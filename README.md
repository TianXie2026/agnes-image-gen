<div align="center">

# 生图 · agnes-image-gen

**给 DeepSeek Harness 的第三方生图插件** — 侧栏「生图」双页面板 + 多 API 来源 + DPAPI 加密密钥 + 对话工具

[![License](https://img.shields.io/badge/license-MIT-2ea44f)](LICENSE)
[![Version](https://img.shields.io/github/v/release/TianXie2026/agnes-image-gen?label=version&color=blue)](https://github.com/TianXie2026/agnes-image-gen/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6)](#系统要求)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A5%200.2.2--rc.3-4b32c3)](#系统要求)
[![Stars](https://img.shields.io/github/stars/TianXie2026/agnes-image-gen?style=social)](https://github.com/TianXie2026/agnes-image-gen/stargazers)

<img src="docs/screenshots/sample-lighthouse.png" alt="示例：黄昏海岸灯塔" width="49%"> <img src="docs/screenshots/sample-lamp.png" alt="示例：台灯与旧书" width="49%">

<sub>两张示例图都由插件调用 `agnes-image-2.5-flash` 生成，未经后期处理。</sub>

</div>

---

## 它是什么

把「生图」搬进 DSH 侧边栏：左边写提示词、选来源/模型/尺寸/比例，右边直接看大图；生成过的图自动进「图库」，按日期分组、可多选、可批量删除、可一键送回参考图。也可以直接在对话里让 Agent 画。

不预置任何 API 地址和密钥——装好后在 **设置 → 生图** 里添加你自己的来源（OpenAI 兼容的图片 API，例如 Agnes）。

## 功能一览

| | 能力 |
|---|---|
| 🎨 **画图** | 文生图 / 图生图两种模式，左控右图；模型、尺寸（1K–4K 或精确 `WxH`）、比例（8 档）可选，实时显示预计像素 |
| 🖼 **查看器** | 0.25×–8× 缩放、拖动平移、`← →` 上一张/下一张、下载、复制提示词、用作参考图、打开文件夹；显示完整生成参数 |
| 🗂 **图库** | 按本地日期分组，多选/按组全选，批量删除（两步确认），批量发送到参考图 |
| 🧬 **图生图** | 点击或拖拽上传 ≤4 张参考图，也可从图库选中送入；按模型名提示是否支持图生图（支持 / 不支持 / 不确定） |
| 🔐 **多来源 + 加密密钥** | 一个或多个 Base URL + Key，按名称切换；Key 用 Windows DPAPI 加密，配置里只有变量名 |
| ✨ **提示词优化** | 一键让同一来源的对话模型改写提示词，可撤销 |
| 📝 **图片元数据** | 每张图旁写同名 `.json`（提示词、模型、尺寸、比例、来源、耗时、体积），删图一起删 |
| 💬 **对话工具** | `agnes_image_generate`，结果在会话里显示缩略图 + 参数行，也能作为图生图输入 |
| 🌓 **细节** | 中英双语、跟随 DSH 主题、无构建步骤、无遥测 |

## 系统要求

| 项 | 要求 |
|---|---|
| 系统 | **Windows 10 / 11**（密钥加密依赖 DPAPI；「打开文件夹」调用资源管理器） |
| DeepSeek Harness | **≥ `0.2.2-rc.3`** |
| 其它 | 不需要 Node/pnpm，不需要构建；插件是纯 JS bundle |

非 Windows 上插件仍可加载、对话工具可用，但**无法保存 API Key**（会明确报 `unsupported`），「打开文件夹」变为无操作。

## 安装

装完都要**关闭再启用插件**（Host 代码生效），然后**刷新页面**（Client 代码生效）。

<details open>
<summary><b>A. 从 GitHub 地址安装（推荐）</b></summary>

在 DSH 里让 Agent 或插件管理器执行：

```text
plugin_manager install_bundle, target = https://github.com/TianXie2026/agnes-image-gen
```

`install_bundle` 支持 npm 包名、git 地址、tarball、本机绝对路径；相对路径会被拒绝。

</details>

<details>
<summary><b>B. 下载 ZIP 解压后安装</b></summary>

1. 打开 <https://github.com/TianXie2026/agnes-image-gen> → `Code` → `Download ZIP`。
2. 解压到任意目录（例如 `D:\plugins\agnes-image-gen`）。
3. `plugin_manager install_bundle, target = D:\plugins\agnes-image-gen`（必须是**解压后的绝对路径**，且目录里直接有 `package.json`）。

</details>

<details>
<summary><b>C. 从 Releases 安装（tgz）</b></summary>

1. 到 [Releases](https://github.com/TianXie2026/agnes-image-gen/releases) 下载最新的 `agnes-image-gen-0.8.1.tgz`。
2. `plugin_manager install_bundle, target = <tgz 的绝对路径>`。

</details>

### 安装后核对

- `plugin_manager list_plugins`：能看到生图插件且为 enabled（显示名 **Agnes 生图**）。
- 刷新页面后，左侧栏出现「生图」。
- 设置里出现「生图」一节。

## 快速开始（3 步）

1. **加来源**：设置 → 生图 →「API 来源」→ 添加来源，填名称、Base URL、API Key，保存后点「测试连接」。
2. **试画一张**：侧栏「生图」→ 画图页，写提示词，按 `Ctrl/Cmd + Enter`。
3. **回头找图**：切到「图库」，按日期分组浏览；点开可放大、下载、复制提示词。

> Base URL 要带版本段，例如 `https://api.agnes-ai.cn/v1`（插件会自己拼 `/images/generations`、`/models`、`/chat/completions`）。

## 用法细节

### 画图页

- 顶部切「文生图 / 图生图」。左列：来源（多来源时才出现）、模型、尺寸、比例、提示词、生成/取消。右列：大图、参数行、操作。
- 提示词支持 `Ctrl/Cmd + Enter` 生成；写不好就让「优化提示词」改写，不满意点「撤销」。
- **图生图**：点上传框或把图片拖进虚线框（≤4 张），也能在图库勾选后「发送到参考图」。模型不支持时会红条禁用生成，不确定时黄条提醒。
- 结果区只保留三个动作：**再来一张**、**添加到参考图**（替换参考图并清空提示词，直接转图生图）、**删除图片**（两步确认）。

### 图库

- 输出目录里的图片按本地日期分组（今天 / 昨天 / M月D日），一次最多列 200 张（mtime 倒序）。
- 工具栏：刷新、全选、清除选择、发送到参考图、删除选中。画图页已有参考图或提示词时，发送会先问「**追加**」还是「**新建（清空原有）**」。
- 删除是**删磁盘文件**，两步确认后不可恢复，同名 `.json` 一起删。

### 查看器

- 滚轮或 `+ / −` 缩放，按住拖动平移，双击还原；`← / →` 切换上一张/下一张，`Esc` 关闭。
- 左下工具条常驻显示缩放比例；右上角 `×` 关闭（覆盖层从 Windows 标题栏下方开始，不会挡住窗口按钮）。
- 右侧：**下载**、**复制提示词**、**用作参考图**、**打开文件夹**，以及模型/尺寸/比例/像素/来源/耗时/体积/时间/文件名与修订提示词。

### 对话

直接说「画一张…」，Agent 会调用 `agnes_image_generate`：

> 用 agnes_image_generate 画一张 16:9 的 2K 图：夜晚的江边城市天际线，长曝光

| 参数 | 类型 | 说明 |
|---|---|---|
| `prompt` | string，必填 | 画面描述；图生图时写编辑指令 |
| `source` | string | 来源名称或 `src-xxxxxxxx` id；不填用默认来源 |
| `model` | string | 图像模型，默认取设置里的默认模型 |
| `size` | string | `1K/2K/3K/4K` 或 `WxH`（64–8192） |
| `ratio` | string | 8 档；`size` 为精确 `WxH` 时忽略 |
| `images` | string[] | 图生图/多图合成，≤4：https URL、`data:image/…;base64,…`、本机绝对路径 |
| `save` | boolean | 是否落盘，默认 `true` |
| `save_dir` | string | 本次输出目录（绝对路径） |
| `file_name` | string | 文件名（不含扩展名），非法字符自动清洗 |

## 配置

<details>
<summary><b>插件配置项（设置页可改）</b></summary>

| 键 | 默认 | 说明 |
|---|---|---|
| `sources` | `[]` | `[{id, label, baseUrl}]`，由设置页写入；最多 8 个 |
| `defaultSourceId` | 第一个来源 | 不指定来源时用哪个 |
| `defaultModel` | `agnes-image-2.5-flash` | 面板与工具初值 |
| `defaultSize` | `2K` | 同上 |
| `defaultRatio` | `1:1` | 同上 |
| `optimizeModel` | `agnes-3.0-flash` | 提示词优化模型 |
| `outputDir` | 自动：空闲最大的非 C 盘 `\Pictures\agnes-image`（只有 C 盘时 `~\Pictures\agnes-image`） | 落盘目录（绝对路径） |
| `timeoutMs` | `300000` | 30–600 秒 |
| `apiKeyEnv` | `AGNES_API_KEY` | 默认来源没有存储密钥时回退到该环境变量 |

</details>

## 输出目录

- 默认放在**非 C 盘**：D–Z 里空闲最大的盘 → `<盘>:\Pictures\agnes-image`；只有 C 盘时回落到 `~\Pictures\agnes-image`。
- 文件名 `agnes-YYYYMMDD-HHmmss-xxxxxx.png`，重名自动加 `-2`。
- 设置页可改目录（「选择…」调系统文件夹框），并显示当前生效目录与默认目录的空闲空间。
- 参考图存在输出目录下的 `.refs\`（`ref-*.png`），7 天后在下次上传时清理，不进图库。

## 密钥与安全边界

- 每个来源一条凭据记录 `agnes-image-gen/api-key-<sourceId>`；明文**永不**进入插件配置。
- 加密：`[System.Security.Cryptography.ProtectedData]::Protect(…, CurrentUser)`；密文（base64，`AQAAANCMnd8…` 开头）存为 `kind: grant` 记录的 payload。解密后按来源缓存 10 分钟。
- 换 Windows 用户或换机器后无法解密，需要重填 Key。DSH 凭据库本身是明文 YAML，保密性来自 DPAPI 而非文件权限。
- 面板走本机路由 `/agnes-image-gen/*`，**未套用** DSH 的会话 cookie 闸门（与 `dsh-pet` 等本地插件一致，桌面端经代理加载时 cookie 不可靠）。路由自行守卫：只接受回环 Host、拒绝 `sec-fetch-site: cross-site`、带 Origin 时必须同源、变更请求必须 `application/json`、body ≤128 KB（`/reference` 放宽到 24 MB）；`/image` 与 `/delete` 限定输出目录内文件（realpath 比对）。这能挡跨站页面，挡不住本机上以你身份运行的恶意程序。
- 图片与提示词只发往**你自己填的 Base URL**；无遥测、无回传。

<details>
<summary><b>HTTP 路由（Host 内部接口）</b></summary>

前缀 `/agnes-image-gen`，全部 JSON、`cache-control: no-store`、错误信封 `{ok:false,error:{code,message}}`：

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/state?job=` | 配置、来源与密钥状态、能力（模型/尺寸/比例/尺寸表）、诊断、任务、历史 |
| POST | `/config` | 写默认值（`defaultSourceId/defaultModel/defaultSize/defaultRatio/optimizeModel/outputDir/timeoutMs/apiKeyEnv`） |
| POST | `/source` | `{action:'save', id?, label, baseUrl, makeDefault?}` / `{action:'delete', id}` |
| POST | `/key` | `{sourceId, value}` 保存（DPAPI 加密）/ `{sourceId, clear:true}` 清除 |
| GET | `/models?sourceId=&refresh=1` | 某来源的模型列表（按来源缓存 10 分钟） |
| POST | `/generate` | 建任务，立即返回 `jobId`（可带 `sourceId`） |
| POST | `/cancel` | `{jobId}` |
| POST | `/optimize` | `{prompt, sourceId?, model?}` |
| POST | `/reference` | `{name, dataUrl}` 上传参考图（png/jpeg/webp/gif，≤24 MB）→ `.refs\` |
| POST | `/delete` | `{path}` 单张，或 `{paths:[…]}` 批量（≤100，返回 `{deleted,failed}`） |
| GET | `/history?limit=` | 输出目录图片（mtime 倒序，上限 200） |
| GET | `/image?job=` / `?path=` | 取图（`?path=` 只允许输出目录内） |
| POST | `/reveal` | 在资源管理器里定位文件（仅 Windows） |

</details>

## 开发与自测

```powershell
# 1) 纯函数 + DPAPI 往返（20 项）
node .\tools\check.mjs

# 2) 路由与守卫冒烟（DSH 已在跑；地址换成当前 Web GUI 的 host:port）
$env:AGNES_ROUTE_ORIGIN='http://127.0.0.1:<port>'
node .\tools\route-smoke.mjs --generate

# 3) 直连上游 API + 落盘（key 走环境变量，不落仓库）
$env:AGNES_API_KEY='sk-…'
node .\tools\smoke.mjs "一只橘猫坐在窗台上，水彩"

# 4) 语法检查
node --check index.js; node --check service.js; node --check http.js; node --check client.js
```

代码结构：Host 侧 `index.js`（注册工具/路由）+ `service.js`（来源、任务、历史、删除）+ `http.js`（路由与守卫）+ `secret.js`（DPAPI）+ `sources.js`/`optimize.js`/`files.js`/`api.js`/`params.js`；Client 侧单文件 `client.js`（面板、图库、查看器、设置页、工具卡片）。

## 已知限制

- 一次只返回一张图（上游不支持 `n`）；上游参数只有提示词/模型/尺寸/比例，没有 seed、负面提示词、风格。
- 图生图能力靠模型名推断：`agnes-image-2.x-flash` 判为支持，`agnes-3.x` / `agnes-image-nano` 判为不支持，其余「不确定」；判断错时可直接用对话工具传 `images` 绕过。
- 图生图输入：公网 URL / data URL / 本机绝对路径；本机文件 ≤20 MB；上传参考图单张 ≤24 MB、最多 4 张。
- 生成较慢（官方建议 60–360 秒超时）；大尺寸更慢。
- 图库一次最多 200 张；更早的图请直接在输出目录里看。
- 提示词优化依赖来源的 `/chat/completions`；不支持时会提示换模型。
- 密钥加密与「打开文件夹」仅 Windows。

## 常见问题

| 问题 | 处理 |
|---|---|
| 装完侧边栏没有「生图」 | 刷新页面；仍没有就关闭再启用插件，或重启 DSH |
| 提示「还没有可用的 API 来源」 | 设置 → 生图 → API 来源 添加一个，并点「测试连接」 |
| Key 保存失败 | 非 Windows、PowerShell 不可用，或被安全软件拦截 |
| 生成慢 / 超时 | 大尺寸与复杂提示词更慢；把超时调到 360 秒再试 |
| 能换别的生图 API 吗 | 兼容 `POST {baseUrl}/images/generations`（返回 `data[0].b64_json` 或 `data[0].url`）与 `GET {baseUrl}/models` 即可；优化需要 OpenAI 兼容 `/chat/completions` |

## English (short)

A third-party image-generation plugin for **DeepSeek Harness** (Windows 10/11, DSH ≥ 0.2.2-rc.3).

- Sidebar panel with **Text → Image** and **Image → Image** (up to 4 reference images, click or drag-drop), plus a date-grouped **Gallery** with multi-select, batch delete and "send to references".
- Built-in viewer: zoom 0.25×–8×, pan, prev/next, download, copy prompt, open folder.
- Multiple OpenAI-compatible image API sources; API keys are encrypted with **Windows DPAPI** (never stored in plaintext). Prompt optimization via the same source's `/chat/completions`.
- Conversation tool `agnes_image_generate` with text-to-image and reference-image editing.
- UI in Chinese and English, follows DSH theme, no telemetry.

Install: `plugin_manager install_bundle` with this repository URL → reload the plugin → refresh the page → add an API source in **Settings → 生图**.

## 许可证与免责

- [MIT](LICENSE) © 2026 TianXie2026
- 第三方插件，与 DeepSeek、Agnes 官方无关；上游 API 的可用性、计费与内容政策由对应服务商决定，生成内容的合规与版权责任由使用者承担。
