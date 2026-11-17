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
    const MODE_KEY = 'agnes-image-gen/mode'
    const REF_MEDIA = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

    // 本地兜底判断：/models 没给 img2img 标志时按命名猜。
    function img2imgSupport(model) {
      const id = String(model ?? '').toLowerCase()
      if (!id) return 'unknown'
      if (/^agnes-image-2\.\d+-flash$/.test(id) || /^agnes-image-2\.\d+$/.test(id)) return 'yes'
      if (/^agnes-\d+\.\d+-(flash|pro)$/.test(id) || /^agnes-image-\d+\.?\d*-?nano$/.test(id)) return 'no'
      return 'unknown'
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
      failed: '生成失败',
      openFolder: '打开文件夹',
      download: '下载',
      copied: '已复制',
      regenerate: '再来一张',
      emptyResult: '生成结果会显示在这里。',
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
      retry: '重试',
      close: '关闭',
      preview: '预览',
      loadFailed: '图片加载失败',
      generating: '生成中',
      saveFailed: '保存失败',
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
      copyPrompt: '复制提示词',
      copyFailed: '复制失败',
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
      modeText: '文生图',
      modeImage: '图生图',
      refsNeeded: '请先添加至少一张参考图。',
      dropHint: '点击选择图片，或把图片拖到这里',
      dropActive: '松开即可添加',
      uploading: '上传中…',
      uploadFailed: '上传失败',
      uploadTooLarge: '图片超过 {size} 上限',
      notImage: '只支持 png / jpeg / webp / gif。',
      refsFull: '参考图最多 {n} 张。',
      img2imgUnsupported: '当前模型不支持图生图，请换一个模型或切回文生图。',
      img2imgUnknown: '还没验证过这个模型是否支持图生图，生成可能失败。',
      sendToReferences: '发送到参考图',
      sentToReferences: '已加入 {n} 张参考图',
      sentSkipped: '{n} 张超出上限被跳过（最多 {max}）',
      addToReference: '添加到参考图',
      prevImage: '上一张',
      nextImage: '下一张',
      imagePosition: '{n} / {total}',
      sendModeTitle: '添加到参考图',
      sendModeHint: '画图页已有参考图或提示词，选择处理方式：',
      sendAppend: '追加到参考图',
      sendReplace: '新建参考图（清空原有）',
      openFolder: '打开文件夹',
      folderOpened: '已在资源管理器中定位该图片',
      openFolderFailed: '打开文件夹失败',
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
      failed: 'Generation failed',
      openFolder: 'Open folder',
      download: 'Download',
      copied: 'Copied',
      regenerate: 'One more',
      emptyResult: 'Results appear here.',
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
      retry: 'Retry',
      close: 'Close',
      preview: 'Preview',
      loadFailed: 'Could not load image',
      generating: 'Generating',
      saveFailed: 'Save failed',
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
      copyPrompt: 'Copy prompt',
      copyFailed: 'Copy failed',
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
      modeText: 'Text to image',
      modeImage: 'Image to image',
      refsNeeded: 'Add at least one reference image first.',
      dropHint: 'Click to choose images, or drop them here',
      dropActive: 'Release to add',
      uploading: 'Uploading…',
      uploadFailed: 'Upload failed',
      uploadTooLarge: 'Image is larger than {size}',
      notImage: 'Only png / jpeg / webp / gif are supported.',
      refsFull: 'You can add at most {n} references.',
      img2imgUnsupported: 'This model does not support image-to-image. Pick another model or switch back to text-to-image.',
      img2imgUnknown: 'This model has not been verified for image-to-image — generation may fail.',
      sendToReferences: 'Send to references',
      sentToReferences: 'Added {n} to references',
      sentSkipped: '{n} skipped (limit {max})',
      addToReference: 'Add to references',
      prevImage: 'Previous',
      nextImage: 'Next',
      imagePosition: '{n} / {total}',
      sendModeTitle: 'Add to references',
      sendModeHint: 'The drawing page already has references or a prompt. Choose how to proceed:',
      sendAppend: 'Append to references',
      sendReplace: 'Start a new reference set (clear current)',
      openFolder: 'Open folder',
      folderOpened: 'Revealed the image in File Explorer',
      openFolderFailed: 'Could not open the folder',
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
      modeTabs: {
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      dropzone: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 96,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px dashed var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        textAlign: 'center',
        cursor: 'pointer',
      },
      dropzoneActive: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 96,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px dashed var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        textAlign: 'center',
        cursor: 'pointer',
      },
      bannerWarn: {
        display: 'flex',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-state-warn-primary)',
        color: 'var(--dsw-alias-state-warn-primary)',
        fontSize: 12,
        lineHeight: 1.5,
      },
      bannerError: {
        display: 'flex',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: 12,
        lineHeight: 1.5,
      },
      error: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, whiteSpace: 'pre-wrap' },
      warn: { color: 'var(--dsw-alias-state-warn-primary)', fontSize: 12 },
      ok: { color: 'var(--dsw-alias-state-success-primary)', fontSize: 12 },
      muted: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 },
      sectionLabel: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      viewer: {
        position: 'fixed',
        // 让出 Windows 自绘标题栏：DSH 用 --dsh-frame-chrome-top 发布标题栏高度，
        // 覆盖层必须从标题栏下沿开始，否则会盖住窗口的最小化 / 最大化 / 关闭按钮。
        top: 'var(--dsh-frame-chrome-top, 0px)',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--dsw-alias-bg-overlay)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: 16,
        zIndex: 2000,
        padding: '12px 16px 16px',
        flexWrap: 'nowrap',
        overflow: 'hidden',
      },
      viewerStage: {
        position: 'relative',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
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
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        transformOrigin: 'center',
        willChange: 'transform',
      },
      viewerToolbar: {
        position: 'absolute',
        left: 24,
        bottom: 24,
        zIndex: 2,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap',
        maxWidth: 'calc(100% - 48px)',
        padding: '4px 8px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-overlay)',
        border: '1px solid var(--dsw-alias-border-l2)',
        fontSize: 12,
      },
      viewerSide: {
        flex: '0 1 320px',
        minWidth: 240,
        maxHeight: '100%',
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

    // ------------------------------------------------------------- 统一按钮
    // 内联样式没法写 :hover / :focus-visible，所以注入一份命名空间化的样式表；
    // 选中器全部带 .agnes- 前缀，卸载时整张表移除，不影响宿主 UI。
    const STYLE_ID = 'agnes-image-gen-ui'
    const BUTTON_CSS = `
.agnes-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 14px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;line-height:1;white-space:nowrap;text-decoration:none;cursor:pointer;transition:background-color .15s ease,border-color .15s ease,color .15s ease,filter .15s ease,opacity .15s ease}
.agnes-btn:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1)}
.agnes-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.agnes-btn:active{opacity:.9}
.agnes-btn:disabled,.agnes-btn[aria-disabled="true"]{opacity:.45;cursor:not-allowed}
.agnes-btn:disabled:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.agnes-btn--primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.agnes-btn--primary:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);filter:brightness(1.06)}
.agnes-btn--ghost{border-color:var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary)}
.agnes-btn--danger{border-color:var(--dsw-alias-state-error-primary);background:transparent;color:var(--dsw-alias-state-error-primary)}
.agnes-btn--danger:hover{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1)}
.agnes-btn--danger-solid{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base)}
.agnes-btn--sm{min-height:26px;padding:0 10px;font-size:12px;border-radius:8px;font-weight:500}
.agnes-btn--icon{min-height:26px;min-width:26px;padding:0 6px;font-size:12px;font-weight:500}
.agnes-btn--block{width:100%;justify-content:flex-start}
`
    const VARIANTS = new Set(['primary', 'ghost', 'danger', 'danger-solid'])

    function Button({ variant = 'default', size = 'md', block = false, href, download, disabled = false, onClick, title, ariaLabel, ariaSelected, role, buttonRef, style, children }) {
      const className = [
        'agnes-btn',
        VARIANTS.has(variant) ? `agnes-btn--${variant}` : '',
        size === 'sm' ? 'agnes-btn--sm' : '',
        size === 'icon' ? 'agnes-btn--icon' : '',
        block ? 'agnes-btn--block' : '',
      ]
        .filter(Boolean)
        .join(' ')
      const shared = {
        ref: buttonRef,
        className,
        title,
        role,
        'aria-label': ariaLabel,
        'aria-selected': ariaSelected === undefined ? undefined : ariaSelected ? 'true' : 'false',
        style,
      }
      if (href) {
        return h('a', { ...shared, href, download, 'aria-disabled': disabled ? 'true' : undefined }, children)
      }
      return h('button', { ...shared, type: 'button', disabled, onClick: disabled ? undefined : onClick }, children)
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

    /** 把本地文件读成 data URL（上传参考图用）。 */
    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('read-failed'))
        reader.readAsDataURL(file)
      })
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text)
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
    function Lightbox({ src, name, path, meta, bytes, onClose, t, onUseReference, canUseReference = false, onPrev, onNext, position = '' }) {
      const [scale, setScale] = useState(1)
      const [offset, setOffset] = useState({ x: 0, y: 0 })
      const [dragging, setDragging] = useState(false)
      const [notice, setNotice] = useState('')
      const stageRef = useRef(null)
      const imgRef = useRef(null)
      const dragRef = useRef(null)
      const closeRef = useRef(null)

      const clampScale = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
      const zoomBy = useCallback((factor) => {
        setScale((current) => {
          const next = clampScale(current * factor)
          if (next <= 1) setOffset({ x: 0, y: 0 })
          return next
        })
      }, [])
      const reset = useCallback(() => {
        setScale(1)
        setOffset({ x: 0, y: 0 })
      }, [])

      useEffect(() => {
        reset()
      }, [reset, src])

      // 限制平移范围：图比舞台大时可以露出边缘，图比舞台小时只能在本区域内挪动。
      const clampOffset = useCallback((next, scaleValue) => {
        const stage = stageRef.current
        const image = imgRef.current
        if (!stage || !image) return next
        const stageBox = stage.getBoundingClientRect()
        const imageBox = image.getBoundingClientRect()
        const baseWidth = imageBox.width / (scaleValue || 1)
        const baseHeight = imageBox.height / (scaleValue || 1)
        const scaledWidth = baseWidth * scaleValue
        const scaledHeight = baseHeight * scaleValue
        const maxX = Math.max(0, Math.abs(scaledWidth - stageBox.width) / 2)
        const maxY = Math.max(0, Math.abs(scaledHeight - stageBox.height) / 2)
        return {
          x: Math.min(maxX, Math.max(-maxX, next.x)),
          y: Math.min(maxY, Math.max(-maxY, next.y)),
        }
      }, [])

      useEffect(() => {
        const element = stageRef.current
        if (!element) return undefined
        const onWheel = (event) => {
          event.preventDefault()
          zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12)
        }
        element.addEventListener('wheel', onWheel, { passive: false })
        return () => element.removeEventListener('wheel', onWheel)
      }, [zoomBy])

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
            return
          }
          if (event.key === 'ArrowLeft' && onPrev) {
            event.preventDefault()
            onPrev()
            return
          }
          if (event.key === 'ArrowRight' && onNext) {
            event.preventDefault()
            onNext()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose, onNext, onPrev, reset, zoomBy])

      const flash = useCallback((message) => {
        setNotice(message)
        window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 3200)
      }, [])

      const doCopyPrompt = useCallback(async () => {
        const ok = await copyText(String(meta?.prompt ?? ''))
        flash(ok ? t('copied') : t('copyFailed'))
      }, [flash, meta, t])

      const revealFolder = useCallback(async () => {
        if (!path) return
        try {
          await api('/reveal', { method: 'POST', body: { path } })
          flash(t('folderOpened'))
        } catch (failure) {
          flash(`${t('openFolderFailed')}：${failure.message}`)
        }
      }, [flash, path, t])

      const onPointerDown = (event) => {
        if (event.button !== 0) return
        // 只按在图片本体上才起拖；工具条按钮、侧栏、背景都保持原生点击。
        if (scale <= 1 || !event.target.closest('img')) return
        event.preventDefault()
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
        setDragging(true)
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // 指针捕获不可用时退化为普通拖动。
        }
      }

      const onPointerMove = (event) => {
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        setOffset(clampOffset({ x: drag.ox + (event.clientX - drag.x), y: drag.oy + (event.clientY - drag.y) }, scale))
      }

      const endDrag = (event) => {
        const drag = dragRef.current
        if (drag && event?.pointerId === drag.id) {
          try {
            event.currentTarget.releasePointerCapture(drag.id)
          } catch {
            // 已经释放时忽略。
          }
        }
        dragRef.current = null
        setDragging(false)
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

      const nav = onPrev || onNext
        ? h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, paddingLeft: 8, borderLeft: '1px solid var(--dsw-alias-border-l1)' } },
            h(
              Button,
              { size: 'icon', title: t('prevImage'), ariaLabel: t('prevImage'), disabled: !onPrev, onClick: onPrev },
              '‹',
            ),
            h('span', { style: { minWidth: 52, textAlign: 'center', fontSize: 12 } }, position || ''),
            h(
              Button,
              { size: 'icon', title: t('nextImage'), ariaLabel: t('nextImage'), disabled: !onNext, onClick: onNext },
              '›',
            ),
          )
        : null

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
            ref: stageRef,
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onDoubleClick: () => {
              if (scale === 1) setScale(2)
              else reset()
            },
          },
          h('img', {
            ref: imgRef,
            src,
            alt: name || t('preview'),
            draggable: false,
            onDragStart: (event) => event.preventDefault(),
            style: {
              ...css.viewerImage,
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              cursor: dragging ? 'grabbing' : scale > 1 ? 'grab' : 'move',
            },
          }),
        ),
        h(
          'div',
          { style: css.viewerToolbar },
          h(Button, { size: 'icon', title: t('zoomOut'), ariaLabel: t('zoomOut'), onClick: () => zoomBy(0.8) }, '−'),
          h('span', { style: { minWidth: 46, textAlign: 'center' } }, `${Math.round(scale * 100)}%`),
          h(Button, { size: 'icon', title: t('zoomIn'), ariaLabel: t('zoomIn'), onClick: () => zoomBy(1.25) }, '+'),
          h(Button, { size: 'sm', onClick: reset }, t('zoomReset')),
          nav,
        ),
        h(
          'div',
          { style: css.viewerSide },
          h(
            'div',
            { style: { display: 'flex', gap: 8, alignItems: 'flex-start' } },
            h('strong', { style: { fontSize: 14, wordBreak: 'break-all', flex: '1 1 auto', minWidth: 0 } }, name || t('preview')),
            h(
              Button,
              { buttonRef: closeRef, size: 'icon', variant: 'ghost', style: { flex: '0 0 auto' }, title: t('close'), ariaLabel: t('close'), onClick: onClose },
              '×',
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
            { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h(
              Button,
              { variant: 'primary', block: true, href: src, download: name || 'agnes-image.png' },
              t('download'),
            ),
            meta?.prompt
              ? h(Button, { block: true, onClick: doCopyPrompt }, t('copyPrompt'))
              : null,
            canUseReference && path
              ? h(Button, { block: true, onClick: () => onUseReference?.({ path, name }) }, t('useAsReference'))
              : null,
            path ? h(Button, { block: true, onClick: revealFolder }, t('openFolder')) : null,
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
            pickDirectory ? h(Button, { size: 'sm', onClick: chooseFolder }, t('chooseFolder')) : null,
          ),
          h('div', { style: css.muted }, dirHint(t, state)),
        ),
        h(
          'div',
          { style: css.shelfRow },
          h(Button, { variant: 'primary', block: true, disabled: busy, onClick: save }, t('saveSource')),
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
      const [mode, setMode] = useState(() => {
        try {
          return window.sessionStorage.getItem(MODE_KEY) === 'image' ? 'image' : 'text'
        } catch {
          return 'text'
        }
      })
      const [references, setReferences] = useState([])
      const [prompt, setPrompt] = useState('')

      const go = useCallback((next) => {
        setPage(next)
        if (next === 'gallery') setGalleryMounted(true)
        try {
          window.sessionStorage.setItem(PAGE_KEY, next)
        } catch {
          // 会话存储不可用时只在内存里记忆。
        }
      }, [])

      const chooseMode = useCallback((next) => {
        const value = next === 'image' ? 'image' : 'text'
        setMode(value)
        try {
          window.sessionStorage.setItem(MODE_KEY, value)
        } catch {
          // 同上。
        }
      }, [])

      const addReference = useCallback(
        (item) => {
          const target = typeof item === 'string' ? item : item?.path
          if (!target) return false
          if (references.some((ref) => ref.path === target)) return false
          if (references.length >= MAX_REFERENCES) return false
          setReferences([...references, { path: target, name: typeof item === 'string' ? '' : String(item?.name ?? '') }])
          return true
        },
        [references],
      )

      // 批量加入：超出上限的部分返回给调用方提示。
      const addReferences = useCallback(
        (items) => {
          const list = Array.isArray(items) ? items : []
          const next = [...references]
          let skipped = 0
          for (const item of list) {
            const target = typeof item === 'string' ? item : item?.path
            if (!target || next.some((ref) => ref.path === target) || next.length >= MAX_REFERENCES) {
              skipped += 1
              continue
            }
            next.push({ path: target, name: typeof item === 'string' ? '' : String(item?.name ?? '') })
          }
          if (next.length !== references.length) setReferences(next)
          return skipped
        },
        [references],
      )

      const removeReference = useCallback((target) => {
        setReferences((current) => current.filter((ref) => ref.path !== target))
      }, [])

      const useReference = useCallback(
        (item) => {
          if (addReference(item)) go('create')
        },
        [addReference, go],
      )

      // 图库「发送到参考图」：mode='replace' 时清空原有参考图与提示词，再切回画图页的图生图模式。
      const sendToReferences = useCallback(
        (items, mode) => {
          const list = Array.isArray(items) ? items : []
          let skipped = 0
          if (mode === 'replace') {
            const next = list
              .map((item) => ({
                path: typeof item === 'string' ? item : item?.path,
                name: typeof item === 'string' ? '' : String(item?.name ?? ''),
              }))
              .filter((item) => Boolean(item.path))
              .slice(0, MAX_REFERENCES)
            skipped = Math.max(0, list.length - next.length)
            setReferences(next)
            setPrompt('')
          } else {
            skipped = addReferences(list)
          }
          chooseMode('image')
          go('create')
          return skipped
        },
        [addReferences, chooseMode, go],
      )

      // 结果图「添加到参考图」：用它替换现有参考图，并清空提示词。
      const replaceReferences = useCallback(
        (items) => {
          const list = Array.isArray(items) ? items : []
          const next = list
            .map((item) => ({
              path: typeof item === 'string' ? item : item?.path,
              name: typeof item === 'string' ? '' : String(item?.name ?? ''),
            }))
            .filter((item) => Boolean(item.path))
            .slice(0, MAX_REFERENCES)
          setReferences(next)
          setPrompt('')
          chooseMode('image')
          go('create')
        },
        [chooseMode, go],
      )

      const tab = (id, label) =>
        h(
          Button,
          {
            variant: page === id ? 'primary' : 'ghost',
            size: 'sm',
            role: 'tab',
            ariaSelected: page === id,
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
            mode,
            onMode: chooseMode,
            prompt,
            onPrompt: setPrompt,
            references,
            onAddReference: addReference,
            onAddReferences: addReferences,
            onReplaceReferences: replaceReferences,
            onRemoveReference: removeReference,
          }),
        ),
        galleryMounted
          ? h(
              'div',
              { role: 'tabpanel', style: page === 'gallery' ? undefined : css.hidden },
              h(GalleryView, {
                t,
                active: page === 'gallery',
                onUseReference: useReference,
                onSendToReferences: sendToReferences,
                hasCanvasContent: Boolean(references.length || prompt.trim()),
              }),
            )
          : null,
      )
    }

    function CreateView({ t, pickDirectory, mode = 'text', onMode, prompt = '', onPrompt, references = [], onAddReferences, onReplaceReferences, onRemoveReference }) {
      const [state, setState] = useState(undefined)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [model, setModel] = useState('')
      const [size, setSize] = useState('')
      const [ratio, setRatio] = useState('')
      const [sourceId, setSourceId] = useState('')
      const [models, setModels] = useState([])
      const [job, setJob] = useState(undefined)
      const [jobId, setJobId] = useState('')
      const [busy, setBusy] = useState(false)
      const [uploading, setUploading] = useState(false)
      const [dragging, setDragging] = useState(false)
      const [optimizing, setOptimizing] = useState(false)
      const [optimizedFrom, setOptimizedFrom] = useState('')
      const [armedDelete, setArmedDelete] = useState('')
      const [preview, setPreview] = useState(null)
      const fileInput = useRef(null)
      const imageMode = mode === 'image'

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
      const modelEntry = (state?.caps?.models ?? []).find((item) => item.id === model)
      const support =
        typeof modelEntry?.img2img === 'boolean' ? (modelEntry.img2img ? 'yes' : 'no') : img2imgSupport(model)
      const refsMissing = imageMode && !references.length
      const genDisabled = Boolean(
        busy || running || !ready || !keyReady || uploading || (imageMode && (refsMissing || support === 'no')),
      )

      const uploadFiles = useCallback(
        async (fileList) => {
          const files = Array.from(fileList ?? [])
          if (!files.length) return
          const images = files.filter((file) => file && REF_MEDIA.includes(file.type))
          if (!images.length) {
            setError(t('notImage'))
            return
          }
          const maxBytes = Number(state?.caps?.maxReferenceBytes) || 24 * 1024 * 1024
          const room = MAX_REFERENCES - references.length
          if (room <= 0) {
            setError(t('refsFull').replace('{n}', String(MAX_REFERENCES)))
            return
          }
          setUploading(true)
          setError('')
          setNotice('')
          const saved = []
          let skipped = 0
          for (const file of images) {
            if (saved.length >= room) {
              skipped += 1
              continue
            }
            if (file.size > maxBytes) {
              setError(t('uploadTooLarge').replace('{size}', formatBytes(maxBytes)))
              skipped += 1
              continue
            }
            try {
              const dataUrl = await readFileAsDataUrl(file)
              const result = await api('/reference', { method: 'POST', body: { name: file.name, dataUrl } })
              if (result?.reference) saved.push(result.reference)
              else skipped += 1
            } catch (failure) {
              setError(`${t('uploadFailed')}：${failure.message}`)
              skipped += 1
            }
          }
          if (saved.length) onAddReferences?.(saved)
          setUploading(false)
          if (saved.length) {
            const extra = skipped
              ? ` · ${t('sentSkipped').replace('{n}', String(skipped)).replace('{max}', String(MAX_REFERENCES))}`
              : ''
            setNotice(`${t('sentToReferences').replace('{n}', String(saved.length))}${extra}`)
          }
        },
        [onAddReferences, references.length, state, t],
      )

      const onDrop = useCallback(
        (event) => {
          event.preventDefault()
          setDragging(false)
          uploadFiles(event.dataTransfer?.files)
        },
        [uploadFiles],
      )

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
        if (imageMode && !references.length) {
          setError(t('refsNeeded'))
          return
        }
        if (imageMode && support === 'no') {
          setError(t('img2imgUnsupported'))
          return
        }
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
              images: imageMode && references.length ? references.map((ref) => ref.path) : undefined,
            },
          })
          setJob({ id: response.jobId, state: 'running', startedAt: Date.now(), params: { model, size, ratio, prompt: text, mode: imageMode ? 'img2img' : 'txt2img' } })
          setJobId(response.jobId)
          setOptimizedFrom('')
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }, [busy, imageMode, model, prompt, ratio, references, running, size, sourceId, support, t])

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
          onPrompt?.(result.prompt ?? text)
          setNotice(t('optimized'))
        } catch (failure) {
          setError(failure.message)
        } finally {
          setOptimizing(false)
        }
      }, [onPrompt, optimizing, prompt, sourceId, t])

      const undoOptimize = useCallback(() => {
        if (!optimizedFrom) return
        onPrompt?.(optimizedFrom)
        setOptimizedFrom('')
        setNotice('')
      }, [onPrompt, optimizedFrom])

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
            setPreview(null)
            setNotice(t('deleted'))
            await load()
            setJob((current) => (current?.result?.path === target ? undefined : current))
          } catch (failure) {
            setError(`${t('deleteFailed')}：${failure.message}`)
          }
        },
        [armedDelete, armDelete, load, t],
      )

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
              h(
                'div',
                { style: css.modeTabs, role: 'tablist', 'aria-label': t('panelTitle') },
                h(
                  Button,
                  {
                    variant: imageMode ? 'ghost' : 'primary',
                    role: 'tab',
                    ariaSelected: !imageMode,
                    onClick: () => onMode?.('text'),
                  },
                  t('modeText'),
                ),
                h(
                  Button,
                  {
                    variant: imageMode ? 'primary' : 'ghost',
                    role: 'tab',
                    ariaSelected: imageMode,
                    onClick: () => onMode?.('image'),
                  },
                  t('modeImage'),
                ),
              ),
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
                  onChange: (event) => onPrompt?.(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault()
                      generate()
                    }
                  },
                }),
              ),
              imageMode
                ? h(
                    'div',
                    { style: css.field },
                    h('span', { style: css.label }, `${t('referenceTitle')} · ${references.length}/${MAX_REFERENCES}`),
                    h(
                      'div',
                      {
                        role: 'button',
                        tabIndex: 0,
                        style: dragging ? css.dropzoneActive : css.dropzone,
                        onClick: () => fileInput.current?.click(),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            fileInput.current?.click()
                          }
                        },
                        onDragOver: (event) => {
                          event.preventDefault()
                          setDragging(true)
                        },
                        onDragLeave: () => setDragging(false),
                        onDrop: onDrop,
                        'aria-label': t('dropHint'),
                      },
                      h('span', null, dragging ? t('dropActive') : uploading ? t('uploading') : t('dropHint')),
                      h('span', { style: css.muted }, t('referenceHint').replace('{n}', String(MAX_REFERENCES))),
                    ),
                    h('input', {
                      ref: fileInput,
                      type: 'file',
                      accept: 'image/png,image/jpeg,image/webp,image/gif',
                      multiple: true,
                      style: { display: 'none' },
                      onChange: (event) => {
                        uploadFiles(event.target.files)
                        event.target.value = ''
                      },
                    }),
                  )
                : null,
              imageMode && support === 'no' ? h('div', { style: css.bannerError }, t('img2imgUnsupported')) : null,
              imageMode && support === 'unknown' ? h('div', { style: css.bannerWarn }, t('img2imgUnknown')) : null,
              h(
                'div',
                { style: css.shelfRow },
                h(
                  Button,
                  {
                    size: 'sm',
                    disabled: optimizing || !prompt.trim() || !keyReady,
                    onClick: optimize,
                    title: t('optimizeHint'),
                  },
                  optimizing ? t('optimizing') : t('optimizePrompt'),
                ),
                optimizedFrom ? h(Button, { size: 'sm', onClick: undoOptimize }, t('undoOptimize')) : null,
                prompt ? h(Button, { size: 'sm', onClick: () => onPrompt?.('') }, t('clear')) : null,
              ),
              imageMode && references.length
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
                  h(Button, { variant: 'primary', block: true, disabled: genDisabled, onClick: generate }, t('generate')),
                  running ? h(Button, { variant: 'danger', block: true, onClick: cancel }, t('cancel')) : null,
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
                  h(Button, { size: 'sm', onClick: generate }, t('retry')),
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
                    h(Button, { variant: 'primary', disabled: busy || running, onClick: generate }, t('regenerate')),
                    savedPath
                      ? h(
                          Button,
                          {
                            disabled: busy || running,
                            onClick: () =>
                              onReplaceReferences?.([{ path: savedPath, name: result?.name ?? '' }]),
                            title: t('addToReference'),
                          },
                          t('addToReference'),
                        )
                      : null,
                    savedPath
                      ? h(
                          Button,
                          {
                            variant: 'danger',
                            onClick: () => deleteImage(savedPath),
                            ariaLabel: t('deleteImage'),
                          },
                          armedDelete === savedPath ? t('confirmDelete') : t('deleteImage'),
                        )
                      : null,
                  ),
                  ...(result.warnings ?? []).map((warning, index) => h('div', { key: `warn-${index}`, style: css.warn }, warning)),
                )
              : null,
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
    function GalleryView({ t, active, onUseReference, onSendToReferences, hasCanvasContent = false }) {
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
      const [sendOpen, setSendOpen] = useState(false)

      const previewIndex = useMemo(() => {
        if (!preview?.path) return -1
        return files.findIndex((file) => file.path === preview.path)
      }, [files, preview])

      const openAt = useCallback(
        (position) => {
          const file = files[position]
          if (!file) return
          setPreview({
            src: routeUrl(`/image?path=${encodeURIComponent(file.path)}`),
            name: file.name,
            path: file.path,
            meta: file.meta,
          })
        },
        [files],
      )

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

      useEffect(() => {
        if (!sendOpen) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setSendOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [sendOpen])

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

      const applySend = useCallback(
        (mode) => {
          if (!selected.size || busy) return
          const items = files.filter((file) => selected.has(file.path))
          const skipped = onSendToReferences?.(items, mode) ?? 0
          const added = items.length - skipped
          setSendOpen(false)
          setArmed('')
          setSelected(new Set())
          setError('')
          if (added > 0) {
            const extra = skipped ? ` · ${t('sentSkipped').replace('{n}', String(skipped)).replace('{max}', String(MAX_REFERENCES))}` : ''
            setNotice(`${t('sentToReferences').replace('{n}', String(added))}${extra}`)
          } else {
            setError(t('refsFull').replace('{n}', String(MAX_REFERENCES)))
          }
        },
        [busy, files, onSendToReferences, selected, t],
      )

      const requestSend = useCallback(() => {
        if (!selected.size || busy) return
        if (hasCanvasContent) {
          setSendOpen(true)
          return
        }
        applySend('append')
      }, [applySend, busy, hasCanvasContent, selected])

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
          setPreview((current) => (current?.path && paths.includes(current.path) ? null : current))
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
            setPreview((current) => (current?.path === target ? null : current))
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
          h(Button, { variant: 'ghost', size: 'sm', onClick: load, disabled: loading }, t('refresh')),
        ),
        h(
          'div',
          { style: css.galleryToolbar },
          h('span', { style: css.muted }, t('groupCount', { n: files.length })),
          selected.size ? h('span', { style: css.ok }, t('selectedCount', { n: selected.size })) : null,
          h(
            Button,
            {
              variant: 'ghost',
              size: 'sm',
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
                Button,
                {
                  variant: 'ghost',
                  size: 'sm',
                  onClick: () => {
                    setArmed('')
                    setSelected(new Set())
                  },
                },
                t('clearSelection'),
              )
            : null,
          h(Button, { disabled: !selected.size || busy, onClick: requestSend }, t('sendToReferences')),
          h(
            Button,
            {
              variant: 'danger',
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
              h(Button, { variant: 'ghost', size: 'sm', onClick: () => toggleGroup(group.items) }, t('selectAll')),
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
        sendOpen
          ? h(
              'div',
              {
                style: {
                  position: 'fixed',
                  top: 'var(--dsh-frame-chrome-top, 0px)',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2100,
                  padding: 24,
                  background: 'var(--dsw-alias-bg-overlay)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                onClick: (event) => {
                  if (event.target === event.currentTarget) setSendOpen(false)
                },
              },
              h(
                'div',
                {
                  role: 'dialog',
                  'aria-modal': 'true',
                  'aria-label': t('sendModeTitle'),
                  style: {
                    ...css.card,
                    maxWidth: 460,
                    width: '100%',
                    background: 'var(--dsw-alias-bg-layer-1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  },
                },
                h('strong', null, t('sendModeTitle')),
                h('div', { style: css.muted }, t('sendModeHint')),
                h(Button, { variant: 'primary', block: true, onClick: () => applySend('append') }, t('sendAppend')),
                h(Button, { block: true, onClick: () => applySend('replace') }, t('sendReplace')),
                h(Button, { variant: 'ghost', block: true, onClick: () => setSendOpen(false) }, t('cancel')),
              ),
            )
          : null,
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
              onPrev: previewIndex > 0 ? () => openAt(previewIndex - 1) : null,
              onNext: previewIndex >= 0 && previewIndex < files.length - 1 ? () => openAt(previewIndex + 1) : null,
              position:
                previewIndex >= 0
                  ? t('imagePosition').replace('{n}', String(previewIndex + 1)).replace('{total}', String(files.length))
                  : '',
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
                        Button,
                        { size: 'sm', disabled: testingId === source.id, onClick: () => testFor(source.id) },
                        testingId === source.id ? t('testing') : t('testThis'),
                      ),
                      h(
                        Button,
                        {
                          size: 'sm',
                          onClick: () => {
                            setKeyFor(keyFor === source.id ? '' : source.id)
                            setKeyValue('')
                          },
                        },
                        t('saveKey'),
                      ),
                      source.key?.hasStored
                        ? h(Button, { size: 'sm', disabled: busy, onClick: () => clearKeyFor(source.id) }, t('clearKey'))
                        : null,
                      source.isDefault
                        ? null
                        : h(Button, { size: 'sm', disabled: busy, onClick: () => makeDefault(source.id) }, t('setDefault')),
                      h(
                        Button,
                        {
                          variant: armedSource === source.id ? 'danger-solid' : 'danger',
                          size: 'sm',
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
                            Button,
                            { size: 'sm', disabled: busy, onClick: () => saveKeyFor(source.id) },
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
            h(Button, { variant: 'primary', disabled: busy, onClick: addSource }, t('addSource')),
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
                    Button,
                    {
                      size: 'sm',
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
                Button,
                {
                  size: 'sm',
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
            h(Button, { variant: 'primary', disabled: busy, onClick: saveSettings }, t('saveSettings')),
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
          h(Button, { size: 'sm', onClick: retry }, t('retry')),
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
        open ? h(Lightbox, { src, name: t('preview'), onClose: () => setOpen(false), t }) : null,
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

        const pickDirectory = async () => {
          const service = ctx.get('uiWorkspace')
          if (!service || typeof service.pickDirectory !== 'function') return null
          return await service.pickDirectory()
        }

        // 统一按钮样式：注入一份带命名空间的样式表，插件卸载时整张移除。
        ctx.effect(() => {
          const element = document.createElement('style')
          element.id = STYLE_ID
          element.textContent = BUTTON_CSS
          document.head.appendChild(element)
          return () => {
            try {
              element.remove()
            } catch {
              // 已被宿主清理时忽略。
            }
          }
        })

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
