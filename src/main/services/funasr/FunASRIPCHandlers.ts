import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { FunASRManager, FunASRManagerOptions, getFunASRManager } from './FunASRManager';
import {
  FunASRInitializeRequest,
  FunASRTranscribeRequest,
} from './FunASRServiceClient';

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>;

export class FunASRIPCHandlers {
  private manager: FunASRManager;
  private handlers: Array<{ channel: string; handler: Handler }>;

  constructor(options: FunASRManagerOptions = {}) {
    this.manager = getFunASRManager(options);
    this.handlers = [];
    this.register();
  }

  destroy(): void {
    for (const { channel, handler } of this.handlers) {
      ipcMain.removeHandler(channel);
    }
    this.handlers = [];
    void this.manager.shutdown();
  }

  private register(): void {
    this.registerHandler('funasr:health', this.handleHealth.bind(this));
    this.registerHandler('funasr:initialize', this.handleInitialize.bind(this));
    this.registerHandler('funasr:transcribe', this.handleTranscribe.bind(this));
    this.registerHandler('funasr:task:get', this.handleGetTask.bind(this));
    this.registerHandler('funasr:shutdown', this.handleShutdown.bind(this));
  }

  private registerHandler(channel: string, handler: Handler): void {
    ipcMain.handle(channel, handler);
    this.handlers.push({ channel, handler });
  }

  private async handleHealth(): Promise<any> {
    return this.manager.health();
  }

  private async handleInitialize(
    _event: IpcMainInvokeEvent,
    payload: FunASRInitializeRequest
  ): Promise<any> {
    return this.manager.initializeModel(payload);
  }

  private async handleTranscribe(
    _event: IpcMainInvokeEvent,
    payload: FunASRTranscribeRequest
  ): Promise<any> {
    return this.manager.transcribe(payload);
  }

  private async handleGetTask(
    _event: IpcMainInvokeEvent,
    taskId: string
  ): Promise<any> {
    return this.manager.getTask(taskId);
  }

  private async handleShutdown(): Promise<{ success: boolean }> {
    await this.manager.shutdown();
    return { success: true };
  }
}

export const registerFunASRIPCHandlers = (options?: FunASRManagerOptions): FunASRIPCHandlers => {
  return new FunASRIPCHandlers(options);
};
