import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Episode } from '../types';

interface PlayerStore {
  // State
  currentEpisode: Episode | null;
  isPlaying: boolean;
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0-1
  playbackRate: number; // 0.5-3.0
  isLoading: boolean;
  error: string | null;

  // Audio element reference
  audioRef: HTMLAudioElement | null;

  // Actions
  setAudioRef: (audio: HTMLAudioElement) => void;
  loadEpisode: (episode: Episode) => void;
  play: () => void;
  pause: () => void;
  playPause: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentEpisode: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      volume: 1.0,
      playbackRate: 1.0,
      isLoading: false,
      error: null,
      audioRef: null,

      // Actions
      setAudioRef: (audio) => set({ audioRef: audio }),

      loadEpisode: (episode) => {
        const { audioRef } = get();
        set({
          currentEpisode: episode,
          position: episode.lastPositionSec,
          duration: episode.durationSec || 0,
          isLoading: true,
          error: null,
        });

        if (audioRef) {
          audioRef.src = episode.audioUrl;
          audioRef.currentTime = episode.lastPositionSec;
        }
      },

      play: () => {
        const { audioRef } = get();
        if (audioRef) {
          audioRef.play().catch((error) => {
            set({ error: error.message, isLoading: false });
          });
        }
        set({ isPlaying: true });
      },

      pause: () => {
        const { audioRef } = get();
        if (audioRef) {
          audioRef.pause();
        }
        set({ isPlaying: false });
      },

      playPause: () => {
        const { isPlaying } = get();
        if (isPlaying) {
          get().pause();
        } else {
          get().play();
        }
      },

      seek: (position) => {
        const { audioRef, duration } = get();
        const clampedPosition = Math.max(0, Math.min(position, duration));

        if (audioRef) {
          audioRef.currentTime = clampedPosition;
        }
        set({ position: clampedPosition });
      },

      setVolume: (volume) => {
        const { audioRef } = get();
        const clampedVolume = Math.max(0, Math.min(1, volume));

        if (audioRef) {
          audioRef.volume = clampedVolume;
        }
        set({ volume: clampedVolume });
      },

      setPlaybackRate: (rate) => {
        const { audioRef } = get();
        const clampedRate = Math.max(0.5, Math.min(3.0, rate));

        if (audioRef) {
          audioRef.playbackRate = clampedRate;
        }
        set({ playbackRate: clampedRate });
      },

      skipForward: (seconds = 10) => {
        const { position, duration } = get();
        get().seek(Math.min(position + seconds, duration));
      },

      skipBackward: (seconds = 10) => {
        const { position } = get();
        get().seek(Math.max(position - seconds, 0));
      },

      setPosition: (position) => set({ position }),
      setDuration: (duration) => set({ duration }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      reset: () =>
        set({
          currentEpisode: null,
          isPlaying: false,
          position: 0,
          duration: 0,
          isLoading: false,
          error: null,
        }),
    }),
    { name: 'Player Store' }
  )
);