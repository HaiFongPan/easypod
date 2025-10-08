import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { PodcastFeedParser } from './FeedParser';
import { FeedsDao } from '../database/dao/feedsDao';
import { EpisodesDao } from '../database/dao/episodesDao';
import { PlayQueueDao, type PlayQueueEntry } from '../database/dao/playQueueDao';
import { PlaybackStateDao, type PlaybackStateWithEpisode } from '../database/dao/playbackStateDao';
import { EpisodeTranscriptsDao, type TranscriptData } from '../database/dao/episodeTranscriptsDao';
import { LlmProvidersDao } from '../database/dao/llmProvidersDao';
import { LlmModelsDao } from '../database/dao/llmModelsDao';
import { PromptsDao } from '../database/dao/promptsDao';
import { AIServiceManager } from './ai/AIServiceManager';
import type { NewFeed, NewEpisode } from '../database/schema';
import OpenAI from 'openai';

/**
 * IPC Handlers for RSS Feed functionality
 * Bridges the RSS parsing services with the renderer process
 */
export class FeedIPCHandlers {
  private parser: PodcastFeedParser;
  private feedsDao: FeedsDao;
  private episodesDao: EpisodesDao;
  private playQueueDao: PlayQueueDao;
  private playbackStateDao: PlaybackStateDao;
  private episodeTranscriptsDao: EpisodeTranscriptsDao;
  private llmProvidersDao: LlmProvidersDao;
  private llmModelsDao: LlmModelsDao;
  private promptsDao: PromptsDao;
  private aiServiceManager: AIServiceManager;

