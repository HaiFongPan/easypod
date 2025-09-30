import React, { useEffect, useMemo, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useEpisodesStore, Episode } from '../store/episodesStore';
import { usePlayerStore } from '../store/playerStore';
import { EpisodeCard } from '../components/Episode/EpisodeCard';
import { cn } from '../utils/cn';
import Button from '../components/Button';

const PAGE_SIZE = 10;
type EpisodesViewMode = 'standard' | 'compact';

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
  } = useEpisodesStore((state) => ({
    episodes: state.episodes,
    loading: state.loading,
    error: state.error,
    searchQuery: state.searchQuery,
    statusFilter: state.statusFilter,
    fetchAllEpisodes: state.fetchAllEpisodes,
    setSearchQuery: state.setSearchQuery,
    setStatusFilter: state.setStatusFilter,
    markAsPlayed: state.markAsPlayed,
    markAsNew: state.markAsNew,
  }), shallow);

  const { loadAndPlay } = usePlayerStore();
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<EpisodesViewMode>('standard');

  useEffect(() => {
    fetchAllEpisodes();
  }, [fetchAllEpisodes]);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(episodes.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [episodes.length, currentPage]);

  const paginatedEpisodes = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return episodes.slice(startIndex, startIndex + PAGE_SIZE);
  }, [episodes, currentPage]);

  const totalPages = Math.max(1, Math.ceil(episodes.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, episodes.length);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearchQuery);
  };

  const handleStatusFilterChange = (status: typeof statusFilter) => {
    if (status === statusFilter) {
      return;
    }
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

  const handleViewModeChange = (mode: EpisodesViewMode) => {
    if (mode === viewMode) {
      return;
    }
    setViewMode(mode);
  };

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
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
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
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

            <div className="flex items-center">
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('standard')}
                  className={cn(
                    'p-2 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-l',
                    viewMode === 'standard' ? 'bg-blue-500 text-white dark:text-white' : 'bg-transparent'
                  )}
                  aria-label="Standard layout"
                  aria-pressed={viewMode === 'standard'}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 5a1 1 0 011-1h10a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 6a1 1 0 011-1h7a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h5a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('compact')}
                  className={cn(
                    'p-2 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-r',
                    viewMode === 'compact' ? 'bg-blue-500 text-white dark:text-white' : 'bg-transparent'
                  )}
                  aria-label="Compact layout"
                  aria-pressed={viewMode === 'compact'}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4.5a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-x-hidden">
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

        {/* Episodes List */}
        {!loading && !error && episodes.length > 0 && (
          <div className="flex-1 min-h-0 p-6 flex flex-col gap-4">
            <div
              className="flex-1 min-h-0 overflow-y-auto pr-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div
                className={cn(
                  'space-y-4',
                  viewMode === 'compact' && 'space-y-2'
                )}
              >
                {paginatedEpisodes.map((episode) => (
                  <EpisodeCard
                    key={episode.id}
                    episode={episode}
                    onPlay={handlePlayEpisode}
                    onMarkAsPlayed={handleMarkAsPlayed}
                    onMarkAsNew={handleMarkAsNew}
                    variant={viewMode}
                  />
                ))}
              </div>
            </div>

            {episodes.length > PAGE_SIZE && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {startIndex + 1}-{endIndex} of {episodes.length} episodes
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
