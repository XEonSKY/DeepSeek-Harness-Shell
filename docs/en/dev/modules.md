# Main-process modules

The main process has two halves: `app/` handles the app itself (windows, config, updates, IPC), and `kernel/` handles the dsh kernel and runtime environment.

## app/

| Module | Responsibility | Key exports / notes |
|---|---|---|
| `index.ts` | App entry | Single-instance lock, dev userData isolation, whenReady startup order, quit cleanup |
| `settings.ts` | Settings and config directory | `configDir()` / `loadSettings()` / `saveSettings()`; config-directory migration orchestration; `tempDownloadDir()` / `tempNpmDir()`; file watcher |
| `configmigrate.ts` | Config-directory migration implementation | Plan persistence, `scanTree` / `migrateTree`, `rollbackMoves` |
| `ipc.ts` | All `ipcMain` handlers | Implements the `RendererApi` contract; install progress, version lists, etc. |
| `ui.ts` | Windows / tray / shortcuts | `createShellWindow` / `createTray` / `syncGlobalHotkey` |
| `appupdate.ts` | App self-update | Resolves GitHub Releases, background download, event broadcasts |
| `appslots.ts` | A/B version slots | Archives the old version, generates the rollback script, startup health guard |
| `webview.ts` | Renderer parameters | Hardware acceleration, webview UserAgent |
| `windowreg.ts` | Window registry | Core / secondary window roles and takeover |
| `contextmenu.ts` | Context menu | Cut / copy / paste / select all |
| `runtime.ts` | Runtime state | Tray, quit flag, broadcasts |
| `const.ts` | Constants | — |

## kernel/

| Module | Responsibility | Key exports |
|---|---|---|
| `dsh.ts` | dsh start/stop / port / logs | `restart` / `stopDshGracefully` / `killAllChildren`; watchdog child process |
| `watchdog.ts` | Watchdog code | `WATCHDOG_CODE` (detaches from this process to supervise dsh) |
| `kernel.ts` | Kernel install / update / uninstall | `installTo` / `updateKernel` / `listVersions` / `resolveInstall` / version management |
| `nodeenv.ts` | Node download & deployment | `deployLocalNode` / `listNodeVersions` / `nodeStatus` / version management |
| `npmRunner.ts` | npm detection / execution / cache | `ensureBundledNpm` / `runNpm` / `listNpmVersions` / `npmCacheEnv` |
| `downloader.ts` | Multi-threaded downloader | `downloadFile` (HTTP Range segmentation, deduplication, cancellation) |
| `cancel.ts` | Cancellation tokens | `beginCancelable` / `cancelActive` / `isAbortError` |
| `installs.ts` | Versioned directories | `installRoot` / `versionDir` / `resolveActive` / `isVersionComplete` / `migrateLegacyInstalls` |
| `tools.ts` | Path resolution | `localNodeExecPath` / `nodeRuntimeFor` / `resolveKernel` / `findSystemNode` |
| `semver.ts` | Version utilities | `sortVersionsDesc` / `filterByPrerelease` / `compareVersions` / `pickLatest` |
| `net.ts` | Proxy | Proxy-related helpers |

> For per-module details see the corresponding developer docs: the install pipeline in [Kernel & environment install pipeline](/en/dev/installs), the config directory in [Config directory](/en/dev/config-dir), and updates in [App self-update](/en/dev/app-update).