  constructor() {
    this.parser = new PodcastFeedParser();
    this.feedsDao = new FeedsDao();
    this.episodesDao = new EpisodesDao();
    this.playQueueDao = new PlayQueueDao();
    this.playbackStateDao = new PlaybackStateDao();
    this.episodeTranscriptsDao = new EpisodeTranscriptsDao();
    this.llmProvidersDao = new LlmProvidersDao();
    this.llmModelsDao = new LlmModelsDao();
    this.promptsDao = new PromptsDao();
    this.aiServiceManager = new AIServiceManager();
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
    ipcMain.handle('feeds:preview', this.handlePreviewFeed.bind(this));

    // Episode management
    ipcMain.handle('episodes:getAll', this.handleGetAllEpisodes.bind(this));
    ipcMain.handle('episodes:getByFeed', this.handleGetEpisodesByFeed.bind(this));
    ipcMain.handle('episodes:getById', this.handleGetEpisodeById.bind(this));
    ipcMain.handle('episodes:search', this.handleSearchEpisodes.bind(this));
    ipcMain.handle('episodes:updatePlayback', this.handleUpdateEpisodePlayback.bind(this));
    ipcMain.handle('episodes:updateProgress', this.handleUpdateEpisodeProgress.bind(this));
    ipcMain.handle('episodes:markAsPlayed', this.handleMarkEpisodeAsPlayed.bind(this));
    ipcMain.handle('episodes:markAsNew', this.handleMarkEpisodeAsNew.bind(this));
    ipcMain.handle('episodes:markAsArchived', this.handleMarkEpisodeAsArchived.bind(this));
    ipcMain.handle('episodes:getRecentlyPlayed', this.handleGetRecentlyPlayed.bind(this));

    // Play queue management
    ipcMain.handle('playQueue:getAll', this.handleGetPlayQueue.bind(this));
    ipcMain.handle('playQueue:add', this.handleAddToPlayQueue.bind(this));
    ipcMain.handle('playQueue:remove', this.handleRemoveFromPlayQueue.bind(this));
    ipcMain.handle('playQueue:reorder', this.handleReorderPlayQueue.bind(this));
    ipcMain.handle('playQueue:clear', this.handleClearPlayQueue.bind(this));

    // Playback state persistence
    ipcMain.handle('playbackState:get', this.handleGetPlaybackState.bind(this));
    ipcMain.handle('playbackState:save', this.handleSavePlaybackState.bind(this));

    // Transcript management
    ipcMain.handle('transcript:getByEpisode', this.handleGetTranscriptByEpisode.bind(this));

    // Cache management
    ipcMain.handle('feeds:getCacheStats', this.handleGetCacheStats.bind(this));
    ipcMain.handle('feeds:clearCache', this.handleClearCache.bind(this));

    // LLM Providers
    ipcMain.handle('llmProviders:getAll', this.handleGetAllProviders.bind(this));
    ipcMain.handle('llmProviders:create', this.handleCreateProvider.bind(this));
    ipcMain.handle('llmProviders:update', this.handleUpdateProvider.bind(this));
    ipcMain.handle('llmProviders:delete', this.handleDeleteProvider.bind(this));
    ipcMain.handle('llmProviders:setDefault', this.handleSetDefaultProvider.bind(this));
    ipcMain.handle('llmProviders:validate', this.handleValidateProvider.bind(this));

    // LLM Models
    ipcMain.handle('llmModels:getAll', this.handleGetAllModels.bind(this));
    ipcMain.handle('llmModels:getByProvider', this.handleGetModelsByProvider.bind(this));
    ipcMain.handle('llmModels:create', this.handleCreateModel.bind(this));
    ipcMain.handle('llmModels:update', this.handleUpdateModel.bind(this));
    ipcMain.handle('llmModels:delete', this.handleDeleteModel.bind(this));
    ipcMain.handle('llmModels:setDefault', this.handleSetDefaultModel.bind(this));

    // Prompts
    ipcMain.handle('prompts:getAll', this.handleGetAllPrompts.bind(this));
    ipcMain.handle('prompts:create', this.handleCreatePrompt.bind(this));
    ipcMain.handle('prompts:update', this.handleUpdatePrompt.bind(this));
    ipcMain.handle('prompts:delete', this.handleDeletePrompt.bind(this));

    // AI Operations
    ipcMain.handle('ai:generateSummary', this.handleGenerateSummary.bind(this));
    ipcMain.handle('ai:generateChapters', this.handleGenerateChapters.bind(this));
    ipcMain.handle('ai:getMindmap', this.handleGetMindmap.bind(this));
    ipcMain.handle('ai:getSummary', this.handleGetSummary.bind(this));
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
      // Check if feed already exists
      const existingFeed = await this.feedsDao.findByUrl(url);

      if (existingFeed) {
        // If feed exists but is not subscribed, subscribe to it
        if (!existingFeed.isSubscribed) {
          await this.feedsDao.subscribe(existingFeed.id);

          // Refresh episodes for the feed
          const parsedFeed = await this.parser.parseFeed(url);
          const { latestPubDate } = await this.saveFeedEpisodes(existingFeed.id, parsedFeed, existingFeed.coverUrl);

          if (latestPubDate) {
            await this.feedsDao.update(existingFeed.id, { lastPubDate: latestPubDate });
          }

          const refreshedFeed = await this.feedsDao.findById(existingFeed.id);
          const episodeCount = await this.episodesDao.countByFeed([existingFeed.id]);

          return {
            success: true,
            feed: {
              ...(refreshedFeed ?? existingFeed),
              isSubscribed: true,
              episodeCount: episodeCount[existingFeed.id] || 0,
            }
          };
        }

        // Already subscribed
        return {
          success: false,
          error: 'Already subscribed to this feed',
        };
      }

      // Parse the feed
      const parsedFeed = await this.parser.parseFeed(url);
      const resolvedFeedCoverUrl = parsedFeed.image || parsedFeed.episodes.find(ep => ep.episodeImage)?.episodeImage || null;

      // Create new feed with isSubscribed = true
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

      // Mark as subscribed
      await this.feedsDao.subscribe(feed.id);

      // Save episodes to database
      const { count: episodeCount, latestPubDate } = await this.saveFeedEpisodes(
        feed.id,
        parsedFeed,
        resolvedFeedCoverUrl,
      );
      let updatedFeed = feed;
      if (latestPubDate) {
        const refreshed = await this.feedsDao.update(feed.id, {
          lastPubDate: latestPubDate,
        });
        if (refreshed) {
          updatedFeed = refreshed;
        }
      }

      return {
        success: true,
        feed: {
          ...updatedFeed,
          isSubscribed: true,
          episodeCount,
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
   * Helper method to save feed episodes
   */
  private async saveFeedEpisodes(
    feedId: number,
    parsedFeed: any,
    coverUrl: string | null
  ): Promise<{ count: number; latestPubDate: string | null }> {
    const episodes: NewEpisode[] = parsedFeed.episodes.map((ep: any) => ({
      feedId,
      guid: ep.guid || ep.audioUrl || `${feedId}-${ep.title}`,
      title: ep.title,
      descriptionHtml: ep.descriptionHtml || ep.description || null,
      audioUrl: ep.audioUrl || '',
      pubDate: ep.pubDate instanceof Date ? ep.pubDate.toISOString() : new Date().toISOString(),
      durationSec: ep.duration || null,
      episodeImageUrl: ep.episodeImage || coverUrl,
      localAudioPath: null,
      status: 'new',
      lastPlayedAt: null,
      lastPositionSec: 0,
      metaJson: JSON.stringify({
        explicit: ep.explicit,
        keywords: ep.keywords,
      }),
    }));

    const latestPubDateIso: string | null = parsedFeed.episodes.reduce(
      (latest: string | null, episode: any) => {
        const sourceDate =
          episode.pubDate instanceof Date
            ? episode.pubDate
            : episode.pubDate
              ? new Date(episode.pubDate)
              : null;
        if (!sourceDate || Number.isNaN(sourceDate.getTime())) {
          return latest;
        }
        if (!latest) {
          return sourceDate.toISOString();
        }
        return sourceDate.getTime() > new Date(latest).getTime()
          ? sourceDate.toISOString()
          : latest;
      },
      null,
    );

    // Batch insert episodes (using INSERT OR IGNORE to handle duplicates)
    if (episodes.length > 0) {
      try {
        await this.episodesDao.createMany(episodes);
      } catch (error) {
        console.warn('Some episodes may already exist, continuing...', error);
      }
    }

    return {
      count: episodes.length,
      latestPubDate: latestPubDateIso,
    };
  }

  /**
   * Unsubscribe from a feed
   */
  private async handleUnsubscribeFeed(
    event: IpcMainInvokeEvent,
    feedId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update isSubscribed to false instead of deleting
      await this.feedsDao.unsubscribe(feedId);
      return { success: true };
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
      // Only return subscribed feeds
      const feeds = await this.feedsDao.findSubscribed();
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
        author: feed.metaJson ? (() => {
          try {
            const parsed = JSON.parse(feed.metaJson);
            return parsed?.author ?? parsed?.ownerName ?? null;
          } catch (error) {
            console.warn('Failed to parse feed metaJson for author', feed.id, error);
            return null;
          }
        })() : null,
        categories: feed.metaJson ? (() => {
          try {
            const parsed = JSON.parse(feed.metaJson);
            const categories = parsed?.categories;
            if (Array.isArray(categories)) {
              return categories;
            }
            if (typeof categories === 'string') {
              return categories.split(',').map((item: string) => item.trim()).filter(Boolean);
            }
            return null;
          } catch (error) {
            console.warn('Failed to parse feed metaJson for categories', feed.id, error);
            return null;
          }
        })() : null,
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
  ): Promise<{ success: boolean; hasUpdates?: boolean; newEpisodes?: number; lastPubDate?: string | null; error?: string }> {
    try {
      const feed = await this.feedsDao.findById(feedId);
      if (!feed) {
        return { success: false, error: 'Feed not found' };
      }

      // Parse the feed
      const parsedFeed = await this.parser.parseFeed(feed.url);
      const resolvedFeedCoverUrl = parsedFeed.image || feed.coverUrl || parsedFeed.episodes.find(ep => ep.episodeImage)?.episodeImage || null;
      const latestParsedPubDate: string | null = parsedFeed.episodes.reduce(
        (latest: string | null, episode: any) => {
          const sourceDate =
            episode.pubDate instanceof Date
              ? episode.pubDate
              : episode.pubDate
                ? new Date(episode.pubDate)
                : null;
          if (!sourceDate || Number.isNaN(sourceDate.getTime())) {
            return latest;
          }
          if (!latest) {
            return sourceDate.toISOString();
          }
          return sourceDate.getTime() > new Date(latest).getTime()
            ? sourceDate.toISOString()
            : latest;
        },
        null,
      );

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
        ...(latestParsedPubDate
          ? { lastPubDate: latestParsedPubDate }
          : {}),
      });
      await this.feedsDao.updateLastChecked(feedId);

      return {
        success: true,
        hasUpdates: newEpisodes.length > 0 || episodesNeedingArtwork.length > 0,
        newEpisodes: newEpisodes.length,
        lastPubDate: latestParsedPubDate ?? feed.lastPubDate ?? null,
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
      // Only refresh subscribed feeds
      const feeds = await this.feedsDao.findSubscribed();
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

  private async handlePreviewFeed(
    event: IpcMainInvokeEvent,
    url: string
  ): Promise<{
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
  }> {
    try {
      const parsedFeed = await this.parser.parseFeed(url);
      const coverImage =
        parsedFeed.image ||
        parsedFeed.episodes.find((episode) => episode.episodeImage)?.episodeImage ||
        null;

      const episodes = parsedFeed.episodes.slice(0, 20).map((episode) => ({
        id: episode.guid || episode.audioUrl || `${parsedFeed.url || url}-${episode.title}`.slice(0, 120),
        title: episode.title,
        duration: episode.duration ?? null,
        image: episode.episodeImage || coverImage || null,
        pubDate:
          episode.pubDate instanceof Date ? episode.pubDate.toISOString() : null,
      }));

      return {
        success: true,
        feed: {
          title: parsedFeed.title,
          description: parsedFeed.description || null,
          image: coverImage,
          author: parsedFeed.author || null,
          url: parsedFeed.url || url,
        },
        episodes,
      };
    } catch (error) {
      console.error('Feed preview error:', error);
      return {
        success: false,
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
        return await this.episodesDao.findByFeed(
          options.feedId,
          options.limit,
          options.offset,
        );
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
      const episodes = await this.episodesDao.findByFeed(feedId, limit, offset);
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
   * Mark episode as archived
   */
  private async handleMarkEpisodeAsArchived(
    event: IpcMainInvokeEvent,
    episodeId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.episodesDao.markAsArchived(episodeId);
      return { success: true };
    } catch (error) {
      console.error('Error marking episode as archived:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as archived',
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
   * Play queue handlers
   */
  private async handleGetPlayQueue(): Promise<PlayQueueEntry[]> {
    try {
      return await this.playQueueDao.getAll();
    } catch (error) {
      console.error('Error loading play queue:', error);
      return [];
    }
  }

  private async handleAddToPlayQueue(
    event: IpcMainInvokeEvent,
    episodeId: number,
    strategy?: number | 'play-next' | 'end',
    currentIndex?: number
  ): Promise<{ success: boolean; queue: PlayQueueEntry[]; error?: string }> {
    try {
      await this.playQueueDao.add(episodeId, strategy, currentIndex);
      const queue = await this.playQueueDao.getAll();
      return { success: true, queue };
    } catch (error) {
      console.error('Error adding episode to play queue:', error);
      return {
        success: false,
        queue: [],
        error: error instanceof Error ? error.message : 'Failed to add to queue',
      };
    }
  }

  private async handleRemoveFromPlayQueue(
    event: IpcMainInvokeEvent,
    episodeId: number
  ): Promise<{ success: boolean; queue: PlayQueueEntry[]; error?: string }> {
    try {
      await this.playQueueDao.removeByEpisodeId(episodeId);
      const queue = await this.playQueueDao.getAll();
      return { success: true, queue };
    } catch (error) {
      console.error('Error removing episode from play queue:', error);
      return {
        success: false,
        queue: [],
        error: error instanceof Error ? error.message : 'Failed to remove from queue',
      };
    }
  }

  private async handleClearPlayQueue(): Promise<{ success: boolean; queue: PlayQueueEntry[]; error?: string }> {
    try {
      await this.playQueueDao.clear();
      return { success: true, queue: [] };
    } catch (error) {
      console.error('Error clearing play queue:', error);
      return {
        success: false,
        queue: [],
        error: error instanceof Error ? error.message : 'Failed to clear queue',
      };
    }
  }

  private async handleReorderPlayQueue(
    event: IpcMainInvokeEvent,
    items: Array<{ id: number; position: number }>
  ): Promise<{ success: boolean; queue: PlayQueueEntry[]; error?: string }> {
    try {
      await this.playQueueDao.reorder(items);
      const queue = await this.playQueueDao.getAll();
      return { success: true, queue };
    } catch (error) {
      console.error('Error reordering play queue:', error);
      return {
        success: false,
        queue: [],
        error: error instanceof Error ? error.message : 'Failed to reorder queue',
      };
    }
  }

  /**
   * Playback state handlers
   */
  private async handleGetPlaybackState(): Promise<PlaybackStateWithEpisode> {
    try {
      return await this.playbackStateDao.get();
    } catch (error) {
      console.error('Error loading playback state:', error);
      return {
        state: {
          id: 1,
          currentEpisodeId: null,
          currentPosition: 0,
          updatedAt: null,
        },
        episode: null,
      };
    }
  }

  private async handleSavePlaybackState(
    event: IpcMainInvokeEvent,
    episodeId: number | null,
    position: number,
    duration?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Use new unified save method if duration is provided
      if (duration !== undefined && duration > 0) {
        await this.playbackStateDao.saveWithEpisodeUpdate(episodeId, position, duration);
      } else {
        // Fallback to original save for backward compatibility
        await this.playbackStateDao.save(episodeId, position);
      }
      return { success: true };
    } catch (error) {
      console.error('Error saving playback state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save playback state',
      };
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
   * Get transcript by episode ID
   */
  private async handleGetTranscriptByEpisode(
    event: IpcMainInvokeEvent,
    episodeId: number
  ): Promise<{ success: boolean; transcript?: TranscriptData; error?: string }> {
    try {
      const transcript = await this.episodeTranscriptsDao.findByEpisodeId(episodeId);

      if (!transcript) {
        return {
          success: false,
          error: 'No transcript found for this episode',
        };
      }

      return {
        success: true,
        transcript,
      };
    } catch (error) {
      console.error('[IPCHandlers] Error getting transcript:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transcript',
      };
    }
  }

  // =====================
  // LLM Provider Handlers
  // =====================

  private async handleGetAllProviders(): Promise<any> {
    try {
      return await this.llmProvidersDao.findAll();
    } catch (error) {
      console.error('Error getting all providers:', error);
      return [];
    }
  }

  private async handleCreateProvider(_: IpcMainInvokeEvent, data: any): Promise<any> {
    try {
      const provider = await this.llmProvidersDao.create(data);
      return { success: true, provider };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleUpdateProvider(_: IpcMainInvokeEvent, id: number, data: any): Promise<any> {
    try {
      const provider = await this.llmProvidersDao.update(id, data);
      return { success: true, provider };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleDeleteProvider(_: IpcMainInvokeEvent, id: number): Promise<any> {
    try {
      await this.llmProvidersDao.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleSetDefaultProvider(_: IpcMainInvokeEvent, id: number): Promise<any> {
    try {
      await this.llmProvidersDao.setDefault(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleValidateProvider(
    _: IpcMainInvokeEvent,
    id: number
  ): Promise<{ success: boolean; message?: string; error?: string; modelsAdded?: number }> {
    try {
      const provider = await this.llmProvidersDao.findById(id);
      if (!provider) {
        return { success: false, error: '未找到对应的 Provider' };
      }

      if (!provider.apiKey || provider.apiKey.trim() === '') {
        return { success: false, error: '请先配置 API Key' };
      }

      let headers: Record<string, string> | undefined;
      if (provider.headersJson) {
        try {
          headers = JSON.parse(provider.headersJson);
        } catch (error) {
          return { success: false, error: '自定义请求头格式错误，请确认为合法 JSON' };
        }
      }

      const client = new OpenAI({
        baseURL: provider.baseUrl || undefined,
        apiKey: provider.apiKey,
        timeout: provider.timeout ?? 30000,
        defaultHeaders: headers,
      });

      const response = await client.models.list();
      const remoteModels = Array.isArray(response.data) ? response.data : [];

      const existingModels = await this.llmModelsDao.findByProvider(provider.id);
      const existingCodes = new Set(existingModels.map(model => model.code));
      const hasDefaultModel = existingModels.some(model => model.isDefault);

      let addedCount = 0;
      let defaultModelId: number | null = null;

      for (const remoteModel of remoteModels) {
        const code = typeof remoteModel?.id === 'string' ? remoteModel.id : null;
        if (!code || existingCodes.has(code)) {
          continue;
        }

        const createdModel = await this.llmModelsDao.create({
          providerId: provider.id,
          name: code,
          code,
        });

        existingCodes.add(code);
        addedCount += 1;

        if (!hasDefaultModel && defaultModelId === null) {
          defaultModelId = createdModel.id;
        }
      }

      if (defaultModelId !== null) {
        await this.llmModelsDao.setDefault(provider.id, defaultModelId);
      }

      const modelCount = remoteModels.length;
      const firstModel = remoteModels[0]?.id;

      const details =
        modelCount === 0
          ? '未能获取模型列表，请确认该服务已启用'
          : `可用模型数量：${modelCount}${firstModel ? `，示例：${firstModel}` : ''}`;

      const syncSummary =
        addedCount > 0 ? `已新增 ${addedCount} 个模型` : '没有新增模型';

      return {
        success: true,
        message: `连接成功。${details}。${syncSummary}`,
        modelsAdded: addedCount,
      };
    } catch (error) {
      console.error('Error validating provider:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '验证失败，请检查日志',
      };
    }
  }

  // ==================
  // LLM Model Handlers
  // ==================

  private async handleGetAllModels(): Promise<any> {
    try {
      return await this.llmModelsDao.findAll();
    } catch (error) {
      console.error('Error getting all models:', error);
      return [];
    }
  }

  private async handleGetModelsByProvider(_: IpcMainInvokeEvent, providerId: number): Promise<any> {
    try {
      return await this.llmModelsDao.findByProvider(providerId);
    } catch (error) {
      console.error('Error getting models by provider:', error);
      return [];
    }
  }

  private async handleCreateModel(_: IpcMainInvokeEvent, data: any): Promise<any> {
    try {
      const model = await this.llmModelsDao.create(data);
      return { success: true, model };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleUpdateModel(_: IpcMainInvokeEvent, id: number, data: any): Promise<any> {
    try {
      const model = await this.llmModelsDao.update(id, data);
      return { success: true, model };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleDeleteModel(_: IpcMainInvokeEvent, id: number): Promise<any> {
    try {
      await this.llmModelsDao.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleSetDefaultModel(_: IpcMainInvokeEvent, providerId: number, modelId: number): Promise<any> {
    try {
      await this.llmModelsDao.setDefault(providerId, modelId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ===============
  // Prompt Handlers
  // ===============

  private async handleGetAllPrompts(): Promise<any> {
    try {
      return await this.promptsDao.findAll();
    } catch (error) {
      console.error('Error getting all prompts:', error);
      return [];
    }
  }

  private async handleCreatePrompt(_: IpcMainInvokeEvent, data: any): Promise<any> {
    try {
      const prompt = await this.promptsDao.create(data);
      return { success: true, prompt };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleUpdatePrompt(_: IpcMainInvokeEvent, id: number, data: any): Promise<any> {
    try {
      const prompt = await this.promptsDao.update(id, data);
      return { success: true, prompt };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async handleDeletePrompt(_: IpcMainInvokeEvent, id: number): Promise<any> {
    try {
      await this.promptsDao.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ======================
  // AI Operation Handlers
  // ======================

  private async handleGenerateSummary(_: IpcMainInvokeEvent, episodeId: number): Promise<any> {
    return await this.aiServiceManager.generateSummary(episodeId);
  }

  private async handleGenerateChapters(_: IpcMainInvokeEvent, episodeId: number): Promise<any> {
    return await this.aiServiceManager.generateChapters(episodeId);
  }

  private async handleGetMindmap(_: IpcMainInvokeEvent, episodeId: number): Promise<any> {
    return await this.aiServiceManager.getMindmap(episodeId);
  }

  private async handleGetSummary(_: IpcMainInvokeEvent, episodeId: number): Promise<any> {
    return await this.aiServiceManager.getSummary(episodeId);
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
      'feeds:preview',
      'episodes:getByFeed',
      'episodes:getById',
      'episodes:search',
      'episodes:updatePlayback',
      'episodes:updateProgress',
      'episodes:markAsPlayed',
      'episodes:markAsNew',
      'episodes:markAsArchived',
      'episodes:getRecentlyPlayed',
      'playQueue:getAll',
      'playQueue:add',
      'playQueue:remove',
      'playQueue:reorder',
      'playQueue:clear',
      'playbackState:get',
      'playbackState:save',
      'transcript:getByEpisode',
      'feeds:getCacheStats',
      'feeds:clearCache',
      'llmProviders:getAll',
      'llmProviders:create',
      'llmProviders:update',
      'llmProviders:delete',
      'llmProviders:setDefault',
      'llmProviders:validate',
      'llmModels:getAll',
      'llmModels:getByProvider',
      'llmModels:create',
      'llmModels:update',
      'llmModels:delete',
      'llmModels:setDefault',
      'prompts:getAll',
      'prompts:create',
      'prompts:update',
      'prompts:delete',
      'ai:generateSummary',
      'ai:generateChapters',
      'ai:getMindmap',
      'ai:getSummary',
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });
  }
}
