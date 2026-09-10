import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import type { NodeDeployResult, NodeRuntimeStatus, NodeStatus } from '@shared/types'
import { configDir, loadSettings } from '../app/settings'
import { isDshRunning, pushLog, rememberChild } from './dsh'
import { findSystemNode, localNodeExecPath, nodeVersionOf } from './tools'
import { compareVersions, stripV } from './semver'
import { downloadFile } from './downloader'
import type { DlProgress } from './downloader'

/**
 * 按当前平台 / 架构下载 Node.js LTS 发行包并解压到配置目录的 `node` 子目录，
 * 供 `nodeRuntime: 'local'` 使用。平台名/扩展名/内部目录均按 Node 官方发行命名。
 */

const NODE_DIST = 'https://nodejs.org/dist'

function nodeOs(): string {
  if (process.platform === 'win32') return 'win'
  if (process.platform === 'darwin') return 'darwin'
  return 'linux'
}

function extOf(): string {
  return nodeOs() === 'win' ? 'zip' : 'tar.gz'
}

/** 本地部署的 Node 根目录：<configDir>/node。 */
export function localNodeDir(): string {
  return path.join(configDir(), 'node')
}

/**
 * 发行索引（index.json，新 → 旧）的短缓存。设置页每次进入「环境」都要拿版本列表，
 * 而该文件有几百 KB；10 分钟内复用。**失败不写缓存** —— 否则一次网络抖动会让版本列表空锁 10 分钟。
 */
const DIST_TTL_MS = 10 * 60 * 1000

interface NodeRelease {
  version: string
  lts: boolean
}

let distCache: { at: number; list: NodeRelease[] } | null = null

