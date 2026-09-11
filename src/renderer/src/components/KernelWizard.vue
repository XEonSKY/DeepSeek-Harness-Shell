<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined, FileTextOutlined, DownloadOutlined, ReloadOutlined } from '@antdv-next/icons'
import { ElMessage } from 'element-plus'
import type { EnvProbe, NodeRuntimeKind, NpmSource } from '@shared/types'
import { MIN_KERNEL_NODE_MAJOR, nodeMajor } from '@shared/version'
import { useAppIcon } from '../lib/appIcon'

/**
 * 内核（@deepseek-ai/dsh）缺失时的全屏安装向导。
 *
 * 从 App.vue 抽出：它自带完整状态（四步流程 / 环境探测 / 版本选择 / 安装日志）与独立样式，
 * 与外壳其余部分只通过「是否显示」和「装完了」两点耦合，因此适合作为独立组件。
 * 由父组件用 `v-if="showMissing"` 控制挂载——每次挂载都会重新探测环境并把步骤归零。
 */
const emit = defineEmits<{ done: [] }>()

const { t } = useI18n({ useScope: 'global' })
const appIcon = useAppIcon()

type Reg = 'npmjs' | 'npmmirror'

const installingKernel = ref(false)
const installError = ref('')
const installReg = ref<Reg>('npmjs')

// Optional kernel-version selection on first install: pick a specific published
// version and whether to include pre-releases (the list is re-fetched accordingly).
const installPrerelease = ref(false)
const installVersions = ref<string[]>([])
const versionsLoading = ref(false)
const installVersion = ref('')

// 内核来源(local/global)与 npm(source)：本页选择后、安装前会持久化到设置。
const installSource = ref<'local' | 'global'>('local')
const installNpm = ref<NpmSource>('system')
// 安装过程的实时日志（本页展示，安装结束时保留以便回看）。
const installLog = ref<string[]>([])
// 是否打开全屏安装日志。
const logFullscreen = ref(false)

// ---- 首次安装四步引导 -----------------------------------------------
// 0 镜像源 · 1 Node 环境 · 2 NPM 环境 · 3 DSH 环境
const step = ref(0)
const envProbe = ref<EnvProbe | null>(null)
const probingEnv = ref(false)

/** 系统 Node 是否可用（存在且主版本 ≥ 内核要求，阈值见 shared/version.ts）。 */
const systemNodeOk = computed(() => {
    const v = envProbe.value?.node.version
    if (!envProbe.value?.node.present || !v) return false
    const major = nodeMajor(v)
    return major !== null && major >= MIN_KERNEL_NODE_MAJOR
})

// 所选 Node 运行时（安装时随设置持久化）。
const nodeRuntimeChoice = ref<NodeRuntimeKind>('electron')
const deployingNode = ref(false)
const deployPercent = ref(0)

const runtimeHint = computed(() => {
    const c = nodeRuntimeChoice.value
    if (c === 'system') return t('kernelMissing.node.hintSystem')
    if (c === 'local') return t('kernelMissing.node.hintLocal')
    return t('kernelMissing.node.hintElectron')
})

async function deployOnce(): Promise<boolean> {
    if (deployingNode.value) return false
    deployingNode.value = true
    deployPercent.value = 0
    try {
        const r = await window.api.deployLocalNode()
        if (r.ok) {
            deployPercent.value = 100
            ElMessage.success(r.message)
            return true
        }
        ElMessage.error(r.message)
        return false
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : String(err))
        return false
    } finally {
        deployingNode.value = false
        await probeEnv()
    }
}
const deployNode = (): Promise<void> => deployOnce().then(() => undefined)

async function probeEnv(): Promise<void> {
    probingEnv.value = true
    try {
        envProbe.value = await window.api.probeEnv()
        // 所选 npm 在不可用时回退到内置 npm。
        if (envProbe.value) {
            if (installNpm.value === 'system' && !envProbe.value.npm) installNpm.value = 'bundled'
            else if (installNpm.value === 'localnode' && !envProbe.value.local.present) installNpm.value = 'bundled'
        }
        // 选了系统 Node 但实际不可用（<20 / 缺失）时回退到 Electron。
        if (envProbe.value && nodeRuntimeChoice.value === 'system' && !systemNodeOk.value) {
            nodeRuntimeChoice.value = 'electron'
        }
    } finally {
        probingEnv.value = false
    }
}

