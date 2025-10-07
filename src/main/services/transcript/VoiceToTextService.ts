import axios from 'axios';
import { getDatabaseManager } from '@/main/database/connection';
import { episodeVoiceTextTasks } from '@/main/database/schema';
import { eq } from 'drizzle-orm';
import {
  TranscriptService,
  TaskStatus,
  SubmitTaskResponse,
  QueryTaskResponse,
  SubmitOptions,
} from '@/main/types/transcript';

/**
 * VoiceToText service interface
 */
export interface VoiceToTextService {
  /**
   * Submit transcription task
   * @param audioUrl Audio file URL (must be publicly accessible)
   * @param episodeId Associated episode ID
   * @param options Optional configuration
   */
  submit(
    audioUrl: string,
    episodeId: number,
    options?: SubmitOptions
  ): Promise<SubmitTaskResponse>;

  /**
   * Query task status
   * @param taskId Task ID
   */
  query(taskId: string): Promise<QueryTaskResponse>;

  /**
   * Cancel task (optional)
   * @param taskId Task ID
   */
  cancel?(taskId: string): Promise<boolean>;

  /**
   * Service name
   */
  readonly serviceName: TranscriptService;
}

/**
 * Base implementation of VoiceToTextService
 */
export abstract class BaseVoiceToTextService implements VoiceToTextService {
  abstract readonly serviceName: TranscriptService;

  /**
   * Preprocess audio URL
   * - Handle 302 redirects
   * - Validate URL accessibility
   */
  protected async preprocessAudioUrl(url: string): Promise<string> {
    try {
      const response = await axios.head(url, {
        maxRedirects: 5,
        validateStatus: (status: number) => status < 400,
      });

      // Return final URL (after handling redirects)
      return response.request.res.responseUrl || url;
    } catch (error) {
      throw new Error(`Audio URL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map service-specific status to unified TaskStatus
   */
  protected abstract mapStatus(serviceStatus: string): TaskStatus;

  /**
   * Save task to database
   */
  protected async saveTaskToDb(
    episodeId: number,
    taskId: string,
    status: TaskStatus,
    output?: any
  ): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db.insert(episodeVoiceTextTasks).values({
      episodeId,
      taskId,
      service: this.serviceName,
      status,
      output: output ? JSON.stringify(output) : '{}',
    });
  }

  /**
   * Update task status in database
   */
  protected async updateTaskInDb(
    taskId: string,
    status: TaskStatus,
    output?: any
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
    options?: SubmitOptions
  ): Promise<SubmitTaskResponse>;

  abstract query(taskId: string): Promise<QueryTaskResponse>;
}
