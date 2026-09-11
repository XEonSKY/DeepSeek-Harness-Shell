import semver from 'semver'
import { isPrerelease, stripV } from '@shared/version'

/**
 * 版本比较工具：改用流行 npm 库 `semver` 实现，替代手写 semver 解析/比较。
 * 对外保持原有函数名与语义（kernel/updater 依赖），减少自维护逻辑。
 */

// 「是否预发布」与「去前导 v」的判定统一放在 shared/version.ts（renderer 也用同一份）。
export { isPrerelease, stripV }

/** -1/0/1：完整 semver 比较（含预发布次序）。无效版本按原语义返回 0。 */
export function compareVersions(a: string, b: string): number {
    if (!semver.valid(a) || !semver.valid(b)) return 0
    return semver.compare(a, b)
}

/** 列表中的最大版本（无效项忽略；为空返回 null）。 */
export function pickLatest(list: string[]): string | null {
    const sorted = [...list].filter((v): v is string => semver.valid(v) !== null).sort(semver.rcompare)
    return sorted.length > 0 ? sorted[0] : null
}

/**
 * 按是否包含预发布过滤；若过滤后为空（例如远端只发布了预发布版），退回全量，
 * 避免版本列表空空如也 —— 有预发布版可选，总好过一个空下拉框。
 */
export function filterByPrerelease(versions: string[], prerelease: boolean): string[] {
    if (prerelease) return versions
    const stable = versions.filter((v) => !isPrerelease(v))
    return stable.length > 0 ? stable : versions
}

/** 降序排列；剔除预发布，除非要求包含、或稳定版为空而回退到全量。 */
export function sortVersionsDesc(versions: string[], prerelease: boolean): string[] {
    return filterByPrerelease(versions, prerelease)
        .filter((v): v is string => semver.valid(v) !== null)
        .sort(semver.rcompare)
}