// 配置目录选择（第 0 步）：当前有效路径 + 默认路径。
const cfgDir = ref('')
const cfgDefaultDir = ref('')
async function loadConfigDir(): Promise<void> {
    try {
        const info = await window.api.getConfigDir()
        cfgDir.value = info.current
        cfgDefaultDir.value = info.default
    } catch {
    /* ignore */
    }
}
async function pickConfigDir(): Promise<void> {
    const p = await window.api.openDirectory()
    if (!p) return
    cfgDir.value = await window.api.setConfigDir(p)
}
async function resetConfigDir(): Promise<void> {
    cfgDir.value = await window.api.setConfigDir(null)
}
const back = (): void => {
    if (step.value > 0) step.value = step.value - 1
}

/** 把向导当前选择持久化到设置。 */
async function persistWizard(): Promise<boolean> {
    try {
        const cur = await window.api.getSettings()
        await window.api.saveSettings({
            ...cur,
            npmRegistry: installReg.value,
            kernelSource: installSource.value,
            nodeRuntime: nodeRuntimeChoice.value,
            npmSource: installSource.value === 'local' ? installNpm.value : cur.npmSource
        })
        return true
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : String(err))
        return false
    }
}

/** 第 3 步：真正安装内核。 */
async function performInstall(): Promise<boolean> {
    installLog.value = []
    try {
        if (!(await persistWizard())) return false
        const r = await window.api.installKernel({
            version: installVersion.value || null,
            registry: installReg.value
        })
        if (!r.ok) {
            installError.value = r.message
            return false
        }
        return true
    } catch (err) {
        installError.value = err instanceof Error ? err.message : String(err)
        return false
    }
}

/** 执行当前步（持久化 + 该步动作），成功后自动进入下一步 / 完成。 */
async function runCurrentStep(): Promise<void> {
    if (installingKernel.value) return
    installingKernel.value = true
    installError.value = ''
    let ok: boolean
    try {
        if (step.value === 0) {
            ok = await persistWizard()
        } else if (step.value === 1) {
            ok = await persistWizard()
            // 选了本地 Node 但尚未部署 → 自动下载部署（带进度）。
            if (ok && nodeRuntimeChoice.value === 'local' && envProbe.value && !envProbe.value.local.present) {
                ok = await deployOnce()
            }
        } else if (step.value === 2) {
            ok = await persistWizard()
        } else {
            ok = await performInstall()
        }
    } finally {
        installingKernel.value = false
    }
    if (!ok) return
    if (step.value >= 3) {
        emit('done') // 安装完成：主进程会自动启动 dsh，由父组件收起本向导
    } else {
        step.value = step.value + 1
    }
}

async function loadInstallVersions(): Promise<void> {
    if (versionsLoading.value) return
    versionsLoading.value = true
    try {
        const list = await window.api.listVersions({
            prerelease: installPrerelease.value,
            registry: installReg.value
        })
        installVersions.value = list
        // Default to the newest version within the current selection scope.
        if (!list.includes(installVersion.value)) installVersion.value = list[0] ?? ''
    } catch {
        installVersions.value = []
    } finally {
        versionsLoading.value = false
    }
}

// 预发布开关 / 镜像源变化时重建版本列表。
watch([installPrerelease, installReg], () => void loadInstallVersions())

const quitShell = (): void => window.api.quit()

let offLog: (() => void) | null = null
let offDeploy: (() => void) | null = null

onMounted(() => {
    // 安装时把主进程的 stdout/stderr 追加到本页日志。
    offLog = window.api.onLog((entry) => {
        if (!installingKernel.value) return
        const line = (entry.k === 'e' ? '[err] ' : '') + entry.s
        installLog.value.push(line)
        if (installLog.value.length > 500) installLog.value.splice(0, installLog.value.length - 500)
    })
    offDeploy = window.api.onNodeDeployProgress((p) => {
        deployPercent.value = p.percent
    })
    void (async () => {
        const s = await window.api.getSettings()
        installReg.value = s.npmRegistry
        installPrerelease.value = s.checkPrerelease === true
        installSource.value = s.kernelSource ?? 'local'
        installNpm.value = s.npmSource ?? 'system'
        nodeRuntimeChoice.value = s.nodeRuntime ?? 'electron'
        await loadConfigDir()
        await probeEnv()
        await loadInstallVersions()
    })()
})

