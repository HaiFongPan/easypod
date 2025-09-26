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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}