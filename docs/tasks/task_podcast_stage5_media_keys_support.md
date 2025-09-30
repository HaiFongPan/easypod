# 任务:媒体键支持

## 任务信息
- **阶段**: 5 - 体验优化
- **估时**: 6小时
- **优先级**: 中
- **依赖**: task_podcast_stage3_playback_state_persistence

## 任务目标
实现系统媒体键集成,支持键盘媒体键、Touch Bar和Media Session API,提供无缝的播放控制体验。

## 具体任务

### 1. Media Session API 集成 (3小时)
   - 使用 navigator.mediaSession 设置元数据
   - 设置封面、标题、艺术家等信息
   - 监听 play/pause/seekbackward/seekforward 事件
   - 监听 previoustrack/nexttrack 事件(播放队列)
   - 更新播放位置(setPositionState)

### 2. macOS Touch Bar 集成 (2小时)
   - 使用 Electron TouchBar API
   - 显示播放/暂停按钮
   - 显示快进/快退按钮
   - 显示当前播放进度
   - 实时更新Touch Bar状态

### 3. 系统媒体键监听 (1小时)
   - macOS:通过 Media Session API 自动处理
   - 确保前后台均可响应
   - 测试蓝牙耳机控制
   - 测试外接键盘媒体键

## 验收标准
- [ ] 播放时系统通知中心显示播放控制
- [ ] 键盘媒体键(播放/暂停/下一曲/上一曲)正常工作
- [ ] Touch Bar显示播放控制和进度
- [ ] 应用在后台时媒体键依然有效
- [ ] 蓝牙耳机控制按钮正常工作
- [ ] 元数据(标题/封面)正确显示

## 技术实现

### 关键技术点
- navigator.mediaSession API
- Electron TouchBar API
- IPC通信同步播放状态到主进程
- mpris-service(Linux,可选)

### Media Session 示例
```typescript
// src/renderer/hooks/useMediaSession.ts
import { useEffect } from 'use';
import { usePlayerStore } from '../store/playerStore';

export function useMediaSession() {
  const { currentEpisode, isPlaying, currentTime, duration } = usePlayerStore();

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentEpisode) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentEpisode.title,
        artist: currentEpisode.feedName,
        album: 'EasyPod',
        artwork: [
          {
            src: currentEpisode.episodeImageUrl || currentEpisode.feedCoverUrl,
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      });

      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1.0,
        position: currentTime,
      });
    }
  }, [currentEpisode, currentTime, duration]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      playerStore.getState().play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      playerStore.getState().pause();
    });

    navigator.mediaSession.setActionHandler('seekbackward', () => {
      playerStore.getState().skipBackward();
    });

    navigator.mediaSession.setActionHandler('seekforward', () => {
      playerStore.getState().skipForward();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playerStore.getState().playPrevious();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playerStore.getState().playNext();
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      // ... clear other handlers
    };
  }, []);
}
```

## 相关文件
- `src/renderer/hooks/useMediaSession.ts`
- `src/main/services/TouchBarManager.ts`
- `src/main/main.ts`

## 后续任务依赖
- task_podcast_stage5_notification_center