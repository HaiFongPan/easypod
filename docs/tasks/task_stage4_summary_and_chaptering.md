# 任务：总结和分章节功能

## 任务信息
- **阶段**: 4 - AI功能集成
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_stage4_ai_provider_abstraction

## 任务目标
实现AI驱动的播客总结生成和智能章节分段功能，提供高质量的内容提炼。

## 具体任务
1. **Prompt模板系统设计**
   - 可配置的模板管理
   - 变量替换和条件逻辑
   - 模板版本控制
   - 内置和自定义模板支持

2. **播客总结生成功能**
   - 要点提取和整理
   - 金句和引文识别
   - 行动项目清单生成
   - 多种总结格式支持

3. **智能章节分段算法**
   - 基于内容主题的分段
   - 时间戳准确定位
   - 章节标题自动生成
   - 章节摘要提取

4. **AI任务历史记录**
   - 任务执行记录存储
   - 结果对比和版本管理
   - 重新生成和优化
   - 用户反馈收集

## 验收标准
- [ ] 总结内容结构化且可读性好
- [ ] 智能分章节准确率≥80%
- [ ] 支持中英文混合内容处理
- [ ] Prompt模板易于编辑和管理
- [ ] AI任务执行成功率≥95%
- [ ] 生成时间合理(≤转写时长的30%)

## Prompt模板系统

### 模板管理器
```typescript
// src/main/services/ai/PromptTemplateManager.ts
interface PromptTemplate {
  id: string;
  name: string;
  category: 'summary' | 'chapters' | 'mindmap' | 'chat' | 'custom';
  description: string;
  template: string;
  variables: PromptVariable[];
  version: string;
  isBuiltin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    options?: string[];
  };
}

interface TemplateRenderContext {
  title: string;
  description: string;
  duration: number;
  transcript: string;
  chapters: Chapter[];
  metadata: Record<string, any>;
  language: string;
  speakerCount: number;
}

class PromptTemplateManager {
  private templates = new Map<string, PromptTemplate>();

  constructor() {
    this.loadBuiltinTemplates();
  }

  async renderTemplate(
    templateId: string,
    context: TemplateRenderContext,
    variables: Record<string, any> = {}
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // 验证必需变量
    this.validateVariables(template, variables);

    // 合并上下文和变量
    const renderContext = {
      ...context,
      ...variables,
      // 辅助函数
      formatTime: this.formatTime,
      truncate: this.truncateText,
      extractKeywords: this.extractKeywords,
    };

    // 使用简单的模板引擎渲染
    return this.renderTemplateString(template.template, renderContext);
  }

  createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTemplate: PromptTemplate = {
      ...template,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(id, newTemplate);
    this.saveTemplate(newTemplate);

    return id;
  }

  updateTemplate(templateId: string, updates: Partial<PromptTemplate>): void {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    if (template.isBuiltin) {
      throw new Error('Cannot modify builtin template');
    }

    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updatedTemplate);
    this.saveTemplate(updatedTemplate);
  }

  deleteTemplate(templateId: string): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    if (template.isBuiltin) {
      throw new Error('Cannot delete builtin template');
    }

    this.templates.delete(templateId);
    this.deleteStoredTemplate(templateId);
  }

  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  private loadBuiltinTemplates(): void {
    const builtinTemplates: PromptTemplate[] = [
      {
        id: 'summary-comprehensive',
        name: '综合总结',
        category: 'summary',
        description: '生成包含要点、金句和行动项的综合总结',
        template: SUMMARY_COMPREHENSIVE_TEMPLATE,
        variables: [
          {
            name: 'focus_areas',
            type: 'array',
            description: '重点关注的领域',
            required: false,
            defaultValue: [],
          },
          {
            name: 'max_points',
            type: 'number',
            description: '最大要点数量',
            required: false,
            defaultValue: 8,
          },
        ],
        version: '1.0',
        isBuiltin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // 更多内置模板...
    ];

    builtinTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  private validateVariables(template: PromptTemplate, variables: Record<string, any>): void {
    for (const variable of template.variables) {
      const value = variables[variable.name];

      if (variable.required && (value === undefined || value === null)) {
        throw new Error(`Required variable '${variable.name}' is missing`);
      }

      if (value !== undefined && variable.validation) {
        this.validateVariableValue(variable, value);
      }
    }
  }

  private validateVariableValue(variable: PromptVariable, value: any): void {
    const { validation } = variable;
    if (!validation) return;

    if (variable.type === 'string' && typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        throw new Error(`Variable '${variable.name}' is too short`);
      }

      if (validation.maxLength && value.length > validation.maxLength) {
        throw new Error(`Variable '${variable.name}' is too long`);
      }

      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        throw new Error(`Variable '${variable.name}' does not match pattern`);
      }

      if (validation.options && !validation.options.includes(value)) {
        throw new Error(`Variable '${variable.name}' must be one of: ${validation.options.join(', ')}`);
      }
    }
  }

  private renderTemplateString(template: string, context: Record<string, any>): string {
    // 简单的模板引擎实现
    let rendered = template;

    // 替换变量 ${variable}
    rendered = rendered.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const keys = varName.split('.');
      let value = context;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return match; // 保持原样
        }
      }

      if (typeof value === 'function') {
        return value();
      }

      return String(value ?? '');
    });

    // 处理条件语句 {{#if condition}}...{{/if}}
    rendered = rendered.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const conditionValue = this.evaluateCondition(condition, context);
      return conditionValue ? content : '';
    });

    // 处理循环语句 {{#each array}}...{{/each}}
    rendered = rendered.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
      const array = context[arrayName];
      if (!Array.isArray(array)) return '';

      return array.map((item, index) => {
        return content
          .replace(/\{\{this\}\}/g, String(item))
          .replace(/\{\{@index\}\}/g, String(index))
          .replace(/\{\{([^}]+)\}\}/g, (m, prop) => String(item[prop] ?? ''));
      }).join('');
    });

    return rendered.trim();
  }

  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    // 简化的条件评估
    const value = context[condition.trim()];
    return Boolean(value);
  }

  private formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  private truncateText = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  private extractKeywords = (text: string): string[] => {
    // 简化的关键词提取
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['的', '是', '在', '了', '和', 'the', 'a', 'an', 'and', 'or', 'but']);

    return [...new Set(words.filter(word =>
      word.length > 2 && !stopWords.has(word)
    ))].slice(0, 10);
  };
}
```

