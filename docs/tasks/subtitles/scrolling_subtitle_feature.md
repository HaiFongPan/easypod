# 滚动字幕功能需求文档

## 文档信息

- **项目**: EasyPod 播客播放器
- **功能**: 滚动字幕与音频同步
- **目标组件**: EpisodeDetailPage.tsx
- **创建日期**: 2025-10-07
- **版本**: 1.0

---

## 1. 需求概述

### 1.1 功能目标

在 EpisodeDetailPage 的字幕标签页中实现一个与 AudioPlayer 同步的滚动字幕功能，支持：
1. 根据播放位置自动高亮当前句子
2. 自动滚动保持当前句子可见
3. 用户手动滚动后暂停自动滚动
4. 通过 Focus Control 按钮恢复自动滚动
5. 多说话人头像区分显示

### 1.2 数据来源

- **数据表**: `episode_transcripts`
- **字段**: `subtitles` (JSON 格式的 `SentenceInfo[]`)
- **数据结构**:
```typescript
interface SentenceInfo {
  text: string;           // 句子内容
  start: number;          // 开始时间（毫秒）
  end: number;            // 结束时间（毫秒）
  timestamp: number[][];  // 词级时间戳 [[start, end], ...]
  spk: number;            // 说话人 ID (0, 1, 2...)
}
```

---

## 2. 功能需求拆解

### 2.1 核心功能需求

#### FR-1: 字幕数据加载
- **描述**: 从数据库加载剧集的字幕数据
- **优先级**: 高
- **验收标准**:
  - [ ] 页面加载时自动获取当前剧集的字幕
  - [ ] 正确解析 `subtitles` 字段中的 JSON 数据
  - [ ] 处理无字幕、加载中、加载失败等状态
  - [ ] 字幕数据缓存避免重复请求

#### FR-2: 说话人头像分配
- **描述**: 为不同说话人分配可视化区分的头像
- **优先级**: 中
- **验收标准**:
  - [ ] 根据 `spk` 字段为每个说话人生成唯一头像
  - [ ] 头像颜色/样式在同一剧集中保持一致
  - [ ] 支持至少 5 个不同说话人的视觉区分
  - [ ] 单人对话时头像可选择性隐藏或简化显示

#### FR-3: 自动高亮与滚动
- **描述**: 根据播放位置自动高亮当前句子并滚动到可见区域
- **优先级**: 高
- **触发条件**:
  - 当前播放的剧集 ID 与 DetailPage 显示的剧集 ID 一致
  - 音频处于播放或暂停状态（有有效播放位置）
- **验收标准**:
  - [ ] 播放位置在句子时间范围内时高亮该句子
  - [ ] 高亮样式明显（边框/背景色变化）
  - [ ] 自动滚动保持高亮句子在视口中部（距顶部约 1/3 处）
  - [ ] 滚动动画平滑（使用 `behavior: 'smooth'`）
  - [ ] 快速跳转时（如 seek）立即更新高亮和滚动

#### FR-4: 手动滚动覆盖
- **描述**: 用户手动滚动后禁用自动滚动
- **优先级**: 高
- **验收标准**:
  - [ ] 检测用户主动的滚动行为（非程序触发）
  - [ ] 滚动后立即停止自动滚动
  - [ ] 视觉指示用户当前处于手动模式（可选：显示提示或 Focus 按钮高亮）
  - [ ] 手动模式在剧集切换时自动重置

#### FR-5: Focus Control 按钮
- **描述**: AudioPlayer 中的按钮，用于恢复自动滚动
- **优先级**: 高
- **位置**: AudioPlayer 中 SpeedControl 组件之前
- **可见性条件**:
  - 仅当播放剧集与 DetailPage 剧集匹配时显示
  - 不匹配时渲染空白占位（保持布局稳定）
- **验收标准**:
  - [ ] 点击按钮恢复自动滚动和高亮
  - [ ] 按钮状态指示是否处于自动模式
  - [ ] 恢复后立即滚动到当前播放位置
  - [ ] 按钮有适当的图标和 tooltip

### 2.2 非功能需求

#### NFR-1: 性能要求
- 字幕列表渲染优化（虚拟滚动或分页加载，如超过 500 句）
- 位置匹配算法时间复杂度 O(log n) 或更优
- 滚动操作防抖（避免频繁触发）
- 内存占用合理（大字幕文件不超过 50MB）

#### NFR-2: 用户体验
- 滚动动画流畅（60fps）
- 高亮过渡自然（淡入淡出效果）
- 空状态和加载状态有友好提示
- 错误状态可重试

#### NFR-3: 可访问性
- 字幕文本支持选择和复制
- 键盘导航支持（可选：上下键跳转句子）
- 高对比度模式兼容

---

## 3. 用户故事与验收标准

