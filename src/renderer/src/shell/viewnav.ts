import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * 顶层视图（web / settings）的路由映射。
 *
 * 原先 App.vue 里同时存在 `view` computed、`go()` 与 `ensureWebRoute()` 三份等价逻辑；
 * 抽出 TitleBar 后两边都需要，故收敛到本模块（封装重复、避免两处各写一份而漂移）。
 *
 * **终端不再是顶层视图**：它已并进设置页成为 `/settings/log` 面板，所以 `ViewKey` 只剩
 * web / settings 两个值；Ctrl+T 的「跳到终端」语义由 `useToggleTerminal()` 直接跳那一个子页
 * （用 useGoView('settings') 只会落到设置首页，不是终端）。
 */

export type ViewKey = 'web' | 'settings'

/** 终端所在的设置子页（设置侧栏「终端」；Ctrl+T 的去处）。 */
export const TERMINAL_PATH = '/settings/log'

/** 当前顶层视图（由 hash 路由推导）。 */
export function useView(): ComputedRef<ViewKey> {
  const route = useRoute()
  return computed<ViewKey>(() => (route.path.startsWith('/settings') ? 'settings' : 'web'))
}

/** 切到某顶层视图；路径未变则不做任何事。 */
export function useGoView(): (k: ViewKey) => void {
  const route = useRoute()
  const router = useRouter()
  return (k: ViewKey): void => {
    const path = k === 'web' ? '/' : '/settings'
    if (route.path !== path) void router.push(path)
  }
}

/**
 * Ctrl+T：在网页与「设置·终端」之间来回切（已经停在终端页则回网页）。
 * 不写成 `go(view==='web' ? ... )` 是因为终端现在是设置页的子页，顶层视图这一个维度表达不了它。
 */
export function useToggleTerminal(): () => void {
  const route = useRoute()
  const router = useRouter()
  return (): void => {
    const next = route.path === TERMINAL_PATH ? '/' : TERMINAL_PATH
    if (route.path !== next) void router.push(next)
  }
}
