# Task Stage 2.3: AI 章节分析功能

## 任务概述

基于转写文本的时间轴和内容，使用 AI 自动分析和生成播客的章节结构，帮助用户快速定位感兴趣的内容片段。

## 技术设计

### 章节分析流程

```
转写文本 (带时间戳的 SentenceInfo[])
    ↓
AI Provider (分析主题变化)
    ↓
生成章节结构 (chapters)
    ↓
保存到数据库 (episode_ai_summarys.chapters)
    ↓
UI 展示和跳转
```

### 章节数据结构

```typescript
interface Chapter {
  id: string;
  title: string; // 章节标题
  summary: string; // 章节摘要
  startTime: number; // 开始时间（毫秒）
  endTime: number; // 结束时间（毫秒）
  keywords: string[]; // 关键词
  speakerIds?: number[]; // 参与的发言人
}
```

## 实现细节

### 1. 章节分析服务

在 `src/main/services/ai/ChapterService.ts`:

```typescript
import { AIProvider } from './AIProvider';
import { getDatabaseManager } from '@/main/database/connection';
import { episodeTranscripts, episodeAiSummarys } from '@/main/database/schema';
import { eq } from 'drizzle-orm';
import { SentenceInfo } from '@/main/types/transcript';

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  startTime: number;
  endTime: number;
  keywords: string[];
  speakerIds?: number[];
}

export class ChapterService {
  constructor(private aiProvider: AIProvider) {}

  /**
   * 生成章节
   */
  async generateChapters(
    episodeId: number,
    options: ChapterGenerationOptions = {}
  ): Promise<Chapter[]> {
    // 1. 获取转写数据
    const { transcript, sentences } = await this.getTranscriptData(episodeId);

    if (!transcript || !sentences || sentences.length === 0) {
      throw new Error('No transcript data available');
    }

    // 2. 分段分析（处理长文本）
    const segments = this.segmentTranscript(sentences, options.maxSegmentLength || 10000);

    // 3. 为每个段落生成章节提案
    const allProposals: ChapterProposal[] = [];

    for (const segment of segments) {
      const proposals = await this.analyzeSegment(segment);
      allProposals.push(...proposals);
    }

    // 4. 合并和优化章节
    const chapters = this.mergeChapters(allProposals, options);

    // 5. 保存到数据库
    await this.saveChapters(episodeId, chapters);

    return chapters;
  }

  /**
   * 细化章节（基于用户反馈）
   */
  async refineChapters(
    episodeId: number,
    currentChapters: Chapter[],
    feedback: string
  ): Promise<Chapter[]> {
    const chaptersJson = JSON.stringify(currentChapters, null, 2);

    const prompt = `当前章节结构:
${chaptersJson}

用户反馈:
${feedback}

请根据用户反馈优化章节结构，返回新的章节 JSON 数组。`;

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
      maxTokens: 2000,
    });

    const chapters = this.parseChaptersFromResponse(response.content);
    await this.saveChapters(episodeId, chapters);

    return chapters;
  }

  /**
   * 获取转写数据
   */
  private async getTranscriptData(
    episodeId: number
  ): Promise<{ transcript: string | null; sentences: SentenceInfo[] | null }> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select()
      .from(episodeTranscripts)
      .where(eq(episodeTranscripts.episodeId, episodeId))
      .limit(1);

    if (!result[0]) {
      return { transcript: null, sentences: null };
    }

    return {
      transcript: result[0].text,
      sentences: JSON.parse(result[0].subtitles) as SentenceInfo[],
    };
  }

  /**
   * 分段处理长文本
   */
  private segmentTranscript(
    sentences: SentenceInfo[],
    maxLength: number
  ): SentenceInfo[][] {
    const segments: SentenceInfo[][] = [];
    let currentSegment: SentenceInfo[] = [];
    let currentLength = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.text.length;

      if (currentLength + sentenceLength > maxLength && currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
        currentLength = 0;
      }

      currentSegment.push(sentence);
      currentLength += sentenceLength;
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * 分析单个段落
   */
  private async analyzeSegment(segment: SentenceInfo[]): Promise<ChapterProposal[]> {
    // 构建带时间戳的文本
    const textWithTimestamps = segment
      .map(s => `[${this.formatTime(s.start)} - ${this.formatTime(s.end)}] ${s.text}`)
      .join('\n');

    const prompt = `请分析以下播客文字稿片段，识别主题变化的位置，生成章节划分建议。

文字稿:
${textWithTimestamps}

