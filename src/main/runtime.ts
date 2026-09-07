import type { BrowserWindow, Tray } from 'electron'

/**
 * Lowest-level cross-cutting runtime state shared by every main-process module.
 *
 * Kept deliberately tiny and cycle-free: feature modules (settings / kernel /
 * dsh server / ui / ipc) import these primitives; nothing imports them back, so
 * there is no import cycle. Electron types are imported as `type` only.
 */
export const IS_WIN = process.platform === 'win32'

// ---------------------------------------------------------------------------
// Shared mutable UI state (owned here so `broadcast` and the window/tray code
// can read / write the same references without a module cycle).
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null
let currentUrl: string | null = null
let tray: Tray | null = null
let quitting = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function setMainWindow(w: BrowserWindow | null): void {
  mainWindow = w
}

export function getCurrentUrl(): string | null {
  return currentUrl
}

export function setCurrentUrl(u: string | null): void {
  currentUrl = u
}

export function getTray(): Tray | null {
  return tray
}

export function setTray(t: Tray | null): void {
  tray = t
}

export function isQuitting(): boolean {
  return quitting
}

export function setQuitting(q: boolean): void {
  quitting = q
}

/** Destroy the tray if present and forget the reference. */
export function destroyTray(): void {
  try {
    tray?.destroy()
  } catch {
    /* already gone */
  }
  tray = null
}

/** Send an event to the renderer if the window is still alive. */
export function broadcast(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}
