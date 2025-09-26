# 任务：Obsidian本地导出

## 任务信息
- **阶段**: 5 - Obsidian导出和应用打包
- **估时**: 12小时
- **优先级**: 高
- **依赖**: task_stage4_markdown_export

## 任务目标
实现与Obsidian笔记应用的深度集成，支持自动检测vault、双链创建和标签管理。

## 具体任务
1. **检测Obsidian vault目录**
   - 自动扫描常见vault位置
   - vault配置文件解析
   - 用户手动选择vault支持
   - 多vault管理和切换

2. **YAML Front Matter生成**
   - Obsidian特定字段支持
   - 自定义属性映射
   - 模板化Front Matter
   - 属性类型验证

3. **双链和标签支持**
   - 播客节目双链创建
   - 相关笔记自动关联
   - 标签自动生成和管理
   - MOC(Map of Content)集成

4. **文件冲突处理和更新逻辑**
   - 重复导出检测
   - 增量更新策略
   - 版本冲突解决
   - 备份和恢复机制

## 验收标准
- [ ] 能自动检测90%的标准Obsidian安装
- [ ] Front Matter格式完全兼容Obsidian
- [ ] 双链和标签功能正常工作
- [ ] 支持增量更新不重复创建
- [ ] 文件冲突处理用户友好
- [ ] 与Obsidian插件生态兼容

## Obsidian集成服务

