import type { BrowserWindow } from 'electron'

/**
 * 壳窗口注册表：跟踪每个壳窗口与其“核心”角色。
 *
 * 核心窗口：承载 dsh 内核 UI 的固定首标签。其它窗口为完整壳(自带标签条)但不含内核 UI。
 * 核心窗口关闭后应把角色移交给仍在运行的窗口（由接管逻辑调用 promoteCore 的副作用钩子）。
 * 当前阶段主要维护注册表与角色查询，供 ipc(shell:meta) 与后续多窗口逻辑使用。
 */

interface Entry {
  win: BrowserWindow
  core: boolean
  born: number
}

const windows = new Map<number, Entry>()
let seq = 0

export function registerShellWindow(win: BrowserWindow, core: boolean): void {
  const id = win.webContents.id
  windows.set(id, { win, core, born: ++seq })
  win.on('closed', () => windows.delete(id))
}

export function isCoreWindow(wcId: number): boolean {
  return windows.get(wcId)?.core === true
}

/** 是否已有核心窗口在运行。 */
export function hasCoreWindow(): boolean {
  for (const e of windows.values()) if (e.core) return true
  return false
}

/** 核心窗口关闭时的接管：把角色给“现存最早打开”的非核心窗口，返回其 webContents id。 */
export function promoteNextToCore(): number | null {
  const next = [...windows.values()]
    .filter((e) => !e.core)
    .sort((a, b) => a.born - b.born)[0]
  if (!next) return null
  next.core = true
  return next.win.webContents.id
}

/** 核心窗口的 webContents id（无则 null）。 */
export function coreWindowId(): number | null {
  for (const e of windows.values()) if (e.core) return e.win.webContents.id
  return null
}

/** 全部已登记、未被销毁的壳窗口。 */
export function listWindows(): BrowserWindow[] {
  const out: BrowserWindow[] = []
  for (const e of windows.values()) {
    if (!e.win.isDestroyed()) out.push(e.win)
  }
  return out
}
