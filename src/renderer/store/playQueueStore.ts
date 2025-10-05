import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Episode } from './episodesStore';
import { usePlayerStore } from './playerStore';

export interface PlayQueueItem {
  id: number;
  episodeId: number;
  position: number;
  addedAt: string | null;
  episode: Episode;
}

interface PlayQueueStore {
  queue: PlayQueueItem[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;

  loadQueue: () => Promise<void>;
  addPlayNext: (episode: Episode) => Promise<void>;
  addToQueueEnd: (episode: Episode) => Promise<void>;
  moveToQueueStart: (episode: Episode) => Promise<void>;
  removeFromQueue: (episodeId: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  playNext: () => void;
  playPrevious: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<void>;
  setCurrentIndex: (index: number) => void;
}

function mapQueueResponse(items: any[]): PlayQueueItem[] {
  return items.map((item) => ({
    id: item.id,
    episodeId: item.episodeId,
    position: item.position,
    addedAt: item.addedAt ?? null,
    episode: item.episode as Episode,
  }));
}

function computeCurrentIndex(queue: PlayQueueItem[]): number {
  const { currentEpisode } = usePlayerStore.getState();
  if (!currentEpisode) {
    return -1;
  }
  return queue.findIndex((item) => item.episode.id === currentEpisode.id);
}

const POSITION_GAP = 1000;

export const usePlayQueueStore = create<PlayQueueStore>()(
  devtools((set, get) => ({
    queue: [],
    currentIndex: -1,
    isLoading: false,
    error: null,

    async loadQueue() {
      set({ isLoading: true, error: null });
      try {
        const items = await window.electronAPI.playQueue.getAll();
        const queue = mapQueueResponse(items);
        set({
          queue,
          currentIndex: computeCurrentIndex(queue),
          isLoading: false,
        });
      } catch (error) {
        console.error('[PlayQueueStore] Failed to load queue', error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load queue',
        });
      }
    },

    async addPlayNext(episode) {
      const { currentIndex } = get();
      try {
        const result = await window.electronAPI.playQueue.add(
          episode.id,
          'play-next',
          currentIndex
        );
        if (!result.success) {
          throw new Error(result.error || 'Unable to add play next');
        }
        const queue = mapQueueResponse(result.queue);
        set({
          queue,
          currentIndex: computeCurrentIndex(queue),
          error: null,
        });
      } catch (error) {
        console.error('[PlayQueueStore] Failed to add play next', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to add play next',
        });
      }
    },

    async addToQueueEnd(episode) {
      try {
        const result = await window.electronAPI.playQueue.add(episode.id, 'end');
        if (!result.success) {
          throw new Error(result.error || 'Unable to add to queue end');
        }
        const queue = mapQueueResponse(result.queue);
        set({
          queue,
          currentIndex: computeCurrentIndex(queue),
          error: null,
        });
      } catch (error) {
        console.error('[PlayQueueStore] Failed to add to queue end', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to add to queue',
        });
      }
    },

    async moveToQueueStart(episode) {
      const { queue } = get();
      const isInQueue = queue.some((item) => item.episodeId === episode.id);

      try {
        if (isInQueue) {
          // Remove from queue first
          const removeResult = await window.electronAPI.playQueue.remove(episode.id);
          if (!removeResult.success) {
            throw new Error(removeResult.error || 'Unable to remove from queue');
          }
        }

        // Add to queue start (use play-next with currentIndex = -1 to insert at absolute first position)
        const result = await window.electronAPI.playQueue.add(episode.id, 'play-next', -1);
        if (!result.success) {
          throw new Error(result.error || 'Unable to move to queue start');
        }
        const updatedQueue = mapQueueResponse(result.queue);
        set({
          queue: updatedQueue,
          currentIndex: computeCurrentIndex(updatedQueue),
          error: null,
        });
      } catch (error) {
        console.error('[PlayQueueStore] Failed to move to queue start', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to move to queue start',
        });
      }
    },

    async removeFromQueue(episodeId) {
      try {
        const result = await window.electronAPI.playQueue.remove(episodeId);
        if (!result.success) {
          throw new Error(result.error || 'Unable to remove from queue');
        }
        const queue = mapQueueResponse(result.queue);
        const currentEpisode = usePlayerStore.getState().currentEpisode;
        set({
          queue,
          currentIndex: computeCurrentIndex(queue),
          error: null,
        });

        // If removing the currently playing episode
        if (currentEpisode && currentEpisode.id === episodeId) {
          if (queue.length > 0) {
            // Load the first episode in the queue (but don't auto-play)
            const nextEpisode = queue[0].episode;
            const playerStore = usePlayerStore.getState();
            playerStore.loadEpisode(nextEpisode); // Load episode but don't play
            set({ currentIndex: 0 });
          } else {
            // Queue is empty, reset player
            usePlayerStore.getState().reset();
          }
        }
      } catch (error) {
        console.error('[PlayQueueStore] Failed to remove from queue', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to remove from queue',
        });
      }
    },

    async clearQueue() {
      try {
        const result = await window.electronAPI.playQueue.clear();
        if (!result.success) {
          throw new Error(result.error || 'Unable to clear queue');
        }
        usePlayerStore.getState().reset();
        set({ queue: [], currentIndex: -1, error: null });
      } catch (error) {
        console.error('[PlayQueueStore] Failed to clear queue', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to clear queue',
        });
      }
    },

    playNext() {
      const { queue, currentIndex } = get();
      if (queue.length === 0) {
        return;
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        usePlayerStore.getState().pause();
        return;
      }

      const nextEpisode = queue[nextIndex].episode;
      usePlayerStore.getState().loadAndPlay(nextEpisode);
      set({ currentIndex: nextIndex });
    },

    playPrevious() {
      const { queue, currentIndex } = get();
      if (queue.length === 0) {
        return;
      }

      const previousIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      const previousEpisode = queue[previousIndex].episode;
      usePlayerStore.getState().loadAndPlay(previousEpisode);
      set({ currentIndex: previousIndex });
    },

    async reorderQueue(fromIndex, toIndex) {
      const { queue } = get();
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= queue.length ||
        toIndex >= queue.length
      ) {
        return;
      }

      const reordered = [...queue];
      const [movedItem] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedItem);

      const payload = reordered.map((item, index) => ({
        id: item.id,
        position: (index + 1) * POSITION_GAP,
      }));

      try {
        const result = await window.electronAPI.playQueue.reorder(payload);
        if (!result.success) {
          throw new Error(result.error || 'Unable to reorder queue');
        }
        const updatedQueue = mapQueueResponse(result.queue);
        set({
          queue: updatedQueue,
          currentIndex: computeCurrentIndex(updatedQueue),
          error: null,
        });
      } catch (error) {
        console.error('[PlayQueueStore] Failed to reorder queue', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to reorder queue',
        });
      }
    },

    setCurrentIndex(index) {
      set({ currentIndex: index });
    },
  }),
  { name: 'Play Queue Store' }
));

usePlayerStore.subscribe((state, previousState) => {
  const currentId = state.currentEpisode?.id ?? null;
  const previousId = previousState?.currentEpisode?.id ?? null;

  if (currentId === previousId) {
    return;
  }

  if (currentId === null) {
    usePlayQueueStore.setState({ currentIndex: -1 });
    return;
  }

  const { queue } = usePlayQueueStore.getState();
  const index = queue.findIndex((item) => item.episode.id === currentId);
  usePlayQueueStore.setState({ currentIndex: index });
});