### Vault检测和管理
```typescript
// src/main/services/obsidian/ObsidianVaultManager.ts
interface ObsidianVault {
  id: string;
  name: string;
  path: string;
  configPath: string;
  isValid: boolean;
  lastAccessed: Date;
  metadata: {
    noteCount: number;
    pluginsEnabled: string[];
    themes: string[];
    version: string;
  };
}

interface VaultConfig {
  pluginEnabledStatus: Record<string, boolean>;
  theme: string;
  cssTheme: string;
  hotkeys: Record<string, any>;
  workspaceLayout: any;
}

class ObsidianVaultManager {
  private knownVaults = new Map<string, ObsidianVault>();

  async scanForVaults(): Promise<ObsidianVault[]> {
    const vaults: ObsidianVault[] = [];

    // 扫描常见的Obsidian配置位置
    const configPaths = this.getObsidianConfigPaths();

    for (const configPath of configPaths) {
      try {
        const foundVaults = await this.scanConfigDirectory(configPath);
        vaults.push(...foundVaults);
      } catch (error) {
        console.warn(`Failed to scan config path ${configPath}:`, error);
      }
    }

    // 更新已知vaults
    vaults.forEach(vault => {
      this.knownVaults.set(vault.id, vault);
    });

    return vaults;
  }

  async validateVault(vaultPath: string): Promise<ObsidianVault | null> {
    try {
      const stats = await fs.stat(vaultPath);
      if (!stats.isDirectory()) {
        return null;
      }

      // 检查是否是有效的Obsidian vault
      const obsidianConfigPath = path.join(vaultPath, '.obsidian');
      const hasObsidianConfig = await this.pathExists(obsidianConfigPath);

      if (!hasObsidianConfig) {
        // 可能是一个普通文件夹，但可以作为vault使用
        console.warn(`No .obsidian config found in ${vaultPath}, treating as basic vault`);
      }

      const vaultName = path.basename(vaultPath);
      const vaultId = this.generateVaultId(vaultPath);

      const vault: ObsidianVault = {
        id: vaultId,
        name: vaultName,
        path: vaultPath,
        configPath: obsidianConfigPath,
        isValid: true,
        lastAccessed: new Date(),
        metadata: await this.collectVaultMetadata(vaultPath, obsidianConfigPath),
      };

      this.knownVaults.set(vaultId, vault);
      return vault;

    } catch (error) {
      console.error(`Failed to validate vault at ${vaultPath}:`, error);
      return null;
    }
  }

  async getVaultConfig(vault: ObsidianVault): Promise<VaultConfig | null> {
    try {
      const configFile = path.join(vault.configPath, 'app.json');
      if (await this.pathExists(configFile)) {
        const configContent = await fs.readFile(configFile, 'utf-8');
        return JSON.parse(configContent);
      }
      return null;
    } catch (error) {
      console.error(`Failed to read vault config for ${vault.name}:`, error);
      return null;
    }
  }

  async createVaultStructure(vault: ObsidianVault): Promise<void> {
    const podcastsDir = path.join(vault.path, 'Podcasts');
    const templatesDir = path.join(vault.path, 'Templates');
    const mocDir = path.join(vault.path, 'MOCs');

    // 创建必要的目录结构
    await this.ensureDirectory(podcastsDir);
    await this.ensureDirectory(templatesDir);
    await this.ensureDirectory(mocDir);

    // 创建MOC文件
    await this.createPodcastMOC(mocDir);

    // 创建模板文件
    await this.createEpisodeTemplate(templatesDir);
  }

  private getObsidianConfigPaths(): string[] {
    const homeDir = os.homedir();
    const platform = os.platform();

    const paths = [];

    if (platform === 'darwin') {
      // macOS
      paths.push(
        path.join(homeDir, 'Library', 'Application Support', 'obsidian'),
        path.join(homeDir, 'Documents', 'Obsidian'),
        path.join(homeDir, 'iCloud Drive (Archive)', 'Obsidian'),
        path.join(homeDir, 'Library', 'Mobile Documents', 'iCloud~md~obsidian', 'Documents'),
      );
    } else if (platform === 'win32') {
      // Windows
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      paths.push(
        path.join(appData, 'obsidian'),
        path.join(homeDir, 'Documents', 'Obsidian'),
        path.join(homeDir, 'OneDrive', 'Obsidian'),
      );
    } else {
      // Linux
      paths.push(
        path.join(homeDir, '.config', 'obsidian'),
        path.join(homeDir, 'Documents', 'Obsidian'),
        path.join(homeDir, 'Obsidian'),
      );
    }

    return paths;
  }

  private async scanConfigDirectory(configPath: string): Promise<ObsidianVault[]> {
    const vaults: ObsidianVault[] = [];

    if (!(await this.pathExists(configPath))) {
      return vaults;
    }

    // 检查Obsidian配置文件
    const obsidianJsonPath = path.join(configPath, 'obsidian.json');
    if (await this.pathExists(obsidianJsonPath)) {
      const config = JSON.parse(await fs.readFile(obsidianJsonPath, 'utf-8'));

      // 从配置中读取vaults
      if (config.vaults && typeof config.vaults === 'object') {
        for (const [vaultId, vaultInfo] of Object.entries(config.vaults as any)) {
          if (vaultInfo.path) {
            const vault = await this.validateVault(vaultInfo.path);
            if (vault) {
              vaults.push(vault);
            }
          }
        }
      }
    }

    // 扫描可能的vault目录
    const commonVaultDirs = [
      path.join(path.dirname(configPath), 'vaults'),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Obsidian'),
    ];

    for (const dir of commonVaultDirs) {
      if (await this.pathExists(dir)) {
        const entries = await fs.readdir(dir);

        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stats = await fs.stat(fullPath);

          if (stats.isDirectory()) {
            const vault = await this.validateVault(fullPath);
            if (vault && !vaults.find(v => v.path === vault.path)) {
              vaults.push(vault);
            }
          }
        }
      }
    }

    return vaults;
  }

  private async collectVaultMetadata(vaultPath: string, configPath: string): Promise<ObsidianVault['metadata']> {
    const metadata = {
      noteCount: 0,
      pluginsEnabled: [] as string[],
      themes: [] as string[],
      version: 'unknown',
    };

    try {
      // 统计笔记数量
      metadata.noteCount = await this.countMarkdownFiles(vaultPath);

      // 读取插件信息
      if (await this.pathExists(configPath)) {
        const communityPluginsPath = path.join(configPath, 'community-plugins.json');
        if (await this.pathExists(communityPluginsPath)) {
          const pluginsContent = await fs.readFile(communityPluginsPath, 'utf-8');
          metadata.pluginsEnabled = JSON.parse(pluginsContent);
        }

        // 读取主题信息
        const themesDir = path.join(configPath, 'themes');
        if (await this.pathExists(themesDir)) {
          const themes = await fs.readdir(themesDir);
          metadata.themes = themes.filter(theme => theme.endsWith('.css'));
        }
      }
    } catch (error) {
      console.warn('Failed to collect vault metadata:', error);
    }

    return metadata;
  }

  private async countMarkdownFiles(dir: string): Promise<number> {
    let count = 0;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          count += await this.countMarkdownFiles(path.join(dir, entry.name));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          count++;
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }

    return count;
  }

  private generateVaultId(vaultPath: string): string {
    return Buffer.from(vaultPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  private async createPodcastMOC(mocDir: string): Promise<void> {
    const mocPath = path.join(mocDir, 'Podcast Notes MOC.md');

    if (await this.pathExists(mocPath)) {
      return; // 已存在
    }

    const mocContent = `# Podcast Notes MOC

