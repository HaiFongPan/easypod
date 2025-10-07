# Task Stage 1.4: 阿里云转写服务实现

## 任务概述

基于阿里云 DashScope 语音识别 API 实现远程音频转写服务，补齐 `VoiceToText` 抽象下的第二个实现。该任务需要完成阿里云任务提交、异步状态轮询、结果下载与转换，并与现有数据库和配置管理体系集成。

## 技术设计

### 阿里云 API 流程

```
1. 提交任务
   POST /services/audio/asr/transcription
   Header: X-DashScope-Async: enable

2. 查询任务
   GET /tasks/{task_id}

3. 下载结果
   GET {transcription_url}
```

### 状态映射

| 阿里云状态 | TaskStatus | 说明 |
|-----------|------------|------|
| PENDING   | pending    | 任务已创建，等待调度 |
| RUNNING   | processing | 任务执行中 |
| SUCCEEDED | succeeded  | 任务完成，可下载结果 |
| FAILED    | failed     | 任务失败，需展示错误 |

### 现有代码结构回顾

- `src/main/services/transcript/VoiceToTextService.ts`
  - 提供 `BaseVoiceToTextService`，内置音频 URL 预处理、任务入库、状态更新等通用逻辑。
- `src/main/services/transcript/TranscriptConverter.ts`
  - 定义 `BaseTranscriptConverter`，封装原始数据与标准字幕结构之间的转换与入库。
- `src/main/services/transcript/FunasrService.ts`
  - 本地 FunASR 的参考实现，可借鉴日志、错误处理与数据库交互模式。
- `src/main/services/transcript/TranscriptConfigManager.ts`
  - 通过 `electron-store` 保存 FunASR 与阿里云配置，提供默认值与导入导出。
- `src/main/services/transcript/TranscriptIPCHandlers.ts`
  - 在主进程中注册 `VoiceToText` 服务，处理渲染进程的任务提交与查询请求。
- `src/main/types/transcript.ts`
  - 定义转写相关的公共类型；当前 `AliyunRawData` 仍是占位符，需要补全。

## 需要实现的内容

### 1. 补全阿里云类型定义

位置: `src/main/types/transcript.ts`

- 定义与 DashScope API 对应的响应类型：
  - `AliyunSubmitResponse` — 任务提交返回 `task_id` 与初始状态。
  - `AliyunQueryResponse` — 任务查询返回状态、结果列表、用量统计等。
  - `AliyunTaskResult` / `AliyunTaskResultItem` — `output.results` 结构。
  - `AliyunRawData`, `AliyunTranscript`, `AliyunSentence`, `AliyunWord` — 转写结果 JSON。
- 更新 `RawTranscriptData` 联合类型并导出上述新接口，供服务与转换器使用。
- 保持字段命名与文档一致（`begin_time`, `transcription_url` 等），方便后续映射。

示例片段：

```typescript
export interface AliyunSubmitResponse {
  output: {
    task_status: 'PENDING' | 'RUNNING';
    task_id: string;
  };
  request_id: string;
}

export interface AliyunQueryResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    submit_time: string;
    scheduled_time?: string;
    end_time?: string;
    results?: AliyunTaskResultItem[];
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

export interface AliyunTaskResultItem {
  file_url: string;
  transcription_url: string;
  subtask_status: 'SUCCEEDED' | 'FAILED';
}

export interface AliyunWord {
  begin_time: number;
  end_time: number;
  text: string;
  punctuation: string;
}

export interface AliyunSentence {
  begin_time: number;
  end_time: number;
  text: string;
  sentence_id: number;
  speaker_id?: number;
  words: AliyunWord[];
}

export interface AliyunTranscript {
  channel_id: number;
  content_duration_in_milliseconds: number;
  text: string;
  sentences: AliyunSentence[];
}

export interface AliyunRawData {
  file_url: string;
  properties: {
    audio_format: string;
    channels: number[];
    original_sampling_rate: number;
    original_duration_in_milliseconds: number;
  };
  transcripts: AliyunTranscript[];
}
```

### 2. 实现 `AliyunService`

新建文件: `src/main/services/transcript/AliyunService.ts`

