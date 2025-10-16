import { useEffect, useRef, useCallback } from "react";

export interface UseInfiniteScrollOptions {
  /**
   * Whether there are more items to load
   */
  hasMore: boolean;
  /**
   * Whether currently loading
   */
  loading: boolean;
  /**
   * Callback to load more items
   */
  onLoadMore: () => void;
  /**
   * Intersection observer threshold (0-1)
   * @default 0.1
   */
  threshold?: number;
  /**
   * Root margin for intersection observer
   * @default "0px"
   */
  rootMargin?: string;
  /**
   * Disable the infinite scroll
   * @default false
   */
  disabled?: boolean;
}

/**
 * Hook for implementing infinite scroll using Intersection Observer API
 *
 * @example
 * ```tsx
 * const { observerTarget } = useInfiniteScroll({
 *   hasMore: hasMoreItems,
 *   loading: isLoading,
 *   onLoadMore: loadMoreItems,
 * });
 *
 * return (
 *   <div>
 *     {items.map(item => <Item key={item.id} {...item} />)}
 *     <div ref={observerTarget} />
 *   </div>
 * );
 * ```
 */
export const useInfiniteScroll = ({
  hasMore,
  loading,
  onLoadMore,
  threshold = 0.1,
  rootMargin = "0px",
  disabled = false,
}: UseInfiniteScrollOptions) => {
  const observerTarget = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Memoize the callback to avoid recreating observer
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loading && !disabled) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore, disabled],
  );

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Don't create observer if disabled
    if (disabled) {
      return;
    }

    // Create new observer
    const options: IntersectionObserverInit = {
      root: null, // viewport
      rootMargin,
      threshold,
    };

    observerRef.current = new IntersectionObserver(
      handleIntersection,
      options,
    );

    // Observe the target element
    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observerRef.current.observe(currentTarget);
    }

    // Cleanup on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, threshold, rootMargin, disabled]);

  return {
    observerTarget,
  };
};
