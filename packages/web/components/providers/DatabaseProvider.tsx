'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Database } from 'sql.js';
import {
  initializeDatabase,
  isDatabaseInitialized,
  closeDatabase,
  exportDatabase,
  loadDatabaseFromData,
} from '@/lib/db/sql-loader';
import type {
  ForumPost,
  PlatformStats,
  PostFilters,
  TimeSeriesData,
  AuthorStats,
} from '@/lib/db/types';
import {
  getDatabaseSummary,
  getPosts,
  getRecentPosts,
  getPlatformStats,
  getPostsTimeSeries,
  getPostsByHour,
  getTopAuthors,
  getTopSources,
  getScrapingSessions,
  getPlatformComparison,
  getPostingHeatmap,
  getTrendingPosts,
  getEngagementMetrics,
  searchPosts,
} from '@/lib/db/queries';

// Cache key types
type CacheKey =
  | 'summary'
  | 'platformStats'
  | 'recentPosts'
  | 'trendingPosts'
  | 'topAuthors'
  | 'topSources'
  | 'engagementMetrics'
  | `posts_${string}`
  | `timeSeries_${number}`
  | `postsByHour_${number}`
  | `heatmap_${number}`
  | `search_${string}`;

// Cache entry type
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Database context type
export interface DatabaseContextType {
  // State
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  database: Database | null;

  // Cached data
  summary: ReturnType<typeof getDatabaseSummary> | null;
  recentPosts: ForumPost[];
  platformStats: PlatformStats[];
  trendingPosts: ForumPost[];

  // Database operations
  loadDatabase: (pathOrData?: string | Uint8Array) => Promise<void>;
  exportDatabase: () => Uint8Array | null;
  closeDatabase: () => void;
  refreshData: () => Promise<void>;
  clearCache: () => void;

  // Query functions with caching
  queryPosts: (filters?: PostFilters) => ForumPost[];
  queryRecentPosts: (limit?: number) => ForumPost[];
  queryPlatformStats: () => PlatformStats[];
  queryTimeSeries: (days?: number) => TimeSeriesData[];
  queryPostsByHour: (days?: number) => ReturnType<typeof getPostsByHour>;
  queryTopAuthors: (limit?: number) => AuthorStats[];
  queryTopSources: (limit?: number) => ReturnType<typeof getTopSources>;
  queryScrapingSessions: (limit?: number) => ReturnType<typeof getScrapingSessions>;
  queryPlatformComparison: () => ReturnType<typeof getPlatformComparison>;
  queryPostingHeatmap: (days?: number) => ReturnType<typeof getPostingHeatmap>;
  queryTrendingPosts: (limit?: number) => ForumPost[];
  queryEngagementMetrics: (days?: number) => ReturnType<typeof getEngagementMetrics>;
  searchPostsQuery: (query: string, limit?: number) => ForumPost[];
}

export const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// Default cache TTL (5 minutes)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

