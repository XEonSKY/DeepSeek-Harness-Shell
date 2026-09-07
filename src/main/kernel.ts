import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { createInterface } from 'node:readline'
import type { KernelAction, Settings, UpdateResult } from '@shared/types'
import { broadcast } from './runtime'
import { resolveDsh } from './tools'
import { loadSettings, mt } from './settings'
import { pushLog, rememberChild, isDshRunning, stopAllDsh, restart } from './dsh'
import { isPrerelease, compareVersions, pickLatest, sortVersionsDesc } from './semver'

// ---------------------------------------------------------------------------
// @deepseek-ai/dsh install & version checks
// ---------------------------------------------------------------------------

interface DshInstallInfo {
  present: boolean
  version: string | null
  dir: string | null
}

/** Walk upward from a resolved launcher path to find the module's package.json. */
function findDshManifest(startPath: string): { dir: string; version: string } | null {
  let d = path.dirname(startPath)
  for (let i = 0; i < 5; i++) {
    const moduleDir = path.join(d, 'node_modules', '@deepseek-ai', 'dsh')
    const pkg = path.join(moduleDir, 'package.json')
    if (fs.existsSync(pkg)) {
      try {
        const v = (JSON.parse(fs.readFileSync(pkg, 'utf8')) as { version?: string }).version
        if (v) return { dir: moduleDir, version: v }
      } catch {
        /* continue walking */
      }
    }
    // The resolved path might itself point inside the module (e.g. .../lib/bin.js)
    if (path.basename(d) === 'dsh') {
      const pkg = path.join(d, 'package.json')
      if (fs.existsSync(pkg)) {
        try {
          const v = (JSON.parse(fs.readFileSync(pkg, 'utf8')) as { version?: string }).version
          if (v) return { dir: d, version: v }
        } catch {
          /* continue */
        }
      }
    }
    d = path.dirname(d)
  }
  return null
}

/** Detect whether @deepseek-ai/dsh is present and read its installed version. */
export function resolveInstall(cfg: Settings): DshInstallInfo {
  let launcher: string
  try {
    launcher = resolveDsh(cfg.dshBin)
  } catch {
    return { present: false, version: null, dir: null }
  }
  const m = findDshManifest(launcher)
  return m ? { present: true, version: m.version, dir: m.dir } : { present: true, version: null, dir: null }
}

function registryBase(r: 'npmjs' | 'npmmirror'): string {
  return r === 'npmmirror' ? 'https://registry.npmmirror.com' : 'https://registry.npmjs.org'
}

async function fetchPublishedVersions(registry: 'npmjs' | 'npmmirror'): Promise<string[] | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(`${registryBase(registry)}/@deepseek-ai%2Fdsh`, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { versions?: Record<string, unknown> }
    if (!data.versions) return null
    return Object.keys(data.versions)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Run a full install/update check and return a result for the renderer to show. */
export async function performUpdateCheck(
  cfg: Settings,
  opts?: { prerelease?: boolean; registry?: 'npmjs' | 'npmmirror' }
): Promise<UpdateResult> {
  if (opts?.registry && opts.registry !== cfg.npmRegistry) cfg = { ...cfg, npmRegistry: opts.registry }
  const info = resolveInstall(cfg)
  if (!info.present) {
    return {
      status: 'missing',
      current: null,
      latest: null,
      message: mt('m.kernel.missingMsg'),
      command: 'npm install -g @deepseek-ai/dsh'
    }
  }
  if (!info.version) {
    return { status: 'error', current: null, latest: null, message: mt('m.kernel.noVersion') }
  }
  const versions = await fetchPublishedVersions(cfg.npmRegistry)
  if (!versions || versions.length === 0) {
    return {
      status: 'error',
      current: info.version,
      latest: null,
      message: mt('m.kernel.registryUnreachable', { version: info.version })
    }
  }
  // Stable-only by default; when prerelease is requested keep the pre-releases too.
  const pool = opts?.prerelease ? versions : versions.filter((v) => !isPrerelease(v))
  const latest = pickLatest(pool)
  if (!latest) {
    return { status: 'ok', current: info.version, latest: null, message: mt('m.kernel.noComparable') }
  }
  if (compareVersions(info.version, latest) >= 0) {
    return { status: 'ok', current: info.version, latest, message: mt('m.kernel.upToDate', { version: info.version }) }
  }
  const kind = isPrerelease(latest) ? mt('m.kernel.preKind') : mt('m.kernel.stableKind')
  return {
    status: 'update',
    current: info.version,
    latest,
    message: mt('m.kernel.newKind', { kind, current: info.version, latest }),
    command: `npm install -g @deepseek-ai/dsh@${latest}`
  }
}

/**
 * Run an npm global command, streaming output into the app's log view.
 * npm must already be on PATH; global installs go to the user's normal prefix
 * (no admin needed when that prefix is user-writable, e.g. %APPDATA%\npm).
 */
function runNpm(args: string[], label: string): Promise<{ ok: boolean; stderrTail: string }> {
  return new Promise((resolve) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    pushLog('o', `[dsh-desktop] ${label} …`)
    let stderrTail = ''
    let settled = false
    const child = rememberChild(
      spawn(npmCmd, args, {
        shell: process.platform === 'win32',
        windowsHide: true,
        cwd: os.homedir(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    )
    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line) => {
      pushLog('o', line)
      console.log('[npm]', line)
    })
    child.stderr!.on('data', (d: Buffer) => {
      const s = d.toString()
      stderrTail = (stderrTail + s).slice(-3000)
      pushLog('e', s)
      console.error('[npm]', s.replace(/\n/g, '\n[npm]'))
    })
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      resolve({ ok, stderrTail })
    }
    child.on('error', () => done(false))
    child.on('exit', (code) => {
      if (code === 0) {
        pushLog('o', `[dsh-desktop] ${label} completed.`)
        done(true)
      } else {
        pushLog('e', `[dsh-desktop] ${label} failed (code=${code}).`)
        done(false)
      }
    })
  })
}

