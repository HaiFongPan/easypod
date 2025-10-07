# Task Stage 2.1: AI 总结功能实现

## 任务概述

基于转写文本实现 AI 总结功能，使用 OpenAI 兼容的 API 生成播客 Episode 的内容摘要。

## 技术设计

### AI 总结流程

```
转写文本 (episode_transcripts.text)
    ↓
AI Provider (OpenAI-compatible API)
    ↓
生成总结 (summary)
    ↓
保存到数据库 (episode_ai_summarys.summary)
    ↓
UI 展示
```

### 总结类型

1. **一句话摘要**: 高度浓缩的一句话总结（20-30字）
2. **简短摘要**: 100-200 字的核心要点
3. **详细摘要**: 500-1000 字的全面总结，包含关键论点和细节

## 实现细节

### 1. AI Provider 抽象接口

在 `src/main/services/ai/AIProvider.ts`:

```typescript
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number; // 0-2
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface AICompletionResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AI Provider 抽象接口
 */
export abstract class AIProvider {
  abstract readonly name: string;

  /**
   * 文本补全
   */
  abstract complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse>;

  /**
   * 流式文本补全
   */
  abstract streamComplete?(
    messages: AIMessage[],
    options?: AICompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse>;
}
```

### 2. OpenAI Provider 实现

在 `src/main/services/ai/OpenAIProvider.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import { AIProvider, AIMessage, AICompletionOptions, AICompletionResponse } from './AIProvider';

export class OpenAIProvider extends AIProvider {
  readonly name = 'openai';

  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(config: OpenAIConfig) {
    super();
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
        top_p: options?.topP ?? 1.0,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        presence_penalty: options?.presencePenalty ?? 0,
      });

      const choice = response.data.choices[0];
      const usage = response.data.usage;

      return {
        content: choice.message.content,
        finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
}
```

### 3. AI 总结服务

在 `src/main/services/ai/SummaryService.ts`:

```typescript
import { AIProvider } from './AIProvider';
import { getDatabaseManager } from '@/main/database/connection';
import { episodeTranscripts, episodeAiSummarys } from '@/main/database/schema';
import { eq } from 'drizzle-orm';

export class SummaryService {
  constructor(private aiProvider: AIProvider) {}

  /**
   * 生成播客总结
   */
  async generateSummary(
    episodeId: number,
    type: SummaryType = 'detailed'
  ): Promise<string> {
    // 1. 获取转写文本
    const transcript = await this.getTranscript(episodeId);
    if (!transcript) {
      throw new Error('Transcript not found');
    }

    // 2. 构建 prompt
    const prompt = this.buildPrompt(transcript, type);

    // 3. 调用 AI 生成总结
    const response = await this.aiProvider.complete([
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      temperature: 0.7,
      maxTokens: this.getMaxTokens(type),
    });

    const summary = response.content.trim();

    // 4. 保存到数据库
    await this.saveSummary(episodeId, summary);

    return summary;
  }

  /**
   * 批量生成总结
   */
  async generateBatchSummary(episodeIds: number[]): Promise<Map<number, string>> {
    const results = new Map<number, string>();

    for (const episodeId of episodeIds) {
      try {
        const summary = await this.generateSummary(episodeId);
        results.set(episodeId, summary);
      } catch (error) {
        console.error(`Failed to generate summary for episode ${episodeId}:`, error);
        results.set(episodeId, '');
      }
    }

    return results;
  }

  /**
   * 获取转写文本
   */
  private async getTranscript(episodeId: number): Promise<string | null> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db
      .select()
      .from(episodeTranscripts)
      .where(eq(episodeTranscripts.episodeId, episodeId))
      .limit(1);

    return result[0]?.text || null;
  }

  /**
   * 保存总结到数据库
   */
  private async saveSummary(episodeId: number, summary: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db
      .insert(episodeAiSummarys)
      .values({
        episodeId,
        summary,
        tags: '',
        chapters: '[]',
      })
      .onConflictDoUpdate({
        target: episodeAiSummarys.episodeId,
        set: {
          summary,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  /**
   * 构建 prompt
   */
  private buildPrompt(transcript: string, type: SummaryType): string {
    const templates = {
      oneline: `请用一句话（20-30字）总结以下播客内容的核心主题:\n\n${transcript}`,

      brief: `请用 100-200 字总结以下播客内容，提取核心要点:\n\n${transcript}`,

      detailed: `请详细总结以下播客内容（500-1000字），包括:
1. 核心主题和论点
2. 关键讨论点
3. 重要结论和见解
4. 值得注意的细节

播客文字稿:
${transcript}`,
    };

    return templates[type] || templates.detailed;
  }

  /**
   * 获取系统 prompt
   */
  private getSystemPrompt(): string {
    return `你是一个专业的播客内容分析助手。你的任务是阅读播客的文字稿，并生成准确、有见地的总结。

