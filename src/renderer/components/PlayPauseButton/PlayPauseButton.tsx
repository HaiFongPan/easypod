import React from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Episode } from '../../store/episodesStore';

export interface PlayPauseButtonProps {
  episode: Episode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal';
  className?: string;
  showTooltip?: boolean;
}

const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  episode,
  size = 'md',
  variant = 'default',
  className = '',
  showTooltip = false,
}) => {
  const { currentEpisode, isPlaying, isLoading, loadAndPlay, playPause } = usePlayerStore(
    (state) => ({
      currentEpisode: state.currentEpisode,
      isPlaying: state.isPlaying,
      isLoading: state.isLoading,
      loadAndPlay: state.loadAndPlay,
      playPause: state.playPause,
    })
  );

  // Determine if this episode is currently playing
  const isCurrentEpisode = currentEpisode?.id === episode.id;
  const shouldShowPause = isCurrentEpisode && isPlaying;
  const shouldShowLoading = isCurrentEpisode && isLoading;

  // Size classes for button and icon
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  // Variant styles - 更简约的设计，只有图标，没有背景
  const variantClasses = {
    default: 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
    minimal: 'text-white hover:text-gray-100 dark:text-white dark:hover:text-gray-200',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click handlers
    if (isCurrentEpisode) {
      playPause(); // Toggle if same episode
    } else {
      loadAndPlay(episode); // Load and play if different episode
    }
  };

  const buttonTitle = shouldShowPause
    ? `Pause ${episode.title}`
    : `Play ${episode.title}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={showTooltip ? buttonTitle : undefined}
      aria-label={buttonTitle}
      disabled={shouldShowLoading}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        flex items-center justify-center
        transition-colors duration-150
        focus:outline-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {shouldShowLoading ? (
        // Loading spinner
        <svg
          className={`${iconSizes[size]} animate-spin`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : shouldShowPause ? (
        // Pause icon (filled circle with pause bars)
        <svg
          className={iconSizes[size]}
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // Play icon (filled circle with play triangle)
        <svg
          className={iconSizes[size]}
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
};

export default PlayPauseButton;
