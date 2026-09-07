/**
 * 简体中文（zh-CN）文案目录。
 *
 * 结构：嵌套对象，叶子为字符串；占位符用 `{name}` 形式，由纯函数 t() / vue-i18n
 * 负责替换。本文件同时被 renderer(vue-i18n) 与 main(纯函数 t) 消费，保证两进程文案一致。
 */
export default {
  /** 应用外壳通用 */
  app: {
    title: 'DeepSeek Harness Shell',
    nav: {
      ui: 'DeepSeek UI',
      terminal: 'DeepSeek Harness 终端',
      settings: '设置'
    },
    reload: '重新加载',
    minimize: '最小化',
    maximize: '最大化 / 还原',
    closeHint: '关闭（隐藏到托盘或退出）'
  },
  /** 关闭行为询问（App 内 ElMessageBox） */
  closeAsk: {
    title: 'DeepSeek Harness Shell',
    text: '关闭窗口时希望做什么？',
    remember: '记住我的选择，下次不再询问',
    toTray: '隐藏到系统托盘',
    quit: '直接退出'
  },
  /** 内核未安装全屏遮罩 */
  kernelMissing: {
    title: '未安装 DeepSeek Harness 内核',
    desc: '未检测到 {pkg}（驱动本界面的命令行内核）。请选择镜像源并安装，安装完成后会自动启动。',
    registryNpmjs: '官方 registry.npmjs.org',
    registryNpmmirror: 'npmmirror 镜像 registry.npmmirror.com',
    install: '安装内核',
    quit: '退出'
  },
  /** 内核更新通知 */
  update: {
    okTitle: '已是最新',
    updateTitle: '发现新版本',
    missingTitle: '未安装 {pkg}',
    errorTitle: '检查更新',
    current: '当前版本',
    latest: '最新版本',
    checkFailedTitle: '检查更新失败'
  },
  /** 设置页 */
  settings: {
    language: '语言',
    locale: {
      system: '跟随系统',
      zh: '简体中文',
      en: 'English'
    }
  },
  /** 日志视图 */
  log: {
    title: 'DeepSeek Harness 进程输出（stdout / stderr）',
    lineCount: '{count} 行',
    autoScroll: '自动滚动',
    clear: '清空显示',
    empty: '（暂无输出。DeepSeek Harness 启动后，实时日志会出现在这里。）'
  },
  /** 设置页（sv = Settings View） */
  sv: {
    cap: '设置',
    nav: { general: '常规', appearance: '外观', dsh: '内核', about: '关于' },
    general: {
      run: '运行',
      workspace: '工作目录',
      workspacePlaceholder: '选择 DeepSeek Harness 的工作目录',
      browse: '选择…',
      workspaceHint: 'DeepSeek Harness 会在此目录启动，并作为默认文件系统位置。留空则用用户主目录。',
      port: '端口',
      portAuto: '自动（推荐）',
      portManual: '手动指定',
      portHint: '自动：从 3080 起自动挑选一个空闲端口，避免冲突。',
      closeBehavior: '关闭按钮行为',
      closeTray: '隐藏到系统托盘',
      closeQuit: '直接退出',
      askEvery: '每次询问',
      rememberChoice: '记住选择',
      askEveryHint: '开启「每次询问」：每次点关闭都会弹窗选择；关闭则直接按上面选择执行并记住。',
      reset: '恢复默认设置',
      resetTxt: '将所有配置恢复为默认值，并重启 DeepSeek Harness 应用默认运行配置。',
      resetBtn: '一键恢复默认'
    },
    appearance: {
      title: '外观',
      theme: '主题',
      themeSystem: '跟随系统',
      themeLight: '浅色',
      themeDark: '深色',
      radiusHint: '界面默认圆角为 8px；切换主题即时生效、无需重启。'
    },
    dsh: {
      kernelVersion: '内核版本',
      versionMissing: '未检测到（{pkg} 未安装？）',
      tagPre: '测试版',
      tagStable: '正式版',
      startup: '内核与启动',
      launcherPath: 'DeepSeek Harness 启动器路径（可选）',
      launcherPlaceholder: 'DeepSeek Harness 不在 PATH 时填写完整路径',
      launcherHint: '留空则从 PATH 查找 DeepSeek Harness。',
      timeout: '启动超时（毫秒）',
      timeoutHint: '等待 DeepSeek Harness 打印地址的最长时间。',
      applyTitle: '应用到 DeepSeek Harness',
      applyTxt: '工作目录、端口、启动器路径与超时等运行配置改动后，点右侧按钮重启 DeepSeek Harness 使其生效。外观、自动更新等即时生效，无需重启。',
      applyBtn: '应用到 DeepSeek Harness（重启）',
      kernelUpdate: '内核更新',
      checkOnStart: '启动时检查内核更新',
      checkOnStartDesc: '开启后，每次启动应用都会自动检查 DeepSeek Harness 内核是否有新版本。关闭后仅通过下方手动检查；检查不会自动安装，仅提示版本与升级命令。',
      checkPrerelease: '检查测试版',
      checkPrereleaseDesc: '开启后，会把预发布（rc / beta 等）也当作候选最新版本一并检查。顶部发现新版本时会以橙色显示测试版、以绿色显示正式版。',
      checkUpdateTitle: '检查 / 更新内核',
      checkUpdateDesc: '「检查」会对比 DeepSeek Harness 内核 {pkg} 是否可升级，并以右上角通知展示当前 / 最新版本；发现新版本后点「更新内核」实际执行 npm install -g 升级（进度见日志视图）。',
      check: '检查',
      update: '更新内核',
      versionMgmt: '版本管理',
      registry: 'npm 镜像源',
      registryNpmjs: '官方 registry.npmjs.org',
      registryNpmmirror: 'npmmirror 镜像 registry.npmmirror.com',
      registryHint: '用于版本列表、更新检查以及安装 / 卸载的网络源。',
      selectVersion: '选择要安装的版本',
      selectPlaceholder: '选择版本',
      currentSuffix: '（当前）',
      refresh: '刷新',
      installVersion: '安装此版本',
      versionListHint: '列表按「检查测试版」开关过滤：关闭只显示正式版，开启则包含预发布（rc / beta）版本。可安装任意历史版本来升级或回退。',
      uninstallTxt: '卸载将移除 {pkg}（会先停止运行中的 dsh）。卸载成功后会自动弹出安装引导。',
      uninstall: '卸载 DeepSeek Harness'
    },
    about: {
      appVersion: '应用版本',
      currentTag: '当前',
      autoUpdate: '自动更新',
      autoUpdateDesc: '启动时自动检查新版本，并在发现后于后台下载。',
      checkPrerelease: '检测测试版',
      checkPrereleaseDesc: '把预发布（rc / beta 等）也当作可更新的版本。',
      checkTitle: '自动更新',
      checkBtn: '检查更新',
      checking: '正在检查更新…',
      downloading: '正在后台下载 {version}…',
      downloadedTitle: '新版本已下载',
      downloadedDesc: '重启后将自动安装，也可点击右侧立即重启。',
      restartNow: '立即重启并安装',
      notAvailable: '已是最新版本。',
      unavailable: '当前无可用更新。'
    }
  },
  /** 即时反馈（ElMessage / ElMessageBox 内文案） */
  msg: {
    saveFail: '自动保存失败：{err}',
    applyOk: '已应用，DeepSeek Harness 正在按新配置重启。',
    applyFail: '应用失败：{err}',
    resetOk: '已恢复默认设置。',
    resetFail: '恢复默认失败：{err}',
    installFail: '安装失败：{err}',
    uninstallFail: '卸载失败：{err}',
    uninstallOk: '已卸载内核，将引导重新安装。',
    updateKernelFail: '内核更新失败：{err}',
    checkFailed: '检查更新失败。',
    updateAvailable: '发现新版本。',
    upToDate: '已是最新版本。',
    uninstallBoxTitle: '卸载内核',
    uninstallBoxText: '将卸载 DeepSeek Harness 内核（{pkg}），并先停止运行中的 dsh。卸载后需要重新安装才能使用。确定继续吗？',
    uninstallOkBtn: '卸载',
    cancelBtn: '取消'
  },
  /** main 进程文案（kernel/updater/托盘/对话框） */
  m: {
    kernel: {
      missingMsg: '未安装 @deepseek-ai/dsh（DeepSeek Harness 命令行工具）',
      noVersion: '无法读取已安装的 @deepseek-ai/dsh 版本',
      registryUnreachable: '当前 {version}；无法连接 npm registry 检查更新',
      noComparable: '当前暂无可比较的适用版本。',
      upToDate: '@deepseek-ai/dsh 已是最新版本 {version}',
      newKind: '发现新{kind}：{current} → {latest}',
      preKind: '测试版',
      stableKind: '正式版',
      busy: '内核操作正在进行中，请稍候。',
      updateOk: '内核已更新到 {version}。',
      updateFail: '内核更新失败：{tail}',
      installNoVersions: '无法连接 npm 仓库，未能获取版本。',
      installNone: '暂无可安装的版本。',
      installOk: '内核已安装到 {version}。',
      installFail: '内核安装失败：{tail}',
      uninstallFail: '卸载失败：{tail}',
      uninstallOk: '已卸载 @deepseek-ai/dsh。'
    },
    appUpdate: {
      noneReleased: '仓库尚未发布任何版本。',
      httpErr: '检查更新失败（GitHub HTTP {status}）。',
      latestReadFail: '最新版本号读取失败。',
      foundNew: '发现新版本 {current} → {latest}',
      upToDate: '已是最新版本 {latest}。',
      netErr: '检查更新失败，无法连接 GitHub。',
      onlyPackaged: '仅打包安装的应用支持自动更新。'
    },
    tray: {
      showHide: '显示 / 隐藏窗口',
      quitDsh: '退出（同时结束 dsh）'
    },
    dialogs: {
      workspaceMissingTitle: '工作目录缺失',
      workspaceMissing: '配置的工作目录不存在：\n{path}\n\nDeepSeek Harness 将改用用户主目录启动。',
      startFailedTitle: 'DeepSeek Harness Shell 无法启动'
    }
  }
}
