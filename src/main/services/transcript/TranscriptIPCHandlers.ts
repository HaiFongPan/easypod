import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { VoiceToTextFactory } from './VoiceToTextFactory';
import { FunasrService } from './FunasrService';
import { AliyunService } from './AliyunService';
import { getTranscriptConfigManager } from './TranscriptConfigManager';
import { getDatabaseManager } from '../../database/connection';
import { episodeVoiceTextTasks, episodes } from '../../database/schema';
import { eq, and, or, inArray, desc } from 'drizzle-orm';
import {
  TranscriptService,
  SubmitTaskResponse,
  QueryTaskResponse,
  TaskStatus,
} from '../../types/transcript';
import { EpisodeVoiceTextTasksDao } from '../../database/dao/episodeVoiceTextTasksDao';

export class TranscriptIPCHandlers {
  private configManager = getTranscriptConfigManager();
  private pollInterval: NodeJS.Timeout | null = null;
  private pollingInFlight = false;
  private tasksDao = new EpisodeVoiceTextTasksDao();

  constructor() {
    this.registerHandlers();
    void this.initializeServices();
    this.startTaskPolling();
  }

  private async initializeServices(): Promise<void> {
    // Register FunASR service
    const funasrService = new FunasrService();
    VoiceToTextFactory.register(funasrService);
    console.log('[TranscriptIPC] FunASR service registered');

    try {
      const aliyunConfig = await this.configManager.getAliyunConfig();
      if (aliyunConfig?.apiKey) {
        const aliyunService = new AliyunService(aliyunConfig);
        VoiceToTextFactory.register(aliyunService);
        console.log('[TranscriptIPC] Aliyun service registered');
      } else {
        console.warn('[TranscriptIPC] Aliyun config missing, service not registered');
      }
    } catch (error) {
      console.error('[TranscriptIPC] Failed to initialize Aliyun service', error);
    }
  }

  private registerHandlers(): void {
    ipcMain.handle('transcript:submit', this.handleSubmitTask.bind(this));
    ipcMain.handle('transcript:query', this.handleQueryTask.bind(this));
    ipcMain.handle('transcript:getTaskStatus', this.handleGetTaskStatus.bind(this));
    ipcMain.handle('transcript:getTasksList', this.handleGetTasksList.bind(this));
    ipcMain.handle('transcript:deleteTask', this.handleDeleteTask.bind(this));
    ipcMain.handle('transcript:retryTask', this.handleRetryTask.bind(this));
  }

  /**
   * Submit transcription task
   */
  private async handleSubmitTask(
    event: IpcMainInvokeEvent,
    params: { episodeId: number; options?: { spkEnable?: boolean; spkNumberPredict?: number } }
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const startTime = Date.now();
    console.log('[TranscriptIPC] Submit task started:', {
      episodeId: params.episodeId,
      timestamp: new Date().toISOString(),
    });

    try {
      // 1. Get episode info
      const db = getDatabaseManager().getDrizzle();
      const episodeResult = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, params.episodeId))
        .limit(1);

      if (!episodeResult[0]) {
        const error = 'Episode not found';
        console.error('[TranscriptIPC] Submit task failed:', {
          episodeId: params.episodeId,
          error,
          duration: Date.now() - startTime,
        });
        return { success: false, error };
      }

      const episode = episodeResult[0];
      console.log('[TranscriptIPC] Episode found:', {
        episodeId: episode.id,
        title: episode.title,
        audioUrl: episode.audioUrl,
      });

      // 2. Check if task already exists
      const existingTasks = await db
        .select()
        .from(episodeVoiceTextTasks)
        .where(
          and(
            eq(episodeVoiceTextTasks.episodeId, params.episodeId),
            or(
              eq(episodeVoiceTextTasks.status, 'pending'),
              eq(episodeVoiceTextTasks.status, 'processing'),
              eq(episodeVoiceTextTasks.status, 'succeeded')
            )
          )
        );

      if (existingTasks.length > 0) {
        const error = 'Task already exists';
        console.warn('[TranscriptIPC] Submit task skipped:', {
          episodeId: params.episodeId,
          existingTasks: existingTasks.map((t: typeof episodeVoiceTextTasks.$inferSelect) => ({
            id: t.id,
            taskId: t.taskId,
            status: t.status,
            service: t.service,
          })),
          duration: Date.now() - startTime,
        });
        return { success: false, error };
      }

      // 3. Get default service
      const defaultService = await this.configManager.getDefaultService();
      console.log('[TranscriptIPC] Using transcription service:', {
        service: defaultService,
      });

      // 4. Get service instance
      let service;
      try {
        service = VoiceToTextFactory.getService(defaultService);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Service not available';
        console.error('[TranscriptIPC] Service not found:', {
          service: defaultService,
          error: errorMessage,
          duration: Date.now() - startTime,
        });
        return { success: false, error: errorMessage };
      }

      // 5. Submit task
      console.log('[TranscriptIPC] Submitting transcription task:', {
        episodeId: episode.id,
        audioUrl: episode.audioUrl,
        service: defaultService,
        options: params.options,
      });

      const result = await service.submit(episode.audioUrl, episode.id, params.options);

      const duration = Date.now() - startTime;
      if (result.success) {
        console.log('[TranscriptIPC] Submit task succeeded:', {
          episodeId: episode.id,
          taskId: result.taskId,
          service: result.service,
          duration,
        });
        this.triggerTaskPolling();
      } else {
        console.error('[TranscriptIPC] Submit task failed:', {
          episodeId: episode.id,
          error: result.error,
          service: result.service,
          duration,
        });
      }

