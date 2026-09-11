/**
 * 下载进度显示用的格式化：字节大小与下载速度。
 */

/** 字节数 → 人类可读大小（B / KB / MB / GB / TB，B 不带小数）。 */
export function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
    return (n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

/** 下载速度：bytes/s → 人类可读 + /s；尚未测出时显示占位符。 */
export function formatSpeed(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return '—'
    return formatBytes(n) + '/s'
}

/** 进度文案：已下载 / 总大小 · 速度（总大小未知时只显示速度）。 */
export function formatDownload(total: number, downloaded: number, speed: number): string {
    if (!Number.isFinite(total) || total <= 0) return formatSpeed(speed)
    return formatBytes(downloaded) + ' / ' + formatBytes(total) + ' · ' + formatSpeed(speed)
}
