import React from 'react';
import { Episode } from '../../store/episodesStore';
import { formatDuration, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import PlayPauseButton from '../PlayPauseButton';
import QueueAddButton from '../QueueAddButton';

interface EpisodeCardProps {
  episode: Episode;
  onArchive?: (id: number) => void;
  variant?: 'standard' | 'compact';
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({
  episode,
  onArchive,
  variant = 'standard',
}) => {

  const progressPercentage = episode.durationSec
    ? (episode.lastPositionSec / episode.durationSec) * 100
    : 0;
  const isCompact = variant === 'compact';
  const descriptionLimit = isCompact ? 120 : 200;
  const getStatusBadge = () => {
    switch (episode.status) {
      case 'new':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
            New
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
            In Progress
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  const isArchived = episode.status === 'archived';

  return (
    <div
      className={cn(
        'flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow cursor-pointer',
        isCompact ? 'p-3 gap-3' : 'p-4 gap-4'
      )}
    >
      {/* Episode Image */}
      <div className={cn('relative flex-shrink-0', isCompact ? 'w-20 h-20' : 'w-32 h-32')}>
        <img
          src={episode.episodeImageUrl || episode.feedCoverUrl || '/default-cover.png'}
          alt={episode.title}
          className="w-full h-full object-cover rounded-md"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-cover.png';
          }}
        />
        {episode.status === 'in_progress' && progressPercentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-600 rounded-b-md overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Episode Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header with Title and Badge */}
        <div className="flex items-start gap-2 mb-2">
          <h3
            className={cn(
              'flex-1 font-semibold line-clamp-2',
              isCompact ? 'text-sm' : 'text-base',
              isArchived
                ? 'text-gray-400 dark:text-gray-600'
                : 'text-gray-900 dark:text-gray-100'
            )}
          >
            {episode.title}
          </h3>
          {getStatusBadge()}
        </div>

        {/* Metadata */}
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 mb-2',
            isCompact ? 'text-xs' : 'text-sm',
            isArchived
              ? 'text-gray-400 dark:text-gray-600'
              : 'text-gray-600 dark:text-gray-400'
          )}
        >
          <span className="font-medium">{episode.feedTitle || 'Unknown Feed'}</span>
          <span>•</span>
          <span>{formatDate(episode.pubDate)}</span>
          {episode.durationSec && (
            <>
              <span>•</span>
              <span>{formatDuration(episode.durationSec)}</span>
            </>
          )}
        </div>

        {/* Description */}
        {episode.descriptionHtml && (
          <div
            className={cn(
              'line-clamp-2',
              isCompact ? 'text-xs mb-2' : 'text-sm mb-3',
              isArchived
                ? 'text-gray-400 dark:text-gray-600'
                : 'text-gray-600 dark:text-gray-400'
            )}
            dangerouslySetInnerHTML={{
              __html: `${episode.descriptionHtml.substring(0, descriptionLimit)}...`
            }}
          />
        )}

        {/* Action Buttons */}
        <div className={cn('flex items-center gap-2 mt-auto', isCompact && 'flex-wrap gap-y-1')}>
          <div className="flex items-center gap-1">
            <QueueAddButton episode={episode} placement="start" />
            <QueueAddButton episode={episode} placement="end" />
          </div>

          <PlayPauseButton
            episode={episode}
            size="md"
            showTooltip
          />

          {onArchive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (episode.status !== 'archived') {
                  onArchive(episode.id);
                }
              }}
              disabled={episode.status === 'archived'}
              className={cn(
                'rounded-full p-1.5 transition',
                episode.status === 'archived'
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700 dark:hover:text-red-400'
              )}
              aria-label={episode.status === 'archived' ? 'Already archived' : 'Archive episode'}
              title={episode.status === 'archived' ? 'Already archived' : 'Archive episode'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="5" x="2" y="3" rx="1"/>
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
                <path d="m9.5 17 5-5"/>
                <path d="m9.5 12 5 5"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
