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
}

const FeedCard: React.FC<FeedCardProps> = ({
  feed,
  onRefresh,
  onDelete,
  onClick,
  viewMode = 'grid',
  isRefreshing = false,
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

  if (viewMode === 'list') {
    return (
      <div
        className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer group"
        onClick={onClick}
      >
        <div className="relative w-16 h-16 flex-shrink-0 mr-4">
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
          <FeedStatusBadge status={isRefreshing ? 'updating' : feed.status} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {feed.title}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
            {feed.description}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{feed.episodeCount} episodes</span>
            <span>Updated: {formatDate(feed.lastCheckedAt)}</span>
          </div>
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
      className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg cursor-pointer dark:border-gray-700 dark:bg-gray-800"
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
        <FeedStatusBadge status={isRefreshing ? 'updating' : feed.status} />
      </div>

      <div className="flex flex-1 flex-col p-4 pb-12">
        <h3 className="mb-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {feed.title}
        </h3>
        <p className="mb-2 text-xs text-gray-600 line-clamp-2 dark:text-gray-400">
          {feed.description}
        </p>

        <div className="mb-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{feed.episodeCount} episodes</span>
          <span>{formatDate(feed.lastCheckedAt)}</span>
        </div>

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
