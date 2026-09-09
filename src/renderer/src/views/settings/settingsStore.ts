import type { FunLocale, NewTabMode, NpmRegistry, NpmSource, ProxyProtocol, ProxyScope, SearchEngineId, Settings, Shortcut, Theme, NodeRuntimeKind } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

/** Short, friendly OS label (pure) used by the About header. */
export function friendlyPlatform(p: string | null | undefined): string {
  switch (p) {
    case 'win32':
      return 'Windows'
    case 'darwin':
      return 'macOS'
    case 'linux':
      return 'Linux'
    default:
      return p || ''
  }
}

/** Settings-form data model. Plain values inside a reactive object (no Ref-of-Ref). */
export interface SettingsState {
  workspace: string
  portMode: 'auto' | 'manual'
  manualPort: number
  dshBin: string
  timeoutMs: number
  closeMode: 'tray' | 'quit'
  askEveryClose: boolean
  theme: Theme
  autoCheckUpdate: boolean
  autoCheckPrerelease: boolean
  npmRegistry: NpmRegistry
  appAutoUpdate: boolean
  appCheckPrerelease: boolean
  devMode: boolean
  /** 内核来源：'local'（内置/默认）｜ 'global'（使用全局安装）。 */
  kernelSource: 'local' | 'global'
  /** Node 运行时：'system' ｜ 'electron'(默认) ｜ 'local'。 */
  nodeRuntime: NodeRuntimeKind
  /** 本地安装用的 npm：'system' ｜ 'bundled'(内置) ｜ 'localnode'(本地 Node 自带)。 */
  npmSource: NpmSource
  proxyEnabled: boolean
  proxyProtocol: ProxyProtocol
  proxyHost: string
  proxyPort: number | null
  proxyScope: ProxyScope[]
  zoomPercent: number
  ignoreSystemScale: boolean
  funLocale: FunLocale
  /** 默认搜索引擎。 */
  searchEngine: SearchEngineId
  /** 新标签页内容模式。 */
  newTabMode: NewTabMode
  /** 新标签页自定义 URL。 */
  newTabUrl: string
  /** 导航页常用站点快捷方式。 */
  shortcuts: Shortcut[]
  /** dsh 是否正在运行（仅 UI，不持久化）。 */
  dshRunning: boolean
  applying: boolean
  updating: boolean
  updatingKernel: boolean
  version: string | null
  versions: string[]
  versionsLoading: boolean
  switchingKernel: boolean
  uninstalling: boolean
  selectedVersion: string
}

/** Every operation the settings panels can trigger. */
export interface SettingsActions {
  loadVersion(): Promise<void>
  browseWorkspace(): Promise<void>
  browseDshBin(): Promise<void>
  apply(): Promise<void>
  resetAll(): Promise<void>
  refreshRunning(): Promise<void>
  startDsh(): Promise<void>
  stopDsh(): Promise<void>
  restartDsh(): Promise<void>
  loadVersions(): Promise<void>
  versionLabel(v: string): string
  runUpdateCheck(): Promise<void>
  runUpdateKernel(): Promise<void>
  switchVersion(): Promise<void>
  confirmUninstall(): Promise<void>
  fillFrom(s: Settings): void
}

/** `Settings` payload assembled from the current form state. */
export function payloadFrom(state: SettingsState): Settings {
  return {
    host: DEFAULT_SETTINGS.host,
    port: state.portMode === 'auto' ? null : state.manualPort > 0 ? state.manualPort : null,
    workspace: state.workspace || null,
    dshBin: state.dshBin || null,
    timeoutMs: state.timeoutMs,
    closeToTray: state.closeMode === 'tray',
    rememberClose: !state.askEveryClose,
    theme: state.theme,
    autoCheckUpdate: state.autoCheckUpdate,
    checkPrerelease: state.autoCheckPrerelease,
    npmRegistry: state.npmRegistry,
    appAutoUpdate: state.appAutoUpdate,
    appCheckPrerelease: state.appCheckPrerelease,
    devMode: state.devMode,
    kernelSource: state.kernelSource,
    nodeRuntime: state.nodeRuntime,
    npmSource: state.npmSource,
    proxyEnabled: state.proxyEnabled,
    proxyProtocol: state.proxyProtocol,
    proxyHost: state.proxyHost,
    proxyPort: state.proxyPort,
    proxyScope: [...state.proxyScope],
    zoomPercent: state.zoomPercent,
    ignoreSystemScale: state.ignoreSystemScale,
    funLocale: state.funLocale,
    searchEngine: state.searchEngine,
    newTabMode: state.newTabMode,
    newTabUrl: state.newTabUrl,
    shortcuts: state.shortcuts.map((s) => ({ title: s.title, url: s.url }))
  }
}
