# Task Stage 1.0: 转写服务配置管理

## 任务概述

实现转写服务的配置管理功能，支持用户配置 FunASR 模型参数和阿里云 API 凭证，为后续的转写功能提供配置基础。

## 技术设计

### 配置项定义

#### FunASR 配置

```typescript
interface FunASRConfig {
  // 模型配置
  model: string;              // ASR 模型路径或标识
  vadModel?: string;          // VAD (语音活动检测) 模型
  puncModel?: string;         // 标点模型
  spkModel?: string;          // 说话人识别模型

  // 运行时配置
  device?: 'cpu' | 'cuda';    // 计算设备
  maxSingleSegmentTime?: number; // 最大单段时长（毫秒）

  // 服务配置
  serverHost?: string;        // FunASR 服务地址
  serverPort?: number;        // FunASR 服务端口
}
```

#### 阿里云配置

```typescript
interface AliyunConfig {
  // API 凭证
  apiKey: string;             // 阿里云 API Key
  baseURL?: string;           // API 基础 URL（支持自定义）

  // 模型配置
  model?: 'paraformer-v2' | 'paraformer-v1'; // 使用的模型版本

  // 默认参数
  languageHints?: string[];   // 语言提示 ['zh', 'en']
  speakerCount?: number;      // 默认说话人数量
  disfluencyRemoval?: boolean; // 去除口语化表达
}
```

### 配置存储方案

使用 `electron-store` 存储用户配置：

```typescript
interface TranscriptConfigStore {
  funasr?: FunASRConfig;
  aliyun?: AliyunConfig;
  defaultService?: 'funasr' | 'aliyun'; // 默认使用的服务
}
```

## 实现细节

### 1. 配置管理器

在 `src/main/services/transcript/TranscriptConfigManager.ts`:

```typescript
import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';

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
  maxSingleSegmentTime: 60000, // 60 秒
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

export class TranscriptConfigManager {
  private store: Store<TranscriptConfigSchema>;

  constructor() {
    this.store = new Store<TranscriptConfigSchema>({
      name: 'transcript-config',
      cwd: app.getPath('userData'),
      encryptionKey: 'easypod-transcript-config', // 简单加密 API Key
    });
  }

  /**
   * 获取 FunASR 配置
   */
  getFunASRConfig(): FunASRConfig | null {
    const config = this.store.get('funasr');
    if (!config || !config.model) {
      return null;
    }

    return {
      ...DEFAULT_FUNASR_CONFIG,
      ...config,
    } as FunASRConfig;
  }

  /**
   * 设置 FunASR 配置
   */
  setFunASRConfig(config: Partial<FunASRConfig>): void {
    const current = this.store.get('funasr') || {};
    this.store.set('funasr', {
      ...current,
      ...config,
    });
  }

  /**
   * 获取 FunASR 默认模型路径
   */
  getDefaultFunASRModels(): {
    model: string;
    vadModel: string;
    puncModel: string;
    spkModel: string;
  } {
    const modelsDir = this.getFunASRModelsDir();

    return {
      model: path.join(modelsDir, 'speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch'),
      vadModel: path.join(modelsDir, 'speech_fsmn_vad_zh-cn-16k-common-pytorch'),
      puncModel: path.join(modelsDir, 'punc_ct-transformer_zh-cn-common-vocab272727-pytorch'),
      spkModel: path.join(modelsDir, 'speech_campplus_sv_zh-cn_16k-common'),
    };
  }

  /**
   * 获取 FunASR 模型目录
   */
  private getFunASRModelsDir(): string {
    // 开发环境
    if (!app.isPackaged) {
      return path.join(process.cwd(), 'resources', 'funasr-models');
    }

    // 生产环境
    return path.join(process.resourcesPath, 'funasr-models');
  }

  /**
   * 获取阿里云配置
   */
  getAliyunConfig(): AliyunConfig | null {
    const config = this.store.get('aliyun');
    if (!config || !config.apiKey) {
      return null;
    }

    return {
      ...DEFAULT_ALIYUN_CONFIG,
      ...config,
    } as AliyunConfig;
  }

  /**
   * 设置阿里云配置
   */
  setAliyunConfig(config: Partial<AliyunConfig>): void {
    const current = this.store.get('aliyun') || {};
    this.store.set('aliyun', {
      ...current,
      ...config,
    });
  }

  /**
   * 获取默认服务
   */
  getDefaultService(): 'funasr' | 'aliyun' {
    return this.store.get('defaultService') || 'funasr';
  }

  /**
   * 设置默认服务
   */
  setDefaultService(service: 'funasr' | 'aliyun'): void {
    this.store.set('defaultService', service);
  }

  /**
   * 清空配置
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 导出配置
   */
  export(): TranscriptConfigSchema {
    return {
      funasr: this.getFunASRConfig() || undefined,
      aliyun: this.getAliyunConfig() || undefined,
      defaultService: this.getDefaultService(),
    };
  }

  /**
   * 导入配置
   */
  import(config: TranscriptConfigSchema): void {
    if (config.funasr) {
      this.setFunASRConfig(config.funasr);
    }
    if (config.aliyun) {
      this.setAliyunConfig(config.aliyun);
    }
    if (config.defaultService) {
      this.setDefaultService(config.defaultService);
    }
  }
}

// 单例模式
let instance: TranscriptConfigManager | null = null;

export function getTranscriptConfigManager(): TranscriptConfigManager {
  if (!instance) {
    instance = new TranscriptConfigManager();
  }
  return instance;
}
```

