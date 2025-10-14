import React, { useEffect, useState } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import Button from './Button/Button';
import { validateTranscriptReadiness, TranscriptValidationResult } from '../utils/transcriptValidation';

interface TranscriptGuardProps {
  children: React.ReactNode;
  serviceType?: 'funasr' | 'aliyun';
  onValidationChange?: (result: TranscriptValidationResult) => void;
  onNavigateToSettings?: () => void;
}

/**
 * Guard component that validates transcript prerequisites before allowing access
 */
export const TranscriptGuard: React.FC<TranscriptGuardProps> = ({
  children,
  serviceType = 'funasr',
  onValidationChange,
  onNavigateToSettings,
}) => {
  const [validation, setValidation] = useState<TranscriptValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    checkValidation();
  }, [serviceType]);

  const checkValidation = async () => {
    setIsValidating(true);
    const result = await validateTranscriptReadiness(serviceType);
    setValidation(result);
    setIsValidating(false);

    if (onValidationChange) {
      onValidationChange(result);
    }
  };

  const handleGoToSettings = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  if (isValidating) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600 dark:text-gray-400">检查转录环境...</div>
      </div>
    );
  }

  if (!validation?.canProceed) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="w-8 h-8" />
          <h3 className="text-lg font-semibold">转录环境未就绪</h3>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-2xl">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            {validation?.message || '无法开始转录'}
          </p>

          {validation?.details && (
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-3">
              <div className="flex items-center gap-2">
                <span className={validation.details.runtimeReady ? 'text-green-600' : 'text-red-600'}>
                  {validation.details.runtimeReady ? '✓' : '✗'}
                </span>
                <span>Python Runtime</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={validation.details.modelsReady ? 'text-green-600' : 'text-red-600'}>
                  {validation.details.modelsReady ? '✓' : '✗'}
                </span>
                <span>FunASR 模型</span>
              </div>
            </div>
          )}

          <Button onClick={handleGoToSettings} size="sm" className="w-full">
            <Settings className="w-4 h-4" />
            前往设置
          </Button>
        </div>

        <button
          onClick={checkValidation}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          重新检查
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default TranscriptGuard;
