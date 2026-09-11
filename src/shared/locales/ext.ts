import zhBase from './zh'
import enBase from './en'
import anime from './zh/anime'
import wenyan from './zh/wenyan'
import hant from './zh/hant'
import pirate from './en/pirate'
import shakespeare from './en/shakespeare'

/**
 * 扩展翻译：统一为「文本覆盖」。
 * 每个变体（anime/wenyan/hant ← zh；pirate/shakespeare ← en）都是一个与
 * 对应语言同构、只写差异键的文案目录文本，运行时深合并到基础文案之上。
 * 覆盖需要覆盖的地方，其余自动沿用基础文案；不改 dsh 设置。
 */

export type ExtStyle = 'off' | 'anime' | 'wenyan' | 'hant' | 'pirate' | 'shakespeare'
export type ExtLocale = 'zh' | 'en'

const BASE: Record<ExtLocale, Record<string, unknown>> = {
    zh: zhBase as Record<string, unknown>,
    en: enBase as Record<string, unknown>
}

/** 变体 -> 差异目录 */
const OVERLAY: Record<Exclude<ExtStyle, 'off'>, Record<string, unknown>> = {
    anime,
    wenyan,
    hant,
    pirate,
    shakespeare
}

type AnyDict = Record<string, unknown>

function deepMerge(base: AnyDict, patch: AnyDict): AnyDict {
    const out: AnyDict = { ...base }
    for (const k of Object.keys(patch)) {
        const pv = patch[k]
        const bv = out[k]
        if (pv && typeof pv === 'object' && !Array.isArray(pv)) {
            out[k] = deepMerge((bv && typeof bv === 'object' && !Array.isArray(bv) ? bv : {}) as AnyDict, pv as AnyDict)
        } else {
            out[k] = pv
        }
    }
    return out
}

/** 某变体属于哪种语言。 */
export function styleLocaleOf(style: ExtStyle): ExtLocale {
    return style === 'pirate' || style === 'shakespeare' ? 'en' : 'zh'
}

/** 取某语言文案目录：off→基础；其它→基础 + 变体文本覆盖。 */
export function catalogForLocale(locale: ExtLocale, style: ExtStyle): Record<string, unknown> {
    if (style === 'off') return BASE[locale]
    const target = styleLocaleOf(style)
    return deepMerge(BASE[target], OVERLAY[style])
}
