# 任务:通知中心集成

## 任务信息
- **阶段**: 5 - 体验优化
- **估时**: 4小时
- **优先级**: 低
- **依赖**: task_podcast_stage3_playback_state_persistence

## 任务目标
集成系统通知中心,在播放状态变化时显示通知,支持通知交互和点击跳转。

## 具体任务

### 1. 播放通知实现 (2小时)
   - 开始播放时显示通知
   - 显示episode标题和封面
   - macOS:使用 Notification Center
   - 可选:显示播放/暂停按钮

### 2. 通知交互 (1小时)
   - 点击通知 → 激活应用窗口
   - 点击通知 → 跳转到当前播放的episode详情页
   - 通知按钮控制播放/暂停(如支持)

### 3. 通知权限管理 (1小时)
   - 首次启动时请求通知权限
   - 设置中提供通知开关
   - 检查权限状态
   - 权限被拒绝时的友好提示

## 验收标准
- [ ] 开始播放时显示通知
- [ ] 通知显示正确的标题和封面
- [ ] 点击通知后应用窗口激活
- [ ] 通知权限请求友好
- [ ] 设置中可以关闭通知

## 技术实现

### 关键技术点
- Electron Notification API
- macOS User Notifications framework
- 通知权限检查和请求
- 应用激活和窗口聚焦

### 通知示例
```typescript
// src/main/services/NotificationManager.ts
import { Notification, app } from 'electron';

export class NotificationManager {
  private currentNotification: Notification | null = null;

  async showPlayingNotification(episode: Episode) {
    // 检查权限
    const hasPermission = await this.checkPermission();
    if (!hasPermission) return;

    // 关闭之前的通知
    if (this.currentNotification) {
      this.currentNotification.close();
    }

    // 创建新通知
    this.currentNotification = new Notification({
      title: '正在播放',
      body: episode.title,
      icon: episode.episodeImageUrl || episode.feedCoverUrl,
      silent: true,
    });

    this.currentNotification.on('click', () => {
      // 激活应用窗口
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });

    this.currentNotification.show();
  }

  async checkPermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }

    const status = await Notification.isSupported();
    return status;
  }

  async requestPermission(): Promise<boolean> {
    // macOS会自动请求权限
    return this.checkPermission();
  }
}
```

## 相关文件
- `src/main/services/NotificationManager.ts`
- `src/main/main.ts`
- `src/renderer/components/Settings/NotificationSettings.tsx`

## 后续任务依赖
- task_podcast_stage5_shortcuts_enhancement