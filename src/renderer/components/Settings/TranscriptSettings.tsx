import React, { useEffect, useState } from 'react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { getElectronAPI } from '../../utils/electron';

interface FunASRConfig {
  model: string;
  vadModel?: string;
  puncModel?: string;
  spkModel?: string;
  device?: 'cpu' | 'cuda';
  maxSingleSegmentTime?: number;
  serverHost?: string;
  serverPort?: number;
}

interface AliyunConfig {
  apiKey: string;
  baseURL?: string;
  model?: 'paraformer-v2' | 'paraformer-v1';
  languageHints?: string[];
  speakerCount?: number;
  disfluencyRemoval?: boolean;
}

export const TranscriptSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'funasr' | 'aliyun' | 'general'>('funasr');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">转写服务配置</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          配置 FunASR 本地转写服务或阿里云 API
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('funasr')}
            className={`${
              activeTab === 'funasr'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            FunASR (本地)
          </button>
          <button
            onClick={() => setActiveTab('aliyun')}
            className={`${
              activeTab === 'aliyun'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            阿里云 API
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            通用设置
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-4">
        {activeTab === 'funasr' && <FunASRSettingsPanel />}
        {activeTab === 'aliyun' && <AliyunSettingsPanel />}
        {activeTab === 'general' && <GeneralSettingsPanel />}
      </div>
    </div>
  );
};

const FunASRSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<FunASRConfig | null>(null);
  const [defaultModels, setDefaultModels] = useState<any>(null);
  const [useDefaultModels, setUseDefaultModels] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
    loadDefaultModels();
  }, []);

  const loadConfig = async () => {
    try {
      const result = await getElectronAPI().transcriptConfig.getFunASRConfig();
      if (result.success && result.config) {
        setConfig(result.config);
      } else {
        setConfig(null);
      }
    } catch (error) {
      console.error('Failed to load FunASR config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultModels = async () => {
    try {
      const result = await getElectronAPI().transcriptConfig.getDefaultModels();
      if (result.success && result.models) {
        setDefaultModels(result.models);
      }
    } catch (error) {
      console.error('Failed to load default models:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configToSave = useDefaultModels
        ? {
            ...defaultModels,
            device: config?.device || 'cpu',
            maxSingleSegmentTime: config?.maxSingleSegmentTime || 60000,
          }
        : config;

      const result = await getElectronAPI().transcriptConfig.setFunASRConfig(configToSave || {});
      if (result.success) {
        alert('FunASR 配置保存成功');
        await loadConfig();
      } else {
        alert(`保存失败: ${result.error}`);
      }
    } catch (error) {
      alert(`保存失败: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="useDefaultModels"
          checked={useDefaultModels}
          onChange={(e) => setUseDefaultModels(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="useDefaultModels" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
          使用默认模型路径
        </label>
      </div>

      {useDefaultModels ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            使用内置的 FunASR 模型，无需手动配置路径。
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• ASR 模型: paraformer-large</li>
            <li>• VAD 模型: fsmn_vad</li>
            <li>• 标点模型: ct-transformer</li>
            <li>• 说话人模型: campplus</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="ASR 模型路径"
            value={config?.model || ''}
            onChange={(e) => setConfig({ ...config!, model: e.target.value })}
            placeholder="/path/to/paraformer-large"
          />
          <Input
            label="VAD 模型路径 (可选)"
            value={config?.vadModel || ''}
            onChange={(e) => setConfig({ ...config!, vadModel: e.target.value })}
            placeholder="/path/to/fsmn_vad"
          />
          <Input
            label="标点模型路径 (可选)"
            value={config?.puncModel || ''}
            onChange={(e) => setConfig({ ...config!, puncModel: e.target.value })}
            placeholder="/path/to/ct-transformer"
          />
          <Input
            label="说话人模型路径 (可选)"
            value={config?.spkModel || ''}
            onChange={(e) => setConfig({ ...config!, spkModel: e.target.value })}
            placeholder="/path/to/campplus"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          计算设备
        </label>
        <select
          value={config?.device || 'cpu'}
          onChange={(e) => setConfig({ ...config!, device: e.target.value as 'cpu' | 'cuda' })}
          className="input w-full"
        >
          <option value="cpu">CPU</option>
          <option value="cuda">CUDA (需要 GPU)</option>
        </select>
      </div>

      <Input
        type="number"
        label="最大单段时长 (秒)"
        value={(config?.maxSingleSegmentTime || 60000) / 1000}
        onChange={(e) =>
          setConfig({ ...config!, maxSingleSegmentTime: Number(e.target.value) * 1000 })
        }
        min={10}
        max={300}
      />

      <div className="pt-4">
        <Button onClick={handleSave} loading={saving}>
          保存配置
        </Button>
      </div>
    </div>
  );
};

const AliyunSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<AliyunConfig>({
    apiKey: '',
    baseURL: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'paraformer-v2',
    speakerCount: 2,
    disfluencyRemoval: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const result = await getElectronAPI().transcriptConfig.getAliyunConfig();
      if (result.success && result.config) {
        setConfig(result.config);
      }
    } catch (error) {
      console.error('Failed to load Aliyun config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await getElectronAPI().transcriptConfig.setAliyunConfig(config);
      if (result.success) {
        alert('阿里云配置保存成功');
        await loadConfig();
      } else {
        alert(`保存失败: ${result.error}`);
      }
    } catch (error) {
      alert(`保存失败: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await getElectronAPI().transcriptConfig.testAliyunAPI();
      if (result.success) {
        alert(`✓ ${result.message}`);
      } else {
        alert(`✗ ${result.error}`);
      }
    } catch (error) {
      alert(`测试失败: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <Input
        type="password"
        label="API Key"
        value={config.apiKey || ''}
        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
        placeholder="请输入阿里云 DashScope API Key"
        helper={
          <span>
            获取 API Key:{' '}
            <a
              href="https://dashscope.console.aliyun.com/apiKey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              阿里云控制台
            </a>
          </span>
        }
      />

      <Input
        label="API 基础 URL"
        value={config.baseURL || ''}
        onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          模型版本
        </label>
        <select
          value={config.model || 'paraformer-v2'}
          onChange={(e) => setConfig({ ...config, model: e.target.value as any })}
          className="input w-full"
        >
          <option value="paraformer-v2">Paraformer V2 (推荐)</option>
          <option value="paraformer-v1">Paraformer V1</option>
        </select>
      </div>

      <Input
        type="number"
        label="默认说话人数量"
        value={config.speakerCount || 2}
        onChange={(e) => setConfig({ ...config, speakerCount: Number(e.target.value) })}
        min={1}
        max={10}
      />

      <div className="flex items-center">
        <input
          type="checkbox"
          id="disfluencyRemoval"
          checked={config.disfluencyRemoval !== false}
          onChange={(e) => setConfig({ ...config, disfluencyRemoval: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="disfluencyRemoval" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
          去除口语化表达
        </label>
      </div>

      <div className="pt-4 flex gap-4">
        <Button onClick={handleSave} loading={saving}>
          保存配置
        </Button>
        <Button onClick={handleTest} loading={testing} disabled={!config.apiKey} variant="secondary">
          {testing ? '测试中...' : '测试连接'}
        </Button>
      </div>
    </div>
  );
};

const GeneralSettingsPanel: React.FC = () => {
  const [defaultService, setDefaultService] = useState<'funasr' | 'aliyun'>('funasr');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDefaultService();
  }, []);

  const loadDefaultService = async () => {
    try {
      const result = await getElectronAPI().transcriptConfig.getDefaultService();
      if (result.success && result.service) {
        setDefaultService(result.service);
      }
    } catch (error) {
      console.error('Failed to load default service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await getElectronAPI().transcriptConfig.setDefaultService(defaultService);
      if (result.success) {
        alert('默认服务设置成功');
      } else {
        alert(`设置失败: ${result.error}`);
      }
    } catch (error) {
      alert(`设置失败: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const result = await getElectronAPI().transcriptConfig.exportConfig();
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
    } catch (error) {
      alert(`导出失败: ${error}`);
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
            const result = await getElectronAPI().transcriptConfig.importConfig(config);
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

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          默认转写服务
        </label>
        <select
          value={defaultService}
          onChange={(e) => setDefaultService(e.target.value as any)}
          className="input w-full"
        >
          <option value="funasr">FunASR (本地)</option>
          <option value="aliyun">阿里云 API</option>
        </select>
      </div>

      <div className="pt-4">
        <Button onClick={handleSave} loading={saving}>
          保存设置
        </Button>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      <div>
        <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">配置管理</h4>
        <div className="flex gap-4">
          <Button onClick={handleExport} variant="secondary">
            导出配置
          </Button>
          <Button onClick={handleImport} variant="secondary">
            导入配置
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptSettings;
