# Agnes 生图（agnes-image-gen）

> 侧边栏点「生图」分「画图 / 图库」两页：画图页左边写提示词、选来源/模型/尺寸/比例，右边直接看图；图库页按日期分组看历史图片，可多选批量删除。
> 也可在对话里让 Agent 调用 `agnes_image_generate`。

## 系统要求与安装

- Windows 10 / 11 + DeepSeek Harness ≥ `0.2.2-rc.3`；插件是纯 JS bundle，不需要 Node/pnpm，也不需要构建。
- 安装：把 GitHub 地址（`https://github.com/TianXie2026/agnes-image-gen`）、解压后的绝对目录、或 Releases 里的 `.tgz` 交给 `plugin_manager install_bundle`；装完关闭再启用插件（Host 生效）、刷新页面（Client 生效）。
- 非 Windows 可以加载和使用对话工具，但无法保存 API Key（DPAPI 限制），「打开文件夹」不生效。

## 它做什么

- 左侧栏「生图」入口，点开是两个页签：
  - **画图**：顶部切「文生图 / 图生图」。左列是控制区（提示词、优化提示词、API 来源（多来源时可选）、模型、尺寸（1K/2K/3K/4K 或精确 WxH）、比例（8 档）、预计像素；图生图模式下还有上传/拖拽区与参考图网格），右列是结果区（大图、参数行、再来一张、添加到参考图、删除图片）。
  - **图库**：输出目录里的历史图片，按本地日期分组（今天 / 昨天 / M月D日），支持勾选、按组全选、清除选择、批量删除（两步确认）、批量「发送到参考图」（画图页已有内容时可选择追加或清空重建），单张也能直接删。
- 「优化提示词」把当前提示词发给同一来源的对话模型（默认 `agnes-3.0-flash`）改写，用户自己决定是否采用，可一键「撤销」。
- 结果区参数行：来源 · 模型 · 尺寸 · 比例 · 耗时 · 体积 · 像素；点图进入查看器。
- **查看器**：滚轮或 `+ / −` 缩放（0.25×–8×）、按住拖动平移、双击还原、上一张/下一张翻页；`下载`、`复制提示词`、`用作参考图`、`打开文件夹`；右侧显示提示词、修订提示词与生成参数。
- 画图页与图库页的所有按钮统一成同一套样式（34px 高、实底、hover/focus 状态一致），不再混用旧的小号灰按钮。
- **图生图 / 参考图**：切到图生图后点虚线框选图、或把图片拖进框（≤4 张，`×` 移除）；也可以在「图库」勾选图片后点「发送到参考图」（会自动切回画图页并进入图生图模式）。
- **图生图能力提示**：按模型名判断（`agnes-image-2.x-flash`→支持、`agnes-3.x`/`agnes-image-nano`→不支持、其余→不确定）。明确不支持时红色提示并禁用生成，不确定时黄色提示但允许尝试。
- 每张图同时落盘（默认项目 `outputs\`，未配置时用非 C 盘默认目录），文件名 `agnes-YYYYMMDD-HHmmss-xxxxxx.png`，重名自动加 `-2`；旁边写一个同名 `.json` 元数据（见下）。
- 历史提示词不再显示在画图页（旧版 localStorage 数据保留但不再读取）。
- 对话里仍保留工具卡片：Agent 调用时在对话内显示缩略图 + 参数行，点图看大图；可指定 `source` 用哪个来源。

## 首次使用

插件安装后**不含** API 地址与密钥，需要你先配置：

1. 打开 设置 → 生图（或插件详情页里的配置页）。
2. 在「API 来源」里 添加来源：起个名字、填 Base URL（例如 `https://api.agnes-ai.cn/v1`）、填 API Key，保存。
3. 点「测试连接」确认能拉到模型列表；有多个来源时，可「设为默认」决定不指定时用哪个。

一个来源够用；要多家（或同一家多个 Key）就加多个，面板与工具都能按名称/id 选。超出 8 个会被拒绝。

API Key **不会明文保存**：保存时用 Windows DPAPI 加密（仅当前 Windows 用户可解密），每个来源一条密文记录 `agnes-image-gen/api-key-<来源 id>`；插件配置里只有 `apiKeyEnv` 这个变量名。输入框永远不回显已保存的 key，只显示状态。

没配好时面板会给引导；点「生成」也会提示缺哪一项。

## 怎么用

侧边栏：

