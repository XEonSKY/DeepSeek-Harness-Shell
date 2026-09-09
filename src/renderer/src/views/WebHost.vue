<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Refresh, Loading } from '@element-plus/icons-vue'
import { webTabs, activeTab, openTab, setHomeUrl, keptTabIds } from '../tabs'
import type { WebTab } from '../tabs'
import NewTab from './NewTab.vue'
import { buildSearchUrl } from '../engines'
import type { SearchEngineId } from '@shared/types'

/**
 * 「/」路由宿主：标签页模式的 web 内容区。
 * - 每个标签页一个 pane；激活页可见，其余隐藏但保留在 DOM——已访问 webview 保活。
 * - webview 首次激活时创建（避免启动即预载外站），随后保活直到标签关闭。
 * - home（内核 UI）订阅主进程 dsh URL 广播 + 轮询兜底。
 * - 任一 webview 的 target=_blank / window.open (ui:new-tab) → openTab 动态新标签页。
 * - 顶部是浏览器式导航栏（后退/前进/刷新 + 地址栏），驱动当前激活 webview。
 * - 标题栏刷新(ui:reload-dsh) → 重载当前激活 webview。
 */
const holderEls: Record<string, HTMLDivElement | null> = {}
const wvById = new Map<string, any>()
let zoomPct = 100
let defaultEngine: SearchEngineId = 'bing'

let offUrl: (() => void) | null = null
let offNewTab: (() => void) | null = null
let offReload: (() => void) | null = null
let offSettings: (() => void) | null = null
let pollTimer: number | null = null

// 当前激活 webview 的导航状态（显示在地址栏）。
const nav = reactive({ url: '', canBack: false, canForward: false, loading: false })
/** 地址栏可编辑文本。 */
const urlInput = ref('')
const addrEditing = ref(false)

function activeWv(): any {
  const t = activeTab()
  return t ? wvById.get(t.id) : null
}

/** 网址导航栏仅在动态标签页激活时显示；三个固定站不显示。 */
const showNav = computed(() => activeTab()?.kind === 'dynamic')

function setHolder(id: string, el: HTMLDivElement | null): void {
  if (el) holderEls[id] = el
  else delete holderEls[id]
}

function applyZoom(wv: any): void {
  try {
    if (wv && typeof wv.setZoomFactor === 'function') wv.setZoomFactor((zoomPct || 100) / 100)
  } catch {
    /* ignore */
  }
}

function removeWebview(id: string): void {
  const wv = wvById.get(id)
  if (wv) {
    try {
      wv.remove()
    } catch {
      /* ignore */
    }
    wvById.delete(id)
  }
}

/** 用某 webview 刷新导航栏状态（仅当其仍是激活标签页时）。 */
function syncNavFrom(wv: any): void {
  if (!wv || activeWv() !== wv) return
  try {
    const url = typeof wv.getURL === 'function' ? (wv.getURL() as string) : ''
    nav.url = url || ''
    nav.canBack = typeof wv.canGoBack === 'function' ? !!wv.canGoBack() : false
    nav.canForward = typeof wv.canGoForward === 'function' ? !!wv.canGoForward() : false
    if (!addrEditing.value) urlInput.value = nav.url
  } catch {
    /* ignore */
  }
}

/** 为某个标签页创建 webview（首次激活时调用）。 */
function ensureWebview(tab: WebTab): void {
  const holder = holderEls[tab.id]
  if (!holder || !tab.url) return
  let wv = wvById.get(tab.id)
  if (!wv) {
    wv = document.createElement('webview')
    // 必须显式允许弹窗，target=_blank / window.open 才会进入主进程的
    // setWindowOpenHandler（主进程再转成“应用内新标签页”）。缺了它会被 webview 静默拦掉。
    wv.setAttribute('allowpopups', '')
    wv.style.width = '100%'
    wv.style.height = '100%'
    wv.style.border = 'none'
    wv.style.flex = '1 1 auto'
    holder.appendChild(wv)
    wvById.set(tab.id, wv)
    tab.visited = true // 打开过：固定三站此时才开始保活

    wv.addEventListener('dom-ready', () => {
      applyZoom(wv)
      // 动态标签页标题跟随真实页面标题；固定来源用友好名。
      if (tab.kind === 'dynamic') {
        const title = typeof wv.getTitle === 'function' ? (wv.getTitle() as string) : ''
        if (title) tab.title = title
      }
      syncNavFrom(wv)
    })
    wv.addEventListener('did-navigate', () => syncNavFrom(wv))
    wv.addEventListener('did-navigate-in-page', () => syncNavFrom(wv))
    wv.addEventListener('did-start-loading', () => {
      if (activeWv() === wv) nav.loading = true
    })
    wv.addEventListener('did-stop-loading', () => {
      if (activeWv() === wv) {
        nav.loading = false
        syncNavFrom(wv)
      }
    })
    // 仅在首次创建时设置 src；此后不再复位，避免切换/返回时触发重载。
    wv.src = tab.url
  }
}

