import React, { useRef, useCallback, MouseEvent } from 'react';
import { cn } from '../../utils/cn';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered?: TimeRanges;
  onSeek: (time: number) => void;
  className?: string;
  disabled?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  buffered,
  onSeek,
  className,
  disabled = false,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);

  const getProgressPercentage = () => {
    if (!duration || duration === 0) return 0;
    return (currentTime / duration) * 100;
  };

  const getBufferedSegments = () => {
    if (!buffered || !duration) return [];

    const segments: { start: number; end: number }[] = [];
    for (let i = 0; i < buffered.length; i++) {
      segments.push({
        start: (buffered.start(i) / duration) * 100,
        end: (buffered.end(i) / duration) * 100,
      });
    }
    return segments;
  };

  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (disabled || !progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;

    onSeek(Math.max(0, Math.min(seekTime, duration)));
  }, [disabled, duration, onSeek]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = getProgressPercentage();
  const bufferedSegments = getBufferedSegments();

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      {/* Current Time */}
      <span className="text-sm text-gray-600 dark:text-gray-400 font-mono min-w-[4rem] text-right">
        {formatTime(currentTime)}
      </span>

      {/* Progress Bar */}
      <div
        ref={progressRef}
        className={cn(
          'flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-hidden',
          !disabled && 'cursor-pointer hover:h-3 transition-all duration-150'
        )}
        onClick={handleClick}
      >
        {/* Buffered segments */}
        {bufferedSegments.map((segment, index) => (
          <div
            key={index}
            className="absolute top-0 h-full bg-gray-300 dark:bg-gray-600"
            style={{
              left: `${segment.start}%`,
              width: `${segment.end - segment.start}%`,
            }}
          />
        ))}

        {/* Progress fill */}
        <div
          className="absolute top-0 left-0 h-full bg-primary-600 transition-all duration-150 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />

        {/* Progress thumb */}
        {!disabled && (
          <div
            className="absolute top-1/2 w-3 h-3 bg-primary-600 rounded-full transform -translate-y-1/2 -translate-x-1/2 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-150"
            style={{ left: `${progressPercentage}%` }}
          />
        )}
      </div>

      {/* Duration */}
      <span className="text-sm text-gray-600 dark:text-gray-400 font-mono min-w-[4rem]">
        {duration ? formatTime(duration) : '--:--'}
      </span>
    </div>
  );
};

export default ProgressBar;