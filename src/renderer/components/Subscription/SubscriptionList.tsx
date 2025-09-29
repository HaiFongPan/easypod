import React, { useEffect, useState } from 'react';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useSubscriptionFilter } from '../../hooks/useSubscriptionFilter';
import { ViewMode } from '../../types/subscription';
import { cn } from '../../utils/cn';
import Button from '../Button';
import FeedCard from './FeedCard';
import AddFeedDialog from './AddFeedDialog';

interface SubscriptionListProps {
  className?: string;
}

const SubscriptionList: React.FC<SubscriptionListProps> = ({ className }) => {
  const subscriptionStore = useSubscriptionStore();
  console.log('SubscriptionStore state:', subscriptionStore);

  const {
    feeds,
    isLoading,
    error,
    refreshingFeeds,
    addFeed,
    removeFeed,
    refreshFeed,
    refreshAllFeeds,
    selectFeed,
    loadFeeds,
    clearError,
  } = subscriptionStore;

  const {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    toggleCategory,
    sortBy,
    setSortBy,
    filteredFeeds,
    availableCategories,
    clearFilters,
    hasActiveFilters,
  } = useSubscriptionFilter(feeds || []);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Load feeds on component mount
  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const handleAddFeed = async (url: string, category: string) => {
    await addFeed(url, category);
  };

  const handleDeleteFeed = async (feedId: string) => {
    if (confirm('Are you sure you want to delete this podcast subscription?')) {
      await removeFeed(feedId);
    }
  };

  const handleFeedClick = (feed: any) => {
    selectFeed(feed);
    // Navigate to feed detail view (this would be handled by the navigation system)
    console.log('Selected feed:', feed);
  };

  const formatStats = () => {
    if (!feeds || feeds.length === 0) return '0 podcasts, 0 episodes';
    const totalEpisodes = feeds.reduce((sum, feed) => sum + feed.episodeCount, 0);
    return `${feeds.length} podcast${feeds.length !== 1 ? 's' : ''}, ${totalEpisodes} episode${totalEpisodes !== 1 ? 's' : ''}`;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Podcasts
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {formatStats()}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshAllFeeds()}
              disabled={isLoading || refreshingFeeds.size > 0}
              icon={
                <svg className={cn("w-4 h-4", (isLoading || refreshingFeeds.size > 0) && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Refresh All
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Add Podcast
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search podcasts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filters Row */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Categories */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Categories:
              </span>
              <div className="flex flex-wrap gap-1">
                {availableCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border transition-colors",
                      selectedCategories.includes(category)
                        ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700"
                        : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* View Controls */}
            <div className="flex items-center space-x-4">
              {/* Sort */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="title">Title</option>
                  <option value="updated">Last Updated</option>
                  <option value="episodes">Episode Count</option>
                </select>
              </div>

              {/* View Mode */}
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1 rounded-l",
                    viewMode === 'grid'
                      ? "bg-blue-500 text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  )}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-1 rounded-r",
                    viewMode === 'list'
                      ? "bg-blue-500 text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  )}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 dark:text-red-300">{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && feeds.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">Loading podcasts...</p>
            </div>
          </div>
        ) : filteredFeeds.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {feeds.length === 0 ? 'No podcasts yet' : 'No matching podcasts'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {feeds.length === 0
                  ? 'Add your first podcast to get started'
                  : 'Try adjusting your search or filters'
                }
              </p>
              {feeds.length === 0 && (
                <Button
                  variant="primary"
                  onClick={() => setShowAddDialog(true)}
                >
                  Add Your First Podcast
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "space-y-4"
          )}>
            {filteredFeeds.map(feed => (
              <FeedCard
                key={feed.id}
                feed={feed}
                viewMode={viewMode}
                isRefreshing={refreshingFeeds.has(feed.id)}
                onRefresh={() => refreshFeed(feed.id)}
                onDelete={() => handleDeleteFeed(feed.id)}
                onClick={() => handleFeedClick(feed)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Feed Dialog */}
      <AddFeedDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddFeed}
        availableCategories={availableCategories}
      />
    </div>
  );
};

export default SubscriptionList;