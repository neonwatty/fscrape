'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  useVirtualizer as useTanstackVirtualizer,
  VirtualizerOptions,
} from '@tanstack/react-virtual';

// Performance metrics interface
export interface VirtualizerMetrics {
  totalItems: number;
  visibleItems: number;
  scrollProgress: number;
  estimatedTotalSize: number;
  currentScrollTop: number;
  memoryEfficiency: number;
  renderTime?: number;
}

// Enhanced virtualizer options
export interface EnhancedVirtualizerOptions<T = any> extends Partial<VirtualizerOptions<any, any>> {
  data: T[];
  containerRef?: React.RefObject<HTMLElement>;
  itemHeight?: number | ((index: number, item: T) => number);
  horizontal?: boolean;
  debug?: boolean;
  onScroll?: (metrics: VirtualizerMetrics) => void;
  measurePerformance?: boolean;
  smoothScroll?: boolean;
  enableKeyboardNavigation?: boolean;
}

/**
 * Enhanced virtualizer hook with performance monitoring
 */
export function useVirtualizer<T = any>({
  data,
  containerRef,
  itemHeight = 50,
  horizontal = false,
  debug = false,
  onScroll,
  measurePerformance = false,
  smoothScroll = true,
  enableKeyboardNavigation = false,
  ...options
}: EnhancedVirtualizerOptions<T>) {
  const internalRef = useRef<HTMLElement>(null);
  const scrollElementRef = containerRef || internalRef;
  const [metrics, setMetrics] = useState<VirtualizerMetrics>({
    totalItems: data.length,
    visibleItems: 0,
    scrollProgress: 0,
    estimatedTotalSize: 0,
    currentScrollTop: 0,
    memoryEfficiency: 0,
  });

  const [renderStartTime, setRenderStartTime] = useState<number>(0);

  // Calculate item size
  const getItemSize = useCallback(
    (index: number) => {
      if (typeof itemHeight === 'function') {
        return itemHeight(index, data[index]);
      }
      return itemHeight;
    },
    [itemHeight, data]
  );

  // Initialize virtualizer
  const virtualizer = useTanstackVirtualizer({
    count: data.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: getItemSize,
    horizontal,
    overscan: 5,
    ...options,
  });

  // Get virtual items
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Update metrics on scroll
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const scrollTop = horizontal ? scrollElement.scrollLeft : scrollElement.scrollTop;
      const scrollHeight = horizontal ? scrollElement.scrollWidth : scrollElement.scrollHeight;
      const clientHeight = horizontal ? scrollElement.clientWidth : scrollElement.clientHeight;

      const scrollProgress = scrollTop / (scrollHeight - clientHeight);
      const memoryEfficiency = 1 - virtualItems.length / data.length;

      const newMetrics: VirtualizerMetrics = {
        totalItems: data.length,
        visibleItems: virtualItems.length,
        scrollProgress: isNaN(scrollProgress) ? 0 : scrollProgress,
        estimatedTotalSize: totalSize,
        currentScrollTop: scrollTop,
        memoryEfficiency: isNaN(memoryEfficiency) ? 0 : memoryEfficiency,
        renderTime: measurePerformance ? performance.now() - renderStartTime : undefined,
      };

      setMetrics(newMetrics);

      if (onScroll) {
        onScroll(newMetrics);
      }

      if (debug) {
        console.log('Virtualizer Metrics:', newMetrics);
      }
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [
    virtualItems.length,
    data.length,
    totalSize,
    horizontal,
    onScroll,
    debug,
    measurePerformance,
    renderStartTime,
    scrollElementRef,
  ]);

  // Performance tracking
  useEffect(() => {
    if (measurePerformance) {
      setRenderStartTime(performance.now());
    }
  }, [measurePerformance, virtualItems]);

  // Smooth scroll to item
  const scrollToItem = useCallback(
    (index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
      virtualizer.scrollToIndex(index, {
        align,
        behavior: smoothScroll ? 'smooth' : 'auto',
      });
    },
    [virtualizer, smoothScroll]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboardNavigation) return;

    const scrollElement = scrollElementRef.current;
    if (!scrollElement) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = virtualItems[0]?.index || 0;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          scrollToItem(Math.min(currentIndex + 1, data.length - 1));
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          scrollToItem(Math.max(currentIndex - 1, 0));
          break;
        case 'PageDown':
          e.preventDefault();
          scrollToItem(Math.min(currentIndex + virtualItems.length, data.length - 1));
          break;
        case 'PageUp':
          e.preventDefault();
          scrollToItem(Math.max(currentIndex - virtualItems.length, 0));
          break;
        case 'Home':
          e.preventDefault();
          scrollToItem(0);
          break;
        case 'End':
          e.preventDefault();
          scrollToItem(data.length - 1);
          break;
      }
    };

    scrollElement.addEventListener('keydown', handleKeyDown);
    scrollElement.tabIndex = 0; // Make focusable

    return () => {
      scrollElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableKeyboardNavigation, virtualItems, data.length, scrollToItem, scrollElementRef]);

  // Calculate render range
  const renderRange = useMemo(() => {
    if (virtualItems.length === 0) {
      return { start: 0, end: 0 };
    }
    return {
      start: virtualItems[0].index,
      end: virtualItems[virtualItems.length - 1].index,
    };
  }, [virtualItems]);

  // Performance helpers
  const getPerformanceStats = useCallback(() => {
    return {
      totalRows: data.length,
      renderedRows: virtualItems.length,
      efficiencyRatio: virtualItems.length / data.length,
      memoryReduction: `${((1 - virtualItems.length / data.length) * 100).toFixed(1)}%`,
      estimatedMemorySaved: `~${((data.length - virtualItems.length) * 0.5).toFixed(1)}KB`, // Rough estimate
    };
  }, [data.length, virtualItems.length]);

  return {
    // Core virtualizer properties
    virtualizer,
    virtualItems,
    totalSize,

    // Calculated properties
    renderRange,
    metrics,

    // Helper functions
    scrollToItem,
    getPerformanceStats,

    // Refs
    scrollElementRef,

    // Utilities
    isScrolling: virtualizer.isScrolling,
    scrollDirection: virtualizer.scrollDirection,
  };
}

