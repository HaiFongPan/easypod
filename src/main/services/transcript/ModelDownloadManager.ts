import axios, { AxiosInstance } from 'axios';
import { TranscriptSettingsDao } from '../../database/dao/transcriptSettingsDao';
import { getFunASRManager } from '../funasr/FunASRManager';

export interface ModelDownloadState {
  modelId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  downloadedSize: number;
  totalSize: number;
  downloadPath?: string;
  errorMessage?: string;
  lastUpdated?: string;
}

export interface DownloadProgressEvent {
  modelId: string;
  status: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
  downloadPath?: string;
  error?: string;
}

/**
 * Manages FunASR model downloads through the Python FastAPI service
 */
export class ModelDownloadManager {
  private dao: TranscriptSettingsDao;
  private httpClient: AxiosInstance;
  private baseURL: string;
  private sseConnections: Map<string, EventSource> = new Map();
  private serviceStartAttempted: boolean = false;

  constructor(funasrServerHost: string = '127.0.0.1', funasrServerPort: number = 17953) {
    this.dao = new TranscriptSettingsDao();
    this.baseURL = `http://${funasrServerHost}:${funasrServerPort}`;
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });
  }

  /**
   * Get the download status of a specific model
   */
  async getModelStatus(modelId: string): Promise<ModelDownloadState> {
    // Try to get real-time status from Python service first
    try {
      const response = await this.httpClient.get('/download-status', {
        params: { model_id: modelId },
        timeout: 3000,
      });

      if (response.data) {
        const apiState: ModelDownloadState = {
          modelId: response.data.model_id,
          status: response.data.status,
          progress: response.data.progress || 0,
          downloadedSize: response.data.downloaded_size || 0,
          totalSize: response.data.total_size || 0,
          downloadPath: response.data.download_path,
          errorMessage: response.data.error,
          lastUpdated: new Date().toISOString(),
        };

        console.log(
          `[ModelDownloadManager] Got status for ${modelId}: ${apiState.status} - ${apiState.progress.toFixed(1)}% ` +
            `(${apiState.downloadedSize}/${apiState.totalSize} bytes)`
        );

        // Save to database for persistence
        await this.saveModelState(apiState);

        return apiState;
      }
    } catch (error) {
      // Service not available, fall back to database
      console.debug(
        `[ModelDownloadManager] Service unavailable for ${modelId}:`,
        error instanceof Error ? error.message : error
      );
    }

    // Fall back to database (source of truth when service is down)
    const allStates = await this.dao.getConfig<Record<string, ModelDownloadState>>('funasr');
    if (allStates && allStates[modelId]) {
      console.log(`[ModelDownloadManager] Using cached state for ${modelId}: ${allStates[modelId].status}`);
      return allStates[modelId];
    }

    // If not in DB and service unavailable, return default pending state
    console.log(`[ModelDownloadManager] No state found for ${modelId}, returning pending`);
    return {
      modelId,
      status: 'pending',
      progress: 0,
      downloadedSize: 0,
      totalSize: 0,
    };
  }

  /**
   * Get download status for all models
   */
  async getAllModelStatus(modelIds: string[]): Promise<Record<string, ModelDownloadState>> {
    const results: Record<string, ModelDownloadState> = {};

    await Promise.all(
      modelIds.map(async (modelId) => {
        results[modelId] = await this.getModelStatus(modelId);
      })
    );

    return results;
  }

  /**
   * Ensure FunASR service is started (auto-start if not running)
   */
  private async ensureServiceStarted(): Promise<void> {
    if (this.serviceStartAttempted) {
      return; // Already attempted, don't retry in the same session
    }

    const isHealthy = await this.checkServiceHealth();
    if (isHealthy) {
      this.serviceStartAttempted = true;
      return; // Service is already running
    }

    // Try to start the service
    console.log('[ModelDownloadManager] FunASR service not running, attempting to start...');
    try {
      const funasrManager = getFunASRManager();
      await funasrManager.ensureReady();
      this.serviceStartAttempted = true;
      console.log('[ModelDownloadManager] FunASR service started successfully');
    } catch (error) {
      console.error('[ModelDownloadManager] Failed to start FunASR service:', error);
      this.serviceStartAttempted = true; // Mark as attempted even if failed
      throw error;
    }
  }

  /**
   * Start downloading a model
   */
  async downloadModel(modelId: string, cacheDir?: string): Promise<{ success: boolean; error?: string }> {
    // Try to ensure service is started
    try {
      await this.ensureServiceStarted();
    } catch (error) {
      return {
        success: false,
        error: 'FunASR 服务无法启动，请确保 Python Runtime 已就绪',
      };
    }

    // Check service health again after start attempt
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      return {
        success: false,
        error: 'FunASR 服务未启动或无法连接，请确保 Python Runtime 已就绪',
      };
    }

    try {
      const response = await this.httpClient.post('/download-model', {
        model_id: modelId,
        cache_dir: cacheDir,
      });

      if (response.data.success) {
        // Initialize state in database
        await this.saveModelState({
          modelId,
          status: 'downloading',
          progress: 0,
          downloadedSize: 0,
          totalSize: 0,
          lastUpdated: new Date().toISOString(),
        });

        return { success: true };
      } else {
        return { success: false, error: response.data.error || 'Unknown error' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start download';
      console.error(`[ModelDownloadManager] Download failed for ${modelId}:`, error);
      return { success: false, error: `下载启动失败: ${message}` };
    }
  }

  /**
   * Cancel an ongoing model download
   */
  async cancelDownload(modelId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.httpClient.delete(`/download-model/${encodeURIComponent(modelId)}`);

      if (response.data.success) {
        // Update state in database
        await this.saveModelState({
          modelId,
          status: 'failed',
          progress: 0,
          downloadedSize: 0,
          totalSize: 0,
          errorMessage: 'Download cancelled by user',
          lastUpdated: new Date().toISOString(),
        });

        // Close SSE connection if exists
        this.closeSseConnection(modelId);

        return { success: true };
      } else {
        return { success: false, error: response.data.error || 'Failed to cancel' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel download';
      return { success: false, error: message };
    }
  }

  /**
   * Subscribe to download progress updates via SSE
   * Note: This uses EventSource which is browser API, needs Node.js alternative
   */
  async subscribeProgress(
    modelId: string,
    onProgress: (event: DownloadProgressEvent) => void
  ): Promise<() => void> {
    // For Node.js environment, we'll use polling instead of SSE
    // SSE is handled in renderer process via fetch API

    const pollInterval = setInterval(async () => {
      try {
        const state = await this.getModelStatus(modelId);

        onProgress({
          modelId: state.modelId,
          status: state.status,
          progress: state.progress,
          downloadedSize: state.downloadedSize,
          totalSize: state.totalSize,
          downloadPath: state.downloadPath,
          error: state.errorMessage,
        });

        // Stop polling if completed or failed
        if (state.status === 'completed' || state.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error(`[ModelDownloadManager] Polling error for ${modelId}:`, error);
      }
    }, 1000); // Poll every second

    // Return cleanup function
    return () => {
      clearInterval(pollInterval);
    };
  }

  /**
   * Save model state to database
   */
  private async saveModelState(state: ModelDownloadState): Promise<void> {
    // Get all existing model states
    const allStates = (await this.dao.getConfig<Record<string, ModelDownloadState>>('funasr')) || {};

    // Update the specific model state
    allStates[state.modelId] = {
      ...state,
      lastUpdated: new Date().toISOString(),
    };

    // Save back to database
    await this.dao.setConfig('funasr', allStates);
  }

  /**
   * Close SSE connection for a model
   */
  private closeSseConnection(modelId: string): void {
    const connection = this.sseConnections.get(modelId);
    if (connection) {
      connection.close();
      this.sseConnections.delete(modelId);
    }
  }

  /**
   * Cleanup all SSE connections
   */
  destroy(): void {
    this.sseConnections.forEach((connection) => connection.close());
    this.sseConnections.clear();
  }

  /**
   * Check if Python FunASR service is reachable
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health', { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let instance: ModelDownloadManager | null = null;

export function getModelDownloadManager(
  host: string = '127.0.0.1',
  port: number = 17953
): ModelDownloadManager {
  if (!instance) {
    instance = new ModelDownloadManager(host, port);
  }
  return instance;
}
