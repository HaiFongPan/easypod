# 任务：订阅管理界面

## 任务信息
- **阶段**: 2 - 订阅和播放功能
- **估时**: 12小时
- **优先级**: 高
- **依赖**: task_stage2_rss_parsing, task_stage1_react_ui_framework

## 任务目标
创建完整的订阅管理用户界面，包括订阅列表、搜索、添加删除等功能。

## 具体任务
1. **订阅列表展示**
   - 创建订阅列表组件
   - 实现网格和列表视图切换
   - 显示播客封面、标题、简介
   - 添加订阅状态指示器(更新中、错误等)

2. **搜索和过滤功能**
   - 实现实时搜索(标题、描述)
   - 添加分类筛选器
   - 支持标签过滤
   - 实现搜索结果高亮

3. **添加/删除订阅源**
   - 创建添加订阅对话框
   - URL验证和预览功能
   - 批量添加订阅支持
   - 删除确认和数据清理

4. **OPML导入/导出功能**
   - OPML文件解析和导入
   - 订阅数据导出为OPML
   - 导入进度显示和错误处理
   - 重复订阅检测和合并

5. **自动/手动刷新机制**
   - 单个订阅手动刷新
   - 全部订阅批量刷新
   - 后台自动刷新设置
   - 刷新状态和进度显示

## 验收标准
- [ ] 订阅列表正确显示所有已订阅播客
- [ ] 搜索功能响应速度≤200ms
- [ ] 添加新订阅URL验证准确率100%
- [ ] OPML导入导出功能完整
- [ ] 刷新操作不阻塞UI响应
- [ ] 错误状态正确显示和处理

## UI组件设计

### 订阅列表组件
```tsx
interface SubscriptionListProps {
  feeds: Feed[];
  viewMode: 'grid' | 'list';
  searchQuery: string;
  selectedCategories: string[];
  onFeedSelect: (feed: Feed) => void;
  onFeedRefresh: (feedId: string) => void;
  onFeedDelete: (feedId: string) => void;
}

const SubscriptionList: React.FC<SubscriptionListProps> = ({
  feeds,
  viewMode,
  searchQuery,
  selectedCategories,
  onFeedSelect,
  onFeedRefresh,
  onFeedDelete,
}) => {
  const filteredFeeds = useMemo(() => {
    return feeds.filter(feed =>
      feed.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategories.length === 0 ||
       selectedCategories.includes(feed.category))
    );
  }, [feeds, searchQuery, selectedCategories]);

  return (
    <div className={`subscription-list ${viewMode}`}>
      {filteredFeeds.map(feed => (
        <FeedCard
          key={feed.id}
          feed={feed}
          onRefresh={() => onFeedRefresh(feed.id)}
          onDelete={() => onFeedDelete(feed.id)}
          onClick={() => onFeedSelect(feed)}
        />
      ))}
    </div>
  );
};
```

### Feed卡片组件
```tsx
interface FeedCardProps {
  feed: Feed;
  onRefresh: () => void;
  onDelete: () => void;
  onClick: () => void;
}

const FeedCard: React.FC<FeedCardProps> = ({
  feed,
  onRefresh,
  onDelete,
  onClick,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div
      className="feed-card group cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <div className="relative">
        <img
          src={feed.coverUrl || '/default-cover.png'}
          alt={feed.title}
          className="w-full h-32 object-cover rounded-t-lg"
        />
        <FeedStatusBadge status={feed.status} />
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-sm mb-1 truncate">
          {feed.title}
        </h3>
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
          {feed.description}
        </p>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{feed.episodeCount} episodes</span>
          <span>{formatDate(feed.lastCheckedAt)}</span>
        </div>
      </div>

      <div className="feed-actions opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onRefresh(); }}>
          <RefreshIcon />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
};
```

