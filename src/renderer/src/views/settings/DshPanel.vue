<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ClusterOutlined, FolderOutlined, SendOutlined, ReloadOutlined } from '@antdv-next/icons'
import { kernelCheck } from '../../lib/update'
import { useSettingsStore } from './useSettingsStore'

const { state, actions } = useSettingsStore()

const open = ref(['dsh-startup', 'dsh-update'])

onMounted(() => {
  void actions.refreshRunning()
})
</script>

<template>
  <div class="panel">
    <div class="dsh-brand">
      <div class="dsh-brand__icon"><el-icon :size="40"><ClusterOutlined /></el-icon></div>
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

    <el-collapse v-model="open">
      <el-collapse-item name="dsh-startup">
        <template #title>
          <div class="sec__title"><el-icon><ClusterOutlined /></el-icon> {{ $t('sv.dsh.startup') }}</div>
        </template>
        <el-form label-position="top">
          <el-form-item :label="$t('sv.dsh.timeout')">
            <el-input-number v-model="state.timeoutMs" :min="5000" :step="5000" />
            <div class="hint">{{ $t('sv.dsh.timeoutHint') }}</div>
          </el-form-item>

          <el-form-item :label="$t('sv.dsh.kernelSource')">
            <el-select v-model="state.kernelSource" class="dd">
              <el-option :value="'local'" :label="$t('sv.dsh.kernelLocal')" />
              <el-option :value="'global'" :label="$t('sv.dsh.kernelGlobal')" />
            </el-select>
            <div class="hint">{{ state.kernelSource === 'local' ? $t('sv.dsh.kernelLocalHint') : $t('sv.dsh.kernelGlobalHint') }}</div>
          </el-form-item>

          <!-- 启动器路径：仅全局模式，用文件选择器选择 -->
          <el-form-item v-if="state.kernelSource === 'global'" :label="$t('sv.dsh.launcherPath')">
            <div class="row">
              <el-input v-model="state.dshBin" readonly :placeholder="$t('sv.dsh.launcherPlaceholder')" />
              <el-button :icon="FolderOutlined" @click="actions.browseDshBin()">{{ $t('sv.dsh.browseLauncher') }}</el-button>
            </div>
            <div class="hint">{{ $t('sv.dsh.launcherHint') }}</div>
          </el-form-item>
        </el-form>

        <!-- 启动 / 停止 / 重启 · 立即应用 -->
        <div class="ctl-row" style="display: flex; align-items: center; gap: 10px; margin-top: 4px">
          <el-tag :type="state.dshRunning ? 'success' : 'info'" size="small" effect="plain">
            {{ state.dshRunning ? $t('sv.dsh.running') : $t('sv.dsh.stopped') }}
          </el-tag>
          <el-button-group>
            <el-button size="small" type="primary" :disabled="state.dshRunning" @click="actions.startDsh()">{{ $t('sv.dsh.start') }}</el-button>
            <el-button size="small" :disabled="!state.dshRunning" @click="actions.stopDsh()">{{ $t('sv.dsh.stop') }}</el-button>
            <el-button size="small" @click="actions.restartDsh()">{{ $t('sv.dsh.restart') }}</el-button>
          </el-button-group>
          <el-button type="primary" style="margin-left: auto" :loading="state.applying" @click="actions.apply()">
            {{ $t('sv.dsh.applyBtn') }}
          </el-button>
        </div>
      </el-collapse-item>

      <el-collapse-item name="dsh-update">
        <template #title>
          <div class="sec__title"><el-icon><ReloadOutlined /></el-icon> {{ $t('sv.dsh.kernelUpdate') }}</div>
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
            <div class="dsh-update__title"><el-icon><ReloadOutlined /></el-icon> {{ $t('sv.dsh.checkUpdateTitle') }}</div>
            <div class="dsh-update__desc">{{ $t('sv.dsh.checkUpdateDesc', { pkg: '@deepseek-ai/dsh' }) }}</div>
          </div>
          <div class="dsh-update__actions">
            <el-button :icon="ReloadOutlined" :loading="state.updating" :disabled="state.updating || state.updatingKernel" @click="actions.runUpdateCheck()">
              {{ $t('sv.dsh.check') }}
            </el-button>
            <el-button type="primary" :icon="SendOutlined" :loading="state.updatingKernel" :disabled="state.updatingKernel || state.updating || !kernelCheck.found" @click="actions.runUpdateKernel()">
              {{ $t('sv.dsh.update') }}
            </el-button>
          </div>
        </div>

        <!-- 检查结果回显：发现新版本由标题栏的 tag 表示；「已是最新」不再弹 toast，改在这里说明 -->
        <div v-if="kernelCheck.checked && !kernelCheck.found" class="au-note">
          <el-tag size="small" type="success" effect="plain">{{ $t('update.okTitle') }}</el-tag>
          <span v-if="kernelCheck.current" class="ver-tag">&nbsp;&nbsp;{{ kernelCheck.current }}</span>
        </div>

        <div class="upd-sep" />
        <el-form label-position="top" class="vm-in">
          <el-form-item :label="$t('sv.dsh.selectVersion')">
            <div class="vm-row">
              <el-select v-model="state.selectedVersion" filterable :placeholder="$t('sv.dsh.selectPlaceholder')" class="vm-sel" :disabled="state.versionsLoading || state.switchingKernel">
                <el-option v-for="v in state.versions" :key="v" :label="actions.versionLabel(v)" :value="v" />
              </el-select>
              <el-button :icon="ReloadOutlined" :loading="state.versionsLoading" @click="actions.loadVersions()">{{ $t('sv.dsh.refresh') }}</el-button>
              <el-button type="primary" :icon="SendOutlined" :loading="state.switchingKernel" :disabled="state.switchingKernel || state.versionsLoading || !state.selectedVersion || state.selectedVersion === state.version" @click="actions.switchVersion()">
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
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
