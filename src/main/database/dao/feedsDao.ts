import { eq, like, desc, sql } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { feeds, episodes, type Feed, type NewFeed, type Episode } from '../schema';

export class FeedsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  // Create
  async create(feedData: NewFeed): Promise<Feed> {
    const result = await this.db
      .insert(feeds)
      .values({
        ...feedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return result[0];
  }

  // Read operations
  async findAll(): Promise<Feed[]> {
    return await this.db
      .select()
      .from(feeds)
      .orderBy(desc(sql`COALESCE(${feeds.lastPubDate}, ${feeds.createdAt})`), desc(feeds.createdAt));
  }

  async findSubscribed(): Promise<Feed[]> {
    return await this.db
      .select()
      .from(feeds)
      .where(eq(feeds.isSubscribed, true))
      .orderBy(desc(sql`COALESCE(${feeds.lastPubDate}, ${feeds.createdAt})`), desc(feeds.createdAt));
  }

  async findUnsubscribed(): Promise<Feed[]> {
    return await this.db
      .select()
      .from(feeds)
      .where(eq(feeds.isSubscribed, false))
      .orderBy(desc(sql`COALESCE(${feeds.lastPubDate}, ${feeds.createdAt})`), desc(feeds.createdAt));
  }

  async findById(id: number): Promise<Feed | null> {
    const result = await this.db
      .select()
      .from(feeds)
      .where(eq(feeds.id, id));

    return result[0] || null;
  }

  async findByUrl(url: string): Promise<Feed | null> {
    const result = await this.db
      .select()
      .from(feeds)
      .where(eq(feeds.url, url));

    return result[0] || null;
  }

  async findByOpmlGroup(group: string): Promise<Feed[]> {
    return await this.db
      .select()
      .from(feeds)
      .where(eq(feeds.opmlGroup, group))
      .orderBy(feeds.title);
  }

  async search(query: string): Promise<Feed[]> {
    return await this.db
      .select()
      .from(feeds)
      .where(
        sql`${feeds.title} LIKE ${'%' + query + '%'} OR ${feeds.description} LIKE ${'%' + query + '%'}`
      )
      .orderBy(feeds.title);
  }

  // Update
  async update(id: number, updates: Partial<NewFeed>): Promise<Feed | null> {
    const result = await this.db
      .update(feeds)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(feeds.id, id))
      .returning();

    return result[0] || null;
  }

  async updateLastChecked(id: number): Promise<void> {
    await this.db
      .update(feeds)
      .set({
        lastCheckedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(feeds.id, id));
  }

  async subscribe(id: number): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(feeds)
      .set({
        isSubscribed: true,
        subscribedAt: now,
        updatedAt: now,
      })
      .where(eq(feeds.id, id));
  }

  async unsubscribe(id: number): Promise<void> {
    await this.db
      .update(feeds)
      .set({
        isSubscribed: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(feeds.id, id));
  }

  async findOrCreate(feedData: Partial<NewFeed> & { url: string }): Promise<Feed> {
    // Try to find existing feed by URL
    const existing = await this.findByUrl(feedData.url);
    if (existing) {
      return existing;
    }

    // Create new feed if it doesn't exist
    const newFeed: NewFeed = {
      title: feedData.title || 'Unknown Podcast',
      url: feedData.url,
      coverUrl: feedData.coverUrl || null,
      description: feedData.description || null,
      lastCheckedAt: feedData.lastCheckedAt || null,
      opmlGroup: feedData.opmlGroup || null,
      metaJson: feedData.metaJson || null,
    };

    return await this.create(newFeed);
  }

  // Delete
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(feeds)
      .where(eq(feeds.id, id));

    return result.changes > 0;
  }

  // Complex queries
  async getFeedWithLatestEpisodes(id: number, limit = 10): Promise<{
    feed: Feed;
    episodes: Episode[];
  } | null> {
    const feed = await this.findById(id);
    if (!feed) return null;

    const feedEpisodes = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.feedId, id))
      .orderBy(desc(episodes.pubDate))
      .limit(limit);

    return {
      feed,
      episodes: feedEpisodes,
    };
  }

  async getFeedsStats(): Promise<{
    totalFeeds: number;
    totalEpisodes: number;
    needsRefresh: number;
  }> {
    const [totalFeeds] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(feeds);

    const [totalEpisodes] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(episodes);

    // Feeds that haven't been checked in over 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [needsRefresh] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(feeds)
      .where(sql`${feeds.lastCheckedAt} IS NULL OR ${feeds.lastCheckedAt} < ${oneHourAgo}`);

    return {
      totalFeeds: totalFeeds.count,
      totalEpisodes: totalEpisodes.count,
      needsRefresh: needsRefresh.count,
    };
  }

  // Bulk operations
  async createMany(feedsData: NewFeed[]): Promise<Feed[]> {
    const now = new Date().toISOString();
    const feedsWithTimestamps = feedsData.map(feed => ({
      ...feed,
      createdAt: now,
      updatedAt: now,
    }));

    return await this.db
      .insert(feeds)
      .values(feedsWithTimestamps)
      .returning();
  }

  async deleteMany(ids: number[]): Promise<number> {
    const result = await this.db
      .delete(feeds)
      .where(sql`${feeds.id} IN (${ids.join(',')})`);

    return result.changes;
  }
}
