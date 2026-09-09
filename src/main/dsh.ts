import { app, dialog } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import fs from 'node:fs'
import { createInterface } from 'node:readline'
import type { LogEntry, Settings } from '@shared/types'
import { IS_WIN, broadcast, getMainWindow, setCurrentUrl } from './runtime'
import type { NodeRuntime } from './tools'
import { resolveKernel, nodeRuntimeForCfg } from './tools'
import { loadSettings, mt } from './settings'

/** Build the CLI args passed to the @deepseek-ai/dsh bin entry. */
function dshArgs(host: string, port: number): string[] {
  const args = ['web', '--no-open']
  if (host && host !== '127.0.0.1') args.push('--host', host)
  args.push('--port', String(port))
  return args
}

/**
 * Watchdog run with `node -e`. It is the real parent of `dsh web` and
 * guarantees dsh dies when this app is gone — gracefully or force-killed:
 *   - graceful quit: Electron kills the watchdog tree (taskkill /T / -pid).
 *   - force kill / crash: this process's stdin write-end is closed by the OS,
 *     the watchdog reads EOF and kills the dsh tree itself.
 * argv[1] is a JSON launch descriptor: { entry, args }.
 * The watchdog re-spawns its own runtime (Electron-as-Node when bundled) on the
 * kernel's JS bin entry, so dsh runs under the same Node we chose — no shell
 * `.cmd` shim and no reliance on a system `node` for the local kernel.
 */
const WATCHDOG_CODE = `
"use strict";
const { spawn, spawnSync } = require("child_process");
const IS_WIN = process.platform === "win32";
let child = null;
function killTree(pid) {
  if (!pid) return;
  try {
    if (IS_WIN) spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    else { try { process.kill(-pid, "SIGKILL"); } catch (_) { try { process.kill(pid, "SIGKILL"); } catch (__) {} } }
  } catch (_) {}
}
function shutdown() { if (child) { killTree(child.pid); child = null; } process.exit(0); }
let launch = null;
try { launch = JSON.parse(process.argv[1] || "null"); } catch (_) { launch = null; }
if (!launch || typeof launch.entry !== "string") { console.error("watchdog: bad launch descriptor"); process.exit(2); }
// dsh's web profile runs an HMR service that requires Node launched with
// --expose-internals, so pass it through when we spawn the kernel bin.
child = spawn(process.execPath, ['--expose-internals', launch.entry].concat(launch.args || []), {
  detached: !IS_WIN,
  windowsHide: true,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"]
});
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.on("exit", (code) => { try { process.exit(code == null ? 0 : code); } catch (_) {} });
child.on("error", () => { try { process.exit(1); } catch (_) {} });
process.stdin.resume();
process.stdin.on("end", shutdown);
process.stdin.on("close", shutdown);
["SIGINT", "SIGTERM", "SIGHUP"].forEach((s) => process.on(s, shutdown));
process.on("exit", () => { if (child) killTree(child.pid); });
`

// ---------------------------------------------------------------------------
// Log ring buffer + child registry
// ---------------------------------------------------------------------------

let serverProcess: ChildProcess | null = null
let childKilled = false
let serverGeneration = 0
let logBuf: LogEntry[] = []
const LOG_CAP = 5000

export function getLogHistory(): LogEntry[] {
  return logBuf.slice()
}

export function pushLog(k: LogEntry['k'], s: string): void {
  if (!s) return
  logBuf.push({ k, s })
  if (logBuf.length > LOG_CAP) logBuf.splice(0, logBuf.length - LOG_CAP)
  broadcast('dsh:log', { k, s })
}

/**
 * Every child this process spawns (the watchdog node, and any in-flight npm)
 * is registered here so a real quit / force-exit can kill the whole batch —
 * not just the latest watchdog. This prevents orphaned node/npm processes from
 * piling up (e.g. an npm install that was still running when the app closed).
 */
const liveChildren = new Set<ChildProcess>()
export function rememberChild(child: ChildProcess): ChildProcess {
  liveChildren.add(child)
  const drop = (): void => {
    liveChildren.delete(child)
  }
  child.once('exit', drop)
  child.once('error', drop)
  return child
}

export function killTree(pid: number): void {
  try {
    if (IS_WIN) spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' })
    else {
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        process.kill(pid, 'SIGTERM')
      }
    }
  } catch {
    /* already gone */
  }
}

/** taskkill /T the tree of every still-registered child (best effort). */
export function killAllChildren(): void {
  for (const c of [...liveChildren]) {
    try {
      if (c.pid) killTree(c.pid)
    } catch {
      /* already gone */
    }
  }
}

export function killServer(): void {
  if (!serverProcess) return
  childKilled = true
  const pid = serverProcess.pid
  if (pid) killTree(pid)
  serverProcess = null
}

/** Whether a dsh server (a watchdog/dsh tree) is currently launched. */
export function isDshRunning(): boolean {
  return serverProcess !== null
}

/**
 * Force-stop every launched dsh instance (the active watchdog/dsh tree plus any
 * lingering registered children, e.g. older generations). Returns true if a
 * server was actually running and had to be shut down. Used before swapping or
 * removing the kernel module, where a live process would lock the files.
 */
export function stopAllDsh(): boolean {
  const wasRunning = isDshRunning()
  killServer()
  killAllChildren()
  return wasRunning
}

/** 主动停止 dsh：关停并清空当前 URL，广播给渲染层。 */
export function stopServer(): void {
  stopAllDsh()
  setCurrentUrl(null)
  broadcast('dsh:url', null)
}

// ---------------------------------------------------------------------------
// Port selection
// ---------------------------------------------------------------------------

