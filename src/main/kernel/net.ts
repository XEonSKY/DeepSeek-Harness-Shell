import type { ProxyScope, Settings } from '@shared/types'

/** 判断某范围是否走代理。 */
export function proxyActive(cfg: Settings, scope: ProxyScope): boolean {
  return !!cfg.proxyEnabled && cfg.proxyScope.includes(scope)
}

/** 组代理 URL（http(s)/socks5）。未启用或字段不完整返回 null。 */
export function proxyUrl(cfg: Settings): string | null {
  if (!cfg.proxyEnabled || !cfg.proxyHost || !cfg.proxyPort) return null
  return `${cfg.proxyProtocol}://${cfg.proxyHost}:${cfg.proxyPort}`
}

/** 为子进程追加的代理环境变量（该范围启用时才非空）。 */
export function proxyEnv(cfg: Settings, scope: ProxyScope): Record<string, string> {
  const u = proxyUrl(cfg)
  if (!u || !proxyActive(cfg, scope)) return {}
  return {
    HTTP_PROXY: u,
    HTTPS_PROXY: u,
    ALL_PROXY: u,
    http_proxy: u,
    https_proxy: u,
    all_proxy: u,
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost'
  }
}

/** npm 命令追加的 --proxy / --https-proxy 参数（npm 范围启用时）。 */
export function npmProxyArgs(cfg: Settings): string[] {
  if (!proxyActive(cfg, 'npm')) return []
  const u = proxyUrl(cfg)
  return u ? ['--proxy', u, '--https-proxy', u] : []
}
