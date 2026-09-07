# DeepSeek Harness Shell

把 DeepSeek Harness Web UI 装进一个桌面应用的外壳：自动以子进程拉起 `dsh web --no-open`，用 `<webview>` 内嵌到无边框 Electron 窗口中展示。

Electron 44 · electron-vite 5 · Vue 3 · Element Plus · TypeScript(strict)

## 功能特性

- **桌面承载 DeepSeek Harness**：child process 启动 `dsh web`，`<webview>` 内嵌；无边框窗口 + 自绘标题栏。
- **watchdog 兜底**：dsh 随应用结束而终止（正常退出 / 强杀 / 崩溃均不残留孤儿进程）。
- **多语言 i18n**：简体中文 / English；语言统一存于 `~/.dsh/settings.yaml` 的 `locale.preference`（`zh`/`en`），可在「设置 → 外观」切换。
- **主题同步**：浅色 / 深色 / 跟随系统，并写回 dsh 的 `settings.yaml`（`ui-theme.preference`）。
- **内核管理与更新**：自动检测 / 安装 / 切换 `@deepseek-ai/dsh`，版本列表、更新检查、卸载（可选 npm 镜像源）。
- **应用自动更新**：electron-updater + GitHub Release，后台下载、进度展示、立即重启安装；支持「自动更新 / 检测测试版」开关（仅打包版可用）。
- **设置持久化**：常规改动自动保存；运行相关项一键「应用到 DeepSeek Harness（重启）」。

## 快速开始

```bash
npm install          # 安装依赖
npm run dev          # electron-vite dev（HMR）
npm run typecheck    # node + web 类型检查
npm run build        # 构建到 out/
npm run start        # 预览构建产物
```

前置：Node ≥ 20，并已全局安装内核 `npm install -g @deepseek-ai/dsh`。

## 打包

```bash
npm run dist:win:x64        # Windows（nsis + portable）
npm run dist:mac            # macOS
npm run dist:linux:x64      # Linux
```

- 主程序 exe 名：`dsh_shell`；开始菜单 / 桌面快捷方式名仍为 **DeepSeek Harness Shell**；图标取自 `resources/icon.png`。
- 产物文件名形如 `DeepSeek-Harness-Shell-<version>-<os>-<arch>-{setup,portable}.exe`。
- 版本号唯一来源 `package.json` 的 `version`（不带前导 `v`）。
- 自动更新依赖 `build.publish`（GitHub：`XEonSKY/DeepSeek-Harness-Shell`）与真实 Release，且仅打包版生效。

## 技术栈与目录

Electron + electron-vite · Vue 3 + Element Plus · TypeScript(strict) · vue-i18n / pinia / vue-router / @vueuse · semver / yaml

```
DeepSeekHarness-Shell/
├─ src/
│  ├─ shared/             # 跨进程：types(契约) / i18n(纯 t) / locales(zh/en 文案)
│  ├─ main/               # 按职责分层：index(接线) settings kernel dsh updater appupdate ui ipc runtime tools semver
│  ├─ preload/            # contextBridge → window.api
│  └─ renderer/           # 顶层路由 Web / Log / Settings(+ 子路由 general/appearance/dsh/about)
│     ├─ router.ts locales.ts theme.ts state.ts update.ts
│     └─ views/settings/  # SettingsView 壳 + General/Appearance/Dsh/About 面板 + useSettingsStore(pinia)
├─ resources/icon.png
├─ package.json           # executableName=dsh_shell; build.publish=github
└─ electron.vite.config.ts / tsconfig*.json
```

## 配置优先级

CLI（`--host/--port/--workspace/--timeout-ms/--dsh-bin`）＞ 环境变量（`DSH_DESKTOP_*`、`DSH_BIN`、`DSH_NODE`）＞ `settings.json`（userData）＞ 默认值。语言与主题另随 dsh 的 `~/.dsh/settings.yaml` 统一管理。

## License

Apache License 2.0 © XEonSKY Studio
