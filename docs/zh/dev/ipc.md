# IPC 契约

main 与 renderer 之间只通过 IPC 通信：预加载脚本用 `contextBridge` 暴露 `window.api`，接口类型定义在 `src/shared/types.ts` 的 `RendererApi`。

## 命名约定

通道名形如 `domain:action`，例如：

- `nodeenv:deploy`、`npmenv:ensure`、`kernel:install`；
- `versions:list` / `versions:use` / `versions:remove`；
- `install:cancel`；
- `configdir:set` / `configdir:revert` / `configdir:migrate-run` / `configdir:migrate-cancel`；
- 事件（主 → 渲染）：`configdir:migration`、`nodeenv:progress`、`npmenv:progress`、`install:progress` 等。

## 新增一个 IPC：三处同步

1. **`src/shared/types.ts`**：在 `RendererApi` 上添加方法签名（以及事件订阅类型）；
2. **`src/preload/index.ts`**：把该方法转发到对应的 `ipcRenderer.invoke` / `on`；
3. **`src/main/app/ipc.ts`**：注册 `ipcMain.handle` 并实现逻辑。

三处版本必须一致，否则类型检查或运行时会报错。

## 主要通道分组

| 分组 | 例子 | 说明 |
|---|---|---|
| 设置 | `settings:get` / `settings:set` / `settings:reset` | 读写应用设置 |
| 配置目录 | `configdir:*` | 查询 / 更改 / 迁移 / 取消 |
| 内核 | `kernel:*`、`versions:*` | 安装 / 更新 / 卸载 / 列版本 / 切换 |
| 环境 | `nodeenv:*`、`npmenv:*` | Node / npm 部署、状态、版本 |
| 运行控制 | `dsh:start` / `dsh:stop` / `dsh:restart` | 控制 dsh 服务 |
| 应用更新 | `appupdate:*` | 检查 / 触发 / 版本槽 / 回退 |
| 终端日志 | `log:*` | 拉取与订阅 dsh 输出 |

> 完整的通道与签名以 `shared/types.ts` 与 `app/ipc.ts` 为准。