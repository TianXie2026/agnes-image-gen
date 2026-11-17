// 纯函数与常量：参数校验、尺寸表、配置归一化、统一错误类型。
// 不依赖 DSH 服务，可被 Node 单测直接 import（tools/check.mjs）。
// 也不 import 任何 @deepseek-ai/* 包：profile 里没有 hoisted 的 DSH 依赖。

import { randomBytes } from 'node:crypto'

export const VERSION = '0.8.0'
export const TOOL_NAME = 'agnes_image_generate'
export const ROUTE_PREFIX = '/agnes-image-gen'

export const DEFAULT_MODEL = 'agnes-image-2.5-flash'
export const MODEL_CHOICES = [
  'agnes-image-2.5-flash',
  'agnes-image-2.1-flash',
  'agnes-image-2.0-flash',
]
export const DEFAULT_SIZE = '2K'
export const DEFAULT_RATIO = '1:1'
export const DEFAULT_TIMEOUT_MS = 300000
export const MIN_TIMEOUT_MS = 30000
export const MAX_TIMEOUT_MS = 600000
export const MAX_IMAGES = 4
export const MAX_BODY_BYTES = 128 * 1024
/** 参考图上传走独立上限（参考图可能是几 MB 的原图）。 */
export const MAX_REFERENCE_BYTES = 24 * 1024 * 1024
export const MAX_UPLOAD_NAME = 80
/** 参考图落在输出目录下的隐藏目录，不进图库列表。 */
export const REF_DIR = '.refs'
export const REF_TTL_DAYS = 7
export const REF_MEDIA = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}
export const MAX_PROMPT_CHARS = 4000
export const MAX_SOURCES = 8
export const MAX_SOURCE_LABEL = 40
export const DEFAULT_OPTIMIZE_MODEL = 'agnes-3.0-flash'
export const OPTIMIZE_MODEL_CHOICES = ['agnes-3.0-flash', 'agnes-2.5-flash', 'agnes-2.5-pro']
/** 来源 id 固定形状，且符合 credentialKey 的 lowercase-hyphenated 段约束。 */
export const SOURCE_ID_PATTERN = /^src-[0-9a-f]{8}$/

export const SIZE_CHOICES = ['1K', '2K', '3K', '4K']
export const RATIO_CHOICES = ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9']
export const SIZE_HINT = '1K/2K/3K/4K，或精确 WxH（如 1024x768，宽高 64–8192）'

/**
 * 官方文档「输出尺寸参考」全表（档位 × 比例 → 像素）。
 * 只用于面板上的像素提示，不参与请求：请求仍发送档位 + ratio。
 */
export const SIZE_TABLE = {
  '1K': {
    '1:1': [1024, 1024],
    '3:4': [864, 1152],
    '4:3': [1152, 864],
    '16:9': [1312, 736],
    '9:16': [736, 1312],
    '2:3': [832, 1248],
    '3:2': [1248, 832],
    '21:9': [1568, 672],
  },
  '2K': {
    '1:1': [2048, 2048],
    '3:4': [1728, 2304],
    '4:3': [2304, 1728],
    '16:9': [2624, 1472],
    '9:16': [1472, 2624],
    '2:3': [1664, 2496],
    '3:2': [2496, 1664],
    '21:9': [3136, 1344],
  },
  '3K': {
    '1:1': [3072, 3072],
    '3:4': [2592, 3456],
    '4:3': [3456, 2592],
    '16:9': [3936, 2208],
    '9:16': [2208, 3936],
    '2:3': [2496, 3744],
    '3:2': [3744, 2496],
    '21:9': [4704, 2016],
  },
  '4K': {
    '1:1': [4096, 4096],
    '3:4': [3456, 4608],
    '4:3': [4608, 3456],
    '16:9': [5248, 2944],
    '9:16': [2944, 5248],
    '2:3': [3328, 4992],
    '3:2': [4992, 3328],
    '21:9': [6272, 2688],
  },
}

