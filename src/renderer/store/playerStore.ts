import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Episode } from './episodesStore';
import { useSettingsStore } from './settingsStore';

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
  isMuted: boolean;

  // Audio element reference
  audioRef: HTMLAudioElement | null;

  // Actions
  setAudioRef: (audio: HTMLAudioElement) => void;
  loadEpisode: (episode: Episode) => void;
  loadAndPlay: (episode: Episode) => void;
  play: () => void;
  pause: () => void;
  playPause: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleMute: () => void;
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
    (set, get) => {
      // Get settings on initialization
      const settings = useSettingsStore.getState();

      return {
        // Initial state
        currentEpisode: null,
        isPlaying: false,
        position: 0,
        duration: 0,
        volume: settings.defaultVolume,
        playbackRate: settings.defaultPlaybackRate,
        isLoading: false,
        error: null,
        isMuted: false,
        audioRef: null,

        // Actions
        setAudioRef: (audio) => set({ audioRef: audio }),

        loadEpisode: (episode) => {
          const { audioRef } = get();
          set({
            currentEpisode: episode,
            position: episode.lastPositionSec || 0,
            duration: episode.durationSec || 0,
            isLoading: true,
            error: null,
          });

          if (audioRef) {
            audioRef.src = episode.audioUrl;
            audioRef.currentTime = episode.lastPositionSec || 0;

            // Set loading to false when audio can play
            const handleCanPlay = () => {
              set({ isLoading: false });
              audioRef.removeEventListener('canplay', handleCanPlay);
            };
            audioRef.addEventListener('canplay', handleCanPlay);
          }
        },

        loadAndPlay: (episode) => {
          get().loadEpisode(episode);
          // Play after a short delay to allow audio to load
          setTimeout(() => {
            get().play();
          }, 100);
        },

        play: () => {
          const { audioRef } = get();
          if (audioRef) {
            audioRef.play()
              .then(() => {
                set({ isPlaying: true, isLoading: false });
              })
              .catch((error) => {
                console.error('Play error:', error);
                set({ error: error.message, isLoading: false, isPlaying: false });
              });
          }
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

        toggleMute: () => {
          const { audioRef } = get();
          if (audioRef) {
            audioRef.muted = !audioRef.muted;
            set({ isMuted: audioRef.muted });
          }
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
      };
    },
    { name: 'Player Store' }
  )
);