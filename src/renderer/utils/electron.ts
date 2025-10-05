import type { ElectronAPI } from '../../main/preload';
import type { Feed } from '../types/subscription';

type StoredFeed = Feed & { url: string };

interface FeedMetadata {
  title: string;
  description: string;
  coverUrl?: string;
  episodeCount: number;
}

const STORAGE_KEY = 'easypod:mock-feeds';
const METADATA_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const metadataCache = new Map<string, { metadata: FeedMetadata; fetchedAt: number }>();

const normalizeError = (error: unknown): string => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Failed to fetch feed. This is often caused by CORS restrictions; try running the Electron app for full access.';
  }

  return error instanceof Error ? error.message : String(error);
};

const normalizeText = (value: string | null | undefined): string =>
  (value ?? '').trim();

const getHostFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const firstNonEmpty = (
  ...values: Array<string | null | undefined>
): string | undefined => {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) {
      return text;
    }
  }
  return undefined;
};

const loadStoredFeeds = (): StoredFeed[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredFeed[];
    return parsed.map(feed => ({
      ...feed,
      status: feed.status ?? 'active',
      lastCheckedAt: feed.lastCheckedAt ?? feed.updatedAt,
    }));
  } catch (error) {
    console.warn('Mock ElectronAPI: failed to read stored feeds', error);
    return [];
  }
};

const saveStoredFeeds = (feeds: StoredFeed[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds));
  } catch (error) {
    console.warn('Mock ElectronAPI: failed to persist feeds', error);
  }
};

const parseFeedMetadata = (xml: string, url: string): FeedMetadata => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Unable to parse feed XML.');
  }

  const channel = doc.querySelector('rss > channel') ?? doc.querySelector('channel');
  if (channel) {
    const title = normalizeText(channel.querySelector('title')?.textContent) || getHostFromUrl(url);
    const description = normalizeText(channel.querySelector('description')?.textContent);
    const coverUrl = firstNonEmpty(
      (channel.querySelector('itunes\\:image') as Element | null)?.getAttribute('href'),
      channel.querySelector('image > url')?.textContent
    );
    const episodeCount = channel.querySelectorAll('item').length;

    return {
      title,
      description,
      coverUrl,
      episodeCount,
    };
  }

  const atomFeed = doc.querySelector('feed');
  if (atomFeed) {
    const title = normalizeText(atomFeed.querySelector('title')?.textContent) || getHostFromUrl(url);
    const description = normalizeText(atomFeed.querySelector('subtitle')?.textContent);
    const coverUrl = firstNonEmpty(
      atomFeed.querySelector('logo')?.textContent,
      atomFeed.querySelector('icon')?.textContent
    );
    const episodeCount = atomFeed.querySelectorAll('entry').length;

    return {
      title,
      description,
      coverUrl,
      episodeCount,
    };
  }

  throw new Error('The provided document is not a valid RSS/Atom feed.');
};