### US-1: 播放时自动跟随字幕

**作为** 播客听众
**我想要** 在播放时自动看到当前说的内容
**以便** 更好地理解和学习播客内容

**验收标准**:
- [ ] Given: 打开 Episode Detail 页面并播放当前剧集
- [ ] When: 音频播放到某个句子的时间范围
- [ ] Then: 该句子被高亮显示，且自动滚动到视口中央

### US-2: 浏览其他内容后快速回到当前位置

**作为** 播客听众
**我想要** 在浏览之前的字幕后快速回到正在播放的位置
**以便** 不中断收听体验

**验收标准**:
- [ ] Given: 用户手动向上滚动查看之前的字幕
- [ ] When: 用户点击 AudioPlayer 中的 Focus 按钮
- [ ] Then: 字幕自动滚动到当前播放位置并恢复自动跟随

### US-3: 区分多个说话人

**作为** 播客听众
**我想要** 看到不同说话人的字幕有视觉区分
**以便** 更清楚谁在说什么

**验收标准**:
- [ ] Given: 字幕包含多个说话人
- [ ] When: 显示字幕列表
- [ ] Then: 每个说话人有不同颜色/样式的头像标识

---

## 4. 技术设计

### 4.1 组件架构

```
EpisodeDetailPage (已存在)
├── Tabs (已存在)
│   └── TranscriptTab (新建)
│       ├── TranscriptList (新建)
│       │   └── TranscriptItem (新建)
│       │       ├── SpeakerAvatar (新建)
│       │       └── SentenceText (新建)
│       └── EmptyState / LoadingState / ErrorState (新建)
│
AudioPlayer (已存在)
├── FocusControl (新建) ← 插入到 SpeedControl 之前
├── SpeedControl (已存在)
└── VolumeControl (已存在)
```

### 4.2 状态管理设计

#### 方案选择: Zustand Store (推荐)

创建新的 `useTranscriptStore`:

```typescript
// src/renderer/store/transcriptStore.ts
interface TranscriptStore {
  // 状态
  transcripts: Record<number, SentenceInfo[]>; // episodeId -> sentences
  loadingStates: Record<number, boolean>;
  errors: Record<number, string | null>;
  autoScrollEnabled: boolean;
  isManualScrolling: boolean;

  // Actions
  loadTranscript: (episodeId: number) => Promise<void>;
  setAutoScrollEnabled: (enabled: boolean) => void;
  setManualScrolling: (isManual: boolean) => void;
  clearTranscript: (episodeId: number) => void;
}
```

**优势**:
- 与现有架构一致（项目使用 Zustand）
- 跨组件共享状态简单
- 易于调试和测试

#### 替代方案: React Context (不推荐)

仅当字幕状态仅在 DetailPage 内部使用时考虑，但不如 Zustand 灵活。

### 4.3 数据流设计

```
┌─────────────────┐
│ EpisodeDetailPage│
│   (useEffect)    │
└────────┬─────────┘
         │ 1. 加载字幕
         ↓
┌─────────────────────────┐
│ IPC: transcript:getByEpisode │ (需要新增)
└────────┬─────────────────┘
         │ 2. 查询数据库
         ↓
┌─────────────────────────┐
│ DAO: TranscriptDao      │ (需要新建)
│   getByEpisodeId()      │
└────────┬─────────────────┘
         │ 3. 返回字幕数据
         ↓
┌─────────────────────────┐
│ TranscriptStore         │
│   transcripts[id]       │
└────────┬─────────────────┘
         │ 4. 组件订阅
         ↓
┌─────────────────────────┐
│ TranscriptList          │
│   - 渲染字幕            │
│   - 监听播放位置        │
│   - 高亮 + 滚动         │
└─────────────────────────┘

┌─────────────────────────┐
│ PlayerStore             │
│   - currentEpisode      │
│   - position            │
│   - isPlaying           │
└────────┬─────────────────┘
         │ 实时订阅
         ↓
┌─────────────────────────┐
│ TranscriptList          │
│   useEffect(() => {     │
│     highlightSentence() │
│     autoScroll()        │
│   }, [position])        │
└─────────────────────────┘
```

### 4.4 IPC 通信设计

#### 新增 IPC Handler

**主进程** (`src/main/services/IPCHandlers.ts`):

```typescript
// 在 FeedIPCHandlers 中添加
private async handleGetTranscriptByEpisode(
  event: IpcMainInvokeEvent,
  episodeId: number
): Promise<{
  success: boolean;
  transcript?: {
    subtitles: SentenceInfo[];
    text: string;
    speakerNumber: number;
  };
  error?: string;
}> {
  try {
    const dao = new EpisodeTranscriptsDao(); // 需要新建
    const result = await dao.findByEpisodeId(episodeId);

    if (!result) {
      return { success: false, error: 'Transcript not found' };
    }

    return {
      success: true,
      transcript: {
        subtitles: JSON.parse(result.subtitles),
        text: result.text,
        speakerNumber: result.speakerNumber,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 注册 handler
ipcMain.handle('transcript:getByEpisode', this.handleGetTranscriptByEpisode.bind(this));
```

