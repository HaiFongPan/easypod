# EasyPod — 播客播放器（Electron/macOS）

> 目标：在 macOS 上提供一款本地优先（privacy-first）的播客播放器，集成 ASR（FunASR）转写、说话人分离、AI 总结 & 对话，以及多格式导出能力。采用 JS + Electron，打包为 dmg/pkg。

---

## 1. 术语 & 范围

- **RSS/Feed**：播客订阅源（兼容 Apple/Google/Podcast Index 扩展标签）。
- **Episode**：单集，包含音频、封面、章节、shownotes。
- **Shownote**：单集正文（HTML/Markdown），可能内嵌章节时间戳。
- **Chapter**：章节信息。优先顺序：Podcast 2.0 `podcast:chapters` JSON → ID3/MP3 Chapter → Shownote 解析。
- **ASR**：FunASR 本地/服务端转写，包含时间戳和说话人（S0,S1…）。
- **AI Provider**：可插拔的大模型服务（OpenAI API 兼容、DashScope、DeepSeek、Ollama、本地 vLLM 等）。
- **Mindmap**：心智图/大纲（导出 XMind/OPML）。

---

## 2. 用户角色 & 关键场景

- **普通听众**：订阅/播放/跳转章节/快捷键/播放历史。
- **信息整理者**：转写→总结→提炼要点→导出到 Obsidian/Notion/XMind/PDF/Markdown。
- **重度播客用户**：跨多节目搜索、书签/高亮片段、与历史内容进行 Chat。

典型用户旅程：

1. 导入订阅（手动/OPML），加载封面和单集列表；
2. 播放音频，使用键盘/Touch Bar/媒体键控制；
3. 点击章节或 shownote 时间戳跳转；
4. 选择“转写并分离说话人”，实时滚动字幕；
5. 一键“AI 总结/智能分章节/提炼/思维导图”；
6. 导出到 Obsidian/Notion/XMind/PDF/Markdown；
7. 后续可基于该集或历史多集发起 Chat 查询。

---

## 3. 功能清单 → 细化与验收标准

### 3.1 订阅 & 库管理

**需求**

- 订阅 RSS（支持 https/http；认证播客可选凭证）。
- 导入/导出 OPML。
- 自动刷新：前台手动刷新；后台定时（可设间隔）。
- 展示封面：优先单集 `<itunes:image>` / episode-level image，其次节目级 cover。
- Shownote 展示（HTML 渲染 + 安全白名单）；提取章节时间戳（`00:12:34` / `12:34`）。
- 全文/多字段搜索（节目名、单集标题、shownote、AI 提炼摘要）。

**验收**

- 给定一个含 `podcast:chapters` 的 feed，渲染章节并可点击跳转。
- 导入 OPML 后，所有 feed 可见且可手动刷新更新单集。
- 无章节时，可从 shownote 时间戳解析 ≥ 80% 正确率（人工 spot-check）。

### 3.2 播放器

**需求**

- 基础控制：播放/暂停、快进/后退（+/- 10/30s 可配置）、倍速（0.5–3x）、静音、音量。
- 进度记忆：每集记忆最后播放位置；播放历史列表；每集播放完成标记。
- 章节跳转：列表 & 进度条刻度；快捷键。
- 媒体键 / Touch Bar / Menu Bar 控制；系统托盘快捷操作。
- 缓存与下载：可选择离线下载（目录可自定义），断点续传，空间占用管理。

**验收**

- 关闭应用重开后，单集恢复到离开位置；
- 快捷键与媒体键在前后台均可控制基本播放；
- 离线模式下该集可无网播放。

### 3.3 字幕转写（FunASR）与说话人分离

**需求**

- FunASR 集成两种模式：
  1. **本地推理**：随应用附带/首次下载模型；
  2. **后台服务**：暂不启用（当前仅支持本地推理）。
- 生成结果含词/句级时间戳；支持声纹/说话人分离（Diarization）。
- 播放时逐行/逐句滚动高亮；点击字幕行→音频跳转；
- 字幕编辑（轻量）：合并/拆分句子、修订文本、重算对齐（可选）。
- 多轨/双语字幕预留（未来兼容翻译）。

