# Settings

The **Settings** page groups options on the left: General, Appearance, Network, Environment, Kernel, Terminal, Shortcuts, Webview, About. Setting cards can be collapsed from their headers.

## General

- **Working directory**: where dsh starts; empty uses `workspace` under the config directory.
- **Port**: Auto (recommended; picks a free port from 3080) or manual.
- **Close behavior**: hide to tray or quit; “ask each time” or “remember choice”.

### New tab & search

- **Default search engine**: used when the address bar receives something that is not a URL, and by the built-in new tab page (Baidu / Sogou / 360 / Bing / Google / DuckDuckGo).
- **New tab**: what the **+** button in the tab bar opens — the **built-in new tab page** (a search box plus shortcuts) or a **custom URL**.
- **Site shortcuts**: a list of name + URL entries shown on the built-in new tab page for one-click access.

- **Restore defaults**: reset everything and restart dsh.

## Appearance

- **Theme**: System / Light / Dark — takes effect immediately.
- **Color scheme**: seven presets (default blue / geek purple / forest green / cyan / warm orange / rose red / graphite). A scheme sets both the **accent color** and the **page / sidebar backgrounds**, with light and dark variants handled automatically (switching Theme recomputes it). Light-vs-dark itself stays with Theme above, and “default blue” keeps the original look.
- **Language (two-level menu)**: pick 中文 / English, plus an extended translation (zh: Simplified / Anime / Classical Chinese / Traditional Chinese; en: English / Pirate / Shakespearean). Extended translations are **text overlays**, apply only to the current language, and never modify dsh settings.
- **Zoom**: 50%–200% (applies to the shell window and the embedded webview).
- **Ignore OS scaling**: prompts for a restart to take effect.

## Network

- **npm registry**: official registry / npmmirror.
- **Proxy**: enable + protocol (HTTP / SOCKS5) + host + port + **proxy scope** (npm installs/downloads, Node download & deploy, kernel update checks). Currently the npm scope actually routes through the proxy; Node download and update-check proxy support are follow-ups.

## Environment

Where the Node that runs the kernel comes from. **The three tabs are the three choices** (clicking a tab switches it; restart dsh afterwards):

- **Bundled**: shows the Node version bundled with Electron plus the Chromium version. Both upgrade with the app and cannot be updated separately.
- **System**: shows the system Node’s current version and the latest LTS; when it is behind, a **Download Node** button appears. A system-wide Node is yours to upgrade (installer / winget / nvm / brew …) — the app never touches system installs; switch to Local deploy to let the app manage it.
- **Local deploy**: the same current/latest comparison; when it is missing or behind it offers **Deploy Node** / **Update to vX**. You can also **pick any version to download / switch to** (the list comes from nodejs.org, with an “Include non-LTS (Current)” checkbox); switching **replaces** the copy in the config directory — there are no side-by-side versions. If dsh is running on that local Node, the app asks to stop it first and restarts it afterwards.

> “Latest LTS” comes from nodejs.org’s release index and is cached in the main process for 10 minutes; offline or through a broken proxy it shows “Could not fetch the latest version”.
> The kernel needs **Node ≥ 20**: picking a lower major version in the list warns you — it cannot run the kernel.

After changing the runtime, click **Apply now** at the bottom to restart dsh and switch immediately. If the selected runtime is unavailable (no system Node ≥ 20, or nothing deployed locally) the button is **disabled** and says why — applying means restarting dsh, which would simply fail to start.

### npm source

The npm used when installing the kernel. **Again: the three tabs are the three choices.**

- **Bundled**: downloaded from the registry into the config directory on first use; managed by the app.
- **System**: uses the npm installed on your system; updating performs a global install — **this really changes your global npm**.
- **Local Node**: uses the npm that ships with the locally deployed Node; updating installs into that Node under the config directory.

