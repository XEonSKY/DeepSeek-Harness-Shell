# Tabs & multiple windows

The app is a frameless desktop shell: a custom title bar on top (which contains a browser-style tab strip) and a web content area below.

## Title bar (left → right)

| Area | Description |
|---|---|
| App icon + title | Shows the app name |
| Fixed-site buttons | Shown only in the **core window**: DeepSeek UI / Web chat / Usage & top-up |
| Jump to core window | Shown only in **secondary windows**, to get back to the window hosting DeepSeek UI |
| Tab strip | Dynamic tabs plus **+** to open a new one; click empty space to drag the window, scroll to pan horizontally |
| Refresh | Shown only while one of the three fixed sites is active; reloads that page |
| Settings | Opens the settings page (the **Terminal** now lives there too: Settings → Terminal) |
| Minimize / maximize / close | Window controls |

> Settings is an **overlay**: the web content underneath is not unmounted, so switching back keeps your state.

## Tabs

### Fixed tabs (core window only)

The three fixed sites always exist and **cannot be closed**:

1. **DeepSeek UI** — the embedded DeepSeek Harness main interface.
2. **Web chat** — embedded [chat.deepseek.com](https://chat.deepseek.com/).
3. **Usage / top-up** — embedded [platform.deepseek.com](https://platform.deepseek.com/).

### Dynamic tabs

- Created by `target=_blank` / `window.open` from a page, or by clicking **+** in the tab strip.
- No limit on how many you open.
- **Keep-alive policy**: the pages kept alive are “the fixed sites + the tabs you starred + the 3 most recent unstarred dynamic tabs”. Everything beyond that **stays in the tab strip**, but its page is released and reloads when you switch back.
- A tab only actually loads its page once it has been **opened**.

### Opening a new tab with “+”

What it opens depends on the **New tab** setting (see [Settings](/en/settings)):

- **Built-in new tab page** (default) — a search box, a search-engine picker, and your configured site shortcuts;
- **Custom URL** — opens the fixed URL you entered.

### Tab actions

| Action | Effect |
|---|---|
| Click | Switch to that tab |
| `Ctrl` / `Cmd` + click | Open that tab's URL in the **system default browser** |
| Middle click | Close the tab |
| Star (☆) | Pin it alive: the page stays resident and does **not** consume one of the 3 keep-alive slots |
| Drag a tab | **Reorder** within the strip; drag it onto another window's light-blue overlay to **move the tab into that window** |
| Right click | Duplicate / close / open in new window / move to another window |

## Address bar

The address bar is shown **only while a dynamic tab is active** (fixed sites do not show it).

| Input | Behaviour |
|---|---|
| `http(s):` / `about:` | Loaded inside the app |
| Other protocols (`mailto:`, `tel:`, custom schemes…) | Handed to the system default handler |
| Anything that is not a URL | Searched with the configured **default search engine** |

The address bar also has **back / forward / reload** (which turns into stop while loading).

## Multiple windows

- Right-click a tab and choose **Open in new window** to create a full **secondary window** (with its own tab strip).
- Secondary windows do **not** have the three fixed sites; that part of the title bar shows a **Jump to core window** button instead.
- A secondary window's OS title shows “current tab title - app name”.
- **After the core window is closed**, the earliest-opened secondary window automatically **takes over** as the new core window and gains the three fixed sites.

## Context menu

Right-click any input field, or text you dragged over to select, to get **Cut / Copy / Paste / Select all**:

- Inside an input all three are available; with a plain text selection (not editable) you get Copy / Select all;
- With no selection and nothing editable, **no menu appears** (the tab strip has its own right-click menu — see the tab actions above);
- Input fields inside the embedded pages (DeepSeek UI, web chat, dynamic tabs) support it too.

## Keyboard shortcuts

The defaults are below; all three can be changed in [Settings → Shortcuts](/en/settings) (clearing one disables it):

| Shortcut | Action |
|---|---|
| `Ctrl` / `Cmd` + `Alt` + `H` | **System-wide**: from any program, return to this app’s main window (also when minimized or hidden to the tray) |
| `Ctrl` / `Cmd` + `T` | Toggle between DeepSeek UI and the terminal (Settings → Terminal) |
| `F12` | Open / close the DevTools console (**only when “Developer mode” is on**) |

## System tray

When hidden to tray, use the tray icon:

- single click: show / hide the window;
- right-click menu: “Show / hide window”, “Quit (also stop dsh)”.

> Closing the window does not stop dsh; on real quit the app also stops the dsh process it manages.
> If no tray is available, closing the last window quits the app directly.
