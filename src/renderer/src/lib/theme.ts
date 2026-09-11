import { watch } from 'vue'
import { useDark, usePreferredDark } from '@vueuse/core'
import { COLOR_SCHEME_IDS } from '@shared/types'
import type { ColorSchemeId, Theme } from '@shared/types'

/**
 * 主题（明暗）与配色方案。
 *
 * 明暗：用 @vueuse 的 useDark/usePreferredDark 驱动 `<html>.dark`，替代手写 matchMedia + classList 逻辑。
 * `isDark` 对外导出：它是**已解析**的明暗状态（applyTheme 会把 'system' 解析为实际值并实时跟随系统），
 * 故深色模式的资源切换（如应用 Logo）应复用此 ref，而不是自己去判断 settings.theme === 'dark'。
 *
 * 配色方案：每套方案给出一个主色；**Element Plus 的 light-3/5/7/8/9 与 dark-2 是「主色与白/黑按比例
 * 插值」算出来的**，这里用同样的公式在运行时推导（EP 的 dark 主题也是往深处混色），因此不需要为每套
 * 方案手写十几个色值。页面/侧栏底色同样由主色轻混而来 —— 唯一的例外是默认方案，它锁死为原中性色。
 */

export const isDark = useDark({ valueDark: 'dark', valueLight: '' })
const preferredDark = usePreferredDark()

/** 预制配色方案：`neutral` = 底色保持纯中性（默认方案用它维持原观感）。 */
export interface ColorScheme {
    id: ColorSchemeId
    /** 主色，写进 `--el-color-primary`。 */
    primary: string
    neutral?: boolean
}

export const COLOR_SCHEMES: readonly ColorScheme[] = [
    { id: 'default', primary: '#409eff', neutral: true },
    { id: 'purple', primary: '#7c4dff' },
    { id: 'green', primary: '#18a058' },
    { id: 'cyan', primary: '#0ea5e9' },
    { id: 'orange', primary: '#f0932b' },
    { id: 'rose', primary: '#e5484d' },
    { id: 'graphite', primary: '#5c6b7a' }
]

/** 默认方案的中性底色：与加配色方案之前完全一致，避免「默认」也悄悄变了观感。 */
const NEUTRAL = {
    light: { page: '#ffffff', side: '#f9fafb' },
    dark: { page: '#151517', side: '#1b1b1c' }
} as const

function rgbOf(hex: string): [number, number, number] {
    const h = hex.replace('#', '')
    const full =
        h.length === 3
            ? h
                .split('')
                .map((c) => c + c)
                .join('')
            : h
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

/** 两个十六进制颜色按权重插值：`weight` 是 `to` 的占比（与 EP 的 SCSS `mix()` 同义）。 */
function mixHex(from: string, to: string, weight: number): string {
    const [r1, g1, b1] = rgbOf(from)
    const [r2, g2, b2] = rgbOf(to)
    const mix = (a: number, b: number): number => Math.round(a * (1 - weight) + b * weight)
    return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function schemeOf(id: ColorSchemeId): ColorScheme {
    return COLOR_SCHEMES.find((s) => s.id === id) ?? COLOR_SCHEMES[0]
}

/**
 * 某方案在某明暗下的页面 / 侧栏底色。**纯函数**：应用与设置页的色块预览共用它，
 * 保证预览里看到的和实际应用的是同一组值。
 */
export function schemeBackgrounds(id: ColorSchemeId, dark: boolean): { page: string; side: string } {
    const s = schemeOf(id)
    if (s.neutral) return dark ? { ...NEUTRAL.dark } : { ...NEUTRAL.light }
    // 逐级加深：浅色下侧栏比页面多带一点主色，深色下侧栏比页面稍亮（与 EP 默认的侧栏关系一致）。
    const base = dark ? '#0d0d0f' : '#ffffff'
    const pageWeight = dark ? 0.94 : 0.965
    const sideWeight = dark ? 0.89 : 0.93
    return {
        page: mixHex(s.primary, base, pageWeight),
        side: mixHex(s.primary, base, sideWeight)
    }
}

/** 当前生效的方案 id（applyColorScheme 记住它，供明暗变化时重算）。 */
let currentScheme: ColorSchemeId = 'default'

/**
 * 把配色方案写进 `<html>` 的行内 CSS 变量。
 * 明暗变了必须重算：`light-N` 的混色基准（白/黑）与底色都随明暗变。
 */
export function applyColorScheme(id: ColorSchemeId = currentScheme): void {
    currentScheme = COLOR_SCHEME_IDS.includes(id) ? id : 'default'
    const s = schemeOf(currentScheme)
    const dark = isDark.value
    const bg = schemeBackgrounds(currentScheme, dark)
    const root = document.documentElement
    const set = (k: string, v: string): void => root.style.setProperty(k, v)

    set('--el-color-primary', s.primary)
    set('--el-color-primary-dark-2', mixHex(s.primary, '#000000', 0.2))
    const mixTo = dark ? '#000000' : '#ffffff'
    for (const n of [3, 5, 7, 8, 9]) set(`--el-color-primary-light-${n}`, mixHex(s.primary, mixTo, n / 10))
    // 底色：--scheme-* 给设置页用（settings.css），--el-bg-color-page 让导航页/覆盖层也跟着走。
    set('--scheme-page-bg', bg.page)
    set('--scheme-side-bg', bg.side)
    set('--el-bg-color-page', bg.page)
}

// 明暗切换（含 'system' 跟随系统时的实时变化）后重算配色。
watch(isDark, () => applyColorScheme())

let stopFollow: (() => void) | null = null

/** 应用所选主题到整个文档：dark/light 直设，system 实时跟随系统偏好。 */
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
    applyColorScheme()
}
