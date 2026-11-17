#!/usr/bin/env node
// Agnes 生图 API 冒烟测试：不经过 DSH，直接验证 key / 请求体 / 响应形态 / 落盘。
//
// 用法（PowerShell，key 走环境变量，不要写进仓库）：
//   $env:AGNES_API_KEY='sk-…'
//   node .\tools\smoke.mjs "一只橘猫坐在窗台上，水彩"
//
// 可选环境变量：AGNES_BASE_URL、AGNES_MODEL、AGNES_SIZE、AGNES_RATIO、AGNES_OUTPUT_DIR。
// 产物写进项目的 outputs/（该目录不进 git，也不进台账的文件级扫描）。

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRequestBody, generateImage } from '../api.js'
import { resolveOutputDir, saveImageFile, timestampName } from '../files.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.dirname(here)
const apiKey = process.env.AGNES_API_KEY
if (!apiKey || !apiKey.trim()) {
  console.error('缺少 AGNES_API_KEY 环境变量。')
  process.exit(1)
}

const prompt = process.argv[2] || '一只橘猫坐在窗台上，水彩风格，柔和晨光'
const baseUrl = process.env.AGNES_BASE_URL || 'https://api.agnes-ai.cn/v1'
const model = process.env.AGNES_MODEL || 'agnes-image-2.5-flash'
const size = process.env.AGNES_SIZE || '1K'
const ratio = process.env.AGNES_RATIO || '1:1'

const started = Date.now()
const generated = await generateImage({
  baseUrl,
  apiKey: apiKey.trim(),
  body: buildRequestBody({ model, prompt, size, ratio, images: [] }),
  timeoutMs: 300000,
})
const target = await saveImageFile({
  dir: resolveOutputDir(process.env.AGNES_OUTPUT_DIR || path.join(projectDir, 'outputs')),
  baseName: `smoke-${timestampName()}`,
  mediaType: generated.mediaType,
  bytes: generated.bytes,
})

const dimensions = pngSize(generated.bytes)
console.log(
  JSON.stringify(
    {
      ok: true,
      path: target,
      mediaType: generated.mediaType,
      bytes: generated.bytes.byteLength,
      elapsed_ms: Date.now() - started,
      request: { model, size, ratio, prompt },
      dimensions,
      revised_prompt: generated.revisedPrompt,
    },
    null,
    2,
  ),
)

function pngSize(bytes) {
  if (bytes.length < 24) return null
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!isPng) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
