// RSS Feed Parser Types
// Following the task specification for RSS parsing functionality

export interface FeedParserOptions {
  timeout: number;
  maxRedirects: number;
  userAgent: string;
  retryAttempts: number;
  enableCaching: boolean;
}

export interface ParsedFeed {
  title: string;
  description: string;
  url: string;
  link: string;
  image?: string;
  author?: string;
  category?: string;
  language?: string;
  copyright?: string;
  lastBuildDate?: Date;
  episodes: ParsedEpisode[];
  // Additional metadata for caching
  etag?: string;
  lastModified?: string;
}

export interface ParsedEpisode {
  guid: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  audioUrl: string;
  pubDate: Date;
  duration?: number; // in seconds
  episodeImage?: string;
  chapters?: ParsedChapter[];
  seasonNumber?: number;
  episodeNumber?: number;
  // iTunes specific fields
  explicit?: boolean;
  keywords?: string[];
  // Podcast 2.0 fields
  transcript?: string;
  funding?: PodcastFunding[];
  persons?: PodcastPerson[];
}

export interface ParsedChapter {
  title: string;
  startTime: number; // seconds
  endTime?: number; // seconds
  image?: string;
  url?: string;
  source: 'json' | 'id3' | 'shownote';
}

export interface PodcastFunding {
  url: string;
  message?: string;
}

export interface PodcastPerson {
  name: string;
  role?: string;
  group?: string;
  img?: string;
  href?: string;
}

export interface CachedFeed {
  feed: ParsedFeed;
  etag?: string;
  lastModified?: string;
  updatedAt: number;
}

export class FeedParseError extends Error {
  constructor(
    message: string,
    public url: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'FeedParseError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public url: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class XMLParseError extends Error {
  constructor(
    message: string,
    public url: string,
    public xmlContent?: string
  ) {
    super(message);
    this.name = 'XMLParseError';
  }
}

// HTTP response interface for caching
export interface FeedResponse {
  data: string;
  status: number;
  headers: Record<string, string>;
  etag?: string;
  lastModified?: string;
}

// Validation result for parsed content
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}