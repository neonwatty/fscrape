import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { ComponentLoading, ChartLoading, TableLoading } from '@/app/loading';

// Type definitions for lazy loading options
export interface LazyLoadOptions {
  ssr?: boolean;
  loading?: ComponentType;
  suspense?: boolean;
}

// Preload component function for critical components
export function preloadComponent(importFn: () => Promise<any>) {
  // Trigger the import but don't await it
  importFn().catch(console.error);
}

// Generic lazy loader with custom loading states
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | { [key: string]: T }>,
  exportName?: string,
  options: LazyLoadOptions = {}
) {
  const { ssr = false, loading = ComponentLoading } = options;

  if (exportName) {
    return dynamic(() => importFn().then((mod) => ({ default: (mod as any)[exportName] })), {
      ssr,
      loading: loading as any,
    });
  }

  return dynamic(importFn as any, { ssr, loading: loading as any });
}

// Specialized lazy loaders for different component types
export const lazyLoadChart = (importFn: () => Promise<any>, exportName?: string) => {
  return createLazyComponent(importFn, exportName, {
    ssr: false,
    loading: ChartLoading,
  });
};

export const lazyLoadTable = (importFn: () => Promise<any>, exportName?: string) => {
  return createLazyComponent(importFn, exportName, {
    ssr: false,
    loading: TableLoading,
  });
};

// Route-level code splitting helper
export const lazyLoadRoute = (importFn: () => Promise<any>, exportName?: string) => {
  return createLazyComponent(importFn, exportName, {
    ssr: true, // Enable SSR for routes
    loading: undefined, // Use default route loading
  });
};

// Conditional lazy loading based on viewport/device
export function conditionalLazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | { [key: string]: T }>,
  condition: () => boolean,
  FallbackComponent?: ComponentType
) {
  if (typeof window === 'undefined') {
    // Server-side: return fallback or loading component
    return FallbackComponent || ComponentLoading;
  }

  if (condition()) {
    return dynamic(importFn as any, {
      ssr: false,
      loading: ComponentLoading as any,
    });
  }

  return FallbackComponent || ComponentLoading;
}

// Intersection Observer based lazy loading
export function lazyLoadOnVisible<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | { [key: string]: T }>,
  _options: IntersectionObserverInit = {}
) {
  if (typeof window === 'undefined') {
    return dynamic(importFn as any, { ssr: true });
  }

  return dynamic(importFn as any, {
    ssr: false,
    loading: ComponentLoading as any,
  });
}

// Bundle splitting utilities for heavy libraries
export const splitBundle = {
  // Chart libraries (dynamically import when needed)
  async loadChartLibrary() {
    return await import('recharts');
  },

  // Async load heavy utilities when available
  async loadHeavyUtil(utilName: string) {
    switch (utilName) {
      case 'recharts':
        return await import('recharts');
      case 'lucide':
        return await import('lucide-react');
      default:
        console.warn(`Utility ${utilName} not configured for lazy loading`);
        return null;
    }
  },
};

// Prefetch components for improved perceived performance
export const prefetchComponents = (components: Array<() => Promise<any>>) => {
  if (typeof window === 'undefined') return;

  // Use requestIdleCallback if available
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      components.forEach(preloadComponent);
    });
  } else {
    // Fallback to setTimeout
    setTimeout(() => {
      components.forEach(preloadComponent);
    }, 1);
  }
};

// Export commonly used lazy loaded components
export const LazyComponents = {
  // Analytics components
  TopAuthors: lazyLoadChart(() => import('@/components/analytics/TopAuthors'), 'TopAuthors'),
  EngagementMetrics: lazyLoadChart(
    () => import('@/components/analytics/EngagementMetrics'),
    'EngagementMetrics'
  ),

  // Chart components
  TimeSeriesChart: lazyLoadChart(
    () => import('@/components/charts/TimeSeriesChart'),
    'TimeSeriesChart'
  ),
  HeatMap: lazyLoadChart(() => import('@/components/charts/HeatMap'), 'HeatMap'),
  GrowthChart: lazyLoadChart(() => import('@/components/charts/GrowthChart'), 'GrowthChart'),
  EngagementChart: lazyLoadChart(
    () => import('@/components/charts/EngagementChart'),
    'EngagementChart'
  ),

  // Table components
  PostsTable: lazyLoadTable(() => import('@/components/tables/PostsTable'), 'PostsTable'),
  ResponsivePostsTable: lazyLoadTable(
    () => import('@/components/tables/ResponsivePostsTable'),
    'ResponsivePostsTable'
  ),

  // Heavy post components
  PostsExplorer: createLazyComponent(
    () => import('@/components/posts/PostsExplorer'),
    'PostsExplorer',
    { ssr: false }
  ),
  PostsTableEnhanced: lazyLoadTable(
    () => import('@/components/posts/PostsTableEnhanced'),
    'PostsTableEnhanced'
  ),
};
