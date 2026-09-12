/**
 * 窗口外框（chrome）几何常量。
 *
 * 主进程创建窗口、渲染层绘制标题栏 / 状态栏都依赖它们：集中在这里，避免 52 / 24
 * 这类数字在两个进程里各写一份、改一处漏一处。
 */

/** 顶部自绘标题栏高度（px）。 */
export const TITLEBAR_HEIGHT = 52

/** 底部状态栏高度（px，含 1px 上边框）。 */
export const STATUSBAR_HEIGHT = 24

/** 默认窗口内容区宽度（px）。 */
export const CONTENT_WIDTH = 1280

/** 默认窗口内容区高度（px）；与 `CONTENT_WIDTH` 一起构成 16:9。 */
export const CONTENT_HEIGHT = 720
