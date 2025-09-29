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
  getImageUrl,
} from '../../main/utils/feedNormalizer';

describe('feedNormalizer', () => {
  describe('parseDuration', () => {
    it('should parse numeric seconds', () => {
      expect(parseDuration(3600)).toBe(3600);
      expect(parseDuration('3600')).toBe(3600);
    });

    it('should parse HH:MM:SS format', () => {
      expect(parseDuration('01:30:45')).toBe(5445); // 1*3600 + 30*60 + 45
      expect(parseDuration('0:05:30')).toBe(330);
    });

    it('should parse MM:SS format', () => {
      expect(parseDuration('05:30')).toBe(330); // 5*60 + 30
      expect(parseDuration('90:00')).toBe(5400); // 90*60
    });

    it('should handle invalid input', () => {
      expect(parseDuration('')).toBeUndefined();
      expect(parseDuration('invalid')).toBeUndefined();
      expect(parseDuration('25:70')).toBe(1630); // Still parses even with invalid seconds
    });

    it('should handle floating point numbers', () => {
      expect(parseDuration(3600.7)).toBe(3600);
      expect(parseDuration('3600.9')).toBe(3600);
    });
  });

  describe('parseDate', () => {
    it('should parse valid date strings', () => {
      const date = parseDate('Mon, 01 Jan 2024 12:00:00 GMT');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should parse ISO date strings', () => {
      const date = parseDate('2024-01-01T12:00:00Z');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should handle invalid dates', () => {
      expect(parseDate('invalid-date')).toBeUndefined();
      expect(parseDate('')).toBeUndefined();
      expect(parseDate(undefined)).toBeUndefined();
    });
  });

  describe('sanitizeDescription', () => {
    it('should allow safe HTML tags', () => {
      const html = '<p>Safe content with <strong>bold</strong> and <a href="https://example.com">links</a></p>';
      const result = sanitizeDescription(html);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<a href="https://example.com">');
    });

    it('should remove dangerous HTML', () => {
      const html = '<script>alert("xss")</script><p>Safe content</p>';
      const result = sanitizeDescription(html);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Safe content</p>');
    });

    it('should handle empty input', () => {
      expect(sanitizeDescription('')).toBe('');
      expect(sanitizeDescription(undefined)).toBe('');
    });
  });

  describe('extractTextContent', () => {
    it('should extract text from HTML', () => {
      const html = '<p>Hello <strong>world</strong>!</p>';
      expect(extractTextContent(html)).toBe('Hello world!');
    });

    it('should normalize whitespace', () => {
      const html = '<p>Hello     world\n\n   test</p>';
      expect(extractTextContent(html)).toBe('Hello world test');
    });

    it('should handle empty input', () => {
      expect(extractTextContent('')).toBe('');
      expect(extractTextContent(undefined)).toBe('');
    });
  });

  describe('extractChaptersFromShownotes', () => {
    it('should extract chapters with HH:MM:SS timestamps', () => {
      const html = `
        <p>Episode timeline:</p>
        <p>00:00:00 Introduction and welcome</p>
        <p>00:05:30 Main topic discussion</p>
        <p>00:25:15 Q&A session</p>
        <p>01:15:00 Conclusion</p>
      `;

      const chapters = extractChaptersFromShownotes(html);
      expect(chapters).toHaveLength(4);
      expect(chapters[0]).toEqual({
        title: 'Introduction and welcome',
        startTime: 0,
        source: 'shownote',
      });
      expect(chapters[1]).toEqual({
        title: 'Main topic discussion',
        startTime: 330,
        source: 'shownote',
      });
      expect(chapters[3]).toEqual({
        title: 'Conclusion',
        startTime: 4500,
        source: 'shownote',
      });
    });

    it('should extract chapters with MM:SS timestamps', () => {
      const html = `
        05:30 - Getting started
        15:45 - Deep dive
        30:00 - Wrap up
      `;

      const chapters = extractChaptersFromShownotes(html);
      expect(chapters).toHaveLength(3);
      expect(chapters[0]).toEqual({
        title: 'Getting started',
        startTime: 330,
        source: 'shownote',
      });
    });

    it('should handle mixed timestamp formats', () => {
      const html = `
        0:00 Introduction
        5:30 - Main content
        01:15:30: Final thoughts
      `;

      const chapters = extractChaptersFromShownotes(html);
      expect(chapters).toHaveLength(3);
      expect(chapters[2]).toEqual({
        title: 'Final thoughts',
        startTime: 4530,
        source: 'shownote',
      });
    });

    it('should return empty array for content without timestamps', () => {
      const html = '<p>No timestamps in this content</p>';
      expect(extractChaptersFromShownotes(html)).toEqual([]);
    });
  });

  describe('normalizeCategory', () => {
    it('should remove iTunes prefix', () => {
      expect(normalizeCategory('iTunes Technology')).toBe('Technology');
      expect(normalizeCategory('Technology')).toBe('Technology');
    });

    it('should decode HTML entities', () => {
      expect(normalizeCategory('Arts &amp; Entertainment')).toBe('Arts & Entertainment');
    });

    it('should handle undefined input', () => {
      expect(normalizeCategory(undefined)).toBeUndefined();
    });
  });

  describe('parseKeywords', () => {
    it('should parse comma-separated keywords', () => {
      expect(parseKeywords('tech, AI, podcast')).toEqual(['tech', 'AI', 'podcast']);
    });

    it('should trim whitespace', () => {
      expect(parseKeywords('  tech , AI,podcast  ')).toEqual(['tech', 'AI', 'podcast']);
    });

    it('should filter empty keywords', () => {
      expect(parseKeywords('tech,, AI,   , podcast')).toEqual(['tech', 'AI', 'podcast']);
    });

    it('should handle undefined input', () => {
      expect(parseKeywords(undefined)).toEqual([]);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe('https://example.com');
      expect(validateUrl('http://test.org/path?query=1')).toBe('http://test.org/path?query=1');
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBeUndefined();
      expect(validateUrl('ftp://invalid')).toBe('ftp://invalid'); // URL constructor allows this
    });

    it('should handle undefined input', () => {
      expect(validateUrl(undefined)).toBeUndefined();
      expect(validateUrl('')).toBeUndefined();
    });
  });

  describe('generateEpisodeGuid', () => {
    it('should use provided GUID if available', () => {
      const guid = generateEpisodeGuid('episode-123', 'https://example.com/audio.mp3', 'Test Episode', new Date());
      expect(guid).toBe('episode-123');
    });

    it('should fallback to audio URL', () => {
      const guid = generateEpisodeGuid(undefined, 'https://example.com/audio.mp3', 'Test Episode', new Date());
      expect(guid).toBe('https://example.com/audio.mp3');
    });

    it('should fallback to title and date', () => {
      const date = new Date('2024-01-01');
      const guid = generateEpisodeGuid(undefined, '', 'Test Episode!', date);
      expect(guid).toBe('test-episode--2024-01-01');
    });

    it('should handle missing date', () => {
      const guid = generateEpisodeGuid(undefined, '', 'Test Episode', undefined);
      expect(guid).toBe('test-episode-unknown');
    });
  });

  describe('getImageUrl', () => {
    it('should prefer primary URL', () => {
      const url = getImageUrl('https://primary.com/image.jpg', 'https://fallback.com/image.jpg');
      expect(url).toBe('https://primary.com/image.jpg');
    });

    it('should use fallback when primary is invalid', () => {
      const url = getImageUrl('invalid-url', 'https://fallback.com/image.jpg');
      expect(url).toBe('https://fallback.com/image.jpg');
    });

    it('should return undefined when both are invalid', () => {
      const url = getImageUrl('invalid', 'also-invalid');
      expect(url).toBeUndefined();
    });
  });
});