/** 取官方发行索引（新 → 旧）；失败返回 null（失败不缓存）。 */
async function nodeDistIndex(): Promise<NodeRelease[] | null> {
  if (distCache && Date.now() - distCache.at < DIST_TTL_MS) return distCache.list
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(`${NODE_DIST}/index.json`, { signal: ctrl.signal })
    if (!res.ok) return null
    const arr = (await res.json()) as Array<{ version?: unknown; lts?: unknown }>
    const list: NodeRelease[] = []
    for (const x of arr) {
      if (typeof x.version === 'string') list.push({ version: x.version, lts: !!x.lts })
    }
    if (list.length === 0) return null
    distCache = { at: Date.now(), list }
    return list
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 从官方 index.json 取最新 LTS 版本号（如 v22.14.0）。 */
export async function latestLtsVersion(): Promise<string | null> {
  const list = await nodeDistIndex()
  return list?.find((x) => x.lts)?.version ?? null
}

/** 可安装的 Node 版本列表（新 → 旧）；`includeNonLts=false` 时只给 LTS。 */
export async function listNodeVersions(includeNonLts: boolean): Promise<string[]> {
  const list = await nodeDistIndex()
  if (!list) return []
  return list.filter((x) => includeNonLts || x.lts).map((x) => x.version)
}

/**
 * 系统 / 本地部署 Node 的当前版本 + 与最新 LTS 的对比（设置 → 环境页）。
 *
 * 版本比较放主进程做：`semver` 是 main 的运行时依赖，渲染层不该引它；
 * 比较结果比原始字符串更不容易被前端各写一份而漂移。
 */
export async function nodeStatus(): Promise<NodeStatus> {
  const sysPath = findSystemNode()
  const localPath = localNodeExecPath()
  const [systemVersion, localVersion, latest] = await Promise.all([
    sysPath ? nodeVersionOf(sysPath) : Promise.resolve(null),
    localPath ? nodeVersionOf(localPath) : Promise.resolve(null),
    latestLtsVersion()
  ])
  const mk = (version: string | null, present: boolean): NodeRuntimeStatus => ({
    present,
    version,
    outdated: !!version && !!latest && compareVersions(stripV(version), stripV(latest)) < 0
  })
  return { latest, system: mk(systemVersion, !!sysPath), local: mk(localVersion, !!localPath) }
}

/** 跑一个子进程并把输出写进日志，返回是否成功。 */
function run(exec: string, argv: string[], label: string): Promise<boolean> {
  return new Promise((resolve) => {
    pushLog('o', `[Manager] ${label}`)
    const child = rememberChild(spawn(exec, argv, { windowsHide: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }))
    let settled = false
    const settle = (ok: boolean): void => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    child.stdout!.on('data', (d: Buffer) => pushLog('o', d.toString()))
    child.stderr!.on('data', (d: Buffer) => pushLog('e', d.toString()))
    child.on('error', () => settle(false))
    child.on('exit', (code) => settle(code === 0))
  })
}

async function extract(stage: string, file: string): Promise<boolean> {
  if (nodeOs() === 'win') {
    // PowerShell Expand-Archive 解压 zip。
    return run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -Path '${file}' -DestinationPath '${stage}' -Force`],
      '解压 Node 压缩包…'
    )
  }
  return run('tar', ['-xzf', file, '-C', stage], '解压 Node 压缩包…')
}

/**
 * 按当前平台 / 架构下载指定（默认最新 LTS）Node 发行包并解压部署到配置目录，
 * 覆盖 `<configDir>/node`。结果也经日志广播给向导。
 *
 * 「切换版本」的语义就是**整体替换**已部署的那份（与内核版本管理一致，不做多版本并存）。
 */
export async function deployLocalNode(
  onProgress?: (p: DlProgress) => void,
  version?: string
): Promise<NodeDeployResult> {
  const cfgDir = configDir()
  const ver = version ?? (await latestLtsVersion())
  if (!ver) return { ok: false, message: '无法获取 Node 版本（网络不可用？）', version: null }
  // 版本号会被拼进下载 URL 与目录名，必须挡住意外/恶意字符串。
  if (!/^v\d+\.\d+\.\d+$/.test(ver)) return { ok: false, message: `Node 版本号不合法：${ver}`, version: null }
  // 正在用本地 Node 跑 dsh 时不能替换：Windows 上运行中的 node.exe 被锁，删除会失败且可能
  // 留下残缺的运行时。渲染层会先停 dsh，这里再兜一道（防止绕过 UI 直接调用）。
  if (loadSettings().nodeRuntime === 'local' && isDshRunning()) {
    return { ok: false, message: 'dsh 正在使用本地 Node 运行，请先停止 dsh 再安装 / 切换版本。', version: ver }
  }

  const dir = `node-${ver}-${nodeOs()}-${process.arch}`
  const url = `${NODE_DIST}/${ver}/${dir}.${extOf()}`
  const file = path.join(cfgDir, `${dir}.${extOf()}`)
  const stage = path.join(cfgDir, '.node-tmp')

  try {
    fs.mkdirSync(cfgDir, { recursive: true })
    fs.mkdirSync(stage, { recursive: true })
  } catch {
    return { ok: false, message: '无法创建配置目录', version: ver }
  }

  pushLog('o', `[Manager] 下载 ${url}`)
  const dl = await downloadFile({
    url,
    destDir: cfgDir,
    fileName: `${dir}.${extOf()}`,
    onProgress: (p) => onProgress?.(p)
  })
  if (!dl.ok) return { ok: false, message: dl.message ?? '下载 Node 失败', version: ver }

  const okExtract = await extract(stage, file)
  try {
    fs.unlinkSync(file)
  } catch {
    /* best effort */
  }
  if (!okExtract) {
    fs.rmSync(stage, { recursive: true, force: true })
    return { ok: false, message: '解压 Node 失败', version: ver }
  }

  const src = path.join(stage, dir)
  if (!fs.existsSync(src)) {
    fs.rmSync(stage, { recursive: true, force: true })
    return { ok: false, message: '解压后未找到 Node 目录', version: ver }
  }

  // 换版本：先把已部署的那份**改名挪开**再放新的，而不是先删 —— 直接 rmSync 一旦删到被占用的
  // 文件就中途抛出，会留下一个残缺的 Node（内核随后起不来）。挪开失败（目录被占用）时原样保留。
  const target = localNodeDir()
  const backup = `${target}.old`
  fs.rmSync(backup, { recursive: true, force: true })
  if (fs.existsSync(target)) {
    try {
      fs.renameSync(target, backup)
    } catch {
      fs.rmSync(stage, { recursive: true, force: true })
      return { ok: false, message: '无法替换已部署的 Node（可能正被占用 / 正在运行）', version: ver }
    }
  }
  try {
    fs.renameSync(src, target)
  } catch {
    try {
      fs.cpSync(src, target, { recursive: true })
      fs.rmSync(src, { recursive: true, force: true })
    } catch {
      // 回滚：把原来的那份放回去，别让用户既没旧的也没新的。
      try {
        fs.rmSync(target, { recursive: true, force: true })
        if (fs.existsSync(backup)) fs.renameSync(backup, target)
      } catch {
        /* 回滚也失败：备份仍在 <configDir>/node.old，保留给用户手工恢复 */
      }
      fs.rmSync(stage, { recursive: true, force: true })
      return { ok: false, message: '移动 Node 到配置目录失败', version: ver }
    }
  }
  fs.rmSync(backup, { recursive: true, force: true })
  fs.rmSync(stage, { recursive: true, force: true })
  pushLog('o', `[Manager] Node ${ver} 已部署到 ${target}`)
  return { ok: true, message: `Node ${ver} 已部署到配置目录`, version: ver }
}
