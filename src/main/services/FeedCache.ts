import { CachedFeed, ParsedFeed } from '../types/feed';

/**
 * Feed Cache Manager
 * Implements conditional requests using ETag and Last-Modified headers
 * for efficient RSS feed fetching and caching
 */
export class FeedCache {
  private cache = new Map<string, CachedFeed>();
  private readonly maxAge: number; // Maximum cache age in milliseconds

  constructor(maxAgeHours: number = 1) {
    this.maxAge = maxAgeHours * 60 * 60 * 1000;
  }

  /**
   * Get cached feed if available and not expired
   */
  getCachedFeed(url: string): CachedFeed | null {
    const cached = this.cache.get(url);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.updatedAt > this.maxAge) {
      this.cache.delete(url);
      return null;
    }

    return cached;
  }

  /**
   * Set cached feed with metadata
   */
  setCachedFeed(url: string, feed: ParsedFeed, etag?: string, lastModified?: string): void {
    this.cache.set(url, {
      feed,
      etag,
      lastModified,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get conditional request headers for cache validation
   */
  getConditionalHeaders(url: string): Record<string, string> {
    const cached = this.cache.get(url);
    const headers: Record<string, string> = {};

    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    if (cached?.lastModified) {
      headers['If-Modified-Since'] = cached.lastModified;
    }

    return headers;
  }

  /**
   * Check if URL has cached content
   */
  has(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * Remove cached feed
   */
  delete(url: string): boolean {
    return this.cache.delete(url);
  }

  /**
   * Clear all cached feeds
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; urls: string[] } {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.updatedAt > this.maxAge) {
        this.cache.delete(url);
        removedCount++;
      }
    }

    return removedCount;
  }
}