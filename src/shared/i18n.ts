import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'
import type { LocaleCode, ResolvedLocale } from './types'

/**
 * 跨进程共享的 i18n 工具（供 main 进程使用；renderer 走 vue-i18n 但消费同一份目录）。
 * 纯函数、无副作用、不依赖 Vue / Electron，方便 Node 侧直接 import。
 */

/** locale -> 目录 */
export const messages: Record<ResolvedLocale, unknown> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

/** 把应用内部语言转成 dsh settings.yaml 用的两字母码。 */
export function localeCodeOf(locale: ResolvedLocale): LocaleCode {
  return locale === 'zh-CN' ? 'zh' : 'en'
}

/**
 * 由 dsh `locale.preference`（两字母码）解析为内部语言；未设置时按系统语言回退。
 * @param pref   dsh 配置里的偏好（'zh'/'en'，可能为 null/缺失）
 * @param system 系统语言（app.getLocale()/navigator.language）
 */
export function resolveLocale(pref: string | null | undefined, system?: string): ResolvedLocale {
  if (pref === 'zh' || pref === 'en') return pref === 'zh' ? 'zh-CN' : 'en-US'
  const sys = (system ?? '').toLowerCase()
  return sys.startsWith('zh') ? 'zh-CN' : 'en-US'
}

type AnyDict = Record<string, unknown>

/** 按点分路径在嵌套目录中查找叶子字符串；找不到返回 null。 */
function lookup(root: unknown, path: string): string | null {
  let node: unknown = root
  for (const part of path.split('.')) {
    if (node == null || typeof node !== 'object') return null
    node = (node as AnyDict)[part]
  }
  return typeof node === 'string' ? node : null
}

/**
 * 纯翻译函数：读 `locale` 目录中 `path`（点分）的文案并替换 `{name}` 占位符。
 * 缺失时回退 zh-CN，再缺失则原样返回 path。
 */
export function t(locale: ResolvedLocale, path: string, params?: Record<string, unknown>): string {
  const template = lookup(messages[locale], path) ?? lookup(messages['zh-CN'], path) ?? path
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : m
  )
}
