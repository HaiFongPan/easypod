# FunASR 模型下载状态监控功能

## 需求概述

在 TranscriptSettings 页面中显示 FunASR 的 4 个模型的下载状态：
- **model** (ASR 模型)
- **vadModel** (VAD 模型)
- **puncModel** (标点模型)
- **spkModel** (说话人模型)

### 状态显示

- 🟢 **绿色**：模型已下载
- 🟡 **黄色**：模型缺失，可点击下载
- 🔴 **红色**：下载失败
- 🔵 **蓝色旋转**：下载中

### UI 参考

复用 `RuntimeStatusIndicator` 的设计风格。

---

## 技术架构

### 数据流

```
Renderer (ModelStatusIndicator)
    ↓ IPC
Main Process (TranscriptConfigIPCHandlers)
    ↓ HTTP
Python FastAPI Service (funasr_service.py)
    ↓
ModelScope Cache (~/.cache/modelscope/hub/)
```

---

## 实现计划

### 第一阶段：Python FastAPI 端点（`resources/python/funasr_service.py`）

#### 1.1 添加模型状态检查端点

**GET `/models/status`**

检查所有配置的模型状态。

**Request Query Parameters:**
```python
{
  "model": str,           # ASR 模型 ID
  "vad_model": str,       # VAD 模型 ID (可选)
  "punc_model": str,      # 标点模型 ID (可选)
  "spk_model": str        # 说话人模型 ID (可选)
}
```

**Response:**
```json
{
  "models": [
    {
      "type": "model",
      "id": "iic/speech_paraformer-large-...",
      "name": "ASR 模型",
      "status": "ready" | "missing",
      "path": "/path/to/model" | null
    },
    {
      "type": "vad_model",
      "id": "iic/speech_fsmn_vad_...",
      "name": "VAD 模型",
      "status": "ready" | "missing",
      "path": "/path/to/model" | null
    }
    // ... 其他模型
  ]
}
```

**实现逻辑:**
- 使用 `modelscope.hub.snapshot_download` 的 `cache_dir` 逻辑检查模型是否存在
- 或尝试加载 AutoModel 捕获异常判断

#### 1.2 添加模型下载端点

**POST `/models/download`**

下载指定模型。

**Request Body:**
```json
{
  "model_id": "iic/speech_paraformer-large-...",
  "model_type": "model" | "vad_model" | "punc_model" | "spk_model",
  "device": "cpu" | "cuda"
}
```

**Response (SSE - Server-Sent Events):**
```json
// 实时流式返回进度
{"status": "downloading", "progress": 0.1, "message": "Downloading model..."}
{"status": "downloading", "progress": 0.5, "message": "Downloading checkpoint-1.pth"}
{"status": "completed", "progress": 1.0, "path": "/path/to/model"}
// 或
{"status": "error", "error": "Network error"}
```

**实现逻辑:**
- 使用 FastAPI 的 `StreamingResponse` 返回 SSE
- 调用 AutoModel 触发下载（ModelScope 自动下载）
- 捕获 ModelScope 的日志输出解析进度
- 或使用 `tqdm` hook 获取下载进度

#### 1.3 辅助函数

```python
def _check_model_exists(model_id: str) -> tuple[bool, str | None]:
    """
    检查模型是否已下载
    Returns: (exists, path)
    """
    # 检查 ModelScope 缓存目录
    cache_dir = os.path.expanduser("~/.cache/modelscope/hub")
    # 模型路径格式: hub/iic/speech_paraformer-large-.../

def _get_model_display_name(model_type: str) -> str:
    """返回模型的中文名称"""
    names = {
        "model": "ASR 模型",
        "vad_model": "VAD 模型",
        "punc_model": "标点模型",
        "spk_model": "说话人模型"
    }
    return names.get(model_type, model_type)
```

---

### 第二阶段：后端 IPC Handlers

#### 2.1 更新 `TranscriptConfigIPCHandlers`

**新增 IPC handlers:**

```typescript
// src/main/services/transcript/TranscriptConfigIPCHandlers.ts

private async handleCheckModelsStatus(
  event: IpcMainInvokeEvent
): Promise<{ success: boolean; models?: ModelStatus[]; error?: string }> {
  // 1. 读取当前 FunASR 配置
  const config = await this.configManager.getFunASRConfig();

  // 2. 调用 FunASR HTTP 服务的 /models/status 端点
  const response = await axios.get('http://127.0.0.1:17953/models/status', {
    params: {
      model: config.model,
      vad_model: config.vadModel,
      punc_model: config.puncModel,
      spk_model: config.spkModel
    }
  });

  return { success: true, models: response.data.models };
}

private async handleDownloadModel(
  event: IpcMainInvokeEvent,
  params: { modelId: string; modelType: string }
): Promise<{ success: boolean; error?: string }> {
  const config = await this.configManager.getFunASRConfig();

  // 使用 SSE 监听下载进度
  const response = await axios.post('http://127.0.0.1:17953/models/download', {
    model_id: params.modelId,
    model_type: params.modelType,
    device: config.device || 'cpu'
  }, {
    responseType: 'stream'
  });

  // 解析 SSE 流，发送进度事件到 renderer
  response.data.on('data', (chunk: Buffer) => {
    const data = JSON.parse(chunk.toString());
    if (this.mainWindow) {
      this.mainWindow.webContents.send('funasr:model:downloadProgress', data);
    }
  });

  return { success: true };
}
```

