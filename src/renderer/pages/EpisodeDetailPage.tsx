import React, { useEffect, useMemo, useRef, useState } from "react";
import QueueAddButton from "../components/QueueAddButton";
import Button from "../components/Button";
import { useEpisodeDetailStore } from "../store/episodeDetailStore";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";
import { formatDate, formatDuration } from "../utils/formatters";
import { cn } from "../utils/cn";

const pad = (value: number) => String(value).padStart(2, "0");
const fmtTime = (seconds: number | null | undefined) => {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
};

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
  const words = text.toLowerCase().match(/[a-z0-9\-]{4,}/g);
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

type TabKey<T extends string> = T;
interface TabsProps<T extends string> {
  tabs: { key: TabKey<T>; label: React.ReactNode }[];
  value: TabKey<T>;
  onChange: (value: TabKey<T>) => void;
  children: React.ReactNode;
}

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
}: TabsProps<T>) {
  return (
    <div className="flex h-full flex-col">
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
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
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

  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [leftTab, setLeftTab] = useState<"notes" | "transcript">("notes");
  const [rightTab, setRightTab] = useState<"summary" | "mindmap">("summary");
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

  useEffect(() => {
    setScrubValue(null);
  }, [isCurrentEpisode]);

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

  const displayPosition = scrubValue ?? playbackPosition;

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

  const handlePlayToggle = () => {
    if (!episode) return;
    if (isCurrentEpisode) {
      playPause();
    } else {
      loadAndPlay(episode);
    }
  };

  const handleScrubCommit = () => {
    if (scrubValue === null || !episode) return;
    if (isCurrentEpisode) {
      seek(scrubValue);
    } else {
      loadAndPlay(episode);
      setTimeout(() => {
        seek(scrubValue);
      }, 400);
    }
    setScrubValue(null);
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

  const handleBack = () => {
    clearEpisode();
    if (previousView) {
      goBack();
    } else {
      setCurrentView("episodes");
    }
  };

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
              <span>Detail View</span>
              <span>•</span>
              <span>{episode.feedTitle ?? "Podcast"}</span>
            </div>
          </div>

          <div className="grid h-full grid-cols-1 divide-y lg:grid-cols-[1.6fr_1fr] lg:divide-x lg:divide-y-0">
            <div className="flex min-w-0 flex-col">
              <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="mx-auto h-40 w-40 flex-shrink-0 overflow-hidden rounded-xl bg-gray-200 shadow-inner dark:bg-gray-700 lg:mx-0">
                    <img
                      src={
                        episode.episodeImageUrl ||
                        episode.feedCoverUrl ||
                        "/default-cover.png"
                      }
                      alt={episode.title}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        (event.target as HTMLImageElement).src =
                          "/default-cover.png";
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Episode Detail
                        </p>
                        <h1 className="mt-1 text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 lg:text-3xl">
                          {episode.title}
                        </h1>
                        {publishInfo && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {publishInfo}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePlayToggle}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium transition",
                            "hover:border-blue-500 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                            isCurrentEpisode && isPlaying
                              ? "bg-blue-600 text-white hover:text-white"
                              : "bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100",
                          )}
                          aria-label={
                            isCurrentEpisode && isPlaying
                              ? "Pause episode"
                              : "Play episode"
                          }
                        >
                          {isCurrentEpisode && isPlaying
                            ? "Pause"
                            : isLoading
                              ? "Loading…"
                              : "Play"}
                        </button>
                      </div>
                    </div>

                    {/* <div className="mt-4 flex flex-col gap-3"> */}
                    {/*   <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400"> */}
                    {/*     <span className="tabular-nums w-14 text-right"> */}
                    {/*       {fmtTime(displayPosition)} */}
                    {/*     </span> */}
                    {/*     <input */}
                    {/*       type="range" */}
                    {/*       min={0} */}
                    {/*       max={playbackDuration || 0} */}
                    {/*       step={1} */}
                    {/*       value={Math.min( */}
                    {/*         displayPosition, */}
                    {/*         playbackDuration || 0, */}
                    {/*       )} */}
                    {/*       onChange={(event) => */}
                    {/*         setScrubValue(Number(event.target.value)) */}
                    {/*       } */}
                    {/*       onMouseUp={handleScrubCommit} */}
                    {/*       onTouchEnd={handleScrubCommit} */}
                    {/*       onKeyUp={(event) => { */}
                    {/*         if (event.key === "Enter" || event.key === " ") { */}
                    {/*           handleScrubCommit(); */}
                    {/*         } */}
                    {/*       }} */}
                    {/*       className="flex-1 accent-blue-500" */}
                    {/*       disabled={!playbackDuration} */}
                    {/*       aria-label="Episode progress" */}
                    {/*     /> */}
                    {/*     <span className="tabular-nums w-14"> */}
                    {/*       {fmtTime(playbackDuration)} */}
                    {/*     </span> */}
                    {/*   </div> */}
                    {/* <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400"> */}
                    {/*   <span>Last played position: {fmtTime(episode.lastPositionSec)}</span> */}
                    {/*   <span>•</span> */}
                    {/*   <span>Duration: {fmtTime(episode.durationSec)}</span> */}
                    {/*   {descriptionText && ( */}
                    {/*     <> */}
                    {/*       <span>•</span> */}
                    {/*       <span>{Math.max(descriptionText.length, 1)} characters of notes</span> */}
                    {/*     </> */}
                    {/*   )} */}
                    {/* </div> */}
                    {/* </div> */}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <Tabs
                  tabs={[
                    { key: "notes", label: "Show Notes" },
                    { key: "transcript", label: "Transcript" },
                  ]}
                  value={leftTab}
                  onChange={setLeftTab}
                >
                  {leftTab === "notes" ? (
                    <div className="prose prose-sm max-w-none px-6 py-6 text-gray-700 dark:prose-invert dark:text-gray-300">
                      {episode.descriptionHtml ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: episode.descriptionHtml,
                          }}
                        />
                      ) : (
                        <p>No show notes were provided for this episode.</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                      <svg
                        className="h-12 w-12 text-gray-300 dark:text-gray-600"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v13a1 1 0 01-1.447.894L12 15.618l-5.553 3.276A1 1 0 015 18V5z" />
                      </svg>
                      <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Transcript coming soon
                      </h3>
                      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                        We’re working on generating a transcript for this
                        episode. Check back after the AI processing is complete.
                      </p>
                    </div>
                  )}
                </Tabs>
              </div>
            </div>

            <div className="flex min-w-0 flex-col bg-gray-50 dark:bg-gray-950">
              <Tabs
                tabs={[
                  { key: "summary", label: "AI Summary" },
                  { key: "mindmap", label: "Mindmap" },
                ]}
                value={rightTab}
                onChange={setRightTab}
              >
                {rightTab === "summary" ? (
                  <div className="space-y-4 px-4 py-6">
                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Episode Summary
                      </h3>
                      <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">（内容留空）</p>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Tags
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <span
                            key={`tag-placeholder-${index}`}
                            className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500"
                          >
                            （留空）
                          </span>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Chapters
                        </h3>
                        <span className="text-xs text-gray-400 dark:text-gray-500">（待填写）</span>
                      </div>
                      <ol className="mt-4 space-y-3 text-sm">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <li key={`chapter-placeholder-${index}`} className="flex items-start gap-3">
                            <div className="mt-1 text-xs font-semibold text-gray-400 dark:text-gray-500">
                              {index + 1}.
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                                  --:--
                                </span>
                                <p className="font-medium text-gray-400 dark:text-gray-500">章节标题（留空）</p>
                              </div>
                              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                章节摘要内容留空，占位展示样式。
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Episode Card
                      </h3>
                      <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">（内容留空）</p>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Play Queue
                      </h3>
                      <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">（内容留空）</p>
                    </section>
                  </div>
                ) : (
                  <Mindmap
                    episodeTitle={episode.title}
                    tags={tags}
                    chapters={chapters}
                    onJump={handleJump}
                  />
                )}
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodeDetailPage;
