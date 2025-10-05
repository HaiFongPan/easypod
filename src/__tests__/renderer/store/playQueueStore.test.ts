import { act } from 'react';
import { usePlayQueueStore, PlayQueueItem } from '../../../renderer/store/playQueueStore';
import { usePlayerStore } from '../../../renderer/store/playerStore';
import { Episode } from '../../../renderer/store/episodesStore';

const globalAny = global as unknown as { window?: any };

const baseEpisode = (overrides: Partial<Episode> = {}): Episode => ({
  id: overrides.id ?? Math.floor(Math.random() * 1000) + 1,
  feedId: 1,
  guid: `episode-${Math.random()}`,
  title: 'Test Episode',
  descriptionHtml: '<p>Episode description</p>',
  audioUrl: 'https://example.com/audio.mp3',
  pubDate: new Date().toISOString(),
  durationSec: 300,
  episodeImageUrl: null,
  localAudioPath: null,
  status: 'new',
  lastPlayedAt: null,
  lastPositionSec: 0,
  feedTitle: 'Test Feed',
  feedCoverUrl: null,
  ...overrides,
});

const mapEpisodeToQueueItem = (episode: Episode, overrides: Partial<PlayQueueItem> = {}): PlayQueueItem => ({
  id: overrides.id ?? episode.id,
  episodeId: episode.id,
  position: overrides.position ?? 1000,
  addedAt: null,
  episode,
});

describe('playQueueStore', () => {
  beforeEach(() => {
    usePlayQueueStore.setState({
      queue: [],
      currentIndex: -1,
      isLoading: false,
      error: null,
    });

    usePlayerStore.setState({
      loadAndPlay: jest.fn(),
      pause: jest.fn(),
      currentEpisode: null,
    });

    if (!globalAny.window) {
      globalAny.window = {};
    }
    globalAny.window.electronAPI = {
      playQueue: {
        getAll: jest.fn(),
        add: jest.fn(),
        remove: jest.fn(),
        reorder: jest.fn(),
        clear: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads queue from preload API', async () => {
    const episode = baseEpisode({ id: 1, title: 'Episode A' });
    const playQueueApi = globalAny.window.electronAPI.playQueue;
    playQueueApi.getAll.mockResolvedValue([
      { id: 10, episodeId: episode.id, position: 1000, addedAt: null, episode },
    ]);

    await act(async () => {
      await usePlayQueueStore.getState().loadQueue();
    });

    const state = usePlayQueueStore.getState();
    expect(playQueueApi.getAll).toHaveBeenCalledTimes(1);
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].episode.title).toBe('Episode A');
    expect(state.currentIndex).toBe(-1);
  });

  it('adds an episode to queue start and updates state', async () => {
    const episode = baseEpisode({ id: 2, title: 'Episode B' });
    const playQueueApi = globalAny.window.electronAPI.playQueue;
    playQueueApi.add.mockResolvedValue({
      success: true,
      queue: [
        { id: 20, episodeId: episode.id, position: 1000, addedAt: null, episode },
      ],
    });

    await act(async () => {
      await usePlayQueueStore.getState().addToQueueStart(episode);
    });

    expect(playQueueApi.add).toHaveBeenCalledWith(episode.id, 'start');
    const state = usePlayQueueStore.getState();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].episodeId).toBe(episode.id);
  });

  it('reorders queue items based on drag indices', async () => {
    const first = mapEpisodeToQueueItem(baseEpisode({ id: 1, title: 'Item 1' }), { id: 100, position: 1000 });
    const second = mapEpisodeToQueueItem(baseEpisode({ id: 2, title: 'Item 2' }), { id: 200, position: 2000 });

    usePlayQueueStore.setState({ queue: [first, second] });

    const playQueueApi = globalAny.window.electronAPI.playQueue;
    playQueueApi.reorder.mockResolvedValue({
      success: true,
      queue: [
        { id: 200, episodeId: second.episodeId, position: 1000, addedAt: null, episode: second.episode },
        { id: 100, episodeId: first.episodeId, position: 2000, addedAt: null, episode: first.episode },
      ],
    });

    await act(async () => {
      await usePlayQueueStore.getState().reorderQueue(0, 1);
    });

    expect(playQueueApi.reorder).toHaveBeenCalledWith([
      { id: 200, position: 1000 },
      { id: 100, position: 2000 },
    ]);

    const state = usePlayQueueStore.getState();
    expect(state.queue[0].episodeId).toBe(second.episodeId);
    expect(state.queue[1].episodeId).toBe(first.episodeId);
  });

  it('advances to the next queued episode when playNext is called', async () => {
    const first = mapEpisodeToQueueItem(baseEpisode({ id: 11, title: 'Episode 11' }), { id: 11, position: 1000 });
    const second = mapEpisodeToQueueItem(baseEpisode({ id: 12, title: 'Episode 12' }), { id: 12, position: 2000 });

    usePlayQueueStore.setState({ queue: [first, second], currentIndex: -1 });

    await act(async () => {
      usePlayQueueStore.getState().playNext();
    });

    const playerLoadAndPlay = usePlayerStore.getState().loadAndPlay as jest.Mock;
    expect(playerLoadAndPlay).toHaveBeenCalledWith(first.episode);

    usePlayQueueStore.setState({ currentIndex: 0 });

    await act(async () => {
      usePlayQueueStore.getState().playNext();
    });

    expect(playerLoadAndPlay).toHaveBeenCalledWith(second.episode);
  });
});
