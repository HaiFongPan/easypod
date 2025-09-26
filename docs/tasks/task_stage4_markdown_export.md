# 任务：Markdown导出

## 任务信息
- **阶段**: 4 - AI功能集成
- **估时**: 8小时
- **优先级**: 中
- **依赖**: task_stage4_summary_and_chaptering

## 任务目标
实现播客内容的标准化Markdown导出功能，支持多种格式和自定义模板。

## 具体任务
1. **模板化Markdown生成**
   - 可配置的导出模板
   - 支持多种Markdown风格
   - 自定义字段和格式
   - 模板预览和编辑

2. **元数据和内容格式化**
   - Front Matter支持
   - 标题层次结构优化
   - 时间戳和链接处理
   - 图片和媒体引用

3. **文件路径管理和命名规则**
   - 智能文件命名
   - 目录结构组织
   - 重复文件处理
   - 批量导出支持

4. **导出选项和配置**
   - 内容选择和过滤
   - 格式化选项设置
   - 附件包含策略
   - 导出进度跟踪

## 验收标准
- [ ] 生成的Markdown格式符合标准
- [ ] 支持GitHub/Obsidian/Notion风格
- [ ] 元数据完整且格式正确
- [ ] 文件命名规则灵活可配置
- [ ] 批量导出性能良好
- [ ] 导出内容可读性高

## Markdown导出服务

