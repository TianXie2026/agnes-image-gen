// Host 侧的领域服务：配置、密钥门面、模型列表、生成任务、历史、路径守卫。
// HTTP 路由（http.js）和 Agent 工具（index.js）都走这里，保证两条入口行为一致。

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, realpath, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

import { buildRequestBody, generateImage, listModels, sniffMediaType } from './api.js'
import {
  defaultOutputDir,
  defaultOutputInfo,
  deleteImageMeta,
  invalidateDefaultOutputDir,
  isInside,
  listImageFiles,
  readImageSize,
  readLocalImage,
  resolveOutputDir,
  saveImageFile,
  writeImageMeta,
} from './files.js'
import { optimizePrompt } from './optimize.js'
import {
  AppError,
  DEFAULT_OPTIMIZE_MODEL,
  MAX_IMAGES,
  MAX_PROMPT_CHARS,
  MAX_SOURCES,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  MODEL_CHOICES,
  OPTIMIZE_MODEL_CHOICES,
  RATIO_CHOICES,
  SIZE_CHOICES,
  SIZE_TABLE,
  VERSION,
  isSourceId,
  nextSourceId,
  normalizeBaseUrl,
  normalizeConfig,
  normalizeConfigPatch,
  normalizeModel,
  normalizeOptimizeModel,
  normalizeRatio,
  normalizeSize,
  normalizeSource,
  normalizeSources,
  normalizeTimeout,
  readPrompt,
  readText,
  resolveDefaultSourceId,
  toAppError,
} from './params.js'
import { SecretStore } from './secret.js'
import { migrateLegacySources } from './sources.js'

const MAX_JOBS = 8
const JOB_TTL_MS = 10 * 60 * 1000
const MODELS_TTL_MS = 10 * 60 * 1000
const MAX_SERVE_BYTES = 64 * 1024 * 1024
const MAX_BATCH_DELETE = 100

const MEDIA_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])

export class ImageService {
  constructor({ ctx, config, logger }) {
    this.ctx = ctx
    this.logger = logger
    this.settings = normalizeConfig(config)
    this.secret = new SecretStore({ ctx, settings: this.settings, logger })
    this.jobs = new Map()
    this.lastJobId = undefined
    this.modelsCache = new Map()
    this.chatModels = []
  }

  // ---------------------------------------------------------------- 状态总览

  defaultSourceId() {
    return this.settings.defaultSourceId ?? this.settings.sources[0]?.id
  }

  /** 面板 / 设置页的首屏数据。jobId 为空时给最近一个任务。 */
  async state(jobId) {
    // 迁移必须发生在请求里：插件激活过程处于 Loader 的 HMR 事务中，
    // 那里调用 configEditor.edit 会抛 "HMR transactions cannot be nested"。
    this.scheduleMigration()
    const defaultSourceId = this.defaultSourceId()
    const sources = []
    for (const source of this.settings.sources) {
      const allowEnv = source.id === defaultSourceId
      const legacyPlaintext = allowEnv && Boolean(this.settings.legacyApiKey)
      sources.push({
        id: source.id,
        label: source.label,
        baseUrl: source.baseUrl,
        isDefault: source.id === defaultSourceId,
        key: await this.secret.status(source.id, { allowEnv, legacyPlaintext }),
      })
    }
    const defaultRow = sources.find((row) => row.isDefault) ?? sources[0]
    const job = this.info(jobId) ?? this.info(this.lastJobId)
    const defaultInfo = defaultOutputInfo()
    return {
      ok: true,
      version: VERSION,
      config: {
        defaultSourceId: defaultRow?.id ?? '',
        defaultModel: this.settings.defaultModel,
        defaultSize: this.settings.defaultSize,
        defaultRatio: this.settings.defaultRatio,
        optimizeModel: this.settings.optimizeModel,
        outputDir: this.settings.outputDir || defaultInfo.dir,
        timeoutMs: this.settings.timeoutMs,
        apiKeyEnv: this.settings.apiKeyEnv,
      },
      outputDirSource: this.settings.outputDir ? 'config' : 'default',
      defaultOutputDir: defaultInfo.dir,
      defaultOutputFreeBytes: defaultInfo.freeBytes,
      sources,
      key: defaultRow?.key ?? {
        state: 'none',
        hasStored: false,
        writable: false,
        envName: this.settings.apiKeyEnv,
      },
      caps: {
        models: MODEL_CHOICES.map((id) => ({ id })),
        optimizeModels: uniqueModels([...OPTIMIZE_MODEL_CHOICES, ...this.chatModels]).map((id) => ({ id })),
        sizes: SIZE_CHOICES,
        ratios: RATIO_CHOICES,
        sizeTable: SIZE_TABLE,
        maxImages: MAX_IMAGES,
        maxSources: MAX_SOURCES,
        maxPromptChars: MAX_PROMPT_CHARS,
        timeout: { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS },
      },
      diagnostics: {
        credentials: Boolean(this.secret.credentials()),
        legacyPlaintext: Boolean(this.settings.legacyApiKey),
        legacySources: Boolean(this.settings.baseUrl) && !this.settings.sources.length,
        dpapi: process.platform === 'win32',
        migration: this.migration,
      },
      ready: Boolean(defaultRow) && defaultRow.key.state !== 'none',
      job,
      history: await this.history(60),
    }
  }

