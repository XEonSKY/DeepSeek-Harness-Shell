# DeepSeek Harness Shell 用户文档站

基于 [VitePress](https://vitepress.dev/) 1.6 的中英双语站点，源码**内容**在本目录（`project/docs/`），**构建逻辑**在项目层（`project/.vitepress/config.mts`）。

- 简体中文：`/zh/`　·　English：`/en/`　·　根路径 `/` 由 `index.md` 跳转到 `/zh/`

## 目录结构

```text
project/
├─ .vitepress/config.mts   # 站点配置（srcDir: 'docs'，输出 .vitepress/dist）
└─ docs/                   # 文档内容
   ├─ index.md             # 根路径跳转（meta refresh → /zh/）
   ├─ zh/                  # 简体中文页面
   ├─ en/                  # 英文页面（与 zh/ 一一对应）
   ├─ public/              # CNAME / .nojekyll / logo.png
   └─ README.md            # 本文件（srcExclude，不发布）
```

## 命令（在 `project/` 下执行）

```bash
npm run docs:dev       # 本地预览（默认 http://localhost:5173）
npm run docs:build     # 构建到 .vitepress/dist
npm run docs:preview   # 预览构建产物
```

## 说明

- `srcDir` 指向 `docs/`，`public/` 作为静态资源目录；构建产物默认输出 `.vitepress/dist`（已 gitignore）。
- `nav` / `sidebar` 与站内链接集中在 `project/.vitepress/config.mts`；**中英两份页面必须成对存在**（`/zh/x` 与 `/en/x`）。
- 所有站内链接都必须带语言前缀（`/zh/...` 或 `/en/...`）。
- `README.md` 通过 `srcExclude` 排除，不发布。
- 发布到 GitHub Pages / 自定义域名时，请在 `config.mts` 设置 `base` 并重新构建部署（旧的内置构建产物已移除）。
