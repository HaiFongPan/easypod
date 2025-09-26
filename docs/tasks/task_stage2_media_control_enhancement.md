# 任务：播放控制增强

## 任务信息
- **阶段**: 2 - 订阅和播放功能
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_stage1_basic_audio_player

## 任务目标
增强播放器功能，添加媒体键支持、快捷键绑定、播放队列和历史记录等高级特性。

## 具体任务
1. **媒体键支持 (Media Session API)**
   - 集成Media Session API
   - 支持系统媒体键控制
   - 实现锁屏控制界面
   - 显示播放信息和封面

2. **键盘快捷键绑定**
   - 全局快捷键注册
   - 应用内快捷键处理
   - 快捷键冲突检测和解决
   - 用户自定义快捷键支持

3. **播放队列和历史记录**
   - 播放队列管理
   - 播放历史追踪
   - 队列拖拽排序
   - 智能播放推荐

4. **断点续播功能**
   - 播放进度持久化
   - 跨设备同步支持预留
   - 自动恢复播放位置
   - 播放状态管理

## 验收标准
- [ ] 媒体键在前后台均可正常控制播放
- [ ] 快捷键响应及时，无冲突
- [ ] 播放队列功能完整，支持拖拽
- [ ] 播放历史准确记录，可查询
- [ ] 断点续播准确率≥99%
- [ ] 锁屏控制界面信息完整

## Media Session API集成

### MediaSession控制器
```tsx
class MediaSessionController {
  private currentEpisode: Episode | null = null;
  private audio: HTMLAudioElement;

  constructor(audio: HTMLAudioElement) {
    this.audio = audio;
    this.setupMediaSession();
  }

  private setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.audio.play();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.audio.pause();
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        this.audio.currentTime = Math.max(0, this.audio.currentTime - skipTime);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        this.audio.currentTime = Math.min(
          this.audio.duration,
          this.audio.currentTime + skipTime
        );
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.audio.currentTime = details.seekTime;
        }
      });
    }
  }

  updateMetadata(episode: Episode) {
    if ('mediaSession' in navigator && episode) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: episode.title,
        artist: episode.feedTitle,
        album: episode.feedTitle,
        artwork: [
          {
            src: episode.image || episode.feedImage,
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      });

      this.currentEpisode = episode;
    }
  }

  updatePositionState(position: number, duration: number, playbackRate: number) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position,
      });
    }
  }
}
```

## 快捷键管理系统

### 快捷键配置
```tsx
interface ShortcutConfig {
  key: string;
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  action: string;
  global?: boolean;
  description: string;
}

const defaultShortcuts: ShortcutConfig[] = [
  {
    key: 'Space',
    modifiers: [],
    action: 'togglePlayPause',
    description: '播放/暂停',
  },
  {
    key: 'ArrowLeft',
    modifiers: [],
    action: 'seekBackward',
    description: '后退10秒',
  },
  {
    key: 'ArrowRight',
    modifiers: [],
    action: 'seekForward',
    description: '前进10秒',
  },
  {
    key: 'ArrowLeft',
    modifiers: ['shift'],
    action: 'seekBackward30',
    description: '后退30秒',
  },
  {
    key: 'ArrowUp',
    modifiers: [],
    action: 'volumeUp',
    description: '音量+',
  },
  {
    key: 'ArrowDown',
    modifiers: [],
    action: 'volumeDown',
    description: '音量-',
  },
  {
    key: 'KeyM',
    modifiers: [],
    action: 'toggleMute',
    description: '静音/取消静音',
  },
];
```

### 快捷键处理器
```tsx
class ShortcutManager {
  private shortcuts = new Map<string, ShortcutConfig>();
  private playerActions: PlayerActions;

  constructor(playerActions: PlayerActions) {
    this.playerActions = playerActions;
    this.loadShortcuts();
    this.setupEventListeners();
  }

  private loadShortcuts() {
    defaultShortcuts.forEach(shortcut => {
      const key = this.generateShortcutKey(shortcut);
      this.shortcuts.set(key, shortcut);
    });
  }

  private generateShortcutKey(config: ShortcutConfig): string {
    const modifiers = config.modifiers.sort().join('+');
    return modifiers ? `${modifiers}+${config.key}` : config.key;
  }

  private setupEventListeners() {
    document.addEventListener('keydown', (event) => {
      if (this.shouldIgnoreEvent(event)) return;

      const shortcutKey = this.eventToShortcutKey(event);
      const config = this.shortcuts.get(shortcutKey);

      if (config) {
        event.preventDefault();
        this.executeAction(config.action);
      }
    });
  }

  private shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();

    // 忽略输入框等元素的键盘事件
    return ['input', 'textarea', 'select'].includes(tagName) ||
           target.contentEditable === 'true';
  }

  private eventToShortcutKey(event: KeyboardEvent): string {
    const modifiers: string[] = [];

    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');

    const key = event.code;
    return modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
  }

  private executeAction(action: string) {
    switch (action) {
      case 'togglePlayPause':
        this.playerActions.togglePlayPause();
        break;
      case 'seekBackward':
        this.playerActions.seekBackward(10);
        break;
      case 'seekForward':
        this.playerActions.seekForward(10);
        break;
      case 'seekBackward30':
        this.playerActions.seekBackward(30);
        break;
      case 'volumeUp':
        this.playerActions.adjustVolume(0.05);
        break;
      case 'volumeDown':
        this.playerActions.adjustVolume(-0.05);
        break;
      case 'toggleMute':
        this.playerActions.toggleMute();
        break;
    }
  }
}
```

