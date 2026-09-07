import { app, BrowserWindow, Menu, Tray, nativeImage, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { loadSettings, mt } from './settings'
import {
  broadcast,
  getCurrentUrl,
  getMainWindow,
  setMainWindow,
  getTray,
  setTray,
  isQuitting,
  setQuitting,
  destroyTray
} from './runtime'

function rendererIndex(): string {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) return devUrl
  return path.join(__dirname, '../renderer/index.html')
}

export function createShellWindow(): void {
  Menu.setApplicationMenu(null)
  const iconPath = path.join(app.getAppPath(), 'resources', 'icon.png')

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: false, // frameless: the renderer draws its own title bar (drag + controls)
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true, // dsh Web UI is embedded with <webview>
      preload: path.join(__dirname, '../preload/index.js')
    }
  })
  setMainWindow(win)

  win.once('ready-to-show', () => win.show())
  const wc = win.webContents

  // Fixed window title.
  wc.on('page-title-updated', (e) => e.preventDefault())
  win.on('page-title-updated', (e) => e.preventDefault())
  const enforceTitle = (): void => { if (!win.isDestroyed()) win.setTitle('DeepSeek Harness') }
  win.once('ready-to-show', enforceTitle)
  wc.on('did-navigate', enforceTitle)

  // Ctrl+T toggles Web <-> log views. Also catch keys typed inside the guest.
  const isCtrlT = (k: { type: string; key?: string; control: boolean; meta: boolean }): boolean => {
    const mod = process.platform === 'darwin' ? k.meta : k.control
    return k.type === 'keyDown' && mod && (k.key || '').toLowerCase() === 't'
  }
  wc.on('before-input-event', (event, input) => {
    // F12 打开/关闭主界面（Vue UI）的 DevTools 控制台，便于排查问题。
    if (input.type === 'keyDown' && (input.key || '') === 'F12') {
      event.preventDefault()
      if (wc.isDevToolsOpened()) wc.closeDevTools()
      else wc.openDevTools({ mode: 'detach' })
      return
    }
    if (isCtrlT(input)) {
      event.preventDefault()
      broadcast('ui:toggle-view')
    }
  })
  wc.on('did-attach-webview', (_event, guest) => {
    guest.on('before-input-event', (gEvent, input) => {
      if (isCtrlT(input)) {
        gEvent.preventDefault()
        broadcast('ui:toggle-view')
      }
    })
    guest.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  // Push any URL that became ready before the renderer loaded.
  wc.on('did-finish-load', () => {
    const url = getCurrentUrl()
    if (url) broadcast('dsh:url', url)
  })

  // Close behaviour: if a remembered choice exists apply it; otherwise ask the
  // renderer, which shows an Element Plus MessageBox (not a native dialog).
  win.on('close', (e) => {
    if (isQuitting()) return // real quit (tray "退出" / close-resolve quit) — let it close
    if (!getTray()) {
      // No tray available: closing really quits (window-all-closed handles it).
      setQuitting(true)
      return
    }
    e.preventDefault()

    const s = loadSettings()
    if (s.rememberClose) {
      if (s.closeToTray) {
        if (!win.isDestroyed()) win.hide()
      } else {
        setQuitting(true)
        app.quit()
      }
    } else {
      broadcast('ui:ask-close') // renderer shows the Element Plus prompt
    }
  })
  win.on('closed', () => {
    setMainWindow(null)
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void wc.loadURL(devUrl)
  } else {
    void wc.loadFile(rendererIndex())
  }
}

/** Show the main window, or recreate it if it was destroyed. */
export function showMainWindow(): void {
  const w = getMainWindow()
  if (w && !w.isDestroyed()) {
    if (!w.isVisible()) w.show()
    w.focus()
  } else {
    createShellWindow()
  }
}

/** System tray: close hides the window here; "退出" really quits (and stops dsh). */
export function createTray(): void {
  try {
    const iconPath = path.join(app.getAppPath(), 'resources', 'icon.png')
    let img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
    if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 })
    const t = new Tray(img)
    setTray(t)

    const visibleWindow = (): BrowserWindow | null => {
      const w = getMainWindow()
      return w && !w.isDestroyed() ? w : null
    }
    t.setToolTip('DeepSeek Harness Shell')
    t.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: mt('m.tray.showHide'),
          click: () => {
            const w = visibleWindow()
            if (w && w.isVisible()) w.hide()
            else showMainWindow()
          }
        },
        { type: 'separator' },
        { label: mt('m.tray.quitDsh'), click: quitApp }
      ])
    )
    t.on('click', () => {
      const w = visibleWindow()
      if (w && w.isVisible()) w.hide()
      else showMainWindow()
    })
  } catch (err) {
    // Tray may be unavailable (e.g. some Linux setups). Degrade gracefully:
    // closing the window then falls back to the previous hide-to-tray-less path.
    console.error('[dsh-desktop] failed to create tray:', err)
    setTray(null)
  }
}

/** Tray-driven real quit. */
export function quitApp(): void {
  setQuitting(true)
  destroyTray()
  app.quit()
}
