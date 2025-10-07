# Task Stage 2.2: AI 标签生成功能

## 任务概述

基于转写文本和总结内容，使用 AI 自动生成播客 Episode 的主题标签，便于内容分类和检索。

## 技术设计

### 标签生成流程

```
转写文本 + AI 总结
    ↓
AI Provider (提取关键主题)
    ↓
生成标签列表 (tags)
    ↓
保存到数据库 (episode_ai_summarys.tags)
    ↓
UI 展示和过滤
```

### 标签类型

1. **主题标签**: 播客的核心主题（如：技术、创业、健康）
2. **领域标签**: 具体的领域或学科（如：前端开发、人工智能、心理学）
3. **人物标签**: 提到的重要人物或嘉宾
4. **情感标签**: 内容的情感色彩（如：鼓舞人心、深度思考、轻松幽默）

## 实现细节

### 1. 标签服务

在 `src/main/services/ai/TagService.ts`:

```typescript
import { AIProvider } from './AIProvider';
import { getDatabaseManager } from '@/main/database/connection';
import { episodeTranscripts, episodeAiSummarys } from '@/main/database/schema';
import { eq } from 'drizzle-orm';

export class TagService {
  constructor(private aiProvider: AIProvider) {}

  /**
   * 生成标签
   */
  async generateTags(episodeId: number, options: TagGenerationOptions = {}): Promise<string[]> {
    // 1. 获取转写文本和总结
    const { transcript, summary } = await this.getContent(episodeId);

    if (!transcript && !summary) {
      throw new Error('No content available for tag generation');
    }

    // 2. 构建 prompt
    const prompt = this.buildPrompt(transcript, summary, options);

    // 3. 调用 AI 生成标签
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
      temperature: 0.3, // 较低的温度以获得更一致的结果
      maxTokens: 500,
    });

    // 4. 解析标签
    const tags = this.parseTags(response.content);

    // 5. 保存到数据库
    await this.saveTags(episodeId, tags);

    return tags;
  }

  /**
   * 根据用户输入优化标签
   */
  async refineTags(
    episodeId: number,
    currentTags: string[],
    feedback: string
  ): Promise<string[]> {
    const prompt = `当前标签: ${currentTags.join(', ')}

用户反馈: ${feedback}

请根据用户反馈优化标签，返回新的标签列表。`;

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
      temperature: 0.3,
      maxTokens: 300,
    });

    const tags = this.parseTags(response.content);
    await this.saveTags(episodeId, tags);

    return tags;
  }

  /**
   * 推荐相关标签
   */
  async suggestRelatedTags(tags: string[]): Promise<string[]> {
    const prompt = `已有标签: ${tags.join(', ')}

请推荐 5-10 个相关标签，扩展内容的主题范围。`;

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
      temperature: 0.5,
      maxTokens: 300,
    });

    return this.parseTags(response.content);
  }

  /**
   * 获取内容
   */
  private async getContent(
    episodeId: number
  ): Promise<{ transcript: string | null; summary: string | null }> {
    const db = getDatabaseManager().getDrizzle();

    const [transcriptResult, summaryResult] = await Promise.all([
      db.select().from(episodeTranscripts).where(eq(episodeTranscripts.episodeId, episodeId)).limit(1),
      db.select().from(episodeAiSummarys).where(eq(episodeAiSummarys.episodeId, episodeId)).limit(1),
    ]);

    return {
      transcript: transcriptResult[0]?.text || null,
      summary: summaryResult[0]?.summary || null,
    };
  }

  /**
   * 保存标签
   */
  private async saveTags(episodeId: number, tags: string[]): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    const tagsString = tags.join(',');

    await db
      .insert(episodeAiSummarys)
      .values({
        episodeId,
        summary: '',
        tags: tagsString,
        chapters: '[]',
      })
      .onConflictDoUpdate({
        target: episodeAiSummarys.episodeId,
        set: {
          tags: tagsString,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  /**
   * 构建 prompt
   */
  private buildPrompt(
    transcript: string | null,
    summary: string | null,
    options: TagGenerationOptions
  ): string {
    const maxTags = options.maxTags || 10;
    const language = options.language || 'zh';

    let content = '';

    if (summary) {
      content += `播客总结:\n${summary}\n\n`;
    }

    if (transcript) {
      // 如果文字稿太长，只取前 2000 字
      const truncated = transcript.length > 2000 ? transcript.substring(0, 2000) + '...' : transcript;
      content += `播客文字稿:\n${truncated}`;
    }

    return `请为以下播客内容生成 ${maxTags} 个关键标签。

${content}

