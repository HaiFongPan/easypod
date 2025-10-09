import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Episode, useEpisodesStore } from './episodesStore';
import { useSettingsStore } from './settingsStore';

const PLAYBACK_SAVE_DEBOUNCE = 10_000;
const PLAYBACK_SAVE_INTERVAL = 5_000; // Auto-save every 5 seconds during playback
let playbackStateTimeout: ReturnType<typeof setTimeout> | null = null;
let playbackSaveInterval: ReturnType<typeof setInterval> | null = null;

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
  loadAndPlay: (episode: Episode, moveToQueueStart?: boolean) => void;
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
  loadPlaybackState: () => Promise<void>;
  savePlaybackState: (options?: { immediate?: boolean }) => Promise<void>;
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
        setAudioRef: (audio) => {
          const { currentEpisode, position } = get();
          if (currentEpisode) {
            audio.src = currentEpisode.audioUrl;
            audio.currentTime = position;
            audio.pause();
          }
          set({ audioRef: audio });
        },

        loadEpisode: (episode) => {
          const { audioRef } = get();

          // Reset position to 0 if episode is completed or archived
          const shouldResetPosition = episode.status === 'played' || episode.status === 'archived';
          const startPosition = shouldResetPosition ? 0 : (episode.lastPositionSec || 0);

          set({
            currentEpisode: episode,
            position: startPosition,
            duration: episode.durationSec || 0,
            isLoading: true,
            error: null,
          });

          void get().savePlaybackState({ immediate: true });

          if (audioRef) {
            audioRef.src = episode.audioUrl;
            audioRef.currentTime = startPosition;

            // Set loading to false when audio can play
            const handleCanPlay = () => {
              set({ isLoading: false });
              audioRef.removeEventListener('canplay', handleCanPlay);
            };
            audioRef.addEventListener('canplay', handleCanPlay);
          }
        },

        loadAndPlay: async (episode, moveToQueueStart = true) => {
          // Move episode to queue start when user manually plays (not from queue navigation)
          if (moveToQueueStart) {
            const { usePlayQueueStore } = await import('./playQueueStore');
            await usePlayQueueStore.getState().moveToQueueStart(episode);
          }

          // Load and play the episode
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
                // Start periodic save when playing
                if (playbackSaveInterval) {
                  clearInterval(playbackSaveInterval);
                }
                playbackSaveInterval = setInterval(() => {
                  void get().savePlaybackState({ immediate: true });
                }, PLAYBACK_SAVE_INTERVAL);
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
          // Stop periodic save when paused
          if (playbackSaveInterval) {
            clearInterval(playbackSaveInterval);
            playbackSaveInterval = null;
          }
          void get().savePlaybackState({ immediate: true });
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

        setPosition: (position) => {
          set({ position });
          // Don't save here - periodic save will handle it during playback
        },
        setDuration: (duration) => set({ duration }),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),

        loadPlaybackState: async () => {
          try {
            const result = await window.electronAPI.playbackState.get();
            if (!result || !result.state) {
              return;
            }

            const { state, episode } = result;
            if (!episode) {
              return;
            }

            const restoredPosition = state.currentPosition ?? episode.lastPositionSec ?? 0;

            set({
              currentEpisode: episode as Episode,
              position: restoredPosition,
              duration: episode.durationSec || 0,
              isPlaying: false,
              isLoading: false,
              error: null,
            });

            const { audioRef } = get();
            if (audioRef) {
              audioRef.src = episode.audioUrl;
              audioRef.currentTime = restoredPosition;
              audioRef.pause();
            }
          } catch (error) {
            console.error('[PlayerStore] Failed to load playback state', error);
          }
        },

        savePlaybackState: async (options = {}) => {
          const { immediate = false } = options;

          const performSave = async () => {
            const { currentEpisode, position, duration } = get();
            const episodeId = currentEpisode ? currentEpisode.id : null;
            const clampedPosition = Number.isFinite(position) && position > 0 ? Math.floor(position) : 0;

            try {
              // Pass duration to enable episode progress update
              await window.electronAPI.playbackState.save(episodeId, clampedPosition, duration);

              // Update local episode state after successful save
              if (episodeId && duration > 0) {
                const progressPercentage = (clampedPosition / duration) * 100;
                let newStatus: Episode['status'];

                if (clampedPosition === 0) {
                  newStatus = 'new';
                } else if (progressPercentage >= 95) {
                  newStatus = 'archived';
                } else {
                  newStatus = 'in_progress';
                }

                // Sync local state with database
                useEpisodesStore.getState().updateLocalEpisode(episodeId, {
                  lastPositionSec: clampedPosition,
                  status: newStatus,
                  lastPlayedAt: new Date().toISOString(),
                });
              }
            } catch (error) {
              console.error('[PlayerStore] Failed to save playback state', error);
            }
          };

          if (immediate) {
            if (playbackStateTimeout) {
              clearTimeout(playbackStateTimeout);
              playbackStateTimeout = null;
            }
            await performSave();
            return;
          }

          if (playbackStateTimeout) {
            clearTimeout(playbackStateTimeout);
          }

          playbackStateTimeout = setTimeout(() => {
            void performSave().finally(() => {
              playbackStateTimeout = null;
            });
          }, PLAYBACK_SAVE_DEBOUNCE);
        },

        reset: () => {
          // Clear periodic save interval
          if (playbackSaveInterval) {
            clearInterval(playbackSaveInterval);
            playbackSaveInterval = null;
          }
          set({
            currentEpisode: null,
            isPlaying: false,
            position: 0,
            duration: 0,
            isLoading: false,
            error: null,
          });
          void get().savePlaybackState({ immediate: true });
        },
      };
    },
    { name: 'Player Store' }
  )
);
