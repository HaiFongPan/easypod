# Task Stage 1.2: VoiceToText 接口抽象设计

## 任务概述

设计并实现统一的 VoiceToText 接口，抽象 FunASR 和阿里云两种转写服务的差异，提供一致的调用接口。

## 技术设计

### 接口定义

```typescript
/**
 * 任务提交响应
 */
interface SubmitTaskResponse {
  success: boolean;
  taskId?: string;
  error?: string;
  servizce: TranscriptService;
}

/**
 * 任务查询响应
 */
interface QueryTaskResponse {
  success: boolean;
  taskId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  progress?: number; // 0-100
  result?: RawTranscriptData;
  error?: string;
  service: TransczriptService;
}
z;

/**
 * 原始转写数据（服务返回的原始格式）
 */
type RawTranscriptData = FunasrRawData | AliyunRawData;

/**
 * VoiceToText 抽象接口
 */
interface VoiceToTextService {
  /**
   * 提交转写任务
   * @param audioUrl 音频文件 URL（需可公网访问）
   * @param episodeId 关联的 episode ID
   * @param options 可选配置
   */
  submit(
    audioUrl: string,
    episodeId: number,
    options?: SubmitOptions,
  ): Promise<SubmitTaskResponse>;

  /**
   * 查询任务状态
   * @param taskId 任务 ID
   */
  query(taskId: string): Promise<QueryTaskResponse>;

  /**
   * 取消任务
   * @param taskId 任务 ID
   */
  cancel?(taskId: string): Promise<boolean>;

  /**
   * 服务名称
   */
  readonly serviceName: TranscriptService;
}

/**
 * 提交选项
 */
interface SubmitOptions {
  // FunASR 配置
  modelPath?: string;
  vadModelPath?: string;
  puncModelPath?: string;
  spkModelPath?: string;

  // 阿里云配置
  model?: "paraformer-v2" | "paraformer-v1";
  languageHints?: string[]; // ['zh', 'en']
  speakerCount?: number; // 发言人数量

  // 通用配置
  disfluencyRemoval?: boolean; // 去除口语化表达
  timestampAlignment?: boolean; // 时间戳对齐
  diarizationEnabled?: boolean; // 启用说话人分离
}
```

### 数据转换器接口

```typescript
/**
 * 原始数据转换为统一格式
 */
interface TranscriptConverter {
  /**
   * 转换为统一的 sentence_info 格式
   */
  convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[];

  /**
   * 提取纯文本
   */
  extractText(raw: RawTranscriptData): string;

  /**
   * 计算发言人数量
   */
  calculateSpeakerCount(raw: RawTranscriptData): number;
}
```

## 实现细节

### 1. 基础抽象类

在 `src/main/services/transcript/VoiceToTextService.ts`:

```typescript
import { TranscriptService, TaskStatus } from "@/main/types/transcript";

export abstract class BaseVoiceToTextService implements VoiceToTextService {
  abstract readonly serviceName: TranscriptService;

  /**
   * 提交任务前的 URL 预处理
   * - 处理 302 重定向
   * - 验证 URL 可访问性
   */
  protected async preprocessAudioUrl(url: string): Promise<string> {
    const axios = require("axios");

    try {
      const response = await axios.head(url, {
        maxRedirects: 5,
        validateStatus: (status: number) => status < 400,
      });

      // 返回最终的 URL（处理重定向后）
      return response.request.res.responseUrl || url;
    } catch (error) {
      throw new Error(`Audio URL validation failed: ${error.message}`);
    }
  }

  /**
   * 将服务的状态映射到统一的 TaskStatus
   */
  protected abstract mapStatus(serviceStatus: string): TaskStatus;

  /**
   * 提交任务到数据库
   */
  protected async saveTaskToDb(
    episodeId: number,
    taskId: string,
    status: TaskStatus,
    output?: any,
  ): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db.insert(episodeVoiceTextTasks).values({
      episodeId,
      taskId,
      service: this.serviceName,
      status,
      output: output ? JSON.stringify(output) : "{}",
    });
  }

  /**
   * 更新任务状态
   */
  protected async updateTaskInDb(
    taskId: string,
    status: TaskStatus,
    output?: any,
  ): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db
      .update(episodeVoiceTextTasks)
      .set({
        status,
        output: output ? JSON.stringify(output) : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(episodeVoiceTextTasks.taskId, taskId));
  }

  abstract submit(
    audioUrl: string,
    episodeId: number,
    options?: SubmitOptions,
  ): Promise<SubmitTaskResponse>;

  abstract query(taskId: string): Promise<QueryTaskResponse>;
}
```