/** 确保当前激活标签页有 webview（已访问标签页保活）。 */
function ensureActive(): void {
  const t = activeTab()
  if (t) ensureWebview(t)
}

function reloadActive(): void {
  const wv = activeWv()
  if (wv && typeof wv.reload === 'function') wv.reload()
}

// ---- 导航栏动作 ----
function navBack(): void {
  activeWv()?.goBack()
}
function navForward(): void {
  activeWv()?.goForward()
}
function navReload(): void {
  const wv = activeWv()
  if (!wv) return
  if (nav.loading && typeof wv.stop === 'function') wv.stop()
  else if (typeof wv.reload === 'function') wv.reload()
}
/** 处理地址栏输入：URL / 扩展协议 / 搜索。 */
async function onAddressEnter(): Promise<void> {
  const wv = activeWv()
  if (!wv) return
  const raw = urlInput.value.trim()
  if (!raw) {
    urlInput.value = nav.url
    return
  }
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(raw)
  if (scheme) {
    const proto = scheme[1].toLowerCase()
    // http/https/about 由 webview 内置加载；其它协议（mailto:/tel:/自定义等）交系统打开。
    if (proto === 'http' || proto === 'https' || proto === 'about') {
      urlInput.value = raw
      await wv.loadURL(raw).catch(() => {})
    } else {
      urlInput.value = nav.url
      await window.api.openExternal(raw)
    }
    return
  }
  let url: string
  if (/^[\w.-]+\.[a-zA-Z]{2,}$/.test(raw)) {
    url = 'https://' + raw
  } else {
    url = buildSearchUrl(defaultEngine, raw) // 非网址 → 默认引擎搜索
  }
  urlInput.value = url
  try {
    await wv.loadURL(url)
  } catch {
    /* did-fail-load will surface */
  }
}

function stopPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(): void {
  if (pollTimer !== null) return
  let tries = 0
  pollTimer = window.setInterval(async () => {
    if (activeTab()?.url) {
      stopPolling()
      return
    }
    if (++tries > 120) {
      stopPolling()
      return
    }
    try {
      const u = await window.api.getDshUrl()
      if (u) {
        setHomeUrl(u)
        stopPolling()
      }
    } catch {
      /* keep polling */
    }
  }, 1000)
}

let lastHomeUrl: string | null = null

/** 销毁不在保活集（keptTabIds：固定三站 + 最近 3 个动态）或已关闭标签页的 webview。 */
function pruneWebviews(): void {
  const keep = keptTabIds()
  for (const id of [...wvById.keys()]) {
    if (!keep.has(id)) removeWebview(id)
  }
}

/** home(内核 UI)URL 变化（dsh 就绪/重连换端口）时，让已存在的 home webview 导航过去。 */
function syncHomeUrl(): void {
  const home = webTabs.list.find((t) => t.kind === 'home')
  const u = home?.url ?? null
  if (u && u !== lastHomeUrl) {
    lastHomeUrl = u
    const wv = wvById.get('home')
    if (wv && wv.src && wv.src !== u && typeof wv.loadURL === 'function') {
      void wv.loadURL(u).catch(() => {
        /* 导航失败由 webview 自身事件反映 */
      })
    }
  }
}

