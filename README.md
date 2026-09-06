# DeepSeek Harness Shell

基于 **Electron + Vite + Vue 3 + Element Plus** 的工程化桌面外壳，承载
[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) Web UI。

传统做法是：在终端跑 `dsh web` 再把网址粘到浏览器。这个外壳把整套流程变成一个桌面应用：

- **无边框窗口**（`frame: false`），外壳自绘标题栏：整条可拖拽，右上角为最小化/最大化/关闭按钮；
- 通过一个 **watchdog 进程** 自动启动 `dsh web --no-open`；
- 用 **Vue3 + Element Plus** 渲染一个“外壳首页”（自绘标题栏 + 界面 / 终端 / 设置三个视图）；
- DeepSeek Harness Web UI 通过 **`<webview>` 内嵌** 在外壳的“界面”视图里展示；
- 内嵌 **dsh 终端/日志视图**（实时 stdout/stderr）；
- 看门狗保证 dsh 会随应用一起结束——无论正常退出、任务管理器强杀还是崩溃。

## 技术栈 / 目录结构

```
dsh-desktop/
├─ electron.vite.config.ts     # electron-vite 构建配置（main / preload / renderer）
├─ tsconfig*.json              # TS 工程引用（node 侧 + web 侧）
├─ resources/icon.png          # 应用图标
├─ src/
│  ├─ shared/types.ts          # 主/渲染进程共享的类型与 IPC 契约
│  ├─ main/index.ts            # 主进程：无边框窗口、spawn watchdog dsh、端口、IPC
│  ├─ preload/index.ts         # contextBridge 桥（window.api）
│  └─ renderer/                # Vite + Vue3 + Element Plus 前端
│     ├─ index.html
│     └─ src/
│        ├─ App.vue            # 外壳：自绘标题栏(拖拽+窗口按钮) + 三视图
│        ├─ state.ts           # 共享响应式状态
│        └─ views/
│           ├─ HomeView.vue    # <webview> 内嵌 dsh Web UI
│           ├─ LogView.vue     # dsh 实时日志/终端
│           └─ SettingsView.vue# 设置（Element Plus 表单）
└─ package.json                # main 指向 out/main/index.js
```

- 主/预加载/渲染三端均使用 **TypeScript**。
- 渲染端使用 **Vite + Vue 3 + Element Plus**（全局注册，组件为 `el-*`，图标 `@element-plus/icons-vue`）。
- 构建由 **electron-vite** 编排（一次 `npm run build` 同时产出 `out/main`、`out/preload`、`out/renderer`）。

## 前置条件

