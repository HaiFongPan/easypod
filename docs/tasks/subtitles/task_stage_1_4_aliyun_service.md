# Task Stage 1.4: 阿里云转写服务实现

## 任务概述

实现基于阿里云 DashScope API 的音频转写服务，支持在线转写、异步任务查询、说话人分离等功能。

## 技术设计

### 阿里云 API 流程

```
1. 提交任务
   POST /api/v1/services/audio/asr/transcription
   Header: X-DashScope-Async: enable

2. 查询任务
   GET /api/v1/tasks/{task_id}

3. 下载结果
   GET {transcription_url}
```

### 状态映射

| 阿里云状态 | 统一状态 | 说明 |
|-----------|---------|------|
| PENDING | processing | 任务排队中 |
| RUNNING | processing | 任务执行中 |
| SUCCEEDED | success | 任务成功 |
| FAILED | failed | 任务失败 |

## 实现细节

### 1. 阿里云原始数据类型

在 `src/main/types/transcript.ts`:

```typescript
/**
 * 阿里云提交任务响应
 */
export interface AliyunSubmitResponse {
  output: {
    task_status: 'PENDING' | 'RUNNING';
    task_id: string;
  };
  request_id: string;
}

/**
 * 阿里云查询任务响应
 */
export interface AliyunQueryResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    submit_time: string;
    scheduled_time?: string;
    end_time?: string;
    results?: Array<{
      file_url: string;
      transcription_url: string;
      subtask_status: 'SUCCEEDED' | 'FAILED';
    }>;
    task_metrics?: {
      TOTAL: number;
      SUCCEEDED: number;
      FAILED: number;
    };
  };
  usage?: {
    duration: number;
  };
}

/**
 * 阿里云转写结果数据
 */
export interface AliyunRawData {
  file_url: string;
  properties: {
    audio_format: string;
    channels: number[];
    original_sampling_rate: number;
    original_duration_in_milliseconds: number;
  };
  transcripts: Array<{
    channel_id: number;
    content_duration_in_milliseconds: number;
    text: string;
    sentences: AliyunSentence[];
  }>;
}

export interface AliyunSentence {
  begin_time: number; // 毫秒
  end_time: number; // 毫秒
  text: string;
  sentence_id: number;
  speaker_id?: number; // 说话人分离时才有
  words: Array<{
    begin_time: number;
    end_time: number;
    text: string;
    punctuation: string;
  }>;
}
```

### 2. 阿里云服务实现

在 `src/main/services/transcript/AliyunService.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import { BaseVoiceToTextService } from './VoiceToTextService';
import { AliyunConverter } from './converters/AliyunConverter';

export class AliyunService extends BaseVoiceToTextService {
  readonly serviceName: TranscriptService = 'aliyun';

  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = 'https://dashscope.aliyuncs.com/api/v1';

  constructor(config: AliyunConfig) {
    super();
    this.apiKey = config.apiKey;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async submit(
    audioUrl: string,
    episodeId: number,
    options?: SubmitOptions
  ): Promise<SubmitTaskResponse> {
    try {
      // 1. 预处理 URL（处理重定向）
      const finalUrl = await this.preprocessAudioUrl(audioUrl);

      // 2. 构建请求参数
      const requestBody = {
        model: options?.model || 'paraformer-v2',
        input: {
          file_urls: [finalUrl],
        },
        parameters: {
          disfluency_removal_enabled: options?.disfluencyRemoval !== false,
          timestamp_alignment_enabled: options?.timestampAlignment !== false,
          language_hints: options?.languageHints || ['zh', 'en'],
          diarization_enabled: options?.diarizationEnabled !== false,
          speaker_count: options?.speakerCount || 2,
        },
      };

      // 3. 提交任务
      const response = await this.client.post<AliyunSubmitResponse>(
        '/services/audio/asr/transcription',
        requestBody,
        {
          headers: {
            'X-DashScope-Async': 'enable',
          },
        }
      );

      const { task_id } = response.data.output;

      // 4. 保存任务信息到数据库
      await this.saveTaskToDb(episodeId, task_id, 'processing');

      return {
        success: true,
        taskId: task_id,
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
      const response = await this.client.get<AliyunQueryResponse>(
        `/tasks/${taskId}`
      );

      const { task_status, results } = response.data.output;

      // 2. 映射状态
      const status = this.mapAliyunStatus(task_status);

      // 3. 如果任务失败
      if (task_status === 'FAILED') {
        await this.updateTaskInDb(taskId, 'failed', response.data);

        return {
          success: false,
          taskId,
          status: 'failed',
          error: 'Transcription task failed',
          service: this.serviceName,
        };
      }

      // 4. 如果任务成功
      if (task_status === 'SUCCEEDED' && results && results.length > 0) {
        const transcriptionUrl = results[0].transcription_url;

        // 5. 下载转写结果
        const rawData = await this.downloadTranscriptionResult(transcriptionUrl);

        // 6. 保存原始数据和转换后的数据
        const converter = new AliyunConverter();
        await converter.saveTranscript(
          await this.getEpisodeIdByTaskId(taskId),
          rawData,
          this.serviceName
        );

        // 7. 更新任务状态
        await this.updateTaskInDb(taskId, 'success', response.data);

        return {
          success: true,
          taskId,
          status: 'succeeded',
          result: rawData,
          service: this.serviceName,
        };
      }

      // 5. 任务仍在处理中
      return {
        success: true,
        taskId,
        status: 'processing',
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

  protected mapStatus(serviceStatus: string): TaskStatus {
    return this.mapAliyunStatus(serviceStatus as any);
  }

  /**
   * 映射阿里云状态到统一状态
   */
  private mapAliyunStatus(
    status: AliyunQueryResponse['output']['task_status']
  ): TaskStatus {
    switch (status) {
      case 'PENDING':
      case 'RUNNING':
        return 'processing';
      case 'SUCCEEDED':
        return 'success';
      case 'FAILED':
        return 'failed';
      default:
        return 'failed';
    }
  }

  /**
   * 下载转写结果
   */
  private async downloadTranscriptionResult(url: string): Promise<AliyunRawData> {
    const response = await axios.get<AliyunRawData>(url);
    return response.data;
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
}

interface AliyunConfig {
  apiKey: string;
}
```

