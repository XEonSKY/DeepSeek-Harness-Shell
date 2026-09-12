# IPC contract

The main and renderer processes communicate only over IPC: the preload script exposes `window.api` via `contextBridge`, and the interface types are defined by `RendererApi` in `src/shared/types.ts`.

## Naming conventions

Channel names look like `domain:action`, for example:

- `nodeenv:deploy`, `npmenv:ensure`, `dsh:install`;
- `dsh:installed` / `dsh:versions` / `dsh:update` / `dsh:uninstall`, `update:check`;
- `versions:list` / `versions:use` / `versions:remove`;
- `install:cancel`;
- `models:info` / `models:balance`;
- `configdir:set` / `configdir:revert` / `configdir:migrate-run` / `configdir:migrate-cancel`;
- Events (main → renderer): `dsh:missing`, `configdir:migration`, `nodeenv:progress`, `npmenv:progress`, `install:progress`, etc.

## Adding an IPC: sync in three places

1. **`src/shared/types.ts`**: add the method signature to `RendererApi` (plus the event-subscription type);
2. **`src/preload/index.ts`**: forward the method to the corresponding `ipcRenderer.invoke` / `on`;
3. **`src/main/app/ipc.ts`**: register `ipcMain.handle` and implement the logic.

All three must agree, otherwise type-checking or runtime will fail.

## Major channel groups

| Group | Examples | Description |
|---|---|---|
| Settings | `settings:get` / `settings:save` / `settings:apply` / `settings:reset` | Read and write app settings |
| Config directory | `configdir:*` | Query / change / migrate / cancel |
| DeepSeek Harness | `dsh:*`, `versions:*`, `update:check` | Install / update / uninstall / query install state / list versions / switch |
| Environment | `nodeenv:*`, `npmenv:*` | Node / npm deployment, status, versions |
| Run control | `dsh:start` / `dsh:stop` / `dsh:restart` | Control the dsh service |
| Models | `models:info` / `models:balance` | Model list and current provider balance (keys never leave the main process) |
| App update | `appupdate:*` | Check / trigger / version slots / rollback |
| Terminal logs | `log:*` | Fetch and subscribe to dsh output |

> The complete channels and signatures are governed by `shared/types.ts` and `app/ipc.ts`.