/** 统一的可映射错误：路由按 status 回 HTTP，工具直接把 message 抛给 Agent。 */
export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export function readText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function readPrompt(input) {
  const prompt = readText(input?.prompt)
  if (!prompt) throw new AppError('bad-request', 'prompt 不能为空：请描述要生成的画面。', 400)
  return prompt
}

/**
 * 模型是否支持图生图：'yes' | 'no' | 'unknown'。
 * 上游 /models 不带能力字段（只有 id），所以这里按模型家族推断；
 * 客户端拿到上游显式标志时优先用上游的。
 */
const IMG2IMG_KNOWN_YES = [/^agnes-image-2\.[0-9]+-flash$/i, /^agnes-image-2\.[0-9]+$/i]
const IMG2IMG_KNOWN_NO = [/^agnes-[0-9]+\.[0-9]+-(flash|pro)$/i, /^agnes-image-[0-9]+\.?[0-9]*-?nano$/i]

export function img2imgSupport(model) {
  const id = readText(model)
  if (!id) return 'unknown'
  if (IMG2IMG_KNOWN_YES.some((pattern) => pattern.test(id))) return 'yes'
  if (IMG2IMG_KNOWN_NO.some((pattern) => pattern.test(id))) return 'no'
  return 'unknown'
}

/** 上传参考图时用的展示名：去扩展名、清洗非法字符、截断。 */
export function sanitizeUploadName(name) {
  const raw = readText(name)
  const base = raw.replace(/\.[^.]*$/, '')
  const cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_UPLOAD_NAME)
  return cleaned || 'reference'
}

/** 档位 1K–4K，或精确 WxH（宽高 64–8192）；容忍 * 与 ×。 */
export function normalizeSize(input) {
  const raw = readText(input)
  if (!raw) return DEFAULT_SIZE
  const normalized = raw.toUpperCase().replace(/\*/g, 'x').replace(/×/g, 'x').replace(/\s+/g, '')
  if (/^[1-4]K$/.test(normalized)) return normalized
  const match = /^(\d{2,5})[xX](\d{2,5})$/.exec(normalized)
  if (match) {
    const width = Number(match[1])
    const height = Number(match[2])
    if (width >= 64 && width <= 8192 && height >= 64 && height <= 8192) {
      return `${width}x${height}`
    }
  }
  throw new AppError('bad-size', `size 不合法：${raw}。可用 ${SIZE_HINT}。`, 400)
}

export function normalizeRatio(input) {
  const raw = readText(input)
  if (!raw) return DEFAULT_RATIO
  if (!RATIO_CHOICES.includes(raw)) {
    throw new AppError('bad-ratio', `ratio 不合法：${raw}。可用 ${RATIO_CHOICES.join(' / ')}。`, 400)
  }
  return raw
}

/** 只允许 http/https、无 userinfo、去掉尾部斜杠；空值表示「未配置」。 */
export function normalizeBaseUrl(input) {
  const raw = readText(input)
  if (!raw) return undefined
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new AppError('bad-base-url', `API Base URL 不是合法 URL：${raw}`, 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('bad-base-url', `API Base URL 只支持 http/https：${raw}`, 400)
  }
  if (parsed.username || parsed.password) {
    throw new AppError('bad-base-url', 'API Base URL 里不要带用户名/密码。', 400)
  }
  return `${parsed.origin}${parsed.pathname}${parsed.search}`.replace(/\/+$/, '')
}

export function normalizeModel(input) {
  const raw = readText(input)
  if (!raw) return DEFAULT_MODEL
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(raw)) {
    throw new AppError('bad-model', `model 不合法：${raw}`, 400)
  }
  return raw
}

/** 配置里的默认档位：只接受 1K–4K（精确 WxH 留给单次请求参数）。 */
export function normalizeDefaultSize(input) {
  const raw = readText(input).toUpperCase()
  if (!raw) return DEFAULT_SIZE
  if (!SIZE_CHOICES.includes(raw)) {
    throw new AppError('bad-size', `默认尺寸只接受 ${SIZE_CHOICES.join('/')}。`, 400)
  }
  return raw
}

