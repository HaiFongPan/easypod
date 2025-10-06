import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { usePlayerStore } from '../../store/playerStore';
import { usePlayQueueStore } from '../../store/playQueueStore';
import ProgressBar from './ProgressBar';
import VolumeControl from './VolumeControl';
import SpeedControl from './SpeedControl';
import PlayPauseButton from '../PlayPauseButton';
import QueuePanel from './QueuePanel';
import { useEpisodeDetailNavigation } from '../../hooks/useEpisodeDetailNavigation';

interface AudioPlayerProps {
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ className }) => {
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const openEpisodeDetail = useEpisodeDetailNavigation();
  const {
    currentEpisode,
    isPlaying,
    position: currentTime,
    duration,
    volume,
    playbackRate,
    isLoading,
    error,
    isMuted,
    setVolume,
    setPlaybackRate,
    toggleMute,
  } = usePlayerStore();

  const {
    playPause,
    seek,
    skipForward,
    skipBackward,
    player,
  } = useAudioPlayer({
    config: {
      volume,
      playbackRate,
      skipForwardSeconds: 10,
      skipBackwardSeconds: 10,
    },
  });
  const queueLength = usePlayQueueStore((state) => state.queue.length);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if no input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          playPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case 'Digit1':
          e.preventDefault();
          setPlaybackRate(1.0);
          break;
        case 'Digit2':
          e.preventDefault();
          setPlaybackRate(1.5);
          break;
        case 'Digit3':
          e.preventDefault();
          setPlaybackRate(2.0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [playPause, skipBackward, skipForward, volume, setVolume, setPlaybackRate]);

  if (!currentEpisode) {
    return (
      <div className={cn(
        'h-20 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center',
        className
      )}>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {queueLength === 0 ? 'Empty Play Queue' : 'No episode selected'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      'h-20 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700',
      'flex items-center px-6 space-x-4',
      className
    )}>
      {/* Episode Info */}
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {currentEpisode.episodeImageUrl && (
          <img
            src={currentEpisode.episodeImageUrl}
            alt={currentEpisode.title}
            className="w-12 h-12 rounded-md object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openEpisodeDetail(currentEpisode)}
            className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
          >
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
              {currentEpisode.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {currentEpisode.feedTitle || 'Unknown Podcast'}
            </p>
          </button>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center gap-4">
        {/* Skip Backward */}
        <button
          onClick={() => skipBackward()}
          disabled={!currentEpisode || isLoading}
          className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Skip backward 10s"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
          </svg>
        </button>

        {/* Play/Pause - 使用 PlayPauseButton */}
        {currentEpisode && (
          <PlayPauseButton
            episode={currentEpisode}
            size="lg"
            variant="default"
          />
        )}

        {/* Skip Forward */}
        <button
          onClick={() => skipForward()}
          disabled={!currentEpisode || isLoading}
          className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Skip forward 10s"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 max-w-md">
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          buffered={player?.buffered}
          onSeek={seek}
          disabled={!currentEpisode || isLoading}
        />
      </div>

      {/* Secondary Controls */}
      <div className="flex items-center space-x-2">
        {/* Speed Control */}
        <SpeedControl
          playbackRate={playbackRate}
          onRateChange={setPlaybackRate}
        />

        {/* Volume Control */}
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={setVolume}
          onMuteToggle={toggleMute}
        />

        {/* Queue Panel Toggle */}
        <div
          className="relative"
          onMouseEnter={() => setIsQueueOpen(true)}
          onMouseLeave={() => setIsQueueOpen(false)}
        >
          <button
            type="button"
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 shadow-sm transition hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-400',
              isQueueOpen && 'border-blue-400 text-blue-600 dark:border-blue-500 dark:text-blue-300'
            )}
            title="Show play queue"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 5a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM4 9a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1zM4 13a1 1 0 011-1h4a1 1 0 110 2H5a1 1 0 01-1-1z" />
            </svg>
            {queueLength > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-500 px-1 text-xs font-bold text-white">
                {queueLength}
              </span>
            )}
          </button>

          {isQueueOpen && <QueuePanel />}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-sm px-4 py-2">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
