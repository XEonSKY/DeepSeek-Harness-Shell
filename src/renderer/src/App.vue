<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Monitor, ChatDotRound, Wallet, Document, Setting, Minus, FullScreen, Close, Refresh, Plus, Star, StarFilled, Download } from '@element-plus/icons-vue'
import { CodeFilled } from '@antdv-next/icons'
import { ElCheckbox, ElMessage, ElMessageBox } from 'element-plus'
import appIcon from './assets/icon.png'
import { checkAndNotify } from './update'
import { applyTheme } from './theme'
import { applyFunToZh } from './locales'
import { webTabs, activeTab, findTab, activateTab, closeTab, openTab, openNewTab, toggleKeep, setCoreRole, FIXED_LABEL_KEY } from './tabs'
import type { WebTab } from './tabs'
import WebHost from './views/WebHost.vue'
import { shellMeta } from './shellmeta'
import type { EnvProbe, NodeRuntimeKind, NpmSource } from '@shared/types'

const { t } = useI18n({ useScope: 'global' })

type ViewKey = 'web' | 'log' | 'settings'

const route = useRoute()
const router = useRouter()
/** 当前高亮的视图（/settings* 统一归入设置）。web 内容由标签页承载。 */
const view = computed<ViewKey>(() => {
  if (route.path.startsWith('/settings')) return 'settings'
  if (route.path.startsWith('/log')) return 'log'
  return 'web'
})

/** 若当前不在 web 宿主页，切到 '/' 以便显示标签页 webview。 */
function ensureWebRoute(): void {
  if (view.value !== 'web') void router.push('/')
}

/** 跳转到某非 web 视图对应的路由。 */
function go(k: 'web' | 'log' | 'settings'): void {
  const path = k === 'web' ? '/' : k === 'log' ? '/log' : '/settings'
  if (route.path !== path) void router.push(path)
}

/** 点击一个标签页：激活并确保显示在 web 宿主。 */
function onTabClick(id: string): void {
  activateTab(id)
  ensureWebRoute()
}

/** 点击标签页关闭按钮。 */
function onTabClose(id: string): void {
  closeTab(id)
}

/** 点击“保活固定”按钮（仅动态标签页）。 */
function onTabKeep(id: string): void {
  toggleKeep(id)
}

/** 中键(mouse button 1)关闭标签页。 */
function onTabMouseDown(id: string, e: MouseEvent): void {
  if (e.button === 1) {
    e.preventDefault()
    closeTab(id)
  }
}

/** 右键菜单状态：位置 + 目标标签。 */
const ctx = ref<{ x: number; y: number; id: string } | null>(null)
function onTabContext(id: string, e: MouseEvent): void {
  ctx.value = { x: e.clientX, y: e.clientY, id }
}
function closeCtx(): void {
  ctx.value = null
}
/** 复制标签页。 */
function ctxDup(): void {
  const t = ctx.value ? findTab(ctx.value.id) : undefined
  closeCtx()
  if (!t) return
  if (t.kind === 'newtab') openNewTab()
  else openTab(t.url ?? '', t.title)
}
/** 关闭标签页。 */
function ctxClose(): void {
  const id = ctx.value?.id
  closeCtx()
  if (id) closeTab(id)
}

/** 在新窗口打开：当前标签对应 URL 开到一个独立窗口（标签保留）。 */
async function ctxOpenWindow(): Promise<void> {
  const t = ctx.value ? findTab(ctx.value.id) : undefined
  closeCtx()
  if (t && t.url) await window.api.openWebWindow(t.url)
}

/** 移动到其它窗口：先在新窗口打开该 URL，再从本窗口移除该标签。 */
async function ctxMove(): Promise<void> {
  const id = ctx.value?.id
  const t = ctx.value ? findTab(ctx.value.id) : undefined
  closeCtx()
  if (!t || !t.url) return
  await window.api.openWebWindow(t.url)
  closeTab(id)
}

/** 跳转到核心窗口（非核心窗口用；现阶段占位，后续经 IPC 聚焦核心窗口）。 */
function jumpToCore(): void {
  // TODO(多窗口): window.api.focusCoreWindow?.()
}

