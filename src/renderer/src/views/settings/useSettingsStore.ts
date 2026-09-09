import { reactive, watch } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { AppUpdateResult, Settings, Theme } from '@shared/types'
import { applyTheme } from '../../theme'
import { appState } from '../../state'
import { i18n } from '../../locales'
import { kernelCheck, checkAndNotify } from '../../update'
import { payloadFrom, type SettingsState, type SettingsActions } from './settingsStore'

/** 取当前语言的翻译（模块内非组件环境）。 */
function tt(key: string, named?: Record<string, unknown>): string {
  return named ? i18n.global.t(key, named) : i18n.global.t(key)
}

/**
 * 设置页数据与动作（Pinia setup store）。
 * 状态集中在 `state`(reactive)，操作集中在 `actions`；watchers 在 store 内建立，
 * 外部自动同步订阅与防抖清理通过返回的 `dispose()` 在卸载时释放。
 */
export const useSettingsStore = defineStore('settings', () => {
  const state = reactive<SettingsState>({
    workspace: '',
    portMode: 'auto',
    manualPort: 3080,
    dshBin: '',
    timeoutMs: DEFAULT_SETTINGS.timeoutMs,
    closeMode: 'tray',
    askEveryClose: true,
    theme: DEFAULT_SETTINGS.theme,
    autoCheckUpdate: DEFAULT_SETTINGS.autoCheckUpdate,
    autoCheckPrerelease: DEFAULT_SETTINGS.checkPrerelease,
    npmRegistry: DEFAULT_SETTINGS.npmRegistry,
    appAutoUpdate: DEFAULT_SETTINGS.appAutoUpdate,
    appCheckPrerelease: DEFAULT_SETTINGS.appCheckPrerelease,
    devMode: DEFAULT_SETTINGS.devMode,
    kernelSource: DEFAULT_SETTINGS.kernelSource,
    nodeRuntime: DEFAULT_SETTINGS.nodeRuntime,
    npmSource: DEFAULT_SETTINGS.npmSource,
    proxyEnabled: DEFAULT_SETTINGS.proxyEnabled,
    proxyProtocol: DEFAULT_SETTINGS.proxyProtocol,
    proxyHost: DEFAULT_SETTINGS.proxyHost,
    proxyPort: DEFAULT_SETTINGS.proxyPort,
    proxyScope: [...DEFAULT_SETTINGS.proxyScope],
    zoomPercent: DEFAULT_SETTINGS.zoomPercent,
    ignoreSystemScale: DEFAULT_SETTINGS.ignoreSystemScale,
    funLocale: DEFAULT_SETTINGS.funLocale,
    dshRunning: false,
    applying: false,
    updating: false,
    updatingKernel: false,
    version: null,
    versions: [],
    versionsLoading: false,
    switchingKernel: false,
    uninstalling: false,
    selectedVersion: '',
    appChecking: false,
    appCheckResult: null,
    appOpenUrl: '',
    appVersion: null
  })

  function fillFrom(s: Settings): void {
    state.workspace = s.workspace ?? ''
    state.dshBin = s.dshBin ?? ''
    state.timeoutMs = s.timeoutMs ?? DEFAULT_SETTINGS.timeoutMs
    state.closeMode = s.closeToTray !== false ? 'tray' : 'quit'
    state.askEveryClose = s.rememberClose === false
    state.theme = s.theme ?? DEFAULT_SETTINGS.theme
    state.autoCheckUpdate = s.autoCheckUpdate !== false
    state.autoCheckPrerelease = s.checkPrerelease === true
    state.npmRegistry = (s.npmRegistry ?? DEFAULT_SETTINGS.npmRegistry) as SettingsState['npmRegistry']
    state.appAutoUpdate = s.appAutoUpdate !== false
    state.appCheckPrerelease = s.appCheckPrerelease === true
    state.devMode = s.devMode === true
    state.kernelSource = s.kernelSource ?? DEFAULT_SETTINGS.kernelSource
    state.nodeRuntime = s.nodeRuntime ?? DEFAULT_SETTINGS.nodeRuntime
    state.npmSource = s.npmSource ?? DEFAULT_SETTINGS.npmSource
    state.proxyEnabled = s.proxyEnabled === true
    state.proxyProtocol = s.proxyProtocol ?? DEFAULT_SETTINGS.proxyProtocol
    state.proxyHost = s.proxyHost ?? DEFAULT_SETTINGS.proxyHost
    state.proxyPort = s.proxyPort ?? DEFAULT_SETTINGS.proxyPort
    state.proxyScope = Array.isArray(s.proxyScope) ? [...s.proxyScope] : [...DEFAULT_SETTINGS.proxyScope]
    state.zoomPercent = s.zoomPercent ?? DEFAULT_SETTINGS.zoomPercent
    state.ignoreSystemScale = s.ignoreSystemScale === true
    state.funLocale = s.funLocale ?? DEFAULT_SETTINGS.funLocale
    appState.workspace = s.workspace
    if (typeof s.port === 'number' && s.port > 0) {
      state.portMode = 'manual'
      state.manualPort = s.port
    } else {
      state.portMode = 'auto'
    }
  }

  // ---- Auto-save: edits persist to disk (debounced), no dsh restart. ---------
  let debounce: number | undefined
  async function persist(): Promise<void> {
    try {
      await window.api.saveSettings(payloadFrom(state))
    } catch (err) {
      ElMessage.error(tt('msg.saveFail', { err: err instanceof Error ? err.message : String(err) }))
    }
  }
  function scheduleSave(): void {
    if (debounce) window.clearTimeout(debounce)
    debounce = window.setTimeout(() => void persist(), 500)
  }

  async function loadVersion(): Promise<void> {
    try {
      state.version = await window.api.getDshVersion()
    } catch {
      state.version = null
    }
  }

  async function browseWorkspace(): Promise<void> {
    const p = await window.api.openDirectory()
    if (p) {
      state.workspace = p
      appState.workspace = p
    }
  }

  /** 全局模式下选择 dsh 启动器文件（dshBin）。 */
  async function browseDshBin(): Promise<void> {
    const p = await window.api.openFile()
    if (p) state.dshBin = p
  }

  /** 刷新 dsh 运行状态。 */
  async function refreshRunning(): Promise<void> {
    try {
      state.dshRunning = await window.api.isDshRunning()
    } catch {
      state.dshRunning = false
    }
  }

  /** 启动 dsh（未运行时拉起来）。 */
  async function startDsh(): Promise<void> {
    try {
      await window.api.startDsh()
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      await refreshRunning()
    }
  }

  /** 停止 dsh。 */
  async function stopDsh(): Promise<void> {
    try {
      await window.api.stopDsh()
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      await refreshRunning()
    }
  }

  /** 用当前配置重启 dsh。 */
  async function restartDsh(): Promise<void> {
    try {
      await window.api.restartDsh()
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      await refreshRunning()
    }
  }

  async function apply(): Promise<void> {
    state.applying = true
    try {
      if (debounce) {
        window.clearTimeout(debounce)
        debounce = undefined
      }
      await window.api.saveSettings(payloadFrom(state))
      await window.api.applySettings()
      ElMessage.success(tt('msg.applyOk'))
    } catch (err) {
      ElMessage.error(tt('msg.applyFail', { err: err instanceof Error ? err.message : String(err) }))
    } finally {
      state.applying = false
    }
  }

  async function resetAll(): Promise<void> {
    try {
      const d = await window.api.resetSettings()
      fillFrom(d)
      applyTheme(d.theme)
      appState.workspace = d.workspace
      await window.api.applySettings()
      ElMessage.success(tt('msg.resetOk'))
    } catch (err) {
      ElMessage.error(tt('msg.resetFail', { err: err instanceof Error ? err.message : String(err) }))
    }
  }

  async function loadVersions(): Promise<void> {
    if (state.versionsLoading) return
    state.versionsLoading = true
    try {
      const list = await window.api.listVersions({
        prerelease: state.autoCheckPrerelease,
        registry: state.npmRegistry
      })
      state.versions = list
      if (state.selectedVersion && !list.includes(state.selectedVersion)) state.selectedVersion = ''
    } catch {
      state.versions = []
    } finally {
      state.versionsLoading = false
    }
  }

  function versionLabel(v: string): string {
    return v === state.version ? v + i18n.global.t('sv.dsh.currentSuffix') : v
  }

  /**
   * Kernel-modifying operations (upgrade / version switch) must first stop any
   * running dsh. Only when one is actually running do we confirm before closing
   * it; the main process also force-stops it independently before the npm step.
   * Resolves true when it is safe to proceed (not running, or user confirmed).
   */
  async function confirmStopDshIfRunning(body: string): Promise<boolean> {
    let running = false
    try {
      running = await window.api.isDshRunning()
    } catch {
      running = false
    }
    if (!running) return true
    try {
      await ElMessageBox.confirm(body, tt('msg.dshRunningTitle'), {
        confirmButtonText: tt('msg.continueBtn'),
        cancelButtonText: tt('msg.cancelBtn'),
        type: 'warning'
      })
      return true
    } catch {
      return false // cancelled
    }
  }

  async function runUpdateCheck(): Promise<void> {
    if (state.updating) return
    state.updating = true
    try {
      await checkAndNotify({
        prerelease: state.autoCheckPrerelease,
        registry: state.npmRegistry
      })
    } finally {
      state.updating = false
    }
  }

  async function runUpdateKernel(): Promise<void> {
    if (state.updatingKernel) return
    if (!(await confirmStopDshIfRunning(tt('msg.updateStopText')))) return
    state.updatingKernel = true
    try {
      const r = await window.api.updateKernel({ registry: state.npmRegistry })
      if (r.ok) {
        state.version = r.version
        kernelCheck.found = false
        kernelCheck.latest = null
        ElMessage.success(r.message)
      } else {
        ElMessage.error(r.message || '')
      }
    } catch (err) {
      ElMessage.error(tt('msg.updateKernelFail', { err: err instanceof Error ? err.message : String(err) }))
    } finally {
      state.updatingKernel = false
    }
  }

  async function switchVersion(): Promise<void> {
    const target = state.selectedVersion
    if (!target || state.switchingKernel) return
    if (!(await confirmStopDshIfRunning(tt('msg.switchStopText')))) return
    state.switchingKernel = true
    try {
      const r = await window.api.installKernel({ version: target, registry: state.npmRegistry })
      if (r.ok) {
        state.version = r.version
        kernelCheck.found = false
        kernelCheck.latest = null
        await loadVersions()
        ElMessage.success(r.message)
      } else {
        ElMessage.error(r.message || '')
      }
    } catch (err) {
      ElMessage.error(tt('msg.installFail', { err: err instanceof Error ? err.message : String(err) }))
    } finally {
      state.switchingKernel = false
    }
  }

  async function confirmUninstall(): Promise<void> {
    try {
      await ElMessageBox.confirm(tt('msg.uninstallBoxText', { pkg: '@deepseek-ai/dsh' }), tt('msg.uninstallBoxTitle'), {
        confirmButtonText: tt('msg.uninstallOkBtn'),
        cancelButtonText: tt('msg.cancelBtn'),
        type: 'warning'
      })
    } catch {
      return // cancelled
    }
    state.uninstalling = true
    try {
      const r = await window.api.uninstallKernel()
      if (r.ok) {
        ElMessage.success(tt('msg.uninstallOk'))
      } else {
        ElMessage.error(r.message || tt('msg.uninstallFail', { err: '' }))
      }
    } catch (err) {
      ElMessage.error(tt('msg.uninstallFail', { err: err instanceof Error ? err.message : String(err) }))
    } finally {
      state.uninstalling = false
    }
  }

  async function runAppCheck(): Promise<void> {
    if (state.appChecking) return
    state.appChecking = true
    try {
      const r: AppUpdateResult = await window.api.checkAppUpdate()
      state.appCheckResult = r
      state.appVersion = r.current
      state.appOpenUrl = r.releaseUrl ?? ''
      if (r.status === 'error') {
        ElMessage.warning(r.message || tt('msg.checkFailed'))
      } else if (r.status === 'update') {
        ElMessage.info(r.message || tt('msg.updateAvailable'))
      } else {
        ElMessage.success(r.message || tt('msg.upToDate'))
      }
    } catch {
      ElMessage.error(tt('msg.checkFailed'))
    } finally {
      state.appChecking = false
    }
  }

  function openAppRelease(): void {
    if (state.appOpenUrl) void window.api.openExternal(state.appOpenUrl)
  }

  const actions: SettingsActions = {
    loadVersion,
    browseWorkspace,
    browseDshBin,
    apply,
    resetAll,
    refreshRunning,
    startDsh,
    stopDsh,
    restartDsh,
    loadVersions,
    versionLabel,
    runUpdateCheck,
    runUpdateKernel,
    switchVersion,
    confirmUninstall,
    runAppCheck,
    openAppRelease,
    fillFrom
  }

  // ---- 自动保存 watch：任何影响运行的设置变更都（防抖）落盘。 ----
  watch(
    () => [
      state.workspace,
      state.portMode,
      state.manualPort,
      state.closeMode,
      state.askEveryClose,
      state.theme,
      state.autoCheckUpdate,
      state.autoCheckPrerelease,
      state.npmRegistry,
      state.dshBin,
      state.timeoutMs,
      state.appAutoUpdate,
      state.appCheckPrerelease,
      state.devMode,
      state.kernelSource,
      state.nodeRuntime,
      state.npmSource,
      state.proxyEnabled,
      state.proxyProtocol,
      state.proxyHost,
      state.proxyPort,
      () => state.proxyScope.join(','),
      state.zoomPercent,
      state.ignoreSystemScale,
      state.funLocale
    ],
    scheduleSave
  )
  // 缩放即时生效（写主进程窗口 zoom；webview 缩放由 HomeView 订阅设置同步）。
  watch(() => state.zoomPercent, (v) => void window.api.setWindowZoom(v))
  // 主题即时生效（dsh 自己 watch 同步的 settings.yaml，无需手动刷新）。
  watch(() => state.theme, (t: Theme) => applyTheme(t))
  // 预发布开关/镜像变化时重建版本列表。
  watch([() => state.autoCheckPrerelease, () => state.npmRegistry], () => void loadVersions())

  // ---- 外部配置自动同步：settings.json / dsh 的 settings.yaml 被外部改动。 ----
  const offSettingsChanged = window.api.onSettingsChanged((s) => {
    fillFrom(s)
    appState.workspace = s.workspace
  })
  const offThemeChanged = window.api.onThemeChanged((t) => {
    state.theme = t
    applyTheme(t)
  })

  /** 卸载/重置时释放外部订阅并清理防抖。 */
  function dispose(): void {
    if (debounce) window.clearTimeout(debounce)
    offSettingsChanged()
    offThemeChanged()
  }

  return { state, actions, dispose }
})