**验收**

- 对 60 分钟音频完成转写，生成 `.json/.srt/.vtt`；
- 字幕与音频位置误差 ≤ 500ms（基于随机抽样 30 处评估）；
- 说话人标签稳定（段落级变更不超过必要切换）。

### 3.4 AI Provider（可插拔）

**需求**

- 配置多个 Provider：名称、Base URL、API Key、模型名、超时、并发、计费估算；
- 提供能力：
  - 单集总结（TL;DR）、智能分章节（带时间点）、重点摘录（要点/引文/金句）；
  - Mindmap（层级 JSON/OPML）；
  - Chat（仅当前集 / 结合历史库）。
- Prompt 模板化：支持变量（如 `${title}` `${transcript}` `${chapters}`）、条件/片段复用；
- 历史记录保存：可查看某集的所有 AI 任务（含 Prompt、模型、时间、成本、输出），可重新生成/对话追溯。

**验收**

- 新增一个自定义 Provider 并成功对同一转写执行“总结”和“分章节”；
- 修改 Prompt 模板后生成结果可体现模板变更；
- Chat 能引用该集与历史多集（用户可指定检索范围）。

### 3.5 导出

**需求**

- Obsidian：写入本地库目录（YAML Front Matter + Markdown 正文 + 资源文件），双链/Tag 支持；
- Notion：OAuth/Token，创建/更新页面（标题/属性/富文本/代码块/图片/文件）；
- Markdown：独立 `.md`/`.mdx`；
- PDF：应用内导出（基于 Electron `printToPDF`），页眉页脚、目录、页码；
- XMind：直接 `.xmind`（Zip+XML）或经由 OPML/FreeMind（.mm）中间格式；
- 附件：封面、字幕（.srt/.vtt/.json）、章节 JSON、AI 摘要。

**验收**

- 选 1 集→一键导出到 5 种目标格式；再次导出会做“更新而非重复”处理（根据 Episode GUID）。

### 3.6 设置 & 偏好

- 媒体快捷键、跳转秒数、默认倍速、下载目录、自动刷新间隔；
- ASR 模型选择（轻量/标准/增强）、设备选择（CPU/GPU）、并发数；
- AI Provider 管理、Prompt 模板管理（内置若干模板 + 自定义）；
- 隐私：允许/禁止将音频/转写上传至第三方；默认本地优先。

---

## 4. 数据模型（建议 SQLite + FTS5（全文搜索扩展））

### 4.1 主要表

- `feeds(id, title, url, cover_url, last_checked_at, opml_group, meta_json)`
- `episodes(id, feed_id, guid, title, description_html, audio_url, pub_date, duration_sec, episode_image_url, local_audio_path, status{new|in_progress|played|archived}, last_played_at, last_position_sec, meta_json)`
- `chapters(id, episode_id, start_ms, end_ms, title, image_url, source{json|id3|shownote})`
- `transcripts(id, episode_id, engine{funasr}, lang, diarization_json, srt_path, vtt_path, raw_json_path, created_at, updated_at)`
- `transcript_segments(id, transcript_id, start_ms, end_ms, speaker, text, tokens_json)`
- `ai_tasks(id, episode_id, provider, model, prompt_template_id, prompt_vars_json, status{queued|running|succeeded|failed}, cost_usd, output_md, output_json, created_at)`
- `ai_prompts(id, name, category{summary|chapters|mindmap|chat}, template_text, variables_json, version, is_builtin)`
- `exports(id, episode_id, target{obsidian|notion|markdown|pdf|xmind}, location, status, last_exported_at, meta_json)`
- `search_index(virtual FTS5 over title, description, transcript_text, ai_output)`

### 4.2 文件布局

```
~/Library/Application Support/EasyPod/
  db.sqlite
  cache/
    covers/
    audio/
  transcripts/
    <episodeId>/raw.json
    <episodeId>/subtitles.srt|.vtt
  exports/
    markdown/
    pdf/
    xmind/
```

