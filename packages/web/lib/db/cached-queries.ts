/**
 * Database queries with advanced caching integration
 */

import { LRUCache, withCache, generateCacheKey } from './cache';
import * as queries from './queries';
import type { PostFilters } from './types';

// Create dedicated cache for database queries
const queryCache = new LRUCache({
  maxSize: 20 * 1024 * 1024, // 20MB for database queries
  maxEntries: 500,
  defaultTTL: 5 * 60 * 1000, // 5 minutes default
  checkInterval: 60 * 1000, // Clean up every minute
  enableStats: true,
});

// TTL configurations for different query types
const TTL_CONFIG = {
  posts: 2 * 60 * 1000, // 2 minutes for post queries
  recentPosts: 30 * 1000, // 30 seconds for recent posts
  stats: 5 * 60 * 1000, // 5 minutes for statistics
  analytics: 10 * 60 * 1000, // 10 minutes for analytics
  search: 60 * 1000, // 1 minute for search results
  trending: 30 * 1000, // 30 seconds for trending
};

/**
 * Cached version of getPosts
 */
export const getCachedPosts = withCache((filters?: PostFilters) => queries.getPosts(filters), {
  cache: queryCache,
  ttl: TTL_CONFIG.posts,
  keyGenerator: (filters) =>
    generateCacheKey('getPosts', (filters as Record<string, unknown>) || {}),
});

/**
 * Cached version of getRecentPosts
 */
export const getCachedRecentPosts = withCache(
  (limit: number = 10) => queries.getRecentPosts(limit),
  {
    cache: queryCache,
    ttl: TTL_CONFIG.recentPosts,
    keyGenerator: (limit) => generateCacheKey('getRecentPosts', { limit }),
  }
);

/**
 * Cached version of getPlatformStats
 */
export const getCachedPlatformStats = withCache(() => queries.getPlatformStats(), {
  cache: queryCache,
  ttl: TTL_CONFIG.stats,
  keyGenerator: () => generateCacheKey('getPlatformStats'),
});

/**
 * Cached version of getPostsTimeSeries
 */
export const getCachedPostsTimeSeries = withCache(
  (days: number = 30) => queries.getPostsTimeSeries(days),
  {
    cache: queryCache,
    ttl: TTL_CONFIG.analytics,
    keyGenerator: (days) => generateCacheKey('getPostsTimeSeries', { days }),
  }
);

/**
 * Cached version of getTopAuthors
 */
export const getCachedTopAuthors = withCache((limit: number = 10) => queries.getTopAuthors(limit), {
  cache: queryCache,
  ttl: TTL_CONFIG.stats,
  keyGenerator: (limit) => generateCacheKey('getTopAuthors', { limit }),
});

/**
 * Cached version of searchPosts
 */
export const getCachedSearchPosts = withCache(
  (query: string, limit: number = 50) => queries.searchPosts(query, limit),
  {
    cache: queryCache,
    ttl: TTL_CONFIG.search,
    keyGenerator: (query, limit) => generateCacheKey('searchPosts', { query, limit }),
  }
);

/**
 * Cached version of getTrendingPosts
 */
export const getCachedTrendingPosts = withCache(
  (limit: number = 10) => queries.getTrendingPosts(limit),
  {
    cache: queryCache,
    ttl: TTL_CONFIG.trending,
    keyGenerator: (limit) => generateCacheKey('getTrendingPosts', { limit }),
  }
);

/**
 * Cached version of getDatabaseSummary
 */
export const getCachedDatabaseSummary = withCache(() => queries.getDatabaseSummary(), {
  cache: queryCache,
  ttl: TTL_CONFIG.stats,
  keyGenerator: () => generateCacheKey('getDatabaseSummary'),
});

/**
 * Invalidate cache for specific query type
 */
export function invalidateCache(queryType?: string): void {
  if (!queryType) {
    queryCache.clear();
    return;
  }

  const keys = queryCache.keys();
  keys.forEach((key) => {
    if (key.startsWith(queryType)) {
      queryCache.delete(key);
    }
  });
}

/**
 * Invalidate all post-related caches
 */
export function invalidatePostCaches(): void {
  invalidateCache('getPosts');
  invalidateCache('getRecentPosts');
  invalidateCache('getTrendingPosts');
  invalidateCache('searchPosts');
}

/**
 * Invalidate all statistics caches
 */
export function invalidateStatsCaches(): void {
  invalidateCache('getPlatformStats');
  invalidateCache('getTopAuthors');
  invalidateCache('getDatabaseSummary');
  invalidateCache('getPostsTimeSeries');
}

/**
 * Get cache statistics
 */
export function getCacheStatistics() {
  const stats = queryCache.getStats();
  const sizeInfo = queryCache.getSizeInfo();

  return {
    ...stats,
    hitRatePercentage: (stats.hitRate * 100).toFixed(2) + '%',
    sizeUsed: `${(sizeInfo.used / 1024).toFixed(2)}KB`,
    sizeMax: `${(sizeInfo.max / 1024 / 1024).toFixed(2)}MB`,
    sizePercentage: sizeInfo.percentage.toFixed(2) + '%',
    avgEntrySizeKB: (stats.avgEntrySize / 1024).toFixed(2) + 'KB',
  };
}

/**
 * Preload common queries
 */
export async function preloadCommonQueries(): Promise<void> {
  try {
    // Preload in parallel
    await Promise.all([
      Promise.resolve(getCachedRecentPosts(10)),
      Promise.resolve(getCachedPlatformStats()),
      Promise.resolve(getCachedDatabaseSummary()),
      Promise.resolve(getCachedTrendingPosts(5)),
    ]);

    console.log('Common queries preloaded into cache');
  } catch (error) {
    console.error('Failed to preload queries:', error);
  }
}

/**
 * Export cache for persistence
 */
export function exportQueryCache() {
  return queryCache.export();
}

/**
 * Import cache from persistence
 */
export function importQueryCache(entries: ReturnType<typeof exportQueryCache>) {
  queryCache.import(entries);
}

/**
 * Stop cache cleanup timer (for cleanup)
 */
export function stopCacheCleanup() {
  queryCache.stopCleanupTimer();
}

// Export cache instance for advanced usage
export { queryCache };
