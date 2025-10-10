export interface SummaryResponse {
  summary: string;
  tags: string[];
}

export interface ChapterLLMItem {
  start: number; // Segment ID (1-based)
  summary: string;
  content: string;
}

export interface ChapterLLMResponse {
  totalChapters: number;
  detectedTime: string;
  chapters: ChapterLLMItem[];
}

export interface ChapterItem {
  start: number; // milliseconds
  end: number; // milliseconds
  summary: string;
}

export interface ChapterResponse {
  totalChapters?: number;
  detectedTime?: string;
  chapters: ChapterItem[];
}

export interface MindmapResponse {
  mindmap: string;  // Markdown format
}

export interface AIService {
  getSummary(transcript: string, prompt?: string): Promise<SummaryResponse>;
  getChapters(
    transcript: string,
    prompt?: string,
  ): Promise<ChapterLLMResponse>;
  getMindmap(transcript: string, prompt?: string): Promise<MindmapResponse>;
}

export interface AIServiceConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
