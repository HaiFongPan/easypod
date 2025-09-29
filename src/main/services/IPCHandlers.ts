import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { PodcastFeedParser } from './FeedParser';
// import { FeedService } from './FeedService';
// import { Feed, Episode } from '../database/schema';

/**
 * IPC Handlers for RSS Feed functionality
 * Bridges the RSS parsing services with the renderer process
 */
export class FeedIPCHandlers {
  private parser: PodcastFeedParser;

  constructor() {
    this.parser = new PodcastFeedParser();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Feed subscription and management
    ipcMain.handle('feeds:subscribe', this.handleSubscribeFeed.bind(this));
    ipcMain.handle('feeds:unsubscribe', this.handleUnsubscribeFeed.bind(this));
    ipcMain.handle('feeds:getAll', this.handleGetAllFeeds.bind(this));
    ipcMain.handle('feeds:getById', this.handleGetFeedById.bind(this));
    ipcMain.handle('feeds:refresh', this.handleRefreshFeed.bind(this));
    ipcMain.handle('feeds:refreshAll', this.handleRefreshAllFeeds.bind(this));
    ipcMain.handle('feeds:validate', this.handleValidateFeedUrl.bind(this));

    // Episode management
    ipcMain.handle('episodes:getByFeed', this.handleGetEpisodesByFeed.bind(this));
    ipcMain.handle('episodes:getById', this.handleGetEpisodeById.bind(this));
    ipcMain.handle('episodes:search', this.handleSearchEpisodes.bind(this));
    ipcMain.handle('episodes:updatePlayback', this.handleUpdateEpisodePlayback.bind(this));

    // Cache management
    ipcMain.handle('feeds:getCacheStats', this.handleGetCacheStats.bind(this));
    ipcMain.handle('feeds:clearCache', this.handleClearCache.bind(this));
  }

  /**
   * Subscribe to a new RSS feed
   */
  private async handleSubscribeFeed(
    event: IpcMainInvokeEvent,
    url: string,
    opmlGroup?: string
  ): Promise<{ success: boolean; feed?: any; error?: string }> {
    try {
      const parsedFeed = await this.parser.parseFeed(url);
      // For now, just return the parsed feed without database storage
      return {
        success: true,
        feed: {
          id: Date.now(),
          title: parsedFeed.title,
          url: parsedFeed.url,
          coverUrl: parsedFeed.image,
          description: parsedFeed.description,
          episodeCount: parsedFeed.episodes.length,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe to feed',
      };
    }
  }

  /**
   * Unsubscribe from a feed
   */
  private async handleUnsubscribeFeed(
    event: IpcMainInvokeEvent,
    feedId: number
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement with database
    return { success: true };
  }

  /**
   * Get all subscribed feeds
   */
  private async handleGetAllFeeds(event: IpcMainInvokeEvent): Promise<any[]> {
    try {
      // TODO: Implement with database
      console.log('Getting all feeds - returning empty array for now');
      return [];
    } catch (error) {
      console.error('Error getting all feeds:', error);
      return [];
    }
  }

  /**
   * Get feed by ID with episode count
   */
  private async handleGetFeedById(
    event: IpcMainInvokeEvent,
    feedId: number
  ): Promise<any | null> {
    // TODO: Implement with database
    return null;
  }

  /**
   * Refresh a specific feed
   */
  private async handleRefreshFeed(
    event: IpcMainInvokeEvent,
    feedId: number
  ): Promise<{ success: boolean; hasUpdates?: boolean; error?: string }> {
    // TODO: Implement with database
    return { success: true, hasUpdates: false };
  }

  /**
   * Refresh all feeds
   */
  private async handleRefreshAllFeeds(
    event: IpcMainInvokeEvent
  ): Promise<{ updated: number; errors: string[] }> {
    // TODO: Implement with database
    return { updated: 0, errors: [] };
  }

  /**
   * Validate feed URL without subscribing
   */
  private async handleValidateFeedUrl(
    event: IpcMainInvokeEvent,
    url: string
  ): Promise<{ valid: boolean; title?: string; error?: string }> {
    try {
      console.log('Validating feed URL:', url);
      const parsedFeed = await this.parser.parseFeed(url);
      console.log('Parsed feed:', parsedFeed ? 'Success' : 'Failed');

      if (!parsedFeed) {
        return {
          valid: false,
          error: 'Failed to parse feed',
        };
      }

      const validation = this.parser.validateFeed(parsedFeed);
      console.log('Validation result:', validation);

      if (!validation.isValid) {
        return {
          valid: false,
          error: validation.errors.join(', '),
        };
      }

      return {
        valid: true,
        title: parsedFeed.title,
      };
    } catch (error) {
      console.error('RSS validation error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get episodes for a feed
   */
  private async handleGetEpisodesByFeed(
    event: IpcMainInvokeEvent,
    feedId: number,
    limit = 50,
    offset = 0
  ): Promise<any[]> {
    // TODO: Implement with database
    return [];
  }

  /**
   * Get episode by ID with chapters
   */
  private async handleGetEpisodeById(
    event: IpcMainInvokeEvent,
    episodeId: number
  ): Promise<any | null> {
    // TODO: Implement with database
    return null;
  }

  /**
   * Search episodes across all feeds
   */
  private async handleSearchEpisodes(
    event: IpcMainInvokeEvent,
    query: string,
    limit = 20
  ): Promise<any[]> {
    // TODO: Implement with database
    return [];
  }

  /**
   * Update episode playback status
   */
  private async handleUpdateEpisodePlayback(
    event: IpcMainInvokeEvent,
    episodeId: number,
    position: number,
    status?: 'new' | 'in_progress' | 'played' | 'archived'
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement with database
    return { success: true };
  }

  /**
   * Get cache statistics
   */
  private async handleGetCacheStats(event: IpcMainInvokeEvent): Promise<{ size: number; urls: string[] }> {
    return this.parser.getCacheStats();
  }

  /**
   * Clear parser cache
   */
  private async handleClearCache(event: IpcMainInvokeEvent): Promise<{ success: boolean }> {
    this.parser.clearCache();
    return { success: true };
  }

  /**
   * Cleanup IPC handlers
   */
  destroy(): void {
    const handlers = [
      'feeds:subscribe',
      'feeds:unsubscribe',
      'feeds:getAll',
      'feeds:getById',
      'feeds:refresh',
      'feeds:refreshAll',
      'feeds:validate',
      'episodes:getByFeed',
      'episodes:getById',
      'episodes:search',
      'episodes:updatePlayback',
      'feeds:getCacheStats',
      'feeds:clearCache',
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });
  }
}