  /** 写入设置页提交的配置（白名单校验后走 configEditor.edit）。 */
  async saveConfig(input) {
    const patch = normalizeConfigPatch(input)
    if (!Object.keys(patch).length) throw new AppError('bad-request', '没有需要保存的配置项。', 400)
    if (patch.defaultSourceId && !this.settings.sources.some((source) => source.id === patch.defaultSourceId)) {
      throw new AppError('no-source', `找不到 API 来源：${patch.defaultSourceId}`, 404)
    }
    const editor = this.ctx.get('configEditor')
    if (!editor || typeof editor.edit !== 'function') {
      throw new AppError('no-config-editor', '配置服务不可用，无法保存设置。', 503)
    }
    const entry = this.entryOf(editor)
    if (!entry) throw new AppError('no-entry', '找不到本插件的配置行，请重装插件。', 500)
    await editor.edit(entry, (current) => {
      const next = { ...(current ?? {}) }
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '') delete next[key]
        else next[key] = value
      }
      return next
    })
    this.secret.invalidate()
    invalidateDefaultOutputDir()
    return { ok: true, patch }
  }

  // ---------------------------------------------------------------- API 来源

  /** 新建 / 更新 / 删除一个来源。来源的密钥必须单独走 SaveKey。 */
  async saveSource(input) {
    const body = input && typeof input === 'object' ? input : {}
    const action = readText(body.action) || 'save'
    if (action !== 'save' && action !== 'delete') {
      throw new AppError('bad-request', `不支持的来源操作：${action}`, 400)
    }
    const editor = this.ctx.get('configEditor')
    if (!editor || typeof editor.edit !== 'function') {
      throw new AppError('no-config-editor', '配置服务不可用，无法保存设置。', 503)
    }
    const entry = this.entryOf(editor)
    if (!entry) throw new AppError('no-entry', '找不到本插件的配置行，请重装插件。', 500)

    if (action === 'delete') {
      const id = readText(body.id)
      if (!this.settings.sources.some((source) => source.id === id)) {
        throw new AppError('no-source', `找不到 API 来源：${id || '(空)'}`, 404)
      }
      const remaining = this.settings.sources.filter((source) => source.id !== id)
      await editor.edit(entry, (current) => {
        const next = { ...(current ?? {}) }
        next.sources = remaining
        if (!remaining.length) delete next.defaultSourceId
        else if (next.defaultSourceId === id) next.defaultSourceId = remaining[0].id
        return next
      })
      try {
        await this.secret.clear(id)
      } catch (error) {
        this.logger?.warn?.(`[agnes-image-gen] 删除来源 ${id} 的密钥记录失败：${messageOf(error)}`)
      }
      return { ok: true, action, id, sources: remaining }
    }

    const wantedId = readText(body.id)
    const makeDefault = body.makeDefault === true
    let source
    let nextSources
    if (wantedId) {
      if (!isSourceId(wantedId)) throw new AppError('bad-source', `来源 id 不合法：${wantedId}`, 400)
      const index = this.settings.sources.findIndex((item) => item.id === wantedId)
      if (index < 0) throw new AppError('no-source', `找不到 API 来源：${wantedId}`, 404)
      source = normalizeSource(
        { id: wantedId, label: body.label ?? this.settings.sources[index].label, baseUrl: body.baseUrl ?? this.settings.sources[index].baseUrl },
        index,
      )
      nextSources = this.settings.sources.map((item) => (item.id === wantedId ? source : item))
    } else {
      if (this.settings.sources.length >= MAX_SOURCES) {
        throw new AppError('too-many-sources', `最多添加 ${MAX_SOURCES} 个 API 来源。`, 400)
      }
      source = normalizeSource(
        { id: nextSourceId(), label: body.label, baseUrl: body.baseUrl },
        this.settings.sources.length,
      )
      nextSources = [...this.settings.sources, source]
    }

    await editor.edit(entry, (current) => {
      const next = { ...(current ?? {}) }
      next.sources = nextSources
      if (makeDefault || !next.defaultSourceId) next.defaultSourceId = source.id
      return next
    })
    return { ok: true, action, source, sources: nextSources, defaultSourceId: makeDefault ? source.id : undefined }
  }


  // ---------------------------------------------------------------- 密钥

  async saveKey(sourceId, value) {
    const source = this.resolveSource(sourceId)
    const status = await this.secret.save(source.id, value)
    return { ok: true, sourceId: source.id, key: { ...status, envName: this.settings.apiKeyEnv } }
  }

  async clearKey(sourceId) {
    const source = this.resolveSource(sourceId)
    const status = await this.secret.clear(source.id)
    return { ok: true, sourceId: source.id, key: { ...status, envName: this.settings.apiKeyEnv } }
  }

  /**
   * 启动时的一次性迁移：
   * 1) 旧全局 baseUrl → 第一个来源（并把旧密文记录搬到该来源名下）；
   * 2) 旧配置明文 apiKey → 默认来源，成功后从配置里删掉 apiKey。
   */
  /** 请求触发的幂等迁移：只在配置里还留着旧字段时做一次。 */
  scheduleMigration() {
    if (this.migrationStarted) return
    if (!this.settings.baseUrl && !this.settings.legacyApiKey) return
    this.migrationStarted = true
    void this.migrateLegacy().catch((error) => {
      this.migrationStarted = false
      this.logger?.warn?.(`[agnes-image-gen] 迁移旧版配置失败：${messageOf(error)}`)
    })
  }

  async migrateLegacy() {
    try {
      const report = await this.migrateLegacyOnce()
      this.migration = { at: Date.now(), ok: true, ...report }
      return report
    } catch (error) {
      this.migration = { at: Date.now(), ok: false, error: messageOf(error) }
      throw error
    }
  }

  async migrateLegacyOnce() {
    const report = { sources: false, record: false, plaintext: false, cleaned: false }
    const editor = this.ctx.get('configEditor')
    // 已经写过一次配置后，快照里的旧字段可能与磁盘不同：迁移前先读一次当前生效值，
    // 这样重试时不会重复建来源、也不会删错键。
    const live = await this.liveConfig(editor)
    const baseUrl = live ? live.baseUrl : this.settings.baseUrl
    const sources = live ? live.sources : this.settings.sources
    const legacyApiKey = live ? live.legacyApiKey : this.settings.legacyApiKey
    const settings = { ...this.settings, baseUrl, sources, legacyApiKey }
    report.basis = {
      editor: Boolean(editor),
      entry: Boolean(editor ? this.entryOf(editor) : undefined),
      live: Boolean(live),
      baseUrl: Boolean(baseUrl),
      sources: sources.length,
    }

    if (settings.baseUrl && !settings.sources.length) {
      try {
        const result = await migrateLegacySources({
          settings,
          secret: this.secret,
          editor,
          entryOf: (instance) => this.entryOf(instance),
          logger: this.logger,
        })
        report.sources = Boolean(result.migrated)
        report.record = Boolean(result.copied)
        return report
      } catch (error) {
        this.logger?.warn?.(`[agnes-image-gen] 旧 Base URL 迁移失败：${messageOf(error)}`)
      }
    }

    if (settings.baseUrl && settings.sources.length) {
      // 来源已经存在：旧 baseUrl 只是历史残留，直接清掉，避免诊断一直报警。
      try {
        const entry = editor ? this.entryOf(editor) : undefined
        if (editor && entry) {
          await editor.edit(entry, (current) => {
            const next = { ...(current ?? {}) }
            delete next.baseUrl
            return next
          })
          report.cleaned = true
        }
      } catch (error) {
        this.logger?.warn?.(`[agnes-image-gen] 清理旧 Base URL 失败：${messageOf(error)}`)
        report.cleanError = messageOf(error)
      }
    }

    if (!legacyApiKey) return report
    const sourceId = resolveDefaultSourceId(this.settings.defaultSourceId, settings.sources)
    if (!sourceId) return report
    try {
      report.plaintext = await this.secret.migrateLegacyPlaintext(sourceId)
    } catch (error) {
      this.logger?.warn?.(`[agnes-image-gen] 旧密钥迁移失败：${messageOf(error)}`)
      return report
    }
    if (!report.plaintext) return report
    try {
      const entry = editor ? this.entryOf(editor) : undefined
      if (editor && entry) {
        await editor.edit(entry, (current) => {
          const next = { ...(current ?? {}) }
          delete next.apiKey
          return next
        })
      }
    } catch (error) {
      this.logger?.warn?.(`[agnes-image-gen] 清理旧明文密钥失败：${messageOf(error)}`)
    }
    return report
  }

  /** 从 configEditor 读当前生效的配置（override 覆盖 inherited）；读不到返回 undefined。 */
  async liveConfig(editor) {
    if (!editor || typeof editor.configuration !== 'function') return undefined
    const entry = this.entryOf(editor)
    if (!entry) return undefined
    try {
      const rows = editor.configuration() ?? []
      const row = rows.find((item) => {
        const candidate = item?.entry
        if (candidate === entry) return true
        return candidate?.id !== undefined && (candidate.id === entry?.id || candidate.id === entry?.patchId)
      })
      if (!row) return undefined
      const merged = { ...(row.inherited ?? {}), ...(row.override ?? {}) }
      return {
        baseUrl: normalizeBaseUrl(merged.baseUrl),
        sources: normalizeSources(merged.sources),
        legacyApiKey: readText(merged.apiKey),
      }
    } catch {
      return undefined
    }
  }

  // ---------------------------------------------------------------- 模型

  /** 远程模型列表（按来源缓存）；失败抛可读错误，面板自行回退内置模型。 */
  async models(force, sourceId) {
    const source = this.resolveSource(sourceId)
    const now = Date.now()
    const cachedEntry = this.modelsCache.get(source.id)
    if (!force && cachedEntry && now - cachedEntry.at < MODELS_TTL_MS) {
      return { ok: true, sourceId: source.id, sourceLabel: source.label, ...cachedEntry.value, cached: true }
    }
    const apiKey = await this.secret.getKey(source.id, { allowEnv: source.id === this.defaultSourceId() })
    const timeoutMs = Math.min(this.settings.timeoutMs, 60000)
    try {
      const result = await listModels({ baseUrl: source.baseUrl, apiKey, timeoutMs })
      const ids = result.models.map((item) => item.id)
      const imageModels = ids.filter((id) => /image/i.test(id))
      const chatModels = ids.filter((id) => !/image/i.test(id))
      this.chatModels = uniqueModels([...this.chatModels, ...chatModels])
      const value = {
        models: (imageModels.length ? imageModels : ids).map((id) => ({ id })),
        all: ids,
        endpoint: result.endpoint,
        fetchedAt: now,
      }
      this.modelsCache.set(source.id, { at: now, value })
      return { ok: true, sourceId: source.id, sourceLabel: source.label, ...value, cached: false }
    } catch (error) {
      throw toAppError(error, 'models-failed')
    }
  }

  // ---------------------------------------------------------------- 提示词优化

  /** 用同一来源的 chat 模型改写提示词；不落库、不存历史，交给面板自己决定用不用。 */
  async optimize(input) {
    const body = input && typeof input === 'object' ? input : {}
    const prompt = readText(body.prompt)
    if (!prompt) throw new AppError('bad-prompt', '提示词为空，无法优化。', 400)
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new AppError('bad-prompt', `提示词过长（上限 ${MAX_PROMPT_CHARS} 字），请先精简。`, 400)
    }
    const source = this.resolveSource(body.sourceId)
    const model = normalizeOptimizeModel(body.model ?? this.settings.optimizeModel)
    const apiKey = await this.secret.getKey(source.id, { allowEnv: source.id === this.defaultSourceId() })
    const started = Date.now()
    const result = await optimizePrompt({
      baseUrl: source.baseUrl,
      apiKey,
      model,
      prompt,
      timeoutMs: Math.min(this.settings.timeoutMs, 90000),
    })
    return {
      ok: true,
      prompt: result.prompt,
      original: prompt,
      model: result.model,
      sourceId: source.id,
      source_label: source.label,
      elapsed_ms: Date.now() - started,
    }
  }


  // ---------------------------------------------------------------- 生成任务

  /**
   * 启动一个生成任务（不等待结果）。面板用轮询 /state 拿结果，工具用 run 等结果。
   * 来源在启动时快照：任务跑完前改设置也不会换掉 URL。
   * @param {{prompt?: string, model?: string, size?: string, ratio?: string, images?: string[], save?: boolean, saveDir?: string, fileName?: string, sourceId?: string}} input
   * @param {{signal?: AbortSignal}} [options]
   */
  start(input, options = {}) {
    const prompt = readPrompt(input)
    const source = this.resolveSource(input?.sourceId)
    const model = normalizeModel(input?.model ?? this.settings.defaultModel)
    const size = normalizeSize(input?.size ?? this.settings.defaultSize)
    const ratio = normalizeRatio(input?.ratio ?? this.settings.defaultRatio)
    const images = normalizeImages(input?.images)
    if (images.length && images.length > MAX_IMAGES) {
      throw new AppError('too-many-images', `图生图最多 ${MAX_IMAGES} 张输入图。`, 400)
    }

    this.prune()
    const job = {
      id: randomUUID(),
      state: 'running',
      startedAt: Date.now(),
      finishedAt: undefined,
      cancelled: false,
      controller: new AbortController(),
      params: {
        prompt,
        model,
        size,
        ratio,
        images: images.length ? images : undefined,
        save: input?.save !== false,
        saveDir: typeof input?.saveDir === 'string' ? input.saveDir : undefined,
        fileName: typeof input?.fileName === 'string' ? input.fileName : undefined,
        sourceId: source.id,
        sourceLabel: source.label,
        sourceBaseUrl: source.baseUrl,
      },
      result: undefined,
      error: undefined,
      bytes: undefined,
    }
    if (options.signal) {
      if (options.signal.aborted) job.cancelled = true
      else options.signal.addEventListener('abort', () => this.cancel(job.id), { once: true })
    }

    this.jobs.set(job.id, job)
    this.lastJobId = job.id
    job.promise = this.execute(job)
    job.promise.catch(() => {})
    return { ok: true, jobId: job.id }
  }

  /** 启动并等待结果（Agent 工具用）。失败抛 AppError。 */
  async run(input, options = {}) {
    const { jobId } = this.start(input, options)
    const job = this.jobs.get(jobId)
    if (!job) throw new AppError('no-job', '任务创建失败。', 500)
    await job.promise
    if (job.state === 'done' && job.result) return job.result
    const error = job.error ?? { code: 'generate-failed', message: '生成失败。' }
    throw new AppError(error.code, error.message, statusOf(error.code))
  }

  /** 取消任务：给了 id 取消指定任务，否则取消最近一个。 */
  cancel(jobId) {
    const job = jobId ? this.jobs.get(jobId) : this.jobs.get(this.lastJobId)
    if (!job) throw new AppError('no-job', '没有可取消的任务。', 404)
    if (job.state !== 'running') return { ok: true, cancelled: false, state: job.state }
    job.cancelled = true
    job.controller.abort()
    return { ok: true, cancelled: true, state: 'cancelling' }
  }

  info(jobId) {
    const job = jobId ? this.jobs.get(jobId) : this.lastJobId ? this.jobs.get(this.lastJobId) : undefined
    if (!job) return undefined
    return {
      id: job.id,
      state: job.state === 'running' && job.cancelled ? 'cancelling' : job.state,
      startedAt: job.startedAt,
      elapsed_ms: (job.finishedAt ?? Date.now()) - job.startedAt,
      params: {
        model: job.params.model,
        size: job.params.size,
        ratio: job.params.ratio,
        save: job.params.save,
        sourceId: job.params.sourceId,
        sourceLabel: job.params.sourceLabel,
      },
      result: job.result,
      error: job.error,
    }
  }

  /** 任务缓存里的原图（面板预览用；save=false 时也能看到图）。 */
  jobBytes(jobId) {
    const job = jobId ? this.jobs.get(jobId) : this.lastJobId ? this.jobs.get(this.lastJobId) : undefined
    if (!job || !job.bytes) return undefined
    return { bytes: job.bytes, mediaType: job.result?.media_type || 'image/png' }
  }

  // ---------------------------------------------------------------- 历史与文件

  async history(limit = 24) {
    const dir = this.settings.outputDir || defaultOutputDir()
    const files = await listImageFiles(dir, limit)
    return { dir, files }
  }

  /** 读取输出目录里的图片给面板显示。/image?path= 的守卫也在这里。 */
  async readImageFile(rawPath) {
    const target = await this.guardInsideOutputDir(rawPath)
    const info = await stat(target)
    if (!info.isFile()) throw new AppError('bad-path', '不是文件。', 400)
    if (info.size > MAX_SERVE_BYTES) throw new AppError('too-large', '图片太大，无法在面板里预览。', 413)
    const bytes = await readFile(target)
    const ext = path.extname(target).toLowerCase()
    return {
      bytes,
      mediaType: MEDIA_BY_EXT[ext] || sniffMediaType(bytes),
      name: path.basename(target),
      bytes_count: info.size,
    }
  }

  /** 删除输出目录里的一张图片（不可恢复；面板负责二次确认）。 */
  async deleteImage(rawPath) {
    return this.removeOne(rawPath)
  }

  /** 批量删除：逐条校验与删除，单条失败不影响其余项。 */
  async deleteImages(rawPaths) {
    if (!Array.isArray(rawPaths)) throw new AppError('bad-request', 'paths 必须是数组。', 400)
    const unique = [...new Set(rawPaths.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))]
    if (!unique.length) throw new AppError('bad-request', '没有要删除的图片。', 400)
    if (unique.length > MAX_BATCH_DELETE) {
      throw new AppError('too-many', `一次最多删除 ${MAX_BATCH_DELETE} 张图片。`, 400)
    }
    const deleted = []
    const failed = []
    for (const rawPath of unique) {
      try {
        deleted.push(await this.removeOne(rawPath))
      } catch (error) {
        failed.push({ path: rawPath, message: messageOf(error) })
      }
    }
    return { ok: failed.length === 0, deleted, failed }
  }

  async removeOne(rawPath) {
    const target = await this.guardInsideOutputDir(rawPath)
    const ext = path.extname(target).toLowerCase()
    if (!IMAGE_EXTS.has(ext)) {
      throw new AppError('bad-path', '只能删除 png/jpg/jpeg/webp/gif 图片。', 400)
    }
    try {
      await unlink(target)
    } catch (error) {
      throw new AppError('delete-failed', `删除图片失败：${messageOf(error)}`, 500)
    }
    const metaRemoved = await deleteImageMeta(target)
    return { ok: true, path: target, name: path.basename(target), meta_removed: metaRemoved }
  }

  /** 校验任意路径确实在输出目录内（realpath 后比较，挡住 ../ 与符号链接）。 */
  async guardInsideOutputDir(rawPath) {
    const input = String(rawPath ?? '').trim()
    if (!input) throw new AppError('bad-path', '缺少 path 参数。', 400)
    if (!path.isAbsolute(input)) throw new AppError('bad-path', '只接受绝对路径。', 400)
    const dir = this.settings.outputDir || defaultOutputDir()
    let base
    let target
    try {
      base = await realpath(dir)
    } catch {
      throw new AppError('no-output-dir', `输出目录不存在：${dir}`, 404)
    }
    try {
      target = await realpath(path.resolve(input))
    } catch {
      throw new AppError('not-found', '文件不存在。', 404)
    }
    if (!isInside(base, target)) {
      throw new AppError('forbidden', '只能访问输出目录里的图片。', 403)
    }
    return target
  }

  /** 在文件管理器里定位文件；输出目录不存在时打开目录本身。 */
  async revealPath(rawPath) {
    const input = String(rawPath ?? '').trim()
    if (input) {
      const target = await this.guardInsideOutputDir(input)
      spawnReveal(target, true)
      return { ok: true, target }
    }
    const dir = this.settings.outputDir || defaultOutputDir()
    spawnReveal(dir, false)
    return { ok: true, target: dir }
  }

  // ---------------------------------------------------------------- 内部

  /** 解析来源：空值用默认来源；也接受来源 label 作为人类友好的别名。 */
  resolveSource(sourceId) {
    const sources = this.settings.sources
    if (!sources.length) {
      throw new AppError(
        'no-source',
        '尚未添加 API 来源：请到 设置 → 生图 → API 来源 添加 Base URL 与 Key。',
        409,
      )
    }
    const wanted = readText(sourceId)
    if (!wanted) {
      const id = this.defaultSourceId()
      return sources.find((source) => source.id === id) ?? sources[0]
    }
    const hit =
      sources.find((source) => source.id === wanted) ?? sources.find((source) => source.label === wanted)
    if (!hit) throw new AppError('no-source', `找不到 API 来源：${wanted}`, 404)
    return hit
  }

  entryOf(editor) {
    const own = this.ctx.fiber?.entry
    let entries = []
    try {
      entries = editor.entries() ?? []
    } catch {
      entries = []
    }
    if (own && entries.includes(own)) return own
    const hit = entries.find((entry) => {
      const id = String(entry?.id ?? '')
      const patchId = String(entry?.patchId ?? '')
      return id === 'agnes-image-gen' || patchId === 'agnes-image-gen' || id.endsWith(':agnes-image-gen')
    })
    return hit ?? own
  }

  async execute(job) {
    const started = Date.now()
    const params = job.params
    try {
      const baseUrl = params.sourceBaseUrl
      if (!baseUrl) throw new AppError('no-base-url', '该 API 来源没有配置 Base URL。', 409)
      const allowEnv = params.sourceId === this.defaultSourceId()
      const apiKey = await this.secret.getKey(params.sourceId, {
        allowEnv,
        legacyPlaintext: allowEnv && Boolean(this.settings.legacyApiKey),
      })
      const timeoutMs = normalizeTimeout(this.settings.timeoutMs)
      const images = await materializeImages(params.images)
      const body = buildRequestBody({
        model: params.model,
        prompt: params.prompt,
        size: params.size,
        ratio: params.ratio,
        images,
      })
      const generated = await generateImage({
        baseUrl,
        apiKey,
        body,
        timeoutMs,
        signal: job.controller.signal,
      })

      const dimensions = readImageSize(generated.bytes)
      const warnings = []
      let savedPath

      if (params.save) {
        try {
          const dir = resolveOutputDir(this.settings.outputDir, params.saveDir)
          savedPath = await saveImageFile({
            dir,
            baseName: params.fileName,
            mediaType: generated.mediaType,
            bytes: generated.bytes,
          })
        } catch (error) {
          warnings.push(`落盘失败：${messageOf(error)}`)
        }
      }

      if (savedPath) {
        try {
          await writeImageMeta(savedPath, {
            prompt: params.prompt,
            revised_prompt: generated.revisedPrompt,
            model: params.model,
            size: params.size,
            ratio: params.ratio,
            source_id: params.sourceId,
            source_label: params.sourceLabel,
            media_type: generated.mediaType,
            bytes: generated.bytes.length,
            width: dimensions?.width,
            height: dimensions?.height,
            elapsed_ms: Date.now() - started,
            created_at: new Date().toISOString(),
            mode: params.images && params.images.length ? 'img2img' : 'txt2img',
            refs: params.images ? params.images.length : 0,
          })
        } catch (error) {
          warnings.push(`元数据写入失败：${messageOf(error)}`)
        }
      }

      let attachment
      try {
        const attachments = this.ctx.get('attachments')
        if (attachments && typeof attachments.saveImage === 'function') {
          attachment = await attachments.saveImage({
            data: generated.bytes,
            mediaType: generated.mediaType,
            name: savedPath ? path.basename(savedPath) : undefined,
          })
        }
      } catch (error) {
        warnings.push(`图片未载入对话：${messageOf(error)}`)
      }

      job.state = 'done'
      job.bytes = generated.bytes
      job.result = {
        ok: true,
        jobId: job.id,
        model: params.model,
        size: params.size,
        ratio: params.ratio,
        source: params.sourceId,
        source_label: params.sourceLabel,
        media_type: generated.mediaType,
        bytes: generated.bytes.length,
        width: dimensions?.width,
        height: dimensions?.height,
        path: savedPath,
        name: savedPath ? path.basename(savedPath) : undefined,
        saved: Boolean(savedPath),
        attachment,
        revised_prompt: generated.revisedPrompt,
        elapsed_ms: Date.now() - started,
        warnings,
      }
    } catch (error) {
      if (job.cancelled) {
        job.state = 'cancelled'
        job.error = { code: 'cancelled', message: '已取消。' }
      } else {
        const appError = toAppError(error, 'generate-failed')
        job.state = 'error'
        job.error = { code: appError.code, message: appError.message }
        this.logger?.warn?.(`[agnes-image-gen] 生成失败：${appError.message}`)
      }
    } finally {
      job.finishedAt = Date.now()
    }
  }

  /** 丢掉老任务，避免长期运行攒内存。 */
  prune() {
    const now = Date.now()
    for (const [id, job] of this.jobs) {
      const finished = job.finishedAt ?? job.startedAt
      if (job.state !== 'running' && now - finished > JOB_TTL_MS) this.jobs.delete(id)
    }
    const finishedJobs = [...this.jobs.values()]
      .filter((job) => job.state !== 'running')
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0))
    while (this.jobs.size > MAX_JOBS && finishedJobs.length) {
      const victim = finishedJobs.shift()
      this.jobs.delete(victim.id)
    }
  }
}

