# FunASR 模型下载重构 - 实现总结

## 实现概述

成功完成了 FunASR 模型下载功能的重构，将模型下载从首次转写时的阻塞下载改为在设置页面的显式下载管理。

## 核心变更

### 1. Python 后端 (`resources/python/funasr_service.py`)

新增 4 个 FastAPI 端点：

- `POST /download-model` - 启动后台下载任务
- `GET /download-status/{model_id}` - 查询下载状态
- `DELETE /download-model/{model_id}` - 取消下载
- `GET /download-progress/{model_id}` - SSE 实时进度流

使用 `modelscope.snapshot_download` 的 `progress_callbacks` 参数实现实时进度跟踪。

### 2. 数据层

**新增文件：**
- `src/main/services/transcript/ModelDownloadManager.ts` - 封装模型下载逻辑，管理与 FastAPI 的 HTTP 通信

**修改文件：**
- `src/main/services/transcript/TranscriptConfigIPCHandlers.ts` - 新增 6 个 IPC 处理器
- `src/main/main.ts` - 传递 mainWindow 实例给 IPCHandlers
- `src/main/preload.ts` - 新增 `transcriptModel` API 命名空间

### 3. 前端层

**新增文件：**
- `src/renderer/components/Settings/ModelDownloadIndicator.tsx` - 模型下载管理 UI 组件
- `src/renderer/components/TranscriptGuard.tsx` - 转写前置检查守卫组件
- `src/renderer/utils/transcriptValidation.ts` - 转写环境验证逻辑

**修改文件：**
- `src/renderer/store/transcriptStore.ts` - 扩展状态管理，新增模型下载状态和操作
- `src/renderer/components/Settings/TranscriptSettings.tsx` - 集成 ModelDownloadIndicator，移除手动路径配置
- `src/renderer/utils/electron.ts` - 新增 transcriptModel mock 实现

## 功能特性

### 模型下载管理

- ✅ 显示 4 个 FunASR 模型（ASR、VAD、标点、说话人）的下载状态
- ✅ 实时进度条显示（百分比、已下载/总大小、速度、剩余时间）
- ✅ 支持下载、取消、重试、重新下载操作
- ✅ 状态持久化到数据库（`transcript_settings` 表）
- ✅ 自动检测 Python Runtime 依赖

### 转写前置检查

- ✅ TranscriptGuard 组件在转写前验证：
  - Python Runtime 是否就绪
  - 所有必需模型是否已下载
- ✅ 验证失败时显示友好错误提示和状态清单
- ✅ 提供一键跳转到设置页面
- ✅ 支持 FunASR 和 Aliyun 两种服务类型

## 架构流程

```
用户操作（点击下载按钮）
  ↓
React 组件 (ModelDownloadIndicator)
  ↓
Zustand Store (transcriptStore.downloadModel)
  ↓
IPC 调用 (window.electronAPI.transcriptModel.download)
  ↓
主进程 (TranscriptConfigIPCHandlers)
  ↓
服务层 (ModelDownloadManager)
  ↓
HTTP 请求 (FastAPI /download-model)
  ↓
Python 服务 (modelscope.snapshot_download)
  ↓
进度事件 (SSE → IPC → Store → UI)
```

## 数据模型

### ModelDownloadState

```typescript
interface ModelDownloadState {
  modelId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;              // 0-100
  downloadedSize: number;        // bytes
  totalSize: number;             // bytes
  speed?: number;                // MB/s
  estimatedTimeRemaining?: number; // seconds
  errorMessage?: string;
}
```

## API 清单

### IPC API (Renderer → Main)

```typescript
window.electronAPI.transcriptModel = {
  getStatus(modelId: string): Promise<APIResponse<ModelDownloadState>>
  getAllStatus(modelIds: string[]): Promise<APIResponse<Record<string, ModelDownloadState>>>
  download(modelId: string, cacheDir?: string): Promise<APIResponse>
  cancel(modelId: string): Promise<APIResponse>
  clearCache(modelId: string): Promise<APIResponse>
  onProgress(callback: (data: ModelDownloadState) => void): () => void
}
```

### FastAPI 端点

- `POST /download-model` - 启动下载
- `GET /download-status/{model_id}` - 查询状态
- `DELETE /download-model/{model_id}` - 取消下载
- `GET /download-progress/{model_id}` - SSE 进度流

## 使用场景

### 场景 1: 首次配置

1. 用户安装应用，进入设置页面
2. 初始化 Python Runtime（如果未就绪）
3. RuntimeStatusIndicator 显示就绪后，ModelDownloadIndicator 自动加载模型状态
4. 用户点击「下载」按钮，开始下载 4 个模型
5. 实时查看下载进度（进度条、速度、剩余时间）
6. 所有模型下载完成后显示绿色勾选标记

### 场景 2: 转写前验证

1. 用户在 Transcript 页面选择 FunASR 服务
2. TranscriptGuard 自动验证：
   - Python Runtime 状态 ✓/✗
   - FunASR 模型状态 ✓/✗
3. 如果验证失败：
   - 显示黄色警告面板
   - 列出缺失项
   - 提供「前往设置」按钮
4. 验证通过后，允许开始转写

### 场景 3: 重新下载

1. 用户在设置页面看到已下载的模型
2. 点击「重新下载」按钮
3. 系统清除旧文件缓存，重新下载
4. 实时显示下载进度

## 测试建议

