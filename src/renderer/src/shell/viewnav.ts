import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * 顶层视图（web / log / settings）的路由映射。
 *
 * 原先 App.vue 里同时存在 `view` computed、`go()` 与 `ensureWebRoute()` 三份等价逻辑；
 * 抽出 TitleBar 后两边都需要，故收敛到本模块（封装重复、避免两处各写一份而漂移）。
 */

export type ViewKey = 'web' | 'log' | 'settings'

/** 当前顶层视图（由 hash 路由推导）。 */
export function useView(): ComputedRef<ViewKey> {
  const route = useRoute()
  return computed<ViewKey>(() => {
    if (route.path.startsWith('/settings')) return 'settings'
    if (route.path.startsWith('/log')) return 'log'
    return 'web'
  })
}

/** 切到某顶层视图；路径未变则不做任何事。 */
export function useGoView(): (k: ViewKey) => void {
  const route = useRoute()
  const router = useRouter()
  return (k: ViewKey): void => {
    const path = k === 'web' ? '/' : k === 'log' ? '/log' : '/settings'
    if (route.path !== path) void router.push(path)
  }
}
