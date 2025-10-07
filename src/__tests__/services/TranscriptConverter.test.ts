import { BaseTranscriptConverter } from '../../main/services/transcript/TranscriptConverter';
import {
  SentenceInfo,
  RawTranscriptData,
} from '../../main/types/transcript';

// Concrete implementation for testing
class TestConverter extends BaseTranscriptConverter {
  convertToSentenceInfo(raw: RawTranscriptData): SentenceInfo[] {
    return raw as SentenceInfo[];
  }

  extractText(raw: RawTranscriptData): string {
    return '';
  }

  calculateSpeakerCount(raw: RawTranscriptData): number {
    return 1;
  }

  // Expose protected method for testing
  public testMergeSentences(sentences: SentenceInfo[]): SentenceInfo[] {
    return this.mergeSentences(sentences);
  }
}

describe('BaseTranscriptConverter.mergeSentences', () => {
  const converter = new TestConverter();

  describe('Edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = converter.testMergeSentences([]);
      expect(result).toEqual([]);
    });

    it('returns single sentence unchanged', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'Hello world',
          start: 0,
          end: 1000,
          timestamp: [[0, 1000]],
          spk: 0,
        },
      ];
      const result = converter.testMergeSentences(sentences);
      expect(result).toEqual(sentences);
    });
  });

  describe('Merge condition: Same speaker', () => {
    it('merges sentences from same speaker', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'Hello',
          start: 0,
          end: 1000,
          timestamp: [[0, 500], [500, 1000]],
          spk: 0,
        },
        {
          text: 'world',
          start: 1500,
          end: 2500,
          timestamp: [[1500, 2500]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        text: 'Hello world',
        start: 0,
        end: 2500,
        timestamp: [[0, 500], [500, 1000], [1500, 2500]],
        spk: 0,
      });
    });

    it('does not merge sentences from different speakers', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'Hello',
          start: 0,
          end: 1000,
          timestamp: [[0, 1000]],
          spk: 0,
        },
        {
          text: 'world',
          start: 1500,
          end: 2500,
          timestamp: [[1500, 2500]],
          spk: 1, // Different speaker
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello');
      expect(result[1].text).toBe('world');
    });
  });

  describe('Merge condition: Time gap ≤ 10s', () => {
    it('merges when gap is exactly 10s (10000ms)', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'First',
          start: 0,
          end: 1000,
          timestamp: [[0, 1000]],
          spk: 0,
        },
        {
          text: 'Second',
          start: 11000, // Gap = 10000ms
          end: 12000,
          timestamp: [[11000, 12000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('First Second');
    });

    it('merges when gap is less than 10s', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'First',
          start: 0,
          end: 1000,
          timestamp: [[0, 1000]],
          spk: 0,
        },
        {
          text: 'Second',
          start: 5000, // Gap = 4000ms
          end: 6000,
          timestamp: [[5000, 6000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('First Second');
    });

    it('does not merge when gap exceeds 10s', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'First',
          start: 0,
          end: 1000,
          timestamp: [[0, 1000]],
          spk: 0,
        },
        {
          text: 'Second',
          start: 11001, // Gap = 10001ms > 10000ms
          end: 12000,
          timestamp: [[11001, 12000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('First');
      expect(result[1].text).toBe('Second');
    });
  });

  describe('Merge condition: Total duration ≤ 1min', () => {
    it('merges when total duration is exactly 1min (60000ms)', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'First',
          start: 0,
          end: 40000,
          timestamp: [[0, 40000]],
          spk: 0,
        },
        {
          text: 'Second',
          start: 45000, // Gap = 5000ms (< 10s), Duration from first.start = 45000ms
          end: 55000,
          timestamp: [[45000, 55000]],
          spk: 0,
        },
        {
          text: 'Third',
          start: 60000, // Gap = 5000ms (< 10s), Duration from first.start = 60000ms (exactly 1min)
          end: 65000,
          timestamp: [[60000, 65000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('First Second Third');
    });

    it('merges when total duration is less than 1min', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'First',
          start: 0,
          end: 1000,
          timestamp: [[0, 1000]],
          spk: 0,
        },
        {
          text: 'Second',
          start: 3000, // Gap = 2000ms (< 10s), Duration = 3000ms
          end: 4000,
          timestamp: [[3000, 4000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('First Second');
    });

    it('does not merge when total duration exceeds 1min', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'First',
          start: 0,
          end: 50000,
          timestamp: [[0, 50000]],
          spk: 0,
        },
        {
          text: 'Second',
          start: 55000, // Gap = 5000ms (< 10s)
          end: 58000,
          timestamp: [[55000, 58000]],
          spk: 0,
        },
        {
          text: 'Third',
          start: 60001, // Gap = 2001ms (< 10s), but Duration from first.start = 60001ms (> 60000ms)
          end: 65000,
          timestamp: [[60001, 65000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('First Second');
      expect(result[1].text).toBe('Third');
    });

    it('tracks duration from first sentence in group, not most recent', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'First',
          start: 0,
          end: 5000,
          timestamp: [[0, 5000]],
          spk: 0,
        },
        {
          text: 'Second',
          start: 10000,
          end: 15000,
          timestamp: [[10000, 15000]],
          spk: 0,
        },
        {
          text: 'Third',
          start: 60001, // 60001ms from FIRST, not from SECOND
          end: 65000,
          timestamp: [[60001, 65000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      // First and Second merge, but Third starts a new group
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('First Second');
      expect(result[1].text).toBe('Third');
    });
  });

  describe('Complex scenarios', () => {
    it('handles multiple speakers with interleaved sentences', () => {
      const sentences: SentenceInfo[] = [
        { text: 'A1', start: 0, end: 1000, timestamp: [[0, 1000]], spk: 0 },
        { text: 'A2', start: 1500, end: 2500, timestamp: [[1500, 2500]], spk: 0 },
        { text: 'B1', start: 3000, end: 4000, timestamp: [[3000, 4000]], spk: 1 },
        { text: 'B2', start: 4500, end: 5500, timestamp: [[4500, 5500]], spk: 1 },
        { text: 'A3', start: 6000, end: 7000, timestamp: [[6000, 7000]], spk: 0 },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        text: 'A1 A2',
        start: 0,
        end: 2500,
        timestamp: [[0, 1000], [1500, 2500]],
        spk: 0,
      });
      expect(result[1]).toEqual({
        text: 'B1 B2',
        start: 3000,
        end: 5500,
        timestamp: [[3000, 4000], [4500, 5500]],
        spk: 1,
      });
      expect(result[2]).toEqual({
        text: 'A3',
        start: 6000,
        end: 7000,
        timestamp: [[6000, 7000]],
        spk: 0,
      });
    });

    it('handles mixed merge conditions correctly', () => {
      const sentences: SentenceInfo[] = [
        // Group 1: Merges
        { text: 'S1', start: 0, end: 1000, timestamp: [[0, 1000]], spk: 0 },
        { text: 'S2', start: 2000, end: 3000, timestamp: [[2000, 3000]], spk: 0 },

        // Group 2: Large gap prevents merge
        { text: 'S3', start: 15000, end: 16000, timestamp: [[15000, 16000]], spk: 0 },

        // Group 3: Different speaker prevents merge
        { text: 'S4', start: 17000, end: 18000, timestamp: [[17000, 18000]], spk: 1 },

        // Group 4: Duration limit prevents merge
        { text: 'S5', start: 100000, end: 101000, timestamp: [[100000, 101000]], spk: 0 },
        { text: 'S6', start: 102000, end: 103000, timestamp: [[102000, 103000]], spk: 0 },
        { text: 'S7', start: 161000, end: 162000, timestamp: [[161000, 162000]], spk: 0 },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(5);
      expect(result[0].text).toBe('S1 S2');
      expect(result[1].text).toBe('S3');
      expect(result[2].text).toBe('S4');
      expect(result[3].text).toBe('S5 S6');
      expect(result[4].text).toBe('S7');
    });

    it('preserves timestamp arrays correctly when merging', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'Hello there',
          start: 0,
          end: 2000,
          timestamp: [[0, 1000], [1000, 2000]], // 2 words
          spk: 0,
        },
        {
          text: 'my friend',
          start: 2500,
          end: 4500,
          timestamp: [[2500, 3500], [3500, 4500]], // 2 words
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toEqual([
        [0, 1000],
        [1000, 2000],
        [2500, 3500],
        [3500, 4500],
      ]);
    });

    it('handles long conversation with many sentences', () => {
      const sentences: SentenceInfo[] = [];

      // Create 30 sentences, all from same speaker
      // Each sentence: 1s duration, 2s gap between sentences
      // Total time for each sentence: 3s interval
      for (let i = 0; i < 30; i++) {
        sentences.push({
          text: `Sentence ${i + 1}`,
          start: i * 3000,
          end: i * 3000 + 1000,
          timestamp: [[i * 3000, i * 3000 + 1000]],
          spk: 0,
        });
      }

      const result = converter.testMergeSentences(sentences);

      // With 3s intervals and 60s (60000ms) duration limit:
      // First group: sentences 0-20 (start times: 0, 3000, 6000, ..., 60000)
      // - Sentence 20 starts at 60000ms (exactly at limit, should merge)
      // Second group: sentence 21+ starts new group (63000ms > 60000ms from first)
      expect(result.length).toBeGreaterThan(1);
      expect(result.length).toBeLessThan(30);

      // Verify first group merged correctly
      expect(result[0].start).toBe(0);
      expect(result[0].text).toContain('Sentence 1');
    });
  });

  describe('Boundary conditions', () => {
    it('handles zero-duration sentences', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'Point in time',
          start: 1000,
          end: 1000, // Same start and end
          timestamp: [[1000, 1000]],
          spk: 0,
        },
        {
          text: 'Next',
          start: 2000,
          end: 3000,
          timestamp: [[2000, 3000]],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Point in time Next');
    });

    it('handles sentences with empty timestamp arrays', () => {
      const sentences: SentenceInfo[] = [
        {
          text: 'No timestamps',
          start: 0,
          end: 1000,
          timestamp: [],
          spk: 0,
        },
        {
          text: 'Also none',
          start: 1500,
          end: 2500,
          timestamp: [],
          spk: 0,
        },
      ];

      const result = converter.testMergeSentences(sentences);

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toEqual([]);
    });
  });
});
