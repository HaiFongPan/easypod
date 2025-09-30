import React, { useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useEpisodesStore, Episode } from '../store/episodesStore';
import { usePlayerStore } from '../store/playerStore';
import { EpisodeCard } from '../components/Episode/EpisodeCard';
import { cn } from '../utils/cn';
import Button from '../components/Button';

export const EpisodesListPage: React.FC = () => {
  const {
    episodes,
    loading,
    error,
    searchQuery,
    statusFilter,
    fetchAllEpisodes,
    setSearchQuery,
    setStatusFilter,
    markAsPlayed,
    markAsNew,
  } = useEpisodesStore();

  const { loadAndPlay } = usePlayerStore();
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  useEffect(() => {
    fetchAllEpisodes();
  }, [fetchAllEpisodes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearchQuery);
  };

  const handleStatusFilterChange = (status: typeof statusFilter) => {
    setStatusFilter(status);
  };

  const handlePlayEpisode = (episode: Episode) => {
    loadAndPlay(episode);
  };

  const handleMarkAsPlayed = async (id: number) => {
    await markAsPlayed(id);
  };

  const handleMarkAsNew = async (id: number) => {
    await markAsNew(id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Episodes</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchAllEpisodes()}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <form className="flex-1" onSubmit={handleSearch}>
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-2 pl-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100"
                placeholder="Search episodes..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          {/* Status Filter */}
          <div className="flex space-x-2">
            <Button
              variant={statusFilter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleStatusFilterChange('all')}
            >
              All
            </Button>
            <Button
              variant={statusFilter === 'new' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleStatusFilterChange('new')}
            >
              New
            </Button>
            <Button
              variant={statusFilter === 'in_progress' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleStatusFilterChange('in_progress')}
            >
              In Progress
            </Button>
            <Button
              variant={statusFilter === 'played' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleStatusFilterChange('played')}
            >
              Played
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading episodes...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-gray-900 dark:text-gray-100 mb-2">Error: {error}</p>
            <Button onClick={() => fetchAllEpisodes()}>Retry</Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && episodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <svg
              className="w-24 h-24 text-gray-400 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Episodes Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Subscribe to podcasts to see episodes here'}
            </p>
          </div>
        )}

        {/* Episodes List with Virtual Scrolling */}
        {!loading && !error && episodes.length > 0 && (
          <div className="h-full p-6">
            <Virtuoso
              style={{ height: '100%' }}
              data={episodes}
              itemContent={(index, episode) => (
                <div className="mb-4" key={episode.id}>
                  <EpisodeCard
                    episode={episode}
                    onPlay={handlePlayEpisode}
                    onMarkAsPlayed={handleMarkAsPlayed}
                    onMarkAsNew={handleMarkAsNew}
                  />
                </div>
              )}
              overscan={5}
            />
          </div>
        )}
      </div>
    </div>
  );
};