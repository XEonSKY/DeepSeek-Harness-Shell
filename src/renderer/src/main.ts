import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import 'element-plus/dist/index.css'
// Element Plus dark theme CSS variables (toggled via the `dark` class on <html>)
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import './assets/base.css'
import { i18n } from './locales'
import { router } from './router'
import type { ResolvedLocale } from '@shared/types'

/**
 * 启动：界面语言来自 dsh settings.yaml 的 locale.preference（zh/en），由主进程经
 * `getUiLocale` 解析返回；读不到时回退为跟随系统（zh/en）。据此挂载 vue-i18n
 * 与 Element Plus。
 */
async function bootstrap(): Promise<void> {
  let resolved: ResolvedLocale = 'zh'
  try {
    resolved = await window.api.getUiLocale()
  } catch {
    /* window.api 可能在异常环境不可用，按 zh 处理 */
  }
  i18n.global.locale.value = resolved

  const app = createApp(App)
  app.use(createPinia())
  app.use(ElementPlus, { locale: resolved === 'zh' ? zhCn : en })
  app.use(i18n)
  app.use(router)
  app.mount('#app')
}

void bootstrap()
