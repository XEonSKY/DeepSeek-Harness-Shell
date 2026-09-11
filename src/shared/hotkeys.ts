/**
 * 快捷键（Electron accelerator）的跨端工具。
 *
 * 放 `shared/` 的理由与 `version.ts` 一样：主进程要用它**匹配** `before-input-event` 里的事件，
 * 渲染层要用它**录制**用户按下的组合并做**显示美化** —— 两端的解析规则必须一致，
 * 否则会出现「界面上显示 Ctrl+T、实际匹配不上」这种最难查的问题。
 *
 * 支持范围有意收敛到 **字母 / 数字 / F1–F24** 三种主键 + 四个修饰键。理由：Electron 对
 * `Space`/`Esc`/`Up` 等主键名的拼写有自己的一套（写错不会报错，只是永远匹配不上），
 * 与其凭记忆猜，不如只支持我确定的部分，其余在录制时直接拒绝并给出提示。
 */

/** 快捷键事件里我们关心的部分：主进程的 `Electron.Input` 与渲染层的 `KeyboardEvent` 都能提供。 */
export interface HotkeyEvent {
    key: string
    control: boolean
    meta: boolean
    alt: boolean
    shift: boolean
}

/** 只按下修饰键本身时不算一个组合。 */
const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'os'])

/** 主键白名单：单字母、单数字、F1–F24。 */
function normalizeKey(raw: string): string | null {
    const k = (raw || '').trim()
    if (!k) return null
    if (/^[a-zA-Z]$/.test(k)) return k.toUpperCase()
    if (/^[0-9]$/.test(k)) return k
    if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(k)) return k.toUpperCase()
    return null
}

/**
 * 把一次按键构造成 accelerator（录制用）。
 * 必须「有修饰键 + 一个合法主键」；纯修饰键或不被支持的主键返回 null。
 * CommandOrControl 是跨平台写法：macOS 上按 ⌘、其它平台按 Ctrl 都会存成它。
 */
export function buildAccelerator(ev: HotkeyEvent, isMac: boolean): string | null {
    if (MODIFIER_KEYS.has(ev.key.toLowerCase())) return null
    const key = normalizeKey(ev.key)
    if (!key) return null
    const parts: string[] = []
    if ((isMac && ev.meta) || (!isMac && ev.control)) parts.push('CommandOrControl')
    // 在 mac 上按住 Ctrl 而不是 ⌘ 时，Alt 之外还可能是 Control —— 明确区分，不猜用户意图。
    if (isMac && ev.control) parts.push('Control')
    if (!isMac && ev.meta) parts.push('Super')
    if (ev.alt) parts.push('Alt')
    if (ev.shift) parts.push('Shift')
    if (parts.length === 0) return null // 裸字母会把打字全吃掉，必须带修饰键
    parts.push(key)
    return parts.join('+')
}

/** 拆分 accelerator：返回修饰键集合 + 主键（全小写）。无法识别时返回 null。 */
function parseAccelerator(accel: string): { mods: Set<string>; key: string } | null {
    const raw = (accel || '').trim()
    if (!raw) return null
    const tokens = raw.split('+').map((t) => t.trim()).filter(Boolean)
    if (tokens.length === 0) return null
    const key = normalizeKey(tokens[tokens.length - 1])
    if (!key) return null
    const mods = new Set<string>()
    for (const t of tokens.slice(0, -1)) {
        const m = t.toLowerCase()
        if (m === 'commandorcontrol' || m === 'cmdorctrl') mods.add('cmdorctrl')
        else if (m === 'command' || m === 'cmd' || m === 'meta') mods.add('meta')
        else if (m === 'control' || m === 'ctrl') mods.add('control')
        else if (m === 'alt' || m === 'option') mods.add('alt')
        else if (m === 'shift') mods.add('shift')
        else if (m === 'super') mods.add('meta')
        else return null // 不认识的修饰键 → 整体判为无效（宁可匹配不上，也别匹配错）
    }
    return { mods, key }
}

/**
 * 判断一次按键是否命中该 accelerator（主进程 `before-input-event` 用）。
 * **修饰键必须完全一致** —— 否则 Ctrl+Shift+T 会被 Ctrl+T 抢走。
 */
export function matchesAccelerator(accel: string, ev: HotkeyEvent, isMac: boolean): boolean {
    const parsed = parseAccelerator(accel)
    if (!parsed) return false
    if (normalizeKey(ev.key) !== parsed.key) return false
    const wantCtrl = parsed.mods.has('control') || (parsed.mods.has('cmdorctrl') && !isMac)
    const wantMeta = parsed.mods.has('meta') || (parsed.mods.has('cmdorctrl') && isMac)
    return (
        ev.control === wantCtrl && ev.meta === wantMeta && ev.alt === parsed.mods.has('alt') && ev.shift === parsed.mods.has('shift')
    )
}

/** 显示用：把 CommandOrControl 换成当前平台实际的键名，便于用户一眼看懂。 */
export function prettyAccelerator(accel: string, isMac: boolean): string {
    const raw = (accel || '').trim()
    if (!raw) return ''
    return raw
        .split('+')
        .map((t) => {
            const m = t.trim().toLowerCase()
            if (m === 'commandorcontrol' || m === 'cmdorctrl') return isMac ? 'Cmd' : 'Ctrl'
            if (m === 'command' || m === 'cmd' || m === 'meta' || m === 'super') return isMac ? 'Cmd' : 'Super'
            if (m === 'control' || m === 'ctrl') return 'Ctrl'
            if (m === 'alt' || m === 'option') return isMac ? 'Option' : 'Alt'
            if (m === 'shift') return 'Shift'
            return t.trim().toUpperCase()
        })
        .join(' + ')
}