// 标签页增减 / 激活切换 / LRU 次序(used) / home URL 变化 → 重建激活 webview + 保活裁剪。
watch(
  () =>
    (webTabs.activeId ?? '') +
    '|' +
    webTabs.list.map((t) => `${t.id}:${t.kind}:${t.used}:${t.keep ? 1 : 0}:${t.url ?? ''}`).join('~'),
  () => {
    ensureActive() // 激活标签页若无 webview 则新建（激活的动态必属于最近保活集）
    pruneWebviews() // 裁剪：只保留固定三站 + 最近 3 个动态标签页的 webview
    syncHomeUrl()
    syncNavFrom(activeWv())
  },
  { flush: 'post' }
)

onMounted(async () => {
  try {
    const s = await window.api.getSettings()
    zoomPct = s.zoomPercent ?? 100
    defaultEngine = s.searchEngine || 'bing'
  } catch {
    zoomPct = 100
  }

  offUrl = window.api.onDshUrl((u) => setHomeUrl(u))
  offNewTab = window.api.onNewTab((url) => openTab(url))
  offReload = window.api.onReloadDsh(reloadActive)
  offSettings = window.api.onSettingsChanged((s) => {
    zoomPct = s.zoomPercent ?? 100
    if (s.searchEngine) defaultEngine = s.searchEngine
    for (const wv of wvById.values()) applyZoom(wv)
  })

  // 初始拉取 dsh URL；拿不到则轮询。
  ensureActive()
  syncNavFrom(activeWv())
  const u = await window.api.getDshUrl()
  if (u) setHomeUrl(u)
  else startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  offUrl?.()
  offNewTab?.()
  offReload?.()
  offSettings?.()
  for (const id of [...wvById.keys()]) removeWebview(id)
  wvById.clear()
})
</script>

<template>
  <div class="whost">
    <!-- 浏览器式导航栏：仅在动态标签页激活时显示（三个固定站用标题栏旧版刷新按钮） -->
    <div v-if="showNav" class="wb-nav">
      <button class="wn" type="button" :disabled="!nav.canBack" title="←" @click="navBack">
        <el-icon :size="16"><ArrowLeft /></el-icon>
      </button>
      <button class="wn" type="button" :disabled="!nav.canForward" title="→" @click="navForward">
        <el-icon :size="16"><ArrowRight /></el-icon>
      </button>
      <button class="wn" type="button" title="reload / stop" @click="navReload">
        <el-icon :size="15" :class="{ spin: nav.loading }"><Refresh /></el-icon>
      </button>
      <div class="wn-addr">
        <el-input
          v-model="urlInput"
          :placeholder="$t('app.tabs.promptPlaceholder')"
          clearable
          @focus="addrEditing = true"
          @blur="addrEditing = false"
          @keyup.enter="onAddressEnter"
        />
      </div>
    </div>

    <div class="wb-stage">
      <div
        v-for="tab in webTabs.list"
        :key="tab.id"
        class="whost__pane"
        :class="{ on: tab.id === webTabs.activeId }"
      >
        <!-- 内置导航页（无 webview） -->
        <NewTab v-if="tab.kind === 'newtab'" />
        <template v-else>
          <div class="whost__holder" :ref="(el) => setHolder(tab.id, el as HTMLDivElement | null)"></div>
          <div v-if="!tab.url" class="whost__wait">
            <el-icon class="spin" :size="36"><Loading /></el-icon>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.whost {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* 导航栏 */
.wb-nav {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
}
.wn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.wn:hover:not(:disabled) {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}
.wn:disabled {
  color: var(--el-text-color-placeholder);
  cursor: default;
}
.wn-addr {
  flex: 1 1 auto;
  min-width: 0;
}
.wn-addr :deep(.el-input__wrapper) {
  border-radius: 999px;
}
/* 内容舞台 */
.wb-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}
.whost__pane {
  position: absolute;
  inset: 0;
  /* 隐藏非激活页，避免各标签页内容叠穿；用 visibility 而非 display:none，
     使 webview 保持存活。切回时不再重载的关键是不去重设其 src（见 ensureWebview）。 */
  visibility: hidden;
}
.whost__pane.on {
  visibility: visible;
}
.whost__holder {
  position: absolute;
  inset: 0;
  display: flex;
}
.whost__wait {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  pointer-events: none;
}
.spin {
  animation: rot 1s linear infinite;
}
@keyframes rot {
  to {
    transform: rotate(360deg);
  }
}
</style>
