import React, { useState, useRef, useCallback, MouseEvent } from 'react';
import { cn } from '../../utils/cn';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  className?: string;
}

const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  className,
}) => {
  const [showSlider, setShowSlider] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.784L4.618 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.618l3.765-3.784a1 1 0 011.09-.14zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    } else if (volume < 0.3) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.784L4.618 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.618l3.765-3.784a1 1 0 011.09-.14z" clipRule="evenodd" />
        </svg>
      );
    } else if (volume < 0.7) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.784L4.618 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.618l3.765-3.784a1 1 0 011.09-.14zm2.126 4.104A1 1 0 0113 8v4a1 1 0 01-1.49.88 4 4 0 010-5.76z" clipRule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.784L4.618 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.618l3.765-3.784a1 1 0 011.09-.14zm8.048 1.414a1 1 0 010 1.414 7 7 0 010 9.192 1 1 0 11-1.414-1.414 5 5 0 000-6.364 1 1 0 011.414-1.414zm-2.829 2.828a1 1 0 010 1.415 3 3 0 010 3.536 1 1 0 01-1.414-1.415 1 1 0 000-0.707 1 1 0 011.414-1.415z" clipRule="evenodd" />
        </svg>
      );
    }
  };

  const handleVolumeClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;

    const rect = volumeRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const percentage = 1 - (clickY / rect.height); // Invert because we want top = high volume
    const newVolume = Math.max(0, Math.min(1, percentage));

    onVolumeChange(newVolume);
  }, [onVolumeChange]);

  const displayVolume = isMuted ? 0 : volume;

  return (
    <div
      className={cn('relative flex items-center', className)}
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      {/* Volume Icon */}
      <button
        onClick={onMuteToggle}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {getVolumeIcon()}
      </button>

      {/* Volume Slider */}
      {showSlider && (
        <div className="absolute left-full ml-2 bottom-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 animate-fade-in">
          <div
            ref={volumeRef}
            className="w-6 h-20 bg-gray-200 dark:bg-gray-700 rounded-full relative cursor-pointer"
            onClick={handleVolumeClick}
          >
            {/* Volume fill */}
            <div
              className="absolute bottom-0 left-0 w-full bg-primary-600 rounded-full transition-all duration-150"
              style={{ height: `${displayVolume * 100}%` }}
            />

            {/* Volume thumb */}
            <div
              className="absolute w-4 h-4 bg-primary-600 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
              style={{
                left: '50%',
                bottom: `${displayVolume * 100}%`
              }}
            />
          </div>

          {/* Volume percentage */}
          <div className="text-xs text-center mt-1 text-gray-600 dark:text-gray-400">
            {Math.round(displayVolume * 100)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumeControl;