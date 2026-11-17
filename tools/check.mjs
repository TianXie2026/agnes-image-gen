#!/usr/bin/env node
// 纯函数 / 加密往返自测：不需要 DSH 运行时，直接跑 `node tools/check.mjs`。
// 覆盖：参数归一化、配置白名单、路径守卫辅助、文件名清洗、PNG 尺寸探测、
// 请求体形状、DPAPI 加解密往返（需要 Windows + PowerShell）。

import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'

import { buildRequestBody } from '../api.js'
import {
  DEFAULT_OUTPUT_DIR,
  defaultOutputDir,
  deleteImageMeta,
  exists,
  listImageFiles,
  metaPathFor,
  pickDefaultOutputDir,
  readImageMeta,
  readImageSize,
  resolveOutputDir,
  sanitizeBaseName,
  writeImageMeta,
  isInside,
  timestampName,
} from '../files.js'
import {
  LEGACY_RECORD_KEY,
  MAX_SOURCES,
  isSourceId,
  nextSourceId,
  normalizeBaseUrl,
  normalizeConfigPatch,
  normalizeRatio,
  normalizeSize,
  normalizeSource,
  normalizeSources,
  pixelHint,
  resolveDefaultSourceId,
  sourceRecordKey,
} from '../params.js'
import { optimizePrompt } from '../optimize.js'
import { seal, unseal } from '../secret.js'

let passed = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
  }
}

await test('normalizeSize 接受档位与精确 WxH', () => {
  assert.equal(normalizeSize('2k'), '2K')
  assert.equal(normalizeSize('2K'), '2K')
  assert.equal(normalizeSize('1024X768'), '1024x768')
  assert.equal(normalizeSize('1024*768'), '1024x768')
  assert.equal(normalizeSize('1024×768'), '1024x768')
  assert.equal(normalizeSize(''), '2K')
})

await test('normalizeSize 拒绝非法值', () => {
  assert.throws(() => normalizeSize('biggest'), /size 不合法/)
  assert.throws(() => normalizeSize('8x8'), /size 不合法/)
})

await test('normalizeRatio 只接受 8 个比例', () => {
  assert.equal(normalizeRatio('16:9'), '16:9')
  assert.throws(() => normalizeRatio('16x9'), /ratio 不合法/)
})

await test('normalizeBaseUrl 规范化并拒 userinfo', () => {
  assert.equal(normalizeBaseUrl('https://api.agnes-ai.cn/v1/'), 'https://api.agnes-ai.cn/v1')
  assert.equal(normalizeBaseUrl(''), undefined)
  assert.throws(() => normalizeBaseUrl('ftp://example.com/v1'), /http\/https/)
  assert.throws(() => normalizeBaseUrl('https://u:p@example.com/v1'), /用户名/)
})

await test('normalizeConfigPatch 白名单 + 逐键校验', () => {
  assert.deepEqual(normalizeConfigPatch({ defaultSourceId: '', defaultSize: '1k' }), {
    defaultSourceId: '',
    defaultSize: '1K',
  })
  assert.deepEqual(normalizeConfigPatch({ optimizeModel: 'agnes-2.5-pro' }), { optimizeModel: 'agnes-2.5-pro' })
  assert.throws(() => normalizeConfigPatch({ baseUrl: 'https://x/v1' }), /不支持的配置项/)
  assert.throws(() => normalizeConfigPatch({ apiKey: 'x' }), /不支持的配置项/)
  assert.throws(() => normalizeConfigPatch({ outputDir: 'relative/dir' }), /绝对路径/)
  assert.throws(() => normalizeConfigPatch({ defaultSourceId: 'nope' }), /来源 id 不合法/)
})

