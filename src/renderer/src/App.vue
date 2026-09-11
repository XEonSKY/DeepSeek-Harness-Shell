<script setup lang="ts">
import { h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElCheckbox, ElMessageBox } from 'element-plus'
import KernelWizard from './components/KernelWizard.vue'
import TitleBar from './components/TitleBar.vue'
import { checkAndNotify } from './lib/update'
import { applyTheme, applyColorScheme } from './lib/theme'
import { applyFunToZh } from './lib/locales'
import { useView, useGoView, useToggleTerminal } from './shell/viewnav'
import { webTabs, activeTab, activateTab, openTarget, setCoreRole, tabLabel } from './shell/tabs'
import WebHost from './views/WebHost.vue'
import { shellMeta } from './shell/shellmeta'

const { t } = useI18n({ useScope: 'global' })

const view = useView()
const go = useGoView()

/**
 * 副窗口把“当前标签页标题”同步给主进程，用于把本窗口命名为“<标题> - 软件名”（例如任务栏/窗口
 * 切换器/“移动到其它窗口”的选择器里可见）。核心窗口保持软件名不推送。
 */
function pushShellTitle(): void {
    if (shellMeta.isCore) return
    const a = activeTab()
    window.api.setShellTitle(a ? tabLabel(a) : '')
}
watch(
    [() => webTabs.activeId, () => activeTab()?.title, () => activeTab()?.kind],
    () => pushShellTitle(),
    { flush: 'post' }
)

// Ctrl+T 在 DeepSeek UI 与「设置 → 终端」之间切换（已在终端页则回 UI）。
const onToggle = useToggleTerminal()

// ---- Element Plus close prompt (requested by the main process) -------------
const remember = ref(false)
let askingClose = false
async function askClosePrompt(): Promise<void> {
    if (askingClose) return
    askingClose = true
    remember.value = false

    const message = h('div', { class: 'close-ask' }, [
        h('p', { class: 'close-ask__text' }, t('closeAsk.text')),
        h(
            ElCheckbox,
            { onChange: (v: string | number | boolean) => (remember.value = !!v) },
            { default: () => t('closeAsk.remember') }
        )
    ])

    try {
        await ElMessageBox({
            title: t('closeAsk.title'),
            message,
            confirmButtonText: t('closeAsk.toTray'),
            cancelButtonText: t('closeAsk.quit'),
            showCancelButton: true,
            distinguishCancelAndClose: true,
            type: 'info',
            customClass: 'close-ask-box'
        })
        // confirm => hide to tray
        window.api.resolveClose({ action: 'hide', remember: remember.value })
    } catch (err) {
    // Element Plus MessageBox 拒绝值就是字符串 'cancel'/'close'（非 { action } 对象）：
    // "直接退出" (cancel) => quit；Esc / X (close) => do nothing。
        if (err === 'cancel') {
            window.api.resolveClose({ action: 'quit', remember: remember.value })
        }
    } finally {
        askingClose = false
    }
}

let offToggle: (() => void) | null = null
let offAskClose: (() => void) | null = null
let offMissing: (() => void) | null = null
let offCore: (() => void) | null = null

// 内核未安装时由主进程通知 → 显示安装向导（向导组件自管全部安装状态与步骤）。
const showMissing = ref(false)

onMounted(() => {
    // 仅核心窗口保留三固定站；非核心窗口不显示内核UI/网页/用量固定标签
    setCoreRole(shellMeta.isCore)
    pushShellTitle() // 副窗口初始命名（如空则回落到软件名）
    // 副窗口若带“开页意图”（创建时主进程给了 URL），挂载后开一个动态标签页承载之。
    if (!shellMeta.isCore) {
        void window.api
            .takeOpenIntent()
            .then((u) => {
                if (u) {
                    openTarget(u)
                    go('web')
                    pushShellTitle()
                }
            })
            .catch(() => {})
    }
    // 角色可能变化（如本窗口接管成为新核心）→ 更新固定标签并回到内核UI
    offCore = window.api.onShellRole((isCore) => {
        shellMeta.isCore = isCore
        setCoreRole(isCore)
        if (isCore) activateTab('home')
    })
    offToggle = window.api.onToggleView(onToggle)
    offAskClose = window.api.onAskClose(() => void askClosePrompt())
    offMissing = window.api.onKernelMissing(() => {
        showMissing.value = true
    })
    void (async () => {
        const s = await window.api.getSettings()
        applyTheme(s.theme)
        applyColorScheme(s.colorScheme)
        void window.api.setWindowZoom(s.zoomPercent ?? 100)
        applyFunToZh(s.funLocale ?? 'off')
        const ok = await window.api.getKernelInstalled()
        if (!ok) {
            showMissing.value = true // main does not start dsh when the kernel is absent
            return
        }
        if (s.autoCheckUpdate) void checkAndNotify({ prerelease: s.checkPrerelease })
    })()
})
onBeforeUnmount(() => {
    offToggle?.()
    offAskClose?.()
    offMissing?.()
    offCore?.()
})
</script>

<template>
    <div class="shell">
        <!-- 自绘标题栏（含标签条、跨窗拖拽遮罩/幽灵、标签右键菜单；状态自管） -->
        <TitleBar />

        <main class="body">
            <!-- 常驻 web 宿主：进入日志/设置也不卸载，标签页 webview 保持保活 -->
            <div class="web-base"><WebHost /></div>
            <!-- 覆盖层：日志 / 设置（盖在 web 宿主上） -->
            <div v-if="view !== 'web'" class="web-overlay"><router-view /></div>
        </main>

        <!-- 内核未安装：全屏四步安装向导（状态自管；装完 emit done 由本窗口收起） -->
        <KernelWizard v-if="showMissing" @done="showMissing = false" />
    </div>
</template>

<style scoped>
.shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}
/* 常驻 web 宿主（底层，永不卸载以保活 webview） */
.web-base {
  position: absolute;
  inset: 0;
}
/* 日志/设置覆盖层：不透明盖在 web 宿主上 */
.web-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: var(--el-bg-color-page);
  overflow: hidden;
}
</style>