onBeforeUnmount(() => {
    offLog?.()
    offDeploy?.()
})
</script>

<template>
    <div class="missing-mask">
        <div class="missing-card">
            <div class="missing-icon"><img :src="appIcon" alt="DeepSeek Harness Shell" draggable="false" class="missing-logo" /></div>
            <h2 class="missing-title">{{ $t('kernelMissing.title') }}</h2>
            <p class="missing-desc">{{ $t('kernelMissing.wizIntro', { pkg: '@deepseek-ai/dsh' }) }}</p>

            <el-steps :active="step" align-center finish-status="success" class="wiz-steps">
                <el-step :title="$t('kernelMissing.wiz.source')" />
                <el-step :title="$t('kernelMissing.wiz.node')" />
                <el-step :title="$t('kernelMissing.wiz.npm')" />
                <el-step :title="$t('kernelMissing.wiz.dsh')" />
            </el-steps>

            <div class="wiz-body">
                <!-- 第 0 步：镜像源 + 配置目录 -->
                <div v-if="step === 0" class="wiz-pane">
                    <div class="wiz-field">
                        <label class="wiz-label">{{ $t('kernelMissing.registry') }}</label>
                        <el-select v-model="installReg" class="missing-reg">
                            <el-option :label="$t('kernelMissing.registryNpmjs')" value="npmjs" />
                            <el-option :label="$t('kernelMissing.registryNpmmirror')" value="npmmirror" />
                        </el-select>
                        <div class="wiz-hint">{{ $t('kernelMissing.registryHint') }}</div>
                    </div>

                    <div class="wiz-field">
                        <label class="wiz-label">{{ $t('kernelMissing.configDir') }}</label>
                        <div class="cfg-row">
                            <el-input :model-value="cfgDir" readonly :placeholder="cfgDefaultDir" />
                            <el-button type="primary" @click="pickConfigDir">{{ $t('kernelMissing.choose') }}</el-button>
                            <el-button v-if="cfgDir !== cfgDefaultDir" @click="resetConfigDir">{{ $t('kernelMissing.restoreDefault') }}</el-button>
                        </div>
                        <div class="wiz-hint">{{ $t('kernelMissing.configDirHint') }}</div>
                    </div>
                </div>

                <!-- 第 1 步：Node 环境（三选一） -->
                <div v-else-if="step === 1" class="wiz-pane">
                    <div class="wiz-field">
                        <label class="wiz-label">{{ $t('kernelMissing.node.pick') }}</label>
                        <el-radio-group v-model="nodeRuntimeChoice" class="nr-opts">
                            <el-radio :value="'system'" :disabled="!systemNodeOk">
                                {{ $t('kernelMissing.node.runtimeSystem') }}
                                <span v-if="!envProbe || !envProbe.node.present" class="muted">（{{ $t('kernelMissing.node.notFound') }}）</span>
                                <span v-else-if="!systemNodeOk" class="muted">（{{ $t('kernelMissing.node.need20') }}）</span>
                                <code v-else class="node-ver">{{ envProbe?.node.version }}</code>
                            </el-radio>
                            <el-radio :value="'electron'">
                                {{ $t('kernelMissing.node.runtimeElectron') }}
                                <span class="muted">（{{ $t('kernelMissing.node.rtDefault') }}）</span>
                            </el-radio>
                            <el-radio :value="'local'">{{ $t('kernelMissing.node.runtimeLocal') }}</el-radio>
                        </el-radio-group>
                        <div class="wiz-hint">{{ runtimeHint }}</div>
                    </div>

                    <div v-if="nodeRuntimeChoice === 'local'" class="wiz-field nr-local">
                        <template v-if="envProbe?.local.present">
                            <el-tag type="success" size="small" effect="plain">{{ $t('kernelMissing.node.localReady') }}&nbsp;{{ envProbe.local.version }}</el-tag>
                            <div class="wiz-btn-row">
                                <el-button size="small" :loading="deployingNode" @click="deployNode">{{ $t('kernelMissing.node.redeploy') }}</el-button>
                                <el-button size="small" :icon="ReloadOutlined" :loading="probingEnv" @click="probeEnv">{{ $t('kernelMissing.node.rescan') }}</el-button>
                            </div>
                        </template>
                        <template v-else>
                            <p class="wiz-hint">{{ $t('kernelMissing.node.deployHint') }}</p>
                        </template>

                        <!-- 下载进度 -->
                        <el-progress
                            v-if="deployingNode"
                            :percentage="deployPercent"
                            :status="deployPercent >= 100 ? 'success' : undefined"
                            :stroke-width="8"
                            class="deploy-progress"
                        />
                        <template v-if="!envProbe?.local.present">
                            <div class="wiz-btn-row">
                                <el-button type="primary" :icon="DownloadOutlined" :loading="deployingNode" @click="deployNode">
                                    {{ $t('kernelMissing.node.deploy') }}
                                </el-button>
                                <el-button :icon="ReloadOutlined" :loading="probingEnv" @click="probeEnv">{{ $t('kernelMissing.node.rescan') }}</el-button>
                            </div>
                        </template>
                    </div>

                    <p v-else-if="nodeRuntimeChoice === 'system'" class="wiz-note">
                        {{ $t('kernelMissing.node.systemNote', { ver: envProbe?.node.version || '' }) }}
                    </p>
                </div>

                <!-- 第 2 步：NPM 环境 -->
                <div v-else-if="step === 2" class="wiz-pane">
                    <div class="wiz-field">
                        <label class="wiz-label">{{ $t('kernelMissing.npmSource') }}</label>
                        <el-radio-group v-model="installNpm" class="npm-opts">
                            <el-radio :value="'system'" :disabled="!envProbe?.npm">
                                {{ $t('kernelMissing.npmSystem') }}
                                <span v-if="!envProbe?.npm" class="muted">（{{ $t('kernelMissing.unavailable') }}）</span>
                            </el-radio>
                            <el-radio :value="'bundled'">{{ $t('kernelMissing.npmBundled') }}</el-radio>
                            <el-radio v-if="envProbe?.local.present" :value="'localnode'">{{ $t('kernelMissing.npmLocalNode') }}</el-radio>
                        </el-radio-group>
                        <div class="wiz-hint">{{ $t('kernelMissing.npmHint') }}</div>
                    </div>
                </div>

                <!-- 第 3 步：DSH 环境 -->
                <div v-else class="wiz-pane">
                    <div class="wiz-field">
                        <label class="wiz-label">{{ $t('kernelMissing.kernelSource') }}</label>
                        <el-radio-group v-model="installSource">
                            <el-radio :value="'local'">{{ $t('kernelMissing.kernelLocal') }}</el-radio>
                            <el-radio :value="'global'">{{ $t('kernelMissing.kernelGlobal') }}</el-radio>
                        </el-radio-group>
                    </div>
                    <div class="wiz-field">
                        <div class="missing-opt">
                            <span>{{ $t('kernelMissing.preLabel') }}</span>
                            <el-switch v-model="installPrerelease" />
                        </div>
                    </div>
                    <div class="wiz-field">
                        <label class="wiz-label">{{ $t('kernelMissing.version') }}</label>
                        <div class="missing-vrow">
                            <el-select
                                v-model="installVersion"
                                filterable
                                :loading="versionsLoading"
                                class="missing-reg"
                                :placeholder="$t('kernelMissing.versionPlaceholder')"
                            >
                                <el-option v-for="v in installVersions" :key="v" :value="v" :label="v" />
                            </el-select>
                            <el-button :icon="ReloadOutlined" circle :loading="versionsLoading" @click="loadInstallVersions" />
                        </div>
                        <div class="wiz-hint">{{ $t('kernelMissing.versionHint') }}</div>
                    </div>

                    <p v-if="installError" class="missing-err">{{ installError }}</p>
                </div>
            </div>

            <!-- 每步执行进度条 -->
            <div v-if="installingKernel" class="install-progress">
                <div class="activity">
                    <span class="activity__label">{{ step === 3 ? $t('kernelMissing.progressNpm') : $t('kernelMissing.executing') }}</span>
                    <div class="activity-bar" />
                </div>
                <div v-if="step === 3" class="activity">
                    <span class="activity__label">{{ $t('kernelMissing.progressDsh') }}</span>
                    <div class="activity-bar" />
                </div>
            </div>

            <!-- 底部导航：执行当前步并进入下一步 -->
            <div class="wiz-nav">
                <el-button text :disabled="installingKernel" @click="quitShell">{{ $t('kernelMissing.quit') }}</el-button>
                <div class="wiz-nav__right">
                    <el-button v-if="step > 0" :disabled="installingKernel" @click="back">{{ $t('kernelMissing.prev') }}</el-button>
                    <el-button type="primary" :loading="installingKernel" :icon="ReloadOutlined" @click="runCurrentStep">
                        {{ step < 3 ? $t('kernelMissing.runStep') : $t('kernelMissing.install') }}
                    </el-button>
                </div>
            </div>

            <!-- 右上角：全屏日志开关（向导打开即显示） -->
            <div class="log-toggle">
                <el-button size="small" :icon="FileTextOutlined" @click="logFullscreen = true">{{ $t('kernelMissing.viewLog') }}</el-button>
            </div>

            <!-- 全屏安装日志 -->
            <transition name="fade">
                <div v-if="logFullscreen" class="log-full">
                    <div class="log-full__head">
                        <span class="log-full__title">{{ $t('kernelMissing.installLog') }}</span>
                        <div class="log-full__acts">
                            <div v-if="installingKernel" class="log-full__mini">
                                <div class="activity-bar" />
                            </div>
                            <el-button :icon="CloseOutlined" text @click="logFullscreen = false">{{ $t('kernelMissing.closeLog') }}</el-button>
                        </div>
                    </div>
                    <pre class="log-full__body">{{ installLog.length ? installLog.join('\n') : $t('kernelMissing.logWaiting') }}</pre>
                </div>
            </transition>
        </div>
    </div>