### 3. 阿里云数据转换器

在 `src/main/services/transcript/converters/AliyunConverter.ts`:

```typescript
import { BaseTranscriptConverter } from '../TranscriptConverter';
import { AliyunRawData, AliyunSentence, SentenceInfo } from '@/main/types/transcript';

export class AliyunConverter extends BaseTranscriptConverter {
  convertToSentenceInfo(raw: AliyunRawData): SentenceInfo[] {
    const sentences: SentenceInfo[] = [];

    // 阿里云可能有多个 channel，这里假设只处理第一个
    const transcript = raw.transcripts[0];
    if (!transcript) {
      return [];
    }

    for (const sentence of transcript.sentences) {
      sentences.push({
        text: sentence.text,
        start: sentence.begin_time,
        end: sentence.end_time,
        timestamp: this.extractWordTimestamps(sentence),
        spk: sentence.speaker_id ?? 0,
      });
    }

    return sentences;
  }

  extractText(raw: AliyunRawData): string {
    const transcript = raw.transcripts[0];
    return transcript?.text || '';
  }

  calculateSpeakerCount(raw: AliyunRawData): number {
    const transcript = raw.transcripts[0];
    if (!transcript?.sentences || transcript.sentences.length === 0) {
      return 1;
    }

    // 找出最大的 speaker_id
    const speakerIds = transcript.sentences
      .map(s => s.speaker_id ?? 0)
      .filter(id => id !== undefined);

    if (speakerIds.length === 0) {
      return 1;
    }

    const maxSpeakerId = Math.max(...speakerIds);
    return maxSpeakerId + 1; // speaker_id 从 0 开始
  }

  /**
   * 从 words 中提取词级别时间戳
   */
  private extractWordTimestamps(sentence: AliyunSentence): number[][] {
    return sentence.words.map(word => [word.begin_time, word.end_time]);
  }
}
```

### 4. 服务配置管理

在 `src/main/services/transcript/config.ts`:

```typescript
import { app } from 'electron';
import Store from 'electron-store';

interface TranscriptConfig {
  aliyun?: {
    apiKey: string;
    model?: 'paraformer-v2' | 'paraformer-v1';
  };
  funasr?: {
    pythonPath?: string;
    modelsPath?: string;
  };
}

export class TranscriptConfigManager {
  private store: Store<TranscriptConfig>;

  constructor() {
    this.store = new Store<TranscriptConfig>({
      name: 'transcript-config',
    });
  }

  /**
   * 获取阿里云配置
   */
  getAliyunConfig(): AliyunConfig | null {
    const config = this.store.get('aliyun');
    if (!config?.apiKey) {
      return null;
    }
    return {
      apiKey: config.apiKey,
    };
  }

  /**
   * 设置阿里云配置
   */
  setAliyunConfig(apiKey: string, model?: string): void {
    this.store.set('aliyun', { apiKey, model });
  }

  /**
   * 获取 FunASR 配置
   */
  getFunasrConfig(): FunasrConfig {
    const config = this.store.get('funasr') || {};
    return {
      pythonPath: config.pythonPath,
      outputDir: path.join(app.getPath('userData'), 'funasr-tasks'),
    };
  }

  /**
   * 设置 FunASR 配置
   */
  setFunasrConfig(pythonPath?: string): void {
    this.store.set('funasr', { pythonPath });
  }
}
```

## 依赖关系

- **前置依赖**:
  - Task 1.1: 数据库表结构
  - Task 1.2: VoiceToText 接口
  - 阿里云 API Key 配置

- **后置依赖**:
  - Task 1.6: IPC 通信接口
  - Task 1.7: UI 集成

## 验收标准

- [ ] AliyunService 实现完整
- [ ] AliyunConverter 转换逻辑正确
- [ ] API 请求和错误处理健壮
- [ ] 状态映射准确
- [ ] 转写结果下载和解析正确
- [ ] 配置管理功能完善
- [ ] 单元测试覆盖核心逻辑
- [ ] 集成测试验证端到端流程

## 风险和注意事项

### 风险

1. **API 费用**: 阿里云 API 按使用量计费，需要提示用户
2. **网络依赖**: 需要稳定的网络连接
3. **API 限流**: 可能遇到请求频率限制
4. **密钥安全**: API Key 需要安全存储

### 注意事项

1. **异步轮询**: 需要合理的轮询间隔，避免频繁请求
2. **超时处理**: 长音频可能需要较长时间
3. **错误重试**: 网络错误需要重试机制
4. **结果缓存**: transcription_url 有有效期，需及时下载

## 实施步骤

1. 实现 AliyunService 类
2. 实现 AliyunConverter 类
3. 实现 TranscriptConfigManager
4. 集成到 VoiceToTextFactory
5. 编写单元测试
6. 编写集成测试
7. 验证端到端流程

## 估时

- 设计: 1 天
- 实现: 2 天
- 配置管理: 1 天
- 测试: 2 天
- **总计**: 6 天
