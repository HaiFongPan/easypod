# Task Stage 1.3: FunASR 服务集成

## 任务概述

集成基于本地 FunASR Python Runtime 的音频转写服务，通过 FastAPI HTTP 服务提供离线转写、说话人分离、时间戳对齐等功能。

## 技术设计

### FunASR 服务架构

```
┌─────────────────────────┐
│   Main Process (TS)     │
│                         │
│  ┌──────────────────┐   │
│  │ FunASRManager    │   │
│  │                  │   │
│  │ ┌──────────────┐ │   │
│  │ │ FunASRServer │ │   │  启动/管理 Python 进程
│  │ └──────┬───────┘ │   │
│  │        │         │   │
│  │ ┌──────▼───────┐ │   │
│  │ │ Client (HTTP)│ │   │  HTTP 调用
│  │ └──────┬───────┘ │   │
│  └────────┼─────────┘   │
└───────────┼─────────────┘
            │ HTTP (127.0.0.1:17953)
            ▼
┌─────────────────────────┐
│ Python Runtime (FastAPI)│
│                         │
│  resources/python/      │
│  funasr_service.py      │
│                         │
│  - /initialize          │
│  - /transcribe          │
│  - /task/{task_id}      │
│  - /health              │
└─────────────────────────┘
```

### 数据流程

1. **初始化模型**: `FunASRManager.initializeModel()` → HTTP POST `/initialize`
2. **提交任务**: `FunASRManager.transcribe()` → HTTP POST `/transcribe` → 返回 task_id
3. **查询状态**: `FunASRManager.getTask(task_id)` → HTTP GET `/task/{task_id}`
4. **获取结果**: 任务状态变为 `completed` 后从响应中获取 segments

## 现有实现回顾

### 1. FunASR FastAPI 服务 (已存在)

文件: `resources/python/funasr_service.py`

**核心端点**:

- `POST /initialize` - 初始化 FunASR 模型
  ```python
  {
    "asr_model": "模型标识",
    "device": "cpu | cuda",
    "options": {
      "vad_model": "VAD 模型",
      "punc_model": "标点模型",
      "max_single_segment_time": 60000
    }
  }
  ```

- `POST /transcribe` - 提交转写任务
  ```python
  {
    "audio_path": "/absolute/path/to/audio.wav",
    "options": {
      "batch_size_s": 300,
      "sentence_timestamp": true,
      "word_timestamp": false
    }
  }
  ```

- `GET /task/{task_id}` - 查询任务状态
  ```python
  {
    "status": "queued | processing | completed | failed",
    "progress": 0.0-1.0,
    "segments": [...],  # 完成后返回
    "error": "..."      # 失败时返回
  }
  ```

**段落格式**:
```typescript
{
  "text": "转写文本",
  "start_ms": 1000,   // 开始时间（毫秒）
  "end_ms": 5000      // 结束时间（毫秒）
}
```

### 2. TypeScript 客户端 (已存在)

文件: `src/main/services/funasr/FunASRServiceClient.ts`

提供类型安全的 HTTP 客户端封装。

### 3. 服务器管理器 (已存在)

文件: `src/main/services/funasr/FunASRServer.ts`

负责启动和管理 Python FastAPI 进程。

### 4. 高层管理器 (已存在)

文件: `src/main/services/funasr/FunASRManager.ts`

整合 Server 和 Client，提供统一的调用接口。

## 需要实现的内容

### 1. VoiceToText 服务适配器

在 `src/main/services/transcript/FunasrService.ts`:

