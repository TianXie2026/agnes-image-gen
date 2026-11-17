// API Key 的加密存储：Windows DPAPI（当前用户）加密后写进 DSH 凭据库的 record。
// 为什么不直接存 credentials 的 ref/record 明文：~/.dsh/.credentials.yaml 是明文 YAML
// （官方 README 明说「file permissions cannot isolate the agent」），所以必须自己加密。
// 每个 API 来源一把独立记录：agnes-image-gen/api-key-<sourceId>，互不覆盖。
// 明文只通过 stdin 进入 PowerShell，永不拼进命令行、日志或错误消息。

import { spawn } from 'node:child_process'

import { AppError, LEGACY_RECORD_KEY, sourceRecordKey } from './params.js'

const SCHEME = 'dpapi-currentuser-v1'
const POWERSHELL = `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
const PS_TIMEOUT_MS = 15000
const CACHE_TTL_MS = 10 * 60 * 1000
const MIN_KEY_LENGTH = 4
const MAX_KEY_LENGTH = 512

const PROTECT_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  'Add-Type -AssemblyName System.Security',
  '$raw=[Console]::In.ReadToEnd().Trim()',
  '$bytes=[Convert]::FromBase64String($raw)',
  '$scope=[System.Security.Cryptography.DataProtectionScope]::CurrentUser',
  '$out=[System.Security.Cryptography.ProtectedData]::Protect($bytes,$null,$scope)',
  '[Console]::Out.Write([Convert]::ToBase64String($out))',
].join('\n')

const UNPROTECT_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  'Add-Type -AssemblyName System.Security',
  '$raw=[Console]::In.ReadToEnd().Trim()',
  '$bytes=[Convert]::FromBase64String($raw)',
  '$scope=[System.Security.Cryptography.DataProtectionScope]::CurrentUser',
  '$out=[System.Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,$scope)',
  '[Console]::Out.Write([Convert]::ToBase64String($out))',
].join('\n')

/** 用 DPAPI 加密一段文本，返回 base64 密文。 */
export async function seal(plaintext) {
  const value = String(plaintext ?? '')
  if (!value) throw new AppError('bad-key', 'API Key 不能为空。', 400)
  const encoded = Buffer.from(value, 'utf8').toString('base64')
  const cipher = await runPowerShell(PROTECT_SCRIPT, encoded)
  if (!cipher) throw new AppError('dpapi-failed', '加密 API Key 失败（DPAPI 没有返回密文）。', 500)
  return cipher
}

/** 解密 base64 密文，返回原始文本。 */
export async function unseal(cipher) {
  const text = String(cipher ?? '').trim()
  if (!text) throw new AppError('dpapi-failed', '密文为空。', 500)
  const encoded = await runPowerShell(UNPROTECT_SCRIPT, text)
  if (!encoded) throw new AppError('dpapi-failed', '解密 API Key 失败（DPAPI 没有返回明文）。', 500)
  return Buffer.from(encoded, 'base64').toString('utf8')
}

/**
 * 插件侧的密钥门面（按来源隔离）。
 * 读取顺序：该来源的 DPAPI 密文记录 → 环境变量（仅默认来源）→ 旧版全局明文（仅迁移期）。
 */
export class SecretStore {
  constructor({ ctx, settings, logger }) {
    this.ctx = ctx
    this.settings = settings
    this.logger = logger
    this.cache = new Map()
    this.unreadable = new Set()
  }

  credentials() {
    try {
      const service = this.ctx.get('credentials')
      return service && typeof service.readRecord === 'function' ? service : undefined
    } catch {
      return undefined
    }
  }

  invalidate(sourceId) {
    if (sourceId) {
      this.cache.delete(sourceId)
      this.unreadable.delete(sourceId)
    } else {
      this.cache.clear()
      this.unreadable.clear()
    }
  }

  /** 环境变量兜底只对默认来源生效，避免把同一个 Key 悄悄用到别的来源上。 */
  envValue() {
    const value = process.env[this.settings.apiKeyEnv]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  /** 只读状态，不解密：给 /state 和设置页用。 */
  async status(sourceId, { allowEnv = false, legacyPlaintext = false } = {}) {
    const key = sourceRecordKey(sourceId)
    const info = {
      sourceId,
      state: 'none',
      hasStored: false,
      writable: false,
      envName: this.settings.apiKeyEnv,
    }
    if (allowEnv && this.envValue()) {
      info.state = 'env'
      info.hasEnv = true
    }
    const credentials = this.credentials()
    if (!credentials) {
      if (legacyPlaintext) info.state = 'legacy'
      return info
    }
    info.writable = true
    try {
      const described = await credentials.describeRecord(key)
      info.hasStored = Boolean(described && described.configured)
      if (described && described.writable === false) info.writable = false
    } catch {
      // 记录不存在或存储未启用：按未配置处理。
    }
    if (info.hasStored) {
      info.state = this.unreadable.has(sourceId) ? 'unreadable' : 'sealed'
    } else if (legacyPlaintext) {
      info.state = 'legacy'
    }
    return info
  }

  /** 加密并保存指定来源的 Key。 */
  async save(sourceId, plaintext) {
    const value = String(plaintext ?? '').trim()
    if (value.length < MIN_KEY_LENGTH) {
      throw new AppError('bad-key', 'API Key 太短，请粘贴完整的密钥。', 400)
    }
    if (value.length > MAX_KEY_LENGTH) {
      throw new AppError('bad-key', 'API Key 太长（上限 512 字符）。', 400)
    }
    if (/\s/.test(value)) {
      throw new AppError('bad-key', 'API Key 里不能包含空白字符。', 400)
    }
    const credentials = this.credentials()
    if (!credentials) {
      throw new AppError('no-credentials', '凭据服务不可用，无法保存 API Key。请改用环境变量方式。', 503)
    }
    const cipher = await seal(value)
    const payload = { scheme: SCHEME, cipher, createdAt: Date.now() }
    await credentials.modifyRecord(sourceRecordKey(sourceId), async () => ({ kind: 'grant', payload }))
    this.cache.set(sourceId, { value, at: Date.now() })
    this.unreadable.delete(sourceId)
    return await this.status(sourceId)
  }

  /** 删除指定来源已保存的 Key（不影响环境变量）。 */
  async clear(sourceId) {
    const credentials = this.credentials()
    if (!credentials) throw new AppError('no-credentials', '凭据服务不可用。', 503)
    await credentials.deleteRecord(sourceRecordKey(sourceId))
    this.cache.delete(sourceId)
    this.unreadable.delete(sourceId)
    return await this.status(sourceId)
  }

  /** 读取指定来源生效的 Key：密文 → 环境变量（仅默认来源）→ 旧明文。 */
  async getKey(sourceId, { allowEnv = false, legacyPlaintext = false } = {}) {
    const now = Date.now()
    const cached = this.cache.get(sourceId)
    if (cached && now - cached.at < CACHE_TTL_MS) return cached.value

    const credentials = this.credentials()
    if (credentials) {
      let record
      try {
        record = await credentials.readRecord(sourceRecordKey(sourceId))
      } catch {
        record = undefined
      }
      const cipher = record && record.kind === 'grant' ? record.payload?.cipher : undefined
      if (typeof cipher === 'string' && cipher) {
        try {
          const value = await unseal(cipher)
          if (value) {
            this.cache.set(sourceId, { value, at: now })
            this.unreadable.delete(sourceId)
            return value
          }
        } catch (error) {
          this.unreadable.add(sourceId)
          this.logger?.warn?.(
            `[agnes-image-gen] 无法解密来源 ${sourceId} 的 API Key：${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
    }

    if (allowEnv) {
      const envValue = this.envValue()
      if (envValue) {
        this.cache.set(sourceId, { value: envValue, at: now })
        return envValue
      }
    }

    if (legacyPlaintext && this.settings.legacyApiKey) {
      this.cache.set(sourceId, { value: this.settings.legacyApiKey, at: now })
      return this.settings.legacyApiKey
    }

    throw new AppError(
      'no-key',
      '该 API 来源还没有保存 API Key：请到 设置 → 生图 → API 来源 里填写。',
      409,
    )
  }

  /** 旧版单记录（迁移用）：把密文原样复制到指定来源，再删掉旧记录。 */
  async copyLegacyRecord(sourceId) {
    const credentials = this.credentials()
    if (!credentials) return false
    let record
    try {
      record = await credentials.readRecord(LEGACY_RECORD_KEY)
    } catch {
      record = undefined
    }
    const cipher = record && record.kind === 'grant' ? record.payload?.cipher : undefined
    if (typeof cipher !== 'string' || !cipher) return false
    try {
      const existing = await credentials.describeRecord(sourceRecordKey(sourceId))
      if (existing && existing.configured) return false
    } catch {
      // 新记录不存在，继续。
    }
    await credentials.modifyRecord(sourceRecordKey(sourceId), async () => ({ kind: 'grant', payload: record.payload }))
    try {
      await credentials.deleteRecord(LEGACY_RECORD_KEY)
    } catch {
      // 旧记录删不掉不影响新记录可用。
    }
    this.invalidate(sourceId)
    return true
  }

  /** 旧版明文 Key（配置里的 apiKey）迁到指定来源。 */
  async migrateLegacyPlaintext(sourceId) {
    const legacy = this.settings.legacyApiKey
    if (!legacy) return false
    const credentials = this.credentials()
    if (!credentials) return false
    try {
      const described = await credentials.describeRecord(sourceRecordKey(sourceId))
      if (described && described.configured) return false
    } catch {
      // 记录不存在，继续迁移。
    }
    await this.save(sourceId, legacy)
    return true
  }
}

function encodeCommand(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

function runPowerShell(script, stdinText) {
  if (process.platform !== 'win32') {
    return Promise.reject(new AppError('unsupported', 'API Key 加密依赖 Windows DPAPI，当前系统不支持。', 501))
  }
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodeCommand(script)], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(new AppError('dpapi-failed', `无法启动 PowerShell：${messageOf(error)}`, 500))
      return
    }

    const stdout = []
    const stderr = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill()
      } catch {
        // 已经退出。
      }
      reject(new AppError('dpapi-timeout', 'DPAPI 调用超时（15s）。', 500))
    }, PS_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new AppError('dpapi-failed', `DPAPI 调用失败：${messageOf(error)}`, 500))
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString('utf8').trim()
        reject(new AppError('dpapi-failed', `DPAPI 调用失败（退出码 ${code}）：${clip(detail, 400) || '无错误输出'}`, 500))
        return
      }
      resolve(Buffer.concat(stdout).toString('utf8').trim())
    })

    child.stdin.on('error', () => {
      // 子进程提前退出时写 stdin 会 EPIPE，错误已由 close 分支覆盖。
    })
    child.stdin.end(`${stdinText}\n`)
  })
}

function clip(text, max) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
