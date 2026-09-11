<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ClusterOutlined, FolderOutlined, SendOutlined, ReloadOutlined } from '@antdv-next/icons'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { InstalledVersions } from '@shared/types'
import { kernelCheck } from '../../lib/update'
import { tt } from '../../lib/locales'
import { useSettingsStore } from './useSettingsStore'

const { state, actions } = useSettingsStore()

const open = ref(['dsh-startup', 'dsh-update'])

/** 本地内核实例的已安装 / 生效版本（全局来源下通常为空）。 */
const installed = ref<InstalledVersions>({ installed: [], active: null })
const installedLoading = ref(false)
/** 正在切换的已安装版本（按钮 loading；空串表示没有）。 */
const switchingInstalled = ref('')
/** 取消按钮的进行中状态。 */
const canceling = ref(false)

/** 内核版本号不带 v 前缀，展示时统一补上。 */
function withV(v: string | null | undefined): string {
    if (!v) return '—'
    return v.startsWith('v') ? v : 'v' + v
}

async function loadInstalled(): Promise<void> {
    if (installedLoading.value) return
    installedLoading.value = true
    try {
        installed.value = await window.api.listInstalledVersions('kernel')
    } catch {
        installed.value = { installed: [], active: null }
    } finally {
        installedLoading.value = false
    }
}

/** 取消正在进行的安装 / 更新 / 切换。 */
async function cancelInstall(): Promise<void> {
    if (canceling.value) return
    canceling.value = true
    try {
        await window.api.cancelInstall()
    } catch {
        /* 取消失败无需打扰用户 */
    } finally {
        canceling.value = false
    }
}

/** 更新内核，完成后刷新已安装列表。 */
async function updateKernel(): Promise<void> {
    await actions.runUpdateKernel()
    await loadInstalled()
}

/** 安装所选版本（已安装时 actions 内部只切指针），完成后刷新列表。 */
async function switchSelected(): Promise<void> {
    await actions.switchVersion()
    await loadInstalled()
}

/** 行内切换已安装版本：只改生效指针、不重装。 */
async function useInstalled(version: string): Promise<void> {
    if (switchingInstalled.value) return
    switchingInstalled.value = version
    try {
        const r = await window.api.useInstalledVersion('kernel', version)
        if (r.ok) {
            state.version = r.version
            ElMessage.success(tt('sv.env.versionSwitched', { version: withV(r.version) }))
        } else {
            ElMessage.error(r.message || '')
        }
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
        switchingInstalled.value = ''
        await loadInstalled()
    }
}

/** 删除已安装版本；删除前确认，删除生效版本时主进程会自动切到剩余最新版。 */
async function removeInstalled(version: string): Promise<void> {
    try {
        await ElMessageBox.confirm(tt('sv.env.removeVersionConfirm', { version: withV(version) }), tt('sv.env.removeVersion'), {
            confirmButtonText: tt('sv.env.removeVersion'),
            cancelButtonText: tt('msg.cancelBtn'),
            type: 'warning'
        })
    } catch {
        return // 用户取消
    }
    try {
        const r = await window.api.removeInstalledVersion('kernel', version)
        if (r.ok) {
            await loadInstalled()
            await actions.loadVersion()
        } else {
            ElMessage.error(r.message || '')
        }
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : String(err))
    }
}

onMounted(() => {
    void actions.refreshRunning()
    void loadInstalled()
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
                        <el-button type="primary" :icon="SendOutlined" :loading="state.updatingKernel" :disabled="state.updatingKernel || state.updating || !kernelCheck.found" @click="updateKernel()">
                            {{ $t('sv.dsh.update') }}
                        </el-button>
                        <el-button v-if="state.updatingKernel" :loading="canceling" @click="cancelInstall()">
                            {{ canceling ? $t('sv.env.canceling') : $t('sv.env.cancelInstall') }}
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
                            <el-button type="primary" :icon="SendOutlined" :loading="state.switchingKernel" :disabled="state.switchingKernel || state.versionsLoading || !state.selectedVersion || state.selectedVersion === state.version" @click="switchSelected()">
                                {{ $t('sv.dsh.installVersion') }}
                            </el-button>
                            <el-button v-if="state.switchingKernel" :loading="canceling" @click="cancelInstall()">
                                {{ canceling ? $t('sv.env.canceling') : $t('sv.env.cancelInstall') }}
                            </el-button>
                        </div>
                        <div class="hint">{{ $t('sv.dsh.versionListHint') }}</div>
                    </el-form-item>
                </el-form>

                <!-- 已安装的本地内核版本：行内切换 / 删除（全局来源下通常为空） -->
                <div class="upd-sep" />
                <div class="iv">
                    <div class="iv__title">{{ $t('sv.env.installedVersions') }}</div>
                    <div v-if="!installed.installed.length" class="hint">{{ $t('sv.env.installedNone') }}</div>
                    <div v-for="v in installed.installed" :key="v" class="iv__row">
                        <code class="iv__ver">{{ withV(v) }}</code>
                        <el-tag v-if="v === installed.active" size="small" type="success" effect="plain">
                            {{ $t('sv.env.activeVersion') }}
                        </el-tag>
                        <el-button v-else size="small" :loading="switchingInstalled === v" @click="useInstalled(v)">
                            {{ $t('sv.env.switchVersion') }}
                        </el-button>
                        <el-button size="small" type="danger" plain @click="removeInstalled(v)">
                            {{ $t('sv.env.removeVersion') }}
                        </el-button>
                    </div>
                </div>

                <div class="vm-un">
                    <div class="vm-un__txt">{{ $t('sv.dsh.uninstallTxt', { pkg: '@deepseek-ai/dsh' }) }}</div>
                    <el-button type="danger" plain :loading="state.uninstalling" @click="actions.confirmUninstall()">{{ $t('sv.dsh.uninstall') }}</el-button>
                </div>
            </el-collapse-item>
        </el-collapse>
    </div>
</template>

<style scoped>
.iv {
  margin-top: 6px;
}
.iv__title {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}
.iv__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.iv__ver {
  font-family: var(--el-font-family-mono);
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  padding: 1px 8px;
  border-radius: 6px;
}
</style>