/** 滚轮滚动标签条时改为横向滚动。 */
function onTabsWheel(e: WheelEvent): void {
  const el = e.currentTarget as HTMLElement | null
  if (!el || el.scrollWidth <= el.clientWidth) return
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (delta === 0) return
  el.scrollLeft += delta
}

/** 标签页文案：固定来源用友好名（i18n），动态/新标签页用真实标题或默认名。 */
function labelOf(tab: WebTab): string {
  if (tab.kind === 'home' || tab.kind === 'chat' || tab.kind === 'platform') {
    return t(FIXED_LABEL_KEY[tab.kind])
  }
  return tab.title || t('app.tabs.new')
}

/** ＋ 新建：按设置开内置导航页或自定义 URL。 */
async function onPlus(): Promise<void> {
  try {
    const s = await window.api.getSettings()
    if (s.newTabMode === 'url' && s.newTabUrl) openTab(s.newTabUrl)
    else openNewTab()
  } catch {
    openNewTab()
  }
  ensureWebRoute()
}

/** 动态/新标签页（由新开链接/＋ 产生）；固定三站以图标按钮呈现，不在此列。 */
const dynamicTabs = computed(() => webTabs.list.filter((t) => t.kind === 'dynamic' || t.kind === 'newtab'))

/** 某个 web 标签是否当前激活（仅 web 宿主视图内高亮）。 */
function isWebActive(id: string): boolean {
  return view.value === 'web' && webTabs.activeId === id
}

/** 当前激活的是否动态标签页（动态标签页才显示 WebHost 里的网址导航栏）。 */
const navVisible = computed(() => view.value === 'web' && activeTab()?.kind === 'dynamic')
/** 激活的是否三个固定站之一（固定站才显示标题栏旧版刷新按钮）。 */
const fixedPageReload = computed(() => {
  if (view.value !== 'web') return false
  const k = activeTab()?.kind
  return k === 'home' || k === 'chat' || k === 'platform'
})

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
let offLog: (() => void) | null = null
let offDeploy: (() => void) | null = null
let offCore: (() => void) | null = null

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

// 内核来源(local/global)与 npm(auto/bundled)：本页选择后、安装前会持久化到设置。
const installSource = ref<'local' | 'global'>('local')
const installNpm = ref<NpmSource>('system')
// 安装过程的实时日志（本页展示，安装结束时保留以便回看）。
const installLog = ref<string[]>([])
// 是否打开全屏安装日志。
const logFullscreen = ref(false)

// ---- 首次安装四步引导 -----------------------------------------------
// 0 镜像源 · 1 Node 环境 · 2 NPM 环境 · 3 DSH 环境
const step = ref(0)
const envProbe = ref<EnvProbe | null>(null)
const probingEnv = ref(false)

/** 系统 Node 是否可用（存在且主版本 ≥ 20）。 */
const systemNodeOk = computed(() => {
  const v = envProbe.value?.node.version
  if (!envProbe.value?.node.present || !v) return false
  const m = /^v?(\d+)/.exec(v.trim())
  return !!m && parseInt(m[1], 10) >= 20
})

// 所选 Node 运行时（安装时随设置持久化）。
const nodeRuntimeChoice = ref<NodeRuntimeKind>('electron')
const deployingNode = ref(false)
const deployPercent = ref(0)

const runtimeHint = computed(() => {
  const c = nodeRuntimeChoice.value
  if (c === 'system') return t('kernelMissing.node.hintSystem')
  if (c === 'local') return t('kernelMissing.node.hintLocal')
  return t('kernelMissing.node.hintElectron')
})

async function deployOnce(): Promise<boolean> {
  if (deployingNode.value) return false
  deployingNode.value = true
  deployPercent.value = 0
  try {
    const r = await window.api.deployLocalNode()
    if (r.ok) {
      deployPercent.value = 100
      ElMessage.success(r.message)
      return true
    }
    ElMessage.error(r.message)
    return false
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
    return false
  } finally {
    deployingNode.value = false
    await probeEnv()
  }
}
const deployNode = (): Promise<void> => deployOnce().then(() => undefined)

