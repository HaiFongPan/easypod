/**
 * Transcript service types and data structures
 */

export type TranscriptService = 'funasr' | 'aliyun';
export type TaskStatus = 'processing' | 'success' | 'failed';

/**
 * Unified sentence info format for subtitles
 */
export interface SentenceInfo {
  text: string;           // Sentence content
  start: number;          // Start time in milliseconds
  end: number;            // End time in milliseconds
  timestamp: number[][];  // Word-level timestamps [[start, end], ...]
  spk: number;            // Speaker ID (0, 1, 2...)
}

/**
 * Voice text task - transcription task tracking
 */
export interface VoiceTextTask {
  id: number;
  episodeId: number;
  taskId: string;
  output: string;           // JSON string
  service: TranscriptService;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Voice text - raw transcription data from services
 */
export interface VoiceText {
  id: number;
  episodeId: number;
  rawJson: string;          // Complete raw JSON from service
  service: TranscriptService;
  createdAt: string;
  updatedAt: string;
}

/**
 * Episode transcript - processed transcription data
 */
export interface EpisodeTranscript {
  id: number;
  episodeId: number;
  subtitles: string;        // JSON.stringify(SentenceInfo[])
  text: string;             // Plain text content
  speakerNumber: number;    // Number of speakers detected
  createdAt: string;
  updatedAt: string;
}

/**
 * Chapter info for AI-generated chapters
 */
export interface ChapterInfo {
  title: string;
  start: number;            // Start time in milliseconds
  end: number;              // End time in milliseconds
  summary?: string;         // Optional chapter summary
}

/**
 * Episode AI summary - AI analysis results
 */
export interface EpisodeAiSummary {
  id: number;
  episodeId: number;
  summary: string;          // AI-generated summary
  tags: string;             // Comma-separated tags
  chapters: string;         // JSON.stringify(ChapterInfo[])
  createdAt: string;
  updatedAt: string;
}

/**
 * Parsed AI summary with structured data
 */
export interface ParsedAiSummary extends Omit<EpisodeAiSummary, 'tags' | 'chapters'> {
  tagsArray: string[];
  chaptersArray: ChapterInfo[];
}