要求:
1. 识别主题明显变化的位置
2. 每个章节至少包含 2-3 分钟的内容
3. 为每个章节提供标题和简短摘要
4. 提取 3-5 个关键词
5. 返回 JSON 格式:
[
  {
    "title": "章节标题",
    "summary": "章节摘要",
    "startTime": 开始时间(毫秒),
    "endTime": 结束时间(毫秒),
    "keywords": ["关键词1", "关键词2"]
  }
]`;

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
      maxTokens: 1500,
    });

    return this.parseChaptersFromResponse(response.content);
  }

  /**
   * 合并章节提案
   */
  private mergeChapters(
    proposals: ChapterProposal[],
    options: ChapterGenerationOptions
  ): Chapter[] {
    const minDuration = (options.minChapterDuration || 120) * 1000; // 转换为毫秒
    const maxChapters = options.maxChapters || 20;

    // 排序
    proposals.sort((a, b) => a.startTime - b.startTime);

    // 合并过短的章节
    const merged: Chapter[] = [];
    let current: ChapterProposal | null = null;

    for (const proposal of proposals) {
      if (!current) {
        current = proposal;
        continue;
      }

      const duration = proposal.endTime - proposal.startTime;

      if (duration < minDuration && merged.length < maxChapters - 1) {
        // 合并到当前章节
        current.endTime = proposal.endTime;
        current.summary += ' ' + proposal.summary;
        current.keywords = [...new Set([...current.keywords, ...proposal.keywords])];
      } else {
        // 保存当前章节，开始新章节
        merged.push(this.createChapter(current));
        current = proposal;
      }
    }

    if (current) {
      merged.push(this.createChapter(current));
    }

    // 限制章节数量
    if (merged.length > maxChapters) {
      return merged.slice(0, maxChapters);
    }

    return merged;
  }

  /**
   * 创建章节对象
   */
  private createChapter(proposal: ChapterProposal): Chapter {
    return {
      id: `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: proposal.title,
      summary: proposal.summary,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      keywords: proposal.keywords.slice(0, 5), // 最多 5 个关键词
    };
  }

  /**
   * 保存章节到数据库
   */
  private async saveChapters(episodeId: number, chapters: Chapter[]): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    const chaptersJson = JSON.stringify(chapters);

    await db
      .insert(episodeAiSummarys)
      .values({
        episodeId,
        summary: '',
        tags: '',
        chapters: chaptersJson,
      })
      .onConflictDoUpdate({
        target: episodeAiSummarys.episodeId,
        set: {
          chapters: chaptersJson,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  /**
   * 解析 AI 响应中的章节
   */
  private parseChaptersFromResponse(content: string): ChapterProposal[] {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const chapters = JSON.parse(jsonMatch[0]);

      return chapters.map((c: any) => ({
        title: c.title || 'Untitled',
        summary: c.summary || '',
        startTime: c.startTime || 0,
        endTime: c.endTime || 0,
        keywords: Array.isArray(c.keywords) ? c.keywords : [],
      }));
    } catch (error) {
      console.error('Failed to parse chapters:', error);
      return [];
    }
  }

  /**
   * 格式化时间
   */
  private formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * 获取系统 prompt
   */
  private getSystemPrompt(): string {
    return `你是一个专业的播客内容分析助手，擅长识别内容主题的变化，划分合理的章节结构。

章节划分原则:
1. 主题连贯性: 同一章节内容主题应相对统一
2. 适当长度: 每个章节不宜过短（至少 2-3 分钟）
3. 自然过渡: 章节边界应在主题自然转换的位置
4. 清晰标题: 章节标题应简洁明了，概括核心内容
5. 有用摘要: 章节摘要应提炼关键信息

输出格式:
- 必须返回有效的 JSON 数组
- 时间使用毫秒表示
- 关键词为字符串数组`;
  }
}

interface ChapterProposal {
  title: string;
  summary: string;
  startTime: number;
  endTime: number;
  keywords: string[];
}

interface ChapterGenerationOptions {
  maxSegmentLength?: number; // 单次分析的最大文本长度
  minChapterDuration?: number; // 最小章节时长（秒）
  maxChapters?: number; // 最大章节数量
}
```

### 2. IPC Handlers 扩展

在 `src/main/services/ai/AIIPCHandlers.ts` 中添加:

```typescript
export class AIIPCHandlers {
  private summaryService: SummaryService;
  private tagService: TagService;
  private chapterService: ChapterService;

  constructor() {
    const provider = AIProviderFactory.getProvider('openai');
    this.summaryService = new SummaryService(provider);
    this.tagService = new TagService(provider);
    this.chapterService = new ChapterService(provider);

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // ... 现有 handlers

    // 章节相关
    ipcMain.handle('ai:generateChapters', this.handleGenerateChapters.bind(this));
    ipcMain.handle('ai:getChapters', this.handleGetChapters.bind(this));
    ipcMain.handle('ai:refineChapters', this.handleRefineChapters.bind(this));
  }

  private async handleGenerateChapters(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; options?: ChapterGenerationOptions }
  ): Promise<{ success: boolean; chapters?: Chapter[]; error?: string }> {
    try {
      const { episodeId, options } = params;
      const chapters = await this.chapterService.generateChapters(episodeId, options);

      return { success: true, chapters };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generate chapters failed',
      };
    }
  }

  private async handleGetChapters(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{ success: boolean; chapters?: Chapter[]; error?: string }> {
    try {
      const { episodeId } = params;

      const db = getDatabaseManager().getDrizzle();
      const result = await db
        .select()
        .from(episodeAiSummarys)
        .where(eq(episodeAiSummarys.episodeId, episodeId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'Chapters not found' };
      }

      const chapters: Chapter[] = result[0].chapters ? JSON.parse(result[0].chapters) : [];

      return { success: true, chapters };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get chapters failed',
      };
    }
  }

  private async handleRefineChapters(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; currentChapters: Chapter[]; feedback: string }
  ): Promise<{ success: boolean; chapters?: Chapter[]; error?: string }> {
    try {
      const { episodeId, currentChapters, feedback } = params;
      const chapters = await this.chapterService.refineChapters(
        episodeId,
        currentChapters,
        feedback
      );

      return { success: true, chapters };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refine chapters failed',
      };
    }
  }

  destroy(): void {
    // ... 现有清理逻辑
    ipcMain.removeHandler('ai:generateChapters');
    ipcMain.removeHandler('ai:getChapters');
    ipcMain.removeHandler('ai:refineChapters');
  }
}
```

### 3. UI 组件

在 `src/renderer/components/ai/ChapterPanel.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Button } from '@/renderer/components/ui/Button';
import { usePlayerStore } from '@/renderer/store/playerStore';

