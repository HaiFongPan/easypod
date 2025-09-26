# 任务：RSS订阅解析

## 任务信息
- **阶段**: 2 - 订阅和播放功能
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_stage1_sqlite_database

## 任务目标
实现完整的RSS/播客订阅源解析功能，支持多种格式和播客标准。

## 具体任务
1. **rss-parser库集成**
   - 安装和配置rss-parser
   - 设置自定义字段解析器
   - 实现缓存和条件请求(ETag, Last-Modified)
   - 添加请求超时和重试机制

2. **标准RSS和iTunes扩展支持**
   - 解析基础RSS字段(title, description, link)
   - 支持iTunes扩展标签(itunes:image, itunes:duration等)
   - 处理播客分类和关键词
   - 解析作者和版权信息

3. **Podcast 2.0章节信息解析**
   - 支持podcast:chapters JSON格式
   - 解析chapter链接和时间戳
   - 处理章节图片和链接
   - 实现章节数据结构存储

4. **错误处理和容错机制**
   - 网络错误重试策略
   - 无效XML格式处理
   - 字符编码问题处理
   - 部分解析失败的恢复机制

## 验收标准
- [ ] 常见播客RSS源解析成功率≥95%
- [ ] 支持iTunes和Podcast 2.0扩展标签
- [ ] 章节信息正确解析和存储
- [ ] 网络异常情况下的错误处理
- [ ] 解析性能满足实时刷新需求
- [ ] 内存使用合理，无明显泄漏

## RSS解析器设计

### 核心解析器类
```tsx
interface FeedParserOptions {
  timeout: number;
  maxRedirects: number;
  userAgent: string;
  retryAttempts: number;
}

class PodcastFeedParser {
  constructor(private options: FeedParserOptions) {}

  async parseFeed(url: string): Promise<ParsedFeed> {
    try {
      const response = await this.fetchWithRetry(url);
      const feed = await this.parseXML(response.data);
      return this.normalizeFeed(feed);
    } catch (error) {
      throw new FeedParseError(error.message, url);
    }
  }

  private async fetchWithRetry(url: string): Promise<any> {
    // 实现带重试的网络请求
  }

  private parseXML(xmlData: string): Promise<any> {
    // XML解析逻辑
  }

  private normalizeFeed(rawFeed: any): ParsedFeed {
    // 标准化feed数据结构
  }
}
```

### 数据结构定义
```tsx
interface ParsedFeed {
  title: string;
  description: string;
  url: string;
  link: string;
  image?: string;
  author?: string;
  category?: string;
  language?: string;
  copyright?: string;
  lastBuildDate?: Date;
  episodes: ParsedEpisode[];
}

interface ParsedEpisode {
  guid: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  audioUrl: string;
  pubDate: Date;
  duration?: number;
  episodeImage?: string;
  chapters?: ParsedChapter[];
  seasonNumber?: number;
  episodeNumber?: number;
}

interface ParsedChapter {
  title: string;
  startTime: number; // 秒
  endTime?: number;
  image?: string;
  url?: string;
  source: 'json' | 'id3' | 'shownote';
}
```

## 技术要点
- 使用axios进行HTTP请求，支持拦截器
- 实现自定义字段映射器
- 支持多种时间格式解析
- 处理HTML实体和特殊字符
- 实现增量更新机制

## 支持的播客标准
1. **RSS 2.0基础标准**
   - 基础元素(title, link, description)
   - pubDate时间格式处理
   - GUID唯一标识符

2. **iTunes扩展**
   - `<itunes:image>` - 播客封面
   - `<itunes:duration>` - 时长格式
   - `<itunes:summary>` - 详细描述
   - `<itunes:category>` - 分类信息

3. **Podcast 2.0扩展**
   - `<podcast:chapters>` - 章节JSON链接
   - `<podcast:transcript>` - 转写文件链接
   - `<podcast:funding>` - 资助信息
   - `<podcast:person>` - 人员信息

## 解析优化策略
```tsx
class FeedCache {
  private cache = new Map<string, CachedFeed>();

  async getFeed(url: string, etag?: string): Promise<ParsedFeed> {
    const headers: Record<string, string> = {};

    if (etag) {
      headers['If-None-Match'] = etag;
    }

    const cached = this.cache.get(url);
    if (cached?.lastModified) {
      headers['If-Modified-Since'] = cached.lastModified;
    }

    // 条件请求逻辑
  }

  setCachedFeed(url: string, feed: ParsedFeed, etag?: string): void {
    this.cache.set(url, {
      feed,
      etag,
      lastModified: new Date().toISOString(),
      updatedAt: Date.now(),
    });
  }
}
```

## 错误处理分类
1. **网络错误** - 超时、DNS失败、连接拒绝
2. **格式错误** - 无效XML、缺少必需字段
3. **编码错误** - 字符集问题、乱码处理
4. **内容错误** - 损坏的音频URL、无效时间戳

## 相关文件
- `src/main/services/FeedParser.ts` - 主解析器
- `src/main/services/FeedCache.ts` - 缓存管理
- `src/main/utils/feedNormalizer.ts` - 数据标准化
- `src/main/types/feed.ts` - 类型定义

## 后续任务依赖
- task_stage2_subscription_ui
- task_stage2_opml_import_export