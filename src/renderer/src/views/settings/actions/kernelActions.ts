import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '../../../lib/locales'
import { kernelCheck, checkAndNotify } from '../../../lib/update'
import type { SettingsState } from '../settingsStore'

/**
 * 内核（@deepseek-ai/dsh）版本管理相关动作：版本列表、更新检查/升级、切换版本、卸载。
 *
 * 从 useSettingsStore 抽出：这组动作自成一体（只依赖 `state` + `window.api` + 提示框），
 * 且都围绕「内核会被替换，替换前必须先停 dsh」这一约束展开，内聚度高。
 */

type KernelActions = {
  loadVersions(): Promise<void>
  versionLabel(v: string): string
  runUpdateCheck(): Promise<void>
  runUpdateKernel(): Promise<void>
  switchVersion(): Promise<void>
  confirmUninstall(): Promise<void>
}

export function createKernelActions(state: SettingsState): KernelActions {
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
    return v === state.version ? v + tt('sv.dsh.currentSuffix') : v
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
        // 装/切换完版本后清掉「检查过」标记：否则「内核」页会拿旧的检查结果继续显示「已是最新」。
        kernelCheck.checked = false
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
        // 装/切换完版本后清掉「检查过」标记：否则「内核」页会拿旧的检查结果继续显示「已是最新」。
        kernelCheck.checked = false
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

  return { loadVersions, versionLabel, runUpdateCheck, runUpdateKernel, switchVersion, confirmUninstall }
}
