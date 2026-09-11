import { app, session } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AppMeta, AppUpdateEvent, Settings } from '@shared/types'
import { isPrerelease } from '@shared/version'
import { proxyActive, proxyUrl } from '../kernel/net'
import { broadcast } from './runtime'
import { loadSettings, mt } from './settings'

/**
 * App 自动更新：封装 electron-updater(GitHub provider)。
 * 仅打包成安装包且仓库有对应 Release 时实际可下载；开发/未打包时给出提示。
 * 下载进度等事件经 IPC 广播给渲染层的「关于」页。
 *
 * ⚠️ 发布侧的两个硬前提（否则本模块永远收不到更新）：
 *  1. Release 必须是**已发布**的，不能停在 draft —— electron-updater 走 `/releases/latest`
 *     或 `releases.atom`，两个端点都不返回 draft。已在 `package.json` 的
 *     `build.publish.releaseType` 设为 `"prerelease"`（schema 默认是 `"draft"`）。
 *  2. 预发布线用户必须保持 `allowPrerelease = true`，见 `setPrerelease()`。
 */

let inited = false

/** 最后一次更新事件：关于页可能在事件之后才挂载，靠它补齐状态。 */
let lastEvent: AppUpdateEvent | null = null

/** 向渲染层广播一次自动更新事件，并留存供后挂载的页面查询。 */
function emit(e: AppUpdateEvent): void {
    lastEvent = e
    broadcast('appupdate:event', e)
}

/**
 * 是否为 portable（免安装）版。
 *
 * portable 版没有可被安装器替换的安装目录，而 Release 里的 `latest.yml` 指向的是 NSIS 的
 * `setup.exe`；若不禁用，免安装版会被引导去下载并执行一个安装包，行为不可预期。
 * electron-builder 的 portable 运行时会注入 `PORTABLE_EXECUTABLE_DIR`。
 *
 * 注：本项目已不再构建 portable（`build.win.target` 只留 nsis），此守卫用于兜住
 * 「有人本地 `electron-builder --win portable`」这种情况。
 */
function isPortableBuild(): boolean {
    return !!process.env['PORTABLE_EXECUTABLE_DIR']
}

// ---------------------------------------------------------------------------
// 更新走代理：electron-updater 的专属网络 session
// ---------------------------------------------------------------------------

/**
 * electron-updater 的专属 session 名（见其 ElectronHttpExecutor：`fromPartition('electron-updater')`）。
 * 必须复用同一个名字，才能只给更新器设置代理而不波及 webview 与外壳 UI。
 */
const UPDATER_SESSION = 'electron-updater'

/** 已应用到更新器 session 的代理 URL；null 表示「未显式设置，沿用系统代理」。 */
let appliedProxy: string | null = null

/**
 * 把「更新」范围的代理应用到更新器专属 session。
 *
 * 此前 `proxyScope` 里的 `'update'` 是**空转**的：`proxyActive(cfg, 'update')` 全项目从未被调用，
 * 代理只作用于 npm 子进程。于是配了代理的用户，app 自更新这一步始终直连（在必须走代理的网络里
 * 表现为长时间无响应直到超时）。
 *
 * 两个关键约束：
 *  - 只改 `partition: 'electron-updater'`，**不动 defaultSession**，因此 <webview> 不受影响；
 *  - 未配置代理时**不调用 setProxy**，保留 Electron 默认的「跟随系统代理」——否则会把本来能用的
 *    系统级代理一并关掉。只有从「有」变「无」时才显式回落到 system。
 */
async function applyUpdaterProxy(cfg: Settings): Promise<void> {
    const url = proxyActive(cfg, 'update') ? proxyUrl(cfg) : null
    if (appliedProxy === url) return
    const updaterSession = session.fromPartition(UPDATER_SESSION, { cache: false })
    await updaterSession.setProxy(
        url ? { proxyRules: url, proxyBypassRules: '<local>' } : { mode: 'system' }
    )
    appliedProxy = url
}

// ---------------------------------------------------------------------------
// GitHub 公共镜像：把发布资产的请求重写到镜像前缀
// ---------------------------------------------------------------------------

