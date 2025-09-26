# 任务：React UI框架搭建

## 任务信息
- **阶段**: 1 - 核心基础设施
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_stage1_electron_init

## 任务目标
建立完整的React UI框架，包括组件系统、状态管理和样式系统。

## 具体任务
1. **React + TypeScript集成**
   - 安装React 18和相关依赖
   - 配置TypeScript类型定义
   - 设置JSX编译和渲染进程集成
   - 配置React DevTools

2. **Tailwind CSS配置**
   - 安装和配置Tailwind CSS
   - 设置自定义主题和设计令牌
   - 配置暗色模式支持
   - 优化生产环境CSS体积

3. **Zustand状态管理**
   - 安装Zustand状态管理库
   - 设计全局状态结构
   - 创建状态管理模块(播放器、订阅、设置等)
   - 实现状态持久化机制

4. **基础组件库创建**
   - Button - 按钮组件(不同尺寸、状态、样式)
   - Input - 输入框组件(文本、搜索、密码等)
   - Layout - 布局组件(侧边栏、主内容区)
   - Modal - 模态框组件
   - Loading - 加载状态组件
   - Progress - 进度条组件

## 验收标准
- [ ] React应用在Electron中正常渲染
- [ ] Tailwind CSS样式生效
- [ ] 暗色/亮色主题可切换
- [ ] Zustand状态管理正常工作
- [ ] 所有基础组件功能完整且可复用
- [ ] TypeScript类型检查无错误

## 技术要点
- 使用React 18的concurrent features
- Tailwind配置响应式设计断点
- Zustand store设计为模块化结构
- 组件支持键盘导航和无障碍访问
- 实现组件的故事书(Storybook)文档

## 组件设计规范
```tsx
// 示例组件结构
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ ... }) => {
  // 组件实现
};
```

## 状态管理结构
```tsx
// 全局状态结构设计
interface AppState {
  player: PlayerState;
  library: LibraryState;
  settings: SettingsState;
  ui: UIState;
}

interface PlayerState {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  position: number;
  volume: number;
  playbackRate: number;
}
```

## 相关文件
- `src/renderer/App.tsx` - 根应用组件
- `src/renderer/components/` - 组件库目录
- `src/renderer/store/` - 状态管理目录
- `tailwind.config.js` - Tailwind配置
- `src/renderer/styles/globals.css` - 全局样式

## 后续任务依赖
- task_stage1_basic_audio_player
- task_stage2_subscription_ui