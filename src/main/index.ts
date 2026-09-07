import { app } from 'electron'
import { registerIpc } from './ipc'
import { startAutoCheckIfEnabled } from './appupdate'
import { loadSettings, startConfigWatchers } from './settings'
import { createShellWindow, createTray, showMainWindow } from './ui'
import { resolveInstall } from './kernel'
import { restart, killServer, killAllChildren } from './dsh'
import { getTray, isQuitting, setQuitting, destroyTray } from './runtime'

// ---------------------------------------------------------------------------
// Boot: wire IPC, start the external-config watchers, open the window/tray,
// and launch dsh when the kernel is present.
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  registerIpc()
  startConfigWatchers()
  createShellWindow()
  createTray()

  const cfg = loadSettings()
  // Launch dsh only if the kernel is present. When missing we do not show a
  // native prompt anymore — the renderer detects it on load and shows the
  // in-app install mask (installKernel starts dsh after a successful install).
  if (resolveInstall(cfg).present) {
    void restart()
  }

  // 打包后按设置自动检查 app 更新（静默，开发态自动跳过）。
  startAutoCheckIfEnabled()

  app.on('activate', () => {
    // macOS convention: re-show the window when the dock icon is clicked.
    showMainWindow()
  })
})

// Closing hides to tray when a tray exists. If there is no tray (unavailable),
// fall back to quitting when all windows are gone.
app.on('window-all-closed', () => {
  if (!getTray()) app.quit()
})

app.on('before-quit', () => {
  if (!isQuitting()) setQuitting(true)
  killServer()
  killAllChildren() // also reap any in-flight npm / leftover watchdog trees
  destroyTray()
})

process.on('exit', () => {
  killServer()
  killAllChildren()
})
process.on('SIGINT', () => {
  setQuitting(true)
  killServer()
  killAllChildren()
  app.quit()
})
