# 任务：集成测试

## 任务信息
- **阶段**: 2 - 订阅和播放功能
- **估时**: 4小时
- **优先级**: 中
- **依赖**: task_stage2_chapter_shownote_display

## 任务目标
完成第2阶段功能的集成测试，确保订阅管理和播放功能的端到端工作流程正常。

## 具体任务
1. **端到端播放流程测试**
   - 订阅添加到播放完整流程
   - 章节跳转和时间戳功能测试
   - 播放控制和状态同步测试
   - 错误场景和恢复测试

2. **RSS解析准确性测试**
   - 多种播客源兼容性测试
   - 章节信息解析验证
   - 特殊字符和编码处理测试
   - 解析性能和内存使用测试

3. **用户交互测试**
   - 键盘快捷键响应测试
   - 媒体键控制功能测试
   - UI组件交互流畅性测试
   - 响应式布局适配测试

## 验收标准
- [ ] 端到端用户流程100%可用
- [ ] RSS解析测试覆盖20+不同播客源
- [ ] 所有快捷键和媒体键功能正常
- [ ] UI在不同屏幕尺寸下正常显示
- [ ] 性能指标满足预期要求
- [ ] 错误处理机制有效

## 端到端测试用例

### 完整播放流程测试
```tsx
// e2e/playback-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Complete Playback Flow', () => {
  test('user can add subscription and play episode', async ({ page }) => {
    // 1. 启动应用
    await page.goto('/');

    // 2. 添加订阅
    await page.click('[data-testid="add-feed-button"]');
    await page.fill('[data-testid="feed-url-input"]', 'https://example.com/podcast.xml');
    await page.click('[data-testid="add-feed-confirm"]');

    // 3. 等待订阅解析完成
    await page.waitForSelector('[data-testid="feed-episodes"]');

    // 4. 选择第一个剧集
    const firstEpisode = page.locator('[data-testid="episode-item"]').first();
    await firstEpisode.click();

    // 5. 播放音频
    await page.click('[data-testid="play-button"]');

    // 6. 验证播放状态
    await expect(page.locator('[data-testid="player-status"]')).toContainText('Playing');

    // 7. 测试章节跳转
    await page.click('[data-testid="chapter-item"]:first-child');

    // 8. 验证时间跳转
    const currentTime = await page.locator('[data-testid="current-time"]').textContent();
    expect(currentTime).toMatch(/^\d+:\d{2}$/);

    // 9. 测试快捷键
    await page.keyboard.press('Space'); // 暂停
    await expect(page.locator('[data-testid="player-status"]')).toContainText('Paused');

    // 10. 测试媒体键 (如果支持)
    await page.keyboard.press('MediaPlayPause');
    await expect(page.locator('[data-testid="player-status"]')).toContainText('Playing');
  });

  test('handles network errors gracefully', async ({ page }) => {
    // 模拟网络错误
    await page.route('**/podcast.xml', route => route.abort());

    await page.goto('/');
    await page.click('[data-testid="add-feed-button"]');
    await page.fill('[data-testid="feed-url-input"]', 'https://example.com/podcast.xml');
    await page.click('[data-testid="add-feed-confirm"]');

    // 验证错误处理
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load feed');
  });
});
```

### RSS解析兼容性测试
```tsx
// src/test/integration/rss-parsing.test.ts
import { describe, test, expect } from 'vitest';
import { FeedParser } from '@/main/services/FeedParser';

describe('RSS Parsing Compatibility', () => {
  const feedParser = new FeedParser({
    timeout: 10000,
    maxRedirects: 3,
    userAgent: 'EasyPod/1.0',
    retryAttempts: 2,
  });

  const testFeeds = [
    {
      name: 'Standard RSS 2.0',
      url: 'https://feeds.example.com/standard.xml',
      expectedEpisodes: 50,
    },
    {
      name: 'iTunes Enhanced',
      url: 'https://feeds.example.com/itunes.xml',
      expectedChapters: true,
    },
    {
      name: 'Podcast 2.0',
      url: 'https://feeds.example.com/podcast2.xml',
      expectedTranscript: true,
    },
    // 更多测试源...
  ];

  testFeeds.forEach(({ name, url, expectedEpisodes, expectedChapters, expectedTranscript }) => {
    test(`parses ${name} correctly`, async () => {
      const feed = await feedParser.parseFeed(url);

      expect(feed.title).toBeTruthy();
      expect(feed.episodes).toBeInstanceOf(Array);

      if (expectedEpisodes) {
        expect(feed.episodes.length).toBeGreaterThanOrEqual(expectedEpisodes);
      }

      if (expectedChapters) {
        const episodeWithChapters = feed.episodes.find(ep => ep.chapters?.length > 0);
        expect(episodeWithChapters).toBeTruthy();
      }

      if (expectedTranscript) {
        const episodeWithTranscript = feed.episodes.find(ep => ep.transcriptUrl);
        expect(episodeWithTranscript).toBeTruthy();
      }

      // 验证必需字段
      feed.episodes.forEach(episode => {
        expect(episode.guid).toBeTruthy();
        expect(episode.title).toBeTruthy();
        expect(episode.audioUrl).toBeTruthy();
        expect(episode.pubDate).toBeInstanceOf(Date);
      });
    });
  });
});
```

## 性能测试

