# 任务:播放队列功能

## 任务信息
- **阶段**: 4 - 增强播放功能
- **估时**: 14小时
- **优先级**: 高
- **依赖**: task_podcast_stage3_playback_state_persistence, task_podcast_stage3_global_settings_persistence

## 任务目标
实现完整的播放队列功能,支持添加、删除、重排序episodes,提供直观的队列管理界面和自动播放逻辑。

## 具体任务

### 1. 队列数据结构和存储 (3小时)
   - 在 playerStore 中添加队列状态
   - 设计队列数据结构:`Array<{episodeId, position}>`
   - 可选:创建 play_queue 表持久化队列
   - 实现队列序列化和反序列化
   - 应用启动时恢复队列

### 2. 队列操作实现 (4小时)
   - **添加到队列头部**(优先播放)
   - **添加到队列尾部**(排队播放)
   - **从队列移除**(删除指定episode)
   - **清空队列**(一键清空所有)
   - **重排序**(拖拽或上移/下移)
   - 队列去重(同一episode不重复添加)

### 3. 队列UI组件 (4小时)
   - 播放栏旁的"队列"按钮(带数量徽章)
   - 队列侧边栏(右侧滑出抽屉)
   - 队列项卡片:
     - Episode缩略图
     - 标题和时长
     - 拖拽手柄
     - 删除按钮
   - 当前播放的episode高亮
   - 空队列状态提示

### 4. 拖拽排序功能 (2小时)
   - 使用 @dnd-kit/core 或 react-beautiful-dnd
   - 拖拽时显示占位符
   - 拖拽结束后更新队列顺序
   - 平滑动画过渡

### 5. 队列播放逻辑 (1小时)
   - 当前episode播放完成 → 自动播放队列下一个
   - 点击队列中的episode → 立即切换播放
   - 队列为空时,播放完成后停止
   - 尊重"自动播放下一集"设置

## 验收标准
- [ ] 添加5个episodes到队列,顺序正确显示
- [ ] 拖动调整顺序后,播放顺序符合预期
- [ ] 当前播放episode播放完成后自动播放下一个
- [ ] 队列持久化(重启应用后队列恢复)
- [ ] 队列UI流畅,拖拽无卡顿
- [ ] 右键菜单"添加到队列"正常工作
- [ ] 队列数量徽章正确显示

## 技术实现

### 关键技术点
- 使用 @dnd-kit 库实现拖拽排序
- Zustand persist 中间件持久化队列
- 事件监听器处理播放完成事件
- CSS transition 实现平滑动画

### 队列数据结构
```typescript
interface QueueItem {
  episodeId: number;
  position: number;
  addedAt: string;
}

interface PlayerStore {
  queue: QueueItem[];
  currentQueueIndex: number;

  addToQueueHead: (episodeId: number) => void;
  addToQueueTail: (episodeId: number) => void;
  removeFromQueue: (episodeId: number) => void;
  clearQueue: () => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  playNext: () => void;
}
```

### 快捷操作集成
- Episode列表右键菜单:
  - 添加到队列头部
  - 添加到队列尾部
  - 立即播放(清空队列并添加)
- Episode详情页操作按钮:
  - 添加到队列按钮

## 相关文件
- `src/renderer/store/playerStore.ts`
- `src/renderer/components/Queue/QueueDrawer.tsx`
- `src/renderer/components/Queue/QueueItem.tsx`
- `src/renderer/hooks/usePlaybackQueue.ts`
- `src/main/database/dao/queueDao.ts` (可选)
- `src/main/services/IPCHandlers.ts` (可选)

## 后续任务依赖
- task_podcast_stage5_media_keys_support