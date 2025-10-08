# LLM Provider 集成和 AI Interface 构建实施计划

## 项目概述

基于现有的 EasyPod 项目架构，实现 LLM Provider 管理、AI 总结功能和相关 UI 配置界面。

---

## 现状分析

### 已有基础设施

- ✅ 数据库：SQLite + Drizzle ORM
- ✅ IPC 通信：Electron IPC + preload 桥接
- ✅ 转写数据：`episodeTranscripts` 表（包含 subtitles 和 text）
- ✅ UI 框架：React + TypeScript + Tailwind CSS
- ✅ 设置页面：已有 TranscriptSettings 组件结构

### 现有 AI 相关表（需要调整）

```typescript
// 当前 schema.ts 中的表
aiPrompts; // category 应改为 type，templateText 应改为 prompt
aiTasks; // 暂时保留不用
aiProviders; // 缺少 isDefault 和 tokenUsage，一个 provider 只能一个 model
episodeAiSummarys; // 缺少 providerId/modelId/tokenUsage 字段
```

### 需求文档建议

参考 `docs/tasks/ai_summary.md`：

- Provider/Models 分表设计（更灵活）
- Prompt 按 type 分类（system/summary/tag/chapters/mindmap）
- Token usage 统计（provider 级别 + model 级别）
- 支持 OpenAI Compatible API

---

## 实施计划

### Phase 1: 数据库表结构设计与实现（2-3 小时）

#### 1.1 新建表结构（推荐方案）

**优势：**

- 表名清晰（llm_providers/llm_models/prompts）
- 避免与现有表冲突
- 符合需求文档设计
- 便于未来扩展

**新增表：**

```typescript
// src/main/database/schema.ts

// LLM Providers 表 - LLM 服务商配置
export const llmProviders = sqliteTable("llm_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // Provider 名称，如 "OpenAI"
  baseUrl: text("base_url").notNull(), // API 基础 URL
  apiKey: text("api_key"), // API Key（需加密存储）
  headersJson: text("headers_json"), // 自定义 HTTP Headers（JSON）
  timeout: integer("timeout").default(30000), // 请求超时时间（毫秒）
  tokenUsage: integer("token_usage").default(0), // Provider 总 token 使用量
  isDefault: integer("is_default", { mode: "boolean" }).default(false), // 是否默认 Provider
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// LLM Models 表 - 模型配置（一个 Provider 可以有多个模型）
export const llmModels = sqliteTable("llm_models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id")
    .notNull()
    .references(() => llmProviders.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // 显示名称，如 "GPT-4o"
  code: text("code").notNull(), // API 调用代码，如 "gpt-4o"
  tokenUsage: integer("token_usage").default(0), // 该模型的 token 使用量
  isDefault: integer("is_default", { mode: "boolean" }).default(false), // 是否为该 Provider 的默认模型
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Prompts 表 - Prompt 模板
export const prompts = sqliteTable("prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"), // Prompt 名称（可选）
  type: text("type").notNull(), // 'system' | 'summary' | 'tag' | 'chapters' | 'mindmap'
  prompt: text("prompt").notNull(), // Prompt 内容
  isBuiltin: integer("is_builtin", { mode: "boolean" }).default(false), // 是否内置 Prompt
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Episode AI Summaries 表 - 修改现有表，增加字段
export const episodeAiSummarys = sqliteTable("episode_ai_summarys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  episodeId: integer("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  providerId: integer("provider_id").references(() => llmProviders.id), // 新增
  modelId: integer("model_id").references(() => llmModels.id), // 新增
  summary: text("summary").notNull().default(""),
  tags: text("tags").notNull().default(""), // 逗号分隔的标签
  chapters: text("chapters").notNull().default("[]"), // JSON 数组格式的章节
  tokenUsage: integer("token_usage").default(0), // 新增：本次生成使用的 token 数
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
```

#### 1.2 导出 TypeScript 类型

```typescript
// src/main/database/schema.ts 底部追加

export type LlmProvider = typeof llmProviders.$inferSelect;
export type NewLlmProvider = typeof llmProviders.$inferInsert;

export type LlmModel = typeof llmModels.$inferSelect;
export type NewLlmModel = typeof llmModels.$inferInsert;

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

// EpisodeAiSummary 类型已存在，无需重复导出
```

#### 1.3 数据库初始化

在 `src/main/main.ts` 的数据库初始化部分，确保新表被创建。

**内置默认数据：**

```typescript
// 默认 Provider 示例
{
  name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  isDefault: true
}

// 默认 Model 示例
{
  providerId: 1,
  name: "GPT-4o",
  code: "gpt-4o",
  isDefault: true
}

// 内置 Prompts
{
  type: "system",
  prompt: "你是一个专业的播客内容分析助手。",
  isBuiltin: true
}
{
  type: "summary",
  prompt: "请总结以下播客内容的核心观点、金句和行动建议。",
  isBuiltin: true
}
{
  type: "tag",
  prompt: "请为以下播客内容生成 5-10 个相关标签。",
  isBuiltin: true
}
{
  type: "chapters",
  prompt: "请分析以下播客内容，将其分为若干章节，每个章节包含开始时间、结束时间和总结。",
  isBuiltin: true
}
{
  type: "mindmap",
  prompt: "请将以下播客内容整理为 Markdown 格式的思维导图。",
  isBuiltin: true
}
```

