# Task Stage 1.7: UI 集成和展示

## 任务概述

实现转写功能的用户界面，包括转写任务管理、字幕查看、导出功能、配置设置等。

## 技术设计

### UI 组件架构

```
TranscriptPage (页面)
├── TranscriptSettings (配置设置)
│   ├── FunasrConfigForm
│   └── AliyunConfigForm
├── TranscriptTaskPanel (任务面板)
│   ├── TaskSubmitForm
│   ├── TaskList
│   └── TaskItem
└── TranscriptViewer (字幕查看器)
    ├── SubtitleList
    ├── SubtitleItem
    ├── SpeakerFilter
    └── ExportDialog
```

### 状态管理

使用 Zustand 创建 `transcriptStore`:

```typescript
interface TranscriptStore {
  // 任务状态
  tasks: Map<string, VoiceTextTask>;
  activeTasks: Set<string>; // 正在处理的任务

  // 字幕数据
  transcripts: Map<number, EpisodeTranscript>; // episodeId -> transcript
  currentPreview: SubtitlePreview[] | null;

  // UI 状态
  selectedEpisodeId: number | null;
  selectedService: TranscriptService;
  isSubmitting: boolean;
  isExporting: boolean;

  // Actions
  submitTask(episodeId: number, service: TranscriptService, options?: SubmitOptions): Promise<void>;
  pollTask(taskId: string): Promise<void>;
  cancelTask(taskId: string): Promise<void>;
  loadTranscript(episodeId: number): Promise<void>;
  loadPreview(episodeId: number, options?: PreviewOptions): Promise<void>;
  exportTranscript(episodeId: number, format: ExportFormat): Promise<void>;
}
```

## 实现细节

### 1. Zustand Store

在 `src/renderer/store/transcriptStore.ts`:

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface TranscriptStore {
  tasks: Map<string, VoiceTextTask>;
  activeTasks: Set<string>;
  transcripts: Map<number, EpisodeTranscript>;
  currentPreview: SubtitlePreview[] | null;

  selectedEpisodeId: number | null;
  selectedService: TranscriptService;
  isSubmitting: boolean;
  isExporting: boolean;

  // Actions
  submitTask: (
    episodeId: number,
    service: TranscriptService,
    options?: SubmitOptions
  ) => Promise<void>;
  pollTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  loadTranscript: (episodeId: number) => Promise<void>;
  loadPreview: (episodeId: number, options?: PreviewOptions) => Promise<void>;
  exportTranscript: (episodeId: number, format: ExportFormat) => Promise<void>;
  setSelectedEpisode: (episodeId: number | null) => void;
  setSelectedService: (service: TranscriptService) => void;
}

