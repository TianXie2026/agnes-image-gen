// 落盘小工具：输出目录解析、文件名清洗、防重名写文件、本地输入图读取、
// 图片尺寸探测、输出目录图片列表。
// 只用 Node 内建模块：Host 插件跑在 Electron 的 Node 侧，DSH 的 fs 服务没有二进制写入口。

import { access, constants, mkdir, open, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i
const MAX_BASE_LENGTH = 64
const MAX_INPUT_BYTES = 20 * 1024 * 1024
const HEADER_BYTES = 64 * 1024
const MAX_HISTORY = 200

/** 没有配置输出目录时的兜底位置。 */
export const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), 'Pictures', 'agnes-image')

/** 解析本次请求要写入的目录：单次覆盖 > 插件配置 > 兜底目录。必须是绝对路径。 */
export function resolveOutputDir(configDir, overrideDir) {
  const override = typeof overrideDir === 'string' && overrideDir.trim() ? overrideDir.trim() : ''
  const configured = typeof configDir === 'string' && configDir.trim() ? configDir.trim() : ''
  const candidate = override || configured || DEFAULT_OUTPUT_DIR
  if (!path.isAbsolute(candidate)) {
    throw new Error(`输出目录必须是绝对路径：${candidate}`)
  }
  return path.resolve(candidate)
}

/** 默认文件名：agnes-YYYYMMDD-HHmmss-xxxxxx。 */
export function timestampName(date = new Date(), random = Math.random) {
  const pad = (value) => String(value).padStart(2, '0')
  const suffix = random().toString(16).slice(2, 8).padEnd(6, '0').slice(0, 6)
  return `agnes-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${suffix}`
}

/** 清洗调用方给的文件名（不含扩展名）：去非法字符、Windows 保留名、超长。 */
export function sanitizeBaseName(raw) {
  if (typeof raw !== 'string') return ''
  let value = raw.trim()
  if (!value) return ''
  value = value.replace(/\.[A-Za-z0-9]{1,5}$/, '')
  value = value
    .replace(ILLEGAL, '-')
    .replace(/\s+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
  if (RESERVED.test(value)) value = `img-${value}`
  return value.slice(0, MAX_BASE_LENGTH)
}

/** 写图片；目录按需创建，重名时追加 -2/-3…。返回最终绝对路径。 */
export async function saveImageFile({ dir, baseName, mediaType, bytes }) {
  await mkdir(dir, { recursive: true })
  const ext = EXTENSIONS[mediaType] || '.png'
  const stem = sanitizeBaseName(baseName) || timestampName()
  let target = path.join(dir, `${stem}${ext}`)
  let index = 2
  while ((await exists(target)) && index < 1000) {
    target = path.join(dir, `${stem}-${index}${ext}`)
    index += 1
  }
  await writeFile(target, bytes)
  return target
}

/** 读本地输入图（图生图），带上限与文件类型校验。 */
export async function readLocalImage(filePath) {
  const info = await stat(filePath)
  if (!info.isFile()) throw new Error(`images 里的路径不是文件：${filePath}`)
  if (info.size > MAX_INPUT_BYTES) {
    throw new Error(`输入图片太大（${info.size} 字节，上限 ${MAX_INPUT_BYTES} 字节）：${filePath}`)
  }
  return await readFile(filePath)
}

/**
 * 从图片字节里读宽高（PNG / JPEG / WebP / GIF）。读不出返回 undefined，绝不抛错。
 * @returns {{width: number, height: number} | undefined}
 */
export function readImageSize(bytes) {
  if (!bytes || bytes.length < 16) return undefined
  try {
    const b = bytes
    // PNG：IHDR 固定从第 16 字节起是大端宽高。
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b.length >= 24) {
      return { width: readUInt32BE(b, 16), height: readUInt32BE(b, 20) }
    }
    // GIF：逻辑屏幕描述符从第 6 字节起是小端宽高。
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b.length >= 10) {
      return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) }
    }
    // WebP
    if (
      b.length >= 30 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    ) {
      const chunk = String.fromCharCode(b[12], b[13], b[14], b[15])
      if (chunk === 'VP8X') {
        return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
      }
      if (chunk === 'VP8 ') {
        return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff }
      }
      if (chunk === 'VP8L' && b.length >= 25) {
        const v = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0
        return { width: 1 + (v & 0x3fff), height: 1 + ((v >> 14) & 0x3fff) }
      }
    }
    // JPEG：扫描 SOFn 段。
    if (b[0] === 0xff && b[1] === 0xd8) {
      let offset = 2
      while (offset + 9 < b.length) {
        if (b[offset] !== 0xff) {
          offset += 1
          continue
        }
        const marker = b[offset + 1]
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2
          continue
        }
        const length = (b[offset + 2] << 8) | b[offset + 3]
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: (b[offset + 7] << 8) | b[offset + 8], height: (b[offset + 5] << 8) | b[offset + 6] }
        }
        if (length < 2) return undefined
        offset += 2 + length
      }
    }
  } catch {
    // 探测只是锦上添花。
  }
  return undefined
}

/** 只读文件头来探测尺寸，避免把整张大图读进内存。 */
export async function readImageSizeOfFile(filePath) {
  let handle
  try {
    handle = await open(filePath, 'r')
    const buffer = Buffer.alloc(HEADER_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0)
    return readImageSize(buffer.subarray(0, bytesRead))
  } catch {
    return undefined
  } finally {
    if (handle) await handle.close().catch(() => {})
  }
}

/**
 * 列出输出目录里的图片（按 mtime 倒序）。
 * @returns {Promise<Array<{path: string, name: string, bytes: number, mtime: number, size?: {width:number,height:number}}>>}
 */
export async function listImageFiles(dir, limit = 24) {
  const target = path.resolve(dir)
  let entries
  try {
    entries = await readdir(target, { withFileTypes: true })
  } catch {
    return []
  }
  const files = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!IMAGE_EXTS.has(ext)) continue
    const full = path.join(target, entry.name)
    try {
      const info = await stat(full)
      files.push({ path: full, name: entry.name, bytes: info.size, mtime: info.mtimeMs })
    } catch {
      // 文件刚好被移走：跳过。
    }
  }
  files.sort((a, b) => b.mtime - a.mtime)
  const limited = files.slice(0, Math.max(1, Math.min(Number(limit) || 0, MAX_HISTORY)))
  for (const item of limited) {
    item.size = await readImageSizeOfFile(item.path)
  }
  return limited
}

/** target 是否位于 dir 之内（两者都应是已经 resolve/realpath 的绝对路径）。 */
export function isInside(dir, target) {
  const base = path.resolve(dir)
  const candidate = path.resolve(target)
  if (base === candidate) return true
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`
  return candidate.startsWith(prefix)
}

function readUInt32BE(bytes, offset) {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]
}

async function exists(target) {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}
