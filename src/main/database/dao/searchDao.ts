import { sql } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { episodes, feeds, transcriptSegments, aiTasks, type Episode } from '../schema';

export interface SearchResult {
  episode: Episode;
  feedTitle: string;
  matchType: 'title' | 'description' | 'transcript' | 'ai_summary';
  snippet: string;
  rank: number;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  feedId?: number;
  includeTranscripts?: boolean;
  includeAISummaries?: boolean;
}

export class SearchDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  private get rawDb() {
    return getDatabaseManager().getRawDb();
  }

  // Full-text search using FTS5
  async fullTextSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 20,
      offset = 0,
      feedId,
      includeTranscripts = true,
      includeAISummaries = true,
    } = options;

    // TODO: Implement FTS5 search when SQLite is available
    // For now, return fallback search results
    return await this.fallbackSearch(query, options);
  }

  // Fallback search using LIKE queries
  private async fallbackSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const { limit = 20, feedId } = options;
    const searchTerm = `%${query}%`;

    try {
      // Search in episode titles and descriptions
      const episodeResults = await this.db
        .select({
          episode: episodes,
          feedTitle: feeds.title,
        })
        .from(episodes)
        .leftJoin(feeds, sql`${episodes.feedId} = ${feeds.id}`)
        .where(
          sql`(${episodes.title} LIKE ${searchTerm} OR ${episodes.descriptionHtml} LIKE ${searchTerm})
             ${feedId ? sql`AND ${episodes.feedId} = ${feedId}` : sql``}`
        )
        .orderBy(sql`
          CASE
            WHEN ${episodes.title} LIKE ${searchTerm} THEN 1
            ELSE 2
          END,
          ${episodes.pubDate} DESC
        `)
        .limit(limit);

      // Convert to SearchResult format
      const results: SearchResult[] = episodeResults.map((result: any, index: number) => ({
        episode: result.episode,
        feedTitle: result.feedTitle || 'Unknown Feed',
        matchType: result.episode.title.toLowerCase().includes(query.toLowerCase()) ? 'title' : 'description',
        snippet: this.extractSnippet(
          result.episode.title.toLowerCase().includes(query.toLowerCase())
            ? result.episode.title
            : result.episode.descriptionHtml || '',
          query
        ),
        rank: index + 1,
      }));

      return results;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  // Extract a snippet around the search term
  private extractSnippet(text: string, query: string, maxLength = 150): string {
    if (!text) return '';

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const queryIndex = lowerText.indexOf(lowerQuery);

    if (queryIndex === -1) {
      return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    const startIndex = Math.max(0, queryIndex - Math.floor((maxLength - query.length) / 2));
    const endIndex = Math.min(text.length, startIndex + maxLength);

    let snippet = text.substring(startIndex, endIndex);

    // Add ellipsis if we're not at the beginning/end
    if (startIndex > 0) snippet = '...' + snippet;
    if (endIndex < text.length) snippet = snippet + '...';

    return snippet;
  }

  // Search suggestions based on partial queries
  async getSearchSuggestions(partialQuery: string, limit = 5): Promise<string[]> {
    if (partialQuery.length < 2) return [];

    try {
      const suggestions: string[] = [];
      const searchTerm = `${partialQuery}%`;

      // Get episode title suggestions
      const titleResults = await this.db
        .select({ title: episodes.title })
        .from(episodes)
        .where(sql`${episodes.title} LIKE ${searchTerm}`)
        .limit(limit)
        .groupBy(episodes.title);

      suggestions.push(...titleResults.map((r: any) => r.title));

      // Get feed name suggestions
      const feedResults = await this.db
        .select({ title: feeds.title })
        .from(feeds)
        .where(sql`${feeds.title} LIKE ${searchTerm}`)
        .limit(Math.max(1, limit - suggestions.length))
        .groupBy(feeds.title);

      suggestions.push(...feedResults.map((r: any) => r.title));

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Suggestions error:', error);
      return [];
    }
  }

  // Update search index for an episode
  async updateSearchIndex(episodeId: number): Promise<void> {
    // TODO: Implement FTS5 index update when SQLite is available
    console.log(`Search index update for episode ${episodeId} - not implemented yet`);
  }

  // Rebuild entire search index
  async rebuildSearchIndex(): Promise<void> {
    // TODO: Implement FTS5 index rebuild when SQLite is available
    console.log('Search index rebuild - not implemented yet');
  }

  // Search within transcripts
  async searchTranscripts(query: string, episodeId?: number, limit = 10): Promise<{
    episodeId: number;
    segments: Array<{
      id: number;
      startMs: number;
      endMs: number;
      speaker: string;
      text: string;
      snippet: string;
    }>;
  }[]> {
    const searchTerm = `%${query}%`;

    try {
      const results = await this.db
        .select({
          id: transcriptSegments.id,
          episodeId: transcriptSegments.transcriptId, // This should be linked to episode
          startMs: transcriptSegments.startMs,
          endMs: transcriptSegments.endMs,
          speaker: transcriptSegments.speaker,
          text: transcriptSegments.text,
        })
        .from(transcriptSegments)
        .where(
          sql`${transcriptSegments.text} LIKE ${searchTerm}
             ${episodeId ? sql`AND ${transcriptSegments.transcriptId} IN (
               SELECT id FROM transcripts WHERE episode_id = ${episodeId}
             )` : sql``}`
        )
        .orderBy(sql`${transcriptSegments.startMs}`)
        .limit(limit);

      // Group by episode
      const groupedResults: { [episodeId: number]: any } = {};

      results.forEach((result: any) => {
        const epId = result.episodeId;
        if (!groupedResults[epId]) {
          groupedResults[epId] = {
            episodeId: epId,
            segments: [],
          };
        }

        groupedResults[epId].segments.push({
          id: result.id,
          startMs: result.startMs,
          endMs: result.endMs,
          speaker: result.speaker || 'Unknown',
          text: result.text,
          snippet: this.extractSnippet(result.text, query),
        });
      });

      return Object.values(groupedResults);
    } catch (error) {
      console.error('Transcript search error:', error);
      return [];
    }
  }

  // Advanced search with filters
  async advancedSearch(options: {
    query?: string;
    feedIds?: number[];
    dateFrom?: string;
    dateTo?: string;
    status?: string[];
    hasDuration?: boolean;
    hasTranscript?: boolean;
    hasAISummary?: boolean;
    minDuration?: number;
    maxDuration?: number;
    limit?: number;
    offset?: number;
  }): Promise<SearchResult[]> {
    const {
      query,
      feedIds,
      dateFrom,
      dateTo,
      status,
      hasDuration,
      hasTranscript,
      hasAISummary,
      minDuration,
      maxDuration,
      limit = 20,
      offset = 0,
    } = options;

    let conditions: any[] = [];

    // Text search condition
    if (query) {
      const searchTerm = `%${query}%`;
      conditions.push(
        sql`(${episodes.title} LIKE ${searchTerm} OR ${episodes.descriptionHtml} LIKE ${searchTerm})`
      );
    }

    // Feed filter
    if (feedIds && feedIds.length > 0) {
      conditions.push(sql`${episodes.feedId} IN (${feedIds.join(',')})`);
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(sql`${episodes.pubDate} >= ${dateFrom}`);
    }
    if (dateTo) {
      conditions.push(sql`${episodes.pubDate} <= ${dateTo}`);
    }

    // Status filter
    if (status && status.length > 0) {
      conditions.push(sql`${episodes.status} IN (${status.map(s => `'${s}'`).join(',')})`);
    }

    // Duration filters
    if (hasDuration) {
      conditions.push(sql`${episodes.durationSec} IS NOT NULL AND ${episodes.durationSec} > 0`);
    }
    if (minDuration) {
      conditions.push(sql`${episodes.durationSec} >= ${minDuration}`);
    }
    if (maxDuration) {
      conditions.push(sql`${episodes.durationSec} <= ${maxDuration}`);
    }

    // Transcript filter
    if (hasTranscript) {
      conditions.push(sql`EXISTS (SELECT 1 FROM transcripts WHERE episode_id = ${episodes.id})`);
    }

    // AI summary filter
    if (hasAISummary) {
      conditions.push(sql`EXISTS (SELECT 1 FROM ai_tasks WHERE episode_id = ${episodes.id} AND status = 'succeeded')`);
    }

    try {
      const whereClause = conditions.length > 0
        ? conditions.reduce((acc, condition, index) =>
            index === 0 ? condition : sql`${acc} AND ${condition}`
          )
        : sql`1=1`;

      const results = await this.db
        .select({
          episode: episodes,
          feedTitle: feeds.title,
        })
        .from(episodes)
        .leftJoin(feeds, sql`${episodes.feedId} = ${feeds.id}`)
        .where(whereClause)
        .orderBy(sql`${episodes.pubDate} DESC`)
        .limit(limit)
        .offset(offset);

      return results.map((result: any, index: number) => ({
        episode: result.episode,
        feedTitle: result.feedTitle || 'Unknown Feed',
        matchType: 'title' as const,
        snippet: query ? this.extractSnippet(result.episode.title, query) : result.episode.title,
        rank: index + 1,
      }));
    } catch (error) {
      console.error('Advanced search error:', error);
      return [];
    }
  }

  // Get search statistics
  async getSearchStats(): Promise<{
    totalEpisodes: number;
    episodesWithTranscripts: number;
    episodesWithAI: number;
    totalFeeds: number;
  }> {
    try {
      const [totalEpisodes] = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(episodes);

      const [totalFeeds] = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(feeds);

      // TODO: Get transcript and AI counts when those tables are properly linked

      return {
        totalEpisodes: totalEpisodes.count,
        episodesWithTranscripts: 0, // TODO
        episodesWithAI: 0, // TODO
        totalFeeds: totalFeeds.count,
      };
    } catch (error) {
      console.error('Search stats error:', error);
      return {
        totalEpisodes: 0,
        episodesWithTranscripts: 0,
        episodesWithAI: 0,
        totalFeeds: 0,
      };
    }
  }
}