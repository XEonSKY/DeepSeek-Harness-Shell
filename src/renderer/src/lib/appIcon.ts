import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { isDark } from './theme'
import iconLight from '../assets/icon.png'
import iconDark from '../assets/icon-dark.png'

/**
 * 应用 Logo 的图片来源：深色模式用 `icon-dark.png`，其余用 `icon.png`。
 *
 * 复用 `theme.ts` 的 `isDark`——它由 useDark 驱动 `<html>.dark`，且 `applyTheme()` 已把
 * `theme: 'system'` 解析为实际明暗并实时跟随系统偏好，因此这里**不要**直接判断
 * `settings.theme === 'dark'`（那会漏掉 system 场景）。
 *
 * 用法（`<script setup>` 内取局部 ref，模板中自动解包）：
 *   const appIcon = useAppIcon()
 *   <img :src="appIcon" />
 */
export function useAppIcon(): ComputedRef<string> {
  return computed(() => (isDark.value ? iconDark : iconLight))
}
