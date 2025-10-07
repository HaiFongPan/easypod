import { eq } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import {
  episodeTranscripts,
  type EpisodeTranscript,
  type NewEpisodeTranscript,
} from '../schema';

export interface SentenceInfo {
  text: string;
  start: number;
  end: number;
  timestamp: number[][];
  spk: number;
}

export interface TranscriptData {
  id: number;
  episodeId: number;
  subtitles: SentenceInfo[];
  text: string;
  speakerNumber: number;
  createdAt: string;
  updatedAt: string;
}

export class EpisodeTranscriptsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  /**
   * Get transcript by episode ID
   */
  async findByEpisodeId(episodeId: number): Promise<TranscriptData | null> {
    const result = await this.db
      .select()
      .from(episodeTranscripts)
      .where(eq(episodeTranscripts.episodeId, episodeId))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    const row = result[0];

    // Parse subtitles JSON
    let subtitles: SentenceInfo[] = [];
    try {
      subtitles = JSON.parse(row.subtitles);
    } catch (error) {
      console.error('[EpisodeTranscriptsDao] Failed to parse subtitles JSON:', error);
      subtitles = [];
    }

    return {
      id: row.id,
      episodeId: row.episodeId,
      subtitles,
      text: row.text,
      speakerNumber: row.speakerNumber,
      createdAt: row.createdAt ?? new Date().toISOString(),
      updatedAt: row.updatedAt ?? new Date().toISOString(),
    };
  }

  /**
   * Create new transcript
   */
  async create(transcriptData: NewEpisodeTranscript): Promise<EpisodeTranscript> {
    const result = await this.db
      .insert(episodeTranscripts)
      .values({
        ...transcriptData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return result[0];
  }

  /**
   * Update existing transcript
   */
  async update(
    episodeId: number,
    data: Partial<Omit<NewEpisodeTranscript, 'episodeId'>>
  ): Promise<EpisodeTranscript | null> {
    const result = await this.db
      .update(episodeTranscripts)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(episodeTranscripts.episodeId, episodeId))
      .returning();

    return result[0] || null;
  }

  /**
   * Delete transcript by episode ID
   */
  async deleteByEpisodeId(episodeId: number): Promise<boolean> {
    const result = await this.db
      .delete(episodeTranscripts)
      .where(eq(episodeTranscripts.episodeId, episodeId));

    return result.changes > 0;
  }

  /**
   * Check if transcript exists for episode
   */
  async exists(episodeId: number): Promise<boolean> {
    const result = await this.db
      .select({ id: episodeTranscripts.id })
      .from(episodeTranscripts)
      .where(eq(episodeTranscripts.episodeId, episodeId))
      .limit(1);

    return result.length > 0;
  }
}
