import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { usePlayerStore } from '../../store/playerStore';
import ProgressBar from './ProgressBar';
import VolumeControl from './VolumeControl';
import SpeedControl from './SpeedControl';
import Button from '../Button';
import Loading from '../Loading';

interface AudioPlayerProps {
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ className }) => {
  const {
    currentEpisode,
    isPlaying,
    position: currentTime,
    duration,
    volume,
    playbackRate,
    isLoading,
    error,
    setVolume,
    setPlaybackRate,
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

  const handleMuteToggle = () => {
    if (player) {
      player.toggleMute();
    }
  };

  if (!currentEpisode) {
    return (
      <div className={cn(
        'h-20 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center',
        className
      )}>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No episode selected
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
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {currentEpisode.title}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Podcast Episode {/* TODO: Get feed name */}
          </p>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center space-x-2">
        {/* Skip Backward */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => skipBackward()}
          disabled={!currentEpisode || isLoading}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
            </svg>
          }
          title="Skip backward 10s"
        />

        {/* Play/Pause */}
        <Button
          variant="primary"
          size="md"
          onClick={playPause}
          disabled={!currentEpisode}
          loading={isLoading}
          className="w-12 h-12 rounded-full"
          icon={
            isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )
          }
          title={isPlaying ? 'Pause' : 'Play'}
        />

        {/* Skip Forward */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => skipForward()}
          disabled={!currentEpisode || isLoading}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
            </svg>
          }
          title="Skip forward 10s"
        />
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
          isMuted={player?.isMuted || false}
          onVolumeChange={setVolume}
          onMuteToggle={handleMuteToggle}
        />
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