---

## 5. 架构与技术选型

### 5.1 Electron 前后端

- **UI 框架**：React + Tailwind（或 Ant Design）
- **状态管理**：Zustand/Recoil；
- **进程**：Main（系统集成/菜单/托盘/协议处理）、Renderer（UI）、Background/Worker（下载/解析/索引）。
- **IPC**：Electron IPC + Node 子进程（FFmpeg、FunASR Python 服务）。
- **本地 DB**：SQLite（better-sqlite3/Drizzle ORM）。
- **音频播放**：HTMLAudioElement + Media Session API；波形（可选 Wavesurfer.js）。
- **打包**：electron-builder（dmg/pkg）、Apple Notarization。

### 5.2 RSS & 解析

- `rss-parser`/`podcast-feed-parser`；
- 支持 Podcast 2.0：`<podcast:chapters url="...json" type="application/json"/>`；
- Shownote 时间戳提取：正则 + 语义行合并；
- ID3/MP3 章节读取：`music-metadata`（可选）。

### 5.3 FunASR 集成

- **选型**：内置 Python venv（随 app 首次启动安装），启动本地服务：
  - 端口随机 + 仅本机访问（127.0.0.1）；
  - gRPC/HTTP 接口：`/transcribe`, `/diarize`, `/status`；
  - 任务队列：分片（chunking 30–60s），流式回传增量结果；
- **前处理**：FFmpeg 统一采样率（16k/32k）、单声道/双声道；
- **后处理**：标点、数字归一、时间戳对齐（CTC/DTW 可选）；
- **说话人**：UI 允许重命名 `S0/S1` 为“主持人/嘉宾 A”。

### 5.4 AI Provider 抽象

- Provider 接口：

```ts
interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  headers: Record<string, string>;
  invoke(
    prompt: string,
    input: Record<string, any>,
    options: { stream?: boolean; timeoutMs?: number },
  ): AsyncIterable<string> | Promise<string>;
}
```

- 支持 OpenAI Chat Completions 兼容、阿里 DashScope、Ollama、本地 vLLM；
- 检索（历史 Chat）使用 SQLite FTS5 或本地向量库（`sqlite-vec` / `onnx`/`faiss`，可选）。

### 5.5 导出实现

- **Obsidian**：模板：
  - Front Matter：`title`, `podcast`, `episode`, `date`, `tags`, `guid`；
  - 正文：摘要、要点、章节、引用、链接、字幕片段；
- **Notion**：页面属性映射（节目/单集/日期/标签/时长/状态）；
- **Markdown/PDF**：同模板 + 资源相对路径；
- **XMind**：优先输出 OPML（.opml），若启用原生 XMind：构建 Zip 包含 `content.json`。

---

## 6. 关键交互 & 界面草图（文字说明 + 简易线框图）

1. **侧边栏**：订阅列表、智能收藏夹（未播/在听/已完成/有 AI 提炼）。
2. **主列表**：当前 feed 单集列表（封面、标题、时长、进度条、是否已下载）。
3. **播放栏**：底部固定（播放/暂停、前进/后退、倍速、进度、封面）。
4. **章节/字幕面板**：左右分栏可切换：章节列表 | 字幕滚动；
5. **AI 面板**：任务卡片（总结/分章节/提炼/Mindmap），可点击查看历史；
6. **Chat 面板**：对话（引用片段带时间戳，可一键跳转播放）。

---

## 7. 权限、安全与隐私

- 默认不上传音频/转写到云端；
- 若使用云端 AI，需显式勾选“允许上传转写/摘要”；
- API Key 加密存储（macOS Keychain）；
- 本地服务仅监听 127.0.0.1；
- Crash/日志脱敏；
- 兼容公司/校园代理环境（HTTP(S) Proxy）。

---

## 8. 性能 & 体验指标（建议）

