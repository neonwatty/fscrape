import { executeQuery, executeQueryFirst } from './sql-loader';
import type { ForumPost, PostFilters, PlatformStats, TimeSeriesData, AuthorStats } from './types';

// Query result pagination interface
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Query optimization options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  useIndex?: string;
  explain?: boolean;
}

// Performance hints for query optimization
export interface QueryHints {
  indexedColumns?: string[];
  estimatedRows?: number;
  cacheKey?: string;
  cacheTTL?: number;
}

/**
 * Optimized query builder for posts with pagination and indexing
 */
export class OptimizedPostQuery {
  public sql: string = '';
  public params: unknown[] = [];
  private indexes: Set<string> = new Set();

  constructor(private filters: PostFilters = {}) {
    this.buildBaseQuery();
  }

  private buildBaseQuery() {
    // Use indexed columns for better performance
    this.sql = `
      SELECT 
        id, title, content, author, score, 
        num_comments, created_utc, url, 
        platform, source, permalink
      FROM posts 
      WHERE 1=1
    `.trim();
  }

  // Apply filters with index hints
  applyFilters(): this {
    if (this.filters.platform) {
      this.sql += ' AND platform = ?';
      this.params.push(this.filters.platform);
      this.indexes.add('idx_platform');
    }

    if (this.filters.source) {
      this.sql += ' AND source = ?';
      this.params.push(this.filters.source);
      this.indexes.add('idx_source');
    }

    if (this.filters.author) {
      this.sql += ' AND author = ?';
      this.params.push(this.filters.author);
      this.indexes.add('idx_author');
    }

    // Use full-text search if available, otherwise fallback to LIKE
    if (this.filters.searchTerm) {
      this.sql += ' AND (title LIKE ? OR content LIKE ?)';
      this.params.push(`%${this.filters.searchTerm}%`, `%${this.filters.searchTerm}%`);
    }

    // Date range filters with index optimization
    if (this.filters.dateFrom) {
      this.sql += ' AND created_utc >= ?';
      this.params.push(Math.floor(this.filters.dateFrom.getTime() / 1000));
      this.indexes.add('idx_created_utc');
    }

    if (this.filters.dateTo) {
      this.sql += ' AND created_utc <= ?';
      this.params.push(Math.floor(this.filters.dateTo.getTime() / 1000));
      this.indexes.add('idx_created_utc');
    }

    // Score range with index
    if (this.filters.scoreMin !== undefined) {
      this.sql += ' AND score >= ?';
      this.params.push(this.filters.scoreMin);
      this.indexes.add('idx_score');
    }

    if (this.filters.scoreMax !== undefined) {
      this.sql += ' AND score <= ?';
      this.params.push(this.filters.scoreMax);
      this.indexes.add('idx_score');
    }

    // Comments range filters
    if (this.filters.commentsMin !== undefined) {
      this.sql += ' AND num_comments >= ?';
      this.params.push(this.filters.commentsMin);
      this.indexes.add('idx_num_comments');
    }

    if (this.filters.commentsMax !== undefined) {
      this.sql += ' AND num_comments <= ?';
      this.params.push(this.filters.commentsMax);
      this.indexes.add('idx_num_comments');
    }

    return this;
  }

  // Apply sorting with index optimization
  applySorting(orderBy: string = 'created_utc', direction: 'ASC' | 'DESC' = 'DESC'): this {
    const validColumns = ['created_utc', 'score', 'num_comments', 'author', 'title'];
    const column = validColumns.includes(orderBy) ? orderBy : 'created_utc';

    this.sql += ` ORDER BY ${column} ${direction}`;
    this.indexes.add(`idx_${column}`);

    return this;
  }

  // Apply pagination with LIMIT and OFFSET
  applyPagination(page: number = 1, pageSize: number = 50): this {
    const limit = Math.min(pageSize, 1000); // Max 1000 records per page
    const offset = (page - 1) * limit;

    this.sql += ` LIMIT ? OFFSET ?`;
    this.params.push(limit, offset);

    return this;
  }

