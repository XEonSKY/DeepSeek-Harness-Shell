import { app, dialog } from 'electron'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { parseDocument } from 'yaml'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { Settings, Theme, ResolvedLocale, LocaleCode } from '@shared/types'
import { resolveLocale, t as tl } from '@shared/i18n'
import { broadcast } from './runtime'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const settingsFile = (): string => path.join(app.getPath('userData'), 'settings.json')

export function readDiskSettings(): Partial<Settings> {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as Partial<Settings>
  } catch {
    return {}
  }
}

const KNOWN_FLAGS = new Set(['--port', '--host', '--workspace', '--timeout-ms', '--dsh-bin'])
function fromArgv(name: string): string | undefined {
  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === name && !KNOWN_FLAGS.has(process.argv[i + 1])) return process.argv[i + 1]
  }
  return undefined
}

function resolvePortSetting(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  const text = String(raw).trim()
  // Treat empty or the literal "null"/"undefined" (e.g. written by older
  // settings.json when port was cleared) as "not configured".
  if (text === '' || /^(null|undefined)$/i.test(text)) return null
  if (!/^\d+$/.test(text)) {
    dialog.showErrorBox('DeepSeek Harness Shell', `Invalid --port value: ${JSON.stringify(text)} (must be a non-negative integer)`)
    return null
  }
  return Number(text)
}

export function loadSettings(): Settings {
  const disk = readDiskSettings()
  const diskPort = disk.port
  const host = fromArgv('--host') ?? process.env.DSH_DESKTOP_HOST ?? disk.host ?? DEFAULT_SETTINGS.host
  const rawPort =
    fromArgv('--port') ??
    process.env.DSH_DESKTOP_PORT ??
    (diskPort === undefined || diskPort === null ? undefined : String(diskPort))
  const port = resolvePortSetting(rawPort)
  const workspace = fromArgv('--workspace') ?? process.env.DSH_DESKTOP_WORKSPACE ?? disk.workspace ?? null
  const dshBin = fromArgv('--dsh-bin') ?? process.env.DSH_BIN ?? disk.dshBin ?? null
  const timeoutMs = Number(fromArgv('--timeout-ms') ?? process.env.DSH_DESKTOP_TIMEOUT_MS ?? disk.timeoutMs ?? DEFAULT_SETTINGS.timeoutMs)
  return {
    host,
    port,
    workspace,
    timeoutMs,
    dshBin,
    closeToTray: disk.closeToTray ?? DEFAULT_SETTINGS.closeToTray,
    rememberClose: disk.rememberClose ?? DEFAULT_SETTINGS.rememberClose,
    theme: disk.theme ?? DEFAULT_SETTINGS.theme,
    autoCheckUpdate: disk.autoCheckUpdate ?? DEFAULT_SETTINGS.autoCheckUpdate,
    checkPrerelease: disk.checkPrerelease ?? DEFAULT_SETTINGS.checkPrerelease,
    npmRegistry: disk.npmRegistry ?? DEFAULT_SETTINGS.npmRegistry,
    appAutoUpdate: disk.appAutoUpdate ?? DEFAULT_SETTINGS.appAutoUpdate,
    appCheckPrerelease: disk.appCheckPrerelease ?? DEFAULT_SETTINGS.appCheckPrerelease
  }
}

/** Persist a partial close-behavior choice into settings.json. */
export function saveCloseChoice(patch: { closeToTray: boolean; rememberClose: boolean }): void {
  persistSettings({ ...DEFAULT_SETTINGS, ...readDiskSettings(), ...patch })
}

// ---------------------------------------------------------------------------
// dsh `settings.yaml` 的 `locale.preference`（界面语言的单一存储来源）
// ---------------------------------------------------------------------------

const LOCALE_CODES = new Set(['zh', 'en'])

/** 从 dsh settings.yaml 文本读取 locale.preference（zh/en），缺失返回 null。 */
function readDshLocalePref(text: string): LocaleCode | null {
  const doc = parseDocument(text || '')
  const v = doc.getIn(['locale', 'preference'])
  const s = v == null ? '' : String(v)
  return LOCALE_CODES.has(s) ? (s as LocaleCode) : null
}

/** 读取当前 dsh 语言偏好码；文件不存在/不可读返回 null。 */
export function dshLocale(): LocaleCode | null {
  try {
    return readDshLocalePref(fs.readFileSync(dshSettingsFile(), 'utf8'))
  } catch {
    return null
  }
}

/** 当 shell 自身写 locale 时抑制 watcher 回声。 */
let lastSelfLocaleWrite = 0

/** 把语言码写入 dsh settings.yaml 的 locale.preference（保留其它键/注释）。 */
export function writeDshLocale(code: LocaleCode): void {
  try {
    const file = dshSettingsFile()
    let text = ''
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      /* not created yet */
    }
    const doc = parseDocument(text || '')
    doc.setIn(['locale', 'preference'], code)
    const next = doc.toString().replace(/\s+$/, '') + '\n'
    if (next !== text) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, next, 'utf8')
    }
    lastSelfLocaleWrite = Date.now()
  } catch (err) {
    console.error('[dsh-desktop] failed to write locale to dsh settings.yaml:', err)
  }
}

