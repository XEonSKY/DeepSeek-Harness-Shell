/**
 * 主进程共用的品牌常量。
 *
 * `APP_TITLE` 用于窗口标题（核心窗口恒为软件名；副窗口为「<标签页标题> - 软件名」）。
 * 之前 `ui.ts` 与 `ipc.ts` 各定义了一份字面量，改一处漏一处，故收敛到此处。
 */
export const APP_TITLE = 'DeepSeek Harness'
