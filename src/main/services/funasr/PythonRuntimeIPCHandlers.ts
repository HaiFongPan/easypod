import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { getPythonRuntimeManager } from './PythonRuntimeManager';
import { getFunASRManager } from './FunASRManager';

export class PythonRuntimeIPCHandlers {
  private runtimeManager = getPythonRuntimeManager();
  private funasrManager = getFunASRManager();
  private logListener: ((log: string) => void) | null = null;

  constructor(private mainWindow: BrowserWindow | null = null) {
    this.registerHandlers();
    this.setupLogForwarding();
  }

  private registerHandlers(): void {
    ipcMain.handle('pythonRuntime:getStatus', this.handleGetStatus.bind(this));
    ipcMain.handle('pythonRuntime:initialize', this.handleInitialize.bind(this));
  }

  /**
   * 获取 Python Runtime 状态
   * - ready: runtime 已准备好（内存缓存或磁盘上的初始化产物）
   * - uninitialized: 尚未初始化
   * - error: 捕获到异常
   */
  private async handleGetStatus(
    event: IpcMainInvokeEvent
  ): Promise<{ status: 'ready' | 'uninitialized' | 'error'; error?: string }> {
    try {
      if (this.runtimeManager.isProvisioned()) {
        return { status: 'ready' };
      }

      return { status: 'uninitialized' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', error: message };
    }
  }

  /**
   * 触发 Python Runtime 初始化
   */
  private async handleInitialize(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.runtimeManager.ensureReady({ checkFunasr: false });

      // Start FunASR service after runtime is ready
      // This starts the HTTP server but doesn't initialize models yet
      // Models will be initialized on first transcription or when explicitly requested
      try {
        await this.funasrManager.ensureReady();
        console.log('[PythonRuntime] FunASR service started successfully');
      } catch (funasrError) {
        console.warn('[PythonRuntime] FunASR service failed to start:', funasrError);
        // Don't fail the initialization, just log the warning
        // The service might start later when needed
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * 将 PythonRuntimeManager 的日志事件转发到 renderer
   */
  private setupLogForwarding(): void {
    this.logListener = (log: string) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pythonRuntime:log', log);
      }
    };

    this.runtimeManager.on('log', this.logListener);
  }

  destroy(): void {
    ipcMain.removeHandler('pythonRuntime:getStatus');
    ipcMain.removeHandler('pythonRuntime:initialize');

    if (this.logListener) {
      this.runtimeManager.off('log', this.logListener);
      this.logListener = null;
    }
  }
}
