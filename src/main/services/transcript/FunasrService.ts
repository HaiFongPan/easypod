import { BaseVoiceToTextService } from './VoiceToTextService';
import { FunasrConverter } from './converters/FunasrConverter';
import { createFunASRManager, FunASRManager } from '../funasr/FunASRManager';
import { getTranscriptConfigManager } from './TranscriptConfigManager';
import { getDatabaseManager } from '@/main/database/connection';
import { episodeVoiceTextTasks } from '@/main/database/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import {
  TranscriptService,
  TaskStatus,
  SubmitTaskResponse,
  QueryTaskResponse,
  SubmitOptions,
  FunasrRawData,
  FunasrSentenceInfo,
} from '@/main/types/transcript';

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
      // 1. Ensure model is initialized
      await this.ensureInitialized();

      // 2. Download audio file locally (FunASR requires local files)
      const audioPath = await this.downloadAudio(audioUrl, episodeId);

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
      // 1. Query task status
      const taskStatus = await this.manager.getTask(taskId);

      // 2. Map status
      const status = this.mapFunASRStatus(taskStatus.status);

      // 3. If task failed
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

      // 4. If task completed
      if (taskStatus.status === 'completed' && taskStatus.segments) {
        // Convert to standard format
        const rawData = this.convertSegmentsToRawData(taskStatus.segments);

        // Save raw data and converted data
        const episodeId = await this.getEpisodeIdByTaskId(taskId);
        const converter = new FunasrConverter();
        await converter.saveTranscript(episodeId, rawData, this.serviceName);

        // Update task status
        await this.updateTaskInDb(taskId, 'succeeded', rawData);

        return {
          success: true,
          taskId,
          status: 'succeeded',
          result: rawData,
          service: this.serviceName,
        };
      }

      // 5. Still processing
      return {
        success: true,
        taskId,
        status: 'processing',
        progress: taskStatus.progress ? taskStatus.progress * 100 : undefined,
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
    // FunASR service doesn't support cancellation yet
    // Mark as cancelled in database
    await this.updateTaskInDb(taskId, 'failed', { error: 'Task cancelled by user' });
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
      throw new Error('FunASR config not found. Please configure FunASR models first.');
    }

    // Initialize model
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
   * Download audio file locally
   */
  private async downloadAudio(url: string, episodeId: number): Promise<string> {
    // Preprocess URL (handle redirects)
    const finalUrl = await this.preprocessAudioUrl(url);

    // Create temp directory
    const tempDir = path.join(app.getPath('userData'), 'funasr-temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Download file
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
   * Map FunASR status to unified status
   */
  private mapFunASRStatus(status: 'queued' | 'processing' | 'completed' | 'failed'): TaskStatus {
    switch (status) {
      case 'queued':
      case 'processing':
        return 'processing';
      case 'completed':
        return 'succeeded';
      case 'failed':
        return 'failed';
      default:
        return 'failed';
    }
  }

  /**
   * Convert FunASR segments to raw data format
   */
  private convertSegmentsToRawData(segments: any[]): FunasrRawData {
    const sentences: FunasrSentenceInfo[] = segments.map((seg) => ({
      text: seg.text,
      start: seg.start_ms,
      end: seg.end_ms,
      timestamp: [[seg.start_ms, seg.end_ms]],
      spk: 0, // FunASR default single speaker
    }));

    return {
      key: 'audio',
      text: segments.map((s) => s.text).join(' '),
      timestamp: segments.map((s) => [s.start_ms, s.end_ms]),
      sentence_info: sentences,
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
