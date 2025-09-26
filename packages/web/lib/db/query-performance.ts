import { executeQuery } from './sql-loader';

// Query performance metrics
export interface QueryMetrics {
  query: string;
  params: unknown[];
  executionTime: number;
  rowsReturned: number;
  rowsScanned?: number;
  indexesUsed?: string[];
  timestamp: number;
  cached: boolean;
}

// Query plan analysis
export interface QueryPlan {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

// Performance threshold configuration
export interface PerformanceThresholds {
  slowQueryMs: number;
  largeResultSet: number;
  maxScanRows: number;
}

/**
 * Query Performance Monitor
 */
export class QueryPerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private slowQueries: QueryMetrics[] = [];
  private thresholds: PerformanceThresholds = {
    slowQueryMs: 100,
    largeResultSet: 1000,
    maxScanRows: 10000,
  };

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    if (thresholds) {
      this.thresholds = { ...this.thresholds, ...thresholds };
    }
  }

  /**
   * Execute query with performance tracking
   */
  executeWithMetrics<T>(
    sql: string,
    params: unknown[] = [],
    cached: boolean = false
  ): { result: T; metrics: QueryMetrics } {
    const startTime = performance.now();

    // Execute the query
    const result = executeQuery(sql, params) as T;

    const executionTime = performance.now() - startTime;
    const rowsReturned = Array.isArray(result) ? result.length : 1;

    // Create metrics object
    const metrics: QueryMetrics = {
      query: sql,
      params,
      executionTime,
      rowsReturned,
      timestamp: Date.now(),
      cached,
    };

    // Analyze if it's a slow query
    if (executionTime > this.thresholds.slowQueryMs) {
      this.slowQueries.push(metrics);
      console.warn(`Slow query detected (${executionTime.toFixed(2)}ms):`, sql.substring(0, 100));
    }

    // Store metrics
    this.metrics.push(metrics);
    this.cleanOldMetrics();

    return { result, metrics };
  }

  /**
   * Analyze query plan
   */
  analyzeQueryPlan(sql: string, params: unknown[] = []): QueryPlan[] {
    const explainSql = `EXPLAIN QUERY PLAN ${sql}`;
    return executeQuery(explainSql, params) as QueryPlan[];
  }

  /**
   * Get query optimization suggestions
   */
  getOptimizationSuggestions(sql: string): string[] {
    const suggestions: string[] = [];
    const upperSql = sql.toUpperCase();

    // Check for missing indexes
    if (upperSql.includes('WHERE') && !upperSql.includes('INDEX')) {
      const whereClause = sql.substring(upperSql.indexOf('WHERE'));
      const columns = this.extractColumnsFromWhere(whereClause);

      columns.forEach((col) => {
        suggestions.push(`Consider adding index on column: ${col}`);
      });
    }

    // Check for SELECT *
    if (upperSql.includes('SELECT *')) {
      suggestions.push('Avoid SELECT *, specify only needed columns');
    }

    // Check for missing LIMIT in queries without aggregation
    if (!upperSql.includes('LIMIT') && !upperSql.includes('COUNT') && !upperSql.includes('SUM')) {
      suggestions.push('Consider adding LIMIT to prevent large result sets');
    }

    // Check for LIKE with leading wildcard
    if (upperSql.includes("LIKE '%")) {
      suggestions.push('Leading wildcard in LIKE prevents index usage');
    }

    // Check for OR conditions
    if (upperSql.includes(' OR ')) {
      suggestions.push('OR conditions may prevent index usage, consider UNION');
    }

    // Check for NOT IN
    if (upperSql.includes('NOT IN')) {
      suggestions.push('NOT IN can be slow, consider NOT EXISTS or LEFT JOIN');
    }

    return suggestions;
  }

  /**
   * Extract column names from WHERE clause
   */
  private extractColumnsFromWhere(whereClause: string): string[] {
    const columns: string[] = [];
    const patterns = [
      /(\w+)\s*=\s*/g,
      /(\w+)\s*>\s*/g,
      /(\w+)\s*<\s*/g,
      /(\w+)\s*LIKE\s*/gi,
      /(\w+)\s*IN\s*/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(whereClause)) !== null) {
        if (match[1] && !['AND', 'OR', 'NOT', 'WHERE'].includes(match[1].toUpperCase())) {
          columns.push(match[1]);
        }
      }
    });

    return [...new Set(columns)];
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    if (this.metrics.length === 0) {
      return null;
    }

    const times = this.metrics.map((m) => m.executionTime);
    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    const totalRows = this.metrics.reduce((sum, m) => sum + m.rowsReturned, 0);
    const avgRows = totalRows / this.metrics.length;

    return {
      totalQueries: this.metrics.length,
      totalTime,
      avgTime,
      maxTime,
      minTime,
      totalRows,
      avgRows,
      slowQueries: this.slowQueries.length,
      cacheHitRate: this.metrics.filter((m) => m.cached).length / this.metrics.length,
    };
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 10): QueryMetrics[] {
    return this.slowQueries.sort((a, b) => b.executionTime - a.executionTime).slice(0, limit);
  }

  /**
   * Clean old metrics (keep last 1000)
   */
  private cleanOldMetrics() {
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
    if (this.slowQueries.length > 100) {
      this.slowQueries = this.slowQueries.slice(-100);
    }
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = [];
    this.slowQueries = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const stats = this.getStatistics();
    const slowQueries = this.getSlowQueries();

    return JSON.stringify(
      {
        statistics: stats,
        slowQueries: slowQueries.map((q) => ({
          query: q.query.substring(0, 200),
          executionTime: q.executionTime,
          rowsReturned: q.rowsReturned,
          timestamp: new Date(q.timestamp).toISOString(),
        })),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }
}

/**
 * Database statistics and health check
 */
export class DatabaseHealth {
  /**
   * Get database size and statistics
   */
  static getStatistics(): {
    tables: unknown;
    indexes: unknown;
    size: unknown;
    performance: unknown;
  } {
    const stats = {
      tables: this.getTableStats(),
      indexes: this.getIndexStats(),
      size: this.getDatabaseSize(),
      performance: this.getPerformanceStats(),
    };

    return stats;
  }

  /**
   * Get table statistics
   */
  private static getTableStats(): unknown[] {
    const sql = `
      SELECT 
        name as table_name,
        (SELECT COUNT(*) FROM posts) as row_count
      FROM sqlite_master 
      WHERE type='table' AND name='posts'
    `;

    return executeQuery(sql) as any[];
  }

  /**
   * Get index statistics
   */
  private static getIndexStats(): any[] {
    const sql = `
      SELECT 
        name as index_name,
        tbl_name as table_name
      FROM sqlite_master 
      WHERE type='index' AND tbl_name='posts'
    `;

    return executeQuery(sql) as any[];
  }

  /**
   * Get database size
   */
  private static getDatabaseSize(): number {
    try {
      const result = executeQuery(
        'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
      ) as any[];
      return result[0]?.size || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get performance statistics
   */
  private static getPerformanceStats(): any {
    try {
      // Check if statistics are available
      const sql = 'SELECT * FROM sqlite_stat1 LIMIT 1';
      executeQuery(sql);

      return {
        analyzed: true,
        message: 'Database statistics available',
      };
    } catch {
      return {
        analyzed: false,
        message: 'Run ANALYZE to generate statistics',
      };
    }
  }

  /**
   * Optimize database
   */
  static optimize(): void {
    const commands = [
      'ANALYZE', // Update statistics
      'VACUUM', // Reclaim space
      'PRAGMA optimize', // Run optimizations
    ];

    commands.forEach((cmd) => {
      try {
        executeQuery(cmd);
        console.log(`Successfully executed: ${cmd}`);
      } catch (error) {
        console.warn(`Failed to execute ${cmd}:`, error);
      }
    });
  }
}

/**
 * Query result prefetching for improved UX
 */
export class QueryPrefetcher {
  private prefetchCache = new Map<string, any>();
  private prefetchQueue: Array<() => Promise<any>> = [];
  private isPrefetching = false;

  /**
   * Prefetch query results
   */
  async prefetch<T>(key: string, queryFn: () => T, ttl: number = 60000): Promise<void> {
    this.prefetchQueue.push(async () => {
      const result = queryFn();
      this.prefetchCache.set(key, {
        data: result,
        timestamp: Date.now(),
        ttl,
      });
    });

    if (!this.isPrefetching) {
      this.processPrefetchQueue();
    }
  }

  /**
   * Get prefetched result
   */
  get<T>(key: string): T | null {
    const cached = this.prefetchCache.get(key);

    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.prefetchCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Process prefetch queue
   */
  private async processPrefetchQueue() {
    if (this.isPrefetching || this.prefetchQueue.length === 0) return;

    this.isPrefetching = true;

    while (this.prefetchQueue.length > 0) {
      const task = this.prefetchQueue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Prefetch error:', error);
        }
      }
    }

    this.isPrefetching = false;
  }

  /**
   * Clear cache
   */
  clear() {
    this.prefetchCache.clear();
    this.prefetchQueue = [];
  }
}

// Global instances
export const queryMonitor = new QueryPerformanceMonitor();
export const queryPrefetcher = new QueryPrefetcher();

// Export convenience functions
export function trackQuery<T>(sql: string, params: unknown[] = [], cached: boolean = false): T {
  const { result } = queryMonitor.executeWithMetrics<T>(sql, params, cached);
  return result;
}

export function analyzeQuery(
  sql: string,
  params: unknown[] = []
): {
  plan: QueryPlan[];
  suggestions: string[];
} {
  const plan = queryMonitor.analyzeQueryPlan(sql, params);
  const suggestions = queryMonitor.getOptimizationSuggestions(sql);

  return { plan, suggestions };
}