```typescript
import { BaseVoiceToTextService } from './VoiceToTextService';
import { FunasrConverter } from './converters/FunasrConverter';
import { createFunASRManager } from '../funasr/FunASRManager';
import { FunASRManager } from '../funasr/FunASRManager';
import { getTranscriptConfigManager } from './TranscriptConfigManager';
import { getDatabaseManager } from '@/main/database/connection';
import { episodeVoiceTextTasks } from '@/main/database/schema';
import { eq } from 'drizzle-orm';

export class FunasrService extends BaseVoiceToTextService {
  readonly serviceName: TranscriptService = 'funasr';

  private manager: FunASRManager;
  private initialized = false;

  constructor() {
    super();
    this.manager = createFunASRManager();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.manager.on('log', (entry) => {
      console.log(`[FunASR] ${entry.stream}: ${entry.line}`);
    });

    this.manager.on('error', (error) => {
      console.error('[FunASR] Error:', error);
    });

    this.manager.on('exit', ({ code, signal }) => {
      console.warn(`[FunASR] Service exited with code ${code}, signal ${signal}`);
      this.initialized = false;
    });
  }

  async submit(
    audioUrl: string,
    episodeId: number,
    options?: SubmitOptions
  ): Promise<SubmitTaskResponse> {
    try {
      // 1. 确保模型已初始化
      await this.ensureInitialized();

      // 2. 下载音频文件到本地（FunASR 需要本地文件）
      const audioPath = await this.downloadAudio(audioUrl, episodeId);

      // 3. 提交转写任务
      const result = await this.manager.transcribe({
        audio_path: audioPath,
        options: {
          batch_size_s: options?.batchSizeS || 300,
          sentence_timestamp: true,
          word_timestamp: options?.wordTimestamp || false,
          merge_vad: true,
        },
      });

      // 4. 保存任务信息到数据库
      await this.saveTaskToDb(episodeId, result.task_id, 'processing');

      return {
        success: true,
        taskId: result.task_id,
        service: this.serviceName,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submit task failed',
        service: this.serviceName,
      };
    }
  }

  async query(taskId: string): Promise<QueryTaskResponse> {
    try {
      // 1. 查询任务状态
      const taskStatus = await this.manager.getTask(taskId);

      // 2. 映射状态
      const status = this.mapFunASRStatus(taskStatus.status);

      // 3. 如果任务失败
      if (taskStatus.status === 'failed') {
        await this.updateTaskInDb(taskId, 'failed', { error: taskStatus.error });

        return {
          success: false,
          taskId,
          status: 'failed',
          error: taskStatus.error || 'Transcription failed',
          service: this.serviceName,
        };
      }

      // 4. 如果任务完成
      if (taskStatus.status === 'completed' && taskStatus.segments) {
        // 转换为标准格式
        const rawData = this.convertSegmentsToRawData(taskStatus.segments);

        // 保存原始数据和转换后的数据
        const episodeId = await this.getEpisodeIdByTaskId(taskId);
        const converter = new FunasrConverter();
        await converter.saveTranscript(episodeId, rawData, this.serviceName);

        // 更新任务状态
        await this.updateTaskInDb(taskId, 'success', rawData);

        return {
          success: true,
          taskId,
          status: 'succeeded',
          result: rawData,
          service: this.serviceName,
        };
      }

      // 5. 仍在处理中
      return {
        success: true,
        taskId,
        status: 'processing',
        progress: taskStatus.progress,
        service: this.serviceName,
      };
    } catch (error) {
      return {
        success: false,
        taskId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Query task failed',
        service: this.serviceName,
      };
    }
  }

  async cancel(taskId: string): Promise<boolean> {
    // FunASR 服务暂不支持取消任务
    // 可以考虑在数据库中标记为已取消
    await this.updateTaskInDb(taskId, 'failed', { error: 'Task cancelled by user' });
    return true;
  }

  protected mapStatus(serviceStatus: string): TaskStatus {
    return this.mapFunASRStatus(serviceStatus as any);
  }

  /**
   * 确保模型已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 获取配置
    const configManager = getTranscriptConfigManager();
    const config = configManager.getFunASRConfig();

    if (!config) {
      throw new Error('FunASR config not found. Please configure FunASR models first.');
    }

    // 初始化模型
    await this.manager.initializeModel({
      asr_model: config.model,
      device: config.device || 'cpu',
      options: {
        vad_model: config.vadModel,
        punc_model: config.puncModel,
        max_single_segment_time: config.maxSingleSegmentTime || 60000,
      },
    });

    this.initialized = true;
  }

  /**
   * 下载音频文件到本地
   */
  private async downloadAudio(url: string, episodeId: number): Promise<string> {
    const axios = require('axios');
    const fs = require('fs').promises;
    const path = require('path');
    const { app } = require('electron');

    // 预处理 URL（处理重定向）
    const finalUrl = await this.preprocessAudioUrl(url);

    // 创建临时目录
    const tempDir = path.join(app.getPath('userData'), 'funasr-temp');
    await fs.mkdir(tempDir, { recursive: true });

    // 下载文件
    const audioPath = path.join(tempDir, `episode-${episodeId}.wav`);
    const response = await axios.get(finalUrl, { responseType: 'stream' });

    const writer = require('fs').createWriteStream(audioPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(audioPath));
      writer.on('error', reject);
    });
  }

  /**
   * 映射 FunASR 状态到统一状态
   */
  private mapFunASRStatus(status: 'queued' | 'processing' | 'completed' | 'failed'): TaskStatus {
    switch (status) {
      case 'queued':
      case 'processing':
        return 'processing';
      case 'completed':
        return 'success';
      case 'failed':
        return 'failed';
      default:
        return 'failed';
    }
  }

  /**
   * 转换 FunASR segments 为原始数据格式
   */
  private convertSegmentsToRawData(segments: any[]): FunasrRawData {
    const sentences: FunasrSentenceInfo[] = segments.map((seg) => ({
      text: seg.text,
      start: seg.start_ms,
      end: seg.end_ms,
      timestamp: [[seg.start_ms, seg.end_ms]],
      spk: 0, // FunASR 默认单说话人
    }));

    return {
      key: 'audio',
      text: segments.map((s) => s.text).join(' '),
      timestamp: segments.map((s) => [s.start_ms, s.end_ms]),
      sentence_info: sentences,
    };
  }

  /**
   * 根据 taskId 获取 episodeId
   */
  private async getEpisodeIdByTaskId(taskId: string): Promise<number> {
    const db = getDatabaseManager().getDrizzle();
    const task = await db
      .select()
      .from(episodeVoiceTextTasks)
      .where(eq(episodeVoiceTextTasks.taskId, taskId))
      .limit(1);

    if (!task[0]) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return task[0].episodeId;
  }

  /**
   * 清理资源
   */
  async shutdown(): Promise<void> {
    await this.manager.shutdown();
  }
}
```

