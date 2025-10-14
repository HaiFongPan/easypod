import { EventEmitter } from 'events';
import { FunASRServer, FunASRServerOptions } from './FunASRServer';
import {
  FunASRServiceClient,
  FunASRInitializeRequest,
  FunASRInitializeResponse,
  FunASRTranscribeRequest,
  FunASRTranscribeResponse,
  FunASRTaskStatus,
  createFunASRServiceClient,
} from './FunASRServiceClient';

export interface FunASRManagerOptions extends FunASRServerOptions {}

let sharedInstance: FunASRManager | undefined;

export class FunASRManager extends EventEmitter {
  private readonly server: FunASRServer;
  private client: FunASRServiceClient | null = null;
  private startupPromise: Promise<FunASRServiceClient> | null = null;
  readonly options: FunASRManagerOptions;

  private constructor(options: FunASRManagerOptions = {}) {
    super();
    this.options = options;
    this.server = new FunASRServer(options);
    this.registerServerEvents();
  }

  private registerServerEvents(): void {
    this.server.on('log', (entry) => this.emit('log', entry));
    this.server.on('error', (error) => this.emit('error', error));
    this.server.on('exit', (payload) => this.emit('exit', payload));
    this.server.on('ready', (payload) => this.emit('ready', payload));
  }

  async ensureReady(): Promise<FunASRServiceClient> {
    if (this.client) {
      return this.client;
    }

    if (!this.startupPromise) {
      this.startupPromise = this.server
        .start()
        .then(({ url }) => {
          const client = createFunASRServiceClient(url);
          this.client = client;
          return client;
        })
        .finally(() => {
          this.startupPromise = null;
        });
    }

    return this.startupPromise;
  }

  async initializeModel(payload: FunASRInitializeRequest): Promise<FunASRInitializeResponse> {
    const client = await this.ensureReady();
    return client.initialize(payload);
  }

  async health(): Promise<any> {
    const client = await this.ensureReady();
    return client.health();
  }

  async transcribe(payload: FunASRTranscribeRequest): Promise<FunASRTranscribeResponse> {
    const client = await this.ensureReady();
    return client.transcribe(payload);
  }

  async getTask(taskId: string): Promise<FunASRTaskStatus> {
    const client = await this.ensureReady();
    return client.getTask(taskId);
  }

  async shutdown(): Promise<void> {
    this.client = null;
    await this.server.stop();
    if (sharedInstance === this) {
      sharedInstance = undefined;
    }
  }

  static create(options?: FunASRManagerOptions): FunASRManager {
    return new FunASRManager(options);
  }
}

export const getFunASRManager = (
  options?: FunASRManagerOptions,
): FunASRManager => {
  if (!sharedInstance) {
    sharedInstance = FunASRManager.create(options);
  }

  if (options && Object.keys(options).length > 0) {
    const mismatch = Object.entries(options).filter(([key, value]) => {
      const currentValue = sharedInstance?.options[key as keyof FunASRManagerOptions];
      return (
        value !== undefined &&
        currentValue !== undefined &&
        currentValue !== value
      );
    });

    if (mismatch.length > 0) {
      sharedInstance.emit(
        'log',
        {
          stream: 'stderr',
          line: `FunASRManager already initialized with different options: ${JSON.stringify(
            mismatch,
          )}`,
        },
      );
    }
  }

  return sharedInstance;
};