async function probeEnv(): Promise<void> {
  probingEnv.value = true
  try {
    envProbe.value = await window.api.probeEnv()
    // 所选 npm 在不可用时回退到内置 npm。
    if (envProbe.value) {
      if (installNpm.value === 'system' && !envProbe.value.npm) installNpm.value = 'bundled'
      else if (installNpm.value === 'localnode' && !envProbe.value.local.present) installNpm.value = 'bundled'
    }
    // 选了系统 Node 但实际不可用（<20 / 缺失）时回退到 Electron。
    if (envProbe.value && nodeRuntimeChoice.value === 'system' && !systemNodeOk.value) {
      nodeRuntimeChoice.value = 'electron'
    }
  } finally {
    probingEnv.value = false
  }
}

// 配置目录选择（第 0 步）：当前有效路径 + 默认路径。
const cfgDir = ref('')
const cfgDefaultDir = ref('')
async function loadConfigDir(): Promise<void> {
  try {
    const info = await window.api.getConfigDir()
    cfgDir.value = info.current
    cfgDefaultDir.value = info.default
  } catch {
    /* ignore */
  }
}
async function pickConfigDir(): Promise<void> {
  const p = await window.api.openDirectory()
  if (!p) return
  cfgDir.value = await window.api.setConfigDir(p)
}
async function resetConfigDir(): Promise<void> {
  cfgDir.value = await window.api.setConfigDir(null)
}
const back = (): void => {
  if (step.value > 0) step.value = step.value - 1
}

/** 把向导当前选择持久化到设置。 */
async function persistWizard(): Promise<boolean> {
  try {
    const cur = await window.api.getSettings()
    await window.api.saveSettings({
      ...cur,
      npmRegistry: installReg.value,
      kernelSource: installSource.value,
      nodeRuntime: nodeRuntimeChoice.value,
      npmSource: installSource.value === 'local' ? installNpm.value : cur.npmSource
    })
    return true
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
    return false
  }
}

/** 第 3 步：真正安装内核。 */
async function performInstall(): Promise<boolean> {
  installLog.value = []
  try {
    if (!(await persistWizard())) return false
    const r = await window.api.installKernel({
      version: installVersion.value || null,
      registry: installReg.value
    })
    if (!r.ok) {
      installError.value = r.message
      return false
    }
    return true
  } catch (err) {
    installError.value = err instanceof Error ? err.message : String(err)
    return false
  }
}

/** 执行当前步（持久化 + 该步动作），成功后自动进入下一步 / 完成。 */
async function runCurrentStep(): Promise<void> {
  if (installingKernel.value) return
  installingKernel.value = true
  installError.value = ''
  let ok = true
  try {
    if (step.value === 0) {
      ok = await persistWizard()
    } else if (step.value === 1) {
      ok = await persistWizard()
      // 选了本地 Node 但尚未部署 → 自动下载部署（带进度）。
      if (ok && nodeRuntimeChoice.value === 'local' && envProbe.value && !envProbe.value.local.present) {
        ok = await deployOnce()
      }
    } else if (step.value === 2) {
      ok = await persistWizard()
    } else {
      ok = await performInstall()
    }
  } finally {
    installingKernel.value = false
  }
  if (!ok) return
  if (step.value >= 3) {
    showMissing.value = false // main starts dsh after a fresh install
  } else {
    step.value = step.value + 1
  }
}

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

const quitShell = (): void => window.api.quit()

