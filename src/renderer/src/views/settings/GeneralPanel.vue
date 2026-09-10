<script setup lang="ts">
import { ref } from 'vue'
import { FolderOutlined, ReloadOutlined, PoweroffOutlined, SettingOutlined, DesktopOutlined, PlusOutlined, DeleteOutlined } from '@antdv-next/icons'
import { useSettingsStore } from './useSettingsStore'
import { SEARCH_ENGINE_IDS, ENGINE_LABEL_KEY } from '../../lib/engines'

const { state, actions } = useSettingsStore()

// el-collapse：默认全部展开
const open = ref(['general-run', 'general-close', 'general-newtab', 'general-reset'])

function addShortcut(): void {
  state.shortcuts.push({ title: '', url: '' })
}
function removeShortcut(i: number): void {
  state.shortcuts.splice(i, 1)
}
</script>

<template>
  <div class="panel">
    <div class="dsh-brand">
      <div class="dsh-brand__icon"><el-icon :size="34"><SettingOutlined /></el-icon></div>
      <div class="dsh-brand__txt">
        <div class="dsh-brand__name">{{ $t('sv.nav.general') }}</div>
        <div class="dsh-brand__desc">{{ $t('sv.intro.general') }}</div>
      </div>
    </div>
    <el-collapse v-model="open">
      <el-collapse-item name="general-run" :title="$t('sv.general.run')">
        <template #title>
          <div class="sec__title"><el-icon><SettingOutlined /></el-icon> {{ $t('sv.general.run') }}</div>
        </template>
        <el-form label-position="top">
          <el-form-item :label="$t('sv.general.workspace')">
            <div class="row">
              <el-input v-model="state.workspace" :readonly="true" :placeholder="$t('sv.general.workspacePlaceholder')" />
              <el-button type="primary" :icon="FolderOutlined" @click="actions.browseWorkspace()">{{ $t('sv.general.browse') }}</el-button>
            </div>
            <div class="hint">{{ $t('sv.general.workspaceHint') }}</div>
          </el-form-item>

          <el-form-item :label="$t('sv.general.port')">
            <div class="row">
              <el-radio-group v-model="state.portMode">
                <el-radio-button :value="'auto'">{{ $t('sv.general.portAuto') }}</el-radio-button>
                <el-radio-button :value="'manual'">{{ $t('sv.general.portManual') }}</el-radio-button>
              </el-radio-group>
              <el-input-number v-if="state.portMode === 'manual'" v-model="state.manualPort" :min="1" :max="65535" class="num" />
            </div>
            <div class="hint">{{ $t('sv.general.portHint') }}</div>
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item name="general-close">
        <template #title>
          <div class="sec__title"><el-icon><PoweroffOutlined /></el-icon> {{ $t('sv.general.closeBehavior') }}</div>
        </template>
        <div class="behav">
          <div class="behav__row">
            <el-radio-group v-model="state.closeMode">
              <el-radio-button :value="'tray'">{{ $t('sv.general.closeTray') }}</el-radio-button>
              <el-radio-button :value="'quit'">{{ $t('sv.general.closeQuit') }}</el-radio-button>
            </el-radio-group>
            <el-switch v-model="state.askEveryClose" inline-prompt :active-text="$t('sv.general.askEvery')" :inactive-text="$t('sv.general.rememberChoice')" />
          </div>
          <div class="hint">{{ $t('sv.general.askEveryHint') }}</div>
        </div>
      </el-collapse-item>

      <el-collapse-item name="general-newtab">
        <template #title>
          <div class="sec__title"><el-icon><DesktopOutlined /></el-icon> {{ $t('sv.general.newTabTitle') }} &amp; {{ $t('sv.general.engineLabel') }}</div>
        </template>
        <el-form label-position="top">
          <el-form-item :label="$t('sv.general.engineLabel')">
            <el-select v-model="state.searchEngine" style="width: 100%">
              <el-option v-for="id in SEARCH_ENGINE_IDS" :key="id" :value="id" :label="$t(ENGINE_LABEL_KEY[id])" />
            </el-select>
          </el-form-item>

          <el-form-item :label="$t('sv.general.newTabTitle')">
            <el-radio-group v-model="state.newTabMode">
              <el-radio :value="'builtin'">{{ $t('sv.general.newTabModeBuiltin') }}</el-radio>
              <el-radio :value="'url'">{{ $t('sv.general.newTabModeUrl') }}</el-radio>
            </el-radio-group>
            <el-input
              v-if="state.newTabMode === 'url'"
              v-model="state.newTabUrl"
              :placeholder="$t('sv.general.newTabUrlPlaceholder')"
              style="margin-top: 8px"
            />
          </el-form-item>

          <el-form-item :label="$t('sv.general.shortcuts')">
            <div class="sh-list">
              <div v-for="(sc, i) in state.shortcuts" :key="i" class="sh-row">
                <el-input v-model="sc.title" :placeholder="$t('sv.general.shortcutTitle')" size="small" />
                <el-input v-model="sc.url" :placeholder="$t('sv.general.shortcutUrl')" size="small" />
                <el-button :icon="DeleteOutlined" text size="small" @click="removeShortcut(i)" />
              </div>
            </div>
            <el-button :icon="PlusOutlined" size="small" plain @click="addShortcut">{{ $t('sv.general.shortcutAdd') }}</el-button>
            <div class="hint">{{ $t('sv.general.shortcutHint') }}</div>
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item name="general-reset">
        <template #title>
          <div class="sec__title"><el-icon><ReloadOutlined /></el-icon> {{ $t('sv.general.reset') }}</div>
        </template>
        <div class="reset-row">
          <div class="reset__txt">{{ $t('sv.general.resetTxt') }}</div>
          <el-button plain type="danger" @click="actions.resetAll()">{{ $t('sv.general.resetBtn') }}</el-button>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.sh-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.sh-row {
  display: flex;
  gap: 6px;
  width: 100%;
}
.sh-row .el-input {
  flex: 1 1 auto;
}
</style>