- **应用启动 ≤ 2.5s（冷启动，已初始化完成）；**
- 订阅刷新 50 个 feed ≤ 30s（高并发抓取，利用 ETag/Last-Modified 缓存）；
- 60 分钟音频本地 ASR：标准模型在 M1/M2 CPU 需分钟级处理（约 20–40 分钟），UI 前台不阻塞；
- UI 滚动字幕渲染 60fps；
- 数据库查询 P95 ≤ 50ms。

---

## 9. 测试 & 验收

- 单元：解析器（Feed/章节/Shownote 正则/时间戳）、DB、导出格式；
- 集成：ASR 端到端、AI Provider 端到端、Notion OAuth；
- 回归：播放与快照；
- 手测清单：快捷键/媒体键、离线下载、封面优先级、章节跳转精度、字幕点击跳转。

---

## 10. 迭代里程碑

- **MVP（4–6 周开发量参考）**：
  - 订阅/播放/历史/章节/shownote；
  - FunASR 本地服务 + 转写（离线批处理）+ 字幕滚动；
  - AI 总结 + 分章节（1 个 Provider）+ Markdown 导出；
  - Obsidian 本地导出；
  - dmg 打包与自动更新（autoUpdater）。
- **v1.1**：说话人分离、Chat（当前集）；Notion 导出；PDF 导出；
- **v1.2**：历史检索 + Chat（向量索引/FTS）；XMind/OPML；多 Provider；
- **v1.3**：UI 打磨、快捷键自定义、更多格式、性能优化。

---

## 11. 打包与发布

- `electron-builder` 目标：dmg（默认）、pkg（企业分发）；
- Apple 签名与公证（Notarization）；
- 自动更新（Squirrel/MacUpdater 通道）；
- 首启引导：选择数据目录、导入 OPML、是否安装本地 ASR 模型。

---

## 12. 风险与备选

- **ASR 性能/尺寸**：提供“轻量模型 + 后台批处理 + 可中断”方案；
- **说话人分离准确率**：提供手动合并角色；
- **Notion API 限速**：队列/重试；
- **XMind 格式复杂**：先走 OPML/Markdown + 外部转换器；
- **解析兼容性**：对非常规 feed 建立容错（宽松 HTML 解析/编码修复）。

---

## 13. Prompt 模板（示例）

```yaml
- id: summary-v1
  name: 播客要点总结
  category: summary
  template: |
    你是资深播客笔记助手。请根据以下信息生成 8-12 条要点与 3-5 个行动项：
    标题: ${title}
    时间: ${pub_date}
    章节: ${chapters}
    摘要用中文，保留关键专有名词的英文原文。
    参考转写片段（可能不完整）:
    ---
    ${transcript_excerpt}
    ---
    输出 Markdown：含【要点】、【金句】、【行动项】小节。

- id: chapters-v1
  name: 智能分章节
  category: chapters
  template: |
    基于转写，为该集生成带时间戳的章节列表（00:MM:SS），标题简洁有力；并对每章写一句 20-40 字摘要。

- id: mindmap-v1
  name: 思维导图（OPML）
  category: mindmap
  template: |
    将本集核心内容组织为 OPML（UTF-8），根节点为《${title}》；二级节点为主要话题；三级为要点。
```

---

## 14. IPC/服务接口（草案）

```ts
// RSS/库
GET /feeds
POST /feeds { url }
POST /feeds/import-opml
GET /episodes?feedId=&q=
GET /episodes/:id

// 播放状态
POST /player/play { episodeId }
POST /player/seek { positionSec }
POST /player/speed { rate }

// ASR
POST /asr/transcribe { episodeId, engine:"funasr", diarization:true }
GET  /asr/status/:taskId
GET  /asr/result/:episodeId  // srt/vtt/json paths

// AI
POST /ai/run { episodeId, providerId, promptTemplateId, vars }
GET  /ai/tasks?episodeId=

// 导出
POST /export { episodeId, target:"obsidian|notion|markdown|pdf|xmind", options }
```

---

## 15. 快捷键（建议默认）

