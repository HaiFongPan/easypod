import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getElectronAPI } from '../utils/electron';
import { PlayerState, LibraryState, SettingsState, UIState } from '../types';

interface AppState {
  // App info
  version: string;
  platform: string;

  // State slices
  player: PlayerState;
  library: LibraryState;
  settings: SettingsState;
  ui: UIState;

  // Actions
  initialize: () => Promise<void>;
  setVersion: (version: string) => void;
  setPlatform: (platform: string) => void;

  // Player actions
  playPause: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setCurrentEpisode: (episode: any) => void;

  // Library actions
  addFeed: (feed: any) => void;
  removeFeed: (feedId: string) => void;
  updateFeed: (feedId: string, updates: any) => void;
  setSearchQuery: (query: string) => void;

  // Settings actions
  toggleDarkMode: () => void;
  updateSettings: (updates: Partial<SettingsState>) => void;

  // UI actions
  toggleSidebar: () => void;
  setActivePanel: (panel: UIState['activePanel']) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        version: '0.1.0',
        platform: 'darwin',

        player: {
          currentEpisode: null,
          isPlaying: false,
          position: 0,
          duration: 0,
          volume: 1.0,
          playbackRate: 1.0,
          isLoading: false,
          error: null,
        },

        library: {
          feeds: [],
          episodes: [],
          currentFeed: null,
          searchQuery: '',
          isLoading: false,
          error: null,
        },

        settings: {
          darkMode: false,
          mediaKeys: true,
          jumpSeconds: 10,
          defaultPlaybackRate: 1.0,
          downloadDirectory: '~/Downloads/EasyPod',
          autoRefreshInterval: 60,
          asrModel: 'standard',
          asrDevice: 'cpu',
          asrConcurrency: 2,
          aiProviders: [],
          activeAIProvider: null,
        },

        ui: {
          sidebarCollapsed: false,
          activePanel: 'episodes',
          showTranscript: false,
          showChapters: true,
          modalStack: [],
        },

        // Actions
        initialize: async () => {
          try {
            const electron = getElectronAPI();
            const [version, platform] = await Promise.all([
              electron.getAppVersion(),
              electron.getPlatform(),
            ]);

            set((state) => ({
              ...state,
              version,
              platform,
            }));
          } catch (error) {
            console.error('Failed to initialize app:', error);
          }
        },

        setVersion: (version) => set((state) => ({ ...state, version })),
        setPlatform: (platform) => set((state) => ({ ...state, platform })),

        // Player actions
        playPause: () =>
          set((state) => ({
            ...state,
            player: {
              ...state.player,
              isPlaying: !state.player.isPlaying,
            },
          })),

        seek: (position) =>
          set((state) => ({
            ...state,
            player: {
              ...state.player,
              position: Math.max(0, Math.min(position, state.player.duration)),
            },
          })),

        setVolume: (volume) =>
          set((state) => ({
            ...state,
            player: {
              ...state.player,
              volume: Math.max(0, Math.min(1, volume)),
            },
          })),

        setPlaybackRate: (rate) =>
          set((state) => ({
            ...state,
            player: {
              ...state.player,
              playbackRate: Math.max(0.5, Math.min(3.0, rate)),
            },
          })),

        setCurrentEpisode: (episode) =>
          set((state) => ({
            ...state,
            player: {
              ...state.player,
              currentEpisode: episode,
              position: episode?.lastPositionSec || 0,
              duration: episode?.durationSec || 0,
            },
          })),

        // Library actions
        addFeed: (feed) =>
          set((state) => ({
            ...state,
            library: {
              ...state.library,
              feeds: [...state.library.feeds, feed],
            },
          })),

        removeFeed: (feedId) =>
          set((state) => ({
            ...state,
            library: {
              ...state.library,
              feeds: state.library.feeds.filter((f) => f.id !== feedId),
              episodes: state.library.episodes.filter((e) => e.feedId !== feedId),
            },
          })),

        updateFeed: (feedId, updates) =>
          set((state) => ({
            ...state,
            library: {
              ...state.library,
              feeds: state.library.feeds.map((f) =>
                f.id === feedId ? { ...f, ...updates } : f
              ),
            },
          })),

        setSearchQuery: (query) =>
          set((state) => ({
            ...state,
            library: {
              ...state.library,
              searchQuery: query,
            },
          })),

        // Settings actions
        toggleDarkMode: () =>
          set((state) => ({
            ...state,
            settings: {
              ...state.settings,
              darkMode: !state.settings.darkMode,
            },
          })),

        updateSettings: (updates) =>
          set((state) => ({
            ...state,
            settings: {
              ...state.settings,
              ...updates,
            },
          })),

        // UI actions
        toggleSidebar: () =>
          set((state) => ({
            ...state,
            ui: {
              ...state.ui,
              sidebarCollapsed: !state.ui.sidebarCollapsed,
            },
          })),

        setActivePanel: (panel) =>
          set((state) => ({
            ...state,
            ui: {
              ...state.ui,
              activePanel: panel,
            },
          })),
      }),
      {
        name: 'easypod-store',
        // Only persist settings and UI preferences
        partialize: (state) => ({
          settings: state.settings,
          ui: state.ui,
        }),
      }
    ),
    { name: 'EasyPod Store' }
  )
);
