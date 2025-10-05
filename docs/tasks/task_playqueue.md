# 播放列表功能需求与技术方案

**创建时间：** 2025-10-01
**状态：** 待实施
**优先级：** P0（核心功能）

---

## 📋 需求概述

### 核心需求
1. **持久化播放列表** - 数据库存储队列，应用重启后数据不丢失
2. **队列操作按钮** - SubscriptionList 和 All Episodes 中添加"加入队首/队尾"图标
3. **自动加入队列** - 直接播放时默认放到队首
4. **断点续播** - 记录当前播放位置，重启后恢复但不自动播放
5. **队列面板** - AudioPlayer 添加 hover 展示播放队列的组件
6. **播放队列页面** - Recently Played 改为播放列表展示，使用 All Episodes 样式

### 设计原则
- 所有 icon 样式保持统一
- 使用蓝色作为主题色（与现有设计一致）
- 提供清晰的视觉反馈和状态指示

---

## 🏗️ 技术架构

### 1. 数据库设计

#### 播放队列表 (play_queue)
```typescript
export const playQueue = sqliteTable('play_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id')
    .notNull()
    .references(() => episodes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(), // 队列位置，越小越靠前
  addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`),
});
```

**说明：**
- `position` 使用间隔整数（1000, 2000, 3000...）便于插入
- `onDelete: 'cascade'` 确保 episode 删除时自动清理队列

#### 播放状态表 (playback_state)
```typescript
export const playbackState = sqliteTable('playback_state', {
  id: integer('id').primaryKey().default(1), // 固定为1，单行表
  currentEpisodeId: integer('current_episode_id')
    .references(() => episodes.id, { onDelete: 'set null' }),
  currentPosition: integer('current_position').default(0), // 播放位置（秒）
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
```

**说明：**
- 单行表设计，id 固定为 1
- 记录当前播放 episode 和播放位置
- 用于应用重启后恢复状态

---

### 2. 状态管理设计

#### PlayQueueStore
**文件：** `src/renderer/store/playQueueStore.ts`

```typescript
interface PlayQueueStore {
  // State
  queue: Episode[];          // 播放队列（按 position 排序）
  currentIndex: number;      // 当前播放索引（-1 表示未播放）
  isLoading: boolean;
  error: string | null;

  // Actions
  loadQueue: () => Promise<void>;
  addToQueueStart: (episode: Episode) => Promise<void>;
  addToQueueEnd: (episode: Episode) => Promise<void>;
  removeFromQueue: (episodeId: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  playNext: () => void;
  playPrevious: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<void>;
  setCurrentIndex: (index: number) => void;
}
```

**关键逻辑：**
- 队列位置使用间隔整数算法（1000, 2000, 3000...）
- 添加到队首：position = 0，其他 episode position 不变
- 添加到队尾：position = maxPosition + 1000
- 当间隔小于 10 时，触发批量重整

#### PlayerStore 增强
**文件：** `src/renderer/store/playerStore.ts`

新增方法：
```typescript
interface PlayerStore {
  // 新增
  loadPlaybackState: () => Promise<void>;  // 启动时加载播放状态
  savePlaybackState: () => Promise<void>;  // 保存播放状态（防抖10秒）
}
```

---

### 3. IPC 通信层

#### Main Process API
**文件：** `src/main/services/IPCHandlers.ts`

```typescript
// 播放队列 IPC
ipcMain.handle('playQueue:getAll', async () => {...})
ipcMain.handle('playQueue:add', async (_, episodeId, position) => {...})
ipcMain.handle('playQueue:remove', async (_, episodeId) => {...})
ipcMain.handle('playQueue:reorder', async (_, items) => {...})
ipcMain.handle('playQueue:clear', async () => {...})

// 播放状态 IPC
ipcMain.handle('playbackState:get', async () => {...})
ipcMain.handle('playbackState:save', async (_, episodeId, position) => {...})
```

#### Preload API
**文件：** `src/main/preload.ts`

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // 现有 API...

  playQueue: {
    getAll: () => ipcRenderer.invoke('playQueue:getAll'),
    add: (episodeId, position) => ipcRenderer.invoke('playQueue:add', episodeId, position),
    remove: (episodeId) => ipcRenderer.invoke('playQueue:remove', episodeId),
    reorder: (items) => ipcRenderer.invoke('playQueue:reorder', items),
    clear: () => ipcRenderer.invoke('playQueue:clear'),
  },

  playbackState: {
    get: () => ipcRenderer.invoke('playbackState:get'),
    save: (episodeId, position) => ipcRenderer.invoke('playbackState:save', episodeId, position),
  },
});
```

---

### 4. 组件设计

#### QueueButton 组件
**文件：** `src/renderer/components/QueueButton.tsx`

```typescript
interface QueueButtonProps {
  episode: Episode;
  size?: 'sm' | 'md' | 'lg';
}

// 下拉菜单形式
// 选项：
// - ⬆️ 添加到队首
// - ⬇️ 添加到队尾
```

**视觉设计：**
- 图标：三个点或队列图标
- Hover 显示下拉菜单
- 点击后显示 Toast 反馈

#### QueuePanel 组件
**文件：** `src/renderer/components/AudioPlayer/QueuePanel.tsx`

```typescript
interface QueuePanelProps {
  queue: Episode[];
  currentEpisodeId: number | null;
  onPlay: (episode: Episode) => void;
  onRemove: (episodeId: number) => void;
  onClear: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}
```

**功能特性：**
- Badge 显示队列数量（如 "🎵 3"）
- Hover 展开悬浮面板（延迟 300ms）
- 当前播放 episode 高亮显示
- 支持点击跳转播放
- 每个 episode 右侧有删除按钮 ✕
- 支持拖拽重排序（使用 @dnd-kit/core）
- 清空队列按钮

**布局示例：**
```
┌────────────────────────────────────┐
│ 播放队列 (3)          [清空队列]   │
│                                    │
│ ▶ 1. Current Episode (playing)    │
│   2. Next Episode          [×]    │
│   3. Another Episode       [×]    │
└────────────────────────────────────┘
```

#### PlayQueuePage 组件
**文件：** `src/renderer/pages/PlayQueuePage.tsx`

- 重命名自 RecentlyPlayedPage
- 复用 EpisodeCard 组件展示队列
- 显示队列位置编号（1, 2, 3...）
- 当前播放 episode 高亮显示
- 支持拖拽重排序
- 支持删除队列项
- 队列为空时显示空状态

---

## 📅 实施步骤

### P0 阶段 - 数据层（第 1-2 周）

#### 任务 1：数据库设计
- [ ] 在 `src/main/database/schema.ts` 添加 `playQueue` 和 `playbackState` 表
- [ ] 编写数据库迁移脚本
- [ ] 创建 `src/main/database/dao/playQueueDao.ts`
- [ ] 创建 `src/main/database/dao/playbackStateDao.ts`

#### 任务 2：IPC 通信层
- [ ] 在 `src/main/services/IPCHandlers.ts` 实现播放队列 IPC handlers
- [ ] 实现播放状态 IPC handlers
- [ ] 在 `src/main/preload.ts` 暴露 API
- [ ] 更新 TypeScript 类型定义

#### 任务 3：状态管理
- [ ] 创建 `src/renderer/store/playQueueStore.ts`
- [ ] 实现队列增删改查逻辑
- [ ] 实现队列位置计算算法
- [ ] 增强 `src/renderer/store/playerStore.ts`
  - [ ] 添加 `loadPlaybackState()` 方法
  - [ ] 添加 `savePlaybackState()` 方法（10秒防抖）

#### 任务 4：启动流程集成
- [ ] 在 `src/renderer/App.tsx` 初始化时加载播放队列
- [ ] 加载播放状态（但不自动播放）
- [ ] 在 `src/renderer/hooks/useAudioPlayer.ts` 实现播放位置自动保存

---

### P1 阶段 - UI 组件（第 3 周）

#### 任务 5：队列操作按钮
- [ ] 创建 `src/renderer/components/QueueButton.tsx`
- [ ] 设计图标：⬆️ 队首 / ⬇️ 队尾
- [ ] 修改 `src/renderer/components/Episode/EpisodeCard.tsx` 集成按钮
- [ ] 修改 `src/renderer/components/Subscription/SubscriptionList.tsx` 添加按钮
- [ ] 添加 Toast 提示反馈

#### 任务 6：AudioPlayer 集成
- [ ] 创建 `src/renderer/components/AudioPlayer/QueuePanel.tsx`
- [ ] 实现队列 Badge 显示
- [ ] 实现 hover 悬浮展示
- [ ] 实现点击跳转播放
- [ ] 实现删除队列项
- [ ] 修改 `src/renderer/components/AudioPlayer/AudioPlayer.tsx` 集成 QueuePanel

#### 任务 7：播放队列页面
- [ ] 重命名 `src/renderer/pages/RecentlyPlayedPage.tsx` → `PlayQueuePage.tsx`
- [ ] 复用 EpisodeCard 展示队列
- [ ] 显示当前播放高亮
- [ ] 实现队列空状态
- [ ] 更新路由（/recently-played → /play-queue）
- [ ] 更新导航菜单文案

#### 任务 8：自动播放逻辑
- [ ] 修改 `src/renderer/components/PlayPauseButton.tsx` - 播放时自动加入队首
- [ ] 实现播放完成自动下一首
- [ ] 队列为空时停止播放

---

### P2 阶段 - 增强优化（第 4 周）

#### 任务 9：拖拽排序
- [ ] 安装依赖：`npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [ ] QueuePanel 实现拖拽重排序
- [ ] PlayQueuePage 实现拖拽重排序
- [ ] 拖拽结束后批量保存到数据库

#### 任务 10：测试与优化
- [ ] 编写单元测试（playQueueStore, DAO 层）
- [ ] 编写集成测试（队列操作流程）
- [ ] 性能优化（防抖、批量操作）
- [ ] Bug 修复和边界情况处理
- [ ] 完成手动测试清单

---

## 🎨 UI/UX 设计规范

### 图标设计
| 功能 | 图标 | 说明 |
|------|------|------|
| 添加到队首 | ⬆️ | ArrowUpCircle，表示插入顶部 |
| 添加到队尾 | ⬇️ | ArrowDownCircle，表示追加底部 |
| 播放队列 | 🎵 | MusicNote + 数字 Badge |
| 删除 | ✕ | 关闭图标 |
| 拖拽手柄 | ⋮⋮ | GripVertical |

### 颜色规范
- **主题色：** 蓝色（blue-600/blue-500）
- **当前播放高亮：** bg-blue-100 dark:bg-blue-900
- **Hover 遮罩：** bg-black/40
- **边框高亮：** border-blue-400 dark:border-blue-500

### 交互反馈
- **添加到队列：** Toast 提示 "已添加到队列顶部/底部"，3秒自动消失
- **重复添加：** Toast 提示 "已在队列中"
- **移除队列：** Toast 提示 "已从队列移除"，提供撤销按钮（5秒）
- **队列为空：** 显示空状态 "播放队列为空"

### 动画效果
- **队列面板展开/收起：** 300ms ease-in-out
- **Episode 添加：** 淡入 + 向下滑动
- **Episode 移除：** 淡出 + 向上滑动
- **拖拽排序：** 实时位置更新，平滑过渡

---

## 🔧 技术难点与解决方案

### 1. 队列位置管理算法

**问题：** 频繁插入队首/队尾时，如何避免重新计算所有位置？

**解决方案：**
```typescript
const POSITION_INTERVAL = 1000;

// 插入队首
function getQueueStartPosition(): number {
  return 0; // 始终为 0
}

// 插入队尾
function getQueueEndPosition(queue: QueueItem[]): number {
  if (queue.length === 0) return POSITION_INTERVAL;
  return Math.max(...queue.map(q => q.position)) + POSITION_INTERVAL;
}

// 位置重整（当间隔小于 10 时触发）
function rebalancePositions(queue: QueueItem[]): QueueItem[] {
  return queue
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({
      ...item,
      position: (index + 1) * POSITION_INTERVAL,
    }));
}
```

---

### 2. 播放状态持久化

**问题：** 频繁保存会影响性能和数据库寿命。

**解决方案：**
```typescript
// 使用 lodash 的 debounce
import { debounce } from 'lodash-es';

const debouncedSavePosition = debounce(async (episodeId, position) => {
  await window.electronAPI.playbackState.save(episodeId, position);
  await window.electronAPI.episodes.updateProgress({
    id: episodeId,
    lastPositionSec: position
  });
}, 10000); // 10秒防抖

// 特殊情况立即保存
const savePo

sitionImmediately = async () => {
  debouncedSavePosition.flush(); // 立即执行
};

// 在以下情况立即保存：
// - 播放暂停
// - 切换 episode
// - 应用关闭（beforeunload）
```

---

### 3. 拖拽排序实现

**问题：** 需要流畅的拖拽体验和准确的位置更新。

**解决方案：**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// 乐观更新：拖拽时立即更新 UI
const handleDragEnd = (event) => {
  const { active, over } = event;
  if (active.id !== over.id) {
    // 1. 立即更新 UI
    setQueue((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });

    // 2. 异步更新数据库
    playQueueStore.reorderQueue(active.id, over.id);
  }
};
```

---

### 4. 播放完成自动下一首

**问题：** 需要准确判断播放完成，处理队列边界情况。

**解决方案：**
```typescript
// 在 useAudioPlayer.ts 中监听 ended 事件
player.on('ended', () => {
  const { queue, currentIndex } = usePlayQueueStore.getState();

  if (currentIndex < queue.length - 1) {
    // 有下一首，自动播放
    usePlayQueueStore.getState().playNext();
  } else {
    // 队列结束，停止播放
    usePlayerStore.getState().pause();
    // 可选：显示 Toast "播放列表已播放完毕"
  }
});
```

---

### 5. 应用启动状态恢复

**问题：** 需要加载播放状态但不自动播放。

**解决方案：**
```typescript
// 在 playerStore.ts 中
loadPlaybackState: async () => {
  const state = await window.electronAPI.playbackState.get();
  if (!state || !state.currentEpisodeId) return;

  const episode = await window.electronAPI.episodes.getById(state.currentEpisodeId);
  if (!episode) return;

  const { audioRef } = get();

  set({
    currentEpisode: episode,
    position: state.currentPosition,
    isPlaying: false,  // 关键：不自动播放
    duration: episode.durationSec || 0,
  });

  // 仅加载音频，不播放
  if (audioRef) {
    audioRef.src = episode.audioUrl;
    audioRef.currentTime = state.currentPosition;
    // 不调用 audioRef.play()
  }
}

// 在 App.tsx 中调用
useEffect(() => {
  playQueueStore.loadQueue();
  playerStore.loadPlaybackState();
}, []);
```

---

## ✅ 验收标准

### 功能验收清单

**队列操作：**
- [ ] 用户可以添加 Episode 到队首
- [ ] 用户可以添加 Episode 到队尾
- [ ] 重复添加时显示提示
- [ ] 可以从队列中移除 Episode
- [ ] 可以清空队列
- [ ] 可以拖拽重排序队列

**播放逻辑：**
- [ ] 点击播放自动加入队首（如果不在队列）
- [ ] 播放完成自动播放下一首
- [ ] 队列最后一首播放完停止
- [ ] 可以点击队列中任意 Episode 跳转播放

**状态持久化：**
- [ ] 应用重启后恢复播放状态
- [ ] 恢复后不自动播放（保持暂停状态）
- [ ] 播放位置正确恢复
- [ ] 播放队列正确恢复

**UI 展示：**
- [ ] AudioPlayer 显示队列数量 Badge
- [ ] Hover Badge 显示完整队列面板
- [ ] 队列中当前播放 Episode 高亮
- [ ] 播放列表页面正常显示
- [ ] 队列为空时显示空状态

### 性能验收

- [ ] 队列操作响应时间 < 100ms
- [ ] 播放状态保存不阻塞 UI
- [ ] 队列长度 100+ 时仍流畅
- [ ] 拖拽排序流畅无卡顿

### 兼容性验收

- [ ] macOS 10.15+ 正常运行
- [ ] Windows 10+ 正常运行
- [ ] 深色模式正常显示
- [ ] 所有图标样式统一

---

## 📦 文件清单

### 新建文件（8个）

1. `src/main/database/dao/playQueueDao.ts` - 播放队列 DAO
2. `src/main/database/dao/playbackStateDao.ts` - 播放状态 DAO
3. `src/renderer/store/playQueueStore.ts` - 播放队列状态管理
4. `src/renderer/components/QueueButton.tsx` - 队列操作按钮
5. `src/renderer/components/AudioPlayer/QueuePanel.tsx` - 队列面板
6. `src/renderer/pages/PlayQueuePage.tsx` - 播放队列页面
7. `src/renderer/types/playQueue.ts` - 类型定义
8. 数据库迁移脚本

### 修改文件（10个）

1. `src/main/database/schema.ts` - 添加表定义
2. `src/main/services/IPCHandlers.ts` - 添加 IPC handlers
3. `src/main/preload.ts` - 暴露 API
4. `src/renderer/store/playerStore.ts` - 增强播放器状态
5. `src/renderer/components/Episode/EpisodeCard.tsx` - 添加队列按钮
6. `src/renderer/components/Subscription/SubscriptionList.tsx` - 集成队列操作
7. `src/renderer/components/AudioPlayer/AudioPlayer.tsx` - 集成队列面板
8. `src/renderer/components/PlayPauseButton.tsx` - 自动加入队列
9. `src/renderer/hooks/useAudioPlayer.ts` - 自动保存播放位置
10. `src/renderer/App.tsx` - 启动时加载状态

### 删除文件（1个）

1. `src/renderer/pages/RecentlyPlayedPage.tsx` - 重命名为 PlayQueuePage

---

## 🧪 测试策略

### 单元测试

**测试文件位置：** `tests/unit/`

1. **playQueueStore 测试**
   - ✓ 添加到队首/队尾
   - ✓ 从队列移除
   - ✓ 队列重排序
   - ✓ 播放下一首/上一首
   - ✓ 清空队列

2. **PlayQueueDao 测试**
   - ✓ CRUD 操作
   - ✓ 位置计算算法
   - ✓ 批量重排序

3. **队列位置算法测试**
   - ✓ 连续插入队首
   - ✓ 连续插入队尾
   - ✓ 位置重整触发

### 集成测试

**测试场景：**

1. **队列操作流程**
   ```
   添加 Episode A 到队尾
   → 添加 Episode B 到队首
   → 验证队列顺序：[B, A]
   → 播放 B
   → 播放完成自动播放 A
   ```

2. **状态持久化流程**
   ```
   播放 Episode A 到 30 秒
   → 关闭应用
   → 重新打开
   → 验证当前播放 A，位置 30 秒，未播放
   ```

3. **拖拽重排序流程**
   ```
   队列：[A, B, C, D]
   → 拖动 D 到第二位
   → 验证队列：[A, D, B, C]
   → 验证数据库 position 更新正确
   ```

### 手动测试清单

**P0 必测场景：**

- [ ] 从 SubscriptionList 添加 episode 到队首
- [ ] 从 SubscriptionList 添加 episode 到队尾
- [ ] 从 All Episodes 页面添加 episode 到队列
- [ ] 直接点击播放，验证自动加入队首
- [ ] 播放中关闭应用，重启验证状态恢复
- [ ] 播放完成自动跳转下一首
- [ ] 队列最后一首播放完成，停止播放
- [ ] AudioPlayer 的 QueuePanel hover 展示
- [ ] QueuePanel 中拖拽重排序
- [ ] QueuePanel 中删除队列项
- [ ] PlayQueuePage 展示完整队列
- [ ] 当前播放 episode 在队列中高亮

**边界情况测试：**

- [ ] 队列为空时播放 episode
- [ ] 删除当前正在播放的 episode
- [ ] 删除队列中的所有 episode
- [ ] 重复添加同一 episode
- [ ] 快速连续添加多个 episode
- [ ] 播放位置为 0 时重启应用

---

## ⏱️ 预计时间线

- **第 1-2 周（P0）：** 数据层和状态管理实现
- **第 3 周（P1）：** UI 组件开发和集成
- **第 4 周（P2）：** 拖拽排序、测试和优化

**总计：** 3-4 周

---

## 📚 相关资源

### 依赖库
```bash
# 拖拽排序
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# 工具库（如需要）
npm install lodash-es
npm install @types/lodash-es -D
```

### 参考文档
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [@dnd-kit 文档](https://docs.dndkit.com/)
- [Electron IPC 文档](https://www.electronjs.org/docs/latest/api/ipc-main)

---

## 🚀 下一步行动

1. **确认需求**：与产品/设计确认功能细节
2. **开始实施**：从 P0 阶段的数据库设计开始
3. **定期 Review**：每完成一个任务进行代码审查
4. **持续测试**：每个阶段完成后进行功能验证

---

**负责人：** 开发团队
**审核人：** 技术负责人
**最后更新：** 2025-10-01
