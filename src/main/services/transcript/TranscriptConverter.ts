import { getDatabaseManager } from '../../database/connection';
import { episodeVoiceTexts, episodeTranscripts } from '../../database/schema';
import {
  TranscriptService,
  RawTranscriptData,
  SentenceInfo,
} from '../../types/transcript';

/**
 * Transcript converter interface
 */
export interface TranscriptConverter {
  /**
   * Convert raw data to unified sentence_info format
   */
  convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[];

  /**
   * Extract plain text from raw data
   */
  extractText(raw: RawTranscriptData): string;

  /**
   * Calculate number of speakers
   */
  calculateSpeakerCount(raw: RawTranscriptData): number;
}

/**
 * Base implementation of TranscriptConverter
 */
export abstract class BaseTranscriptConverter implements TranscriptConverter {
  abstract convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[];
  abstract extractText(raw: RawTranscriptData): string;
  abstract calculateSpeakerCount(raw: RawTranscriptData): number;

  /**
   * Save converted transcript to database
   */
  async saveTranscript(
    episodeId: number,
    raw: RawTranscriptData,
    service: TranscriptService
  ): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    // 1. Save raw JSON
    await db
      .insert(episodeVoiceTexts)
      .values({
        episodeId,
        rawJson: JSON.stringify(raw),
        service,
      })
      .onConflictDoUpdate({
        target: [episodeVoiceTexts.episodeId, episodeVoiceTexts.service],
        set: {
          rawJson: JSON.stringify(raw),
          updatedAt: new Date().toISOString(),
        },
      });

    // 2. Convert and save transcript data
    const sentenceInfo = this.convertToSentenceInfo(raw);
    const text = this.extractText(raw);
    const speakerNumber = this.calculateSpeakerCount(raw);

    await db
      .insert(episodeTranscripts)
      .values({
        episodeId,
        subtitles: JSON.stringify(sentenceInfo),
        text,
        speakerNumber,
      })
      .onConflictDoUpdate({
        target: episodeTranscripts.episodeId,
        set: {
          subtitles: JSON.stringify(sentenceInfo),
          text,
          speakerNumber,
          updatedAt: new Date().toISOString(),
        },
      });
  }
}