function normalizeImages(input) {
  if (input === undefined || input === null) return []
  if (!Array.isArray(input)) throw new AppError('bad-images', 'images 必须是数组。', 400)
  const out = []
  for (const item of input) {
    if (typeof item !== 'string' || !item.trim()) continue
    out.push(item.trim())
  }
  return out
}

/**
 * 把 images 里的本机绝对路径读成 data URL：Agnes 只接受 http(s) URL 或图片 base64。
 * https / data:image 原样透传；其它形式直接报错，避免把半截字符串发给服务端。
 */
async function materializeImages(list) {
  const out = []
  for (const item of list ?? []) {
    const text = String(item ?? '').trim()
    if (!text) continue
    if (/^data:image\//i.test(text) || /^https?:\/\//i.test(text)) {
      out.push(text)
      continue
    }
    if (!path.isAbsolute(text)) {
      throw new AppError('bad-image', `图片地址必须是 https URL、data URL 或本机绝对路径：${text.slice(0, 80)}`, 400)
    }
    try {
      const bytes = await readLocalImage(text)
      const mediaType = sniffMediaType(bytes) || 'image/png'
      out.push(`data:${mediaType};base64,${bytes.toString('base64')}`)
    } catch (error) {
      throw new AppError('bad-image', `读取输入图失败：${messageOf(error)}`, 400)
    }
  }
  return out
}

function statusOf(code) {
  if (code === 'no-base-url' || code === 'no-key' || code === 'no-source') return 409
  if (code === 'bad-key') return 401
  if (code === 'timeout' || code === 'optimize-timeout') return 504
  if (code === 'cancelled') return 408
  return 502
}

function uniqueModels(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const id = typeof item === 'string' ? item.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function spawnReveal(target, select) {
  // 用 explorer 打开：/select, 让文件处于选中状态；失败时静默，避免影响主流程。
  try {
    const args = select ? ['/select,', target] : [target]
    const child = spawn('explorer.exe', args, { detached: true, stdio: 'ignore', windowsHide: false })
    child.on('error', () => {})
    child.unref?.()
  } catch {
    // 打开文件管理器只是便利功能。
  }
}
