import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getTranscriptConfigManager, FunASRConfig, AliyunConfig } from './TranscriptConfigManager';
import { existsSync } from 'fs';
import axios from 'axios';
import { VoiceToTextFactory } from './VoiceToTextFactory';
import { AliyunService } from './AliyunService';
import { FunasrService } from './FunasrService';
import { getDatabaseManager } from '../../database/connection';
import { episodeVoiceTextTasks } from '../../database/schema';
import { eq, and } from 'drizzle-orm';

export class TranscriptConfigIPCHandlers {
  private configManager = getTranscriptConfigManager();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // FunASR configuration
    ipcMain.handle('transcript:config:getFunASR', this.handleGetFunASRConfig.bind(this));
    ipcMain.handle('transcript:config:setFunASR', this.handleSetFunASRConfig.bind(this));
    ipcMain.handle('transcript:config:getDefaultModels', this.handleGetDefaultModels.bind(this));
    ipcMain.handle('transcript:config:validateModelPath', this.handleValidateModelPath.bind(this));

    // Aliyun configuration
    ipcMain.handle('transcript:config:getAliyun', this.handleGetAliyunConfig.bind(this));
    ipcMain.handle('transcript:config:setAliyun', this.handleSetAliyunConfig.bind(this));
    ipcMain.handle('transcript:config:testAliyunAPI', this.handleTestAliyunAPI.bind(this));

    // General configuration
    ipcMain.handle('transcript:config:getDefaultService', this.handleGetDefaultService.bind(this));
    ipcMain.handle('transcript:config:setDefaultService', this.handleSetDefaultService.bind(this));
  }

  private async handleGetFunASRConfig(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; config?: FunASRConfig; error?: string }> {
    try {
      const config = await this.configManager.getFunASRConfig();
      return { success: true, config: config || undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get FunASR config',
      };
    }
  }

  private async handleSetFunASRConfig(
    event: IpcMainInvokeEvent,
    params: { config: Partial<FunASRConfig> }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 保存配置到数据库
      await this.configManager.setFunASRConfig(params.config);

      // 2. 检查 FunASR 服务状态
      const funasrService = VoiceToTextFactory.getService('funasr') as FunasrService | undefined;
      if (!funasrService) {
        // 服务未初始化,下次转写时自动加载新配置
        return { success: true };
      }

      // 3. 检查是否有活跃转写任务
      const hasActiveTasks = await this.checkActiveFunASRTasks();
      if (hasActiveTasks) {
        return {
          success: false,
          error: '有转写任务正在进行，请等待任务完成后再修改配置',
        };
      }

      // 4. 重新初始化模型
      console.log('[TranscriptConfigIPCHandlers] Reinitializing FunASR model with new config');
      await funasrService.reinitializeModel();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set FunASR config',
      };
    }
  }

  /**
   * 检查是否有活跃的 FunASR 转写任务
   */
  private async checkActiveFunASRTasks(): Promise<boolean> {
    try {
      const db = getDatabaseManager().getDrizzle();
      const tasks = await db
        .select()
        .from(episodeVoiceTextTasks)
        .where(
          and(
            eq(episodeVoiceTextTasks.service, 'funasr'),
            eq(episodeVoiceTextTasks.status, 'processing')
          )
        )
        .limit(1);

      return tasks.length > 0;
    } catch (error) {
      console.error('[TranscriptConfigIPCHandlers] Failed to check active tasks:', error);
      return false; // 查询失败时允许重载,避免阻塞
    }
  }

  private async handleGetDefaultModels(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; models?: any; error?: string }> {
    try {
      const models = this.configManager.getDefaultFunASRModels();
      return { success: true, models };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get default models',
      };
    }
  }

  private async handleValidateModelPath(
    event: IpcMainInvokeEvent,
    params: { path: string }
  ): Promise<{ success: boolean; exists?: boolean; error?: string }> {
    try {
      const exists = existsSync(params.path);
      return { success: true, exists };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate model path',
      };
    }
  }

  private async handleGetAliyunConfig(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; config?: AliyunConfig; error?: string }> {
    try {
      const config = await this.configManager.getAliyunConfig();
      return { success: true, config: config || undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Aliyun config',
      };
    }
  }

  private async handleSetAliyunConfig(
    event: IpcMainInvokeEvent,
    params: { config: Partial<AliyunConfig> }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.configManager.setAliyunConfig(params.config);
      const updatedConfig = await this.configManager.getAliyunConfig();

      if (updatedConfig?.apiKey) {
        if (VoiceToTextFactory.hasService('aliyun')) {
          VoiceToTextFactory.unregister('aliyun');
        }
        VoiceToTextFactory.register(new AliyunService(updatedConfig));
        console.log('[TranscriptConfig] Aliyun service re-registered with new config');
      } else if (VoiceToTextFactory.hasService('aliyun')) {
        VoiceToTextFactory.unregister('aliyun');
        console.warn('[TranscriptConfig] Aliyun config cleared, service unregistered');
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set Aliyun config',
      };
    }
  }

  private async handleTestAliyunAPI(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const config = await this.configManager.getAliyunConfig();
      if (!config) {
        return { success: false, error: 'Aliyun config not found' };
      }

      // Simple API connectivity test
      const baseURL = config.baseURL || 'https://dashscope.aliyuncs.com/api/v1';
      const response = await axios.get(`${baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
        timeout: 5000,
      });

      if (response.status === 200) {
        return { success: true, message: 'API connection successful' };
      }

      return { success: false, error: `Unexpected status: ${response.status}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API test failed',
      };
    }
  }

  private async handleGetDefaultService(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; service?: 'funasr' | 'aliyun'; error?: string }> {
    try {
      const service = await this.configManager.getDefaultService();
      return { success: true, service };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get default service',
      };
    }
  }

  private async handleSetDefaultService(
    event: IpcMainInvokeEvent,
    params: { service: 'funasr' | 'aliyun' }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.configManager.setDefaultService(params.service);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set default service',
      };
    }
  }

  destroy(): void {
    ipcMain.removeHandler('transcript:config:getFunASR');
    ipcMain.removeHandler('transcript:config:setFunASR');
    ipcMain.removeHandler('transcript:config:getDefaultModels');
    ipcMain.removeHandler('transcript:config:validateModelPath');
    ipcMain.removeHandler('transcript:config:getAliyun');
    ipcMain.removeHandler('transcript:config:setAliyun');
    ipcMain.removeHandler('transcript:config:testAliyunAPI');
    ipcMain.removeHandler('transcript:config:getDefaultService');
    ipcMain.removeHandler('transcript:config:setDefaultService');
  }
}