### 2. IPC Handlers

在 `src/main/services/transcript/TranscriptConfigIPCHandlers.ts`:

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getTranscriptConfigManager, FunASRConfig, AliyunConfig } from './TranscriptConfigManager';
import { existsSync } from 'fs';

export class TranscriptConfigIPCHandlers {
  private configManager = getTranscriptConfigManager();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // FunASR 配置
    ipcMain.handle('transcript:config:getFunASR', this.handleGetFunASRConfig.bind(this));
    ipcMain.handle('transcript:config:setFunASR', this.handleSetFunASRConfig.bind(this));
    ipcMain.handle('transcript:config:getDefaultModels', this.handleGetDefaultModels.bind(this));
    ipcMain.handle('transcript:config:validateModelPath', this.handleValidateModelPath.bind(this));

    // 阿里云配置
    ipcMain.handle('transcript:config:getAliyun', this.handleGetAliyunConfig.bind(this));
    ipcMain.handle('transcript:config:setAliyun', this.handleSetAliyunConfig.bind(this));
    ipcMain.handle('transcript:config:testAliyunAPI', this.handleTestAliyunAPI.bind(this));

    // 通用配置
    ipcMain.handle('transcript:config:getDefaultService', this.handleGetDefaultService.bind(this));
    ipcMain.handle('transcript:config:setDefaultService', this.handleSetDefaultService.bind(this));
    ipcMain.handle('transcript:config:export', this.handleExportConfig.bind(this));
    ipcMain.handle('transcript:config:import', this.handleImportConfig.bind(this));
  }

  private async handleGetFunASRConfig(
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; config?: FunASRConfig; error?: string }> {
    try {
      const config = this.configManager.getFunASRConfig();
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
      this.configManager.setFunASRConfig(params.config);
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
      const config = this.configManager.getAliyunConfig();
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
      this.configManager.setAliyunConfig(params.config);
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
      const config = this.configManager.getAliyunConfig();
      if (!config) {
        return { success: false, error: 'Aliyun config not found' };
      }

      // 简单的 API 连通性测试
      const axios = require('axios');
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
      const service = this.configManager.getDefaultService();
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
      this.configManager.setDefaultService(params.service);
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
      const config = this.configManager.export();
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
      this.configManager.import(params.config);
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
```

### 3. Preload API

在 `src/main/preload.ts` 中添加:

```typescript
const transcriptConfigAPI = {
  // FunASR 配置
  getFunASRConfig: () => ipcRenderer.invoke('transcript:config:getFunASR'),
  setFunASRConfig: (config: Partial<FunASRConfig>) =>
    ipcRenderer.invoke('transcript:config:setFunASR', { config }),
  getDefaultModels: () => ipcRenderer.invoke('transcript:config:getDefaultModels'),
  validateModelPath: (path: string) =>
    ipcRenderer.invoke('transcript:config:validateModelPath', { path }),

  // 阿里云配置
  getAliyunConfig: () => ipcRenderer.invoke('transcript:config:getAliyun'),
  setAliyunConfig: (config: Partial<AliyunConfig>) =>
    ipcRenderer.invoke('transcript:config:setAliyun', { config }),
  testAliyunAPI: () => ipcRenderer.invoke('transcript:config:testAliyunAPI'),

  // 通用配置
  getDefaultService: () => ipcRenderer.invoke('transcript:config:getDefaultService'),
  setDefaultService: (service: 'funasr' | 'aliyun') =>
    ipcRenderer.invoke('transcript:config:setDefaultService', { service }),
  exportConfig: () => ipcRenderer.invoke('transcript:config:export'),
  importConfig: (config: any) => ipcRenderer.invoke('transcript:config:import', { config }),
};

contextBridge.exposeInMainWorld('electronAPI', {
  // ... 现有 API
  transcriptConfig: transcriptConfigAPI,
});
```

### 4. UI 组件

在 `src/renderer/components/settings/TranscriptSettings.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Button } from '@/renderer/components/ui/Button';
import { Input } from '@/renderer/components/ui/Input';
import { Select } from '@/renderer/components/ui/Select';
import { Tabs, TabList, Tab, TabPanel } from '@/renderer/components/ui/Tabs';

export const TranscriptSettings: React.FC = () => {
  return (
    <div className="transcript-settings">
      <h2>转写服务配置</h2>

      <Tabs>
        <TabList>
          <Tab>FunASR (本地)</Tab>
          <Tab>阿里云 API</Tab>
          <Tab>通用设置</Tab>
        </TabList>

        <TabPanel>
          <FunASRSettingsPanel />
        </TabPanel>

        <TabPanel>
          <AliyunSettingsPanel />
        </TabPanel>

        <TabPanel>
          <GeneralSettingsPanel />
        </TabPanel>
      </Tabs>
    </div>
  );
};

const FunASRSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [defaultModels, setDefaultModels] = useState<any>(null);
  const [useDefaultModels, setUseDefaultModels] = useState(true);

  useEffect(() => {
    loadConfig();
    loadDefaultModels();
  }, []);

  const loadConfig = async () => {
    const result = await window.electronAPI.transcriptConfig.getFunASRConfig();
    if (result.success && result.config) {
      setConfig(result.config);
    }
  };

  const loadDefaultModels = async () => {
    const result = await window.electronAPI.transcriptConfig.getDefaultModels();
    if (result.success && result.models) {
      setDefaultModels(result.models);
    }
  };

  const handleSave = async () => {
    const configToSave = useDefaultModels
      ? {
          ...defaultModels,
          device: config?.device || 'cpu',
          maxSingleSegmentTime: config?.maxSingleSegmentTime || 60000,
        }
      : config;

    const result = await window.electronAPI.transcriptConfig.setFunASRConfig(configToSave);
    if (result.success) {
      alert('FunASR 配置保存成功');
    } else {
      alert(`保存失败: ${result.error}`);
    }
  };

  const handleValidatePath = async (path: string) => {
    const result = await window.electronAPI.transcriptConfig.validateModelPath(path);
    return result.exists;
  };

  return (
    <div className="funasr-settings-panel">
      <div className="form-section">
        <label>
          <input
            type="checkbox"
            checked={useDefaultModels}
            onChange={(e) => setUseDefaultModels(e.target.checked)}
          />
          使用默认模型路径
        </label>
      </div>

      {useDefaultModels ? (
        <div className="form-section">
          <p>使用内置的 FunASR 模型，无需手动配置路径。</p>
          <ul>
            <li>ASR 模型: paraformer-large</li>
            <li>VAD 模型: fsmn_vad</li>
            <li>标点模型: ct-transformer</li>
            <li>说话人模型: campplus</li>
          </ul>
        </div>
      ) : (
        <>
          <div className="form-row">
            <label>ASR 模型路径:</label>
            <Input
              value={config?.model || ''}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="/path/to/paraformer-large"
            />
          </div>

          <div className="form-row">
            <label>VAD 模型路径:</label>
            <Input
              value={config?.vadModel || ''}
              onChange={(e) => setConfig({ ...config, vadModel: e.target.value })}
              placeholder="/path/to/fsmn_vad"
            />
          </div>

          <div className="form-row">
            <label>标点模型路径:</label>
            <Input
              value={config?.puncModel || ''}
              onChange={(e) => setConfig({ ...config, puncModel: e.target.value })}
              placeholder="/path/to/ct-transformer"
            />
          </div>

          <div className="form-row">
            <label>说话人模型路径:</label>
            <Input
              value={config?.spkModel || ''}
              onChange={(e) => setConfig({ ...config, spkModel: e.target.value })}
              placeholder="/path/to/campplus"
            />
          </div>
        </>
      )}

      <div className="form-row">
        <label>计算设备:</label>
        <Select
          value={config?.device || 'cpu'}
          onChange={(e) => setConfig({ ...config, device: e.target.value })}
        >
          <option value="cpu">CPU</option>
          <option value="cuda">CUDA (需要 GPU)</option>
        </Select>
      </div>

      <div className="form-row">
        <label>最大单段时长 (秒):</label>
        <Input
          type="number"
          value={(config?.maxSingleSegmentTime || 60000) / 1000}
          onChange={(e) =>
            setConfig({ ...config, maxSingleSegmentTime: Number(e.target.value) * 1000 })
          }
          min={10}
          max={300}
        />
      </div>

      <div className="form-actions">
        <Button onClick={handleSave}>保存配置</Button>
      </div>
    </div>
  );
};

const AliyunSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<any>({});
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const result = await window.electronAPI.transcriptConfig.getAliyunConfig();
    if (result.success && result.config) {
      setConfig(result.config);
    }
  };

  const handleSave = async () => {
    const result = await window.electronAPI.transcriptConfig.setAliyunConfig(config);
    if (result.success) {
      alert('阿里云配置保存成功');
    } else {
      alert(`保存失败: ${result.error}`);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await window.electronAPI.transcriptConfig.testAliyunAPI();
      if (result.success) {
        alert(`✓ ${result.message}`);
      } else {
        alert(`✗ ${result.error}`);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="aliyun-settings-panel">
      <div className="form-row">
        <label>API Key:</label>
        <Input
          type="password"
          value={config.apiKey || ''}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          placeholder="请输入阿里云 DashScope API Key"
        />
        <small>
          获取 API Key:{' '}
          <a
            href="https://dashscope.console.aliyun.com/apiKey"
            target="_blank"
            rel="noopener noreferrer"
          >
            阿里云控制台
          </a>
        </small>
      </div>

      <div className="form-row">
        <label>API 基础 URL:</label>
        <Input
          value={config.baseURL || 'https://dashscope.aliyuncs.com/api/v1'}
          onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
        />
      </div>

      <div className="form-row">
        <label>模型版本:</label>
        <Select
          value={config.model || 'paraformer-v2'}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
        >
          <option value="paraformer-v2">Paraformer V2 (推荐)</option>
          <option value="paraformer-v1">Paraformer V1</option>
        </Select>
      </div>

      <div className="form-row">
        <label>默认说话人数量:</label>
        <Input
          type="number"
          value={config.speakerCount || 2}
          onChange={(e) => setConfig({ ...config, speakerCount: Number(e.target.value) })}
          min={1}
          max={10}
        />
      </div>

      <div className="form-row">
        <label>
          <input
            type="checkbox"
            checked={config.disfluencyRemoval !== false}
            onChange={(e) => setConfig({ ...config, disfluencyRemoval: e.target.checked })}
          />
          去除口语化表达
        </label>
      </div>

      <div className="form-actions">
        <Button onClick={handleSave}>保存配置</Button>
        <Button onClick={handleTest} disabled={testing || !config.apiKey}>
          {testing ? '测试中...' : '测试连接'}
        </Button>
      </div>
    </div>
  );
};

const GeneralSettingsPanel: React.FC = () => {
  const [defaultService, setDefaultService] = useState<'funasr' | 'aliyun'>('funasr');

  useEffect(() => {
    loadDefaultService();
  }, []);

  const loadDefaultService = async () => {
    const result = await window.electronAPI.transcriptConfig.getDefaultService();
    if (result.success && result.service) {
      setDefaultService(result.service);
    }
  };

  const handleSave = async () => {
    const result = await window.electronAPI.transcriptConfig.setDefaultService(defaultService);
    if (result.success) {
      alert('默认服务设置成功');
    }
  };

  const handleExport = async () => {
    const result = await window.electronAPI.transcriptConfig.exportConfig();
    if (result.success && result.config) {
      const blob = new Blob([JSON.stringify(result.config, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transcript-config.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const config = JSON.parse(event.target?.result as string);
            const result = await window.electronAPI.transcriptConfig.importConfig(config);
            if (result.success) {
              alert('配置导入成功');
              window.location.reload();
            }
          } catch (error) {
            alert('配置文件格式错误');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="general-settings-panel">
      <div className="form-row">
        <label>默认转写服务:</label>
        <Select value={defaultService} onChange={(e) => setDefaultService(e.target.value as any)}>
          <option value="funasr">FunASR (本地)</option>
          <option value="aliyun">阿里云 API</option>
        </Select>
      </div>

      <div className="form-actions">
        <Button onClick={handleSave}>保存设置</Button>
      </div>

      <hr />

      <div className="config-management">
        <h3>配置管理</h3>
        <div className="form-actions">
          <Button onClick={handleExport}>导出配置</Button>
          <Button onClick={handleImport}>导入配置</Button>
        </div>
      </div>
    </div>
  );
};
```

## 依赖关系

- **前置依赖**:
  - electron-store 包
  - TypeScript 类型定义

- **后置依赖**:
  - Task 1.1: 数据库表结构
  - Task 1.3: FunASR 服务实现
  - Task 1.4: 阿里云服务实现

## 验收标准

- [ ] TranscriptConfigManager 实现完整
- [ ] 支持 FunASR 模型配置（4 个模型路径）
- [ ] 支持阿里云 API 配置（API Key、URL）
- [ ] 配置加密存储（API Key 等敏感信息）
- [ ] IPC 接口实现完整
- [ ] UI 设置面板功能正常
- [ ] 支持配置导入/导出
- [ ] 配置验证功能正常
- [ ] 阿里云 API 连接测试正常

## 风险和注意事项

### 风险

1. **敏感信息存储**: API Key 需要安全存储
2. **模型路径验证**: 用户输入的路径可能无效
3. **默认配置**: 需要提供合理的默认值

### 注意事项

1. **加密存储**: 使用 electron-store 的加密功能
2. **路径验证**: 验证模型路径是否存在
3. **API 测试**: 提供 API 连接测试功能
4. **配置迁移**: 考虑未来版本的配置升级

## 实施步骤

1. 安装 electron-store 依赖
2. 实现 TranscriptConfigManager
3. 实现 TranscriptConfigIPCHandlers
4. 更新 preload.ts
5. 实现 UI 设置组件
6. 添加配置验证逻辑
7. 测试配置存储和读取
8. 集成到设置页面

## 估时

- 设计: 0.5 天
- 配置管理器实现: 1 天
- IPC Handlers 实现: 1 天
- UI 组件实现: 2 天
- 测试和优化: 1 天
- **总计**: 5.5 天
