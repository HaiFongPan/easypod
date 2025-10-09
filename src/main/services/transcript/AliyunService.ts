import axios, { AxiosInstance } from "axios";
import { eq } from "drizzle-orm";
import {
  QueryTaskResponse,
  SubmitOptions,
  SubmitTaskResponse,
  TaskStatus,
  TranscriptService,
  AliyunSubmitResponse,
  AliyunQueryResponse,
  AliyunRawData,
} from "../../types/transcript";
import { BaseVoiceToTextService } from "./VoiceToTextService";
import { AliyunConverter } from "./converters/AliyunConverter";
import { AliyunConfig } from "./TranscriptConfigManager";
import { getDatabaseManager } from "../../database/connection";
import { episodeVoiceTextTasks } from "../../database/schema";

interface SubmitPayload {
  model: string;
  input: {
    file_urls: string[];
  };
  parameters: {
    disfluency_removal_enabled: boolean;
    timestamp_alignment_enabled: boolean;
    language_hints: string[];
    diarization_enabled: boolean;
    speaker_count: number;
  };
}

export class AliyunService extends BaseVoiceToTextService {
  readonly serviceName: TranscriptService = "aliyun";

  private readonly client: AxiosInstance;
  private readonly config: AliyunConfig;

  constructor(config: AliyunConfig) {
    super();
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL ?? "https://dashscope.aliyuncs.com/api/v1",
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  async submit(
    audioUrl: string,
    episodeId: number,
    options?: SubmitOptions,
  ): Promise<SubmitTaskResponse> {
    try {
      const finalUrl = await this.preprocessAudioUrl(audioUrl);
      const payload = this.buildSubmitPayload(finalUrl, options);

      const response = await this.client.post<AliyunSubmitResponse>(
        "/services/audio/asr/transcription",
        payload,
        {
          headers: {
            "X-DashScope-Async": "enable",
          },
        },
      );

      const { task_id, task_status } = response.data.output;
      const initialStatus = this.mapAliyunStatus(task_status);

      await this.saveTaskToDb(episodeId, task_id, initialStatus, response.data);

      return {
        success: true,
        taskId: task_id,
        service: this.serviceName,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Submit task failed";
      return {
        success: false,
        error: message,
        service: this.serviceName,
      };
    }
  }

  async query(taskId: string): Promise<QueryTaskResponse> {
    try {
      const response = await this.client.get<AliyunQueryResponse>(
        `/tasks/${taskId}`,
      );

      const { task_status, results } = response.data.output;
      const status = this.mapAliyunStatus(task_status);

      if (task_status === "FAILED") {
        await this.updateTaskInDb(taskId, "failed", response.data);
        return {
          success: false,
          taskId,
          status: "failed",
          error: "Aliyun transcription task failed",
          service: this.serviceName,
        };
      }

      if (task_status === "SUCCEEDED") {
        const successfulResult = results?.find(
          (item) => item.subtask_status === "SUCCEEDED",
        );

        if (!successfulResult) {
          await this.updateTaskInDb(taskId, "failed", response.data);
          return {
            success: false,
            taskId,
            status: "failed",
            error: "Aliyun returned success without transcription result",
            service: this.serviceName,
          };
        }

        const rawData = await this.downloadTranscriptionResult(
          successfulResult.transcription_url,
        );

        const episodeId = await this.getEpisodeIdByTaskId(taskId);
        const converter = new AliyunConverter();
        await converter.saveTranscript(episodeId, rawData, this.serviceName);

        await this.updateTaskInDb(taskId, "succeeded", response.data);

        return {
          success: true,
          taskId,
          status: "succeeded",
          result: rawData,
          service: this.serviceName,
        };
      }

      // Pending or Running
      await this.updateTaskInDb(taskId, status, response.data);
      return {
        success: true,
        taskId,
        status,
        service: this.serviceName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.updateTaskInDb(taskId, "failed", { error: message });
      } catch (updateError) {
        console.error(
          "[AliyunService] Failed to mark task as failed",
          updateError,
        );
      }

      return {
        success: false,
        taskId,
        status: "failed",
        error: message,
        service: this.serviceName,
      };
    }
  }

  protected mapStatus(serviceStatus: string): TaskStatus {
    return this.mapAliyunStatus(
      serviceStatus as AliyunQueryResponse["output"]["task_status"],
    );
  }

  private buildSubmitPayload(
    audioUrl: string,
    options?: SubmitOptions,
  ): SubmitPayload {
    const model =
      options?.model ?? this.config.model ?? "paraformer-v2";

    const languageHints =
      options?.languageHints ?? this.config.languageHints ?? ["zh", "en"];

    // Speaker recognition configuration based on spkEnable
    const diarizationEnabled = options?.spkEnable ?? false;
    const speakerCount = options?.spkEnable
      ? (options?.spkNumberPredict ?? this.config.speakerCount ?? 2)
      : 0;

    const disfluencyRemoval =
      options?.disfluencyRemoval ?? this.config.disfluencyRemoval ?? true;

    const timestampAlignment =
      options?.timestampAlignment ?? true;

    return {
      model,
      input: {
        file_urls: [audioUrl],
      },
      parameters: {
        disfluency_removal_enabled: disfluencyRemoval,
        timestamp_alignment_enabled: timestampAlignment,
        language_hints: languageHints,
        diarization_enabled: diarizationEnabled,
        speaker_count: speakerCount,
      },
    };
  }

  private mapAliyunStatus(
    status: AliyunQueryResponse["output"]["task_status"],
  ): TaskStatus {
    switch (status) {
      case "PENDING":
        return "pending";
      case "RUNNING":
        return "processing";
      case "SUCCEEDED":
        return "succeeded";
      case "FAILED":
      default:
        return "failed";
    }
  }

  private async downloadTranscriptionResult(url: string): Promise<AliyunRawData> {
    const response = await axios.get<AliyunRawData>(url, {
      timeout: 30000,
    });
    return response.data;
  }

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
