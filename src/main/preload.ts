import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Menu events
  onMenuAddSubscription: (callback: () => void) => {
    ipcRenderer.on('menu-add-subscription', callback);
    return () => ipcRenderer.removeListener('menu-add-subscription', callback);
  },

  // Player controls (will be implemented later)
  playPause: () => ipcRenderer.invoke('player-play-pause'),
  seek: (position: number) => ipcRenderer.invoke('player-seek', position),
  setVolume: (volume: number) => ipcRenderer.invoke('player-set-volume', volume),
  setSpeed: (speed: number) => ipcRenderer.invoke('player-set-speed', speed),

  // Media keys and system integration
  onMediaKey: (callback: (action: string) => void) => {
    ipcRenderer.on('media-key', (_, action) => callback(action));
    return () => ipcRenderer.removeListener('media-key', callback);
  },

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),

  // RSS Feed management
  feeds: {
    subscribe: (url: string, opmlGroup?: string) =>
      ipcRenderer.invoke('feeds:subscribe', url, opmlGroup),
    unsubscribe: (feedId: number) =>
      ipcRenderer.invoke('feeds:unsubscribe', feedId),
    getAll: () => ipcRenderer.invoke('feeds:getAll'),
    getById: (feedId: number) => ipcRenderer.invoke('feeds:getById', feedId),
    refresh: (feedId: number) => ipcRenderer.invoke('feeds:refresh', feedId),
    refreshAll: () => ipcRenderer.invoke('feeds:refreshAll'),
    validate: (url: string) => ipcRenderer.invoke('feeds:validate', url),
    getCacheStats: () => ipcRenderer.invoke('feeds:getCacheStats'),
    clearCache: () => ipcRenderer.invoke('feeds:clearCache'),
  },

  // Episode management
  episodes: {
    getAll: (options?: any) => ipcRenderer.invoke('episodes:getAll', options),
    getByFeed: (feedId: number, limit?: number, offset?: number) =>
      ipcRenderer.invoke('episodes:getByFeed', feedId, limit, offset),
    getById: (episodeId: number) => ipcRenderer.invoke('episodes:getById', episodeId),
    search: (query: string, limit?: number) =>
      ipcRenderer.invoke('episodes:search', query, limit),
    updatePlayback: (
      episodeId: number,
      position: number,
      status?: 'new' | 'in_progress' | 'played' | 'archived'
    ) => ipcRenderer.invoke('episodes:updatePlayback', episodeId, position, status),
    updateProgress: (data: { id: number; lastPositionSec: number; lastPlayedAt?: string; status?: string }) =>
      ipcRenderer.invoke('episodes:updateProgress', data),
    markAsPlayed: (episodeId: number) => ipcRenderer.invoke('episodes:markAsPlayed', episodeId),
    markAsNew: (episodeId: number) => ipcRenderer.invoke('episodes:markAsNew', episodeId),
    markAsArchived: (episodeId: number) => ipcRenderer.invoke('episodes:markAsArchived', episodeId),
    getRecentlyPlayed: (limit?: number) => ipcRenderer.invoke('episodes:getRecentlyPlayed', limit),
  },

  // Play queue management
  playQueue: {
    getAll: () => ipcRenderer.invoke('playQueue:getAll'),
    add: (episodeId: number, strategy?: number | 'play-next' | 'end', currentIndex?: number) =>
      ipcRenderer.invoke('playQueue:add', episodeId, strategy, currentIndex),
    remove: (episodeId: number) =>
      ipcRenderer.invoke('playQueue:remove', episodeId),
    reorder: (items: Array<{ id: number; position: number }>) =>
      ipcRenderer.invoke('playQueue:reorder', items),
    clear: () => ipcRenderer.invoke('playQueue:clear'),
  },

  // Playback state persistence
  playbackState: {
    get: () => ipcRenderer.invoke('playbackState:get'),
    save: (episodeId: number | null, position: number, duration?: number) =>
      ipcRenderer.invoke('playbackState:save', episodeId, position, duration),
  },
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  onMenuAddSubscription: (callback: () => void) => () => void;
  playPause: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  onMediaKey: (callback: (action: string) => void) => () => void;
  showNotification: (title: string, body: string) => Promise<void>;
  feeds: {
    subscribe: (url: string, opmlGroup?: string) => Promise<{ success: boolean; feed?: any; error?: string }>;
    unsubscribe: (feedId: number) => Promise<{ success: boolean; error?: string }>;
    getAll: () => Promise<any[]>;
    getById: (feedId: number) => Promise<any | null>;
    refresh: (feedId: number) => Promise<{ success: boolean; hasUpdates?: boolean; error?: string }>;
    refreshAll: () => Promise<{ updated: number; errors: string[] }>;
    validate: (url: string) => Promise<{ valid: boolean; title?: string; error?: string }>;
    getCacheStats: () => Promise<{ size: number; urls: string[] }>;
    clearCache: () => Promise<{ success: boolean }>;
  };
  episodes: {
    getAll: (options?: any) => Promise<any[]>;
    getByFeed: (feedId: number, limit?: number, offset?: number) => Promise<any[]>;
    getById: (episodeId: number) => Promise<any | null>;
    search: (query: string, limit?: number) => Promise<any[]>;
    updatePlayback: (
      episodeId: number,
      position: number,
      status?: 'new' | 'in_progress' | 'played' | 'archived'
    ) => Promise<{ success: boolean; error?: string }>;
    updateProgress: (data: { id: number; lastPositionSec: number; lastPlayedAt?: string; status?: string }) => Promise<{ success: boolean; error?: string }>;
    markAsPlayed: (episodeId: number) => Promise<{ success: boolean; error?: string }>;
    markAsNew: (episodeId: number) => Promise<{ success: boolean; error?: string }>;
    markAsArchived: (episodeId: number) => Promise<{ success: boolean; error?: string }>;
    getRecentlyPlayed: (limit?: number) => Promise<any[]>;
  };
  playQueue: {
    getAll: () => Promise<any[]>;
    add: (
      episodeId: number,
      strategy?: number | 'play-next' | 'end',
      currentIndex?: number
    ) => Promise<{ success: boolean; queue: any[]; error?: string }>;
    remove: (episodeId: number) => Promise<{ success: boolean; queue: any[]; error?: string }>;
    reorder: (
      items: Array<{ id: number; position: number }>
    ) => Promise<{ success: boolean; queue: any[]; error?: string }>;
    clear: () => Promise<{ success: boolean; queue: any[]; error?: string }>;
  };
  playbackState: {
    get: () => Promise<{ state: { id: number; currentEpisodeId: number | null; currentPosition: number; updatedAt: string | null }; episode: any | null }>;
    save: (episodeId: number | null, position: number, duration?: number) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
