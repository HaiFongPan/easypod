import { Episode } from '../types';

// Mock episode data for testing
export const mockEpisodes: Episode[] = [
  {
    id: '1',
    feedId: 'test-feed-1',
    guid: 'episode-1',
    title: 'Test Episode 1: Audio Player Demo',
    descriptionHtml: '<p>This is a test episode to demonstrate the audio player functionality.</p>',
    // Using a public domain audio file for testing
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    pubDate: new Date('2024-01-01'),
    durationSec: 30,
    episodeImageUrl: 'https://via.placeholder.com/300x300/4F46E5/ffffff?text=Test+Episode+1',
    localAudioPath: null,
    status: 'new',
    lastPlayedAt: null,
    lastPositionSec: 0,
    meta: {},
  },
  {
    id: '2',
    feedId: 'test-feed-1',
    guid: 'episode-2',
    title: 'Test Episode 2: Longer Audio Sample',
    descriptionHtml: '<p>A longer test episode for testing seek and progress functionality.</p>',
    // Another public domain audio sample
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-01.wav',
    pubDate: new Date('2024-01-02'),
    durationSec: 120,
    episodeImageUrl: 'https://via.placeholder.com/300x300/059669/ffffff?text=Test+Episode+2',
    localAudioPath: null,
    status: 'in_progress',
    lastPlayedAt: new Date('2024-01-02'),
    lastPositionSec: 45,
    meta: {},
  },
  {
    id: '3',
    feedId: 'test-feed-2',
    guid: 'episode-3',
    title: 'Test Episode 3: Music Sample',
    descriptionHtml: '<p>A music sample for testing audio controls and quality.</p>',
    // Creative Commons music sample
    audioUrl: 'https://www.bensound.com/bensound-music/bensound-ukulele.mp3',
    pubDate: new Date('2024-01-03'),
    durationSec: 180,
    episodeImageUrl: 'https://via.placeholder.com/300x300/DC2626/ffffff?text=Music+Test',
    localAudioPath: null,
    status: 'played',
    lastPlayedAt: new Date('2024-01-03'),
    lastPositionSec: 180,
    meta: {},
  }
];

// Alternative audio sources if the above don't work
export const alternativeAudioSources = [
  'https://html5tutorial.info/media/vincent.mp3',
  'https://www.w3schools.com/html/mov_bbb.mp4', // Video with audio
  'https://file-examples.com/storage/fe11c0cf9f6da3b7a1c/2017/11/file_example_MP3_700KB.mp3',
];

// Test chapters data
export const mockChapters = [
  {
    id: '1',
    episodeId: '1',
    startMs: 0,
    endMs: 10000,
    title: 'Introduction',
    imageUrl: null,
    source: 'manual' as const,
  },
  {
    id: '2',
    episodeId: '1',
    startMs: 10000,
    endMs: 20000,
    title: 'Main Content',
    imageUrl: null,
    source: 'manual' as const,
  },
  {
    id: '3',
    episodeId: '1',
    startMs: 20000,
    endMs: 30000,
    title: 'Conclusion',
    imageUrl: null,
    source: 'manual' as const,
  },
];

// Helper function to get a random episode
export const getRandomEpisode = (): Episode => {
  const randomIndex = Math.floor(Math.random() * mockEpisodes.length);
  return mockEpisodes[randomIndex];
};

// Helper function to create a custom test episode
export const createTestEpisode = (overrides: Partial<Episode> = {}): Episode => {
  return {
    id: `test-${Date.now()}`,
    feedId: 'test-feed',
    guid: `test-guid-${Date.now()}`,
    title: 'Custom Test Episode',
    descriptionHtml: '<p>Custom test episode description</p>',
    audioUrl: alternativeAudioSources[0],
    pubDate: new Date(),
    durationSec: 60,
    episodeImageUrl: 'https://via.placeholder.com/300x300/8B5CF6/ffffff?text=Custom+Test',
    localAudioPath: null,
    status: 'new',
    lastPlayedAt: null,
    lastPositionSec: 0,
    meta: {},
    ...overrides,
  };
};