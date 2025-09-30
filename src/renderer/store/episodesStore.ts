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
  feedCoverUrl?: string;
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
  updateEpisodeProgress: (id: number, lastPositionSec: number, status?: string) => Promise<void>;
  markAsPlayed: (id: number) => Promise<void>;
  markAsNew: (id: number) => Promise<void>;
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
    set({ statusFilter: status });
    get().fetchAllEpisodes();
  },

  updateEpisodeProgress: async (id: number, lastPositionSec: number, status?: string) => {
    try {
      const result = await window.electronAPI.episodes.updateProgress({
        id,
        lastPositionSec,
        lastPlayedAt: new Date().toISOString(),
        status,
      });

      if (result.success) {
        // Update local state
        set(state => ({
          episodes: state.episodes.map(ep =>
            ep.id === id
              ? { ...ep, lastPositionSec, status: (status as Episode['status']) || ep.status }
              : ep
          )
        }));
      }
    } catch (error) {
      console.error('Failed to update episode progress:', error);
    }
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

  clearEpisodes: () => {
    set({ episodes: [], searchQuery: '', statusFilter: 'all' });
  },
}));