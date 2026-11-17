# 生图 · agnes-image-gen

给 [DeepSeek Harness](https://github.com/deepseek-ai) 用的第三方生图插件：侧边栏「生图」双页面板（画图 / 图库）+ 设置页（多 API 来源 + 加密密钥）+ 对话工具 `agnes_image_generate`。

<img src="docs/screenshots/sample-lighthouse.png" alt="示例：海岸灯塔" width="49%"> <img src="docs/screenshots/sample-lamp.png" alt="示例：台灯与旧书" width="49%">

> 示例图由插件调用 `agnes-image-2.5-flash` 生成，未经后期处理。

## 功能

- **侧栏「生图」入口**：`画图` 页左列写提示词、选来源/模型/尺寸/比例，右列直接看大图；`图库` 页把历史图片按日期分组，支持多选、按组全选、批量删除。
- **多 API 来源**：可以加一个或多个 OpenAI 兼容的图片 API（Base URL + Key），面板与工具都能按名称/id 选；不选时用默认来源。
- **密钥不明文落盘**：每个来源的 Key 用 Windows DPAPI（当前用户）加密后存进 DSH 凭据库，配置里只有变量名。
- **提示词优化**：一键让同一来源的对话模型改写提示词，用不用由你决定，可撤销。
- **对话里也能画**：Agent 调用 `agnes_image_generate`，结果在会话里显示缩略图 + 参数行。
- **中英双语**、跟随 DSH 主题、无遥测。

## 系统要求

| 项 | 要求 |
|---|---|
| 系统 | Windows 10 / 11（密钥加密依赖 DPAPI；「打开文件夹」调用资源管理器） |
| DeepSeek Harness | ≥ `0.2.2-rc.3` |
| 其它 | 不需要 Node/pnpm，不需要构建；插件是纯 JS bundle |

非 Windows 上插件仍可加载、对话工具可用，但**无法保存 API Key**（保存时会明确报 `unsupported`）；`打开文件夹` 变为无操作。

## 安装

三种方式任选其一。装完都要**关闭再启用插件**（Host 代码生效），然后**刷新页面**（Client 代码生效）。

### A. 从 GitHub 地址安装（推荐）

在 DSH 里让 Agent 或插件管理器执行：

```text
plugin_manager install_bundle, target = https://github.com/TianXie2026/agnes-image-gen
```

`install_bundle` 支持 npm 包名、git 地址、tarball、本机绝对路径。

### B. 下载 ZIP 解压后装

1. 打开 <https://github.com/TianXie2026/agnes-image-gen> → `Code` → `Download ZIP`。
2. 解压到任意目录（例如 `D:\plugins\agnes-image-gen`）。
3. `plugin_manager install_bundle, target = D:\plugins\agnes-image-gen`（必须是**解压后的绝对路径**，且目录里直接有 `package.json`）。

### C. 从 Releases 装

1. 到 <https://github.com/TianXie2026/agnes-image-gen/releases> 下载 `agnes-image-gen-0.5.0.tgz`。
2. `plugin_manager install_bundle, target = <tgz 的绝对路径>`。

### 安装后核对

- `plugin_manager list_plugins`：能看到生图插件且为 enabled（显示名是 `生图`）。
- 刷新页面后，左侧栏出现「生图」。
- 设置里出现「生图」一节。

## 首次配置

插件安装后**不包含任何 API 地址和密钥**，需要你自己填：

1. 打开 设置 → 生图 →「API 来源」→ 添加来源。
2. 填名称（随意）、Base URL（例如 `https://api.agnes-ai.cn/v1`）、API Key，保存。
3. 点「测试连接」，能拉到模型列表即成功。
4. 有多个来源时，用「设为默认」决定不指定来源时用哪个。

> 也可以直接在 设置 → 生图 → 默认 里改默认模型（默认 `agnes-image-2.5-flash`）、默认尺寸（`2K`）、默认比例（`1:1`）、超时和输出目录。

## 用法

### 侧边栏「生图」

**画图**：

1. 写提示词（`Ctrl/Cmd + Enter` 直接生成）；不擅长写就点「优化提示词」，满意再生成，不满意点「撤销」。
2. 需要时切来源，选模型 / 尺寸（`1K/2K/3K/4K` 或精确 `WxH`）/ 比例（8 档），下面会显示预计像素。
3. 点「生成」，可随时「取消」；右列出现大图、参数行（来源 · 模型 · 尺寸 · 比例 · 耗时 · 体积 · 像素）。
4. 右列操作：打开文件夹 / 下载 / 复制路径 / 删除（点两次确认）/ 再来一张。
5. 历史提示词是胶囊：点击填入、`×` 删单条、可一次清空。

**图库**：

1. 输出目录里的历史图片按本地日期分组（今天 / 昨天 / M月D日）。
2. 勾选若干张 → 「删除选中」；也可按组全选、清除选择；单张角标 `×` 直接删。
3. 删除是**删磁盘文件**，两步确认后不可恢复。

快捷键：`Ctrl/Cmd + Enter` 生成；大图里 `Esc` 关闭。

### 对话

直接说「画一张…」，Agent 会调用 `agnes_image_generate`：

> 用 agnes_image_generate 画一张 16:9 的 2K 图：夜晚的江边城市天际线，长曝光

工具参数：

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

## 配置项

| 键 | 默认 | 说明 |
|---|---|---|
| `sources` | `[]` | `[{id, label, baseUrl}]`，由设置页写入；最多 8 个 |
| `defaultSourceId` | 第一个来源 | 不指定来源时用哪个 |
| `defaultModel` | `agnes-image-2.5-flash` | 面板与工具初值 |
| `defaultSize` | `2K` | 同上 |
| `defaultRatio` | `1:1` | 同上 |
| `optimizeModel` | `agnes-3.0-flash` | 提示词优化模型 |
| `outputDir` | `~\Pictures\agnes-image` | 落盘目录（绝对路径） |
| `timeoutMs` | `300000` | 30–600 秒 |
| `apiKeyEnv` | `AGNES_API_KEY` | 默认来源没有存储密钥时回退到该环境变量 |

## 密钥与安全

- 每个来源一条凭据记录：`agnes-image-gen/api-key-<sourceId>`；明文**永不**进入插件配置。
- 保存：`[System.Security.Cryptography.ProtectedData]::Protect(…, CurrentUser)`；密文（base64，`AQAAANCMnd8…` 开头）作为 `kind: grant` 记录的 payload。
- 读取：解密后按来源缓存 10 分钟；解密失败标记 `unreadable`，设置页提示重新保存。
- 更换 Windows 用户或换机器后无法解密，需要重填 Key。
- DSH 凭据库本身是明文 YAML（DSH 默认实现），所以保密性来自 DPAPI，而不是文件权限。
- 面板走本机 HTTP 路由 `/agnes-image-gen/*`，没有套用 DSH 的会话 cookie 闸门（与 `dsh-pet` 等本地插件一致，桌面端经代理加载页面时 cookie 不可靠）。因此路由自己做守卫：只接受回环 Host、拒绝 `sec-fetch-site: cross-site`、要求带 Origin 时同源、变更请求必须 `application/json`（触发 CORS 预检）、body ≤128 KB；`/image` 与 `/delete` 只允许操作输出目录内的文件（realpath 比对）。这能挡住跨站页面，但挡不住本机上以你身份运行的恶意程序。
- 图片与提示词只会发往**你自己填的 Base URL**；插件不含任何遥测或回传。

## 输出目录

- 默认 `~\Pictures\agnes-image`（Windows 下即 `C:\Users\<你>\Pictures\agnes-image`）。
- 文件名 `agnes-YYYYMMDD-HHmmss-xxxxxx.png`，重名自动加 `-2`。
- 想换目录：设置页改，或单次传 `save_dir`。
- 面板里「删除图片」与图库「删除选中」会直接删磁盘文件，不可恢复（两步确认）。

## HTTP 路由（Host）

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
| POST | `/delete` | `{path}` 单张，或 `{paths:[…]}` 批量（≤100，返回 `{deleted,failed}`） |
| GET | `/history?limit=` | 输出目录图片（mtime 倒序，上限 200） |
| GET | `/image?job=` / `?path=` | 取图（`?path=` 只允许输出目录内） |
| POST | `/reveal` | 在资源管理器里定位文件（仅 Windows） |

## 开发与自测

```powershell
# 1) 纯函数 + DPAPI 往返（14 项）
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

## 已知限制

- 一次只返回一张图（上游不支持 `n`）。
- 上游只有提示词/模型/尺寸/比例；没有 seed、负面提示词、风格参数。
- 图生图输入支持公网 URL / data URL / 本机绝对路径；本机文件上限 20 MB；提示词上限 4000 字符。
- 生成较慢（官方建议 60–360s 超时）。
- 图库一次最多列 200 张（按 mtime 倒序）；更早的图请直接在输出目录里看。
- 提示词优化依赖来源的 `/chat/completions`；不支持时会提示换模型。
- 密钥加密与「打开文件夹」仅 Windows。

## 常见问题

**装完侧边栏没有「生图」？** 先刷新页面；仍没有就关闭再启用插件，或重启 DSH。

**提示「还没有可用的 API 来源」？** 去 设置 → 生图 → API 来源 添加一个，并点「测试连接」。

**Key 保存失败？** 非 Windows、或 PowerShell 不可用时会失败；也可能安全软件拦了 PowerShell。

**生成很慢/超时？** 大尺寸和复杂提示词更慢；可在设置里把超时调到 360 秒再试。

**能换成别的生图 API 吗？** 只要兼容 `POST {baseUrl}/images/generations`（返回 `data[0].b64_json` 或 `data[0].url`）与 `GET {baseUrl}/models` 就能用；提示词优化需要兼容 OpenAI 的 `/chat/completions`。

## 许可证与免责

- MIT，见 [LICENSE](LICENSE)。
- 这是第三方插件，与 DeepSeek、Agnes 官方无关；上游 API 的可用性、计费与内容政策由对应服务商决定。
- 生成内容的合规与版权责任由使用者承担。