/** `npm install -g <pkg>`, optionally pinned to a registry mirror. */
function runNpmInstall(pkg: string, registry?: 'npmjs' | 'npmmirror'): Promise<{ ok: boolean; stderrTail: string }> {
  const args = ['install', '-g', pkg]
  if (registry) args.push(`--registry=${registryBase(registry)}`)
  return runNpm(args, `npm install -g ${pkg}`)
}

// ---------------------------------------------------------------------------
// Uninstall-failure diagnosis: when `npm uninstall -g` fails we try to find out
// why the module directory could not be removed (a live process still using it,
// a read-only / locked folder, etc.) and report a concrete, actionable error.
// ---------------------------------------------------------------------------

/**
 * Windows: list running processes whose command line references the dsh module
 * directory (i.e. still launched from it). EncodedCommand is used so the probe's
 * own command line does not contain the needle and match itself. Best effort.
 */
function detectHolders(dir: string): Promise<string[]> {
  return new Promise((resolve) => {
    const escDir = dir.replace(/'/g, "''")
    const script = [
      `$rows = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escDir}*' }`,
      '$rows | Sort-Object ProcessId | Select-Object -First 6 | ForEach-Object {',
      '  $c = $_.CommandLine; if ($c -and $c.Length -gt 160) { $c = $c.Substring(0, 160) }',
      '  Write-Output ("{0} {1} :: {2}" -f $_.ProcessId, $_.Name, $c)',
      '}'
    ].join('\n')
    const child = rememberChild(
      spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
        windowsHide: true,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    )
    let out = ''
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }, 8000)
    child.stdout!.on('data', (d: Buffer) => {
      if (out.length < 6000) out += d.toString()
    })
    child.stderr!.on('data', () => {
      /* ignore */
    })
    const done = (): void => {
      clearTimeout(timer)
      resolve(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
    }
    child.on('error', done)
    child.on('exit', done)
  })
}

/**
 * Probe whether the module directory is locked / not removable: renaming a
 * directory whose contents are open (or that is read-only / held) fails on
 * Windows. The rename is immediately reversed; returns true when locked.
 */
function probeDirInUse(dir: string): boolean {
  const tmp = `${dir}.~uninstall-probe-${Date.now()}`
  try {
    fs.renameSync(dir, tmp)
  } catch {
    return true
  }
  try {
    fs.renameSync(tmp, dir)
  } catch {
    try {
      fs.renameSync(tmp, dir)
    } catch {
      console.error('[dsh-desktop] could not restore module dir after lock probe:', tmp)
    }
  }
  return false
}

/** Compose a localized, cause-specific message for a failed uninstall. */
async function uninstallDiagnose(dir: string | null, tail: string): Promise<string> {
  const fallback = mt('m.kernel.uninstallFail', { tail: tail.trim() || '...' })
  if (!dir) return fallback

  const dirExists = fs.existsSync(dir)
  let reason: string
  if (dirExists) {
    const holders = process.platform === 'win32' ? await detectHolders(dir) : []
    if (holders.length) {
      reason = mt('m.kernel.uninstallReasonHolder', { procs: holders.slice(0, 5).join('；') })
    } else if (probeDirInUse(dir)) {
      reason = mt('m.kernel.uninstallReasonLocked')
    } else {
      reason = mt('m.kernel.uninstallReasonPresent')
    }
  } else {
    reason = mt('m.kernel.uninstallReasonRemoved')
  }
  return mt('m.kernel.uninstallDiag', { reason, tail: tail.trim() || '...' })
}

