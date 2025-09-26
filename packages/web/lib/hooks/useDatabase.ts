'use client';

import { useContext } from 'react';
import { DatabaseContext, DatabaseContextType } from '@/components/providers/DatabaseProvider';

/**
 * Custom hook to access database context
 * @returns DatabaseContextType with all database operations and state
 * @throws Error if used outside of DatabaseProvider
 */
export function useDatabase(): DatabaseContextType {
  const context = useContext(DatabaseContext);

  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }

  return context;
}

// Additional specialized hooks for common use cases

/**
 * Hook to get loading and error states
 */
export function useDatabaseStatus() {
  const { isLoading, isInitialized, error } = useDatabase();
  return { isLoading, isInitialized, error };
}

/**
 * Hook to get cached summary data
 */
export function useDatabaseSummary() {
  const { summary, refreshData } = useDatabase();
  return { summary, refreshData };
}

/**
 * Hook for post queries with filters
 */
export function usePostQueries() {
  const { queryPosts, queryRecentPosts, queryTrendingPosts, searchPostsQuery } = useDatabase();

  return {
    queryPosts,
    queryRecentPosts,
    queryTrendingPosts,
    searchPosts: searchPostsQuery,
  };
}

/**
 * Hook for analytics queries
 */
export function useAnalyticsQueries() {
  const {
    queryPlatformStats,
    queryTimeSeries,
    queryPostsByHour,
    queryTopAuthors,
    queryTopSources,
    queryPostingHeatmap,
    queryEngagementMetrics,
    queryPlatformComparison,
  } = useDatabase();

  return {
    queryPlatformStats,
    queryTimeSeries,
    queryPostsByHour,
    queryTopAuthors,
    queryTopSources,
    queryPostingHeatmap,
    queryEngagementMetrics,
    queryPlatformComparison,
  };
}

/**
 * Hook for database file operations
 */
export function useDatabaseFileOps() {
  const { loadDatabase, exportDatabase, closeDatabase } = useDatabase();

  return {
    loadDatabase,
    exportDatabase,
    closeDatabase,
  };
}