const fetchFeedMetadata = async (url: string): Promise<FeedMetadata> => {
  const cached = metadataCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < METADATA_CACHE_MAX_AGE_MS) {
    return cached.metadata;
  }

  const attempts = [url, `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`];
  const errors: string[] = [];

  for (const target of attempts) {
    try {
      const response = await fetch(target, { mode: 'cors' });
      if (!response.ok) {
        errors.push(`${target} → HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();
      const metadata = parseFeedMetadata(text, url);
      metadataCache.set(url, { metadata, fetchedAt: Date.now() });
      return metadata;
    } catch (error) {
      errors.push(`${target} → ${normalizeError(error)}`);
    }
  }

  throw new Error(errors.join(' | ') || 'Unable to fetch feed data.');
};

const buildMockFeed = (
  url: string,
  metadata: FeedMetadata,
  overrides?: Partial<StoredFeed>
): StoredFeed => {
  const timestamp = new Date().toISOString();
  return {
    id: overrides?.id ?? `${Date.now()}`,
    url,
    title: metadata.title,
    description: metadata.description,
    coverUrl: metadata.coverUrl,
    category: overrides?.category ?? 'Default',
    episodeCount: metadata.episodeCount,
    lastCheckedAt: timestamp,
    status: overrides?.status ?? 'active',
    error: overrides?.error,
    createdAt: overrides?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

const createMockElectronAPI = (): ElectronAPI => {
  const menuListeners = new Set<() => void>();
  const mediaKeyListeners = new Set<(action: string) => void>();

  const subscribe = async (url: string, opmlGroup?: string) => {
    try {
      const metadata = await fetchFeedMetadata(url);
      const feeds = loadStoredFeeds();
      const existing = feeds.find(feed => feed.url === url);
      const feed = buildMockFeed(url, metadata, existing ? {
        ...existing,
        category: opmlGroup ?? existing.category,
        createdAt: existing.createdAt,
        id: existing.id,
      } : {
        category: opmlGroup ?? 'Default',
      });

      const nextFeeds = existing
        ? feeds.map(item => (item.id === feed.id ? feed : item))
        : [...feeds, feed];

      saveStoredFeeds(nextFeeds);
      return { success: true, feed };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  };

  const refresh = async (feedId: number) => {
    const feeds = loadStoredFeeds();
    const id = String(feedId);
    const index = feeds.findIndex(feed => feed.id === id);

    if (index === -1) {
      return { success: false, error: 'Feed not found' } as const;
    }

    try {
      const metadata = await fetchFeedMetadata(feeds[index].url);
      const hasUpdates = metadata.episodeCount !== feeds[index].episodeCount;
      const updatedFeed = buildMockFeed(feeds[index].url, metadata, {
        ...feeds[index],
        category: feeds[index].category,
        createdAt: feeds[index].createdAt,
        id,
      });

      feeds[index] = { ...updatedFeed, status: 'active', error: undefined };
      saveStoredFeeds(feeds);
      return { success: true, hasUpdates };
    } catch (error) {
      const message = normalizeError(error);
      feeds[index] = {
        ...feeds[index],
        status: 'error',
        error: message,
        lastCheckedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveStoredFeeds(feeds);
      return { success: false, error: message };
    }
  };

  const refreshAll = async () => {
    const feeds = loadStoredFeeds();
    let updated = 0;
    const errors: string[] = [];

    for (const feed of feeds) {
      const result = await refresh(Number(feed.id));
      if (result.success && result.hasUpdates) {
        updated += 1;
      }
      if (!result.success && result.error) {
        errors.push(`${feed.title}: ${result.error}`);
      }
    }

    return { updated, errors };
  };

  return {
    getAppVersion: async () => '0.0.0-dev (browser)',
    getPlatform: async () => navigator.platform || 'web',
    onMenuAddSubscription: (callback: () => void) => {
      menuListeners.add(callback);
      return () => menuListeners.delete(callback);
    },
    playPause: async () => undefined,
    seek: async () => undefined,
    setVolume: async () => undefined,
    setSpeed: async () => undefined,
    onMediaKey: (callback: (action: string) => void) => {
      mediaKeyListeners.add(callback);
      return () => mediaKeyListeners.delete(callback);
    },
    showNotification: async (title: string, body: string) => {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
          return;
        }

        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification(title, { body });
            return;
          }
        }
      }

      console.info(`[Notification] ${title}: ${body}`);
    },
    feeds: {
      subscribe,
      unsubscribe: async (feedId: number) => {
        const feeds = loadStoredFeeds();
        const id = String(feedId);
        const nextFeeds = feeds.filter(feed => feed.id !== id);
        const success = nextFeeds.length !== feeds.length;
        saveStoredFeeds(nextFeeds);
        return success ? { success: true } : { success: false, error: 'Feed not found' };
      },
      getAll: async () => loadStoredFeeds(),
      getById: async (feedId: number) => {
        const id = String(feedId);
        return loadStoredFeeds().find(feed => feed.id === id) ?? null;
      },
      refresh,
      refreshAll,
      validate: async (url: string) => {
        try {
          const metadata = await fetchFeedMetadata(url);
          return { valid: true, title: metadata.title };
        } catch (error) {
          return { valid: false, error: normalizeError(error) };
        }
      },
      getCacheStats: async () => {
        const feeds = loadStoredFeeds();
        return {
          size: feeds.length,
          urls: feeds.map(feed => feed.url),
        };
      },
      clearCache: async () => {
        metadataCache.clear();
        saveStoredFeeds(loadStoredFeeds());
        return { success: true };
      },
    },
    episodes: {
      getAll: async () => [],
      getByFeed: async () => [],
      getById: async () => null,
      search: async () => [],
      updatePlayback: async () => ({ success: true }),
      updateProgress: async () => ({ success: true }),
      markAsPlayed: async () => ({ success: true }),
      markAsNew: async () => ({ success: true }),
      markAsArchived: async () => ({ success: true }),
      getRecentlyPlayed: async () => [],
    },
    playQueue: {
      getAll: async () => [],
      add: async () => ({ success: true, queue: [] as any[] }),
      remove: async () => ({ success: true, queue: [] as any[] }),
      reorder: async () => ({ success: true, queue: [] as any[] }),
      clear: async () => ({ success: true, queue: [] as any[] }),
    },
    playbackState: {
      get: async () => ({
        state: {
          id: 1,
          currentEpisodeId: null,
          currentPosition: 0,
          updatedAt: new Date().toISOString(),
        },
        episode: null,
      }),
      save: async () => ({ success: true }),
    },
  };
};

let electronApiRef: ElectronAPI | null = null;

export const getElectronAPI = (): ElectronAPI => {
  if (electronApiRef) {
    return electronApiRef;
  }

  if (window.electronAPI) {
    electronApiRef = window.electronAPI;
    return electronApiRef;
  }

  electronApiRef = createMockElectronAPI();
  window.electronAPI = electronApiRef;
  return electronApiRef;
};