- Space：播放/暂停
- ←/→：后退/快进 10s（Shift：30s）
- ↑/↓：音量 ±5%
- `[` / `]`：倍速 -/+ 0.1
- `C`：章节面板焦点
- `T`：转写/字幕面板焦点
- `G`：生成 AI 摘要

---

## 16. 开源与依赖清单（初稿）

- Electron, React, Tailwind, Zustand, electron-builder
- rss-parser, node-fetch, music-metadata, sanitize-html
- better-sqlite3, Drizzle ORM, sqlite-fts5
- wavesurfer.js（可选）
- FFmpeg（打包随附/首次下载）
- FunASR（Python，modelscope 依赖）
- Notion SDK（官方）

---

## 17. 日志 & 观测

- app.log（info/error）、asr.log、ai.log；
- 可开启 debug overlay；
- 导出健康状态（版本、磁盘占用、模型大小、AI 额度估算）。

---

## 18. 成功标准（业务角度）

- 日常使用：无需外部服务即可完成"订阅→播放→转写→摘要→本地导出"。
- 70% 以上用户将"AI 摘要"结果直接作为 Obsidian/Notion 笔记；
- 1 小时内多任务（刷新/下载/转写/导出）不造成 UI 卡顿。

---

## 19. 核心播放功能补充需求（Stage 2 增强）

> 基于当前项目进度，本节详细描述核心播放功能的补充需求，确保 EasyPod 具备完整的播客播放器基础能力。

### 19.1 数据持久化集成

**需求背景**

当前项目已完成 SQLite schema 设计和 Drizzle ORM 集成，但前端 UI 尚未与数据库建立完整连接。需要实现数据层与 UI 层的完整打通。

**功能需求**

1. **订阅数据持久化**
   - 订阅源（feeds）增删改查
   - 订阅元数据（封面、描述、最后检查时间）存储
   - OPML 导入时写入数据库
   - 订阅列表从数据库加载

2. **单集数据持久化**
   - Episode 元数据存储（标题、描述、音频 URL、发布日期、时长）
   - Episode 图片优先级：episode-level image > feed-level cover
   - Episode 状态标记（new/in_progress/played/archived）

3. **数据同步机制**
   - RSS 刷新后更新数据库
   - 去重处理（基于 GUID）
   - 增量更新（仅添加新 episodes）

**验收标准**

- 添加订阅后数据库中存在对应 feed 记录
- 刷新订阅后 episodes 表正确填充
- 应用重启后订阅列表从数据库恢复
- Episode GUID 去重正常工作

---

### 19.2 Episode 列表页面

**需求背景**

用户需要一个统一的 Episode 列表页面，查看所有订阅源的最新单集，按发布时间倒序排列。

**功能需求**

1. **All Episodes 视图**
   - 显示所有订阅源的 episodes
   - 按 `pubDate` DESC 排序
   - 每个 episode 卡片包含：
     - Episode 封面图（优先 episodeImageUrl，其次 feed coverUrl）
     - 标题
     - 所属播客名称
     - 发布日期（相对时间：今天/昨天/X天前）
     - 时长
     - 播放状态指示器（未播放/进行中/已完成）
     - 播放进度条（如已开始播放）

2. **交互功能**
   - 点击 episode 卡片 → 进入 Episode 详情页
   - 悬停显示快捷操作：
     - 播放/暂停
     - 添加到播放队列
     - 标记为已播放/未播放

3. **筛选和搜索**
   - 按状态筛选（全部/未播放/进行中/已完成）
   - 搜索框（实时搜索标题和描述）
   - 按订阅源筛选（下拉菜单）

4. **分页加载**
   - 虚拟滚动或分页加载（每页 50 条）
   - 滚动到底部自动加载更多

**UI 布局**

```
┌─────────────────────────────────────────────┐
│ [搜索框]  [状态筛选▾]  [订阅源筛选▾]         │
├─────────────────────────────────────────────┤
│  ┌──────┐  Episode Title                    │
│  │ IMG  │  Podcast Name • 2h ago • 45:32   │
│  │      │  [=========>        ] 65%        │
│  └──────┘  Brief description...             │
├─────────────────────────────────────────────┤
│  ┌──────┐  Another Episode                  │
│  │ IMG  │  Another Podcast • 1d ago • 1:05:12│
│  └──────┘                                    │
└─────────────────────────────────────────────┘
```

