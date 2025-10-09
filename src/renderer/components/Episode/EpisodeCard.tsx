import React from 'react';
import { Episode } from '../../store/episodesStore';
import { formatDuration, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import PlayPauseButton from '../PlayPauseButton';
import QueueAddButton from '../QueueAddButton';
import { ArchiveEpisodeButton } from '../ArchiveEpisodeButton';

interface EpisodeCardProps {
  episode: Episode;
  variant?: 'standard' | 'compact';
  onSelect?: (episode: Episode) => void;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({
  episode,
  variant = 'standard',
  onSelect,
}) => {

  const progressPercentage = episode.durationSec
    ? (episode.lastPositionSec / episode.durationSec) * 100
    : 0;
  const isCompact = variant === 'compact';
  const actionButtonSize = isCompact ? 'sm' : 'md';
  const descriptionLimit = isCompact ? 120 : 200;
  const plainDescription = episode.descriptionHtml
    ? episode.descriptionHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
  const truncatedDescription = plainDescription
    ? `${plainDescription.slice(0, descriptionLimit)}${plainDescription.length > descriptionLimit ? '…' : ''}`
    : '';
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(episode);
    }
  };

  return (
    <div
      className={cn(
        'flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow',
        onSelect ? 'cursor-pointer' : 'cursor-default',
        isCompact ? 'p-3 gap-3' : 'p-4 gap-4'
      )}
      onClick={onSelect ? () => onSelect(episode) : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={handleKeyDown}
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
            {onSelect ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(episode);
                }}
                className={cn(
                  'text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800',
                  !isArchived && 'hover:underline'
                )}
              >
                {episode.title}
              </button>
            ) : (
              episode.title
            )}
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
        {truncatedDescription && (
          <p
            className={cn(
              'line-clamp-2',
              isCompact ? 'text-xs mb-2' : 'text-sm mb-3',
              isArchived
                ? 'text-gray-400 dark:text-gray-600'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            {truncatedDescription}
          </p>
        )}

        {/* Action Buttons */}
        <div className={cn('flex items-center gap-2 mt-auto', isCompact && 'flex-wrap gap-y-1')}>
          <div className="flex items-center gap-1">
            <QueueAddButton episode={episode} placement="next" size={actionButtonSize} />
            <QueueAddButton episode={episode} placement="end" size={actionButtonSize} />
          </div>

          <PlayPauseButton
            episode={episode}
            size={actionButtonSize}
            showTooltip
          />

          <ArchiveEpisodeButton
            episodeId={episode.id}
            status={episode.status}
            size={actionButtonSize}
            className={cn(
              'transition',
              episode.status === 'archived' &&
                'text-gray-300 dark:text-gray-700 hover:text-gray-300 dark:hover:text-gray-700',
            )}
            title={episode.status === 'archived' ? 'Already archived' : 'Archive episode'}
            aria-label={episode.status === 'archived' ? 'Episode already archived' : 'Archive episode'}
          />
        </div>
      </div>
    </div>
  );
};
