import { getElectronAPI } from './electron';

export interface TranscriptValidationResult {
  canProceed: boolean;
  redirectTo?: string;
  message?: string;
  details?: {
    runtimeReady: boolean;
    modelsReady: boolean;
    missingModels?: string[];
  };
}

/**
 * Validate that all prerequisites are met before starting transcription
 */
export async function validateTranscriptReadiness(
  serviceType: 'funasr' | 'aliyun' = 'funasr'
): Promise<TranscriptValidationResult> {
  const electronAPI = getElectronAPI();

  // For Aliyun service, only check API key configuration
  if (serviceType === 'aliyun') {
    try {
      const configResult = await electronAPI.transcriptConfig.getAliyunConfig();
      if (!configResult.success || !configResult.config || !configResult.config.apiKey) {
        return {
          canProceed: false,
          redirectTo: '/settings?tab=transcript',
          message: '阿里云 API 未配置,请先配置 API Key',
        };
      }
      return { canProceed: true, details: { runtimeReady: true, modelsReady: true } };
    } catch (error) {
      return {
        canProceed: false,
        message: '检查阿里云配置时出错',
      };
    }
  }

  // For FunASR service, check Python Runtime and models
  try {
    // 1. Check Python Runtime status
    const runtimeStatus = await electronAPI.pythonRuntime.getStatus();
    if (runtimeStatus.status !== 'ready') {
      return {
        canProceed: false,
        redirectTo: '/settings?tab=transcript',
        message: 'Python Runtime 未就绪,请先初始化运行环境',
        details: {
          runtimeReady: false,
          modelsReady: false,
        },
      };
    }

    // 2. Get default model IDs
    const modelsResult = await electronAPI.transcriptConfig.getDefaultModels();
    if (!modelsResult.success || !modelsResult.models) {
      return {
        canProceed: false,
        message: '无法获取模型配置',
        details: {
          runtimeReady: true,
          modelsReady: false,
        },
      };
    }

    const { model, vadModel, puncModel, spkModel } = modelsResult.models;
    const requiredModels = [model, vadModel, puncModel, spkModel];

    // 3. Check all model statuses
    const modelStatusResult = await electronAPI.transcriptModel.getAllStatus(requiredModels);
    if (!modelStatusResult.success || !modelStatusResult.status) {
      return {
        canProceed: false,
        redirectTo: '/settings?tab=transcript',
        message: '无法获取模型状态',
        details: {
          runtimeReady: true,
          modelsReady: false,
        },
      };
    }

    // 4. Verify all models are downloaded
    const modelStatuses = modelStatusResult.status;
    const missingModels: string[] = [];

    requiredModels.forEach((modelId) => {
      const status = modelStatuses[modelId];
      if (!status || status.status !== 'completed') {
        missingModels.push(modelId);
      }
    });

    if (missingModels.length > 0) {
      const modelNames: Record<string, string> = {
        [model]: 'ASR 模型',
        [vadModel]: 'VAD 模型',
        [puncModel]: '标点模型',
        [spkModel]: '说话人模型',
      };

      const missingNames = missingModels.map((id) => modelNames[id] || id).join('、');

      return {
        canProceed: false,
        redirectTo: '/settings?tab=transcript',
        message: `FunASR 模型未下载完成 (缺少: ${missingNames}),请先下载所需模型`,
        details: {
          runtimeReady: true,
          modelsReady: false,
          missingModels,
        },
      };
    }

    // All checks passed
    return {
      canProceed: true,
      details: {
        runtimeReady: true,
        modelsReady: true,
      },
    };
  } catch (error) {
    console.error('[TranscriptValidation] Error:', error);
    return {
      canProceed: false,
      message: error instanceof Error ? error.message : '验证转录环境时出错',
    };
  }
}