**Preload** (`src/main/preload.ts`):

```typescript
// 在 electronAPI.transcript 中添加
transcript: {
  // ... 现有方法
  getByEpisode: (episodeId: number) =>
    ipcRenderer.invoke('transcript:getByEpisode', episodeId),
}
```

### 4.5 DAO 设计

**新建文件**: `src/main/database/dao/episodeTranscriptsDao.ts`

```typescript
import { eq } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { episodeTranscripts, type EpisodeTranscript } from '../schema';

export class EpisodeTranscriptsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  async findByEpisodeId(episodeId: number): Promise<EpisodeTranscript | null> {
    const results = await this.db
      .select()
      .from(episodeTranscripts)
      .where(eq(episodeTranscripts.episodeId, episodeId))
      .limit(1);

    return results[0] ?? null;
  }

  async exists(episodeId: number): Promise<boolean> {
    const result = await this.findByEpisodeId(episodeId);
    return result !== null;
  }
}
```

### 4.6 核心算法

#### 4.6.1 位置匹配算法（二分查找）

```typescript
// src/renderer/utils/subtitleMatcher.ts
export function findCurrentSentence(
  sentences: SentenceInfo[],
  positionMs: number
): number {
  // 边界情况
  if (sentences.length === 0) return -1;
  if (positionMs < sentences[0].start) return -1;
  if (positionMs > sentences[sentences.length - 1].end) return sentences.length - 1;

  // 二分查找
  let left = 0;
  let right = sentences.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const sentence = sentences[mid];

    if (positionMs >= sentence.start && positionMs <= sentence.end) {
      return mid;
    } else if (positionMs < sentence.start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // 如果没有精确匹配，返回最接近的前一句
  return Math.max(0, right);
}

// 测试用例
describe('findCurrentSentence', () => {
  const sentences: SentenceInfo[] = [
    { text: 'A', start: 0, end: 1000, timestamp: [], spk: 0 },
    { text: 'B', start: 1000, end: 2000, timestamp: [], spk: 0 },
    { text: 'C', start: 2000, end: 3000, timestamp: [], spk: 1 },
  ];

  it('should find sentence at exact start', () => {
    expect(findCurrentSentence(sentences, 1000)).toBe(1);
  });

  it('should find sentence in the middle', () => {
    expect(findCurrentSentence(sentences, 1500)).toBe(1);
  });

  it('should return -1 before first sentence', () => {
    expect(findCurrentSentence(sentences, -100)).toBe(-1);
  });

  it('should return last index after all sentences', () => {
    expect(findCurrentSentence(sentences, 5000)).toBe(2);
  });
});
```

**时间复杂度**: O(log n)
**空间复杂度**: O(1)

#### 4.6.2 手动滚动检测

```typescript
// src/renderer/hooks/useScrollDetection.ts
export function useScrollDetection(
  containerRef: React.RefObject<HTMLDivElement>,
  onManualScroll: () => void,
  autoScrollEnabled: boolean
) {
  const lastProgrammaticScroll = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 如果是最近的程序化滚动（100ms 内），忽略
      if (Date.now() - lastProgrammaticScroll.current < 100) {
        return;
      }

      // 防抖：只在停止滚动后触发
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (autoScrollEnabled) {
          onManualScroll();
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [autoScrollEnabled, onManualScroll]);

  // 程序化滚动时调用此函数
  const markProgrammaticScroll = useCallback(() => {
    lastProgrammaticScroll.current = Date.now();
  }, []);

  return { markProgrammaticScroll };
}
```

#### 4.6.3 自动滚动实现

```typescript
// src/renderer/components/TranscriptList.tsx 片段
const scrollToSentence = useCallback((index: number) => {
  if (!containerRef.current) return;

  const sentenceElements = containerRef.current.querySelectorAll('[data-sentence-index]');
  const targetElement = sentenceElements[index] as HTMLElement;

  if (!targetElement) return;

  const containerHeight = containerRef.current.clientHeight;
  const targetTop = targetElement.offsetTop;
  const targetHeight = targetElement.offsetHeight;

  // 滚动到视口上方 1/3 处
  const scrollTop = targetTop - containerHeight / 3 + targetHeight / 2;

  markProgrammaticScroll();
  containerRef.current.scrollTo({
    top: Math.max(0, scrollTop),
    behavior: 'smooth',
  });
}, [markProgrammaticScroll]);

useEffect(() => {
  if (!autoScrollEnabled || isManualScrolling) return;
  if (!currentEpisode || currentEpisode.id !== episode?.id) return;

  const positionMs = position * 1000;
  const currentIndex = findCurrentSentence(sentences, positionMs);

  if (currentIndex !== -1 && currentIndex !== highlightedIndex) {
    setHighlightedIndex(currentIndex);
    scrollToSentence(currentIndex);
  }
}, [position, autoScrollEnabled, isManualScrolling, currentEpisode?.id, episode?.id]);
```

