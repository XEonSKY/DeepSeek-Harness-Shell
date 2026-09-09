<div align="center">

# 🚀 DeepSeek Harness Shell

**把 DeepSeek Harness 装进桌面 —— 一键启动 · 自给自足 · 开箱即用**

[![Electron](https://img.shields.io/badge/Electron-^44-47848F?logo=electron&logoColor=white&style=flat-square)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white&style=flat-square)](https://vuejs.org/)
[![Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-eee?style=flat-square)](#)
![Made with 💜](https://img.shields.io/badge/made%20with-%F0%9F%92%9C-f5a623?style=flat-square)

一个轻量、漂亮的桌面外壳，把 **DeepSeek Harness Web UI** 以原生窗口的方式跑起来：
不需要手动开终端、不需要自己装一堆东西——**首次使用跟着四步向导走，几分钟就能进入 DeepSeek Harness**。

</div>

---

## ✨ 为什么用它

| 🤔 痛点 | ✅ 它帮你 |
|---|---|
| 每次都要自己 `dsh web` 开终端？ | 一键启动，随窗口同生共死 |
| 装内核麻烦、版本混乱？ | 内置内核自管，可本地/全局、可回退历史版本 |
| 系统里没有 Node / npm？ | 可选 **内置 Node + 内置 npm**，自给自足 |
| 默认语言/网络不合心意？ | 中英双语、镜像源、代理都可调 |
| 界面太素？ | 主题/深色、缩放、二次元等**彩蛋扩展翻译** 🎨 |

> 它不替代 DeepSeek Harness 本身，而是它的**原生桌面入口 + 环境管家**。

---

## 🎁 功能一览

### 🚀 一键运行内核
- 自动定位/安装 `@deepseek-ai/dsh` 内核，窗口与内核**同生共死**；
- 内核来源：**内置（应用自管）** 或 **全局安装**；支持**启动 / 停止 / 重启**与实时状态。

### 🧰 环境自给（可选）
- **内置 Node**（按当前系统自动下载部署）· **内置 npm** · 本地内核/工作目录均收纳在应用配置目录；
- 需要系统 Node 时自动探测（要求 ≥ 20）。

### ⚙️ 贴心设置
- **常规**：工作目录、端口、关闭行为
- **外观**：主题（跟随系统/浅/深）、**界面缩放 50–200%**、禁用系统缩放
- **语言 / 扩展**：中文·English，二级菜单还能切换 **二次元 🐾 / 文言 📜 / 繁体中文 🀄** 等
- **网络**：npm 镜像源 + **代理**（协议 / 端口 / 范围）
- **内核**：启动器路径、Node/npm 来源、内核更新与**版本回退**、卸载
- 所有设置卡都可**折叠**，清爽不拥挤 ✨

### 🛡 其它
- 深色模式跟随系统 / 手动切换
- 原生托盘、关闭行为可记忆
- 启动引导（首次安装内核）带实时日志与进度条
- 应用与内核**自更新**

---

## 🖥 界面

<div align="center">

![DeepSeek UI](https://img.shields.io/badge/DeepSeek%20UI-%E2%96%B2-4D6BFE?style=for-the-badge)
![设置](https://img.shields.io/badge/%E8%AE%BE%E7%BD%AE-%E2%9A%99%EF%B8%8F-22c55e?style=for-the-badge)
![终端](https://img.shields.io/badge/%E7%BB%88%E7%AB%AF-black?style=for-the-badge)
![网页对话](https://img.shields.io/badge/Chat-4D6BFE?style=for-the-badge)

*（欢迎补上截图 😄）*

</div>

---

## 📦 安装与运行

**方式一：发布版（推荐）**
> 到 [Releases](../../releases) 下载对应平台的安装包（Windows / macOS / Linux）。

**方式二：从源码跑（给想折腾的朋友）**

```bash
git clone https://github.com/XEonSKY/DeepSeek-Harness-Shell.git
cd DeepSeek-Harness-Shell/app
npm install
npm run dev
```

首次启动会进入**安装向导**：镜像源 → Node 环境 → npm 环境 → 安装内核；一路“执行并下一步”即可。

---

## 💡 新手 Q&A

<details>
<summary><b>我本机没装 Node，能用吗？</b></summary>

能。向导里 Node 环境选 **本地部署** 或直接用 **Electron 自带 Node**；内置 npm 会在首次安装时自动拉取。

</details>

<details>
<summary><b>想用自己全局装的 DeepSeek Harness？</b></summary>

设置 → 内核 → 内核来源选「全局」即可（此时启动器路径可用文件选择器指定）。

</details>

<details>
<summary><b>界面想换个花样？</b></summary>

设置 → 外观 → 「语言」二级下拉里，把中文换成 **二次元 / 文言 / 繁体中文** 试试 🎉（纯本地文案覆盖，不影响你的 dsh 数据）。

</details>

<details>
<summary><b>用不惯镜像 / 网络慢？</b></summary>

设置 → 网络 → 切换 npm 镜像源，需要时再配置代理。

</details>

---

## 🗺 目录入口
- 主界面 `DeepSeek UI` ｜ 网页对话 `Chat` ｜ 用量充值 `Platform`
- 实时终端 `日志` ｜ 全部设置 `设置`
- 快捷键：`Ctrl/Cmd+T` 在 UI 与日志间切换

---

<div align="center">

**喜欢的点个 ⭐，遇到问题开 [Issue](../../issues) 🐛**

<br>

![Made for DeepSeek](https://img.shields.io/badge/%E4%B8%BA%20DeepSeek%20%E8%80%8C%E7%94%9F-4D6BFE?style=for-the-badge)

</div>
