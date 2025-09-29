import nock from 'nock';
import { PodcastFeedParser } from '../../main/services/FeedParser';
import { FeedParseError, NetworkError, XMLParseError } from '../../main/types/feed';
import {
  basicRssFeed,
  itunesExtendedFeed,
  podcast20Feed,
  chaptersJson,
  invalidRssFeed,
  malformedXml,
} from '../fixtures/sampleRss';

describe('PodcastFeedParser', () => {
  let parser: PodcastFeedParser;

  beforeEach(() => {
    parser = new PodcastFeedParser({
      timeout: 5000,
      retryAttempts: 2,
      enableCaching: false, // Disable caching for tests
    });
  });

  describe('parseFeed', () => {
    it('should parse basic RSS feed successfully', async () => {
      nock('https://example.com')
        .get('/basic-feed.xml')
        .reply(200, basicRssFeed, {
          'content-type': 'application/rss+xml',
        });

      const feed = await parser.parseFeed('https://example.com/basic-feed.xml');

      expect(feed.title).toBe('Test Podcast');
      expect(feed.description).toBe('A test podcast for unit testing');
      expect(feed.url).toBe('https://example.com/basic-feed.xml');
      expect(feed.image).toBe('https://example.com/cover.jpg');
      expect(feed.episodes).toHaveLength(2);

      const episode1 = feed.episodes[0];
      expect(episode1.title).toBe('Episode 1: Introduction');
      expect(episode1.guid).toBe('episode-1');
      expect(episode1.audioUrl).toBe('https://example.com/episode1.mp3');
      expect(episode1.pubDate).toBeInstanceOf(Date);
    });

    it('should parse iTunes extended RSS feed', async () => {
      nock('https://example.com')
        .get('/itunes-feed.xml')
        .reply(200, itunesExtendedFeed);

      const feed = await parser.parseFeed('https://example.com/itunes-feed.xml');

      expect(feed.title).toBe('iTunes Enhanced Podcast');
      expect(feed.author).toBe('John Doe');
      expect(feed.category).toBe('Technology');
      expect(feed.image).toBe('https://example.com/itunes-cover.jpg');

      const episode = feed.episodes[0];
      expect(episode.title).toBe('Tech Talk Episode 1');
      expect(episode.duration).toBe(4530); // 01:15:30 in seconds
      expect(episode.seasonNumber).toBe(1);
      expect(episode.episodeNumber).toBe(1);
      expect(episode.keywords).toEqual(['AI', 'technology', 'machine learning', 'innovation']);
      expect(episode.explicit).toBe(false);
    });

    it('should parse Podcast 2.0 enhanced feed', async () => {
      // Mock the main feed
      nock('https://example.com')
        .get('/podcast20-feed.xml')
        .reply(200, podcast20Feed);

      // Mock the chapters JSON
      nock('https://example.com')
        .get('/modern1-chapters.json')
        .reply(200, chaptersJson);

      const feed = await parser.parseFeed('https://example.com/podcast20-feed.xml');

      expect(feed.title).toBe('Podcast 2.0 Enhanced Show');
      expect(feed.author).toBe('Jane Smith');

      const episode = feed.episodes[0];
      expect(episode.title).toBe('Modern Podcasting with Chapters');
      expect(episode.duration).toBe(3000); // 50:00 in seconds
      expect(episode.transcript).toBe('https://example.com/modern1-transcript.vtt');
      expect(episode.funding).toHaveLength(1);
      expect(episode.funding![0].url).toBe('https://example.com/episode-support');
      expect(episode.persons).toHaveLength(2);
      expect(episode.persons![0].name).toBe('Jane Smith');
      expect(episode.persons![0].role).toBe('host');

      // Test chapters from JSON
      expect(episode.chapters).toHaveLength(4);
      expect(episode.chapters![0]).toEqual({
        title: 'Introduction',
        startTime: 0,
        image: 'https://example.com/intro.jpg',
        url: 'https://example.com/intro-notes',
        source: 'json',
      });
    });

    it('should extract chapters from shownotes when no JSON chapters', async () => {
      const feedWithShownoteChapters = podcast20Feed.replace(
        '<podcast:chapters url="https://example.com/modern1-chapters.json" type="application/json"/>',
        ''
      );

      nock('https://example.com')
        .get('/shownote-chapters.xml')
        .reply(200, feedWithShownoteChapters);

      const feed = await parser.parseFeed('https://example.com/shownote-chapters.xml');
      const episode = feed.episodes[0];

      expect(episode.chapters).toHaveLength(4);
      expect(episode.chapters![0]).toEqual({
        title: 'Introduction',
        startTime: 0,
        source: 'shownote',
      });
      expect(episode.chapters![1]).toEqual({
        title: 'Main topic discussion',
        startTime: 330, // 05:30 in seconds
        source: 'shownote',
      });
    });

    it('should handle network errors with retry', async () => {
      nock('https://example.com')
        .get('/error-feed.xml')
        .times(2) // Should retry once
        .replyWithError('Network error');

      await expect(parser.parseFeed('https://example.com/error-feed.xml'))
        .rejects
        .toThrow(NetworkError);
    });

    it('should handle HTTP error responses', async () => {
      nock('https://example.com')
        .get('/404-feed.xml')
        .reply(404, 'Not Found');

      await expect(parser.parseFeed('https://example.com/404-feed.xml'))
        .rejects
        .toThrow(NetworkError);
    });

    it('should handle malformed XML', async () => {
      nock('https://example.com')
        .get('/malformed-feed.xml')
        .reply(200, malformedXml);

      await expect(parser.parseFeed('https://example.com/malformed-feed.xml'))
        .rejects
        .toThrow(XMLParseError);
    });

    it('should handle chapters JSON fetch failure gracefully', async () => {
      nock('https://example.com')
        .get('/podcast20-feed.xml')
        .reply(200, podcast20Feed);

      nock('https://example.com')
        .get('/modern1-chapters.json')
        .reply(404, 'Not Found');

      const feed = await parser.parseFeed('https://example.com/podcast20-feed.xml');
      const episode = feed.episodes[0];

      // Should fallback to shownote chapters
      expect(episode.chapters).toHaveLength(4);
      expect(episode.chapters![0].source).toBe('shownote');
    });

    it('should support conditional requests for caching', async () => {
      const parserWithCache = new PodcastFeedParser({ enableCaching: true });

      // First request
      nock('https://example.com')
        .get('/cached-feed.xml')
        .reply(200, basicRssFeed, {
          'etag': '"123456"',
          'last-modified': 'Mon, 01 Jan 2024 12:00:00 GMT',
        });

      await parserWithCache.parseFeed('https://example.com/cached-feed.xml');

      // Second request should include conditional headers
      nock('https://example.com')
        .get('/cached-feed.xml')
        .matchHeader('if-none-match', '"123456"')
        .matchHeader('if-modified-since', 'Mon, 01 Jan 2024 12:00:00 GMT')
        .reply(304); // Not Modified

      const cachedFeed = await parserWithCache.parseFeed('https://example.com/cached-feed.xml');
      expect(cachedFeed.title).toBe('Test Podcast');
    });
  });

  describe('validateFeed', () => {
    it('should validate correct feed', async () => {
      nock('https://example.com')
        .get('/valid-feed.xml')
        .reply(200, basicRssFeed);

      const feed = await parser.parseFeed('https://example.com/valid-feed.xml');
      const validation = parser.validateFeed(feed);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should identify validation errors', async () => {
      nock('https://example.com')
        .get('/invalid-feed.xml')
        .reply(200, invalidRssFeed);

      const feed = await parser.parseFeed('https://example.com/invalid-feed.xml');
      const validation = parser.validateFeed(feed);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('cache functionality', () => {
    it('should cache and retrieve feeds', async () => {
      const parserWithCache = new PodcastFeedParser({ enableCaching: true });

      nock('https://example.com')
        .get('/cache-test.xml')
        .once() // Should only be called once
        .reply(200, basicRssFeed);

      // First call
      const feed1 = await parserWithCache.parseFeed('https://example.com/cache-test.xml');

      // Second call should use cache
      const feed2 = await parserWithCache.parseFeed('https://example.com/cache-test.xml');

      expect(feed1.title).toBe(feed2.title);
      expect(parserWithCache.getCacheStats().size).toBe(1);
    });

    it('should clear cache', () => {
      const parserWithCache = new PodcastFeedParser({ enableCaching: true });

      parserWithCache.clearCache();
      expect(parserWithCache.getCacheStats().size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should provide detailed error information', async () => {
      nock('https://example.com')
        .get('/error-test.xml')
        .replyWithError('Connection timeout');

      try {
        await parser.parseFeed('https://example.com/error-test.xml');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).url).toBe('https://example.com/error-test.xml');
      }
    });

    it('should handle various error types appropriately', async () => {
      // Test different error scenarios
      const scenarios = [
        { path: '/timeout', error: 'ETIMEDOUT', expectedType: NetworkError },
        { path: '/malformed', body: malformedXml, expectedType: XMLParseError },
      ];

      for (const scenario of scenarios) {
        if (scenario.error) {
          nock('https://example.com')
            .get(scenario.path)
            .replyWithError(scenario.error);
        } else {
          nock('https://example.com')
            .get(scenario.path)
            .reply(200, scenario.body);
        }

        await expect(parser.parseFeed(`https://example.com${scenario.path}`))
          .rejects
          .toThrow(scenario.expectedType);
      }
    });
  });
});