### 2. 服务工厂

在 `src/main/services/transcript/VoiceToTextFactory.ts`:

```typescript
export class VoiceToTextFactory {
  private static services: Map<TranscriptService, VoiceToTextService> =
    new Map();

  /**
   * 注册服务实例
   */
  static register(service: VoiceToTextService): void {
    this.services.set(service.serviceName, service);
  }

  /**
   * 获取服务实例
   */
  static getService(serviceName: TranscriptService): VoiceToTextService {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Voice to text service not found: ${serviceName}`);
    }
    return service;
  }

  /**
   * 获取所有已注册的服务
   */
  static getAllServices(): VoiceToTextService[] {
    return Array.from(this.services.values());
  }
}
```

### 3. 数据转换器基类

在 `src/main/services/transcript/TranscriptConverter.ts`:

```typescript
export abstract class BaseTranscriptConverter implements TranscriptConverter {
  abstract convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[];
  abstract extractText(raw: RawTranscriptData): string;
  abstract calculateSpeakerCount(raw: RawTranscriptData): number;

  /**
   * 保存转换后的数据到数据库
   */
  async saveTranscript(
    episodeId: number,
    raw: RawTranscriptData,
    service: TranscriptService,
  ): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    // 1. 保存原始 JSON
    await db
      .insert(episodeVoiceTexts)
      .values({
        episodeId,
        rawJson: JSON.stringify(raw),
        service,
      })
      .onConflictDoUpdate({
        target: [episodeVoiceTexts.episodeId, episodeVoiceTexts.service],
        set: {
          rawJson: JSON.stringify(raw),
          updatedAt: new Date().toISOString(),
        },
      });

    // 2. 转换并保存字幕数据
    const sentenceInfo = this.convertToSentenceInfo(raw);
    const text = this.extractText(raw);
    const speakerNumber = this.calculateSpeakerCount(raw);

    await db
      .insert(episodeTranscripts)
      .values({
        episodeId,
        subtitles: JSON.stringify(sentenceInfo),
        text,
        speakerNumber,
      })
      .onConflictDoUpdate({
        target: episodeTranscripts.episodeId,
        set: {
          subtitles: JSON.stringify(sentenceInfo),
          text,
          speakerNumber,
          updatedAt: new Date().toISOString(),
        },
      });
  }
}
```

## 依赖关系

- **前置依赖**:
  - Task 1.1: 数据库表结构完成
  - TypeScript 类型定义

- **后置依赖**:
  - Task 1.3: FunASR 服务实现
  - Task 1.4: 阿里云服务实现
  - Task 1.5: 数据处理逻辑

## 验收标准

- [ ] VoiceToTextService 接口定义完整
- [ ] BaseVoiceToTextService 抽象类实现
- [ ] VoiceToTextFactory 工厂类实现
- [ ] TranscriptConverter 接口和基类实现
- [ ] URL 预处理逻辑正确（处理 302 重定向）
- [ ] 任务状态映射逻辑清晰
- [ ] 数据库操作封装合理
- [ ] 类型定义完整，通过 type-check

## 风险和注意事项

### 风险

1. **URL 验证**: 某些音频 URL 可能需要认证或有访问限制
2. **异步任务管理**: 需要考虑任务超时、重试机制
3. **数据一致性**: 多个表的写入需要考虑事务性

### 注意事项

1. **接口扩展性**: 预留足够的扩展点，方便未来添加新服务
2. **错误处理**: 统一的错误处理和日志记录
3. **配置管理**: 不同服务的配置应该灵活可配
4. **状态映射**: 各服务的状态需要映射到统一的 TaskStatus

## 实施步骤

1. 定义 VoiceToTextService 接口
2. 实现 BaseVoiceToTextService 抽象类
3. 实现 VoiceToTextFactory 工厂类
4. 定义 TranscriptConverter 接口
5. 实现 BaseTranscriptConverter 抽象类
6. 编写单元测试
7. 集成到主进程初始化流程

## 估时

- 设计: 1 天
- 实现: 2 天
- 测试: 1 天
- **总计**: 4 天
