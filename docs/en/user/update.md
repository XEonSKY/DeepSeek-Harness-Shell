# App Update & Rollback

This app supports **background auto-update** and keeps one previous version for **one-click rollback**. The related interface is under “Settings → About”.

## How auto-update works

1. **Check**: once enabled, it silently checks for a new version at startup (whether pre-releases are included is controlled by “Check for test builds”);
2. **Background download**: when a new version exists, it downloads in the background without interrupting your work; progress can be seen on the About page;
3. **Restart prompt**: when the download finishes, a global prompt “Restart and install now” appears; alternatively it installs automatically when you quit later;
4. **Keep the old version**: before installing, the current version is **compressed and archived** (only the most recent one is kept) as the rollback source;
5. **Health guard**: if the new version fails repeatedly after starting, it automatically rolls back to the previous version.

## Manual update and rollback

- Under “Settings → About” you can manually trigger a check / update;
- “Roll back to previous version” immediately returns to the archived old version, suitable as an emergency measure when a new version has problems.

## Difference from kernel updates

| | Update target | Channel | Managed where |
|---|---|---|---|
| **App self-update** | This desktop shell | GitHub Releases | Settings → About |
| **Kernel update** | `@deepseek-ai/dsh` | npm registry | Settings → Kernel |

The two do not affect each other: when GitHub is unreachable, app self-update may fail while kernel updates still work, and vice versa.

## If an update gets stuck

- Check your network; if necessary, enter a public GitHub mirror prefix under “Settings → Network”;
- App updates and kernel updates use different channels and can be troubleshot separately;
- For more detailed troubleshooting see [FAQ](/en/user/faq).
