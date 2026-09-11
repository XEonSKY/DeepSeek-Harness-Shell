# IPC contract

The main and renderer processes communicate only over IPC: the preload script exposes `window.api` via `contextBridge`, and the interface types are defined by `RendererApi` in `src/shared/types.ts`.

## Naming conventions

Channel names look like `domain:action`, for example:

- `nodeenv:deploy`, `npmenv:ensure`, `kernel:install`;
- `versions:list` / `versions:use` / `versions:remove`;
- `install:cancel`;
- `configdir:set` / `configdir:revert` / `configdir:migrate-run` / `configdir:migrate-cancel`;
- Events (main → renderer): `configdir:migration`, `nodeenv:progress`, `npmenv:progress`, `install:progress`, etc.

## Adding an IPC: sync in three places

1. **`src/shared/types.ts`**: add the method signature to `RendererApi` (plus the event-subscription type);
2. **`src/preload/index.ts`**: forward the method to the corresponding `ipcRenderer.invoke` / `on`;
3. **`src/main/app/ipc.ts`**: register `ipcMain.handle` and implement the logic.

All three must agree, otherwise type-checking or runtime will fail.

## Major channel groups

| Group | Examples | Description |
|---|---|---|
| Settings | `settings:get` / `settings:set` / `settings:reset` | Read and write app settings |
| Config directory | `configdir:*` | Query / change / migrate / cancel |
| Kernel | `kernel:*`, `versions:*` | Install / update / uninstall / list versions / switch |
| Environment | `nodeenv:*`, `npmenv:*` | Node / npm deployment, status, versions |
| Run control | `dsh:start` / `dsh:stop` / `dsh:restart` | Control the dsh service |
| App update | `appupdate:*` | Check / trigger / version slots / rollback |
| Terminal logs | `log:*` | Fetch and subscribe to dsh output |

> The complete channels and signatures are governed by `shared/types.ts` and `app/ipc.ts`.
