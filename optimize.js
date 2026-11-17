// 提示词优化：复用同一 API 来源的 OpenAI 兼容 /chat/completions 端点。
// 不引入新凭据：谁生成图片，就用谁的 Base URL + Key 来改写提示词。

import { joinEndpoint } from './api.js'
import { AppError, MAX_PROMPT_CHARS } from './params.js'

const DEFAULT_OPTIMIZE_TIMEOUT_MS = 60000
const MAX_REVISED_CHARS = MAX_PROMPT_CHARS

const SYSTEM_PROMPT = [
  '你是资深 AI 绘画提示词工程师。用户会给你一句中文或英文的画面描述。',
  '请把它改写成一段更强的生图提示词：保留原始主体与意图，补充场景、风格、光线、构图、材质与画质细节；',
  '不要改变用户要求的对象、数量、文字或氛围；不要引入与原意无关的元素。',
  '要求：',
  '1. 只输出改写后的提示词本身，不要解释、不要标题、不要加引号、不要用 Markdown 代码块；',
  '2. 保持用户原本使用的语言（中文就用中文，英文就用英文）；',
  '3. 长度控制在 120–400 字之间，信息密度优先，不要堆砌同义词；',
  '4. 不要写「以下是优化后的提示词」这类开场白。',
].join('\n')

/**
 * 调 chat 模型改写提示词。
 * @param {{baseUrl: string, apiKey: string, model: string, prompt: string, timeoutMs?: number, signal?: AbortSignal}} options
 * @returns {Promise<{prompt: string, model: string, endpoint: string}>}
 */
export async function optimizePrompt({ baseUrl, apiKey, model, prompt, timeoutMs = DEFAULT_OPTIMIZE_TIMEOUT_MS, signal }) {
  const text = String(prompt ?? '').trim()
  if (!text) throw new AppError('bad-prompt', '提示词为空，无法优化。', 400)
  if (text.length > MAX_PROMPT_CHARS) {
    throw new AppError('bad-prompt', `提示词过长（上限 ${MAX_PROMPT_CHARS} 字），请先精简。`, 400)
  }

  const endpoint = joinEndpoint(baseUrl, '/chat/completions')
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.7,
        max_tokens: 700,
      }),
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
      throw new AppError('optimize-failed', `优化接口返回了非 JSON 响应（HTTP ${response.status}）：${clip(raw, 200)}`, 502)
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new AppError(
        'optimize-unsupported',
        `该 API 来源不支持对话补全（HTTP 404）：请在设置里把「提示词优化模型」换成该来源支持的模型，或先不用优化按钮。`,
        502,
      )
    }
    throw new AppError(
      'optimize-failed',
      `提示词优化失败（HTTP ${response.status}）：${clip(describeError(payload, raw), 240)}`,
      502,
    )
  }

  const content = payload?.choices?.[0]?.message?.content
  const revised = clean(content)
  if (!revised) {
    throw new AppError('optimize-empty', '优化接口没有返回可用的提示词，请重试或换一个优化模型。', 502)
  }
  return { prompt: revised, model, endpoint }
}

function clean(value) {
  if (typeof value !== 'string') return ''
  let text = value.trim()
  // 有些模型会包一层代码块或引号，这里只取内容本身。
  const fence = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/.exec(text)
  if (fence) text = fence[1].trim()
  text = text.replace(/^["'「『]+/, '').replace(/["'」』]+$/, '').trim()
  text = text
    .split(/\n{2,}/)
    .filter((line) => !/^(以下是|优化后|提示词[:：]|Prompt[:：])/i.test(line.trim()))
    .join('\n')
    .trim()
  if (text.length > MAX_REVISED_CHARS) text = text.slice(0, MAX_REVISED_CHARS).trim()
  return text
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
  if (name === 'TimeoutError') {
    return new AppError('optimize-timeout', `提示词优化超时（${timeoutMs} ms），可以重试或改用更快的优化模型。`, 504)
  }
  if (name === 'AbortError') return new AppError('cancelled', '提示词优化已取消。', 408)
  const message = error instanceof Error ? error.message : String(error)
  return new AppError('optimize-failed', `提示词优化请求失败：${clip(message, 240)}`, 502)
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
