import React, { useState } from 'react';
import { Feed, ViewMode } from '../../types/subscription';
import { cn } from '../../utils/cn';
import FeedStatusBadge from './FeedStatusBadge';

interface FeedCardProps {
  feed: Feed;
  onRefresh: () => void;
  onDelete: () => void;
  onClick: () => void;
  viewMode?: ViewMode;
  isRefreshing?: boolean;
  isActive?: boolean;
  condensed?: boolean;
}

const FeedCard: React.FC<FeedCardProps> = ({
  feed,
  onRefresh,
  onDelete,
  onClick,
  viewMode = 'grid',
  isRefreshing = false,
  isActive = false,
  condensed = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (value?: string | null) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString();
  };

  const latestRelease = formatDate(feed.lastPubDate ?? feed.lastCheckedAt);

  const handleRefresh = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isRefreshing) {
      onRefresh();
    }
  };

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const renderCoverImage = () =>
    !imageError && feed.coverUrl ? (
      <img
        src={feed.coverUrl}
        alt={feed.title}
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setImageError(true)}
      />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
        <svg className="h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );

  const renderActionOverlay = (positionClass = 'bottom-2 right-2') => (
    <div
      className={cn(
        'pointer-events-none absolute flex items-center gap-1 text-white opacity-90 transition-opacity',
        positionClass,
        !showDeleteConfirm && 'group-hover:opacity-100'
      )}
    >
      {showDeleteConfirm ? (
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-medium">
          <span>Delete?</span>
          <button
            type="button"
            onClick={confirmDelete}
            className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold hover:bg-white/35"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={cancelDelete}
            className="rounded-full bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25"
          >
            No
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleRefresh}
            className={cn(
              'pointer-events-auto rounded-full bg-black/45 p-1.5 shadow-sm backdrop-blur transition hover:bg-black/65',
              isRefreshing && 'cursor-wait opacity-70'
            )}
            aria-label="Refresh feed"
            disabled={isRefreshing}
          >
            <svg
              className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path d="M21 2v6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 22v-6h6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.51 9a9 9 0 0 1 14.13-3.36L21 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 15a9 9 0 0 1-14.13 3.36L3 16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="pointer-events-auto rounded-full bg-black/45 p-1.5 shadow-sm backdrop-blur transition hover:bg-black/65"
            aria-label="Delete feed"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 10v8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 10v8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 6l1-3h12l1 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );

  if (condensed) {
    return (
      <div
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-2 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
          isActive && 'border-primary-500 shadow-lg dark:border-primary-400'
        )}
        onClick={onClick}
      >
        <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
          {renderCoverImage()}
          {renderActionOverlay()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
            {feed.title}
          </p>
          <div className="mt-1 flex flex-col gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <FeedStatusBadge status={isRefreshing ? 'updating' : feed.status} className="self-start" />
            {feed.author && <span className="line-clamp-1">{feed.author}</span>}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {feed.episodeCount} episodes
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Latest: {latestRelease}
          </p>
          {feed.categories && feed.categories.length > 0 && (
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">
              {feed.categories.slice(0, 3).join(', ')}
              {feed.categories.length > 3 ? '…' : ''}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div
        className={cn(
          'group flex h-full flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-center transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
          isActive && 'border-primary-500 shadow-lg dark:border-primary-400'
        )}
        onClick={onClick}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
          {renderCoverImage()}
          {renderActionOverlay('top-2 right-2')}
        </div>

        <div className="flex w-full flex-1 flex-col gap-2">
          <h3 className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
            {feed.title}
          </h3>
          <div className="flex flex-col gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <FeedStatusBadge status={isRefreshing ? 'updating' : feed.status} className="self-center" />
            <div className="flex flex-wrap items-center justify-center gap-1">
              <span>{feed.episodeCount} eps</span>
              <span>•</span>
              <span>{latestRelease}</span>
            </div>
            {feed.categories && feed.categories.length > 0 && (
              <span className="mx-auto line-clamp-1">
                {feed.categories.slice(0, 2).join(', ')}
                {feed.categories.length > 2 ? '…' : ''}
              </span>
            )}
          </div>
          {feed.error && (
            <div className="text-xs text-red-600 dark:text-red-400">
              Error: {feed.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg cursor-pointer dark:border-gray-700 dark:bg-gray-800',
        isActive && 'border-primary-500 shadow-lg dark:border-primary-400'
      )}
      onClick={onClick}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {renderCoverImage()}
        {renderActionOverlay()}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {feed.title}
          </h3>
          <FeedStatusBadge status={isRefreshing ? 'updating' : feed.status} className="inline-flex" />
        </div>
        <p className="mb-2 line-clamp-3 text-xs text-gray-600 dark:text-gray-400">{feed.description}</p>

        <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{feed.episodeCount} episodes</span>
          <span>Latest: {latestRelease}</span>
        </div>

        {(feed.author || (feed.categories && feed.categories.length > 0)) && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            {feed.author && <span>{feed.author}</span>}
            {feed.author && feed.categories && feed.categories.length > 0 && <span>•</span>}
            {feed.categories && feed.categories.length > 0 && (
              <span>
                {feed.categories.slice(0, 3).join(', ')}
                {feed.categories.length > 3 ? '…' : ''}
              </span>
            )}
          </div>
        )}

        {feed.error && (
          <div className="mb-2 text-xs text-red-600 dark:text-red-400">
            Error: {feed.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedCard;
