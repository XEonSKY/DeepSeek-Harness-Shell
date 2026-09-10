import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 顶层视图路由。标签页承载的 web 内容统一由 `/`(WebHost) 渲染（激活的 webview 标签页），
 * 日志与设置仍是独立页面。`/chat`、`/platform` 不再单独成路由——它们是标签条里的固定标签页。
 * 视图懒加载，切走即卸载；hash 历史在 Electron file:// 与 dev server 下都稳定。
 * name 与标题栏高亮对应。
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'web', component: () => import('../views/WebHost.vue') },
    { path: '/log', name: 'log', component: () => import('../views/LogView.vue') },
    {
      // 父路由不命名：命名路由配上未命名的空路径子路由会触发 Vue Router 警告，
      // 且按名字导航无法落到空路径子路由。导航统一用 path，由子路由 name 区分。
      path: '/settings',
      component: () => import('../views/SettingsView.vue'),
      children: [
        { path: '', name: 'settings-root', redirect: { name: 'settings-general' } },
        { path: 'general', name: 'settings-general', component: () => import('../views/settings/GeneralPanel.vue') },
        { path: 'appearance', name: 'settings-appearance', component: () => import('../views/settings/AppearancePanel.vue') },
        { path: 'network', name: 'settings-network', component: () => import('../views/settings/NetworkPanel.vue') },
        { path: 'dsh', name: 'settings-dsh', component: () => import('../views/settings/DshPanel.vue') },
        { path: 'about', name: 'settings-about', component: () => import('../views/settings/AboutPanel.vue') }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