**验收标准**

- Episode 列表正确显示所有订阅的单集
- 排序按发布日期降序
- 图片优先级逻辑正确
- 播放状态和进度显示准确
- 搜索和筛选功能响应时间 < 200ms
- 支持至少 1000+ episodes 流畅滚动

---

### 19.3 Episode 详情页面

**需求背景**

当用户点击播放或查看某一集时，需要展示完整的 Episode 信息，包括 show notes、章节、AI 摘要等。

**功能需求**

1. **页面布局（三栏式）**

   **左栏（固定宽度 280px）**
   - Episode 封面图（大图）
   - 播放/暂停按钮
   - 添加到队列按钮
   - 分享按钮
   - 下载按钮

   **中栏（主内容区）**
   - Episode 标题（大字体）
   - 所属播客名称（可点击跳转）
   - 发布日期、时长
   - Show Notes（HTML 渲染，白名单过滤）
     - 支持时间戳链接（00:12:34 格式），点击跳转播放
     - 支持外部链接（新窗口打开）
   - 章节列表（如有）
     - 章节标题
     - 时间戳
     - 点击跳转到对应时间

   **右栏（可选侧边栏，宽度 320px）**
   - Tabs 切换：转写 / AI 摘要
   - **转写 Tab**：
     - 显示字幕内容（按说话人分段）
     - 播放时滚动高亮
     - 点击字幕行跳转音频
   - **AI 摘要 Tab**：
     - 显示 AI 生成的总结
     - 要点、金句、行动项
     - 重新生成按钮

2. **响应式设计**
   - 窗口宽度 < 1024px 时，右栏折叠为抽屉
   - 移动端友好（虽然是 Electron，但为未来 web 版预留）

**交互细节**

- 页面加载时，如果当前正在播放该 episode，显示播放状态
- 点击 Show Notes 中的时间戳 → 跳转播放 + 高亮对应位置
- 章节列表项悬停显示预览图（如有）

**数据来源**

- Episode 基础信息：`episodes` 表
- Show Notes：`episodes.descriptionHtml` 字段
- 章节：`chapters` 表（按 `startMs` 排序）
- 转写：`transcript_segments` 表
- AI 摘要：`ai_tasks` 表（category='summary'）

**验收标准**

- 详情页正确显示 episode 所有信息
- Show Notes HTML 渲染安全（无 XSS）
- 时间戳链接点击后音频正确跳转
- 章节列表点击跳转准确
- 转写字幕与音频同步高亮（误差 ±500ms）
- AI 摘要正确加载和显示

---

### 19.4 音频播放状态持久化

**需求背景**

用户关闭应用或切换 episode 时，需要保存播放进度，下次打开时自动恢复。

**功能需求**

1. **播放进度自动保存**
   - 每 5 秒自动保存当前播放位置到数据库
   - 更新 `episodes.lastPositionSec` 字段
   - 更新 `episodes.lastPlayedAt` 时间戳
   - 节流处理，避免频繁写入

2. **播放状态标记**
   - 播放进度 < 5% → 状态：`new`
   - 5% ≤ 播放进度 < 95% → 状态：`in_progress`
   - 播放进度 ≥ 95% → 状态：`played`
   - 用户手动标记 → 状态：`archived`

3. **播放历史记录**
   - `episodes.lastPlayedAt` 记录最后播放时间
   - "Recently Played" 视图按此字段排序
   - 支持清除播放历史

4. **恢复播放**
   - 点击 episode 时，自动从 `lastPositionSec` 开始播放
   - 提示用户："从 X 分 Y 秒处继续播放" 或 "从头开始"
   - 播放完成后询问："标记为已完成？"

**数据库操作**

```ts
// 保存播放进度
await db.update(episodes)
  .set({
    lastPositionSec: currentPosition,
    lastPlayedAt: new Date().toISOString(),
    status: calculateStatus(currentPosition, duration),
  })
  .where(eq(episodes.id, episodeId));
```

