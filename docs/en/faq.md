# FAQ

## Launch error: `the value for "version" in ~/.dsh/.credentials.yaml must be a string`

This is a dsh kernel config-read failure, not an app bug. Usually the **top-level** `version` in `.credentials.yaml` is a number.

Fix: edit `C:\Users\<you>\.dsh\.credentials.yaml` (or your home equivalent) and make the first line a quoted string:

```yaml
version: "1"
```

Save and relaunch. The inner `payload.version` does not need changing.

## Stuck on the loading spinner, the UI never appears

The app resolves the address from dsh printing `dsh web: <url>`. If there is no URL for a while:

- check the **Terminal** for dsh errors (Settings → Terminal, or `Ctrl`/`Cmd` + `T`);
- check whether the chosen port is busy (it scans upward for a free one);
- confirm the kernel is installed and the working directory exists and is readable.

## F12 console does nothing

Enable **Developer mode** first: Settings → About → turn on “Developer mode”. It is off by default to avoid accidental use.

## Why “stop dsh” before upgrade / uninstall

On Windows a running dsh locks the kernel module files, blocking replacement/removal. The app stops it first; if a process still holds the files, it detects and asks you to close it.

## Update check fails / cannot connect

- Check your network; in Settings switch the kernel registry to `npmmirror` and retry.
- App and kernel updates use different channels (GitHub / npm). If GitHub is unreachable, the app self-update may fail while the kernel update still works.

## I want multiple instances

It is **single-instance** by default: relaunching focuses the existing window instead of opening another. (Different working-directory/port setups may need to disable the current default concurrency guard.)

## Still stuck?

Include the log from the **Terminal** (Settings → Terminal) plus the app version and kernel version when reporting to the maintainers.
