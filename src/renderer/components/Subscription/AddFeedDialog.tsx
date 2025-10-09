import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getElectronAPI } from "../../utils/electron";
import { cn } from "../../utils/cn";
import Button from "../Button";
import { formatDuration } from "../../utils/formatters";
import type { Episode } from "../../store/episodesStore";
import PlayPauseButton from "../PlayPauseButton/PlayPauseButton";
import QueueAddButton from "../QueueAddButton";

type DialogMode = "idle" | "rssPreview" | "itunesResults" | "itunesPreview";

type PreviewFeed = {
  title: string;
  description?: string | null;
  image?: string | null;
  author?: string | null;
  url: string;
};

type PreviewEpisode = {
  id: string;
  title: string;
  duration?: number | null;
  image?: string | null;
  pubDate?: string | null;
};

type PreviewResponse = {
  success: boolean;
  feed?: PreviewFeed;
  episodes?: PreviewEpisode[];
  error?: string;
};

type ItunesResult = {
  trackId: number;
  trackName: string;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
};

interface AddFeedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, category: string) => Promise<void>;
  availableCategories: string[];
}

const isProbablyUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const formatEpisodeDuration = (duration?: number | null) => {
  if (!duration || Number.isNaN(duration) || duration <= 0) {
    return "Unknown";
  }
  return formatDuration(duration);
};

const stripDangerousTags = (html: string): string =>
  html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