/** createRequest 收到的请求选项（由 builder-util-runtime 的 configureRequestUrl 填好）。 */
interface ExecRequestOptions {
    protocol?: string
    hostname?: string
    port?: string
    path?: string
}

/** 我们只依赖 httpExecutor 的这一个方法（它是所有 HTTP 的唯一出口）。 */
interface UpdaterExecutor {
    createRequest(options: ExecRequestOptions, callback: (response: unknown) => void): unknown
}

let mirrorPatched = false
/** 当前生效的镜像前缀（不含尾斜杠）；null = 直连官方。 */
let activeMirror: string | null = null

/**
 * 规范化镜像前缀：允许省略协议，去掉尾斜杠。
 * 例：`ghproxy.com` → `https://ghproxy.com`；`https://x.cn/gh/` → `https://x.cn/gh`。
 * 解析失败返回 null（按直连处理，不让一个笔误把更新彻底弄坏）。
 */
function normalizeMirror(raw: string | undefined): string | null {
    const s = (raw ?? '').trim()
    if (!s) return null
    try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
        return (u.origin + u.pathname).replace(/\/+$/, '')
    } catch {
        return null
    }
}

/**
 * 只改写 **GitHub 发布资产** 的请求，形式为 `<mirror>/https://github.com/<owner>/<repo>/releases/download/...`
 * —— 这正是 ghproxy 系公共镜像的约定（镜像把原始绝对 URL 接在自身路径之后）。
 *
 * 刻意**只匹配 `/releases/download/`**：版本元数据必须留在官方 ——
 *  - `/<owner>/<repo>/releases.atom`：`allowPrerelease` 为真时 GitHubProvider 用它解析 tag；
 *  - `/<owner>/<repo>/releases/latest`：**正式版线**用它解析 tag（`getLatestTagName()`），
 *    且是以 `Accept: application/json` 请求后 `JSON.parse` 的 —— 镜像一旦不支持该端点或
 *    把请求重定向成 HTML，检查会直接抛 `ERR_UPDATER_LATEST_VERSION_NOT_FOUND`
 *    （报错文案伪装成「找不到最新版本」），表现为**检测不到正式版**。
 *
 * ⚠️ 旧实现用的是 `/^\/[^/]+\/[^/]+\/releases\//`，它**会命中 `/releases/latest`**，
 * 只有 `releases.atom` 因为「releases 后面少一个斜杠」才侥幸幸免 —— 与本节注释声称的
 * 「元数据始终走官方」不符，已修正。镜像现在只搬运发布资产（安装包与 blockmap）。
 */
function rewriteGithubAsset(options: ExecRequestOptions): void {
    const mirror = activeMirror
    if (!mirror) return
    if (options.hostname !== 'github.com') return
    const path = options.path ?? ''
    if (!/^\/[^/]+\/[^/]+\/releases\/download\//.test(path)) return
    let base: URL
    try {
        base = new URL(mirror)
    } catch {
        return
    }
    options.protocol = base.protocol
    options.hostname = base.hostname
    if (base.port) options.port = base.port
    else delete options.port
    options.path = `${base.pathname.replace(/\/+$/, '')}/https://github.com${path}`
}

/**
 * 就地包装 `autoUpdater.httpExecutor.createRequest`（只做一次）。
 *
 * 为什么是这个点：`HttpExecutor.request()`（元数据 / blockmap）与 `download()`→`doDownload()`
 * （安装包 / 差分区间）**两条路都汇到 `createRequest`**，而 provider 每次检查都会从
 * `autoUpdater.httpExecutor` 取执行器（`createProviderRuntimeOptions()`），所以包装一次即全覆盖。
 *
 * ⚠️ 这依赖 electron-updater 的内部结构。升级该依赖前请复核
 * `electron-updater/out/ElectronHttpExecutor.js` 是否仍以 `createRequest` 作为唯一出口。
 */
function installMirrorRewrite(): void {
    if (mirrorPatched) return
    // 注：electron-updater 的 .d.ts 并未声明 httpExecutor（只在运行时赋值），故从 autoUpdater 整体断言。
    const exec = (autoUpdater as unknown as { httpExecutor?: UpdaterExecutor | null }).httpExecutor
    const orig = exec?.createRequest
    if (!exec || typeof orig !== 'function') return
    const bound = orig.bind(exec)
    exec.createRequest = (options, callback) => {
        rewriteGithubAsset(options)
        return bound(options, callback)
    }
    mirrorPatched = true
}

/** 读取设置并刷新镜像前缀（空串 / 非法值 = 直连）。 */
function applyMirror(cfg: Settings): void {
    installMirrorRewrite()
    activeMirror = normalizeMirror(cfg.updateMirrorUrl)
}

/**
 * 每次检查前刷新更新器环境：专属 session 的代理 + GitHub 资产镜像。
 * 设置可在运行期被改（网络面板），故每次都读一遍而不是只做一次。
 */
async function prepareUpdater(cfg: Settings): Promise<void> {
    await applyUpdaterProxy(cfg)
    applyMirror(cfg)
}

// ---------------------------------------------------------------------------

/** 惰性初始化：注册 electron-updater 事件到广播。 */
function ensureInited(): void {
    if (inited) return
    inited = true
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => emit({ kind: 'checking' }))
    autoUpdater.on('update-available', (info) => emit({ kind: 'available', version: info?.version ?? null }))
    autoUpdater.on('update-not-available', (info) => emit({ kind: 'not-available', version: info?.version ?? null }))
    autoUpdater.on('download-progress', (p) => emit({ kind: 'progress', percent: typeof p?.percent === 'number' ? p.percent : 0 }))
    autoUpdater.on('update-downloaded', (info) => emit({ kind: 'downloaded', version: info?.version ?? null }))
    autoUpdater.on('error', (err) => emit({ kind: 'error', message: err && err.message ? err.message : String(err) }))
}

