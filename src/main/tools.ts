import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { IS_WIN } from './runtime'

/**
 * Tool location (dsh / node on PATH or known fallbacks) and shell-command
 * assembly. Pure-ish (fs.readFileSync / existsSync); no shared mutable state.
 */

function pathEnv(): string[] {
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean)
}

function findInDirs(dirs: string[], names: string[]): string | undefined {
  for (const dir of dirs) {
    for (const n of names) {
      const p = path.join(dir, n)
      if (fs.existsSync(p)) return p
    }
  }
  return undefined
}

export function resolveDsh(configured: string | null): string {
  if (configured) {
    if (!fs.existsSync(configured)) throw new Error(`DSH_BIN / settings.dshBin points at a missing file: ${configured}`)
    return configured
  }
  const want = IS_WIN ? ['dsh.cmd', 'dsh.bat', 'dsh.exe', 'dsh'] : ['dsh']
  const hit = findInDirs(pathEnv(), want)
  if (hit) return hit
  if (IS_WIN) {
    const npm = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm')
    const g = findInDirs([npm], ['dsh.cmd', 'dsh.bat'])
    if (g) return g
  }
  throw new Error('Could not find the `dsh` CLI on PATH. Install it with:\n  npm install -g @deepseek-ai/dsh\nor set DSH_BIN to the launcher path.')
}

export function resolveNode(): string {
  const override = process.env.DSH_NODE
  if (override) {
    if (!fs.existsSync(override)) throw new Error(`DSH_NODE points at a missing file: ${override}`)
    return override
  }
  const want = IS_WIN ? ['node.exe', 'node.cmd'] : ['node']
  const hit = findInDirs(pathEnv(), want)
  if (hit) return hit
  if (IS_WIN) {
    const p = findInDirs(['C:\\Program Files\\nodejs', 'C:\\Program Files (x86)\\nodejs'], ['node.exe'])
    if (p) return p
  }
  throw new Error('Could not find the system Node.js binary (`node`) needed to run the watchdog.')
}

export function quoteArg(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

export function buildCommand(dshBin: string, host: string, port: number): string {
  const parts = [quoteArg(dshBin), 'web', '--no-open']
  if (host && host !== '127.0.0.1') parts.push('--host', host)
  parts.push('--port', String(port))
  return parts.join(' ')
}
