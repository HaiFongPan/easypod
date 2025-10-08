import { contextBridge, ipcRenderer } from 'electron';
import type {
  FunASRHealthResponse,
  FunASRInitializeRequest,
  FunASRInitializeResponse,
  FunASRTaskStatus,
  FunASRTranscribeRequest,
  FunASRTranscribeResponse,
} from './services/funasr/FunASRServiceClient';
import type { FunASRConfig, AliyunConfig } from './services/transcript/TranscriptConfigManager';

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
    preview: (url: string) => ipcRenderer.invoke('feeds:preview', url),
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

  funasr: {
    health: () => ipcRenderer.invoke('funasr:health'),
    initialize: (payload: FunASRInitializeRequest) =>
      ipcRenderer.invoke('funasr:initialize', payload),
    transcribe: (payload: FunASRTranscribeRequest) =>
      ipcRenderer.invoke('funasr:transcribe', payload),
    getTask: (taskId: string) => ipcRenderer.invoke('funasr:task:get', taskId),
    shutdown: () => ipcRenderer.invoke('funasr:shutdown'),
  },

  transcriptConfig: {
    // FunASR configuration
    getFunASRConfig: () => ipcRenderer.invoke('transcript:config:getFunASR'),
    setFunASRConfig: (config: Partial<FunASRConfig>) =>
      ipcRenderer.invoke('transcript:config:setFunASR', { config }),
    getDefaultModels: () => ipcRenderer.invoke('transcript:config:getDefaultModels'),
    validateModelPath: (path: string) =>
      ipcRenderer.invoke('transcript:config:validateModelPath', { path }),

    // Aliyun configuration
    getAliyunConfig: () => ipcRenderer.invoke('transcript:config:getAliyun'),
    setAliyunConfig: (config: Partial<AliyunConfig>) =>
      ipcRenderer.invoke('transcript:config:setAliyun', { config }),
    testAliyunAPI: () => ipcRenderer.invoke('transcript:config:testAliyunAPI'),

    // General configuration
    getDefaultService: () => ipcRenderer.invoke('transcript:config:getDefaultService'),
    setDefaultService: (service: 'funasr' | 'aliyun') =>
      ipcRenderer.invoke('transcript:config:setDefaultService', { service }),
    exportConfig: () => ipcRenderer.invoke('transcript:config:export'),
    importConfig: (config: any) => ipcRenderer.invoke('transcript:config:import', { config }),
  },

  transcript: {
    submit: (episodeId: number) =>
      ipcRenderer.invoke('transcript:submit', { episodeId }),
    query: (taskId: string, service: 'funasr' | 'aliyun') =>
      ipcRenderer.invoke('transcript:query', { taskId, service }),
    getTaskStatus: (episodeId: number) =>
      ipcRenderer.invoke('transcript:getTaskStatus', { episodeId }),
    getByEpisode: (episodeId: number) =>
      ipcRenderer.invoke('transcript:getByEpisode', episodeId),
    getTasksList: (page: number, pageSize: number, nameFilter?: string) =>
      ipcRenderer.invoke('transcript:getTasksList', { page, pageSize, nameFilter }),
    deleteTask: (episodeId: number) =>
      ipcRenderer.invoke('transcript:deleteTask', { episodeId }),
    retryTask: (episodeId: number) =>
      ipcRenderer.invoke('transcript:retryTask', { episodeId }),
  },

  // LLM Providers
  llmProviders: {
    getAll: () => ipcRenderer.invoke('llmProviders:getAll'),
    create: (data: any) => ipcRenderer.invoke('llmProviders:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('llmProviders:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('llmProviders:delete', id),
    setDefault: (id: number) => ipcRenderer.invoke('llmProviders:setDefault', id),
    validate: (id: number) => ipcRenderer.invoke('llmProviders:validate', id),
  },

  // LLM Models
  llmModels: {
    getAll: () => ipcRenderer.invoke('llmModels:getAll'),
    getByProvider: (providerId: number) => ipcRenderer.invoke('llmModels:getByProvider', providerId),
    create: (data: any) => ipcRenderer.invoke('llmModels:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('llmModels:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('llmModels:delete', id),
    setDefault: (providerId: number, modelId: number) =>
      ipcRenderer.invoke('llmModels:setDefault', providerId, modelId),
  },

  // Prompts
  prompts: {
    getAll: () => ipcRenderer.invoke('prompts:getAll'),
    create: (data: any) => ipcRenderer.invoke('prompts:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('prompts:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('prompts:delete', id),
  },

  // AI Operations
  ai: {
    generateSummary: (episodeId: number) => ipcRenderer.invoke('ai:generateSummary', episodeId),
    generateChapters: (episodeId: number) => ipcRenderer.invoke('ai:generateChapters', episodeId),
    getMindmap: (episodeId: number) => ipcRenderer.invoke('ai:getMindmap', episodeId),
    getSummary: (episodeId: number) => ipcRenderer.invoke('ai:getSummary', episodeId),
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
    refresh: (feedId: number) => Promise<{ success: boolean; hasUpdates?: boolean; lastPubDate?: string | null; newEpisodes?: number; error?: string }>;
    refreshAll: () => Promise<{ updated: number; errors: string[]; newEpisodesCount?: number }>;
    validate: (url: string) => Promise<{ valid: boolean; title?: string; error?: string }>;
    preview: (url: string) => Promise<{
      success: boolean;
      feed?: {
        title: string;
        description?: string | null;
        image?: string | null;
        author?: string | null;
        url: string;
      };
      episodes?: Array<{
        id: string;
        title: string;
        duration?: number | null;
        image?: string | null;
        pubDate?: string | null;
      }>;
      error?: string;
    }>;
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
  funasr: {
    health: () => Promise<FunASRHealthResponse>;
    initialize: (payload: FunASRInitializeRequest) => Promise<FunASRInitializeResponse>;
    transcribe: (payload: FunASRTranscribeRequest) => Promise<FunASRTranscribeResponse>;
    getTask: (taskId: string) => Promise<FunASRTaskStatus>;
    shutdown: () => Promise<{ success: boolean }>;
  };
  transcriptConfig: {
    // FunASR configuration
    getFunASRConfig: () => Promise<{ success: boolean; config?: FunASRConfig; error?: string }>;
    setFunASRConfig: (config: Partial<FunASRConfig>) => Promise<{ success: boolean; error?: string }>;
    getDefaultModels: () => Promise<{ success: boolean; models?: any; error?: string }>;
    validateModelPath: (path: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>;

    // Aliyun configuration
    getAliyunConfig: () => Promise<{ success: boolean; config?: AliyunConfig; error?: string }>;
    setAliyunConfig: (config: Partial<AliyunConfig>) => Promise<{ success: boolean; error?: string }>;
    testAliyunAPI: () => Promise<{ success: boolean; message?: string; error?: string }>;

    // General configuration
    getDefaultService: () => Promise<{ success: boolean; service?: 'funasr' | 'aliyun'; error?: string }>;
    setDefaultService: (service: 'funasr' | 'aliyun') => Promise<{ success: boolean; error?: string }>;
    exportConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
    importConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  };
  transcript: {
    submit: (episodeId: number) => Promise<{ success: boolean; taskId?: string; error?: string }>;
    query: (taskId: string, service: 'funasr' | 'aliyun') => Promise<any>;
    getTaskStatus: (episodeId: number) => Promise<{
      success: boolean;
      hasTask?: boolean;
      status?: 'pending' | 'processing' | 'succeeded' | 'failed';
      taskId?: string;
      service?: 'funasr' | 'aliyun';
      error?: string;
    }>;
    getTasksList: (page: number, pageSize: number, nameFilter?: string) => Promise<{
      success: boolean;
      tasks?: any[];
      total?: number;
      error?: string;
    }>;
    deleteTask: (episodeId: number) => Promise<{ success: boolean; error?: string }>;
    retryTask: (episodeId: number) => Promise<{ success: boolean; taskId?: string; error?: string }>;
    getByEpisode: (episodeId: number) => Promise<{
      success: boolean;
      transcript?: {
        id: number;
        episodeId: number;
        subtitles: Array<{
          text: string;
          start: number;
          end: number;
          timestamp: number[][];
          spk: number;
        }>;
        text: string;
        speakerNumber: number;
        createdAt: string;
        updatedAt: string;
      };
      error?: string;
    }>;
  };
  llmProviders: {
    getAll: () => Promise<any[]>;
    create: (data: any) => Promise<{ success: boolean; error?: string }>;
    update: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
    delete: (id: number) => Promise<{ success: boolean; error?: string }>;
    setDefault: (id: number) => Promise<{ success: boolean; error?: string }>;
    validate: (
      id: number
    ) => Promise<{ success: boolean; message?: string; error?: string; modelsAdded?: number }>;
  };
  llmModels: {
    getAll: () => Promise<any[]>;
    getByProvider: (providerId: number) => Promise<any[]>;
    create: (data: any) => Promise<{ success: boolean; error?: string }>;
    update: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
    delete: (id: number) => Promise<{ success: boolean; error?: string }>;
    setDefault: (providerId: number, modelId: number) => Promise<{ success: boolean; error?: string }>;
  };
  prompts: {
    getAll: () => Promise<any[]>;
    create: (data: any) => Promise<{ success: boolean; error?: string }>;
    update: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
    delete: (id: number) => Promise<{ success: boolean; error?: string }>;
  };
  ai: {
    generateSummary: (episodeId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    generateChapters: (episodeId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    getMindmap: (episodeId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    getSummary: (episodeId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