export const useTranscriptStore = create<TranscriptStore>()(
  devtools(
    (set, get) => ({
      tasks: new Map(),
      activeTasks: new Set(),
      transcripts: new Map(),
      currentPreview: null,

      selectedEpisodeId: null,
      selectedService: 'funasr',
      isSubmitting: false,
      isExporting: false,

      submitTask: async (episodeId, service, options) => {
        set({ isSubmitting: true });

        try {
          const result = await window.electronAPI.transcript.submitTask(
            episodeId,
            service,
            options
          );

          if (result.success && result.taskId) {
            // 添加到活动任务
            const activeTasks = new Set(get().activeTasks);
            activeTasks.add(result.taskId);
            set({ activeTasks });

            // 开始轮询任务状态
            get().pollTask(result.taskId);
          } else {
            throw new Error(result.error || 'Submit task failed');
          }
        } catch (error) {
          console.error('Submit task error:', error);
          throw error;
        } finally {
          set({ isSubmitting: false });
        }
      },

      pollTask: async (taskId) => {
        const pollInterval = 3000; // 3秒轮询一次
        const maxAttempts = 600; // 最多30分钟

        let attempts = 0;

        const poll = async () => {
          if (attempts >= maxAttempts) {
            const activeTasks = new Set(get().activeTasks);
            activeTasks.delete(taskId);
            set({ activeTasks });
            return;
          }

          attempts++;

          try {
            const result = await window.electronAPI.transcript.queryTask(taskId);

            if (result.status === 'succeeded') {
              // 任务成功，更新字幕数据
              const activeTasks = new Set(get().activeTasks);
              activeTasks.delete(taskId);
              set({ activeTasks });

              // 重新加载字幕
              const tasks = await window.electronAPI.transcript.getTasksByEpisode(
                get().selectedEpisodeId!
              );
              if (tasks.success && tasks.tasks) {
                const task = tasks.tasks.find(t => t.taskId === taskId);
                if (task) {
                  await get().loadTranscript(task.episodeId);
                }
              }
            } else if (result.status === 'failed') {
              // 任务失败
              const activeTasks = new Set(get().activeTasks);
              activeTasks.delete(taskId);
              set({ activeTasks });
            } else {
              // 继续轮询
              setTimeout(poll, pollInterval);
            }
          } catch (error) {
            console.error('Poll task error:', error);
            setTimeout(poll, pollInterval);
          }
        };

        poll();
      },

      cancelTask: async (taskId) => {
        try {
          const result = await window.electronAPI.transcript.cancelTask(taskId);

          if (result.success) {
            const activeTasks = new Set(get().activeTasks);
            activeTasks.delete(taskId);
            set({ activeTasks });
          }
        } catch (error) {
          console.error('Cancel task error:', error);
          throw error;
        }
      },

      loadTranscript: async (episodeId) => {
        try {
          const result = await window.electronAPI.transcript.getTranscript(episodeId);

          if (result.success && result.transcript) {
            const transcripts = new Map(get().transcripts);
            transcripts.set(episodeId, result.transcript);
            set({ transcripts });
          }
        } catch (error) {
          console.error('Load transcript error:', error);
        }
      },

      loadPreview: async (episodeId, options) => {
        try {
          const result = await window.electronAPI.transcript.getPreview(episodeId, options);

          if (result.success && result.preview) {
            set({ currentPreview: result.preview });
          }
        } catch (error) {
          console.error('Load preview error:', error);
        }
      },

      exportTranscript: async (episodeId, format) => {
        set({ isExporting: true });

        try {
          const result = await window.electronAPI.transcript.exportTranscript(episodeId, format);

          if (result.success && result.content) {
            // 触发下载
            const blob = new Blob([result.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transcript-${episodeId}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
          }
        } catch (error) {
          console.error('Export transcript error:', error);
          throw error;
        } finally {
          set({ isExporting: false });
        }
      },

      setSelectedEpisode: (episodeId) => {
        set({ selectedEpisodeId: episodeId });

        if (episodeId !== null) {
          get().loadTranscript(episodeId);
          get().loadPreview(episodeId);
        }
      },

      setSelectedService: (service) => {
        set({ selectedService: service });
      },
    }),
    { name: 'Transcript Store' }
  )
);
```

### 2. 转写任务面板组件

在 `src/renderer/components/transcript/TranscriptTaskPanel.tsx`:

```typescript
import React, { useEffect } from 'react';
import { useTranscriptStore } from '@/renderer/store/transcriptStore';
import { Button } from '@/renderer/components/ui/Button';
import { Select } from '@/renderer/components/ui/Select';

export const TranscriptTaskPanel: React.FC<{ episodeId: number }> = ({ episodeId }) => {
  const {
    selectedService,
    setSelectedService,
    isSubmitting,
    activeTasks,
    submitTask,
  } = useTranscriptStore();

  const [tasks, setTasks] = React.useState<VoiceTextTask[]>([]);

  useEffect(() => {
    loadTasks();
  }, [episodeId]);

  const loadTasks = async () => {
    const result = await window.electronAPI.transcript.getTasksByEpisode(episodeId);
    if (result.success && result.tasks) {
      setTasks(result.tasks);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitTask(episodeId, selectedService);
      await loadTasks();
    } catch (error) {
      console.error('Submit failed:', error);
    }
  };

  return (
    <div className="transcript-task-panel">
      <div className="task-submit-form">
        <h3>提交转写任务</h3>

        <div className="form-row">
          <label>转写服务:</label>
          <Select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value as TranscriptService)}
          >
            <option value="funasr">FunASR (本地)</option>
            <option value="aliyun">阿里云 API</option>
          </Select>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || activeTasks.size > 0}
        >
          {isSubmitting ? '提交中...' : '开始转写'}
        </Button>
      </div>

      <div className="task-list">
        <h3>任务列表</h3>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};

