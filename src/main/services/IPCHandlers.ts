import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { PodcastFeedParser } from './FeedParser';
import { FeedsDao } from '../database/dao/feedsDao';
import { EpisodesDao } from '../database/dao/episodesDao';
import type { NewFeed, NewEpisode } from '../database/schema';

/**
 * IPC Handlers for RSS Feed functionality
 * Bridges the RSS parsing services with the renderer process
 */
export class FeedIPCHandlers {
  private parser: PodcastFeedParser;
  private feedsDao: FeedsDao;
  private episodesDao: EpisodesDao;

  constructor() {
    this.parser = new PodcastFeedParser();
    this.feedsDao = new FeedsDao();
    this.episodesDao = new EpisodesDao();
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
    ipcMain.handle('episodes:getAll', this.handleGetAllEpisodes.bind(this));
    ipcMain.handle('episodes:getByFeed', this.handleGetEpisodesByFeed.bind(this));
    ipcMain.handle('episodes:getById', this.handleGetEpisodeById.bind(this));
    ipcMain.handle('episodes:search', this.handleSearchEpisodes.bind(this));
    ipcMain.handle('episodes:updatePlayback', this.handleUpdateEpisodePlayback.bind(this));
    ipcMain.handle('episodes:updateProgress', this.handleUpdateEpisodeProgress.bind(this));
    ipcMain.handle('episodes:markAsPlayed', this.handleMarkEpisodeAsPlayed.bind(this));
    ipcMain.handle('episodes:markAsNew', this.handleMarkEpisodeAsNew.bind(this));
    ipcMain.handle('episodes:getRecentlyPlayed', this.handleGetRecentlyPlayed.bind(this));

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
      // Check if already subscribed
      const existingFeed = await this.feedsDao.findByUrl(url);
      if (existingFeed) {
        return {
          success: false,
          error: 'Already subscribed to this feed',
        };
      }

      // Parse the feed
      const parsedFeed = await this.parser.parseFeed(url);
      const resolvedFeedCoverUrl = parsedFeed.image || parsedFeed.episodes.find(ep => ep.episodeImage)?.episodeImage || null;

      // Save feed to database
      const newFeed: NewFeed = {
        title: parsedFeed.title,
        url: parsedFeed.url,
        coverUrl: resolvedFeedCoverUrl,
        description: parsedFeed.description || null,
        lastCheckedAt: new Date().toISOString(),
        opmlGroup: opmlGroup || null,
        metaJson: JSON.stringify({
          language: parsedFeed.language,
          author: parsedFeed.author,
          link: parsedFeed.link,
        }),
      };

      const feed = await this.feedsDao.create(newFeed);

      // Save episodes to database
      const episodes: NewEpisode[] = parsedFeed.episodes.map((ep) => ({
        feedId: feed.id!,
        guid: ep.guid || ep.audioUrl || `${feed.id}-${ep.title}`,
        title: ep.title,
        descriptionHtml: ep.descriptionHtml || ep.description || null,
        audioUrl: ep.audioUrl || '',
        pubDate: ep.pubDate instanceof Date ? ep.pubDate.toISOString() : new Date().toISOString(),
        durationSec: ep.duration || null,
        episodeImageUrl: ep.episodeImage || resolvedFeedCoverUrl,
        localAudioPath: null,
        status: 'new',
        lastPlayedAt: null,
        lastPositionSec: 0,
        metaJson: JSON.stringify({
          explicit: ep.explicit,
          keywords: ep.keywords,
        }),
      }));

      // Batch insert episodes
      if (episodes.length > 0) {
        await this.episodesDao.createMany(episodes);
      }

      return {
        success: true,
        feed: {
          ...feed,
          episodeCount: episodes.length,
        }
      };
    } catch (error) {
      console.error('Error subscribing to feed:', error);
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
    try {
      const deleted = await this.feedsDao.delete(feedId);
      return { success: deleted };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      };
    }
  }

  /**
   * Get all subscribed feeds
   */
  private async handleGetAllFeeds(event: IpcMainInvokeEvent): Promise<any[]> {
    try {
      const feeds = await this.feedsDao.findAll();
      const feedIds = feeds
        .map(feed => feed.id)
        .filter((id): id is number => typeof id === 'number');

      let episodeCounts: Record<number, number> = {};
      if (feedIds.length > 0) {
        episodeCounts = await this.episodesDao.countByFeed(feedIds);
      }

      return feeds.map(feed => ({
        ...feed,
        episodeCount: typeof feed.id === 'number' ? episodeCounts[feed.id] ?? 0 : 0,
      }));
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
    try {
      const result = await this.feedsDao.getFeedWithLatestEpisodes(feedId, 10);
      if (!result) return null;

      return {
        ...result.feed,
        episodeCount: result.episodes.length,
        latestEpisodes: result.episodes,
      };
    } catch (error) {
      console.error('Error getting feed by ID:', error);
      return null;
    }
  }

  /**
   * Refresh a specific feed
   */
  private async handleRefreshFeed(
    event: IpcMainInvokeEvent,
    feedId: number
  ): Promise<{ success: boolean; hasUpdates?: boolean; newEpisodes?: number; error?: string }> {
    try {
      const feed = await this.feedsDao.findById(feedId);
      if (!feed) {
        return { success: false, error: 'Feed not found' };
      }

      // Parse the feed
      const parsedFeed = await this.parser.parseFeed(feed.url);
      const resolvedFeedCoverUrl = parsedFeed.image || feed.coverUrl || parsedFeed.episodes.find(ep => ep.episodeImage)?.episodeImage || null;

      // Get existing episode GUIDs
      const existingEpisodes = await this.episodesDao.findByFeed(feedId);
      const existingGuids = new Set(existingEpisodes.map(ep => ep.guid));
      const parsedEpisodesByGuid = new Map(parsedFeed.episodes.map(ep => [ep.guid || ep.audioUrl || `${feedId}-${ep.title}`, ep]));

      // Find new episodes
      const newEpisodes: NewEpisode[] = [];
      for (const ep of parsedFeed.episodes) {
        const guid = ep.guid || ep.audioUrl || `${feedId}-${ep.title}`;
        if (!existingGuids.has(guid)) {
          newEpisodes.push({
            feedId: feed.id!,
            guid,
            title: ep.title,
            descriptionHtml: ep.descriptionHtml || ep.description || null,
            audioUrl: ep.audioUrl || '',
            pubDate: ep.pubDate instanceof Date ? ep.pubDate.toISOString() : new Date().toISOString(),
            durationSec: ep.duration || null,
            episodeImageUrl: ep.episodeImage || resolvedFeedCoverUrl,
            localAudioPath: null,
            status: 'new',
            lastPlayedAt: null,
            lastPositionSec: 0,
            metaJson: JSON.stringify({
              explicit: ep.explicit,
              keywords: ep.keywords,
            }),
          });
        }
      }

      // Insert new episodes
      if (newEpisodes.length > 0) {
        await this.episodesDao.createMany(newEpisodes);
      }

      // Backfill missing episode artwork
      const episodesNeedingArtwork = existingEpisodes
        .map(existing => {
          const parsedEpisode = parsedEpisodesByGuid.get(existing.guid);
          if (!parsedEpisode) {
            return null;
          }
          const desiredImage = parsedEpisode.episodeImage || resolvedFeedCoverUrl;
          if (desiredImage && desiredImage !== existing.episodeImageUrl) {
            return { id: existing.id, episodeImageUrl: desiredImage } as const;
          }
          if (!desiredImage && !existing.episodeImageUrl) {
            return null;
          }
          return null;
        })
        .filter((update): update is { id: number; episodeImageUrl: string } => Boolean(update));

      if (episodesNeedingArtwork.length > 0) {
        await Promise.all(
          episodesNeedingArtwork.map(update =>
            this.episodesDao.update(update.id, { episodeImageUrl: update.episodeImageUrl })
          )
        );
      }

      // Update feed metadata and last checked time
      await this.feedsDao.update(feedId, {
        coverUrl: resolvedFeedCoverUrl ?? feed.coverUrl,
        description: parsedFeed.description || feed.description,
      });
      await this.feedsDao.updateLastChecked(feedId);

      return {
        success: true,
        hasUpdates: newEpisodes.length > 0 || episodesNeedingArtwork.length > 0,
        newEpisodes: newEpisodes.length,
      };
    } catch (error) {
      console.error('Error refreshing feed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh feed',
      };
    }
  }

  /**
   * Refresh all feeds
   */
  private async handleRefreshAllFeeds(
    event: IpcMainInvokeEvent
  ): Promise<{ updated: number; errors: string[]; newEpisodesCount: number }> {
    try {
      const feeds = await this.feedsDao.findAll();
      let updated = 0;
      let newEpisodesCount = 0;
      const errors: string[] = [];

      for (const feed of feeds) {
        try {
          const result = await this.handleRefreshFeed(event, feed.id!);
          if (result.success) {
            updated++;
            newEpisodesCount += result.newEpisodes || 0;
          } else if (result.error) {
            errors.push(`${feed.title}: ${result.error}`);
          }
        } catch (error) {
          errors.push(`${feed.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { updated, errors, newEpisodesCount };
    } catch (error) {
      console.error('Error refreshing all feeds:', error);
      return { updated: 0, errors: ['Failed to refresh feeds'], newEpisodesCount: 0 };
    }
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
   * Get all episodes (with optional filters)
   */
  private async handleGetAllEpisodes(
    event: IpcMainInvokeEvent,
    options?: { feedId?: number; status?: string; limit?: number; offset?: number }
  ): Promise<any[]> {
    try {
      if (options?.feedId) {
        return await this.episodesDao.findByFeed(options.feedId, options.limit);
      }
      if (options?.status) {
        return await this.episodesDao.findByStatus(options.status as any, options.limit);
      }
      return await this.episodesDao.findAll(options?.limit);
    } catch (error) {
      console.error('Error getting all episodes:', error);
      return [];
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
    try {
      const episodes = await this.episodesDao.findByFeed(feedId, limit);
      return episodes;
    } catch (error) {
      console.error('Error getting episodes by feed:', error);
      return [];
    }
  }

  /**
   * Get episode by ID with chapters
   */
  private async handleGetEpisodeById(
    event: IpcMainInvokeEvent,
    episodeId: number
  ): Promise<any | null> {
    try {
      const result = await this.episodesDao.getEpisodeWithChapters(episodeId);
      return result;
    } catch (error) {
      console.error('Error getting episode by ID:', error);
      return null;
    }
  }

  /**
   * Search episodes across all feeds
   */
  private async handleSearchEpisodes(
    event: IpcMainInvokeEvent,
    query: string,
    limit = 20
  ): Promise<any[]> {
    try {
      const episodes = await this.episodesDao.search(query);
      return episodes.slice(0, limit);
    } catch (error) {
      console.error('Error searching episodes:', error);
      return [];
    }
  }

  /**
   * Update episode playback status (legacy - kept for compatibility)
   */
  private async handleUpdateEpisodePlayback(
    event: IpcMainInvokeEvent,
    episodeId: number,
    position: number,
    status?: 'new' | 'in_progress' | 'played' | 'archived'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.episodesDao.updatePlayPosition(episodeId, position);

      if (status) {
        await this.episodesDao.update(episodeId, { status });
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating episode playback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update playback',
      };
    }
  }

  /**
   * Update episode progress (new API)
   */
  private async handleUpdateEpisodeProgress(
    event: IpcMainInvokeEvent,
    data: { id: number; lastPositionSec: number; lastPlayedAt?: string; status?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.episodesDao.updatePlayPosition(data.id, data.lastPositionSec);

      if (data.status) {
        await this.episodesDao.update(data.id, { status: data.status });
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating episode progress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update progress',
      };
    }
  }

  /**
   * Mark episode as played
   */
  private async handleMarkEpisodeAsPlayed(
    event: IpcMainInvokeEvent,
    episodeId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.episodesDao.markAsPlayed(episodeId);
      return { success: true };
    } catch (error) {
      console.error('Error marking episode as played:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as played',
      };
    }
  }

  /**
   * Mark episode as new
   */
  private async handleMarkEpisodeAsNew(
    event: IpcMainInvokeEvent,
    episodeId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.episodesDao.markAsNew(episodeId);
      return { success: true };
    } catch (error) {
      console.error('Error marking episode as new:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as new',
      };
    }
  }

  /**
   * Get recently played episodes
   */
  private async handleGetRecentlyPlayed(
    event: IpcMainInvokeEvent,
    limit = 10
  ): Promise<any[]> {
    try {
      return await this.episodesDao.findRecentlyPlayed(limit);
    } catch (error) {
      console.error('Error getting recently played episodes:', error);
      return [];
    }
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
