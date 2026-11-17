// Agnes（https://api.agnes-ai.cn/v1）图像生成接口的最小客户端。
// 只负责：拼请求体 → 发请求 → 把 b64_json / url 两种响应形态归一成字节流。
// 不依赖任何 DSH 包，也直接给 tools/smoke.mjs 复用。

const DEFAULT_TIMEOUT_MS = 300000

/**
 * 组装 /images/generations 请求体。
 * 文档约定：尺寸与比例是顶层字段；图生图/合成的输入图必须放在 extra_body.image；
 * response_format 只在 extra_body 里，且文生图要 base64 需要 return_base64。
 */
export function buildRequestBody({ model, prompt, size, ratio, images }) {
  const body = {
    model,
    prompt,
    size,
    ratio,
    return_base64: true,
    extra_body: { response_format: 'b64_json' },
  }
  if (Array.isArray(images) && images.length) body.extra_body.image = images
  return body
}

/** 拼接 endpoint，容忍 baseUrl 末尾斜杠。 */
export function joinEndpoint(baseUrl, suffix) {
  return `${String(baseUrl).replace(/\/+$/, '')}${suffix}`
}

/** 按 magic bytes 判断图片类型，认不出来时按 PNG 处理（Agnes 默认输出 PNG）。 */
export function sniffMediaType(bytes) {
  const b = bytes
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'image/webp'
  return 'image/png'
}

/**
 * 生成一张图片。
 * @param {{baseUrl: string, apiKey: string, body: object, timeoutMs?: number, signal?: AbortSignal}} options
 * @returns {Promise<{bytes: Uint8Array, mediaType: string, revisedPrompt?: string}>}
 */
export async function generateImage({ baseUrl, apiKey, body, timeoutMs = DEFAULT_TIMEOUT_MS, signal }) {
  const endpoint = joinEndpoint(baseUrl, '/images/generations')
  const composite = composeSignal(timeoutMs, signal)

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: composite,
    })
  } catch (error) {
    throw requestError(error, timeoutMs)
  }

  const raw = await response.text()
  let payload
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      throw new Error(`Agnes API 返回了非 JSON 响应（HTTP ${response.status}）：${clip(raw, 300)}`)
    }
  }

  if (!response.ok) {
    throw new Error(`Agnes API 请求失败（HTTP ${response.status}）：${clip(describeError(payload, raw), 300)}`)
  }

  const item = Array.isArray(payload?.data) ? payload.data[0] : undefined
  if (!item || typeof item !== 'object') {
    throw new Error(`Agnes API 响应里没有图片数据：${clip(raw, 300)}`)
  }

  let decoded = decodeInlineImage(item.b64_json)
  if (!decoded && typeof item.url === 'string' && item.url) {
    decoded = await downloadImage(item.url, timeoutMs, signal)
  }
  if (!decoded) throw new Error('Agnes API 既没有返回 b64_json 也没有返回 url。')

  return {
    bytes: decoded.bytes,
    mediaType: decoded.mediaType || sniffMediaType(decoded.bytes),
    revisedPrompt:
      typeof item.revised_prompt === 'string' && item.revised_prompt.trim()
        ? item.revised_prompt.trim()
        : undefined,
  }
}

/**
 * 拉取模型列表（GET /models）。用于设置页「测试连接」和面板的模型下拉。
 * @param {{baseUrl: string, apiKey: string, timeoutMs?: number, signal?: AbortSignal}} options
 * @returns {Promise<{models: Array<{id: string}>, endpoint: string}>}
 */
export async function listModels({ baseUrl, apiKey, timeoutMs = 30000, signal }) {
  const endpoint = joinEndpoint(baseUrl, '/models')
  let response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: composeSignal(timeoutMs, signal),
    })
  } catch (error) {
    throw requestError(error, timeoutMs)
  }
  const raw = await response.text()
  let payload
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      throw new Error(`模型列表不是 JSON（HTTP ${response.status}）：${clip(raw, 200)}`)
    }
  }
  if (!response.ok) {
    throw new Error(`模型列表请求失败（HTTP ${response.status}）：${clip(describeError(payload, raw), 200)}`)
  }
  const rows = Array.isArray(payload?.data) ? payload.data : []
  const models = rows
    .map((row) => (typeof row === 'string' ? { id: row } : row))
    .filter((row) => typeof row?.id === 'string' && row.id.trim())
    .map((row) => {
      const id = row.id.trim()
      const flag = row.supports_img2img ?? row.supportsImg2Img ?? row?.features?.img2img
      const item = { id }
      if (typeof flag === 'boolean') item.img2img = flag
      return item
    })
  return { models, endpoint }
}

function composeSignal(timeoutMs, outer) {
  const signals = []
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    signals.push(AbortSignal.timeout(timeoutMs))
  }
  if (outer) signals.push(outer)
  if (!signals.length) return undefined
  if (signals.length === 1) return signals[0]
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals)

  const controller = new AbortController()
  for (const candidate of signals) {
    if (candidate.aborted) {
      controller.abort(candidate.reason)
      break
    }
    candidate.addEventListener('abort', () => controller.abort(candidate.reason), { once: true })
  }
  return controller.signal
}

function requestError(error, timeoutMs) {
  const name = error?.name
  if (name === 'TimeoutError') return new Error(`Agnes 生图请求超时（${timeoutMs} ms）。可以调大配置项 timeoutMs，或减少一次请求的复杂度。`)
  if (name === 'AbortError') return new Error('Agnes 生图请求已取消。')
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`Agnes 生图请求失败：${clip(message, 300)}`)
}

function decodeInlineImage(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const text = value.trim()
  if (text.startsWith('data:')) {
    const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/is.exec(text)
    if (!match) return undefined
    const mediaType = match[1] && /^image\//i.test(match[1]) ? match[1].toLowerCase() : undefined
    const bytes = Buffer.from(match[2], 'base64')
    if (!bytes.length) return undefined
    return { bytes, mediaType }
  }
  if (!/^[A-Za-z0-9+/\s]+=*$/.test(text)) return undefined
  const bytes = Buffer.from(text, 'base64')
  if (!bytes.length) return undefined
  return { bytes, mediaType: sniffMediaType(bytes) }
}

async function downloadImage(url, timeoutMs, signal) {
  let response
  try {
    response = await fetch(url, { signal: composeSignal(timeoutMs, signal) })
  } catch (error) {
    throw requestError(error, timeoutMs)
  }
  if (!response.ok) throw new Error(`下载生成图片失败（HTTP ${response.status}）：${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length) throw new Error(`下载生成图片失败：响应为空（${url}）`)
  return { bytes, mediaType: sniffMediaType(bytes) }
}

function describeError(payload, raw) {
  const candidates = [
    payload?.error?.message,
    typeof payload?.error === 'string' ? payload.error : undefined,
    payload?.message,
    payload?.error?.code,
  ]
  const hit = candidates.find((item) => typeof item === 'string' && item.trim())
  return hit || raw || '（无错误正文）'
}

function clip(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}
