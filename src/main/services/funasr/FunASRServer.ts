import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, createWriteStream, WriteStream } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { app } from 'electron';
import { getPythonRuntimeManager } from './PythonRuntimeManager';

export interface FunASRServerOptions {
  host?: string;
  port?: number;
  scriptPath?: string;
  checkFunasr?: boolean;
}

export interface FunASRServerState {
  url: string;
  pid: number;
}

const DEFAULT_PORT = 17953;
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_RETRY_INTERVAL_MS = 1_000;

export class FunASRServer extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private logStream: WriteStream | null = null;
  private readonly options: Required<Omit<FunASRServerOptions, 'scriptPath' | 'checkFunasr'>> & {
    scriptPath?: string;
    checkFunasr: boolean;
  };
  private baseUrl: string | null = null;

  constructor(options: FunASRServerOptions = {}) {
    super();
    this.options = {
      host: options.host ?? '127.0.0.1',
      port: options.port ?? DEFAULT_PORT,
      scriptPath: options.scriptPath,
      checkFunasr: options.checkFunasr ?? false,
    };
  }

  async start(): Promise<FunASRServerState> {
    if (this.child && !this.child.killed) {
      return { url: this.requireBaseUrl(), pid: this.child.pid ?? -1 };
    }

    const runtime = await getPythonRuntimeManager().ensureReady({
      checkFunasr: this.options.checkFunasr,
    });

    const scriptPath = this.options.scriptPath ?? this.resolveScriptPath();
    if (!existsSync(scriptPath)) {
      throw new Error(`FunASR service script not found at ${scriptPath}`);
    }

    const args = [scriptPath, '--host', this.options.host, '--port', String(this.options.port)];
    const child = spawn(runtime.pythonPath, args, {
      env: runtime.env,
      cwd: runtime.runtimeDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // We do not need to write to stdin; close immediately to avoid hanging.
    child.stdin.end();

    this.child = child;
    this.baseUrl = `http://${this.options.host}:${this.options.port}`;

    this.setupLogging(runtime.logsDir, child);

    child.on('exit', (code, signal) => {
      this.emit('exit', { code, signal });
      this.child = null;
    });

    child.on('error', (error) => {
      this.emit('error', error);
    });

    await this.waitForHealth();

    this.emit('ready', { url: this.baseUrl, pid: child.pid });
    return { url: this.requireBaseUrl(), pid: child.pid ?? -1 };
  }

  async stop(): Promise<void> {
    if (!this.child) {
      return;
    }

    const target = this.child;
    this.child = null;
    target.removeAllListeners();

    return new Promise((resolve) => {
      target.once('exit', () => {
        this.closeLogStream();
        resolve();
      });

      if (!target.killed) {
        target.kill();
      } else {
        this.closeLogStream();
        resolve();
      }
    });
  }

  isRunning(): boolean {
    return Boolean(this.child && !this.child.killed);
  }

  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  private resolveScriptPath(): string {
    if (process.env.EASYPOD_FUNASR_SERVER_SCRIPT) {
      return process.env.EASYPOD_FUNASR_SERVER_SCRIPT;
    }

    if (app.isPackaged) {
      return join(process.resourcesPath, 'python', 'funasr_service.py');
    }

    // In development mode, use process.cwd() instead of app.getAppPath()
    // because app.getAppPath() may point to dist/main where the compiled JS is,
    // but resources/ is in the project root
    return join(process.cwd(), 'resources', 'python', 'funasr_service.py');
  }

  private setupLogging(logsDir: string, child: ChildProcessWithoutNullStreams): void {
    this.closeLogStream();
    const logPath = join(logsDir, 'funasr-server.log');
    this.logStream = createWriteStream(logPath, { flags: 'a' });

    const forward = (data: Buffer, stream: 'stdout' | 'stderr') => {
      const line = data.toString();
      this.emit('log', { stream, line });
      this.logStream?.write(`[${new Date().toISOString()}] [${stream}] ${line}`);
    };

    child.stdout.on('data', (data: Buffer) => forward(data, 'stdout'));
    child.stderr.on('data', (data: Buffer) => forward(data, 'stderr'));
  }

  private async waitForHealth(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    const url = `${this.requireBaseUrl()}/health`;

    while (Date.now() < deadline) {
      try {
        const result = await axios.get(url, { timeout: 2_000 });
        if (result.status === 200) {
          return;
        }
      } catch (error) {
        // Retry until timeout; emit debug logs for visibility.
        this.emit('log', { stream: 'stdout', line: `Health check retry: ${String(error)}` });
      }

      await new Promise((resolve) => setTimeout(resolve, HEALTH_RETRY_INTERVAL_MS));
    }

    throw new Error('Timed out waiting for FunASR service health check.');
  }

  private requireBaseUrl(): string {
    if (!this.baseUrl) {
      throw new Error('FunASR service URL requested before startup.');
    }
    return this.baseUrl;
  }

  private closeLogStream(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

export const getFunASRServer = (options?: FunASRServerOptions): FunASRServer => {
  return new FunASRServer(options);
};
