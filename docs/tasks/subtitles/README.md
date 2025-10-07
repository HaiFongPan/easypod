# 音频转写字幕功能任务清单

## 项目概述

本项目实现音频转写字幕功能，支持本地 FunASR 和阿里云 API 两种转写服务，并基于转写结果提供 AI 总结、标签生成和章节分析功能。

## 任务总览

### Stage 1: 转写功能核心实现

| 任务编号 | 任务名称 | 估时 | 状态 | 依赖 |
|---------|---------|------|------|------|
| 1.0 | 转写服务配置管理 | 5.5天 | ⏳ | - |
| 1.1 | 数据库表结构设计与实现 | 2天 | ⏳ | - |
| 1.2 | VoiceToText 接口抽象设计 | 4天 | ⏳ | 1.1 |
| 1.3 | FunASR 服务集成 | 5天 | ⏳ | 1.0, 1.1, 1.2 |
| 1.4 | 阿里云转写服务实现 | 6天 | ⏳ | 1.0, 1.1, 1.2 |
| 1.5 | 数据转换和处理逻辑 | 6天 | ⏳ | 1.1-1.4 |
| 1.6 | IPC 通信接口实现 | 5天 | ⏳ | 1.1-1.5 |
| 1.7 | UI 集成和展示 | 9天 | ⏳ | 1.1-1.6 |

**Stage 1 总计**: 42.5 天

### Stage 2: AI 功能实现

| 任务编号 | 任务名称 | 估时 | 状态 | 依赖 |
|---------|---------|------|------|------|
| 2.1 | AI 总结功能实现 | 9天 | ⏳ | 1.1, Stage 1 |
| 2.2 | AI 标签生成功能 | 8天 | ⏳ | 1.1, 2.1 |
| 2.3 | AI 章节分析功能 | 10天 | ⏳ | 1.1, 1.5, 2.1 |

**Stage 2 总计**: 27 天

**项目总计**: 69.5 天（约 14 周）

## 任务详情

### Stage 1: 转写功能核心实现

#### [Task 1.0: 转写服务配置管理](./task_stage_1_0_settings.md)

**核心内容**:
- 实现 `TranscriptConfigManager` 配置管理器
- 支持 FunASR 模型配置（model, vad_model, punc_model, spk_model）
- 支持阿里云 API 配置（API Key, URL）
- 配置加密存储和验证
- 实现配置导入/导出功能

**关键产出**:
- TranscriptConfigManager 配置管理器
- TranscriptConfigIPCHandlers IPC 接口
- UI 设置面板（FunASR、阿里云、通用设置）
- 配置验证和测试功能

---

#### [Task 1.1: 数据库表结构设计与实现](./task_stage_1_1_database_schema.md)

**核心内容**:
- 设计 4 张新表: `episode_voice_text_tasks`, `episode_voice_texts`, `episode_transcripts`, `episode_ai_summarys`
- 使用 Drizzle ORM 定义 schema
- 实现数据库迁移逻辑

**关键产出**:
- 完整的表结构 SQL
- Drizzle Schema 定义
- TypeScript 类型定义

---

#### [Task 1.2: VoiceToText 接口抽象设计](./task_stage_1_2_voice_to_text_interface.md)

**核心内容**:
- 定义 `VoiceToTextService` 统一接口
- 实现 `BaseVoiceToTextService` 抽象类
- 实现 `VoiceToTextFactory` 工厂类
- 设计 `TranscriptConverter` 数据转换接口

**关键产出**:
- VoiceToTextService 接口
- BaseVoiceToTextService 基类
- VoiceToTextFactory 工厂
- TranscriptConverter 转换器

---

#### [Task 1.3: FunASR 服务集成](./task_stage_1_3_funasr_service.md)

**核心内容**:
- 实现 `FunasrService` 适配器类
- 实现 `FunasrConverter` 数据转换器
- 集成现有的 FunASRManager（FastAPI 服务）
- 实现模型初始化和状态跟踪

**关键产出**:
- FunasrService 适配器实现
- FunasrConverter 转换器
- 与 FunASRManager 的集成
- HTTP API 调用封装

---

#### [Task 1.4: 阿里云转写服务实现](./task_stage_1_4_aliyun_service.md)

**核心内容**:
- 实现 `AliyunService` 类
- 实现 `AliyunConverter` 数据转换器
- 实现配置管理 `TranscriptConfigManager`
- 处理异步任务查询和结果下载

**关键产出**:
- AliyunService 完整实现
- AliyunConverter 转换器
- TranscriptConfigManager 配置管理
- API 调用封装

---

#### [Task 1.5: 数据转换和处理逻辑](./task_stage_1_5_data_processing.md)

**核心内容**:
- 实现 `SubtitleUtils` 字幕工具类
- 实现 `TextUtils` 文本处理工具类
- 实现 `TranscriptProcessor` 处理服务
- 支持多种字幕格式导出 (SRT, VTT, LRC, TXT, JSON)

**关键产出**:
- SubtitleUtils 工具类
- TextUtils 工具类
- TranscriptProcessor 处理器
- 多格式导出功能

---

#### [Task 1.6: IPC 通信接口实现](./task_stage_1_6_ipc_handlers.md)

**核心内容**:
- 实现 `TranscriptIPCHandlers` 类
- 更新 preload.ts 暴露 API
- 定义完整的 TypeScript 类型
- 实现任务管理、字幕获取、导出等功能

**关键产出**:
- TranscriptIPCHandlers 完整实现
- Preload API 定义
- TypeScript 类型定义
- IPC 通信接口

---

#### [Task 1.7: UI 集成和展示](./task_stage_1_7_ui_integration.md)