**验收标准**

- 播放 5 分钟后关闭应用，重新打开该 episode 从断点恢复
- 播放状态标记准确（new/in_progress/played）
- Recently Played 列表按播放时间倒序显示
- 播放进度保存延迟 < 10 秒

---

### 19.5 全局播放设置持久化

**需求背景**

用户的播放偏好（倍速、跳转秒数等）应持久化保存，重启应用后恢复。

**功能需求**

1. **倍速设置**
   - 支持范围：0.5x ~ 2.0x
   - 步进：0.1x
   - 默认：1.0x
   - 保存到 `settings` 表：`key='playback_rate'`

2. **跳转秒数设置**
   - 快进秒数：默认 10s（可设置 5/10/15/30s）
   - 快退秒数：默认 10s（可设置 5/10/15/30s）
   - 保存到 `settings` 表

3. **音量设置**
   - 保存用户上次设置的音量（0-100）
   - 静音状态不保存

4. **自动播放下一集**
   - 开关选项（默认关闭）
   - 当前 episode 播放完成后自动播放队列下一集

5. **设置界面**
   - 设置面板（通过菜单栏或快捷键打开）
   - 分类：播放设置 / 快捷键 / 存储 / 关于

**数据库设计**

```ts
// settings 表示例
{
  key: 'playback_rate',
  value: '1.5',
  type: 'number',
  description: '默认播放倍速'
}
{
  key: 'skip_forward_seconds',
  value: '10',
  type: 'number',
  description: '快进秒数'
}
```

**验收标准**

- 设置倍速为 1.5x，重启应用后播放器默认 1.5x
- 修改跳转秒数后，快进/快退按钮按新设置执行
- 音量设置在重启后恢复
- 设置界面 UI 清晰易用

---

### 19.6 播放队列功能

**需求背景**

用户需要管理待播放的 episodes 队列，支持添加、删除、重排序。

**功能需求**

1. **队列数据结构**
   - 队列存储在 `playerStore` 状态中（内存）
   - 可选：持久化到数据库（`play_queue` 表）
   - 队列项包含：episodeId、position（顺序）

2. **队列操作**
   - **添加到队列头部**：优先播放
   - **添加到队列尾部**：排队播放
   - **从队列移除**：点击删除按钮
   - **拖动排序**：支持拖拽调整播放顺序
   - **清空队列**：一键清空

3. **队列 UI**
   - 播放栏旁边的"队列"按钮（显示队列数量徽章）
   - 点击展开队列侧边栏（右侧滑出）
   - 队列项显示：
     - Episode 缩略图
     - 标题
     - 时长
     - 拖拽手柄
     - 删除按钮
   - 当前播放的 episode 高亮显示

4. **队列播放逻辑**
   - 当前 episode 播放完成 → 自动播放队列下一个
   - 点击队列中的 episode → 立即切换播放
   - 队列为空时，播放完成后停止

5. **快捷操作**
   - Episode 列表中右键菜单：
     - 添加到队列头部
     - 添加到队列尾部
     - 立即播放（清空队列并添加）

**拖拽实现**

- 使用 `react-beautiful-dnd` 或 HTML5 Drag & Drop API
- 拖拽时显示占位符
- 拖拽结束后更新队列顺序

**数据持久化（可选）**

```ts
// play_queue 表（可选设计）
{
  id: number;
  episodeId: number;
  position: number; // 队列位置
  addedAt: string;
}
```

**验收标准**

- 添加 5 个 episodes 到队列，顺序正确显示
- 拖动调整顺序后，播放顺序符合预期
- 当前播放 episode 播放完成后自动播放下一个
- 队列持久化（重启应用后队列恢复）
- 队列 UI 流畅，拖拽无卡顿

---

### 19.7 附加功能点

**媒体键支持**

- 监听系统媒体键事件（播放/暂停、下一曲、上一曲）
- macOS Touch Bar 集成（显示播放控制、进度条）