await test('来源校验：id / label / baseUrl / 上限 / 去重', () => {
  const id = nextSourceId()
  assert.equal(isSourceId(id), true)
  assert.equal(isSourceId('src-xyz'), false)
  const source = normalizeSource({ id, baseUrl: 'https://api.example.com/v1/' }, 0)
  assert.deepEqual(source, { id, label: '来源 1', baseUrl: 'https://api.example.com/v1' })
  assert.equal(normalizeSource({ id, label: '  A   B  ', baseUrl: 'https://x/v1' }, 2).label, 'A B')
  assert.throws(() => normalizeSource({ id, label: 'x' }, 0), /缺少 API Base URL/)
  assert.throws(() => normalizeSource({ id: 'src-1', baseUrl: 'https://x/v1' }, 0), /id 不合法/)
  assert.throws(
    () => normalizeSources(Array.from({ length: MAX_SOURCES + 1 }, () => ({ id: nextSourceId(), baseUrl: 'https://x/v1' }))),
    /最多添加/,
  )
  const dup = nextSourceId()
  assert.throws(
    () => normalizeSources([{ id: dup, baseUrl: 'https://x/v1' }, { id: dup, baseUrl: 'https://y/v1' }]),
    /重复/,
  )
})

await test('默认来源解析与密钥记录键', () => {
  const a = nextSourceId()
  const b = nextSourceId()
  const sources = [
    { id: a, label: 'A', baseUrl: 'https://a/v1' },
    { id: b, label: 'B', baseUrl: 'https://b/v1' },
  ]
  assert.equal(resolveDefaultSourceId(b, sources), b)
  assert.equal(resolveDefaultSourceId('src-deadbeef', sources), a)
  assert.equal(resolveDefaultSourceId('', sources), a)
  assert.equal(resolveDefaultSourceId(b, []), undefined)
  assert.equal(sourceRecordKey(a), `agnes-image-gen/api-key-${a}`)
  assert.equal(sourceRecordKey(a).includes(a), true)
  assert.equal(sourceRecordKey(a).includes(LEGACY_RECORD_KEY), true)
  assert.throws(() => sourceRecordKey('bad'), /id 不合法/)
})

