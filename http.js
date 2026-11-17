// Host 侧 HTTP 路由：面板与设置页通过同名前缀和本地回环地址访问。
// 为什么不用 connection 的 cookie 闸门：Desktop 页面可能经 dsh-app:// 加载，
// 该闸的 cookie 行为在 Desktop 未验证（dsh-pet 同样直接注册裸路由）。这里自己做守卫：
// 只认回环 Host、拒绝跨站 fetch、变更类请求必须是 application/json（强制 CORS 预检）。

import { AppError, MAX_BODY_BYTES, ROUTE_PREFIX } from './params.js'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

const ROUTES = [
  { path: '/state', method: 'GET' },
  { path: '/config', method: 'POST' },
  { path: '/source', method: 'POST' },
  { path: '/key', method: 'POST' },
  { path: '/models', method: 'GET' },
  { path: '/generate', method: 'POST' },
  { path: '/optimize', method: 'POST' },
  { path: '/cancel', method: 'POST' },
  { path: '/history', method: 'GET' },
  { path: '/image', method: 'GET' },
  { path: '/delete', method: 'POST' },
  { path: '/reveal', method: 'POST' },
]

/**
 * 注册路由，返回卸载函数。
 * @param {{webServer: any, service: import('./service.js').ImageService, logger?: any}} options
 */
export function registerHttpRoutes({ webServer, service, logger }) {
  const dispose = webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: (request, response) => handleRequest({ request, response, service, logger }),
  })
  return () => dispose?.()
}

async function handleRequest({ request, response, service, logger }) {
  let route = '/'
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const pathname = url.pathname
    if (pathname !== ROUTE_PREFIX && !pathname.startsWith(`${ROUTE_PREFIX}/`)) {
      sendJson(response, 404, fail('not-found', '未知接口。'))
      return
    }
    route = pathname.slice(ROUTE_PREFIX.length) || '/'
    const entry = ROUTES.find((item) => item.path === route)
    if (!entry) {
      sendJson(response, 404, fail('not-found', '未知接口。'))
      return
    }
    if (String(request.method ?? 'GET').toUpperCase() !== entry.method) {
      response.setHeader('Allow', entry.method)
      sendJson(response, 405, fail('method-not-allowed', `该接口只接受 ${entry.method}。`))
      return
    }
    const rejection = guardRequest(request, entry.method === 'POST')
    if (rejection) {
      sendJson(response, rejection.status, fail(rejection.code, rejection.message))
      return
    }

    switch (route) {
      case '/state': {
        const jobId = url.searchParams.get('job') ?? undefined
        sendJson(response, 200, await service.state(jobId))
        return
      }
      case '/config': {
        const body = await readJsonBody(request)
        sendJson(response, 200, await service.saveConfig(body))
        return
      }
      case '/source': {
        const body = await readJsonBody(request)
        sendJson(response, 200, await service.saveSource(body))
        return
      }
      case '/key': {
        const body = await readJsonBody(request)
        const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : undefined
        if (body && body.clear === true) {
          sendJson(response, 200, await service.clearKey(sourceId))
          return
        }
        const value = typeof body?.value === 'string' ? body.value : ''
        sendJson(response, 200, await service.saveKey(sourceId, value))
        return
      }
      case '/models': {
        const force = url.searchParams.get('refresh') === '1'
        const sourceId = url.searchParams.get('sourceId') ?? undefined
        sendJson(response, 200, await service.models(force, sourceId))
        return
      }
      case '/generate': {
        const body = await readJsonBody(request)
        sendJson(response, 200, service.start(body))
        return
      }
      case '/optimize': {
        const body = await readJsonBody(request)
        sendJson(response, 200, await service.optimize(body))
        return
      }
      case '/delete': {
        const body = await readJsonBody(request)
        if (Array.isArray(body?.paths)) {
          sendJson(response, 200, await service.deleteImages(body.paths))
          return
        }
        sendJson(response, 200, await service.deleteImage(body?.path))
        return
      }
      case '/cancel': {
        const body = await readJsonBody(request).catch(() => ({}))
        sendJson(response, 200, service.cancel(typeof body?.jobId === 'string' ? body.jobId : undefined))
        return
      }
      case '/history': {
        const limit = Number(url.searchParams.get('limit') ?? 24)
        sendJson(response, 200, { ok: true, ...(await service.history(Number.isFinite(limit) ? limit : 24)) })
        return
      }
      case '/image': {
        const jobId = url.searchParams.get('job')
        if (jobId) {
          const cached = service.jobBytes(jobId)
          if (!cached) {
            sendJson(response, 404, fail('not-found', '任务图片已过期，请重新生成。'))
            return
          }
          sendImage(response, cached.bytes, cached.mediaType)
          return
        }
        const file = await service.readImageFile(url.searchParams.get('path'))
        sendImage(response, file.bytes, file.mediaType)
        return
      }
      case '/reveal': {
        const body = await readJsonBody(request).catch(() => ({}))
        sendJson(response, 200, await service.revealPath(typeof body?.path === 'string' ? body.path : ''))
        return
      }
      default:
        sendJson(response, 404, fail('not-found', '未知接口。'))
    }
  } catch (error) {
    const appError = error instanceof AppError ? error : undefined
    if (!appError) {
      logger?.warn?.(`[agnes-image-gen] ${route} 处理失败：${error instanceof Error ? error.message : String(error)}`)
    }
    const status = appError?.status ?? 500
    sendJson(response, status, fail(appError?.code ?? 'internal', appError?.message ?? '插件内部错误。'))
  }
}

