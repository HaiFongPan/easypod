# 任务：章节和Shownote展示

## 任务信息
- **阶段**: 2 - 订阅和播放功能
- **估时**: 12小时
- **优先级**: 高
- **依赖**: task_stage2_rss_parsing

## 任务目标
实现章节导航和播客节目笔记(Shownote)的显示功能，支持时间戳跳转和响应式布局。

## 具体任务
1. **章节列表和时间戳跳转**
   - 创建章节列表组件
   - 实现章节点击跳转功能
   - 显示章节进度和高亮当前章节
   - 支持章节封面和链接

2. **Shownote HTML渲染**
   - 安全的HTML内容渲染
   - 使用sanitize-html防止XSS攻击
   - 支持常见HTML标签和样式
   - 实现内容滚动和搜索

3. **时间戳链接解析和跳转**
   - 正则表达式匹配时间戳格式
   - 支持多种时间格式(HH:MM:SS, MM:SS)
   - 时间戳点击跳转播放位置
   - 时间戳样式高亮显示

4. **响应式布局适配**
   - 左右分栏布局设计
   - 章节/Shownote切换标签页
   - 移动端适配和触摸优化
   - 可拖拽调整面板大小

## 验收标准
- [ ] 章节跳转准确性≥99% (误差≤1秒)
- [ ] 时间戳解析准确率≥80%
- [ ] HTML渲染安全，无XSS风险
- [ ] 响应式布局在不同屏幕尺寸下正常
- [ ] 章节/Shownote面板切换流畅
- [ ] 支持键盘导航和无障碍访问

## 章节组件设计

### 章节列表组件
```tsx
interface ChapterListProps {
  chapters: Chapter[];
  currentTime: number;
  onChapterClick: (startTime: number) => void;
  onChapterImageClick?: (imageUrl: string) => void;
}

interface Chapter {
  id: string;
  title: string;
  startTime: number; // 秒
  endTime?: number;
  imageUrl?: string;
  url?: string;
  source: 'json' | 'id3' | 'shownote';
}

const ChapterList: React.FC<ChapterListProps> = ({
  chapters,
  currentTime,
  onChapterClick,
  onChapterImageClick,
}) => {
  const getCurrentChapterIndex = () => {
    return chapters.findIndex((chapter, index) => {
      const nextChapter = chapters[index + 1];
      return currentTime >= chapter.startTime &&
             (!nextChapter || currentTime < nextChapter.startTime);
    });
  };

  const currentChapterIndex = getCurrentChapterIndex();

  return (
    <div className="chapter-list">
      <h3 className="text-sm font-medium mb-3">Chapters</h3>
      <div className="space-y-2">
        {chapters.map((chapter, index) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            isActive={index === currentChapterIndex}
            onClick={() => onChapterClick(chapter.startTime)}
            onImageClick={onChapterImageClick}
          />
        ))}
      </div>
    </div>
  );
};
```

