import { app } from 'electron';

type ElectronStoreModule = typeof import('electron-store');

// Use runtime dynamic import to load ESM-only electron-store from CommonJS build output.
const dynamicImport = new Function(
  'specifier',
  'return import(specifier);',
) as (specifier: string) => Promise<ElectronStoreModule>;

async function loadElectronStore(): Promise<ElectronStoreModule> {
  return dynamicImport('electron-store');
}

export interface FunASRConfig {
  model: string;
  vadModel?: string;
  puncModel?: string;
  spkModel?: string;
  device?: 'cpu' | 'cuda';
  maxSingleSegmentTime?: number;
  serverHost?: string;
  serverPort?: number;
}

export interface AliyunConfig {
  apiKey: string;
  baseURL?: string;
  model?: 'paraformer-v2' | 'paraformer-v1';
  languageHints?: string[];
  speakerCount?: number;
  disfluencyRemoval?: boolean;
}

interface TranscriptConfigSchema {
  funasr?: FunASRConfig;
  aliyun?: AliyunConfig;
  defaultService?: 'funasr' | 'aliyun';
}

const DEFAULT_FUNASR_CONFIG: Partial<FunASRConfig> = {
  device: 'cpu',
  maxSingleSegmentTime: 60000, // 60 seconds
  serverHost: '127.0.0.1',
  serverPort: 17953,
};

const DEFAULT_ALIYUN_CONFIG: Partial<AliyunConfig> = {
  baseURL: 'https://dashscope.aliyuncs.com/api/v1',
  model: 'paraformer-v2',
  languageHints: ['zh', 'en'],
  speakerCount: 2,
  disfluencyRemoval: true,
};

type StoreInstance = {
  get<K extends keyof TranscriptConfigSchema>(key: K): TranscriptConfigSchema[K] | undefined;
  set<K extends keyof TranscriptConfigSchema>(key: K, value: TranscriptConfigSchema[K]): void;
  clear(): void;
};

export class TranscriptConfigManager {
  private store: StoreInstance | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initStore();
  }

  private async initStore(): Promise<void> {
    try {
      const ElectronStore = (await loadElectronStore()).default;
      this.store = new ElectronStore<TranscriptConfigSchema>({
        name: 'transcript-config',
        cwd: app.getPath('userData'),
        encryptionKey: 'easypod-transcript-config', // Simple encryption for API keys
      }) as any;
    } catch (error) {
      console.error('Failed to initialize electron-store:', error);
      throw error;
    }
  }

  private async ensureStore(): Promise<StoreInstance> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.store) {
      throw new Error('Store not initialized');
    }
    return this.store;
  }

  /**
   * Get FunASR configuration
   */
  async getFunASRConfig(): Promise<FunASRConfig | null> {
    const store = await this.ensureStore();
    const config = store.get('funasr');
    if (!config || !config.model) {
      return null;
    }

    return {
      ...DEFAULT_FUNASR_CONFIG,
      ...config,
    } as FunASRConfig;
  }

  /**
   * Set FunASR configuration
   */
  async setFunASRConfig(config: Partial<FunASRConfig>): Promise<void> {
    const store = await this.ensureStore();
    const current = store.get('funasr') || {};
    store.set('funasr', {
      ...current,
      ...config,
    } as FunASRConfig);
  }

  /**
   * Get default FunASR model names (not paths)
   * These are ModelScope model identifiers that FunASR will download/use
   */
  getDefaultFunASRModels(): {
    model: string;
    vadModel: string;
    puncModel: string;
    spkModel: string;
  } {
    return {
      model: 'iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch',
      vadModel: 'iic/speech_fsmn_vad_zh-cn-16k-common-pytorch',
      puncModel: 'iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch',
      spkModel: 'iic/speech_campplus_sv_zh-cn_16k-common',
    };
  }

  /**
   * Get Aliyun configuration
   */
  async getAliyunConfig(): Promise<AliyunConfig | null> {
    const store = await this.ensureStore();
    const config = store.get('aliyun');
    if (!config || !config.apiKey) {
      return null;
    }

    return {
      ...DEFAULT_ALIYUN_CONFIG,
      ...config,
    } as AliyunConfig;
  }

  /**
   * Set Aliyun configuration
   */
  async setAliyunConfig(config: Partial<AliyunConfig>): Promise<void> {
    const store = await this.ensureStore();
    const current = store.get('aliyun') || {};
    store.set('aliyun', {
      ...current,
      ...config,
    } as AliyunConfig);
  }

  /**
   * Get default service
   */
  async getDefaultService(): Promise<'funasr' | 'aliyun'> {
    const store = await this.ensureStore();
    return store.get('defaultService') || 'funasr';
  }

  /**
   * Set default service
   */
  async setDefaultService(service: 'funasr' | 'aliyun'): Promise<void> {
    const store = await this.ensureStore();
    store.set('defaultService', service);
  }

  /**
   * Clear all configuration
   */
  async clear(): Promise<void> {
    const store = await this.ensureStore();
    store.clear();
  }

  /**
   * Export configuration
   */
  async export(): Promise<TranscriptConfigSchema> {
    return {
      funasr: (await this.getFunASRConfig()) || undefined,
      aliyun: (await this.getAliyunConfig()) || undefined,
      defaultService: await this.getDefaultService(),
    };
  }

  /**
   * Import configuration
   */
  async import(config: TranscriptConfigSchema): Promise<void> {
    if (config.funasr) {
      await this.setFunASRConfig(config.funasr);
    }
    if (config.aliyun) {
      await this.setAliyunConfig(config.aliyun);
    }
    if (config.defaultService) {
      await this.setDefaultService(config.defaultService);
    }
  }
}

// Singleton instance
let instance: TranscriptConfigManager | null = null;

export function getTranscriptConfigManager(): TranscriptConfigManager {
  if (!instance) {
    instance = new TranscriptConfigManager();
  }
  return instance;
}