/**
 * Hook for infinite scrolling with virtualization
 */
export function useInfiniteVirtualizer<T = any>({
  fetchMore,
  hasMore,
  threshold = 0.8,
  ...virtualizerOptions
}: EnhancedVirtualizerOptions<T> & {
  fetchMore: () => Promise<void> | void;
  hasMore: boolean;
  threshold?: number;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const virtualizerResult = useVirtualizer(virtualizerOptions);

  // Check if we should load more
  useEffect(() => {
    const { scrollProgress } = virtualizerResult.metrics;

    if (scrollProgress > threshold && hasMore && !isLoading) {
      setIsLoading(true);
      Promise.resolve(fetchMore()).finally(() => {
        setIsLoading(false);
      });
    }
  }, [virtualizerResult.metrics, threshold, hasMore, isLoading, fetchMore]);

  return {
    ...virtualizerResult,
    isLoading,
  };
}

/**
 * Hook for bidirectional infinite scrolling
 */
export function useBidirectionalVirtualizer<T = any>({
  fetchNext,
  fetchPrevious,
  hasNext,
  hasPrevious,
  ...virtualizerOptions
}: EnhancedVirtualizerOptions<T> & {
  fetchNext: () => Promise<void> | void;
  fetchPrevious: () => Promise<void> | void;
  hasNext: boolean;
  hasPrevious: boolean;
}) {
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const virtualizerResult = useVirtualizer(virtualizerOptions);

  // Check scroll position for loading
  useEffect(() => {
    const { scrollProgress, currentScrollTop } = virtualizerResult.metrics;

    // Load next
    if (scrollProgress > 0.8 && hasNext && !isLoadingNext) {
      setIsLoadingNext(true);
      Promise.resolve(fetchNext()).finally(() => {
        setIsLoadingNext(false);
      });
    }

    // Load previous
    if (currentScrollTop < 100 && hasPrevious && !isLoadingPrevious) {
      setIsLoadingPrevious(true);
      Promise.resolve(fetchPrevious()).finally(() => {
        setIsLoadingPrevious(false);
      });
    }
  }, [
    virtualizerResult.metrics,
    hasNext,
    hasPrevious,
    isLoadingNext,
    isLoadingPrevious,
    fetchNext,
    fetchPrevious,
  ]);

  return {
    ...virtualizerResult,
    isLoadingNext,
    isLoadingPrevious,
  };
}

/**
 * Helper to generate large datasets for testing
 */
export function generateTestData<T extends Record<string, any>>(
  count: number,
  generator: (index: number) => T
): T[] {
  return Array.from({ length: count }, (_, index) => generator(index));
}

/**
 * Performance benchmark utility
 */
export function benchmarkVirtualizer(
  itemCount: number,
  visibleItems: number
): {
  memoryUsage: string;
  renderEfficiency: string;
  recommendation: string;
} {
  const baseMemoryPerItem = 1; // KB estimate
  const withoutVirtualization = itemCount * baseMemoryPerItem;
  const withVirtualization = visibleItems * baseMemoryPerItem;
  const saved = withoutVirtualization - withVirtualization;
  const efficiency = (saved / withoutVirtualization) * 100;

  return {
    memoryUsage: `${withVirtualization}KB vs ${withoutVirtualization}KB`,
    renderEfficiency: `${efficiency.toFixed(1)}% memory saved`,
    recommendation:
      itemCount > 100
        ? 'Virtualization highly recommended'
        : 'Virtualization optional for this dataset size',
  };
}
