<script setup lang="ts">
import { Folder, Refresh, SwitchButton, Setting } from '@element-plus/icons-vue'
import { useSettingsStore } from './useSettingsStore'

const { state, actions } = useSettingsStore()
</script>

<template>
  <div class="panel">
    <el-card shadow="never" class="sec">
      <template #header>
        <div class="sec__title"><el-icon><Setting /></el-icon> {{ $t('sv.general.run') }}</div>
      </template>
      <el-form label-position="top">
        <el-form-item :label="$t('sv.general.workspace')">
          <div class="row">
            <el-input v-model="state.workspace" :readonly="true" :placeholder="$t('sv.general.workspacePlaceholder')" />
            <el-button type="primary" :icon="Folder" @click="actions.browseWorkspace()">{{ $t('sv.general.browse') }}</el-button>
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
    </el-card>

    <el-card shadow="never" class="sec">
      <template #header>
        <div class="sec__title"><el-icon><SwitchButton /></el-icon> {{ $t('sv.general.closeBehavior') }}</div>
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
    </el-card>

    <el-card shadow="never" class="sec reset-sec">
      <template #header>
        <div class="sec__title"><el-icon><Refresh /></el-icon> {{ $t('sv.general.reset') }}</div>
      </template>
      <div class="reset-row">
        <div class="reset__txt">{{ $t('sv.general.resetTxt') }}</div>
        <el-button plain type="danger" @click="actions.resetAll()">{{ $t('sv.general.resetBtn') }}</el-button>
      </div>
    </el-card>
  </div>
</template>
