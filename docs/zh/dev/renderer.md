# 渲染进程

渲染层是 Vue 3 应用，负责标签页外壳、设置页、安装向导与终端。源码在 `src/renderer/src/`。

## 目录

| 路径 | 说明 |
|---|---|
| `App.vue` | 根组件：标题栏、webview 容器、设置覆盖层、全局提示与迁移进度框 |
| `views/` | 页面：`WebHost.vue`（内核 UI / 网页）、`NewTab.vue`（内置导航页）、`LogView.vue`（终端） |
| `views/settings/` | 设置面板：General / Appearance / Network / Env / Dsh / Log / Hotkeys / Webview / About |
| `components/` | `KernelWizard.vue`（四步安装向导）、`TitleBar.vue` 等 |
| `lib/` | 主题、标签、状态、格式化、更新提示、locale 工具 |
| `stores` / `views/settings/settingsStore.ts` | Pinia 状态与设置镜像 |

## 状态管理

- Pinia store 保存设置镜像，`useSettingsStore.ts` 负责从主进程读取并写回；
- 设置面板改动后调用主进程保存（部分设置需「立即应用」重启 dsh 才生效）。

## 标签与窗口

标签的创建、保活、拖动迁移逻辑在 `lib/tabs.ts` 等；核心窗口与副窗口的角色由主进程 `windowreg.ts` 与渲染层共同决定。

## 主题与语言

- 主题：跟随系统 / 浅色 / 深色；配色方案决定主色与底色；深色下应用图标切换深色版；
- i18n：`vue-i18n`，语言包在 `src/shared/locales/`（zh / en 及扩展翻译）；扩展翻译是文本覆盖；
- 主题与语言会同步到 dsh 自身的配置。

## 与主进程通信

所有主进程能力都通过 `window.api`（预加载暴露）调用，类型契约见 `src/shared/types.ts` 的 `RendererApi`。新增能力必须三处同步，见 [IPC 契约](/zh/dev/ipc)。