const AddFeedDialog: React.FC<AddFeedDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  availableCategories,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<DialogMode>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewFeed, setPreviewFeed] = useState<PreviewFeed | null>(null);
  const [previewEpisodes, setPreviewEpisodes] = useState<PreviewEpisode[]>([]);
  const [itunesResults, setItunesResults] = useState<ItunesResult[]>([]);
  const [selectedItunes, setSelectedItunes] = useState<ItunesResult | null>(
    null,
  );
  const [selectedFeedUrl, setSelectedFeedUrl] = useState<string | null>(null);

  const [categoryInput, setCategoryInput] = useState("Default");
  const [isAdding, setIsAdding] = useState(false);

  const [persistedFeed, setPersistedFeed] = useState<{
    id: number;
    isSubscribed: boolean;
  } | null>(null);
  const [persistedEpisodes, setPersistedEpisodes] = useState<Episode[]>([]);
  const [isSyncingEpisodes, setIsSyncingEpisodes] = useState(false);

  const resetForm = () => {
    setInputValue("");
    setMode("idle");
    setIsLoading(false);
    setErrorMessage(null);
    setPreviewFeed(null);
    setPreviewEpisodes([]);
    setItunesResults([]);
    setSelectedItunes(null);
    setSelectedFeedUrl(null);
    setPersistedFeed(null);
    setPersistedEpisodes([]);
    setCategoryInput("Default");
    setIsAdding(false);
    setIsSyncingEpisodes(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const previewFeedFromUrl = useCallback(
    async (feedUrl: string, nextMode: DialogMode) => {
      const electron = getElectronAPI();
      if (!electron?.feeds?.preview) {
        setErrorMessage("Feed preview is not available in this build.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const result = (await electron.feeds.preview(
          feedUrl,
        )) as PreviewResponse;
        if (!result.success || !result.feed) {
          throw new Error(result.error || "Failed to preview feed");
        }

        setPreviewFeed(result.feed);
        setPreviewEpisodes(result.episodes ?? []);
        setSelectedFeedUrl(result.feed.url || feedUrl);
        setMode(nextMode);
      } catch (error) {
        console.error("Preview error:", error);
        setPreviewFeed(null);
        setPreviewEpisodes([]);
        setSelectedFeedUrl(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load feed preview",
        );
        setMode("idle");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const performItunesSearch = useCallback(async (term: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setItunesResults([]);
    try {
      const params = new URLSearchParams({
        term,
        media: "podcast",
        limit: "10",
        attribute: "titleTerm",
      });

      const response = await fetch(
        `https://itunes.apple.com/search?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error(`iTunes search failed (${response.status})`);
      }

      const payload = await response.json();
      const results: ItunesResult[] = Array.isArray(payload?.results)
        ? payload.results.filter((item: ItunesResult) => Boolean(item.feedUrl))
        : [];

      setItunesResults(results.slice(0, 10));
      setMode(results.length > 0 ? "itunesResults" : "idle");
      if (results.length === 0) {
        setErrorMessage("No podcasts found for that keyword.");
      }
    } catch (error) {
      console.error("iTunes search error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Search failed");
      setMode("idle");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = async () => {
    const value = inputValue.trim();
    if (!value) return;

    setPreviewFeed(null);
    setPreviewEpisodes([]);
    setSelectedFeedUrl(null);
    setSelectedItunes(null);
    setErrorMessage(null);

    if (isProbablyUrl(value)) {
      await previewFeedFromUrl(value, "rssPreview");
    } else {
      await performItunesSearch(value);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleItunesSelect = async (result: ItunesResult) => {
    if (!result.feedUrl) {
      setErrorMessage("Selected podcast does not provide an RSS feed.");
      return;
    }
    setSelectedItunes(result);
    await previewFeedFromUrl(result.feedUrl, "itunesPreview");
  };

  const handleBackToResults = () => {
    setPreviewFeed(null);
    setPreviewEpisodes([]);
    setSelectedFeedUrl(null);
    setMode("itunesResults");
  };

  const handleAdd = useCallback(async () => {
    const feedUrl =
      selectedFeedUrl ?? (isProbablyUrl(inputValue) ? inputValue.trim() : null);
    if (!feedUrl || isAdding) {
      if (!feedUrl) {
        setErrorMessage("Preview a podcast before adding it.");
      }
      return;
    }

    const finalCategory = categoryInput.trim() || "Default";

    setIsAdding(true);
    setErrorMessage(null);
    try {
      await onAdd(feedUrl, finalCategory);
      handleClose();
    } catch (error) {
      console.error("Add podcast error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to add podcast",
      );
    } finally {
      setIsAdding(false);
    }
  }, [
    categoryInput,
    handleClose,
    inputValue,
    onAdd,
    selectedFeedUrl,
    isAdding,
  ]);

  const handleAddFromIcon = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    handleAdd();
  };

  const isAddDisabled = useMemo(
    () => !selectedFeedUrl || isAdding || Boolean(persistedFeed?.isSubscribed),
    [selectedFeedUrl, isAdding, persistedFeed?.isSubscribed],
  );

  useEffect(() => {
    if (
      !selectedFeedUrl ||
      (mode !== "rssPreview" && mode !== "itunesPreview")
    ) {
      setPersistedFeed(null);
      setPersistedEpisodes([]);
      setIsSyncingEpisodes(false);
      return;
    }

    const electron = getElectronAPI();
    if (!electron?.feeds?.subscribe) {
      return;
    }

    let cancelled = false;
    setIsSyncingEpisodes(true);

    (async () => {
      try {
        const result = await electron.feeds.subscribe(
          selectedFeedUrl,
          undefined,
          {
            subscribe: false,
            limitEpisodes: 25,
            returnEpisodes: true,
          },
        );

        if (cancelled) {
          return;
        }

        if (result?.success && result.feed) {
          setPersistedFeed({
            id: result.feed.id,
            isSubscribed: Boolean(result.feed.isSubscribed),
          });
          setPersistedEpisodes(
            Array.isArray(result.episodes) ? result.episodes : [],
          );
        } else {
          setPersistedFeed(null);
          setPersistedEpisodes([]);
          if (result?.error) {
            setErrorMessage(result.error);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync preview episodes:", error);
          setPersistedFeed(null);
          setPersistedEpisodes([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load preview episodes",
          );
        }
      } finally {
        if (!cancelled) {
          setIsSyncingEpisodes(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFeedUrl, mode]);

  const episodeIndex = useMemo(() => {
    const map: Record<string, Episode> = {};
    persistedEpisodes.forEach((episode) => {
      if (episode.guid) {
        map[`guid:${episode.guid}`] = episode;
      }
      if (episode.audioUrl) {
        map[`audio:${episode.audioUrl}`] = episode;
      }
      if (episode.title) {
        map[`title:${episode.title.toLowerCase()}`] = episode;
      }
    });
    return map;
  }, [persistedEpisodes]);

  const findEpisodeForPreview = useCallback(
    (episode: PreviewEpisode): Episode | undefined => {
      if (!episode) return undefined;
      const candidates: string[] = [];
      if (episode.id) {
        candidates.push(`guid:${episode.id}`, `audio:${episode.id}`);
      }
      if (episode.title) {
        candidates.push(`title:${episode.title.toLowerCase()}`);
      }
      for (const key of candidates) {
        const match = episodeIndex[key];
        if (match) {
          return match;
        }
      }
      return undefined;
    },
    [episodeIndex],
  );

  const categorySuggestions = useMemo(() => {
    const base = ["Default", ...availableCategories];
    const seen = new Set<string>();
    return base
      .map((cat) => (cat || "").trim())
      .filter((cat) => {
        if (!cat) return false;
        const key = cat.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [availableCategories]);

  const renderEpisodeList = () => {
    if (!previewFeed) {
      return null;
    }

    const showActions = mode === "itunesPreview" || mode === "rssPreview";

    return (
      <div className="rounded-md border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {previewEpisodes.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
            No recent episodes available for preview.
          </div>
        ) : (
          <>
            {isSyncingEpisodes && (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                Syncing episode actions...
              </div>
            )}
            {previewEpisodes.map((episode) => {
              const artwork = episode.image || previewFeed.image || null;
              const durationLabel = formatEpisodeDuration(episode.duration);
              const matchedEpisode = findEpisodeForPreview(episode);

              const disabledButtonClasses =
                "flex h-8 w-8 items-center justify-center rounded-full text-gray-300 dark:text-gray-600 cursor-not-allowed";

              return (
                <div
                  key={episode.id}
                  className="flex items-center gap-3 p-3 text-left"
                >
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
                    {artwork ? (
                      <img
                        src={artwork}
                        alt="Episode artwork"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.6}
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path
                            d="M12 7v10M7 12h10"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                      {episode.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {durationLabel}
                    </div>
                  </div>
                  {showActions && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {matchedEpisode ? (
                        <PlayPauseButton
                          episode={matchedEpisode}
                          size="sm"
                          className="text-primary-600 hover:text-primary-500 focus:outline-none"
                          showTooltip
                        />
                      ) : (
                        <button
                          type="button"
                          disabled
                          className={disabledButtonClasses}
                          title="Episode not available yet"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      )}

                      {matchedEpisode ? (
                        <QueueAddButton
                          episode={matchedEpisode}
                          placement="next"
                          size="sm"
                          className="text-primary-600 hover:text-primary-500 focus:ring-primary-300"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled
                          className={disabledButtonClasses}
                          title="Episode not available yet"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              d="M5 12h14M12 5l7 7-7 7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}

                      {matchedEpisode ? (
                        <QueueAddButton
                          episode={matchedEpisode}
                          placement="end"
                          size="sm"
                          className="text-primary-600 hover:text-primary-500 focus:ring-primary-300"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled
                          className={disabledButtonClasses}
                          title="Episode not available yet"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              d="M12 5v14M5 12h14"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  const renderItunesResults = () => (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
      {itunesResults.map((result) => {
        const artwork =
          result.artworkUrl100 || result.artworkUrl600 || result.artworkUrl60;
        return (
          <button
            key={result.trackId}
            type="button"
            onClick={() => handleItunesSelect(result)}
            className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
              {artwork ? (
                <img
                  src={artwork}
                  alt={result.trackName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path
                      d="M12 7v10M7 12h10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                {result.trackName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                {result.artistName || result.collectionName || "Unknown artist"}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderPreviewHeader = () => {
    if (!previewFeed) return null;

    const description = previewFeed.description
      ? stripDangerousTags(previewFeed.description)
      : null;

    const addButtonClass = cn(
      "absolute bottom-1 right-1 rounded-md bg-black/45 p-1.5 text-white/80 shadow-sm backdrop-blur transition hover:bg-black/65",
      isAddDisabled && "cursor-not-allowed opacity-50",
    );

    const coverElement = (
      <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
        {previewFeed.image ? (
          <img
            src={previewFeed.image}
            alt={previewFeed.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
            </svg>
          </div>
        )}
        <button
          type="button"
          onClick={handleAddFromIcon}
          disabled={isAddDisabled}
          className={addButtonClass}
          aria-label="Add podcast"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              d="M12 5v14M5 12h14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );

    return (
      <div className="flex items-start gap-4">
        {mode === "itunesPreview" ? (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={handleBackToResults}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  d="M15 18l-6-6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </button>
            {coverElement}
          </div>
        ) : (
          coverElement
        )}

        <div className="flex-1 space-y-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {previewFeed.title}
              </h3>
              {persistedFeed?.isSubscribed && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Already subscribed
                </span>
              )}
            </div>
            {(previewFeed.author || selectedItunes?.artistName) && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {previewFeed.author || selectedItunes?.artistName}
              </p>
            )}
          </div>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {description}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderCategorySelection = () => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Category
      </label>
      <input
        type="text"
        value={categoryInput}
        onChange={(e) => setCategoryInput(e.target.value)}
        placeholder="Default"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      {categorySuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categorySuggestions.map((cat) => {
            const isActive =
              categoryInput.trim().toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryInput(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  isActive
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-gray-300 text-gray-600 hover:border-primary-400 hover:text-primary-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-primary-400 dark:hover:text-primary-300",
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add New Podcast
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="mt-4 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter an RSS feed URL or podcast keyword
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="https://example.com/feed.xml or podcast name"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
                <Button
                  variant="secondary"
                  onClick={handleSearch}
                  disabled={!inputValue.trim() || isLoading}
                >
                  {isLoading ? "Loading..." : "Search"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                URLs load directly from RSS. Keywords search Apple Podcasts.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            {mode === "itunesResults" && renderItunesResults()}

            {(mode === "rssPreview" || mode === "itunesPreview") && (
              <div className="space-y-4">
                {renderPreviewHeader()}
                {renderEpisodeList()}
              </div>
            )}

            {mode === "idle" &&
              !previewFeed &&
              !itunesResults.length &&
              !isLoading && (
                <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Start by entering an RSS feed URL or a podcast keyword.
                </div>
              )}

            {renderCategorySelection()}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {persistedFeed?.isSubscribed && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This feed is already in your library.
              </p>
            )}
            <div className="flex justify-end gap-3 sm:justify-start">
              <Button variant="ghost" onClick={handleClose} disabled={isAdding}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAdd}
                disabled={isAddDisabled}
              >
                {isAdding ? "Adding..." : "Add Podcast"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFeedDialog;
