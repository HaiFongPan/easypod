import React, { useState } from 'react';
import { cn } from '../utils/cn';
import { Episode } from '../store/episodesStore';
import { usePlayQueueStore } from '../store/playQueueStore';

type QueuePlacement = 'start' | 'end';

type QueueAddButtonSize = 'sm' | 'md' | 'lg';

type QueueAddButtonProps = {
  episode: Episode;
  placement: QueuePlacement;
  size?: QueueAddButtonSize;
  className?: string;
  stopPropagation?: boolean;
};

const sizeClasses: Record<QueueAddButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizeClasses: Record<QueueAddButtonSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const iconPaths: Record<QueuePlacement, string[]> = {
  start: [
    'M3 5h6',
    'M3 12h13',
    'M3 19h13',
    'm16 8-3-3 3-3',
    'M21 19V7a2 2 0 0 0-2-2h-6',
  ],
  end: [
    'M16 5H3',
    'M16 12H3',
    'M9 19H3',
    'm16 16-3 3 3 3',
    'M21 5v12a2 2 0 0 1-2 2h-6',
  ],
};

export const QueueAddButton: React.FC<QueueAddButtonProps> = ({
  episode,
  placement,
  size = 'md',
  className = '',
  stopPropagation = true,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { addToQueueStart, addToQueueEnd, isInQueue } = usePlayQueueStore((state) => ({
    addToQueueStart: state.addToQueueStart,
    addToQueueEnd: state.addToQueueEnd,
    isInQueue: state.queue.some((item) => item.episodeId === episode.id),
  }));

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.stopPropagation();
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      if (placement === 'start') {
        await addToQueueStart(episode);
      } else {
        await addToQueueEnd(episode);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const title = placement === 'start'
    ? isInQueue ? `Move "${episode.title}" to queue start` : `Add "${episode.title}" to queue start`
    : isInQueue ? `Move "${episode.title}" to queue end` : `Add "${episode.title}" to queue end`;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      disabled={isLoading}
      className={cn(
        sizeClasses[size],
        'flex items-center justify-center rounded-full bg-transparent text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className,
      )}
    >
      {isLoading ? (
        <svg
          className={cn(iconSizeClasses[size], 'animate-spin')}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V2C5.373 2 2 5.373 2 9.5c0 .69.07 1.366.204 2.019L4 12z"
          />
        </svg>
      ) : (
        <svg
          className={iconSizeClasses[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          {iconPaths[placement].map((path, index) => (
            <path key={index} d={path} />
          ))}
        </svg>
      )}
    </button>
  );
};

export default QueueAddButton;