await test('optimizePrompt 请求形状与清洗', async () => {
  const original = globalThis.fetch
  let captured
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) }
    return new Response(JSON.stringify({ choices: [{ message: { content: '```\n一只橘猫坐在窗台，水彩，晨光\n```' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const result = await optimizePrompt({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'agnes-3.0-flash',
      prompt: ' 一只猫 ',
    })
    assert.equal(captured.url, 'https://api.example.com/v1/chat/completions')
    assert.equal(captured.init.headers.Authorization, 'Bearer sk-test')
    assert.equal(captured.body.model, 'agnes-3.0-flash')
    assert.equal(captured.body.temperature, 0.7)
    assert.equal(captured.body.max_tokens, 700)
    assert.equal(captured.body.messages.length, 2)
    assert.equal(captured.body.messages[1].content, '一只猫')
    assert.equal(result.prompt, '一只橘猫坐在窗台，水彩，晨光')
    assert.equal(result.model, 'agnes-3.0-flash')
  } finally {
    globalThis.fetch = original
  }
})

await test('resolveOutputDir 只接受绝对路径', () => {
  assert.equal(resolveOutputDir('E:\\DSH\\out', ''), 'E:\\DSH\\out')
  assert.throws(() => resolveOutputDir('relative', ''), /绝对路径/)
  assert.equal(isInside('E:\\a', 'E:\\a\\b.png'), true)
  assert.equal(isInside('E:\\a', 'E:\\ab\\b.png'), false)
})

await test('pickDefaultOutputDir 避开 C 盘并选空闲最大的盘', () => {
  const picked = pickDefaultOutputDir({
    drives: [
      { root: 'C:\\', freeBytes: 1e12 },
      { root: 'D:\\', freeBytes: 2e12 },
      { root: 'E:\\', freeBytes: 1.5e12 },
    ],
    homedir: 'C:\\Users\\tester',
  })
  assert.equal(picked, path.join('D:\\', 'Pictures', 'agnes-image'))
})

await test('pickDefaultOutputDir 只有 C 盘时回落家目录', () => {
  const picked = pickDefaultOutputDir({
    drives: [{ root: 'C:\\', freeBytes: 1e12 }],
    homedir: 'C:\\Users\\tester',
  })
  assert.equal(picked, path.join('C:\\Users\\tester', 'Pictures', 'agnes-image'))
})

await test('resolveOutputDir 未配置时走默认目录', () => {
  const fallback = resolveOutputDir('', '')
  assert.equal(path.isAbsolute(fallback), true)
  assert.equal(fallback, defaultOutputDir())
  assert.equal(path.isAbsolute(DEFAULT_OUTPUT_DIR), true)
})

await test('sanitizeBaseName 清洗非法字符与保留名', () => {
  assert.equal(sanitizeBaseName('a/b:c*?.png'), 'a-b-c')
  assert.equal(sanitizeBaseName('CON'), 'img-CON')
  assert.equal(sanitizeBaseName('   '), '')
  assert.match(timestampName(), /^agnes-\d{8}-\d{6}-[0-9a-f]{6}$/)
})

await test('readImageSize 读 PNG 头', () => {
  const header = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0)
  header.writeUInt32BE(13, 8)
  header.write('IHDR', 12, 'ascii')
  header.writeUInt32BE(1024, 16)
  header.writeUInt32BE(512, 20)
  assert.deepEqual(readImageSize(header), { width: 1024, height: 512 })
  assert.equal(readImageSize(Buffer.alloc(4)), undefined)
})

await test('buildRequestBody 形状符合文档', () => {
  const body = buildRequestBody({ model: 'agnes-image-2.5-flash', prompt: 'x', size: '2K', ratio: '16:9' })
  assert.equal(body.return_base64, true)
  assert.equal(body.extra_body.response_format, 'b64_json')
  assert.equal('response_format' in body, false)
  assert.equal('image' in body.extra_body, false)
  const edit = buildRequestBody({ model: 'm', prompt: 'x', size: '2K', ratio: '1:1', images: ['data:image/png;base64,AA=='] })
  assert.deepEqual(edit.extra_body.image, ['data:image/png;base64,AA=='])
})

await test('pixelHint 提供档位×比例像素', () => {
  assert.deepEqual(pixelHint('2K', '16:9'), [2624, 1472])
  assert.deepEqual(pixelHint('1K', '9:16'), [736, 1312])
  assert.equal(pixelHint('1024x768', '1:1'), undefined)
})

await test('图片 sidecar 元数据写入 / 读取 / 删除', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'agnes-meta-'))
  try {
    const file = path.join(dir, 'pic.png')
    const png = Buffer.alloc(33)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0)
    png.writeUInt32BE(13, 8)
    png.write('IHDR', 12, 'ascii')
    png.writeUInt32BE(640, 16)
    png.writeUInt32BE(480, 20)
    await writeFile(file, png)

    const meta = {
      prompt: '一只橘猫，水彩',
      model: 'agnes-image-2.5-flash',
      size: '1K',
      ratio: '1:1',
      width: 640,
      height: 480,
      bytes: png.length,
      created_at: new Date().toISOString(),
      mode: 'txt2img',
      refs: 0,
      media_type: 'image/png',
    }
    await writeImageMeta(file, meta)
    assert.equal(JSON.parse(await readFile(metaPathFor(file), 'utf8')).v, 1)
    const back = await readImageMeta(file)
    assert.equal(back.prompt, meta.prompt)
    assert.equal(back.model, meta.model)

    const listed = await listImageFiles(dir, 5)
    assert.equal(listed.length, 1)
    assert.equal(listed[0].meta.prompt, meta.prompt)
    assert.equal(listed[0].width, 640)
    assert.equal(listed[0].height, 480)

    await writeFile(metaPathFor(file), '{ broken json')
    assert.equal(await readImageMeta(file), null)
    const broken = await listImageFiles(dir, 5)
    assert.equal(broken.length, 1)
    assert.equal(broken[0].meta, undefined)
    assert.equal(broken[0].width, 640)

    await deleteImageMeta(file)
    assert.equal(await exists(metaPathFor(file)), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await test('DPAPI 加密往返且密文不含明文', async () => {
  if (process.platform !== 'win32') {
    console.log('     (跳过：非 Windows)')
    return
  }
  const plain = 'sk-check-only-0001'
  const cipher = await seal(plain)
  assert.ok(cipher.length > 40, '密文太短')
  assert.equal(cipher.includes(plain), false)
  assert.equal(cipher.startsWith('AQAAANCMnd8'), true, '不是 DPAPI blob')
  assert.equal(await unseal(cipher), plain)
  assert.equal(LEGACY_RECORD_KEY, 'agnes-image-gen/api-key')
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const item of failures) {
    console.error(`\n${item.name}`)
    console.error(item.error)
  }
  process.exit(1)
}
