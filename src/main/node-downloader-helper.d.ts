/**
 * Ambient typing for `node-downloader-helper` so typecheck passes even before
 * `npm install`. Only the subset used by main/downloader.ts is declared.
 */
declare module 'node-downloader-helper' {
    export interface DlStats {
        name?: string
        total?: number | null
        downloaded?: number
        progress?: number
        speed?: number
    }
    export class DownloaderHelper {
        constructor(url: string, destinationFolder: string, options?: Record<string, unknown>)
        start(): Promise<unknown>
        pause(): void
        resume(): Promise<boolean>
        stop(): void
        on(event: string, listener: (...args: any[]) => void): this
        off(event: string, listener: (...args: any[]) => void): this
        once(event: string, listener: (...args: any[]) => void): this
    }
}