export function DatabaseProvider({
  children,
  cacheTTL = DEFAULT_CACHE_TTL,
}: {
  children: React.ReactNode;
  cacheTTL?: number;
}) {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [database, setDatabase] = useState<Database | null>(null);

  // Cached data state
  const [summary, setSummary] = useState<DatabaseContextType['summary']>(null);
  const [recentPosts, setRecentPosts] = useState<ForumPost[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<ForumPost[]>([]);

  // Query cache
  const [queryCache, setQueryCache] = useState<Map<CacheKey, CacheEntry<unknown>>>(new Map());

  // Check if cache entry is valid
  const isCacheValid = useCallback((entry: CacheEntry<unknown> | undefined): boolean => {
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }, []);

  // Get from cache or execute query
  const getCachedOrQuery = useCallback(
    <T,>(key: CacheKey, queryFn: () => T, ttl: number = cacheTTL): T => {
      const cached = queryCache.get(key);
      if (isCacheValid(cached)) {
        return cached!.data as T;
      }

      const data = queryFn();
      const newCache = new Map(queryCache);
      newCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      });
      setQueryCache(newCache);

      return data;
    },
    [queryCache, isCacheValid, cacheTTL]
  );

  // Refresh cached data
  const refreshDataFn = useCallback(async () => {
    if (!isDatabaseInitialized()) {
      return;
    }

    try {
      // Get database summary
      const dbSummary = getDatabaseSummary();
      setSummary(dbSummary);

      // Get recent posts
      const posts = getRecentPosts(10);
      setRecentPosts(posts);

      // Get platform stats
      const stats = getPlatformStats();
      setPlatformStats(stats);

      // Get trending posts
      const trending = getTrendingPosts(10);
      setTrendingPosts(trending);

      // Clear query cache to force refresh
      setQueryCache(new Map());
    } catch (err) {
      console.error('Failed to refresh data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    }
  }, []);

  // Load database from path or data
  const loadDatabaseFn = useCallback(
    async (pathOrData?: string | Uint8Array) => {
      console.log('loadDatabaseFn called with:', pathOrData);
      setIsLoading(true);
      setError(null);

      try {
        let db: Database;

        if (pathOrData instanceof Uint8Array) {
          console.log('Loading from binary data');
          // Load from binary data
          db = await loadDatabaseFromData(pathOrData);
        } else {
          console.log('Loading from path:', pathOrData || 'default');
          // Load from path or default
          db = await initializeDatabase(pathOrData ? { databasePath: pathOrData } : undefined);
        }

        console.log('Database object created:', db);
        setDatabase(db);
        setIsInitialized(true);

        // Clear cache when loading new database
        setQueryCache(new Map());

        // Load initial data
        await refreshDataFn();
      } catch (err) {
        console.error('Failed to load database:', err);
        setError(err instanceof Error ? err.message : 'Failed to load database');
        setIsInitialized(false);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshDataFn]
  );

  // Export database
  const exportDatabaseFn = useCallback((): Uint8Array | null => {
    return exportDatabase();
  }, []);

  // Close database
  const closeDatabaseFn = useCallback(() => {
    closeDatabase();
    setDatabase(null);
    setIsInitialized(false);
    setQueryCache(new Map());
    setSummary(null);
    setRecentPosts([]);
    setPlatformStats([]);
    setTrendingPosts([]);
  }, []);

  // Clear cache
  const clearCacheFn = useCallback(() => {
    setQueryCache(new Map());
  }, []);

  // Initialize database on mount
  useEffect(() => {
    console.log('DatabaseProvider mount - isInitialized:', isInitialized, 'isLoading:', isLoading);
    if (!isInitialized && !isLoading) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const dbPath = `${basePath}/data/sample.db`;
      console.log(`Attempting to load database from ${dbPath}`);
      loadDatabaseFn(dbPath)
        .then(() => console.log('Database loaded successfully'))
        .catch((err) => console.error('Failed to load database:', err));
    }
  }, []); // Only run once on mount

  // Query functions with caching
  const queryPosts = useCallback(
    (filters?: PostFilters): ForumPost[] => {
      if (!isDatabaseInitialized()) return [];
      const key: CacheKey = `posts_${JSON.stringify(filters || {})}`;
      return getCachedOrQuery(key, () => getPosts(filters));
    },
    [getCachedOrQuery]
  );

  const queryRecentPosts = useCallback(
    (limit: number = 10): ForumPost[] => {
      if (!isDatabaseInitialized()) return [];
      return getCachedOrQuery('recentPosts', () => getRecentPosts(limit));
    },
    [getCachedOrQuery]
  );

  const queryPlatformStats = useCallback((): PlatformStats[] => {
    if (!isDatabaseInitialized()) return [];
    return getCachedOrQuery('platformStats', () => getPlatformStats());
  }, [getCachedOrQuery]);

  const queryTimeSeries = useCallback(
    (days: number = 30): TimeSeriesData[] => {
      if (!isDatabaseInitialized()) return [];
      const key: CacheKey = `timeSeries_${days}`;
      return getCachedOrQuery(key, () => getPostsTimeSeries(days));
    },
    [getCachedOrQuery]
  );

  const queryPostsByHour = useCallback(
    (days: number = 7): ReturnType<typeof getPostsByHour> => {
      if (!isDatabaseInitialized()) return [];
      const key: CacheKey = `postsByHour_${days}`;
      return getCachedOrQuery(key, () => getPostsByHour(days));
    },
    [getCachedOrQuery]
  );

  const queryTopAuthors = useCallback(
    (limit: number = 10): AuthorStats[] => {
      if (!isDatabaseInitialized()) return [];
      return getCachedOrQuery('topAuthors', () => getTopAuthors(limit));
    },
    [getCachedOrQuery]
  );

  const queryTopSources = useCallback(
    (limit: number = 10): ReturnType<typeof getTopSources> => {
      if (!isDatabaseInitialized()) return [];
      return getCachedOrQuery('topSources', () => getTopSources(limit));
    },
    [getCachedOrQuery]
  );

  const queryScrapingSessions = useCallback(
    (limit: number = 20): ReturnType<typeof getScrapingSessions> => {
      if (!isDatabaseInitialized()) return [];
      return getCachedOrQuery('topSources', () => getScrapingSessions(limit));
    },
    [getCachedOrQuery]
  );

  const queryPlatformComparison = useCallback((): ReturnType<typeof getPlatformComparison> => {
    if (!isDatabaseInitialized()) return [];
    return getCachedOrQuery('platformStats', () => getPlatformComparison());
  }, [getCachedOrQuery]);

  const queryPostingHeatmap = useCallback(
    (days: number = 30): ReturnType<typeof getPostingHeatmap> => {
      if (!isDatabaseInitialized()) return [];
      const key: CacheKey = `heatmap_${days}`;
      return getCachedOrQuery(key, () => getPostingHeatmap(days));
    },
    [getCachedOrQuery]
  );

  const queryTrendingPosts = useCallback(
    (limit: number = 10): ForumPost[] => {
      if (!isDatabaseInitialized()) return [];
      return getCachedOrQuery('trendingPosts', () => getTrendingPosts(limit));
    },
    [getCachedOrQuery]
  );

  const queryEngagementMetrics = useCallback(
    (days: number = 30): ReturnType<typeof getEngagementMetrics> => {
      if (!isDatabaseInitialized()) return [];
      return getCachedOrQuery('engagementMetrics', () => getEngagementMetrics(days));
    },
    [getCachedOrQuery]
  );

  const searchPostsQuery = useCallback(
    (query: string, limit: number = 50): ForumPost[] => {
      if (!isDatabaseInitialized()) return [];
      const key: CacheKey = `search_${query}_${limit}`;
      return getCachedOrQuery(key, () => searchPosts(query, limit), 60000); // 1 minute cache for searches
    },
    [getCachedOrQuery]
  );

  // Clean up database on unmount
  useEffect(() => {
    return () => {
      if (isDatabaseInitialized()) {
        closeDatabase();
      }
    };
  }, []);

  // Memoize context value
  const value = useMemo<DatabaseContextType>(
    () => ({
      // State
      isLoading,
      isInitialized,
      error,
      database,

      // Cached data
      summary,
      recentPosts,
      platformStats,
      trendingPosts,

      // Database operations
      loadDatabase: loadDatabaseFn,
      exportDatabase: exportDatabaseFn,
      closeDatabase: closeDatabaseFn,
      refreshData: refreshDataFn,
      clearCache: clearCacheFn,

      // Query functions
      queryPosts,
      queryRecentPosts,
      queryPlatformStats,
      queryTimeSeries,
      queryPostsByHour,
      queryTopAuthors,
      queryTopSources,
      queryScrapingSessions,
      queryPlatformComparison,
      queryPostingHeatmap,
      queryTrendingPosts,
      queryEngagementMetrics,
      searchPostsQuery,
    }),
    [
      isLoading,
      isInitialized,
      error,
      database,
      summary,
      recentPosts,
      platformStats,
      trendingPosts,
      loadDatabaseFn,
      exportDatabaseFn,
      closeDatabaseFn,
      refreshDataFn,
      clearCacheFn,
      queryPosts,
      queryRecentPosts,
      queryPlatformStats,
      queryTimeSeries,
      queryPostsByHour,
      queryTopAuthors,
      queryTopSources,
      queryScrapingSessions,
      queryPlatformComparison,
      queryPostingHeatmap,
      queryTrendingPosts,
      queryEngagementMetrics,
      searchPostsQuery,
    ]
  );

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

// Custom hook to use database context
export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