onMounted(() => {
  // 仅核心窗口保留三固定站；非核心窗口不显示内核UI/网页/用量固定标签
  setCoreRole(shellMeta.isCore)
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
    step.value = 0
  })
  // 安装时把主进程的 stdout/stderr 追加到本页日志。
  offLog = window.api.onLog((entry) => {
    if (!installingKernel.value) return
    const line = (entry.k === 'e' ? '[err] ' : '') + entry.s
    installLog.value.push(line)
    if (installLog.value.length > 500) installLog.value.splice(0, installLog.value.length - 500)
  })
  offDeploy = window.api.onNodeDeployProgress((p) => {
    deployPercent.value = p.percent
  })
  void (async () => {
    const s = await window.api.getSettings()
    applyTheme(s.theme)
    void window.api.setWindowZoom(s.zoomPercent ?? 100)
    applyFunToZh(s.funLocale ?? 'off')
    installReg.value = s.npmRegistry
    installPrerelease.value = s.checkPrerelease === true
    installSource.value = s.kernelSource ?? 'local'
    installNpm.value = s.npmSource ?? 'system'
    nodeRuntimeChoice.value = s.nodeRuntime ?? 'electron'
    await loadConfigDir()
    await probeEnv()
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
  offLog?.()
  offDeploy?.()
  offCore?.()
})
</script>

