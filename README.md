# EasyPod

一款隐私优先的播客播放器，支持本地音频转写和 AI 智能分析。

## 为什么 Vibe Coding 这个项目

目前接触过一些播客 AI 功能的平台，免费收费都有，也都非常好用。例如

- PodWise（收费），非常好用的平台，不过因为其实我需求不高，一般都用每个月 4 次的额度
- 阿里听悟（免费），虽然有发现模块，但是很多播客搜索不到，当然支持 RSS 很好，只是要找 RSS 链接也很麻烦
- NotebookLLM（部分免费），强大但是资源要自己上传，IP 不稳定还可能使用不了

没用过：

- 小宇宙（收费），价格还行，但是不想用中心化的播客客户端
- Pocketcast（收费），这是我一直使用的播客应用，虽然提供了 Plus 能力来转写字幕，但是价格还是贵（$10/月）

于是就产生了让 AI 来写一个应用来试试，顺便释放 macbook 自身的资源。当然 90% 代码都是 AI 写的，大部分代码我都没有看过，能跑就行。当然这个项目肯定没有办法跟专业的播客客户端的 AI 能力相比，毕竟这期只做了简单的 Summary 和章节划分，Prompt 也是自己整的，没有上任何工具、Agent，超简单 Prompt。当然未来也会计划自定义 Prompt、输出 mindmap、提供 chat 之类的功能。

在 docs 下保留了很多我写的、AI 写的计划，虽然很乱，但是觉得还是有必要保留一下现场。

![首页](https://images.bugnone.dev/homepage.png)
![字幕](https://images.bugnone.dev/transcript.png)

> **🤖 本项目完全由 AI Coding 完成**
> 使用 Claude Code (claude.ai/code) / Codex 从零开始构建，展示了 AI 辅助编程的强大能力（当然代码肯定是屎山级别的）。

## ✨ 功能特性

> 使用 FunASR 转录对于长音频来说是非常消耗时间的（还没有调整过配置）
> 例如老罗对谈 Tim 这集（171分钟），如果选择说话人分离大概需要消耗 25 分钟（4CPU），不选择说话人分离大约是 10 分钟（4CPU）
> 对比的，阿里云接口是大概 5 分钟左右。

### 核心功能

- **🎙️ 播客订阅与播放**
  - 支持 RSS 订阅与播客搜索(itunes 接口)
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

# 5. 启动调试
npm run dev
```

### 构建与打包

```bash
npm run build:all
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

## 📖 使用说明

### 1. 订阅播客

- 点击 "+ 添加订阅" 输入 RSS 地址
- 支持自动刷新和手动更新

### 2. 转写音频

- 首次使用会引导下载 FunASR 模型（~2GB，需要几分钟）
- 如果选择阿里云接口 FunASR 不需要配置
- 在设置中配置转写服务（FunASR 或阿里云）
- 单集详情页点击 "转写" 按钮

### 3. AI 分析

- 在设置中配置 AI 服务提供商和 API Key
- 支持 OpenAI、DeepSeek、阿里云、ollama 等兼容接口
- 转写完成后可使用 AI 生成摘要

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

## 📄 许可证

MIT License