### 4.7 说话人头像生成策略

#### 方案 1: 颜色编码（推荐）

```typescript
// src/renderer/utils/speakerAvatar.ts
const SPEAKER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-white' },
  { bg: 'bg-green-500', text: 'text-white' },
  { bg: 'bg-purple-500', text: 'text-white' },
  { bg: 'bg-orange-500', text: 'text-white' },
  { bg: 'bg-pink-500', text: 'text-white' },
  { bg: 'bg-indigo-500', text: 'text-white' },
  { bg: 'bg-yellow-500', text: 'text-gray-900' },
  { bg: 'bg-red-500', text: 'text-white' },
];

export function getSpeakerColor(spk: number) {
  return SPEAKER_COLORS[spk % SPEAKER_COLORS.length];
}

export function getSpeakerLabel(spk: number): string {
  return `S${spk + 1}`; // S1, S2, S3...
}
```

**组件实现**:

```typescript
// src/renderer/components/SpeakerAvatar.tsx
const SpeakerAvatar: React.FC<{ spk: number }> = ({ spk }) => {
  const { bg, text } = getSpeakerColor(spk);
  const label = getSpeakerLabel(spk);

  return (
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
        bg,
        text
      )}
      title={`Speaker ${spk + 1}`}
    >
      {label}
    </div>
  );
};
```

#### 方案 2: 图标/Emoji（可选）

为更生动的展示，可使用 emoji 或图标库（如 Heroicons）。

---

## 5. 实现任务拆分

### 5.1 阶段 1: 数据层 (1-2 天)

#### Task 1.1: 创建 DAO
- **文件**: `src/main/database/dao/episodeTranscriptsDao.ts`
- **复杂度**: 简单
- **依赖**: 无
- **实现内容**:
  - [ ] 实现 `findByEpisodeId(episodeId: number)`
  - [ ] 实现 `exists(episodeId: number)`
  - [ ] 添加单元测试 (`src/__tests__/database/episodeTranscriptsDao.test.ts`)

**函数签名**:
```typescript
class EpisodeTranscriptsDao {
  async findByEpisodeId(episodeId: number): Promise<EpisodeTranscript | null>;
  async exists(episodeId: number): Promise<boolean>;
}
```

#### Task 1.2: 添加 IPC Handler
- **文件**: `src/main/services/IPCHandlers.ts`
- **复杂度**: 简单
- **依赖**: Task 1.1
- **实现内容**:
  - [ ] 实现 `handleGetTranscriptByEpisode`
  - [ ] 注册到 `ipcMain.handle('transcript:getByEpisode', ...)`
  - [ ] 在 `destroy()` 中添加清理逻辑

#### Task 1.3: 更新 Preload 和类型定义
- **文件**: `src/main/preload.ts`
- **复杂度**: 简单
- **依赖**: Task 1.2
- **实现内容**:
  - [ ] 在 `electronAPI.transcript` 中添加 `getByEpisode` 方法
  - [ ] 更新 `ElectronAPI` 接口类型定义

### 5.2 阶段 2: 状态管理 (1 天)

#### Task 2.1: 创建 TranscriptStore
- **文件**: `src/renderer/store/transcriptStore.ts`
- **复杂度**: 中等
- **依赖**: Task 1.3
- **实现内容**:
  - [ ] 定义 store 接口和状态
  - [ ] 实现 `loadTranscript(episodeId)` action
  - [ ] 实现 `setAutoScrollEnabled` 和 `setManualScrolling`
  - [ ] 添加加载状态和错误处理
  - [ ] 集成 Zustand devtools

**状态结构**:
```typescript
{
  transcripts: Record<number, SentenceInfo[]>,
  loadingStates: Record<number, boolean>,
  errors: Record<number, string | null>,
  autoScrollEnabled: boolean,
  isManualScrolling: boolean,
}
```

### 5.3 阶段 3: 工具函数 (0.5 天)

#### Task 3.1: 位置匹配算法
- **文件**: `src/renderer/utils/subtitleMatcher.ts`
- **复杂度**: 中等
- **依赖**: 无
- **实现内容**:
  - [ ] 实现 `findCurrentSentence` 函数（二分查找）
  - [ ] 添加单元测试（至少 5 个测试用例）