核心职责：提交 DashScope 转写任务、轮询任务状态、在成功时下载并保存结果。

实现要点：

- 构造函数
  - 接收 `AliyunConfig`，根据配置创建 `axios` 客户端（`baseURL`、`timeout`、`Authorization` Header）。
  - 支持自定义 `baseURL`，默认为 `https://dashscope.aliyuncs.com/api/v1`。

- `submit(audioUrl, episodeId, options)`
  1. 通过 `preprocessAudioUrl` 处理重定向，获得最终可访问的音频地址。
  2. 组合请求体：
     - `model`: `options?.model ?? config.model ?? 'paraformer-v2'`
     - `input.file_urls`: 音频 URL 数组
     - `parameters`：合并配置与调用参数（`language_hints`、`speaker_count`、`disfluency_removal_enabled`、`timestamp_alignment_enabled`、`diarization_enabled`）。缺省时默认开启 `timestamp_alignment` 与 `disfluency_removal`。
  3. 使用 header `X-DashScope-Async: enable` 提交任务。
  4. 将任务写入 `episode_voice_text_tasks`：任务状态置为 `processing`，`output` 保存原始响应。
  5. 返回 `{ success: true, taskId, service: 'aliyun' }`，失败时捕获异常并写入错误信息。

- `query(taskId)`
  1. 调用 `GET /tasks/{taskId}`，根据 `task_status` 做分支。
  2. `FAILED`
     - 调用 `updateTaskInDb(taskId, 'failed', response.data)`
     - 返回 `{ success: false, status: 'failed', error }`
  3. `SUCCEEDED`
     - 读取 `results`，挑选 `subtask_status === 'SUCCEEDED'` 的条目。
     - 下载 `transcription_url`（预签名 URL，无需额外 Header）。
     - 通过 `AliyunConverter` 将数据保存到 `episode_voice_texts` 与 `episode_transcripts`。
     - 更新数据库任务状态为 `succeeded`，`output` 记录查询响应。
     - 返回 `{ success: true, status: 'succeeded', result: rawData }`。
  4. 其它状态返回 `{ success: true, status }`，保持轮询。
  5. 所有异常都需 catch，写入 `updateTaskInDb(taskId, 'failed', { error })` 后再返回失败结构。

- 状态映射

```typescript
private mapAliyunStatus(status: AliyunQueryResponse['output']['task_status']): TaskStatus {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'RUNNING':
      return 'processing';
    case 'SUCCEEDED':
      return 'succeeded';
    case 'FAILED':
    default:
      return 'failed';
  }
}
```

- 工具方法
  - `downloadTranscriptionResult(url: string)` 使用 `axios.get` 获取 `AliyunRawData`。
  - `getEpisodeIdByTaskId(taskId: string)` 读取数据库，沿用 `FunasrService` 的实现模式。
  - 将复用逻辑拆成私有方法，便于单元测试（例如 `buildSubmitPayload`、`ensureClient`）。

示例骨架：

```typescript
import axios, { AxiosInstance } from 'axios';
import { BaseVoiceToTextService } from './VoiceToTextService';
import { AliyunConverter } from './converters/AliyunConverter';
import { AliyunConfig } from './TranscriptConfigManager';
import {
  TranscriptService,
  SubmitTaskResponse,
  QueryTaskResponse,
  TaskStatus,
  SubmitOptions,
  AliyunSubmitResponse,
  AliyunQueryResponse,
  AliyunRawData,
} from '../../types/transcript';
import { getDatabaseManager } from '../../database/connection';
import { episodeVoiceTextTasks } from '../../database/schema';
import { eq } from 'drizzle-orm';

export class AliyunService extends BaseVoiceToTextService {
  readonly serviceName: TranscriptService = 'aliyun';

  private client: AxiosInstance;
  private config: AliyunConfig;

  constructor(config: AliyunConfig) {
    super();
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL ?? 'https://dashscope.aliyuncs.com/api/v1',
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async submit(audioUrl: string, episodeId: number, options?: SubmitOptions): Promise<SubmitTaskResponse> {
    // ...实现见上
  }

  async query(taskId: string): Promise<QueryTaskResponse> {
    // ...实现见上
  }

  protected mapStatus(status: string): TaskStatus {
    return this.mapAliyunStatus(status as AliyunQueryResponse['output']['task_status']);
  }

  // downloadTranscriptionResult, mapAliyunStatus, getEpisodeIdByTaskId 等私有方法
}
```

