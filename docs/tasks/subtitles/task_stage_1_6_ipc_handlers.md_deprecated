# Task Stage 1.6: IPC 通信接口实现

## 任务概述

实现主进程与渲染进程之间的 IPC 通信接口，提供转写任务的提交、查询、取消、结果获取等功能。

## 技术设计

### IPC 接口设计

```typescript
interface TranscriptAPI {
  // 任务管理
  submitTask(episodeId: number, service: 'funasr' | 'aliyun', options?: SubmitOptions): Promise<SubmitResult>;
  queryTask(taskId: string): Promise<TaskResult>;
  cancelTask(taskId: string): Promise<boolean>;
  getTasksByEpisode(episodeId: number): Promise<VoiceTextTask[]>;

  // 字幕数据
  getTranscript(episodeId: number): Promise<EpisodeTranscript | null>;
  exportTranscript(episodeId: number, format: ExportFormat): Promise<string>;
  getTranscriptPreview(episodeId: number, options?: PreviewOptions): Promise<SubtitlePreview[]>;

  // 配置管理
  getServiceConfig(service: TranscriptService): Promise<ServiceConfig | null>;
  setServiceConfig(service: TranscriptService, config: any): Promise<boolean>;
  testServiceConfig(service: TranscriptService): Promise<TestResult>;
}
```

## 实现细节

### 1. IPC Handlers 实现

在 `src/main/services/transcript/TranscriptIPCHandlers.ts`:

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { VoiceToTextFactory } from './VoiceToTextFactory';
import { TranscriptProcessor } from './TranscriptProcessor';
import { TranscriptConfigManager } from './config';
import { FunasrService } from './FunasrService';
import { AliyunService } from './AliyunService';
import { getDatabaseManager } from '@/main/database/connection';
import { episodeVoiceTextTasks, episodeTranscripts, episodes } from '@/main/database/schema';
import { eq } from 'drizzle-orm';

export class TranscriptIPCHandlers {
  private configManager: TranscriptConfigManager;

  constructor() {
    this.configManager = new TranscriptConfigManager();
    this.registerHandlers();
    this.initializeServices();
  }

  /**
   * 初始化转写服务
   */
  private initializeServices(): void {
    // 初始化 FunASR 服务
    const funasrConfig = this.configManager.getFunasrConfig();
    const funasrService = new FunasrService(funasrConfig);
    VoiceToTextFactory.register(funasrService);

    // 初始化阿里云服务（如果有配置）
    const aliyunConfig = this.configManager.getAliyunConfig();
    if (aliyunConfig) {
      const aliyunService = new AliyunService(aliyunConfig);
      VoiceToTextFactory.register(aliyunService);
    }
  }

  /**
   * 注册所有 IPC 处理器
   */
  private registerHandlers(): void {
    // 任务管理
    ipcMain.handle('transcript:submitTask', this.handleSubmitTask.bind(this));
    ipcMain.handle('transcript:queryTask', this.handleQueryTask.bind(this));
    ipcMain.handle('transcript:cancelTask', this.handleCancelTask.bind(this));
    ipcMain.handle('transcript:getTasksByEpisode', this.handleGetTasksByEpisode.bind(this));

    // 字幕数据
    ipcMain.handle('transcript:getTranscript', this.handleGetTranscript.bind(this));
    ipcMain.handle('transcript:exportTranscript', this.handleExportTranscript.bind(this));
    ipcMain.handle('transcript:getPreview', this.handleGetPreview.bind(this));

    // 配置管理
    ipcMain.handle('transcript:getConfig', this.handleGetConfig.bind(this));
    ipcMain.handle('transcript:setConfig', this.handleSetConfig.bind(this));
    ipcMain.handle('transcript:testConfig', this.handleTestConfig.bind(this));
  }

