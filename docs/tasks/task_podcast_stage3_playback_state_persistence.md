# 任务:音频播放状态持久化

## 任务信息
- **阶段**: 3 - 核心播放功能增强
- **估时**: 10小时
- **优先级**: 高
- **依赖**: task_podcast_stage3_data_persistence, task_stage1_basic_audio_player

## 任务目标
实现播放进度和状态的自动保存机制,确保用户关闭应用或切换episode时能够保存播放位置,下次打开时自动恢复播放。

## 具体任务

### 1. 播放进度自动保存 (4小时)
   - 监听音频播放时间更新事件
   - 实现节流保存机制(每5秒保存一次)
   - 更新 episodes.lastPositionSec 字段
   - 更新 episodes.lastPlayedAt 时间戳
   - 避免频繁数据库写入
   - 在暂停、切换、关闭时立即保存

### 2. 播放状态标记 (3小时)
   - 根据播放进度自动更新状态:
     - < 5% → status: 'new'
     - 5%-95% → status: 'in_progress'
     - ≥ 95% → status: 'played'
   - 用户手动标记为已播放/未播放
   - 播放完成后弹窗询问:"标记为已完成?"
   - 状态变更后通知UI更新

### 3. 播放历史记录 (2小时)
   - 更新 episodes.lastPlayedAt 字段
   - 实现"最近播放"视图(按lastPlayedAt倒序)
   - 支持清除播放历史
   - 播放历史列表显示播放时间和进度

### 4. 恢复播放功能 (1小时)
   - 点击episode时检查lastPositionSec
   - 如果进度 > 5%,显示提示对话框:
     - "从 X 分 Y 秒处继续播放"
     - "从头开始"按钮
   - 自动跳转到保存的位置
   - 播放完成后询问是否标记为已完成

## 验收标准
- [ ] 播放5分钟后关闭应用,重新打开该episode从断点恢复
- [ ] 播放状态标记准确(new/in_progress/played)
- [ ] Recently Played列表按播放时间倒序显示
- [ ] 播放进度保存延迟 < 10秒
- [ ] 切换episode时当前进度立即保存
- [ ] 播放完成后弹窗询问是否标记为已完成
- [ ] 手动标记状态后UI立即更新

## 技术实现

### 关键技术点
- 使用节流(throttle)避免频繁数据库写入
- 在组件卸载时保存进度
- 使用Electron IPC更新数据库
- 状态变更后通过事件总线通知UI

### 进度保存策略
- 播放中:每5秒节流保存
- 暂停时:立即保存
- 切换episode:立即保存当前episode进度
- 应用关闭:useEffect cleanup保存
- 播放完成(≥95%):弹窗确认是否标记为已完成

## 相关文件
- `src/renderer/hooks/usePlaybackPersistence.ts`
- `src/renderer/components/ResumePlaybackDialog.tsx`
- `src/renderer/store/playerStore.ts`
- `src/main/database/dao/episodesDao.ts`
- `src/main/services/IPCHandlers.ts`

## 后续任务依赖
- task_podcast_stage3_global_settings_persistence
- task_podcast_stage4_episode_detail