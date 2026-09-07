<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { Setting, Moon, Cpu, InfoFilled } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from './settings/useSettingsStore'

type Group = 'general' | 'appearance' | 'dsh' | 'about'

const { actions } = useSettingsStore()
const route = useRoute()
const router = useRouter()

const menus: { key: Group; icon: Component }[] = [
  { key: 'general', icon: Setting },
  { key: 'appearance', icon: Moon },
  { key: 'dsh', icon: Cpu },
  { key: 'about', icon: InfoFilled }
]

/** 由当前子路由决定高亮分组。 */
const activeGroup = computed<Group>(() => {
  const n = route.name
  return typeof n === 'string' && n.startsWith('settings-') ? (n.slice(9) as Group) : 'general'
})

function go(g: Group): void {
  void router.push(`/settings/${g}`)
}

const loading = ref(false)

// 进入设置时把磁盘设置填进 store（store 的 watch 会随之应用主题/语言）。
onMounted(async () => {
  loading.value = true
  try {
    const s = await window.api.getSettings()
    actions.fillFrom(s)
  } finally {
    loading.value = false
  }
  await actions.loadVersion()
  void actions.loadVersions()
})
</script>

<template>
  <div class="settings">
    <aside class="side">
      <div class="side__cap">{{ $t('sv.cap') }}</div>
      <nav class="nav">
        <button
          v-for="m in menus"
          :key="m.key"
          type="button"
          class="nav__item"
          :class="{ on: activeGroup === m.key }"
          @click="go(m.key)"
        >
          <el-icon :size="18"><component :is="m.icon" /></el-icon>
          <span class="nav__label">{{ $t('sv.nav.' + m.key) }}</span>
        </button>
      </nav>
    </aside>

    <div class="main">
      <div v-loading="loading" class="main__scroll">
        <div class="cols">
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 设置页样式：统一用 .settings 前缀，使其同时作用于嵌套子路由渲染的内容。 */
.settings {
  display: flex;
  height: 100%;
}
.settings .side {
  flex: 0 0 218px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 10px;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  overflow-y: auto;
}
.settings .side__cap {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 0 10px 8px;
  letter-spacing: 1px;
}
.settings .nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.settings .nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.settings .nav__item:hover {
  background: var(--el-fill-color);
}
.settings .nav__item.on {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.settings .nav__label {
  line-height: 1.3;
}
.settings .main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.settings .main__scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 20px 22px;
  min-height: 0;
}
.settings .cols {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
.settings .sec {
  margin-bottom: 14px;
  border-radius: 10px;
}
.settings .sec__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.settings .row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.settings .num {
  width: 160px;
}
.settings .hint {
  width: 100%;
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
.settings .behav__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* DeepSeek Harness brand + version header */
.settings .dsh-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 4px 18px;
}
.settings .dsh-brand__icon {
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.settings .dsh-brand__name {
  font-size: 20px;
  font-weight: 700;
}
.settings .dsh-brand__ver {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.settings .dsh-brand__ver code {
  font-family: var(--el-font-family-mono);
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 6px;
}
.settings .ver-tag {
  font-variant-numeric: tabular-nums;
}
.settings .env-badge {
  margin-left: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 1px 8px;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}

/* 内核页：应用（重启）区块 */
.settings .apply-sec {
  margin-top: 4px;
}
.settings .apply-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.settings .apply__txt {
  flex: 1 1 auto;
  min-width: 260px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

/* 更新 group */
.settings .kopt {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.settings .au {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.settings .au__txt {
  flex: 1 1 auto;
}
.settings .au__t {
  font-weight: 600;
  margin-bottom: 4px;
}
.settings .au__desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
.settings .upd-sep {
  height: 1px;
  background: var(--el-border-color-lighter);
  margin: 18px 0 16px;
}
.settings .dsh-update {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.settings .dsh-update__text {
  flex: 1 1 auto;
  min-width: 240px;
}
.settings .dsh-update__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 4px;
}
.settings .dsh-update__desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
.settings .dsh-update__desc code {
  font-family: var(--el-font-family-mono);
  background: var(--el-fill-color-light);
  padding: 0 4px;
  border-radius: 4px;
}
.settings .dsh-update__actions {
  flex: 0 0 auto;
  display: flex;
  gap: 8px;
  align-items: center;
}
.settings .au-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.settings .au-note {
  margin: 8px 0 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.settings .vm-reg {
  width: 100%;
}
.settings .vm-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
}
.settings .vm-sel {
  flex: 1 1 auto;
  min-width: 0;
}
.settings .vm-un {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.settings .vm-un__txt {
  flex: 1 1 auto;
  min-width: 240px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
.settings .vm-un__txt code {
  font-family: var(--el-font-family-mono);
  background: var(--el-fill-color-light);
  padding: 0 4px;
  border-radius: 4px;
}

/* 常规页：恢复默认 */
.settings .reset-sec {
  margin-top: 4px;
}

/* 关于页：更新检查结果 */
.settings .about-result {
  margin-top: 18px;
}
.settings .about-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.settings .about-arrow {
  color: var(--el-text-color-secondary);
}
.settings .reset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.settings .reset__txt {
  flex: 1 1 auto;
  min-width: 260px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}
</style>