总结要求:
- 客观、准确地概括内容
- 提取核心观点和关键信息
- 保持语言简洁、流畅
- 使用中文输出
- 不要添加原文中没有的信息`;
  }

  /**
   * 根据类型获取最大 token 数
   */
  private getMaxTokens(type: SummaryType): number {
    const tokenLimits = {
      oneline: 100,
      brief: 500,
      detailed: 2000,
    };

    return tokenLimits[type] || 2000;
  }
}

export type SummaryType = 'oneline' | 'brief' | 'detailed';
```

### 4. IPC Handlers

在 `src/main/services/ai/AIIPCHandlers.ts`:

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { SummaryService } from './SummaryService';
import { AIProviderFactory } from './AIProviderFactory';

export class AIIPCHandlers {
  private summaryService: SummaryService;

  constructor() {
    // 初始化 AI Provider
    const provider = AIProviderFactory.getProvider('openai');
    this.summaryService = new SummaryService(provider);

    this.registerHandlers();
  }

  private registerHandlers(): void {
    ipcMain.handle('ai:generateSummary', this.handleGenerateSummary.bind(this));
    ipcMain.handle('ai:getSummary', this.handleGetSummary.bind(this));
  }

  private async handleGenerateSummary(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; type?: SummaryType }
  ): Promise<{ success: boolean; summary?: string; error?: string }> {
    try {
      const { episodeId, type } = params;
      const summary = await this.summaryService.generateSummary(episodeId, type);

      return { success: true, summary };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generate summary failed',
      };
    }
  }

  private async handleGetSummary(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{ success: boolean; summary?: string; error?: string }> {
    try {
      const { episodeId } = params;

      const db = getDatabaseManager().getDrizzle();
      const result = await db
        .select()
        .from(episodeAiSummarys)
        .where(eq(episodeAiSummarys.episodeId, episodeId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'Summary not found' };
      }

      return { success: true, summary: result[0].summary };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get summary failed',
      };
    }
  }

  destroy(): void {
    ipcMain.removeHandler('ai:generateSummary');
    ipcMain.removeHandler('ai:getSummary');
  }
}
```

### 5. UI 组件

在 `src/renderer/components/ai/SummaryPanel.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Button } from '@/renderer/components/ui/Button';

export const SummaryPanel: React.FC<{ episodeId: number }> = ({ episodeId }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryType, setSummaryType] = useState<SummaryType>('detailed');

  useEffect(() => {
    loadSummary();
  }, [episodeId]);

  const loadSummary = async () => {
    const result = await window.electronAPI.ai.getSummary(episodeId);
    if (result.success && result.summary) {
      setSummary(result.summary);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const result = await window.electronAPI.ai.generateSummary(episodeId, summaryType);
      if (result.success && result.summary) {
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Generate summary failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="summary-panel">
      <div className="summary-header">
        <h3>AI 总结</h3>

        <div className="summary-actions">
          <select
            value={summaryType}
            onChange={(e) => setSummaryType(e.target.value as SummaryType)}
          >
            <option value="oneline">一句话总结</option>
            <option value="brief">简短总结</option>
            <option value="detailed">详细总结</option>
          </select>

          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? '生成中...' : summary ? '重新生成' : '生成总结'}
          </Button>
        </div>
      </div>

      <div className="summary-content">
        {summary ? (
          <p>{summary}</p>
        ) : (
          <p className="empty-state">暂无总结，请点击生成</p>
        )}
      </div>
    </div>
  );
};
```

## 依赖关系

- **前置依赖**:
  - Task 1.1: 数据库 episode_ai_summarys 表
  - Stage 1: 转写功能完成
  - OpenAI API Key 配置

- **后置依赖**:
  - Task 2.2: AI 标签生成
  - Task 2.3: AI 章节分析

## 验收标准

- [ ] AIProvider 接口设计完整
- [ ] OpenAIProvider 实现正确
- [ ] SummaryService 生成逻辑正确
- [ ] 支持三种总结类型
- [ ] IPC 接口实现完整
- [ ] UI 组件展示正常
- [ ] 错误处理健壮
- [ ] Token 使用统计准确

## 风险和注意事项

### 风险

1. **API 费用**: OpenAI API 按 token 计费
2. **文本长度**: 长文本可能超过 API 限制
3. **质量控制**: AI 生成质量可能不稳定
4. **速率限制**: API 可能有速率限制

### 注意事项

1. **文本截断**: 超长文本需要截断或分段处理
2. **Prompt 优化**: Prompt 设计影响总结质量
3. **缓存机制**: 避免重复生成相同内容
4. **用户提示**: 明确告知 AI 生成可能的费用

## 实施步骤

1. 实现 AIProvider 接口和 OpenAIProvider
2. 实现 SummaryService
3. 实现 IPC Handlers
4. 实现 UI 组件
5. 集成到 Episode 详情页
6. 测试和优化 Prompt
7. 添加错误处理和重试机制

## 估时

- 设计: 1 天
- Provider 实现: 2 天
- Service 实现: 2 天
- UI 实现: 2 天
- 测试和优化: 2 天
- **总计**: 9 天