- [Node.js](https://nodejs.org/)（建议 ≥ 20）。
- `PATH` 里有 `dsh` CLI：

  ```bash
  npm install -g @deepseek-ai/dsh
  dsh --version
  ```

## 安装

```bash
npm install
```

> 若 npm 提示 `electron` 的 install 脚本被 `allowScripts` 拦截，本项目的
> `package.json` 已加入 `"allowScripts": { "electron": true }`。重新执行一次
> `npm install`（或 `npm rebuild electron`）即可下载 Electron 二进制。

## 开发 / 运行

```bash
# 开发模式（带 HMR，主进程改动自动重启）
npm run dev

# 仅类型检查
npm run typecheck

# 先构建后以 preview 方式运行（等同于打包产物预览）
npm run build
npm run start
```

## 打包

```bash
# 构建 + electron-builder 出当前平台安装包（按当前机器架构）
npm run dist

# 指定 Windows（nsis 安装包 + portable 免安装单文件）
npm run dist:win

# 指定平台与架构（缺省架构由 electron-builder 自动，也可显式指定）
npm run dist:win:x64
npm run dist:win:arm64
npm run dist:mac
npm run dist:linux:x64
npm run dist:linux:arm64
```

产物在 `dist/`。`appId` 为 `com.deepseek.harness.shell`，产品名 `DeepSeek Harness Shell`，
图标取 `resources/icon.png`。

### 产物命名规则

安装包/镜像文件名统一为 **无空格连字符** 形式，避免产品名空格带来的文件名问题，也方便上传
GitHub Release 等资源：

```
DeepSeek-Harness-Shell-<版本>-<平台>-<架构>.<扩展名>
```

| 平台 | 示例 | 扩展名 |
| --- | --- | --- |
| Windows 安装包 | `DeepSeek-Harness-Shell-0.0.1-win-x64-setup.exe` | `.exe` |
| Windows 免安装 | `DeepSeek-Harness-Shell-0.0.1-win-x64-portable.exe` | `.exe` |
| macOS | `DeepSeek-Harness-Shell-0.0.1-mac-arm64.dmg` | `.dmg` |
| Linux | `DeepSeek-Harness-Shell-0.0.1-linux-x64.AppImage` | `.AppImage` |

- 平台取值：`win` / `mac` / `linux`；架构取值：`x64` / `arm64`（`ia32` 等随实际构建）。
- 目标平台与架构在 `package.json` 的 `build.win/mac/linux.target` 中声明（`nsis`、`portable`、
  `dmg`、`AppImage` 均声明了 `x64` 与 `arm64`），每目标各自的 `artifactName` 定义上面的命名模板。

### 版本号规则

- 唯一版本来源为 **`package.json` 顶层 `"version"`**（当前 `0.0.1`）。Electron 运行时的
  `app.getVersion()`、「关于」页显示、以及所有产物文件名里的 `<版本>` 都取自它——不要在多处维护版本号。
- 采用标准 semver（`主.次.修订`，如 `0.1.0`）；预发布请在修订后追加 `-beta.N` / `-rc.N`。
- 版本号不应带前导 `v`（`v` 只用于 Git tag / GitHub Release 名称）。发布新版本时打 tag
  `v0.1.0` 并对应更新 `package.json` 的 `version` 为 `0.1.0`。
- 不要直接改动 `bun.lock` / `package-lock.json` 里的版本——它们从 `package.json` 自动生成。

## 界面与快捷键

- **顶栏**：左侧品牌与连接状态，中间三个视图切换（DeepSeek UI / dsh 终端 / 设置），
  右侧「在浏览器打开」「退出」。
- **界面视图**：`<webview>` 内嵌 dsh Web UI；右上角有「重新加载」。
- **终端视图**：实时显示 dsh 进程 stdout/stderr，支持清空显示与自动滚动开关。
- **设置视图**：编辑工作目录 / 端口 / 关闭行为 / 高级项，改动会**自动保存**（右上角显示“已自动保存”）；
  涉及 dsh 运行的项（工作目录、端口、dsh 路径、超时）点「应用到 dsh（重启）」后才生效。
- **外观**：界面默认圆角为 8px；支持浅色 / 深色 / 跟随系统主题（即时生效，无需重启），并会**同步到
  DeepSeek Harness 自身的 `{user}\.dsh\settings.yaml` 的 `ui-theme.preference`** 再刷新界面。
  「设置」页底部有「恢复默认设置」，可一键还原所有配置。
- **安装与版本自检**：每次启动会自动检查 `@deepseek-ai/dsh` 的安装与版本，结果以**右上角通知**呈现
  （最新 / 有新版本 / 未安装 / 无法联网），并附带对应 npm 命令；「设置」里的“检查更新”可手动触发
  （通知会避开自绘标题栏显示）。
- **`Ctrl+T`（macOS `Cmd+T`）**：在「DeepSeek UI」与「dsh 终端」之间快速切换
  （在 dsh Web UI 内按也能触发）。
- **最小化与托盘**：点最小化缩到 Windows 任务栏；点关闭默认会询问是“隐藏到系统托盘（dsh 继续后台运行）”
  还是“直接退出（并结束 dsh）”，勾选“记住我的选择”后不再询问。可在「设置」→「关闭按钮行为」里
  直接指定并记住。托盘图标可恢复窗口，托盘菜单「退出」真正结束应用与 dsh。

## 配置（优先级从高到低）

| 优先级 | 位置 | 键 |
| --- | --- | --- |
| 1 | CLI（`--` 之后传给进程） | `--port`、`--host`、`--workspace`、`--timeout-ms`、`--dsh-bin` |
| 2 | 环境变量 | `DSH_DESKTOP_PORT/HOST/WORKSPACE/TIMEOUT_MS`、`DSH_BIN`、`DSH_NODE` |
| 3 | `settings.json`（设置页写入） | 同构字段 |
| 4 | 内置默认值 | `127.0.0.1`、端口自动、超时 `90000ms` |

`settings.json` 位于 userData 目录（Windows：`%APPDATA%/DeepSeek Harness Shell/settings.json`）。

端口规则：留空/`null` → 从 `3080` 起自动扫描一个空闲端口；正整数 → 以该端口为起点扫描；
`0` → 完全交给操作系统分配。dsh 只接受 `127.0.0.1`。

## 进程生命周期与安全

- **dsh 必随应用结束**：主进程杀掉 watchdog 的进程树；应用被强杀/崩溃时，watchdog 通过
  stdin 关闭感知并自行终止 dsh，不会残留孤儿 `dsh web`。
- 主窗口只运行本地 Vue UI；dsh Web UI 运行在隔离的 `<webview>` 中，仅访问回环地址。
- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。

## 说明

- 旧版单文件（根目录 `main.js`、`preload.js`、`terminal.html`）已由新的 `src/` 工程取代，
  可安全删除。