## 播放队列管理

### 队列数据结构
```tsx
interface PlayQueue {
  id: string;
  name: string;
  episodes: QueueItem[];
  currentIndex: number;
  shuffleEnabled: boolean;
  repeatMode: 'none' | 'one' | 'all';
}

interface QueueItem {
  episodeId: string;
  addedAt: Date;
  playedAt?: Date;
  completed: boolean;
}

class QueueManager {
  private queue: PlayQueue;
  private shuffleOrder: number[] = [];

  constructor(initialQueue?: PlayQueue) {
    this.queue = initialQueue || {
      id: 'default',
      name: 'Default Queue',
      episodes: [],
      currentIndex: -1,
      shuffleEnabled: false,
      repeatMode: 'none',
    };
  }

  addEpisode(episodeId: string, insertAt?: number) {
    const queueItem: QueueItem = {
      episodeId,
      addedAt: new Date(),
      completed: false,
    };

    if (insertAt !== undefined) {
      this.queue.episodes.splice(insertAt, 0, queueItem);
    } else {
      this.queue.episodes.push(queueItem);
    }

    this.updateShuffleOrder();
  }

  removeEpisode(index: number) {
    if (index >= 0 && index < this.queue.episodes.length) {
      this.queue.episodes.splice(index, 1);

      if (this.queue.currentIndex >= index) {
        this.queue.currentIndex--;
      }

      this.updateShuffleOrder();
    }
  }

  getCurrentEpisode(): QueueItem | null {
    if (this.queue.currentIndex >= 0 && this.queue.currentIndex < this.queue.episodes.length) {
      return this.queue.episodes[this.queue.currentIndex];
    }
    return null;
  }

  getNextEpisode(): QueueItem | null {
    const nextIndex = this.getNextIndex();
    return nextIndex !== -1 ? this.queue.episodes[nextIndex] : null;
  }

  getPreviousEpisode(): QueueItem | null {
    const prevIndex = this.getPreviousIndex();
    return prevIndex !== -1 ? this.queue.episodes[prevIndex] : null;
  }

  private getNextIndex(): number {
    if (this.queue.episodes.length === 0) return -1;

    if (this.queue.repeatMode === 'one') {
      return this.queue.currentIndex;
    }

    let nextIndex: number;

    if (this.queue.shuffleEnabled) {
      const currentShuffleIndex = this.shuffleOrder.indexOf(this.queue.currentIndex);
      const nextShuffleIndex = (currentShuffleIndex + 1) % this.shuffleOrder.length;
      nextIndex = this.shuffleOrder[nextShuffleIndex];
    } else {
      nextIndex = this.queue.currentIndex + 1;
    }

    if (nextIndex >= this.queue.episodes.length) {
      return this.queue.repeatMode === 'all' ? 0 : -1;
    }

    return nextIndex;
  }

  private updateShuffleOrder() {
    this.shuffleOrder = Array.from({ length: this.queue.episodes.length }, (_, i) => i);

    // Fisher-Yates shuffle
    for (let i = this.shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleOrder[i], this.shuffleOrder[j]] = [this.shuffleOrder[j], this.shuffleOrder[i]];
    }
  }
}
```

## 播放历史管理
```tsx
interface PlayHistory {
  episodeId: string;
  playedAt: Date;
  duration: number; // 播放时长(秒)
  position: number; // 停止位置(秒)
  completed: boolean;
}

class PlayHistoryManager {
  private history: PlayHistory[] = [];
  private maxHistorySize = 1000;

  addHistoryEntry(episodeId: string, duration: number, position: number) {
    const existingIndex = this.history.findIndex(h => h.episodeId === episodeId);

    const historyEntry: PlayHistory = {
      episodeId,
      playedAt: new Date(),
      duration,
      position,
      completed: position >= duration * 0.95, // 95%认为已完成
    };

    if (existingIndex >= 0) {
      // 更新现有记录
      this.history[existingIndex] = historyEntry;
    } else {
      // 添加新记录
      this.history.unshift(historyEntry);

      // 限制历史记录数量
      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(0, this.maxHistorySize);
      }
    }
  }

  getRecentHistory(limit = 50): PlayHistory[] {
    return this.history.slice(0, limit);
  }

  getEpisodeHistory(episodeId: string): PlayHistory | null {
    return this.history.find(h => h.episodeId === episodeId) || null;
  }

  clearHistory() {
    this.history = [];
  }
}
```

## 相关文件
- `src/renderer/services/MediaSessionController.ts`
- `src/renderer/services/ShortcutManager.ts`
- `src/renderer/services/QueueManager.ts`
- `src/renderer/services/PlayHistoryManager.ts`
- `src/renderer/components/Player/PlayQueue.tsx`
- `src/renderer/hooks/useMediaSession.ts`

## 后续任务依赖
- task_stage2_chapter_shownote_display
- task_stage3_transcript_player_integration