/** @returns {{status: number, code: string, message: string} | undefined} */
function guardRequest(request, needsJson) {
  const host = headerOf(request, 'host')
  if (host && !isLoopbackAuthority(host)) {
    return { status: 403, code: 'forbidden-host', message: '只接受本地回环地址访问。' }
  }
  if (headerOf(request, 'sec-fetch-site') === 'cross-site') {
    return { status: 403, code: 'forbidden-origin', message: '拒绝跨站请求。' }
  }
  const origin = headerOf(request, 'origin')
  if (origin) {
    let originHost
    try {
      originHost = new URL(origin).host
    } catch {
      return { status: 403, code: 'forbidden-origin', message: 'Origin 不合法。' }
    }
    if (!isLoopbackAuthority(originHost)) {
      return { status: 403, code: 'forbidden-origin', message: 'Origin 必须是本地回环地址。' }
    }
  }
  if (needsJson) {
    const contentType = headerOf(request, 'content-type') ?? ''
    if (!/^application\/json\b/i.test(contentType)) {
      return { status: 415, code: 'unsupported-media-type', message: '请求体必须是 application/json。' }
    }
  }
  return undefined
}

function isLoopbackAuthority(authority) {
  const raw = String(authority ?? '').trim().toLowerCase()
  if (!raw) return false
  if (LOOPBACK_HOSTS.has(raw)) return true
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']')
    if (end > 0) return raw.slice(0, end + 1) === '[::1]'
    return false
  }
  const host = raw.split(':')[0]
  return LOOPBACK_HOSTS.has(host)
}

function headerOf(request, name) {
  const value = request.headers?.[name]
  if (Array.isArray(value)) return value[0]
  return typeof value === 'string' ? value : undefined
}

function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve(value)
    }
    request.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        finish(new AppError('too-large', `请求体超过 ${maxBytes} 字节。`, 413))
        request.destroy?.()
        return
      }
      chunks.push(chunk)
    })
    request.on('error', (error) => finish(new AppError('bad-request', `读取请求体失败：${messageOf(error)}`, 400)))
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        finish(undefined, {})
        return
      }
      try {
        finish(undefined, JSON.parse(raw))
      } catch {
        finish(new AppError('bad-json', '请求体不是合法 JSON。', 400))
      }
    })
  })
}

function sendJson(response, status, payload) {
  if (response.writableEnded) return
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  })
  response.end(body)
}

function sendImage(response, bytes, mediaType) {
  if (response.writableEnded) return
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  response.writeHead(200, {
    'content-type': mediaType || 'image/png',
    'content-length': String(body.length),
    'cache-control': 'private, max-age=60',
  })
  response.end(body)
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
