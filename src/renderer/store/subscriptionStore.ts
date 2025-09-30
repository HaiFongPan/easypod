import { create } from 'zustand';
import { getElectronAPI } from '../utils/electron';
import { Feed, ImportResult } from '../types/subscription';

interface SubscriptionState {
  feeds: Feed[];
  isLoading: boolean;
  error: string | null;
  refreshingFeeds: Set<string>;
  selectedFeed: Feed | null;
}

interface SubscriptionActions {
  setFeeds: (feeds: Feed[]) => void;
  addFeed: (url: string, category?: string) => Promise<void>;
  removeFeed: (feedId: string) => Promise<void>;
  refreshFeed: (feedId: string) => Promise<void>;
  refreshAllFeeds: () => Promise<void>;
  selectFeed: (feed: Feed | null) => void;
  importOPML: (file: File) => Promise<ImportResult>;
  exportOPML: () => Promise<string>;
  loadFeeds: () => Promise<void>;
  clearError: () => void;
}

const VALID_FEED_STATUSES: Feed['status'][] = ['active', 'updating', 'error', 'paused'];

const normalizeFeed = (raw: Partial<Feed>): Feed => {
  const now = new Date().toISOString();
  const id = raw.id?.toString() || raw.url || raw.title || `feed-${Date.now().toString(36)}`;
  const status = VALID_FEED_STATUSES.includes(raw.status as Feed['status'])
    ? (raw.status as Feed['status'])
    : 'active';

  return {
    id,
    title: raw.title ?? 'Untitled Podcast',
    url: raw.url ?? '',
    description: raw.description ?? '',
    coverUrl: raw.coverUrl,
    category: raw.category ?? 'Uncategorized',
    episodeCount: raw.episodeCount ?? 0,
    lastCheckedAt: raw.lastCheckedAt ?? now,
    status,
    error: raw.error,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
};

export const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>((set, get) => ({
  // State
  feeds: [],
  isLoading: false,
  error: null,
  refreshingFeeds: new Set(),
  selectedFeed: null,

  // Actions
  setFeeds: (feeds) => set({ feeds: feeds.map(normalizeFeed) }),

  addFeed: async (url: string, category = 'Default') => {
    set({ isLoading: true, error: null });
    try {
      const electron = getElectronAPI();

      // Check if ElectronAPI is available
      if (!electron?.feeds?.validate) {
        throw new Error('RSS functionality not available yet');
      }

      // First validate the feed
      const validation = await electron.feeds.validate(url);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid feed URL');
      }

      // Subscribe to the feed
      const result = await electron.feeds.subscribe(url, category);
      if (!result.success) {
        throw new Error(result.error || 'Failed to subscribe to feed');
      }

      // Add to local state
      const newFeed: Feed = {
        id: result.feed.id.toString(),
        title: result.feed.title,
        url: url,
        description: result.feed.description || '',
        coverUrl: result.feed.coverUrl,
        category,
        episodeCount: result.feed.episodeCount || 0,
        lastCheckedAt: new Date().toISOString(),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set(state => ({
        feeds: [...state.feeds, newFeed],
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add feed',
        isLoading: false
      });
      throw error;
    }
  },

  removeFeed: async (feedId: string) => {
    try {
      const electron = getElectronAPI();
      await electron.feeds.unsubscribe(parseInt(feedId));
      set(state => ({
        feeds: state.feeds.filter(feed => feed.id !== feedId),
        selectedFeed: state.selectedFeed?.id === feedId ? null : state.selectedFeed,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove feed' });
      throw error;
    }
  },

  refreshFeed: async (feedId: string) => {
    const electron = getElectronAPI();
    const { refreshingFeeds } = get();
    const newRefreshing = new Set(refreshingFeeds);
    newRefreshing.add(feedId);
    set({ refreshingFeeds: newRefreshing });

    try {
      const result = await electron.feeds.refresh(parseInt(feedId));
      if (!result.success) {
        throw new Error(result.error || 'Failed to refresh feed');
      }

      // Update feed status
      set(state => {
        const updatedRefreshing = new Set(state.refreshingFeeds);
        updatedRefreshing.delete(feedId);

        return {
          feeds: state.feeds.map(feed =>
            feed.id === feedId
              ? { ...feed, lastCheckedAt: new Date().toISOString(), status: 'active' as const }
              : feed
          ),
          refreshingFeeds: updatedRefreshing,
        };
      });
    } catch (error) {
      console.error(`Failed to refresh feed ${feedId}:`, error);
      const updatedRefreshing = new Set(refreshingFeeds);
      updatedRefreshing.delete(feedId);

      set(state => ({
        feeds: state.feeds.map(feed =>
          feed.id === feedId
            ? { ...feed, status: 'error' as const, error: error instanceof Error ? error.message : 'Refresh failed' }
            : feed
        ),
        refreshingFeeds: updatedRefreshing,
      }));
    }
  },

  refreshAllFeeds: async () => {
    const { feeds } = get();
    const refreshPromises = feeds.map(feed => get().refreshFeed(feed.id));
    await Promise.allSettled(refreshPromises);
  },

  selectFeed: (feed) => set({ selectedFeed: feed }),

  loadFeeds: async () => {
    set({ isLoading: true, error: null });
    try {
      const electron = getElectronAPI();
      // Temporarily catch all errors and provide empty array as fallback
      if (!electron?.feeds?.getAll) {
        console.warn('ElectronAPI feeds.getAll not available, using empty array');
        set({ feeds: [], isLoading: false, error: null });
        return;
      }

      const feeds = await electron.feeds.getAll();
      const normalizedFeeds = Array.isArray(feeds) ? feeds.map(normalizeFeed) : [];
      set({ feeds: normalizedFeeds, isLoading: false, error: null });
    } catch (error) {
      console.error('Error loading feeds:', error);
      // Don't show the error to user for now, just log it
      set({
        feeds: [],
        isLoading: false,
        error: null // Temporarily hide errors
      });
    }
  },

  importOPML: async (file: File): Promise<ImportResult> => {
    // This would typically be implemented with a proper OPML parser
    // For now, return a mock implementation
    return { feeds: [], errors: ['OPML import not implemented yet'] };
  },

  exportOPML: async (): Promise<string> => {
    const { feeds } = get();
    const opmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>EasyPod Subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    ${feeds.map(feed =>
      `<outline type="rss" text="${feed.title}" title="${feed.title}" xmlUrl="${feed.url}" description="${feed.description}" />`
    ).join('\n    ')}
  </body>
</opml>`;
    return opmlTemplate;
  },

  clearError: () => set({ error: null }),
}));
