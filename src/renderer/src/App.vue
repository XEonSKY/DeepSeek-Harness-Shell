<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Monitor, Document, Setting, Minus, FullScreen, Close, Refresh, Cpu, Wallet, ChatDotRound } from '@element-plus/icons-vue'
import { ElCheckbox, ElMessageBox } from 'element-plus'
import appIcon from './assets/icon.png'
import { checkAndNotify } from './update'
import { applyTheme } from './theme'
import { appState } from './state'

const { t } = useI18n({ useScope: 'global' })

type ViewKey = 'web' | 'chat' | 'platform' | 'log' | 'settings'

const route = useRoute()
const router = useRouter()
/** 当前高亮的视图（/settings* 统一归入设置）。 */
const view = computed<ViewKey>(() => {
  if (route.path.startsWith('/settings')) return 'settings'
  if (route.path.startsWith('/chat')) return 'chat'
  if (route.path.startsWith('/platform')) return 'platform'
  if (route.path.startsWith('/log')) return 'log'
  return 'web'
})

/** 跳转到某视图对应的路由。 */
function go(k: ViewKey): void {
  const path =
    k === 'web' ? '/' : k === 'chat' ? '/chat' : k === 'platform' ? '/platform' : k === 'log' ? '/log' : '/settings'
  if (route.path !== path) void router.push(path)
}

/**
 * DeepSeek UI 导航点击：CTRL（或 Cmd）点击在系统浏览器打开当前 dsh 地址；
 * 否则普通切回内置 UI 页。
 */
async function uiClick(e: MouseEvent): Promise<void> {
  if ((e.ctrlKey || e.metaKey) && appState.url) {
    await window.api.openExternal(appState.url)
    return
  }
  go('web')
}

const winMinimize = (): void => window.api.windowMinimize()
const winMaximize = (): void => window.api.windowToggleMaximize()
const winClose = (): void => window.api.windowClose()
const winReload = (): void => window.api.reloadDsh()

// Ctrl+T 在 DeepSeek UI 与终端之间切换（其它视图回到 UI）。
function onToggle(): void {
  if (view.value === 'web') void router.push('/log')
  else void router.push('/')
}

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
    // "直接退出" (cancel) => quit; Esc / X (close) => do nothing
    if ((err as { action?: string }).action === 'cancel') {
      window.api.resolveClose({ action: 'quit', remember: remember.value })
    }
  } finally {
    askingClose = false
  }
}

let offToggle: (() => void) | null = null
let offAskClose: (() => void) | null = null
let offMissing: (() => void) | null = null

// ---- Kernel-not-installed overlay ------------------------------------------
type Reg = 'npmjs' | 'npmmirror'
const showMissing = ref(false)
const installingKernel = ref(false)
const installError = ref('')
const installReg = ref<Reg>('npmjs')

// Optional kernel-version selection on first install: pick a specific published
// version and whether to include pre-releases (the list is re-fetched accordingly).
const installPrerelease = ref(false)
const installVersions = ref<string[]>([])
const versionsLoading = ref(false)
const installVersion = ref('')

async function loadInstallVersions(): Promise<void> {
  if (versionsLoading.value) return
  versionsLoading.value = true
  try {
    const list = await window.api.listVersions({
      prerelease: installPrerelease.value,
      registry: installReg.value
    })
    installVersions.value = list
    // Default to the newest version within the current selection scope.
    if (!list.includes(installVersion.value)) installVersion.value = list[0] ?? ''
  } catch {
    installVersions.value = []
  } finally {
    versionsLoading.value = false
  }
}

// Rebuild the version list when the install mask shows, or when the pre-release
// toggle / registry changes while it is open.
watch([showMissing, installPrerelease, installReg], () => {
  if (showMissing.value) void loadInstallVersions()
})

async function doInstallKernel(): Promise<void> {
  if (installingKernel.value) return
  installingKernel.value = true
  installError.value = ''
  try {
    const r = await window.api.installKernel({
      version: installVersion.value || null,
      registry: installReg.value
    })
    if (!r.ok) {
      installError.value = r.message
      return
    }
    showMissing.value = false // main starts dsh after a fresh install
  } catch (err) {
    installError.value = err instanceof Error ? err.message : String(err)
  } finally {
    installingKernel.value = false
  }
}

const quitShell = (): void => window.api.quit()

