import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { createInterface } from 'node:readline'
import type { KernelAction, Settings, UpdateResult, NodeRuntimeKind } from '@shared/types'
import { IS_WIN, broadcast } from './runtime'
import { resolveKernel, nodeRuntimeFor, localNodeNpmCli } from './tools'
import { loadSettings, mt, localKernelDir, bundledNpmDir } from './settings'
import { pushLog, rememberChild, isDshRunning, stopAllDsh, restart } from './dsh'
import { downloadFile } from './downloader'
import { proxyEnv, npmProxyArgs } from './net'
import { isPrerelease, compareVersions, pickLatest, sortVersionsDesc } from './semver'

// ---------------------------------------------------------------------------
// @deepseek-ai/dsh install & version checks (source-aware: local vs global)
// ---------------------------------------------------------------------------

export interface DshInstallInfo {
  present: boolean
  version: string | null
  dir: string | null
  kind: 'local' | 'global'
}

/** Detect whether the kernel chosen by cfg.kernelSource is present and its version. */
export function resolveInstall(cfg: Settings): DshInstallInfo {
  const k = resolveKernel(cfg)
  return { present: k.present, version: k.version, dir: k.moduleDir || null, kind: k.kind }
}

export function kernelInstalled(): boolean {
  return resolveInstall(loadSettings()).present
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
      command: ''
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
    command: ''
  }
}

// ---------------------------------------------------------------------------
// npm invocation (system npm OR bundled npm run under Electron's Node)
// ---------------------------------------------------------------------------

type ToolResult = { ok: boolean; stderrTail: string }

/** Spawn any process and stream stdout/stderr into the log view. */
function runTool(exec: string, argv: string[], label: string, opts: { shell: boolean; env?: NodeJS.ProcessEnv }): Promise<ToolResult> {
  return new Promise((resolve) => {
    pushLog('o', `[Manager] ${label} …`)
    let stderrTail = ''
    let settled = false
    const child = rememberChild(
      spawn(exec, argv, {
        shell: opts.shell,
        windowsHide: true,
        cwd: os.homedir(),
        env: opts.env ?? process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    )
    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line) => {
      pushLog('o', line)
      console.log('[Manager]', line)
    })
    child.stderr!.on('data', (d: Buffer) => {
      const s = d.toString()
      stderrTail = (stderrTail + s).slice(-3000)
      pushLog('e', s)
      console.error('[Manager]', s.replace(/\n/g, '\n[Manager]'))
    })
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      resolve({ ok, stderrTail })
    }
    child.on('error', () => done(false))
    child.on('exit', (code) => {
      if (code === 0) {
        pushLog('o', `[Manager] ${label} completed.`)
        done(true)
      } else {
        pushLog('e', `[Manager] ${label} failed (code=${code}).`)
        done(false)
      }
    })
  })
}

/** Run the system `npm` (npm.cmd on Windows). */
function runNpm(args: string[], label: string): Promise<ToolResult> {
  const cfg = loadSettings()
  const env = { ...process.env, ...proxyEnv(cfg, 'npm') }
  return runTool(IS_WIN ? 'npm.cmd' : 'npm', [...args, ...npmProxyArgs(cfg)], label, { shell: IS_WIN, env })
}

/** Run an npm-cli.js under a Node runtime (used for the bundled / localnode npm). */
function runNpmCli(cli: string, args: string[], label: string, runtime?: NodeRuntimeKind): Promise<ToolResult> {
  const cfg = loadSettings()
  const rt = nodeRuntimeFor(runtime ?? 'electron')
  const env = { ...process.env, ...rt.env, ...proxyEnv(cfg, 'npm') }
  return runTool(rt.exec, [cli, ...args, ...npmProxyArgs(cfg)], label, { shell: false, env })
}

function runNpmInstallGlobal(pkg: string, registry?: 'npmjs' | 'npmmirror'): Promise<ToolResult> {
  const args = ['install', '-g', pkg]
  if (registry) args.push(`--registry=${registryBase(registry)}`)
  return runNpm(args, `npm install -g ${pkg}`)
}

