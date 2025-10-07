# Task Stage 1.1: 数据库表结构设计与实现

## 任务概述

为音频转写字幕功能设计并实现数据库表结构，支持 FunASR 和阿里云两种转写服务的数据存储需求。

## 技术设计

### 新增表结构

#### 1. episode_voice_text_tasks (转写任务表)

存储转写任务的状态和产出数据。

```sql
CREATE TABLE IF NOT EXISTS episode_voice_text_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    task_id TEXT NOT NULL,
    output TEXT NOT NULL,           -- 任务的产出数据 JSON
    service TEXT NOT NULL,          -- 转写服务: funasr, aliyun
    status TEXT NOT NULL DEFAULT 'processing', -- processing / success / failed
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_voice_text_tasks_episode ON episode_voice_text_tasks(episode_id);
CREATE INDEX idx_voice_text_tasks_status ON episode_voice_text_tasks(status);
```

**字段说明：**
- `task_id`: 任务唯一标识（FunASR 自生成，阿里云 API 返回）
- `output`: JSON 格式，存储任务结果或错误信息
- `service`: 枚举值 'funasr' | 'aliyun'
- `status`: 枚举值 'processing' | 'success' | 'failed'

#### 2. episode_voice_texts (原始转写数据表)

存储转写服务返回的原始 JSON 数据，方便复用和调试。

```sql
CREATE TABLE IF NOT EXISTS episode_voice_texts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    raw_json TEXT NOT NULL,         -- 原始 JSON 数据
    service TEXT NOT NULL,          -- 转写服务: funasr, aliyun
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_voice_texts_episode_service ON episode_voice_texts(episode_id, service);
```

**字段说明：**
- `raw_json`: 存储完整的服务返回数据
- 唯一索引确保每个 episode 的每种 service 只有一条记录

#### 3. episode_transcripts (转写文本表)

存储处理后的转写文本和字幕数据。

```sql
CREATE TABLE IF NOT EXISTS episode_transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    subtitles TEXT NOT NULL,        -- JSON 格式的字幕内容（sentence_info 数组）
    text TEXT NOT NULL,             -- 纯文本内容
    speaker_number INTEGER NOT NULL DEFAULT 1, -- 发言人数量
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_transcripts_episode ON episode_transcripts(episode_id);
```

**字段说明：**
- `subtitles`: JSON 数组，格式为统一的 sentence_info 结构
- `text`: 完整的文字稿
- `speaker_number`: 发言人数量（从 spk/speaker_id 计算得出）

#### 4. episode_ai_summarys (AI 分析结果表)

存储基于转写文本的 AI 分析结果。

```sql
CREATE TABLE IF NOT EXISTS episode_ai_summarys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    summary TEXT NOT NULL DEFAULT '',   -- AI 总结内容
    tags TEXT NOT NULL DEFAULT '',      -- 按英文逗号分割的标签
    chapters TEXT NOT NULL DEFAULT '[]', -- JSON 格式的章节展示
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_ai_summarys_episode ON episode_ai_summarys(episode_id);
```

### 数据结构定义

#### sentence_info 统一格式

```typescript
interface SentenceInfo {
  text: string;           // 句子内容
  start: number;          // 开始时间（毫秒）
  end: number;            // 结束时间（毫秒）
  timestamp: number[][];  // [[start, end], ...] 词级别时间戳
  spk: number;            // 发言人编号（0, 1, 2...）
}
```

## 实现细节

### 1. Drizzle ORM Schema 定义

在 `src/main/database/schema.ts` 中添加新表定义：

