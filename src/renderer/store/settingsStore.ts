import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AppSettings {
  // Playback Settings
  defaultPlaybackRate: number; // 0.5 - 2.0
  skipForwardSeconds: number; // Default: 10
  skipBackwardSeconds: number; // Default: 10
  defaultVolume: number; // 0.0 - 1.0
  autoPlayNext: boolean; // Auto-play next episode in queue

  // UI Settings
  theme: 'light' | 'dark' | 'system';
  compactView: boolean;

  // Notification Settings
  enableNotifications: boolean;
  notifyOnNewEpisodes: boolean;

  // Download Settings
  autoDownload: boolean;
  downloadQuality: 'low' | 'medium' | 'high';

  // Privacy Settings
  sendAnalytics: boolean;
}

interface SettingsStore extends AppSettings {
  // Actions
  updatePlaybackRate: (rate: number) => void;
  updateSkipForwardSeconds: (seconds: number) => void;
  updateSkipBackwardSeconds: (seconds: number) => void;
  updateDefaultVolume: (volume: number) => void;
  toggleAutoPlayNext: () => void;
  updateTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleCompactView: () => void;
  toggleNotifications: () => void;
  toggleNotifyOnNewEpisodes: () => void;
  toggleAutoDownload: () => void;
  updateDownloadQuality: (quality: 'low' | 'medium' | 'high') => void;
  toggleSendAnalytics: () => void;
  resetToDefaults: () => void;
}

const defaultSettings: AppSettings = {
  // Playback Settings
  defaultPlaybackRate: 1.0,
  skipForwardSeconds: 10,
  skipBackwardSeconds: 10,
  defaultVolume: 1.0,
  autoPlayNext: true,

  // UI Settings
  theme: 'system',
  compactView: false,

  // Notification Settings
  enableNotifications: true,
  notifyOnNewEpisodes: true,

  // Download Settings
  autoDownload: false,
  downloadQuality: 'medium',

  // Privacy Settings
  sendAnalytics: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Initial state from defaults
      ...defaultSettings,

      // Actions
      updatePlaybackRate: (rate) => {
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        set({ defaultPlaybackRate: clampedRate });
      },

      updateSkipForwardSeconds: (seconds) => {
        const clampedSeconds = Math.max(5, Math.min(60, seconds));
        set({ skipForwardSeconds: clampedSeconds });
      },

      updateSkipBackwardSeconds: (seconds) => {
        const clampedSeconds = Math.max(5, Math.min(60, seconds));
        set({ skipBackwardSeconds: clampedSeconds });
      },

      updateDefaultVolume: (volume) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        set({ defaultVolume: clampedVolume });
      },

      toggleAutoPlayNext: () => set((state) => ({ autoPlayNext: !state.autoPlayNext })),

      updateTheme: (theme) => set({ theme }),

      toggleCompactView: () => set((state) => ({ compactView: !state.compactView })),

      toggleNotifications: () => set((state) => ({ enableNotifications: !state.enableNotifications })),

      toggleNotifyOnNewEpisodes: () =>
        set((state) => ({ notifyOnNewEpisodes: !state.notifyOnNewEpisodes })),

      toggleAutoDownload: () => set((state) => ({ autoDownload: !state.autoDownload })),

      updateDownloadQuality: (quality) => set({ downloadQuality: quality }),

      toggleSendAnalytics: () => set((state) => ({ sendAnalytics: !state.sendAnalytics })),

      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'easypod-settings', // LocalStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist specific fields
      partialize: (state) => ({
        defaultPlaybackRate: state.defaultPlaybackRate,
        skipForwardSeconds: state.skipForwardSeconds,
        skipBackwardSeconds: state.skipBackwardSeconds,
        defaultVolume: state.defaultVolume,
        autoPlayNext: state.autoPlayNext,
        theme: state.theme,
        compactView: state.compactView,
        enableNotifications: state.enableNotifications,
        notifyOnNewEpisodes: state.notifyOnNewEpisodes,
        autoDownload: state.autoDownload,
        downloadQuality: state.downloadQuality,
        sendAnalytics: state.sendAnalytics,
      }),
    }
  )
);