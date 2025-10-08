import React, { useEffect, useMemo, useState } from "react";
import { shallow } from "zustand/shallow";
import { useEpisodesStore, Episode } from "../store/episodesStore";
import { usePlayerStore } from "../store/playerStore";
import { EpisodeCard } from "../components/Episode/EpisodeCard";
import { cn } from "../utils/cn";
import Button from "../components/Button";
import { useEpisodeDetailNavigation } from "../hooks/useEpisodeDetailNavigation";
import { LayoutList, PlayCircle, Archive, Search, List, Loader2, AlertCircle, Mic } from "lucide-react";

const PAGE_SIZE = 10;
type EpisodesViewMode = "standard" | "compact";

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
    markAsArchived,
  } = useEpisodesStore(
    (state) => ({
      episodes: state.episodes,
      loading: state.loading,
      error: state.error,
      searchQuery: state.searchQuery,
      statusFilter: state.statusFilter,
      fetchAllEpisodes: state.fetchAllEpisodes,
      setSearchQuery: state.setSearchQuery,
      setStatusFilter: state.setStatusFilter,
      markAsArchived: state.markAsArchived,
    }),
    shallow,
  );

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<EpisodesViewMode>("standard");
  const openEpisodeDetail = useEpisodeDetailNavigation();

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
  const toggleGroupClasses =
    "inline-flex items-center overflow-hidden rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 divide-x divide-gray-200 dark:divide-gray-700";
  const toggleButtonBaseClasses =
    "flex h-10 items-center justify-center px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800";
  const toggleButtonInactiveClasses =
    "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200";
  const toggleButtonActiveClasses =
    "bg-blue-500 text-white hover:bg-blue-500 hover:text-white dark:bg-blue-600 dark:hover:bg-blue-600 dark:text-white";
  const statusOptions = [
    { value: "all" as const, icon: LayoutList, label: "All Episodes" },
    { value: "in_progress" as const, icon: PlayCircle, label: "In Progress" },
    { value: "archived" as const, icon: Archive, label: "Archived" },
  ];

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

  const handleArchive = async (id: number) => {
    await markAsArchived(id);
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              All Episodes
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {episodes.length} episode{episodes.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchAllEpisodes()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
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
                className="w-full h-10 px-4 pl-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100"
                placeholder="Search episodes..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </form>

          {/* Status Filter */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className={toggleGroupClasses} role="group" aria-label="Status filter">
              {statusOptions.map(({ value, icon: Icon, label }) => {
                const isSelected = statusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleStatusFilterChange(value)}
                    className={cn(
                      toggleButtonBaseClasses,
                      isSelected ? toggleButtonActiveClasses : toggleButtonInactiveClasses,
                    )}
                    aria-label={label}
                    aria-pressed={isSelected}
                    title={label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center">
              <div className={toggleGroupClasses} role="group" aria-label="View mode">
                <button
                  type="button"
                  onClick={() => handleViewModeChange("standard")}
                  className={cn(
                    toggleButtonBaseClasses,
                    viewMode === "standard"
                      ? toggleButtonActiveClasses
                      : toggleButtonInactiveClasses,
                  )}
                  aria-label="Standard layout"
                  aria-pressed={viewMode === "standard"}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange("compact")}
                  className={cn(
                    toggleButtonBaseClasses,
                    viewMode === "compact"
                      ? toggleButtonActiveClasses
                      : toggleButtonInactiveClasses,
                  )}
                  aria-label="Compact layout"
                  aria-pressed={viewMode === "compact"}
                >
                  <List className="w-4 h-4" />
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
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading episodes...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-gray-900 dark:text-gray-100 mb-2">
              Error: {error}
            </p>
            <Button onClick={() => fetchAllEpisodes()}>Retry</Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && episodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <Mic className="w-24 h-24 text-gray-400 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Episodes Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Subscribe to podcasts to see episodes here"}
            </p>
          </div>
        )}

        {/* Episodes List */}
        {!loading && !error && episodes.length > 0 && (
          <div className="flex-1 min-h-0 p-6 flex flex-col gap-4">
            <div
              className="flex-1 min-h-0 overflow-y-auto pr-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                className={cn(
                  "space-y-4",
                  viewMode === "compact" && "space-y-2",
                )}
              >
                {paginatedEpisodes.map((episode) => (
                  <EpisodeCard
                    key={episode.id}
                    episode={episode}
                    onArchive={handleArchive}
                    variant={viewMode}
                    onSelect={openEpisodeDetail}
                  />
                ))}
              </div>
            </div>

            {episodes.length > PAGE_SIZE && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {startIndex + 1}-{endIndex} of {episodes.length}{" "}
                  episodes
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
