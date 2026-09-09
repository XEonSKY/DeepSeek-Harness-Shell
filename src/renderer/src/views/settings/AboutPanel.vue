<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Promotion, Refresh } from '@element-plus/icons-vue'
import { useSettingsStore } from './useSettingsStore'
import PanelCard from './PanelCard.vue'
import { friendlyPlatform } from './settingsStore'
import type { AppMeta, AppUpdateEvent } from '@shared/types'
import aboutIcon from '../../assets/icon.png'

const { state } = useSettingsStore()

type Phase = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'none' | 'error'

const meta = ref<AppMeta | null>(null)
const phase = ref<Phase>('idle')
const targetVersion = ref<string | null>(null)
const percent = ref(0)
const errMsg = ref('')

const envLabel = ref('')

function onEvent(e: AppUpdateEvent): void {
  switch (e.kind) {
    case 'checking':
      phase.value = 'checking'
      break
    case 'available':
      targetVersion.value = e.version ?? null
      phase.value = 'downloading'
      percent.value = 0
      break
    case 'progress':
      phase.value = 'downloading'
      percent.value = Math.round(e.percent ?? 0)
      break
    case 'downloaded':
      targetVersion.value = e.version ?? targetVersion.value
      phase.value = 'downloaded'
      percent.value = 100
      break
    case 'not-available':
      phase.value = 'none'
      break
    case 'error':
      errMsg.value = e.message ?? ''
      phase.value = 'error'
      break
  }
}

async function check(): Promise<void> {
  errMsg.value = ''
  phase.value = 'checking'
  const r = await window.api.triggerAppUpdate({ prerelease: state.appCheckPrerelease })
  if (!r.ok) {
    errMsg.value = r.message
    phase.value = 'error'
  }
}

function restart(): void {
  window.api.restartAndInstall()
}

let offEvent: (() => void) | null = null

onMounted(async () => {
  offEvent = window.api.onAppUpdateEvent(onEvent)
  try {
    const m = await window.api.getAppMeta()
    meta.value = m
    const parts: string[] = []
    if (m.platform) parts.push(friendlyPlatform(m.platform))
    if (m.arch) parts.push(m.arch)
    envLabel.value = parts.join(' · ')
  } catch {
    /* ignore */
  }
})

onBeforeUnmount(() => offEvent?.())
</script>

<template>
  <div class="panel">
    <div class="dsh-brand">
      <div class="dsh-brand__icon about-logo"><img :src="aboutIcon" alt="DeepSeek Harness Shell" draggable="false" /></div>
      <div class="dsh-brand__txt">
        <div class="dsh-brand__name">DeepSeek Harness Shell</div>
        <div class="dsh-brand__ver">
          {{ $t('sv.about.appVersion') }}&nbsp;<code>{{ meta?.version ? 'v' + meta.version : '—' }}</code>
          <span v-if="envLabel" class="env-badge">{{ envLabel }}</span>
        </div>
      </div>
    </div>

    <!-- 更新开关 -->
    <PanelCard id="about-options">
      <template #header>
        <div class="sec__title">{{ $t('sv.about.options') }}</div>
      </template>
      <div class="kopt">
        <div class="au">
          <div class="au__txt">
            <div class="au__t">{{ $t('sv.about.autoUpdate') }}</div>
            <div class="au__desc">{{ $t('sv.about.autoUpdateDesc') }}</div>
          </div>
          <el-switch v-model="state.appAutoUpdate" />
        </div>
        <div class="au">
          <div class="au__txt">
            <div class="au__t">{{ $t('sv.about.checkPrerelease') }}</div>
            <div class="au__desc">{{ $t('sv.about.checkPrereleaseDesc') }}</div>
          </div>
          <el-switch v-model="state.appCheckPrerelease" />
        </div>
        <div class="au">
          <div class="au__txt">
            <div class="au__t">{{ $t('sv.about.devMode') }}</div>
            <div class="au__desc">{{ $t('sv.about.devModeDesc') }}</div>
          </div>
          <el-switch v-model="state.devMode" />
        </div>
      </div>
    </PanelCard>

    <!-- 更新操作区 -->
    <PanelCard id="about-check">
      <template #header>
        <div class="sec__title"><el-icon><Refresh /></el-icon> {{ $t('sv.about.checkTitle') }}</div>
      </template>

      <div class="au-row">
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="phase === 'checking'"
          :disabled="phase === 'checking' || phase === 'downloading'"
          @click="check"
        >
          {{ $t('sv.about.checkBtn') }}
        </el-button>
        <el-button
          v-if="phase === 'downloaded'"
          type="success"
          :icon="Promotion"
          @click="restart"
        >
          {{ $t('sv.about.restartNow') }}
        </el-button>
      </div>

      <template v-if="phase === 'downloading'">
        <p class="au-note">{{ $t('sv.about.downloading', { version: targetVersion || '' }) }}</p>
        <el-progress :percentage="percent" :status="percent >= 100 ? 'success' : 'active'" />
      </template>

      <el-alert
        v-else-if="phase === 'downloaded'"
        class="about-result"
        :title="$t('sv.about.downloadedTitle')"
        :description="$t('sv.about.downloadedDesc')"
        type="success"
        show-icon
        :closable="false"
      />
      <el-alert
        v-else-if="phase === 'none'"
        class="about-result"
        :title="$t('sv.about.notAvailable')"
        type="info"
        show-icon
        :closable="false"
      />
      <el-alert
        v-else-if="phase === 'error' && errMsg"
        class="about-result"
        :title="errMsg"
        type="warning"
        show-icon
        :closable="false"
      />
    </PanelCard>
  </div>
</template>

<style scoped>
/* 关于页使用应用图标（icon.png）替代默认的 Info 图标。 */
.about-logo {
  background: transparent;
}
.about-logo img {
  width: 52px;
  height: 52px;
  border-radius: 13px;
  object-fit: cover;
  display: block;
}
</style>
