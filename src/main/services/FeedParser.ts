import Parser from 'rss-parser';
import axios, { AxiosResponse } from 'axios';
import { parseString } from 'xml2js';
import {
  FeedParserOptions,
  ParsedFeed,
  ParsedEpisode,
  ParsedChapter,
  FeedParseError,
  NetworkError,
  XMLParseError,
  FeedResponse,
  ValidationResult
} from '../types/feed';
import { FeedCache } from './FeedCache';
import {
  parseDuration,
  parseDate,
  sanitizeDescription,
  extractTextContent,
  extractChaptersFromShownotes,
  normalizeCategory,
  parseKeywords,
  validateUrl,
  generateEpisodeGuid,
  normalizeFunding,
  normalizePersons,
  getImageUrl
} from '../utils/feedNormalizer';

const coerceToString = (value: unknown): string | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map(coerceToString)
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .join('\n');
  }

  if (typeof value === 'object' && '_' in (value as Record<string, unknown>)) {
    return coerceToString((value as Record<string, unknown>)._);
  }

  return undefined;
};

/**
 * Comprehensive RSS/Podcast Feed Parser
 * Supports RSS 2.0, iTunes extensions, and Podcast 2.0 standards
 */
export class PodcastFeedParser {
  private cache: FeedCache;
  private parser: Parser = new Parser();
  private readonly options: FeedParserOptions;

  constructor(options: Partial<FeedParserOptions> = {}) {
    this.options = {
      timeout: 30000,
      maxRedirects: 5,
      userAgent: 'EasyPod/1.0 (Podcast Player)',
      retryAttempts: 3,
      enableCaching: true,
      ...options,
    };

    this.cache = new FeedCache();
    this.setupParser();
  }

  /**
   * Setup RSS parser with custom field mappings
   */
  private setupParser(): void {
    this.parser = new Parser({
      timeout: this.options.timeout,
      headers: {
        'User-Agent': this.options.userAgent,
      },
      customFields: {
        feed: [
          'itunes:image',
          'itunes:category',
          'itunes:author',
          'itunes:summary',
          'itunes:explicit',
          'podcast:funding',
          'podcast:trailer',
          'podcast:license',
        ],
        item: [
          'itunes:image',
          'itunes:duration',
          'itunes:summary',
          'itunes:explicit',
          'itunes:season',
          'itunes:episode',
          'itunes:keywords',
          'podcast:chapters',
          'podcast:transcript',
          'podcast:funding',
          'podcast:person',
          'content:encoded',
        ],
      },
    });
  }

  /**
   * Parse RSS feed from URL with caching support
   */
  async parseFeed(url: string): Promise<ParsedFeed> {
    try {
      // Check cache first
      if (this.options.enableCaching) {
        const cached = this.cache.getCachedFeed(url);
        if (cached) {
          return cached.feed;
        }
      }

      const response = await this.fetchWithRetry(url);

      // Handle 304 Not Modified
      if (response.status === 304) {
        const cached = this.cache.getCachedFeed(url);
        if (cached) {
          return cached.feed;
        }
      }

      const rawFeed = await this.parseRSSContent(response.data, url);
      const normalizedFeed = await this.normalizeFeed(rawFeed, url, response);

      // Cache the result
      if (this.options.enableCaching) {
        this.cache.setCachedFeed(
          url,
          normalizedFeed,
          response.etag,
          response.lastModified
        );
      }

      return normalizedFeed;
    } catch (error) {
      if (error instanceof FeedParseError || error instanceof NetworkError || error instanceof XMLParseError) {
        throw error;
      }
      throw new FeedParseError(`Failed to parse feed: ${error instanceof Error ? error.message : String(error)}`, url, error);
    }
  }

  /**
   * Fetch RSS content with retry mechanism and conditional requests
   */
  private async fetchWithRetry(url: string): Promise<FeedResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const headers: Record<string, string> = {
          'User-Agent': this.options.userAgent,
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        };

        // Add conditional request headers for caching
        if (this.options.enableCaching) {
          Object.assign(headers, this.cache.getConditionalHeaders(url));
        }

        const response: AxiosResponse<string> = await axios.get(url, {
          headers,
          timeout: this.options.timeout,
          maxRedirects: this.options.maxRedirects,
          validateStatus: (status) => status < 400 || status === 304,
        });

