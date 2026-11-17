// Agnes 生图插件 · Client 入口
// 1) 侧栏「生图」入口 + 主面板（提示词 / 模型 / 尺寸 / 比例 / 结果 / 历史）
// 2) 设置页（API Base URL、API Key 加密保存、默认参数、输出目录、诊断）
// 3) 对话里的工具卡片（agnes_image_generate 的图片展示）
// 只 require('react')；样式全部走 --dsw-alias-* 主题变量。

window.__ModuleLoader__.load({
  id: '@tianxie2026/agnes-image-gen',
  factory(require) {
    const React = require('react')
    const { createElement: h, useCallback, useEffect, useMemo, useRef, useState } = React

    const PKG = '@tianxie2026/agnes-image-gen'
    const NS = 'agnes-image-gen'
    const PANEL_ID = 'agnes-image-gen'
    const SECTION_ID = 'agnes-image'
    const ROUTE_PREFIX = '/agnes-image-gen'
    const MAX_REFERENCES = 4
    const ZOOM_MIN = 0.25
    const ZOOM_MAX = 8

    // 「发到会话」用：apply 时注入 layout 服务，点击时切回对话面板
    let layoutService = null
    function goConversation() {
      try {
        layoutService?.selectPanel?.('conversation')
      } catch {
        // 面板切换失败不影响已复制的图片
      }
    }

    // ------------------------------------------------------------- 文案（内置 zh/en，locale 服务只用来切换）
    const ZH = {
      nav: '生图',
      panelTitle: '生图',
      panelSubtitle: '输入提示词，选模型与比例。结果会显示在这里，并按设置落盘。',
      statusReady: '已就绪',
      statusUnconfigured: '未完成配置',
      setupTitle: '先完成配置',
      setupHint: '填入 API Base URL 与 API Key。Key 会用 Windows DPAPI 加密保存，不会以明文写入配置文件。',
      baseUrlLabel: 'API Base URL',
      baseUrlPlaceholder: 'https://api.agnes-ai.cn/v1',
      keyLabel: 'API Key',
      keyPlaceholder: '粘贴密钥（加密保存）',
      save: '保存',
      saveKey: '保存 Key',
      clearKey: '清除 Key',
      keySaved: '已加密保存',
      keyCleared: '已清除',
      keyStateSealed: '已加密保存（DPAPI）',
      keyStateEnv: '来自环境变量',
      keyStateNone: '未配置',
      keyStateUnreadable: '已保存但解密失败',
      keyStateLegacy: '检测到旧版明文 Key（启动时会自动迁移）',
      promptLabel: '提示词',
      promptPlaceholder: '描述画面：主体、场景、风格、光照、构图、画质…',
      modelLabel: '模型',
      sizeLabel: '尺寸',
      ratioLabel: '比例',
      pixels: '约 {w}×{h} 像素',
      generate: '生成',
      cancel: '取消',
      clear: '清空',
      running: '生成中…',
      cancelling: '正在取消…',
      elapsed: '已完成 · {s} 秒',
      failed: '生成失败',
      openFolder: '打开文件夹',
      download: '下载',
      copyPath: '复制路径',
      copied: '已复制',
      regenerate: '再来一张',
      recent: '最近生成',
      noHistory: '输出目录里还没有图片。',
      emptyResult: '生成结果会显示在这里。',
      testConnection: '测试连接',
      testing: '测试中…',
      testOk: '连接正常，{n} 个模型可用。',
      defaults: '默认参数',
      timeoutLabel: '超时（秒）',
      outputDirLabel: '输出目录',
      saveSettings: '保存设置',
      saved: '已保存',
      diagnostics: '诊断',
      diagCredentials: '凭据服务',
      diagDpapi: 'DPAPI 加密',
      diagLegacy: '旧版明文 Key',
      available: '可用',
      unavailable: '不可用',
      yes: '有',
      no: '无',
      settingsTitle: '生图',
      settingsHint: '这些设置只影响生图插件。密钥用 Windows DPAPI（当前用户）加密后存进 DSH 凭据库。',
      dpapiNote: '密钥不会以明文写入插件配置或凭据文件。',
      promptHistory: '历史提示词',
      retry: '重试',
      close: '关闭',
      preview: '预览',
      loadFailed: '图片加载失败',
      generating: '生成中',
      saveFailed: '保存失败',
      configSaved: '配置已保存',
      needBaseUrl: '请先填写 API Base URL。',
      cancelled: '已取消',
      notSaved: '未落盘（save=false）',
      sourceLabel: '来源',
      defaultSource: '默认',
      noSources: '还没有 API 来源。先在设置 → 生图 → API 来源 里添加一个。',
      needSourceKey: '这个来源还没有 API Key，去设置里填一下。',
      sourcesTitle: 'API 来源',
      sourcesHint: '可以添加多个 Base URL + Key，生成时选择用哪个；不选就用默认来源。',
      addSource: '添加来源',
      sourceName: '名称（可选）',
      sourceNamePlaceholder: '例如 Agnes 官方',
      saveSource: '保存来源',
      sourceSaved: '来源已保存',
      sourceRemoved: '来源已删除',
      removeSource: '删除来源',
      confirmRemove: '再点一次删除',
      setDefault: '设为默认',
      isDefault: '默认来源',
      testThis: '测试',
      optimizing: '优化中…',
      optimizePrompt: '优化提示词',
      optimized: '已优化',
      undoOptimize: '撤销',
      optimizeHint: '用同一来源的对话模型扩写提示词，是否采用由你决定。',
      optimizeModel: '提示词优化模型',
      removeHistory: '删除这条',
      clearHistory: '清空历史',
      deleteImage: '删除图片',
      confirmDelete: '再点一次删除',
      deleted: '已删除',
      deleteFailed: '删除失败',
      legacySources: '检测到旧版 Base URL，启动时会自动迁移为来源',
      defaultSourceLabel: '默认来源',
      defaultModelLabel: '默认画图模型',
      chooseFolder: '选择…',
      effectiveDir: '当前生效',
      defaultDirHint: '未设置时默认：{path}',
      freeSpace: '空闲 {free}',
      usingDefaultDir: '未设置时使用默认目录',
      pickFailed: '打开目录选择框失败',
      tabCreate: '画图',
      tabGallery: '图库',
      openGallery: '打开图库',
      galleryTitle: '历史图片',
      galleryHint: '按日期分组；勾选后可以批量删除。',
      groupToday: '今天',
      groupYesterday: '昨天',
      groupCount: '{n} 张',
      selectAll: '全选',
      clearSelection: '清除选择',
      selectedCount: '已选 {n} 张',
      deleteSelected: '删除选中',
      confirmDeleteSelected: '再点一次删除 {n} 张',
      batchDeleted: '已删除 {n} 张',
      batchFailed: '{n} 张删除失败',
      refresh: '刷新',
      noGallery: '还没有历史图片。',
      goCreate: '去画一张',
      saveAs: '另存为',
      copyImage: '复制图片',
      sendToConversation: '发到会话',
      copyPrompt: '复制提示词',
      copyFailed: '复制失败',
      copiedForConversation: '已复制图片，粘贴到输入框即可',
      promptMissing: '这张图片没有留下提示词（旧版本生成的图片）。',
      revisedPrompt: '修订后的提示词',
      pixelsLabel: '像素',
      elapsedLabel: '耗时',
      bytesLabel: '体积',
      createdAt: '生成时间',
      fileName: '文件名',
      useAsReference: '用作参考图',
      zoomIn: '放大',
      zoomOut: '缩小',
      zoomReset: '原始大小',
      referenceTitle: '参考图',
      referenceHint: '图生图会把这些图一起发给模型（最多 {n} 张）。',
      clearReferences: '清空参考图',
      maxReferences: '最多 {n} 张参考图',
    }
    const EN = {
      nav: 'Image',
      panelTitle: 'Image generation',
      panelSubtitle: 'Describe the image, pick a model and ratio. Results appear here and are saved to disk.',
      statusReady: 'Ready',
      statusUnconfigured: 'Not configured',
      setupTitle: 'Set up first',
      setupHint: 'Enter the API base URL and API key. The key is encrypted with Windows DPAPI and never written in plain text.',
      baseUrlLabel: 'API base URL',
      baseUrlPlaceholder: 'https://api.agnes-ai.cn/v1',
      keyLabel: 'API key',
      keyPlaceholder: 'Paste the key (encrypted at rest)',
      save: 'Save',
      saveKey: 'Save key',
      clearKey: 'Clear key',
      keySaved: 'Saved (encrypted)',
      keyCleared: 'Cleared',
      keyStateSealed: 'Saved (DPAPI encrypted)',
      keyStateEnv: 'From environment variable',
      keyStateNone: 'Not set',
      keyStateUnreadable: 'Saved but cannot decrypt',
      keyStateLegacy: 'Legacy plaintext key found (auto-migrated on start)',
      promptLabel: 'Prompt',
      promptPlaceholder: 'Subject, scene, style, lighting, composition, quality…',
      modelLabel: 'Model',
      sizeLabel: 'Size',
      ratioLabel: 'Ratio',
      pixels: 'about {w}×{h} px',
      generate: 'Generate',
      cancel: 'Cancel',
      clear: 'Clear',
      running: 'Generating…',
      cancelling: 'Cancelling…',
      elapsed: 'Done · {s}s',
      failed: 'Generation failed',
      openFolder: 'Open folder',
      download: 'Download',
      copyPath: 'Copy path',
      copied: 'Copied',
      regenerate: 'One more',
      recent: 'Recent',
      noHistory: 'No images in the output folder yet.',
      emptyResult: 'Results appear here.',
      testConnection: 'Test connection',
      testing: 'Testing…',
      testOk: 'Connected, {n} models available.',
      defaults: 'Defaults',
      timeoutLabel: 'Timeout (s)',
      outputDirLabel: 'Output folder',
      saveSettings: 'Save settings',
      saved: 'Saved',
      diagnostics: 'Diagnostics',
      diagCredentials: 'Credential service',
      diagDpapi: 'DPAPI encryption',
      diagLegacy: 'Legacy plaintext key',
      available: 'available',
      unavailable: 'unavailable',
      yes: 'yes',
      no: 'no',
      settingsTitle: 'Image generation',
      settingsHint: 'These settings only affect the image plugin. The key is encrypted with Windows DPAPI (current user) before it is stored.',
      dpapiNote: 'The key is never written to plugin config or credential files in plain text.',
      promptHistory: 'Prompt history',
      retry: 'Retry',
      close: 'Close',
      preview: 'Preview',
      loadFailed: 'Could not load image',
      generating: 'Generating',
      saveFailed: 'Save failed',
      configSaved: 'Settings saved',
      needBaseUrl: 'Enter the API base URL first.',
      cancelled: 'Cancelled',
      notSaved: 'Not saved (save=false)',
      sourceLabel: 'Source',
      defaultSource: 'default',
      noSources: 'No API source yet. Add one under Settings → Image → API sources.',
      needSourceKey: 'This source has no API key yet. Add it in Settings.',
      sourcesTitle: 'API sources',
      sourcesHint: 'Add one or more base URLs with keys. Pick one when generating; without a choice the default source is used.',
      addSource: 'Add source',
      sourceName: 'Name (optional)',
      sourceNamePlaceholder: 'e.g. Agnes official',
      saveSource: 'Save source',
      sourceSaved: 'Source saved',
      sourceRemoved: 'Source deleted',
      removeSource: 'Delete source',
      confirmRemove: 'Click again to delete',
      setDefault: 'Make default',
      isDefault: 'Default source',
      testThis: 'Test',
      optimizing: 'Improving…',
      optimizePrompt: 'Improve prompt',
      optimized: 'Improved',
      undoOptimize: 'Undo',
      optimizeHint: 'Rewrites the prompt with a chat model from the same source. You decide whether to use it.',
      optimizeModel: 'Prompt optimizer model',
      removeHistory: 'Remove',
      clearHistory: 'Clear history',
      deleteImage: 'Delete image',
      confirmDelete: 'Click again to delete',
      deleted: 'Deleted',
      deleteFailed: 'Delete failed',
      legacySources: 'Legacy base URL detected; it is migrated to a source on start',
      defaultSourceLabel: 'Default source',
      defaultModelLabel: 'Default image model',
      chooseFolder: 'Choose…',
      effectiveDir: 'Effective',
      defaultDirHint: 'Default when unset: {path}',
      freeSpace: '{free} free',
      usingDefaultDir: 'Uses the default folder',
      pickFailed: 'Could not open the folder picker',
      tabCreate: 'Create',
      tabGallery: 'Gallery',
      openGallery: 'Open gallery',
      galleryTitle: 'History',
      galleryHint: 'Grouped by date; tick images to delete them in bulk.',
      groupToday: 'Today',
      groupYesterday: 'Yesterday',
      groupCount: '{n} images',
      selectAll: 'Select all',
      clearSelection: 'Clear selection',
      selectedCount: '{n} selected',
      deleteSelected: 'Delete selected',
      confirmDeleteSelected: 'Click again to delete {n}',
      batchDeleted: 'Deleted {n}',
      batchFailed: '{n} failed to delete',
      refresh: 'Refresh',
      noGallery: 'No images yet.',
      goCreate: 'Create one',
      saveAs: 'Save as',
      copyImage: 'Copy image',
      sendToConversation: 'Send to chat',
      copyPrompt: 'Copy prompt',
      copyFailed: 'Copy failed',
      copiedForConversation: 'Image copied — paste it into the input box',
      promptMissing: 'No prompt was recorded for this image (generated by an older version).',
      revisedPrompt: 'Revised prompt',
      pixelsLabel: 'Pixels',
      elapsedLabel: 'Elapsed',
      bytesLabel: 'Size',
      createdAt: 'Created',
      fileName: 'File',
      useAsReference: 'Use as reference',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      zoomReset: 'Actual size',
      referenceTitle: 'References',
      referenceHint: 'Image-to-image sends these along with the prompt (up to {n}).',
      clearReferences: 'Clear references',
      maxReferences: 'Up to {n} references',
    }

    // ------------------------------------------------------------- 样式
    const css = {
      panel: {
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'auto',
        padding: '28px 32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        font: 'inherit',
      },
      header: { display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
      h1: { margin: 0, fontSize: 20, fontWeight: 600 },
      sub: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      chip: {
        marginLeft: 'auto',
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l2)',
        color: 'var(--dsw-alias-label-secondary)',
      },
      chipReady: {
        marginLeft: 'auto',
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-state-success-primary)',
        color: 'var(--dsw-alias-state-success-primary)',
      },
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      label: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
      },
      textarea: {
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 96,
        resize: 'vertical',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        lineHeight: 1.5,
      },
      row: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
      field: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120, flex: '1 1 120px' },
      primary: {
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-base)',
        font: 'inherit',
        cursor: 'pointer',
      },
      secondary: {
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        cursor: 'pointer',
      },
      small: {
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      },
      disabled: { opacity: 0.5, cursor: 'not-allowed' },
      error: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, whiteSpace: 'pre-wrap' },
      warn: { color: 'var(--dsw-alias-state-warn-primary)', fontSize: 12 },
      ok: { color: 'var(--dsw-alias-state-success-primary)', fontSize: 12 },
      muted: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 },
      preview: {
        width: '100%',
        maxWidth: 560,
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l1)',
        display: 'block',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      thumbs: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 },
      thumb: {
        width: 88,
        height: 88,
        flex: '0 0 auto',
        objectFit: 'cover',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l1)',
        cursor: 'pointer',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      overlay: {
        position: 'fixed',
        inset: 0,
        background: 'var(--dsw-alias-bg-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        zIndex: 2000,
        padding: 24,
      },
      overlayImage: { maxWidth: '92vw', maxHeight: '84vh', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1)' },
      viewer: {
        position: 'fixed',
        inset: 0,
        background: 'var(--dsw-alias-bg-overlay)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: 16,
        zIndex: 2000,
        padding: 24,
        flexWrap: 'wrap',
      },
      viewerStage: {
        position: 'relative',
        flex: '1 1 420px',
        minWidth: 260,
        minHeight: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        touchAction: 'none',
      },
      viewerImage: {
        maxWidth: '100%',
        maxHeight: '100%',
        userSelect: 'none',
        cursor: 'grab',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      viewerToolbar: {
        position: 'absolute',
        left: 12,
        bottom: 12,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-overlay)',
        border: '1px solid var(--dsw-alias-border-l2)',
        fontSize: 12,
      },
      viewerSide: {
        flex: '0 1 340px',
        minWidth: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'auto',
        padding: 16,
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        color: 'var(--dsw-alias-label-primary)',
      },
      promptBox: {
        margin: 0,
        padding: 10,
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        fontSize: 12,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 200,
        overflow: 'auto',
        color: 'var(--dsw-alias-label-primary)',
      },
      infoRow: { display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.6 },
      infoKey: { flex: '0 0 76px', color: 'var(--dsw-alias-label-secondary)' },
      infoValue: { flex: '1 1 auto', wordBreak: 'break-all' },
      refRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
      refItem: {
        position: 'relative',
        width: 72,
        height: 72,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        flex: '0 0 auto',
      },
      refImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      refRemove: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 22,
        height: 22,
        padding: 0,
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        lineHeight: 1,
        cursor: 'pointer',
      },
      shelfRow: { display: 'flex', gap: 8, alignItems: 'center' },
      meta: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-all' },
      chips: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
      chipItem: {
        display: 'inline-flex',
        alignItems: 'stretch',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l2)',
        overflow: 'hidden',
        maxWidth: 260,
      },
      chipPick: {
        padding: '3px 8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      chipRemove: {
        padding: '3px 8px',
        border: 'none',
        borderLeft: '1px solid var(--dsw-alias-border-l1)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12,
        minWidth: 24,
        minHeight: 24,
      },
      thumbWrap: { position: 'relative', flex: '0 0 auto', display: 'inline-flex' },
      thumbDelete: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 22,
        minHeight: 22,
        padding: 0,
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      },
      danger: {
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-state-error-primary)',
        background: 'transparent',
        color: 'var(--dsw-alias-state-error-primary)',
        font: 'inherit',
        cursor: 'pointer',
      },
      sourceRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      pageTabs: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
      tab: {
        padding: '6px 14px',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        cursor: 'pointer',
      },
      tabActive: {
        padding: '6px 14px',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-base)',
        font: 'inherit',
        cursor: 'pointer',
      },
      canvas: { display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
      canvasLeft: { flex: '0 1 360px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 },
      canvasRight: { flex: '1 1 420px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 },
      stage: {
        minHeight: 260,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      stageImage: { maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, cursor: 'zoom-in' },
      galleryToolbar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
      galleryGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
      groupHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      groupCount: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      tileGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 },
      tile: {
        position: 'relative',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      tileImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', cursor: 'zoom-in' },
      tileCheck: { position: 'absolute', top: 6, left: 6, width: 18, height: 18, cursor: 'pointer' },
      hidden: { display: 'none' },
    }

    // ------------------------------------------------------------- 小工具
    function mountPrefix() {
      try {
        const url = new URL(document.baseURI)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
        return url.pathname.replace(/\/+$/, '')
      } catch {
        return ''
      }
    }

    function routeUrl(suffix) {
      return `${mountPrefix()}${ROUTE_PREFIX}${suffix}`
    }

    async function api(pathname, options = {}) {
      const method = options.method ?? 'GET'
      const body = options.body
      const attempt = async () => {
        const response = await fetch(routeUrl(pathname), {
          method,
          headers: body === undefined ? undefined : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          credentials: 'same-origin',
          cache: 'no-store',
        })
        const text = await response.text()
        let payload
        try {
          payload = text ? JSON.parse(text) : {}
        } catch {
          throw new Error(`接口返回了非 JSON（HTTP ${response.status}）`)
        }
        if (!response.ok || payload?.ok === false) {
          const error = new Error(payload?.error?.message || `请求失败（HTTP ${response.status}）`)
          error.code = payload?.error?.code
          error.status = response.status
          throw error
        }
        return payload
      }
      try {
        return await attempt()
      } catch (error) {
        // 保存配置会让 Host 插件重载，路由可能瞬间不可用：GET（以及声明 retry 的幂等写）再试一次。
        if ((method === 'GET' || options.retry === true) && (error.status === 404 || error.status === 503)) {
          await delay(600)
          return await attempt()
        }
        throw error
      }
    }

    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return ''
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    function pixelHint(sizeTable, size, ratio) {
      const row = sizeTable?.[String(size ?? '').toUpperCase()]
      return row?.[ratio]
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    }

    /** 把同源图片按位图写进剪贴板（对话输入框里 Ctrl+V 可直接粘成图片）。 */
    async function copyImage(src) {
      try {
        if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
        const response = await fetch(src, { credentials: 'same-origin' })
        if (!response.ok) return false
        const blob = await response.blob()
        const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png'
        await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
        return true
      } catch {
        return false
      }
    }

    // ------------------------------------------------------------- 图标
    function Icon({ size = 18 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          'aria-hidden': true,
        },
        h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3 }),
        h('circle', { cx: 9, cy: 10, r: 1.6 }),
        h('path', { d: 'M4 17l4.5-4.5L13 17l3-3 4 4' }),
        h('path', { d: 'M17.5 2.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z' }),
      )
    }

    function Spinner({ size = 16, label }) {
      return h(
        'span',
        { role: 'status', 'aria-label': label, style: { display: 'inline-flex', alignItems: 'center', gap: 8 } },
        h(
          'svg',
          { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
          h('circle', { cx: 12, cy: 12, r: 9, stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 3 }),
          h(
            'path',
            {
              d: 'M21 12a9 9 0 0 0-9-9',
              stroke: 'var(--dsw-alias-brand-primary)',
              strokeWidth: 3,
              strokeLinecap: 'round',
            },
            h('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 12 12', to: '360 12 12', dur: '1s', repeatCount: 'indefinite' }),
          ),
        ),
        label ? h('span', { style: css.muted }, label) : null,
      )
    }

    // ------------------------------------------------------------- 图片查看器（缩放 / 平移 / 另存 / 复制 / 元信息）
    function Lightbox({ src, name, path, meta, bytes, mtime, onClose, t, onUseReference, canUseReference = false }) {
      const [scale, setScale] = useState(1)
      const [offset, setOffset] = useState({ x: 0, y: 0 })
      const [notice, setNotice] = useState('')
      const dragRef = useRef(null)
      const closeRef = useRef(null)

      const clampScale = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
      const zoomBy = useCallback((factor) => setScale((current) => clampScale(current * factor)), [])
      const reset = useCallback(() => {
        setScale(1)
        setOffset({ x: 0, y: 0 })
      }, [])

      useEffect(() => {
        reset()
      }, [reset, src])

      useEffect(() => {
        closeRef.current?.focus()
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
            return
          }
          if (event.key === '+' || event.key === '=') {
            event.preventDefault()
            zoomBy(1.25)
            return
          }
          if (event.key === '-') {
            event.preventDefault()
            zoomBy(0.8)
            return
          }
          if (event.key === '0') {
            event.preventDefault()
            reset()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose, reset, zoomBy])

      const flash = useCallback((message) => {
        setNotice(message)
        window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 3200)
      }, [])

      const doCopyImage = useCallback(async () => {
        const ok = await copyImage(src)
        if (!ok) {
          flash(t('copyFailed'))
          return false
        }
        flash(t('copied'))
        return true
      }, [flash, src, t])

      const sendToConversation = useCallback(async () => {
        const ok = await copyImage(src)
        if (!ok) {
          flash(t('copyFailed'))
          return
        }
        flash(t('copiedForConversation'))
        goConversation()
      }, [flash, src, t])

      const doCopyPrompt = useCallback(async () => {
        const ok = await copyText(String(meta?.prompt ?? ''))
        flash(ok ? t('copied') : t('copyFailed'))
      }, [flash, meta, t])

      const onWheel = (event) => {
        event.preventDefault()
        zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12)
      }

      const onPointerDown = (event) => {
        if (scale <= 1) return
        dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }

      const onPointerMove = (event) => {
        const drag = dragRef.current
        if (!drag) return
        setOffset({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y })
      }

      const onPointerUp = () => {
        dragRef.current = null
      }

      const rows = []
      if (meta) {
        if (meta.model) rows.push([t('modelLabel'), meta.model])
        if (meta.size) rows.push([t('sizeLabel'), meta.size])
        if (meta.ratio) rows.push([t('ratioLabel'), meta.ratio])
        if (Number.isFinite(meta.width) && Number.isFinite(meta.height)) {
          rows.push([t('pixelsLabel'), `${meta.width}×${meta.height}`])
        }
        if (meta.source_label) rows.push([t('sourceLabel'), meta.source_label])
        if (Number.isFinite(meta.elapsed_ms)) rows.push([t('elapsedLabel'), `${Math.round(meta.elapsed_ms / 100) / 10}s`])
        if (meta.created_at) rows.push([t('createdAt'), new Date(meta.created_at).toLocaleString()])
      }
      if (Number.isFinite(bytes ?? meta?.bytes)) rows.push([t('bytesLabel'), formatBytes(bytes ?? meta.bytes)])
      if (path) rows.push([t('fileName'), name || path.split(/[\\/]/).pop() || ''])

      return h(
        'div',
        {
          style: css.viewer,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('preview'),
          onClick: (event) => {
            if (event.target === event.currentTarget) onClose()
          },
        },
        h(
          'div',
          {
            style: css.viewerStage,
            onWheel,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onDoubleClick: () => {
              if (scale === 1) setScale(2)
              else reset()
            },
          },
          h('img', {
            src,
            alt: name || t('preview'),
            draggable: false,
            style: {
              ...css.viewerImage,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              cursor: scale > 1 ? 'grab' : 'zoom-in',
            },
          }),
          h(
            'div',
            { style: css.viewerToolbar },
            h(
              'button',
              { type: 'button', style: css.small, onClick: () => zoomBy(0.8), 'aria-label': t('zoomOut'), title: t('zoomOut') },
              '−',
            ),
            h('span', { style: { minWidth: 44, textAlign: 'center' } }, `${Math.round(scale * 100)}%`),
            h(
              'button',
              { type: 'button', style: css.small, onClick: () => zoomBy(1.25), 'aria-label': t('zoomIn'), title: t('zoomIn') },
              '+',
            ),
            h('button', { type: 'button', style: css.small, onClick: reset }, t('zoomReset')),
          ),
        ),
        h(
          'div',
          { style: css.viewerSide },
          h(
            'div',
            { style: { display: 'flex', gap: 8, alignItems: 'flex-start' } },
            h('strong', { style: { fontSize: 14, wordBreak: 'break-all' } }, name || t('preview')),
            h(
              'button',
              { ref: closeRef, type: 'button', style: { ...css.small, marginLeft: 'auto' }, onClick: onClose },
              t('close'),
            ),
          ),
          h('div', { style: css.sectionLabel }, t('promptLabel')),
          meta?.prompt
            ? h('pre', { style: css.promptBox }, meta.prompt)
            : h('div', { style: css.muted }, t('promptMissing')),
          meta?.revised_prompt
            ? h('div', null, h('div', { style: css.sectionLabel }, t('revisedPrompt')), h('pre', { style: css.promptBox }, meta.revised_prompt))
            : null,
          h(
            'div',
            { style: { ...css.shelfRow, flexWrap: 'wrap' } },
            h('a', { href: src, download: name || 'agnes-image.png', style: { ...css.small, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' } }, t('saveAs')),
            h('button', { type: 'button', style: css.small, onClick: doCopyImage }, t('copyImage')),
            h('button', { type: 'button', style: css.small, onClick: sendToConversation }, t('sendToConversation')),
            meta?.prompt ? h('button', { type: 'button', style: css.small, onClick: doCopyPrompt }, t('copyPrompt')) : null,
            canUseReference && path
              ? h('button', { type: 'button', style: css.small, onClick: () => onUseReference?.({ path, name }) }, t('useAsReference'))
              : null,
          ),
          notice ? h('div', { style: css.ok }, notice) : null,
          rows.length
            ? h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                ...rows.map(([key, value]) =>
                  h(
                    'div',
                    { key, style: css.infoRow },
                    h('span', { style: css.infoKey }, key),
                    h('span', { style: css.infoValue }, String(value)),
                  ),
                ),
              )
            : null,
        ),
      )
    }

    // ------------------------------------------------------------- 未配置引导 / 面板共用表单
    function SetupCard({ state, t, onSaved, pickDirectory }) {
      const [name, setName] = useState('')
      const [baseUrl, setBaseUrl] = useState('')
      const [keyValue, setKeyValue] = useState('')
      const [outputDir, setOutputDir] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')

      const chooseFolder = useCallback(async () => {
        try {
          const picked = await pickDirectory?.()
          if (picked) setOutputDir(picked)
        } catch (failure) {
          setError(failure?.message || t('pickFailed'))
        }
      }, [pickDirectory, t])

      const save = useCallback(async () => {
        setBusy(true)
        setError('')
        setNotice('')
        try {
          const url = baseUrl.trim()
          if (!url) throw new Error(t('needBaseUrl'))
          const created = await api('/source', {
            method: 'POST',
            retry: true,
            body: { action: 'save', label: name.trim(), baseUrl: url, makeDefault: true },
          })
          const sourceId = created?.source?.id
          if (keyValue.trim()) {
            if (!sourceId) throw new Error(t('saveFailed'))
            await api('/key', { method: 'POST', retry: true, body: { sourceId, value: keyValue.trim() } })
            setKeyValue('')
          }
          if (outputDir.trim()) {
            await api('/config', { method: 'POST', retry: true, body: { outputDir: outputDir.trim() } })
            setOutputDir('')
          }
          setNotice(t('sourceSaved'))
          await onSaved?.()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }, [baseUrl, keyValue, name, onSaved, outputDir, t])

      return h(
        'div',
        { style: css.card },
        h('div', null, h('div', { style: { fontWeight: 600 } }, t('setupTitle')), h('div', { style: css.muted }, t('setupHint'))),
        h(
          'div',
          { style: css.row },
          h(
            'label',
            { style: { ...css.field, flex: '1 1 160px' } },
            h('span', { style: css.label }, t('sourceName')),
            h('input', {
              type: 'text',
              style: css.input,
              value: name,
              placeholder: t('sourceNamePlaceholder'),
              spellCheck: false,
              onChange: (event) => setName(event.target.value),
            }),
          ),
          h(
            'label',
            { style: { ...css.field, flex: '2 1 240px' } },
            h('span', { style: css.label }, t('baseUrlLabel')),
            h('input', {
              type: 'url',
              style: css.input,
              value: baseUrl,
              placeholder: t('baseUrlPlaceholder'),
              spellCheck: false,
              onChange: (event) => setBaseUrl(event.target.value),
            }),
          ),
        ),
        h(
          'label',
          { style: css.field },
          h('span', { style: css.label }, t('keyLabel')),
          h('input', {
            type: 'password',
            style: css.input,
            value: keyValue,
            placeholder: t('keyPlaceholder'),
            autoComplete: 'off',
            onChange: (event) => setKeyValue(event.target.value),
          }),
        ),
        h(
          'label',
          { style: css.field },
          h('span', { style: css.label }, t('outputDirLabel')),
          h(
            'div',
            { style: css.row },
            h('input', {
              type: 'text',
              style: { ...css.input, flex: '1 1 240px', fontFamily: 'ui-monospace, monospace' },
              value: outputDir,
              spellCheck: false,
              placeholder: state?.defaultOutputDir || '',
              onChange: (event) => setOutputDir(event.target.value),
            }),
            pickDirectory
              ? h(
                  'button',
                  { type: 'button', style: css.secondary, onClick: chooseFolder },
                  t('chooseFolder'),
                )
              : null,
          ),
          h('div', { style: css.muted }, dirHint(t, state)),
        ),
        h(
          'div',
          { style: css.shelfRow },
          h(
            'button',
            {
              type: 'button',
              style: busy ? { ...css.primary, ...css.disabled } : css.primary,
              disabled: busy,
              onClick: save,
            },
            t('saveSource'),
          ),
        ),
        h('div', { style: css.muted }, t('dpapiNote')),
        error ? h('div', { style: css.error }, error) : null,
        notice ? h('div', { style: css.ok }, notice) : null,
      )
    }
    /** 把来源的 Key 状态翻译成文案（面板与设置页共用）。 */
    function keyStateText(t, key) {
      const state = key?.state ?? 'none'
      const text = {
        sealed: t('keyStateSealed'),
        env: t('keyStateEnv'),
        none: t('keyStateNone'),
        unreadable: t('keyStateUnreadable'),
        legacy: t('keyStateLegacy'),
      }[state] ?? t('keyStateNone')
      return state === 'env' && key?.envName ? `${text} · ${key.envName}` : text
    }

    /** 输出目录提示：未设置时用的默认目录 + 空闲空间。 */
    function dirHint(t, state) {
      const dir = state?.defaultOutputDir || ''
      if (!dir) return t('usingDefaultDir')
      const free = Number.isFinite(state?.defaultOutputFreeBytes)
        ? `（${t('freeSpace').replace('{free}', formatBytes(state.defaultOutputFreeBytes))}）`
        : ''
      return `${t('defaultDirHint').replace('{path}', dir)}${free}`
    }

    // ------------------------------------------------------------- 侧栏主面板（画图 / 图库 两页）
    const PAGE_KEY = 'agnes-image-gen/page'

    function PanelShell({ t, pickDirectory }) {
      const [page, setPage] = useState(() => {
        try {
          return window.sessionStorage.getItem(PAGE_KEY) === 'gallery' ? 'gallery' : 'create'
        } catch {
          return 'create'
        }
      })
      const [galleryMounted, setGalleryMounted] = useState(page === 'gallery')
      const [references, setReferences] = useState([])

      const go = useCallback((next) => {
        setPage(next)
        if (next === 'gallery') setGalleryMounted(true)
        try {
          window.sessionStorage.setItem(PAGE_KEY, next)
        } catch {
          // 会话存储不可用时只在内存里记忆。
        }
      }, [])

      const addReference = useCallback((item) => {
        const target = typeof item === 'string' ? item : item?.path
        if (!target) return
        const name = typeof item === 'string' ? '' : String(item?.name ?? '')
        setReferences((current) => {
          if (current.some((ref) => ref.path === target)) return current
          if (current.length >= MAX_REFERENCES) return current
          return [...current, { path: target, name }]
        })
      }, [])

      const removeReference = useCallback((target) => {
        setReferences((current) => current.filter((ref) => ref.path !== target))
      }, [])

      const useReference = useCallback(
        (item) => {
          addReference(item)
          go('create')
        },
        [addReference, go],
      )

      const tab = (id, label) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': page === id,
            style: page === id ? css.tabActive : css.tab,
            onClick: () => go(id),
          },
          label,
        )

      return h(
        'div',
        { style: css.panel },
        h(
          'div',
          { style: css.pageTabs, role: 'tablist', 'aria-label': t('panelTitle') },
          tab('create', t('tabCreate')),
          tab('gallery', t('tabGallery')),
        ),
        h(
          'div',
          { role: 'tabpanel', style: page === 'create' ? undefined : css.hidden },
          h(CreateView, {
            t,
            pickDirectory,
            onOpenGallery: () => go('gallery'),
            references,
            onRemoveReference: removeReference,
          }),
        ),
        galleryMounted
          ? h(
              'div',
              { role: 'tabpanel', style: page === 'gallery' ? undefined : css.hidden },
              h(GalleryView, { t, active: page === 'gallery', onUseReference: useReference }),
            )
          : null,
      )
    }

    function CreateView({ t, pickDirectory, onOpenGallery, references = [], onRemoveReference }) {
      const [state, setState] = useState(undefined)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [prompt, setPrompt] = useState('')
      const [model, setModel] = useState('')
      const [size, setSize] = useState('')
      const [ratio, setRatio] = useState('')
      const [sourceId, setSourceId] = useState('')
      const [models, setModels] = useState([])
      const [job, setJob] = useState(undefined)
      const [jobId, setJobId] = useState('')
      const [busy, setBusy] = useState(false)
      const [optimizing, setOptimizing] = useState(false)
      const [optimizedFrom, setOptimizedFrom] = useState('')
      const [armedDelete, setArmedDelete] = useState('')
      const [preview, setPreview] = useState(null)
      const [copied, setCopied] = useState('')

      const applyState = useCallback((next, jobKey) => {
        if (!next) return
        setState(next)
        const wanted = jobKey ? (next.job && next.job.id === jobKey ? next.job : undefined) : next.job
        if (wanted) setJob(wanted)
        setSourceId((current) => {
          if (current && (next.sources ?? []).some((item) => item.id === current)) return current
          return next.config?.defaultSourceId ?? (next.sources ?? [])[0]?.id ?? ''
        })
        setModel((current) => current || next.config?.defaultModel || '')
        setSize((current) => current || next.config?.defaultSize || '')
        setRatio((current) => current || next.config?.defaultRatio || '')
      }, [])

      const load = useCallback(async () => {
        try {
          const next = await api('/state')
          applyState(next, '')
          setError('')
          return next
        } catch (failure) {
          setError(failure.message)
          return undefined
        } finally {
          setLoading(false)
        }
      }, [applyState])

      useEffect(() => {
        load()
      }, [load])

      useEffect(() => {
        if (!jobId) return
        let alive = true
        let timer
        const tick = async () => {
          try {
            const next = await api(`/state?job=${encodeURIComponent(jobId)}`)
            if (!alive) return
            applyState(next, jobId)
            const current = next.job && next.job.id === jobId ? next.job : undefined
            if (current && (current.state === 'running' || current.state === 'cancelling')) {
              timer = setTimeout(tick, 1200)
            } else {
              if (!current) setJob(undefined)
              setJobId('')
            }
          } catch (failure) {
            if (!alive) return
            setError(failure.message)
            timer = setTimeout(tick, 2000)
          }
        }
        tick()
        return () => {
          alive = false
          clearTimeout(timer)
        }
      }, [applyState, jobId])

      const sources = state?.sources ?? []
      const currentSource = sources.find((item) => item.id === sourceId) ?? sources.find((item) => item.isDefault)
      const keyReady = Boolean(
        currentSource && (currentSource.key?.hasStored || (currentSource.isDefault && currentSource.key?.state === 'env')),
      )
      const running = job && (job.state === 'running' || job.state === 'cancelling')
      const ready = Boolean(state?.ready)
      const hint = pixelHint(state?.caps?.sizeTable, size, ratio)

      const armDelete = useCallback((target) => {
        setArmedDelete(target)
        window.setTimeout(() => {
          setArmedDelete((current) => (current === target ? '' : current))
        }, 3000)
      }, [])

      const chooseSource = useCallback(async (id) => {
        setSourceId(id)
        setModels([])
        try {
          const result = await api(`/models?sourceId=${encodeURIComponent(id)}`)
          const list = (result.models ?? []).map((item) => item.id)
          setModels(list)
          setModel((current) => (current && list.includes(current) ? current : (list[0] ?? current)))
        } catch {
          // 模型列表拿不到就回退内置列表。
        }
      }, [])

      const generate = useCallback(async () => {
        if (busy || running) return
        const text = prompt.trim()
        if (!text) return
        setBusy(true)
        setError('')
        setNotice('')
        try {
          const response = await api('/generate', {
            method: 'POST',
            body: {
              prompt: text,
              model,
              size,
              ratio,
              sourceId: sourceId || undefined,
              images: references.length ? references.map((ref) => ref.path) : undefined,
            },
          })
          setJob({ id: response.jobId, state: 'running', startedAt: Date.now(), params: { model, size, ratio } })
          setJobId(response.jobId)
          setOptimizedFrom('')
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }, [busy, model, prompt, ratio, references, running, size, sourceId])

      const cancel = useCallback(async () => {
        if (!job?.id) return
        try {
          await api('/cancel', { method: 'POST', body: { jobId: job.id } })
        } catch (failure) {
          setError(failure.message)
        }
      }, [job])

      const optimize = useCallback(async () => {
        const text = prompt.trim()
        if (!text || optimizing) return
        setOptimizing(true)
        setError('')
        setNotice('')
        try {
          const result = await api('/optimize', {
            method: 'POST',
            body: { prompt: text, sourceId: sourceId || undefined },
          })
          setOptimizedFrom(text)
          setPrompt(result.prompt ?? text)
          setNotice(t('optimized'))
        } catch (failure) {
          setError(failure.message)
        } finally {
          setOptimizing(false)
        }
      }, [optimizing, prompt, sourceId, t])

      const undoOptimize = useCallback(() => {
        if (!optimizedFrom) return
        setPrompt(optimizedFrom)
        setOptimizedFrom('')
        setNotice('')
      }, [optimizedFrom])

      const deleteImage = useCallback(
        async (target) => {
          if (!target) return
          if (armedDelete !== target) {
            armDelete(target)
            return
          }
          setArmedDelete('')
          setError('')
          try {
            await api('/delete', { method: 'POST', body: { path: target } })
            setPreview('')
            setNotice(t('deleted'))
            await load()
            setJob((current) => (current?.result?.path === target ? undefined : current))
          } catch (failure) {
            setError(`${t('deleteFailed')}：${failure.message}`)
          }
        },
        [armedDelete, armDelete, load, t],
      )

      const reveal = useCallback(async (target) => {
        try {
          await api('/reveal', { method: 'POST', body: target ? { path: target } : {} })
        } catch (failure) {
          setError(failure.message)
        }
      }, [])

      const copy = useCallback(async (text) => {
        if (await copyText(text)) {
          setCopied(text)
          setTimeout(() => setCopied(''), 1600)
        }
      }, [])

      const options = useMemo(() => {
        const list = models.length ? models : (state?.caps?.models ?? []).map((item) => item.id)
        const finalList = list.length ? list : ['agnes-image-2.5-flash', 'agnes-image-2.1-flash', 'agnes-image-2.0-flash']
        return model && !finalList.includes(model) ? [model, ...finalList] : finalList
      }, [model, models, state])

      const result = job?.result
      const previewSrc = job?.state === 'done' && job?.id ? routeUrl(`/image?job=${encodeURIComponent(job.id)}`) : ''
      const savedPath = result?.path
      const resultMeta = result
        ? {
            prompt: job?.params?.prompt ?? '',
            revised_prompt: result.revised_prompt ?? '',
            model: result.model,
            size: result.size,
            ratio: result.ratio,
            width: result.width,
            height: result.height,
            source_label: result.source_label,
            elapsed_ms: result.elapsed_ms,
            bytes: result.bytes,
          }
        : null

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h(
          'div',
          { style: css.header },
          h('div', null, h('h1', { style: css.h1 }, t('panelTitle')), h('p', { style: css.sub }, t('panelSubtitle'))),
          h('span', { style: ready ? css.chipReady : css.chip }, ready ? t('statusReady') : t('statusUnconfigured')),
        ),
        h(
          'div',
          { style: css.canvas },
          h(
            'div',
            { style: css.canvasLeft },
            loading ? h('div', { style: css.muted }, h(Spinner, { label: t('generating') })) : null,
            state && !sources.length ? h(SetupCard, { state, t, onSaved: load, pickDirectory }) : null,
            state && sources.length && !keyReady ? h('div', { style: css.warn }, t('needSourceKey')) : null,
            h(
              'div',
              { style: css.card },
              sources.length > 1
                ? h(
                    'label',
                    { style: css.field },
                    h('span', { style: css.label }, t('sourceLabel')),
                    h(
                      'select',
                      {
                        style: css.input,
                        value: currentSource?.id ?? '',
                        onChange: (event) => chooseSource(event.target.value),
                      },
                      ...sources.map((item) =>
                        h(
                          'option',
                          { key: item.id, value: item.id },
                          `${item.label}${item.isDefault ? ` · ${t('defaultSource')}` : ''}`,
                        ),
                      ),
                    ),
                  )
                : null,
              h(
                'label',
                { style: css.field },
                h('span', { style: css.label }, t('promptLabel')),
                h('textarea', {
                  style: css.textarea,
                  value: prompt,
                  placeholder: t('promptPlaceholder'),
                  onChange: (event) => setPrompt(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault()
                      generate()
                    }
                  },
                }),
              ),
              h(
                'div',
                { style: css.shelfRow },
                h(
                  'button',
                  {
                    type: 'button',
                    style: optimizing || !prompt.trim() || !keyReady ? { ...css.secondary, ...css.disabled } : css.secondary,
                    disabled: optimizing || !prompt.trim() || !keyReady,
                    onClick: optimize,
                    title: t('optimizeHint'),
                  },
                  optimizing ? t('optimizing') : t('optimizePrompt'),
                ),
                optimizedFrom
                  ? h('button', { type: 'button', style: css.small, onClick: undoOptimize }, t('undoOptimize'))
                  : null,
                prompt ? h('button', { type: 'button', style: css.small, onClick: () => setPrompt('') }, t('clear')) : null,
              ),
              references.length
                ? h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                    h(
                      'div',
                      { style: css.row },
                      h('span', { style: css.label }, `${t('referenceTitle')} · ${references.length}/${MAX_REFERENCES}`),
                      h('span', { style: css.muted }, t('referenceHint').replace('{n}', String(MAX_REFERENCES))),
                    ),
                    h(
                      'div',
                      { style: css.refRow },
                      ...references.map((ref) =>
                        h(
                          'div',
                          { key: ref.path, style: css.refItem },
                          h('img', { src: routeUrl(`/image?path=${encodeURIComponent(ref.path)}`), alt: ref.name || '', style: css.refImg }),
                          h(
                            'button',
                            {
                              type: 'button',
                              style: css.refRemove,
                              'aria-label': t('clear'),
                              title: t('clear'),
                              onClick: () => onRemoveReference?.(ref.path),
                            },
                            '×',
                          ),
                        ),
                      ),
                    ),
                  )
                : null,
              h(
                'div',
                { style: css.row },
                h(
                  'label',
                  { style: { ...css.field, flex: '2 1 200px' } },
                  h('span', { style: css.label }, t('modelLabel')),
                  h(
                    'select',
                    { style: css.input, value: model, onChange: (event) => setModel(event.target.value) },
                    ...options.map((item) => h('option', { key: item, value: item }, item)),
                  ),
                ),
                h(
                  'label',
                  { style: css.field },
                  h('span', { style: css.label }, t('sizeLabel')),
                  h(
                    'select',
                    { style: css.input, value: size, onChange: (event) => setSize(event.target.value) },
                    ...(state?.caps?.sizes ?? ['1K', '2K', '3K', '4K']).map((item) => h('option', { key: item, value: item }, item)),
                  ),
                ),
                h(
                  'label',
                  { style: css.field },
                  h('span', { style: css.label }, t('ratioLabel')),
                  h(
                    'select',
                    { style: css.input, value: ratio, onChange: (event) => setRatio(event.target.value) },
                    ...(state?.caps?.ratios ?? ['1:1']).map((item) => h('option', { key: item, value: item }, item)),
                  ),
                ),
              ),
              hint ? h('div', { style: css.muted }, t('pixels', { w: hint[0], h: hint[1] })) : null,
              h(
                'div',
                { style: css.shelfRow },
                h(
                  'button',
                  {
                    type: 'button',
                    style: busy || running || !ready || !keyReady ? { ...css.primary, ...css.disabled } : css.primary,
                    disabled: busy || running || !ready || !keyReady,
                    onClick: generate,
                  },
                  t('generate'),
                ),
                running ? h('button', { type: 'button', style: css.secondary, onClick: cancel }, t('cancel')) : null,
              ),
              error ? h('div', { style: css.error }, error) : null,
              notice ? h('div', { style: css.ok }, notice) : null,
            ),
          ),
          h(
            'div',
            { style: css.canvasRight },
            h(
              'div',
              { style: css.stage },
              running
                ? h(Spinner, { size: 18, label: `${t('running')} ${Math.round((job?.elapsed_ms ?? 0) / 100) / 10}s` })
                : previewSrc
                  ? h('img', {
                      src: previewSrc,
                      alt: result?.name ?? t('preview'),
                      style: css.stageImage,
                      onClick: () => setPreview({ src: previewSrc, name: result?.name, path: result?.path, meta: resultMeta }),
                    })
                  : h('div', { style: css.muted }, t('emptyResult')),
            ),
            job?.state === 'error'
              ? h(
                  'div',
                  { style: css.card },
                  h('div', { style: css.error }, `${t('failed')}：${job.error?.message ?? ''}`),
                  h('button', { type: 'button', style: css.small, onClick: generate }, t('retry')),
                )
              : null,
            job?.state === 'cancelled' ? h('div', { style: css.warn }, t('cancelled')) : null,
            job?.state === 'done' && result
              ? h(
                  'div',
                  { style: css.card },
                  h(
                    'div',
                    { style: css.meta },
                    [
                      result.source_label,
                      result.model,
                      result.size,
                      result.ratio,
                      `${Math.round((result.elapsed_ms ?? 0) / 100) / 10}s`,
                      formatBytes(result.bytes),
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  ),
                  Number.isInteger(result.width) && Number.isInteger(result.height)
                    ? h('div', { style: css.meta }, `${result.width}×${result.height}`)
                    : null,
                  savedPath
                    ? h('div', { style: { ...css.meta, fontFamily: 'ui-monospace, monospace' } }, savedPath)
                    : h('div', { style: css.warn }, t('notSaved')),
                  h(
                    'div',
                    { style: css.shelfRow },
                    savedPath
                      ? h('button', { type: 'button', style: css.small, onClick: () => reveal(savedPath) }, t('openFolder'))
                      : null,
                    h(
                      'a',
                      {
                        href: previewSrc,
                        download: result.name ?? 'agnes-image.png',
                        style: { ...css.small, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
                      },
                      t('download'),
                    ),
                    savedPath
                      ? h(
                          'button',
                          { type: 'button', style: css.small, onClick: () => copy(savedPath) },
                          copied === savedPath ? t('copied') : t('copyPath'),
                        )
                      : null,
                    h('button', { type: 'button', style: css.small, onClick: generate }, t('regenerate')),
                    savedPath
                      ? h(
                          'button',
                          {
                            type: 'button',
                            style: armedDelete === savedPath ? css.danger : css.small,
                            onClick: () => deleteImage(savedPath),
                            'aria-label': t('deleteImage'),
                          },
                          armedDelete === savedPath ? t('confirmDelete') : t('deleteImage'),
                        )
                      : null,
                  ),
                  ...(result.warnings ?? []).map((warning, index) => h('div', { key: `warn-${index}`, style: css.warn }, warning)),
                )
              : null,
            h('button', { type: 'button', style: css.small, onClick: onOpenGallery }, t('openGallery')),
          ),
        ),
        preview
          ? h(Lightbox, {
              src: preview.src,
              name: preview.name,
              path: preview.path,
              meta: preview.meta,
              bytes: preview.meta?.bytes,
              onClose: () => setPreview(null),
              t,
            })
          : null,
      )
    }

    // ------------------------------------------------------------- 图库页
    function GalleryView({ t, active, onUseReference }) {
      const [files, setFiles] = useState([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [selected, setSelected] = useState(() => new Set())
      const [broken, setBroken] = useState(() => new Set())
      const [armed, setArmed] = useState('')
      const armedPaths = useRef('')
      const [preview, setPreview] = useState(null)
      const [busy, setBusy] = useState(false)

      const load = useCallback(async () => {
        setLoading(true)
        try {
          const result = await api('/history?limit=200')
          setFiles(result.files ?? [])
          setSelected(new Set())
          setBroken(new Set())
          setError('')
        } catch (failure) {
          setError(failure.message)
        } finally {
          setLoading(false)
        }
      }, [])

      useEffect(() => {
        if (active) load()
      }, [active, load])

      useEffect(() => {
        if (!armed) return
        const timer = window.setTimeout(() => setArmed(''), 3000)
        return () => window.clearTimeout(timer)
      }, [armed])

      const dayKeyOf = (value) => {
        const date = new Date(value)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }

      const groups = useMemo(() => {
        const map = new Map()
        for (const file of files) {
          if (broken.has(file.path)) continue
          const key = dayKeyOf(file.mtime)
          if (!map.has(key)) map.set(key, { key, at: new Date(file.mtime), items: [] })
          map.get(key).items.push(file)
        }
        for (const group of map.values()) group.items.sort((a, b) => b.mtime - a.mtime)
        return [...map.values()].sort((a, b) => b.at.getTime() - a.at.getTime())
      }, [broken, files])

      const dayLabel = useCallback(
        (date) => {
          const now = new Date()
          const startOf = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
          const days = Math.round((startOf(now) - startOf(date)) / 86400000)
          if (days === 0) return t('groupToday')
          if (days === 1) return t('groupYesterday')
          const sameYear = date.getFullYear() === now.getFullYear()
          return date.toLocaleDateString(undefined, {
            year: sameYear ? undefined : 'numeric',
            month: 'short',
            day: 'numeric',
          })
        },
        [t],
      )

      const toggle = useCallback((target) => {
        setSelected((current) => {
          const next = new Set(current)
          if (next.has(target)) next.delete(target)
          else next.add(target)
          return next
        })
        setArmed('')
      }, [])

      const toggleGroup = useCallback((items) => {
        setSelected((current) => {
          const next = new Set(current)
          const all = items.every((file) => next.has(file.path))
          for (const file of items) {
            if (all) next.delete(file.path)
            else next.add(file.path)
          }
          return next
        })
        setArmed('')
      }, [])

      const deleteSelected = useCallback(async () => {
        const paths = [...selected]
        if (!paths.length || busy) return
        const snapshot = paths.join('\n')
        if (armed !== 'batch') {
          armedPaths.current = snapshot
          setArmed('batch')
          return
        }
        // 确认期间选择变了（比如点了全选）：只刷新快照，不执行删除。
        if (armedPaths.current !== snapshot) {
          armedPaths.current = snapshot
          return
        }
        armedPaths.current = ''
        setArmed('')
        setBusy(true)
        setError('')
        setNotice('')
        try {
          const result = await api('/delete', { method: 'POST', body: { paths }, retry: true })
          const failed = result.failed ?? []
          const removed = (result.deleted ?? []).length
          if (removed) setNotice(t('batchDeleted', { n: removed }))
          if (failed.length) setError(`${t('batchFailed', { n: failed.length })}：${failed.map((item) => item.message).join('；')}`)
          setPreview('')
          await load()
        } catch (failure) {
          setError(`${t('deleteFailed')}：${failure.message}`)
          await load()
        } finally {
          setBusy(false)
        }
      }, [armed, busy, load, selected, t])

      const deleteOne = useCallback(
        async (target) => {
          if (armed !== target) {
            setArmed(target)
            return
          }
          setArmed('')
          setError('')
          try {
            await api('/delete', { method: 'POST', body: { path: target } })
            setFiles((current) => current.filter((file) => file.path !== target))
            setSelected((current) => {
              const next = new Set(current)
              next.delete(target)
              return next
            })
            setPreview('')
            setNotice(t('deleted'))
          } catch (failure) {
            setError(`${t('deleteFailed')}：${failure.message}`)
          }
        },
        [armed, t],
      )

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h(
          'div',
          { style: css.header },
          h('div', null, h('h1', { style: css.h1 }, t('galleryTitle')), h('p', { style: css.sub }, t('galleryHint'))),
          h('button', { type: 'button', style: css.small, onClick: load, disabled: loading }, t('refresh')),
        ),
        h(
          'div',
          { style: css.galleryToolbar },
          h('span', { style: css.muted }, t('groupCount', { n: files.length })),
          selected.size ? h('span', { style: css.ok }, t('selectedCount', { n: selected.size })) : null,
          h(
            'button',
            {
              type: 'button',
              style: files.length ? css.small : { ...css.small, ...css.disabled },
              disabled: !files.length,
              onClick: () => {
                setArmed('')
                setSelected(new Set(files.map((file) => file.path)))
              },
            },
            t('selectAll'),
          ),
          selected.size
            ? h(
                'button',
                {
                  type: 'button',
                  style: css.small,
                  onClick: () => {
                    setArmed('')
                    setSelected(new Set())
                  },
                },
                t('clearSelection'),
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              style: armed === 'batch' ? css.danger : selected.size && !busy ? css.danger : { ...css.danger, ...css.disabled },
              disabled: !selected.size || busy,
              onClick: deleteSelected,
            },
            armed === 'batch' ? t('confirmDeleteSelected', { n: selected.size }) : t('deleteSelected'),
          ),
        ),
        error ? h('div', { style: css.error }, error) : null,
        notice ? h('div', { style: css.ok }, notice) : null,
        loading ? h('div', { style: css.muted }, h(Spinner, { label: t('generating') })) : null,
        !loading && !groups.length ? h('div', { style: css.muted }, t('noGallery')) : null,
        ...groups.map((group) =>
          h(
            'section',
            { key: group.key, style: css.galleryGroup },
            h(
              'div',
              { style: css.groupHead },
              h('button', { type: 'button', style: css.small, onClick: () => toggleGroup(group.items) }, t('selectAll')),
              h('strong', { style: { fontSize: 13 } }, dayLabel(group.at)),
              h('span', { style: css.groupCount }, t('groupCount', { n: group.items.length })),
            ),
            h(
              'div',
              { style: css.tileGrid },
              ...group.items.map((file) => {
                const src = routeUrl(`/image?path=${encodeURIComponent(file.path)}`)
                const checked = selected.has(file.path)
                return h(
                  'div',
                  {
                    key: file.path,
                    style: checked ? { ...css.tile, border: '2px solid var(--dsw-alias-brand-primary)' } : css.tile,
                  },
                  h('img', {
                    src,
                    alt: file.name,
                    title: file.name,
                    loading: 'lazy',
                    style: css.tileImg,
                    onClick: () => setPreview({ src, name: file.name, path: file.path, meta: file.meta }),
                    onError: () =>
                      setBroken((current) => {
                        const next = new Set(current)
                        next.add(file.path)
                        return next
                      }),
                  }),
                  h('input', {
                    type: 'checkbox',
                    checked,
                    'aria-label': `${t('selectAll')}：${file.name}`,
                    style: css.tileCheck,
                    onChange: () => toggle(file.path),
                  }),
                  h(
                    'button',
                    {
                      type: 'button',
                      style:
                        armed === file.path
                          ? {
                              ...css.thumbDelete,
                              borderColor: 'var(--dsw-alias-state-error-primary)',
                              color: 'var(--dsw-alias-state-error-primary)',
                            }
                          : css.thumbDelete,
                      'aria-label': t('deleteImage'),
                      title: armed === file.path ? t('confirmDelete') : t('deleteImage'),
                      onClick: (event) => {
                        event.stopPropagation()
                        deleteOne(file.path)
                      },
                    },
                    armed === file.path ? '✓' : '×',
                  ),
                )
              }),
            ),
          ),
        ),
        preview
          ? h(Lightbox, {
              src: preview.src,
              name: preview.name,
              path: preview.path,
              meta: preview.meta,
              bytes: preview.meta?.bytes,
              onClose: () => setPreview(null),
              t,
              onUseReference,
              canUseReference: Boolean(onUseReference),
            })
          : null,
      )
    }
    // ------------------------------------------------------------- 设置页
    function SettingsPage({ t, pickDirectory }) {
      const [state, setState] = useState(undefined)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [busy, setBusy] = useState(false)
      const [keyFor, setKeyFor] = useState('')
      const [keyValue, setKeyValue] = useState('')
      const [armedSource, setArmedSource] = useState('')
      const [testingId, setTestingId] = useState('')
      const [testResults, setTestResults] = useState({})
      const [newLabel, setNewLabel] = useState('')
      const [newBaseUrl, setNewBaseUrl] = useState('')
      const [newKey, setNewKey] = useState('')
      const [defaultSourceId, setDefaultSourceId] = useState('')
      const [defaultModel, setDefaultModel] = useState('')
      const [optimizeModel, setOptimizeModel] = useState('')
      const [defaultSize, setDefaultSize] = useState('')
      const [defaultRatio, setDefaultRatio] = useState('')
      const [timeoutSeconds, setTimeoutSeconds] = useState('300')
      const [outputDir, setOutputDir] = useState('')

      const apply = useCallback((next) => {
        if (!next) return
        setState(next)
        setDefaultSourceId(next.config?.defaultSourceId ?? '')
        setDefaultModel(next.config?.defaultModel ?? '')
        setOptimizeModel(next.config?.optimizeModel ?? '')
        setDefaultSize(next.config?.defaultSize ?? '')
        setDefaultRatio(next.config?.defaultRatio ?? '')
        setTimeoutSeconds(String(Math.round((next.config?.timeoutMs ?? 300000) / 1000)))
        setOutputDir(next.config?.outputDir ?? '')
      }, [])

      const load = useCallback(async () => {
        try {
          const next = await api('/state')
          apply(next)
          setError('')
        } catch (failure) {
          setError(failure.message)
        } finally {
          setLoading(false)
        }
      }, [apply])

      useEffect(() => {
        load()
      }, [load])

      const flash = useCallback((message) => {
        setNotice(message)
        window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 4000)
      }, [])

      const armSource = useCallback((id) => {
        setArmedSource(id)
        window.setTimeout(() => {
          setArmedSource((current) => (current === id ? '' : current))
        }, 3000)
      }, [])

      const addSource = useCallback(async () => {
        setBusy(true)
        setError('')
        setNotice('')
        try {
          const url = newBaseUrl.trim()
          if (!url) throw new Error(t('needBaseUrl'))
          const created = await api('/source', {
            method: 'POST',
            retry: true,
            body: { action: 'save', label: newLabel.trim(), baseUrl: url, makeDefault: !(state?.sources ?? []).length },
          })
          const sourceId = created?.source?.id
          if (newKey.trim() && sourceId) {
            await api('/key', { method: 'POST', retry: true, body: { sourceId, value: newKey.trim() } })
          }
          setNewLabel('')
          setNewBaseUrl('')
          setNewKey('')
          flash(t('sourceSaved'))
          await load()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }, [flash, load, newBaseUrl, newKey, newLabel, state, t])

      const saveKeyFor = useCallback(
        async (id) => {
          setBusy(true)
          setError('')
          setNotice('')
          try {
            if (!keyValue.trim()) throw new Error(t('keyPlaceholder'))
            await api('/key', { method: 'POST', retry: true, body: { sourceId: id, value: keyValue.trim() } })
            setKeyValue('')
            setKeyFor('')
            flash(t('keySaved'))
            await load()
          } catch (failure) {
            setError(failure.message)
          } finally {
            setBusy(false)
          }
        },
        [flash, keyValue, load, t],
      )

      const clearKeyFor = useCallback(
        async (id) => {
          setBusy(true)
          setError('')
          setNotice('')
          try {
            await api('/key', { method: 'POST', retry: true, body: { sourceId: id, clear: true } })
            flash(t('keyCleared'))
            await load()
          } catch (failure) {
            setError(failure.message)
          } finally {
            setBusy(false)
          }
        },
        [flash, load, t],
      )

      const testFor = useCallback(async (id) => {
        setTestingId(id)
        setError('')
        try {
          const result = await api(`/models?sourceId=${encodeURIComponent(id)}&refresh=1`)
          setTestResults((current) => ({ ...current, [id]: t('testOk', { n: (result.models ?? []).length }) }))
        } catch (failure) {
          setTestResults((current) => ({ ...current, [id]: failure.message }))
        } finally {
          setTestingId('')
        }
      }, [t])

      const makeDefault = useCallback(
        async (id) => {
          setBusy(true)
          setError('')
          setNotice('')
          try {
            await api('/source', { method: 'POST', retry: true, body: { action: 'save', id, makeDefault: true } })
            flash(t('saved'))
            await load()
          } catch (failure) {
            setError(failure.message)
          } finally {
            setBusy(false)
          }
        },
        [flash, load, t],
      )

      const removeSource = useCallback(
        async (id) => {
          if (armedSource !== id) {
            armSource(id)
            return
          }
          setArmedSource('')
          setBusy(true)
          setError('')
          setNotice('')
          try {
            await api('/source', { method: 'POST', retry: true, body: { action: 'delete', id } })
            flash(t('sourceRemoved'))
            await load()
          } catch (failure) {
            setError(failure.message)
          } finally {
            setBusy(false)
          }
        },
        [armSource, armedSource, flash, load, t],
      )

      const saveSettings = useCallback(async () => {
        setBusy(true)
        setError('')
        setNotice('')
        try {
          const seconds = Number(timeoutSeconds)
          if (!Number.isFinite(seconds) || seconds < 30 || seconds > 600) {
            throw new Error('超时必须在 30–600 秒之间。')
          }
          await api('/config', {
            method: 'POST',
            retry: true,
            body: {
              defaultSourceId,
              defaultModel,
              optimizeModel,
              defaultSize,
              defaultRatio,
              outputDir: outputDir.trim(),
              timeoutMs: Math.round(seconds * 1000),
            },
          })
          flash(t('saved'))
          await load()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }, [defaultModel, defaultRatio, defaultSize, defaultSourceId, flash, load, optimizeModel, outputDir, t, timeoutSeconds])

      const sources = state?.sources ?? []
      const modelOptions = state?.caps?.models?.map((item) => item.id) ?? ['agnes-image-2.5-flash']
      const optimizeOptions = state?.caps?.optimizeModels?.map((item) => item.id) ?? ['agnes-3.0-flash']
      const sizeOptions = state?.caps?.sizes ?? ['1K', '2K', '3K', '4K']
      const ratioOptions = state?.caps?.ratios ?? ['1:1']

      return h(
        'div',
        { style: css.panel },
        h(
          'div',
          { style: css.header },
          h('div', null, h('h1', { style: css.h1 }, t('settingsTitle')), h('p', { style: css.sub }, t('settingsHint'))),
        ),
        loading ? h(Spinner, { label: t('generating') }) : null,
        error ? h('div', { style: css.error }, error) : null,
        notice ? h('div', { style: css.ok }, notice) : null,

        h(
          'div',
          { style: css.card },
          h('div', { style: { fontWeight: 600 } }, t('sourcesTitle')),
          h('div', { style: css.muted }, t('sourcesHint')),
          sources.length
            ? h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                ...sources.map((source) =>
                  h(
                    'div',
                    { key: source.id, style: css.sourceRow },
                    h(
                      'div',
                      { style: css.shelfRow },
                      h('span', { style: { fontWeight: 600 } }, source.label),
                      source.isDefault ? h('span', { style: css.ok }, t('isDefault')) : null,
                      h(
                        'span',
                        { style: { ...css.muted, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' } },
                        source.baseUrl,
                      ),
                    ),
                    h(
                      'div',
                      { style: css.shelfRow },
                      h('span', { style: css.muted }, keyStateText(t, source.key)),
                      h(
                        'button',
                        { type: 'button', style: css.small, disabled: testingId === source.id, onClick: () => testFor(source.id) },
                        testingId === source.id ? t('testing') : t('testThis'),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          style: css.small,
                          onClick: () => {
                            setKeyFor(keyFor === source.id ? '' : source.id)
                            setKeyValue('')
                          },
                        },
                        t('saveKey'),
                      ),
                      source.key?.hasStored
                        ? h(
                            'button',
                            { type: 'button', style: css.small, disabled: busy, onClick: () => clearKeyFor(source.id) },
                            t('clearKey'),
                          )
                        : null,
                      source.isDefault
                        ? null
                        : h(
                            'button',
                            { type: 'button', style: css.small, disabled: busy, onClick: () => makeDefault(source.id) },
                            t('setDefault'),
                          ),
                      h(
                        'button',
                        {
                          type: 'button',
                          style: armedSource === source.id ? css.danger : css.small,
                          disabled: busy,
                          onClick: () => removeSource(source.id),
                        },
                        armedSource === source.id ? t('confirmRemove') : t('removeSource'),
                      ),
                    ),
                    testResults[source.id] ? h('div', { style: css.muted }, testResults[source.id]) : null,
                    keyFor === source.id
                      ? h(
                          'div',
                          { style: css.shelfRow },
                          h('input', {
                            type: 'password',
                            style: css.input,
                            value: keyValue,
                            placeholder: t('keyPlaceholder'),
                            autoComplete: 'off',
                            onChange: (event) => setKeyValue(event.target.value),
                          }),
                          h(
                            'button',
                            {
                              type: 'button',
                              style: busy ? { ...css.secondary, ...css.disabled } : css.secondary,
                              disabled: busy,
                              onClick: () => saveKeyFor(source.id),
                            },
                            t('saveKey'),
                          ),
                        )
                      : null,
                  ),
                ),
              )
            : h('div', { style: css.muted }, t('noSources')),
          h('div', { style: { ...css.label, fontWeight: 600, marginTop: 4 } }, t('addSource')),
          h(
            'div',
            { style: css.row },
            h(
              'label',
              { style: { ...css.field, flex: '1 1 140px' } },
              h('span', { style: css.label }, t('sourceName')),
              h('input', {
                type: 'text',
                style: css.input,
                value: newLabel,
                placeholder: t('sourceNamePlaceholder'),
                spellCheck: false,
                onChange: (event) => setNewLabel(event.target.value),
              }),
            ),
            h(
              'label',
              { style: { ...css.field, flex: '2 1 220px' } },
              h('span', { style: css.label }, t('baseUrlLabel')),
              h('input', {
                type: 'url',
                style: css.input,
                value: newBaseUrl,
                placeholder: t('baseUrlPlaceholder'),
                spellCheck: false,
                onChange: (event) => setNewBaseUrl(event.target.value),
              }),
            ),
            h(
              'label',
              { style: { ...css.field, flex: '2 1 200px' } },
              h('span', { style: css.label }, t('keyLabel')),
              h('input', {
                type: 'password',
                style: css.input,
                value: newKey,
                placeholder: t('keyPlaceholder'),
                autoComplete: 'off',
                onChange: (event) => setNewKey(event.target.value),
              }),
            ),
          ),
          h(
            'div',
            { style: css.shelfRow },
            h(
              'button',
              { type: 'button', style: busy ? { ...css.primary, ...css.disabled } : css.primary, disabled: busy, onClick: addSource },
              t('addSource'),
            ),
          ),
          h('div', { style: css.muted }, t('dpapiNote')),
        ),

        h(
          'div',
          { style: css.card },
          h('div', { style: { fontWeight: 600 } }, t('defaults')),
          h(
            'div',
            { style: css.row },
            h(
              'label',
              { style: { ...css.field, flex: '2 1 200px' } },
              h('span', { style: css.label }, t('defaultSourceLabel')),
              h(
                'select',
                { style: css.input, value: defaultSourceId, onChange: (event) => setDefaultSourceId(event.target.value) },
                ...sources.map((source) => h('option', { key: source.id, value: source.id }, source.label)),
              ),
            ),
            h(
              'label',
              { style: { ...css.field, flex: '2 1 200px' } },
              h('span', { style: css.label }, t('defaultModelLabel')),
              h(
                'select',
                { style: css.input, value: defaultModel, onChange: (event) => setDefaultModel(event.target.value) },
                ...(defaultModel && !modelOptions.includes(defaultModel) ? [defaultModel] : [])
                  .concat(modelOptions)
                  .map((id) => h('option', { key: id, value: id }, id)),
              ),
            ),
            h(
              'label',
              { style: { ...css.field, flex: '2 1 200px' } },
              h('span', { style: css.label }, t('optimizeModel')),
              h(
                'select',
                { style: css.input, value: optimizeModel, onChange: (event) => setOptimizeModel(event.target.value) },
                ...(optimizeModel && !optimizeOptions.includes(optimizeModel) ? [optimizeModel] : [])
                  .concat(optimizeOptions)
                  .map((id) => h('option', { key: id, value: id }, id)),
              ),
            ),
          ),
          h(
            'div',
            { style: css.row },
            h(
              'label',
              { style: css.field },
              h('span', { style: css.label }, t('sizeLabel')),
              h(
                'select',
                { style: css.input, value: defaultSize, onChange: (event) => setDefaultSize(event.target.value) },
                ...sizeOptions.map((item) => h('option', { key: item, value: item }, item)),
              ),
            ),
            h(
              'label',
              { style: css.field },
              h('span', { style: css.label }, t('ratioLabel')),
              h(
                'select',
                { style: css.input, value: defaultRatio, onChange: (event) => setDefaultRatio(event.target.value) },
                ...ratioOptions.map((item) => h('option', { key: item, value: item }, item)),
              ),
            ),
            h(
              'label',
              { style: css.field },
              h('span', { style: css.label }, t('timeoutLabel')),
              h('input', {
                type: 'number',
                min: 30,
                max: 600,
                step: 10,
                style: css.input,
                value: timeoutSeconds,
                onChange: (event) => setTimeoutSeconds(event.target.value),
              }),
            ),
          ),
          h(
            'label',
            { style: css.field },
            h('span', { style: css.label }, t('outputDirLabel')),
            h(
              'div',
              { style: css.row },
              h('input', {
                type: 'text',
                style: { ...css.input, flex: '1 1 280px', fontFamily: 'ui-monospace, monospace' },
                value: outputDir,
                spellCheck: false,
                placeholder: state?.defaultOutputDir || '',
                onChange: (event) => setOutputDir(event.target.value),
              }),
              pickDirectory
                ? h(
                    'button',
                    {
                      type: 'button',
                      style: css.secondary,
                      onClick: async () => {
                        try {
                          const picked = await pickDirectory()
                          if (picked) setOutputDir(picked)
                        } catch (failure) {
                          setError(failure?.message || t('pickFailed'))
                        }
                      },
                    },
                    t('chooseFolder'),
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  style: css.secondary,
                  onClick: () => api('/reveal', { method: 'POST', body: {} }).catch((failure) => setError(failure.message)),
                },
                t('openFolder'),
              ),
            ),
            h(
              'div',
              { style: css.muted },
              `${t('effectiveDir')}：${state?.config?.outputDir || '—'} · ${dirHint(t, state)}`,
            ),
          ),
          h(
            'div',
            { style: css.shelfRow },
            h(
              'button',
              { type: 'button', style: busy ? { ...css.primary, ...css.disabled } : css.primary, disabled: busy, onClick: saveSettings },
              t('saveSettings'),
            ),
          ),
        ),

        h(
          'div',
          { style: css.card },
          h('div', { style: { fontWeight: 600 } }, t('diagnostics')),
          h('div', { style: css.meta }, `${t('diagCredentials')}：${state?.diagnostics?.credentials ? t('available') : t('unavailable')}`),
          h('div', { style: css.meta }, `${t('diagDpapi')}：${state?.diagnostics?.dpapi ? t('available') : t('unavailable')}`),
          h('div', { style: css.meta }, `${t('diagLegacy')}：${state?.diagnostics?.legacyPlaintext ? t('yes') : t('no')}`),
          state?.diagnostics?.legacyPlaintext ? h('div', { style: css.warn }, t('keyStateLegacy')) : null,
          state?.diagnostics?.legacySources ? h('div', { style: css.warn }, t('legacySources')) : null,
        ),
      )
    }
    // ------------------------------------------------------------- 对话里的工具卡片
    function textOf(block) {
      const content = Array.isArray(block?.content) ? block.content : []
      return content
        .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
        .map((item) => item.text)
        .join('\n')
        .trim()
    }

    function imagesOf(block) {
      const content = Array.isArray(block?.content) ? block.content : []
      return content.filter((item) => item && item.type === 'image' && item.attachment)
    }

    function useImageSource(loadImage, attachmentId) {
      const [src, setSrc] = useState('')
      const [state, setState] = useState('idle')
      const [attempt, setAttempt] = useState(0)
      const urlRef = useRef('')

      const retry = useCallback(() => {
        setState('loading')
        setAttempt((value) => value + 1)
      }, [])

      useEffect(() => {
        if (!attachmentId || typeof loadImage !== 'function') {
          setState('idle')
          return undefined
        }
        let alive = true
        setState('loading')
        const peeked = typeof loadImage.peek === 'function' ? loadImage.peek({ attachmentId }) : ''
        if (peeked) {
          setSrc(peeked)
          setState('ready')
          return undefined
        }
        loadImage({ attachmentId })
          .then((url) => {
            if (!alive) return
            urlRef.current = url || ''
            setSrc(url || '')
            setState(url ? 'ready' : 'error')
          })
          .catch(() => {
            if (alive) setState('error')
          })
        return () => {
          alive = false
          if (urlRef.current && urlRef.current !== peeked) URL.revokeObjectURL?.(urlRef.current)
          urlRef.current = ''
        }
      }, [attachmentId, attempt, loadImage])

      return { src, state, retry, attempt }
    }

    function ToolImage({ attachment, loadImage, t }) {
      const { src, state, retry } = useImageSource(loadImage, attachment?.attachmentId)
      const [open, setOpen] = useState(false)

      if (state === 'error') {
        return h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } },
          h('span', null, t('loadFailed')),
          h('button', { type: 'button', onClick: retry, style: css.small }, t('retry')),
        )
      }
      if (!src) {
        return h('div', {
          style: {
            width: 240,
            height: 150,
            borderRadius: 8,
            border: '1px solid var(--dsw-alias-border-l1)',
            background: 'var(--dsw-alias-bg-layer-2)',
          },
        })
      }
      return h(
        'div',
        null,
        h(
          'button',
          {
            type: 'button',
            onClick: () => setOpen(true),
            'aria-label': t('preview'),
            style: { padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block' },
          },
          h('img', {
            src,
            alt: t('preview'),
            style: {
              display: 'block',
              width: 240,
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 8,
              border: '1px solid var(--dsw-alias-border-l1)',
            },
          }),
        ),
        open ? h(Lightbox, { src, alt: t('preview'), onClose: () => setOpen(false), t }) : null,
      )
    }

    function AgnesImageCard(props) {
      const t = props.t
      const phase = props.phase
      const block = props.block
      if (phase !== 'result') {
        return h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', padding: 8 } }, h(Spinner, { label: t('generating') }))
      }
      const text = textOf(block)
      const lines = text ? text.split('\n') : []
      const images = imagesOf(block)
      const isError = Boolean(block?.isError)
      if (isError) {
        return h('div', {
          role: 'alert',
          style: {
            color: 'var(--dsw-alias-state-error-primary)',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            maxHeight: 240,
            overflow: 'auto',
          },
        }, text || t('failed'))
      }
      const metaLine = lines[1] || ''
      const warnLines = lines.slice(2)
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: 4 } },
        images.length
          ? h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              ...images.map((item, index) => h(ToolImage, {
                key: item.attachment?.attachmentId ?? `image-${index}`,
                attachment: item.attachment,
                loadImage: props.loadImage,
                t,
              })),
            )
          : null,
        metaLine ? h('div', { style: css.meta }, metaLine) : null,
        ...warnLines.map((line, index) => h('div', { key: `line-${index}`, style: css.warn }, line)),
      )
    }

    // ------------------------------------------------------------- 注册
    return {
      inject: ['slots', 'locale', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => {
          const disposers = []
          try {
            disposers.push(ctx.locale.register(NS, 'zh-CN', ZH))
          } catch {
            // 已注册过同一语言：忽略。
          }
          try {
            disposers.push(ctx.locale.register(NS, 'en', EN))
          } catch {
            // 同上。
          }
          try {
            disposers.push(ctx.locale.register(NS, 'zh', ZH))
          } catch {
            // 'zh' 不是必需的别名。
          }
          return () => {
            for (const dispose of disposers) {
              try {
                dispose()
              } catch {
                // 幂等卸载。
              }
            }
          }
        })

        const t = ctx.locale.bind(NS)

        layoutService = ctx.get('layout') ?? null

        const pickDirectory = async () => {
          const service = ctx.get('uiWorkspace')
          if (!service || typeof service.pickDirectory !== 'function') return null
          return await service.pickDirectory()
        }

        ctx.effect(() =>
          ctx.slots.inject('tool.call.toolview', () =>
            ctx.slots.register(
              { name: 'tool.call.toolview', key: 'agnes_image_generate', locale: NS },
              (props) => h(AgnesImageCard, { ...props, t }),
            ),
          ),
        )

        // 侧栏行：常开（不像插件市场那样需要用户手动打开）。
        ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: 2, label: () => t('nav'), locale: NS },
          (owner) => h(Icon, { size: owner?.size ?? 16 }),
        )

        // 主面板：点侧栏行时由 layout 按同名 key 选中。
        ctx.slots.register(
          { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t }) },
          () => h(PanelShell, { t, pickDirectory }),
        )

        // 设置 → 生图
        ctx.slots.register(
          { name: 'settings.section', id: SECTION_ID, order: 45, label: () => t('nav'), locale: NS, inject: () => ({ t }) },
          () => h(SettingsPage, { t, pickDirectory }),
        )

        ctx.slots.register(
          { name: 'settings.section.icon', id: SECTION_ID },
          () => h(Icon, { size: 18 }),
        )

        // 插件详情页里的配置页（只有整页视图才渲染，避免和摘要重复）。
        ctx.slots.register(
          { name: 'plugins.bundle.config', key: PKG, locale: NS, inject: () => ({ t }) },
          (props) => (props?.view === 'page' ? h(SettingsPage, { t, pickDirectory }) : null),
        )

        // 插件卸载时把侧栏面板让回给对话页，避免停在空白面板上。
        ctx.effect(() => () => {
          try {
            const layout = ctx.get('layout')
            if (layout?.panelInfo?.getSnapshot?.()?.activePanelId === PANEL_ID) layout.selectPanel(null)
          } catch {
            // 卸载阶段尽力而为。
          }
        })
      },
    }
  },
})
