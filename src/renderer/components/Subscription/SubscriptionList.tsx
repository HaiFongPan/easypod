import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSubscriptionStore } from "../../store/subscriptionStore";
import { useSubscriptionFilter } from "../../hooks/useSubscriptionFilter";
import { ViewMode, Feed, SortBy } from "../../types/subscription";
import { cn } from "../../utils/cn";
import Button from "../Button";
import FeedCard from "./FeedCard";
import AddFeedDialog from "./AddFeedDialog";
import { Episode } from "../../store/episodesStore";
import { getElectronAPI } from "../../utils/electron";
import { formatDate, formatDuration } from "../../utils/formatters";
import PlayPauseButton from "../PlayPauseButton";
import QueueAddButton from "../QueueAddButton";
import { Grid, Grid3x3 } from "lucide-react";
import { useEpisodeDetailNavigation } from "../../hooks/useEpisodeDetailNavigation";

interface SubscriptionListProps {
  className?: string;
}

const SubscriptionList: React.FC<SubscriptionListProps> = ({ className }) => {
  const subscriptionStore = useSubscriptionStore();

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
    selectedCategories,
    toggleCategory,
    sortBy,
    setSortBy,
    filteredFeeds,
    availableCategories,
    clearFilters,
    hasActiveFilters,
  } = useSubscriptionFilter(feeds || []);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [autoSwitchedToGrid, setAutoSwitchedToGrid] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeFeed, setActiveFeed] = useState<Feed | null>(null);
  const [episodesDrawerOpen, setEpisodesDrawerOpen] = useState(false);
  const [feedEpisodes, setFeedEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesLoadingMore, setEpisodesLoadingMore] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [episodesPage, setEpisodesPage] = useState(0);
  const [hasMoreEpisodes, setHasMoreEpisodes] = useState(false);
  const openEpisodeDetail = useEpisodeDetailNavigation();

  const EPISODES_PAGE_SIZE = 20;

  const activeFeedFromList = useMemo(() => {
    if (!activeFeed) {
      return null;
    }
    return filteredFeeds.find((feed) => feed.id === activeFeed.id) ?? null;
  }, [filteredFeeds, activeFeed]);

  const effectiveActiveFeed = activeFeedFromList ?? activeFeed ?? null;

  const feedRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const feedLayoutClasses = useMemo(() => {
    if (episodesDrawerOpen) {
      return "flex flex-col gap-3";
    }
    if (viewMode === "grid") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6";
    }
    return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-4";
  }, [viewMode, episodesDrawerOpen]);

  // Load feeds on component mount
  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const resetEpisodesState = useCallback(() => {
    setFeedEpisodes([]);
    setEpisodesError(null);
    setEpisodesLoading(false);
    setEpisodesLoadingMore(false);
    setEpisodesPage(0);
    setHasMoreEpisodes(false);
  }, []);

  const closeEpisodesDrawer = useCallback(() => {
    setEpisodesDrawerOpen(false);
    setActiveFeed(null);
    resetEpisodesState();
    selectFeed(null);
    if (autoSwitchedToGrid) {
      setViewMode("compact");
      setAutoSwitchedToGrid(false);
    }
  }, [
    autoSwitchedToGrid,
    resetEpisodesState,
    selectFeed,
    setAutoSwitchedToGrid,
    setViewMode,
  ]);

  const loadEpisodesForFeed = useCallback(
    async (feedId: string, page = 0, append = false) => {
      const numericId = Number(feedId);
      if (!Number.isFinite(numericId)) {
        setFeedEpisodes([]);
        setEpisodesError("Feed episodes unavailable");
        setEpisodesLoading(false);
        return;
      }

      try {
        if (append) {
          setEpisodesLoadingMore(true);
        } else {
          setEpisodesLoading(true);
        }
        setEpisodesError(null);
        const electron = getElectronAPI();
        const offset = page * EPISODES_PAGE_SIZE;
        const episodes = await electron.episodes.getByFeed(
          numericId,
          EPISODES_PAGE_SIZE,
          offset,
        );
        const normalizedEpisodes = Array.isArray(episodes) ? episodes : [];
        setFeedEpisodes((prev) =>
          append ? [...prev, ...normalizedEpisodes] : normalizedEpisodes,
        );
        setEpisodesPage(page);
        setHasMoreEpisodes(normalizedEpisodes.length === EPISODES_PAGE_SIZE);
      } catch (error) {
        setEpisodesError(
          error instanceof Error ? error.message : "Failed to load episodes",
        );
        setFeedEpisodes([]);
      } finally {
        setEpisodesLoading(false);
        setEpisodesLoadingMore(false);
      }
    },
    [EPISODES_PAGE_SIZE],
  );

  useEffect(() => {
    if (activeFeed) {
      setFeedEpisodes([]);
      setEpisodesError(null);
      loadEpisodesForFeed(activeFeed.id, 0, false);
    } else {
      resetEpisodesState();
    }
  }, [activeFeed, loadEpisodesForFeed, resetEpisodesState]);

  useEffect(() => {
    if (
      activeFeed &&
      !filteredFeeds.some((feed) => feed.id === activeFeed.id)
    ) {
      closeEpisodesDrawer();
    }
  }, [activeFeed, filteredFeeds, closeEpisodesDrawer]);

  useEffect(() => {
    if (!episodesDrawerOpen || !effectiveActiveFeed) {
      return;
    }

    const node = feedRefs.current[effectiveActiveFeed.id];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [episodesDrawerOpen, effectiveActiveFeed]);

  const handleAddFeed = async (url: string, category: string) => {
    await addFeed(url, category);
  };

  const handleDeleteFeed = async (feedId: string) => {
    if (confirm("Are you sure you want to delete this podcast subscription?")) {
      await removeFeed(feedId);
      if (activeFeed?.id === feedId) {
        closeEpisodesDrawer();
      }
    }
  };

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setAutoSwitchedToGrid(false);
  }, []);

  const handleFeedClick = (feed: Feed) => {
    if (viewMode === "compact") {
      setViewMode("grid");
      setAutoSwitchedToGrid(true);
    }
    selectFeed(feed);
    setActiveFeed(feed);
    setEpisodesDrawerOpen(true);
  };

  const handleRefreshFeed = async (feedId: string) => {
    await refreshFeed(feedId);
    if (activeFeed?.id === feedId) {
      loadEpisodesForFeed(feedId, 0, false);
    }
  };

  const handleLoadMoreEpisodes = () => {
    if (
      !activeFeed ||
      episodesLoading ||
      episodesLoadingMore ||
      !hasMoreEpisodes
    ) {
      return;
    }
    const nextPage = episodesPage + 1;
    loadEpisodesForFeed(activeFeed.id, nextPage, true);
  };

  const formatStats = () => {
    if (!feeds || feeds.length === 0) return "0 podcasts, 0 episodes";
    const totalEpisodes = feeds.reduce(
      (sum, feed) => sum + feed.episodeCount,
      0,
    );
    return `${feeds.length} podcast${feeds.length !== 1 ? "s" : ""}, ${totalEpisodes} episode${totalEpisodes !== 1 ? "s" : ""}`;
  };

  const activeFeedEpisodeCount = useMemo(() => {
    if (!effectiveActiveFeed) return 0;
    if (Array.isArray(feedEpisodes)) {
      return feedEpisodes.length;
    }
    return 0;
  }, [effectiveActiveFeed, feedEpisodes]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
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
                <svg
                  className={cn(
                    "w-4 h-4",
                    (isLoading || refreshingFeeds.size > 0) && "animate-spin",
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
            >
              Add Podcast
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Categories */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Categories:
              </span>
              <div className="flex flex-wrap gap-1">
                {availableCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border transition-colors",
                      selectedCategories.includes(category)
                        ? "bg-primary-100 text-primary-800 border-primary-300 dark:bg-primary-900 dark:text-primary-300 dark:border-primary-700"
                        : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600",
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
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="lastPubDate">Latest Release</option>
                  <option value="title">Title</option>
                  <option value="episodes">Episode Count</option>
                </select>
              </div>

              {/* View Mode */}
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded">
                <button
                  onClick={() => handleViewModeChange("grid")}
                  className={cn(
                    "p-1.5 rounded-l transition-colors",
                    viewMode === "grid"
                      ? "bg-primary-500 text-white"
                      : "text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200",
                  )}
                  aria-label="Standard grid view"
                >
                  <Grid className="h-4 w-4" strokeWidth={1.6} />
                </button>
                <button
                  onClick={() => handleViewModeChange("compact")}
                  className={cn(
                    "p-1.5 rounded-r transition-colors",
                    viewMode === "compact"
                      ? "bg-primary-500 text-white"
                      : "text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200",
                  )}
                  aria-label="Compact grid view"
                >
                  <Grid3x3 className="h-4 w-4" strokeWidth={1.6} />
                </button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
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
              <svg
                className="w-5 h-5 text-red-500 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-800 dark:text-red-300">{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="relative flex-1 overflow-y-auto p-6 min-h-0 scrollbar-auto-hide"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {isLoading && feeds.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                Loading podcasts...
              </p>
            </div>
          </div>
        ) : filteredFeeds.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {feeds.length === 0
                  ? "No podcasts yet"
                  : "No matching podcasts"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {feeds.length === 0
                  ? "Add your first podcast to get started"
                  : "Try adjusting your filters"}
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
          <div className="relative h-full">
            <div
              className={cn(
                "h-full",
                episodesDrawerOpen ? "lg:flex lg:gap-4" : "",
              )}
            >
              <div
                className={cn(
                  "h-full flex-1",
                  episodesDrawerOpen &&
                    "lg:flex-none lg:w-[18rem] lg:flex-shrink-0",
                )}
              >
                <div
                  className={cn(
                    "h-full scrollbar-auto-hide",
                    episodesDrawerOpen && "lg:overflow-y-auto lg:pr-2",
                  )}
                  style={
                    episodesDrawerOpen
                      ? { WebkitOverflowScrolling: "touch" }
                      : undefined
                  }
                >
                  <div className={cn(feedLayoutClasses)}>
                    {filteredFeeds.map((feed) => (
                      <div
                        key={feed.id}
                        className="w-full"
                        ref={(el) => {
                          feedRefs.current[feed.id] = el;
                        }}
                      >
                        <FeedCard
                          feed={feed}
                          viewMode={viewMode}
                          isRefreshing={refreshingFeeds.has(feed.id)}
                          onRefresh={() => handleRefreshFeed(feed.id)}
                          onDelete={() => handleDeleteFeed(feed.id)}
                          onClick={() => handleFeedClick(feed)}
                          isActive={
                            effectiveActiveFeed?.id === feed.id &&
                            episodesDrawerOpen
                          }
                          condensed={episodesDrawerOpen}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Overlay for small screens */}
              {episodesDrawerOpen && (
                <div
                  className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                  onClick={closeEpisodesDrawer}
                />
              )}

              {/* Episodes Drawer */}
              <div
                className={cn(
                  "pointer-events-none fixed inset-y-0 right-0 z-40 w-full transform border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 lg:static lg:flex-1 lg:h-full lg:border-none lg:bg-transparent lg:shadow-none",
                  episodesDrawerOpen
                    ? "translate-x-0 pointer-events-auto"
                    : "translate-x-full",
                  !episodesDrawerOpen && "lg:hidden",
                )}
                role="dialog"
                aria-modal="true"
                aria-hidden={!episodesDrawerOpen}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Episodes
                      </h3>
                      {effectiveActiveFeed && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {effectiveActiveFeed.title}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closeEpisodesDrawer}
                      icon={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      }
                      aria-label="Close episode list"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-auto-hide">
                    {!effectiveActiveFeed && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select a podcast to view its episodes.
                      </p>
                    )}

                    {effectiveActiveFeed && episodesLoading && (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                        <svg
                          className="h-8 w-8 animate-spin mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Loading episodes...
                      </div>
                    )}

                    {effectiveActiveFeed &&
                      episodesError &&
                      !episodesLoading && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                          {episodesError}
                        </div>
                      )}

                    {effectiveActiveFeed &&
                      !episodesLoading &&
                      !episodesError &&
                      feedEpisodes.length === 0 && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                          No episodes available yet.
                        </div>
                      )}

                    {effectiveActiveFeed &&
                      !episodesLoading &&
                      !episodesError &&
                      feedEpisodes.length > 0 && (
                        <div className="space-y-3">
                          {feedEpisodes.map((episode) => {
                            const isPlayed = episode.status === "played";
                            const summaryText = episode.descriptionHtml
                              ? episode.descriptionHtml
                                  .replace(/<[^>]*>/g, "")
                                  .slice(0, 240)
                              : "";
                            return (
                              <div
                                key={episode.id}
                                className="group flex gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-primary-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500 cursor-pointer"
                                role="button"
                                tabIndex={0}
                                onClick={() => openEpisodeDetail(episode)}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    openEpisodeDetail(episode);
                                  }
                                }}
                                aria-label={`Open details for ${episode.title}`}
                              >
                                <div className="flex w-16 flex-shrink-0 flex-col items-center gap-2">
                                  <div className="relative h-16 w-16 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
                                    <img
                                      src={
                                        episode.episodeImageUrl ||
                                        episode.feedCoverUrl ||
                                        "/default-cover.png"
                                      }
                                      alt={episode.title}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src =
                                          "/default-cover.png";
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <PlayPauseButton
                                      episode={episode}
                                      size="xs"
                                      variant="default"
                                      className="rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-primary-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                    />
                                    <QueueAddButton
                                      episode={episode}
                                      placement="next"
                                      size="xs"
                                      className="text-gray-400 hover:text-primary-600 dark:text-gray-300"
                                    />
                                    <QueueAddButton
                                      episode={episode}
                                      placement="end"
                                      size="xs"
                                      className="text-gray-400 hover:text-primary-600 dark:text-gray-300"
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-1 flex-col">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEpisodeDetail(episode);
                                    }}
                                    className={cn(
                                      "text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition dark:focus-visible:ring-offset-gray-800",
                                      isPlayed
                                        ? "text-gray-500 dark:text-gray-500"
                                        : "text-gray-900 hover:underline dark:text-gray-100",
                                    )}
                                  >
                                    {episode.title}
                                  </button>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>{formatDate(episode.pubDate)}</span>
                                    {episode.durationSec ? (
                                      <>
                                        <span>•</span>
                                        <span>
                                          {formatDuration(episode.durationSec)}
                                        </span>
                                      </>
                                    ) : null}
                                    {episode.status &&
                                      episode.status !== "new" && (
                                        <>
                                          <span>•</span>
                                          <span className="capitalize">
                                            {episode.status.replace("_", " ")}
                                          </span>
                                        </>
                                      )}
                                  </div>
                                  {summaryText && (
                                    <p className="mt-2 text-xs text-gray-500 line-clamp-3 dark:text-gray-400">
                                      {summaryText}
                                      {episode.descriptionHtml &&
                                      episode.descriptionHtml.replace(
                                        /<[^>]*>/g,
                                        "",
                                      ).length > summaryText.length
                                        ? "…"
                                        : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    {effectiveActiveFeed &&
                      hasMoreEpisodes &&
                      !episodesLoading &&
                      !episodesError && (
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleLoadMoreEpisodes}
                            disabled={episodesLoadingMore}
                          >
                            {episodesLoadingMore ? "Loading..." : "Load More"}
                          </Button>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
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