export const ChapterPanel: React.FC<{ episodeId: number }> = ({ episodeId }) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);

  const { seekTo, currentTime } = usePlayerStore();

  useEffect(() => {
    loadChapters();
  }, [episodeId]);

  useEffect(() => {
    // 更新当前章节
    const current = chapters.find(
      c => currentTime * 1000 >= c.startTime && currentTime * 1000 <= c.endTime
    );
    setCurrentChapterId(current?.id || null);
  }, [currentTime, chapters]);

  const loadChapters = async () => {
    const result = await window.electronAPI.ai.getChapters(episodeId);
    if (result.success && result.chapters) {
      setChapters(result.chapters);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const result = await window.electronAPI.ai.generateChapters(episodeId, {
        minChapterDuration: 120,
        maxChapters: 15,
      });

      if (result.success && result.chapters) {
        setChapters(result.chapters);
      }
    } catch (error) {
      console.error('Generate chapters failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChapterClick = (chapter: Chapter) => {
    seekTo(chapter.startTime / 1000);
  };

  const formatDuration = (startMs: number, endMs: number) => {
    const duration = (endMs - startMs) / 1000;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chapter-panel">
      <div className="chapter-header">
        <h3>章节</h3>

        <Button onClick={handleGenerate} disabled={isGenerating} size="sm">
          {isGenerating ? '生成中...' : chapters.length > 0 ? '重新生成' : '生成章节'}
        </Button>
      </div>

      <div className="chapter-list">
        {chapters.length > 0 ? (
          chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              className={`chapter-item ${currentChapterId === chapter.id ? 'active' : ''}`}
              onClick={() => handleChapterClick(chapter)}
            >
              <div className="chapter-index">{index + 1}</div>

              <div className="chapter-content">
                <div className="chapter-title">{chapter.title}</div>
                <div className="chapter-summary">{chapter.summary}</div>

                <div className="chapter-meta">
                  <span className="chapter-time">
                    {formatDuration(chapter.startTime, chapter.endTime)}
                  </span>

                  {chapter.keywords && chapter.keywords.length > 0 && (
                    <div className="chapter-keywords">
                      {chapter.keywords.map((keyword, i) => (
                        <span key={i} className="keyword-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>暂无章节，请点击生成</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

## 依赖关系

- **前置依赖**:
  - Task 1.1: 数据库 episode_ai_summarys 表
  - Task 1.5: 转写数据处理
  - Task 2.1: AI 总结功能
  - OpenAI API Key 配置

- **后置依赖**:
  - 无

## 验收标准

- [ ] ChapterService 实现完整
- [ ] 支持长文本分段分析
- [ ] 章节合并逻辑合理
- [ ] 支持章节优化
- [ ] IPC 接口实现完整
- [ ] UI 组件展示正常
- [ ] 与播放器时间轴同步
- [ ] 点击章节可跳转播放

## 风险和注意事项

### 风险

1. **分析准确性**: AI 可能无法准确识别主题变化
2. **长文本处理**: 超长文本可能超过 API 限制
3. **性能问题**: 章节生成可能耗时较长

### 注意事项

1. **分段策略**: 合理的文本分段以提高准确性
2. **章节长度**: 避免过短或过长的章节
3. **用户反馈**: 允许用户调整章节边界
4. **时间精度**: 确保章节时间与字幕对齐

## 实施步骤

1. 实现 ChapterService
2. 扩展 IPC Handlers
3. 实现 ChapterPanel 组件
4. 集成到播放器界面
5. 测试和优化 Prompt
6. 添加章节编辑功能
7. 性能优化

## 估时

- 设计: 1 天
- Service 实现: 3 天
- UI 实现: 2 天
- 集成和测试: 2 天
- 优化: 2 天
- **总计**: 10 天
