<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Brush, Moon } from '@element-plus/icons-vue'
import { i18n, setLocale, applyFunToZh } from '../../locales'
import { useSettingsStore } from './useSettingsStore'
import type { FunLocale, ResolvedLocale } from '@shared/types'

const { state } = useSettingsStore()

const open = ref(['appearance-main'])
const ZOOMS = [50, 75, 100, 125, 150, 175, 200]

// 界面语言单一来源是 dsh settings.yaml 的 locale.preference（zh/en）。
const lang = ref<ResolvedLocale>(i18n.global.locale.value as ResolvedLocale)
const isZh = computed(() => lang.value === 'zh')

// 当前语言的扩展翻译变体（off + 该语言变体）
const FUN_ZH: FunLocale[] = ['off', 'anime', 'wenyan', 'hant']
const FUN_EN: FunLocale[] = ['off', 'pirate', 'shakespeare']
const funList = computed<FunLocale[]>(() => (isZh.value ? FUN_ZH : FUN_EN))
const funCurrent = computed<FunLocale>(() => (funList.value.includes(state.funLocale) ? state.funLocale : 'off'))

// 选项文案固定（不随当前界面语言变化）
const ZH_LABEL: Record<string, string> = { off: '简体中文', anime: '二次元', wenyan: '文言', hant: '繁体中文' }
const EN_LABEL: Record<string, string> = { off: 'English', pirate: 'Pirate', shakespeare: 'Shakespearean' }
const langOptions = computed(() => [
  { value: 'zh', label: '中文', children: FUN_ZH.map((e) => ({ value: e, label: ZH_LABEL[e] })) },
  { value: 'en', label: 'English', children: FUN_EN.map((e) => ({ value: e, label: EN_LABEL[e] })) }
])
const langCascader = computed<[string, string]>(() => [lang.value, funCurrent.value])
function onLangCascader(path: (string | number)[]): void {
  const [loc, ext] = path.map(String)
  if (loc === 'zh' || loc === 'en') void chooseLang(loc as ResolvedLocale)
  if (ext) state.funLocale = ext as FunLocale
}

async function chooseLang(l: ResolvedLocale): Promise<void> {
  if (lang.value === l) return
  lang.value = l
  setLocale(l)
  // 娱乐翻译只对 zh 生效：语言变了按当前娱乐风格重建 zh 文案。
  applyFunToZh(state.funLocale)
  try {
    await window.api.setUiLocale(l)
  } catch {
    /* 忽略写盘失败，界面仍即时切换 */
  }
}

// 娱乐翻译风格变化即时应用到 zh 文案。
watch(() => state.funLocale, (v) => applyFunToZh(v))

const tt = (key: string): string => i18n.global.t(key)

// 禁用系统缩放需重启生效：确认→保存并重启；取消→不做任何修改（回退）。
async function onSysScale(v: boolean): Promise<void> {
  if (v === state.ignoreSystemScale) return
  try {
    await ElMessageBox.confirm(tt('sv.appearance.sysScaleText'), tt('sv.appearance.ignoreScale'), {
      confirmButtonText: tt('sv.appearance.restartNow'),
      cancelButtonText: tt('msg.cancelBtn'),
      type: 'warning'
    })
  } catch {
    return // 取消：回退修改（状态未变更）
  }
  state.ignoreSystemScale = v
  try {
    const cur = await window.api.getSettings()
    await window.api.saveSettings({ ...cur, ignoreSystemScale: v })
  } catch {
    /* ignore */
  }
  window.api.relaunch()
}
</script>

<template>
  <div class="panel">
    <div class="dsh-brand">
      <div class="dsh-brand__icon"><el-icon :size="34"><Brush /></el-icon></div>
      <div class="dsh-brand__txt">
        <div class="dsh-brand__name">{{ $t('sv.nav.appearance') }}</div>
        <div class="dsh-brand__desc">{{ $t('sv.intro.appearance') }}</div>
      </div>
    </div>
    <el-collapse v-model="open">
      <el-collapse-item name="appearance-main">
        <template #title>
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

          <el-form-item :label="$t('sv.appearance.zoom')">
            <el-select v-model="state.zoomPercent" class="zoom-sel">
              <el-option v-for="z in ZOOMS" :key="z" :label="z + '%'" :value="z" />
            </el-select>
            <div class="hint">{{ $t('sv.appearance.zoomHint') }}</div>
          </el-form-item>

          <el-form-item :label="$t('sv.appearance.ignoreScale')">
            <el-switch :model-value="state.ignoreSystemScale" @update:model-value="onSysScale" />
            <div class="hint">{{ $t('sv.appearance.ignoreScaleHint') }}</div>
          </el-form-item>

          <el-form-item :label="$t('sv.appearance.language')">
            <el-cascader
              :options="langOptions"
              :model-value="langCascader"
              class="lang-casc"
              :placeholder="$t('sv.appearance.language')"
              @change="onLangCascader"
            />
            <div class="hint">{{ $t('sv.appearance.funHint') }}</div>
          </el-form-item>
        </el-form>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.zoom-sel {
  width: 220px;
}
.lang-casc {
  width: 100%;
}
</style>