要求:
1. 标签应准确反映播客的核心主题和内容
2. 包含主题标签、领域标签、人物标签（如有）
3. 标签应简洁（2-4个字）
4. 使用${language === 'zh' ? '中文' : '英文'}
5. 每行一个标签
6. 不要添加编号、符号或额外说明`;
  }

  /**
   * 获取系统 prompt
   */
  private getSystemPrompt(): string {
    return `你是一个专业的内容标签生成助手。你的任务是分析播客内容，提取关键主题和概念，生成准确、有意义的标签。

标签生成原则:
- 准确性: 标签应准确反映内容
- 相关性: 标签应与主题高度相关
- 简洁性: 使用简洁的词语
- 多样性: 涵盖不同维度（主题、领域、人物等）
- 实用性: 便于检索和分类`;
  }

  /**
   * 解析 AI 返回的标签
   */
  private parseTags(content: string): string[] {
    // 按行分割
    const lines = content.split('\n').map(line => line.trim());

    // 过滤空行和提取标签
    const tags = lines
      .filter(line => line.length > 0)
      .map(line => {
        // 移除可能的编号、符号等
        return line.replace(/^[\d\-\*\•\.\)]+\s*/, '').trim();
      })
      .filter(tag => {
        // 过滤掉过长或过短的标签
        return tag.length >= 2 && tag.length <= 20;
      });

    // 去重
    return Array.from(new Set(tags));
  }
}

interface TagGenerationOptions {
  maxTags?: number; // 最大标签数量
  language?: 'zh' | 'en'; // 标签语言
}
```

### 2. IPC Handlers 扩展

在 `src/main/services/ai/AIIPCHandlers.ts` 中添加:

```typescript
export class AIIPCHandlers {
  private summaryService: SummaryService;
  private tagService: TagService;

  constructor() {
    const provider = AIProviderFactory.getProvider('openai');
    this.summaryService = new SummaryService(provider);
    this.tagService = new TagService(provider);

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // ... 现有 handlers

    // 标签相关
    ipcMain.handle('ai:generateTags', this.handleGenerateTags.bind(this));
    ipcMain.handle('ai:getTags', this.handleGetTags.bind(this));
    ipcMain.handle('ai:refineTags', this.handleRefineTags.bind(this));
    ipcMain.handle('ai:suggestRelatedTags', this.handleSuggestRelatedTags.bind(this));
  }

  private async handleGenerateTags(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; options?: TagGenerationOptions }
  ): Promise<{ success: boolean; tags?: string[]; error?: string }> {
    try {
      const { episodeId, options } = params;
      const tags = await this.tagService.generateTags(episodeId, options);

      return { success: true, tags };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generate tags failed',
      };
    }
  }

  private async handleGetTags(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{ success: boolean; tags?: string[]; error?: string }> {
    try {
      const { episodeId } = params;

      const db = getDatabaseManager().getDrizzle();
      const result = await db
        .select()
        .from(episodeAiSummarys)
        .where(eq(episodeAiSummarys.episodeId, episodeId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'Tags not found' };
      }

      const tags = result[0].tags ? result[0].tags.split(',').filter(t => t.length > 0) : [];

      return { success: true, tags };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get tags failed',
      };
    }
  }

  private async handleRefineTags(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; currentTags: string[]; feedback: string }
  ): Promise<{ success: boolean; tags?: string[]; error?: string }> {
    try {
      const { episodeId, currentTags, feedback } = params;
      const tags = await this.tagService.refineTags(episodeId, currentTags, feedback);

      return { success: true, tags };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refine tags failed',
      };
    }
  }

  private async handleSuggestRelatedTags(
    event: IpcMainInvokeEvent,
    params: { tags: string[] }
  ): Promise<{ success: boolean; tags?: string[]; error?: string }> {
    try {
      const { tags } = params;
      const relatedTags = await this.tagService.suggestRelatedTags(tags);

      return { success: true, tags: relatedTags };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Suggest tags failed',
      };
    }
  }

  destroy(): void {
    // ... 现有清理逻辑
    ipcMain.removeHandler('ai:generateTags');
    ipcMain.removeHandler('ai:getTags');
    ipcMain.removeHandler('ai:refineTags');
    ipcMain.removeHandler('ai:suggestRelatedTags');
  }
}
```

### 3. UI 组件