        return {
          data: response.data,
          status: response.status,
          headers: response.headers as Record<string, string>,
          etag: response.headers.etag,
          lastModified: response.headers['last-modified'],
        };
      } catch (error) {
        lastError = error as Error;

        if (axios.isAxiosError(error)) {
          if (error.response?.status && error.response.status >= 400) {
            throw new NetworkError(
              `HTTP ${error.response.status}: ${error.response.statusText}`,
              url,
              error.response.status
            );
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.options.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }

    throw new NetworkError(
      `Failed to fetch feed after ${this.options.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`,
      url
    );
  }

  /**
   * Parse RSS XML content
   */
  private async parseRSSContent(xmlContent: string, url: string): Promise<any> {
    try {
      return await this.parser.parseString(xmlContent);
    } catch (error) {
      throw new XMLParseError(
        `Failed to parse RSS XML: ${error instanceof Error ? error.message : String(error)}`,
        url,
        xmlContent.substring(0, 1000)
      );
    }
  }

  /**
   * Normalize raw RSS feed data to standardized format
   */
  private async normalizeFeed(rawFeed: any, url: string, response: FeedResponse): Promise<ParsedFeed> {
    const feed: ParsedFeed = {
      title: rawFeed.title || 'Untitled Podcast',
      description: extractTextContent(rawFeed.description),
      url,
      link: validateUrl(rawFeed.link) || url,
      lastBuildDate: parseDate(rawFeed.lastBuildDate),
      episodes: [],
    };

    // Extract feed-level metadata
    const feedImageFromItunes = this.extractImageUrlFromNode(rawFeed['itunes:image']);
    const feedImageFromImageTag = this.extractImageUrlFromNode(rawFeed.image);
    if (feedImageFromImageTag) {
      feed.image = feedImageFromImageTag;
    } else if (feedImageFromItunes) {
      feed.image = feedImageFromItunes;
    }

    feed.author = rawFeed['itunes:author'] || rawFeed.managingEditor;
    feed.category = normalizeCategory(rawFeed['itunes:category']?.text);
    feed.language = rawFeed.language;
    feed.copyright = rawFeed.copyright;

    // Add caching metadata
    feed.etag = response.etag;
    feed.lastModified = response.lastModified;

    // Process episodes
    if (rawFeed.items && Array.isArray(rawFeed.items)) {
      for (const item of rawFeed.items) {
        try {
          const episode = await this.normalizeEpisode(item);
          if (episode) {
            feed.episodes.push(episode);
          }
        } catch (error) {
          console.warn(`Failed to parse episode: ${error instanceof Error ? error.message : String(error)}`);
          // Continue processing other episodes
        }
      }
    }

    if (!feed.image) {
      const firstEpisodeWithImage = feed.episodes.find(ep => ep.episodeImage);
      if (firstEpisodeWithImage?.episodeImage) {
        feed.image = firstEpisodeWithImage.episodeImage;
      }
    }

    return feed;
  }

  /**
   * Normalize individual episode data
   */
  private async normalizeEpisode(item: any): Promise<ParsedEpisode | null> {
    // Validate required fields
    if (!item.title && !item.enclosure?.url) {
      return null; // Skip invalid episodes
    }

    const audioUrl = validateUrl(item.enclosure?.url);
    if (!audioUrl) {
      return null; // Audio URL is required
    }

    const pubDate = parseDate(item.pubDate || item.isoDate);
    const title = item.title || 'Untitled Episode';

    const rawContentEncoded = coerceToString(item['content:encoded']) ?? coerceToString(item.content);
    const rawDescription = coerceToString(item.description) ?? coerceToString(item['itunes:summary']);

    const sanitizedContentHtml = sanitizeDescription(rawContentEncoded);
    const sanitizedDescriptionHtml = sanitizeDescription(rawDescription);
    const sanitizedContentTrimmedLength = sanitizedContentHtml.trim().length;
    const descriptionHtml = sanitizedContentTrimmedLength > 0
      ? sanitizedContentHtml
      : sanitizedDescriptionHtml;

    const rawSummary = coerceToString(item['itunes:summary']) ?? coerceToString(item.summary);

    const episode: ParsedEpisode = {
      guid: generateEpisodeGuid(item.guid, audioUrl, title, pubDate),
      title,
      description: extractTextContent(rawSummary ?? rawDescription ?? ''),
      descriptionHtml,
      audioUrl,
      pubDate: pubDate || new Date(),
    };

    // Optional fields
    episode.duration = parseDuration(item['itunes:duration']) || parseDuration(item.enclosure?.length);
    const episodeImageFromItunes = this.extractImageUrlFromNode(item['itunes:image']);
    const episodeImageFromMedia = this.extractImageUrlFromNode(item['media:thumbnail']) || this.extractImageUrlFromNode(item['media:content']);
    const episodeImageFromItem = this.extractImageUrlFromNode(item.image);
    episode.episodeImage = getImageUrl(episodeImageFromItunes, episodeImageFromMedia || episodeImageFromItem);
    episode.seasonNumber = parseInt(item['itunes:season'], 10) || undefined;
    episode.episodeNumber = parseInt(item['itunes:episode'], 10) || undefined;
    episode.explicit = item['itunes:explicit'] === 'true' || item['itunes:explicit'] === 'yes';
    episode.keywords = parseKeywords(item['itunes:keywords']);

    // Podcast 2.0 fields
    if (item['podcast:funding']) {
      episode.funding = normalizeFunding(Array.isArray(item['podcast:funding']) ? item['podcast:funding'] : [item['podcast:funding']]);
    }

    if (item['podcast:person']) {
      episode.persons = normalizePersons(Array.isArray(item['podcast:person']) ? item['podcast:person'] : [item['podcast:person']]);
    }

    if (item['podcast:transcript']) {
      episode.transcript = validateUrl(item['podcast:transcript'].url || item['podcast:transcript']._);
    }

    // Parse chapters
    episode.chapters = await this.parseEpisodeChapters(item, episode.descriptionHtml);

    return episode;
  }

  private extractImageUrlFromNode(node: any): string | undefined {
    if (!node) {
      return undefined;
    }

    if (typeof node === 'string') {
      return validateUrl(node);
    }

    if (Array.isArray(node)) {
      for (const entry of node) {
        const url = this.extractImageUrlFromNode(entry);
        if (url) {
          return url;
        }
      }
      return undefined;
    }

    if (typeof node === 'object') {
      return (
        validateUrl((node as any).url) ||
        validateUrl((node as any).href) ||
        validateUrl((node as any)._) ||
        validateUrl((node as any)['#']) ||
        ((node as any).$ ? (validateUrl((node as any).$.url) || validateUrl((node as any).$.href)) : undefined) ||
        ((node as any)['@'] ? (validateUrl((node as any)['@'].url) || validateUrl((node as any)['@'].href)) : undefined)
      );
    }

    return undefined;
  }

  /**
   * Parse episode chapters from various sources
   */
  private async parseEpisodeChapters(item: any, descriptionHtml?: string): Promise<ParsedChapter[]> {
    const chapters: ParsedChapter[] = [];

    // Priority 1: Podcast 2.0 chapters JSON
    if (item['podcast:chapters']?.url) {
      try {
        const chaptersFromJson = await this.fetchChaptersJson(item['podcast:chapters'].url);
        chapters.push(...chaptersFromJson);
      } catch (error) {
        console.warn(`Failed to fetch chapters JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Priority 2: Extract from shownotes if no JSON chapters
    if (chapters.length === 0 && descriptionHtml) {
      const chaptersFromShownotes = extractChaptersFromShownotes(descriptionHtml);
      chapters.push(...chaptersFromShownotes);
    }

    return chapters.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Fetch and parse Podcast 2.0 chapters JSON
   */
  private async fetchChaptersJson(url: string): Promise<ParsedChapter[]> {
    try {
      const response = await axios.get(url, {
        timeout: this.options.timeout,
        headers: { 'User-Agent': this.options.userAgent },
      });

      const chaptersData = response.data;
      if (!chaptersData.chapters || !Array.isArray(chaptersData.chapters)) {
        return [];
      }

      return chaptersData.chapters
        .map((chapter: any) => ({
          title: chapter.title || '',
          startTime: parseFloat(chapter.startTime) || 0,
          endTime: chapter.endTime ? parseFloat(chapter.endTime) : undefined,
          image: validateUrl(chapter.img),
          url: validateUrl(chapter.url),
          source: 'json' as const,
        }))
        .filter((chapter: ParsedChapter) => chapter.title && chapter.startTime >= 0);
    } catch (error) {
      throw new Error(`Failed to fetch chapters JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate parsed feed data
   */
  validateFeed(feed: ParsedFeed): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!feed.title.trim()) {
      errors.push('Feed title is required');
    }

    if (!feed.url) {
      errors.push('Feed URL is required');
    }

    if (feed.episodes.length === 0) {
      warnings.push('No episodes found in feed');
    }

    // Episode validation
    for (const [index, episode] of feed.episodes.entries()) {
      if (!episode.title.trim()) {
        warnings.push(`Episode ${index + 1}: Missing title`);
      }

      if (!episode.audioUrl) {
        errors.push(`Episode ${index + 1}: Missing audio URL`);
      }

      if (!episode.guid) {
        warnings.push(`Episode ${index + 1}: Missing GUID`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
