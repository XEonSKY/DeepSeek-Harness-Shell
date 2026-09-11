import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import type { KernelAction, Settings, UpdateResult } from '@shared/types'
import { IS_WIN, broadcast } from '../app/runtime'
import { resolveKernel } from './tools'
import { loadSettings, mt, localKernelDir } from '../app/settings'
import { rememberChild, isDshRunning, stopAllDsh, restart } from './dsh'
import { isPrerelease, compareVersions, pickLatest, sortVersionsDesc } from './semver'
import { registryBase, runNpm, runNpmInstallGlobal, runLocalNpmInstall } from './npmRunner'

// ---------------------------------------------------------------------------
// @deepseek-ai/dsh install & version checks (source-aware: local vs global)
// ---------------------------------------------------------------------------

export interface DshInstallInfo {
    present: boolean
    version: string | null
    dir: string | null
    kind: 'local' | 'global'
}

/** Detect whether the kernel chosen by cfg.kernelSource is present and its version. */
export function resolveInstall(cfg: Settings): DshInstallInfo {
    const k = resolveKernel(cfg)
    return { present: k.present, version: k.version, dir: k.moduleDir || null, kind: k.kind }
}

export function kernelInstalled(): boolean {
    return resolveInstall(loadSettings()).present
}

async function fetchPublishedVersions(registry: 'npmjs' | 'npmmirror'): Promise<string[] | null> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    try {
        const res = await fetch(`${registryBase(registry)}/@deepseek-ai%2Fdsh`, { signal: ctrl.signal })
        if (!res.ok) return null
        const data = (await res.json()) as { versions?: Record<string, unknown> }
        if (!data.versions) return null
        return Object.keys(data.versions)
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

/** Run a full install/update check and return a result for the renderer to show. */
export async function performUpdateCheck(
    cfg: Settings,
    opts?: { prerelease?: boolean; registry?: 'npmjs' | 'npmmirror' }
): Promise<UpdateResult> {
    if (opts?.registry && opts.registry !== cfg.npmRegistry) cfg = { ...cfg, npmRegistry: opts.registry }
    const info = resolveInstall(cfg)
    if (!info.present) {
        return {
            status: 'missing',
            current: null,
            latest: null,
            message: mt('m.kernel.missingMsg'),
            command: ''
        }
    }
    if (!info.version) {
        return { status: 'error', current: null, latest: null, message: mt('m.kernel.noVersion') }
    }
    const versions = await fetchPublishedVersions(cfg.npmRegistry)
    if (!versions || versions.length === 0) {
        return {
            status: 'error',
            current: info.version,
            latest: null,
            message: mt('m.kernel.registryUnreachable', { version: info.version })
        }
    }
    const pool = opts?.prerelease ? versions : versions.filter((v) => !isPrerelease(v))
    const latest = pickLatest(pool)
    if (!latest) {
        return { status: 'ok', current: info.version, latest: null, message: mt('m.kernel.noComparable') }
    }
    if (compareVersions(info.version, latest) >= 0) {
        return { status: 'ok', current: info.version, latest, message: mt('m.kernel.upToDate', { version: info.version }) }
    }
    const kind = isPrerelease(latest) ? mt('m.kernel.preKind') : mt('m.kernel.stableKind')
    return {
        status: 'update',
        current: info.version,
        latest,
        message: mt('m.kernel.newKind', { kind, current: info.version, latest }),
        command: ''
    }
}

// ---------------------------------------------------------------------------
// Uninstall-failure diagnosis (global npm only — the module may be locked)
// ---------------------------------------------------------------------------

function detectHolders(dir: string): Promise<string[]> {
    return new Promise((resolve) => {
        const escDir = dir.replace(/'/g, "''")
        const script = [
            `$rows = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escDir}*' }`,
            '$rows | Sort-Object ProcessId | Select-Object -First 6 | ForEach-Object {',
            '  $c = $_.CommandLine; if ($c -and $c.Length -gt 160) { $c = $c.Substring(0, 160) }',
            '  Write-Output ("{0} {1} :: {2}" -f $_.ProcessId, $_.Name, $c)',
            '}'
        ].join('\n')
        const child = rememberChild(
            spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
                windowsHide: true,
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe']
            })
        )
        let out = ''
        const timer = setTimeout(() => {
            try {
                child.kill('SIGKILL')
            } catch {
                /* ignore */
            }
        }, 8000)
        child.stdout!.on('data', (d: Buffer) => {
            if (out.length < 6000) out += d.toString()
        })
        child.stderr!.on('data', () => {
            /* ignore */
        })
        const done = (): void => {
            clearTimeout(timer)
            resolve(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
        }
        child.on('error', done)
        child.on('exit', done)
    })
}

function probeDirInUse(dir: string): boolean {
    const tmp = `${dir}.~uninstall-probe-${Date.now()}`
    try {
        fs.renameSync(dir, tmp)
    } catch {
        return true
    }
    try {
        fs.renameSync(tmp, dir)
    } catch {
        try {
            fs.renameSync(tmp, dir)
        } catch {
            console.error('[Manager] could not restore module dir after lock probe:', tmp)
        }
    }
    return false
}

async function uninstallDiagnose(dir: string | null, tail: string): Promise<string> {
    const fallback = mt('m.kernel.uninstallFail', { tail: tail.trim() || '...' })
    if (!dir) return fallback

    const dirExists = fs.existsSync(dir)
    let reason: string
    if (dirExists) {
        const holders = IS_WIN ? await detectHolders(dir) : []
        if (holders.length) {
            reason = mt('m.kernel.uninstallReasonHolder', { procs: holders.slice(0, 5).join('；') })
        } else if (probeDirInUse(dir)) {
            reason = mt('m.kernel.uninstallReasonLocked')
        } else {
            reason = mt('m.kernel.uninstallReasonPresent')
        }
    } else {
        reason = mt('m.kernel.uninstallReasonRemoved')
    }
    return mt('m.kernel.uninstallDiag', { reason, tail: tail.trim() || '...' })
}

let kernelBusy = false
function busyMsg(): KernelAction {
    return { ok: false, message: mt('m.kernel.busy'), version: null }
}

/** Newest considered published versions (newest first). */
export async function listVersions(opts?: { prerelease?: boolean; registry?: 'npmjs' | 'npmmirror' }): Promise<string[]> {
    const cfg = loadSettings()
    const registry = opts?.registry ?? cfg.npmRegistry
    const versions = await fetchPublishedVersions(registry)
    if (!versions) return []
    return sortVersionsDesc(versions, opts?.prerelease ?? cfg.checkPrerelease)
}

async function resolveTargetVersion(cfg: Settings, registry: 'npmjs' | 'npmmirror'): Promise<string> {
    const versions = await fetchPublishedVersions(registry)
    if (!versions || !versions.length) throw new Error(mt('m.kernel.installNoVersions'))
    const picked = pickLatest(cfg.checkPrerelease ? versions : versions.filter((v) => !isPrerelease(v)))
    if (!picked) throw new Error(mt('m.kernel.installNone'))
    return picked
}

/** Upgrade / install the kernel to the newest (or a specific) version. */
async function installTo(local: boolean, target: string, registry: 'npmjs' | 'npmmirror', cfg: Settings): Promise<KernelAction> {
    const wasRunning = isDshRunning()
    stopAllDsh()
    let result: { ok: boolean; stderrTail: string; fatal?: string }
    if (local) {
        result = await runLocalNpmInstall(`@deepseek-ai/dsh@${target}`, cfg)
    } else {
        result = await runNpmInstallGlobal(`@deepseek-ai/dsh@${target}`, registry)
    }
    if (!result.ok) {
        if (wasRunning) void restart()
        const message =
            result.fatal ??
      (local ? mt('m.kernel.localInstallFail', { tail: result.stderrTail.trim() || '...' }) : mt('m.kernel.installFail', { tail: result.stderrTail.trim() || '...' }))
        return { ok: false, message, version: null }
    }
    void restart() // bring the new/installed kernel up
    return { ok: true, message: mt('m.kernel.installOk', { version: target }), version: target }
}

/** Upgrade to the newest considered version. */
export async function updateKernel(opts?: { registry?: 'npmjs' | 'npmmirror' }): Promise<KernelAction> {
    if (kernelBusy) return busyMsg()
    const cfg = loadSettings()
    const effRegistry = opts?.registry ?? cfg.npmRegistry
    const local = cfg.kernelSource !== 'global'
    const check = await performUpdateCheck(cfg, { prerelease: cfg.checkPrerelease, registry: effRegistry })
    if (check.status !== 'update' || !check.latest) {
        return { ok: false, message: check.message || '', version: null }
    }
    kernelBusy = true
    try {
        return await installTo(local, check.latest, effRegistry, cfg)
    } finally {
        kernelBusy = false
    }
}

/** Install / switch to a version (latest when none given). Fresh installs start dsh. */
export async function installKernel(opts?: { version?: string | null; registry?: 'npmjs' | 'npmmirror' }): Promise<KernelAction> {
    if (kernelBusy) return busyMsg()
    const cfg = loadSettings()
    const registry = opts?.registry ?? cfg.npmRegistry
    const local = cfg.kernelSource !== 'global'
    let target = (opts?.version ?? '').trim()
    if (!target) {
        try {
            target = await resolveTargetVersion(cfg, registry)
        } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err), version: null }
        }
    }
    kernelBusy = true
    try {
        return await installTo(local, target, registry, cfg)
    } finally {
        kernelBusy = false
    }
}

/** Uninstall the effective kernel. */
export async function uninstallKernel(): Promise<KernelAction> {
    if (kernelBusy) return busyMsg()
    const info = resolveInstall(loadSettings())
    const local = info.kind === 'local'
    kernelBusy = true
    try {
        stopAllDsh()
        if (local) {
            try {
                // Removing the local module dir is enough (npm managed it under our prefix).
                if (info.dir) fs.rmSync(info.dir, { recursive: true, force: true })
                else fs.rmSync(path.join(localKernelDir(), 'node_modules'), { recursive: true, force: true })
            } catch (err) {
                return { ok: false, message: err instanceof Error ? err.message : String(err), version: null }
            }
            broadcast('kernel:missing')
            return { ok: true, message: mt('m.kernel.uninstallOk'), version: null }
        }
        const r = await runNpm(['uninstall', '-g', '@deepseek-ai/dsh'], 'npm uninstall -g @deepseek-ai/dsh')
        if (!r.ok) {
            const message = await uninstallDiagnose(info.dir, r.stderrTail)
            return { ok: false, message, version: null }
        }
        broadcast('kernel:missing')
        return { ok: true, message: mt('m.kernel.uninstallOk'), version: null }
    } finally {
        kernelBusy = false
    }
}
