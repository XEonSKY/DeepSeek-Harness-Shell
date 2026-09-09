import { DownloaderHelper } from 'node-downloader-helper'

/**
 * 统一文件下载器（基于 node-downloader-helper）：
 * 带进度回调、失败重试、覆盖旧文件。用于 Node 发行包、内置 npm 等大文件下载。
 */

export interface DlProgress {
  total: number
  downloaded: number
  /** 0-100 */
  percent: number
  /** bytes/s */
  speed: number
}

export interface DownloadFileOpts {
  url: string
  destDir: string
  fileName?: string
  onProgress?: (p: DlProgress) => void
}

export async function downloadFile(o: DownloadFileOpts): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    const dl = new DownloaderHelper(o.url, o.destDir, {
      fileName: o.fileName,
      override: true,
      retry: { maxRetries: 3, delay: 1000 },
      progressThrottle: 150,
      removeOnFail: true,
      removeOnStop: true
    })
    let done = false
    const finish = (r: { ok: boolean; message?: string }): void => {
      if (done) return
      done = true
      resolve(r)
    }
    dl.on('progress.throttled', (s: { total?: number | null; downloaded?: number; progress?: number; speed?: number }) => {
      if (!o.onProgress) return
      o.onProgress({
        total: s.total ?? 0,
        downloaded: s.downloaded ?? 0,
        percent: typeof s.progress === 'number' ? s.progress : 0,
        speed: s.speed ?? 0
      })
    })
    dl.on('error', (e: { message?: string } | Error) => finish({ ok: false, message: 'message' in e && e.message ? e.message : String(e) }))
    dl.on('end', () => finish({ ok: true }))
    dl.start().catch((e: unknown) => finish({ ok: false, message: String(e) }))
  })
}