### 3. 实现 `AliyunConverter`

新建文件: `src/main/services/transcript/converters/AliyunConverter.ts`

- 继承 `BaseTranscriptConverter`，输入 `AliyunRawData`，输出通用的 `SentenceInfo[]`、整段文本与说话人数量。
- 处理多通道场景：遍历 `raw.transcripts`，按照 `channel_id` 与句子顺序合并结果。
- 句子转换逻辑：
  - `start` / `end` 使用毫秒值（无需转换）。
  - `timestamp` 来自 `words` 的 `[begin_time, end_time]`，若 `words` 为空则退化为整句范围。
  - `spk` 取 `speaker_id ?? channel_id ?? 0`。
- 文本提取：拼接所有 `transcripts` 的 `text`，可以使用换行符分隔。
- 说话人数：统计 `speaker_id` 最大值 + 1，若全部缺失则回退到通道数量。
- 复用 `BaseTranscriptConverter.saveTranscript`，因此 `AliyunService` 只需调用 `converter.saveTranscript(episodeId, rawData, this.serviceName)`。

示例：

```typescript
import { BaseTranscriptConverter } from '../TranscriptConverter';
import {
  AliyunRawData,
  RawTranscriptData,
  SentenceInfo,
  AliyunSentence,
} from '../../../types/transcript';

export class AliyunConverter extends BaseTranscriptConverter {
  convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[] {
    const data = raw as AliyunRawData;
    const sentences: SentenceInfo[] = [];

    for (const transcript of data.transcripts ?? []) {
      for (const sentence of transcript.sentences ?? []) {
        sentences.push({
          text: sentence.text,
          start: sentence.begin_time,
          end: sentence.end_time,
          timestamp: this.extractWordTimestamps(sentence),
          spk: sentence.speaker_id ?? transcript.channel_id ?? 0,
        });
      }
    }

    return sentences;
  }

  extractText(raw: RawTranscriptData): string {
    const data = raw as AliyunRawData;
    return (data.transcripts ?? []).map((t) => t.text).filter(Boolean).join('\n');
  }

  calculateSpeakerCount(raw: RawTranscriptData): number {
    const data = raw as AliyunRawData;
    const speakerIds = new Set<number>();

    for (const transcript of data.transcripts ?? []) {
      speakerIds.add(transcript.channel_id ?? 0);
      for (const sentence of transcript.sentences ?? []) {
        if (typeof sentence.speaker_id === 'number') {
          speakerIds.add(sentence.speaker_id);
        }
      }
    }

    return speakerIds.size || 1;
  }

  private extractWordTimestamps(sentence: AliyunSentence): number[][] {
    if (!sentence.words?.length) {
      return [[sentence.begin_time, sentence.end_time]];
    }
    return sentence.words.map((word) => [word.begin_time, word.end_time]);
  }
}
```

### 4. 服务注册与配置同步

- 更新 `src/main/services/transcript/TranscriptIPCHandlers.ts`
  - 将 `initializeServices` 改为 `async`，在构造函数中 `void this.initializeServices()`。
  - 始终注册 `FunasrService`。
  - 通过 `await this.configManager.getAliyunConfig()` 获取配置，存在 `apiKey` 时注册 `AliyunService`。
  - 若配置缺失，打印 warning，避免默认服务指向 Aliyun 时查找失败。

```typescript
private async initializeServices(): Promise<void> {
  const funasrService = new FunasrService();
  VoiceToTextFactory.register(funasrService);

  try {
    const aliyunConfig = await this.configManager.getAliyunConfig();
    if (aliyunConfig?.apiKey) {
      VoiceToTextFactory.register(new AliyunService(aliyunConfig));
      console.log('[TranscriptIPC] Aliyun service registered');
    } else {
      console.warn('[TranscriptIPC] Aliyun config missing, service not registered');
    }
  } catch (error) {
    console.error('[TranscriptIPC] Failed to initialize Aliyun service', error);
  }
}
```