---

### Phase 2: DAO 层实现（2-3 小时）

#### 2.1 创建 DAO 文件

```typescript
// src/main/database/dao/llmProvidersDao.ts

import { eq, desc } from "drizzle-orm";
import { getDatabaseManager } from "../connection";
import { llmProviders, type LlmProvider, type NewLlmProvider } from "../schema";

export class LlmProvidersDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  // Create
  async create(data: NewLlmProvider): Promise<LlmProvider> {
    const result = await this.db
      .insert(llmProviders)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  // Read
  async findAll(): Promise<LlmProvider[]> {
    return await this.db
      .select()
      .from(llmProviders)
      .orderBy(desc(llmProviders.createdAt));
  }

  async findById(id: number): Promise<LlmProvider | null> {
    const result = await this.db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findDefault(): Promise<LlmProvider | null> {
    const result = await this.db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.isDefault, true))
      .limit(1);
    return result[0] || null;
  }

  // Update
  async update(
    id: number,
    data: Partial<NewLlmProvider>,
  ): Promise<LlmProvider | null> {
    const result = await this.db
      .update(llmProviders)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmProviders.id, id))
      .returning();
    return result[0] || null;
  }

  async setDefault(id: number): Promise<void> {
    // 先清除所有默认标记
    await this.db.update(llmProviders).set({ isDefault: false });

    // 设置新的默认
    await this.db
      .update(llmProviders)
      .set({ isDefault: true })
      .where(eq(llmProviders.id, id));
  }

  async incrementTokenUsage(id: number, tokens: number): Promise<void> {
    await this.db
      .update(llmProviders)
      .set({
        tokenUsage: sql`${llmProviders.tokenUsage} + ${tokens}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmProviders.id, id));
  }

  // Delete
  async delete(id: number): Promise<void> {
    await this.db.delete(llmProviders).where(eq(llmProviders.id, id));
  }
}
```

```typescript
// src/main/database/dao/llmModelsDao.ts

import { eq, desc, and } from "drizzle-orm";
import { getDatabaseManager } from "../connection";
import { llmModels, type LlmModel, type NewLlmModel } from "../schema";

export class LlmModelsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  async create(data: NewLlmModel): Promise<LlmModel> {
    const result = await this.db
      .insert(llmModels)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  async findAll(): Promise<LlmModel[]> {
    return await this.db
      .select()
      .from(llmModels)
      .orderBy(desc(llmModels.createdAt));
  }

  async findByProvider(providerId: number): Promise<LlmModel[]> {
    return await this.db
      .select()
      .from(llmModels)
      .where(eq(llmModels.providerId, providerId))
      .orderBy(desc(llmModels.createdAt));
  }