/** Whether a system `npm` is available on PATH (or the Windows global prefix). */
function hasSystemNpm(): boolean {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  if (IS_WIN) {
    dirs.push(path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm'))
    for (const d of dirs) {
      for (const n of ['npm.cmd', 'npm.bat']) {
        if (fs.existsSync(path.join(d, n))) return true
      }
    }
  } else {
    for (const d of dirs) {
      if (fs.existsSync(path.join(d, 'npm'))) return true
    }
  }
  return false
}

/** Resolve the bundled npm's npm-cli.js after it has been fetched + extracted. */
function bundledNpmCli(): string {
  return path.join(bundledNpmDir(), 'package', 'bin', 'npm-cli.js')
}

/** Locate a system `tar` (Windows ships tar.exe in System32). */
function findSystemTar(): string | null {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  const names = IS_WIN ? ['tar.exe', 'tar'] : ['tar']
  if (IS_WIN) dirs.push(path.join(process.env.WINDIR || 'C:\\Windows', 'System32'))
  for (const d of dirs) {
    for (const n of names) {
      const p = path.join(d, n)
      if (fs.existsSync(p)) return p
    }
  }
  return null
}

/**
 * Make the bundled npm available: if it is not already cached in the app dir,
 * fetch a pinned npm tarball from the chosen registry and extract it with a
 * system tar. Once ready its bin is run under Electron's own Node.
 */
async function ensureBundledNpm(cfg: Settings): Promise<{ ok: boolean; cli?: string; message?: string }> {
  const cli = bundledNpmCli()
  if (fs.existsSync(cli)) return { ok: true, cli }
  const base = registryBase(cfg.npmRegistry)
  let version = ''
  try {
    const res = await fetch(`${base}/npm/latest`)
    if (!res.ok) throw new Error('registry')
    const meta = (await res.json()) as { version?: string }
    if (!meta.version) throw new Error('no version')
    version = meta.version
  } catch {
    return { ok: false, message: mt('m.kernel.bundledNpmFetchFail') }
  }
  const npmDir = bundledNpmDir()
  try {
    fs.mkdirSync(npmDir, { recursive: true })
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
  const tgz = path.join(npmDir, `npm-${version}.tgz`)
  try {
    fs.unlinkSync(tgz)
  } catch {
    /* no stale file */
  }
  const dl = await downloadFile({ url: `${base}/npm/-/npm-${version}.tgz`, destDir: npmDir, fileName: `npm-${version}.tgz` })
  if (!dl.ok) {
    return { ok: false, message: mt('m.kernel.bundledNpmFetchFail') }
  }
  const tar = findSystemTar()
  if (!tar) {
    return { ok: false, message: mt('m.kernel.bundledNpmNoTar') }
  }
  const r = spawnSync(tar, ['-xzf', tgz, '-C', npmDir], { encoding: 'utf8' })
  try {
    fs.unlinkSync(tgz)
  } catch {
    /* best effort */
  }
  if (r.status !== 0) return { ok: false, message: mt('m.kernel.bundledNpmExtractFail') }
  if (fs.existsSync(cli)) return { ok: true, cli }
  return { ok: false, message: mt('m.kernel.bundledNpmMissing') }
}

/**
 * Pick the npm to use for a LOCAL install per cfg.npmSource:
 *  - 'system'   : the system npm (error when none).
 *  - 'bundled'  : the bundled npm (fetched/cached on first use).
 *  - 'localnode': the npm bundled with the deployed local Node.
 * `cli === null` means "use the system npm"; otherwise the npm-cli.js path,
 * plus the Node runtime it must run under.
 */
async function chooseLocalNpm(cfg: Settings): Promise<{ ok: boolean; cli: string | null; runtime?: NodeRuntimeKind; message?: string }> {
  if (cfg.npmSource === 'bundled') {
    const b = await ensureBundledNpm(cfg)
    return b.ok && b.cli ? { ok: true, cli: b.cli, runtime: 'electron' } : { ok: false, cli: null, message: b.message }
  }
  if (cfg.npmSource === 'localnode') {
    const cli = localNodeNpmCli()
    if (!cli) return { ok: false, cli: null, message: mt('m.kernel.noLocalNodeNpm') }
    return { ok: true, cli, runtime: 'local' }
  }
  if (hasSystemNpm()) return { ok: true, cli: null }
  return { ok: false, cli: null, message: mt('m.kernel.noSystemNpm') }
}

/** Local install into ~/.config/dsh_shell/kernel via `npm --prefix`. */
async function runLocalNpmInstall(target: string, cfg: Settings): Promise<{ ok: boolean; stderrTail: string; fatal?: string }> {
  const npm = await chooseLocalNpm(cfg)
  if (!npm.ok) return { ok: false, stderrTail: '', fatal: npm.message }
  const kernelDir = localKernelDir()
  try {
    fs.mkdirSync(kernelDir, { recursive: true })
    const pkgFile = path.join(kernelDir, 'package.json')
    if (!fs.existsSync(pkgFile)) {
      fs.writeFileSync(pkgFile, JSON.stringify({ name: 'dsh-shell-kernel', private: true, version: '0.0.0' }, null, 2))
    }
  } catch (err) {
    return { ok: false, stderrTail: '', fatal: err instanceof Error ? err.message : String(err) }
  }
  const args = ['install', '--prefix', kernelDir, '--no-audit', '--no-fund', target]
  if (cfg.npmRegistry) args.push(`--registry=${registryBase(cfg.npmRegistry)}`)
  const label = `npm install ${target} (local)`
  return npm.cli ? runNpmCli(npm.cli, args, label, npm.runtime ?? 'electron') : runNpm(args, label)
}

// ---------------------------------------------------------------------------
// Uninstall-failure diagnosis (global npm only — the module may be locked)
// ---------------------------------------------------------------------------

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
      console.error('[Manager] could not restore module dir after lock probe:', tmp)
    }
  }
  return false
}

