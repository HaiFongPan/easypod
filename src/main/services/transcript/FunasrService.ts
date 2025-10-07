import { BaseVoiceToTextService } from "./VoiceToTextService";
import { FunasrConverter } from "./converters/FunasrConverter";
import { createFunASRManager, FunASRManager } from "../funasr/FunASRManager";
import { getTranscriptConfigManager } from "./TranscriptConfigManager";
import { getDatabaseManager } from "../../database/connection";
import { episodeVoiceTextTasks } from "../../database/schema";
import { eq } from "drizzle-orm";
import {
  TranscriptService,
  TaskStatus,
  SubmitTaskResponse,
  QueryTaskResponse,
  SubmitOptions,
  FunasrRawData,
  FunasrSentenceInfo,
} from "../../types/transcript";

export class FunasrService extends BaseVoiceToTextService {
  readonly serviceName: TranscriptService = "funasr";

  private manager: FunASRManager;
  private initialized = false;

  constructor() {
    super();
    this.manager = createFunASRManager();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.manager.on("log", (entry) => {
      console.log(`[FunASR] ${entry.stream}: ${entry.line}`);
    });

    this.manager.on("error", (error) => {
      console.error("[FunASR] Error:", error);
    });

    this.manager.on("exit", ({ code, signal }) => {
      console.warn(
        `[FunASR] Service exited with code ${code}, signal ${signal}`,
      );
      this.initialized = false;
    });
  }

  async submit(
    audioUrl: string,
    episodeId: number,
    options?: SubmitOptions,
  ): Promise<SubmitTaskResponse> {
    try {
      // 1. Ensure model is initialized
      await this.ensureInitialized();

      // 2. get final audio url
      const audioPath = await this.preprocessAudioUrl(audioUrl);

      // 3. Submit transcription task
      const result = await this.manager.transcribe({
        audio_path: audioPath,
        options: {
          batch_size_s: options?.batchSizeS || 300,
          sentence_timestamp: true,
          word_timestamp: options?.wordTimestamp || false,
          merge_vad: true,
        },
      });

      // 4. Save task info to database
      await this.saveTaskToDb(episodeId, result.task_id, "processing");

      return {
        success: true,
        taskId: result.task_id,
        service: this.serviceName,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Submit task failed",
        service: this.serviceName,
      };
    }
  }

  async query(taskId: string): Promise<QueryTaskResponse> {
    try {
      // 1. Query task status
      const taskStatus = await this.manager.getTask(taskId);

      // 2. Map status
      // const status = this.mapFunASRStatus(taskStatus.status);

      // 3. If task failed
      if (taskStatus.status === "failed") {
        await this.updateTaskInDb(taskId, "failed", {
          error: taskStatus.error,
        });

        return {
          success: false,
          taskId,
          status: "failed",
          error: taskStatus.error || "Transcription failed",
          service: this.serviceName,
        };
      }

      // 4. If task completed
      if (taskStatus.status === "completed") {
        const extracted = this.extractRawData(taskStatus);

        if (!extracted) {
          console.warn(
            "[FunasrService] Completed task without usable result payload",
            {
              taskId,
              serviceStatus: taskStatus,
            },
          );
          await this.updateTaskInDb(taskId, "failed", {
            error: "FunASR task completed without result payload",
          });
          return {
            success: false,
            taskId,
            status: "failed",
            error: "Transcription result missing",
            service: this.serviceName,
          };
        }

        // Save raw data and converted data
        const episodeId = await this.getEpisodeIdByTaskId(taskId);
        const converter = new FunasrConverter();
        await converter.saveTranscript(
          episodeId,
          extracted.rawData,
          this.serviceName,
        );

        // Update task status with raw payload for inspection/debugging
        console.info("[FunasrService] Completed task, start updateTaskIndb");

        await this.updateTaskInDb(
          taskId,
          "succeeded",
          extracted.originalPayload,
        );

        console.info("[FunasrService] Completed task, return succeeded");
        return {
          success: true,
          taskId,
          status: "succeeded",
          result: extracted.rawData,
          service: this.serviceName,
        };
      }

      // 5. Still processing
      return {
        success: true,
        taskId,
        status: "processing",
        progress: taskStatus.progress ? taskStatus.progress * 100 : undefined,
        service: this.serviceName,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Query task failed";

      try {
        await this.updateTaskInDb(taskId, "failed", { error: errorMessage });
      } catch (updateError) {
        console.error(
          "[FunasrService] Failed to mark task as failed after query error",
          {
            taskId,
            error: updateError instanceof Error ? updateError.message : updateError,
          },
        );
      }

      return {
        success: false,
        taskId,
        status: "failed",
        error: errorMessage,
        service: this.serviceName,
      };
    }
  }

  async cancel(taskId: string): Promise<boolean> {
    // FunASR service doesn't support cancellation yet
    // Mark as cancelled in database
    await this.updateTaskInDb(taskId, "failed", {
      error: "Task cancelled by user",
    });
    return true;
  }

  protected mapStatus(serviceStatus: string): TaskStatus {
    return this.mapFunASRStatus(serviceStatus as any);
  }

  /**
   * Ensure model is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get configuration
    const configManager = getTranscriptConfigManager();
    const config = await configManager.getFunASRConfig();

    if (!config) {
      throw new Error(
        "FunASR config not found. Please configure FunASR models first.",
      );
    }

    // Initialize model
    await this.manager.initializeModel({
      asr_model: config.model,
      device: config.device || "cpu",
      options: {
        vad_model: config.vadModel,
        punc_model: config.puncModel,
        max_single_segment_time: config.maxSingleSegmentTime || 60000,
      },
    });

    this.initialized = true;
  }

  /**
   * Map FunASR status to unified status
   */
  private mapFunASRStatus(
    status: "queued" | "processing" | "completed" | "failed",
  ): TaskStatus {
    switch (status) {
      case "queued":
      case "processing":
        return "processing";
      case "completed":
        return "succeeded";
      case "failed":
        return "failed";
      default:
        return "failed";
    }
  }

  private extractRawData(
    taskStatus: Awaited<ReturnType<FunASRManager["getTask"]>>,
  ): { rawData: FunasrRawData; originalPayload: unknown } | null {
    if (taskStatus.result && typeof taskStatus.result === "object") {
      const normalized = this.normalizeRawResult(
        taskStatus.result as Record<string, unknown>,
      );
      return {
        rawData: normalized,
        originalPayload: taskStatus.result,
      };
    }

    if (Array.isArray(taskStatus.segments) && taskStatus.segments.length > 0) {
      const rawData = this.convertSegmentsToRawData(taskStatus.segments);
      return {
        rawData,
        originalPayload: { segments: taskStatus.segments },
      };
    }

    return null;
  }

  /**
   * Normalize raw result emitted by the Python FunASR service into the
   * FunasrRawData structure used across the app.
   */
  private normalizeRawResult(raw: Record<string, unknown>): FunasrRawData {
    const rawAny = raw as Record<string, unknown> & { [key: string]: unknown };
    const text =
      typeof rawAny?.text === "string" ? (rawAny.text as string) : "";
    const key =
      typeof rawAny?.key === "string" ? (rawAny.key as string) : "audio";

    const normalizeTimestamp = (value: unknown): number => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return 0;
      }
      return Math.round(value);
    };