在 `src/renderer/components/ai/TagPanel.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Button } from '@/renderer/components/ui/Button';
import { Badge } from '@/renderer/components/ui/Badge';

export const TagPanel: React.FC<{ episodeId: number }> = ({ episodeId }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    loadTags();
  }, [episodeId]);

  const loadTags = async () => {
    const result = await window.electronAPI.ai.getTags(episodeId);
    if (result.success && result.tags) {
      setTags(result.tags);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const result = await window.electronAPI.ai.generateTags(episodeId, {
        maxTags: 10,
        language: 'zh',
      });

      if (result.success && result.tags) {
        setTags(result.tags);
      }
    } catch (error) {
      console.error('Generate tags failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!feedback.trim()) return;

    setIsGenerating(true);

    try {
      const result = await window.electronAPI.ai.refineTags(episodeId, tags, feedback);

      if (result.success && result.tags) {
        setTags(result.tags);
        setFeedback('');
        setEditMode(false);
      }
    } catch (error) {
      console.error('Refine tags failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    setTags(newTags);
    // TODO: 保存到数据库
  };

  return (
    <div className="tag-panel">
      <div className="tag-header">
        <h3>标签</h3>

        <div className="tag-actions">
          <Button size="sm" onClick={() => setEditMode(!editMode)}>
            {editMode ? '取消编辑' : '编辑'}
          </Button>

          <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? '生成中...' : tags.length > 0 ? '重新生成' : '生成标签'}
          </Button>
        </div>
      </div>

      <div className="tag-list">
        {tags.length > 0 ? (
          tags.map((tag, index) => (
            <Badge
              key={index}
              variant="primary"
              onRemove={editMode ? () => handleRemoveTag(index) : undefined}
            >
              {tag}
            </Badge>
          ))
        ) : (
          <p className="empty-state">暂无标签，请点击生成</p>
        )}
      </div>

      {editMode && (
        <div className="tag-refine">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="描述你想要的标签调整，例如：添加更多技术相关的标签，移除不太相关的标签..."
            rows={3}
          />

          <Button onClick={handleRefine} disabled={!feedback.trim() || isGenerating}>
            优化标签
          </Button>
        </div>
      )}
    </div>
  );
};
```

### 4. 标签搜索和过滤

在 `src/renderer/hooks/useTagFilter.ts`:

```typescript
import { useMemo } from 'react';

export interface Episode {
  id: number;
  title: string;
  tags?: string;
  // ... other fields
}

export function useTagFilter(episodes: Episode[], selectedTags: string[]) {
  const filteredEpisodes = useMemo(() => {
    if (selectedTags.length === 0) {
      return episodes;
    }

    return episodes.filter((episode) => {
      if (!episode.tags) return false;

      const episodeTags = episode.tags.split(',').map(t => t.trim());

      // 检查是否包含所有选中的标签
      return selectedTags.every(tag => episodeTags.includes(tag));
    });
  }, [episodes, selectedTags]);

  // 统计所有标签及其出现次数
  const tagStats = useMemo(() => {
    const stats = new Map<string, number>();

    episodes.forEach((episode) => {
      if (episode.tags) {
        const episodeTags = episode.tags.split(',').map(t => t.trim());
        episodeTags.forEach(tag => {
          stats.set(tag, (stats.get(tag) || 0) + 1);
        });
      }
    });

    // 按出现次数排序
    return Array.from(stats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [episodes]);

  return {
    filteredEpisodes,
    tagStats,
  };
}
```

## 依赖关系

- **前置依赖**:
  - Task 1.1: 数据库 episode_ai_summarys 表
  - Task 2.1: AI 总结功能
  - OpenAI API Key 配置

- **后置依赖**:
  - Task 2.3: AI 章节分析

## 验收标准

- [ ] TagService 实现完整
- [ ] 支持自动生成标签
- [ ] 支持标签优化和调整
- [ ] 支持相关标签推荐
- [ ] IPC 接口实现完整
- [ ] UI 组件展示正常
- [ ] 标签过滤和搜索功能正常
- [ ] 错误处理健壮

## 风险和注意事项

### 风险

1. **标签质量**: AI 生成的标签可能不够准确
2. **标签一致性**: 同类内容的标签可能不一致
3. **语言混合**: 中英文混合的标签处理

### 注意事项

1. **人工审核**: 允许用户编辑和调整标签
2. **标签规范化**: 统一标签的格式和命名
3. **标签去重**: 避免语义相同的重复标签
4. **标签限制**: 限制标签数量和长度

## 实施步骤

1. 实现 TagService
2. 扩展 IPC Handlers
3. 实现 TagPanel 组件
4. 实现标签过滤功能
5. 集成到 Episode 详情页和列表页
6. 测试和优化 Prompt
7. 添加标签管理功能

## 估时

- 设计: 1 天
- Service 实现: 2 天
- UI 实现: 2 天
- 过滤功能: 1 天
- 测试和优化: 2 天
- **总计**: 8 天
