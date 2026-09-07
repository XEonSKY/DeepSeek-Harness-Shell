import { createI18n } from 'vue-i18n'
import zhCN from '@shared/locales/zh-CN'
import enUS from '@shared/locales/en-US'
import type { ResolvedLocale } from '@shared/types'

export type { ResolvedLocale }

/**
 * renderer 的 vue-i18n 单例（组合式 API，legacy:false）。
 * 文案与 main 共用同一份 shared/locales 目录。
 * 界面语言由 dsh settings.yaml 的 locale.preference（zh/en）决定，见 getUiLocale/setUiLocale。
 */
export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

/** 把 vue-i18n 切到某语言（不写盘；持久化走 setUiLocale）。 */
export function setLocale(locale: ResolvedLocale): void {
  i18n.global.locale.value = locale
}