const TaskItem: React.FC<{ task: VoiceTextTask }> = ({ task }) => {
  const { cancelTask, activeTasks } = useTranscriptStore();
  const isActive = activeTasks.has(task.taskId);

  const statusText = {
    processing: '处理中',
    success: '成功',
    failed: '失败',
  }[task.status];

  return (
    <div className={`task-item task-${task.status}`}>
      <div className="task-info">
        <span className="task-service">{task.service}</span>
        <span className="task-status">{statusText}</span>
        <span className="task-time">{new Date(task.createdAt).toLocaleString()}</span>
      </div>

      {task.status === 'processing' && (
        <Button size="sm" onClick={() => cancelTask(task.taskId)}>
          取消
        </Button>
      )}
    </div>
  );
};
```

### 3. 字幕查看器组件

在 `src/renderer/components/transcript/TranscriptViewer.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { useTranscriptStore } from '@/renderer/store/transcriptStore';
import { usePlayerStore } from '@/renderer/store/playerStore';
import { Button } from '@/renderer/components/ui/Button';

export const TranscriptViewer: React.FC<{ episodeId: number }> = ({ episodeId }) => {
  const { currentPreview, loadPreview, exportTranscript } = useTranscriptStore();
  const { currentTime } = usePlayerStore();

  const [selectedSpeaker, setSelectedSpeaker] = React.useState<number | null>(null);
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>('srt');
  const [showExportDialog, setShowExportDialog] = React.useState(false);

  const activeItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPreview(episodeId, { highlightSpeaker: selectedSpeaker ?? undefined });
  }, [episodeId, selectedSpeaker]);

  // 滚动到当前播放位置
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime]);

  const handleExport = async () => {
    try {
      await exportTranscript(episodeId, exportFormat);
      setShowExportDialog(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getCurrentItem = () => {
    if (!currentPreview) return null;
    return currentPreview.find(
      (item) => currentTime >= item.startMs && currentTime <= item.endMs
    );
  };

  const currentItem = getCurrentItem();

  return (
    <div className="transcript-viewer">
      <div className="viewer-header">
        <h3>字幕</h3>

        <div className="viewer-actions">
          <Button size="sm" onClick={() => setShowExportDialog(true)}>
            导出
          </Button>
        </div>
      </div>

      {currentPreview && currentPreview.length > 0 ? (
        <div className="subtitle-list">
          {currentPreview.map((item) => {
            const isActive = currentItem?.id === item.id;

            return (
              <div
                key={item.id}
                ref={isActive ? activeItemRef : null}
                className={`subtitle-item ${isActive ? 'active' : ''} ${
                  item.isHighlighted ? 'highlighted' : ''
                }`}
                onClick={() => {
                  // 点击跳转到对应时间
                  const player = usePlayerStore.getState();
                  player.seekTo(item.startMs / 1000);
                }}
              >
                <div className="subtitle-time">
                  {item.startTime} → {item.endTime}
                </div>
                <div className="subtitle-speaker">发言人 {item.speakerId}</div>
                <div className="subtitle-text">{item.text}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <p>暂无字幕数据</p>
          <p>请先提交转写任务</p>
        </div>
      )}

      {showExportDialog && (
        <ExportDialog
          format={exportFormat}
          onFormatChange={setExportFormat}
          onExport={handleExport}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
};

const ExportDialog: React.FC<{
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  onExport: () => void;
  onClose: () => void;
}> = ({ format, onFormatChange, onExport, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>导出字幕</h3>

        <div className="form-row">
          <label>格式:</label>
          <Select value={format} onChange={(e) => onFormatChange(e.target.value as ExportFormat)}>
            <option value="srt">SRT (SubRip)</option>
            <option value="vtt">VTT (WebVTT)</option>
            <option value="lrc">LRC (歌词)</option>
            <option value="txt">TXT (纯文本)</option>
            <option value="json">JSON</option>
          </Select>
        </div>

        <div className="modal-actions">
          <Button onClick={onExport}>导出</Button>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### 4. 配置设置组件

在 `src/renderer/components/transcript/TranscriptSettings.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Button } from '@/renderer/components/ui/Button';
import { Input } from '@/renderer/components/ui/Input';

export const TranscriptSettings: React.FC = () => {
  const [aliyunApiKey, setAliyunApiKey] = useState('');
  const [funasrPythonPath, setFunasrPythonPath] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const aliyunConfig = await window.electronAPI.transcript.getConfig('aliyun');
    const funasrConfig = await window.electronAPI.transcript.getConfig('funasr');

    if (aliyunConfig.success && aliyunConfig.config) {
      setAliyunApiKey(aliyunConfig.config.apiKey || '');
    }

    if (funasrConfig.success && funasrConfig.config) {
      setFunasrPythonPath(funasrConfig.config.pythonPath || '');
    }
  };

  const handleSaveAliyun = async () => {
    const result = await window.electronAPI.transcript.setConfig('aliyun', {
      apiKey: aliyunApiKey,
    });

    if (result.success) {
      alert('阿里云配置保存成功');
    }
  };

  const handleSaveFunasr = async () => {
    const result = await window.electronAPI.transcript.setConfig('funasr', {
      pythonPath: funasrPythonPath,
    });

    if (result.success) {
      alert('FunASR 配置保存成功');
    }
  };

  const handleTest = async (service: TranscriptService) => {
    const result = await window.electronAPI.transcript.testConfig(service);

    if (result.success) {
      setTestResult(`✓ ${result.message}`);
    } else {
      setTestResult(`✗ ${result.error}`);
    }
  };

  return (
    <div className="transcript-settings">
      <h2>转写服务配置</h2>

      <section className="config-section">
        <h3>阿里云 API</h3>

        <div className="form-row">
          <label>API Key:</label>
          <Input
            type="password"
            value={aliyunApiKey}
            onChange={(e) => setAliyunApiKey(e.target.value)}
            placeholder="请输入阿里云 API Key"
          />
        </div>

        <div className="form-actions">
          <Button onClick={handleSaveAliyun}>保存</Button>
          <Button variant="secondary" onClick={() => handleTest('aliyun')}>
            测试连接
          </Button>
        </div>
      </section>

      <section className="config-section">
        <h3>FunASR 本地服务</h3>

        <div className="form-row">
          <label>Python 路径 (可选):</label>
          <Input
            value={funasrPythonPath}
            onChange={(e) => setFunasrPythonPath(e.target.value)}
            placeholder="/path/to/python3"
          />
        </div>

        <div className="form-actions">
          <Button onClick={handleSaveFunasr}>保存</Button>
          <Button variant="secondary" onClick={() => handleTest('funasr')}>
            测试环境
          </Button>
        </div>
      </section>

      {testResult && (
        <div className="test-result">
          <p>{testResult}</p>
        </div>
      )}
    </div>
  );
};
```

### 5. 样式

在 `src/renderer/styles/transcript.css`:

```css
.transcript-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.subtitle-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.subtitle-item {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.subtitle-item:hover {
  background-color: var(--hover-bg);
}

.subtitle-item.active {
  background-color: var(--primary-light);
  border-color: var(--primary);
}

.subtitle-item.highlighted {
  border-left: 3px solid var(--accent);
}

.subtitle-time {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.subtitle-speaker {
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.subtitle-text {
  line-height: 1.6;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.task-list {
  margin-top: 1rem;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.task-item.task-success {
  background-color: var(--success-light);
}

.task-item.task-failed {
  background-color: var(--error-light);
}

.task-item.task-processing {
  background-color: var(--warning-light);
}
```

## 依赖关系

- **前置依赖**:
  - Task 1.1-1.6: 所有后端功能实现完成
  - UI 组件库（Button、Input、Select 等）

- **后置依赖**:
  - Stage 2: AI 功能集成

## 验收标准

- [ ] TranscriptStore 实现完整
- [ ] TranscriptTaskPanel 组件功能正常
- [ ] TranscriptViewer 组件展示正确
- [ ] TranscriptSettings 配置保存和测试功能正常
- [ ] 字幕与播放器时间轴同步
- [ ] 导出功能正确
- [ ] 响应式设计适配不同屏幕
- [ ] 错误处理和用户反馈友好

## 风险和注意事项

### 风险

1. **性能问题**: 大量字幕数据的渲染性能
2. **同步问题**: 字幕与播放器的时间同步
3. **用户体验**: 任务轮询的反馈

### 注意事项

1. **虚拟滚动**: 大量字幕使用虚拟滚动优化性能
2. **自动滚动**: 播放时字幕自动滚动到当前位置
3. **状态同步**: Store 状态与后端数据的一致性
4. **错误提示**: 友好的错误提示和重试机制

## 实施步骤

1. 实现 TranscriptStore
2. 实现 TranscriptTaskPanel 组件
3. 实现 TranscriptViewer 组件
4. 实现 TranscriptSettings 组件
5. 添加样式
6. 集成到 Episode 详情页
7. 测试和优化

## 估时

- 设计: 1 天
- Store 实现: 1 天
- 组件实现: 3 天
- 样式和优化: 2 天
- 测试: 2 天
- **总计**: 9 天