**注册 handlers:**

```typescript
ipcMain.handle('transcript:config:checkModelsStatus', this.handleCheckModelsStatus.bind(this));
ipcMain.handle('transcript:config:downloadModel', this.handleDownloadModel.bind(this));
```

---

### 第三阶段：Preload 桥接

#### 3.1 更新 `src/main/preload.ts`

```typescript
transcriptConfig: {
  // ... 现有方法

  // 新增
  checkModelsStatus: () =>
    ipcRenderer.invoke('transcript:config:checkModelsStatus'),
  downloadModel: (modelId: string, modelType: string) =>
    ipcRenderer.invoke('transcript:config:downloadModel', { modelId, modelType }),
  onModelDownloadProgress: (callback: (data: ModelDownloadProgress) => void) => {
    const listener = (_: any, data: ModelDownloadProgress) => callback(data);
    ipcRenderer.on('funasr:model:downloadProgress', listener);
    return () => ipcRenderer.removeListener('funasr:model:downloadProgress', listener);
  },
},
```

#### 3.2 更新类型定义

```typescript
interface ModelStatus {
  type: 'model' | 'vad_model' | 'punc_model' | 'spk_model';
  id: string;
  name: string;
  status: 'ready' | 'missing';
  path: string | null;
}

interface ModelDownloadProgress {
  status: 'downloading' | 'completed' | 'error';
  progress: number;
  message?: string;
  error?: string;
  path?: string;
}

export interface ElectronAPI {
  // ...
  transcriptConfig: {
    // ... 现有方法
    checkModelsStatus: () => Promise<{
      success: boolean;
      models?: ModelStatus[];
      error?: string
    }>;
    downloadModel: (modelId: string, modelType: string) => Promise<{
      success: boolean;
      error?: string
    }>;
    onModelDownloadProgress: (callback: (data: ModelDownloadProgress) => void) => () => void;
  };
}
```

---

### 第四阶段：前端组件

#### 4.1 创建 `ModelStatusIndicator.tsx`

**位置:** `src/renderer/components/Settings/ModelStatusIndicator.tsx`

**组件结构:**

```tsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Download } from 'lucide-react';
import Button from '../Button/Button';
import { getElectronAPI } from '../../utils/electron';
import { useToast } from '../Toast/ToastProvider';

interface ModelInfo {
  type: string;
  id: string;
  name: string;
  status: 'ready' | 'missing' | 'downloading' | 'error';
  progress: number;
  error?: string;
  path?: string | null;
}

interface ModelStatusIndicatorProps {
  refreshTrigger?: number;
}

export const ModelStatusIndicator: React.FC<ModelStatusIndicatorProps> = ({
  refreshTrigger,
}) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    checkModelsStatus();
  }, [refreshTrigger]);

  useEffect(() => {
    // 监听下载进度
    const removeListener = getElectronAPI().transcriptConfig.onModelDownloadProgress(
      (data) => {
        updateModelProgress(data);
      }
    );
    return removeListener;
  }, []);

  const checkModelsStatus = async () => {
    setLoading(true);
    try {
      const result = await getElectronAPI().transcriptConfig.checkModelsStatus();
      if (result.success && result.models) {
        setModels(
          result.models.map(m => ({
            ...m,
            status: m.status as 'ready' | 'missing',
            progress: 0,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to check models status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (model: ModelInfo) => {
    setModels(prev =>
      prev.map(m =>
        m.type === model.type ? { ...m, status: 'downloading', progress: 0 } : m
      )
    );

    toast.info(`开始下载${model.name}...`);

    try {
      const result = await getElectronAPI().transcriptConfig.downloadModel(
        model.id,
        model.type
      );
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModels(prev =>
        prev.map(m =>
          m.type === model.type
            ? { ...m, status: 'error', error: message }
            : m
        )
      );
      toast.error(`下载失败: ${message}`);
    }
  };

  const updateModelProgress = (data: any) => {
    setModels(prev =>
      prev.map(m => {
        if (m.status === 'downloading') {
          if (data.status === 'completed') {
            toast.success(`✓ ${m.name}下载完成！`);
            return { ...m, status: 'ready', progress: 100, path: data.path };
          } else if (data.status === 'error') {
            return { ...m, status: 'error', error: data.error };
          } else {
            return { ...m, progress: data.progress * 100 };
          }
        }
        return m;
      })
    );
  };

  const getStatusIcon = (model: ModelInfo) => {
    switch (model.status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'missing':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'downloading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'missing':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'downloading':
        return 'bg-blue-50 dark:bg-blue-900/20';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20';
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">检查模型状态中...</div>;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        模型下载状态
      </h4>

      <div className="space-y-2">
        {models.map((model) => (
          <div
            key={model.type}
            className={`rounded-lg p-4 transition-colors ${getStatusColor(model.status)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(model)}
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {model.name}
                  </div>
                  {model.status === 'missing' && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      模型未下载
                    </div>
                  )}
                  {model.status === 'error' && model.error && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      {model.error}
                    </div>
                  )}
                </div>
              </div>

              {model.status === 'missing' && (
                <Button
                  onClick={() => handleDownload(model)}
                  size="sm"
                  variant="secondary"
                >
                  <Download className="w-3 h-3 mr-1" />
                  下载
                </Button>
              )}

              {model.status === 'error' && (
                <Button
                  onClick={() => handleDownload(model)}
                  size="sm"
                  variant="secondary"
                >
                  重试
                </Button>
              )}
            </div>

            {/* 下载进度条 */}
            {model.status === 'downloading' && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>下载中...</span>
                  <span>{Math.round(model.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${model.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelStatusIndicator;
```

#### 4.2 集成到 `TranscriptSettings.tsx`

在 `FunASRSettingsPanel` 中，在 `RuntimeStatusIndicator` 之后添加：

```tsx
return (
  <div className="space-y-6">
    {/* Python Runtime 状态指示器 */}
    <RuntimeStatusIndicator refreshTrigger={refreshTrigger} />

    {/* 模型下载状态指示器 - 新增 */}
    <ModelStatusIndicator refreshTrigger={refreshTrigger} />

    {/* 原有的配置表单 */}
    <div className="flex items-center">
      {/* ... */}
    </div>
  </div>
);
```

---

## 实现顺序

### 阶段 1: Python FastAPI 端点（2-3 小时）
1. 在 `funasr_service.py` 添加 `/models/status` 端点
2. 添加 `/models/download` 端点（SSE 流式响应）
3. 实现 `_check_model_exists()` 辅助函数
4. 本地测试端点功能

### 阶段 2: 后端 IPC（1-2 小时）
1. 更新 `TranscriptConfigIPCHandlers` 添加新的 handlers
2. 实现 HTTP 调用和 SSE 流式解析
3. 添加日志转发机制

### 阶段 3: Preload & 类型（30 分钟）
1. 更新 `preload.ts` 暴露新的 IPC 方法
2. 更新类型定义（ModelStatus, ModelDownloadProgress）

### 阶段 4: 前端组件（2-3 小时）
1. 创建 `ModelStatusIndicator.tsx` 组件
2. 实现状态查询和下载逻辑
3. 添加进度监听和 UI 更新
4. 集成到 `TranscriptSettings`

### 阶段 5: 测试（1-2 小时）
1. 测试模型状态检查
2. 测试模型下载流程
3. 测试错误处理和重试
4. 测试 UI 交互和 Toast 提示

**总计工作量：7-11 小时**

---

## 技术要点

### ModelScope 缓存机制

FunASR 使用 ModelScope 下载模型，默认缓存路径：
- Linux/macOS: `~/.cache/modelscope/hub/`
- Windows: `%USERPROFILE%\.cache\modelscope\hub\`

模型目录结构：
```
~/.cache/modelscope/hub/
├── iic/
│   ├── speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch/
│   ├── speech_fsmn_vad_zh-cn-16k-common-pytorch/
│   ├── punc_ct-transformer_zh-cn-common-vocab272727-pytorch/
│   └── speech_campplus_sv_zh-cn_16k-common/
```

### SSE (Server-Sent Events) 实现

Python FastAPI:
```python
from fastapi.responses import StreamingResponse

async def download_stream():
    for progress in range(0, 101, 10):
        yield f"data: {json.dumps({'progress': progress / 100})}\n\n"
        await asyncio.sleep(0.5)

@app.post("/models/download")
async def download_model(payload: DownloadRequest):
    return StreamingResponse(download_stream(), media_type="text/event-stream")
```

Node.js Axios:
```typescript
const response = await axios.post(url, data, { responseType: 'stream' });
response.data.on('data', (chunk: Buffer) => {
  const line = chunk.toString();
  if (line.startsWith('data: ')) {
    const data = JSON.parse(line.slice(6));
    // 处理进度数据
  }
});
```

### 错误处理

需要处理的场景：
1. **网络错误**：ModelScope 下载失败
2. **磁盘空间不足**：下载中断
3. **Python 环境问题**：funasr 未安装
4. **FunASR 服务未启动**：HTTP 调用失败
5. **并发下载**：防止同时下载多个模型导致冲突

---

## 未来优化

1. **批量下载**：支持一键下载所有缺失模型
2. **下载取消**：支持取消正在进行的下载
3. **离线包**：支持导入本地模型文件
4. **镜像源**：支持配置 ModelScope 镜像加速
5. **缓存清理**：支持清理旧版本模型节省空间
6. **模型验证**：下载完成后验证模型完整性

---

## 参考资料

- [FunASR 官方文档](https://github.com/alibaba-damo-academy/FunASR)
- [ModelScope Hub](https://modelscope.cn/models)
- [FastAPI SSE](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [Lucide Icons](https://lucide.dev/)
