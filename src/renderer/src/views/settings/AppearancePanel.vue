<script setup lang="ts">
import { ref } from 'vue'
import { Moon } from '@element-plus/icons-vue'
import { i18n, setLocale } from '../../locales'
import { useSettingsStore } from './useSettingsStore'
import type { ResolvedLocale } from '@shared/types'

const { state } = useSettingsStore()

// 界面语言单一来源是 dsh settings.yaml 的 locale.preference（zh/en）。
const lang = ref<ResolvedLocale>(i18n.global.locale.value as ResolvedLocale)

function onLangChange(v: string | number | boolean): void {
  const s = String(v)
  if (s === 'zh-CN' || s === 'en-US') void chooseLang(s)
}

async function chooseLang(l: ResolvedLocale): Promise<void> {
  if (lang.value === l) return
  lang.value = l
  setLocale(l)
  try {
    await window.api.setUiLocale(l)
  } catch {
    /* 忽略写盘失败，界面仍即时切换 */
  }
}
</script>

<template>
  <div class="panel">
    <el-card shadow="never" class="sec">
      <template #header>
        <div class="sec__title"><el-icon><Moon /></el-icon> {{ $t('sv.appearance.title') }}</div>
      </template>
      <el-form label-position="top">
        <el-form-item :label="$t('sv.appearance.theme')">
          <el-radio-group v-model="state.theme">
            <el-radio-button :value="'system'">{{ $t('sv.appearance.themeSystem') }}</el-radio-button>
            <el-radio-button :value="'light'">{{ $t('sv.appearance.themeLight') }}</el-radio-button>
            <el-radio-button :value="'dark'">{{ $t('sv.appearance.themeDark') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('settings.language')">
          <el-radio-group :model-value="lang" @update:model-value="onLangChange">
            <el-radio-button :value="'zh-CN'">{{ $t('settings.locale.zh') }}</el-radio-button>
            <el-radio-button :value="'en-US'">{{ $t('settings.locale.en') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <div class="hint">{{ $t('sv.appearance.radiusHint') }}</div>
    </el-card>
  </div>
</template>
