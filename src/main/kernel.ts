import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { createInterface } from 'node:readline'
import type { KernelAction, Settings, UpdateResult } from '@shared/types'
import { broadcast } from './runtime'
import { resolveDsh } from './tools'
import { loadSettings, mt } from './settings'
import { pushLog, rememberChild, killServer, restart } from './dsh'
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
  kernelBusy = true
  try {
    const target = check.latest
    const r = await runNpmInstall(`@deepseek-ai/dsh@${target}`, effRegistry)
    if (!r.ok) return { ok: false, message: mt('m.kernel.updateFail', { tail: r.stderrTail.trim() || '...' }), version: null }
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
  const wasInstalled = resolveInstall(cfg).present
  kernelBusy = true
  try {
    const r = await runNpmInstall(`@deepseek-ai/dsh@${target}`, registry)
    if (!r.ok) return { ok: false, message: mt('m.kernel.installFail', { tail: r.stderrTail.trim() || '...' }), version: null }
    if (!wasInstalled) void restart() // fresh install → bring up dsh
    return { ok: true, message: mt('m.kernel.installOk', { version: target }), version: target }
  } finally {
    kernelBusy = false
  }
}

/** Uninstall @deepseek-ai/dsh (stops dsh first), then asks the shell to show the install mask. */
export async function uninstallKernel(): Promise<KernelAction> {
  if (kernelBusy) return busyMsg()
  kernelBusy = true
  try {
    killServer()
    const r = await runNpm(['uninstall', '-g', '@deepseek-ai/dsh'], 'npm uninstall -g @deepseek-ai/dsh')
    if (!r.ok) return { ok: false, message: mt('m.kernel.uninstallFail', { tail: r.stderrTail.trim() || '...' }), version: null }
    broadcast('kernel:missing')
    return { ok: true, message: mt('m.kernel.uninstallOk'), version: null }
  } finally {
    kernelBusy = false
  }
}
