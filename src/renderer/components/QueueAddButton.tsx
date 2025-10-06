import React, { useState } from 'react';
import { cn } from '../utils/cn';
import { Episode } from '../store/episodesStore';
import { usePlayQueueStore } from '../store/playQueueStore';

type QueuePlacement = 'next' | 'end';

type QueueAddButtonSize = 'xs' | 'sm' | 'md' | 'lg';

type QueueAddButtonProps = {
  episode: Episode;
  placement: QueuePlacement;
  size?: QueueAddButtonSize;
  className?: string;
  stopPropagation?: boolean;
};

const sizeClasses: Record<QueueAddButtonSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizeClasses: Record<QueueAddButtonSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const iconPaths: Record<QueuePlacement, string[]> = {
  next: [
    'M11 12H3',
    'M16 6H3',
    'M16 18H3',
    'M18 9v6',
    'M21 12h-6',
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
  const { addPlayNext, addToQueueEnd, isInQueue } = usePlayQueueStore((state) => ({
    addPlayNext: state.addPlayNext,
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
      if (placement === 'next') {
        await addPlayNext(episode);
      } else {
        await addToQueueEnd(episode);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const title = placement === 'next'
    ? isInQueue ? `Already in queue` : `Play "${episode.title}" next`
    : isInQueue ? `Already in queue` : `Add "${episode.title}" to queue end`;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      disabled={isLoading || isInQueue}
      className={cn(
        sizeClasses[size],
        'flex items-center justify-center rounded-full bg-transparent transition-colors',
        isInQueue
          ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
          : 'text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300',
        'disabled:cursor-not-allowed disabled:opacity-50',
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
