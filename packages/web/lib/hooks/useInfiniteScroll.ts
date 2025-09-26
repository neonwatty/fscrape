import { useEffect, useRef, useCallback, useState } from 'react';

export interface UseInfiniteScrollOptions {
  /**
   * Callback function triggered when the sentinel element is intersected
   */
  onLoadMore: () => void | Promise<void>;

  /**
   * Whether more data is available to load
   */
  hasMore: boolean;

  /**
   * Whether data is currently being loaded
   */
  isLoading?: boolean;

  /**
   * Root element for intersection (defaults to viewport)
   */
  root?: Element | null;

  /**
   * Margin around root element
   */
  rootMargin?: string;

  /**
   * Visibility threshold to trigger loading (0-1)
   */
  threshold?: number;

  /**
   * Enable/disable the infinite scroll
   */
  enabled?: boolean;

  /**
   * Delay before triggering load (ms)
   */
  delay?: number;
}

export interface UseInfiniteScrollReturn {
  /**
   * Ref to attach to the sentinel element
   */
  sentinelRef: React.RefObject<HTMLDivElement | null>;

  /**
   * Whether the intersection observer is active
   */
  isObserving: boolean;

  /**
   * Manually trigger a load
   */
  loadMore: () => void;

  /**
   * Reset the infinite scroll state
   */
  reset: () => void;
}

/**
 * Custom hook for implementing infinite scroll using Intersection Observer
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading = false,
  root = null,
  rootMargin = '100px',
  threshold = 0.1,
  enabled = true,
  delay = 0,
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isObserving, setIsObserving] = useState(false);

  // Manual load trigger
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && enabled) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoading, enabled]);

  // Reset function
  const reset = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    setIsObserving(false);
  }, []);

  // Intersection callback
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      if (entry.isIntersecting && hasMore && !isLoading && enabled) {
        // Clear any existing timeout
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }

        // Apply delay if specified
        if (delay > 0) {
          loadTimeoutRef.current = setTimeout(() => {
            onLoadMore();
          }, delay);
        } else {
          onLoadMore();
        }
      }
    },
    [onLoadMore, hasMore, isLoading, enabled, delay]
  );

  // Setup and cleanup observer
  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Don't observe if conditions aren't met
    if (!enabled || !hasMore || !sentinelRef.current) {
      setIsObserving(false);
      return;
    }

    // Create new observer
    const options: IntersectionObserverInit = {
      root,
      rootMargin,
      threshold,
    };

    observerRef.current = new IntersectionObserver(handleIntersection, options);
    observerRef.current.observe(sentinelRef.current);
    setIsObserving(true);

    // Cleanup function
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      setIsObserving(false);
    };
  }, [enabled, hasMore, handleIntersection, root, rootMargin, threshold]);

  return {
    sentinelRef,
    isObserving,
    loadMore,
    reset,
  };
}

/**
 * Hook for managing paginated data with infinite scroll
 */
export interface UsePaginatedDataOptions<T> {
  /**
   * Function to fetch data for a specific page
   */
  fetchData: (page: number, pageSize: number) => Promise<T[]>;

  /**
   * Initial page size
   */
  initialPageSize?: number;

  /**
   * Whether to enable infinite scroll
   */
  infiniteScroll?: boolean;

  /**
   * Root margin for intersection observer
   */
  rootMargin?: string;
}

export interface UsePaginatedDataReturn<T> {
  /**
   * Current data array
   */
  data: T[];

  /**
   * Current page number (0-indexed)
   */
  currentPage: number;

  /**
   * Current page size
   */
  pageSize: number;

  /**
   * Total number of items (if known)
   */
  totalItems?: number;

  /**
   * Whether data is being loaded
   */
  isLoading: boolean;

  /**
   * Whether there is more data to load
   */
  hasMore: boolean;

  /**
   * Error state
   */
  error: Error | null;

  /**
   * Load next page
   */
  loadNextPage: () => Promise<void>;

  /**
   * Load previous page
   */
  loadPreviousPage: () => Promise<void>;

  /**
   * Jump to specific page
   */
  goToPage: (page: number) => Promise<void>;

  /**
   * Change page size
   */
  setPageSize: (size: number) => void;

  /**
   * Reset pagination
   */
  reset: () => void;

  /**
   * Infinite scroll sentinel ref
   */
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
}

export function usePaginatedData<T>({
  fetchData,
  initialPageSize = 20,
  infiniteScroll = false,
  rootMargin = '100px',
}: UsePaginatedDataOptions<T>): UsePaginatedDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, _setTotalItems] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadNextPage = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const newData = await fetchData(currentPage + 1, pageSize);

      if (infiniteScroll) {
        // Append data for infinite scroll
        setData((prev) => [...prev, ...newData]);
      } else {
        // Replace data for pagination
        setData(newData);
      }

      setCurrentPage((prev) => prev + 1);
      setHasMore(newData.length === pageSize);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, fetchData, infiniteScroll, isLoading, hasMore]);

  const loadPreviousPage = useCallback(async () => {
    if (isLoading || currentPage === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const newData = await fetchData(currentPage - 1, pageSize);
      setData(newData);
      setCurrentPage((prev) => prev - 1);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, fetchData, isLoading]);

  const goToPage = useCallback(
    async (page: number) => {
      if (isLoading || page < 0) return;

      setIsLoading(true);
      setError(null);

      try {
        const newData = await fetchData(page, pageSize);
        setData(newData);
        setCurrentPage(page);
        setHasMore(newData.length === pageSize);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, fetchData, isLoading]
  );

  const reset = useCallback(() => {
    setData([]);
    setCurrentPage(0);
    setHasMore(true);
    setError(null);
    setIsLoading(false);
  }, []);

  // Setup infinite scroll if enabled
  const infiniteScrollHook = useInfiniteScroll({
    onLoadMore: loadNextPage,
    hasMore: hasMore && infiniteScroll,
    isLoading,
    rootMargin,
    enabled: infiniteScroll,
  });

  // Load initial data
  useEffect(() => {
    goToPage(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    currentPage,
    pageSize,
    totalItems,
    isLoading,
    hasMore,
    error,
    loadNextPage,
    loadPreviousPage,
    goToPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      reset();
    },
    reset,
    ...(infiniteScroll && { sentinelRef: infiniteScrollHook.sentinelRef }),
  };
}