### 单个章节组件
```tsx
interface ChapterItemProps {
  chapter: Chapter;
  isActive: boolean;
  onClick: () => void;
  onImageClick?: (imageUrl: string) => void;
}

const ChapterItem: React.FC<ChapterItemProps> = ({
  chapter,
  isActive,
  onClick,
  onImageClick,
}) => {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`chapter-item cursor-pointer p-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900 border-l-2 border-blue-500'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {chapter.imageUrl && (
          <img
            src={chapter.imageUrl}
            alt={chapter.title}
            className="w-10 h-10 rounded cursor-pointer object-cover"
            onClick={(e) => {
              e.stopPropagation();
              onImageClick?.(chapter.imageUrl!);
            }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
              {formatTime(chapter.startTime)}
            </span>
            <span className="text-xs text-gray-500 capitalize">
              {chapter.source}
            </span>
          </div>

          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {chapter.title}
          </h4>

          {chapter.url && (
            <a
              href={chapter.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              onClick={(e) => e.stopPropagation()}
            >
              View Link
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
```

## Shownote展示组件

### HTML内容渲染
```tsx
import DOMPurify from 'isomorphic-dompurify';

interface ShownoteProps {
  content: string;
  onTimestampClick: (timestamp: number) => void;
}

const Shownote: React.FC<ShownoteProps> = ({ content, onTimestampClick }) => {
  const processedContent = useMemo(() => {
    // 先清理HTML内容
    const cleanHtml = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel']
    });

    // 解析并高亮时间戳
    return highlightTimestamps(cleanHtml);
  }, [content]);

  const highlightTimestamps = (html: string): string => {
    const timestampRegex = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/g;

    return html.replace(timestampRegex, (match, hours, minutes, seconds) => {
      const totalSeconds = calculateTotalSeconds(hours, minutes, seconds);
      return `<span class="timestamp-link" data-timestamp="${totalSeconds}">${match}</span>`;
    });
  };

  const calculateTotalSeconds = (hours: string | undefined, minutes: string, seconds: string): number => {
    const h = hours ? parseInt(hours, 10) : 0;
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    return h * 3600 + m * 60 + s;
  };

  const handleContentClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;

    if (target.classList.contains('timestamp-link')) {
      event.preventDefault();
      const timestamp = parseInt(target.dataset.timestamp || '0', 10);
      onTimestampClick(timestamp);
    }
  };

  return (
    <div className="shownote">
      <h3 className="text-sm font-medium mb-3">Show Notes</h3>
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={handleContentClick}
      />

      <style jsx>{`
        .shownote :global(.timestamp-link) {
          color: #3b82f6;
          cursor: pointer;
          text-decoration: underline;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-weight: 500;
        }

        .shownote :global(.timestamp-link:hover) {
          color: #1d4ed8;
          background-color: rgba(59, 130, 246, 0.1);
          padding: 1px 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};
```

## 响应式布局组件

### 分栏布局管理器
```tsx
interface ContentPanelProps {
  chapters: Chapter[];
  shownote: string;
  currentTime: number;
  onChapterClick: (timestamp: number) => void;
  onTimestampClick: (timestamp: number) => void;
}

const ContentPanel: React.FC<ContentPanelProps> = ({
  chapters,
  shownote,
  currentTime,
  onChapterClick,
  onTimestampClick,
}) => {
  const [activeTab, setActiveTab] = useState<'chapters' | 'shownote'>('chapters');
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  // 响应式检测
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.max(280, Math.min(600, e.clientX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (isMobile) {
    // 移动端标签页模式
    return (
      <div className="content-panel-mobile">
        <div className="tab-header">
          <button
            className={`tab ${activeTab === 'chapters' ? 'active' : ''}`}
            onClick={() => setActiveTab('chapters')}
          >
            Chapters ({chapters.length})
          </button>
          <button
            className={`tab ${activeTab === 'shownote' ? 'active' : ''}`}
            onClick={() => setActiveTab('shownote')}
          >
            Show Notes
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'chapters' ? (
            <ChapterList
              chapters={chapters}
              currentTime={currentTime}
              onChapterClick={onChapterClick}
            />
          ) : (
            <Shownote
              content={shownote}
              onTimestampClick={onTimestampClick}
            />
          )}
        </div>
      </div>
    );
  }

  // 桌面端分栏模式
  return (
    <div className="content-panel-desktop flex">
      <div
        className="chapters-panel bg-white dark:bg-gray-900 border-r"
        style={{ width: panelWidth }}
      >
        <ChapterList
          chapters={chapters}
          currentTime={currentTime}
          onChapterClick={onChapterClick}
        />
      </div>

      <div
        className="resize-handle"
        onMouseDown={handleMouseDown}
      />

      <div className="shownote-panel flex-1 bg-gray-50 dark:bg-gray-800">
        <Shownote
          content={shownote}
          onTimestampClick={onTimestampClick}
        />
      </div>
    </div>
  );
};
```

## 时间戳解析工具
```tsx
export class TimestampParser {
  private static readonly PATTERNS = [
    /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/g, // HH:MM:SS.mmm or MM:SS
    /(?:at\s+)?(\d{1,2}):(\d{2})/g, // at MM:SS
    /(?:\[)?(\d{1,2}):(\d{2})(?:\])?/g, // [MM:SS]
  ];

  static parseTimestamps(text: string): TimestampMatch[] {
    const matches: TimestampMatch[] = [];

    this.PATTERNS.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const timestamp = this.parseTimestamp(match);
        if (timestamp !== null) {
          matches.push({
            text: match[0],
            timestamp,
            index: match.index,
            length: match[0].length,
          });
        }
      }
    });

    return matches.sort((a, b) => a.index - b.index);
  }

  private static parseTimestamp(match: RegExpExecArray): number | null {
    try {
      if (match.length >= 4 && match[1]) {
        // HH:MM:SS format
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const milliseconds = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
      } else {
        // MM:SS format
        const minutes = parseInt(match[match.length - 2], 10);
        const seconds = parseInt(match[match.length - 1], 10);
        return minutes * 60 + seconds;
      }
    } catch {
      return null;
    }
  }
}

interface TimestampMatch {
  text: string;
  timestamp: number;
  index: number;
  length: number;
}
```

## 相关文件
- `src/renderer/components/Content/ChapterList.tsx`
- `src/renderer/components/Content/Shownote.tsx`
- `src/renderer/components/Content/ContentPanel.tsx`
- `src/renderer/utils/TimestampParser.ts`
- `src/renderer/hooks/useContentPanel.ts`

## 后续任务依赖
- task_stage3_transcript_subtitle_display
- task_stage4_ai_content_integration