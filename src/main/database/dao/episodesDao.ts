import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { episodes, chapters, transcripts, feeds, type Episode, type NewEpisode, type Chapter } from '../schema';

export type EpisodeStatus = 'new' | 'in_progress' | 'played' | 'archived';

export type EpisodeWithFeed = Episode & {
  feedTitle?: string | null;
  feedCoverUrl?: string | null;
};

const baseEpisodeSelect = {
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
} as const;

export class EpisodesDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  // Create
  async create(episodeData: NewEpisode): Promise<Episode> {
    const result = await this.db
      .insert(episodes)
      .values({
        ...episodeData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return result[0];
  }

  // Read operations
  async findAll(limit?: number): Promise<EpisodeWithFeed[]> {
    const query = this.db
      .select(baseEpisodeSelect)
      .from(episodes)
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .orderBy(desc(episodes.pubDate), desc(episodes.createdAt));

    const results = await (limit ? query.limit(limit) : query);

    return results.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? undefined,
      feedCoverUrl: row.feedCoverUrl ?? undefined,
    }));
  }

  async findById(id: number): Promise<Episode | null> {
    const result = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.id, id));

    return result[0] || null;
  }

  async findByGuid(guid: string): Promise<Episode | null> {
    const result = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.guid, guid));

    return result[0] || null;
  }

  async findByFeed(feedId: number, limit?: number, offset = 0): Promise<EpisodeWithFeed[]> {
    let query = this.db
      .select(baseEpisodeSelect)
      .from(episodes)
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .where(eq(episodes.feedId, feedId))
      .orderBy(desc(episodes.pubDate), desc(episodes.createdAt));

    if (offset) {
      query = query.offset(offset);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const results = await query;

    return results.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? undefined,
      feedCoverUrl: row.feedCoverUrl ?? undefined,
    }));
  }

  async findByStatus(status: EpisodeStatus, limit?: number): Promise<EpisodeWithFeed[]> {
    const query = this.db
      .select(baseEpisodeSelect)
      .from(episodes)
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .where(eq(episodes.status, status))
      .orderBy(desc(episodes.lastPlayedAt), desc(episodes.updatedAt));

    const results = await (limit ? query.limit(limit) : query);

    return results.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? undefined,
      feedCoverUrl: row.feedCoverUrl ?? undefined,
    }));
  }

  async findRecentlyPlayed(limit = 10): Promise<EpisodeWithFeed[]> {
    const results = await this.db
      .select(baseEpisodeSelect)
      .from(episodes)
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .where(sql`${episodes.lastPlayedAt} IS NOT NULL`)
      .orderBy(desc(episodes.lastPlayedAt), desc(episodes.updatedAt))
      .limit(limit);

    return results.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? undefined,
      feedCoverUrl: row.feedCoverUrl ?? undefined,
    }));
  }

  async findInProgress(limit = 10): Promise<EpisodeWithFeed[]> {
    const results = await this.db
      .select(baseEpisodeSelect)
      .from(episodes)
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .where(and(
        eq(episodes.status, 'in_progress'),
        sql`${episodes.lastPositionSec} > 0`
      ))
      .orderBy(desc(episodes.lastPlayedAt), desc(episodes.updatedAt))
      .limit(limit);

    return results.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? undefined,
      feedCoverUrl: row.feedCoverUrl ?? undefined,
    }));
  }

  // Update
  async update(id: number, updates: Partial<NewEpisode>): Promise<Episode | null> {
    const result = await this.db
      .update(episodes)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(episodes.id, id))
      .returning();

    return result[0] || null;
  }

  async updatePlayPosition(id: number, positionSec: number): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(episodes)
      .set({
        lastPositionSec: positionSec,
        lastPlayedAt: now,
        status: positionSec > 0 ? 'in_progress' : 'new',
        updatedAt: now,
      })
      .where(eq(episodes.id, id));
  }

  async markAsPlayed(id: number): Promise<void> {
    const episode = await this.findById(id);
    if (!episode) return;

    const now = new Date().toISOString();
    await this.db
      .update(episodes)
      .set({
        status: 'played',
        lastPlayedAt: now,
        lastPositionSec: episode.durationSec || 0,
        updatedAt: now,
      })
      .where(eq(episodes.id, id));
  }

  async markAsNew(id: number): Promise<void> {
    await this.db
      .update(episodes)
      .set({
        status: 'new',
        lastPositionSec: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(episodes.id, id));
  }

  async markAsArchived(id: number): Promise<void> {
    await this.db
      .update(episodes)
      .set({
        status: 'archived',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(episodes.id, id));
  }

  // Delete
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(episodes)
      .where(eq(episodes.id, id));

    return result.changes > 0;
  }

  // Complex queries
  async getEpisodeWithChapters(id: number): Promise<{
    episode: Episode;
    chapters: Chapter[];
  } | null> {
    const episode = await this.findById(id);
    if (!episode) return null;

    const episodeChapters = await this.db
      .select()
      .from(chapters)
      .where(eq(chapters.episodeId, id))
      .orderBy(asc(chapters.startMs));

    return {
      episode,
      chapters: episodeChapters,
    };
  }

  async getEpisodePlayStats(id: number): Promise<{
    totalTime: number;
    playedTime: number;
    progressPercent: number;
    isCompleted: boolean;
  }> {
    const episode = await this.findById(id);
    if (!episode) {
      return { totalTime: 0, playedTime: 0, progressPercent: 0, isCompleted: false };
    }

    const totalTime = episode.durationSec || 0;
    const playedTime = episode.lastPositionSec || 0;
    const progressPercent = totalTime > 0 ? (playedTime / totalTime) * 100 : 0;
    const isCompleted = episode.status === 'played' || progressPercent >= 95;

    return {
      totalTime,
      playedTime,
      progressPercent,
      isCompleted,
    };
  }

  // Search operations
  async search(query: string, feedId?: number): Promise<EpisodeWithFeed[]> {
    const searchCondition = sql`${episodes.title} LIKE ${'%' + query + '%'} OR ${episodes.descriptionHtml} LIKE ${'%' + query + '%'}`;
    const feedCondition = feedId ? eq(episodes.feedId, feedId) : sql`1=1`;

    const results = await this.db
      .select(baseEpisodeSelect)
      .from(episodes)
      .leftJoin(feeds, eq(episodes.feedId, feeds.id))
      .where(and(searchCondition, feedCondition))
      .orderBy(desc(episodes.pubDate), desc(episodes.createdAt));

    return results.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? undefined,
      feedCoverUrl: row.feedCoverUrl ?? undefined,
    }));
  }

  // Full-text search using FTS5
  async fullTextSearch(query: string, limit = 20): Promise<EpisodeWithFeed[]> {
    // TODO: Implement FTS5 search when available
    // For now, fall back to LIKE search
    return await this.search(query);
  }

  // Bulk operations
  async createMany(episodesData: NewEpisode[]): Promise<Episode[]> {
    const now = new Date().toISOString();
    const episodesWithTimestamps = episodesData.map(episode => ({
      ...episode,
      createdAt: now,
      updatedAt: now,
    }));

    return await this.db
      .insert(episodes)
      .values(episodesWithTimestamps)
      .returning();
  }

  async updateMany(ids: number[], updates: Partial<NewEpisode>): Promise<number> {
    const result = await this.db
      .update(episodes)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(inArray(episodes.id, ids));

    return result.changes;
  }

  async deleteByFeed(feedId: number): Promise<number> {
    const result = await this.db
      .delete(episodes)
      .where(eq(episodes.feedId, feedId));

    return result.changes;
  }

  // Statistics
  async countByFeed(feedIds: number[]): Promise<Record<number, number>> {
    if (feedIds.length === 0) {
      return {};
    }

    const rows = await this.db
      .select({
        feedId: episodes.feedId,
        count: sql<number>`COUNT(*)`,
      })
      .from(episodes)
      .where(inArray(episodes.feedId, feedIds))
      .groupBy(episodes.feedId);

    return rows.reduce<Record<number, number>>((acc, row) => {
      if (typeof row.feedId === 'number') {
        acc[row.feedId] = row.count;
      }
      return acc;
    }, {});
  }

  async getStats(): Promise<{
    total: number;
    new: number;
    inProgress: number;
    played: number;
    archived: number;
    totalDuration: number;
    totalListened: number;
  }> {
    const [total] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(episodes);

    const [newCount] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(episodes)
      .where(eq(episodes.status, 'new'));

    const [inProgressCount] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(episodes)
      .where(eq(episodes.status, 'in_progress'));

    const [playedCount] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(episodes)
      .where(eq(episodes.status, 'played'));

    const [archivedCount] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(episodes)
      .where(eq(episodes.status, 'archived'));

    const [durationStats] = await this.db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(${episodes.durationSec}), 0)`,
        totalListened: sql<number>`COALESCE(SUM(${episodes.lastPositionSec}), 0)`,
      })
      .from(episodes);

    return {
      total: total.count,
      new: newCount.count,
      inProgress: inProgressCount.count,
      played: playedCount.count,
      archived: archivedCount.count,
      totalDuration: durationStats.totalDuration,
      totalListened: durationStats.totalListened,
    };
  }
}
