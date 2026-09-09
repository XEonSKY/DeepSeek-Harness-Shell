import { app, dialog, ipcMain, shell } from 'electron'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { Settings, ResolvedLocale } from '@shared/types'
import { resolveLocale, localeCodeOf } from '@shared/i18n'
import { readDiskSettings, persistSettings, syncDshTheme, loadSettings, saveCloseChoice, dshLocale, writeDshLocale, configDirInfo, setConfigDir, normalizeNpmSource } from './settings'
import { resolveInstall, kernelInstalled, listVersions, performUpdateCheck, updateKernel, installKernel, uninstallKernel } from './kernel'
import { getLogHistory, restart, isDshRunning, stopServer } from './dsh'
import { checkAppSelfUpdate } from './updater'
import { appMeta, triggerAppUpdate, restartAndInstall } from './appupdate'
import { broadcast, getCurrentUrl, getMainWindow, setQuitting } from './runtime'
import { findSystemNode, findSystemNpm, nodeVersionOf, localNodeExecPath } from './tools'
import { deployLocalNode } from './nodeenv'

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => {
    const merged: Settings = { ...DEFAULT_SETTINGS, ...readDiskSettings() }
    merged.npmSource = normalizeNpmSource(merged.npmSource)
    return merged
  })
  // 界面语言：读/写 dsh settings.yaml 的 locale.preference（zh/en）。
  ipcMain.handle('i18n:get', () => resolveLocale(dshLocale(), app.getLocale()))
  ipcMain.handle('i18n:set', (_e, loc: ResolvedLocale) => {
    writeDshLocale(localeCodeOf(loc))
    return loc
  })
  // Persist only — the renderer auto-saves edits without restarting dsh.
  ipcMain.handle('settings:save', (_e, s: Settings) => {
    const merged: Settings = { ...DEFAULT_SETTINGS, ...s }
    persistSettings(merged)
    syncDshTheme(merged.theme)
    return merged
  })
  // Explicit "apply": restart dsh so the persisted settings take effect.
  ipcMain.handle('settings:apply', () => {
    void restart()
  })
  // Restore every setting to its default.
  ipcMain.handle('settings:reset', () => {
    const d: Settings = { ...DEFAULT_SETTINGS }
    persistSettings(d)
    syncDshTheme(d.theme)
    return d
  })
  ipcMain.handle('log:history', () => getLogHistory())
  ipcMain.handle('dsh:url:get', () => getCurrentUrl())
  ipcMain.handle('dsh:running', () => isDshRunning())
  ipcMain.handle('dsh:start', () => {
    void restart()
  })
  ipcMain.handle('dsh:stop', () => {
    stopServer()
  })
  ipcMain.handle('dsh:restart', () => {
    void restart()
  })
  ipcMain.handle('zoom:set', (_e, percent: number) => {
    const w = getMainWindow()
    if (!w) return
    const p = Math.max(50, Math.min(200, Number(percent) || 100))
    w.webContents.setZoomFactor(p / 100)
  })
  ipcMain.on('app:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle('dsh:version', () => resolveInstall(loadSettings()).version)
  ipcMain.handle('kernel:installed', () => kernelInstalled())
  ipcMain.handle('kernel:versions', (_e, opts) => listVersions(opts))
  ipcMain.handle('update:check', (_e, opts) => performUpdateCheck(loadSettings(), opts))
  ipcMain.handle('appupdate:check', () => checkAppSelfUpdate())
  ipcMain.handle('appupdate:meta', () => appMeta())
  ipcMain.handle('appupdate:trigger', (_e, opts: { prerelease: boolean }) => triggerAppUpdate(opts))
  ipcMain.on('appupdate:restart', () => restartAndInstall())
  ipcMain.handle('kernel:update', (_e, opts) => updateKernel(opts))
  ipcMain.handle('kernel:install', (_e, opts) => installKernel(opts))
  ipcMain.handle('kernel:uninstall', () => uninstallKernel())
  ipcMain.handle('env:probe', async () => {
    const nodePath = findSystemNode()
    const localPath = localNodeExecPath()
    return {
      platform: process.platform,
      arch: process.arch,
      node: { present: !!nodePath, version: nodePath ? await nodeVersionOf(nodePath) : null },
      npm: !!findSystemNpm(),
      local: { present: !!localPath, version: localPath ? await nodeVersionOf(localPath) : null }
    }
  })
  ipcMain.handle('nodeenv:deploy', async () => {
    return deployLocalNode((p) =>
      broadcast('nodeenv:deploy-progress', { percent: Math.max(0, Math.min(100, Math.round(p.percent))), downloaded: p.downloaded, total: p.total })
    )
  })
  ipcMain.handle('configdir:get', () => configDirInfo())
  ipcMain.handle('configdir:set', (_e, dir: string | null) => {
    return setConfigDir(typeof dir === 'string' && dir ? dir : null)
  })
  ipcMain.handle('app:openExternal', async (_e, url: string) => {
    if (/^https?:/i.test(url)) await shell.openExternal(url)
  })
  ipcMain.handle('dialog:openDirectory', async () => {
    const w = getMainWindow()
    if (!w) return null
    const r = await dialog.showOpenDialog(w, {
      title: '选择工作目录',
      properties: ['openDirectory', 'createDirectory']
    })
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]
  })
  ipcMain.handle('dialog:openFile', async () => {
    const w = getMainWindow()
    if (!w) return null
    const r = await dialog.showOpenDialog(w, {
      title: '选择启动器文件',
      properties: ['openFile'],
      filters: [
        { name: 'launcher', extensions: ['cmd', 'bat', 'exe', 'js', 'sh', ''] },
        { name: 'all', extensions: ['*'] }
      ]
    })
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]
  })
  ipcMain.on('app:quit', () => app.quit())

  // Frameless-window controls driven by the renderer's custom title bar.
  ipcMain.on('win:minimize', () => getMainWindow()?.minimize())
  ipcMain.on('win:maximize-toggle', () => {
    const w = getMainWindow()
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on('win:close', () => getMainWindow()?.close())

  // Title-bar refresh: ask the renderer to reload the dsh UI.
  ipcMain.on('web:reload', () => broadcast('ui:reload-dsh'))

  // Renderer answered the Element Plus close prompt.
  ipcMain.on(
    'win:close-resolve',
    (_e, decision: { action: 'hide' | 'quit'; remember: boolean }) => {
      const w = getMainWindow()
      if (!w) return
      if (decision.remember) saveCloseChoice({ closeToTray: decision.action === 'hide', rememberClose: true })
      if (decision.action === 'hide') {
        w.hide()
      } else {
        setQuitting(true)
        app.quit()
      }
    }
  )
}