#### Task 3.2: 说话人头像工具
- **文件**: `src/renderer/utils/speakerAvatar.ts`
- **复杂度**: 简单
- **依赖**: 无
- **实现内容**:
  - [ ] 定义颜色映射表
  - [ ] 实现 `getSpeakerColor(spk: number)`
  - [ ] 实现 `getSpeakerLabel(spk: number)`

#### Task 3.3: 滚动检测 Hook
- **文件**: `src/renderer/hooks/useScrollDetection.ts`
- **复杂度**: 中等
- **依赖**: 无
- **实现内容**:
  - [ ] 实现手动滚动检测逻辑
  - [ ] 防抖处理
  - [ ] 程序化滚动标记功能

### 5.4 阶段 4: UI 组件 (2-3 天)

#### Task 4.1: SpeakerAvatar 组件
- **文件**: `src/renderer/components/SpeakerAvatar.tsx`
- **复杂度**: 简单
- **依赖**: Task 3.2
- **实现内容**:
  - [ ] 创建头像组件
  - [ ] 支持颜色编码
  - [ ] 添加 tooltip
  - [ ] 响应式尺寸

#### Task 4.2: TranscriptItem 组件
- **文件**: `src/renderer/components/TranscriptItem.tsx`
- **复杂度**: 简单
- **依赖**: Task 4.1
- **实现内容**:
  - [ ] 布局：头像 + 文本
  - [ ] 高亮状态样式
  - [ ] 时间戳显示（可选）
  - [ ] 支持点击跳转播放位置（可选）

**Props 接口**:
```typescript
interface TranscriptItemProps {
  sentence: SentenceInfo;
  index: number;
  isHighlighted: boolean;
  onClick?: (startMs: number) => void;
}
```

#### Task 4.3: TranscriptList 组件
- **文件**: `src/renderer/components/TranscriptList.tsx`
- **复杂度**: 复杂
- **依赖**: Task 4.2, Task 3.1, Task 3.3, Task 2.1
- **实现内容**:
  - [ ] 渲染字幕列表
  - [ ] 集成自动高亮逻辑
  - [ ] 集成自动滚动逻辑
  - [ ] 集成手动滚动检测
  - [ ] 性能优化（虚拟滚动，如超过 500 条）
  - [ ] 空状态、加载状态、错误状态处理

**核心逻辑**:
```typescript
const TranscriptList: React.FC<Props> = ({ episodeId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { transcripts, loadTranscript } = useTranscriptStore();
  const { position, currentEpisode } = usePlayerStore();
  const { markProgrammaticScroll } = useScrollDetection(
    containerRef,
    () => setManualScrolling(true),
    autoScrollEnabled
  );

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    loadTranscript(episodeId);
  }, [episodeId]);

  useEffect(() => {
    // 自动高亮和滚动逻辑
  }, [position, autoScrollEnabled]);

  return (
    <div ref={containerRef} className="overflow-y-auto">
      {sentences.map((sentence, index) => (
        <TranscriptItem
          key={index}
          sentence={sentence}
          index={index}
          isHighlighted={highlightedIndex === index}
        />
      ))}
    </div>
  );
};
```

#### Task 4.4: 更新 EpisodeDetailPage 字幕标签页
- **文件**: `src/renderer/pages/EpisodeDetailPage.tsx`
- **复杂度**: 简单
- **依赖**: Task 4.3
- **实现内容**:
  - [ ] 替换占位符内容（第 720-732 行）
  - [ ] 使用 TranscriptList 组件
  - [ ] 添加条件渲染逻辑（有/无字幕）

**修改位置**:
```typescript
// 替换原有的 transcriptPanel
const transcriptPanel = (
  <TranscriptList episodeId={episode.id} />
);
```

### 5.5 阶段 5: Focus Control (1 天)

#### Task 5.1: FocusControl 组件
- **文件**: `src/renderer/components/AudioPlayer/FocusControl.tsx`
- **复杂度**: 中等
- **依赖**: Task 2.1
- **实现内容**:
  - [ ] 创建按钮组件
  - [ ] 可见性逻辑（仅当播放剧集与 DetailPage 匹配时显示）
  - [ ] 点击恢复自动滚动
  - [ ] 状态指示（图标变化或颜色变化）
  - [ ] Tooltip 提示

**Props 接口**:
```typescript
interface FocusControlProps {
  currentEpisodeId: number | null;
  detailPageEpisodeId: number | null;
  autoScrollEnabled: boolean;
  onFocusClick: () => void;
}
```

