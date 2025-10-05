import { create } from 'zustand';

export interface Episode {
  id: number;
  feedId: number;
  guid: string;
  title: string;
  descriptionHtml: string | null;
  audioUrl: string;
  pubDate: string;
  durationSec: number | null;
  episodeImageUrl: string | null;
  localAudioPath: string | null;
  status: 'new' | 'in_progress' | 'played' | 'archived';
  lastPlayedAt: string | null;
  lastPositionSec: number;
  createdAt?: string;
  updatedAt?: string;
  // Joined data from feeds table
  feedTitle?: string;
  feedCoverUrl?: string | null;
}

interface EpisodesStore {
  episodes: Episode[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: 'all' | 'new' | 'in_progress' | 'played' | 'archived';

  // Actions
  fetchAllEpisodes: () => Promise<void>;
  fetchEpisodesByFeed: (feedId: number) => Promise<void>;
  searchEpisodes: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: 'all' | 'new' | 'in_progress' | 'played' | 'archived') => void;
  // Note: Episode progress is now automatically updated via playbackState.save()
  // updateEpisodeProgress: (id: number, lastPositionSec: number, status?: string) => Promise<void>;
  updateLocalEpisode: (id: number, updates: Partial<Episode>) => void;
  markAsPlayed: (id: number) => Promise<void>;
  markAsNew: (id: number) => Promise<void>;
  markAsArchived: (id: number) => Promise<void>;
  clearEpisodes: () => void;
}

export const useEpisodesStore = create<EpisodesStore>((set, get) => ({
  episodes: [],
  loading: false,
  error: null,
  searchQuery: '',
  statusFilter: 'all',

  fetchAllEpisodes: async () => {
    set({ loading: true, error: null });
    try {
      const options: any = {};
      const { statusFilter } = get();

      if (statusFilter !== 'all') {
        options.status = statusFilter;
      }

      const episodes = await window.electronAPI.episodes.getAll(options);
      console.debug('[EpisodesStore] fetched episodes', {
        count: episodes.length,
        sample: episodes[0],
        options
      });
      set({ episodes, loading: false });
    } catch (error) {
      console.error('Failed to fetch episodes:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch episodes',
        loading: false
      });
    }
  },

  fetchEpisodesByFeed: async (feedId: number) => {
    set({ loading: true, error: null });
    try {
      const episodes = await window.electronAPI.episodes.getByFeed(feedId, 100);
      set({ episodes, loading: false });
    } catch (error) {
      console.error('Failed to fetch episodes:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch episodes',
        loading: false
      });
    }
  },

  searchEpisodes: async (query: string) => {
    if (!query.trim()) {
      get().fetchAllEpisodes();
      return;
    }

    set({ loading: true, error: null, searchQuery: query });
    try {
      const episodes = await window.electronAPI.episodes.search(query, 50);
      set({ episodes, loading: false });
    } catch (error) {
      console.error('Failed to search episodes:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to search episodes',
        loading: false
      });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    if (query.trim()) {
      get().searchEpisodes(query);
    } else {
      get().fetchAllEpisodes();
    }
  },

  setStatusFilter: (status: 'all' | 'new' | 'in_progress' | 'played' | 'archived') => {
    const currentStatus = get().statusFilter;
    if (currentStatus === status) {
      return;
    }
    set({ statusFilter: status });
    get().fetchAllEpisodes();
  },

  // updateEpisodeProgress is removed - episode progress is now automatically
  // updated via playbackStateDao.saveWithEpisodeUpdate() when saving playback state

  // Update local episode state (for immediate UI refresh)
  updateLocalEpisode: (id: number, updates: Partial<Episode>) => {
    set(state => ({
      episodes: state.episodes.map(ep =>
        ep.id === id ? { ...ep, ...updates } : ep
      )
    }));
  },

  markAsPlayed: async (id: number) => {
    try {
      const result = await window.electronAPI.episodes.markAsPlayed(id);
      if (result.success) {
        set(state => ({
          episodes: state.episodes.map(ep =>
            ep.id === id ? { ...ep, status: 'played' as const } : ep
          )
        }));
      }
    } catch (error) {
      console.error('Failed to mark episode as played:', error);
    }
  },

  markAsNew: async (id: number) => {
    try {
      const result = await window.electronAPI.episodes.markAsNew(id);
      if (result.success) {
        set(state => ({
          episodes: state.episodes.map(ep =>
            ep.id === id ? { ...ep, status: 'new' as const, lastPositionSec: 0 } : ep
          )
        }));
      }
    } catch (error) {
      console.error('Failed to mark episode as new:', error);
    }
  },

  markAsArchived: async (id: number) => {
    try {
      const result = await window.electronAPI.episodes.markAsArchived(id);
      if (result.success) {
        set(state => ({
          episodes: state.episodes.map(ep =>
            ep.id === id ? { ...ep, status: 'archived' as const } : ep
          )
        }));
      }
    } catch (error) {
      console.error('Failed to mark episode as archived:', error);
    }
  },

  clearEpisodes: () => {
    set({ episodes: [], searchQuery: '', statusFilter: 'all' });
  },
}));