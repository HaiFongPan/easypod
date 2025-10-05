import { eq, sql } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { playbackState, episodes, feeds } from '../schema';
import type { EpisodeWithFeed } from './episodesDao';

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
}
