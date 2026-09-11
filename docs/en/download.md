# Download & system requirements

DeepSeek Harness Shell is a cross-platform desktop app (Windows / macOS / Linux). Installers are published on GitHub Releases.

## Version

This documentation matches version **0.1.5-alpha-5**.

## System requirements

| Item | Requirement |
|---|---|
| OS | Windows 10/11 (x64 / arm64), macOS, mainstream Linux (x64 / arm64) |
| Runtime | No Node.js needed (the `@deepseek-ai/dsh` kernel is managed by the app) |
| Network | Online access on first run to install the dsh kernel; localhost afterwards |

> The kernel `@deepseek-ai/dsh` is auto-detected. When missing, the app guides a one-click install (official registry.npmjs.org or the npmmirror mirror).

## Where to download

- Open the [Releases](https://github.com/XEonSKY/DeepSeek-Harness-Shell/releases) page and pick the newest release.
- Artifacts are named like `DeepSeek-Harness-Shell-<version>-<platform>-<arch>.<ext>`:
  - Windows installer: `...-win-x64-setup.exe` / `...-win-arm64-setup.exe`
  - macOS: `...-mac-x64.dmg` / `...-mac-arm64.dmg` (a matching `.zip` is published for auto-update)
  - Linux: `...-linux-x64.AppImage` / `...-linux-arm64.AppImage`

::: tip Choosing an architecture
Pick the asset matching your **running process architecture** (the installed package's arch): arm64 on ARM machines, x64 on Intel/AMD.
:::

## Verify & security

- Only download from the official Releases; app self-updates also go through GitHub.
- If GitHub is slow on your network, set a public mirror prefix (e.g. `https://ghproxy.com`) under Settings → Network → GitHub mirror to speed up update downloads; leave it empty for a direct connection.
- If you see an “unknown publisher” warning, allow it per your OS guidance (open-source apps are often unsigned).
