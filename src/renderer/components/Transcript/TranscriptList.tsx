import React, { useEffect, useRef, useCallback } from 'react';
import TranscriptItem from './TranscriptItem';
import { useTranscriptStore } from '../../store/transcriptStore';
import { usePlayerStore } from '../../store/playerStore';
import {
  findCurrentSentenceIndex,
  debounce,
  smoothScrollToElement,
} from '../../utils/transcriptUtils';
import { cn } from '../../utils/cn';

interface TranscriptListProps {
  episodeId: number;
  onJumpToTime?: (timeMs: number) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  refreshTrigger?: number | string; // Optional trigger to force refresh
}

const TranscriptList: React.FC<TranscriptListProps> = ({
  episodeId,
  onJumpToTime,
  scrollContainerRef,
  refreshTrigger,
}) => {
  const sentenceRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isManualScrolling = useRef(false);
  const lastAutoScrollTime = useRef<number>(0);

  // Transcript store
  const {
    transcript,
    isLoading,
    error,
    currentSentenceIndex,
    autoScrollEnabled,
    manualScrollDetected,
    loadTranscript,
    setCurrentSentenceIndex,
    setManualScrollDetected,
  } = useTranscriptStore();

  // Player store
  const { currentEpisode, position: playerPosition } = usePlayerStore();

  // Check if player episode matches detail page episode
  const isMatchingEpisode = currentEpisode?.id === episodeId;

  // Load transcript on mount, episode change, or refresh trigger
  useEffect(() => {
    loadTranscript(episodeId);
  }, [episodeId, loadTranscript, refreshTrigger]);

  // Update current sentence index based on player position
  useEffect(() => {
    if (!transcript || !isMatchingEpisode) {
      return;
    }

    const positionMs = playerPosition * 1000;
    const newIndex = findCurrentSentenceIndex(transcript.subtitles, positionMs);

    if (newIndex !== currentSentenceIndex) {
      setCurrentSentenceIndex(newIndex);
    }
  }, [
    transcript,
    playerPosition,
    isMatchingEpisode,
    currentSentenceIndex,
    setCurrentSentenceIndex,
  ]);

  // Auto-scroll to current sentence
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (
      !autoScrollEnabled ||
      manualScrollDetected ||
      currentSentenceIndex < 0 ||
      !container
    ) {
      return;
    }

    const targetElement = sentenceRefs.current.get(currentSentenceIndex);
    if (!targetElement) {
      return;
    }

    // Prevent scrolling if user recently manually scrolled
    const now = Date.now();
    if (now - lastAutoScrollTime.current < 300) {
      return;
    }

    lastAutoScrollTime.current = now;
    smoothScrollToElement(container, targetElement);
  }, [currentSentenceIndex, autoScrollEnabled, manualScrollDetected, scrollContainerRef]);

  // Detect manual scroll with debouncing
  const handleScroll = useCallback(
    debounce(() => {
      if (isManualScrolling.current) {
        setManualScrollDetected(true);
        isManualScrolling.current = false;
      }
    }, 300),
    [setManualScrollDetected]
  );

  // Mark that user is scrolling
  const handleScrollStart = useCallback(() => {
    const now = Date.now();
    // Only mark as manual scroll if it's not immediately after auto-scroll
    if (now - lastAutoScrollTime.current > 300) {
      isManualScrolling.current = true;
    }
  }, []);

  // Attach scroll listeners to the container
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) {
      return;
    }

    container.addEventListener('scroll', handleScroll);
    container.addEventListener('touchstart', handleScrollStart);
    container.addEventListener('mousedown', handleScrollStart);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchstart', handleScrollStart);
      container.removeEventListener('mousedown', handleScrollStart);
    };
  }, [scrollContainerRef, handleScroll, handleScrollStart]);

  // Handle timestamp click - jump to time in player
  const handleTimestampClick = useCallback(
    (timeMs: number) => {
      if (onJumpToTime) {
        onJumpToTime(timeMs);
      }
    },
    [onJumpToTime]
  );

  // Store ref for each sentence
  const setSentenceRef = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element) {
      sentenceRefs.current.set(index, element);
    } else {
      sentenceRefs.current.delete(index);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500 dark:border-gray-700 dark:border-t-blue-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading transcript...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <svg
            className="mx-auto h-12 w-12 text-red-400 dark:text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
            Failed to load transcript
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // No transcript available
  if (!transcript || transcript.subtitles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <svg
            className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v13a1 1 0 01-1.447.894L12 15.618l-5.553 3.276A1 1 0 015 18V5z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
            No transcript available
          </h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            This episode doesn't have a transcript yet. Try generating one using the AI transcription feature.
          </p>
        </div>
      </div>
    );
  }

  // Render transcript list
  return (
    <div className="space-y-3 px-6 py-6">
      {transcript.subtitles.map((sentence, index) => (
        <TranscriptItem
          key={`sentence-${index}`}
          ref={(el) => setSentenceRef(index, el)}
          sentence={sentence}
          isHighlighted={isMatchingEpisode && index === currentSentenceIndex}
          onClickTimestamp={handleTimestampClick}
        />
      ))}
    </div>
  );
};

export default TranscriptList;
