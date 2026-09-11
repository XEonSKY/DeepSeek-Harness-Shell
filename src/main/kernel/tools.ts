import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { IS_WIN } from '../app/runtime'
import { localKernelDir, configDir } from '../app/settings'
import type { NodeRuntimeKind } from '@shared/types'

/**
 * Kernel / tooling location helpers.
 *
 * The @deepseek-ai/dsh kernel may come from two places:
 *   - local ('local', default): installed by this app into ~/.config/dsh_shell/kernel
 *     and run with Electron's own bundled Node (no system node needed).
 *   - global ('global'): the system `npm install -g @deepseek-ai/dsh`, found on PATH.
 *
 * Either way we launch the kernel by running its real JS bin entry under a Node
 * runtime we pick, instead of a shell `.cmd` shim, so the whole lifecycle can run
 * under Electron's Node.
 */

/** PATH 上的目录列表（去掉空项）。供各处定位系统工具复用。 */
export function pathEnv(): string[] {
    return (process.env.PATH || '').split(path.delimiter).filter(Boolean)
}

/** 在若干目录里按名称顺序找第一个存在的文件；找到返回绝对路径，否则 undefined。 */
export function findInDirs(dirs: string[], names: string[]): string | undefined {
    for (const dir of dirs) {
        for (const n of names) {
            const p = path.join(dir, n)
            if (fs.existsSync(p)) return p
        }
    }
    return undefined
}

/** Where the app-managed (local) kernel is installed. */
export function localDshModuleDir(): string {
    return path.join(localKernelDir(), 'node_modules', '@deepseek-ai', 'dsh')
}

function readPkgVersion(moduleDir: string): string | null {
    try {
        const v = (
            JSON.parse(fs.readFileSync(path.join(moduleDir, 'package.json'), 'utf8')) as { version?: string }
        ).version
        return v || null
    } catch {
        return null
    }
}

/**
 * Resolve the JS bin entry of a package from its module dir (reads package.json
 * `bin`, preferring the entry mapped to `dsh`, falling back to `main`).
 */
export function resolveModuleBin(moduleDir: string): string | null {
    let pkg: { bin?: unknown; main?: string }
    try {
        pkg = JSON.parse(fs.readFileSync(path.join(moduleDir, 'package.json'), 'utf8')) as {
            bin?: unknown
            main?: string
        }
    } catch {
        return null
    }
    let rel: string | null = null
    const bin = pkg.bin
    if (typeof bin === 'string') {
        rel = bin
    } else if (bin && typeof bin === 'object') {
        const map = bin as Record<string, string>
        const pick = Object.keys(map).find((k) => k === 'dsh') ?? Object.keys(map)[0]
        if (pick) rel = map[pick]
    }
    const candidates = [rel, pkg.main ?? null].filter((c): c is string => !!c)
    for (const c of candidates) {
        const abs = path.resolve(moduleDir, c)
        if (fs.existsSync(abs)) return abs
    }
    return null
}

/**
 * Walk upward from a resolved launcher path to find the @deepseek-ai/dsh module
 * directory (used for the global install, whose launcher lives in the npm prefix).
 */
function findDshModule(startPath: string): { dir: string; version: string } | null {
    let d = path.dirname(startPath)
    for (let i = 0; i < 5; i++) {
        const moduleDir = path.join(d, 'node_modules', '@deepseek-ai', 'dsh')
        if (fs.existsSync(path.join(moduleDir, 'package.json'))) {
            const version = readPkgVersion(moduleDir)
            if (version) return { dir: moduleDir, version }
        }
        // The resolved path might itself point inside the module (e.g. .../bin.js).
        if (path.basename(d) === 'dsh' && fs.existsSync(path.join(d, 'package.json'))) {
            const version = readPkgVersion(d)
            if (version) return { dir: d, version }
        }
        d = path.dirname(d)
    }
    return null
}

/** Resolve the global `dsh` launcher on PATH (throws when absent). */
export function resolveDsh(configured: string | null): string {
    if (configured) {
        if (!fs.existsSync(configured)) throw new Error(`DSH_BIN / settings.dshBin points at a missing file: ${configured}`)
        return configured
    }
    const want = IS_WIN ? ['dsh.cmd', 'dsh.bat', 'dsh.exe', 'dsh'] : ['dsh']
    const hit = findInDirs(pathEnv(), want)
    if (hit) return hit
    if (IS_WIN) {
        const npm = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm')
        const g = findInDirs([npm], ['dsh.cmd', 'dsh.bat'])
        if (g) return g
    }
    throw new Error('Could not find the `dsh` CLI on PATH. Install it with:\n  npm install -g @deepseek-ai/dsh\nor set DSH_BIN to the launcher path.')
}

