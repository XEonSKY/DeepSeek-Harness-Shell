<script setup lang="ts">
import { Cpu, Promotion, Refresh } from '@element-plus/icons-vue'
import { kernelCheck } from '../../update'
import { useSettingsStore } from './useSettingsStore'

const { state, actions } = useSettingsStore()
</script>

<template>
  <div class="panel">
    <div class="dsh-brand">
      <div class="dsh-brand__icon"><el-icon :size="40"><Cpu /></el-icon></div>
      <div class="dsh-brand__txt">
        <div class="dsh-brand__name">DeepSeek Harness</div>
        <div class="dsh-brand__ver">
          {{ $t('sv.dsh.kernelVersion') }}&nbsp;<code>{{ state.version ? 'v' + state.version : $t('sv.dsh.versionMissing', { pkg: '@deepseek-ai/dsh' }) }}</code>
          <el-tag
            v-if="kernelCheck.found"
            size="small"
            effect="plain"
            round
            class="ver-tag"
            :type="kernelCheck.prerelease ? 'warning' : 'success'"
          >
            {{ kernelCheck.prerelease ? $t('sv.dsh.tagPre') : $t('sv.dsh.tagStable') }}&nbsp;{{ kernelCheck.latest }}
          </el-tag>
        </div>
      </div>
    </div>

    <el-card shadow="never" class="sec">
      <template #header>
        <div class="sec__title"><el-icon><Cpu /></el-icon> {{ $t('sv.dsh.startup') }}</div>
      </template>
      <el-form label-position="top">
        <el-form-item :label="$t('sv.dsh.launcherPath')">
          <el-input v-model="state.dshBin" :placeholder="$t('sv.dsh.launcherPlaceholder')" />
          <div class="hint">{{ $t('sv.dsh.launcherHint') }}</div>
        </el-form-item>
        <el-form-item :label="$t('sv.dsh.timeout')">
          <el-input-number v-model="state.timeoutMs" :min="5000" :step="5000" />
          <div class="hint">{{ $t('sv.dsh.timeoutHint') }}</div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="sec apply-sec">
      <template #header>
        <div class="sec__title"><el-icon><Promotion /></el-icon> {{ $t('sv.dsh.applyTitle') }}</div>
      </template>
      <div class="apply-row">
        <div class="apply__txt">{{ $t('sv.dsh.applyTxt') }}</div>
        <el-button type="primary" :loading="state.applying" @click="actions.apply()">{{ $t('sv.dsh.applyBtn') }}</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="sec">
      <template #header>
        <div class="sec__title"><el-icon><Refresh /></el-icon> {{ $t('sv.dsh.kernelUpdate') }}</div>
      </template>
      <div class="kopt">
        <div class="au">
          <div class="au__txt">
            <div class="au__t">{{ $t('sv.dsh.checkOnStart') }}</div>
            <div class="au__desc">{{ $t('sv.dsh.checkOnStartDesc') }}</div>
          </div>
          <el-switch v-model="state.autoCheckUpdate" />
        </div>

        <div class="au">
          <div class="au__txt">
            <div class="au__t">{{ $t('sv.dsh.checkPrerelease') }}</div>
            <div class="au__desc">{{ $t('sv.dsh.checkPrereleaseDesc') }}</div>
          </div>
          <el-switch v-model="state.autoCheckPrerelease" />
        </div>
      </div>

      <div class="upd-sep" />
      <div class="dsh-update">
        <div class="dsh-update__text">
          <div class="dsh-update__title"><el-icon><Refresh /></el-icon> {{ $t('sv.dsh.checkUpdateTitle') }}</div>
          <div class="dsh-update__desc">{{ $t('sv.dsh.checkUpdateDesc', { pkg: '@deepseek-ai/dsh' }) }}</div>
        </div>
        <div class="dsh-update__actions">
          <el-button :icon="Refresh" :loading="state.updating" :disabled="state.updating || state.updatingKernel" @click="actions.runUpdateCheck()">
            {{ $t('sv.dsh.check') }}
          </el-button>
          <el-button type="primary" :icon="Promotion" :loading="state.updatingKernel" :disabled="state.updatingKernel || state.updating || !kernelCheck.found" @click="actions.runUpdateKernel()">
            {{ $t('sv.dsh.update') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 版本管理 -->
    <el-card shadow="never" class="sec">
      <template #header>
        <div class="sec__title"><el-icon><Cpu /></el-icon> {{ $t('sv.dsh.versionMgmt') }}</div>
      </template>
      <el-form label-position="top">
        <el-form-item :label="$t('sv.dsh.registry')">
          <el-select v-model="state.npmRegistry" class="vm-reg">
            <el-option :label="$t('sv.dsh.registryNpmjs')" value="npmjs" />
            <el-option :label="$t('sv.dsh.registryNpmmirror')" value="npmmirror" />
          </el-select>
          <div class="hint">{{ $t('sv.dsh.registryHint') }}</div>
        </el-form-item>

        <el-form-item :label="$t('sv.dsh.selectVersion')">
          <div class="vm-row">
            <el-select v-model="state.selectedVersion" filterable :placeholder="$t('sv.dsh.selectPlaceholder')" class="vm-sel" :disabled="state.versionsLoading || state.switchingKernel">
              <el-option v-for="v in state.versions" :key="v" :label="actions.versionLabel(v)" :value="v" />
            </el-select>
            <el-button :icon="Refresh" :loading="state.versionsLoading" @click="actions.loadVersions()">{{ $t('sv.dsh.refresh') }}</el-button>
            <el-button type="primary" :icon="Promotion" :loading="state.switchingKernel" :disabled="state.switchingKernel || state.versionsLoading || !state.selectedVersion || state.selectedVersion === state.version" @click="actions.switchVersion()">
              {{ $t('sv.dsh.installVersion') }}
            </el-button>
          </div>
          <div class="hint">{{ $t('sv.dsh.versionListHint') }}</div>
        </el-form-item>
      </el-form>

      <div class="vm-un">
        <div class="vm-un__txt">{{ $t('sv.dsh.uninstallTxt', { pkg: '@deepseek-ai/dsh' }) }}</div>
        <el-button type="danger" plain :loading="state.uninstalling" @click="actions.confirmUninstall()">{{ $t('sv.dsh.uninstall') }}</el-button>
      </div>
    </el-card>
  </div>
</template>
