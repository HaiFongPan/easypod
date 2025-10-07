/**
 * Transcript service types and data structures
 */

export type TranscriptService = 'funasr' | 'aliyun';
export type TaskStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

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

/**
 * FunASR raw data format
 */
export interface FunasrRawData {
  key: string; // Audio file name
  text: string; // Complete text transcript
  timestamp: number[][]; // Word-level timestamps [[start, end], ...]
  sentence_info: FunasrSentenceInfo[];
}

export interface FunasrSentenceInfo {
  text: string;
  start: number; // Milliseconds
  end: number; // Milliseconds
  timestamp: number[][];
  spk: number; // Speaker ID
}

/**
 * Aliyun submit task response payload
 */
export interface AliyunSubmitResponse {
  output: {
    task_status: 'PENDING' | 'RUNNING';
    task_id: string;
  };
  request_id: string;
}

export interface AliyunTaskResultItem {
  file_url: string;
  transcription_url: string;
  subtask_status: 'SUCCEEDED' | 'FAILED';
}

/**
 * Aliyun query task response payload
 */
export interface AliyunQueryResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    submit_time: string;
    scheduled_time?: string;
    end_time?: string;
    results?: AliyunTaskResultItem[];
    task_metrics?: {
      TOTAL: number;
      SUCCEEDED: number;
      FAILED: number;
    };
  };
  usage?: {
    duration: number;
  };
}

export interface AliyunWord {
  begin_time: number; // Milliseconds
  end_time: number; // Milliseconds
  text: string;
  punctuation: string;
}

export interface AliyunSentence {
  begin_time: number;
  end_time: number;
  text: string;
  sentence_id: number;
  speaker_id?: number;
  words: AliyunWord[];
}

export interface AliyunTranscript {
  channel_id: number;
  content_duration_in_milliseconds: number;
  text: string;
  sentences: AliyunSentence[];
}

/**
 * Aliyun raw data format
 */
export interface AliyunRawData {
  file_url: string;
  properties: {
    audio_format: string;
    channels: number[];
    original_sampling_rate: number;
    original_duration_in_milliseconds: number;
  };
  transcripts: AliyunTranscript[];
}

/**
 * Raw transcript data union type
 */
export type RawTranscriptData = FunasrRawData | AliyunRawData;

/**
 * Submit task response
 */
export interface SubmitTaskResponse {
  success: boolean;
  taskId?: string;
  error?: string;
  service: TranscriptService;
}

/**
 * Query task response
 */
export interface QueryTaskResponse {
  success: boolean;
  taskId: string;
  status: TaskStatus;
  progress?: number; // 0-100
  result?: RawTranscriptData;
  error?: string;
  service: TranscriptService;
}

/**
 * Submit options for transcription tasks
 */
export interface SubmitOptions {
  // FunASR configuration
  modelPath?: string;
  vadModelPath?: string;
  puncModelPath?: string;
  spkModelPath?: string;
  batchSizeS?: number;
  wordTimestamp?: boolean;

  // Aliyun configuration
  model?: 'paraformer-v2' | 'paraformer-v1';
  languageHints?: string[]; // ['zh', 'en']
  speakerCount?: number; // Number of speakers

  // Common configuration
  disfluencyRemoval?: boolean; // Remove disfluency
  timestampAlignment?: boolean; // Timestamp alignment
  diarizationEnabled?: boolean; // Enable speaker diarization
}
