# 任务：基础音频播放器

## 任务信息
- **阶段**: 1 - 核心基础设施
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_stage1_react_ui_framework

## 任务目标
实现核心的音频播放功能，包括播放控制、进度管理和用户交互界面。

## 具体任务
1. **HTMLAudioElement封装**
   - 创建Audio播放器类封装
   - 实现播放状态管理和事件监听
   - 处理音频加载、错误和元数据
   - 实现播放队列和切换逻辑

2. **播放控制功能**
   - 播放/暂停切换
   - 快进/后退(可配置10s/30s)
   - 跳转到指定时间位置
   - 循环播放和随机播放模式

3. **音量和倍速控制**
   - 音量调节(0-100%)
   - 静音/取消静音
   - 播放倍速控制(0.5x-3.0x)
   - 音量和倍速状态持久化

4. **进度条和时间显示**
   - 实时进度条更新
   - 拖拽进度条跳转
   - 当前时间/总时长显示
   - 剩余时间显示选项

## 验收标准
- [ ] 音频文件加载和播放正常
- [ ] 所有播放控制功能响应及时
- [ ] 进度条拖拽跳转准确(误差≤1秒)
- [ ] 音量和倍速调节平滑
- [ ] 播放状态持久化正常
- [ ] 支持常见音频格式(MP3, AAC, OGG等)

## 播放器组件设计

### AudioPlayer类接口
```tsx
interface AudioPlayerConfig {
  volume: number;
  playbackRate: number;
  skipForwardSeconds: number;
  skipBackwardSeconds: number;
}

class AudioPlayer {
  // 播放控制
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(timeInSeconds: number): void;
  skipForward(): void;
  skipBackward(): void;

  // 音量和倍速
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  toggleMute(): void;

  // 状态获取
  get isPlaying(): boolean;
  get currentTime(): number;
  get duration(): number;
  get buffered(): TimeRanges;

  // 事件监听
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}
```

### 播放器UI组件
```tsx
interface AudioPlayerUIProps {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onRateChange: (rate: number) => void;
}

const AudioPlayerUI: React.FC<AudioPlayerUIProps> = ({ ... }) => {
  return (
    <div className="audio-player">
      {/* 播放控制按钮 */}
      {/* 进度条 */}
      {/* 音量控制 */}
      {/* 倍速选择 */}
    </div>
  );
};
```

## 技术要点
- 使用Web Audio API处理音频流
- 实现播放器状态的Zustand store
- 支持键盘快捷键控制
- 处理网络音频流的缓冲状态
- 实现音频焦点管理(多窗口场景)

## 播放器状态管理
```tsx
interface PlayerState {
  // 当前播放内容
  currentEpisode: Episode | null;
  currentTime: number;
  duration: number;

  // 播放状态
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;

  // 用户设置
  volume: number;
  playbackRate: number;
  isMuted: boolean;

  // 播放模式
  repeatMode: 'none' | 'one' | 'all';
  shuffleMode: boolean;
}
```

## 用户交互设计
- 空格键播放/暂停
- 左右箭头键快进/后退
- 上下箭头键音量调节
- 数字键倍速快捷切换
- 进度条点击和拖拽支持

## 相关文件
- `src/renderer/components/AudioPlayer/` - 播放器组件目录
- `src/renderer/store/playerStore.ts` - 播放器状态管理
- `src/renderer/utils/audioPlayer.ts` - 音频播放器核心逻辑
- `src/renderer/hooks/useAudioPlayer.ts` - 播放器React Hook

## 后续任务依赖
- task_stage2_media_control_enhancement
- task_stage2_playback_history