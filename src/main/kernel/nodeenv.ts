import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { configDir } from '../app/settings'
import { pushLog, rememberChild } from './dsh'
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

/** 从官方 index.json 取最新 LTS 版本号（如 v22.14.0）。 */
export async function latestLtsVersion(): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(`${NODE_DIST}/index.json`, { signal: ctrl.signal })
    if (!res.ok) return null
    const arr = (await res.json()) as Array<{ version: string; lts: unknown }>
    const hit = arr.find((x) => x.lts)
    return hit ? hit.version : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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

/** 下载并按架构部署 Node LTS 到配置目录。结果也经日志广播给向导。 */
export async function deployLocalNode(
  onProgress?: (p: DlProgress) => void
): Promise<{ ok: boolean; message: string; version: string | null }> {
  const cfgDir = configDir()
  const ver = await latestLtsVersion()
  if (!ver) return { ok: false, message: '无法获取 Node LTS 版本（网络不可用？）', version: null }

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

  const target = localNodeDir()
  fs.rmSync(target, { recursive: true, force: true })
  try {
    fs.renameSync(src, target)
  } catch {
    try {
      fs.cpSync(src, target, { recursive: true })
      fs.rmSync(src, { recursive: true, force: true })
    } catch {
      return { ok: false, message: '移动 Node 到配置目录失败', version: ver }
    }
  }
  fs.rmSync(stage, { recursive: true, force: true })
  pushLog('o', `[Manager] Node ${ver} 已部署到 ${target}`)
  return { ok: true, message: `Node ${ver} 已部署到配置目录`, version: ver }
}