      return {
        success: result.success,
        taskId: result.taskId,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptIPC] Submit task exception:', {
        episodeId: params.episodeId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private startTaskPolling(): void {
    if (this.pollInterval) {
      return;
    }

    const poll = async () => {
      try {
        await this.pollActiveTasks();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[TranscriptIPC] Task polling failed:', { error: message });
      }
    };

    this.pollInterval = setInterval(poll, 5000);
    void poll();
  }

  private triggerTaskPolling(): void {
    this.startTaskPolling();
    void this.pollActiveTasks();
  }

  private async pollActiveTasks(): Promise<void> {
    if (this.pollingInFlight) {
      return;
    }
    this.pollingInFlight = true;

    try {
      const db = getDatabaseManager().getDrizzle();
      const ACTIVE_STATUSES: TaskStatus[] = ['pending', 'processing'];
      const tasks = await db
        .select()
        .from(episodeVoiceTextTasks)
        .where(inArray(episodeVoiceTextTasks.status, ACTIVE_STATUSES))
        .limit(20);

      if (tasks.length === 0) {
        return;
      }

      for (const task of tasks) {
        try {
          const service = VoiceToTextFactory.getService(task.service);
          await service.query(task.taskId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[TranscriptIPC] Poll task query failed:', {
            taskId: task.taskId,
            service: task.service,
            error: message,
          });
        }
      }
    } finally {
      this.pollingInFlight = false;
    }
  }

  /**
   * Query task status
   */
  private async handleQueryTask(
    event: IpcMainInvokeEvent,
    params: { taskId: string; service: TranscriptService }
  ): Promise<QueryTaskResponse> {
    const startTime = Date.now();
    console.log('[TranscriptIPC] Query task started:', {
      taskId: params.taskId,
      service: params.service,
      timestamp: new Date().toISOString(),
    });

    try {
      const service = VoiceToTextFactory.getService(params.service);
      const result = await service.query(params.taskId);

      console.log('[TranscriptIPC] Query task result:', {
        taskId: params.taskId,
        status: result.status,
        progress: result.progress,
        hasResult: !!result.result,
        error: result.error,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptIPC] Query task exception:', {
        taskId: params.taskId,
        service: params.service,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });
      return {
        success: false,
        taskId: params.taskId,
        status: 'failed',
        error: errorMessage,
        service: params.service,
      };
    }
  }

  /**
   * Get task status from database
   */
  private async handleGetTaskStatus(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{
    success: boolean;
    hasTask?: boolean;
    status?: TaskStatus;
    taskId?: string;
    service?: TranscriptService;
    error?: string;
  }> {
    try {
      const db = getDatabaseManager().getDrizzle();
      const tasks = await db
        .select()
        .from(episodeVoiceTextTasks)
        .where(eq(episodeVoiceTextTasks.episodeId, params.episodeId))
        .orderBy(desc(episodeVoiceTextTasks.updatedAt))
        .limit(1);

      if (tasks.length === 0) {
        return {
          success: true,
          hasTask: false,
        };
      }

      const task = tasks[0];
      return {
        success: true,
        hasTask: true,
        status: task.status,
        taskId: task.taskId,
        service: task.service,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptIPC] Get task status exception:', {
        episodeId: params.episodeId,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get tasks list with pagination
   */
  private async handleGetTasksList(
    event: IpcMainInvokeEvent,
    params: { page: number; pageSize: number; nameFilter?: string }
  ): Promise<{
    success: boolean;
    tasks?: any[];
    total?: number;
    error?: string;
  }> {
    try {
      const { tasks, total } = await this.tasksDao.findAllWithPagination(
        params.page,
        params.pageSize,
        params.nameFilter
      );

      return {
        success: true,
        tasks,
        total,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptIPC] Get tasks list exception:', {
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete transcript task and related data
   */
  private async handleDeleteTask(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.tasksDao.deleteTasksByEpisodeId(params.episodeId);
      console.log('[TranscriptIPC] Deleted task for episode:', params.episodeId);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptIPC] Delete task exception:', {
        episodeId: params.episodeId,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Retry failed transcription task
   */
  private async handleRetryTask(
    event: IpcMainInvokeEvent,
    params: { episodeId: number }
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      // 1. Check existing task status
      const existingTask = await this.tasksDao.findByEpisodeId(params.episodeId);

      if (!existingTask) {
        return { success: false, error: 'Task not found' };
      }

      if (existingTask.status !== 'failed') {
        return { success: false, error: 'Only failed tasks can be retried' };
      }

      // 2. Delete existing failed task data
      await this.tasksDao.deleteTasksByEpisodeId(params.episodeId);
      console.log('[TranscriptIPC] Deleted failed task before retry:', params.episodeId);

      // 3. Submit new task using existing submit handler
      return await this.handleSubmitTask(event, params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptIPC] Retry task exception:', {
        episodeId: params.episodeId,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  destroy(): void {
    ipcMain.removeHandler('transcript:submit');
    ipcMain.removeHandler('transcript:query');
    ipcMain.removeHandler('transcript:getTaskStatus');
    ipcMain.removeHandler('transcript:getTasksList');
    ipcMain.removeHandler('transcript:deleteTask');
    ipcMain.removeHandler('transcript:retryTask');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