- 在 `TranscriptConfigIPCHandlers.handleSetAliyunConfig` 成功后，可选地重新注册服务（先 `VoiceToTextFactory.unregister('aliyun')`，再使用最新配置注册），确保运行时配置变更立即生效。

### 5. 日志与错误处理

- 参考 `FunasrService`，使用 `console.log` / `console.error` 输出关键步骤：提交任务、查询状态、下载结果、转换与入库。
- 针对网络超时、无效响应等情况，给出可读错误信息，便于 UI 提示用户（例如 “DashScope API 返回空结果”）。

### 6. 测试策略

- **单元测试**
  - `AliyunConverter`：使用示例 JSON 验证句子转换、文本拼接、说话人数统计。
  - `AliyunService`：利用 `jest.mock('axios')` 模拟提交 / 查询 / 下载；验证数据库交互可通过 mock `getDatabaseManager()` 返回的内存实现或 spy。
- **集成测试（可选）**
  - 在 `src/__tests__` 下构建针对 `TranscriptIPCHandlers` 的集成测试，模拟注册 Aliyun 后的任务提交流程。
- **手动验证**
  - 使用真实 DashScope API Key 提交短音频，确认数据库 `episode_voice_texts`、`episode_transcripts` 数据正确，UI 可读取。

## 依赖关系

- **前置任务**：
  - Task 1.0 — `TranscriptConfigManager` 已支持阿里云配置存储。
  - Task 1.1 — 数据表 `episode_voice_text_tasks`、`episode_voice_texts`、`episode_transcripts` 已就绪。
  - Task 1.2 — `VoiceToText` 抽象与工厂已实现。

- **后续任务**：
  - Task 1.5 — 数据处理与多格式导出依赖阿里云原始数据。
  - Task 1.6 — IPC 层需要在 UI 中暴露 Aliyun 服务能力。
  - Stage 2 — AI 功能需要 Aliyun 转写结果作为输入。

## 验收标准

- [ ] `AliyunService` 可提交任务并正确更新任务状态。
- [ ] `AliyunService` 在任务完成后能够下载并保存原始转写 JSON。
- [ ] `AliyunConverter` 输出的 `SentenceInfo[]` 与文本符合约定格式。
- [ ] `episode_voice_text_tasks` / `episode_voice_texts` / `episode_transcripts` 记录正确。
- [ ] `TranscriptIPCHandlers` 在阿里云配置存在时能注册服务。
- [ ] 异常情况下返回明确错误信息，并在数据库中记录。
- [ ] 单元测试覆盖提交、查询、转换的核心分支。

## 风险与注意事项

1. **API 限流 / 费用**：DashScope 按量计费，应在 UI 明确提示，避免后台无限重试。
2. **结果过期**：`transcription_url` 为临时签名 URL，获取到后需立即下载并持久化。
3. **网络波动**：应妥善处理网络超时、DNS 失败等异常，必要时提供重试或重提交流程。
4. **配置变更**：更新 API Key 或模型后需重新实例化服务，避免旧实例继续使用失效凭证。
5. **长任务处理**：大文件转写耗时较长，轮询间隔保持与 `TranscriptIPCHandlers` 一致（当前 5s），避免触发限流。

## 实施步骤

1. 在 `src/main/types/transcript.ts` 中补全阿里云相关类型定义。
2. 新建 `AliyunConverter`，实现数据转换与入库逻辑。
3. 新建 `AliyunService`，完成提交 / 查询 / 下载 / 状态映射。
4. 更新 `TranscriptIPCHandlers`，按需注册新服务并处理配置更新。
5. 为服务与转换器编写 Jest 单元测试。
6. 通过手动或自动化方式验证端到端流程，记录示例数据。

## 估时

- 类型与接口设计：1 天
- 服务与转换器实现：2 天
- 配置与 IPC 集成：1 天
- 测试与验证：2 天
- **总计**：约 6 天