export function normalizeTimeout(input) {
  if (input === undefined || input === null || input === '') return DEFAULT_TIMEOUT_MS
  const value = Number(input)
  if (!Number.isFinite(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
    throw new AppError(
      'bad-timeout',
      `请求超时必须在 ${MIN_TIMEOUT_MS / 1000}–${MAX_TIMEOUT_MS / 1000} 秒之间。`,
      400,
    )
  }
  return Math.round(value)
}

export function normalizeEnvName(input) {
  const raw = readText(input).toUpperCase()
  if (!raw) return 'AGNES_API_KEY'
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(raw)) {
    throw new AppError('bad-env', `环境变量名不合法：${raw}`, 400)
  }
  return raw
}

// ------------------------------------------------------------------ API 来源

export function isSourceId(value) {
  return typeof value === 'string' && SOURCE_ID_PATTERN.test(value)
}

/** 生成一个新来源 id：src- + 8 位小写 hex。 */
export function nextSourceId() {
  return `src-${randomBytes(4).toString('hex')}`
}

/** 单个来源：{id, label, baseUrl}。baseUrl 必填，label 缺省「来源 N」。 */
export function normalizeSource(input, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('bad-source', 'API 来源必须是对象。', 400)
  }
  const id = readText(input.id)
  if (!isSourceId(id)) {
    throw new AppError('bad-source', `来源 id 不合法：${id || '(空)'}`, 400)
  }
  const label = readText(input.label).replace(/\s+/g, ' ').slice(0, MAX_SOURCE_LABEL) || `来源 ${index + 1}`
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  if (!baseUrl) {
    throw new AppError('bad-source', `来源「${label}」缺少 API Base URL。`, 400)
  }
  return { id, label, baseUrl }
}

export function normalizeSources(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new AppError('bad-source', 'sources 必须是数组。', 400)
  if (value.length > MAX_SOURCES) {
    throw new AppError('too-many-sources', `最多添加 ${MAX_SOURCES} 个 API 来源。`, 400)
  }
  const out = []
  const seen = new Set()
  value.forEach((item, index) => {
    const source = normalizeSource(item, index)
    if (seen.has(source.id)) throw new AppError('bad-source', `来源 id 重复：${source.id}`, 400)
    seen.add(source.id)
    out.push(source)
  })
  return out
}

/** 默认来源必须真实存在；配错或为空时退回第一个来源。 */
export function resolveDefaultSourceId(input, sources) {
  const wanted = readText(input)
  if (wanted && sources.some((source) => source.id === wanted)) return wanted
  return sources[0]?.id
}

export function normalizeOptimizeModel(input) {
  const raw = readText(input)
  if (!raw) return DEFAULT_OPTIMIZE_MODEL
  return normalizeModel(raw)
}

/** 密钥记录的键：每个来源一把，互不覆盖。 */
export function sourceRecordKey(sourceId) {
  if (!isSourceId(sourceId)) {
    throw new AppError('bad-source', `来源 id 不合法：${sourceId || '(空)'}`, 400)
  }
  return `agnes-image-gen/api-key-${sourceId}`
}

/** 旧版单一记录键，只用于迁移。 */
export const LEGACY_RECORD_KEY = 'agnes-image-gen/api-key'

