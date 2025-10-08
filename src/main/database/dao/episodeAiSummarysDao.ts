import { eq } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { episodeAiSummarys, type EpisodeAiSummary, type NewEpisodeAiSummary } from '../schema';

export class EpisodeAiSummarysDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  // Create
  async create(data: NewEpisodeAiSummary): Promise<EpisodeAiSummary> {
    const result = await this.db
      .insert(episodeAiSummarys)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  // Read
  async findByEpisode(episodeId: number): Promise<EpisodeAiSummary | null> {
    const result = await this.db
      .select()
      .from(episodeAiSummarys)
      .where(eq(episodeAiSummarys.episodeId, episodeId))
      .limit(1);
    return result[0] || null;
  }

  // Update
  async update(episodeId: number, data: Partial<NewEpisodeAiSummary>): Promise<EpisodeAiSummary | null> {
    const result = await this.db
      .update(episodeAiSummarys)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(episodeAiSummarys.episodeId, episodeId))
      .returning();
    return result[0] || null;
  }

  // Delete
  async delete(episodeId: number): Promise<void> {
    await this.db
      .delete(episodeAiSummarys)
      .where(eq(episodeAiSummarys.episodeId, episodeId));
  }
}
