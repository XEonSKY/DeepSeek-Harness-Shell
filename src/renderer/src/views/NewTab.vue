<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Monitor, ChatDotRound, Wallet, Search } from '@element-plus/icons-vue'
import { useAppIcon } from '../lib/appIcon'
import { webTabs, activateTab, closeTab, activeTab, findTab, launchFromNewTab } from '../shell/tabs'
import { SEARCH_ENGINE_IDS, ENGINE_LABEL_KEY, buildSearchUrl } from '../lib/engines'
import type { SearchEngineId, Shortcut } from '@shared/types'

const q = ref('')
const engine = ref<SearchEngineId>('bing')
const shortcuts = ref<Shortcut[]>([])
// 应用 Logo：随深浅色切换（深色用 icon-dark.png），见 appIcon.ts
const appIcon = useAppIcon()

// 顶部固定三站（直达已有固定标签页）。
const fixedSites = [
  { id: 'home', key: 'app.nav.ui', icon: Monitor },
  { id: 'chat', key: 'app.nav.chat', icon: ChatDotRound },
  { id: 'platform', key: 'app.nav.platform', icon: Wallet }
] as const

onMounted(async () => {
  try {
    const s = await window.api.getSettings()
    engine.value = s.searchEngine || 'bing'
    shortcuts.value = Array.isArray(s.shortcuts) ? s.shortcuts : []
  } catch {
    /* defaults */
  }
})

/** 离开当前导航页（导航页是一次性的）。 */
function leave(act: () => void): void {
  const curId = webTabs.activeId
  const curKind = activeTab()?.kind
  act()
  if (curKind === 'newtab' && curId) {
    const cur = findTab(curId)
    if (cur) closeTab(curId)
  }
}

/** 点固定三站：切到对应固定标签页并关闭本导航页。 */
function goFixed(id: string): void {
  leave(() => activateTab(id))
}

/** 打开一个 URL（新建动态标签页），导航页随之关闭。 */
function openUrl(url: string, title?: string): void {
  if (activeTab()?.kind === 'newtab') launchFromNewTab(url, title)
  else leave(() => launchFromNewTab(url, title))
}

/** 提交搜索/网址。 */
async function submit(): Promise<void> {
  const s = q.value.trim()
  if (!s) return
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s)
  if (scheme) {
    const proto = scheme[1].toLowerCase()
    if (proto === 'http' || proto === 'https') openUrl(s)
    else await window.api.openExternal(s) // 扩展/非内置协议交给系统
    return
  }
  if (/^[\w.-]+\.[a-zA-Z]{2,}$/.test(s)) {
    openUrl('https://' + s, s)
    return
  }
  openUrl(buildSearchUrl(engine.value, s), s)
}
</script>

<template>
  <div class="nt">
    <img :src="appIcon" class="nt__logo" alt="" draggable="false" />
    <h1 class="nt__title">DeepSeek Harness Shell</h1>

    <form class="nt__search" @submit.prevent="submit">
      <el-select v-model="engine" class="nt__engine" :placeholder="$t('navPage.engineLabel')">
        <el-option v-for="id in SEARCH_ENGINE_IDS" :key="id" :value="id" :label="$t(ENGINE_LABEL_KEY[id])" />
      </el-select>
      <el-input
        v-model="q"
        class="nt__input pill-input"
        :placeholder="$t('navPage.placeholder')"
        clearable
        autofocus
        @keyup.enter="submit"
      />
      <el-button native-type="submit" type="primary" class="nt__go">
        <el-icon :size="16"><Search /></el-icon>
        <span>{{ $t('navPage.search') }}</span>
      </el-button>
    </form>

    <section class="nt__quick">
      <h2 class="nt__h">{{ $t('navPage.quick') }}</h2>
      <div class="nt__grid">
        <button
          v-for="site in fixedSites"
          :key="site.id"
          class="nt__cell"
          type="button"
          @click="goFixed(site.id)"
        >
          <el-icon :size="22"><component :is="site.icon" /></el-icon>
          <span>{{ $t(site.key) }}</span>
        </button>

        <a
          v-for="(sc, i) in shortcuts"
          :key="i"
          class="nt__cell"
          href="#"
          @click.prevent="openUrl(sc.url, sc.title)"
        >
          <span class="nt__fav">{{ (sc.title || '☆').slice(0, 1) }}</span>
          <span>{{ sc.title }}</span>
        </a>
      </div>
      <p v-if="!shortcuts.length" class="nt__empty">{{ $t('sv.general.shortcutHint') }}</p>
    </section>
  </div>
</template>

<style scoped>
.nt {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--el-bg-color-page);
  gap: 8px;
}
.nt__logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  -webkit-user-drag: none;
}
.nt__title {
  margin: 4px 0 18px;
  font-size: 20px;
  font-weight: 700;
}
.nt__search {
  display: flex;
  gap: 8px;
  width: min(680px, 92%);
}
.nt__engine {
  flex: 0 0 140px;
}
.nt__input {
  flex: 1 1 auto;
}
.nt__go {
  flex: 0 0 auto;
}
.nt__quick {
  margin-top: 34px;
  width: min(680px, 92%);
}
.nt__h {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px;
  font-weight: 600;
}
.nt__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 10px;
}
.nt__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  text-decoration: none;
  font-size: 13px;
  cursor: pointer;
  overflow: hidden;
}
.nt__cell:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.nt__fav {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--el-fill-color);
  font-size: 15px;
}
.nt__empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  margin-top: 4px;
}
</style>