**通知中心集成**

- 播放时显示通知（标题、封面、播放/暂停按钮）
- macOS：使用 Notification Center
- 点击通知 → 激活应用窗口

**快捷键增强**

- 已有基础快捷键（Space、←/→、↑/↓）
- 新增：
  - `Q`：打开/关闭队列面板
  - `L`：跳转到当前播放 episode 的详情页
  - `M`：标记当前 episode 为已播放
  - `Cmd/Ctrl + Shift + N`：下一集

---

### 19.8 技术实现要点

**状态管理优化**

- 使用 Zustand 的 `persist` middleware 持久化关键状态
- 播放状态同步到主进程（用于媒体键控制）

**IPC 通信扩展**

```ts
// 新增 IPC handlers
ipcMain.handle('episodes:getAll', async (_, { feedId, status }) => {
  return await episodesDao.getAll({ feedId, status });
});

ipcMain.handle('episodes:updateProgress', async (_, { id, position, status }) => {
  return await episodesDao.updateProgress(id, position, status);
});

ipcMain.handle('settings:get', async (_, key) => {
  return await settingsDao.get(key);
});

ipcMain.handle('settings:set', async (_, { key, value, type }) => {
  return await settingsDao.set(key, value, type);
});

ipcMain.handle('queue:getAll', async () => {
  return await queueDao.getAll();
});

ipcMain.handle('queue:add', async (_, { episodeId, position }) => {
  return await queueDao.add(episodeId, position);
});

ipcMain.handle('queue:reorder', async (_, items) => {
  return await queueDao.reorder(items);
});
```

**数据库访问层（DAO）**

- 创建 `episodesDao.ts`
- 创建 `settingsDao.ts`
- 创建 `queueDao.ts`（如需持久化队列）

**性能优化**

- Episode 列表虚拟滚动（使用 `react-window` 或 `react-virtuoso`）
- 图片懒加载和缓存
- 数据库查询优化（索引：feedId、pubDate、status）

---

### 19.9 验收标准总结

本节功能完成后，EasyPod 应具备以下核心能力：

1. ✅ 完整的订阅和 episode 数据持久化
2. ✅ 功能完善的 Episode 列表页面
3. ✅ 信息丰富的 Episode 详情页面
4. ✅ 播放进度和状态自动保存
5. ✅ 全局播放设置持久化
6. ✅ 灵活的播放队列管理
7. ✅ 媒体键和快捷键支持
8. ✅ 流畅的用户体验（响应时间 < 200ms，滚动 60fps）

**用户旅程验证**

1. 用户添加订阅 → 订阅列表显示 → Episode 列表自动填充
2. 用户点击 episode → 进入详情页 → 点击播放
3. 播放器显示封面、标题、进度条 → 用户调整倍速为 1.5x
4. 用户添加 3 个 episodes 到播放队列
5. 用户拖动调整队列顺序
6. 当前 episode 播放完成 → 自动播放队列下一个
7. 用户关闭应用 → 重新打开 → 播放进度和队列恢复
8. 用户调整倍速设置为 2.0x → 重启应用 → 默认倍速为 2.0x

---

## 20. 后续迭代路线图

基于本次补充需求完成后，后续开发优先级如下：

**P0（必须）- MVP 完成**
- [x] 订阅和 Episode 数据持久化
- [x] Episode 列表和详情页面
- [x] 播放状态和设置持久化
- [x] 播放队列功能
- [ ] 章节跳转和 Show Notes 时间戳链接

**P1（重要）- 增强版**
- [ ] 离线下载功能
- [ ] 转写功能（FunASR 集成）
- [ ] AI 摘要（基础）
- [ ] Markdown 导出

**P2（期望）- 完整版**
- [ ] 说话人分离
- [ ] 多 AI Provider 支持
- [ ] Obsidian/Notion 导出
- [ ] 历史检索和 Chat

**P3（增值）- 高级版**
- [ ] 心智图生成
- [ ] PDF 导出
- [ ] 插件系统
- [ ] 自定义主题