/**
 * 控制是否采纳预发布版本。
 *
 * **不能**直接用设置里的 `appCheckPrerelease` 覆盖：electron-updater 构造时会按当前版本自动
 * 设置 `allowPrerelease`（AppUpdater：`allowPrerelease = hasPrereleaseComponents(currentVersion)`），
 * 对 `0.1.5-alpha-2` 这类预发布版本本来就是 `true`。若用默认值为 `false` 的设置项强行覆盖，
 * 预发布线用户会被钉死在「只看正式版」，永远收不到同线更新。
 *
 * 这里改为「设置项 OR 当前版本本身是预发布」——即：想跨到正式版可以单独开，但没人会被卡死。
 */
function setPrerelease(on: boolean): void {
    autoUpdater.allowPrerelease = on || isPrerelease(app.getVersion())
}

/** 运行环境元信息（关于页显示当前版本/架构）。 */
export function appMeta(): AppMeta {
    let version: string | null = null
    try {
        version = app.getVersion() || null
    } catch {
    /* not packaged */
    }
    return { version, arch: process.arch, platform: process.platform }
}

/** 最近一次自动更新状态；关于页挂载晚于事件时据此补齐（从未有过事件则为 null）。 */
export function appUpdateState(): AppUpdateEvent | null {
    return lastEvent
}

/** 触发一次检查；有可用更新时 electron-updater 自动进入后台下载。 */
export async function triggerAppUpdate(opts: { prerelease: boolean }): Promise<{ ok: boolean; message: string }> {
    if (!app.isPackaged) return { ok: false, message: mt('m.appUpdate.onlyPackaged') }
    if (isPortableBuild()) return { ok: false, message: mt('m.appUpdate.portable') }
    ensureInited()
    setPrerelease(opts.prerelease)
    try {
        await prepareUpdater(loadSettings())
        await autoUpdater.checkForUpdates()
        return { ok: true, message: '' }
    } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
}

/** 立即重启并安装已下载的更新。 */
export function restartAndInstall(): void {
    if (app.isPackaged && !isPortableBuild()) autoUpdater.quitAndInstall()
}

/** 启动时按设置自动检查一次（静默；失败不打扰）。 */
export function startAutoCheckIfEnabled(): void {
    if (!app.isPackaged || isPortableBuild()) return
    const s = loadSettings()
    if (!s.appAutoUpdate) return
    ensureInited()
    setPrerelease(s.appCheckPrerelease)
    void (async () => {
        try {
            await prepareUpdater(s)
            await autoUpdater.checkForUpdates()
        } catch {
            /* silent */
        }
    })()
}