onMounted(() => {
  offToggle = window.api.onToggleView(onToggle)
  offAskClose = window.api.onAskClose(() => void askClosePrompt())
  offMissing = window.api.onKernelMissing(() => {
    showMissing.value = true
  })
  void (async () => {
    const s = await window.api.getSettings()
    applyTheme(s.theme)
    installReg.value = s.npmRegistry
    installPrerelease.value = s.checkPrerelease === true
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
})
</script>

<template>
  <div class="shell">
    <!-- Custom (frameless) title bar: the whole bar is a drag region. -->
    <header class="titlebar">
      <div class="left">
        <img :src="appIcon" class="icon" alt="" draggable="false" />
        <span class="title">{{ $t('app.title') }}</span>

        <!-- 界面 / 网页版 Chat / 充值平台 / 终端 live on the left as icon buttons -->
        <nav class="nav">
          <el-tooltip :content="$t('app.nav.ui')" placement="bottom" :show-after="300">
            <button
              class="icon-btn"
              :class="{ active: view === 'web' }"
              type="button"
              @click="uiClick"
            >
              <el-icon><Monitor /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip :content="$t('app.nav.chat')" placement="bottom" :show-after="300">
            <button
              class="icon-btn"
              :class="{ active: view === 'chat' }"
              type="button"
              @click="go('chat')"
            >
              <el-icon><ChatDotRound /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip :content="$t('app.nav.platform')" placement="bottom" :show-after="300">
            <button
              class="icon-btn"
              :class="{ active: view === 'platform' }"
              type="button"
              @click="go('platform')"
            >
              <el-icon><Wallet /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip :content="$t('app.nav.terminal')" placement="bottom" :show-after="300">
            <button
              class="icon-btn"
              :class="{ active: view === 'log' }"
              type="button"
              @click="go('log')"
            >
              <el-icon><Document /></el-icon>
            </button>
          </el-tooltip>
        </nav>
      </div>

      <div class="right">
        <!-- Refresh: on the DeepSeek UI (web), web Chat and DeepSeek platform pages -->
        <el-tooltip v-if="view === 'web' || view === 'chat' || view === 'platform'" :content="$t('app.reload')" placement="bottom" :show-after="300">
          <button class="icon-btn" type="button" @click="winReload">
            <el-icon><Refresh /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="$t('app.nav.settings')" placement="bottom" :show-after="300">
          <button
            class="icon-btn"
            :class="{ active: view === 'settings' }"
            type="button"
            @click="go('settings')"
          >
            <el-icon><Setting /></el-icon>
          </button>
        </el-tooltip>
        <span class="divider" />
        <el-tooltip :content="$t('app.minimize')" placement="bottom" :show-after="300">
          <button class="icon-btn" type="button" @click="winMinimize">
            <el-icon><Minus /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="$t('app.maximize')" placement="bottom" :show-after="300">
          <button class="icon-btn" type="button" @click="winMaximize">
            <el-icon><FullScreen /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="$t('app.closeHint')" placement="bottom" :show-after="300">
          <button class="icon-btn danger" type="button" @click="winClose">
            <el-icon><Close /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </header>

    <main class="body">
      <div class="pane"><router-view /></div>
    </main>

    <!-- Kernel-not-installed full-screen mask -->
    <div v-if="showMissing" class="missing-mask">
      <div class="missing-card">
        <div class="missing-icon"><el-icon :size="44"><Cpu /></el-icon></div>
        <h2 class="missing-title">{{ $t('kernelMissing.title') }}</h2>
        <p class="missing-desc">
          {{ $t('kernelMissing.desc', { pkg: '@deepseek-ai/dsh' }) }}
        </p>
        <el-select v-model="installReg" class="missing-reg">
          <el-option :label="$t('kernelMissing.registryNpmjs')" value="npmjs" />
          <el-option :label="$t('kernelMissing.registryNpmmirror')" value="npmmirror" />
        </el-select>
        <div class="missing-opt">
          <span class="missing-opt__txt">{{ $t('kernelMissing.preLabel') }}</span>
          <el-switch v-model="installPrerelease" />
        </div>
        <div class="missing-vrow">
          <el-select
            v-model="installVersion"
            filterable
            :loading="versionsLoading"
            class="missing-reg"
            :placeholder="$t('kernelMissing.versionPlaceholder')"
          >
            <el-option v-for="v in installVersions" :key="v" :value="v" :label="v" />
          </el-select>
          <el-button :icon="Refresh" circle :loading="versionsLoading" @click="loadInstallVersions" />
        </div>
        <p class="missing-vhint">{{ $t('kernelMissing.versionHint') }}</p>
        <p v-if="installError" class="missing-err">{{ installError }}</p>
        <div class="missing-actions">
          <el-button :loading="installingKernel" type="primary" :icon="Refresh" @click="doInstallKernel">
            {{ $t('kernelMissing.install') }}
          </el-button>
          <el-button @click="quitShell">{{ $t('kernelMissing.quit') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.titlebar {
  -webkit-app-region: drag;
  flex: 0 0 auto;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  user-select: none;
}
.left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  object-fit: cover;
  -webkit-user-drag: none;
  flex: 0 0 auto;
}
.title {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
}
.nav {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}
.right {
  -webkit-app-region: no-drag;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.divider {
  width: 1px;
  height: 22px;
  background: var(--el-border-color-lighter);
  margin: 0 6px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 22px;
  border: none;
  border-radius: var(--el-border-radius-base);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}
.icon-btn.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.icon-btn.danger:hover {
  background: var(--el-color-danger);
  color: #fff;
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}
.pane {
  position: absolute;
  inset: 0;
}
.missing-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
}
.missing-card {
  width: 400px;
  max-width: calc(100% - 48px);
  text-align: center;
}
.missing-icon {
  width: 84px;
  height: 84px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.missing-title {
  margin: 0 0 10px;
  font-size: 18px;
}
.missing-desc {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
.missing-desc code {
  font-family: var(--el-font-family-mono);
  background: var(--el-fill-color-light);
  padding: 0 4px;
  border-radius: 4px;
}
.missing-reg {
  width: 100%;
  margin-bottom: 8px;
}
.missing-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.missing-vrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.missing-vrow .missing-reg {
  flex: 1 1 auto;
  margin-bottom: 0;
}
.missing-vhint {
  margin: 6px 0 0;
  text-align: left;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
.missing-err {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-danger);
  word-break: break-all;
}
.missing-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
