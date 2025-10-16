import React from "react";
import { Loader2 } from "lucide-react";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

export interface InfiniteScrollContainerProps {
  /**
   * Whether there are more items to load
   */
  hasMore: boolean;
  /**
   * Whether currently loading more items
   */
  loading: boolean;
  /**
   * Callback to load more items
   */
  onLoadMore: () => void;
  /**
   * Content to display
   */
  children: React.ReactNode;
  /**
   * Intersection observer threshold (0-1)
   * @default 0.1
   */
  threshold?: number;
  /**
   * Root margin for intersection observer
   * @default "200px"
   */
  rootMargin?: string;
  /**
   * Custom loading indicator
   */
  loadingIndicator?: React.ReactNode;
  /**
   * Custom end message
   */
  endMessage?: React.ReactNode;
  /**
   * Class name for the container
   */
  className?: string;
}

/**
 * A container component that implements infinite scroll
 *
 * @example
 * ```tsx
 * <InfiniteScrollContainer
 *   hasMore={hasMore}
 *   loading={loading}
 *   onLoadMore={loadMore}
 * >
 *   {items.map(item => <Item key={item.id} {...item} />)}
 * </InfiniteScrollContainer>
 * ```
 */
export const InfiniteScrollContainer: React.FC<
  InfiniteScrollContainerProps
> = ({
  hasMore,
  loading,
  onLoadMore,
  children,
  threshold = 0.1,
  rootMargin = "200px",
  loadingIndicator,
  endMessage,
  className = "flex-1 min-h-0 overflow-y-auto",
}) => {
  const { observerTarget } = useInfiniteScroll({
    hasMore,
    loading,
    onLoadMore,
    threshold,
    rootMargin,
  });

  const defaultLoadingIndicator = (
    <div className="flex justify-center py-6">
      <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400" />
    </div>
  );

  const defaultEndMessage = (
    <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
      No more items
    </div>
  );

  return (
    <div className={className}>
      {children}

      {/* Loading indicator */}
      {loading && (loadingIndicator ?? defaultLoadingIndicator)}

      {/* Observer target - invisible trigger element */}
      {hasMore && !loading && (
        <div
          ref={observerTarget}
          className="h-4"
          aria-hidden="true"
          data-testid="infinite-scroll-trigger"
        />
      )}

      {/* End message */}
      {!hasMore && !loading && (endMessage ?? defaultEndMessage)}
    </div>
  );
};
