// Agnes 生图插件 · Host 入口
// 两件事：注册 agent 工具 agnes_image_generate；注册 /agnes-image-gen/* 本地路由给侧栏面板。
// 配置与密钥都不预置：安装后在「设置 → 生图」里手填，Key 走 Windows DPAPI 加密。

import { ImageService } from './service.js'
import { registerHttpRoutes } from './http.js'
import { describeResult, normalizeConfig, TOOL_NAME } from './params.js'

export const inject = ['tools', 'attachments']

export function apply(ctx, config) {
  const logger = createLogger(ctx)
  const service = new ImageService({ ctx, config: normalizeConfig(config), logger })

  ctx.effect(() => {
    const dispose = ctx.tools.register(createTool(service))
    return () => dispose()
  })

  // webServer 由 Web 组合提供，启动时可能比本插件激活得更晚：
  // 用 ctx.inject 等它出现再挂路由，这样开机加载和运行中重载都能生效。
  ctx.inject(['webServer'], (hostCtx) => {
    const webServer = hostCtx.webServer
    if (!webServer || typeof webServer.register !== 'function') {
      logger.warn?.('[agnes-image-gen] webServer 不可用：侧栏面板的接口没有注册，Agent 工具仍然可用。')
      return () => {}
    }
    return registerHttpRoutes({ webServer, service, logger })
  })

  // 旧版本把 baseUrl / apiKey 明文写在插件配置里：首次读取面板状态时做一次性迁移
  // （baseUrl → 第一个 API 来源；明文 apiKey → 默认来源的 DPAPI 记录），成功后从配置里删掉。
  // 不在激活期做：激活走 Loader 的 HMR 事务，configEditor.edit 在那里会报
  // "HMR transactions cannot be nested"。迁移入口在 ImageService#state。
}

function createTool(service) {
  return {
    name: TOOL_NAME,
    description:
      '用 Agnes 图像模型按提示词生成一张图片（也可基于已有图片编辑或合成）。调用前需要用户在 设置 → 生图 里添加至少一个 API 来源（Base URL + API Key）。一次调用只生成一张；要出多张就多次调用。图片会显示在对话里，并按配置落盘到输出目录。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['prompt'],
      properties: {
        prompt: {
          type: 'string',
          description: '要生成的画面描述，越具体越好（主体、风格、构图、光线、画质）。图生图/多图合成时写编辑指令。',
        },
        source: {
          type: 'string',
          description:
            '用哪个 API 来源（设置 → 生图 → API 来源 里的名称或 id）。不填就用默认来源；用户只说「画一张」时不要猜，留空。',
        },
        model: {
          type: 'string',
          description:
            '图像模型，默认取插件设置里的 defaultModel（agnes-image-2.5-flash）。常用：agnes-image-2.5-flash（推荐）、agnes-image-2.1-flash、agnes-image-2.0-flash。',
        },
        size: {
          type: 'string',
          description:
            '输出尺寸档位，默认 2K。可用 1K/2K/3K/4K，或精确 WxH（如 1024x768，宽高 64–8192）。给精确 WxH 时忽略 ratio。',
        },
        ratio: {
          type: 'string',
          enum: ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'],
          description: '画面比例，默认 1:1。size 给精确 WxH 时忽略。',
        },
        images: {
          type: 'array',
          items: { type: 'string' },
          description:
            '图生图/多图合成的输入图，最多 4 张。每项为 https 图片 URL、data:image/…;base64 URL，或本机绝对路径。不填即纯文生图。',
        },
        save: {
          type: 'boolean',
          description: '是否把图片落盘到输出目录，默认 true。为 false 时只在对话里显示。',
        },
        save_dir: {
          type: 'string',
          description: '本次输出目录（绝对路径），覆盖插件配置的 outputDir。',
        },
        file_name: {
          type: 'string',
          description: '文件名（不带扩展名），非法字符会被清洗；不填则按时间戳命名。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'model', 'size', 'ratio', 'elapsed_ms', 'bytes'],
        properties: {
          ok: { type: 'boolean' },
          path: { type: 'string' },
          name: { type: 'string' },
          model: { type: 'string' },
          size: { type: 'string' },
          ratio: { type: 'string' },
          source: { type: 'string' },
          source_label: { type: 'string' },
          media_type: { type: 'string' },
          elapsed_ms: { type: 'number' },
          bytes: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          saved: { type: 'boolean' },
          revised_prompt: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } },
          attachment: { type: 'object', additionalProperties: true },
        },
      },
      render(_args, value) {
        const firstLine = value?.path
          ? value.path
          : '（未落盘：save=false，图片只在对话里显示）'
        const detail = describeResult(value ?? {})
        const lines = [firstLine, value?.source_label ? `${value.source_label} · ${detail}` : detail]
        for (const warning of value?.warnings ?? []) lines.push(warning)
        const content = [{ type: 'text', text: lines.join('\n') }]
        if (value?.attachment) content.push({ type: 'image', attachment: value.attachment })
        return content
      },
      presentationMeta(_args, value) {
        return compact({
          path: value?.path,
          model: value?.model,
          size: value?.size,
          ratio: value?.ratio,
          source: value?.source_label,
          elapsed_ms: value?.elapsed_ms,
          bytes: value?.bytes,
        })
      },
    },
    timeoutMs: 360000,
    isConcurrencySafe: () => false,
    presentCall(args) {
      return { card: 'generic', title: '生成图片', rawInput: args }
    },
    async execute(args, exec) {
      const result = await service.run(
        {
          prompt: args?.prompt,
          sourceId: args?.source,
          model: args?.model,
          size: args?.size,
          ratio: args?.ratio,
          images: args?.images,
          save: args?.save,
          saveDir: args?.save_dir,
          fileName: args?.file_name,
        },
        { signal: exec?.signal },
      )
      return compact({
        ok: true,
        path: result.path,
        name: result.name,
        model: result.model,
        size: result.size,
        ratio: result.ratio,
        source: result.source,
        source_label: result.source_label,
        media_type: result.media_type,
        elapsed_ms: result.elapsed_ms,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        saved: result.saved,
        revised_prompt: result.revised_prompt,
        warnings: result.warnings,
        attachment: result.attachment,
      })
    },
  }
}

// 工具返回值必须是 lossless JSON：递归去掉 undefined（JSON.parse(JSON.stringify(x)) 的无损前提）。
function compact(value) {
  if (Array.isArray(value)) return value.map(compact)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue
      out[key] = compact(item)
    }
    return out
  }
  return value
}

function createLogger(ctx) {
  try {
    if (typeof ctx.logger === 'function') {
      const scoped = ctx.logger('agnes-image-gen')
      if (scoped && typeof scoped.warn === 'function') return scoped
    }
    if (ctx.logger && typeof ctx.logger.warn === 'function') return ctx.logger
  } catch {
    // 退回 console。
  }
  return {
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
  }
}