**组件结构**:
```typescript
const FocusControl: React.FC<Props> = ({
  currentEpisodeId,
  detailPageEpisodeId,
  autoScrollEnabled,
  onFocusClick,
}) => {
  const isVisible = currentEpisodeId === detailPageEpisodeId && detailPageEpisodeId !== null;

  if (!isVisible) {
    return <div className="w-10 h-10" />; // 占位保持布局
  }

  return (
    <button
      onClick={onFocusClick}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border transition',
        autoScrollEnabled
          ? 'border-blue-500 text-blue-600'
          : 'border-gray-300 text-gray-600 hover:border-blue-400'
      )}
      title={autoScrollEnabled ? 'Auto-scroll enabled' : 'Click to focus on current subtitle'}
    >
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        {/* 眼睛图标或靶心图标 */}
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
      </svg>
    </button>
  );
};
```

#### Task 5.2: 集成 FocusControl 到 AudioPlayer
- **文件**: `src/renderer/components/AudioPlayer/AudioPlayer.tsx`
- **复杂度**: 简单
- **依赖**: Task 5.1
- **实现内容**:
  - [ ] 导入 FocusControl
  - [ ] 获取 DetailPage 当前剧集 ID（通过 store 或 context）
  - [ ] 插入到 SpeedControl 之前（约第 193 行）
  - [ ] 传递正确的 props

**插入位置**:
```typescript
{/* 在 Secondary Controls 部分 */}
<div className="flex items-center space-x-2">
  {/* Focus Control - 新增 */}
  <FocusControl
    currentEpisodeId={currentEpisode?.id ?? null}
    detailPageEpisodeId={detailPageEpisodeId}
    autoScrollEnabled={autoScrollEnabled}
    onFocusClick={handleFocusClick}
  />

  {/* Speed Control - 已存在 */}
  <SpeedControl ... />

  {/* Volume Control - 已存在 */}
  <VolumeControl ... />
</div>
```

#### Task 5.3: 获取 DetailPage 剧集状态
- **文件**: `src/renderer/store/episodeDetailStore.ts` (已存在)
- **复杂度**: 简单
- **依赖**: 无
- **实现内容**:
  - [ ] 确认 `selectedEpisode` 已暴露（已存在）
  - [ ] 在 AudioPlayer 中订阅此状态

---

## 6. 测试策略

### 6.1 单元测试

#### Test Suite 1: subtitleMatcher.ts
- **文件**: `src/__tests__/utils/subtitleMatcher.test.ts`
- **覆盖场景**:
  - [ ] 空数组输入
  - [ ] 位置在第一句之前
  - [ ] 位置在最后一句之后
  - [ ] 位置在句子开始时刻
  - [ ] 位置在句子结束时刻
  - [ ] 位置在句子中间
  - [ ] 位置在两句间隙

#### Test Suite 2: episodeTranscriptsDao.ts
- **文件**: `src/__tests__/database/episodeTranscriptsDao.test.ts`
- **覆盖场景**:
  - [ ] 查询存在的字幕
  - [ ] 查询不存在的字幕
  - [ ] 解析 JSON 格式正确性
  - [ ] 数据库连接失败处理

#### Test Suite 3: TranscriptStore
- **文件**: `src/__tests__/store/transcriptStore.test.ts`
- **覆盖场景**:
  - [ ] 初始状态正确
  - [ ] loadTranscript 成功
  - [ ] loadTranscript 失败
  - [ ] 切换自动滚动状态
  - [ ] 多次加载同一剧集（缓存）

### 6.2 集成测试

#### Integration Test 1: 字幕加载流程
- **描述**: 测试从 IPC 到 UI 的完整数据流
- **场景**:
  - [ ] Given: 数据库有字幕数据
  - [ ] When: 打开 Episode Detail 页面
  - [ ] Then: 字幕正确显示

#### Integration Test 2: 自动滚动与手动覆盖
- **描述**: 测试自动滚动和手动滚动交互
- **场景**:
  - [ ] Given: 字幕自动滚动开启
  - [ ] When: 用户手动滚动
  - [ ] Then: 自动滚动停止
  - [ ] When: 点击 Focus 按钮
  - [ ] Then: 自动滚动恢复

### 6.3 边界情况测试

| 场景                     | 预期行为                                 |
| ------------------------ | ---------------------------------------- |
| 无字幕数据               | 显示友好的空状态提示                     |
| 字幕加载中               | 显示 loading spinner                     |
| 字幕加载失败             | 显示错误信息和重试按钮                   |
| 查看时剧集切换           | 清空旧字幕，加载新字幕，重置滚动状态     |
| 快速连续 seek           | 高亮和滚动立即响应最新位置               |
| 超长字幕列表（>1000 句） | 使用虚拟滚动保持性能                     |
| 网络延迟获取字幕         | 显示加载状态，超时后提示错误             |
| 播放结束                 | 高亮最后一句                             |
| 播放前（position = 0）   | 不高亮任何句子或高亮第一句               |
| 单说话人                 | 头像简化显示或统一样式                   |
| 多说话人（>8 个）        | 颜色循环使用，确保可区分                 |

---

## 7. 用户体验设计

