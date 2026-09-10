<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Promotion, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from './useSettingsStore'
import { friendlyPlatform } from './settingsStore'
import type { AppMeta, AppUpdateEvent } from '@shared/types'
import { useAppIcon } from '../../lib/appIcon'
import { tt } from '../../lib/locales'

const { state } = useSettingsStore()
// 应用 Logo：随深浅色切换（深色用 icon-dark.png），见 lib/appIcon.ts
const aboutIcon = useAppIcon()

/** 开发模式彩蛋：连点应用版本 5 次解锁。 */
const DEV_UNLOCK_TAPS = 5
const DEV_TAP_WINDOW_MS = 1500

let tapCount = 0
let tapTimer: number | undefined
let burstHost: HTMLElement | null = null

/** 从点击点炸出一圈彩色粒子。 */
function spawnBurst(el: HTMLElement, e: MouseEvent): void {
  burstHost ??= el.parentElement ?? el
  const hostRect = burstHost.getBoundingClientRect()
  const x = e.clientX - hostRect.left
  const y = e.clientY - hostRect.top
  const colors = [
    'var(--el-color-primary)',
    'var(--el-color-primary-light-3)',
    'var(--el-color-warning)',
    'var(--el-color-success)',
    'var(--el-color-danger)'
  ]

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i')
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4
    const dist = 18 + Math.random() * 22
    const size = 3 + Math.random() * 3
    p.className = 'kv-burst'
    p.style.cssText = [
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${size}px`,
      `background:${colors[i % colors.length]}`,
      `--dx:${Math.cos(angle) * dist}px`,
      `--dy:${Math.sin(angle) * dist}px`,
      `--rot:${Math.random() * 360}deg`
    ].join(';')
    burstHost.appendChild(p)
    p.addEventListener('animationend', () => p.remove(), { once: true })
  }
}

function onAppVerClick(e: MouseEvent): void {
  const el = e.currentTarget as HTMLElement
  spawnBurst(el, e)

  if (state.devMode) return

  if (tapTimer) window.clearTimeout(tapTimer)
  tapCount += 1
  if (tapCount >= DEV_UNLOCK_TAPS) {
    tapCount = 0
    state.devMode = true
    ElMessage.success(tt('sv.about.devUnlocked'))
    return
  }

  tapTimer = window.setTimeout(() => {
    tapCount = 0
  }, DEV_TAP_WINDOW_MS)
}

const open = ref(['about-options', 'about-links', 'about-check'])

type Phase = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'none' | 'error'

const meta = ref<AppMeta | null>(null)
const phase = ref<Phase>('idle')
const targetVersion = ref<string | null>(null)
const percent = ref(0)
const errMsg = ref('')

const envLabel = ref('')

/** 项目主页（外部浏览器打开）。 */
const REPO_URL = 'https://github.com/XEonSKY/DeepSeek-Harness-Shell'

function openRepo(): void {
  void window.api.openExternal(REPO_URL)
}

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

onBeforeUnmount(() => {
  offEvent?.()
  if (tapTimer) window.clearTimeout(tapTimer)
})
</script>

<template>
  <div class="panel">
    <div class="dsh-brand">
      <div class="dsh-brand__icon about-logo"><img :src="aboutIcon" alt="DeepSeek Harness Shell" draggable="false" /></div>
      <div class="dsh-brand__txt">
        <div class="dsh-brand__name">DeepSeek Harness Shell</div>
        <div class="dsh-brand__ver">
          {{ $t('sv.about.appVersion') }}&nbsp;<code
            class="app-ver"
            @click="onAppVerClick"
          >{{ meta?.version ? 'v' + meta.version : '—' }}</code>
          <span v-if="envLabel" class="env-badge">{{ envLabel }}</span>
        </div>
      </div>
    </div>

    <el-collapse v-model="open">
      <!-- 更新开关 -->
      <el-collapse-item name="about-options">
        <template #title>
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
          <!-- 开发模式默认隐藏：在内核页连点「内核版本」5 次解锁；开启后才显示，关闭即再隐藏 -->
          <div v-if="state.devMode" class="au">
            <div class="au__txt">
              <div class="au__t">{{ $t('sv.about.devMode') }}</div>
              <div class="au__desc">{{ $t('sv.about.devModeDesc') }}</div>
            </div>
            <el-switch v-model="state.devMode" />
          </div>
        </div>
      </el-collapse-item>

      <!-- 项目链接 -->
      <el-collapse-item name="about-links">
        <template #title>
          <div class="sec__title">{{ $t('sv.about.links') }}</div>
        </template>
        <div class="au">
          <div class="au__txt">
            <div class="au__t">{{ $t('sv.about.github') }}</div>
            <div class="au__desc">{{ $t('sv.about.githubDesc') }}</div>
            <div class="repo-url">{{ REPO_URL }}</div>
          </div>
          <el-button class="repo-btn" @click="openRepo">
            <svg class="gh-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
              />
            </svg>
            {{ $t('sv.about.openGithub') }}
          </el-button>
        </div>
      </el-collapse-item>

      <!-- 更新操作区 -->
      <el-collapse-item name="about-check">
        <template #title>
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
      </el-collapse-item>
    </el-collapse>
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

/* 项目主页：地址 + 外链按钮 */
.repo-url {
  display: inline-block;
  margin-top: 8px;
  padding: 3px 8px;
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  word-break: break-all;
}
.repo-btn {
  flex: 0 0 auto;
}
.gh-icon {
  width: 15px;
  height: 15px;
  margin-right: 6px;
  vertical-align: -2px;
  display: inline-block;
}
</style>