  /**
   * 提交转写任务
   */
  private async handleSubmitTask(
    event: IpcMainInvokeEvent,
    params: {
      episodeId: number;
      service: TranscriptService;
      options?: SubmitOptions;
    }
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      const { episodeId, service, options } = params;

      // 1. 获取 episode 信息
      const db = getDatabaseManager().getDrizzle();
      const episode = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, episodeId))
        .limit(1);

      if (!episode[0]) {
        return { success: false, error: 'Episode not found' };
      }

      const audioUrl = episode[0].audioUrl;
      if (!audioUrl) {
        return { success: false, error: 'Episode has no audio URL' };
      }

      // 2. 获取服务实例
      const voiceService = VoiceToTextFactory.getService(service);

      // 3. 提交任务
      const result = await voiceService.submit(audioUrl, episodeId, options);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submit task failed',
      };
    }
  }

  /**
   * 查询任务状态
   */
  private async handleQueryTask(
    event: IpcMainInvokeEvent,
    params: { taskId: string }
  ): Promise<QueryTaskResponse> {
    try {
      const { taskId } = params;

      // 1. 从数据库获取任务信息
      const db = getDatabaseManager().getDrizzle();
      const task = await db
        .select()
        .from(episodeVoiceTextTasks)
        .where(eq(episodeVoiceTextTasks.taskId, taskId))
        .limit(1);

      if (!task[0]) {
        return {
          success: false,
          taskId,
          status: 'failed',
          error: 'Task not found',
          service: 'funasr', // 默认值
        };
      }

      // 2. 如果已经完成，直接返回缓存结果
      if (task[0].status === 'success' || task[0].status === 'failed') {
        return {
          success: task[0].status === 'success',
          taskId,
          status: task[0].status === 'success' ? 'succeeded' : 'failed',
          result: task[0].status === 'success' ? JSON.parse(task[0].output) : undefined,
          error: task[0].status === 'failed' ? JSON.parse(task[0].output)?.error : undefined,
          service: task[0].service,
        };
      }

      // 3. 查询最新状态
      const voiceService = VoiceToTextFactory.getService(task[0].service);
      const result = await voiceService.query(taskId);

      return result;
    } catch (error) {
      return {
        success: false,
        taskId: params.taskId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Query task failed',
        service: 'funasr',
      };
    }
  }

  /**
   * 取消任务
   */
  private async handleCancelTask(
    event: IpcMainInvokeEvent,
    params: { taskId: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { taskId } = params;

      // 获取任务信息
      const db = getDatabaseManager().getDrizzle();
      const task = await db
        .select()
        .from(episodeVoiceTextTasks)
        .where(eq(episodeVoiceTextTasks.taskId, taskId))
        .limit(1);

      if (!task[0]) {
        return { success: false, error: 'Task not found' };
      }

      // 调用服务的取消方法
      const voiceService = VoiceToTextFactory.getService(task[0].service);
      if (voiceService.cancel) {
        const cancelled = await voiceService.cancel(taskId);
        return { success: cancelled };
      }

      return { success: false, error: 'Service does not support cancel' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cancel task failed',
      };
    }
  }

  /**
   * 获取 episode 的所有转写任务
   */
  private async handleGetTasksByEpisode(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{ success: boolean; tasks?: VoiceTextTask[]; error?: string }> {
    try {
      const { episodeId } = params;

      const db = getDatabaseManager().getDrizzle();
      const tasks = await db
        .select()
        .from(episodeVoiceTextTasks)
        .where(eq(episodeVoiceTextTasks.episodeId, episodeId))
        .orderBy(desc(episodeVoiceTextTasks.createdAt));

      return { success: true, tasks };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get tasks failed',
      };
    }
  }

  /**
   * 获取 episode 的转写结果
   */
  private async handleGetTranscript(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{ success: boolean; transcript?: EpisodeTranscript; error?: string }> {
    try {
      const { episodeId } = params;

      const db = getDatabaseManager().getDrizzle();
      const transcript = await db
        .select()
        .from(episodeTranscripts)
        .where(eq(episodeTranscripts.episodeId, episodeId))
        .limit(1);

      if (!transcript[0]) {
        return { success: false, error: 'Transcript not found' };
      }

      return { success: true, transcript: transcript[0] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get transcript failed',
      };
    }
  }

  /**
   * 导出字幕
   */
  private async handleExportTranscript(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; format: ExportFormat }
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const { episodeId, format } = params;

      // 1. 获取转写数据
      const db = getDatabaseManager().getDrizzle();
      const transcript = await db
        .select()
        .from(episodeTranscripts)
        .where(eq(episodeTranscripts.episodeId, episodeId))
        .limit(1);

      if (!transcript[0]) {
        return { success: false, error: 'Transcript not found' };
      }

      // 2. 解析 subtitles
      const sentences: SentenceInfo[] = JSON.parse(transcript[0].subtitles);

      // 3. 导出为指定格式
      const content = TranscriptProcessor.export(sentences, format);

      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  /**
   * 获取字幕预览
   */
  private async handleGetPreview(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; options?: PreviewOptions }
  ): Promise<{ success: boolean; preview?: SubtitlePreview[]; error?: string }> {
    try {
      const { episodeId, options } = params;

      // 获取转写数据
      const db = getDatabaseManager().getDrizzle();
      const transcript = await db
        .select()
        .from(episodeTranscripts)
        .where(eq(episodeTranscripts.episodeId, episodeId))
        .limit(1);

      if (!transcript[0]) {
        return { success: false, error: 'Transcript not found' };
      }

      // 生成预览
      const sentences: SentenceInfo[] = JSON.parse(transcript[0].subtitles);
      const preview = TranscriptProcessor.generatePreview(sentences, options);

      return { success: true, preview };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get preview failed',
      };
    }
  }

  /**
   * 获取服务配置
   */
  private async handleGetConfig(
    event: IpcMainInvokeEvent,
    params: { service: TranscriptService }
  ): Promise<{ success: boolean; config?: any; error?: string }> {
    try {
      const { service } = params;

      let config: any;
      if (service === 'funasr') {
        config = this.configManager.getFunasrConfig();
      } else if (service === 'aliyun') {
        config = this.configManager.getAliyunConfig();
      }

      return { success: true, config };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get config failed',
      };
    }
  }

  /**
   * 设置服务配置
   */
  private async handleSetConfig(
    event: IpcMainInvokeEvent,
    params: { service: TranscriptService; config: any }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { service, config } = params;

      if (service === 'funasr') {
        this.configManager.setFunasrConfig(config.pythonPath);
        // 重新初始化服务
        const funasrService = new FunasrService(this.configManager.getFunasrConfig());
        VoiceToTextFactory.register(funasrService);
      } else if (service === 'aliyun') {
        this.configManager.setAliyunConfig(config.apiKey, config.model);
        // 重新初始化服务
        const aliyunService = new AliyunService({ apiKey: config.apiKey });
        VoiceToTextFactory.register(aliyunService);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Set config failed',
      };
    }
  }

  /**
   * 测试服务配置
   */
  private async handleTestConfig(
    event: IpcMainInvokeEvent,
    params: { service: TranscriptService }
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { service } = params;

      // 这里可以实现配置测试逻辑
      // 例如：测试 Python 环境、测试 API Key 有效性等

      return { success: true, message: `${service} configuration is valid` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test config failed',
      };
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    ipcMain.removeHandler('transcript:submitTask');
    ipcMain.removeHandler('transcript:queryTask');
    ipcMain.removeHandler('transcript:cancelTask');
    ipcMain.removeHandler('transcript:getTasksByEpisode');
    ipcMain.removeHandler('transcript:getTranscript');
    ipcMain.removeHandler('transcript:exportTranscript');
    ipcMain.removeHandler('transcript:getPreview');
    ipcMain.removeHandler('transcript:getConfig');
    ipcMain.removeHandler('transcript:setConfig');
    ipcMain.removeHandler('transcript:testConfig');
  }
}

