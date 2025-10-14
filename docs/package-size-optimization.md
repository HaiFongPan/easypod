# 打包体积优化

## 问题分析

### 优化前 (891MB)
打包后的应用体积达到 891MB,远超预期。经过分析发现主要问题:

```
891M  EasyPod.app/
├── 681M  Contents/Resources/
│   ├── 351M  app.asar (包含重复的 python-runtime)
│   ├── 304M  python-runtime/ (extraResources 复制)
│   └── 24M   app.asar.unpacked/
└── 210M  Contents/Frameworks/ (Electron 框架)
```

**根本原因:**
1. **Python Runtime 重复打包**
   - `resources/python-runtime/` 通过 `files` 配置被打包进 app.asar (290MB)
   - 同时通过 `extraResources` 复制到 Resources/ (304MB)
   - 导致 290MB 的重复占用

2. **图标源文件被打包**
   - `resources/icon.iconset/` 包含 10 个 PNG 源文件 (~2MB)
   - 已生成 icon.icns 后,源文件不需要打包

### app.asar 内容分析 (优化前)
```
351MB app.asar
├── 290MB  resources/python-runtime/runtime-macos.tar.gz
├── 90MB   node_modules/ (所有运行时依赖)
│   ├── 33MB  lucide-react (图标库)
│   ├── 23MB  better-sqlite3 (原生模块)
│   └── 10MB  openai (AI SDK)
└── 其他应用代码和资源
```

## 优化方案

### 修改 package.json 打包配置

```json
{
  "build": {
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "resources/**/*",
      "!resources/python-runtime/**/*",  // 排除,避免重复
      "!resources/icon.iconset/**/*"     // 排除源文件
    ],
    "extraResources": [
      {
        "from": "resources/python-runtime",
        "to": "python-runtime"  // 单独复制到 Resources/
      }
    ]
  }
}
```

### 优化效果

#### 优化后 (600MB)
```
600M  EasyPod.app/
├── 390M  Contents/Resources/
│   ├── 60M   app.asar (不再包含 python-runtime)
│   ├── 304M  python-runtime/ (仅一份)
│   └── 24M   app.asar.unpacked/
└── 210M  Contents/Frameworks/ (Electron 框架)
```

**体积减少:**
- 从 891MB 降至 600MB
- 减少 291MB (32.6%)
- Python Runtime 不再重复打包

#### app.asar 优化后 (60MB)
```
60MB app.asar
├── 0MB    resources/python-runtime/ (已排除!)
├── 90MB   node_modules/ (压缩后约 60MB)
└── 其他应用代码和资源
```

## 进一步优化建议

### 1. 优化依赖 (可节省 ~30MB)

**lucide-react (33MB)** - 考虑使用按需加载
```typescript
// 当前: 导入整个库
import { Play, Pause } from 'lucide-react';

// 优化: 使用 tree-shaking 友好的导入
// 或考虑切换到 lucide-static (仅 SVG)
```

**openai (10MB)** - 仅客户端需要,考虑延迟加载
```typescript
// 仅在 AI 功能初始化时动态加载
const { OpenAI } = await import('openai');
```

### 2. 压缩资源文件 (可节省 ~5MB)

**说话人头像** (dist/renderer/assets/spk_*.png, 共 8MB)
- 当前: 未压缩的 PNG
- 建议: 使用 WebP 格式,质量 80% 可减少 60% 体积

### 3. 代码分割 (改善加载速度)

```typescript
// 大型组件延迟加载
const TranscriptViewer = lazy(() => import('./components/TranscriptViewer'));
const AIAnalyzer = lazy(() => import('./components/AIAnalyzer'));
```

### 4. 移除未使用的依赖

检查是否有未使用的包:
```bash
npx depcheck
```

## 最终体积构成

### 优化后分布
```
600MB 总计
├── 304MB (51%) Python Runtime (必需,FunASR 转写引擎)
├── 210MB (35%) Electron Frameworks (必需)
├── 60MB  (10%) app.asar (应用代码 + 依赖)
└── 26MB  (4%)  其他资源
```

### Python Runtime 详情
```
304MB python-runtime/
├── 280MB  runtime-macos.tar.gz (Python 3.10 + FunASR + 依赖)
├── 18MB   logs/ (运行时日志)
└── 6MB    其他配置文件
```

**注意:** Python Runtime 是 FunASR 本地转写的核心,无法进一步优化。用户首次使用时还需下载 ~2GB 的模型文件。

## 总结

通过排除重复打包的 Python Runtime,成功将应用体积从 891MB 优化至 600MB。当前体积主要由三部分构成:
1. Python Runtime (304MB) - 本地转写必需
2. Electron 框架 (210MB) - 跨平台桌面应用必需
3. 应用代码和依赖 (86MB) - 可进一步优化

对于一个包含完整 Python 运行时和本地 AI 转写能力的桌面应用,600MB 的体积是合理的。
