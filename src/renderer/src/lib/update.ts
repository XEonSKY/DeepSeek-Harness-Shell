import { h, reactive } from 'vue'
import { ElTag, ElNotification } from 'element-plus'
import type { VNode } from 'vue'
import type { UpdateResult } from '@shared/types'
import { isPrerelease } from '@shared/version'
import { tt } from './locales'

const TYPE: Record<UpdateResult['status'], 'success' | 'warning' | 'error'> = {
    ok: 'success',
    update: 'warning',
    missing: 'error',
    error: 'warning'
}

export interface KernelCheckState {
    /** A newer version than the installed one has been found. */
    found: boolean
    latest: string | null
    /** Whether the found latest is a pre-release (rc / beta / …). */
    prerelease: boolean
    /** 最近一次检查返回的当前版本（「已是最新」的界面回显用）。 */
    current: string | null
    /** 是否已经检查过至少一次 —— 决定要不要显示「已是最新」那一行。 */
    checked: boolean
}

/** Latest kernel check result, so the 内核 page header can show it reactively. */
export const kernelCheck = reactive<KernelCheckState>({
    found: false,
    latest: null,
    prerelease: false,
    current: null,
    checked: false
})

/** Build the notification body: current & latest versions shown as el-tag. */
function buildBody(r: UpdateResult): string | VNode {
    const kids: Array<string | VNode> = []

    if (r.current) {
        kids.push(
            h('div', { class: 'update-row' }, [
                h('span', { class: 'update-lbl' }, tt('update.current')),
                h(ElTag, { size: 'small', type: 'info', effect: 'plain' }, () => r.current!)
            ])
        )
    }

    if (r.latest) {
        const isPre = isPrerelease(r.latest)
        const tagType = r.status === 'update' ? (isPre ? 'warning' : 'success') : 'success'
        kids.push(
            h('div', { class: 'update-row' }, [
                h('span', { class: 'update-lbl' }, tt('update.latest')),
                h(ElTag, { size: 'small', effect: 'plain', type: tagType }, () => r.latest!)
            ])
        )
    }

    if (r.command) {
        kids.push(h('div', { class: 'update-cmd' }, r.command))
    }
    kids.push(h('div', { class: 'update-note' }, r.message))

    return h('div', { class: 'update-body' }, kids)
}

/** Ask the main process to check and show the result as a top-right toast. */
export async function checkAndNotify(opts?: {
    prerelease?: boolean
    registry?: 'npmjs' | 'npmmirror'
}): Promise<void> {
    try {
        const r: UpdateResult = await window.api.checkForUpdates(opts)
        // Publish to the shared store so the 内核 header can render the new-version tag.
        kernelCheck.found = r.status === 'update' && !!r.latest
        kernelCheck.latest = r.latest
        kernelCheck.prerelease = r.latest ? isPrerelease(r.latest) : false
        kernelCheck.current = r.current ?? null
        kernelCheck.checked = true

        // 「已是最新」不弹提示（只有真发现新版本才值得打断用户）：结果改在「内核」页里回显一行。
        if (r.status === 'ok') return

        const titles: Record<UpdateResult['status'], string> = {
            ok: tt('update.okTitle'),
            update: tt('update.updateTitle'),
            missing: tt('update.missingTitle', { pkg: '@deepseek-ai/dsh' }),
            error: tt('update.errorTitle')
        }

        ElNotification({
            title: titles[r.status],
            message: buildBody(r),
            type: TYPE[r.status],
            position: 'top-right',
            // Drop below the custom (frameless) title bar so it never covers it.
            offset: 60,
            duration: 7000
        })
    } catch (err) {
        ElNotification({
            title: tt('update.checkFailedTitle'),
            message: err instanceof Error ? err.message : String(err),
            type: 'error',
            position: 'top-right',
            offset: 60,
            duration: 5000
        })
    }
}
