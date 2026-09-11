import { defineConfig } from 'vitepress'

const REPO = 'https://github.com/XEonSKY/DeepSeek-Harness-Shell'

// 两套语言各自位于独立目录：docs/zh/ 与 docs/en/，URL 前缀与目录一一对应。
// 站点根 `/` 由 docs/index.md 重定向到 /zh/（VitePress 的 locale 必须有 link 前缀，
// 因此这里不再使用无前缀的 root locale）。

const zhNav = [
  { text: '下载', link: '/zh/download' },
  { text: '快速开始', link: '/zh/quickstart' },
  { text: '界面与使用', link: '/zh/usage' },
  { text: '设置', link: '/zh/settings' },
  { text: '内核管理', link: '/zh/kernel' },
  { text: '常见问题', link: '/zh/faq' }
]

const zhSidebar = [
  {
    text: '用户文档',
    items: [
      { text: '下载与系统要求', link: '/zh/download' },
      { text: '快速开始', link: '/zh/quickstart' },
      { text: '标签页与多窗口', link: '/zh/usage' },
      { text: '设置说明', link: '/zh/settings' },
      { text: '内核（@deepseek-ai/dsh）管理', link: '/zh/kernel' },
      { text: '常见问题', link: '/zh/faq' }
    ]
  }
]

const enNav = [
  { text: 'Download', link: '/en/download' },
  { text: 'Quick start', link: '/en/quickstart' },
  { text: 'Usage', link: '/en/usage' },
  { text: 'Settings', link: '/en/settings' },
  { text: 'Kernel', link: '/en/kernel' },
  { text: 'FAQ', link: '/en/faq' }
]

const enSidebar = [
  {
    text: 'User guide',
    items: [
      { text: 'Download & system requirements', link: '/en/download' },
      { text: 'Quick start', link: '/en/quickstart' },
      { text: 'Tabs & multiple windows', link: '/en/usage' },
      { text: 'Settings', link: '/en/settings' },
      { text: 'Kernel (@deepseek-ai/dsh) management', link: '/en/kernel' },
      { text: 'FAQ', link: '/en/faq' }
    ]
  }
]

export default defineConfig({
  title: 'DeepSeek Harness Shell',
  description: 'DeepSeek Harness Shell —— 下载与使用文档',
  cleanUrls: true,
  lastUpdated: true,
  // README.md 是仓库/站点维护说明，不属于用户文档，不进站点。
  srcDir: 'docs',
  srcExclude: ['README.md'],
  head: [
    ['meta', { name: 'theme-color', content: '#0d1424' }],
    ['meta', { name: 'application-name', content: 'DeepSeek Harness Shell' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'DeepSeek Harness Shell' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    // 应用图标：由 app/resources/icon.png（256×256）复制为 docs/public/logo.png
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { property: 'og:image', content: '/logo.png' }]
  ],
  locales: {
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/'
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/'
    }
  },
  themeConfig: {
    search: {
      provider: 'local'
    },
    socialLinks: [{ icon: 'github', link: REPO }],
    // 说明：editLink / footer 是「按语言」的文案，必须放进下面的 locales 里，
    // 否则英文站会显示中文。outline / docFooter / lastUpdated 同理。
    locales: {
      zh: {
        label: '简体中文',
        lang: 'zh-CN',
        nav: zhNav,
        sidebar: zhSidebar,
        outline: { label: '本页导航', level: [2, 3] },
        docFooter: { prev: '上一页', next: '下一页' },
        lastUpdated: { text: '最后更新于', formatOptions: { dateStyle: 'short', timeStyle: 'short' } },
        editLink: {
          pattern: `${REPO}/edit/main/docs/:path`,
          text: '在 GitHub 上编辑此页'
        },
        footer: {
          message: 'DeepSeek Harness Shell · 用户文档',
          copyright:
            'Copyright © 2026 <a href="https://www.xeonsky.com/" target="_blank" rel="noopener">XEonSKY Studio</a>'
        }
      },
      en: {
        label: 'English',
        lang: 'en-US',
        nav: enNav,
        sidebar: enSidebar,
        outline: { label: 'On this page', level: [2, 3] },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Last updated at', formatOptions: { dateStyle: 'short', timeStyle: 'short' } },
        editLink: {
          pattern: `${REPO}/edit/main/docs/:path`,
          text: 'Edit this page on GitHub'
        },
        footer: {
          message: 'DeepSeek Harness Shell · User guide',
          copyright:
            'Copyright © 2026 <a href="https://www.xeonsky.com/" target="_blank" rel="noopener">XEonSKY Studio</a>'
        }
      }
    }
  }
})
