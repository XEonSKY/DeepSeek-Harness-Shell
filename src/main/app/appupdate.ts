import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AppMeta, AppUpdateEvent } from '@shared/types'
import { broadcast } from './runtime'
import { loadSettings, mt } from './settings'

/**
 * App 自动更新：封装 electron-updater(GitHub provider)。
 * 仅打包成安装包且仓库有对应 Release 时实际可下载；开发/未打包时给出提示。
 * 下载进度等事件经 IPC 广播给渲染层的「关于」页。
 */

let inited = false

/** 向渲染层广播一次自动更新事件。 */
function emit(e: AppUpdateEvent): void {
  broadcast('appupdate:event', e)
}

/** 惰性初始化：注册 electron-updater 事件到广播。 */
function ensureInited(): void {
  if (inited) return
  inited = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => emit({ kind: 'checking' }))
  autoUpdater.on('update-available', (info) => emit({ kind: 'available', version: info?.version ?? null }))
  autoUpdater.on('update-not-available', () => emit({ kind: 'not-available' }))
  autoUpdater.on('download-progress', (p) => emit({ kind: 'progress', percent: typeof p?.percent === 'number' ? p.percent : 0 }))
  autoUpdater.on('update-downloaded', (info) => emit({ kind: 'downloaded', version: info?.version ?? null }))
  autoUpdater.on('error', (err) => emit({ kind: 'error', message: err && err.message ? err.message : String(err) }))
}

/** 控制是否采纳预发布版本。 */
function setPrerelease(on: boolean): void {
  ;(autoUpdater as unknown as { allowPrerelease?: boolean }).allowPrerelease = on
}

/** 运行环境元信息（关于页显示当前版本/架构）。 */
export function appMeta(): AppMeta {
  let version: string | null = null
  try {
    version = app.getVersion() || null
  } catch {
    /* not packaged */
  }
  return { version, arch: process.arch, platform: process.platform }
}

/** 触发一次检查；有可用更新时 electron-updater 自动进入后台下载。 */
export async function triggerAppUpdate(opts: { prerelease: boolean }): Promise<{ ok: boolean; message: string }> {
  if (!app.isPackaged) return { ok: false, message: mt('m.appUpdate.onlyPackaged') }
  ensureInited()
  setPrerelease(opts.prerelease)
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true, message: '' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

/** 立即重启并安装已下载的更新。 */
export function restartAndInstall(): void {
  if (app.isPackaged) autoUpdater.quitAndInstall()
}

/** 启动时按设置自动检查一次（静默；失败不打扰）。 */
export function startAutoCheckIfEnabled(): void {
  if (!app.isPackaged) return
  const s = loadSettings()
  if (!s.appAutoUpdate) return
  ensureInited()
  setPrerelease(s.appCheckPrerelease)
  void autoUpdater.checkForUpdates().catch(() => {
    /* silent */
  })
}
