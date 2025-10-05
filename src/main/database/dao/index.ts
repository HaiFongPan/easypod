import { FeedsDao } from './feedsDao';
import { EpisodesDao } from './episodesDao';
import { SearchDao } from './searchDao';
import { PlayQueueDao } from './playQueueDao';
import { PlaybackStateDao } from './playbackStateDao';

export * from './feedsDao';
export * from './episodesDao';
export * from './searchDao';
export * from './playQueueDao';
export * from './playbackStateDao';

// Database service that provides access to all DAOs
export class DatabaseService {
  private _feeds: FeedsDao | null = null;
  private _episodes: EpisodesDao | null = null;
  private _search: SearchDao | null = null;
  private _playQueue: PlayQueueDao | null = null;
  private _playbackState: PlaybackStateDao | null = null;

  get feeds(): FeedsDao {
    if (!this._feeds) {
      this._feeds = new FeedsDao();
    }
    return this._feeds;
  }

  get episodes(): EpisodesDao {
    if (!this._episodes) {
      this._episodes = new EpisodesDao();
    }
    return this._episodes;
  }

  get search(): SearchDao {
    if (!this._search) {
      this._search = new SearchDao();
    }
    return this._search;
  }

  get playQueue(): PlayQueueDao {
    if (!this._playQueue) {
      this._playQueue = new PlayQueueDao();
    }
    return this._playQueue;
  }

  get playbackState(): PlaybackStateDao {
    if (!this._playbackState) {
      this._playbackState = new PlaybackStateDao();
    }
    return this._playbackState;
  }

  // Convenience methods for common operations
  async getFeedWithEpisodes(feedId: number, episodeLimit = 10) {
    return await this.feeds.getFeedWithLatestEpisodes(feedId, episodeLimit);
  }

  async searchEverything(query: string, options?: {
    feedId?: number;
    limit?: number;
    includeTranscripts?: boolean;
  }) {
    return await this.search.fullTextSearch(query, options);
  }

  async getRecentActivity(limit = 20) {
    const recentlyPlayed = await this.episodes.findRecentlyPlayed(limit);
    const inProgress = await this.episodes.findInProgress(limit);

    return {
      recentlyPlayed,
      inProgress,
    };
  }

  async getLibraryStats() {
    const feedStats = await this.feeds.getFeedsStats();
    const episodeStats = await this.episodes.getStats();
    const searchStats = await this.search.getSearchStats();

    return {
      feeds: feedStats,
      episodes: episodeStats,
      search: searchStats,
    };
  }

  async getPlaybackStateWithQueue() {
    const [state, queue] = await Promise.all([
      this.playbackState.get(),
      this.playQueue.getAll(),
    ]);

    return {
      playbackState: state,
      queue,
    };
  }

  // Transaction support (when available)
  async transaction<T>(callback: (service: DatabaseService) => Promise<T>): Promise<T> {
    // TODO: Implement proper transaction support when database is available
    return await callback(this);
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
}
