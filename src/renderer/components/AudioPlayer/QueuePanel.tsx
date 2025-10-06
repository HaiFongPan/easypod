import React, { useState } from 'react';
import { usePlayQueueStore } from '../../store/playQueueStore';
import { usePlayerStore } from '../../store/playerStore';
import PlayPauseButton from '../PlayPauseButton';
import { cn } from '../../utils/cn';
import { useEpisodeDetailNavigation } from '../../hooks/useEpisodeDetailNavigation';

const QueuePanel: React.FC = () => {
  const {
    queue,
    currentIndex,
    removeFromQueue,
    clearQueue,
    reorderQueue,
  } = usePlayQueueStore((state) => ({
    queue: state.queue,
    currentIndex: state.currentIndex,
    removeFromQueue: state.removeFromQueue,
    clearQueue: state.clearQueue,
    reorderQueue: state.reorderQueue,
  }));

  const { currentEpisode } = usePlayerStore((state) => ({
    currentEpisode: state.currentEpisode,
  }));
  const openEpisodeDetail = useEpisodeDetailNavigation();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleRemove = async (episodeId: number) => {
    await removeFromQueue(episodeId);
  };

  const handleClearQueue = async () => {
    if (queue.length === 0) {
      return;
    }
    await clearQueue();
  };

  const handleDragStart = (index: number) => (event: React.DragEvent<HTMLLIElement>) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number) => (event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index: number) => async (event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    const fromData = event.dataTransfer.getData('text/plain');
    const fromIndex = draggedIndex ?? Number(fromData);
    setDraggedIndex(null);
    if (!Number.isInteger(fromIndex) || fromIndex === index) {
      return;
    }
    await reorderQueue(fromIndex, index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const isEmpty = queue.length === 0;

  return (
    <div className="absolute bottom-full right-0 z-50 pb-2">
      <div className="w-96 max-h-96 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Play Queue</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{queue.length} item{queue.length === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          onClick={handleClearQueue}
          disabled={isEmpty}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-100 disabled:text-gray-400 disabled:hover:bg-transparent dark:text-red-300 dark:hover:bg-red-900/40"
        >
          Clear
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isEmpty ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Queue is empty. Add episodes to start listening.
          </div>
        ) : (
          <ol className="divide-y divide-gray-200 dark:divide-gray-700">
            {queue.map((item, index) => {
              const isCurrent = currentEpisode?.id === item.episodeId || currentIndex === index;
              return (
                <li
                  key={item.id}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800',
                    isCurrent && 'bg-blue-50 dark:bg-blue-900/40',
                    draggedIndex === index && 'opacity-60'
                  )}
                >
                  <div className="relative flex-shrink-0 w-10 h-10">
                    <img
                      src={item.episode.episodeImageUrl || item.episode.feedCoverUrl || '/default-cover.png'}
                      alt={item.episode.title}
                      className="w-full h-full object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-cover.png';
                      }}
                    />
                    <div className="absolute bottom-0 right-0 flex items-center justify-center w-5 h-5 bg-blue-600/80 dark:bg-blue-500/80 text-white text-xs font-bold rounded-sm">
                      {index + 1}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEpisodeDetail(item.episode);
                      }}
                      className={cn(
                        'truncate text-left text-sm font-medium transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800',
                        isCurrent ? 'text-blue-600 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
                      )}
                    >
                      {item.episode.title}
                    </button>
                    <p className="text-xs text-gray-500 truncate dark:text-gray-400">
                      {item.episode.feedTitle ?? 'Unknown Podcast'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <PlayPauseButton
                      episode={item.episode}
                      size="sm"
                      variant="minimal"
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
                          d="M8.257 3.099c.366-.446.958-.637 1.53-.484l6 1.5A1 1 0 0116 5.078V16a2 2 0 01-2 2H6a2 2 0 01-2-2V6a1 1 0 01.714-.962l6-1.5a1 1 0 01.543.05zM8 9a1 1 0 10-2 0v5a1 1 0 102 0V9zm3-1a1 1 0 00-1 1v5a1 1 0 102 0V9a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      </div>
    </div>
  );
};

export default QueuePanel;
