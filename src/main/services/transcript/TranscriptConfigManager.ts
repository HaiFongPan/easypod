import { TranscriptSettingsDao } from "../../database/dao/transcriptSettingsDao";
import { encryptString, decryptString } from "../../utils/encryption";

export interface FunASRConfig {
  model: string;
  vadModel?: string;
  puncModel?: string;
  spkModel?: string;
  device?: "cpu" | "cuda";
  maxSingleSegmentTime?: number;
  serverHost?: string;
  serverPort?: number;
  useDefaultModels?: boolean; // UI 状态持久化
}

export interface AliyunConfig {
  apiKey: string;
  baseURL?: string;
  model?: "paraformer-v2" | "paraformer-v1";
  languageHints?: string[];
  speakerCount?: number;
  disfluencyRemoval?: boolean;
}

interface DefaultServiceConfig {
  defaultService: "funasr" | "aliyun";
}

const DEFAULT_FUNASR_CONFIG: Partial<FunASRConfig> = {
  device: "cpu",
  maxSingleSegmentTime: 60000, // 60 seconds
  serverHost: "127.0.0.1",
  serverPort: 17953,
  useDefaultModels: true,
};

const DEFAULT_ALIYUN_CONFIG: Partial<AliyunConfig> = {
  baseURL: "https://dashscope.aliyuncs.com/api/v1",
  model: "paraformer-v2",
  languageHints: ["zh", "en"],
  speakerCount: 2,
  disfluencyRemoval: true,
};

export class TranscriptConfigManager {
  private dao: TranscriptSettingsDao;

  constructor() {
    this.dao = new TranscriptSettingsDao();
  }

  /**
   * Get FunASR configuration
   * Returns default config if no custom config exists
   */
  async getFunASRConfig(): Promise<FunASRConfig> {
    // const config = await this.dao.getConfig<FunASRConfig>('funasr');
    //
    // // If no config exists, return defaults with default models
    // if (!config) {
    const defaultModels = this.getDefaultFunASRModels();
    return {
      ...DEFAULT_FUNASR_CONFIG,
      model: defaultModels.model,
      vadModel: defaultModels.vadModel,
      puncModel: defaultModels.puncModel,
      spkModel: defaultModels.spkModel,
    } as FunASRConfig;
    // }
    //
    // // Merge with defaults
    // return {
    //   ...DEFAULT_FUNASR_CONFIG,
    //   ...config,
    // } as FunASRConfig;
  }

  /**
   * Set FunASR configuration
   */
  async setFunASRConfig(config: Partial<FunASRConfig>): Promise<void> {
    const current = (await this.dao.getConfig<FunASRConfig>("funasr")) || {};
    await this.dao.setConfig("funasr", {
      ...current,
      ...config,
    });
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
      model:
        "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      vadModel: "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch",
      puncModel: "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch",
      spkModel: "iic/speech_campplus_sv_zh-cn_16k-common",
    };
  }

  /**
   * Get Aliyun configuration
   */
  async getAliyunConfig(): Promise<AliyunConfig | null> {
    const config = await this.dao.getConfig<AliyunConfig>("aliyun");
    if (!config || !config.apiKey) {
      return null;
    }

    // 解密 API Key
    const decryptedApiKey = decryptString(config.apiKey);

    return {
      ...DEFAULT_ALIYUN_CONFIG,
      ...config,
      apiKey: decryptedApiKey,
    } as AliyunConfig;
  }

  /**
   * Set Aliyun configuration
   */
  async setAliyunConfig(config: Partial<AliyunConfig>): Promise<void> {
    const current = (await this.dao.getConfig<AliyunConfig>("aliyun")) || {};
    const merged = {
      ...current,
      ...config,
    };

    // 加密 API Key
    if (merged.apiKey) {
      merged.apiKey = encryptString(merged.apiKey);
    }

    await this.dao.setConfig("aliyun", merged);
  }

  /**
   * Get default service
   */
  async getDefaultService(): Promise<("funasr" | "aliyun") | null> {
    const config = await this.dao.getConfig<DefaultServiceConfig>("default");
    return config?.defaultService ?? null;
  }

  /**
   * Set default service
   */
  async setDefaultService(service: "funasr" | "aliyun"): Promise<void> {
    await this.dao.setConfig("default", { defaultService: service });
  }

  /**
   * Clear all configuration
   */
  async clear(): Promise<void> {
    await this.dao.clearAll();
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
