# Kernel (@deepseek-ai/dsh) management

The app manages the kernel `@deepseek-ai/dsh`, which powers the DeepSeek Harness Web UI.

## Common operations

### First install
When no kernel is detected, an install wizard appears. You can choose the registry, whether to include pre-releases, and a specific version, then install in one click.

### Upgrade / switch version
In **Settings → Kernel**:

- **Check / update kernel**: compare with the latest and click “Update kernel” to upgrade.
- **Version management**: refresh the version list (filtered by “include pre-releases” and the registry), pick a historical version to install / switch (upgrade or downgrade).

Upgrades and switches **safely stop dsh first** (asking if one is running), then restart automatically on success to run the target version; on failure the app tries to restore the previous running state and reports the reason.

### Uninstall
Click “Uninstall kernel” to stop dsh and remove it, then the install wizard reappears. If the uninstall fails, the app detects why the directory is occupied (still referenced by a process, read-only, or blocked by security software) and informs you.

## Network & registry

Kernel version listing, update checks and install / uninstall all use npm. The default is the official `registry.npmjs.org`; in some regions you can switch to the `npmmirror` mirror.

## Difference from app self-update

- **Kernel update**: updates `@deepseek-ai/dsh` (npm), managed on the Kernel page.
- **App self-update**: updates the shell app itself (GitHub releases), managed on the About page.