## 搜索和过滤功能
```tsx
const useSubscriptionFilter = (feeds: Feed[]) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'title' | 'updated' | 'episodes'>('title');

  const filteredFeeds = useMemo(() => {
    let result = feeds.filter(feed => {
      const matchesSearch = feed.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          feed.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategories.length === 0 ||
                             selectedCategories.includes(feed.category);

      return matchesSearch && matchesCategory;
    });

    // 排序逻辑
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'updated':
          return new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime();
        case 'episodes':
          return b.episodeCount - a.episodeCount;
        default:
          return 0;
      }
    });

    return result;
  }, [feeds, searchQuery, selectedCategories, sortBy]);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    sortBy,
    setSortBy,
    filteredFeeds,
  };
};
```

## OPML导入导出
```tsx
class OPMLManager {
  async importOPML(file: File): Promise<ImportResult> {
    try {
      const xmlContent = await this.readFileAsText(file);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

      const outlines = xmlDoc.querySelectorAll('outline[type="rss"]');
      const feeds: Partial<Feed>[] = [];

      outlines.forEach(outline => {
        const title = outline.getAttribute('title') || outline.getAttribute('text');
        const url = outline.getAttribute('xmlUrl');
        const description = outline.getAttribute('description') || '';
        const category = outline.parentElement?.getAttribute('title') || 'Default';

        if (title && url) {
          feeds.push({ title, url, description, category });
        }
      });

      return { feeds, errors: [] };
    } catch (error) {
      throw new OPMLImportError(`Failed to parse OPML: ${error.message}`);
    }
  }

  exportOPML(feeds: Feed[]): string {
    const opmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>EasyPod Subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    ${this.generateOutlines(feeds)}
  </body>
</opml>`;

    return opmlTemplate;
  }

  private generateOutlines(feeds: Feed[]): string {
    const categories = this.groupFeedsByCategory(feeds);

    return Object.entries(categories)
      .map(([category, categoryFeeds]) => {
        const outlines = categoryFeeds
          .map(feed =>
            `<outline type="rss" text="${feed.title}" title="${feed.title}" xmlUrl="${feed.url}" description="${feed.description || ''}" />`
          )
          .join('\n      ');

        return `<outline text="${category}" title="${category}">
      ${outlines}
    </outline>`;
      })
      .join('\n    ');
  }
}
```

## 状态管理集成
```tsx
interface SubscriptionState {
  feeds: Feed[];
  isLoading: boolean;
  error: string | null;
  refreshingFeeds: Set<string>;
}

const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>((set, get) => ({
  feeds: [],
  isLoading: false,
  error: null,
  refreshingFeeds: new Set(),

  addFeed: async (url: string) => {
    set({ isLoading: true, error: null });
    try {
      const feed = await feedService.addFeed(url);
      set(state => ({
        feeds: [...state.feeds, feed],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  refreshFeed: async (feedId: string) => {
    const { refreshingFeeds } = get();
    refreshingFeeds.add(feedId);
    set({ refreshingFeeds: new Set(refreshingFeeds) });

    try {
      const updatedFeed = await feedService.refreshFeed(feedId);
      set(state => {
        const newRefreshing = new Set(state.refreshingFeeds);
        newRefreshing.delete(feedId);

        return {
          feeds: state.feeds.map(feed =>
            feed.id === feedId ? updatedFeed : feed
          ),
          refreshingFeeds: newRefreshing,
        };
      });
    } catch (error) {
      console.error(`Failed to refresh feed ${feedId}:`, error);
      refreshingFeeds.delete(feedId);
      set({ refreshingFeeds: new Set(refreshingFeeds) });
    }
  },
}));
```

## 相关文件
- `src/renderer/components/Subscription/SubscriptionList.tsx`
- `src/renderer/components/Subscription/FeedCard.tsx`
- `src/renderer/components/Subscription/AddFeedDialog.tsx`
- `src/renderer/services/OPMLManager.ts`
- `src/renderer/store/subscriptionStore.ts`

## 后续任务依赖
- task_stage2_media_control_enhancement
- task_stage3_subscription_integration