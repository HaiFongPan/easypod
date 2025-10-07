import axios from 'axios';
import { AliyunService } from '../../main/services/transcript/AliyunService';
import { AliyunConfig } from '../../main/services/transcript/TranscriptConfigManager';

const createMockClient = () => ({
  post: jest.fn(),
  get: jest.fn(),
});

describe('AliyunService helpers', () => {
  const baseConfig: AliyunConfig = {
    apiKey: 'test-key',
    baseURL: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'paraformer-v2',
    languageHints: ['zh', 'en'],
    speakerCount: 2,
    disfluencyRemoval: true,
  };

  beforeEach(() => {
    jest.spyOn(axios, 'create').mockReturnValue(createMockClient() as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds submit payload with option overrides', () => {
    const service = new AliyunService(baseConfig);
    const payload = (service as any).buildSubmitPayload('https://audio.example.com/file.mp3', {
      model: 'paraformer-v1',
      languageHints: ['en'],
      speakerCount: 3,
      disfluencyRemoval: false,
      timestampAlignment: false,
      diarizationEnabled: false,
    });

    expect(payload).toEqual({
      model: 'paraformer-v1',
      input: {
        file_urls: ['https://audio.example.com/file.mp3'],
      },
      parameters: {
        disfluency_removal_enabled: false,
        timestamp_alignment_enabled: false,
        language_hints: ['en'],
        diarization_enabled: false,
        speaker_count: 3,
      },
    });
  });

  it('falls back to configuration defaults when options missing', () => {
    const service = new AliyunService(baseConfig);
    const payload = (service as any).buildSubmitPayload('https://audio.example.com/file.mp3');

    expect(payload).toEqual({
      model: 'paraformer-v2',
      input: {
        file_urls: ['https://audio.example.com/file.mp3'],
      },
      parameters: {
        disfluency_removal_enabled: true,
        timestamp_alignment_enabled: true,
        language_hints: ['zh', 'en'],
        diarization_enabled: true,
        speaker_count: 2,
      },
    });
  });

  it('maps Aliyun statuses to unified TaskStatus values', () => {
    const service = new AliyunService(baseConfig);
    expect((service as any).mapAliyunStatus('PENDING')).toBe('pending');
    expect((service as any).mapAliyunStatus('RUNNING')).toBe('processing');
    expect((service as any).mapAliyunStatus('SUCCEEDED')).toBe('succeeded');
    expect((service as any).mapAliyunStatus('FAILED')).toBe('failed');
  });
});