/**
 * 解析当前界面语言（main 侧）：来源是 dsh settings.yaml 的 locale.preference；
 * 未设置时按 app.getLocale()（系统）回退。
 */
export function uiLocale(): ResolvedLocale {
  return resolveLocale(dshLocale(), app.getLocale())
}

/** main 进程的翻译入口：读当前语言目录 `path` 并替换 `{x}` 占位。 */
export function mt(path: string, params?: Record<string, unknown>): string {
  return tl(uiLocale(), path, params)
}

// ---------------------------------------------------------------------------
// Sync UI theme into dsh's own settings.yaml (ui-theme.preference)
// ---------------------------------------------------------------------------

const UI_THEME_VALUES = new Set(['system', 'light', 'dark'])

function dshSettingsFile(): string {
  return path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'settings.yaml')
}

/** 用 `yaml` 库设置顶层 ui-theme.preference，保留其它键/注释，避免手写文本补丁的脆弱性。 */
function patchUiTheme(text: string, pref: string): string {
  const doc = parseDocument(text || '')
  doc.setIn(['ui-theme', 'preference'], pref)
  return doc.toString().replace(/\s+$/, '') + '\n'
}

let lastSyncedTheme = ''
/** When the app itself writes the dsh theme we suppress the watcher echo. */
let lastSelfThemeWrite = 0
/** Timestamp of the last settings.json write performed by this process. */
let lastSelfSettingsWrite = 0

/** Read ui-theme.preference from dsh's settings.yaml (via the yaml library). */
function readUiThemePref(text: string): Theme | null {
  const doc = parseDocument(text || '')
  const v = doc.getIn(['ui-theme', 'preference'])
  const s = v == null ? '' : String(v)
  return UI_THEME_VALUES.has(s) ? (s as Theme) : null
}

/** Write the app theme into dsh's settings.yaml so the dsh UI matches. */
export function syncDshTheme(theme: string): void {
  if (!UI_THEME_VALUES.has(theme) || theme === lastSyncedTheme) return
  try {
    const file = dshSettingsFile()
    let text = ''
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      /* not created yet */
    }
    const next = patchUiTheme(text, theme)
    if (next !== text) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, next, 'utf8')
    }
    lastSyncedTheme = theme
    lastSelfThemeWrite = Date.now()
  } catch (err) {
    console.error('[dsh-desktop] failed to sync theme to dsh settings.yaml:', err)
  }
}

export function persistSettings(s: Settings): void {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
    fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), 'utf8')
    lastSelfSettingsWrite = Date.now()
  } catch {
    /* non-fatal */
  }
}

// ---------------------------------------------------------------------------
// External-config watchers
// ---------------------------------------------------------------------------
// When settings.json / dsh's settings.yaml are changed on disk by someone other
// than this app, tell the renderer to re-sync automatically. Echoes caused by
// our own writes are suppressed via the lastSelf* timestamps.
// ---------------------------------------------------------------------------

const configWatchers: fs.FSWatcher[] = []

/** Watch one file in a directory and call onChange (debounced) on changes. */
function watchConfigFile(name: string, dir: string, onChange: () => void): void {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    /* directory may be uncreatable; the watcher will still try below */
  }
  let timer: NodeJS.Timeout | null = null
  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onChange()
    }, 200)
  }
  try {
    const w = fs.watch(dir, (_event, filename) => {
      if (filename && filename.toString() === name) schedule()
    })
    w.on('error', () => {
      /* ignore transient watch errors */
    })
    configWatchers.push(w)
  } catch (err) {
    console.error(`[dsh-desktop] failed to watch ${name} in ${dir}:`, err)
  }
}

export function startConfigWatchers(): void {
  // App settings: on external edit, push the authoritative settings for the
  // renderer to re-fill its form.
  watchConfigFile('settings.json', app.getPath('userData'), () => {
    if (Date.now() - lastSelfSettingsWrite < 400) return
    broadcast('settings:changed', loadSettings())
  })
  // DSH settings.yaml：当 ui-theme.preference / locale.preference 在 shell 之外被改动
  //（例如在 dsh UI 内切换主题/语言）时广播，让 shell 采用。
  watchConfigFile('settings.yaml', path.dirname(dshSettingsFile()), () => {
    if (Date.now() - lastSelfThemeWrite < 400 || Date.now() - lastSelfLocaleWrite < 400) return
    try {
      const text = fs.readFileSync(dshSettingsFile(), 'utf8')
      const theme = readUiThemePref(text)
      if (theme) broadcast('settings:theme', theme)
      const localePref = readDshLocalePref(text)
      if (localePref) broadcast('settings:locale', localePref)
    } catch {
      /* file not (yet) readable */
    }
  })
}
