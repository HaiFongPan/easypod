import axios, { AxiosInstance } from 'axios';

export interface FunASRInitializeRequest {
  asr_model: string;
  device?: string;
  options?: Record<string, unknown>;
}

export interface FunASRInitializeResponse {
  status: 'ready' | 'initializing';
  loaded_models: string[];
  message?: string;
}

export interface FunASRTranscribeRequest {
  audio_path: string;
  options?: Record<string, unknown>;
}

export interface FunASRTranscribeResponse {
  task_id: string;
  status: string;
}

export interface FunASRSegment {
  start_ms: number;
  end_ms: number;
  text: string;
  speaker?: string;
}

export interface FunASRTaskStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  segments?: FunASRSegment[];
  metadata?: Record<string, unknown>;
}

export interface FunASRHealthResponse {
  status: 'ok';
  funasr_version?: string;
  python_version?: string;
  models?: string[];
}

export class FunASRServiceClient {
  private axios: AxiosInstance;

  constructor(baseUrl: string) {
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 60_000,
    });
  }

  get baseURL(): string {
    return this.axios.defaults.baseURL ?? '';
  }

  async health(): Promise<FunASRHealthResponse> {
    const response = await this.axios.get<FunASRHealthResponse>('/health');
    return response.data;
  }

  async initialize(payload: FunASRInitializeRequest): Promise<FunASRInitializeResponse> {
    const response = await this.axios.post<FunASRInitializeResponse>('/initialize', payload);
    return response.data;
  }

  async transcribe(payload: FunASRTranscribeRequest): Promise<FunASRTranscribeResponse> {
    const response = await this.axios.post<FunASRTranscribeResponse>('/transcribe', payload);
    return response.data;
  }

  async getTask(taskId: string): Promise<FunASRTaskStatus> {
    const response = await this.axios.get<FunASRTaskStatus>(`/task/${encodeURIComponent(taskId)}`);
    return response.data;
  }
}

export const createFunASRServiceClient = (baseUrl: string): FunASRServiceClient => {
  return new FunASRServiceClient(baseUrl);
};