    const timestampSource = rawAny?.timestamp as unknown;
    const timestamp: number[][] = Array.isArray(timestampSource)
      ? timestampSource
          .map((pair) =>
            Array.isArray(pair)
              ? (pair
                  .map((value) => normalizeTimestamp(value))
                  .slice(0, 2) as number[])
              : null,
          )
          .filter(
            (pair): pair is number[] =>
              Array.isArray(pair) && pair.length === 2,
          )
      : [];

    const sentenceInfoSource = rawAny?.sentence_info as unknown;
    const sentence_info: FunasrSentenceInfo[] = Array.isArray(
      sentenceInfoSource,
    )
      ? sentenceInfoSource
          .map((item) => {
            if (typeof item !== "object" || item === null) {
              return null;
            }
            const textValue =
              typeof (item as any).text === "string" ? (item as any).text : "";
            const startValue = normalizeTimestamp((item as any).start);
            const endValue = normalizeTimestamp((item as any).end);
            const rawTimestamps = (item as any).timestamp;
            const timestamps: number[][] = Array.isArray(rawTimestamps)
              ? rawTimestamps
                  .map((pair: unknown) =>
                    Array.isArray(pair)
                      ? (pair as number[])
                          .map((value) => normalizeTimestamp(value))
                          .slice(0, 2)
                      : null,
                  )
                  .filter(
                    (pair: number[] | null): pair is number[] =>
                      Array.isArray(pair) && pair.length === 2,
                  )
              : [[startValue, endValue]];

            return {
              text: textValue,
              start: startValue,
              end: endValue,
              timestamp: timestamps,
              spk:
                typeof (item as any).spk === "number" ? (item as any).spk : 0,
            } as FunasrSentenceInfo;
          })
          .filter((value): value is FunasrSentenceInfo => value !== null)
      : [];

    if (!sentence_info.length && text) {
      sentence_info.push({
        text,
        start: timestamp[0]?.[0] ?? 0,
        end: timestamp[timestamp.length - 1]?.[1] ?? 0,
        timestamp: timestamp.length
          ? timestamp
          : [[0, Math.max(text.length * 200, 1000)]],
        spk: 0,
      });
    }

    return {
      key,
      text,
      timestamp,
      sentence_info,
    };
  }

  private convertSegmentsToRawData(
    segments: Array<{
      text: string;
      start_ms: number;
      end_ms: number;
      speaker?: string;
    }>,
  ): FunasrRawData {
    const sentence_info: FunasrSentenceInfo[] = segments.map((segment) => ({
      text: segment.text,
      start: segment.start_ms,
      end: segment.end_ms,
      timestamp: [[segment.start_ms, segment.end_ms]],
      spk: segment.speaker ? Number(segment.speaker) || 0 : 0,
    }));

    return {
      key: "audio",
      text: segments.map((segment) => segment.text).join(" "),
      timestamp: segments.map((segment) => [segment.start_ms, segment.end_ms]),
      sentence_info,
    };
  }

  /**
   * Get episodeId by taskId
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
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    await this.manager.shutdown();
  }
}
