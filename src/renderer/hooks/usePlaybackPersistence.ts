import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useEpisodesStore } from '../store/episodesStore';

/**
 * Hook to handle playback state persistence
 * Auto-saves progress every 5 seconds during playback
 * Updates episode status based on progress percentage
 */
export function usePlaybackPersistence() {
  const { currentEpisode, position, duration, isPlaying } = usePlayerStore();
  const { updateEpisodeProgress } = useEpisodesStore();

  const lastSavedPosition = useRef<number>(0);
  const saveInterval = useRef<NodeJS.Timeout | null>(null);

  // Auto-save progress every 5 seconds during playback
  useEffect(() => {
    if (!currentEpisode || !isPlaying) {
      // Clear interval when not playing
      if (saveInterval.current) {
        clearInterval(saveInterval.current);
        saveInterval.current = null;
      }
      return;
    }

    // Set up interval to save progress every 5 seconds
    saveInterval.current = setInterval(() => {
      const currentPosition = position;

      // Only save if position has changed significantly (> 2 seconds)
      if (Math.abs(currentPosition - lastSavedPosition.current) > 2) {
        savePlaybackProgress(currentEpisode.id, currentPosition, duration);
        lastSavedPosition.current = currentPosition;
      }
    }, 5000); // 5 seconds

    return () => {
      if (saveInterval.current) {
        clearInterval(saveInterval.current);
      }
    };
  }, [currentEpisode, isPlaying, position, duration]);

  // Save progress when episode changes or component unmounts
  useEffect(() => {
    return () => {
      if (currentEpisode && position > 0) {
        savePlaybackProgress(currentEpisode.id, position, duration);
      }
    };
  }, [currentEpisode?.id]);

  // Helper function to save playback progress
  const savePlaybackProgress = async (
    episodeId: number,
    currentPosition: number,
    totalDuration: number
  ) => {
    if (totalDuration === 0) return;

    const progressPercentage = (currentPosition / totalDuration) * 100;
    let newStatus: string | undefined;

    // Determine episode status based on progress
    if (progressPercentage < 5) {
      newStatus = 'new'; // Less than 5% played
    } else if (progressPercentage >= 95) {
      newStatus = 'played'; // More than 95% played
    } else {
      newStatus = 'in_progress'; // Between 5% and 95%
    }

    console.log(
      `[Playback Persistence] Saving episode ${episodeId} progress: ${currentPosition.toFixed(1)}s / ${totalDuration.toFixed(1)}s (${progressPercentage.toFixed(1)}%) - Status: ${newStatus}`
    );

    try {
      await updateEpisodeProgress(episodeId, currentPosition, newStatus);
    } catch (error) {
      console.error('Failed to save playback progress:', error);
    }
  };

  // Manual save function that can be called externally
  const saveNow = () => {
    if (currentEpisode && position > 0) {
      savePlaybackProgress(currentEpisode.id, position, duration);
      lastSavedPosition.current = position;
    }
  };

  return { saveNow };
}