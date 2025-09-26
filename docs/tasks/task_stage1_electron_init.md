# 任务：Electron项目初始化

## 任务信息
- **阶段**: 1 - 核心基础设施
- **估时**: 8小时
- **优先级**: 高
- **依赖**: 无

## 任务目标
搭建Electron应用的基础框架和开发环境，为后续功能开发奠定基础。

## 具体任务
1. **项目结构初始化**
   - 创建标准的Electron项目目录结构
   - 配置package.json和依赖管理
   - 设置主进程和渲染进程入口文件

2. **配置electron-builder**
   - 安装和配置electron-builder
   - 设置构建目标为macOS (dmg)
   - 配置应用图标和基础信息

3. **开发环境配置**
   - 设置开发模式热重载
   - 配置调试环境和开发者工具
   - 建立开发/生产环境切换机制

4. **TypeScript和ESLint配置**
   - 配置TypeScript编译选项
   - 设置ESLint代码规范
   - 配置Prettier代码格式化
   - 添加预提交钩子

## 验收标准
- [ ] Electron应用可正常启动
- [ ] 开发模式支持热重载
- [ ] TypeScript编译无错误
- [ ] ESLint检查通过
- [ ] 可生成基础的dmg安装包

## 技术要点
- 使用Electron最新稳定版本
- TypeScript strict模式开启
- 配置适当的安全策略(contextIsolation, nodeIntegration)
- 支持macOS原生特性(如Touch Bar, Notification)

## 相关文件
- `package.json` - 项目依赖和脚本
- `electron-builder.config.js` - 打包配置
- `tsconfig.json` - TypeScript配置
- `.eslintrc.js` - ESLint规则
- `src/main/main.ts` - 主进程入口
- `src/renderer/index.html` - 渲染进程入口

## 后续任务依赖
- task_stage1_react_ui_framework
- task_stage1_sqlite_database