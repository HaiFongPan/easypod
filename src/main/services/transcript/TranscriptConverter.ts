import { getDatabaseManager } from "../../database/connection";
import { episodeVoiceTexts, episodeTranscripts } from "../../database/schema";
import {
  TranscriptService,
  RawTranscriptData,
  SentenceInfo,
} from "../../types/transcript";

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
   * Merge sentences based on speaker continuity and time proximity
   *
   * Merge conditions (ALL must be true):
   * 1. Multi Speakers, merge same speaker: prev.spk === next.spk
   * 2. Time gap ≤ 10s: next.start - prev.end ≤ 10000ms
   * 3. Total duration ≤ 1min: next.start - first.start ≤ 60000ms
   */
  protected mergeSentences(sentences: SentenceInfo[]): SentenceInfo[] {
    if (sentences.length <= 1) {
      return sentences;
    }

    const speakerIds = new Set<number>();
    for (const sentence of sentences) {
      if (typeof sentence.spk === "number") {
        speakerIds.add(sentence.spk);
      }
    }

    if ((speakerIds.size || 1) === 1) {
      return sentences;
    }

    const merged: SentenceInfo[] = [];
    let current: SentenceInfo | null = null;

    for (const sentence of sentences) {
      if (!current) {
        // First sentence, start a new group
        current = { ...sentence };
        continue;
      }

      const timeSinceLastEnd = sentence.start - current.end;
      const timeSinceGroupStart = sentence.start - current.start;

      const sameSpeaker = current.spk === sentence.spk;
      const gapWithin2s = timeSinceLastEnd <= 2000;
      const durationWithin20s = timeSinceGroupStart <= 20000;

      if (sameSpeaker && gapWithin2s && durationWithin20s) {
        // Merge with current group
        current = {
          text: current.text + " " + sentence.text,
          start: current.start, // Keep first start
          end: sentence.end, // Update to latest end
          timestamp: [...current.timestamp, ...sentence.timestamp],
          spk: current.spk,
        };
      } else {
        // Push current group and start new one
        merged.push(current);
        current = { ...sentence };
      }
    }

    // Don't forget the last group
    if (current) {
      merged.push(current);
    }

    return merged;
  }

  /**
   * Save converted transcript to database
   */
  async saveTranscript(
    episodeId: number,
    raw: RawTranscriptData,
    service: TranscriptService,
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
