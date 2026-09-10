/**
 * 跨端（main + renderer）共用的版本号工具。
 *
 * 这里刻意**不依赖 `semver` 包**：renderer 侧只做轻量判断，引入 semver 会白白增大渲染层产物。
 * 主进程的 `main/semver.ts` 复用本函数，从而保证「是否预发布」在两端判断一致
 * （此前 main 用 semver.prerelease、renderer 用正则，遇到带前导 v 的版本号会得出不同结论）。
 */

/** 去掉前导 v/V（GitHub Release tag 常见）。 */
export function stripV(v: string): string {
  return v.replace(/^[vV]/, '')
}

/** 是否预发布版本（含 rc / beta / alpha / 数字预发布段）。 */
export function isPrerelease(v: string): boolean {
  return /^\d+\.\d+\.\d+-/.test(stripV(v))
}