</template>

<style scoped>
.missing-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
}
.missing-card {
  width: 560px;
  max-width: calc(100% - 48px);
  text-align: center;
}
.missing-icon {
  width: 84px;
  height: 84px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.missing-logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
  -webkit-user-drag: none;
}
.missing-title {
  margin: 0 0 10px;
  font-size: 18px;
}
.missing-desc {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
.missing-reg {
  width: 100%;
  margin-bottom: 8px;
}
.missing-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.missing-vrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.missing-vrow .missing-reg {
  flex: 1 1 auto;
  margin-bottom: 0;
}
.missing-err {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-danger);
  word-break: break-all;
}
/* ---- 首次安装引导 ---- */
.wiz-steps {
  margin: 6px 0 18px;
  --el-step-title-font-size: 13px;
}
.wiz-body {
  text-align: left;
  min-height: 170px;
}
.wiz-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wiz-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wiz-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
.wiz-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
.wiz-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  text-align: left;
}
.npm-opts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.nr-opts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.nr-opts .el-radio {
  height: auto;
  white-space: normal;
  margin-right: 0;
}
.nr-local {
  margin-top: 2px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-light);
}
.deploy-progress {
  width: 100%;
}
.muted {
  color: var(--el-text-color-disabled);
  font-size: 12px;
}
.wiz-btn-row {
  display: flex;
  gap: 10px;
}
.wiz-nav {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wiz-nav__right {
  display: flex;
  gap: 10px;
}
.cfg-row {
  display: flex;
  gap: 8px;
}
.cfg-row .el-input {
  flex: 1 1 auto;
}
.node-ver {
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
}
/* ---- 安装进度条（npm / DSH 活动条） ---- */
.install-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.activity {
  display: flex;
  align-items: center;
  gap: 10px;
}
.activity__label {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.activity-bar {
  position: relative;
  flex: 1 1 auto;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--el-fill-color);
}
.activity-bar::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 40%;
  border-radius: 4px;
  background: var(--el-color-primary);
  animation: bar-slide 1.1s ease-in-out infinite;
}
@keyframes bar-slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}
/* ---- 右上角开关 + 全屏日志 ---- */
.log-toggle {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 2001;
}
.log-full {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}
.log-full__head {
  flex: 0 0 auto;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.log-full__title {
  font-weight: 600;
  font-size: 15px;
}
.log-full__acts {
  display: flex;
  align-items: center;
  gap: 16px;
}
.log-full__mini {
  width: 180px;
}
.log-full__body {
  flex: 1 1 auto;
  margin: 0;
  overflow: auto;
  padding: 12px 16px;
  font-family: var(--el-font-family-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--el-text-color-regular);
}
/* ---- 过渡 ---- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
