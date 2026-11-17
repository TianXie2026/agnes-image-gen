#!/usr/bin/env node
// 路由冒烟：对着正在运行的 DSH Web 服务打一圈 /agnes-image-gen/*。
// 用法：
//   node tools/route-smoke.mjs                          # 只读检查 + 守卫分支
//   node tools/route-smoke.mjs --base-url=... --key=...  # 建一个来源、存 Key、测连接
//   node tools/route-smoke.mjs --generate --base-url=... --key=...
//   node tools/route-smoke.mjs --generate --skip-optimize
// 环境变量：AGNES_ROUTE_ORIGIN 覆盖地址（默认 http://127.0.0.1:56414）；
//           AGNES_API_KEY 作为 --key 的替代；AGNES_SOURCE_ID 指定已有来源。

const origin = (process.env.AGNES_ROUTE_ORIGIN || 'http://127.0.0.1:56414').replace(/\/+$/, '')
const prefix = `${origin}/agnes-image-gen`

function argValue(name) {
  const hit = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const flags = new Set(
  process.argv
    .slice(2)
    .filter((item) => item.startsWith('--') && !item.includes('='))
    .map((item) => item.slice(2)),
)
const baseUrlArg = argValue('base-url')
const keyArg = argValue('key') || process.env.AGNES_API_KEY
const wantGenerate = flags.has('generate')
const skipOptimize = flags.has('skip-optimize')
const wantGuard = !flags.has('no-guard')

let failures = 0
let sourceId = process.env.AGNES_SOURCE_ID

function ok(name, extra) {
  console.log(`ok   ${name}${extra ? ` — ${extra}` : ''}`)
}

function fail(name, detail) {
  failures += 1
  console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(pathname, options = {}) {
  const response = await fetch(`${prefix}${pathname}`, {
    method: options.method ?? 'GET',
    headers: options.headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.startsWith('image/')) {
    const bytes = Buffer.from(await response.arrayBuffer())
    return { status: response.status, contentType, bytes }
  }
  const text = await response.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }
  return { status: response.status, contentType, payload }
}

const json = { 'content-type': 'application/json' }

/** 保存配置/来源会触发 Host 重载，路由瞬时 404/503 时重试一次。 */
async function post(pathname, body) {
  const first = await request(pathname, { method: 'POST', headers: json, body })
  if (first.status === 404 || first.status === 503) {
    await sleep(900)
    return await request(pathname, { method: 'POST', headers: json, body })
  }
  return first
}

// 1) 守卫分支（不需要业务成功）
if (wantGuard) {
  const crossSite = await request('/state', { headers: { 'sec-fetch-site': 'cross-site' } })
  crossSite.status === 403 ? ok('cross-site 被拒') : fail('cross-site 被拒', `HTTP ${crossSite.status}`)

  const evilOrigin = await request('/state', { headers: { origin: 'https://evil.example' } })
  evilOrigin.status === 403 ? ok('非回环 Origin 被拒') : fail('非回环 Origin 被拒', `HTTP ${evilOrigin.status}`)

  const noJson = await request('/config', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: {} })
  noJson.status === 415 ? ok('非 JSON 变更请求被拒') : fail('非 JSON 变更请求被拒', `HTTP ${noJson.status}`)

  const traversal = await request(`/image?path=${encodeURIComponent('C:\\Windows\\win.ini')}`)
  ;[403, 404].includes(traversal.status)
    ? ok('输出目录外的路径被拒')
    : fail('输出目录外的路径被拒', `HTTP ${traversal.status}`)

  const outsideDelete = await post('/delete', { path: 'C:\\Windows\\win.ini' })
  ;[403, 404].includes(outsideDelete.status)
    ? ok('删除输出目录外的路径被拒')
    : fail('删除输出目录外的路径被拒', `HTTP ${outsideDelete.status}`)

  const nonImageDelete = await post('/delete', { path: 'E:\\DSH\\projects\\agnes-image-gen\\README.md' })
  ;[400, 403, 404].includes(nonImageDelete.status)
    ? ok('非图片删除被拒')
    : fail('非图片删除被拒', `HTTP ${nonImageDelete.status}`)

  const cancelMissing = await request('/cancel', { method: 'POST', headers: json, body: { jobId: 'nope' } })
  cancelMissing.status === 404 ? ok('未知任务取消返回 404') : fail('未知任务取消返回 404', `HTTP ${cancelMissing.status}`)

  const badSource = await post('/source', { action: 'save', baseUrl: 'ftp://example.com/v1' })
  badSource.status === 400 ? ok('非法 baseUrl 被拒') : fail('非法 baseUrl 被拒', `HTTP ${badSource.status}`)

  const unknown = await request('/nope')
  unknown.status === 404 ? ok('未知接口返回 404') : fail('未知接口返回 404', `HTTP ${unknown.status}`)
}

// 2) 状态
let state
{
  const response = await request('/state')
  if (response.status !== 200 || response.payload?.ok !== true) {
    fail('GET /state', `HTTP ${response.status}`)
    console.log(JSON.stringify(response.payload, null, 2))
    process.exit(1)
  }
  state = response.payload
  ok(
    'GET /state',
    `v${state.version} · ready=${state.ready} · sources=${state.sources?.length ?? 0} · 默认=${state.config?.defaultSourceId || '(空)'}`,
  )
  for (const source of state.sources ?? []) {
    console.log(`     ${source.isDefault ? '*' : ' '} ${source.label} · ${source.baseUrl} · key=${source.key?.state}`)
  }
  if (state.diagnostics?.legacyPlaintext) console.log('     注意：配置里仍有旧版明文 apiKey')
  if (state.diagnostics?.legacySources) console.log('     注意：仍检测到旧版 baseUrl，启动时会迁移')
  if (!state.sources?.length) console.log('     注意：还没有 API 来源（交付态应为空，由用户在设置页添加）')
}

// 3) 建来源 / 存 Key（可选）
if (baseUrlArg) {
  const created = await post('/source', { action: 'save', baseUrl: baseUrlArg, makeDefault: true })
  if (created.status === 200 && created.payload?.source?.id) {
    sourceId = created.payload.source.id
    ok('POST /source 新建来源', `${sourceId} · ${created.payload.source.baseUrl}`)
  } else {
    fail('POST /source 新建来源', `HTTP ${created.status} ${JSON.stringify(created.payload)}`)
  }
  if (sourceId && keyArg) {
    const saved = await post('/key', { sourceId, value: keyArg })
    saved.status === 200 && saved.payload?.key?.state === 'sealed'
      ? ok('POST /key 加密保存', saved.payload.key.state)
      : fail('POST /key 加密保存', `HTTP ${saved.status} ${JSON.stringify(saved.payload?.error ?? saved.payload)}`)
  }
  await sleep(600)
  const refreshed = await request('/state')
  if (refreshed.status === 200) {
    state = refreshed.payload
    sourceId = sourceId || state.config?.defaultSourceId
  }
} else {
  sourceId = sourceId || state.config?.defaultSourceId
}

// 4) 模型列表 / 测试连接
{
  const suffix = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}&refresh=1` : '?refresh=1'
  const response = await request(`/models${suffix}`)
  if (response.status === 200 && response.payload?.ok) {
    ok('GET /models', `${response.payload.models?.length ?? 0} 个图片模型 · ${response.payload.sourceLabel ?? ''}`)
  } else {
    fail('GET /models', `HTTP ${response.status}：${response.payload?.error?.message ?? ''}`)
  }
}

// 5) 提示词优化（可选）
if (!skipOptimize) {
  const response = await post('/optimize', { prompt: '一只橘猫坐在窗台上', sourceId })
  if (response.status === 200 && response.payload?.prompt) {
    ok('POST /optimize', `${response.payload.prompt.slice(0, 40)}…`)
  } else {
    fail('POST /optimize', `HTTP ${response.status}：${response.payload?.error?.message ?? ''}`)
  }
}

// 6) 生成（可选）
if (wantGenerate) {
  const started = await post('/generate', {
    prompt: '路由冒烟测试：一只橘猫坐在窗台上，水彩风格',
    size: '1K',
    ratio: '1:1',
    sourceId,
  })
  if (started.status !== 200 || !started.payload?.jobId) {
    fail('POST /generate', `HTTP ${started.status} ${JSON.stringify(started.payload)}`)
  } else {
    const jobId = started.payload.jobId
    ok('POST /generate', `job ${jobId.slice(0, 8)}…`)
    const deadline = Date.now() + 240000
    let job
    while (Date.now() < deadline) {
      await sleep(1200)
      const polled = await request(`/state?job=${encodeURIComponent(jobId)}`)
      job = polled.payload?.job
      if (job && job.state !== 'running' && job.state !== 'cancelling') break
    }
    if (job?.state === 'done') {
      const result = job.result
      ok(
        '生成完成',
        `${result.source_label ?? ''} · ${result.model} · ${result.size} · ${result.ratio} · ${result.width}x${result.height} · ${result.bytes} B`,
      )
      const image = await request(`/image?job=${encodeURIComponent(jobId)}`)
      image.status === 200 && image.contentType.startsWith('image/') && image.bytes.length > 1000
        ? ok('GET /image?job', `${image.contentType} · ${image.bytes.length} B`)
        : fail('GET /image?job', `HTTP ${image.status} · ${image.contentType}`)
      if (result.path) {
        const file = await request(`/image?path=${encodeURIComponent(result.path)}`)
        file.status === 200 && file.bytes.length > 1000
          ? ok('GET /image?path（落盘文件）', `${file.bytes.length} B`)
          : fail('GET /image?path（落盘文件）', `HTTP ${file.status}`)
        const removed = await post('/delete', { path: result.path })
        removed.status === 200 && removed.payload?.ok
          ? ok('POST /delete 删除测试图', removed.payload.path ?? result.path)
          : fail('POST /delete 删除测试图', `HTTP ${removed.status}`)
        const gone = await request(`/image?path=${encodeURIComponent(result.path)}`)
        gone.status === 404 ? ok('删除后 /image 返回 404') : fail('删除后 /image 返回 404', `HTTP ${gone.status}`)
      }
      const cancelDone = await request('/cancel', { method: 'POST', headers: json, body: { jobId } })
      cancelDone.payload?.cancelled === false ? ok('已完成任务不可取消') : fail('已完成任务不可取消')
    } else {
      fail('生成完成', `state=${job?.state} ${job?.error?.message ?? ''}`)
    }
  }
}

// 6b) 批量删除
{
  const listed = await request('/history?limit=200')
  const dir = listed.payload?.dir
  const sample = listed.payload?.files?.[0]
  if (listed.status === 200 && dir && sample) {
    const { copyFile, stat } = await import('node:fs/promises')
    const path = await import('node:path')
    const first = path.join(dir, 'route-smoke-batch-a.png')
    const second = path.join(dir, 'route-smoke-batch-b.png')
    await copyFile(sample.path, first)
    await copyFile(sample.path, second)

    const batch = await post('/delete', {
      paths: [first, second, 'C:\\Windows\\win.ini', path.join(dir, 'route-smoke-missing.png')],
    })
    const deleted = batch.payload?.deleted ?? []
    const failed = batch.payload?.failed ?? []
    batch.status === 200 && deleted.length === 2 && failed.length === 2
      ? ok('POST /delete 批量删除', `deleted=${deleted.length} failed=${failed.length}`)
      : fail('POST /delete 批量删除', `HTTP ${batch.status} deleted=${deleted.length} failed=${failed.length}`)

    const goneA = await stat(first).then(() => false, () => true)
    const goneB = await stat(second).then(() => false, () => true)
    goneA && goneB ? ok('批量删除后文件已移除') : fail('批量删除后文件已移除')

    const tooMany = await post('/delete', { paths: Array.from({ length: 101 }, (_, index) => `${dir}\\nope-${index}.png`) })
    tooMany.status === 400 ? ok('批量删除超过 100 张被拒') : fail('批量删除超过 100 张被拒', `HTTP ${tooMany.status}`)

    const wide = await request('/history?limit=200')
    const sorted = (wide.payload?.files ?? []).every((file, index, all) => index === 0 || all[index - 1].mtime >= file.mtime)
    wide.status === 200 && sorted ? ok('GET /history?limit=200 按时间倒序') : fail('GET /history?limit=200 按时间倒序')
  } else {
    console.log('skip 批量删除 — 输出目录里还没有图片可复制')
  }
}

// 7) 来源增删：临时建一个再删掉
{
  const created = await post('/source', { action: 'save', label: 'route-smoke 临时来源', baseUrl: 'https://example.invalid/v1' })
  if (created.status === 200 && created.payload?.source?.id) {
    const id = created.payload.source.id
    ok('POST /source（临时来源）', id)
    const removed = await post('/source', { action: 'delete', id })
    removed.status === 200 && !(removed.payload?.sources ?? []).some((item) => item.id === id)
      ? ok('POST /source 删除来源')
      : fail('POST /source 删除来源', `HTTP ${removed.status} ${JSON.stringify(removed.payload?.error ?? '')}`)
  } else {
    fail('POST /source（临时来源）', `HTTP ${created.status} ${JSON.stringify(created.payload?.error ?? '')}`)
  }
}

// 8) 历史
{
  const response = await request('/history?limit=5')
  response.status === 200 && response.payload?.ok
    ? ok('GET /history', `${response.payload.files?.length ?? 0} 张 · ${response.payload.dir ?? ''}`)
    : fail('GET /history', `HTTP ${response.status}`)
}

console.log(`\n${failures ? `${failures} 项失败` : '全部通过'}`)
process.exit(failures ? 1 : 0)
