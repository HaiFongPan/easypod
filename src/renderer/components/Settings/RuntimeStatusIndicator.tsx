import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import Button from '../Button/Button';
import { getElectronAPI } from '../../utils/electron';
import { useToast } from '../Toast/ToastProvider';

type RuntimeStatus = 'ready' | 'uninitialized' | 'error' | 'checking' | 'initializing';

interface RuntimeStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

interface RuntimeStatusIndicatorProps {
  refreshTrigger?: number;
}

export const RuntimeStatusIndicator: React.FC<RuntimeStatusIndicatorProps> = ({
  refreshTrigger,
}) => {
  const [status, setStatus] = useState<RuntimeStatus>('checking');
  const [error, setError] = useState<string | undefined>();
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<RuntimeStep[]>([
    { id: 'check', label: '检查环境', status: 'pending' },
    { id: 'archive', label: '查找 Runtime Archive', status: 'pending' },
    { id: 'extract', label: '解压 Runtime', status: 'pending' },
    { id: 'deps', label: '安装依赖', status: 'pending' },
    { id: 'verify', label: '验证安装', status: 'pending' },
  ]);

  const toast = useToast();

  useEffect(() => {
    checkStatus();
  }, [refreshTrigger]);

  const checkStatus = async () => {
    setStatus('checking');
    try {
      const result = await getElectronAPI().pythonRuntime.getStatus();
      setStatus(result.status);
      setError(result.error);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const parseLogToSteps = (log: string) => {
    const updates: Partial<RuntimeStep>[] = [];

    // 检查环境
    if (log.includes('Checking for embedded Python runtime') || log.includes('检查')) {
      updates.push({ id: 'check', status: 'in_progress' });
    }
    if (log.includes('Runtime root:') || log.includes('Manifest found:')) {
      updates.push({ id: 'check', status: 'completed' });
      updates.push({ id: 'archive', status: 'in_progress' });
    }

    // 查找 Archive
    if (log.includes('Archive found:')) {
      updates.push({ id: 'archive', status: 'completed' });
    }

    // 解压
    if (log.includes('Extracting bundled Python runtime') || log.includes('解压')) {
      updates.push({ id: 'extract', status: 'in_progress' });
      setProgress(30);
    }
    if (log.includes('Extraction completed successfully') || log.includes('✓ Extraction completed')) {
      updates.push({ id: 'extract', status: 'completed' });
      setProgress(60);
    }

    // 查找 Python
    if (log.includes('Searching for Python binary') || log.includes('Python found:')) {
      updates.push({ id: 'deps', status: 'in_progress' });
      setProgress(75);
    }

    // 验证
    if (log.includes('Checking funasr import') || log.includes('funasr import successful')) {
      updates.push({ id: 'verify', status: 'in_progress' });
      setProgress(90);
    }

    // 完成
    if (log.includes('Embedded runtime ready') || log.includes('✅')) {
      updates.push({ id: 'verify', status: 'completed' });
      setProgress(100);
    }

    // 错误
    if (log.includes('❌') || log.includes('Failed') || log.includes('失败')) {
      const currentStep = steps.find(s => s.status === 'in_progress');
      if (currentStep) {
        updates.push({ id: currentStep.id, status: 'error' });
      }
    }

    return updates;
  };

  const handleInitialize = async () => {
    setStatus('initializing');
    setIsExpanded(false);
    setProgress(0);
    setSteps(steps.map(s => ({ ...s, status: 'pending' })));

    toast.info('开始初始化 Python Runtime...');

    // 监听日志
    const removeListener = getElectronAPI().pythonRuntime.onLog((log) => {
      console.log('[Runtime Log]', log);

      const updates = parseLogToSteps(log);
      if (updates.length > 0) {
        setSteps(prev => {
          const next = [...prev];
          updates.forEach(update => {
            const index = next.findIndex(s => s.id === update.id);
            if (index !== -1 && update.status) {
              next[index] = { ...next[index], status: update.status };
            }
          });
          return next;
        });
      }
    });

    try {
      const result = await getElectronAPI().pythonRuntime.initialize();
      removeListener();

      if (result.success) {
        setStatus('ready');
        setProgress(100);
        setSteps(steps.map(s => ({ ...s, status: 'completed' })));
        toast.success('✓ Python Runtime 初始化成功！', 2000);

        // 2 秒后收起
        setTimeout(() => {
          setIsExpanded(false);
          checkStatus();
        }, 2000);
      } else {
        setStatus('error');
        setError(result.error);
        toast.error(`初始化失败: ${result.error}`);
      }
    } catch (err) {
      removeListener();
      setStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`初始化异常: ${message}`);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'ready':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          text: 'Python Runtime 已就绪',
          color: 'text-green-700 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
        };
      case 'uninitialized':
        return {
          icon: <Clock className="w-4 h-4 text-yellow-500" />,
          text: 'Python Runtime 未初始化',
          color: 'text-yellow-700 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          text: 'Python Runtime 异常',
          color: 'text-red-700 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
        };
      case 'initializing':
        return {
          icon: <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />,
          text: '正在初始化 Python Runtime...',
          color: 'text-blue-700 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        };
      case 'checking':
        return {
          icon: <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />,
          text: '检查中...',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        };
    }
  };

  const config = getStatusConfig();

  const getStepIcon = (step: RuntimeStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
    }
  };

  return (
    <div className={`rounded-lg mb-4 transition-colors ${config.bgColor}`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1">
          {config.icon}
          <div className="flex-1">
            <div className={`text-sm font-medium ${config.color}`}>
              {config.text}
            </div>
            {error && !isExpanded && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {status === 'uninitialized' && (
            <Button onClick={handleInitialize} size="sm">
              初始化 Runtime
            </Button>
          )}
          {status === 'error' && !isExpanded && (
            <Button onClick={checkStatus} variant="secondary" size="sm">
              重新检查
            </Button>
          )}
          {status === 'initializing' && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* 展开的进度区域 */}
      {isExpanded && status === 'initializing' && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          {/* 进度条 */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>初始化进度</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* 步骤列表 */}
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-2 text-sm"
              >
                {getStepIcon(step)}
                <span
                  className={`${
                    step.status === 'completed'
                      ? 'text-green-700 dark:text-green-400'
                      : step.status === 'in_progress'
                      ? 'text-blue-700 dark:text-blue-400 font-medium'
                      : step.status === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RuntimeStatusIndicator;
