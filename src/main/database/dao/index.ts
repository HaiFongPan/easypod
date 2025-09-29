import { FeedsDao } from './feedsDao';
import { EpisodesDao } from './episodesDao';
import { SearchDao } from './searchDao';

export * from './feedsDao';
export * from './episodesDao';
export * from './searchDao';

// Database service that provides access to all DAOs
export class DatabaseService {
  private _feeds: FeedsDao | null = null;
  private _episodes: EpisodesDao | null = null;
  private _search: SearchDao | null = null;

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