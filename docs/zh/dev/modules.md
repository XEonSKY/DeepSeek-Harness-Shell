# 主进程模块

主进程分两块：`app/` 负责应用自身（窗口、配置、更新、IPC），`kernel/` 负责 dsh 内核与运行环境。

## app/

| 模块 | 职责 | 关键导出 / 说明 |
|---|---|---|
| `index.ts` | 应用入口 | 单实例锁、dev userData 隔离、whenReady 启动顺序、退出清理 |
| `settings.ts` | 设置与配置目录 | `configDir()` / `loadSettings()` / `saveSettings()`；配置目录迁移编排；`tempDownloadDir()` / `tempNpmDir()`；文件监听 |
| `configmigrate.ts` | 配置目录迁移实现 | 计划持久化、`scanTree` / `migrateTree`、`rollbackMoves` |
| `ipc.ts` | 所有 `ipcMain` handler | 实现 `RendererApi` 契约；安装进度、版本列表等 |
| `ui.ts` | 窗口 / 托盘 / 快捷键 | `createShellWindow` / `createTray` / `syncGlobalHotkey` |
| `appupdate.ts` | 应用自更新 | 解析 GitHub Releases、后台下载、事件广播 |
| `appslots.ts` | A/B 版本槽 | 归档旧版、生成回退脚本、启动健康守卫 |
| `webview.ts` | 渲染参数 | 硬件加速、webview UserAgent |
| `windowreg.ts` | 窗口登记 | 核心 / 副窗口角色与接管 |
| `contextmenu.ts` | 右键菜单 | 剪切 / 复制 / 粘贴 / 全选 |
| `runtime.ts` | 运行态 | 托盘、退出标志、广播 |
| `const.ts` | 常量 | —— |

## kernel/

| 模块 | 职责 | 关键导出 |
|---|---|---|
| `dsh.ts` | dsh 启停 / 端口 / 日志 | `restart` / `stopDshGracefully` / `killAllChildren`；watchdog 子进程 |
| `watchdog.ts` | watchdog 代码 | `WATCHDOG_CODE`（脱离本进程守护 dsh） |
| `kernel.ts` | 内核安装 / 更新 / 卸载 | `installTo` / `updateKernel` / `listVersions` / `resolveInstall` / 版本管理 |
| `nodeenv.ts` | Node 下载部署 | `deployLocalNode` / `listNodeVersions` / `nodeStatus` / 版本管理 |
| `npmRunner.ts` | npm 探测 / 执行 / 缓存 | `ensureBundledNpm` / `runNpm` / `listNpmVersions` / `npmCacheEnv` |
| `downloader.ts` | 多线程下载器 | `downloadFile`（HTTP Range 分段、去重、取消） |
| `cancel.ts` | 取消令牌 | `beginCancelable` / `cancelActive` / `isAbortError` |
| `installs.ts` | 版本化目录 | `installRoot` / `versionDir` / `resolveActive` / `isVersionComplete` / `migrateLegacyInstalls` |
| `tools.ts` | 路径解析 | `localNodeExecPath` / `nodeRuntimeFor` / `resolveKernel` / `findSystemNode` |
| `semver.ts` | 版本工具 | `sortVersionsDesc` / `filterByPrerelease` / `compareVersions` / `pickLatest` |
| `net.ts` | 代理 | 代理相关辅助 |

> 逐模块细节见对应开发文档：安装链路见[内核与环境安装链路](/zh/dev/installs)，配置目录见[配置目录](/zh/dev/config-dir)，更新见[应用自更新](/zh/dev/app-update)。