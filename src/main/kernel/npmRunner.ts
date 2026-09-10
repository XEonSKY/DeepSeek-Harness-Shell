import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { createInterface } from 'node:readline'
import type { NodeRuntimeKind, Settings } from '@shared/types'
import { IS_WIN } from '../app/runtime'
import { loadSettings, mt, localKernelDir, bundledNpmDir } from '../app/settings'
import { nodeRuntimeFor, localNodeNpmCli, pathEnv, findInDirs } from './tools'
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

/** Locate a system `tar` (Windows ships tar.exe in System32). */
function findSystemTar(): string | null {
  const dirs = pathEnv()
  const names = IS_WIN ? ['tar.exe', 'tar'] : ['tar']
  if (IS_WIN) dirs.push(path.join(process.env.WINDIR || 'C:\\Windows', 'System32'))
  return findInDirs(dirs, names) ?? null
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
