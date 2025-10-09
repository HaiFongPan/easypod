import React from 'react';
import { Users } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SpeakerRecognizeToggleProps {
  enabled: boolean;
  speakerCount: number;
  onToggle: (enabled: boolean) => void;
  onCountChange: (count: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SpeakerRecognizeToggle: React.FC<SpeakerRecognizeToggleProps> = ({
  enabled,
  speakerCount,
  onToggle,
  onCountChange,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 9) {
      onCountChange(val);
    }
  };

  const handleCountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) {
      onCountChange(1);
    } else if (val > 9) {
      onCountChange(9);
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800',
        sizeClasses[size],
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className={cn(
          'flex items-center gap-1.5 font-medium transition',
          enabled
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-700 dark:text-gray-300',
        )}
      >
        <Users size={iconSizes[size]} />
        <span>Speaker</span>
      </button>

      {/* Toggle switch */}
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="peer sr-only"
        />
        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></div>
      </label>

      {/* Number input (only shown when enabled) */}
      {enabled && (
        <input
          type="number"
          min={1}
          max={9}
          step={1}
          value={speakerCount}
          onChange={handleCountChange}
          onBlur={handleCountBlur}
          className={cn(
            'w-12 rounded border border-gray-300 bg-white px-2 py-0.5 text-center text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
          )}
        />
      )}
    </div>
  );
};
