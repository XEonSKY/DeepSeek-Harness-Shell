<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { appState } from '../state'

const holder = ref<HTMLDivElement | null>(null)
let wv: any = null
let offUrl: (() => void) | null = null
let offReload: (() => void) | null = null
let pollTimer: number | null = null

// The webview is created once the container is mounted (it always exists), so
// there is no dependency on a v-if swap happening before we set the src.
function ensureWebview(): void {
  if (!holder.value || wv) return
  wv = document.createElement('webview')
  wv.style.width = '100%'
  wv.style.height = '100%'
  wv.style.border = 'none'
  wv.style.flex = '1 1 auto'
  holder.value.appendChild(wv)
  wv.addEventListener('dom-ready', () => {
    appState.connected = true
    appState.starting = false
  })
}

async function applyUrl(url: string | null): Promise<void> {
  if (!url) return
  appState.url = url
  ensureWebview()
  if (wv && wv.src !== url) wv.src = url
}

function reload(): void {
  if (wv && typeof wv.reload === 'function') wv.reload()
  else if (appState.url) void applyUrl(appState.url)
}

// The dsh server may take a few seconds to come up and print its URL. Poll in
// case the "url ready" broadcast raced ahead of this view's subscription.
function startPolling(): void {
  if (pollTimer !== null) return
  let tries = 0
  pollTimer = window.setInterval(async () => {
    if (appState.url) {
      stopPolling()
      return
    }
    if (++tries > 120) {
      stopPolling()
      appState.starting = false
      return
    }
    try {
      const u = await window.api.getDshUrl()
      if (u) {
        stopPolling()
        await applyUrl(u)
      }
    } catch {
      /* keep polling */
    }
  }, 1000)
}

function stopPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  ensureWebview()
  offUrl = window.api.onDshUrl((u) => void applyUrl(u))
  offReload = window.api.onReloadDsh(reload) // title-bar refresh (UI page only)
  startPolling()
  const u = await window.api.getDshUrl()
  await applyUrl(u)
})

onBeforeUnmount(() => {
  offUrl?.()
  offReload?.()
  stopPolling()
  if (wv && holder.value && wv.parentNode === holder.value) {
    try {
      holder.value.removeChild(wv)
    } catch {
      /* ignore */
    }
  }
  wv = null
})
</script>

<template>
  <div class="web">
    <div ref="holder" class="web__holder"></div>

    <div v-if="!appState.url" class="web__overlay">
      <el-icon class="spin" :size="36"><Loading /></el-icon>
    </div>
  </div>
</template>

<style scoped>
.web {
  position: relative;
  width: 100%;
  height: 100%;
}
.web__holder {
  position: absolute;
  inset: 0;
  display: flex;
}
.web__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
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