let kernelBusy = false
function busyMsg(): KernelAction {
  return { ok: false, message: mt('m.kernel.busy'), version: null }
}

export function kernelInstalled(): boolean {
  return resolveInstall(loadSettings()).present
}

/** Newest considered published versions (newest first). */
export async function listVersions(opts?: { prerelease?: boolean; registry?: 'npmjs' | 'npmmirror' }): Promise<string[]> {
  const cfg = loadSettings()
  const registry = opts?.registry ?? cfg.npmRegistry
  const versions = await fetchPublishedVersions(registry)
  if (!versions) return []
  return sortVersionsDesc(versions, opts?.prerelease ?? cfg.checkPrerelease)
}

/** Upgrade to the newest considered version via npm install -g. */
export async function updateKernel(opts?: { registry?: 'npmjs' | 'npmmirror' }): Promise<KernelAction> {
  if (kernelBusy) return busyMsg()
  const cfg = loadSettings()
  const effRegistry = opts?.registry ?? cfg.npmRegistry
  const check = await performUpdateCheck(cfg, { prerelease: cfg.checkPrerelease, registry: effRegistry })
  if (check.status !== 'update' || !check.latest) {
    return { ok: false, message: check.message || '', version: null }
  }
  const target = check.latest
  // A live dsh process would lock the module files, so force-close every dsh
  // instance before npm swaps the kernel. If one was running we restore it
  // afterwards so a failed upgrade does not leave the shell serverless.
  const wasRunning = isDshRunning()
  stopAllDsh()
  kernelBusy = true
  try {
    const r = await runNpmInstall(`@deepseek-ai/dsh@${target}`, effRegistry)
    if (!r.ok) {
      if (wasRunning) void restart()
      return { ok: false, message: mt('m.kernel.updateFail', { tail: r.stderrTail.trim() || '...' }), version: null }
    }
    void restart() // bring the newly upgraded kernel up
    return { ok: true, message: mt('m.kernel.updateOk', { version: target }), version: target }
  } finally {
    kernelBusy = false
  }
}

/** Install / switch to a version (latest when none given). Fresh installs start dsh. */
export async function installKernel(opts?: { version?: string | null; registry?: 'npmjs' | 'npmmirror' }): Promise<KernelAction> {
  if (kernelBusy) return busyMsg()
  const cfg = loadSettings()
  const registry = opts?.registry ?? cfg.npmRegistry
  let target = (opts?.version ?? '').trim()
  if (!target) {
    const versions = await fetchPublishedVersions(registry)
    if (!versions || !versions.length) return { ok: false, message: mt('m.kernel.installNoVersions'), version: null }
    const picked = pickLatest(cfg.checkPrerelease ? versions : versions.filter((v) => !isPrerelease(v)))
    target = picked || ''
    if (!target) return { ok: false, message: mt('m.kernel.installNone'), version: null }
  }
  // Same as update: a running dsh locks the module, so shut every instance down
  // first. If one was running and the install fails we restart the old kernel;
  // on success we restart so the newly (re)installed version becomes active.
  const wasRunning = isDshRunning()
  stopAllDsh()
  kernelBusy = true
  try {
    const r = await runNpmInstall(`@deepseek-ai/dsh@${target}`, registry)
    if (!r.ok) {
      if (wasRunning) void restart()
      return { ok: false, message: mt('m.kernel.installFail', { tail: r.stderrTail.trim() || '...' }), version: null }
    }
    void restart() // fresh install → bring up dsh; switch → run the new version
    return { ok: true, message: mt('m.kernel.installOk', { version: target }), version: target }
  } finally {
    kernelBusy = false
  }
}

/** Uninstall @deepseek-ai/dsh (stops dsh first), then asks the shell to show the install mask. */
export async function uninstallKernel(): Promise<KernelAction> {
  if (kernelBusy) return busyMsg()
  // Remember where the module lives now; on failure we inspect that path to
  // detect what is still occupying it.
  const dir = resolveInstall(loadSettings()).dir
  kernelBusy = true
  try {
    stopAllDsh()
    const r = await runNpm(['uninstall', '-g', '@deepseek-ai/dsh'], 'npm uninstall -g @deepseek-ai/dsh')
    if (!r.ok) {
      // Diagnose the occupation cause and return a concrete, actionable error.
      const message = await uninstallDiagnose(dir, r.stderrTail)
      return { ok: false, message, version: null }
    }
    broadcast('kernel:missing')
    return { ok: true, message: mt('m.kernel.uninstallOk'), version: null }
  } finally {
    kernelBusy = false
  }
}
