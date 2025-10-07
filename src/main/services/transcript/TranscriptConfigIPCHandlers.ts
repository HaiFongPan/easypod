import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getTranscriptConfigManager, FunASRConfig, AliyunConfig } from './TranscriptConfigManager';
import { existsSync } from 'fs';
import axios from 'axios';

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
    ipcMain.handle('transcript:config:export', this.handleExportConfig.bind(this));
    ipcMain.handle('transcript:config:import', this.handleImportConfig.bind(this));
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
      await this.configManager.setFunASRConfig(params.config);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set FunASR config',
      };
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
      const response = await axios.get(`${config.baseURL}/models`, {
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

  private async handleExportConfig(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; config?: any; error?: string }> {
    try {
      const config = await this.configManager.export();
      return { success: true, config };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export config',
      };
    }
  }

  private async handleImportConfig(
    event: IpcMainInvokeEvent,
    params: { config: any }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.configManager.import(params.config);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import config',
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
    ipcMain.removeHandler('transcript:config:export');
    ipcMain.removeHandler('transcript:config:import');
  }
}