type ExportFormat = 'srt' | 'vtt' | 'lrc' | 'txt' | 'json';
```

### 2. Preload 脚本更新

在 `src/main/preload.ts` 中添加 transcript API:

```typescript
const transcriptAPI = {
  submitTask: (episodeId: number, service: TranscriptService, options?: SubmitOptions) =>
    ipcRenderer.invoke('transcript:submitTask', { episodeId, service, options }),

  queryTask: (taskId: string) =>
    ipcRenderer.invoke('transcript:queryTask', { taskId }),

  cancelTask: (taskId: string) =>
    ipcRenderer.invoke('transcript:cancelTask', { taskId }),

  getTasksByEpisode: (episodeId: number) =>
    ipcRenderer.invoke('transcript:getTasksByEpisode', { episodeId }),

  getTranscript: (episodeId: number) =>
    ipcRenderer.invoke('transcript:getTranscript', { episodeId }),

  exportTranscript: (episodeId: number, format: ExportFormat) =>
    ipcRenderer.invoke('transcript:exportTranscript', { episodeId, format }),

  getPreview: (episodeId: number, options?: PreviewOptions) =>
    ipcRenderer.invoke('transcript:getPreview', { episodeId, options }),

  getConfig: (service: TranscriptService) =>
    ipcRenderer.invoke('transcript:getConfig', { service }),

  setConfig: (service: TranscriptService, config: any) =>
    ipcRenderer.invoke('transcript:setConfig', { service, config }),

  testConfig: (service: TranscriptService) =>
    ipcRenderer.invoke('transcript:testConfig', { service }),
};

