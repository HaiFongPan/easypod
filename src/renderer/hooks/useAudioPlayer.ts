import { useEffect, useRef, useCallback } from 'react';
import { AudioPlayer, AudioPlayerConfig, AudioPlayerState } from '../utils/audioPlayer';
import { usePlayerStore } from '../store/playerStore';
import { usePlayQueueStore } from '../store/playQueueStore';
import { useNavigationStore } from '../store/navigationStore';
import { useEpisodeDetailStore } from '../store/episodeDetailStore';
import { Episode } from '../types';

interface UseAudioPlayerOptions {
  config?: Partial<AudioPlayerConfig>;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export const useAudioPlayer = (options: UseAudioPlayerOptions = {}) => {
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const {
    currentEpisode,
    isPlaying,
    position,
    duration,
    volume,
    playbackRate,
    setAudioRef,
    setPosition,
    setDuration,
    setLoading,
    setError,
  } = usePlayerStore();

  // Initialize audio player
  useEffect(() => {
    const defaultConfig: AudioPlayerConfig = {
      volume: 1.0,
      playbackRate: 1.0,
      skipForwardSeconds: 10,
      skipBackwardSeconds: 10,
    };

    const config = { ...defaultConfig, ...options.config };
    audioPlayerRef.current = new AudioPlayer(config);

    // Register audio element with playerStore
    if (audioPlayerRef.current.audioElement) {
      setAudioRef(audioPlayerRef.current.audioElement);
    }

    // Set up event listeners
    const player = audioPlayerRef.current;

    player.on('play', () => {
      options.onPlay?.();
    });

    player.on('pause', () => {
      options.onPause?.();
    });

    player.on('ended', async () => {
      // Save playback state immediately
      await usePlayerStore.getState().savePlaybackState({ immediate: true });

      // Get current episode and queue
      const currentEpisode = usePlayerStore.getState().currentEpisode;
      const { queue, removeFromQueue } = usePlayQueueStore.getState();

      // Remove current episode from queue if it exists
      if (currentEpisode && queue.some(item => item.episodeId === currentEpisode.id)) {
        await removeFromQueue(currentEpisode.id);

        // After removal, play the first episode in the updated queue
        const updatedQueue = usePlayQueueStore.getState().queue;
        if (updatedQueue.length > 0) {
          const nextEpisode = updatedQueue[0].episode;

          // Update detail page if currently on episode-detail view
          const currentView = useNavigationStore.getState().currentView;
          if (currentView === 'episode-detail') {
            useEpisodeDetailStore.getState().setEpisode(nextEpisode);
          }

          usePlayerStore.getState().loadAndPlay(nextEpisode);
        }
      } else {
        // If not in queue, just play next from queue
        const updatedQueue = usePlayQueueStore.getState().queue;
        const currentIndex = usePlayQueueStore.getState().currentIndex;
        const nextIndex = currentIndex + 1;

        if (nextIndex < updatedQueue.length) {
          const nextEpisode = updatedQueue[nextIndex].episode;

          // Update detail page if currently on episode-detail view
          const currentView = useNavigationStore.getState().currentView;
          if (currentView === 'episode-detail') {
            useEpisodeDetailStore.getState().setEpisode(nextEpisode);
          }
        }

        usePlayQueueStore.getState().playNext();
      }

      options.onEnd?.();
    });

    player.on('timeupdate', (state: AudioPlayerState) => {
      setPosition(state.currentTime);
    });

    player.on('durationchange', (state: AudioPlayerState) => {
      setDuration(state.duration);
    });

    player.on('loadstart', () => {
      setLoading(true);
      setError(null);
    });

    player.on('canplay', () => {
      setLoading(false);
    });

    player.on('error', () => {
      const error = new Error('Audio playback error');
      setError(error.message);
      setLoading(false);
      options.onError?.(error);
    });

    // Cleanup on unmount
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.destroy();
      }
    };
  }, []);

  // Sync volume and playback rate from store
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  // Player controls
  const play = useCallback(async () => {
    if (audioPlayerRef.current) {
      try {
        await audioPlayerRef.current.play();
      } catch (error) {
        setError(`Failed to play: ${error}`);
      }
    }
  }, [setError]);

  const pause = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
  }, []);

  const playPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((timeInSeconds: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seek(timeInSeconds);
    }
  }, []);

  const skipForward = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.skipForward();
    }
  }, []);

  const skipBackward = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.skipBackward();
    }
  }, []);

  const loadEpisode = useCallback(async (episode: Episode) => {
    if (audioPlayerRef.current) {
      try {
        setLoading(true);
        setError(null);
        await audioPlayerRef.current.loadEpisode(episode);
      } catch (error) {
        setError(`Failed to load episode: ${error}`);
      } finally {
        setLoading(false);
      }
    }
  }, [setLoading, setError]);

  // Return player controls and state
  return {
    // Controls
    play,
    pause,
    playPause,
    seek,
    skipForward,
    skipBackward,
    loadEpisode,

    // State (from store)
    currentEpisode,
    isPlaying,
    currentTime: position,
    duration,
    volume,
    playbackRate,

    // Direct player access (for advanced use cases)
    player: audioPlayerRef.current,
  };
};
