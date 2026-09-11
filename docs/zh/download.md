# 下载与系统要求

DeepSeek Harness Shell 是跨平台桌面应用（Windows / macOS / Linux），安装包发布在 GitHub Releases。

## 版本

当前文档对应版本：**0.1.5-alpha-5**。

## 系统要求

| 项 | 要求 |
|---|---|
| 操作系统 | Windows 10/11（x64、arm64）、macOS、主流 Linux（x64、arm64） |
| 运行时 | 无需预装 Node.js（自带 `@deepseek-ai/dsh` 内核管理） |
| 网络 | 首次需联网以下载 / 安装 dsh 内核；后续使用本地回环地址 |

> 内核 `@deepseek-ai/dsh` 由应用自动检测；缺失时应用内会引导一键安装（可选官方 registry.npmjs.org 或 npmmirror 镜像）。

## 从哪里下载

- 打开 [Releases](https://github.com/XEonSKY/DeepSeek-Harness-Shell/releases) 页面，选择最新版本。
- 产物命名形如：`DeepSeek-Harness-Shell-<版本>-<平台>-<架构>.<后缀>`
  - Windows 安装包：`...-win-x64-setup.exe` / `...-win-arm64-setup.exe`
  - macOS：`...-mac-x64.dmg` / `...-mac-arm64.dmg`（同版本另有 `.zip`，供自动更新使用）
  - Linux：`...-linux-x64.AppImage` / `...-linux-arm64.AppImage`

::: tip 选择架构
按你**运行的进程架构**（即安装包架构）匹配资产：ARM 机器请下载 arm64 版，Intel/AMD 请下载 x64 版。
:::

## 验证与安全

- 建议仅从官方 Releases 下载；应用自更新同样走 GitHub 发布。
- 若所在网络访问 GitHub 较慢，可在「设置 → 网络 → GitHub 镜像」填入公共镜像前缀（如 `https://ghproxy.com`）来加速更新包的下载；留空即直连。
- 安装后如有「未知发行者」提示，请按系统引导放行（开源应用常未付费签名）。
