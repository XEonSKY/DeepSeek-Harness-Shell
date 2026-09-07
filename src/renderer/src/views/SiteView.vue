<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'

/**
 * 通用「内嵌外部站点」页：以 <webview> 打开路由 meta.externalUrl 指定的网址
 * （/platform、/chat 共用本组件）。标题栏「刷新」广播会重载本页。
 */
const route = useRoute()
const targetUrl = computed<string>(() => (route.meta.externalUrl as string) || '')

const holder = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const failed = ref(false)
let wv: any = null
let offReload: (() => void) | null = null

function createWebview(): void {
  if (!holder.value || wv) return
  wv = document.createElement('webview')
  wv.style.width = '100%'
  wv.style.height = '100%'
  wv.style.border = 'none'
  wv.style.flex = '1 1 auto'
  holder.value.appendChild(wv)
  wv.addEventListener('dom-ready', () => {
    ready.value = true
    failed.value = false
  })
  // Only treat a failure of the main frame as a load error (ignore sub-resources).
  wv.addEventListener('did-fail-load', (e: { isMainFrame?: boolean }) => {
    if (e.isMainFrame !== false) {
      failed.value = true
      ready.value = false
    }
  })
}

function setSrc(url: string): void {
  if (!url) return
  ready.value = false
  failed.value = false
  createWebview()
  if (wv && wv.src !== url) wv.src = url
}

function reload(): void {
  failed.value = false
  if (wv && typeof wv.reload === 'function') wv.reload()
  else setSrc(targetUrl.value)
}

// Two SiteView routes (/platform, /chat) reuse the same component instance, so
// switching between them must reload the webview with the new target URL.
watch(targetUrl, (u) => setSrc(u))

onMounted(() => {
  createWebview()
  setSrc(targetUrl.value)
  offReload = window.api.onReloadDsh(reload)
})

onBeforeUnmount(() => {
  offReload?.()
  if (wv && holder.value && wv.parentNode === holder.value) {
    try {
      holder.value.removeChild(wv)
    } catch {
      /* ignore */
    }
  }
  wv = null
  ready.value = false
  failed.value = false
})
</script>

<template>
  <div class="site">
    <div ref="holder" class="site__holder"></div>

    <div v-if="failed" class="site__err">
      <div class="site__err-t">{{ $t('webpage.loadFailed') }}</div>
      <el-button size="small" @click="reload">{{ $t('webpage.retry') }}</el-button>
    </div>
    <div v-else-if="!ready" class="site__loading">
      <el-icon class="spin" :size="34"><Loading /></el-icon>
    </div>
  </div>
</template>

<style scoped>
.site {
  position: relative;
  width: 100%;
  height: 100%;
}
.site__holder {
  position: absolute;
  inset: 0;
  display: flex;
}
.site__loading,
.site__err {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  pointer-events: none;
}
.site__err {
  pointer-events: auto;
  color: var(--el-text-color-regular);
}
.site__err-t {
  font-size: 14px;
  color: var(--el-text-color-secondary);
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