Each tab shows the **current version** and the **latest on the registry**; when it is behind or not ready yet, a **Download npm / Update npm** button appears. Below the tabs there is one **version picker** shared by all three (with an “Include pre-releases” checkbox) that can install any historical version — installing targets the source of **the tab selected above**.

> The npm source is only used when installing the kernel with kernel source = Bundled; changing it does **not** need a dsh restart, it applies to the next kernel install / update.
> If **System** fails with a permission error (EPERM), the global npm prefix usually points at the system Node directory: run as administrator, or switch to one of the other two sources (they install into the config directory).

## Kernel

- **Start / Stop / Restart**: control the dsh server directly, with a live status tag.
- **Apply now**: persist runtime changes and restart dsh.
- **Kernel source**: Bundled (installed into the app dir, run with the built-in Node) or Global.
- **Launcher path**: shown only in Global mode; pick the file with a file dialog.
- **Kernel updates**: check on startup, include pre-releases, and a manual check / update. **No notification is shown when you are already up to date** — the result appears as a line under the Check button (including the version the remote resolved to).
- **Version / uninstall**: browse and **install / switch** to any historical version; **Uninstall** stops dsh first, then shows the install wizard.

::: warning Upgrade / switch / uninstall
These operations **force-stop all running dsh instances first** (they ask for confirmation if one is running). After an upgrade or switch, dsh restarts automatically; on failure the app detects the occupation cause and reports it.
:::

## Terminal

- Live dsh output (stdout / stderr) with ANSI colors; toggle **auto-scroll** or **clear** the display.
- The terminal is **read-only** (no keyboard input); a placeholder is shown while dsh has produced no output.
- Leaving and coming back re-reads the recent output (server-side ring buffer, capped at 5000 lines).
- The title bar no longer carries a terminal button: press `Ctrl` / `Cmd` + `T` to toggle between DeepSeek UI and the terminal.

## Shortcuts

| Shortcut | Default | Scope |
|---|---|---|
| Return to the main window | `Ctrl` / `Cmd` + `Alt` + `H` | **System-wide** — brings the app’s main window to the front from any program (also when minimized or hidden to the tray) |
| Toggle the terminal view | `Ctrl` / `Cmd` + `T` | In-app: switches between DeepSeek UI and Settings → Terminal |
| DevTools console | `F12` | In-app: only active when Developer mode is on (About page) |

- Click **Change**, then press a combination (`Esc` cancels); **Clear** disables it and **Reset** restores the default above.
- Letters, digits and F1–F24 only, and at least one modifier is required — otherwise typing would be swallowed.
- The system-wide one may be taken by another program; the page tells you when that happens — just pick another combination.
- Changes apply immediately; no restart needed.

## Webview

How the embedded pages (kernel UI, web chat and every dynamic tab) render, and what they identify as.

- **Hardware acceleration**: on by default. Turning it off lowers resource usage and helps with old drivers, at the cost of choppier scrolling and animation. It can only be decided while the app starts, so changing it needs an **app restart** (the page offers to restart right away).
- **UserAgent**: leave it empty to use the default. The default is generated live from the current platform and versions, like:

  ```
  Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Safari/537.36 XEonSKY/0.1.5-alpha-5
  ```

  The platform token follows each platform’s real Chrome string; after `Chrome/` is the current Chromium version, and after `XEonSKY/` the app version.
- A custom UA applies to **new requests** immediately; already-loaded pages pick it up after a refresh (or a restart).

## About

- Shows the app version and runtime architecture.
- **Auto update**: check for a new app version on startup and download it in the background; **Include pre-releases**; **Developer mode** (F12 toggles DevTools by default — change it on the Shortcuts page).

> Theme and the base language still mirror dsh’s own `~/.dsh/settings.yaml`; the app’s own settings (General / Network / Kernel / About, etc.) live in the app **config directory** `settings.json` (default `~/.config/dsh_shell`, `dsh_shell_dev` in dev; selectable in the wizard/settings, with migration).