### 导出模板系统
```typescript
// src/main/services/export/MarkdownExporter.ts
interface MarkdownExportOptions {
  template: 'standard' | 'obsidian' | 'github' | 'custom';
  includeMetadata: boolean;
  includeFrontMatter: boolean;
  includeTableOfContents: boolean;
  includeTranscript: boolean;
  includeChapters: boolean;
  includeSummary: boolean;
  includeTimestamps: boolean;
  imageHandling: 'embed' | 'link' | 'copy';
  fileNaming: string; // 模板字符串
  outputDirectory: string;
  customTemplate?: string;
}

interface MarkdownTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  frontMatterFields: string[];
  supportsTableOfContents: boolean;
  timestampFormat: 'link' | 'plain' | 'badge';
}

class MarkdownExporter {
  private templates = new Map<string, MarkdownTemplate>();

  constructor() {
    this.loadBuiltinTemplates();
  }

  async exportEpisode(
    episode: Episode,
    options: MarkdownExportOptions
  ): Promise<{ filePath: string; content: string }> {
    const template = this.getTemplate(options.template, options.customTemplate);

    // 收集所有数据
    const exportData = await this.collectExportData(episode, options);

    // 生成文件名
    const fileName = this.generateFileName(episode, options.fileNaming);
    const filePath = path.join(options.outputDirectory, fileName);

    // 渲染模板
    const content = await this.renderTemplate(template, exportData, options);

    // 处理附件
    if (options.imageHandling === 'copy') {
      await this.copyAttachments(exportData, options.outputDirectory);
    }

    // 写入文件
    await this.ensureDirectoryExists(options.outputDirectory);
    await fs.writeFile(filePath, content, 'utf-8');

    return { filePath, content };
  }

  async batchExportEpisodes(
    episodes: Episode[],
    options: MarkdownExportOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ filePath: string; episodeId: string }[]> {
    const results: { filePath: string; episodeId: string }[] = [];

    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];

      try {
        const result = await this.exportEpisode(episode, {
          ...options,
          outputDirectory: path.join(options.outputDirectory, this.sanitizeFileName(episode.feedTitle)),
        });

        results.push({
          filePath: result.filePath,
          episodeId: episode.id,
        });

        onProgress?.(i + 1, episodes.length);
      } catch (error) {
        console.error(`Failed to export episode ${episode.id}:`, error);
      }
    }

    return results;
  }

  private async collectExportData(episode: Episode, options: MarkdownExportOptions): Promise<any> {
    const data: any = {
      // 基本信息
      title: episode.title,
      feedTitle: episode.feedTitle,
      description: episode.description,
      pubDate: episode.pubDate,
      duration: episode.duration,
      audioUrl: episode.audioUrl,
      episodeImage: episode.episodeImage,
      guid: episode.guid,

      // 播放统计
      playCount: episode.playCount || 0,
      lastPlayedAt: episode.lastPlayedAt,
      isCompleted: episode.status === 'completed',

      // 导出时间
      exportedAt: new Date(),
    };

    // 章节信息
    if (options.includeChapters) {
      data.chapters = await this.getEpisodeChapters(episode.id);
    }

    // 转写内容
    if (options.includeTranscript) {
      data.transcript = await this.getEpisodeTranscript(episode.id);
    }

    // AI生成的内容
    if (options.includeSummary) {
      data.summary = await this.getEpisodeSummary(episode.id);
      data.aiChapters = await this.getAIGeneratedChapters(episode.id);
      data.mindmap = await this.getEpisodeMindmap(episode.id);
    }

    return data;
  }

  private getTemplate(templateType: string, customTemplate?: string): MarkdownTemplate {
    if (templateType === 'custom' && customTemplate) {
      return {
        id: 'custom',
        name: 'Custom Template',
        description: 'User defined template',
        template: customTemplate,
        frontMatterFields: ['title', 'date', 'tags'],
        supportsTableOfContents: true,
        timestampFormat: 'link',
      };
    }

    const template = this.templates.get(templateType);
    if (!template) {
      throw new Error(`Template ${templateType} not found`);
    }

    return template;
  }

  private async renderTemplate(
    template: MarkdownTemplate,
    data: any,
    options: MarkdownExportOptions
  ): Promise<string> {
    let content = '';

    // 添加Front Matter
    if (options.includeFrontMatter) {
      content += this.generateFrontMatter(data, template.frontMatterFields);
      content += '\n';
    }

    // 渲染主模板
    content += this.processTemplate(template.template, data, options);

    // 后处理
    content = this.postProcessContent(content, options);

    return content;
  }

  private generateFrontMatter(data: any, fields: string[]): string {
    const frontMatter: Record<string, any> = {};

    fields.forEach(field => {
      switch (field) {
        case 'title':
          frontMatter.title = data.title;
          break;
        case 'date':
          frontMatter.date = data.pubDate?.toISOString?.() || new Date().toISOString();
          break;
        case 'tags':
          frontMatter.tags = ['podcast', data.feedTitle];
          break;
        case 'duration':
          frontMatter.duration = this.formatDuration(data.duration);
          break;
        case 'guid':
          frontMatter.guid = data.guid;
          break;
        case 'audio_url':
          frontMatter.audio_url = data.audioUrl;
          break;
        case 'completed':
          frontMatter.completed = data.isCompleted;
          break;
        default:
          if (data[field] !== undefined) {
            frontMatter[field] = data[field];
          }
      }
    });

    const yamlContent = Object.entries(frontMatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
        } else if (typeof value === 'string' && value.includes('\n')) {
          return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`;
        } else {
          return `${key}: ${JSON.stringify(value)}`;
        }
      })
      .join('\n');

    return `---\n${yamlContent}\n---\n`;
  }

  private processTemplate(template: string, data: any, options: MarkdownExportOptions): string {
    let content = template;

    // 基本变量替换
    content = content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return data[varName] || match;
    });

    // 条件内容
    content = content.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, innerContent) => {
      return data[condition] ? innerContent : '';
    });

    // 章节处理
    if (data.chapters && options.includeChapters) {
      const chaptersContent = this.generateChaptersContent(data.chapters, options);
      content = content.replace(/\{\{chapters\}\}/g, chaptersContent);
    }

    // 转写内容处理
    if (data.transcript && options.includeTranscript) {
      const transcriptContent = this.generateTranscriptContent(data.transcript, options);
      content = content.replace(/\{\{transcript\}\}/g, transcriptContent);
    }

    // AI总结处理
    if (data.summary && options.includeSummary) {
      content = content.replace(/\{\{summary\}\}/g, data.summary);
    }

    return content;
  }

  private generateChaptersContent(chapters: Chapter[], options: MarkdownExportOptions): string {
    if (!chapters.length) return '';

    const chapterLines = chapters.map((chapter, index) => {
      const timeStr = this.formatTime(chapter.startTime);
      const title = chapter.title || `Chapter ${index + 1}`;

      if (options.includeTimestamps) {
        return `${index + 1}. [${timeStr}] ${title}`;
      } else {
        return `${index + 1}. ${title}`;
      }
    });

    return `## 📚 Chapters\n\n${chapterLines.join('\n')}\n`;
  }

  private generateTranscriptContent(segments: TranscriptSegment[], options: MarkdownExportOptions): string {
    if (!segments.length) return '';

    let transcriptContent = '## 📝 Transcript\n\n';

    const groupedSegments = this.groupSegmentsBySpeaker(segments);

    for (const group of groupedSegments) {
      if (options.includeTimestamps) {
        const timeStr = this.formatTime(group.startTime);
        transcriptContent += `**${group.speaker}** [${timeStr}]\n\n`;
      } else {
        transcriptContent += `**${group.speaker}**\n\n`;
      }

      transcriptContent += `${group.text}\n\n`;
    }

    return transcriptContent;
  }

  private groupSegmentsBySpeaker(segments: TranscriptSegment[]): Array<{
    speaker: string;
    startTime: number;
    text: string;
  }> {
    const groups: Array<{
      speaker: string;
      startTime: number;
      text: string;
    }> = [];

    let currentGroup: any = null;

    for (const segment of segments) {
      if (!currentGroup || currentGroup.speaker !== segment.speaker) {
        if (currentGroup) {
          groups.push(currentGroup);
        }

        currentGroup = {
          speaker: segment.speaker,
          startTime: segment.start,
          text: segment.text,
        };
      } else {
        currentGroup.text += ' ' + segment.text;
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private postProcessContent(content: string, options: MarkdownExportOptions): string {
    // 清理多余的空行
    content = content.replace(/\n{3,}/g, '\n\n');

    // 确保标题前后有空行
    content = content.replace(/^(#{1,6}\s+.+)$/gm, '\n$1\n');

    // 处理时间戳链接
    if (options.includeTimestamps) {
      content = content.replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, (match, time) => {
        // 可以生成播放器链接或保持原样
        return match;
      });
    }

    return content.trim() + '\n';
  }

  private generateFileName(episode: Episode, template: string): string {
    const date = episode.pubDate || new Date();
    const variables = {
      title: this.sanitizeFileName(episode.title),
      feedTitle: this.sanitizeFileName(episode.feedTitle),
      date: date.toISOString().split('T')[0],
      year: date.getFullYear().toString(),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      day: date.getDate().toString().padStart(2, '0'),
      guid: episode.guid.substring(0, 8),
    };

    let fileName = template;

    Object.entries(variables).forEach(([key, value]) => {
      fileName = fileName.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });

    // 确保以.md结尾
    if (!fileName.endsWith('.md')) {
      fileName += '.md';
    }

    return fileName;
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '') // 移除非法字符
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/-+/g, '-') // 多个连字符合并为一个
      .replace(/^-|-$/g, ''); // 移除首尾连字符
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private loadBuiltinTemplates(): void {
    const templates: MarkdownTemplate[] = [
      {
        id: 'standard',
        name: 'Standard Markdown',
        description: 'Basic markdown format suitable for most platforms',
        template: STANDARD_MARKDOWN_TEMPLATE,
        frontMatterFields: ['title', 'date', 'tags', 'duration'],
        supportsTableOfContents: true,
        timestampFormat: 'plain',
      },
      {
        id: 'obsidian',
        name: 'Obsidian',
        description: 'Optimized for Obsidian with backlinks and tags',
        template: OBSIDIAN_MARKDOWN_TEMPLATE,
        frontMatterFields: ['title', 'date', 'tags', 'duration', 'guid'],
        supportsTableOfContents: true,
        timestampFormat: 'link',
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'GitHub flavored markdown with table of contents',
        template: GITHUB_MARKDOWN_TEMPLATE,
        frontMatterFields: ['title', 'date'],
        supportsTableOfContents: true,
        timestampFormat: 'badge',
      },
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }
}
```

### 内置模板定义
```typescript
// src/main/services/export/templates/markdownTemplates.ts
export const STANDARD_MARKDOWN_TEMPLATE = `
# {{title}}

**Podcast:** {{feedTitle}}
**Date:** {{pubDate}}
**Duration:** {{duration}}

{{#if description}}
## 📄 Description

{{description}}
{{/if}}

{{chapters}}

{{summary}}

{{transcript}}

---

*Exported from EasyPod on {{exportedAt}}*
`;

export const OBSIDIAN_MARKDOWN_TEMPLATE = `
# {{title}}

**Podcast:** [[{{feedTitle}}]]
**Date:** {{pubDate}}
**Duration:** {{duration}}

#podcast #{{feedTitle}}

{{#if description}}
## 📄 Description

{{description}}
{{/if}}

{{chapters}}

{{summary}}

{{transcript}}

## 🔗 Related

- [[Podcast Notes MOC]]
- [[{{feedTitle}} - Episodes]]

---

*Exported from EasyPod on {{exportedAt}}*
*GUID: {{guid}}*
`;

export const GITHUB_MARKDOWN_TEMPLATE = `
# {{title}}

[![Podcast](https://img.shields.io/badge/Podcast-{{feedTitle}}-blue)]()
[![Duration](https://img.shields.io/badge/Duration-{{duration}}-green)]()

## Table of Contents

- [Description](#description)
- [Chapters](#chapters)
- [Summary](#summary)
- [Transcript](#transcript)

{{#if description}}
## Description

{{description}}
{{/if}}

{{chapters}}

{{summary}}

{{transcript}}

---

<sub>Exported from EasyPod | Generated on {{exportedAt}}</sub>
`;
```

## 导出配置界面

### 导出选项组件
```tsx
// src/renderer/components/Export/MarkdownExportDialog.tsx
interface MarkdownExportDialogProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: MarkdownExportOptions) => Promise<void>;
}

const MarkdownExportDialog: React.FC<MarkdownExportDialogProps> = ({
  episode,
  isOpen,
  onClose,
  onExport,
}) => {
  const [options, setOptions] = useState<MarkdownExportOptions>({
    template: 'standard',
    includeMetadata: true,
    includeFrontMatter: true,
    includeTableOfContents: true,
    includeTranscript: true,
    includeChapters: true,
    includeSummary: true,
    includeTimestamps: true,
    imageHandling: 'link',
    fileNaming: '{date} - {title}',
    outputDirectory: '',
  });

  const [previewContent, setPreviewContent] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!options.outputDirectory) {
      // 打开文件夹选择对话框
      const result = await window.electron.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Export Directory',
      });

      if (result.canceled || !result.filePaths[0]) {
        return;
      }

      setOptions(prev => ({
        ...prev,
        outputDirectory: result.filePaths[0],
      }));
    }

    setIsExporting(true);
    try {
      await onExport(options);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const generatePreview = async () => {
    try {
      const preview = await window.electron.generateMarkdownPreview(episode.id, options);
      setPreviewContent(preview);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      generatePreview();
    }
  }, [isOpen, options]);

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Export to Markdown</DialogTitle>

      <DialogContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 配置选项 */}
          <div className="space-y-4">
            <div>
              <Label>Template</Label>
              <Select
                value={options.template}
                onChange={(value) => setOptions(prev => ({ ...prev, template: value }))}
              >
                <option value="standard">Standard Markdown</option>
                <option value="obsidian">Obsidian</option>
                <option value="github">GitHub</option>
                <option value="custom">Custom</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Content Options</Label>

              <Checkbox
                checked={options.includeFrontMatter}
                onChange={(checked) => setOptions(prev => ({ ...prev, includeFrontMatter: checked }))}
                label="Include Front Matter"
              />

              <Checkbox
                checked={options.includeChapters}
                onChange={(checked) => setOptions(prev => ({ ...prev, includeChapters: checked }))}
                label="Include Chapters"
              />

              <Checkbox
                checked={options.includeSummary}
                onChange={(checked) => setOptions(prev => ({ ...prev, includeSummary: checked }))}
                label="Include AI Summary"
              />

              <Checkbox
                checked={options.includeTranscript}
                onChange={(checked) => setOptions(prev => ({ ...prev, includeTranscript: checked }))}
                label="Include Transcript"
              />

              <Checkbox
                checked={options.includeTimestamps}
                onChange={(checked) => setOptions(prev => ({ ...prev, includeTimestamps: checked }))}
                label="Include Timestamps"
              />
            </div>

            <div>
              <Label>File Naming</Label>
              <Input
                value={options.fileNaming}
                onChange={(e) => setOptions(prev => ({ ...prev, fileNaming: e.target.value }))}
                placeholder="{date} - {title}"
              />
              <p className="text-xs text-gray-500 mt-1">
                Variables: {'{title}'}, {'{feedTitle}'}, {'{date}'}, {'{year}'}, {'{month}'}, {'{day}'}
              </p>
            </div>

            <div>
              <Label>Output Directory</Label>
              <div className="flex gap-2">
                <Input
                  value={options.outputDirectory}
                  onChange={(e) => setOptions(prev => ({ ...prev, outputDirectory: e.target.value }))}
                  placeholder="Select directory..."
                />
                <Button
                  onClick={async () => {
                    const result = await window.electron.showOpenDialog({
                      properties: ['openDirectory'],
                    });
                    if (!result.canceled && result.filePaths[0]) {
                      setOptions(prev => ({ ...prev, outputDirectory: result.filePaths[0] }));
                    }
                  }}
                >
                  Browse
                </Button>
              </div>
            </div>
          </div>

          {/* 预览 */}
          <div>
            <Label>Preview</Label>
            <div className="border rounded-lg p-4 h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              <pre className="whitespace-pre-wrap text-sm">
                {previewContent}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="primary"
          disabled={isExporting || !options.outputDirectory}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

## 相关文件
- `src/main/services/export/MarkdownExporter.ts` - 导出服务
- `src/main/services/export/templates/` - 模板定义目录
- `src/renderer/components/Export/MarkdownExportDialog.tsx` - 导出配置界面
- `src/main/ipc/exportHandlers.ts` - IPC导出处理器

## 后续任务依赖
- task_stage5_obsidian_export
- task_stage5_dmg_packaging