import React, { useEffect, useState } from 'react';
import { usePlayQueueStore } from '../store/playQueueStore';
import { usePlayerStore } from '../store/playerStore';
import { cn } from '../utils/cn';
import PlayPauseButton from '../components/PlayPauseButton';
import Button from '../components/Button';
import { useEpisodeDetailNavigation } from '../hooks/useEpisodeDetailNavigation';

const PlayQueuePage: React.FC = () => {
  const {
    queue,
    currentIndex,
    loadQueue,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    isLoading,
    error,
  } = usePlayQueueStore((state) => ({
    queue: state.queue,
    currentIndex: state.currentIndex,
    loadQueue: state.loadQueue,
    reorderQueue: state.reorderQueue,
    removeFromQueue: state.removeFromQueue,
    clearQueue: state.clearQueue,
    isLoading: state.isLoading,
    error: state.error,
  }));
  const { currentEpisode } = usePlayerStore((state) => ({
    currentEpisode: state.currentEpisode,
  }));
  const openEpisodeDetail = useEpisodeDetailNavigation();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadQueue().catch((error) => {
      console.error('[PlayQueuePage] Failed to load queue', error);
    });
  }, [loadQueue]);

  const handleRemove = async (episodeId: number) => {
    await removeFromQueue(episodeId);
  };

  const handleClear = async () => {
    await clearQueue();
  };

  const handleDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (_index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index: number) => async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const data = event.dataTransfer.getData('text/plain');
    const fromIndex = draggedIndex ?? Number(data);
    setDraggedIndex(null);
    if (!Number.isInteger(fromIndex) || fromIndex === index) {
      return;
    }
    await reorderQueue(fromIndex, index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Play Queue</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {queue.length} item{queue.length === 1 ? '' : 's'} queued
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClear}
          disabled={queue.length === 0}
        >
          Clear Queue
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a7 7 0 107 7h-2a5 5 0 11-5-5V3z" />
            </svg>
            Loading queue…
          </div>
        )}

        {queue.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-center dark:border-gray-700 dark:bg-gray-800">
            <svg className="h-10 w-10 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 110 2H5a1 1 0 01-1-1zM4 9a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM4 13a1 1 0 011-1h8a1 1 0 110 2H5a1 1 0 01-1-1zM4 17a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z" />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">Queue is empty</h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              Start playing an episode or use the queue buttons in podcast lists to build your listening queue.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item, index) => {
              const isCurrent = currentEpisode?.id === item.episodeId || currentIndex === index;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'group flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500',
                    isCurrent && 'border-blue-400 dark:border-blue-500'
                  )}
                >
                  <div className="relative flex-shrink-0 w-12 h-12">
                    <img
                      src={item.episode.episodeImageUrl || item.episode.feedCoverUrl || '/default-cover.png'}
                      alt={item.episode.title}
                      className="w-full h-full object-cover rounded-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-cover.png';
                      }}
                    />
                    <div className="absolute bottom-0 right-0 flex items-center justify-center w-6 h-6 bg-blue-600/80 dark:bg-blue-500/80 text-white text-xs font-bold rounded-sm">
                      {index + 1}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEpisodeDetail(item.episode);
                          }}
                          className={cn(
                            'truncate text-left text-sm font-semibold text-gray-900 transition hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:focus:ring-blue-400',
                            isCurrent && 'text-blue-600 dark:text-blue-300'
                          )}
                        >
                          {item.episode.title}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.episode.feedTitle ?? 'Unknown Podcast'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PlayPauseButton
                          episode={item.episode}
                          size="sm"
                          variant="default"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemove(item.episodeId)}
                          className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700"
                          aria-label="Remove from queue"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M6 8a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {item.episode.descriptionHtml?.replace(/<[^>]*>/g, '') || 'No description available.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayQueuePage;
