import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import Button from "../components/Button";
import TranscriptList from "../components/Transcript/TranscriptList";
import { AITranscribeButton } from "../components/AITranscribeButton/AITranscribeButton";
import { SpeakerRecognizeToggle } from "../components/SpeakerRecognizeToggle/SpeakerRecognizeToggle";
import { ExportSRTButton } from "../components/ExportSRTButton/ExportSRTButton";
import PlayPauseButton from "../components/PlayPauseButton/PlayPauseButton";
import { useEpisodeDetailStore } from "../store/episodeDetailStore";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";
import { usePlayQueueStore } from "../store/playQueueStore";
import { formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";
import { convertToSRT, downloadSRT } from "../utils/srtConverter";

const stripHtml = (html: string | null | undefined) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const extractTags = (text: string, feedTitle?: string | null) => {
  if (!text) {
    return feedTitle ? [feedTitle] : [];
  }
  const words = text.toLowerCase().match(/[a-z0-9-]{4,}/g);
  if (!words) return feedTitle ? [feedTitle] : [];
  const stopWords = new Set([
    "that",
    "with",
    "have",
    "this",
    "from",
    "about",
    "your",
    "when",
    "will",
    "episode",
    "podcast",
  ]);
  const counts = new Map<string, number>();
  words.forEach((word) => {
    if (stopWords.has(word)) return;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word.replace(/^[a-z]/, (c) => c.toUpperCase()));
  if (feedTitle && !sorted.includes(feedTitle)) {
    sorted.unshift(feedTitle);
  }
  return sorted;
};

type Chapter = {
  id: string;
  title: string;
  start: number;
  summary: string;
};

const buildChapters = (duration: number, description: string) => {
  if (!Number.isFinite(duration) || duration <= 0) {
    return [
      {
        id: "c0",
        title: "Episode Start",
        start: 0,
        summary: description.slice(0, 80) || "Kick-off for this conversation.",
      },
    ];
  }

  const segmentCount = duration >= 3600 ? 5 : 4;
  const segmentLength = duration / segmentCount;
  const sentences = description.split(/(?<=[.!?])\s+/).filter(Boolean);

  return Array.from({ length: segmentCount }).map((_, index) => {
    const start = Math.round(index * segmentLength);
    const sentence =
      sentences[index] ?? description.slice(index * 80, (index + 1) * 80);
    return {
      id: `chapter-${index}`,
      title: `Chapter ${index + 1}`,
      start,
      summary: sentence?.trim() || "Deep dive segment.",
    } satisfies Chapter;
  });
};

const TRANSCRIPT_POLL_INTERVAL_MS = 3000;
const POLLABLE_TRANSCRIPT_STATUSES: Array<"pending" | "processing"> = [
  "pending",
  "processing",
];

const isPollableTranscriptStatus = (
  status: TranscriptTaskStatus,
): status is (typeof POLLABLE_TRANSCRIPT_STATUSES)[number] =>
  POLLABLE_TRANSCRIPT_STATUSES.includes(
    status as (typeof POLLABLE_TRANSCRIPT_STATUSES)[number],
  );

type TranscriptTaskStatus =
  | "none"
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "submitting";

type TabKey<T extends string> = T;
type CompactTabKey = "notes" | "transcript" | "summary" | "mindmap";
interface TabsProps<T extends string> {
  tabs: { key: TabKey<T>; label: React.ReactNode }[];
  value: TabKey<T>;
  onChange: (value: TabKey<T>) => void;
  children: React.ReactNode;
  onContentScroll?: React.UIEventHandler<HTMLDivElement>;
  contentRef?: React.Ref<HTMLDivElement>;
  contentClassName?: string;
}

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
  onContentScroll,
  contentRef,
  contentClassName,
}: TabsProps<T>) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-800">
        {tabs.map((tab) => {
          const active = tab.key === value;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={cn(
                "relative px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-current",
                active
                  ? "text-gray-900 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "absolute left-0 right-0 -bottom-px h-0.5 rounded-full transition-all",
                  active ? "bg-blue-500 dark:bg-blue-400" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
      <div
        ref={contentRef}
        onScroll={onContentScroll}
        className={cn("min-h-0 flex-1 overflow-y-auto pb-20", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}

interface MindmapProps {
  episodeTitle: string;
  tags: string[];
  chapters: Chapter[];
  onJump: (start: number) => void;
}

const Mindmap: React.FC<MindmapProps> = ({
  episodeTitle,
  tags,
  chapters,
  onJump,
}) => {
  const size = 500;
  const radiusInner = 140;
  const radiusOuter = 210;
  const cx = size / 2;
  const cy = size / 2;

  const chapterPoints = chapters.map((chapter, index) => {
    const angle = (index / chapters.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...chapter,
      x: cx + Math.cos(angle) * radiusInner,
      y: cy + Math.sin(angle) * radiusInner,
    };
  });

  const tagPoints = tags.map((tag, index) => {
    const angle =
      (index / Math.max(tags.length, 1)) * Math.PI * 2 + Math.PI / 8;
    return {
      id: `tag-${index}`,
      label: tag,
      x: cx + Math.cos(angle) * radiusOuter,
      y: cy + Math.sin(angle) * radiusOuter,
    };
  });

  return (
    <div className="flex justify-center p-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-[480px] w-full max-w-[540px] text-gray-700 dark:text-gray-200"
        role="img"
        aria-label="Episode mindmap"
      >
        {chapterPoints.map((point) => (
          <line
            key={`edge-${point.id}`}
            x1={cx}
            y1={cy}
            x2={point.x}
            y2={point.y}
            stroke="currentColor"
            className="opacity-30"
            strokeWidth={1}
          />
        ))}
        {tagPoints.map((point) => (
          <line
            key={`edge-${point.id}`}
            x1={cx}
            y1={cy}
            x2={point.x}
            y2={point.y}
            stroke="currentColor"
            className="opacity-10"
            strokeWidth={1}
          />
        ))}

        <g transform={`translate(${cx - 110}, ${cy - 24})`}>
          <rect
            width={220}
            height={48}
            rx={24}
            className="fill-blue-600 dark:fill-blue-500"
          />
          <text
            x={110}
            y={30}
            className="text-[12px] font-semibold tracking-wide text-white"
            textAnchor="middle"
          >
            {episodeTitle}
          </text>
        </g>

        {chapterPoints.map((point) => (
          <g
            key={point.id}
            transform={`translate(${point.x - 100}, ${point.y - 18})`}
          >
            <rect
              width={200}
              height={36}
              rx={18}
              className="fill-white stroke-current text-gray-900 transition hover:stroke-blue-500 dark:fill-gray-900 dark:text-gray-100"
              onClick={() => onJump(point.start)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onJump(point.start);
                }
              }}
            />
            <text
              x={100}
              y={24}
              textAnchor="middle"
              className="text-[12px] font-medium"
            >
              {point.title}
            </text>
          </g>
        ))}

        {tagPoints.map((point) => (
          <g
            key={point.id}
            transform={`translate(${point.x - 70}, ${point.y - 14})`}
          >
            <rect
              width={140}
              height={28}
              rx={14}
              className="fill-white stroke-current opacity-60 dark:fill-gray-900"
            />
            <text
              x={70}
              y={18}
              textAnchor="middle"
              className="text-[11px] font-medium"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const EpisodeDetailPage: React.FC = () => {
  const episode = useEpisodeDetailStore((state) => state.selectedEpisode);
  const clearEpisode = useEpisodeDetailStore((state) => state.clearEpisode);
  const previousView = useNavigationStore((state) => state.previousView);
  const goBack = useNavigationStore((state) => state.goBack);
  const setCurrentView = useNavigationStore((state) => state.setCurrentView);

  // Transcript task state
  const [transcriptTaskStatus, setTranscriptTaskStatus] =
    useState<TranscriptTaskStatus>("none");
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptRefreshTrigger, setTranscriptRefreshTrigger] = useState(0);

  // Speaker recognition state
  const [speakerRecognizeEnabled, setSpeakerRecognizeEnabled] = useState(false);
  const [speakerCount, setSpeakerCount] = useState(2);

  // SRT export state
  const [isExportingSRT, setIsExportingSRT] = useState(false);

  // AI summary state
  const [aiSummary, setAiSummary] = useState<{
    summary: string;
    tags: string[];
    chapters: Array<{ start: number; end: number; summary: string }>;
    totalChapters?: number;
    detectedTime?: string;
  } | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiChaptersLoading, setAiChaptersLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const {
    currentEpisode,
    isPlaying,
    isLoading,
    position,
    duration,
    loadAndPlay,
    playPause,
    seek,
  } = usePlayerStore((state) => ({
    currentEpisode: state.currentEpisode,
    isPlaying: state.isPlaying,
    isLoading: state.isLoading,
    position: state.position,
    duration: state.duration,
    loadAndPlay: state.loadAndPlay,
    playPause: state.playPause,
    seek: state.seek,
  }));

  const isCurrentEpisode = episode && currentEpisode?.id === episode.id;
  const playbackDuration = isCurrentEpisode
    ? duration
    : (episode?.durationSec ?? 0);
  const playbackPosition = isCurrentEpisode
    ? position
    : (episode?.lastPositionSec ?? 0);

  const [leftTab, setLeftTab] = useState<"notes" | "transcript">("notes");
  const [rightTab, setRightTab] = useState<"summary" | "mindmap">("summary");
  const [compactTab, setCompactTab] = useState<CompactTabKey>("notes");
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const leftPanelScrollRef = useRef<HTMLDivElement | null>(null);
  const didSkipStrictCleanup = useRef(false);

  useEffect(() => {
    return () => {
      if (!didSkipStrictCleanup.current) {
        didSkipStrictCleanup.current = true;
        return;
      }
      clearEpisode();
    };
  }, [clearEpisode]);

  // Check transcript task status when episode changes
  useEffect(() => {
    if (!episode) {
      setTranscriptTaskStatus("none");
      setTranscriptError(null);
      return;
    }

    let cancelled = false;

    const applyStatus = (
      status: TranscriptTaskStatus,
      errorMessage?: string | null,
    ) => {
      if (cancelled) {
        return;
      }
      setTranscriptTaskStatus((previous) =>
        previous === status ? previous : status,
      );
      setTranscriptError(errorMessage ?? null);
    };

    const checkTaskStatus = async () => {
      try {
        console.log(
          "[EpisodeDetail] Checking transcript task status for episode:",
          episode.id,
        );
        const result = await window.electronAPI.transcript.getTaskStatus(
          episode.id,
        );

        if (cancelled) {
          return;
        }

        if (result.success && result.hasTask) {
          console.log("[EpisodeDetail] Task status:", result.status);
          const status = (result.status ?? "none") as TranscriptTaskStatus;
          const errorMessage =
            status === "failed" ? result.error || "Transcription failed" : null;
          applyStatus(status, errorMessage);
        } else if (result.success) {
          applyStatus("none", null);
        } else {
          applyStatus(
            "none",
            result.error || "Failed to check transcription status",
          );
        }
      } catch (error) {
        console.error("[EpisodeDetail] Failed to check task status:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to check transcription status";
        applyStatus("none", message);
      }
    };

    void checkTaskStatus();

    return () => {
      cancelled = true;
    };
  }, [episode?.id]);

  // Poll transcript task status while pending or processing
  useEffect(() => {
    if (!episode) {
      return;
    }

    if (!isPollableTranscriptStatus(transcriptTaskStatus)) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const runPoll = async () => {
      try {
        const result = await window.electronAPI.transcript.getTaskStatus(
          episode.id,
        );

        if (cancelled) {
          return;
        }

        if (result.success && result.hasTask) {
          const status = (result.status ?? "none") as TranscriptTaskStatus;

          setTranscriptTaskStatus((previous) => {
            // Trigger transcript refresh when status changes to succeeded
            if (previous !== "succeeded" && status === "succeeded") {
              setTranscriptRefreshTrigger((prev) => prev + 1);
            }
            return previous === status ? previous : status;
          });

          if (status === "failed") {
            setTranscriptError(result.error || "Transcription failed");
          } else {
            setTranscriptError(null);
          }

          if (isPollableTranscriptStatus(status)) {
            timeoutId = setTimeout(runPoll, TRANSCRIPT_POLL_INTERVAL_MS);
          }
        } else if (result.success) {
          setTranscriptTaskStatus((previous) =>
            previous === "none" ? previous : "none",
          );
          setTranscriptError(null);
        } else {
          setTranscriptError(
            result.error || "Failed to check transcription status",
          );
          timeoutId = setTimeout(runPoll, TRANSCRIPT_POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Failed to check transcription status";
        setTranscriptError(message);
        timeoutId = setTimeout(runPoll, TRANSCRIPT_POLL_INTERVAL_MS);
      }
    };

    runPoll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [episode?.id, transcriptTaskStatus]);

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === "undefined") {
        return;
      }
      setIsCompactLayout(window.innerWidth < 1024);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (!isCompactLayout) {
      return;
    }
    setCompactTab((prev) => {
      if (prev === "summary" || prev === "mindmap") {
        return rightTab;
      }
      return leftTab;
    });
  }, [isCompactLayout, leftTab, rightTab]);

  useEffect(() => {
    if (isCompactLayout) {
      return;
    }
    if (compactTab === "notes" || compactTab === "transcript") {
      setLeftTab(compactTab);
    } else {
      setRightTab(compactTab);
    }
  }, [isCompactLayout, compactTab]);

  useEffect(() => {
    setIsHeaderCompact(false);
    if (leftPanelScrollRef.current) {
      leftPanelScrollRef.current.scrollTop = 0;
    }
    // Load AI summary when episode changes
    loadAISummary();
  }, [episode?.id]);

  const loadAISummary = async () => {
    if (!episode) {
      setAiSummary(null);
      setAiError(null);
      return;
    }

    try {
      setAiError(null);
      const result = await window.electronAPI.ai.getSummary(episode.id);

      if (result.success && result.data) {
        setAiSummary(result.data);
      } else {
        setAiSummary(null);
      }
    } catch (error) {
      console.error("[EpisodeDetail] Failed to load AI summary:", error);
      setAiError(
        error instanceof Error ? error.message : "Failed to load AI summary",
      );
    }
  };

  useEffect(() => {
    if (!isCompactLayout) {
      setIsHeaderCompact(false);
    }
  }, [isCompactLayout]);

  useEffect(() => {
    if (
      isCompactLayout &&
      !(compactTab === "notes" || compactTab === "transcript")
    ) {
      setIsHeaderCompact(false);
    }
  }, [compactTab, isCompactLayout]);

  useEffect(() => {
    if (!leftPanelScrollRef.current) {
      return;
    }
    if (isCompactLayout) {
      if (compactTab === "notes" || compactTab === "transcript") {
        leftPanelScrollRef.current.scrollTop = 0;
      }
      return;
    }
    leftPanelScrollRef.current.scrollTop = 0;
  }, [leftTab, compactTab, isCompactLayout]);

  const descriptionText = useMemo(
    () => stripHtml(episode?.descriptionHtml),
    [episode?.descriptionHtml],
  );
  const tags = useMemo(
    () => extractTags(descriptionText, episode?.feedTitle),
    [descriptionText, episode?.feedTitle],
  );
  const chapters = useMemo(
    () =>
      buildChapters(
        playbackDuration || episode?.durationSec || 0,
        descriptionText,
      ),
    [playbackDuration, episode?.durationSec, descriptionText],
  );

  if (!episode) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 px-6 text-center dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          No episode selected
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Choose an episode from any list to view its details here.
        </p>
        <Button
          className="mt-6"
          variant="primary"
          onClick={() => setCurrentView("episodes")}
        >
          Browse Episodes
        </Button>
      </div>
    );
  }

  const publishInfo = [
    episode.feedTitle,
    episode.pubDate && formatDate(episode.pubDate),
  ]
    .filter(Boolean)
    .join(" • ");

  const handlePlayToggle = async () => {
    if (!episode) return;
    if (isCurrentEpisode) {
      playPause();
    } else {
      // Move episode to queue start before playing
      await usePlayQueueStore.getState().moveToQueueStart(episode);
      loadAndPlay(episode);
    }
  };

  const handleAITranscribe = async () => {
    if (!episode) return;

    console.log("[EpisodeDetail] AI transcribe button clicked");
    console.log("[EpisodeDetail] Episode:", {
      id: episode.id,
      title: episode.title,
      audioUrl: episode.audioUrl,
    });
    console.log("[EpisodeDetail] Speaker recognition:", {
      enabled: speakerRecognizeEnabled,
      count: speakerCount,
    });

    setTranscriptTaskStatus("submitting");
    setTranscriptError(null);

    try {
      console.log("[EpisodeDetail] Submitting transcription task...");
      const options = {
        spkEnable: speakerRecognizeEnabled,
        spkNumberPredict: speakerRecognizeEnabled ? speakerCount : undefined,
      };
      const result = await window.electronAPI.transcript.submit(
        episode.id,
        options,
      );

      console.log("[EpisodeDetail] Submit result:", result);

      if (result.success) {
        console.log(
          "[EpisodeDetail] Task submitted successfully, taskId:",
          result.taskId,
        );
        setTranscriptTaskStatus("processing");
      } else {
        console.error("[EpisodeDetail] Failed to submit task:", result.error);
        setTranscriptError(
          result.error || "Failed to submit transcription task",
        );
        setTranscriptTaskStatus("failed");
      }
    } catch (error) {
      console.error("[EpisodeDetail] Exception when submitting task:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setTranscriptError(errorMessage);
      setTranscriptTaskStatus("failed");
    }
  };

  const handleGenerateSummary = async () => {
    if (!episode) return;

    try {
      setAiSummaryLoading(true);
      setAiError(null);
      const result = await window.electronAPI.ai.generateSummary(episode.id);

      if (result.success) {
        await loadAISummary();
      } else {
        setAiError(result.error || "Failed to generate summary");
      }
    } catch (error) {
      console.error("[EpisodeDetail] Failed to generate summary:", error);
      setAiError(
        error instanceof Error ? error.message : "Failed to generate summary",
      );
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleGenerateChapters = async () => {
    if (!episode) return;

    try {
      setAiChaptersLoading(true);
      setAiError(null);
      const result = await window.electronAPI.ai.generateChapters(episode.id);

      if (result.success) {
        await loadAISummary();
      } else {
        setAiError(result.error || "Failed to generate chapters");
      }
    } catch (error) {
      console.error("[EpisodeDetail] Failed to generate chapters:", error);
      setAiError(
        error instanceof Error ? error.message : "Failed to generate chapters",
      );
    } finally {
      setAiChaptersLoading(false);
    }
  };

  const handleJump = (start: number) => {
    if (!episode) return;
    if (isCurrentEpisode) {
      seek(start);
    } else {
      loadAndPlay(episode);
      setTimeout(() => {
        seek(start);
      }, 400);
    }
  };

  const handleExportSRT = async () => {
    if (!episode) return;

    try {
      setIsExportingSRT(true);
      console.log("[EpisodeDetail] Exporting SRT for episode:", episode.id);

      // Fetch transcript data
      const result = await window.electronAPI.transcript.getByEpisode(episode.id);

      if (!result.success || !result.transcript) {
        console.error("[EpisodeDetail] Failed to fetch transcript:", result.error);
        alert(result.error || "Failed to fetch transcript data");
        return;
      }

      const { transcript } = result;

      if (!transcript.subtitles || transcript.subtitles.length === 0) {
        alert("No transcript segments available to export");
        return;
      }

      // Convert to SRT format
      const srtContent = convertToSRT(transcript.subtitles);

      // Generate filename from episode title and feed title
      const sanitizeFilename = (str: string) =>
        str
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // Remove invalid filename chars
          .replace(/\s+/g, "_") // Replace spaces with underscores
          .substring(0, 100); // Limit length

      const feedPart = episode.feedTitle
        ? `${sanitizeFilename(episode.feedTitle)}_`
        : "";
      const titlePart = sanitizeFilename(episode.title);
      const filename = `${feedPart}${titlePart}.srt`;

      // Download the file
      downloadSRT(srtContent, filename);

      console.log("[EpisodeDetail] SRT exported successfully:", filename);
    } catch (error) {
      console.error("[EpisodeDetail] Error exporting SRT:", error);
      alert(
        error instanceof Error
          ? error.message
          : "An error occurred while exporting SRT"
      );
    } finally {
      setIsExportingSRT(false);
    }
  };

  const handleLeftTabChange = (value: "notes" | "transcript") => {
    setLeftTab(value);
    if (isCompactLayout) {
      setCompactTab(value);
    }
  };

  const handleRightTabChange = (value: "summary" | "mindmap") => {
    setRightTab(value);
    if (isCompactLayout) {
      setCompactTab(value);
    }
  };

  const handleCompactTabChange = (value: CompactTabKey) => {
    setCompactTab(value);
    if (value === "notes" || value === "transcript") {
      setLeftTab(value);
    } else {
      setRightTab(value);
    }
  };

  const handleScrollableContentScroll = (
    event: React.UIEvent<HTMLDivElement>,
  ) => {
    const scrollContext = isCompactLayout ? compactTab : leftTab;
    if (!(scrollContext === "notes" || scrollContext === "transcript")) {
      setIsHeaderCompact(false);
      return;
    }
    const shouldCompact = event.currentTarget.scrollTop > 80;
    setIsHeaderCompact(shouldCompact);
  };

  const handleBack = () => {
    clearEpisode();
    if (previousView) {
      goBack();
    } else {
      setCurrentView("episodes");
    }
  };

  const notesPanel = episode.descriptionHtml ? (
    <div
      className="prose prose-sm max-w-none select-text px-6 py-6 pb-24 text-gray-700 dark:prose-invert dark:text-gray-300"
      dangerouslySetInnerHTML={{
        __html: episode.descriptionHtml,
      }}
    />
  ) : (
    <div className="prose prose-sm max-w-none select-text px-6 py-6 pb-24 text-gray-700 dark:prose-invert dark:text-gray-300">
      <p>No show notes were provided for this episode.</p>
    </div>
  );

  const transcriptPanel = episode ? (
    <TranscriptList
      episodeId={episode.id}
      scrollContainerRef={leftPanelScrollRef}
      refreshTrigger={transcriptRefreshTrigger}
      onJumpToTime={(timeMs) => {
        const timeSec = timeMs / 1000;
        if (isCurrentEpisode) {
          seek(timeSec);
        } else {
          loadAndPlay(episode);
          setTimeout(() => {
            seek(timeSec);
          }, 400);
        }
      }}
    />
  ) : null;

  const summaryPanel = (
    <div className="space-y-4 px-4 py-6">
      {aiError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
        </div>
      )}

      {!aiSummary && !aiSummaryLoading && !aiChaptersLoading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            No AI summary available yet
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={transcriptTaskStatus !== "succeeded"}
          >
            Generate Summary
          </Button>
          {transcriptTaskStatus !== "succeeded" && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Transcript required first
            </p>
          )}
        </div>
      )}

      {aiSummaryLoading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generating AI summary...
          </p>
        </div>
      )}

      {aiSummary && (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Episode Summary
              </h3>
              <Button
                aria-label="Regenerate summary"
                variant="ghost"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={aiSummaryLoading}
                title="Regenerate summary"
              >
                <RefreshCcw
                  className={cn("h-4 w-4", aiSummaryLoading && "animate-spin")}
                />
              </Button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap select-text">
              {aiSummary.summary}
            </p>
          </section>

          {aiSummary.tags && aiSummary.tags.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Tags
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {aiSummary.tags.map((tag, index) => (
                  <span
                    key={`ai-tag-${index}`}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {aiSummary.chapters && aiSummary.chapters.length > 0 ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  AI Chapters
                </h3>
                <Button
                  aria-label="Regenerate chapters"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateChapters}
                  disabled={aiChaptersLoading}
                  title="Regenerate chapters"
                >
                  <RefreshCcw
                    className={cn(
                      "h-4 w-4",
                      aiChaptersLoading && "animate-spin",
                    )}
                  />
                </Button>
              </div>
              <ol className="space-y-3 text-sm">
                {aiSummary.chapters.map((chapter, index) => {
                  const startMin = Math.floor(chapter.start / 60000);
                  const startSec = Math.floor((chapter.start % 60000) / 1000);
                  const timeStr = `${startMin}:${startSec.toString().padStart(2, "0")}`;

                  return (
                    <li
                      key={`ai-chapter-${index}`}
                      className="flex items-start gap-3"
                    >
                      <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                        {index + 1}.
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleJump(chapter.start / 1000)}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                          >
                            {timeStr}
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 select-text">
                          {chapter.summary}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  AI Chapters
                </h3>
              </div>
              <div className="mt-3 text-center">
                {aiChaptersLoading ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Generating AI chapters...
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      No chapters generated yet
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleGenerateChapters}
                      disabled={aiChaptersLoading}
                    >
                      Generate Chapters
                    </Button>
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );

  const mindmapPanel = (
    <Mindmap
      episodeTitle={episode.title}
      tags={tags}
      chapters={chapters}
      onJump={handleJump}
    />
  );

  const shouldShowCover = !isCompactLayout;
  const coverSizeClass = shouldShowCover
    ? isHeaderCompact
      ? "h-16 w-16"
      : "h-40 w-40"
    : "";
  const titleSizeClass = isCompactLayout
    ? "text-lg"
    : isHeaderCompact
      ? "text-xl lg:text-2xl"
      : "text-2xl lg:text-3xl";
  const publishInfoClass = isHeaderCompact ? "mt-1 text-xs" : "mt-2 text-sm";
  const actionButtonSizeClass =
    isHeaderCompact || isCompactLayout
      ? "px-3 py-1.5 text-xs"
      : "px-4 py-2 text-sm";

  const headerSection = (
    <div
      className={cn(
        "border-b border-gray-200 px-6 dark:border-gray-800",
        isHeaderCompact ? "py-3" : "py-5",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 lg:flex-row",
          isCompactLayout ? "lg:flex-col" : undefined,
          shouldShowCover && isHeaderCompact && !isCompactLayout
            ? "lg:items-center"
            : "lg:items-start",
        )}
      >
        {shouldShowCover && (
          <div
            className={cn(
              "mx-auto flex-shrink-0 overflow-hidden rounded-xl bg-gray-200 shadow-inner transition-all duration-200 dark:bg-gray-700 lg:mx-0",
              coverSizeClass,
            )}
          >
            <img
              src={
                episode.episodeImageUrl ||
                episode.feedCoverUrl ||
                "/default-cover.png"
              }
              alt={episode.title}
              className="h-full w-full object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).src = "/default-cover.png";
              }}
            />
          </div>
        )}
        <div className="flex-1">
          {/* Title and Metadata */}
          <div
            className={cn("flex flex-col", isCompactLayout ? "gap-1" : "gap-2")}
          >
            <h1
              className={cn(
                "mt-1 font-bold leading-tight text-gray-900 transition-all duration-200 dark:text-gray-100",
                titleSizeClass,
              )}
            >
              {episode.title}
            </h1>
            {publishInfo && (
              <p
                className={cn(
                  "text-gray-600 dark:text-gray-400",
                  publishInfoClass,
                )}
              >
                {publishInfo}
              </p>
            )}
          </div>

          {/* Action Buttons - Below publishInfo */}
          <div
            className={cn(
              "mt-4 flex shrink-0 flex-wrap items-center gap-2",
              isHeaderCompact && !isCompactLayout
                ? "lg:justify-start"
                : undefined,
            )}
          >
            <PlayPauseButton
              episode={episode}
              size="md"
              variant="default"
              skipAutoQueue={true}
            />

            <AITranscribeButton
              status={
                transcriptTaskStatus === "none"
                  ? "idle"
                  : transcriptTaskStatus === "pending"
                    ? "processing"
                    : transcriptTaskStatus
              }
              onTranscribe={handleAITranscribe}
              size="sm"
            />

            <SpeakerRecognizeToggle
              enabled={speakerRecognizeEnabled}
              speakerCount={speakerCount}
              onToggle={setSpeakerRecognizeEnabled}
              onCountChange={setSpeakerCount}
              size="sm"
              disabled={transcriptTaskStatus === "succeeded"}
            />

            <ExportSRTButton
              onExport={handleExportSRT}
              disabled={transcriptTaskStatus !== "succeeded"}
              loading={isExportingSRT}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-rows-[auto_1fr]">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <span className="mr-2 inline-flex items-center">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 4.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l3.293 3.293a1 1 0 11-1.414 1.414l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              Back
            </Button>
            <div className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {/* <span>Detail View</span> */}
              {/* <span>•</span> */}
              <span>{episode.feedTitle ?? "Podcast"}</span>
            </div>
          </div>

          <div className="grid h-full min-h-0 grid-cols-1 divide-y divide-gray-200 dark:divide-gray-800 lg:grid-cols-[1.6fr_1fr] lg:divide-x lg:divide-y-0">
            {isCompactLayout ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="bg-white dark:bg-gray-900">{headerSection}</div>
                <div
                  className={cn(
                    "flex-1 min-h-0",
                    compactTab === "summary" || compactTab === "mindmap"
                      ? "bg-gray-50 dark:bg-gray-950"
                      : "bg-white dark:bg-gray-900",
                  )}
                >
                  <Tabs
                    tabs={[
                      { key: "notes", label: "Show Notes" },
                      { key: "transcript", label: "Transcript" },
                      { key: "summary", label: "AI Summary" },
                    ]}
                    value={compactTab}
                    onChange={handleCompactTabChange}
                    onContentScroll={handleScrollableContentScroll}
                    contentRef={leftPanelScrollRef}
                    contentClassName="pb-24"
                  >
                    {compactTab === "notes"
                      ? notesPanel
                      : compactTab === "transcript"
                        ? transcriptPanel
                        : summaryPanel}
                  </Tabs>
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-full min-h-0 min-w-0 flex-col bg-white dark:bg-gray-900">
                  {headerSection}
                  <div className="flex-1 min-h-0">
                    <Tabs
                      tabs={[
                        { key: "notes", label: "Show Notes" },
                        { key: "transcript", label: "Transcript" },
                      ]}
                      value={leftTab}
                      onChange={handleLeftTabChange}
                      onContentScroll={handleScrollableContentScroll}
                      contentRef={leftPanelScrollRef}
                      contentClassName="pb-24"
                    >
                      {leftTab === "notes" ? notesPanel : transcriptPanel}
                    </Tabs>
                  </div>
                </div>

                <div className="flex h-full min-h-0 min-w-0 flex-col bg-gray-50 dark:bg-gray-950">
                  <div className="flex-1 min-h-0">
                    <Tabs
                      tabs={[
                        { key: "summary", label: "AI Summary" },
                      ]}
                      value={rightTab}
                      onChange={handleRightTabChange}
                      contentClassName="pb-24"
                    >
                      {summaryPanel}
                    </Tabs>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodeDetailPage;