1. 写提示词（`Ctrl/Cmd + Enter` 直接生成）；想润色就点「优化提示词」，满意再生成，不满意点「撤销」。
2. 需要时切换来源，选模型 / 尺寸 / 比例。
3. 图生图：先切到「图生图」，点上传框或拖入图片（≤4 张），也可以从图库「发送到参考图」；模型不支持时会红条拦住生成。
4. 点「生成」；耗时约 10–60 秒，可随时取消。
5. 结果出来后：看图、再来一张、删除（点两次确认）；「添加到参考图」会用当前结果替换参考图并清空提示词，方便连续改图；查看器里可下载、复制提示词、用作参考图、打开文件夹。
6. 想看以前画的，切到「图库」：按日期分组，勾选后可批量删除或发送到参考图（已有参考图/提示词时先选追加还是新建）；点图进查看器，`← / →` 翻页。
   **图片删除会同时删掉磁盘上的文件和同名 `.json` 元数据，不可恢复。**

对话里：直接说需求，例如

> 画一张 2K、16:9 的图：雨夜霓虹街道，赛博朋克风格

工具参数（Agent 用）：

| 参数 | 默认 | 备注 |
|---|---|---|
| `prompt` | 必填 | 图生图时写编辑指令 |
| `source` | 默认来源 | 来源名称或 `src-xxxxxxxx` id |
| `model` | 来源默认 / `agnes-image-2.5-flash` | 还有 2.1 / 2.0 flash |
| `size` | `2K` | `1K/2K/3K/4K` 或 `WxH`（64–8192） |
| `ratio` | `1:1` | `size` 是 `WxH` 时忽略 |
| `images` | 空 | 图生图输入，≤4（https URL / `data:` URL / 本机绝对路径） |
| `save` / `save_dir` / `file_name` | `true` / 配置 / 自动 | 落盘控制 |

## 设置项

| 设置 | 说明 |
|---|---|
| API 来源 | 每个来源：名称、Base URL、Key 状态；测试连接 / 保存 Key / 清除 Key / 设为默认 / 删除 |
| 默认来源 | 不指定来源时用哪个 |
| 默认画图模型 / 默认尺寸 / 默认比例 | 面板与工具的初值 |
| 提示词优化模型 | 优化按钮调用的对话模型，默认 `agnes-3.0-flash`；可换 `agnes-2.5-flash` / `agnes-2.5-pro` |
| 请求超时 | 30–600 秒，默认 300 |
| 输出目录 | 绝对路径；可「选择…」用系统文件夹选择框，或「打开文件夹」；下方显示当前生效目录、未设置时的默认目录与空闲空间 |
| 诊断 | 凭据服务、DPAPI、是否还有旧版明文 key / 旧版 Base URL、上次迁移结果 |

## 数据存在哪

