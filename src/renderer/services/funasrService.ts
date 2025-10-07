import type {
  FunASRHealthResponse,
  FunASRInitializeRequest,
  FunASRInitializeResponse,
  FunASRTaskStatus,
  FunASRTranscribeRequest,
  FunASRTranscribeResponse,
} from '../../main/services/funasr/FunASRServiceClient';
import { getElectronAPI } from '../utils/electron';

export const funasrService = {
  health(): Promise<FunASRHealthResponse> {
    return getElectronAPI().funasr.health();
  },

  initialize(payload: FunASRInitializeRequest): Promise<FunASRInitializeResponse> {
    return getElectronAPI().funasr.initialize(payload);
  },

  transcribe(payload: FunASRTranscribeRequest): Promise<FunASRTranscribeResponse> {
    return getElectronAPI().funasr.transcribe(payload);
  },

  getTask(taskId: string): Promise<FunASRTaskStatus> {
    return getElectronAPI().funasr.getTask(taskId);
  },

  shutdown(): Promise<{ success: boolean }> {
    return getElectronAPI().funasr.shutdown();
  },
};

export type FunASRService = typeof funasrService;