<template>
  <div class="shell">
    <!-- Custom (frameless) title bar: the whole bar is a drag region. -->
    <header class="titlebar" :class="{ 'titlebar--flush': navVisible }">
      <div class="left">
        <img :src="appIcon" class="icon" alt="" draggable="false" />
        <span class="title">{{ $t('app.title') }}</span>

        <!-- 核心窗口：显示固定三站图标；非核心窗口：显示“跳转核心窗口”按钮 -->
        <div class="quick">
          <template v-if="shellMeta.isCore">
            <el-tooltip :content="$t('app.nav.ui')" placement="bottom" :show-after="300">
              <button class="icon-btn" :class="{ active: isWebActive('home') }" type="button" @click="onTabClick('home')">
                <el-icon><Monitor /></el-icon>
              </button>
            </el-tooltip>
            <el-tooltip :content="$t('app.nav.chat')" placement="bottom" :show-after="300">
              <button class="icon-btn" :class="{ active: isWebActive('chat') }" type="button" @click="onTabClick('chat')">
                <el-icon><ChatDotRound /></el-icon>
              </button>
            </el-tooltip>
            <el-tooltip :content="$t('app.nav.platform')" placement="bottom" :show-after="300">
              <button class="icon-btn" :class="{ active: isWebActive('platform') }" type="button" @click="onTabClick('platform')">
                <el-icon><Wallet /></el-icon>
              </button>
            </el-tooltip>
          </template>
          <template v-else>
            <el-tooltip :content="$t('app.jumpCoreHint')" placement="bottom" :show-after="300">
              <button class="icon-btn core-jump" type="button" @click="jumpToCore">
                <el-icon :size="20"><Monitor /></el-icon>
                <span class="core-jump__txt">{{ $t('app.jumpCore') }}</span>
              </button>
            </el-tooltip>
          </template>
          <span class="divider" />
        </div>

        <!-- 动态标签页条：可开很多，多标签时原生横向滚动；空白区可拖窗口 -->
        <div class="tabs" @wheel="onTabsWheel">
          <div
            v-for="tab in dynamicTabs"
            :key="tab.id"
            class="tab"
            :class="{ on: isWebActive(tab.id) }"
            :title="tab.url ?? ''"
            @click="onTabClick(tab.id)"
            @mousedown="onTabMouseDown(tab.id, $event)"
            @contextmenu.prevent="onTabContext(tab.id, $event)"
          >
            <span class="tab__label">{{ labelOf(tab) }}</span>
            <button
              v-if="tab.kind === 'dynamic'"
              class="tab__pin"
              :class="{ on: tab.keep }"
              type="button"
              :title="$t('app.tabs.keep')"
              @click.stop="onTabKeep(tab.id)"
            >
              <el-icon :size="11"><component :is="tab.keep ? StarFilled : Star" /></el-icon>
            </button>
            <button
              class="tab__x"
              type="button"
              :title="$t('app.tabs.close')"
              @click.stop="onTabClose(tab.id)"
            >
              <el-icon :size="12"><Close /></el-icon>
            </button>
          </div>

          <button class="tab tab--add" type="button" :title="$t('app.tabs.new')" @click="onPlus">
            <el-icon :size="16"><Plus /></el-icon>
          </button>
        </div>
      </div>

      <div class="right">
        <!-- 三个固定站(非动态标签页)：用旧版刷新按钮重载当前固定站 -->
        <el-tooltip v-if="fixedPageReload" :content="$t('app.reload')" placement="bottom" :show-after="300">
          <button class="icon-btn" type="button" @click="winReload">
            <el-icon><Refresh /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="$t('app.nav.terminal')" placement="bottom" :show-after="300">
          <button class="icon-btn" :class="{ active: view === 'log' }" type="button" @click="go('log')">
            <CodeFilled style="font-size: 18px" />
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
      <!-- 常驻 web 宿主：进入日志/设置也不卸载，标签页 webview 保持保活 -->
      <div class="web-base"><WebHost /></div>
      <!-- 覆盖层：日志 / 设置（盖在 web 宿主上） -->
      <div v-if="view !== 'web'" class="web-overlay"><router-view /></div>
    </main>

    <!-- 标签页右键菜单 -->
    <template v-if="ctx">
      <div class="ctx-bk" @mousedown="closeCtx" @contextmenu.prevent="closeCtx" />
      <div class="ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }">
        <button type="button" @click="ctxDup">{{ $t('app.tabs.dup') }}</button>
        <button type="button" @click="ctxClose">{{ $t('app.tabs.close') }}</button>
        <span class="ctx__sep" />
        <button type="button" @click="ctxOpenWindow">{{ $t('app.tabs.openWindow') }}</button>
        <button type="button" @click="ctxMove">{{ $t('app.tabs.moveWindow') }}</button>
      </div>
    </template>

    <!-- Kernel-not-installed full-screen mask (4-step wizard) -->
    <div v-if="showMissing" class="missing-mask">
      <div class="missing-card">
        <div class="missing-icon"><img :src="appIcon" alt="DeepSeek Harness Shell" draggable="false" class="missing-logo" /></div>
        <h2 class="missing-title">{{ $t('kernelMissing.title') }}</h2>
        <p class="missing-desc">{{ $t('kernelMissing.wizIntro', { pkg: '@deepseek-ai/dsh' }) }}</p>

        <el-steps :active="step" align-center finish-status="success" class="wiz-steps">
          <el-step :title="$t('kernelMissing.wiz.source')" />
          <el-step :title="$t('kernelMissing.wiz.node')" />
          <el-step :title="$t('kernelMissing.wiz.npm')" />
          <el-step :title="$t('kernelMissing.wiz.dsh')" />
        </el-steps>

        <div class="wiz-body">
          <!-- 第 0 步：镜像源 + 配置目录 -->
          <div v-if="step === 0" class="wiz-pane">
            <div class="wiz-field">
              <label class="wiz-label">{{ $t('kernelMissing.registry') }}</label>
              <el-select v-model="installReg" class="missing-reg">
                <el-option :label="$t('kernelMissing.registryNpmjs')" value="npmjs" />
                <el-option :label="$t('kernelMissing.registryNpmmirror')" value="npmmirror" />
              </el-select>
              <div class="wiz-hint">{{ $t('kernelMissing.registryHint') }}</div>
            </div>

            <div class="wiz-field">
              <label class="wiz-label">{{ $t('kernelMissing.configDir') }}</label>
              <div class="cfg-row">
                <el-input :model-value="cfgDir" readonly :placeholder="cfgDefaultDir" />
                <el-button type="primary" @click="pickConfigDir">{{ $t('kernelMissing.choose') }}</el-button>
                <el-button v-if="cfgDir !== cfgDefaultDir" @click="resetConfigDir">{{ $t('kernelMissing.restoreDefault') }}</el-button>
              </div>
              <div class="wiz-hint">{{ $t('kernelMissing.configDirHint') }}</div>
            </div>
          </div>

          <!-- 第 1 步：Node 环境（三选一） -->
          <div v-else-if="step === 1" class="wiz-pane">
            <div class="wiz-field">
              <label class="wiz-label">{{ $t('kernelMissing.node.pick') }}</label>
              <el-radio-group v-model="nodeRuntimeChoice" class="nr-opts">
                <el-radio :value="'system'" :disabled="!systemNodeOk">
                  {{ $t('kernelMissing.node.runtimeSystem') }}
                  <span v-if="!envProbe || !envProbe.node.present" class="muted">（{{ $t('kernelMissing.node.notFound') }}）</span>
                  <span v-else-if="!systemNodeOk" class="muted">（{{ $t('kernelMissing.node.need20') }}）</span>
                  <code v-else class="node-ver">{{ envProbe?.node.version }}</code>
                </el-radio>
                <el-radio :value="'electron'">
                  {{ $t('kernelMissing.node.runtimeElectron') }}
                  <span class="muted">（{{ $t('kernelMissing.node.rtDefault') }}）</span>
                </el-radio>
                <el-radio :value="'local'">{{ $t('kernelMissing.node.runtimeLocal') }}</el-radio>
              </el-radio-group>
              <div class="wiz-hint">{{ runtimeHint }}</div>
            </div>

            <div v-if="nodeRuntimeChoice === 'local'" class="wiz-field nr-local">
              <template v-if="envProbe?.local.present">
                <el-tag type="success" size="small" effect="plain">{{ $t('kernelMissing.node.localReady') }}&nbsp;{{ envProbe.local.version }}</el-tag>
                <div class="wiz-btn-row">
                  <el-button size="small" :loading="deployingNode" @click="deployNode">{{ $t('kernelMissing.node.redeploy') }}</el-button>
                  <el-button size="small" :icon="Refresh" :loading="probingEnv" @click="probeEnv">{{ $t('kernelMissing.node.rescan') }}</el-button>
                </div>
              </template>
              <template v-else>
                <p class="wiz-hint">{{ $t('kernelMissing.node.deployHint') }}</p>
              </template>

              <!-- 下载进度 -->
              <el-progress
                v-if="deployingNode"
                :percentage="deployPercent"
                :status="deployPercent >= 100 ? 'success' : undefined"
                :stroke-width="8"
                class="deploy-progress"
              />
              <template v-if="!envProbe?.local.present">
                <div class="wiz-btn-row">
                  <el-button type="primary" :icon="Download" :loading="deployingNode" @click="deployNode">
                    {{ $t('kernelMissing.node.deploy') }}
                  </el-button>
                  <el-button :icon="Refresh" :loading="probingEnv" @click="probeEnv">{{ $t('kernelMissing.node.rescan') }}</el-button>
                </div>
              </template>
            </div>

            <p v-else-if="nodeRuntimeChoice === 'system'" class="wiz-note">
              {{ $t('kernelMissing.node.systemNote', { ver: envProbe?.node.version || '' }) }}
            </p>
          </div>

          <!-- 第 2 步：NPM 环境 -->
          <div v-else-if="step === 2" class="wiz-pane">
            <div class="wiz-field">
              <label class="wiz-label">{{ $t('kernelMissing.npmSource') }}</label>
              <el-radio-group v-model="installNpm" class="npm-opts">
                <el-radio :value="'system'" :disabled="!envProbe?.npm">
                  {{ $t('kernelMissing.npmSystem') }}
                  <span v-if="!envProbe?.npm" class="muted">（{{ $t('kernelMissing.unavailable') }}）</span>
                </el-radio>
                <el-radio :value="'bundled'">{{ $t('kernelMissing.npmBundled') }}</el-radio>
                <el-radio v-if="envProbe?.local.present" :value="'localnode'">{{ $t('kernelMissing.npmLocalNode') }}</el-radio>
              </el-radio-group>
              <div class="wiz-hint">{{ $t('kernelMissing.npmHint') }}</div>
            </div>
          </div>

          <!-- 第 3 步：DSH 环境 -->
          <div v-else class="wiz-pane">
            <div class="wiz-field">
              <label class="wiz-label">{{ $t('kernelMissing.kernelSource') }}</label>
              <el-radio-group v-model="installSource">
                <el-radio :value="'local'">{{ $t('kernelMissing.kernelLocal') }}</el-radio>
                <el-radio :value="'global'">{{ $t('kernelMissing.kernelGlobal') }}</el-radio>
              </el-radio-group>
            </div>
            <div class="wiz-field">
              <div class="missing-opt">
                <span class="missing-opt__txt">{{ $t('kernelMissing.preLabel') }}</span>
                <el-switch v-model="installPrerelease" />
              </div>
            </div>
            <div class="wiz-field">
              <label class="wiz-label">{{ $t('kernelMissing.version') }}</label>
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
              <div class="wiz-hint">{{ $t('kernelMissing.versionHint') }}</div>
            </div>

            <p v-if="installError" class="missing-err">{{ installError }}</p>
          </div>
        </div>

        <!-- 每步执行进度条 -->
        <div v-if="installingKernel" class="install-progress central">
          <div class="activity">
            <span class="activity__label">{{ step === 3 ? $t('kernelMissing.progressNpm') : $t('kernelMissing.executing') }}</span>
            <div class="activity-bar" />
          </div>
          <div v-if="step === 3" class="activity">
            <span class="activity__label">{{ $t('kernelMissing.progressDsh') }}</span>
            <div class="activity-bar" />
          </div>
        </div>

        <!-- 底部导航：执行当前步并进入下一步 -->
        <div class="wiz-nav">
          <el-button text :disabled="installingKernel" @click="quitShell">{{ $t('kernelMissing.quit') }}</el-button>
          <div class="wiz-nav__right">
            <el-button v-if="step > 0" :disabled="installingKernel" @click="back">{{ $t('kernelMissing.prev') }}</el-button>
            <el-button type="primary" :loading="installingKernel" :icon="Refresh" @click="runCurrentStep">
              {{ step < 3 ? $t('kernelMissing.runStep') : $t('kernelMissing.install') }}
            </el-button>
          </div>
        </div>

        <!-- 右上角：全屏日志开关（向导打开即显示） -->
        <div class="log-toggle">
          <el-button size="small" :icon="Document" @click="logFullscreen = true">{{ $t('kernelMissing.viewLog') }}</el-button>
        </div>

        <!-- 全屏安装日志 -->
        <transition name="fade">
          <div v-if="logFullscreen" class="log-full">
            <div class="log-full__head">
              <span class="log-full__title">{{ $t('kernelMissing.installLog') }}</span>
              <div class="log-full__acts">
                <div v-if="installingKernel" class="log-full__mini">
                  <div class="activity-bar" />
                </div>
                <el-button :icon="Close" text @click="logFullscreen = false">{{ $t('kernelMissing.closeLog') }}</el-button>
              </div>
            </div>
            <pre class="log-full__body">{{ installLog.length ? installLog.join('\n') : $t('kernelMissing.logWaiting') }}</pre>
          </div>
        </transition>
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
/* 动态标签页显示网址导航栏时，去掉标题栏下边框，使标题栏与网址栏无缝相连 */
.titlebar--flush {
  border-bottom: none;
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
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
/* 标题栏里的图标按钮可点不可拖；非按钮区域(分割线/空隙)随容器可拖 */
.titlebar .icon-btn {
  -webkit-app-region: no-drag;
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
.icon-btn.core-jump {
  width: auto;
  padding: 0 10px;
  gap: 6px;
  font-size: 13px;
}
.core-jump__txt {
  white-space: nowrap;
}
/* ---- 固定三站图标按钮区 + 浏览器标签条 ---- */
.quick {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tabs {
  /* 容器可拖窗口；空白（含标签少时右侧）即可拖动，多标签时原生横向滚动 */
  -webkit-app-region: drag;
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: 8px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.tab {
  -webkit-app-region: no-drag;
  flex: 0 1 auto;
  min-width: 110px;
  max-width: 230px;
  height: 32px;
  padding: 0 6px 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.tab:hover {
  background: var(--el-fill-color);
}
.tab.on {
  background: var(--el-bg-color);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.tab__label {
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 保活固定按钮（星标，点亮即保活且不计入名额） */
.tab__pin {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
}
.tab__pin:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}
.tab__pin.on {
  color: var(--el-color-warning);
}
.tab__x {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
}
.tab__x:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}
.tab--add {
  -webkit-app-region: no-drag;
  flex: 0 0 auto;
  min-width: 0; /* 覆盖 .tab 的 min-width，＋ 按钮不做最小宽度 */
  padding: 0 8px;
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
  width: 560px;
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
.missing-logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
  -webkit-user-drag: none;
}
.missing-src {
  text-align: left;
  background: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
  padding: 8px 12px;
  margin-bottom: 8px;
}
.src-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
}
.src-row + .src-row {
  border-top: 1px dashed var(--el-border-color-lighter);
}
.src-row__txt {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.missing-log {
  margin-top: 10px;
  text-align: left;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
  overflow: hidden;
}
.missing-log__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: var(--el-fill-color-light);
  font-size: 12px;
}
.missing-log__title {
  color: var(--el-text-color-regular);
  font-weight: 600;
}
.missing-log__body {
  margin: 0;
  max-height: 160px;
  overflow: auto;
  padding: 8px 10px;
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
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
/* ---- 首次安装引导 ---- */
.wiz-steps {
  margin: 6px 0 18px;
  --el-step-title-font-size: 13px;
}
.wiz-body {
  text-align: left;
  min-height: 170px;
}
.wiz-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wiz-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wiz-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
.wiz-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
.wiz-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  text-align: left;
}
.node-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.node-status__line {
  display: inline-flex;
  align-items: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.npm-opts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.nr-opts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.nr-opts .el-radio {
  height: auto;
  white-space: normal;
  margin-right: 0;
}
.nr-local {
  margin-top: 2px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-light);
}
.deploy-progress {
  width: 100%;
}
.muted {
  color: var(--el-text-color-disabled);
  font-size: 12px;
}
.wiz-btn-row {
  display: flex;
  gap: 10px;
}
.wiz-nav {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wiz-nav__right {
  display: flex;
  gap: 10px;
}
.node-status .spin {
  animation: wiz-rot 1s linear infinite;
}
.node-found {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.cfg-row {
  display: flex;
  gap: 8px;
}
.cfg-row .el-input {
  flex: 1 1 auto;
}
.node-ver {
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
}
@keyframes wiz-rot {
  to {
    transform: rotate(360deg);
  }
}
/* ---- 安装进度条（npm / DSH 活动条） ---- */
.install-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.activity {
  display: flex;
  align-items: center;
  gap: 10px;
}
.activity__label {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.activity-bar {
  position: relative;
  flex: 1 1 auto;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--el-fill-color);
}
.activity-bar::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 40%;
  border-radius: 4px;
  background: var(--el-color-primary);
  animation: bar-slide 1.1s ease-in-out infinite;
}
@keyframes bar-slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}
.log-open {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}
/* ---- 右上角开关 + 全屏日志 ---- */
.log-toggle {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 2001;
}
.log-full {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}
.log-full__head {
  flex: 0 0 auto;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.log-full__title {
  font-weight: 600;
  font-size: 15px;
}
.log-full__acts {
  display: flex;
  align-items: center;
  gap: 16px;
}
.log-full__mini {
  width: 180px;
}
.log-full__body {
  flex: 1 1 auto;
  margin: 0;
  overflow: auto;
  padding: 12px 16px;
  font-family: var(--el-font-family-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--el-text-color-regular);
}
/* ---- 过渡 ---- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* ---- 标签页右键菜单 ---- */
.ctx-bk {
  position: fixed;
  inset: 0;
  z-index: 3000;
}
.ctx {
  position: fixed;
  z-index: 3001;
  min-width: 150px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
}
.ctx button {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.ctx button:hover:not(:disabled) {
  background: var(--el-fill-color);
}
.ctx button.ctx__disabled {
  color: var(--el-text-color-placeholder);
  cursor: default;
}
.ctx__sep {
  height: 1px;
  background: var(--el-border-color-lighter);
  margin: 4px 0;
}
</style>
