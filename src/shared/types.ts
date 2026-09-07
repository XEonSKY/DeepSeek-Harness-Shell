/** Settings persisted in the app's userData directory. */
export interface Settings {
  /** Bind host for dsh. dsh only allows 127.0.0.1 today. */
  host: string
  /**
   * Preferred starting port for auto-selection:
   *  - positive number: probe it and scan upward while busy
   *  - null/undefined : start from dsh's usual 3080 (still scans if busy)
   *  - 0             : hand the choice entirely to the OS
   */
  port: number | null
  /** Folder dsh boots from (its default file-system location). null => home. */
  workspace: string | null
  /** Milliseconds to wait for dsh to print its URL before giving up. */
  timeoutMs: number
  /** Absolute path to the dsh launcher when not on PATH. */
  dshBin: string | null
  /** When the window close button is pressed: hide to tray (true) or quit (false). */
  closeToTray: boolean
  /** Apply closeToTray without asking again. */
  rememberClose: boolean
  /** UI colour scheme. */
  theme: 'system' | 'light' | 'dark'
  /** Check for a newer @deepseek-ai/dsh kernel automatically at startup. */
  autoCheckUpdate: boolean
  /** Also consider pre-release (-rc / -beta / …) kernel versions when checking. */
  checkPrerelease: boolean
  /** npm registry used to list versions, check and install/uninstall the kernel. */
  npmRegistry: NpmRegistry
  /** App 自动更新：启动时自动检查新版本（默认开）。 */
  appAutoUpdate: boolean
  /** App 更新检查也把预发布版本当作候选（默认关）。 */
  appCheckPrerelease: boolean
  /** 开发模式：开启后 F12 才允许打开 DevTools 控制台（默认关）。 */
  devMode: boolean
}

/** Which npm registry to use for kernel version listing / install. */
export type NpmRegistry = 'npmjs' | 'npmmirror'

export type Theme = 'system' | 'light' | 'dark'

/**
 * dsh `settings.yaml` 里 `locale.preference` 使用的两字母语言码。
 * 界面语言以此为单一存储来源（见 src/main/settings.ts 的 dsh locale 读写）。
 */
export type LocaleCode = 'zh' | 'en'

/** 应用内部实际语言（与 vue-i18n / element-plus 语言名对应）。 */
export type ResolvedLocale = 'zh-CN' | 'en-US'

export const DEFAULT_SETTINGS: Settings = {
  host: '127.0.0.1',
  port: null,
  workspace: null,
  timeoutMs: 90000,
  dshBin: null,
  closeToTray: true,
  rememberClose: false,
  theme: 'system',
  autoCheckUpdate: true,
  checkPrerelease: false,
  npmRegistry: 'npmjs',
  appAutoUpdate: true,
  appCheckPrerelease: false,
  devMode: false
}

/** Result of a kernel install / uninstall action. */
export interface KernelAction {
  ok: boolean
  message: string
  version: string | null
}

export type LogKind = 'o' | 'e'

/** One buffered / streamed log entry carried to the renderer. */
export interface LogEntry {
  k: LogKind
  s: string
}

/** Result of an @deepseek-ai/dsh install/update check. */
export interface UpdateResult {
  status: 'ok' | 'update' | 'missing' | 'error'
  current: string | null
  latest: string | null
  message: string
  command?: string
}

/**
 * Result of checking whether the shell app *itself* has a newer release on
 * GitHub (compared against the running app version, e.g. from package.json).
 */
export interface AppUpdateResult {
  /** update = a newer release exists; ok = already latest; error = check failed. */
  status: 'ok' | 'update' | 'error'
  /** The currently running shell version (could be null in an unusual env). */
  current: string | null
  /** The newest release tag from GitHub (leading "v" stripped), or null. */
  latest: string | null
  /** Human-readable status line (localized). */
  message: string
  /** URL to open for download/release notes. */
  releaseUrl: string | null
  /** Architecture of the currently running shell (e.g. x64 / arm64 / ia32). */
  arch: string | null
  /** OS of the running shell (e.g. win32 / darwin / linux). */
  platform: string | null
}

/** 运行环境元信息（关于页展示当前版本/架构）。 */
export interface AppMeta {
  version: string | null
  arch: string | null
  platform: string | null
}

/** 自动更新过程状态（由主进程 electron-updater 事件桥接而来）。 */
export interface AppUpdateEvent {
  kind: 'checking' | 'available' | 'not-available' | 'progress' | 'downloaded' | 'error'
  version?: string | null
  /** progress 时的下载百分比 0-100。 */
  percent?: number
  message?: string
}

/** Everything the renderer (shell UI) can ask of the main process. */
export interface RendererApi {
  platform: string
  versions: { electron: string; node: string; chrome: string }

