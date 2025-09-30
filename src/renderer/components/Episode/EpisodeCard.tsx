import React from 'react';
import { Episode } from '../../store/episodesStore';
import { formatDuration, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import Button from '../Button';

interface EpisodeCardProps {
  episode: Episode;
  onPlay: (episode: Episode) => void;
  onMarkAsPlayed?: (id: number) => void;
  onMarkAsNew?: (id: number) => void;
  variant?: 'standard' | 'compact';
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({
  episode,
  onPlay,
  onMarkAsPlayed,
  onMarkAsNew,
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
      case 'played':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded">
            Played
          </span>
        );
      default:
        return null;
    }
  };

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
              'flex-1 font-semibold text-gray-900 dark:text-gray-100 line-clamp-2',
              isCompact ? 'text-sm' : 'text-base'
            )}
          >
            {episode.title}
          </h3>
          {getStatusBadge()}
        </div>

        {/* Metadata */}
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-400 mb-2',
            isCompact ? 'text-xs' : 'text-sm'
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
              'text-gray-600 dark:text-gray-400 line-clamp-2',
              isCompact ? 'text-xs mb-2' : 'text-sm mb-3'
            )}
            dangerouslySetInnerHTML={{
              __html: `${episode.descriptionHtml.substring(0, descriptionLimit)}...`
            }}
          />
        )}

        {/* Action Buttons */}
        <div className={cn('flex items-center gap-2 mt-auto', isCompact && 'flex-wrap gap-y-1')}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onPlay(episode)}
          >
            {episode.status === 'in_progress' ? 'Continue' : 'Play'}
          </Button>

          {episode.status !== 'played' && onMarkAsPlayed && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsPlayed(episode.id);
              }}
            >
              Mark as Played
            </Button>
          )}

          {episode.status === 'played' && onMarkAsNew && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsNew(episode.id);
              }}
            >
              Mark as New
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