contextBridge.exposeInMainWorld('electronAPI', {
  // ... 现有 API
  transcript: transcriptAPI,
});
```

### 3. TypeScript 类型定义

在 `src/renderer/types/electron.d.ts`:

```typescript
interface ElectronAPI {
  // ... 现有定义

  transcript: {
    submitTask(
      episodeId: number,
      service: 'funasr' | 'aliyun',
      options?: SubmitOptions
    ): Promise<{ success: boolean; taskId?: string; error?: string }>;

    queryTask(taskId: string): Promise<QueryTaskResponse>;

    cancelTask(taskId: string): Promise<{ success: boolean; error?: string }>;

    getTasksByEpisode(
      episodeId: number
    ): Promise<{ success: boolean; tasks?: VoiceTextTask[]; error?: string }>;

    getTranscript(
      episodeId: number
    ): Promise<{ success: boolean; transcript?: EpisodeTranscript; error?: string }>;

    exportTranscript(
      episodeId: number,
      format: 'srt' | 'vtt' | 'lrc' | 'txt' | 'json'
    ): Promise<{ success: boolean; content?: string; error?: string }>;

    getPreview(
      episodeId: number,
      options?: PreviewOptions
    ): Promise<{ success: boolean; preview?: SubtitlePreview[]; error?: string }>;

    getConfig(
      service: 'funasr' | 'aliyun'
    ): Promise<{ success: boolean; config?: any; error?: string }>;

    setConfig(
      service: 'funasr' | 'aliyun',
      config: any
    ): Promise<{ success: boolean; error?: string }>;

    testConfig(
      service: 'funasr' | 'aliyun'
    ): Promise<{ success: boolean; message?: string; error?: string }>;
  };
}
```

## 依赖关系

- **前置依赖**:
  - Task 1.1-1.5: 所有服务和处理逻辑实现完成

- **后置依赖**:
  - Task 1.7: UI 集成

## 验收标准

- [ ] TranscriptIPCHandlers 实现完整
- [ ] Preload 脚本正确暴露 API
- [ ] TypeScript 类型定义完整
- [ ] 所有 IPC 调用正确处理错误
- [ ] 资源清理逻辑完善
- [ ] 单元测试覆盖所有 Handler
- [ ] 集成测试验证端到端通信

## 风险和注意事项

### 风险

1. **IPC 通信开销**: 大量字幕数据传输可能影响性能
2. **错误传播**: IPC 错误需要正确序列化传输
3. **并发问题**: 多个任务同时查询时的状态同步

### 注意事项

1. **数据大小**: 避免通过 IPC 传输过大的数据
2. **错误处理**: 统一的错误格式和日志
3. **类型安全**: 确保类型定义与实现一致
4. **资源清理**: 应用退出时正确清理 IPC 监听器

## 实施步骤

1. 实现 TranscriptIPCHandlers 类
2. 更新 preload.ts 暴露 API
3. 更新 TypeScript 类型定义
4. 在 main.ts 中初始化 Handlers
5. 编写单元测试
6. 编写集成测试
7. 性能测试和优化

## 估时

- 设计: 1 天
- 实现: 2 天
- 测试: 2 天
- **总计**: 5 天