function findFreePort(start: number, host: string): Promise<number> {
  return new Promise((resolve) => {
    const tryPort = (candidate: number): void => {
      const probe = net.createServer()
      probe.unref()
      probe.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          if (candidate + 1 > start + 200) resolve(0)
          else tryPort(candidate + 1)
        } else resolve(0)
      })
      probe.listen(candidate, host, () => {
        const bound = (probe.address() as net.AddressInfo).port
        probe.close(() => resolve(bound))
      })
    }
    tryPort(start)
  })
}

async function resolvePort(s: Settings): Promise<number> {
  if (s.port === 0) return 0
  const base = (s.port && s.port > 0) ? s.port : 3080
  return findFreePort(base, s.host || '127.0.0.1')
}

// ---------------------------------------------------------------------------
// dsh server lifecycle (through the watchdog)
// ---------------------------------------------------------------------------

/**
 * Spawn dsh (via the watchdog) and resolve with its printed URL.
 * Note: the caller (restart) resolves a free port first and writes it back to
 * cfg.port, so this function always has a concrete port to pass to dsh.
 */
function launchServer(cfg: Settings): Promise<string> {
  const gen = ++serverGeneration
  killServer() // stop any previous generation
  childKilled = false

  const kernel = resolveKernel(cfg)
  if (!kernel.present || !kernel.entry) {
    return Promise.reject(
      new Error(`No usable @deepseek-ai/dsh kernel (source=${cfg.kernelSource ?? 'local'}). Please install it first.`)
    )
  }

  let cwd = os.homedir()
  if (cfg.workspace) {
    // 默认工作目录在配置目录下；不存在则创建，创建失败再回退主目录。
    try {
      fs.mkdirSync(cfg.workspace, { recursive: true })
      cwd = cfg.workspace
    } catch {
      dialog.showErrorBox(mt('m.dialogs.workspaceMissingTitle'), mt('m.dialogs.workspaceMissing', { path: cfg.workspace }))
    }
  }

  const port = (cfg.port ?? 3080) === 0 ? 0 : cfg.port ?? 3080
  const rt = nodeRuntimeForCfg(cfg)
  const launch = { entry: kernel.entry, args: dshArgs(cfg.host || '127.0.0.1', port) }

  return new Promise<string>((resolve, reject) => {
    spawnWatchdog(rt, launch, { cwd, gen, resolve, reject, timeoutMs: cfg.timeoutMs })
  })
}

interface SpawnOpts {
  cwd: string
  gen: number
  resolve: (url: string) => void
  reject: (err: Error) => void
  timeoutMs: number
}

function spawnWatchdog(rt: NodeRuntime, launch: { entry: string; args: string[] }, o: SpawnOpts): void {
  const child = rememberChild(
    spawn(rt.exec, ['-e', WATCHDOG_CODE, JSON.stringify(launch)], {
      shell: false,
      windowsHide: true,
      cwd: o.cwd,
      env: { ...process.env, ...rt.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })
  )
  serverProcess = child
  let settledUrl = false
  let stderrTail = ''
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    if (!settledUrl) {
      o.reject(new Error(`Timed out waiting for dsh to print its URL (${o.timeoutMs} ms).\n${stderrTail}`))
      killServer()
    }
  }, o.timeoutMs)

  const finish = (url: string): void => {
    if (settledUrl || o.gen !== serverGeneration) return
    settledUrl = true
    clearTimeout(timer)
    o.resolve(url)
  }

  const rl = createInterface({ input: child.stdout! })
  rl.on('line', (line) => {
    console.log('[Core]', line)
    pushLog('o', line)
    const m = line.match(/dsh web:\s*(https?:\/\/\S+)/i)
    if (m) finish(m[1])
  })

  child.stderr!.on('data', (d: Buffer) => {
    const s = d.toString()
    stderrTail = (stderrTail + s).slice(-4000)
    pushLog('e', s)
    console.error('[Core]', s.replace(/\n/g, '\n[Core]'))
  })

  child.stdin!.on('error', () => {})

  child.on('error', (err) => {
    if (!settledUrl && !timedOut) {
      clearTimeout(timer)
      o.reject(new Error(`Failed to start DeepSeek Harness: ${err.message}`))
    }
  })

  child.on('exit', (code) => {
    console.log('[Manager] dsh exited (code=', code, ')')
    clearTimeout(timer)
    if (!settledUrl && !childKilled) {
      o.reject(new Error(`DeepSeek Harness exited before serving a URL (code=${code}).\n${stderrTail}`))
    }
  })
}

// ---------------------------------------------------------------------------
// Serialized restart
// ---------------------------------------------------------------------------

/**
 * Run one full restart cycle from the current on-disk settings. Broken out so
 * `restart` can serialize invocations — see below.
 */
async function runOneRestart(): Promise<void> {
  try {
    const effective = { ...loadSettings() }
    effective.port = await resolvePort(effective)
    const url = await launchServer(effective)
    setCurrentUrl(url)
    broadcast('dsh:url', url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    dialog.showErrorBox(mt('m.dialogs.startFailedTitle'), msg)
    if (!getMainWindow()) app.quit()
  }
}

let restartBusy = false
let restartRequested = false

/**
 * Restart the dsh server, serialized: concurrent triggers (a fresh install, a
 * settings apply, the auto-start at boot) queue behind one another and coalesce
 * into a single trailing run, so they can never each spawn their own
 * watchdog/dsh generation and stack processes.
 */
export async function restart(): Promise<void> {
  restartRequested = true
  if (restartBusy) return
  restartBusy = true
  try {
    while (restartRequested) {
      restartRequested = false
      await runOneRestart()
    }
  } finally {
    restartBusy = false
  }
}
