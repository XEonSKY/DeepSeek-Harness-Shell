# Renderer

The renderer is a Vue 3 application responsible for the tab shell, settings page, install wizard and terminal. Its source lives in `src/renderer/src/`.

## Directory

| Path | Description |
|---|---|
| `App.vue` | Root component: title bar, webview container, settings overlay, global toasts and the migration progress dialog |
| `views/` | Pages: `WebHost.vue` (kernel UI / web), `NewTab.vue` (built-in navigation page), `LogView.vue` (terminal) |
| `views/settings/` | Settings panels: General / Appearance / Network / Env / Dsh / Log / Hotkeys / Webview / About |
| `components/` | `KernelWizard.vue` (four-step install wizard), `TitleBar.vue`, etc. |
| `lib/` | Theme, tabs, state, formatting, update prompts, locale utilities |
| `stores` / `views/settings/settingsStore.ts` | Pinia state and settings mirror |

## State management

- The Pinia store holds a mirror of the settings, and `useSettingsStore.ts` reads from and writes back to the main process;
- Changes in the settings panels are saved through the main process (some settings need "Apply now" to restart dsh before they take effect).

## Tabs and windows

The creation, keep-alive and drag-migration logic for tabs lives in `lib/tabs.ts` and elsewhere; the roles of the core window and secondary windows are decided jointly by the main process `windowreg.ts` and the renderer.

## Theme and language

- Theme: follow system / light / dark; the color scheme decides the accent color and the base background; in dark mode the app icon switches to its dark variant;
- i18n: `vue-i18n`, with locale files in `src/shared/locales/` (zh / en plus extended translations); extended translations are text overlays;
- Theme and language are synced to dsh's own configuration.

## Communicating with the main process

All main-process capabilities are called through `window.api` (exposed by the preload); the type contract is `RendererApi` in `src/shared/types.ts`. New capabilities must be kept in sync in three places, see [IPC contract](/en/dev/ipc).