### 7.1 滚动行为细节

- **滚动目标位置**: 当前句子距视口顶部约 1/3 处
  - 理由：既能看到当前句子，也能看到接下来的几句

- **滚动动画**: 使用 `behavior: 'smooth'`
  - 时长：约 300-500ms（浏览器默认）
  - 在快速 seek 时仍使用平滑滚动以减少突兀感

- **滚动边界**:
  - 第一句：距顶部 20px
  - 最后一句：距底部 20px

### 7.2 高亮样式建议

#### 方案 A: 边框高亮（推荐）

```css
.transcript-item {
  @apply border-l-4 border-transparent px-4 py-3 transition-colors;
}

.transcript-item.highlighted {
  @apply border-l-blue-500 bg-blue-50 dark:bg-blue-900/20;
}
```

#### 方案 B: 背景高亮

```css
.transcript-item {
  @apply px-4 py-3 transition-colors;
}

.transcript-item.highlighted {
  @apply bg-yellow-100 dark:bg-yellow-900/30;
}
```

#### 方案 C: 组合方案

```css
.transcript-item.highlighted {
  @apply border-l-4 border-l-blue-500 bg-blue-50 shadow-sm dark:bg-blue-900/20;
}
```

### 7.3 Focus 按钮图标和位置

- **图标**: 眼睛图标（Eye）或靶心图标（Target）
  - 推荐：Heroicons 的 `EyeIcon` 或自定义 SVG

- **位置**: AudioPlayer 中 SpeedControl 之前
  - 保持 Secondary Controls 区域的视觉平衡

- **尺寸**: 与 SpeedControl 和 VolumeControl 一致（h-10 w-10）

- **Tooltip**:
  - 自动模式: "Auto-scroll enabled"
  - 手动模式: "Click to focus on current subtitle"

### 7.4 空状态设计

```typescript
const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
    <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="currentColor">
      {/* 文档图标 */}
    </svg>
    <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
      No transcript available
    </h3>
    <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
      This episode doesn't have a transcript yet. Click the "AI" button to generate one.
    </p>
  </div>
);
```

### 7.5 加载状态设计

```typescript
const LoadingState = () => (
  <div className="flex h-full items-center justify-center">
    <div className="flex flex-col items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500"></div>
      <p className="mt-4 text-sm text-gray-500">Loading transcript...</p>
    </div>
  </div>
);
```

### 7.6 错误状态设计

```typescript
const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
    <svg className="h-12 w-12 text-red-400" viewBox="0 0 24 24" fill="currentColor">
      {/* 错误图标 */}
    </svg>
    <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
      Failed to load transcript
    </h3>
    <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
      {error}
    </p>
    <button
      onClick={onRetry}
      className="mt-4 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
    >
      Retry
    </button>
  </div>
);
```

---

## 8. 性能优化

### 8.1 虚拟滚动（可选，如超过 500 句）

**库选择**: react-window 或 react-virtuoso

**实现示例** (使用 react-window):

```typescript
import { FixedSizeList } from 'react-window';

const TranscriptList: React.FC<Props> = ({ sentences }) => {
  const renderRow = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <TranscriptItem
        sentence={sentences[index]}
        index={index}
        isHighlighted={highlightedIndex === index}
      />
    </div>
  );

  return (
    <FixedSizeList
      height={600} // 容器高度
      itemCount={sentences.length}
      itemSize={80} // 单项高度
      width="100%"
    >
      {renderRow}
    </FixedSizeList>
  );
};
```

### 8.2 防抖和节流

- **手动滚动检测**: 防抖 150ms
- **位置更新**: 节流 100ms（playerStore 已处理）
- **高亮更新**: 仅在 index 变化时重新渲染

### 8.3 缓存策略

- **TranscriptStore**: 已加载的字幕保存在 `transcripts` 对象中
- **过期策略**: 剧集切换时可选择性清理旧字幕（如内存受限）

---

## 9. 实现时间线

| 阶段              | 任务                         | 预计时间 | 依赖                     |
| ----------------- | ---------------------------- | -------- | ------------------------ |
| **阶段 1: 数据层** | Task 1.1 - 1.3               | 1-2 天   | 无                       |
| **阶段 2: 状态**   | Task 2.1                     | 1 天     | 阶段 1                   |
| **阶段 3: 工具**   | Task 3.1 - 3.3               | 0.5 天   | 无                       |
| **阶段 4: UI**     | Task 4.1 - 4.4               | 2-3 天   | 阶段 2, 阶段 3           |
| **阶段 5: Focus**  | Task 5.1 - 5.3               | 1 天     | 阶段 2                   |
| **测试和优化**     | 单元测试、集成测试、性能优化 | 1-2 天   | 所有阶段                 |
| **总计**           |                              | 6.5-9.5 天 |                          |

