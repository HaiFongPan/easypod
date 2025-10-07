import type { SentenceInfo } from '../store/transcriptStore';

/**
 * Find the current sentence index based on playback position using binary search
 * Time complexity: O(log n)
 *
 * @param sentences Array of sentence info
 * @param currentTimeMs Current playback time in milliseconds
 * @returns Index of the current sentence, or -1 if not found
 */
export function findCurrentSentenceIndex(
  sentences: SentenceInfo[],
  currentTimeMs: number
): number {
  if (!sentences || sentences.length === 0) {
    return -1;
  }

  // Binary search for the sentence containing currentTimeMs
  let left = 0;
  let right = sentences.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const sentence = sentences[mid];

    if (currentTimeMs >= sentence.start && currentTimeMs <= sentence.end) {
      // Found exact match
      return mid;
    }

    if (currentTimeMs < sentence.start) {
      // Search in left half
      right = mid - 1;
    } else {
      // currentTimeMs > sentence.end
      // This sentence might be the closest before current time
      result = mid;
      // Search in right half
      left = mid + 1;
    }
  }

  // Return the closest sentence before current time
  // If no sentence found (currentTimeMs is before first sentence), return -1
  if (result >= 0 && currentTimeMs >= sentences[result].start) {
    return result;
  }

  return -1;
}

/**
 * Format time in milliseconds to human-readable format (MM:SS or HH:MM:SS)
 *
 * @param ms Time in milliseconds
 * @returns Formatted time string
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get speaker avatar color based on speaker ID
 * Returns color code from a predefined palette
 *
 * @param speakerId Speaker ID (0, 1, 2, ...)
 * @returns Object with background and text color
 */
export function getSpeakerColor(speakerId: number): {
  bg: string;
  text: string;
  border: string;
} {
  const colors = [
    { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
    { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600' },
    { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600' },
    { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
    { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600' },
    { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
    { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600' },
    { bg: 'bg-teal-500', text: 'text-white', border: 'border-teal-600' },
  ];

  return colors[speakerId % colors.length];
}

/**
 * Get speaker label (S0, S1, S2, ...)
 *
 * @param speakerId Speaker ID
 * @returns Speaker label string
 */
export function getSpeakerLabel(speakerId: number): string {
  return `S${speakerId}`;
}

/**
 * Debounce function for detecting manual scroll
 * Returns a debounced version of the callback
 *
 * @param callback Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Smooth scroll to element within a container
 *
 * @param container Scroll container element
 * @param target Target element to scroll to
 * @param offset Offset from top (default: container height / 3)
 */
export function smoothScrollToElement(
  container: HTMLElement,
  target: HTMLElement,
  offset?: number
): void {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // Calculate the desired offset (1/3 from top by default)
  const defaultOffset = containerRect.height / 3;
  const scrollOffset = offset ?? defaultOffset;

  // Calculate scroll position
  const currentScroll = container.scrollTop;
  const targetTop = targetRect.top - containerRect.top + currentScroll;
  const desiredScroll = targetTop - scrollOffset;

  // Smooth scroll
  container.scrollTo({
    top: desiredScroll,
    behavior: 'smooth',
  });
}
