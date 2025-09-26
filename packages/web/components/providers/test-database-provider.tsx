'use client';

import { DatabaseProvider, useDatabase } from './DatabaseProvider';
import { useDatabaseStatus, useDatabaseSummary, usePostQueries } from '@/lib/hooks/useDatabase';

// Test component that uses the database context
function TestDatabaseConsumer() {
  const { isLoading, isInitialized, error } = useDatabaseStatus();
  const { summary } = useDatabaseSummary();
  const { queryRecentPosts, searchPosts } = usePostQueries();

  // Test loading states
  if (isLoading) {
    return <div>Loading database...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!isInitialized) {
    return <div>Database not initialized</div>;
  }

  // Test successful data access
  const recentPosts = queryRecentPosts(5);
  const searchResults = searchPosts('test', 10);

  return (
    <div>
      <h2>Database Test</h2>
      <p>Total Posts: {summary?.totalPosts || 0}</p>
      <p>Total Authors: {summary?.totalAuthors || 0}</p>
      <p>Recent Posts: {recentPosts.length}</p>
      <p>Search Results: {searchResults.length}</p>
    </div>
  );
}

// Test wrapper component
export function TestDatabaseProvider() {
  return (
    <DatabaseProvider cacheTTL={60000}>
      <TestDatabaseConsumer />
    </DatabaseProvider>
  );
}

// Error boundary test
function TestErrorBoundary() {
  try {
    // This should throw an error when used outside provider
    const database = useDatabase();
    return <div>Should not render: {database.isInitialized}</div>;
  } catch (error) {
    return <div>✅ Error caught: {(error as Error).message}</div>;
  }
}

export function TestDatabaseContextErrors() {
  return (
    <div>
      <h2>Context Error Test</h2>
      <TestErrorBoundary />
    </div>
  );
}