  getSettings(): Promise<Settings>
  /** 当前界面语言：读取 dsh settings.yaml 的 locale.preference（zh→zh-CN / en→en-US；未设则跟随系统解析）。 */
  getUiLocale(): Promise<ResolvedLocale>
  /** 把界面语言写回 dsh settings.yaml 的 locale.preference（两字母码）。 */
  setUiLocale(locale: ResolvedLocale): Promise<void>
  /** Persist settings to disk only (no restart). */
  saveSettings(s: Settings): Promise<Settings>
  /** (Re)start dsh using the persisted settings so they take effect. */
  applySettings(): Promise<void>
  /** Reset all settings to defaults (persisted) and return them. */
  resetSettings(): Promise<Settings>
  getLogHistory(): Promise<LogEntry[]>
  getDshUrl(): Promise<string | null>
  /** Whether a dsh server instance is currently running in the main process. */
  isDshRunning(): Promise<boolean>
  /** Current installed @deepseek-ai/dsh kernel version (from the local module). */
  getDshVersion(): Promise<string | null>
  /** Whether @deepseek-ai/dsh is present on this machine. */
  getKernelInstalled(): Promise<boolean>
  /** List published kernel versions (descending), filtered by prerelease flag. */
  listVersions(opts: { prerelease: boolean; registry: NpmRegistry }): Promise<string[]>
  /** Check @deepseek-ai/dsh version/update in the main process. */
  checkForUpdates(opts?: { prerelease?: boolean; registry?: NpmRegistry }): Promise<UpdateResult>
  /**
   * Upgrade the installed @deepseek-ai/dsh kernel to the newest considered
   * version (runs `npm install -g`). Resolves when the install finishes.
   */
  updateKernel(opts?: { registry?: NpmRegistry }): Promise<KernelAction>
  /** Check whether the shell app itself has a newer GitHub release. */
  checkAppUpdate(): Promise<AppUpdateResult>
  /** 运行环境元信息（关于页显示当前版本/架构）。 */
  getAppMeta(): Promise<AppMeta>
  /** 触发一次 app 自动更新检查；有可用更新时由主进程后台自动下载。 */
  triggerAppUpdate(opts: { prerelease: boolean }): Promise<{ ok: boolean; message: string }>
  /** 订阅主进程的自动更新事件（检查中/可用/下载进度/下载完成/出错）。 */
  onAppUpdateEvent(cb: (e: AppUpdateEvent) => void): () => void
  /** 立即重启并安装已下载的更新。 */
  restartAndInstall(): void
  /**
   * Install / switch the kernel to a specific version (or latest when no
   * version is given). If nothing was installed, dsh is started afterwards.
   */
  installKernel(opts?: { version?: string | null; registry?: NpmRegistry }): Promise<KernelAction>
  /** Uninstall @deepseek-ai/dsh (stops dsh first). */
  uninstallKernel(): Promise<KernelAction>

  /** A dsh server URL is (re)available; the shell should show it in the webview. */
  onDshUrl(cb: (url: string) => void): () => void
  /** Stream live dsh stdout/stderr lines. */
  onLog(cb: (entry: LogEntry) => void): () => void
  /**
   * The app's own settings.json changed on disk (edited outside the shell);
   * re-sync the whole settings form with the authoritative persisted values.
   */
  onSettingsChanged(cb: (s: Settings) => void): () => void
  /**
   * DeepSeek Harness's own settings.yaml (ui-theme.preference) changed on disk
   * (e.g. the theme was changed inside the dsh UI); adopt it in the shell.
   */
  onThemeChanged(cb: (theme: Theme) => void): () => void
  /** Main asks the renderer to flip between the Web view and the log view. */
  onToggleView(cb: () => void): () => void
  /** Main asks the renderer to show the (Element Plus) close-behaviour prompt. */
  onAskClose(cb: () => void): () => void
  /** Renderer reports the user's close decision back to the main process. */
  resolveClose(decision: { action: 'hide' | 'quit'; remember: boolean }): void
  /** Main detected that the kernel was removed/never installed; show the install mask. */
  onKernelMissing(cb: () => void): () => void

  /** Ask the main process to request a reload of the dsh UI (title-bar refresh). */
  reloadDsh(): void
  /** The shell should reload the dsh UI when this fires. */
  onReloadDsh(cb: () => void): () => void

  openExternal(url: string): Promise<void>
  /** Open a native directory picker; resolves the chosen path or null. */
  openDirectory(): Promise<string | null>
  quit(): void

  // Frameless-window controls (drawn by the renderer's custom title bar).
  windowMinimize(): void
  windowToggleMaximize(): void
  windowClose(): void
}