/** What we know about the currently effective kernel for a given setting. */
export interface DshKernel {
    kind: 'local' | 'global'
    present: boolean
    /** @deepseek-ai/dsh module directory ('' when unknown). */
    moduleDir: string
    version: string | null
    /** Absolute JS bin entry to run the CLI (null when not present). */
    entry: string | null
}

/** Resolve presence / version / bin entry of the kernel chosen by cfg.kernelSource. */
export function resolveKernel(cfg: { kernelSource?: 'local' | 'global'; dshBin?: string | null }): DshKernel {
    if (cfg.kernelSource === 'global') {
        let launcher: string
        try {
            launcher = resolveDsh(cfg.dshBin ?? null)
        } catch {
            return { kind: 'global', present: false, moduleDir: '', version: null, entry: null }
        }
        const m = findDshModule(launcher)
        if (!m) return { kind: 'global', present: true, moduleDir: '', version: null, entry: null }
        return { kind: 'global', present: true, moduleDir: m.dir, version: m.version, entry: resolveModuleBin(m.dir) }
    }
    const moduleDir = localDshModuleDir()
    const present = fs.existsSync(path.join(moduleDir, 'package.json'))
    const version = present ? readPkgVersion(moduleDir) : null
    const entry = present ? resolveModuleBin(moduleDir) : null
    return { kind: 'local', present, moduleDir, version, entry }
}

/** Locate the system `node` binary on PATH / common install dirs. */
export function findSystemNode(): string | null {
    const want = IS_WIN ? ['node.exe'] : ['node']
    const dirs = pathEnv()
    if (IS_WIN) dirs.push('C:\\Program Files\\nodejs', 'C:\\Program Files (x86)\\nodejs')
    return findInDirs(dirs, want) ?? null
}

/** Locate the system `npm` launcher on PATH / the Windows global prefix. */
export function findSystemNpm(): string | null {
    const want = IS_WIN ? ['npm.cmd', 'npm.bat'] : ['npm']
    const dirs = pathEnv()
    if (IS_WIN) dirs.push(path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm'))
    return findInDirs(dirs, want) ?? null
}

/** Ask a node binary for its version (`node --version`), best effort. */
export function nodeVersionOf(nodePath: string): Promise<string | null> {
    return new Promise((resolve) => {
        let out = ''
        try {
            const p = spawn(nodePath, ['--version'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
            p.stdout!.on('data', (d: Buffer) => {
                if (out.length < 64) out += d.toString()
            })
            p.on('error', () => resolve(null))
            p.on('exit', (code) => {
                resolve(code === 0 && out.trim() ? out.trim() : null)
            })
        } catch {
            resolve(null)
        }
    })
}

/**
 * The Node runtime used to execute the watchdog, the local kernel and any bundled
 * tooling.
 */
export interface NodeRuntime {
    exec: string
    env: Record<string, string>
}

/** 应用按架构下载部署到配置目录的 Node 可执行文件（<configDir>/node）。 */
export function localNodeExecPath(): string | null {
    const base = path.join(configDir(), 'node')
    const exec = IS_WIN ? path.join(base, 'node.exe') : path.join(base, 'bin', 'node')
    return fs.existsSync(exec) ? exec : null
}

/** 部署的本地 Node 自带的 npm-cli（不存在返回 null）。 */
export function localNodeNpmCli(): string | null {
    const base = path.join(configDir(), 'node')
    const candidates = IS_WIN
        ? [path.join(base, 'node_modules', 'npm', 'bin', 'npm-cli.js')]
        : [path.join(base, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')]
    for (const c of candidates) {
        if (fs.existsSync(c)) return c
    }
    return null
}

/** 按选择的运行时返回 Node 运行方式（不存在时抛错）。 */
export function nodeRuntimeFor(kind: NodeRuntimeKind): NodeRuntime {
    if (kind === 'system') {
        const p = findSystemNode()
        if (!p) throw new Error('System Node is required but was not found on PATH.')
        return { exec: p, env: {} }
    }
    if (kind === 'local') {
        const p = localNodeExecPath()
        if (!p) throw new Error('No locally deployed Node found. Deploy one under the config directory first.')
        return { exec: p, env: {} }
    }
    return { exec: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } }
}

/** 依据设置（可选 DSH_NODE 环境覆盖）解析运行 dsh/npm 的 Node。 */
export function nodeRuntimeForCfg(cfg?: { nodeRuntime?: NodeRuntimeKind }): NodeRuntime {
    const override = process.env.DSH_NODE
    if (override) {
        if (!fs.existsSync(override)) throw new Error(`DSH_NODE points at a missing file: ${override}`)
        return { exec: override, env: {} }
    }
    return nodeRuntimeFor(cfg?.nodeRuntime ?? 'electron')
}
