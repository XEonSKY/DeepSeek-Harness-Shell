import { watch } from 'vue'
import { useDark, usePreferredDark } from '@vueuse/core'
import type { Theme } from '@shared/types'

/**
 * 主题切换：用 @vueuse 的 useDark/usePreferredDark 驱动 <html>.dark，
 * 替代手写 matchMedia + classList 逻辑；语义与原实现一致。
 */
const isDark = useDark({ valueDark: 'dark', valueLight: '' })
const preferredDark = usePreferredDark()

let stopFollow: (() => void) | null = null

/** 应用所选配色到整个文档：dark/light 直设，system 实时跟随系统偏好。 */
export function applyTheme(theme: Theme): void {
  stopFollow?.()
  stopFollow = null
  if (theme === 'dark') {
    isDark.value = true
  } else if (theme === 'light') {
    isDark.value = false
  } else {
    // 'system'：先按当前系统设置，并跟随其后续变化
    isDark.value = preferredDark.value
    stopFollow = watch(preferredDark, (d) => {
      isDark.value = d
    })
  }
}