### 2. FunASR 数据转换器

在 `src/main/services/transcript/converters/FunasrConverter.ts`:

```typescript
import { BaseTranscriptConverter } from '../TranscriptConverter';
import { FunasrRawData, FunasrSentenceInfo, SentenceInfo } from '@/main/types/transcript';

export class FunasrConverter extends BaseTranscriptConverter {
  convertToSentenceInfo(raw: FunasrRawData): SentenceInfo[] {
    // FunASR 的 sentence_info 已经是标准格式，直接返回
    return raw.sentence_info.map((item) => ({
      text: item.text,
      start: item.start,
      end: item.end,
      timestamp: item.timestamp,
      spk: item.spk || 0,
    }));
  }

  extractText(raw: FunasrRawData): string {
    return raw.text;
  }

  calculateSpeakerCount(raw: FunasrRawData): number {
    if (!raw.sentence_info || raw.sentence_info.length === 0) {
      return 1;
    }

    const maxSpk = Math.max(...raw.sentence_info.map((s) => s.spk || 0));
    return maxSpk + 1; // spk 从 0 开始
  }
}
```

### 3. 类型定义

在 `src/main/types/transcript.ts` 中添加:

```typescript
/**
 * FunASR 原始返回数据
 */
export interface FunasrRawData {
  key: string; // 音频文件名
  text: string; // 完整文字稿
  timestamp: number[][]; // [[start, end], ...] 词级别时间戳
  sentence_info: FunasrSentenceInfo[];
}

export interface FunasrSentenceInfo {
  text: string;
  start: number; // 毫秒
  end: number; // 毫秒
  timestamp: number[][];
  spk: number; // 发言人编号
}
```

## 依赖关系

