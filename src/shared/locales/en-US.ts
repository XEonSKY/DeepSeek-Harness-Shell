/**
 * English (en-US) message catalog.
 *
 * Same nested structure as zh-CN; leaves are strings, `{name}` placeholders are
 * substituted by t() / vue-i18n. Kept structurally identical to zh-CN.ts.
 */
export default {
  app: {
    title: 'DeepSeek Harness Shell',
    nav: {
      ui: 'DeepSeek UI',
      terminal: 'DeepSeek Harness Terminal',
      settings: 'Settings'
    },
    reload: 'Reload',
    minimize: 'Minimize',
    maximize: 'Maximize / Restore',
    closeHint: 'Close (hide to tray or quit)'
  },
  closeAsk: {
    title: 'DeepSeek Harness Shell',
    text: 'What should happen when the window closes?',
    remember: 'Remember my choice and stop asking',
    toTray: 'Hide to system tray',
    quit: 'Quit'
  },
  kernelMissing: {
    title: 'DeepSeek Harness kernel not installed',
    desc: '{pkg} (the CLI kernel that powers this UI) was not found. Choose a registry and install it; DeepSeek Harness will start automatically afterwards.',
    registryNpmjs: 'Official registry.npmjs.org',
    registryNpmmirror: 'npmmirror mirror registry.npmmirror.com',
    install: 'Install kernel',
    quit: 'Quit'
  },
  update: {
    okTitle: 'Up to date',
    updateTitle: 'Update available',
    missingTitle: '{pkg} not installed',
    errorTitle: 'Check for updates',
    current: 'Current version',
    latest: 'Latest version',
    checkFailedTitle: 'Update check failed'
  },
  settings: {
    language: 'Language',
    locale: {
      system: 'Follow system',
      zh: '简体中文',
      en: 'English'
    }
  },
  log: {
    title: 'DeepSeek Harness process output (stdout / stderr)',
    lineCount: '{count} lines',
    autoScroll: 'Auto-scroll',
    clear: 'Clear',
    empty: '(No output yet. Live logs will appear here once DeepSeek Harness starts.)'
  },
  sv: {
    cap: 'Settings',
    nav: { general: 'General', appearance: 'Appearance', dsh: 'Kernel', about: 'About' },
    general: {
      run: 'Run',
      workspace: 'Working directory',
      workspacePlaceholder: 'Choose a working directory for DeepSeek Harness',
      browse: 'Browse…',
      workspaceHint: 'DeepSeek Harness will start in this directory and use it as the default file-system location. Leave empty to use your home directory.',
      port: 'Port',
      portAuto: 'Auto (recommended)',
      portManual: 'Manual',
      portHint: 'Auto: pick the first free port starting at 3080 to avoid conflicts.',
      closeBehavior: 'Close button behavior',
      closeTray: 'Hide to system tray',
      closeQuit: 'Quit',
      askEvery: 'Ask each time',
      rememberChoice: 'Remember choice',
      askEveryHint: 'With “Ask each time” on, closing always shows a prompt; off applies the choice above and remembers it.',
      reset: 'Restore default settings',
      resetTxt: 'Restore every setting to its default and restart DeepSeek Harness with the default runtime config.',
      resetBtn: 'Restore defaults'
    },
    appearance: {
      title: 'Appearance',
      theme: 'Theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      radiusHint: 'Default corner radius is 8px; switching the theme takes effect immediately without a restart.'
    },
    dsh: {
      kernelVersion: 'Kernel version',
      versionMissing: 'Not detected ({pkg} not installed?)',
      tagPre: 'Pre-release',
      tagStable: 'Stable',
      startup: 'Kernel & startup',
      launcherPath: 'DeepSeek Harness launcher path (optional)',
      launcherPlaceholder: 'Full path when DeepSeek Harness is not on PATH',
      launcherHint: 'Leave empty to look up DeepSeek Harness on PATH.',
      timeout: 'Startup timeout (ms)',
      timeoutHint: 'How long to wait for DeepSeek Harness to print its address.',
      applyTitle: 'Apply to DeepSeek Harness',
      applyTxt: 'After editing run settings such as working directory, port, launcher path and timeout, restart DeepSeek Harness with the button on the right to apply them. Appearance and auto-update settings take effect immediately without a restart.',
      applyBtn: 'Apply to DeepSeek Harness (restart)',
      kernelUpdate: 'Kernel updates',
      checkOnStart: 'Check kernel updates on startup',
      checkOnStartDesc: 'When on, the app automatically checks for a newer DeepSeek Harness kernel every time it starts. When off, only use the manual check below; checking never installs automatically, it only shows the version and upgrade command.',
      checkPrerelease: 'Include pre-releases',
      checkPrereleaseDesc: 'When on, pre-releases (rc / beta / …) are also treated as candidate latest versions when checking. New versions show in orange for pre-releases and green for stable releases.',
      checkUpdateTitle: 'Check / update kernel',
      checkUpdateDesc: '“Check” compares whether the DeepSeek Harness kernel {pkg} can be upgraded and shows current / latest versions in a top-right notification; after finding a new version, “Update kernel” actually runs npm install -g (progress is shown in the log view).',
      check: 'Check',
      update: 'Update kernel',
      versionMgmt: 'Version management',
      registry: 'npm registry',
      registryNpmjs: 'Official registry.npmjs.org',
      registryNpmmirror: 'npmmirror mirror registry.npmmirror.com',
      registryHint: 'Network source used for the version list, update check and install / uninstall.',
      selectVersion: 'Choose a version to install',
      selectPlaceholder: 'Select version',
      currentSuffix: ' (current)',
      refresh: 'Refresh',
      installVersion: 'Install this version',
      versionListHint: 'The list is filtered by the “Include pre-releases” switch: off shows stable versions only, on also includes pre-releases (rc / beta). You can install any historical version to upgrade or downgrade.',
      uninstallTxt: 'Uninstalling removes {pkg} (stopping any running dsh first). After a successful uninstall the install wizard will be shown.',
      uninstall: 'Uninstall DeepSeek Harness'
    },
    about: {
      appVersion: 'App version',
      currentTag: 'Current',
      autoUpdate: 'Automatic updates',
      autoUpdateDesc: 'Check for a new version on startup and download it in the background when one is found.',
      checkPrerelease: 'Include pre-releases',
      checkPrereleaseDesc: 'Treat pre-releases (rc / beta / …) as updatable versions too.',
      checkTitle: 'Automatic updates',
      checkBtn: 'Check for updates',
      checking: 'Checking for updates…',
      downloading: 'Downloading {version} in the background…',
      downloadedTitle: 'New version downloaded',
      downloadedDesc: 'It will install automatically after restart, or you can restart now with the button on the right.',
      restartNow: 'Restart & install now',
      notAvailable: 'Already up to date.',
      unavailable: 'No update available right now.'
    }
  },
  msg: {
    saveFail: 'Auto-save failed: {err}',
    applyOk: 'Applied — DeepSeek Harness is restarting with the new configuration.',
    applyFail: 'Apply failed: {err}',
    resetOk: 'Settings restored to defaults.',
    resetFail: 'Restore failed: {err}',
    installFail: 'Install failed: {err}',
    uninstallFail: 'Uninstall failed: {err}',
    uninstallOk: 'Kernel uninstalled. The install wizard will be shown.',
    updateKernelFail: 'Kernel update failed: {err}',
    checkFailed: 'Update check failed.',
    updateAvailable: 'A new version is available.',
    upToDate: 'Already up to date.',
    uninstallBoxTitle: 'Uninstall kernel',
    uninstallBoxText: 'This uninstalls the DeepSeek Harness kernel ({pkg}) and stops any running dsh first. You will need to reinstall it to use DeepSeek Harness again. Continue?',
    uninstallOkBtn: 'Uninstall',
    cancelBtn: 'Cancel'
  },
  m: {
    kernel: {
      missingMsg: '@deepseek-ai/dsh is not installed (the DeepSeek Harness CLI tool)',
      noVersion: 'Could not read the installed @deepseek-ai/dsh version',
      registryUnreachable: 'Currently {version}; cannot reach the npm registry to check for updates',
      noComparable: 'No comparable eligible version is available right now.',
      upToDate: '@deepseek-ai/dsh is already the latest version {version}',
      newKind: 'New {kind} found: {current} → {latest}',
      preKind: 'pre-release',
      stableKind: 'stable release',
      busy: 'A kernel operation is already in progress, please wait.',
      updateOk: 'Kernel updated to {version}.',
      updateFail: 'Kernel update failed: {tail}',
      installNoVersions: 'Could not reach the npm registry to fetch versions.',
      installNone: 'No installable version is available.',
      installOk: 'Kernel installed to {version}.',
      installFail: 'Kernel install failed: {tail}',
      uninstallFail: 'Uninstall failed: {tail}',
      uninstallOk: '@deepseek-ai/dsh uninstalled.'
    },
    appUpdate: {
      noneReleased: 'This repository has not published any releases yet.',
      httpErr: 'Update check failed (GitHub HTTP {status}).',
      latestReadFail: 'Could not read the latest version.',
      foundNew: 'New version found: {current} → {latest}',
      upToDate: 'Already the latest version {latest}.',
      netErr: 'Update check failed, could not reach GitHub.',
      onlyPackaged: 'Automatic updates are only supported in packaged builds.'
    },
    tray: {
      showHide: 'Show / hide window',
      quitDsh: 'Quit (also stop dsh)'
    },
    dialogs: {
      workspaceMissingTitle: 'Working directory missing',
      workspaceMissing: 'The configured working directory does not exist:\n{path}\n\nDeepSeek Harness will start in your home directory instead.',
      startFailedTitle: 'DeepSeek Harness Shell could not start'
    }
  }
}
