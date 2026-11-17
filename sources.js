// 旧版「全局 baseUrl + 单一密钥记录」→「多来源（sources）」的一次性迁移。
// 只做一件事：把旧 baseUrl 变成第一个来源，并把旧密文记录原样搬到该来源名下。

import { nextSourceId } from './params.js'

/**
 * @param {{
 *   settings: ReturnType<typeof import('./params.js').normalizeConfig>,
 *   secret: import('./secret.js').SecretStore,
 *   editor?: any,
 *   entryOf?: (editor: any) => any,
 *   logger?: any,
 * }} options
 * @returns {Promise<{migrated: boolean, sourceId?: string, copied?: boolean}>}
 */
export async function migrateLegacySources({ settings, secret, editor, entryOf, logger }) {
  if (!settings.baseUrl || settings.sources.length) return { migrated: false }
  if (!editor || typeof editor.edit !== 'function' || typeof entryOf !== 'function') {
    return { migrated: false }
  }
  const entry = entryOf(editor)
  if (!entry) return { migrated: false }

  const sourceId = nextSourceId()
  let copied = false
  try {
    copied = await secret.copyLegacyRecord(sourceId)
  } catch (error) {
    logger?.warn?.(`[agnes-image-gen] 旧密钥记录迁移失败：${messageOf(error)}`)
  }

  try {
    await editor.edit(entry, (current) => {
      const next = { ...(current ?? {}) }
      const baseUrl = next.baseUrl
      delete next.baseUrl
      const sources = Array.isArray(next.sources) ? next.sources : []
      if (baseUrl && typeof baseUrl === 'string' && !sources.length) {
        next.sources = [{ id: sourceId, label: '默认来源', baseUrl }]
      }
      if (!next.defaultSourceId) {
        const list = Array.isArray(next.sources) ? next.sources : []
        next.defaultSourceId = list[0]?.id ?? sourceId
      }
      return next
    })
  } catch (error) {
    if (copied) {
      try {
        await secret.clear(sourceId)
      } catch {
        // 回滚失败只是留下一条无主密文记录。
      }
    }
    throw error
  }

  return { migrated: true, sourceId, copied }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
