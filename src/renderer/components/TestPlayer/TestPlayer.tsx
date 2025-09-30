import React, { useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { mockEpisodes, getRandomEpisode, createTestEpisode } from '../../utils/testData';
import Button from '../Button';
import type { Episode } from '../../store/episodesStore';

interface TestPlayerProps {
  className?: string;
}

const TestPlayer: React.FC<TestPlayerProps> = ({ className }) => {
  const {
    currentEpisode,
    isPlaying,
    position,
    duration,
    volume,
    playbackRate,
    isLoading,
    error,
    loadEpisode,
    play,
    pause,
    seek,
    skipForward,
    skipBackward,
    setVolume,
    setPlaybackRate,
  } = usePlayerStore();

  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  const handleLoadEpisode = async (episode: Episode) => {
    setSelectedEpisode(episode);
    await loadEpisode(episode);
  };

  const handlePlay = async () => {
    if (currentEpisode) {
      await play();
    }
  };

  const handleSeekTest = (percentage: number) => {
    if (duration > 0) {
      const newTime = (percentage / 100) * duration;
      seek(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Audio Player Test Console
      </h2>

      {/* Episode Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Select Test Episode
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {mockEpisodes.map((episode) => (
            <Button
              key={episode.id}
              variant={selectedEpisode?.id === episode.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleLoadEpisode(episode)}
              className="text-left justify-start"
            >
              <div>
                <div className="font-medium truncate">{episode.title}</div>
                <div className="text-xs opacity-75">{formatTime(episode.durationSec || 0)}</div>
              </div>
            </Button>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLoadEpisode(getRandomEpisode())}
          >
            Load Random Episode
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLoadEpisode(createTestEpisode())}
          >
            Create Custom Episode
          </Button>
        </div>
      </div>

      {/* Current Episode Info */}
      {currentEpisode && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
            Current Episode
          </h4>
          <div className="flex items-center gap-3">
            {currentEpisode.episodeImageUrl && (
              <img
                src={currentEpisode.episodeImageUrl}
                alt={currentEpisode.title}
                className="w-16 h-16 rounded-md object-cover"
              />
            )}
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {currentEpisode.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Duration: {formatTime(currentEpisode.durationSec || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Status: {currentEpisode.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Status */}
      <div className="mb-6">
        <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Player Status
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">Playing</div>
            <div className={`text-lg ${isPlaying ? 'text-green-600' : 'text-red-600'}`}>
              {isPlaying ? '▶️' : '⏸️'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">Position</div>
            <div className="text-gray-600 dark:text-gray-400">
              {formatTime(position)} / {formatTime(duration)}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">Volume</div>
            <div className="text-gray-600 dark:text-gray-400">
              {Math.round(volume * 100)}%
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">Speed</div>
            <div className="text-gray-600 dark:text-gray-400">
              {playbackRate}x
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="mt-2 text-yellow-600 dark:text-yellow-400">
            Loading audio...
          </div>
        )}

        {error && (
          <div className="mt-2 text-red-600 dark:text-red-400">
            Error: {error}
          </div>
        )}
      </div>

      {/* Manual Controls for Testing */}
      <div className="mb-6">
        <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Manual Controls (for testing)
        </h4>

        {/* Basic Controls */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="primary"
            size="sm"
            onClick={handlePlay}
            disabled={!currentEpisode || isLoading}
          >
            Play
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={pause}
            disabled={!currentEpisode}
          >
            Pause
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => skipBackward()}
            disabled={!currentEpisode}
          >
            ⏪ -10s
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => skipForward()}
            disabled={!currentEpisode}
          >
            ⏩ +10s
          </Button>
        </div>

        {/* Seek Testing */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
            Seek Test (click to jump to position)
          </div>
          <div className="flex gap-1">
            {[0, 25, 50, 75, 100].map(percentage => (
              <Button
                key={percentage}
                variant="ghost"
                size="sm"
                onClick={() => handleSeekTest(percentage)}
                disabled={!currentEpisode || duration === 0}
                className="flex-1"
              >
                {percentage}%
              </Button>
            ))}
          </div>
        </div>

        {/* Volume Testing */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
            Volume Test
          </div>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map(vol => (
              <Button
                key={vol}
                variant="ghost"
                size="sm"
                onClick={() => setVolume(vol)}
                className="flex-1"
              >
                {Math.round(vol * 100)}%
              </Button>
            ))}
          </div>
        </div>

        {/* Speed Testing */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
            Speed Test
          </div>
          <div className="flex gap-1">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
              <Button
                key={speed}
                variant="ghost"
                size="sm"
                onClick={() => setPlaybackRate(speed)}
                className="flex-1"
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
          Keyboard Shortcuts (focus this window)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800 dark:text-blue-200">
          <div><strong>Space:</strong> Play/Pause</div>
          <div><strong>←/→:</strong> Skip backward/forward</div>
          <div><strong>↑/↓:</strong> Volume up/down</div>
          <div><strong>1/2/3:</strong> Speed 1x/1.5x/2x</div>
        </div>
        <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
          Make sure this window is focused and no input fields are selected.
        </div>
      </div>
    </div>
  );
};

export default TestPlayer;
