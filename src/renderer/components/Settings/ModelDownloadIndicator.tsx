import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Download, X, RefreshCw } from 'lucide-react';
import Button from '../Button/Button';
import { useTranscriptStore, ModelDownloadState } from '../../store/transcriptStore';
import { useToast } from '../Toast/ToastProvider';

interface ModelDownloadIndicatorProps {
  modelIds: string[];
  modelNames: Record<string, string>; // modelId -> displayName mapping
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
  return `${Math.round(seconds / 3600)}小时`;
};

export const ModelDownloadIndicator: React.FC<ModelDownloadIndicatorProps> = ({
  modelIds,
  modelNames,
}) => {
  const { models, loadModelStatus, downloadModel, cancelDownload } = useTranscriptStore();
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const toast = useToast();

  useEffect(() => {
    // Load initial status for all models
    loadModelStatus(modelIds);
  }, [modelIds]);

  const toggleExpanded = (modelId: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleDownload = async (modelId: string) => {
    const success = await downloadModel(modelId);
    if (success) {
      toast.success(`开始下载模型: ${modelNames[modelId] || modelId}`);
      setExpandedModels((prev) => new Set(prev).add(modelId));
    } else {
      toast.error(`下载失败: ${models[modelId]?.errorMessage || '未知错误'}`);
    }
  };

  const handleCancel = async (modelId: string) => {
    const success = await cancelDownload(modelId);
    if (success) {
      toast.info(`已取消下载: ${modelNames[modelId] || modelId}`);
    }
  };

  const getModelStatusConfig = (model: ModelDownloadState | undefined) => {
    if (!model) {
      return {
        icon: <AlertCircle className="w-4 h-4 text-gray-400" />,
        text: '未下载',
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      };
    }

    switch (model.status) {
      case 'completed':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          text: '已下载',
          color: 'text-green-700 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
        };
      case 'downloading':
        return {
          icon: (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ),
          text: '下载中',
          color: 'text-blue-700 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          text: '下载失败',
          color: 'text-red-700 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
        };
      default:
        return {
          icon: <Download className="w-4 h-4 text-gray-400" />,
          text: '未下载',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        };
    }
  };

  const renderModelItem = (modelId: string) => {
    const model = models[modelId];
    const config = getModelStatusConfig(model);
    const isExpanded = expandedModels.has(modelId);
    const displayName = modelNames[modelId] || modelId;

    return (
      <div
        key={modelId}
        className={`rounded-lg mb-3 transition-colors border ${config.bgColor} ${
          model?.status === 'downloading'
            ? 'border-blue-200 dark:border-blue-800'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 flex-1">
            {config.icon}
            <div className="flex-1">
              <div className={`text-sm font-medium ${config.color}`}>{displayName}</div>
              {model?.status === 'downloading' && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {model.progress > 0 && `${model.progress.toFixed(1)}%`}
                  {model.downloadedSize > 0 && (
                    <>
                      {model.progress > 0 && ' · '}
                      {formatBytes(model.downloadedSize)}
                      {model.totalSize > 0 && model.totalSize > model.downloadedSize && (
                        <> / {formatBytes(model.totalSize)}</>
                      )}
                    </>
                  )}
                  {!model.downloadedSize && !model.progress && '下载中...'}
                  {model.speed && model.speed > 0 && ` · ${model.speed.toFixed(2)} MB/s`}
                  {model.estimatedTimeRemaining && ` · 剩余 ${formatTime(model.estimatedTimeRemaining)}`}
                </div>
              )}
              {model?.status === 'failed' && model.errorMessage && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">{model.errorMessage}</div>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {model?.status === 'downloading' && (
              <Button onClick={() => handleCancel(modelId)} variant="secondary" size="sm">
                <X className="w-4 h-4" />
                取消
              </Button>
            )}
            {(model?.status === 'pending' || model?.status === 'failed' || !model) && (
              <Button
                onClick={() => handleDownload(modelId)}
                variant={model?.status === 'failed' ? 'secondary' : 'primary'}
                size="sm"
              >
                <Download className="w-4 h-4" />
                {model?.status === 'failed' ? '重试' : '下载'}
              </Button>
            )}
            {model?.status === 'completed' && (
              <Button onClick={() => handleDownload(modelId)} variant="secondary" size="sm">
                <RefreshCw className="w-4 h-4" />
                重新下载
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar for downloading models */}
        {model?.status === 'downloading' && (
          <div className="px-4 pb-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${model.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Calculate overall status
  const allCompleted = modelIds.every((id) => models[id]?.status === 'completed');
  const anyDownloading = modelIds.some((id) => models[id]?.status === 'downloading');
  const anyFailed = modelIds.some((id) => models[id]?.status === 'failed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">FunASR 模型</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {allCompleted && '所有模型已下载完成'}
            {anyDownloading && '正在下载模型...'}
            {!allCompleted && !anyDownloading && '需要下载以下模型才能使用转写功能'}
          </p>
        </div>
        {allCompleted && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
      </div>

      {/* Info banner */}
      {!allCompleted && !anyDownloading && (
        <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <strong>注意：</strong>下载模型前请确保 Python Runtime 已初始化完成。模型文件较大（约 600MB），下载可能需要几分钟。
        </div>
      )}

      <div className="space-y-2">
        {modelIds.map((modelId) => renderModelItem(modelId))}
      </div>

      {anyFailed && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 p-3 rounded-lg">
          提示: 如果下载失败，请检查：
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Python Runtime 是否已就绪</li>
            <li>网络连接是否正常（需要访问 modelscope.cn）</li>
            <li>是否有足够的磁盘空间（至少 600MB）</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ModelDownloadIndicator;
