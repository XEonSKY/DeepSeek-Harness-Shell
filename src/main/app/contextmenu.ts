import { Menu } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions, WebContents } from 'electron'
import { mt } from './settings'

/**
 * 给一个 webContents 挂上「右键 → 剪切 / 复制 / 粘贴 / 全选」原生菜单。
 *
 * 挂两处：外壳窗口自己的 webContents（设置页输入框、页面里拖选出来的文本），以及每个内嵌
 * `<webview>` 的 guest（DeepSeek UI / 网页对话 / 动态标签里的输入框）。Electron **没有**内建
 * 右键菜单，不挂这个的话右键就是完全没有反应。
 *
 * 三个刻意的做法：
 *  - **没有可操作对象就直接返回**：标题条的标签右键菜单是渲染层自绘的（TitleBar.vue），
 *    在空白处或标签上再弹一个没用的原生菜单会和它叠在一起。
 *  - 动作**显式作用于 `wc`**（`wc.cut()` 等）而不是用 `role`：role 是按「当前聚焦的
 *    webContents」执行的，而内嵌 webview 与宿主窗口同属一个 BrowserWindow，谁被聚焦并不显然；
 *    显式调用没有这个歧义。
 *  - 标签文案走 `mt()`：主进程文案统一放在 shared/locales，zh/en 各一份。
 */
export function attachContextMenu(wc: WebContents, win: BrowserWindow): void {
  wc.on('context-menu', (_event, params) => {
    const editable = params.isEditable
    const hasSelection = (params.selectionText ?? '').trim().length > 0
    if (!editable && !hasSelection) return

    const items: MenuItemConstructorOptions[] = []
    if (editable) {
      items.push({ label: mt('m.menu.cut'), enabled: params.editFlags.canCut, click: () => wc.cut() })
    }
    items.push({
      label: mt('m.menu.copy'),
      enabled: params.editFlags.canCopy || hasSelection,
      click: () => wc.copy()
    })
    if (editable) {
      items.push({ label: mt('m.menu.paste'), enabled: params.editFlags.canPaste, click: () => wc.paste() })
      items.push({ type: 'separator' })
    }
    items.push({
      label: mt('m.menu.selectAll'),
      enabled: params.editFlags.canSelectAll,
      click: () => wc.selectAll()
    })

    Menu.buildFromTemplate(items).popup({ window: win })
  })
}