/** 生效配置（来自 profile 的 patch / override）。baseUrl 未配置时为 undefined。 */
export function normalizeConfig(config) {
  const source = config && typeof config === 'object' ? config : {}
  const sources = normalizeSources(source.sources)
  return {
    // 旧版遗留的全局 baseUrl 只用于一次性迁移到 sources。
    baseUrl: normalizeBaseUrl(source.baseUrl),
    // 旧版遗留的明文密钥只用于一次性迁移，不作为生效配置使用。
    legacyApiKey: readText(source.apiKey),
    apiKeyEnv: normalizeEnvName(source.apiKeyEnv),
    sources,
    defaultSourceId: resolveDefaultSourceId(source.defaultSourceId, sources),
    defaultModel: normalizeModel(source.defaultModel),
    defaultSize: normalizeDefaultSize(source.defaultSize),
    defaultRatio: normalizeRatio(source.defaultRatio),
    optimizeModel: normalizeOptimizeModel(source.optimizeModel),
    outputDir: readText(source.outputDir),
    timeoutMs: normalizeTimeout(source.timeoutMs),
  }
}

/** 设置页可写的配置键白名单：任何其它键一律拒绝。 */
export const CONFIG_PATCH_KEYS = [
  'defaultSourceId',
  'defaultModel',
  'defaultSize',
  'defaultRatio',
  'optimizeModel',
  'outputDir',
  'timeoutMs',
  'apiKeyEnv',
]

/**
 * 校验设置页提交的配置补丁。空字符串表示清除该键（defaultSourceId/outputDir/apiKeyEnv 有意义）。
 * 注意：来源本身（sources）不走这里，走 POST /source。
 * @returns {Record<string, unknown>} 只含通过校验的键
 */
export function normalizeConfigPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('bad-request', '配置补丁必须是对象。', 400)
  }
  const patch = {}
  for (const [key, raw] of Object.entries(input)) {
    if (!CONFIG_PATCH_KEYS.includes(key)) {
      throw new AppError('bad-request', `不支持的配置项：${key}`, 400)
    }
    if (key === 'defaultSourceId') {
      const value = readText(raw)
      if (value && !isSourceId(value)) {
        throw new AppError('bad-source', `来源 id 不合法：${value}`, 400)
      }
      patch.defaultSourceId = value
    } else if (key === 'defaultModel') {
      patch.defaultModel = normalizeModel(raw)
    } else if (key === 'defaultSize') {
      patch.defaultSize = normalizeDefaultSize(raw)
    } else if (key === 'defaultRatio') {
      patch.defaultRatio = normalizeRatio(raw)
    } else if (key === 'optimizeModel') {
      patch.optimizeModel = normalizeOptimizeModel(raw)
    } else if (key === 'outputDir') {
      const value = readText(raw)
      patch.outputDir = value && !isAbsolutePath(value) ? (() => {
        throw new AppError('bad-output-dir', `输出目录必须是绝对路径：${value}`, 400)
      })() : value
    } else if (key === 'timeoutMs') {
      patch.timeoutMs = normalizeTimeout(raw)
    } else if (key === 'apiKeyEnv') {
      patch.apiKeyEnv = normalizeEnvName(raw)
    }
  }
  return patch
}

export function isAbsolutePath(value) {
  return typeof value === 'string' && /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(value)
}

/** 档位 × 比例的像素提示；精确 WxH 或未知组合返回 undefined。 */
export function pixelHint(size, ratio) {
  const table = SIZE_TABLE[String(size).toUpperCase()]
  if (!table) return undefined
  return table[ratio]
}

export function describeResult(value) {
  const parts = [value.model, value.size, value.ratio, `${value.elapsed_ms}ms`, formatBytes(value.bytes)]
  if (Number.isInteger(value.width) && Number.isInteger(value.height)) {
    parts.push(`${value.width}x${value.height}`)
  }
  return parts.filter(Boolean).join(' · ')
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 把任意异常收成 AppError（找不到具体分类时按 502 处理）。 */
export function toAppError(error, fallback = 'internal') {
  if (error instanceof AppError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (/超时|timeout/i.test(message)) return new AppError('timeout', message, 504)
  if (/取消|cancel/i.test(message)) return new AppError('cancelled', message, 408)
  if (/HTTP 40[13]/.test(message)) return new AppError('bad-key', message, 401)
  return new AppError(fallback, message, 502)
}