async function uninstallDiagnose(dir: string | null, tail: string): Promise<string> {
  const fallback = mt('m.kernel.uninstallFail', { tail: tail.trim() || '...' })
  if (!dir) return fallback

  const dirExists = fs.existsSync(dir)
  let reason: string
  if (dirExists) {
    const holders = IS_WIN ? await detectHolders(dir) : []
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

/** Newest considered published versions (newest first). */
export async function listVersions(opts?: { prerelease?: boolean; registry?: 'npmjs' | 'npmmirror' }): Promise<string[]> {
  const cfg = loadSettings()
  const registry = opts?.registry ?? cfg.npmRegistry
  const versions = await fetchPublishedVersions(registry)
  if (!versions) return []
  return sortVersionsDesc(versions, opts?.prerelease ?? cfg.checkPrerelease)
}

async function resolveTargetVersion(cfg: Settings, registry: 'npmjs' | 'npmmirror'): Promise<string> {
  const versions = await fetchPublishedVersions(registry)
  if (!versions || !versions.length) throw new Error(mt('m.kernel.installNoVersions'))
  const picked = pickLatest(cfg.checkPrerelease ? versions : versions.filter((v) => !isPrerelease(v)))
  if (!picked) throw new Error(mt('m.kernel.installNone'))
  return picked
}

/** Upgrade / install the kernel to the newest (or a specific) version. */
async function installTo(local: boolean, target: string, registry: 'npmjs' | 'npmmirror', cfg: Settings): Promise<KernelAction> {
  const wasRunning = isDshRunning()
  stopAllDsh()
  let result: { ok: boolean; stderrTail: string; fatal?: string }
  if (local) {
    result = await runLocalNpmInstall(`@deepseek-ai/dsh@${target}`, cfg)
  } else {
    result = await runNpmInstallGlobal(`@deepseek-ai/dsh@${target}`, registry)
  }
  if (!result.ok) {
    if (wasRunning) void restart()
    const message =
      result.fatal ??
      (local ? mt('m.kernel.localInstallFail', { tail: result.stderrTail.trim() || '...' }) : mt('m.kernel.installFail', { tail: result.stderrTail.trim() || '...' }))
    return { ok: false, message, version: null }
  }
  void restart() // bring the new/installed kernel up
  return { ok: true, message: mt('m.kernel.installOk', { version: target }), version: target }
}

/** Upgrade to the newest considered version. */
export async function updateKernel(opts?: { registry?: 'npmjs' | 'npmmirror' }): Promise<KernelAction> {
  if (kernelBusy) return busyMsg()
  const cfg = loadSettings()
  const effRegistry = opts?.registry ?? cfg.npmRegistry
  const local = cfg.kernelSource !== 'global'
  const check = await performUpdateCheck(cfg, { prerelease: cfg.checkPrerelease, registry: effRegistry })
  if (check.status !== 'update' || !check.latest) {
    return { ok: false, message: check.message || '', version: null }
  }
  kernelBusy = true
  try {
    return await installTo(local, check.latest, effRegistry, cfg)
  } finally {
    kernelBusy = false
  }
}

/** Install / switch to a version (latest when none given). Fresh installs start dsh. */
export async function installKernel(opts?: { version?: string | null; registry?: 'npmjs' | 'npmmirror' }): Promise<KernelAction> {
  if (kernelBusy) return busyMsg()
  const cfg = loadSettings()
  const registry = opts?.registry ?? cfg.npmRegistry
  const local = cfg.kernelSource !== 'global'
  let target = (opts?.version ?? '').trim()
  if (!target) {
    try {
      target = await resolveTargetVersion(cfg, registry)
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err), version: null }
    }
  }
  kernelBusy = true
  try {
    return await installTo(local, target, registry, cfg)
  } finally {
    kernelBusy = false
  }
}

/** Uninstall the effective kernel. */
export async function uninstallKernel(): Promise<KernelAction> {
  if (kernelBusy) return busyMsg()
  const info = resolveInstall(loadSettings())
  const local = info.kind === 'local'
  kernelBusy = true
  try {
    stopAllDsh()
    if (local) {
      try {
        // Removing the local module dir is enough (npm managed it under our prefix).
        if (info.dir) fs.rmSync(info.dir, { recursive: true, force: true })
        else fs.rmSync(path.join(localKernelDir(), 'node_modules'), { recursive: true, force: true })
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err), version: null }
      }
      broadcast('kernel:missing')
      return { ok: true, message: mt('m.kernel.uninstallOk'), version: null }
    }
    const r = await runNpm(['uninstall', '-g', '@deepseek-ai/dsh'], 'npm uninstall -g @deepseek-ai/dsh')
    if (!r.ok) {
      const message = await uninstallDiagnose(info.dir, r.stderrTail)
      return { ok: false, message, version: null }
    }
    broadcast('kernel:missing')
    return { ok: true, message: mt('m.kernel.uninstallOk'), version: null }
  } finally {
    kernelBusy = false
  }
}
