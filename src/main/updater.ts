import { app } from 'electron'
import type { AppUpdateResult } from '@shared/types'
import { stripV, compareVersions } from './semver'
import { mt } from './settings'

// ---------------------------------------------------------------------------
// Shell self-update (compare against this repo's GitHub Releases)
// ---------------------------------------------------------------------------

/** GitHub repo that publishes builds of this shell app. */
const APP_RELEASE_REPO = 'XEonSKY/DeepSeek-Harness-Shell'
const APP_RELEASES_URL = `https://github.com/${APP_RELEASE_REPO}/releases`
const APP_RELEASES_API = `https://api.github.com/repos/${APP_RELEASE_REPO}/releases/latest`

/** 带 15s 超时的 fetch，避免网络/镜像挂起卡住主进程。 */
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Compare the running app against the newest release tag on GitHub. */
export async function checkAppSelfUpdate(): Promise<AppUpdateResult> {
  // The running app's own arch/platform — used to match the right artifact when
  // an update is found. This is the *installed package's* arch, not the machine's.
  const arch = process.arch
  const platform = process.platform
  let current: string | null = null
  try {
    current = app.getVersion() || null
  } catch {
    /* not packaged / no version */
  }
  try {
    const res = await fetchWithTimeout(APP_RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'deepseek-harness-shell' }
    })
    if (!res.ok) {
      return {
        status: 'error',
        current,
        latest: null,
        message: res.status === 404 ? mt('m.appUpdate.noneReleased') : mt('m.appUpdate.httpErr', { status: res.status }),
        releaseUrl: res.status === 404 ? APP_RELEASES_URL : null,
        arch,
        platform
      }
    }
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = data.tag_name ? stripV(data.tag_name) : null
    const releaseUrl = data.html_url || APP_RELEASES_URL
    if (!latest) {
      return { status: 'error', current, latest: null, message: mt('m.appUpdate.latestReadFail'), releaseUrl, arch, platform }
    }
    if (current && compareVersions(current, latest) < 0) {
      return { status: 'update', current, latest, message: mt('m.appUpdate.foundNew', { current, latest }), releaseUrl, arch, platform }
    }
    return { status: 'ok', current, latest, message: mt('m.appUpdate.upToDate', { latest }), releaseUrl, arch, platform }
  } catch (err) {
    return {
      status: 'error',
      current,
      latest: null,
      message: mt('m.appUpdate.netErr'),
      releaseUrl: APP_RELEASES_URL,
      arch,
      platform
    }
  }
}
