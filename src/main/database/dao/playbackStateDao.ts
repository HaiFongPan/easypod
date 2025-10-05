import { eq, sql } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { playbackState, episodes, feeds } from '../schema';
import type { EpisodeWithFeed } from './episodesDao';
import { EpisodesDao } from './episodesDao';

export interface PlaybackStateEntry {
  id: number;
  currentEpisodeId: number | null;
  currentPosition: number;
  updatedAt: string | null;
}

export interface PlaybackStateWithEpisode {
  state: PlaybackStateEntry;
  episode: EpisodeWithFeed | null;
}

export class PlaybackStateDao {
  private episodesDao: EpisodesDao;

  constructor() {
    this.episodesDao = new EpisodesDao();
  }

  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  async get(): Promise<PlaybackStateWithEpisode> {
    const rows = await this.db
      .select({
        stateId: playbackState.id,
        currentEpisodeId: playbackState.currentEpisodeId,
        currentPosition: playbackState.currentPosition,
        updatedAt: playbackState.updatedAt,
        episode: {
          id: episodes.id,
          feedId: episodes.feedId,
          guid: episodes.guid,
          title: episodes.title,
          descriptionHtml: episodes.descriptionHtml,
          audioUrl: episodes.audioUrl,
          pubDate: episodes.pubDate,
          durationSec: episodes.durationSec,
          episodeImageUrl: episodes.episodeImageUrl,
          localAudioPath: episodes.localAudioPath,
          status: episodes.status,
          lastPlayedAt: episodes.lastPlayedAt,
          lastPositionSec: episodes.lastPositionSec,
          metaJson: episodes.metaJson,
          createdAt: episodes.createdAt,
          updatedAt: episodes.updatedAt,
          feedTitle: feeds.title,
          feedCoverUrl: feeds.coverUrl,
        },
      })
      .from(playbackState)
      .leftJoin(episodes, eq(playbackState.currentEpisodeId, episodes.id))
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .limit(1);

    const row = rows[0];

    const state: PlaybackStateEntry = {
      id: row?.stateId ?? 1,
      currentEpisodeId: row?.currentEpisodeId ?? null,
      currentPosition: row?.currentPosition ?? 0,
      updatedAt: row?.updatedAt ?? null,
    };

    if (!row?.episode?.id) {
      return { state, episode: null };
    }

    const episode = {
      ...row.episode,
      id: Number(row.episode.id),
      feedId: Number(row.episode.feedId),
      guid: row.episode.guid ?? '',
      title: row.episode.title ?? '',
      audioUrl: row.episode.audioUrl ?? '',
      status: row.episode.status ?? 'new',
      lastPositionSec: row.episode.lastPositionSec ?? 0,
      feedTitle: row.episode.feedTitle ?? undefined,
      feedCoverUrl: row.episode.feedCoverUrl ?? undefined,
      descriptionHtml: row.episode.descriptionHtml ?? null,
      durationSec: row.episode.durationSec ?? null,
      episodeImageUrl: row.episode.episodeImageUrl ?? null,
      localAudioPath: row.episode.localAudioPath ?? null,
      lastPlayedAt: row.episode.lastPlayedAt ?? null,
      metaJson: row.episode.metaJson ?? null,
      createdAt: row.episode.createdAt ?? null,
      updatedAt: row.episode.updatedAt ?? null,
      pubDate: row.episode.pubDate ?? null,
    } as EpisodeWithFeed;

    return { state, episode };
  }

  async save(currentEpisodeId: number | null, currentPosition: number): Promise<void> {
    const clampedPosition = Number.isFinite(currentPosition) && currentPosition >= 0
      ? Math.floor(currentPosition)
      : 0;

    await this.db
      .insert(playbackState)
      .values({
        id: 1,
        currentEpisodeId,
        currentPosition: clampedPosition,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: playbackState.id,
        set: {
          currentEpisodeId,
          currentPosition: clampedPosition,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  async clear(): Promise<void> {
    await this.db
      .update(playbackState)
      .set({
        currentEpisodeId: null,
        currentPosition: 0,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(playbackState.id, 1));
  }

  /**
   * Save playback state and synchronously update episode progress
   * @param currentEpisodeId - Episode ID being played
   * @param currentPosition - Current playback position in seconds
   * @param duration - Total episode duration in seconds (optional)
   */
  async saveWithEpisodeUpdate(
    currentEpisodeId: number | null,
    currentPosition: number,
    duration: number = 0
  ): Promise<void> {
    const clampedPosition = Number.isFinite(currentPosition) && currentPosition >= 0
      ? Math.floor(currentPosition)
      : 0;

    // Save to playbackState table
    await this.db
      .insert(playbackState)
      .values({
        id: 1,
        currentEpisodeId,
        currentPosition: clampedPosition,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: playbackState.id,
        set: {
          currentEpisodeId,
          currentPosition: clampedPosition,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    // Update episode progress if episode is being played
    if (currentEpisodeId && duration > 0) {
      const progressPercentage = (clampedPosition / duration) * 100;
      let newStatus: 'new' | 'in_progress' | 'archived';

      // Determine episode status based on progress
      if (clampedPosition === 0) {
        newStatus = 'new'; // Not played yet
      } else if (progressPercentage >= 95) {
        newStatus = 'archived'; // More than 95% played (consider finished)
      } else {
        newStatus = 'in_progress'; // Anything between 0% and 95% is in progress
      }

      const now = new Date().toISOString();
      await this.db
        .update(episodes)
        .set({
          lastPositionSec: clampedPosition,
          lastPlayedAt: now,
          status: newStatus,
          updatedAt: now,
        })
        .where(eq(episodes.id, currentEpisodeId));
    }
  }
}
