import type { BrowserWindow } from 'electron'

/**
 * 壳窗口注册表：跟踪每个「壳窗口」(core 或 secondary)与其“核心”角色。
 *
 * 核心窗口：承载 dsh 内核 UI 的固定首标签。其它壳窗口为「副窗口」——同样带完整标签条，
 * 但不含内核 UI 固定站。真弹窗(第三方 window.open 带 frameName/features)不是壳窗口，
 * 不入册（所以既收不到全局广播，也不会被当作副窗口参与核心接管）。
 *
 * 核心窗口被销毁（真关闭）时，若仍有副窗口存活，应把核心角色移交给“现存最早打开”的副窗口
 * （见 promoteNextToCore），并由调用方（ui.ts）给新核心发 shell:core 并把它设为当前主窗口。
 */
interface Entry {
  win: BrowserWindow
  core: boolean
  born: number
}

const windows = new Map<number, Entry>()
let seq = 0

/** 登记一个壳窗口。入册时挂 closed 自动注销。 */
export function registerShellWindow(win: BrowserWindow, core: boolean): void {
  const id = win.webContents.id
  windows.set(id, { win, core, born: ++seq })
  win.on('closed', () => windows.delete(id))
}

export function isCoreWindow(wcId: number): boolean {
  return windows.get(wcId)?.core === true
}

/** 按 webContents id 查窗口（含被标记为非核心的副窗口）。无则 null。 */
export function windowByContentsId(wcId: number): BrowserWindow | null {
  const e = windows.get(wcId)
  return e && !e.win.isDestroyed() ? e.win : null
}

/** 是否已有核心窗口在运行。 */
export function hasCoreWindow(): boolean {
  for (const e of windows.values()) if (e.core) return true
  return false
}

/** 核心窗口的 webContents id（无则 null）。 */
export function coreWindowId(): number | null {
  for (const e of windows.values()) if (e.core) return e.win.webContents.id
  return null
}

/** 核心窗口对象（被销毁或无则 null）。 */
export function coreWindow(): BrowserWindow | null {
  const id = coreWindowId()
  return id != null ? windowByContentsId(id) : null
}

/**
 * 核心窗口关闭后的接管：把核心角色给“现存最早打开”的非核心窗口。
 * 返回其 webContents id；若没有可用副窗口则返回 null（此时不再有核心）。
 * 注意：调用方应在拿到返回值后把该窗口设为主窗口并广播 shell:core(true)。
 */
export function promoteNextToCore(): number | null {
  const next = [...windows.values()]
    .filter((e) => !e.core && !e.win.isDestroyed())
    .sort((a, b) => a.born - b.born)[0]
  if (!next) return null
  next.core = true
  return next.win.webContents.id
}

/** 全部已登记、未被销毁的壳窗口。 */
export function listWindows(): BrowserWindow[] {
  const out: BrowserWindow[] = []
  for (const e of windows.values()) {
    if (!e.win.isDestroyed()) out.push(e.win)
  }
  return out
}