  async findById(id: number): Promise<LlmModel | null> {
    const result = await this.db
      .select()
      .from(llmModels)
      .where(eq(llmModels.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findDefault(providerId: number): Promise<LlmModel | null> {
    const result = await this.db
      .select()
      .from(llmModels)
      .where(
        and(
          eq(llmModels.providerId, providerId),
          eq(llmModels.isDefault, true),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  async update(
    id: number,
    data: Partial<NewLlmModel>,
  ): Promise<LlmModel | null> {
    const result = await this.db
      .update(llmModels)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmModels.id, id))
      .returning();
    return result[0] || null;
  }

  async setDefault(providerId: number, modelId: number): Promise<void> {
    // 清除该 Provider 下所有模型的默认标记
    await this.db
      .update(llmModels)
      .set({ isDefault: false })
      .where(eq(llmModels.providerId, providerId));

    // 设置新默认
    await this.db
      .update(llmModels)
      .set({ isDefault: true })
      .where(eq(llmModels.id, modelId));
  }

  async incrementTokenUsage(id: number, tokens: number): Promise<void> {
    await this.db
      .update(llmModels)
      .set({
        tokenUsage: sql`${llmModels.tokenUsage} + ${tokens}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmModels.id, id));
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(llmModels).where(eq(llmModels.id, id));
  }
}
```

```typescript
// src/main/database/dao/promptsDao.ts

import { eq, desc } from "drizzle-orm";
import { getDatabaseManager } from "../connection";
import { prompts, type Prompt, type NewPrompt } from "../schema";

export class PromptsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  async create(data: NewPrompt): Promise<Prompt> {
    const result = await this.db
      .insert(prompts)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  async findAll(): Promise<Prompt[]> {
    return await this.db
      .select()
      .from(prompts)
      .orderBy(desc(prompts.createdAt));
  }

  async findByType(type: string): Promise<Prompt[]> {
    return await this.db.select().from(prompts).where(eq(prompts.type, type));
  }

  async findBuiltins(): Promise<Prompt[]> {
    return await this.db
      .select()
      .from(prompts)
      .where(eq(prompts.isBuiltin, true));
  }

  async findById(id: number): Promise<Prompt | null> {
    const result = await this.db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1);
    return result[0] || null;
  }

  async update(id: number, data: Partial<NewPrompt>): Promise<Prompt | null> {
    const result = await this.db
      .update(prompts)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(prompts.id, id))
      .returning();
    return result[0] || null;
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(prompts).where(eq(prompts.id, id));
  }
}
```

```typescript
// src/main/database/dao/episodeAiSummarysDao.ts

import { eq, desc } from "drizzle-orm";
import { getDatabaseManager } from "../connection";
import {
  episodeAiSummarys,
  type EpisodeAiSummary,
  type NewEpisodeAiSummary,
} from "../schema";

export class EpisodeAiSummarysDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  async create(data: NewEpisodeAiSummary): Promise<EpisodeAiSummary> {
    const result = await this.db
      .insert(episodeAiSummarys)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  async findByEpisode(episodeId: number): Promise<EpisodeAiSummary | null> {
    const result = await this.db
      .select()
      .from(episodeAiSummarys)
      .where(eq(episodeAiSummarys.episodeId, episodeId))
      .limit(1);
    return result[0] || null;
  }

  async update(
    episodeId: number,
    data: Partial<NewEpisodeAiSummary>,
  ): Promise<EpisodeAiSummary | null> {
    const result = await this.db
      .update(episodeAiSummarys)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(episodeAiSummarys.episodeId, episodeId))
      .returning();
    return result[0] || null;
  }

  async delete(episodeId: number): Promise<void> {
    await this.db
      .delete(episodeAiSummarys)
      .where(eq(episodeAiSummarys.episodeId, episodeId));
  }
}
```

#### 2.2 导出 DAOs

```typescript
// src/main/database/dao/index.ts 追加

export * from "./llmProvidersDao";
export * from "./llmModelsDao";
export * from "./promptsDao";
export * from "./episodeAiSummarysDao";
```

---

### Phase 3: AI 服务层实现（4-5 小时）

#### 3.1 安装依赖

```bash
npm install openai
```

#### 3.2 定义接口和类型

```typescript
// src/main/services/ai/types.ts

export interface SummaryResponse {
  summary: string;
  tags: string[];
}

export interface ChapterItem {
  start: number; // 毫秒
  end: number; // 毫秒
  summary: string;
}

export interface ChapterResponse {
  chapters: ChapterItem[];
}

export interface MindmapResponse {
  mindmap: string; // Markdown 格式
}

export interface AIService {
  getSummary(transcript: string, prompt?: string): Promise<SummaryResponse>;
  getChapters(transcript: string, prompt?: string): Promise<ChapterResponse>;
  getMindmap(transcript: string, prompt?: string): Promise<MindmapResponse>;
}

export interface AIServiceConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

#### 3.3 实现 OpenAI Service

```typescript
// src/main/services/ai/OpenAIService.ts

import OpenAI from "openai";
import type {
  AIService,
  AIServiceConfig,
  SummaryResponse,
  ChapterResponse,
  MindmapResponse,
  TokenUsage,
} from "./types";

export class OpenAIService implements AIService {
  private client: OpenAI;
  private config: AIServiceConfig;
  public lastTokenUsage: TokenUsage | null = null;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      defaultHeaders: config.headers,
    });
  }

  private async callAPI(
    systemPrompt: string,
    userPrompt: string,
    transcript: string,
  ): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\n\n播客内容：\n${transcript}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // 记录 token 使用量
    if (response.usage) {
      this.lastTokenUsage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      };
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AI 返回内容为空");
    }

    return JSON.parse(content);
  }

  async getSummary(
    transcript: string,
    customPrompt?: string,
  ): Promise<SummaryResponse> {
    const systemPrompt = "你是一个专业的播客内容分析助手。";
    const userPrompt =
      customPrompt ||
      '请总结以下播客内容的核心观点、金句和行动建议，并生成 5-10 个相关标签。返回 JSON 格式：{"summary": "总结内容", "tags": ["标签1", "标签2"]}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }

  async getChapters(
    transcript: string,
    customPrompt?: string,
  ): Promise<ChapterResponse> {
    const systemPrompt = "你是一个专业的播客内容分析助手。";
    const userPrompt =
      customPrompt ||
      '请分析以下播客内容，将其分为若干章节，每个章节包含开始时间（毫秒）、结束时间（毫秒）和总结。返回 JSON 格式：{"chapters": [{"start": 0, "end": 60000, "summary": "章节总结"}]}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }

  async getMindmap(
    transcript: string,
    customPrompt?: string,
  ): Promise<MindmapResponse> {
    const systemPrompt = "你是一个专业的播客内容分析助手。";
    const userPrompt =
      customPrompt ||
      '请将以下播客内容整理为 Markdown 格式的思维导图。返回 JSON 格式：{"mindmap": "# 主题\\n## 子主题"}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }
}
```

#### 3.4 实现 AI Service Manager

```typescript
// src/main/services/ai/AIServiceManager.ts

import { OpenAIService } from "./OpenAIService";
import { LlmProvidersDao } from "../../database/dao/llmProvidersDao";
import { LlmModelsDao } from "../../database/dao/llmModelsDao";
import { PromptsDao } from "../../database/dao/promptsDao";
import { EpisodeAiSummarysDao } from "../../database/dao/episodeAiSummarysDao";
import { EpisodeTranscriptsDao } from "../../database/dao/episodeTranscriptsDao";
import type {
  AIService,
  SummaryResponse,
  ChapterResponse,
  MindmapResponse,
} from "./types";

export class AIServiceManager {
  private providersDao: LlmProvidersDao;
  private modelsDao: LlmModelsDao;
  private promptsDao: PromptsDao;
  private summariesDao: EpisodeAiSummarysDao;
  private transcriptsDao: EpisodeTranscriptsDao;

  constructor() {
    this.providersDao = new LlmProvidersDao();
    this.modelsDao = new LlmModelsDao();
    this.promptsDao = new PromptsDao();
    this.summariesDao = new EpisodeAiSummarysDao();
    this.transcriptsDao = new EpisodeTranscriptsDao();
  }

  private async getDefaultService(): Promise<{
    service: AIService;
    providerId: number;
    modelId: number;
  }> {
    // 获取默认 Provider
    const provider = await this.providersDao.findDefault();
    if (!provider) {
      throw new Error("未配置默认 LLM Provider");
    }

    // 获取默认 Model
    const model = await this.modelsDao.findDefault(provider.id);
    if (!model) {
      throw new Error(`Provider ${provider.name} 未配置默认模型`);
    }

    // 创建 AI Service
    const service = new OpenAIService({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey || "",
      model: model.code,
      timeout: provider.timeout,
      headers: provider.headersJson
        ? JSON.parse(provider.headersJson)
        : undefined,
    });

    return { service, providerId: provider.id, modelId: model.id };
  }

  private async getPromptByType(type: string): Promise<string> {
    const prompts = await this.promptsDao.findByType(type);
    if (prompts.length === 0) {
      throw new Error(`未找到类型为 ${type} 的 Prompt`);
    }
    // 优先使用非内置的自定义 Prompt
    const customPrompt = prompts.find((p) => !p.isBuiltin);
    return customPrompt ? customPrompt.prompt : prompts[0].prompt;
  }

  async generateSummary(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 获取转写内容
      const transcript = await this.transcriptsDao.getByEpisode(episodeId);
      if (!transcript) {
        return { success: false, error: "该集未找到转写内容" };
      }

      // 获取 AI Service 和配置
      const { service, providerId, modelId } = await this.getDefaultService();

      // 获取 Prompt
      const summaryPrompt = await this.getPromptByType("summary");

      // 调用 AI API
      const result = await service.getSummary(transcript.text, summaryPrompt);

      // 记录 token 使用量
      const tokenUsage =
        (service as OpenAIService).lastTokenUsage?.totalTokens || 0;

      // 更新 Provider 和 Model 的 token 统计
      await this.providersDao.incrementTokenUsage(providerId, tokenUsage);
      await this.modelsDao.incrementTokenUsage(modelId, tokenUsage);

      // 保存结果
      const existing = await this.summariesDao.findByEpisode(episodeId);
      if (existing) {
        await this.summariesDao.update(episodeId, {
          providerId,
          modelId,
          summary: result.summary,
          tags: result.tags.join(","),
          tokenUsage,
        });
      } else {
        await this.summariesDao.create({
          episodeId,
          providerId,
          modelId,
          summary: result.summary,
          tags: result.tags.join(","),
          chapters: "[]",
          tokenUsage,
        });
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成失败",
      };
    }
  }

  async generateChapters(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const transcript = await this.transcriptsDao.getByEpisode(episodeId);
      if (!transcript) {
        return { success: false, error: "该集未找到转写内容" };
      }

      const { service, providerId, modelId } = await this.getDefaultService();
      const chaptersPrompt = await this.getPromptByType("chapters");
      const result = await service.getChapters(transcript.text, chaptersPrompt);

      const tokenUsage =
        (service as OpenAIService).lastTokenUsage?.totalTokens || 0;
      await this.providersDao.incrementTokenUsage(providerId, tokenUsage);
      await this.modelsDao.incrementTokenUsage(modelId, tokenUsage);

      // 保存章节信息
      const existing = await this.summariesDao.findByEpisode(episodeId);
      if (existing) {
        await this.summariesDao.update(episodeId, {
          chapters: JSON.stringify(result.chapters),
          tokenUsage: existing.tokenUsage + tokenUsage,
        });
      } else {
        await this.summariesDao.create({
          episodeId,
          providerId,
          modelId,
          summary: "",
          tags: "",
          chapters: JSON.stringify(result.chapters),
          tokenUsage,
        });
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成失败",
      };
    }
  }

  async getSummary(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const summary = await this.summariesDao.findByEpisode(episodeId);
      if (!summary) {
        return { success: false, error: "该集尚未生成总结" };
      }

      return {
        success: true,
        data: {
          summary: summary.summary,
          tags: summary.tags.split(",").filter((t) => t.trim()),
          chapters: JSON.parse(summary.chapters),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "查询失败",
      };
    }
  }
}
```

---

### Phase 4: IPC 通信层（2-3 小时）

#### 4.1 注册 IPC Handlers

在 `src/main/services/IPCHandlers.ts` 中添加：

```typescript
import { AIServiceManager } from "./ai/AIServiceManager";
import { LlmProvidersDao } from "../database/dao/llmProvidersDao";
import { LlmModelsDao } from "../database/dao/llmModelsDao";
import { PromptsDao } from "../database/dao/promptsDao";

export class FeedIPCHandlers {
  // ... 现有代码 ...

  private aiServiceManager: AIServiceManager;
  private llmProvidersDao: LlmProvidersDao;
  private llmModelsDao: LlmModelsDao;
  private promptsDao: PromptsDao;

  constructor() {
    // ... 现有初始化 ...

    this.aiServiceManager = new AIServiceManager();
    this.llmProvidersDao = new LlmProvidersDao();
    this.llmModelsDao = new LlmModelsDao();
    this.promptsDao = new PromptsDao();

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // ... 现有 handlers ...

    // LLM Providers
    ipcMain.handle(
      "llmProviders:getAll",
      this.handleGetAllProviders.bind(this),
    );
    ipcMain.handle("llmProviders:create", this.handleCreateProvider.bind(this));
    ipcMain.handle("llmProviders:update", this.handleUpdateProvider.bind(this));
    ipcMain.handle("llmProviders:delete", this.handleDeleteProvider.bind(this));
    ipcMain.handle(
      "llmProviders:setDefault",
      this.handleSetDefaultProvider.bind(this),
    );

    // LLM Models
    ipcMain.handle("llmModels:getAll", this.handleGetAllModels.bind(this));
    ipcMain.handle(
      "llmModels:getByProvider",
      this.handleGetModelsByProvider.bind(this),
    );
    ipcMain.handle("llmModels:create", this.handleCreateModel.bind(this));
    ipcMain.handle("llmModels:update", this.handleUpdateModel.bind(this));
    ipcMain.handle("llmModels:delete", this.handleDeleteModel.bind(this));
    ipcMain.handle(
      "llmModels:setDefault",
      this.handleSetDefaultModel.bind(this),
    );

    // Prompts
    ipcMain.handle("prompts:getAll", this.handleGetAllPrompts.bind(this));
    ipcMain.handle("prompts:create", this.handleCreatePrompt.bind(this));
    ipcMain.handle("prompts:update", this.handleUpdatePrompt.bind(this));
    ipcMain.handle("prompts:delete", this.handleDeletePrompt.bind(this));

    // AI Operations
    ipcMain.handle("ai:generateSummary", this.handleGenerateSummary.bind(this));
    ipcMain.handle(
      "ai:generateChapters",
      this.handleGenerateChapters.bind(this),
    );
    ipcMain.handle("ai:getSummary", this.handleGetSummary.bind(this));
  }

  // Provider Handlers
  private async handleGetAllProviders(): Promise<any> {
    try {
      const providers = await this.llmProvidersDao.findAll();
      return { success: true, providers };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleCreateProvider(_: any, data: any): Promise<any> {
    try {
      const provider = await this.llmProvidersDao.create(data);
      return { success: true, provider };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleUpdateProvider(
    _: any,
    id: number,
    data: any,
  ): Promise<any> {
    try {
      const provider = await this.llmProvidersDao.update(id, data);
      return { success: true, provider };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleDeleteProvider(_: any, id: number): Promise<any> {
    try {
      await this.llmProvidersDao.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleSetDefaultProvider(_: any, id: number): Promise<any> {
    try {
      await this.llmProvidersDao.setDefault(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Model Handlers
  private async handleGetAllModels(): Promise<any> {
    try {
      const models = await this.llmModelsDao.findAll();
      return { success: true, models };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleGetModelsByProvider(
    _: any,
    providerId: number,
  ): Promise<any> {
    try {
      const models = await this.llmModelsDao.findByProvider(providerId);
      return { success: true, models };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleCreateModel(_: any, data: any): Promise<any> {
    try {
      const model = await this.llmModelsDao.create(data);
      return { success: true, model };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleUpdateModel(_: any, id: number, data: any): Promise<any> {
    try {
      const model = await this.llmModelsDao.update(id, data);
      return { success: true, model };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleDeleteModel(_: any, id: number): Promise<any> {
    try {
      await this.llmModelsDao.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleSetDefaultModel(
    _: any,
    providerId: number,
    modelId: number,
  ): Promise<any> {
    try {
      await this.llmModelsDao.setDefault(providerId, modelId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Prompt Handlers
  private async handleGetAllPrompts(): Promise<any> {
    try {
      const prompts = await this.promptsDao.findAll();
      return { success: true, prompts };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleCreatePrompt(_: any, data: any): Promise<any> {
    try {
      const prompt = await this.promptsDao.create(data);
      return { success: true, prompt };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleUpdatePrompt(
    _: any,
    id: number,
    data: any,
  ): Promise<any> {
    try {
      const prompt = await this.promptsDao.update(id, data);
      return { success: true, prompt };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleDeletePrompt(_: any, id: number): Promise<any> {
    try {
      await this.promptsDao.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // AI Operation Handlers
  private async handleGenerateSummary(_: any, episodeId: number): Promise<any> {
    return await this.aiServiceManager.generateSummary(episodeId);
  }

  private async handleGenerateChapters(
    _: any,
    episodeId: number,
  ): Promise<any> {
    return await this.aiServiceManager.generateChapters(episodeId);
  }

  private async handleGetSummary(_: any, episodeId: number): Promise<any> {
    return await this.aiServiceManager.getSummary(episodeId);
  }
}
```

#### 4.2 暴露 API 到渲染进程

在 `src/main/preload.ts` 中添加：

```typescript
contextBridge.exposeInMainWorld("electronAPI", {
  // ... 现有 API ...

  // LLM Providers
  llmProviders: {
    getAll: () => ipcRenderer.invoke("llmProviders:getAll"),
    create: (data: any) => ipcRenderer.invoke("llmProviders:create", data),
    update: (id: number, data: any) =>
      ipcRenderer.invoke("llmProviders:update", id, data),
    delete: (id: number) => ipcRenderer.invoke("llmProviders:delete", id),
    setDefault: (id: number) =>
      ipcRenderer.invoke("llmProviders:setDefault", id),
  },

  // LLM Models
  llmModels: {
    getAll: () => ipcRenderer.invoke("llmModels:getAll"),
    getByProvider: (providerId: number) =>
      ipcRenderer.invoke("llmModels:getByProvider", providerId),
    create: (data: any) => ipcRenderer.invoke("llmModels:create", data),
    update: (id: number, data: any) =>
      ipcRenderer.invoke("llmModels:update", id, data),
    delete: (id: number) => ipcRenderer.invoke("llmModels:delete", id),
    setDefault: (providerId: number, modelId: number) =>
      ipcRenderer.invoke("llmModels:setDefault", providerId, modelId),
  },

  // Prompts
  prompts: {
    getAll: () => ipcRenderer.invoke("prompts:getAll"),
    create: (data: any) => ipcRenderer.invoke("prompts:create", data),
    update: (id: number, data: any) =>
      ipcRenderer.invoke("prompts:update", id, data),
    delete: (id: number) => ipcRenderer.invoke("prompts:delete", id),
  },

  // AI Operations
  ai: {
    generateSummary: (episodeId: number) =>
      ipcRenderer.invoke("ai:generateSummary", episodeId),
    generateChapters: (episodeId: number) =>
      ipcRenderer.invoke("ai:generateChapters", episodeId),
    getSummary: (episodeId: number) =>
      ipcRenderer.invoke("ai:getSummary", episodeId),
  },
});
```

---

### Phase 5: UI 层实现（5-6 小时）

#### 5.1 创建 AI Settings 组件

```typescript
// src/renderer/components/Settings/AISettings.tsx

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { getElectronAPI } from '../../utils/electron';

interface LlmProvider {
  id: number;
  name: string;
  baseUrl: string;
  apiKey: string;
  tokenUsage: number;
  isDefault: boolean;
}

interface LlmModel {
  id: number;
  providerId: number;
  name: string;
  code: string;
  tokenUsage: number;
  isDefault: boolean;
}

export const AISettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'providers' | 'prompts' | 'stats'>('providers');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI 设置</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          配置 LLM Provider、Prompt 模板和查看使用统计
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('providers')}
            className={`${
              activeTab === 'providers'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Provider 配置
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`${
              activeTab === 'prompts'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Prompt 模板
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            使用统计
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-4">
        {activeTab === 'providers' && <ProvidersPanel />}
        {activeTab === 'prompts' && <PromptsPanel />}
        {activeTab === 'stats' && <StatsPanel />}
      </div>
    </div>
  );
};

const ProvidersPanel: React.FC = () => {
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [models, setModels] = useState<Record<number, LlmModel[]>>({});
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const result = await getElectronAPI().llmProviders.getAll();
      if (result.success) {
        setProviders(result.providers);

        // 加载所有 models
        for (const provider of result.providers) {
          const modelsResult = await getElectronAPI().llmModels.getByProvider(provider.id);
          if (modelsResult.success) {
            setModels(prev => ({ ...prev, [provider.id]: modelsResult.models }));
          }
        }

        if (result.providers.length > 0 && !selectedProviderId) {
          setSelectedProviderId(result.providers[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async () => {
    const result = await getElectronAPI().llmProviders.create({
      name: 'New Provider',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      tokenUsage: 0,
      isDefault: false,
    });

    if (result.success) {
      await loadProviders();
      setSelectedProviderId(result.provider.id);
    }
  };

  const handleUpdateProvider = async (id: number, data: Partial<LlmProvider>) => {
    await getElectronAPI().llmProviders.update(id, data);
    await loadProviders();
  };

  const handleDeleteProvider = async (id: number) => {
    if (confirm('确定要删除该 Provider 吗？')) {
      await getElectronAPI().llmProviders.delete(id);
      await loadProviders();
      if (selectedProviderId === id) {
        setSelectedProviderId(providers.length > 1 ? providers[0].id : null);
      }
    }
  };

  const handleSetDefaultProvider = async (id: number) => {
    await getElectronAPI().llmProviders.setDefault(id);
    await loadProviders();
  };

  const handleAddModel = async (providerId: number) => {
    const result = await getElectronAPI().llmModels.create({
      providerId,
      name: 'new-model',
      code: 'new-model',
      tokenUsage: 0,
      isDefault: false,
    });

    if (result.success) {
      await loadProviders();
    }
  };

  const handleUpdateModel = async (modelId: number, data: Partial<LlmModel>) => {
    await getElectronAPI().llmModels.update(modelId, data);
    await loadProviders();
  };

  const handleDeleteModel = async (modelId: number) => {
    await getElectronAPI().llmModels.delete(modelId);
    await loadProviders();
  };

  const selectedProvider = providers.find(p => p.id === selectedProviderId);
  const selectedModels = selectedProviderId ? models[selectedProviderId] || [] : [];

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">加载中...</div>;
  }

  return (
    <div className="flex h-[80vh] border rounded-xl overflow-hidden dark:border-gray-700">
      {/* Left Panel - Provider List */}
      <div className="w-1/3 border-r bg-gray-50 dark:bg-gray-800 dark:border-gray-700 flex flex-col">
        <div className="p-4 font-semibold text-lg border-b dark:border-gray-700">Providers</div>
        <div className="flex-1 overflow-y-auto">
          {providers.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-2 cursor-pointer border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                selectedProviderId === p.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                  : ''
              }`}
              onClick={() => setSelectedProviderId(p.id)}
            >
              <span className="truncate">{p.name}</span>
              <div className="flex items-center gap-2">
                {p.isDefault && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProvider(p.id);
                  }}
                  className="text-gray-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t dark:border-gray-700">
          <Button onClick={handleAddProvider} className="w-full">
            <Plus size={16} className="mr-1" /> 添加 Provider
          </Button>
        </div>
      </div>

      {/* Right Panel - Provider Details */}
      <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900">
        {selectedProvider ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <Input
                value={selectedProvider.name}
                onChange={(e) => handleUpdateProvider(selectedProvider.id, { name: e.target.value })}
                className="text-2xl font-semibold w-2/3"
              />
              <Button
                onClick={() => handleSetDefaultProvider(selectedProvider.id)}
                variant={selectedProvider.isDefault ? 'primary' : 'secondary'}
              >
                <Star size={16} className="mr-1" />
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              <Input
                label="API Base URL"
                value={selectedProvider.baseUrl}
                onChange={(e) => handleUpdateProvider(selectedProvider.id, { baseUrl: e.target.value })}
              />
              <Input
                type="password"
                label="API Key"
                value={selectedProvider.apiKey}
                onChange={(e) => handleUpdateProvider(selectedProvider.id, { apiKey: e.target.value })}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Models</h3>
                <button
                  onClick={() => handleAddModel(selectedProvider.id)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + 添加模型
                </button>
              </div>
              <ul className="space-y-2">
                {selectedModels.map((m) => (
                  <li
                    key={m.id}
                    className="flex gap-2 items-center border rounded-md px-3 py-2 dark:border-gray-700"
                  >
                    <Input
                      value={m.name}
                      onChange={(e) => handleUpdateModel(m.id, { name: e.target.value })}
                      placeholder="显示名称"
                      className="flex-1"
                    />
                    <Input
                      value={m.code}
                      onChange={(e) => handleUpdateModel(m.id, { code: e.target.value })}
                      placeholder="API 代码"
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleDeleteModel(m.id)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="text-gray-400 text-center mt-10">请选择一个 Provider 查看详情</div>
        )}
      </div>
    </div>
  );
};

const PromptsPanel: React.FC = () => {
  // Prompt 配置面板实现
  return (
    <div className="text-gray-600 dark:text-gray-400">
      Prompt 配置功能开发中...
    </div>
  );
};

const StatsPanel: React.FC = () => {
  // 统计面板实现
  return (
    <div className="text-gray-600 dark:text-gray-400">
      使用统计功能开发中...
    </div>
  );
};

export default AISettings;
```

#### 5.2 集成到设置页面

在 `src/renderer/components/MainContent.tsx` 中修改 `SettingsView`：

```typescript
const SettingsView: React.FC = () => {
  const [activeSection, setActiveSection] = React.useState<'general' | 'transcript' | 'ai'>('general');

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h2>
        </div>
        <nav className="px-3 space-y-1">
          <button
            onClick={() => setActiveSection('general')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'general'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            通用设置
          </button>
          <button
            onClick={() => setActiveSection('transcript')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'transcript'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            转写服务
          </button>
          <button
            onClick={() => setActiveSection('ai')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'ai'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            AI 设置
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeSection === 'general' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">通用设置</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">应用程序的基本设置</p>
            </div>
          )}
          {activeSection === 'transcript' && <TranscriptSettings />}
          {activeSection === 'ai' && <AISettings />}
        </div>
      </div>
    </div>
  );
};
```

---

### Phase 6: 功能集成到 EpisodeDetailPage（3-4 小时）

在 `src/renderer/pages/EpisodeDetailPage.tsx` 中添加 AI 功能：

```typescript
// 在 EpisodeDetailPage 组件中添加

const [aiSummary, setAiSummary] = useState<any>(null);
const [isGenerating, setIsGenerating] = useState(false);

const loadAISummary = async () => {
  if (!episode) return;

  const result = await getElectronAPI().ai.getSummary(episode.id);
  if (result.success) {
    setAiSummary(result.data);
  }
};

const handleGenerateSummary = async () => {
  if (!episode) return;

  setIsGenerating(true);
  try {
    const result = await getElectronAPI().ai.generateSummary(episode.id);
    if (result.success) {
      setAiSummary(result.data);
      alert('总结生成成功！');
    } else {
      alert(`生成失败：${result.error}`);
    }
  } catch (error) {
    alert(`生成失败：${error}`);
  } finally {
    setIsGenerating(false);
  }
};

// 在 UI 中添加

<div className="mt-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold">AI 总结</h3>
    <Button onClick={handleGenerateSummary} loading={isGenerating} disabled={isGenerating}>
      {isGenerating ? '生成中...' : '生成总结'}
    </Button>
  </div>

  {aiSummary && (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">核心观点</h4>
        <p className="text-gray-700 dark:text-gray-300">{aiSummary.summary}</p>
      </div>

      {aiSummary.tags.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">标签</h4>
          <div className="flex flex-wrap gap-2">
            {aiSummary.tags.map((tag: string, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {aiSummary.chapters.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">章节</h4>
          <ul className="space-y-2">
            {aiSummary.chapters.map((chapter: any, idx: number) => (
              <li key={idx} className="border-l-2 border-blue-500 pl-3">
                <div className="text-sm text-gray-500">
                  {formatTime(chapter.start)} - {formatTime(chapter.end)}
                </div>
                <div>{chapter.summary}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )}
</div>
```

---

## 总工时估算

- **Phase 1: 数据库表结构**：2-3 小时
- **Phase 2: DAO 层**：2-3 小时
- **Phase 3: AI 服务层**：4-5 小时
- **Phase 4: IPC 通信层**：2-3 小时
- **Phase 5: UI 层**：5-6 小时
- **Phase 6: 功能集成**：3-4 小时

**总计：18-24 小时**

---

## 技术要点总结

### 数据流向

```
EpisodeDetailPage (用户点击生成)
  → IPC (ai:generateSummary)
  → AIServiceManager
  → OpenAIService (调用 OpenAI API)
  → 保存到 episodeAiSummarys
  → 更新 token 统计
  → 返回结果给前端
```

### 关键技术点

1. **OpenAI SDK 配置**：支持自定义 `baseURL`，兼容其他 OpenAI Compatible API
2. **JSON 输出**：使用 `response_format: {type: "json_object"}` 确保结构化输出
3. **Token 统计**：从 API 响应的 `usage` 字段获取，分别统计 Provider 和 Model 级别
4. **错误处理**：完整的 try-catch 和用户友好的错误提示
5. **UI 交互**：参考 `setting.jsx` 的左右分栏布局，支持实时编辑和保存

---

## 后续优化方向

1. **API Key 加密存储**：使用 Electron safeStorage API
2. **Prompt 变量支持**：实现 `{{transcript}}` 等变量替换
3. **批量任务队列**：支持多集同时生成总结
4. **成本估算**：在生成前预估 token 使用和成本
5. **导出功能**：将 AI 总结导出为 Markdown/Obsidian 格式
6. **多语言支持**：中英文 UI 切换
7. **缓存优化**：相同内容避免重复调用 API

---

## 参考资料

- OpenAI API 文档：https://platform.openai.com/docs/api-reference
- Drizzle ORM 文档：https://orm.drizzle.team/
- Electron IPC 文档：https://www.electronjs.org/docs/latest/api/ipc-main
- 需求文档：`docs/tasks/ai_summary.md`
- UI 参考：`docs/tasks/ai_summary/setting.jsx`