- **前置依赖**:
  - Task 1.0: 配置管理
  - Task 1.1: 数据库表结构
  - Task 1.2: VoiceToText 接口
  - Python Runtime 已构建
  - 现有的 FunASRManager 实现

- **后置依赖**:
  - Task 1.6: IPC 通信接口
  - Task 1.7: UI 集成

## 验收标准

- [ ] FunasrService 适配器实现完整
- [ ] FunasrConverter 转换逻辑正确
- [ ] 与现有 FunASRManager 正确集成
- [ ] 模型初始化逻辑正确
- [ ] 任务状态跟踪准确
- [ ] 音频下载和清理逻辑完善
- [ ] 错误处理健壮
- [ ] 单元测试覆盖核心逻辑
- [ ] 集成测试验证端到端流程

## 风险和注意事项

### 风险

1. **服务启动时间**: FastAPI 服务启动可能需要几秒钟
2. **模型加载**: 首次加载模型可能耗时较长（1-2 分钟）
3. **进程管理**: 需要确保 Python 进程正确清理
4. **磁盘空间**: 下载的音频文件需要定期清理

### 注意事项

1. **单例模式**: FunASRManager 应该是单例，避免多次启动服务
2. **模型缓存**: 模型加载后会缓存在内存中
3. **错误重试**: 服务启动失败时需要重试机制
4. **资源清理**: 应用退出时清理临时文件和进程
5. **配置检查**: 提交任务前检查模型配置是否存在

## 实施步骤

1. 实现 FunasrService 适配器类
2. 实现 FunasrConverter 转换器
3. 添加类型定义
4. 集成到 VoiceToTextFactory
5. 编写单元测试
6. 编写集成测试
7. 验证端到端流程
8. 添加错误处理和日志

## 估时

- 设计: 0.5 天
- 适配器实现: 2 天
- 转换器实现: 0.5 天
- 测试: 2 天
- **总计**: 5 天

## 与现有实现的集成

### FunASRManager 使用示例

```typescript
import { createFunASRManager } from '@/main/services/funasr/FunASRManager';

const manager = createFunASRManager();

// 1. 初始化模型
await manager.initializeModel({
  asr_model: 'paraformer-large',
  device: 'cpu',
  options: {
    vad_model: 'fsmn_vad',
    punc_model: 'ct-transformer',
  },
});

// 2. 提交转写任务
const { task_id } = await manager.transcribe({
  audio_path: '/path/to/audio.wav',
  options: {
    batch_size_s: 300,
    sentence_timestamp: true,
  },
});

// 3. 轮询任务状态
const status = await manager.getTask(task_id);

// 4. 关闭服务
await manager.shutdown();
```

### 事件监听

```typescript
manager.on('log', (entry) => {
  console.log(`[${entry.stream}] ${entry.line}`);
});

manager.on('error', (error) => {
  console.error('FunASR Error:', error);
});

manager.on('exit', ({ code, signal }) => {
  console.warn(`FunASR exited: code=${code}, signal=${signal}`);
});

manager.on('ready', ({ url, pid }) => {
  console.log(`FunASR ready at ${url}, pid=${pid}`);
});
```

## 测试建议

### 单元测试

```typescript
describe('FunasrService', () => {
  it('should submit transcription task', async () => {
    const service = new FunasrService();
    const result = await service.submit('http://example.com/audio.mp3', 1);
    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();
  });

  it('should query task status', async () => {
    const service = new FunasrService();
    const result = await service.query('task-123');
    expect(result.status).toBeDefined();
  });
});
```

### 集成测试

```typescript
describe('FunASR Integration', () => {
  it('should complete full transcription workflow', async () => {
    const service = new FunasrService();

    // 提交任务
    const submitResult = await service.submit('http://example.com/test.mp3', 1);
    expect(submitResult.success).toBe(true);

    // 轮询直到完成
    let queryResult;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      queryResult = await service.query(submitResult.taskId!);
    } while (queryResult.status === 'processing');

    // 验证结果
    expect(queryResult.status).toBe('succeeded');
    expect(queryResult.result).toBeDefined();
  });
});
```
