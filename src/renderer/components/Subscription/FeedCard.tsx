import React, { useState } from 'react';
import { Feed } from '../../types/subscription';
import { cn } from '../../utils/cn';
import Button from '../Button';
import FeedStatusBadge from './FeedStatusBadge';

interface FeedCardProps {
  feed: Feed;
  onRefresh: () => void;
  onDelete: () => void;
  onClick: () => void;
  viewMode?: 'grid' | 'list';
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRefresh();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  if (viewMode === 'grid' && condensed) {
    return (
      <div
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-2 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
          isActive && 'border-blue-500 shadow-lg'
        )}
        onClick={onClick}
      >
        <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-md">
          {!imageError && feed.coverUrl ? (
            <img
              src={feed.coverUrl}
              alt={feed.title}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-700">
              <svg className="h-10 w-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
            {feed.title}
          </p>
          <div className="mt-1 flex flex-col gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <FeedStatusBadge
              status={isRefreshing ? "updating" : feed.status}
              className="self-start"
            />
            {feed.author && (
              <span className="line-clamp-1">{feed.author}</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {feed.episodeCount} episodes
          </p>
          {feed.categories && feed.categories.length > 0 && (
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">
              {feed.categories.slice(0, 3).join(", ")}
              {feed.categories.length > 3 ? "…" : ""}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'group flex items-center rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
          isActive && 'border-blue-500 shadow-lg'
        )}
        onClick={onClick}
      >
        <div className="relative mr-4 h-16 w-16 flex-shrink-0">
          {!imageError && feed.coverUrl ? (
            <img
              src={feed.coverUrl}
              alt={feed.title}
              className="w-full h-full object-cover rounded-md"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {feed.title}
          </h3>
          <div className="mt-1 flex flex-col gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <FeedStatusBadge status={isRefreshing ? 'updating' : feed.status} className="self-start" />
            {feed.author && (
              <span className="line-clamp-1">{feed.author}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {feed.description}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{feed.episodeCount} episodes</span>
            <span>Updated: {formatDate(feed.lastCheckedAt)}</span>
          </div>
          {feed.categories && feed.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span>{feed.categories.slice(0, 3).join(', ')}{feed.categories.length > 3 ? '…' : ''}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!showDeleteConfirm ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                icon={
                  <svg className={cn("w-4 h-4", isRefreshing && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
              />
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
              <Button variant="ghost" size="sm" onClick={confirmDelete}>✓</Button>
              <Button variant="ghost" size="sm" onClick={cancelDelete}>✕</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg cursor-pointer dark:border-gray-700 dark:bg-gray-800",
        isActive && "border-blue-500 dark:border-blue-400 shadow-lg"
      )}
      onClick={onClick}
    >
      <div className="relative aspect-square w-full">
        {!imageError && feed.coverUrl ? (
          <img
            src={feed.coverUrl}
            alt={feed.title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
            <svg className="h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 pb-12">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {feed.title}
          </h3>
          <FeedStatusBadge status={isRefreshing ? 'updating' : feed.status} className="inline-flex" />
        </div>
        <p className="mb-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
          {feed.description}
        </p>

        <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{feed.episodeCount} episodes</span>
          <span>{formatDate(feed.lastCheckedAt)}</span>
        </div>

        {(feed.author || (feed.categories && feed.categories.length > 0)) && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            {feed.author && <span>{feed.author}</span>}
            {feed.author && feed.categories && feed.categories.length > 0 && <span>•</span>}
            {feed.categories && feed.categories.length > 0 && (
              <span>{feed.categories.slice(0, 3).join(', ')}{feed.categories.length > 3 ? '…' : ''}</span>
            )}
          </div>
        )}

        {feed.error && (
          <div className="mb-2 text-xs text-red-600 dark:text-red-400">
            Error: {feed.error}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-gray-200 bg-white p-2 opacity-0 transition-opacity group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-800">
        {!showDeleteConfirm ? (
          <div className="flex justify-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
            >
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xs text-red-600 dark:text-red-400">Delete this feed?</span>
            <Button variant="ghost" size="sm" onClick={confirmDelete}>Yes</Button>
            <Button variant="ghost" size="sm" onClick={cancelDelete}>No</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedCard;