```typescript
export const episodeVoiceTextTasks = sqliteTable('episode_voice_text_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  output: text('output').notNull(),
  service: text('service', { enum: ['funasr', 'aliyun'] }).notNull(),
  status: text('status', { enum: ['processing', 'success', 'failed'] }).notNull().default('processing'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const episodeVoiceTexts = sqliteTable('episode_voice_texts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  rawJson: text('raw_json').notNull(),
  service: text('service', { enum: ['funasr', 'aliyun'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueEpisodeService: unique().on(table.episodeId, table.service),
}));

export const episodeTranscripts = sqliteTable('episode_transcripts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: cascade' }),
  subtitles: text('subtitles').notNull(),
  text: text('text').notNull(),
  speakerNumber: integer('speaker_number').notNull().default(1),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueEpisode: unique().on(table.episodeId),
}));

export const episodeAiSummarys = sqliteTable('episode_ai_summarys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull().default(''),
  tags: text('tags').notNull().default(''),
  chapters: text('chapters').notNull().default('[]'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueEpisode: unique().on(table.episodeId),
}));
```

### 2. TypeScript 类型定义

在 `src/main/types/transcript.ts` 中定义类型：

```typescript
export type TranscriptService = 'funasr' | 'aliyun';
export type TaskStatus = 'processing' | 'success' | 'failed';

export interface SentenceInfo {
  text: string;
  start: number;
  end: number;
  timestamp: number[][];
  spk: number;
}

export interface VoiceTextTask {
  id: number;
  episodeId: number;
  taskId: string;
  output: string;
  service: TranscriptService;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceText {
  id: number;
  episodeId: number;
  rawJson: string;
  service: TranscriptService;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeTranscript {
  id: number;
  episodeId: number;
  subtitles: string; // JSON.stringify(SentenceInfo[])
  text: string;
  speakerNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeAiSummary {
  id: number;
  episodeId: number;
  summary: string;
  tags: string; // comma-separated
  chapters: string; // JSON.stringify(Chapter[])
  createdAt: string;
  updatedAt: string;
}
```

### 3. 数据库迁移

在 `src/main/main.ts` 的数据库初始化部分添加表创建逻辑：

```typescript
async function initializeDatabase() {
  const dbManager = getDatabaseManager();
  const db = dbManager.getDrizzle();

  // 运行迁移以创建新表
  await db.run(sql`
    -- 创建 episode_voice_text_tasks 表
    CREATE TABLE IF NOT EXISTS episode_voice_text_tasks (...)
  `);

  // ... 创建其他表
}
```

## 依赖关系

- **前置依赖**:
  - 现有 episodes 表结构
  - Drizzle ORM 配置

- **后置依赖**:
  - Task 1.2: VoiceToText 接口设计
  - Task 1.5: 数据转换处理逻辑

## 验收标准

- [ ] 所有表结构在 schema.ts 中正确定义
- [ ] 表创建 SQL 可正确执行
- [ ] 外键关联正确配置（级联删除）
- [ ] 索引创建正确（查询优化）
- [ ] TypeScript 类型定义完整
- [ ] 数据库迁移可成功运行
- [ ] 使用 `npm run type-check` 无类型错误

## 风险和注意事项

### 风险

1. **数据迁移风险**: 现有用户升级时需要创建新表
2. **存储空间**: raw_json 字段可能较大（长音频）
3. **数据一致性**: episode 删除时需要级联删除相关数据

### 注意事项

1. **JSON 存储**: subtitles、chapters 等字段存储为 JSON 字符串，需要序列化/反序列化
2. **时间戳格式**: 统一使用毫秒作为时间单位
3. **服务枚举**: service 字段使用枚举类型限制值
4. **唯一约束**: episode_voice_texts 和 episode_transcripts 使用 (episode_id, service) 和 episode_id 的唯一约束

## 实施步骤

1. 在 `schema.ts` 中定义表结构
2. 创建 TypeScript 类型定义文件
3. 编写数据库迁移脚本
4. 在 main.ts 中集成迁移逻辑
5. 运行应用验证表创建成功
6. 编写单元测试验证表结构

## 估时

- 设计: 0.5 天
- 实现: 1 天
- 测试: 0.5 天
- **总计**: 2 天