### 内置模板定义
```typescript
// src/main/services/ai/templates/summaryTemplates.ts
export const SUMMARY_COMPREHENSIVE_TEMPLATE = `
你是一位专业的播客内容总结专家。请根据以下播客转写内容，生成一份高质量的综合总结。

播客信息：
- 标题：${title}
- 时长：${formatTime(duration)}
- 说话人数：${speakerCount}
- 语言：${language}

转写内容：
---
${transcript}
---

请按照以下格式生成总结：

## 📝 核心要点 (${max_points || 8}条)

{{#if focus_areas}}
重点关注领域：${focus_areas.join('、')}
{{/if}}

1. [第一个要点，包含具体时间戳]
2. [第二个要点，包含具体时间戳]
...

## 💎 精彩金句

1. "引用原文" - 说话人 (时间戳)
2. "引用原文" - 说话人 (时间戳)
...

## 🎯 行动项目

- [ ] [具体可执行的行动项]
- [ ] [具体可执行的行动项]
...

## 🔍 关键词

${extractKeywords(transcript).join('、')}

## 💡 个人思考

[留给听众填写的思考空间]

---
生成时间：${new Date().toLocaleString()}
`;

export const CHAPTERS_SMART_TEMPLATE = `
你是一位专业的播客编辑专家。请基于以下转写内容，智能识别并创建章节分段。

播客信息：
- 标题：${title}
- 时长：${formatTime(duration)}

转写内容：
---
${transcript}
---

请按照以下要求生成章节：

1. 每个章节应该有清晰的主题边界
2. 章节时长建议在3-15分钟之间
3. 章节标题要简洁有力，体现核心内容
4. 提供每个章节的简要摘要

输出格式（JSON）：

{
  "chapters": [
    {
      "title": "章节标题",
      "startTime": 时间戳(秒),
      "endTime": 时间戳(秒),
      "summary": "章节内容摘要",
      "keyPoints": ["关键点1", "关键点2"],
      "speakers": ["主要说话人"]
    }
  ],
  "totalChapters": 章节总数,
  "averageLength": 平均章节时长
}

请确保：
- 所有时间戳准确对应转写内容
- 章节之间无重叠和空隙
- 标题具有吸引力和描述性
`;

export const MINDMAP_TEMPLATE = `
你是一位知识图谱专家。请将播客内容转换为结构化的思维导图格式。

播客信息：
- 标题：${title}
- 主要内容：${truncate(transcript, 500)}

请创建一个OPML格式的思维导图，包含：

1. 主要话题（二级节点）
2. 关键论点（三级节点）
3. 具体细节（四级节点）

输出OPML格式：

<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>${title} - 思维导图</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
    <outline text="主要话题1">
      <outline text="关键论点1.1">
        <outline text="具体细节1.1.1"/>
        <outline text="具体细节1.1.2"/>
      </outline>
      <outline text="关键论点1.2"/>
    </outline>
    <outline text="主要话题2">
      <!-- 更多内容 -->
    </outline>
  </body>
</opml>

请确保思维导图层次清晰，逻辑合理，便于理解和记忆。
`;
```

## AI内容生成服务

### 内容生成器
```typescript
// src/main/services/ai/ContentGenerator.ts
interface GenerationTask {
  id: string;
  type: 'summary' | 'chapters' | 'mindmap';
  episodeId: string;
  templateId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

class ContentGenerator {
  private providerManager: AIProviderManager;
  private templateManager: PromptTemplateManager;
  private tasks = new Map<string, GenerationTask>();

  constructor(
    providerManager: AIProviderManager,
    templateManager: PromptTemplateManager
  ) {
    this.providerManager = providerManager;
    this.templateManager = templateManager;
  }

  async generateSummary(
    episodeId: string,
    transcript: string,
    episodeMetadata: any,
    options: {
      templateId?: string;
      providerId?: string;
      variables?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const taskId = this.createTask('summary', episodeId, options.templateId || 'summary-comprehensive');

    try {
      await this.updateTaskStatus(taskId, 'processing', 10);

      // 准备模板上下文
      const context: TemplateRenderContext = {
        title: episodeMetadata.title,
        description: episodeMetadata.description || '',
        duration: episodeMetadata.duration || 0,
        transcript,
        chapters: episodeMetadata.chapters || [],
        metadata: episodeMetadata,
        language: this.detectLanguage(transcript),
        speakerCount: this.countSpeakers(transcript),
      };

      await this.updateTaskStatus(taskId, 'processing', 30);

      // 渲染Prompt
      const prompt = await this.templateManager.renderTemplate(
        options.templateId || 'summary-comprehensive',
        context,
        options.variables || {}
      );

      await this.updateTaskStatus(taskId, 'processing', 50);

      // 调用AI生成
      const result = await this.providerManager.generateText(
        options.providerId || 'openai',
        prompt,
        {
          temperature: 0.3,
          maxTokens: 2048,
        }
      );

      await this.updateTaskStatus(taskId, 'completed', 100);

      // 保存结果
      await this.saveGenerationResult(taskId, 'summary', episodeId, {
        content: result.text,
        cost: result.cost,
        templateId: options.templateId,
        providerId: options.providerId,
      });

      return result.text;

    } catch (error) {
      await this.updateTaskStatus(taskId, 'failed', 0);
      await this.updateTaskError(taskId, error.message);
      throw error;
    }
  }

  async generateChapters(
    episodeId: string,
    transcript: string,
    episodeMetadata: any,
    options: {
      templateId?: string;
      providerId?: string;
      minChapterDuration?: number;
      maxChapterDuration?: number;
    } = {}
  ): Promise<Chapter[]> {
    const taskId = this.createTask('chapters', episodeId, options.templateId || 'chapters-smart');

    try {
      await this.updateTaskStatus(taskId, 'processing', 10);

      const context: TemplateRenderContext = {
        title: episodeMetadata.title,
        description: episodeMetadata.description || '',
        duration: episodeMetadata.duration || 0,
        transcript,
        chapters: [],
        metadata: episodeMetadata,
        language: this.detectLanguage(transcript),
        speakerCount: this.countSpeakers(transcript),
      };

      await this.updateTaskStatus(taskId, 'processing', 30);

      const prompt = await this.templateManager.renderTemplate(
        options.templateId || 'chapters-smart',
        context,
        {
          minChapterDuration: options.minChapterDuration || 180,
          maxChapterDuration: options.maxChapterDuration || 900,
        }
      );

      await this.updateTaskStatus(taskId, 'processing', 50);

      const result = await this.providerManager.generateText(
        options.providerId || 'openai',
        prompt,
        {
          temperature: 0.2,
          maxTokens: 1024,
        }
      );

      // 解析JSON结果
      const chaptersData = this.parseChaptersResponse(result.text);

      await this.updateTaskStatus(taskId, 'completed', 100);

      await this.saveGenerationResult(taskId, 'chapters', episodeId, {
        chapters: chaptersData.chapters,
        cost: result.cost,
        templateId: options.templateId,
        providerId: options.providerId,
      });

      return chaptersData.chapters;

    } catch (error) {
      await this.updateTaskStatus(taskId, 'failed', 0);
      await this.updateTaskError(taskId, error.message);
      throw error;
    }
  }

  async generateMindmap(
    episodeId: string,
    transcript: string,
    episodeMetadata: any,
    options: {
      templateId?: string;
      providerId?: string;
      format?: 'opml' | 'json';
    } = {}
  ): Promise<string> {
    const taskId = this.createTask('mindmap', episodeId, options.templateId || 'mindmap');

    try {
      await this.updateTaskStatus(taskId, 'processing', 20);

      const context: TemplateRenderContext = {
        title: episodeMetadata.title,
        description: episodeMetadata.description || '',
        duration: episodeMetadata.duration || 0,
        transcript,
        chapters: episodeMetadata.chapters || [],
        metadata: episodeMetadata,
        language: this.detectLanguage(transcript),
        speakerCount: this.countSpeakers(transcript),
      };

      await this.updateTaskStatus(taskId, 'processing', 50);

      const prompt = await this.templateManager.renderTemplate(
        options.templateId || 'mindmap',
        context,
        { format: options.format || 'opml' }
      );

      const result = await this.providerManager.generateText(
        options.providerId || 'openai',
        prompt,
        {
          temperature: 0.1,
          maxTokens: 1536,
        }
      );

      await this.updateTaskStatus(taskId, 'completed', 100);

      await this.saveGenerationResult(taskId, 'mindmap', episodeId, {
        content: result.text,
        cost: result.cost,
        format: options.format,
        templateId: options.templateId,
        providerId: options.providerId,
      });

      return result.text;

    } catch (error) {
      await this.updateTaskStatus(taskId, 'failed', 0);
      await this.updateTaskError(taskId, error.message);
      throw error;
    }
  }

  getTask(taskId: string): GenerationTask | undefined {
    return this.tasks.get(taskId);
  }

  async getGenerationHistory(episodeId: string): Promise<any[]> {
    const db = await getDatabase();
    return db.all(`
      SELECT * FROM ai_generation_results
      WHERE episode_id = ?
      ORDER BY created_at DESC
    `, [episodeId]);
  }

  private createTask(type: GenerationTask['type'], episodeId: string, templateId: string): string {
    const taskId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task: GenerationTask = {
      id: taskId,
      type,
      episodeId,
      templateId,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
    };

    this.tasks.set(taskId, task);
    return taskId;
  }

  private async updateTaskStatus(taskId: string, status: GenerationTask['status'], progress: number): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.progress = progress;

      if (status === 'completed' || status === 'failed') {
        task.completedAt = new Date();
      }
    }
  }

  private async updateTaskError(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.error = error;
    }
  }

  private detectLanguage(text: string): string {
    // 简化的语言检测
    const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length;
    return chineseRatio > 0.3 ? 'zh' : 'en';
  }

  private countSpeakers(transcript: string): number {
    const speakers = new Set();
    const lines = transcript.split('\n');

    for (const line of lines) {
      const speakerMatch = line.match(/^(S\d+|Speaker\s*\d*):/);
      if (speakerMatch) {
        speakers.add(speakerMatch[1]);
      }
    }

    return speakers.size || 1;
  }

  private parseChaptersResponse(response: string): { chapters: Chapter[] } {
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Failed to parse chapters response:', error);
      throw new Error('Invalid chapters response format');
    }
  }

  private async saveGenerationResult(
    taskId: string,
    type: string,
    episodeId: string,
    result: any
  ): Promise<void> {
    const db = await getDatabase();
    await db.run(`
      INSERT INTO ai_generation_results (
        task_id, type, episode_id, result_data,
        created_at, cost, template_id, provider_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      taskId,
      type,
      episodeId,
      JSON.stringify(result),
      new Date().toISOString(),
      result.cost || 0,
      result.templateId || '',
      result.providerId || '',
    ]);
  }
}
```

## 相关文件
- `src/main/services/ai/PromptTemplateManager.ts` - 模板管理
- `src/main/services/ai/ContentGenerator.ts` - 内容生成服务
- `src/main/services/ai/templates/` - 内置模板目录
- `src/renderer/components/AI/SummaryGenerator.tsx` - 总结生成界面
- `src/renderer/components/AI/ChapterGenerator.tsx` - 章节生成界面

## 后续任务依赖
- task_stage4_markdown_export