---

## 10. 技术风险和缓解措施

| 风险                     | 影响 | 概率 | 缓解措施                                                     |
| ------------------------ | ---- | ---- | ------------------------------------------------------------ |
| 超长字幕列表性能问题     | 高   | 中   | 实现虚拟滚动（react-window）                                 |
| 手动滚动误触发           | 中   | 中   | 增加防抖时间，优化检测算法                                   |
| 快速 seek 导致滚动混乱   | 中   | 低   | 取消正在进行的滚动动画，立即跳转到新位置                     |
| 不同浏览器滚动行为差异   | 低   | 中   | 测试多种浏览器，使用 polyfill                                |
| 数据库查询字幕失败       | 高   | 低   | 添加错误处理和重试机制                                       |
| DetailPage 和 AudioPlayer 状态同步问题 | 高   | 低   | 使用统一的 Zustand store，确保单一数据源                     |

---

## 11. 未来扩展功能（不在当前范围）

1. **点击句子跳转播放位置**: 用户点击某句字幕，播放器跳转到该时间点
2. **字幕搜索**: 在字幕中搜索关键词
3. **字幕导出**: 导出为 SRT/VTT 格式
4. **字幕编辑**: 允许用户修正字幕内容
5. **多语言字幕**: 支持双语字幕并排显示
6. **字幕笔记**: 在字幕上添加个人笔记
7. **键盘快捷键**: 使用上下键跳转句子

---

## 12. 参考资料

### 12.1 项目文档

- `/Users/leo/Projects/misc/easypod/CLAUDE.md` - 项目开发指南
- `/Users/leo/Projects/misc/easypod/docs/sub.md` - 字幕功能数据库设计
- `/Users/leo/Projects/misc/easypod/docs/plan.md` - 项目整体规划

### 12.2 相关代码

- `src/renderer/pages/EpisodeDetailPage.tsx` - 主要修改目标
- `src/renderer/components/AudioPlayer/AudioPlayer.tsx` - Focus Control 集成位置
- `src/renderer/store/playerStore.ts` - 播放位置数据源
- `src/main/database/schema.ts` - 数据库架构定义
- `src/main/types/transcript.ts` - 字幕类型定义

### 12.3 技术栈文档

- [Zustand](https://github.com/pmndrs/zustand) - 状态管理
- [React Window](https://react-window.vercel.app/) - 虚拟滚动
- [Drizzle ORM](https://orm.drizzle.team/) - 数据库 ORM
- [Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-main) - 进程通信

---

## 13. 附录

### 13.1 完整组件树

```
EpisodeDetailPage
└── Tabs
    └── TranscriptTab
        ├── [Loading State]
        ├── [Error State]
        ├── [Empty State]
        └── TranscriptList
            └── TranscriptItem (循环)
                ├── SpeakerAvatar
                └── SentenceText

AudioPlayer
├── ...existing components
└── Secondary Controls
    ├── FocusControl (新增)
    ├── SpeedControl
    └── VolumeControl
```

### 13.2 数据流图

```
┌──────────────────────────────────────────────────────────┐
│                     User Actions                         │
├──────────────────────────────────────────────────────────┤
│ 1. Open Episode Detail Page                             │
│ 2. Play audio                                            │
│ 3. Manual scroll                                         │
│ 4. Click Focus button                                    │
└──────────────┬───────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────┐
│                    State Updates                         │
├──────────────────────────────────────────────────────────┤
│ TranscriptStore:                                         │
│   - loadTranscript(episodeId)                            │
│   - setAutoScrollEnabled(true/false)                     │
│   - setManualScrolling(true/false)                       │
│                                                          │
│ PlayerStore:                                             │
│   - position updates (every 100ms)                       │
│   - currentEpisode changes                               │
└──────────────┬───────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────┐
│                    UI Updates                            │
├──────────────────────────────────────────────────────────┤
│ TranscriptList:                                          │
│   - findCurrentSentence(position)                        │
│   - setHighlightedIndex(index)                           │
│   - scrollToSentence(index) [if auto-scroll enabled]    │
│                                                          │
│ FocusControl:                                            │
│   - Update button state (active/inactive)                │
└──────────────────────────────────────────────────────────┘
```

### 13.3 关键时间点

- **播放位置更新**: 每 100ms（playerStore 节流）
- **滚动动画时长**: 300-500ms（浏览器默认）
- **手动滚动防抖**: 150ms
- **程序化滚动标记窗口**: 100ms

---

## 14. 审批和签收

| 角色         | 姓名 | 日期 | 签名 |
| ------------ | ---- | ---- | ---- |
| 需求分析师   |      |      |      |
| 技术负责人   |      |      |      |
| 产品经理     |      |      |      |
| 开发工程师   |      |      |      |

---

**文档结束**