- 插件配置（profile `cordis.patch.yml`）：`apiKeyEnv`、`sources`（id/名称/Base URL）、`defaultSourceId`、`defaultModel`、`defaultSize`、`defaultRatio`、`optimizeModel`、`outputDir`、`timeoutMs`。**不含密钥。**
- 密钥密文：DSH 凭据库（`<harness home>\.credentials.yaml`）里的 `agnes-image-gen/api-key-<来源 id>` 记录，`kind: grant`，`payload: {scheme: dpapi-currentuser-v1, cipher: ...}`。
- 图片元数据：每张图旁边的 `<图片名>.json`（`v: 1`），字段 `prompt`、`revised_prompt`、`model`、`size`、`ratio`、`source_id`、`source_label`、`media_type`、`bytes`、`width`、`height`、`elapsed_ms`、`created_at`、`mode`（`txt2img` / `img2img`）、`refs`（参考图张数）。读不出时按「旧图」处理，不影响出图。
- 提示词历史：**v0.6.0 起不再读写**；旧版本的 localStorage 数据（`agnes-image-gen/prompt-history`）留在浏览器里，不会被清理。
- 参考图：上传的图存在输出目录下的 `.refs\`（`ref-*.png`），不进入图库；上传时顺手清理超过 7 天的旧参考图。

## HTTP 接口（面板用）

前缀 `/agnes-image-gen`，统一返回 no-store JSON，错误信封 `{ok:false,error:{code,message}}`：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/state` | 配置、来源、Key 状态、能力、诊断、最近任务与历史 |
| POST | `/config` | 写默认值（来源相关字段之外的白名单） |
| POST | `/source` | 新增/修改/删除来源（`action: save \| delete`） |
| POST | `/key` | 保存/清除某来源的 Key（`{sourceId, value}` 或 `{sourceId, clear:true}`） |
| GET | `/models` | 某来源的模型列表（`?sourceId=&refresh=1`） |
| POST | `/generate` | 发起生成（返回 `jobId`） |
| POST | `/cancel` | 取消任务 |
| POST | `/optimize` | 优化提示词 |
| POST | `/reference` | 上传参考图：`{name, dataUrl}`（png/jpeg/webp/gif，≤24 MB）→ 存到输出目录 `.refs\`，返回 `{ok, reference:{path,name,bytes,width,height}}` |
| POST | `/delete` | 删除输出目录内的图片：`{path}` 单张，或 `{paths:[…]}` 批量（≤100，返回 `{deleted,failed}`） |
| GET | `/history` | 输出目录里的图片列表（`?limit=`，上限 200，按 mtime 倒序） |
| GET | `/image` | 取图（`?job=` 或 `?path=`，只允许输出目录内） |
| POST | `/reveal` | 在资源管理器里定位文件 |

## 出错时会看到什么

- 未配置：面板顶部引导卡；工具调用返回「还没有可用的 API 来源」。
- 参数不合法：本地先校验，红字说明哪一项不对。
- Key 被拒：提示检查该来源的 API Key（HTTP 401/403）。
- 超时 / 取消：明确区分（504 / 408），取消后任务标记为已取消。
- 优化失败：提示换优化模型或稍后再试，原提示词不动。
- 删除失败（文件被占用）：提示关掉占用程序再试，界面保留该项。
- 落盘失败但图已生成：图照常显示，警告行说明原因。
- 图片渲染不出但已落盘：给占位与「打开文件夹」。

## 版本说明（0.5.0 首个公开版本）

- 本版为第一个公开发布；更早的 0.2–0.4 只在本机迭代过，没有公开包。
- 本机旧版升级：包名从 `@local/agnes-image-gen` 改为 `@tianxie2026/agnes-image-gen`，需卸载后重装一次（行 id 仍是 `agnes-image-gen`，来源与密钥记录保留）。
- 插件包不再预置 `baseUrl`/`apiKey`；未配置 `outputDir` 时按下面「默认输出目录」的规则选目录。
- 旧版单一 `baseUrl` + `agnes-image-gen/api-key` 记录会在第一次打开面板时自动迁移成默认来源（迁移在请求里做，因为插件激活期处于 Loader 的 HMR 事务中，不能写配置）；失败只记 `诊断 → 上次迁移`。

## 默认输出目录（v0.5.1 起）

- 未配置 `outputDir` 时：枚举 D–Z 盘，按 `statfs` 的空闲空间降序，选第一个盘生成 `<盘>:\Pictures\agnes-image`（例如 `D:\Pictures\agnes-image`）。
- 没有可用数据盘（只有 C 盘）或非 Windows：回落到 `~\Pictures\agnes-image`。
- 结果缓存 5 分钟；缓存的盘符消失（拔盘）会自动重算。设置页保存配置时也会刷新缓存。
- `/state` 新增 `outputDirSource`（`config`/`default`）、`defaultOutputDir`、`defaultOutputFreeBytes`，供设置页显示。
- 已配置 `outputDir` 的机器行为不变；默认值不会自动写进配置，避免静默改配置。

## 版本说明（0.6.0）

- 画图页不再显示历史提示词（旧 localStorage 数据保留，不再读取）。
- 新增图片查看器：缩放（0.25×–8×，滚轮 / 按钮 / 键盘 `+` `−` `0`）、拖拽平移、双击还原；另存为、复制图片、发到会话（复制图片并切到对话）、复制提示词；显示提示词、修订提示词与生成参数。
- 图库查看器里的「用作参考图」把图片带回画图页（最多 4 张），生成时作为图生图输入。
- 每张图旁边写同名 `.json` 元数据；`/history` 的条目带 `meta`/`width`/`height`；删图时一并删 `.json`。旧图没有 sidecar 也能正常列出与删除（查看器提示无提示词）。
- 工具 `images` 参数里的本机绝对路径会在发送前转成 `data:` URL（此前会 400：`extra_body.image must be a public http(s) URL or valid image base64`）。
- 无需迁移；升级后刷新页面即可。

## 版本说明（0.5.1）

- 默认输出目录改为「空闲最大的非 C 盘 + `\Pictures\agnes-image`」，只有 C 盘时回落家目录 Pictures。
- 设置页与首次配置卡新增「选择…」按钮（系统原生文件夹选择框），显示当前生效目录与默认目录空闲空间。
- 无需迁移：已配置的 `outputDir` 保持不变；包名、配置键、密钥记录格式均未变。

## 版本说明（0.7.0）

- 画图页顶部拆成「文生图 / 图生图」两种模式，选择记在 sessionStorage（`agnes-image-gen/mode`）。
- 图生图：点击虚线框或把图片拖进去上传参考图（≤4 张，单张 ≤24 MB，png/jpeg/webp/gif），上传后落盘到输出目录 `.refs\`；也支持在「图库」勾选后「发送到参考图」（自动切回画图页）。
- 图生图能力检测：`img2imgSupport(model)` 按模型名判 `yes/no/unknown`；不支持时红条并禁用生成，不确定时黄条但允许尝试；若来源 `/models` 返回 `supports_img2img` 之类的布尔字段则优先采用。
- 结果区按钮精简：只保留「再来一张」「删除图片」；查看器去掉「发到会话」、「另存为」改为「下载」；所有动作按钮改用统一的 32px 实底样式。
- 新增 `POST /reference`（body 上限 24 MB）；参考图上传时清理 7 天前的旧 `.refs` 文件；参考图不进入图库列表。
- 无需迁移；升级后刷新页面即可。

## 版本说明（0.8.1）

- 修复查看器工具条点击无反应：工具条从舞台内部移到舞台之上，指针捕获只在按到图片本体、且已放大（>100%）时启动，`‹ / ›`、`+ / −`、`原始大小` 都能正常点击。
- 覆盖层让出 Windows 自绘标题栏（`top: var(--dsh-frame-chrome-top, 0px)`），不再盖住窗口的最小化/最大化/关闭；发送模式对话框同样处理。
- 「关闭」放在查看器右上角（右侧信息栏标题行最右，图标 `×`）；因为覆盖层已让出标题栏，它落在窗口按钮下方，不会重叠误点；`Esc` 仍然可用。

## 版本说明（0.8.0）

- 画图页与图库页的按钮统一重做：注入一套命名空间样式 `.agnes-btn`（34px 高、实底、hover / focus-visible / disabled 一致），主按钮用品牌色，删除类用错误色；不再混用旧的小号灰按钮。
- 查看器改为固定两栏布局（舞台 + 320px 侧栏），图片不再被裁切；缩放后可按住拖动（限制在可视范围内），工具条始终显示缩放比例与上一张/下一张，支持 `← / →`。
- 查看器右侧动作：「下载」「复制提示词」「用作参考图」新增「打开文件夹」；去掉「复制图片」「发到会话」。
- 画图页结果区新增「添加到参考图」：用当前结果替换参考图、清空提示词并切到图生图模式。
- 图库「发送到参考图」支持两种模式：追加，或新建（清空原有参考图与提示词）；画图页为空时直接追加。
- 无需迁移；升级后刷新页面即可。

## 限制

- 一次一张（API 不支持 `n`）；要一组就排队多画。
- 图库一次最多列 200 张；更早的图请直接在输出目录里看。
- 上游没有 seed / 负面提示词 / 风格参数，只有提示词、模型、尺寸、比例。
- 本机图片输入上限 20 MB；上传参考图上限 24 MB、最多 4 张（存在输出目录 `.refs\`，7 天后清理）；提示词上限 4000 字符。
- 图生图能力靠模型名推断，可能比上游实际能力保守；判为「不支持」时可换模型或直接用对话工具传 `images`。
- 加密依赖 Windows DPAPI；非 Windows 或 PowerShell 不可用时无法保存 key，会明确提示。
- 删除图片只针对图片扩展名（png/jpg/jpeg/webp/gif）且在输出目录内。

## 安全说明

面板走本机 HTTP 路由 `/agnes-image-gen/*`，没有套用 DSH 的会话 cookie 闸门（与 `dsh-pet` 等本地插件一致，桌面版经代理加载页面时 cookie 不可靠）。因此路由自己做守卫：只接受回环地址的 Host，拒绝 `sec-fetch-site: cross-site`，要求带 Origin 时同源，变更类请求必须是 `application/json`（触发 CORS 预检）、请求体 ≤128 KB（`/reference` 上传参考图放宽到 24 MB）；`/image` 与 `/delete` 只允许操作输出目录内的文件（realpath 比对）。这能挡住跨站页面的简单请求，但挡不住本机上以你自己身份运行的恶意程序 —— 与任何本地 HTTP 服务同样的边界。

## 相关文件

- Host：`index.js`（接线与工具定义）、`service.js`（生成/历史/取消/来源/密钥门面）、`http.js`（路由与守卫）、`api.js`（上游 HTTP）、`optimize.js`（提示词优化）、`sources.js`（旧配置迁移）、`secret.js`（DPAPI 与凭据记录）、`params.js`（校验/尺寸表）、`files.js`（落盘/尺寸探测/目录列表）
- Client：`client.js`（侧栏入口、画图/图库双页面板、设置页、工具卡片；文案内置 zh/en）
- 自测：`tools/check.mjs`（纯函数 + DPAPI 往返）、`tools/route-smoke.mjs`（路由与守卫冒烟）、`tools/smoke.mjs`（直连上游 API）
- 上游文档：<https://www.agnes-ai.cn/zh-Hans/docs/agnes-image-25-flash.md>