## 最近收听

\`\`\`dataview
LIST
FROM #podcast
WHERE file.ctime >= date("today") - dur("7 days")
SORT file.ctime DESC
LIMIT 10
\`\`\`

## 按节目分类

\`\`\`dataview
TABLE length(rows) as "剧集数",
      sum(map(rows.duration, (x) => x)) as "总时长"
FROM #podcast
GROUP BY podcast
SORT rows[0].file.ctime DESC
\`\`\`

## 收藏的剧集

\`\`\`dataview
LIST
FROM #podcast
WHERE contains(tags, "#favorite")
SORT file.ctime DESC
\`\`\`

## 标签索引

#podcast #audio #learning #productivity #tech #business #entertainment

---

*This MOC is maintained by EasyPod*
`;

    await fs.writeFile(mocPath, mocContent, 'utf-8');
  }

  private async createEpisodeTemplate(templatesDir: string): Promise<void> {
    const templatePath = path.join(templatesDir, 'Podcast Episode.md');

    if (await this.pathExists(templatePath)) {
      return; // 已存在
    }

    const templateContent = `---
title: "{{title}}"
podcast: "[[{{podcast}}]]"
date: {{date}}
duration: "{{duration}}"
tags:
  - podcast
  - "{{podcast}}"
status: "{{status}}"
rating:
guid: "{{guid}}"
---

# {{title}}

**Podcast:** [[{{podcast}}]]
**Date:** {{date}}
**Duration:** {{duration}}
**Status:** {{status}}

## 📝 Notes

<!-- 你的笔记 -->

## 🎯 Key Takeaways

-
-
-

## 💭 Thoughts

<!-- 你的思考 -->

## 🔗 Related

- [[Podcast Notes MOC]]
- [[{{podcast}} - Episodes]]

---

*Imported from EasyPod*
`;

    await fs.writeFile(templatePath, templateContent, 'utf-8');
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
```

## Obsidian导出器

### 专用导出服务
```typescript
// src/main/services/obsidian/ObsidianExporter.ts
interface ObsidianExportOptions {
  vaultId: string;
  createBacklinks: boolean;
  updateExisting: boolean;
  generateTags: boolean;
  useTemplates: boolean;
  organizationStructure: 'flat' | 'by-podcast' | 'by-date';
  customTagPrefix?: string;
}

interface ObsidianExportResult {
  filePath: string;
  isNew: boolean;
  backlinksCreated: string[];
  tagsAdded: string[];
}

class ObsidianExporter {
  private vaultManager: ObsidianVaultManager;
  private backlinkTracker = new Map<string, Set<string>>();

  constructor(vaultManager: ObsidianVaultManager) {
    this.vaultManager = vaultManager;
  }

  async exportEpisode(
    episode: Episode,
    options: ObsidianExportOptions
  ): Promise<ObsidianExportResult> {
    const vault = this.vaultManager.getVault(options.vaultId);
    if (!vault) {
      throw new Error(`Vault ${options.vaultId} not found`);
    }

    // 确保vault结构存在
    await this.vaultManager.createVaultStructure(vault);

    // 生成文件路径
    const filePath = await this.generateFilePath(vault, episode, options);

    // 检查是否已存在
    const exists = await this.pathExists(filePath);
    let shouldUpdate = !exists || options.updateExisting;

    if (exists && !options.updateExisting) {
      // 文件存在但不更新，返回现有信息
      return {
        filePath,
        isNew: false,
        backlinksCreated: [],
        tagsAdded: [],
      };
    }

    // 收集导出数据
    const exportData = await this.collectExportData(episode);

    // 生成Front Matter
    const frontMatter = await this.generateObsidianFrontMatter(episode, exportData, options);

    // 生成内容
    const content = await this.generateObsidianContent(episode, exportData, options);

    // 合成最终内容
    const finalContent = `---\n${frontMatter}\n---\n\n${content}`;

    // 写入文件
    await this.ensureDirectoryExists(path.dirname(filePath));
    await fs.writeFile(filePath, finalContent, 'utf-8');

    // 创建反向链接
    const backlinksCreated = await this.createBacklinks(vault, episode, filePath, options);

    // 更新标签索引
    const tagsAdded = await this.updateTagIndex(vault, episode, options);

    // 更新MOC
    await this.updatePodcastMOC(vault, episode, filePath);

    return {
      filePath,
      isNew: !exists,
      backlinksCreated,
      tagsAdded,
    };
  }

  async batchExportEpisodes(
    episodes: Episode[],
    options: ObsidianExportOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<ObsidianExportResult[]> {
    const results: ObsidianExportResult[] = [];

    for (let i = 0; i < episodes.length; i++) {
      try {
        const result = await this.exportEpisode(episodes[i], options);
        results.push(result);
        onProgress?.(i + 1, episodes.length);
      } catch (error) {
        console.error(`Failed to export episode ${episodes[i].id}:`, error);
      }
    }

    return results;
  }

  private async generateFilePath(
    vault: ObsidianVault,
    episode: Episode,
    options: ObsidianExportOptions
  ): Promise<string> {
    let subDir = 'Podcasts';

    switch (options.organizationStructure) {
      case 'by-podcast':
        subDir = path.join('Podcasts', this.sanitizeFileName(episode.feedTitle));
        break;
      case 'by-date':
        const date = episode.pubDate || new Date();
        subDir = path.join('Podcasts', date.getFullYear().toString(), (date.getMonth() + 1).toString().padStart(2, '0'));
        break;
      case 'flat':
      default:
        subDir = 'Podcasts';
        break;
    }

    const fileName = this.generateObsidianFileName(episode);
    return path.join(vault.path, subDir, fileName);
  }

  private generateObsidianFileName(episode: Episode): string {
    const date = episode.pubDate ? episode.pubDate.toISOString().split('T')[0] : 'unknown';
    const title = this.sanitizeFileName(episode.title);
    return `${date} - ${title}.md`;
  }

  private async generateObsidianFrontMatter(
    episode: Episode,
    exportData: any,
    options: ObsidianExportOptions
  ): Promise<string> {
    const frontMatter: Record<string, any> = {
      title: episode.title,
      podcast: `[[${episode.feedTitle}]]`,
      date: episode.pubDate?.toISOString?.() || new Date().toISOString(),
      duration: this.formatDuration(episode.duration || 0),
      status: episode.status || 'new',
      guid: episode.guid,
      audio_url: episode.audioUrl,
    };

    // 添加标签
    if (options.generateTags) {
      const tags = this.generateTags(episode, options);
      frontMatter.tags = tags;
    }

    // 添加自定义属性
    if (episode.episodeNumber) {
      frontMatter.episode = episode.episodeNumber;
    }

    if (episode.seasonNumber) {
      frontMatter.season = episode.seasonNumber;
    }

    if (exportData.summary) {
      frontMatter.has_summary = true;
    }

    if (exportData.transcript) {
      frontMatter.has_transcript = true;
    }

    if (exportData.chapters?.length > 0) {
      frontMatter.chapters = exportData.chapters.length;
    }

    // 转换为YAML格式
    return Object.entries(frontMatter)
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
  }

  private async generateObsidianContent(
    episode: Episode,
    exportData: any,
    options: ObsidianExportOptions
  ): Promise<string> {
    let content = `# ${episode.title}\n\n`;

    // 基本信息
    content += `**Podcast:** [[${episode.feedTitle}]]\n`;
    content += `**Date:** ${episode.pubDate?.toDateString?.()} || 'Unknown'}\n`;
    content += `**Duration:** ${this.formatDuration(episode.duration || 0)}\n\n`;

    // 描述
    if (episode.description) {
      content += `## 📄 Description\n\n${episode.description}\n\n`;
    }

    // 章节
    if (exportData.chapters?.length > 0) {
      content += `## 📚 Chapters\n\n`;
      exportData.chapters.forEach((chapter: any, index: number) => {
        const timeStr = this.formatTime(chapter.startTime);
        content += `${index + 1}. [[#${timeStr}]] ${chapter.title}\n`;
      });
      content += '\n';
    }

    // AI总结
    if (exportData.summary) {
      content += `## 📝 Summary\n\n${exportData.summary}\n\n`;
    }

    // 笔记区域
    content += `## 📓 Notes\n\n<!-- 在此添加你的笔记 -->\n\n`;

    // 关键要点
    content += `## 🎯 Key Takeaways\n\n- \n- \n- \n\n`;

    // 思考
    content += `## 💭 Thoughts\n\n<!-- 在此添加你的思考 -->\n\n`;

    // 转写内容 (可选)
    if (exportData.transcript) {
      content += `## 📜 Transcript\n\n`;
      content += `> [!note]- Click to expand transcript\n`;
      content += `> ${exportData.transcript.replace(/\n/g, '\n> ')}\n\n`;
    }

    // 相关链接
    content += `## 🔗 Related\n\n`;
    content += `- [[Podcast Notes MOC]]\n`;
    content += `- [[${episode.feedTitle} - Episodes]]\n`;

    // 如果有AI生成的章节，添加章节详情
    if (exportData.chapters?.length > 0) {
      content += `\n---\n\n## Chapter Details\n\n`;
      exportData.chapters.forEach((chapter: any) => {
        const timeStr = this.formatTime(chapter.startTime);
        content += `### ${timeStr} ${chapter.title}\n\n`;
        if (chapter.summary) {
          content += `${chapter.summary}\n\n`;
        }
      });
    }

    content += `\n---\n\n*Imported from EasyPod on ${new Date().toLocaleDateString()}*\n`;

    return content;
  }

  private generateTags(episode: Episode, options: ObsidianExportOptions): string[] {
    const tags = ['podcast'];

    // 添加播客名称标签
    const podcastTag = this.sanitizeTag(episode.feedTitle);
    if (podcastTag) {
      tags.push(podcastTag);
    }

    // 添加自定义前缀
    if (options.customTagPrefix) {
      tags.push(options.customTagPrefix);
    }

    // 根据内容类型添加标签
    if (episode.description) {
      const description = episode.description.toLowerCase();

      // 简单的主题检测
      const topicKeywords = {
        tech: ['technology', 'programming', 'software', 'coding', '技术', '编程'],
        business: ['business', 'startup', 'entrepreneur', '商业', '创业'],
        science: ['science', 'research', 'study', '科学', '研究'],
        entertainment: ['movie', 'music', 'game', '电影', '音乐', '游戏'],
        education: ['education', 'learning', 'course', '教育', '学习'],
      };

      Object.entries(topicKeywords).forEach(([topic, keywords]) => {
        if (keywords.some(keyword => description.includes(keyword))) {
          tags.push(topic);
        }
      });
    }

    // 去重并排序
    return [...new Set(tags)].sort();
  }

  private async createBacklinks(
    vault: ObsidianVault,
    episode: Episode,
    filePath: string,
    options: ObsidianExportOptions
  ): Promise<string[]> {
    if (!options.createBacklinks) {
      return [];
    }

    const backlinksCreated: string[] = [];

    // 创建播客系列页面
    const seriesPagePath = path.join(vault.path, 'Podcasts', `${this.sanitizeFileName(episode.feedTitle)} - Episodes.md`);

    if (!(await this.pathExists(seriesPagePath))) {
      await this.createSeriesPage(vault, episode.feedTitle, seriesPagePath);
      backlinksCreated.push(seriesPagePath);
    }

    // 更新系列页面，添加新剧集链接
    await this.updateSeriesPage(seriesPagePath, episode, path.basename(filePath, '.md'));

    return backlinksCreated;
  }

  private async createSeriesPage(vault: ObsidianVault, seriesTitle: string, filePath: string): Promise<void> {
    const content = `# ${seriesTitle} - Episodes

## All Episodes

\`\`\`dataview
TABLE duration as "Duration", date(date) as "Date"
FROM #podcast
WHERE podcast = "[[${seriesTitle}]]"
SORT file.ctime DESC
\`\`\`

## Recent Episodes

\`\`\`dataview
LIST
FROM #podcast
WHERE podcast = "[[${seriesTitle}]]" AND file.ctime >= date("today") - dur("30 days")
SORT file.ctime DESC
\`\`\`

---

*This page is maintained by EasyPod*
`;

    await this.ensureDirectoryExists(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private async updateSeriesPage(seriesPagePath: string, episode: Episode, episodeFileName: string): Promise<void> {
    try {
      let content = await fs.readFile(seriesPagePath, 'utf-8');

      // 检查是否已经包含该剧集的链接
      if (content.includes(`[[${episodeFileName}]]`)) {
        return; // 已存在
      }

      // 在适当位置添加链接 (这里简化处理，实际可能需要更复杂的逻辑)
      const episodeLink = `- [[${episodeFileName}]]\n`;

      // 寻找插入位置 (例如在"## Episodes"部分后)
      const insertionPattern = /(## All Episodes\s*\n)/;
      if (insertionPattern.test(content)) {
        content = content.replace(insertionPattern, `$1\n${episodeLink}`);
        await fs.writeFile(seriesPagePath, content, 'utf-8');
      }
    } catch (error) {
      console.warn(`Failed to update series page ${seriesPagePath}:`, error);
    }
  }

  private async updateTagIndex(vault: ObsidianVault, episode: Episode, options: ObsidianExportOptions): Promise<string[]> {
    if (!options.generateTags) {
      return [];
    }

    // 这里可以实现标签索引更新逻辑
    // 例如更新标签页面、创建标签MOC等
    const tags = this.generateTags(episode, options);

    // 简化实现：只返回生成的标签
    return tags;
  }

  private async updatePodcastMOC(vault: ObsidianVault, episode: Episode, filePath: string): Promise<void> {
    const mocPath = path.join(vault.path, 'MOCs', 'Podcast Notes MOC.md');

    try {
      if (await this.pathExists(mocPath)) {
        // MOC存在，可以添加更新逻辑
        // 这里简化处理，实际可能需要更复杂的MOC管理
      }
    } catch (error) {
      console.warn('Failed to update Podcast MOC:', error);
    }
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '') // 移除非法字符
      .replace(/\s+/g, ' ') // 标准化空格
      .trim()
      .substring(0, 200); // 限制长度
  }

  private sanitizeTag(tag: string): string {
    return tag
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, '') // 只保留字母数字和中文
      .replace(/\s+/g, '')
      .substring(0, 50);
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
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
}
```

## 相关文件
- `src/main/services/obsidian/ObsidianVaultManager.ts` - Vault管理
- `src/main/services/obsidian/ObsidianExporter.ts` - 导出服务
- `src/renderer/components/Export/ObsidianExportDialog.tsx` - 导出配置界面
- `src/main/ipc/obsidianHandlers.ts` - IPC处理器

## 后续任务依赖
- task_stage5_dmg_packaging