### 手动测试清单

- [ ] Python Runtime 未就绪时，模型下载按钮应禁用
- [ ] 点击下载后，进度条实时更新
- [ ] 下载速度和剩余时间估算准确
- [ ] 取消下载后，状态变为 pending，可重新下载
- [ ] 下载失败后，显示错误信息，提供重试按钮
- [ ] 刷新页面后，下载状态正确恢复
- [ ] 所有模型下载完成后，显示「所有模型已下载完成」
- [ ] TranscriptGuard 正确阻止未就绪时的转写操作
- [ ] TranscriptGuard 验证失败时，显示准确的缺失项清单

### 集成测试

- [ ] 测试大文件下载（600MB+ 模型）
- [ ] 测试网络中断恢复
- [ ] 测试多个模型并发下载
- [ ] 测试应用重启后状态恢复

## 服务自动启动

为了确保模型下载功能随时可用，实现了**三层自动启动机制**：

### 1. 应用启动时自动启动

**修改文件**：`src/main/main.ts`

```typescript
// Auto-start FunASR service if Python Runtime is already provisioned
if (runtimeManager.isProvisioned()) {
  console.log('[App] Python Runtime is provisioned, starting FunASR service...');
  const { getFunASRManager } = await import('./services/funasr/FunASRManager');
  const funasrManager = getFunASRManager();

  // Start service in background, don't block app startup
  funasrManager.ensureReady()
    .then(() => {
      console.log('[App] FunASR service started successfully');
    })
    .catch((error) => {
      console.warn('[App] FunASR service failed to start:', error);
    });
}
```

### 2. Runtime 初始化后自动启动

**修改文件**：`src/main/services/funasr/PythonRuntimeIPCHandlers.ts`

```typescript
private async handleInitialize(event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> {
  try {
    await this.runtimeManager.ensureReady({ checkFunasr: false });

    // Start FunASR service after runtime is ready
    try {
      await this.funasrManager.ensureReady();
      console.log('[PythonRuntime] FunASR service started successfully');
    } catch (funasrError) {
      console.warn('[PythonRuntime] FunASR service failed to start:', funasrError);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
```

### 3. 模型下载前自动启动

**修改文件**：`src/main/services/transcript/ModelDownloadManager.ts`

```typescript
private async ensureServiceStarted(): Promise<void> {
  if (this.serviceStartAttempted) {
    return; // Already attempted
  }

  const isHealthy = await this.checkServiceHealth();
  if (isHealthy) {
    this.serviceStartAttempted = true;
    return; // Service is already running
  }

  // Try to start the service
  console.log('[ModelDownloadManager] FunASR service not running, attempting to start...');
  try {
    const funasrManager = getFunASRManager();
    await funasrManager.ensureReady();
    this.serviceStartAttempted = true;
    console.log('[ModelDownloadManager] FunASR service started successfully');
  } catch (error) {
    console.error('[ModelDownloadManager] Failed to start FunASR service:', error);
    this.serviceStartAttempted = true;
    throw error;
  }
}

async downloadModel(modelId: string, cacheDir?: string): Promise<{ success: boolean; error?: string }> {
  // Try to ensure service is started
  try {
    await this.ensureServiceStarted();
  } catch (error) {
    return {
      success: false,
      error: 'FunASR 服务无法启动，请确保 Python Runtime 已就绪',
    };
  }
  // ... rest of download logic
}
```

### 启动时机说明

| 场景 | 触发时机 | 说明 |
|------|---------|------|
| **应用启动** | 每次打开应用 | 如果 Runtime 已初始化，后台自动启动服务 |
| **Runtime 初始化** | 点击"初始化"按钮 | 初始化完成后立即启动服务 |
| **点击下载** | 下载模型前 | 检测服务状态，未运行则尝试启动 |

### 优势

✅ **无感启动**：用户无需手动启动服务
✅ **多重保障**：三层机制确保服务可用
✅ **容错处理**：启动失败不影响应用运行，提供友好错误提示
✅ **性能优化**：后台异步启动，不阻塞主流程

## 已知问题和限制

1. **网络依赖**：首次下载需要稳定的网络连接到 modelscope.cn
2. **磁盘空间**：4 个模型总计约 600MB，需确保足够磁盘空间
3. **Python Runtime**：必须先初始化 Runtime 才能下载模型
4. **并发下载**：当前实现支持多个模型并发下载，但进度事件是独立的
5. **服务依赖**：模型下载依赖 FunASR HTTP 服务运行，服务在 Runtime 初始化后自动启动

## 后续优化建议

1. **断点续传**：利用 HTTP Range 请求支持下载中断后继续
2. **并发控制**：限制同时下载的模型数量，避免带宽过载
3. **镜像源**：支持配置 modelscope 镜像源，提高国内下载速度
4. **磁盘空间检查**：下载前检查可用磁盘空间
5. **下载队列**：实现下载队列管理，支持暂停/恢复
6. **校验和验证**：下载完成后验证文件完整性

## 相关文档

- 需求文档：`docs/tasks/model_download.md`
- Python Runtime 构建：`docs/python-runtime-build.md`
- 技术设计：由 requirements-analyst agent 生成

## 完成状态

✅ 所有功能已实现
✅ TypeScript 类型检查通过
✅ 代码已集成到主分支

**实现日期**: 2025-01-14
**实现版本**: Stage 3 (FunASR Transcription Integration)
