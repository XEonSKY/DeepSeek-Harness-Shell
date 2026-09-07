import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 顶层视图路由（DeepSeek UI / 日志 / 设置），其中「设置」下挂子路由（常规/外观/内核/关于）。
 * 视图均懒加载，切走即卸载——避免隐藏页常驻挂载占用/阻塞；hash 历史在 Electron file://
 * 与 dev server 下都稳定。name 与顶部栏高亮对应。
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'web', component: () => import('./views/HomeView.vue') },
    { path: '/log', name: 'log', component: () => import('./views/LogView.vue') },
    {
      // 父路由不命名：命名路由配上未命名的空路径子路由会触发 Vue Router 警告，
      // 且按名字导航无法落到空路径子路由。导航统一用 path，由子路由 name 区分。
      path: '/settings',
      component: () => import('./views/SettingsView.vue'),
      children: [
        { path: '', name: 'settings-root', redirect: { name: 'settings-general' } },
        { path: 'general', name: 'settings-general', component: () => import('./views/settings/GeneralPanel.vue') },
        { path: 'appearance', name: 'settings-appearance', component: () => import('./views/settings/AppearancePanel.vue') },
        { path: 'dsh', name: 'settings-dsh', component: () => import('./views/settings/DshPanel.vue') },
        { path: 'about', name: 'settings-about', component: () => import('./views/settings/AboutPanel.vue') }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
