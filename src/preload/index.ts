import { contextBridge, ipcRenderer } from 'electron'
import type { AppUpdateEvent, LogEntry, NodeDeployProgress, RendererApi, Settings, Theme } from '@shared/types'

const api: RendererApi = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  },

  getSettings: () => ipcRenderer.invoke('settings:get'),
  getUiLocale: () => ipcRenderer.invoke('i18n:get'),
  setUiLocale: (locale) => ipcRenderer.invoke('i18n:set', locale),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  applySettings: () => ipcRenderer.invoke('settings:apply'),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  getLogHistory: () => ipcRenderer.invoke('log:history'),
  getDshUrl: () => ipcRenderer.invoke('dsh:url:get'),
  isDshRunning: () => ipcRenderer.invoke('dsh:running'),
  startDsh: () => ipcRenderer.invoke('dsh:start'),
  stopDsh: () => ipcRenderer.invoke('dsh:stop'),
  restartDsh: () => ipcRenderer.invoke('dsh:restart'),
  setWindowZoom: (percent) => ipcRenderer.invoke('zoom:set', percent),
  relaunch: () => ipcRenderer.send('app:relaunch'),
  getDshVersion: () => ipcRenderer.invoke('dsh:version'),
  getKernelInstalled: () => ipcRenderer.invoke('kernel:installed'),
  listVersions: (opts) => ipcRenderer.invoke('kernel:versions', opts),
  checkForUpdates: (opts) => ipcRenderer.invoke('update:check', opts),
  checkAppUpdate: () => ipcRenderer.invoke('appupdate:check'),
  getAppMeta: () => ipcRenderer.invoke('appupdate:meta'),
  triggerAppUpdate: (opts) => ipcRenderer.invoke('appupdate:trigger', opts),
  restartAndInstall: () => ipcRenderer.send('appupdate:restart'),

  onAppUpdateEvent(cb) {
    const listener = (_e: unknown, evt: AppUpdateEvent): void => cb(evt)
    ipcRenderer.on('appupdate:event', listener)
    return () => ipcRenderer.removeListener('appupdate:event', listener)
  },
  onNodeDeployProgress(cb) {
    const listener = (_e: unknown, p: NodeDeployProgress): void => cb(p)
    ipcRenderer.on('nodeenv:deploy-progress', listener)
    return () => ipcRenderer.removeListener('nodeenv:deploy-progress', listener)
  },
  updateKernel: (opts) => ipcRenderer.invoke('kernel:update', opts),
  installKernel: (opts) => ipcRenderer.invoke('kernel:install', opts),
  uninstallKernel: () => ipcRenderer.invoke('kernel:uninstall'),

  onDshUrl(cb) {
    const listener = (_e: unknown, url: string): void => cb(url)
    ipcRenderer.on('dsh:url', listener)
    return () => ipcRenderer.removeListener('dsh:url', listener)
  },

  onLog(cb) {
    const onLine = (_e: unknown, entry: LogEntry): void => cb(entry)
    ipcRenderer.on('dsh:log', onLine)
    return () => ipcRenderer.removeListener('dsh:log', onLine)
  },

  onSettingsChanged(cb) {
    const listener = (_e: unknown, s: Settings): void => cb(s)
    ipcRenderer.on('settings:changed', listener)
    return () => ipcRenderer.removeListener('settings:changed', listener)
  },

  onThemeChanged(cb) {
    const listener = (_e: unknown, t: Theme): void => cb(t)
    ipcRenderer.on('settings:theme', listener)
    return () => ipcRenderer.removeListener('settings:theme', listener)
  },

  onToggleView(cb) {
    const listener = (): void => cb()
    ipcRenderer.on('ui:toggle-view', listener)
    return () => ipcRenderer.removeListener('ui:toggle-view', listener)
  },

  onAskClose(cb) {
    const listener = (): void => cb()
    ipcRenderer.on('ui:ask-close', listener)
    return () => ipcRenderer.removeListener('ui:ask-close', listener)
  },

  onKernelMissing(cb) {
    const listener = (): void => cb()
    ipcRenderer.on('kernel:missing', listener)
    return () => ipcRenderer.removeListener('kernel:missing', listener)
  },

  resolveClose: (decision) => ipcRenderer.send('win:close-resolve', decision),

  reloadDsh: () => ipcRenderer.send('web:reload'),
  onReloadDsh(cb) {
    const listener = (): void => cb()
    ipcRenderer.on('ui:reload-dsh', listener)
    return () => ipcRenderer.removeListener('ui:reload-dsh', listener)
  },

  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  probeEnv: () => ipcRenderer.invoke('env:probe'),
  deployLocalNode: () => ipcRenderer.invoke('nodeenv:deploy'),
  getConfigDir: () => ipcRenderer.invoke('configdir:get'),
  setConfigDir: (dir) => ipcRenderer.invoke('configdir:set', dir),
  quit: () => ipcRenderer.send('app:quit'),

  windowMinimize: () => ipcRenderer.send('win:minimize'),
  windowToggleMaximize: () => ipcRenderer.send('win:maximize-toggle'),
  windowClose: () => ipcRenderer.send('win:close')
}

contextBridge.exposeInMainWorld('api', api)
