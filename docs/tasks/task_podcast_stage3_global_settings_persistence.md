# 任务:全局播放设置持久化

## 任务信息
- **阶段**: 3 - 核心播放功能增强
- **估时**: 8小时
- **优先级**: 中
- **依赖**: task_stage1_sqlite_database

## 任务目标
实现全局播放设置的持久化存储,包括倍速、跳转秒数、音量等用户偏好,确保重启应用后设置得以恢复。

## 具体任务

### 1. Settings数据层实现 (3小时)
   - 创建 settings 表(如未创建)
   - 实现 settingsDao.ts 数据访问层
   - 支持键值对存储(key-value)
   - 支持类型标记(number/string/boolean/json)
   - 提供 get/set/getAll 方法
   - 初始化默认设置

### 2. 播放设置实现 (3小时)
   - 倍速设置(playback_rate: 0.5-2.0x,步进0.1)
   - 快进秒数设置(skip_forward_seconds: 5/10/15/30)
   - 快退秒数设置(skip_backward_seconds: 5/10/15/30)
   - 音量设置(volume: 0-100)
   - 自动播放下一集开关(auto_play_next: boolean)
   - 默认值初始化

### 3. 设置界面UI (2小时)
   - 创建SettingsDialog组件
   - 分类Tab:播放设置/快捷键/存储/关于
   - 倍速滑块(0.5-2.0x,显示当前值)
   - 跳转秒数选择器(下拉菜单)
   - 音量滑块
   - 自动播放下一集开关
   - 保存和重置按钮

## 验收标准
- [ ] 设置倍速为1.5x,重启应用后播放器默认1.5x
- [ ] 修改跳转秒数后,快进/快退按钮按新设置执行
- [ ] 音量设置在重启后恢复(静音状态除外)
- [ ] 自动播放下一集开关在重启后保持
- [ ] 设置界面UI清晰易用,分类合理
- [ ] 设置变更后立即生效,无需重启

## 技术实现

### 关键技术点
- 使用键值对存储灵活支持多种配置
- 类型标记确保数据正确解析
- Zustand persist中间件持久化状态
- IPC同步主进程和渲染进程设置

### 默认设置列表
```typescript
const defaults = [
  { key: 'playback_rate', value: 1.0, type: 'number' },
  { key: 'skip_forward_seconds', value: 10, type: 'number' },
  { key: 'skip_backward_seconds', value: 10, type: 'number' },
  { key: 'volume', value: 100, type: 'number' },
  { key: 'auto_play_next', value: false, type: 'boolean' },
];
```

## 相关文件
- `src/main/database/schema.ts`
- `src/main/database/dao/settingsDao.ts`
- `src/main/services/IPCHandlers.ts`
- `src/renderer/store/settingsStore.ts`
- `src/renderer/components/Settings/SettingsDialog.tsx`
- `src/renderer/hooks/usePlayer.ts`

## 后续任务依赖
- task_podcast_stage4_playback_queue