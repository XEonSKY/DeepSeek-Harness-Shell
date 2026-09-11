# Settings Guide

“Settings” is organized into groups on the left: General, Appearance, Network, Environment, Kernel, Terminal, Shortcuts, Webview, About. Every settings card can be **collapsed** by clicking its title. This page explains each item.

## General

| Setting | Effect |
|---|---|
| **Working directory** | The directory in which dsh starts; leave blank to use `workspace` under the configuration directory. |
| **Configuration folder** | The location of app settings, local kernels, bundled npm, local Node, and the default workspace. Defaults to `~/.dsbox/release` (release) / `~/.dsbox/dev` (dev). You can “Change” it or “Restore Default”. |
| **Port** | Automatic (picks a free port starting from 3080, recommended) or manually specified. |
| **Close button behavior** | Hide to tray or quit directly; you can choose “Ask every time” or “Remember choice”. |
| **Restore default settings** | One-click reset and restart of dsh. |

### Changing and migrating the configuration folder

A change is **not moved immediately**; instead you are prompted that it will “migrate automatically after restart”:

- Choosing “Cancel change” undoes this modification;
- After restart a **migration progress dialog** is shown (progress bar + the file currently being moved), and only after it succeeds does the current directory point to the new location;
- The legacy default directory `~/.config/dsh_shell[_dev]` (and the `~/dsbox/{release,dev}` used by intermediate versions) is migrated automatically to the new location on the next restart.

### New tab and search

| Setting | Effect |
|---|---|
| **Default search engine** | Used when non-URL content is entered in the address bar and when searching on the built-in navigation page (Baidu / Sogou / 360 / Bing / Google / DuckDuckGo). |
| **New tab** | Whether clicking “＋” opens the **built-in navigation page** (search box + common sites) or a **custom URL**. |
| **Common site shortcuts** | A name + URL list shown on the built-in navigation page. |

## Appearance

| Setting | Effect |
|---|---|
| **Theme** | Follow system / Light / Dark; takes effect immediately. |
| **Color scheme** | 7 preset schemes (Default Blue / Geek Purple / Forest Green / Teal / Warm Orange / Rose Red / Graphite Gray), which determine both the primary color and the page / sidebar background, with light and dark variants adapting automatically. |
| **Language (secondary dropdown)** | Choose Chinese / English, and choose an extended translation (zh: Simplified / Anime / Classical Chinese / Traditional Chinese; en: English / Pirate / Shakespearean). Extended translations are **text overlays** that affect only the current language and do not change dsh settings. |
| **Interface zoom** | 50%–200%, applied to the shell window and embedded webviews. |
| **Disable system scaling** | Ignore the operating system display scaling; requires a restart to take effect. |

## Network

| Setting | Effect |
|---|---|
| **npm registry mirror** | Official `registry.npmjs.org` or `npmmirror`. |
| **Proxy** | Enable + protocol (HTTP / SOCKS5) + host + port + proxy scope (npm install / download, Node download and deployment, kernel update check). |
| **Download concurrency** | The number of concurrent connections for multi-threaded segmented downloads: 1 = single-threaded, default 4, maximum 16. |

For download progress, temporary directories, de-duplication, and similar behavior, see [Environment Management](/en/user/environment).

## Environment

The Node and npm sources used to run the kernel; see [Environment Management (Node / npm)](/en/user/environment).

## Kernel

Kernel source, updates, version switching, and uninstalling; see [Kernel Management](/en/user/kernel).

## Terminal

- dsh's real-time output (stdout / stderr) with ANSI colors; you can toggle **auto-scroll** and **clear display**;
- The terminal is **read-only** (it does not accept keyboard input); a placeholder is shown before dsh has produced any output;
- Switching away and back re-fetches the most recent output (a server-side ring buffer, capped at 5000 lines);
- Press `Ctrl` / `Cmd` + `T` to switch between DeepSeek UI and the terminal.

## Shortcuts

| Shortcut | Default | Scope |
|---|---|---|
| Return to main window | `Ctrl` / `Cmd` + `Alt` + `H` | **System-wide**; brings the main window to the foreground from any program |
| Toggle terminal view | `Ctrl` / `Cmd` + `T` | In-app: DeepSeek UI ↔ Settings · Terminal |
| DevTools console | `F12` | In-app: effective only when “About → Developer Mode” is enabled |

- Click “Change” and then press the key combination (`Esc` cancels); “Clear” = disable, “Restore Default” = return to the default value;
- Only letters / digits / F1–F24 are supported, and at least one modifier key is required;
- A system-wide shortcut may be taken by another program; when that happens the page shows a prompt, and you can switch to another one;
- Changes take effect immediately and do not require a restart.

## Webview

The rendering mode and browser identity of embedded pages (kernel UI, web chat, dynamic tabs).

- **Hardware acceleration**: enabled by default. Disabling it can reduce resource usage and improve compatibility with older drivers, but scrolling and animations become choppier. It can only be decided at **app startup**, so a change requires restarting the app.
- **UserAgent**: leave blank to use the default, generated in real time from the current platform and version, like `... Chrome/<Chromium version> Safari/537.36 XEonSKY/<app version>`; a custom UA takes effect immediately for **new requests**, and for already-loaded pages after a refresh.

## About

- Shows the app version and running architecture;
- **Auto-update**: checks for a new app version at startup and downloads it in the background; see [App Update & Rollback](/en/user/update);
- **Check for pre-releases**: whether to include pre-release versions;
- **Developer Mode**: by default `F12` toggles DevTools (the shortcut can be changed on the “Shortcuts” page).

> The base source of theme and language is still dsh's `~/.dsh/settings.yaml`; the app's own settings are stored in `settings.json` in the **configuration directory**.
