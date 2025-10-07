import { AliyunConverter } from '../../main/services/transcript/converters/AliyunConverter';
import { AliyunRawData } from '../../main/types/transcript';

describe('AliyunConverter', () => {
  const converter = new AliyunConverter();

  const samplePayload: AliyunRawData = {
    file_url: 'https://example.com/audio.mp3',
    properties: {
      audio_format: 'mp3',
      channels: [0],
      original_sampling_rate: 44100,
      original_duration_in_milliseconds: 4500,
    },
    transcripts: [
      {
        channel_id: 0,
        content_duration_in_milliseconds: 4400,
        text: 'Hello world!\nHow are you?',
        sentences: [
          {
            begin_time: 0,
            end_time: 1400,
            text: 'Hello world!',
            sentence_id: 1,
            speaker_id: 2,
            words: [
              {
                begin_time: 0,
                end_time: 500,
                text: 'Hello',
                punctuation: '',
              },
              {
                begin_time: 500,
                end_time: 1200,
                text: 'world',
                punctuation: '!',
              },
            ],
          },
          {
            begin_time: 1600,
            end_time: 2600,
            text: 'How are you?',
            sentence_id: 2,
            words: [],
          },
        ],
      },
    ],
  };

  it('converts sentences to unified format with merging', () => {
    const sentenceInfo = converter.convertToSentenceInfo(samplePayload);

    // With merging disabled, we'd have 2 sentences
    // But these sentences should NOT merge because:
    // - They have different speakers (spk: 2 vs spk: 0)
    expect(sentenceInfo).toHaveLength(2);
    expect(sentenceInfo[0]).toEqual({
      text: 'Hello world!',
      start: 0,
      end: 1400,
      timestamp: [
        [0, 500],
        [500, 1200],
      ],
      spk: 2,
    });
    expect(sentenceInfo[1]).toEqual({
      text: 'How are you?',
      start: 1600,
      end: 2600,
      timestamp: [[1600, 2600]],
      spk: 0,
    });
  });

  it('extracts the combined transcript text', () => {
    expect(converter.extractText(samplePayload)).toBe('Hello world!\nHow are you?');
  });

  it('calculates speaker count from channels and speaker ids', () => {
    expect(converter.calculateSpeakerCount(samplePayload)).toBe(2);
  });

  it('falls back to defaults when transcripts are missing', () => {
    const emptyPayload: AliyunRawData = {
      file_url: 'https://example.com/audio.mp3',
      properties: samplePayload.properties,
      transcripts: [],
    };

    expect(converter.convertToSentenceInfo(emptyPayload)).toEqual([]);
    expect(converter.extractText(emptyPayload)).toBe('');
    expect(converter.calculateSpeakerCount(emptyPayload)).toBe(1);
  });

  it('merges sentences from same speaker within time limits', () => {
    const mergeablePayload: AliyunRawData = {
      file_url: 'https://example.com/audio.mp3',
      properties: samplePayload.properties,
      transcripts: [
        {
          channel_id: 0,
          content_duration_in_milliseconds: 10000,
          text: 'First sentence. Second sentence. Third sentence.',
          sentences: [
            {
              begin_time: 0,
              end_time: 2000,
              text: 'First sentence.',
              sentence_id: 1,
              speaker_id: 1,
              words: [
                { begin_time: 0, end_time: 500, text: 'First', punctuation: '' },
                { begin_time: 500, end_time: 2000, text: 'sentence', punctuation: '.' },
              ],
            },
            {
              begin_time: 2500,
              end_time: 4500,
              text: 'Second sentence.',
              sentence_id: 2,
              speaker_id: 1, // Same speaker
              words: [
                { begin_time: 2500, end_time: 3000, text: 'Second', punctuation: '' },
                { begin_time: 3000, end_time: 4500, text: 'sentence', punctuation: '.' },
              ],
            },
            {
              begin_time: 5000,
              end_time: 7000,
              text: 'Third sentence.',
              sentence_id: 3,
              speaker_id: 1, // Same speaker, still within 1min
              words: [
                { begin_time: 5000, end_time: 5500, text: 'Third', punctuation: '' },
                { begin_time: 5500, end_time: 7000, text: 'sentence', punctuation: '.' },
              ],
            },
          ],
        },
      ],
    };

    const sentenceInfo = converter.convertToSentenceInfo(mergeablePayload);

    // All three sentences should merge into one
    expect(sentenceInfo).toHaveLength(1);
    expect(sentenceInfo[0]).toEqual({
      text: 'First sentence. Second sentence. Third sentence.',
      start: 0,
      end: 7000,
      timestamp: [
        [0, 500],
        [500, 2000],
        [2500, 3000],
        [3000, 4500],
        [5000, 5500],
        [5500, 7000],
      ],
      spk: 1,
    });
  });
});
