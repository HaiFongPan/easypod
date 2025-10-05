import { asc, desc, eq, sql } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import {
  playQueue,
  episodes,
  feeds,
} from '../schema';
import type { EpisodeWithFeed } from './episodesDao';

const POSITION_GAP = 1000;

export interface PlayQueueEntry {
  id: number;
  episodeId: number;
  position: number;
  addedAt: string | null;
  episode: EpisodeWithFeed;
}

interface QueueRow {
  queueId: number;
  queueEpisodeId: number;
  queuePosition: number;
  queueAddedAt: string | null;
  episode: EpisodeWithFeed;
}

type InsertPositionStrategy = number | 'start' | 'end' | undefined;

export class PlayQueueDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  async getAll(): Promise<PlayQueueEntry[]> {
    const rows = await this.db
      .select({
        queueId: playQueue.id,
        queueEpisodeId: playQueue.episodeId,
        queuePosition: playQueue.position,
        queueAddedAt: playQueue.addedAt,
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
      .from(playQueue)
      .innerJoin(episodes, eq(playQueue.episodeId, episodes.id))
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .orderBy(asc(playQueue.position));

    return rows.map((row) => this.mapRow(row));
  }

  async add(episodeId: number, strategy?: InsertPositionStrategy): Promise<PlayQueueEntry | null> {
    const position = await this.computeInsertPosition(strategy);

    await this.db
      .insert(playQueue)
      .values({
        episodeId,
        position,
      })
      .onConflictDoUpdate({
        target: playQueue.episodeId,
        set: {
          position,
          addedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    await this.rebalanceIfNeeded();

    return await this.getByEpisodeId(episodeId);
  }

  async removeByEpisodeId(episodeId: number): Promise<void> {
    await this.db
      .delete(playQueue)
      .where(eq(playQueue.episodeId, episodeId));
  }

  async clear(): Promise<void> {
    await this.db.delete(playQueue);
  }

  async reorder(items: Array<{ id: number; position: number }>): Promise<void> {
    if (items.length === 0) {
      return;
    }

    for (const item of items) {
      await this.db
        .update(playQueue)
        .set({ position: item.position })
        .where(eq(playQueue.id, item.id));
    }

    await this.rebalanceIfNeeded();
  }

  async getByEpisodeId(episodeId: number): Promise<PlayQueueEntry | null> {
    const row = await this.db
      .select({
        queueId: playQueue.id,
        queueEpisodeId: playQueue.episodeId,
        queuePosition: playQueue.position,
        queueAddedAt: playQueue.addedAt,
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
      .from(playQueue)
      .innerJoin(episodes, eq(playQueue.episodeId, episodes.id))
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .where(eq(playQueue.episodeId, episodeId))
      .orderBy(asc(playQueue.position))
      .limit(1);

    const record = row[0];
    if (!record) {
      return null;
    }

    return this.mapRow(record);
  }

  private async computeInsertPosition(strategy?: InsertPositionStrategy): Promise<number> {
    if (typeof strategy === 'number') {
      return strategy;
    }

    const [{ minPosition } = { minPosition: null }] = await this.db
      .select({ minPosition: playQueue.position })
      .from(playQueue)
      .orderBy(asc(playQueue.position))
      .limit(1);

    const [{ maxPosition } = { maxPosition: null }] = await this.db
      .select({ maxPosition: playQueue.position })
      .from(playQueue)
      .orderBy(desc(playQueue.position))
      .limit(1);

    if (strategy === 'start') {
      if (minPosition === null) {
        return POSITION_GAP;
      }
      return minPosition - POSITION_GAP;
    }

    if (strategy === 'end') {
      if (maxPosition === null) {
        return POSITION_GAP;
      }
      return maxPosition + POSITION_GAP;
    }

    if (maxPosition === null) {
      return POSITION_GAP;
    }

    return maxPosition + POSITION_GAP;
  }

  private async rebalanceIfNeeded(): Promise<void> {
    const items = await this.db
      .select({
        id: playQueue.id,
        position: playQueue.position,
      })
      .from(playQueue)
      .orderBy(asc(playQueue.position));

    if (items.length === 0) {
      return;
    }

    const firstPosition = items[0].position ?? 0;

    if (items.length === 1) {
      if (firstPosition !== POSITION_GAP) {
        await this.db
          .update(playQueue)
          .set({ position: POSITION_GAP })
          .where(eq(playQueue.id, items[0].id));
      }
      return;
    }

    let needsRebalance = firstPosition < POSITION_GAP;

    if (!needsRebalance) {
      for (let i = 0; i < items.length - 1; i++) {
        const current = items[i];
        const next = items[i + 1];
        const gap = (next.position ?? 0) - (current.position ?? 0);
        if (gap < 10) {
          needsRebalance = true;
          break;
        }
      }
    }

    if (!needsRebalance) {
      return;
    }

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      await this.db
        .update(playQueue)
        .set({ position: (index + 1) * POSITION_GAP })
        .where(eq(playQueue.id, item.id));
    }
  }

  private mapRow(row: QueueRow): PlayQueueEntry {
    return {
      id: row.queueId,
      episodeId: row.queueEpisodeId,
      position: row.queuePosition,
      addedAt: row.queueAddedAt,
      episode: {
        ...row.episode,
        feedTitle: row.episode.feedTitle ?? undefined,
        feedCoverUrl: row.episode.feedCoverUrl ?? undefined,
      },
    };
  }
}