**核心内容**:
- 实现 `transcriptStore` Zustand store
- 实现 `TranscriptTaskPanel` 任务管理面板
- 实现 `TranscriptViewer` 字幕查看器
- 实现 `TranscriptSettings` 配置设置

**关键产出**:
- transcriptStore 状态管理
- 完整的 UI 组件
- 样式和交互逻辑
- 与播放器集成

---

### Stage 2: AI 功能实现

#### [Task 2.1: AI 总结功能实现](./task_stage_2_1_ai_summary.md)

**核心内容**:
- 定义 `AIProvider` 抽象接口
- 实现 `OpenAIProvider` 服务
- 实现 `SummaryService` 总结服务
- 支持三种总结类型 (一句话、简短、详细)

**关键产出**:
- AIProvider 接口
- OpenAIProvider 实现
- SummaryService 服务
- AI 总结 UI 组件

---

#### [Task 2.2: AI 标签生成功能](./task_stage_2_2_ai_tags.md)

**核心内容**:
- 实现 `TagService` 标签服务
- 支持自动生成、优化、相关标签推荐
- 实现标签过滤和搜索功能
- 实现标签管理 UI

**关键产出**:
- TagService 服务
- 标签生成和优化逻辑
- TagPanel UI 组件
- 标签过滤功能

---

#### [Task 2.3: AI 章节分析功能](./task_stage_2_3_ai_chapters.md)

**核心内容**:
- 实现 `ChapterService` 章节服务
- 实现长文本分段分析
- 实现章节合并和优化
- 实现章节导航和跳转 UI

**关键产出**:
- ChapterService 服务
- 章节分析和生成逻辑
- ChapterPanel UI 组件
- 播放器章节集成

---

## 技术栈

### 后端（Main Process）
- **语言**: TypeScript
- **数据库**: SQLite + Drizzle ORM
- **转写服务**:
  - FunASR (Python Runtime)
  - 阿里云 DashScope API
- **AI 服务**: OpenAI-compatible API

### 前端（Renderer Process）
- **框架**: React + TypeScript
- **状态管理**: Zustand
- **UI 组件**: 自定义组件库
- **样式**: CSS Modules

### 进程通信
- **IPC**: Electron IpcMain/IpcRenderer
- **Preload**: contextBridge

## 关键依赖

### 外部服务
- Python 3.10+ (FunASR 运行环境)
- 阿里云 DashScope API Key
- OpenAI-compatible API Key

### 数据流转

```
音频文件
    ↓
转写服务 (FunASR / 阿里云)
    ↓
原始数据 (episode_voice_texts)
    ↓
数据转换 (Converter)
    ↓
标准格式 (episode_transcripts)
    ↓
AI 分析
    ├── 总结 (episode_ai_summarys.summary)
    ├── 标签 (episode_ai_summarys.tags)
    └── 章节 (episode_ai_summarys.chapters)
    ↓
UI 展示
```

## 风险评估

### 高风险项
1. **FunASR Python Runtime 集成**: 需要确保 Python 环境正确配置
2. **长文本处理**: 超长播客可能超过 API 限制
3. **AI 成本控制**: OpenAI API 费用需要考虑

### 中风险项
1. **异步任务管理**: FunASR 异步任务需要自行实现
2. **数据一致性**: 多表关联和级联删除
3. **UI 性能**: 大量字幕数据的渲染优化

### 低风险项
1. **阿里云 API 集成**: API 相对稳定
2. **数据库设计**: 表结构相对简单
3. **IPC 通信**: 现有架构已有成熟方案

## 开发建议

### 开发顺序
1. **先做 Stage 1.1-1.2**: 打好基础（数据库 + 接口设计）
2. **并行 1.3 和 1.4**: FunASR 和阿里云可以并行开发
3. **串行 1.5-1.7**: 数据处理 → IPC → UI
4. **Stage 2 可灵活安排**: AI 功能可以逐个实现

### 测试策略
- **单元测试**: 每个 Service 和 Converter 都需要单元测试
- **集成测试**: 端到端的转写流程测试
- **UI 测试**: 组件功能和交互测试
- **性能测试**: 长文本和大量字幕的性能测试

### 文档要求
- API 文档: IPC 接口完整文档
- 用户文档: 配置和使用说明
- 开发文档: 架构和实现细节

## 里程碑

### Milestone 1: 基础功能 (Week 1-2)
- ✅ 配置管理完成
- ✅ 数据库设计完成
- ✅ 接口抽象完成
- ✅ 基础架构搭建

### Milestone 2: 转写服务 (Week 3-6)
- ✅ FunASR 服务集成
- ✅ 阿里云服务实现
- ✅ 数据处理完成

### Milestone 3: UI 集成 (Week 7-9)
- ✅ IPC 接口完成
- ✅ UI 组件实现
- ✅ 端到端测试通过

### Milestone 4: AI 功能 (Week 10-14)
- ✅ AI 总结实现
- ✅ 标签生成实现
- ✅ 章节分析实现
- ✅ 完整功能测试

## 验收标准

### Stage 1 验收
- [ ] 用户可以提交转写任务（FunASR 和阿里云）
- [ ] 用户可以查看任务状态和进度
- [ ] 用户可以查看和导出字幕（多种格式）
- [ ] 字幕与播放器时间轴同步
- [ ] 配置管理功能正常

### Stage 2 验收
- [ ] 用户可以生成 AI 总结（三种类型）
- [ ] 用户可以生成和管理标签
- [ ] 用户可以生成和导航章节
- [ ] 标签可用于过滤和搜索
- [ ] 章节可点击跳转播放

## 附录

### 相关文档
- [需求文档](../sub.md)
- [技术设计](../prd.md)
- [Python Runtime 文档](../python-runtime-build.md)

### 参考资料
- [FunASR 文档](https://github.com/alibaba-damo-academy/FunASR)
- [阿里云语音识别 API](https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
