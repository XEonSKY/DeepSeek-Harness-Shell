/**
 * 可取消操作令牌：Node / npm / dsh 的安装（下载 + 解压 + 落盘）共用一个「当前操作」，
 * 渲染层「取消」按钮经 IPC 调 `cancelActive()` 中止。同一时刻只允许一个安装在进行。
 */

let active: { token: object; ctrl: AbortController } | null = null

export interface CancelToken {
    signal: AbortSignal
    /** 操作结束时调用；只清理属于自己的令牌，避免误清后来的操作。 */
    done(): void
}

/** 开始一个可取消操作并返回令牌。 */
export function beginCancelable(): CancelToken {
    const ctrl = new AbortController()
    const token: CancelToken = {
        signal: ctrl.signal,
        done(): void {
            if (active && active.token === token) active = null
        }
    }
    active = { token, ctrl }
    return token
}

/** 中止当前操作；没有进行中的操作时返回 false。 */
export function cancelActive(): boolean {
    if (!active) return false
    active.ctrl.abort()
    return true
}

/** 已取消时的统一文案。 */
export const CANCELED_MESSAGE = '操作已取消'