### 播放器性能基准测试
```tsx
// src/test/performance/player-performance.test.ts
import { describe, test, expect } from 'vitest';
import { PerformanceMonitor } from '@/renderer/utils/performance';

describe('Player Performance', () => {
  const monitor = new PerformanceMonitor();

  test('audio loading time meets requirements', async () => {
    const endTiming = monitor.startTiming('audio-load');

    // 模拟音频加载
    const audio = new Audio('test-audio.mp3');

    await new Promise((resolve, reject) => {
      audio.oncanplaythrough = resolve;
      audio.onerror = reject;
      audio.load();
    });

    endTiming();

    const metrics = monitor.getMetrics('audio-load');
    expect(metrics.avg).toBeLessThan(3000); // 3秒内加载完成
  });

  test('chapter navigation response time', async () => {
    const chapters = generateTestChapters(50);

    const endTiming = monitor.startTiming('chapter-navigation');

    // 模拟章节跳转
    for (let i = 0; i < 10; i++) {
      const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];
      // 执行跳转逻辑
      await simulateChapterJump(randomChapter.startTime);
    }

    endTiming();

    const metrics = monitor.getMetrics('chapter-navigation');
    expect(metrics.avg).toBeLessThan(100); // 平均响应时间<100ms
  });
});
```

## UI响应性测试

### 快捷键响应测试
```tsx
// src/test/integration/keyboard-shortcuts.test.ts
import { render, screen, fireEvent } from '@test/utils';
import { PlayerContainer } from '@/renderer/components/Player/PlayerContainer';

describe('Keyboard Shortcuts', () => {
  test('space key toggles play/pause', async () => {
    render(<PlayerContainer />);

    const playButton = screen.getByTestId('play-button');

    // 初始状态应该是暂停
    expect(playButton).toHaveAttribute('aria-label', 'Play');

    // 按空格键
    fireEvent.keyDown(document, { code: 'Space' });

    // 应该变为播放状态
    await waitFor(() => {
      expect(playButton).toHaveAttribute('aria-label', 'Pause');
    });

    // 再次按空格键
    fireEvent.keyDown(document, { code: 'Space' });

    // 应该变为暂停状态
    await waitFor(() => {
      expect(playButton).toHaveAttribute('aria-label', 'Play');
    });
  });

  test('arrow keys control playback position', async () => {
    const { getByTestId } = render(<PlayerContainer />);

    // 模拟音频加载完成
    const mockAudio = { currentTime: 60, duration: 300 };

    // 右箭头前进
    fireEvent.keyDown(document, { code: 'ArrowRight' });

    // 验证时间变化
    await waitFor(() => {
      expect(mockAudio.currentTime).toBe(70); // +10秒
    });

    // 左箭头后退
    fireEvent.keyDown(document, { code: 'ArrowLeft' });

    await waitFor(() => {
      expect(mockAudio.currentTime).toBe(60); // -10秒
    });
  });
});
```

## 响应式布局测试
```tsx
// src/test/integration/responsive-layout.test.ts
import { render, screen } from '@test/utils';
import { ContentPanel } from '@/renderer/components/Content/ContentPanel';

describe('Responsive Layout', () => {
  const mockChapters = [
    { id: '1', title: 'Chapter 1', startTime: 0 },
    { id: '2', title: 'Chapter 2', startTime: 300 },
  ];

  test('shows tabs on mobile viewport', () => {
    // 模拟移动端视窗
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    render(
      <ContentPanel
        chapters={mockChapters}
        shownote="Test content"
        currentTime={0}
        onChapterClick={() => {}}
        onTimestampClick={() => {}}
      />
    );

    // 移动端应该显示标签页
    expect(screen.getByText('Chapters (2)')).toBeInTheDocument();
    expect(screen.getByText('Show Notes')).toBeInTheDocument();
  });

  test('shows split panels on desktop viewport', () => {
    // 模拟桌面端视窗
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });

    render(
      <ContentPanel
        chapters={mockChapters}
        shownote="Test content"
        currentTime={0}
        onChapterClick={() => {}}
        onTimestampClick={() => {}}
      />
    );

    // 桌面端应该显示分栏布局
    expect(screen.getByClassName('chapters-panel')).toBeInTheDocument();
    expect(screen.getByClassName('shownote-panel')).toBeInTheDocument();
    expect(screen.getByClassName('resize-handle')).toBeInTheDocument();
  });
});
```

## 测试数据生成器
```tsx
// src/test/utils/testDataGenerators.ts
export const generateTestFeed = (overrides = {}): Feed => ({
  id: `feed-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Podcast',
  url: 'https://example.com/feed.xml',
  description: 'A test podcast for integration testing',
  coverUrl: 'https://example.com/cover.jpg',
  category: 'Technology',
  language: 'en',
  lastCheckedAt: new Date(),
  episodes: [],
  ...overrides,
});

export const generateTestEpisode = (overrides = {}): Episode => ({
  id: `episode-${Math.random().toString(36).substr(2, 9)}`,
  feedId: 'test-feed',
  guid: `guid-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Episode',
  description: 'A test episode for integration testing',
  audioUrl: 'https://example.com/audio.mp3',
  pubDate: new Date(),
  duration: 3600, // 1 hour
  status: 'new',
  lastPosition: 0,
  chapters: [],
  ...overrides,
});

export const generateTestChapters = (count: number): Chapter[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `chapter-${i}`,
    title: `Chapter ${i + 1}`,
    startTime: i * 300, // 每章5分钟
    endTime: (i + 1) * 300,
    source: 'json' as const,
  }));
};
```

## 相关文件
- `e2e/playback-flow.spec.ts` - 端到端测试
- `src/test/integration/` - 集成测试目录
- `src/test/performance/` - 性能测试目录
- `src/test/utils/testDataGenerators.ts` - 测试数据生成
- `playwright.config.ts` - E2E测试配置

## 后续任务依赖
- task_stage3_funasr_integration
- task_stage5_end_to_end_testing