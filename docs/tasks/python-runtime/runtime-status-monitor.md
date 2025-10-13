# Python Runtime 状态监控与初始化功能

## 需求背景

在 FunASR 转写设置页面，用户需要直观了解 Python Runtime 的状态，并能在未初始化时手动触发初始化流程，同时查看详细的初始化日志。

## 功能需求

### 1. Runtime 状态指示器
- **🟢 绿点（Ready）**: Python Runtime 已初始化且可用
- **🟡 黄点（Uninitialized）**: 尚未初始化，需要手动或自动触发
- **🔴 红点（Error）**: 初始化失败或运行时异常

### 2. 初始化按钮
- 仅在 `uninitialized` 状态下显示
- 点击后触发 `PythonRuntimeManager.ensureReady()`
- 打开浮动日志框实时显示初始化进度

### 3. 浮动日志查看器
- 右上角固定定位的浮动框
- 实时显示 `PythonRuntimeManager` 的 EventEmitter 日志
- 自动滚动到最新日志
- 初始化成功后显示完成提示并延迟 2 秒自动关闭

## 技术实现

### 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer Process (React UI)                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ TranscriptSettings                                    │  │
│  │  ├─ FunASRSettingsPanel                              │  │
│  │  │   ├─ RuntimeStatusIndicator                       │  │
│  │  │   │   └─ 状态点 + 初始化按钮                       │  │
│  │  │   └─ (其他 FunASR 配置表单)                        │  │
│  │  └─ RuntimeLogViewer (Portal, fixed 右上角)          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕ IPC                              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Main Process                                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PythonRuntimeIPCHandlers                              │  │
│  │  ├─ pythonRuntime:getStatus                          │  │
│  │  ├─ pythonRuntime:initialize                         │  │
│  │  └─ pythonRuntime:log (event)                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PythonRuntimeManager                                  │  │
│  │  ├─ ensureReady() → 初始化逻辑                        │  │
│  │  ├─ getDetails() → 状态查询                          │  │
│  │  └─ EventEmitter.on('log', ...) → 日志流             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 实现步骤

#### Step 1: 添加 Python Runtime IPC Handlers

**文件**: `src/main/services/funasr/PythonRuntimeIPCHandlers.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { getPythonRuntimeManager } from './PythonRuntimeManager';

export class PythonRuntimeIPCHandlers {
  private runtimeManager = getPythonRuntimeManager();
  private logListener: ((log: string) => void) | null = null;

  constructor(private mainWindow: BrowserWindow | null = null) {
    this.registerHandlers();
    this.setupLogForwarding();
  }

  private registerHandlers(): void {
    ipcMain.handle('pythonRuntime:getStatus', this.handleGetStatus.bind(this));
    ipcMain.handle('pythonRuntime:initialize', this.handleInitialize.bind(this));
  }

  /**
   * 获取 Python Runtime 状态
   * - ready: details 不为 null
   * - uninitialized: details 为 null 且无错误
   * - error: 捕获到异常
   */
  private async handleGetStatus(
    event: IpcMainInvokeEvent
  ): Promise<{ status: 'ready' | 'uninitialized' | 'error'; error?: string }> {
    try {
      const details = this.runtimeManager.getDetails();

      if (details) {
        return { status: 'ready' };
      }

      return { status: 'uninitialized' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', error: message };
    }
  }

  /**
   * 触发 Python Runtime 初始化
   */
  private async handleInitialize(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.runtimeManager.ensureReady({ checkFunasr: false });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * 将 PythonRuntimeManager 的日志事件转发到 renderer
   */
  private setupLogForwarding(): void {
    this.logListener = (log: string) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pythonRuntime:log', log);
      }
    };

    this.runtimeManager.on('log', this.logListener);
  }

  destroy(): void {
    ipcMain.removeHandler('pythonRuntime:getStatus');
    ipcMain.removeHandler('pythonRuntime:initialize');

    if (this.logListener) {
      this.runtimeManager.off('log', this.logListener);
      this.logListener = null;
    }
  }
}
```

#### Step 2: 在 main.ts 注册 IPC Handlers

**文件**: `src/main/main.ts`

在现有的 IPC handlers 注册代码中添加:

```typescript
import { PythonRuntimeIPCHandlers } from './services/funasr/PythonRuntimeIPCHandlers';

// ... 在 createWindow() 后或现有 handlers 附近
let pythonRuntimeHandlers: PythonRuntimeIPCHandlers | null = null;

app.whenReady().then(() => {
  createWindow();
  // ... 其他初始化

  // 注册 Python Runtime handlers
  pythonRuntimeHandlers = new PythonRuntimeIPCHandlers(mainWindow);
});

// 在 app.on('quit') 或 cleanup 中
app.on('quit', () => {
  pythonRuntimeHandlers?.destroy();
});
```

#### Step 3: 更新 Preload API

**文件**: `src/main/preload.ts`

在 `contextBridge.exposeInMainWorld('electronAPI', {...})` 中添加:

```typescript
pythonRuntime: {
  getStatus: () => ipcRenderer.invoke('pythonRuntime:getStatus'),
  initialize: () => ipcRenderer.invoke('pythonRuntime:initialize'),
  onLog: (callback: (log: string) => void) => {
    ipcRenderer.on('pythonRuntime:log', (_, log) => callback(log));
    return () => ipcRenderer.removeListener('pythonRuntime:log', callback);
  },
},
```

在 `ElectronAPI` interface 中添加类型定义:

```typescript
pythonRuntime: {
  getStatus: () => Promise<{ status: 'ready' | 'uninitialized' | 'error'; error?: string }>;
  initialize: () => Promise<{ success: boolean; error?: string }>;
  onLog: (callback: (log: string) => void) => () => void;
};
```

#### Step 4: 创建 RuntimeStatusIndicator 组件

**文件**: `src/renderer/components/Settings/RuntimeStatusIndicator.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import Button from '../Button/Button';
import { getElectronAPI } from '../../utils/electron';

type RuntimeStatus = 'ready' | 'uninitialized' | 'error' | 'checking';

interface RuntimeStatusIndicatorProps {
  onInitialize: () => void;
}

export const RuntimeStatusIndicator: React.FC<RuntimeStatusIndicatorProps> = ({
  onInitialize,
}) => {
  const [status, setStatus] = useState<RuntimeStatus>('checking');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setStatus('checking');
    try {
      const result = await getElectronAPI().pythonRuntime.getStatus();
      setStatus(result.status);
      setError(result.error);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'ready':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          text: 'Python Runtime 已就绪',
          color: 'text-green-700 dark:text-green-400',
        };
      case 'uninitialized':
        return {
          icon: <Clock className="w-4 h-4 text-yellow-500" />,
          text: 'Python Runtime 未初始化',
          color: 'text-yellow-700 dark:text-yellow-400',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          text: 'Python Runtime 异常',
          color: 'text-red-700 dark:text-red-400',
        };
      case 'checking':
        return {
          icon: <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />,
          text: '检查中...',
          color: 'text-gray-600 dark:text-gray-400',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {config.icon}
          <div>
            <div className={`text-sm font-medium ${config.color}`}>
              {config.text}
            </div>
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {status === 'uninitialized' && (
            <Button onClick={onInitialize} size="sm">
              初始化 Runtime
            </Button>
          )}
          {status === 'error' && (
            <Button onClick={checkStatus} variant="secondary" size="sm">
              重新检查
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuntimeStatusIndicator;
```

#### Step 5: 创建 RuntimeLogViewer 组件

**文件**: `src/renderer/components/Settings/RuntimeLogViewer.tsx`

```typescript
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, XCircle } from 'lucide-react';
import Button from '../Button/Button';
import { getElectronAPI } from '../../utils/electron';

interface RuntimeLogViewerProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const RuntimeLogViewer: React.FC<RuntimeLogViewerProps> = ({
  onClose,
  onSuccess,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'initializing' | 'success' | 'error'>('initializing');
  const [error, setError] = useState<string | undefined>();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 监听日志事件
    const removeListener = getElectronAPI().pythonRuntime.onLog((log) => {
      setLogs((prev) => [...prev, log]);
    });

    // 开始初始化
    initializeRuntime();

    return () => {
      removeListener();
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // 自动滚动到底部
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const initializeRuntime = async () => {
    try {
      const result = await getElectronAPI().pythonRuntime.initialize();
      if (result.success) {
        setStatus('success');
        setLogs((prev) => [...prev, '✅ Python Runtime 初始化成功！']);
        onSuccess?.();

        // 2 秒后自动关闭
        autoCloseTimerRef.current = setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setStatus('error');
        setError(result.error);
        setLogs((prev) => [...prev, `❌ 初始化失败: ${result.error}`]);
      }
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLogs((prev) => [...prev, `❌ 初始化异常: ${message}`]);
    }
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[500px] max-h-[600px] flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {status === 'initializing' && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Python Runtime 初始化
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 font-mono text-xs">
          {logs.map((log, index) => (
            <div
              key={index}
              className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-1"
            >
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        {status !== 'initializing' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={onClose} variant="secondary" fullWidth>
              关闭
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default RuntimeLogViewer;
```

