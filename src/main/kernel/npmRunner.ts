import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { createInterface } from 'node:readline'
import type { NodeRuntimeKind, NpmRuntimeStatus, NpmSource, NpmStatus, Settings, ToolActionResult } from '@shared/types'
import { IS_WIN } from '../app/runtime'
import { loadSettings, mt, localKernelDir, bundledNpmDir } from '../app/settings'
import { nodeRuntimeFor, localNodeNpmCli, findSystemNpm, pathEnv, findInDirs } from './tools'
import { localNodeDir } from './nodeenv'
import { compareVersions, stripV, sortVersionsDesc } from './semver'
import { pushLog, rememberChild } from './dsh'
import { downloadFile } from './downloader'
import { proxyEnv, npmProxyArgs } from './net'

/**
 * npm / 外部工具的调用层：如何按所选来源（系统 npm、内置 npm、本地 Node 自带 npm）
 * 与代理设置真正把命令跑起来，并把输出接进日志视图。
 *
 * 从 kernel.ts 抽出：kernel.ts 负责「装哪个版本、装到哪、失败怎么诊断」，
 * 本模块只负责「怎么把它们跑起来」——两者关注点不同，分开后各自更好读。
 */

export type ToolResult = { ok: boolean; stderrTail: string }

/** npm registry 的 URL 基址（安装/查询都走这里）。 */
export function registryBase(r: 'npmjs' | 'npmmirror'): string {
  return r === 'npmmirror' ? 'https://registry.npmmirror.com' : 'https://registry.npmjs.org'
}

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
export function runNpm(args: string[], label: string): Promise<ToolResult> {
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

export function runNpmInstallGlobal(pkg: string, registry?: 'npmjs' | 'npmmirror'): Promise<ToolResult> {
  const args = ['install', '-g', pkg]
  if (registry) args.push(`--registry=${registryBase(registry)}`)
  return runNpm(args, `npm install -g ${pkg}`)
}

/** Whether a system `npm` is available on PATH (or the Windows global prefix). */
function hasSystemNpm(): boolean {
  const dirs = pathEnv()
  if (IS_WIN) {
    dirs.push(path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm'))
    return findInDirs(dirs, ['npm.cmd', 'npm.bat']) !== undefined
  }
  return findInDirs(dirs, ['npm']) !== undefined
}

/** Resolve the bundled npm's npm-cli.js after it has been fetched + extracted. */
function bundledNpmCli(): string {
  return path.join(bundledNpmDir(), 'package', 'bin', 'npm-cli.js')
}

// ---- 版本探测 / 列表（安静：不写日志视图）----------------------------------
// 环境页每次进入都要问版本，**绝不能**走 runTool（它把输出推进终端日志，会刷屏）。

/** 安静地跑一次命令取版本号。 */
function quietVersion(exec: string, argv: string[], shell: boolean, env?: NodeJS.ProcessEnv): Promise<string | null> {
  return new Promise((resolve) => {
    let out = ''
    try {
      const child = spawn(exec, argv, { shell, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: env ?? process.env })
      child.stdout!.on('data', (d: Buffer) => {
        if (out.length < 64) out += d.toString()
      })
      child.on('error', () => resolve(null))
      child.on('exit', (code) => resolve(code === 0 && out.trim() ? out.trim() : null))
    } catch {
      resolve(null)
    }
  })
}

/** 内置 npm 跑在 Electron 自带的 Node 上（与 chooseLocalNpm 的 runtime: 'electron' 一致）。 */
function electronNode(): { exec: string; env: NodeJS.ProcessEnv } {
  return { exec: process.execPath, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
}

/** 系统 npm 的版本（没有系统 npm → null）。 */
function systemNpmVersion(): Promise<string | null> {
  const p = findSystemNpm()
  if (!p) return Promise.resolve(null)
  // Windows 上 .cmd 必须经 shell 启动，而 shell 模式下**带空格的路径**会被拆成两段，
  // 所以显式加引号（npm 常装在 C:\Program Files\nodejs 下）。
  return quietVersion(IS_WIN ? `"${p}"` : p, ['--version'], IS_WIN)
}

/** 内置 npm 的版本（尚未下载到配置目录 → null）。 */
function bundledNpmVersion(): Promise<string | null> {
  const cli = bundledNpmCli()
  if (!fs.existsSync(cli)) return Promise.resolve(null)
  const n = electronNode()
  return quietVersion(n.exec, [cli, '--version'], false, n.env)
}

/** 本地部署 Node 自带 npm 的版本（未部署本地 Node → null）。 */
function localNodeNpmVersion(): Promise<string | null> {
  const cli = localNodeNpmCli()
  if (!cli) return Promise.resolve(null)
  try {
    const rt = nodeRuntimeFor('local')
    return quietVersion(rt.exec, [cli, '--version'], false, { ...process.env, ...rt.env })
  } catch {
    return Promise.resolve(null)
  }
}

/**
 * registry 元数据的短缓存（键含 registry，换源后不串味）。
 * npm 的 packument 动辄几 MB，不能每次进设置页都拉；**失败不缓存**。
 */
const REG_TTL_MS = 10 * 60 * 1000
let latestCache: { key: string; at: number; version: string | null } | null = null
let listCache: { key: string; at: number; list: string[] } | null = null

/** registry 上的最新 npm 版本（失败返回 null，不缓存失败）。 */
export async function npmLatestVersion(cfg: Settings): Promise<string | null> {
  const key = cfg.npmRegistry
  if (latestCache && latestCache.key === key && Date.now() - latestCache.at < REG_TTL_MS) {
    return latestCache.version
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(`${registryBase(key)}/npm/latest`, { signal: ctrl.signal })
    if (!res.ok) return null
    const meta = (await res.json()) as { version?: unknown }
    if (typeof meta.version !== 'string' || !meta.version) return null
    latestCache = { key, at: Date.now(), version: meta.version }
    return meta.version
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 可安装的 npm 版本列表（新 → 旧）。
 * 用 registry 的**缩写元数据**（`application/vnd.npm.install-v1+json`）：完整 packument 有好几 MB，
 * 缩写版小得多；结果按 registry 缓存 10 分钟（失败不缓存）。
 */
export async function listNpmVersions(cfg: Settings, prerelease: boolean): Promise<string[]> {
  const key = cfg.npmRegistry
  let all: string[]
  if (listCache && listCache.key === key && Date.now() - listCache.at < REG_TTL_MS) {
    all = listCache.list
  } else {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30000)
    try {
      const res = await fetch(`${registryBase(key)}/npm`, {
        signal: ctrl.signal,
        headers: { accept: 'application/vnd.npm.install-v1+json' }
      })
      if (!res.ok) return []
      const meta = (await res.json()) as { versions?: Record<string, unknown> }
      const keys = meta.versions ? Object.keys(meta.versions) : []
      if (keys.length === 0) return []
      all = keys
      listCache = { key, at: Date.now(), list: keys }
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }
  return sortVersionsDesc(all, prerelease)
}

/** 三个 npm 来源的当前版本 + registry 最新版（设置 → 环境页）。 */
export async function npmStatus(): Promise<NpmStatus> {
  const cfg = loadSettings()
  const [latest, system, bundled, localnode] = await Promise.all([
    npmLatestVersion(cfg),
    systemNpmVersion(),
    bundledNpmVersion(),
    localNodeNpmVersion()
  ])
  const mk = (version: string | null): NpmRuntimeStatus => ({
    present: !!version,
    version,
    outdated: !!version && !!latest && compareVersions(stripV(version), stripV(latest)) < 0
  })
  return { latest, system: mk(system), bundled: mk(bundled), localnode: mk(localnode) }
}

/** Locate a system `tar` (Windows ships tar.exe in System32). */
function findSystemTar(): string | null {
  const dirs = pathEnv()
  const names = IS_WIN ? ['tar.exe', 'tar'] : ['tar']
  if (IS_WIN) dirs.push(path.join(process.env.WINDIR || 'C:\\Windows', 'System32'))
  return findInDirs(dirs, names) ?? null
}

/**
 * Make the bundled npm available: if it is not already cached, fetch a pinned
 * npm tarball from the chosen registry and extract it with a system tar. Once
 * ready its bin is run under Electron's own Node.
 *
 * `version` 指定要装哪个版本（设置页「切换版本」用）；**不传时保持原语义** —— 已缓存就直接用，
 * 内核安装路径不该因为缓存版本旧就重新下载。
 */
async function ensureBundledNpm(
  cfg: Settings,
  version?: string
): Promise<{ ok: boolean; cli?: string; message?: string }> {
  const cli = bundledNpmCli()
  if (fs.existsSync(cli) && version === undefined) return { ok: true, cli }

  const target = version ?? (await npmLatestVersion(cfg))
  if (!target) return { ok: false, message: mt('m.kernel.bundledNpmFetchFail') }
  // 已经就是这个版本 → 空操作。
  if (fs.existsSync(cli)) {
    const cur = await bundledNpmVersion()
    if (cur && stripV(cur) === stripV(target)) return { ok: true, cli }
  }

  const base = registryBase(cfg.npmRegistry)
  const npmDir = bundledNpmDir()
  // 先在临时目录里下载解压，成功后再整体换上去 —— 直接解压到自己身上，一旦下载或解压失败
  // 会把原本能用的缓存 npm 破坏掉（与 Node 换版本同一个道理）。
  const stage = path.join(path.dirname(npmDir), '.npm-tmp')
  try {
    fs.rmSync(stage, { recursive: true, force: true })
    fs.mkdirSync(stage, { recursive: true })
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
  const tgz = path.join(stage, `npm-${target}.tgz`)
  const dl = await downloadFile({ url: `${base}/npm/-/npm-${target}.tgz`, destDir: stage, fileName: `npm-${target}.tgz` })
  if (!dl.ok) {
    fs.rmSync(stage, { recursive: true, force: true })
    return { ok: false, message: mt('m.kernel.bundledNpmFetchFail') }
  }
  const tar = findSystemTar()
  if (!tar) {
    fs.rmSync(stage, { recursive: true, force: true })
    return { ok: false, message: mt('m.kernel.bundledNpmNoTar') }
  }
  const r = spawnSync(tar, ['-xzf', tgz, '-C', stage], { encoding: 'utf8' })
  const entry = path.join(stage, 'package', 'bin', 'npm-cli.js')
  if (r.status !== 0 || !fs.existsSync(entry)) {
    fs.rmSync(stage, { recursive: true, force: true })
    return { ok: false, message: r.status === 0 ? mt('m.kernel.bundledNpmMissing') : mt('m.kernel.bundledNpmExtractFail') }
  }
  try {
    fs.unlinkSync(tgz)
  } catch {
    /* best effort */
  }

  // 换上去：旧的先改名挪开，失败则回滚，别让用户既没有旧的也没有新的。
  const backup = `${npmDir}.old`
  fs.rmSync(backup, { recursive: true, force: true })
  if (fs.existsSync(npmDir)) {
    try {
      fs.renameSync(npmDir, backup)
    } catch {
      fs.rmSync(stage, { recursive: true, force: true })
      return { ok: false, message: mt('m.kernel.bundledNpmExtractFail') }
    }
  }
  try {
    fs.renameSync(stage, npmDir)
  } catch (err) {
    try {
      fs.rmSync(npmDir, { recursive: true, force: true })
      if (fs.existsSync(backup)) fs.renameSync(backup, npmDir)
    } catch {
      /* 回滚也失败：备份仍在 <configDir>/npm.old，留给用户手工恢复 */
    }
    fs.rmSync(stage, { recursive: true, force: true })
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
  fs.rmSync(backup, { recursive: true, force: true })
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
export async function runLocalNpmInstall(target: string, cfg: Settings): Promise<{ ok: boolean; stderrTail: string; fatal?: string }> {
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

/**
 * 把 npm 的失败输出整理成一句能照着做的提示。
 * 权限类错误（EPERM/EACCES）最常见的原因是：npm 的全局 prefix 指向了系统 Node 目录
 * （`C:\Program Files\nodejs`），在 Windows 上写它需要管理员权限。
 */
function npmFailMessage(tail: string): string {
  const t = (tail || '').trim()
  if (/EPERM|EACCES/i.test(t)) {
    return '权限不足（EPERM）：npm 需要写入受保护的目录。这通常是因为全局 prefix 指向了系统 Node 目录 —— 系统来源需要以管理员身份运行，或改用「程序内置 / 本机 Node 自带」把包装进配置目录。'
  }
  return t.slice(-400) || 'npm 执行失败。'
}

/**
 * 按来源下载 / 切换 npm 版本（不传 `version` 为最新版）。设置页「环境 → npm 来源」用。
 *
 *  - `bundled`  ：拉 tarball 解压缓存到 `<configDir>/npm`（应用代管）；
 *  - `system`   ：交给**系统 npm 自己**执行 `npm install -g npm@<版本>` —— 这是 npm 官方的自更新
 *                 方式，但会**真实改动系统全局 npm**（这是设置页上明说过的）；
 *  - `localnode`：用本地 Node 的 npm 装进 `<configDir>/node`，应用代管。
 *
 * 后两者会把过程输出接进终端日志（复用 runNpm / runNpmCli 的既有行为），捆绑下载则只看结果。
 */
export async function updateNpm(opts: { source: NpmSource; version?: string }): Promise<ToolActionResult> {
  const cfg = loadSettings()
  const target = opts.version ?? (await npmLatestVersion(cfg))
  if (!target) return { ok: false, message: mt('m.kernel.bundledNpmFetchFail'), version: null }
  // 版本号会被拼进下载 URL 与 npm 参数，必须挡住意外/恶意字符串。
  if (!/^\d+\.\d+\.\d+/.test(target)) return { ok: false, message: `npm 版本号不合法：${target}`, version: null }

  if (opts.source === 'bundled') {
    const r = await ensureBundledNpm(cfg, target)
    return r.ok
      ? { ok: true, message: `npm ${target} 已缓存到配置目录`, version: target }
      : { ok: false, message: r.message ?? mt('m.kernel.bundledNpmFetchFail'), version: target }
  }

  if (opts.source === 'localnode') {
    const cli = localNodeNpmCli()
    if (!cli) return { ok: false, message: mt('m.kernel.noLocalNodeNpm'), version: null }
    /**
     * **必须显式钉住 `--prefix`**：npm 全局 prefix 默认取 node 可执行文件所在目录，但会被用户级
     * `~/.npmrc` 的 `prefix=` 或 `npm_config_prefix` 环境变量覆盖 —— 那样它就会去写系统 Node 目录
     * （Windows 上是 `C:\Program Files\nodejs`），非管理员直接 EPERM。命令行参数优先级高于两者。
     */
    const r = await runNpmCli(
      cli,
      ['install', '-g', `npm@${target}`, '--prefix', localNodeDir()],
      `npm install -g npm@${target} (local node)`,
      'local'
    )
    return r.ok
      ? { ok: true, message: `npm ${target} 已装入本地 Node`, version: target }
      : { ok: false, message: npmFailMessage(r.stderrTail), version: target }
  }

  if (!hasSystemNpm()) return { ok: false, message: mt('m.kernel.noSystemNpm'), version: null }
  const r = await runNpm(['install', '-g', `npm@${target}`], `npm install -g npm@${target}`)
  return r.ok
    ? { ok: true, message: `npm ${target} 已更新`, version: target }
    : { ok: false, message: npmFailMessage(r.stderrTail), version: target }
}
