# EasyPod

一款隐私优先的播客播放器，支持本地音频转写和 AI 智能分析。

> **🤖 本项目完全由 AI Coding 完成**
> 使用 Claude Code (claude.ai/code) 从零开始构建，展示了 AI 辅助编程的强大能力。

## ✨ 功能特性

### 核心功能

- **🎙️ 播客订阅与播放**
  - 支持 RSS 2.0、iTunes 和 Podcast 2.0 标准
  - 智能播放队列管理
  - 章节导航与进度记忆
  - 播放速度调节、跳转控制

- **📝 本地音频转写**
  - 基于 FunASR 的离线转写引擎
  - 支持中英文混合识别
  - 说话人分离（Diarization）
  - 时间戳精确对齐

- **🤖 AI 智能分析** ⚠️
  - 播客内容摘要生成
  - 章节智能总结
  - 关键信息提取
  - **需要第三方 AI API**（支持 OpenAI 兼容接口）

## 💾 系统要求

- **操作系统**：macOS 10.15+ (目前仅支持 macOS)
- **磁盘空间**：约 **3GB**
  - 应用本身：~200MB
  - Python 运行时：~600MB
  - FunASR 模型：~2GB
- **内存**：建议 8GB 及以上
- **AI 功能**：需要 OpenAI 兼容 API（如 OpenAI、DeepSeek、Aliyun 等）

## 🚀 快速开始

### 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（Electron + Vite 热重载）
npm run dev

# 3. 类型检查
npm run type-check

# 4. 运行测试
npm test
```

### 构建与打包

```bash
# 构建应用（编译 TypeScript + 打包前端）
npm run build

# 快速打包（不创建 DMG，用于测试）
npm run pack

# 完整打包 macOS 应用
npm run dist:mac

# 生成应用图标（如果修改了图标源文件）
npm run build:icon
```

### Python 运行时（转写功能必需）

```bash
# 首次构建或更新依赖后需要构建 Python 运行时
npm run build:python-runtime

# 验证运行时完整性
npm run verify:python-runtime

# 检查运行时状态
npm run check:python-runtime

# 完整构建（运行时 + 应用 + 打包）
npm run build:all
```

#### 开发模式快捷配置

如果你本地已有 Python 3.10+ 环境和 FunASR，可以跳过运行时构建：

```bash
# 使用系统 Python（仅开发模式）
export EASYPOD_FUNASR_PYTHON=/path/to/your/python3

# 跳过 FunASR 依赖安装（如果已全局安装）
export EASYPOD_FUNASR_SKIP_INSTALL=1

npm run dev
```

## 📖 使用说明

### 1. 订阅播客

- 点击 "+ 添加订阅" 输入 RSS 地址
- 支持自动刷新和手动更新

### 2. 转写音频

- 首次使用会自动下载 FunASR 模型（~2GB，需要几分钟）
- 在设置中配置转写服务（FunASR 或阿里云）
- 单集详情页点击 "转写" 按钮

### 3. AI 分析

- 在设置中配置 AI 服务提供商和 API Key
- 支持 OpenAI、DeepSeek、阿里云等兼容接口
- 转写完成后可使用 AI 生成摘要

### 4. 导出笔记

- 支持导出为 Markdown 格式
- 可选包含转写文本、AI 摘要、章节信息
- 兼容 Obsidian 双链语法

## 🏗️ 项目结构

```
easypod/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── config/        # 配置管理（端口、加密等）
│   │   ├── database/      # SQLite + Drizzle ORM
│   │   ├── services/      # 核心业务逻辑
│   │   │   ├── funasr/    # FunASR 服务管理
│   │   │   ├── transcript/# 转写配置和模型下载
│   │   │   └── ai/        # AI 服务集成
│   │   └── main.ts        # 主进程入口
│   ├── renderer/          # React 前端
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面视图
│   │   ├── store/         # Zustand 状态管理
│   │   └── hooks/         # 自定义 Hooks
│   └── __tests__/         # 单元测试
├── resources/
│   ├── python/            # FunASR 服务脚本
│   └── icon.icns          # 应用图标
├── scripts/               # 构建和工具脚本
└── docs/                  # 开发文档
```

## 🙏 致谢

本项目依赖以下优秀的开源项目：

- **[FunASR](https://github.com/alibaba-damo-academy/FunASR)** - 阿里达摩院开源的语音识别框架，提供高质量的本地转写能力
- **[Electron](https://www.electronjs.org/)** - 跨平台桌面应用框架
- **[React](https://react.dev/)** - 用户界面构建库
- **[Drizzle ORM](https://orm.drizzle.team/)** - 类型安全的 TypeScript ORM
- **[Zustand](https://github.com/pmndrs/zustand)** - 轻量级状态管理
- **[Tailwind CSS](https://tailwindcss.com/)** - 实用优先的 CSS 框架
- **[Lucide Icons](https://lucide.dev/)** - 精美的图标库

特别感谢 **FunASR** 团队提供的强大本地语音识别能力，让隐私保护和高质量转写得以兼得。

## 📝 开发文档

- [项目规划](docs/plan.md) - 开发路线图和功能规划
- [Python 运行时构建](docs/python-runtime-build.md) - 详细的运行时打包说明
- [任务文档](docs/tasks/) - 各功能模块的设计文档
- [CLAUDE.md](CLAUDE.md) - Claude Code 项目指引

## 📄 许可证

MIT License

---

**Made with ❤️ and 🤖 by Claude Code**