  // Execute with performance tracking
  execute(): ForumPost[] {
    return executeQuery(this.sql, this.params) as ForumPost[];
  }

  // Get query plan for debugging
  explain(): unknown {
    const explainSql = `EXPLAIN QUERY PLAN ${this.sql}`;
    return executeQuery(explainSql, this.params);
  }

  // Get recommended indexes
  getRecommendedIndexes(): string[] {
    return Array.from(this.indexes);
  }
}

/**
 * Get paginated posts with optimizations
 */
export function getOptimizedPosts(
  filters: PostFilters = {},
  page: number = 1,
  pageSize: number = 50,
  orderBy: string = 'created_utc',
  orderDirection: 'ASC' | 'DESC' = 'DESC'
): PaginatedResult<ForumPost> {
  // Build optimized query
  const query = new OptimizedPostQuery(filters)
    .applyFilters()
    .applySorting(orderBy, orderDirection)
    .applyPagination(page, pageSize);

  // Execute main query
  const data = query.execute();

  // Get total count (optimized with COUNT(*))
  const countQuery = new OptimizedPostQuery(filters).applyFilters();
  const countSql = countQuery.sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as count FROM');
  const countResult = executeQueryFirst(countSql, countQuery.params) as { count: number };
  const total = countResult?.count || 0;

  return {
    data,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Get recent posts with limit (optimized for dashboard)
 */
export function getRecentPostsOptimized(limit: number = 10, platform?: string): ForumPost[] {
  let sql = `
    SELECT 
      id, title, author, score, num_comments, 
      created_utc, platform, source
    FROM posts
  `;
  const params: unknown[] = [];

  if (platform) {
    sql += ' WHERE platform = ?';
    params.push(platform);
  }

  // Use index on created_utc for efficient sorting
  sql += ' ORDER BY created_utc DESC LIMIT ?';
  params.push(limit);

  return executeQuery(sql, params) as ForumPost[];
}

/**
 * Get top authors with optimized aggregation
 */
export function getTopAuthorsOptimized(
  limit: number = 10,
  filters: PostFilters = {}
): AuthorStats[] {
  let sql = `
    SELECT 
      author,
      COUNT(*) as post_count,
      SUM(score) as total_score,
      AVG(score) as avg_score,
      MAX(score) as max_score,
      SUM(num_comments) as total_comments
    FROM posts
    WHERE author IS NOT NULL AND author != '[deleted]'
  `;
  const params: unknown[] = [];

  // Apply filters
  if (filters.platform) {
    sql += ' AND platform = ?';
    params.push(filters.platform);
  }

  if (filters.dateFrom) {
    sql += ' AND created_utc >= ?';
    params.push(Math.floor(filters.dateFrom.getTime() / 1000));
  }

  if (filters.dateTo) {
    sql += ' AND created_utc <= ?';
    params.push(Math.floor(filters.dateTo.getTime() / 1000));
  }

  // Group and order with index optimization
  sql += `
    GROUP BY author
    HAVING post_count > 1
    ORDER BY total_score DESC
    LIMIT ?
  `;
  params.push(limit);

  return executeQuery(sql, params) as AuthorStats[];
}

/**
 * Get platform statistics with optimized aggregation
 */
export function getPlatformStatsOptimized(): PlatformStats[] {
  const sql = `
    SELECT 
      platform,
      COUNT(*) as post_count,
      SUM(score) as total_score,
      AVG(score) as avg_score,
      SUM(num_comments) as total_comments,
      AVG(num_comments) as avg_comments,
      MAX(created_utc) as latest_post,
      MIN(created_utc) as earliest_post
    FROM posts
    GROUP BY platform
    ORDER BY post_count DESC
  `;

  return executeQuery(sql) as PlatformStats[];
}

/**
 * Get time series data optimized for charts
 */
export function getTimeSeriesOptimized(
  interval: 'hour' | 'day' | 'week' | 'month' = 'day',
  filters: PostFilters = {}
): TimeSeriesData[] {
  // Calculate the appropriate time bucket based on interval
  const timeBucket = {
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
  }[interval];

  let sql = `
    SELECT 
      (created_utc / ?) * ? as time_bucket,
      COUNT(*) as post_count,
      SUM(score) as total_score,
      AVG(score) as avg_score,
      SUM(num_comments) as total_comments
    FROM posts
    WHERE 1=1
  `;
  const params: unknown[] = [timeBucket, timeBucket];

  // Apply filters
  if (filters.platform) {
    sql += ' AND platform = ?';
    params.push(filters.platform);
  }

  if (filters.dateFrom) {
    sql += ' AND created_utc >= ?';
    params.push(Math.floor(filters.dateFrom.getTime() / 1000));
  }

  if (filters.dateTo) {
    sql += ' AND created_utc <= ?';
    params.push(Math.floor(filters.dateTo.getTime() / 1000));
  }

  sql += `
    GROUP BY time_bucket
    ORDER BY time_bucket ASC
  `;

  const results = executeQuery(sql, params) as Array<{
    time_bucket: number;
    post_count: number;
    avg_score: number;
    total_comments: number;
  }>;

  return results.map((row) => ({
    date: new Date(row.time_bucket * 1000).toISOString(),
    count: row.post_count,
    avgScore: row.avg_score,
    avgComments: row.total_comments / row.post_count,
  }));
}

/**
 * Create indexes for optimization
 */
export function createOptimizedIndexes(): void {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_platform ON posts(platform)',
    'CREATE INDEX IF NOT EXISTS idx_subreddit ON posts(subreddit)',
    'CREATE INDEX IF NOT EXISTS idx_author ON posts(author)',
    'CREATE INDEX IF NOT EXISTS idx_created_utc ON posts(created_utc DESC)',
    'CREATE INDEX IF NOT EXISTS idx_score ON posts(score DESC)',
    'CREATE INDEX IF NOT EXISTS idx_num_comments ON posts(num_comments DESC)',
    // Covering index for common queries
    'CREATE INDEX IF NOT EXISTS idx_covering_main ON posts(platform, created_utc DESC, score DESC)',
    // Index for text search
    'CREATE INDEX IF NOT EXISTS idx_title ON posts(title)',
  ];

  indexes.forEach((sql) => {
    try {
      executeQuery(sql);
    } catch (error) {
      console.warn(`Failed to create index: ${sql}`, error);
    }
  });

  // Run ANALYZE to update statistics
  executeQuery('ANALYZE');
}

/**
 * Batch insert optimization for large datasets
 */
export function batchInsertPosts(posts: ForumPost[], batchSize: number = 500): void {
  const sql = `
    INSERT OR REPLACE INTO posts (
      id, title, content, author, score, 
      num_comments, created_utc, url, 
      platform, source, permalink
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Process in batches to avoid memory issues
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);

    // Use transaction for batch insert
    executeQuery('BEGIN TRANSACTION');

    try {
      batch.forEach((post) => {
        executeQuery(sql, [
          post.id,
          post.title,
          post.content,
          post.author,
          post.score,
          post.num_comments,
          post.created_utc,
          post.url,
          post.platform,
          post.source,
          post.permalink,
        ]);
      });

      executeQuery('COMMIT');
    } catch (error) {
      executeQuery('ROLLBACK');
      throw error;
    }
  }
}

/**
 * Query result caching for frequently accessed data
 */
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export function getCachedQuery<T>(cacheKey: string, queryFn: () => T, ttl: number = CACHE_TTL): T {
  const cached = queryCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = queryFn();
  queryCache.set(cacheKey, { data, timestamp: now });

  // Clean old cache entries
  if (queryCache.size > 100) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) {
      queryCache.delete(oldestKey);
    }
  }

  return data;
}