#### Step 6: 集成到 TranscriptSettings

**文件**: `src/renderer/components/Settings/TranscriptSettings.tsx`

在 `FunASRSettingsPanel` 组件中添加:

```typescript
// 在文件顶部添加 import
import RuntimeStatusIndicator from './RuntimeStatusIndicator';
import RuntimeLogViewer from './RuntimeLogViewer';

const FunASRSettingsPanel: React.FC = () => {
  // ... 现有 state
  const [showLogViewer, setShowLogViewer] = useState(false);

  // ... 现有代码

  const handleRuntimeInitialized = () => {
    // 初始化成功后刷新状态
    // RuntimeStatusIndicator 会自动重新检查状态
  };

  return (
    <div className="space-y-6">
      {/* Python Runtime 状态指示器 - 添加在最顶部 */}
      <RuntimeStatusIndicator
        onInitialize={() => setShowLogViewer(true)}
      />

      {/* 现有的 FunASR 配置表单 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="useDefaultModels"
          // ... 其他属性
        />
        {/* ... */}
      </div>

      {/* ... 其他配置项 */}

      {/* 浮动日志查看器 */}
      {showLogViewer && (
        <RuntimeLogViewer
          onClose={() => setShowLogViewer(false)}
          onSuccess={handleRuntimeInitialized}
        />
      )}
    </div>
  );
};
```

## 状态流转图

```
┌─────────────────┐
│   checking      │  组件加载时
└────────┬────────┘
         │
         ▼
    调用 getStatus()
         │
    ┌────┴──────────────────┬──────────────┐
    ▼                       ▼              ▼
┌─────────┐         ┌──────────────┐  ┌───────┐
│ ready   │         │uninitialized │  │ error │
└─────────┘         └──────┬───────┘  └───────┘
                           │
                    用户点击"初始化"
                           │
                           ▼
                    打开 LogViewer
                           │
                    调用 initialize()
                           │
                      ┌────┴────┐
                      ▼         ▼
                 ┌─────────┐ ┌───────┐
                 │ success │ │ error │
                 └─────────┘ └───────┘
                      │
                延迟 2s 自动关闭
                      │
                      ▼
                  刷新状态
```

## 日志格式说明

`PythonRuntimeManager` 的日志通过 EventEmitter 触发，格式为纯字符串:

```typescript
this.emit('log', '🔍 Checking for embedded Python runtime...');
this.emit('log', `✓ Runtime root: ${runtimeRoot}`);
this.emit('log', `❌ Runtime archive not found: ${archivePath}`);
```

在 `RuntimeLogViewer` 中直接显示这些日志，保留原有的 emoji 和格式。

## 测试检查清单

- [ ] 状态检查: 首次打开设置页，状态显示为 `uninitialized`（如果从未初始化）
- [ ] 初始化按钮: 未初始化状态下显示"初始化 Runtime"按钮
- [ ] 日志查看器: 点击初始化按钮后打开右上角浮动框
- [ ] 实时日志: 日志框实时显示 PythonRuntimeManager 的输出
- [ ] 自动滚动: 新日志追加时自动滚动到底部
- [ ] 成功提示: 初始化成功后显示绿色完成图标和成功消息
- [ ] 自动关闭: 成功后 2 秒自动关闭日志框
- [ ] 状态更新: 日志框关闭后，状态指示器变为绿点（ready）
- [ ] 错误处理: 初始化失败时显示红色错误图标和错误信息
- [ ] 重新检查: 错误状态下显示"重新检查"按钮

## 备注

1. **日志转发性能**: `PythonRuntimeManager` 初始化过程中会产生大量日志（20-50 条），需确保 IPC 通信不会阻塞
2. **多次初始化**: 如果用户多次点击初始化，`ensureReady()` 会复用已有的 Promise，不会重复初始化
3. **环境变量覆盖**: 如果设置了 `EASYPOD_FUNASR_PYTHON`，状态会直接显示为 `ready`，跳过解压流程
4. **权限问题**: macOS 用户数据目录 (`~/Library/Application Support/easypod/python/`) 需要有写权限
