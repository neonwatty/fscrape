import { executeQuery, executeQueryFirst } from './sql-loader';
import type { ForumPost, PostFilters, PlatformStats, TimeSeriesData, AuthorStats } from './types';

export type { ForumPost, PostFilters, PlatformStats, TimeSeriesData, AuthorStats };

// Get posts with filters
export function getPosts(filters: PostFilters = {}): ForumPost[] {
  let sql = 'SELECT * FROM posts WHERE 1=1';
  const params: unknown[] = [];

  // Apply filters
  if (filters.platform) {
    sql += ' AND platform = ?';
    params.push(filters.platform);
  }

  if (filters.source) {
    sql += ' AND subreddit = ?';
    params.push(filters.source);
  }

  if (filters.author) {
    sql += ' AND author LIKE ?';
    params.push(`%${filters.author}%`);
  }

  if (filters.searchTerm) {
    sql += ' AND (title LIKE ? OR body LIKE ?)';
    params.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
  }

  if (filters.dateFrom) {
    sql += ' AND created_utc >= ?';
    params.push(Math.floor(filters.dateFrom.getTime() / 1000));
  }

  if (filters.dateTo) {
    sql += ' AND created_utc <= ?';
    params.push(Math.floor(filters.dateTo.getTime() / 1000));
  }

  if (filters.scoreMin !== undefined) {
    sql += ' AND score >= ?';
    params.push(filters.scoreMin);
  }

  if (filters.scoreMax !== undefined) {
    sql += ' AND score <= ?';
    params.push(filters.scoreMax);
  }

  if (filters.commentsMin !== undefined) {
    sql += ' AND num_comments >= ?';
    params.push(filters.commentsMin);
  }

  if (filters.commentsMax !== undefined) {
    sql += ' AND num_comments <= ?';
    params.push(filters.commentsMax);
  }

  // Apply time range filter
  if (filters.timeRange && filters.timeRange !== 'all') {
    const now = Math.floor(Date.now() / 1000);
    let timeAgo = now;

    switch (filters.timeRange) {
      case 'day':
        timeAgo = now - 86400;
        break;
      case 'week':
        timeAgo = now - 604800;
        break;
      case 'month':
        timeAgo = now - 2592000;
        break;
      case 'year':
        timeAgo = now - 31536000;
        break;
    }

    sql += ' AND created_utc >= ?';
    params.push(timeAgo);
  }

  // Apply sorting
  const sortBy = filters.sortBy || 'created_utc';
  const sortOrder = filters.sortOrder || 'desc';
  sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

  // Apply pagination
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return executeQuery<ForumPost>(sql, params);
}

// Get recent posts
export function getRecentPosts(limit: number = 10): ForumPost[] {
  return executeQuery<ForumPost>(
    `SELECT * FROM posts 
     ORDER BY created_utc DESC 
     LIMIT ?`,
    [limit]
  );
}

// Get post by ID
export function getPostById(id: string): ForumPost | null {
  return executeQueryFirst<ForumPost>('SELECT * FROM posts WHERE id = ?', [id]);
}

// Get platform statistics
export function getPlatformStats(): PlatformStats[] {
  return executeQuery<PlatformStats>(`
    SELECT 
      platform,
      COUNT(*) as totalPosts,
      AVG(score) as avgScore,
      AVG(num_comments) as avgComments,
      MAX(created_utc) as lastScraped
    FROM posts
    GROUP BY platform
    ORDER BY totalPosts DESC
  `);
}

// Get posts count by time period
export function getPostsTimeSeries(days: number = 30): TimeSeriesData[] {
  const now = Math.floor(Date.now() / 1000);
  const timeAgo = now - days * 86400;

  return executeQuery<TimeSeriesData>(
    `
    SELECT 
      DATE(created_utc, 'unixepoch') as date,
      COUNT(*) as count,
      AVG(score) as avgScore,
      AVG(num_comments) as avgComments
    FROM posts
    WHERE created_utc >= ?
    GROUP BY DATE(created_utc, 'unixepoch')
    ORDER BY date DESC
  `,
    [timeAgo]
  );
}

// Get posts by hour (for activity patterns)
export function getPostsByHour(
  days: number = 7
): { hour: number; count: number; avgScore: number }[] {
  const now = Math.floor(Date.now() / 1000);
  const timeAgo = now - days * 86400;

  return executeQuery(
    `
    SELECT 
      CAST(strftime('%H', created_utc, 'unixepoch') AS INTEGER) as hour,
      COUNT(*) as count,
      AVG(score) as avgScore
    FROM posts
    WHERE created_utc >= ?
    GROUP BY hour
    ORDER BY hour
  `,
    [timeAgo]
  );
}

// Get top authors with detailed stats
export function getTopAuthors(limit: number = 10): AuthorStats[] {
  return executeQuery<AuthorStats>(
    `
    SELECT 
      author,
      COUNT(*) as postCount,
      SUM(score) as totalScore,
      AVG(score) as avgScore,
      SUM(num_comments) as totalComments
    FROM posts
    WHERE author IS NOT NULL AND author != '[deleted]'
    GROUP BY author
    ORDER BY totalScore DESC
    LIMIT ?
  `,
    [limit]
  );
}

// Get author statistics (enhanced version)
export function getAuthorStats(username: string): AuthorStats | null {
  return executeQueryFirst<AuthorStats>(
    `
    SELECT 
      author,
      COUNT(*) as postCount,
      SUM(score) as totalScore,
      AVG(score) as avgScore,
      SUM(num_comments) as totalComments
    FROM posts
    WHERE author = ?
    GROUP BY author
  `,
    [username]
  );
}

// Get posts by hour heatmap data
export function getPostingHeatmap(days: number = 30) {
  const now = Math.floor(Date.now() / 1000);
  const timeAgo = now - days * 86400;

  return executeQuery<{ hour: number; dayOfWeek: number; count: number; avgScore: number }>(
    `
    SELECT 
      CAST(strftime('%H', created_utc, 'unixepoch') AS INTEGER) as hour,
      CAST(strftime('%w', created_utc, 'unixepoch') AS INTEGER) as dayOfWeek,
      COUNT(*) as count,
      AVG(score) as avgScore
    FROM posts
    WHERE created_utc >= ?
    GROUP BY hour, dayOfWeek
    ORDER BY dayOfWeek, hour
  `,
    [timeAgo]
  );
}

// Get top sources (subreddits or other sources)
export function getTopSources(
  limit: number = 10
): { source: string; platform: string; count: number; avgScore: number }[] {
  return executeQuery(
    `
    SELECT 
      COALESCE(subreddit, platform) as source,
      platform,
      COUNT(*) as count,
      AVG(score) as avgScore
    FROM posts
    GROUP BY source, platform
    ORDER BY count DESC
    LIMIT ?
  `,
    [limit]
  );
}

// Get scraping sessions (if we track them)
export function getScrapingSessions(limit: number = 20): {
  platform: string;
  sessionDate: string;
  postCount: number;
  avgScore: number;
}[] {
  return executeQuery(
    `
    SELECT 
      platform,
      DATE(created_utc, 'unixepoch') as sessionDate,
      COUNT(*) as postCount,
      AVG(score) as avgScore
    FROM posts
    GROUP BY platform, sessionDate
    ORDER BY sessionDate DESC
    LIMIT ?
  `,
    [limit]
  );
}

// Platform comparison data
export function getPlatformComparison(): {
  platform: string;
  totalPosts: number;
  avgScore: number;
  avgComments: number;
  topHour: number;
  topDay: number;
}[] {
  return executeQuery(`
    WITH platform_stats AS (
      SELECT 
        platform,
        COUNT(*) as totalPosts,
        AVG(score) as avgScore,
        AVG(num_comments) as avgComments
      FROM posts
      GROUP BY platform
    ),
    platform_peak_hour AS (
      SELECT 
        platform,
        CAST(strftime('%H', created_utc, 'unixepoch') AS INTEGER) as hour,
        COUNT(*) as count
      FROM posts
      GROUP BY platform, hour
    ),
    platform_peak_day AS (
      SELECT 
        platform,
        CAST(strftime('%w', created_utc, 'unixepoch') AS INTEGER) as day,
        COUNT(*) as count
      FROM posts
      GROUP BY platform, day
    ),
    peak_hours AS (
      SELECT 
        platform,
        hour as topHour
      FROM platform_peak_hour
      WHERE (platform, count) IN (
        SELECT platform, MAX(count)
        FROM platform_peak_hour
        GROUP BY platform
      )
    ),
    peak_days AS (
      SELECT 
        platform,
        day as topDay
      FROM platform_peak_day
      WHERE (platform, count) IN (
        SELECT platform, MAX(count)
        FROM platform_peak_day
        GROUP BY platform
      )
    )
    SELECT 
      ps.platform,
      ps.totalPosts,
      ps.avgScore,
      ps.avgComments,
      COALESCE(ph.topHour, 0) as topHour,
      COALESCE(pd.topDay, 0) as topDay
    FROM platform_stats ps
    LEFT JOIN peak_hours ph ON ps.platform = ph.platform
    LEFT JOIN peak_days pd ON ps.platform = pd.platform
    ORDER BY ps.totalPosts DESC
  `);
}

// Search posts
export function searchPosts(query: string, limit: number = 50): ForumPost[] {
  return executeQuery<ForumPost>(
    `
    SELECT * FROM posts
    WHERE title LIKE ? OR body LIKE ?
    ORDER BY score DESC
    LIMIT ?
  `,
    [`%${query}%`, `%${query}%`, limit]
  );
}

// Get unique sources (subreddits, HN categories, etc.)
export function getUniqueSources(): { platform: string; source: string; count: number }[] {
  return executeQuery(`
    SELECT 
      platform, 
      COALESCE(subreddit, platform) as source, 
      COUNT(*) as count
    FROM posts
    GROUP BY platform, source
    ORDER BY platform, count DESC
  `);
}

// Get database summary
export function getDatabaseSummary() {
  const totalPosts = executeQueryFirst<{ count: number }>('SELECT COUNT(*) as count FROM posts');
  const totalAuthors = executeQueryFirst<{ count: number }>(
    'SELECT COUNT(DISTINCT author) as count FROM posts WHERE author IS NOT NULL'
  );
  const dateRange = executeQueryFirst<{ minDate: number; maxDate: number }>(
    'SELECT MIN(created_utc) as minDate, MAX(created_utc) as maxDate FROM posts'
  );
  const platforms = getPlatformStats();

  return {
    totalPosts: totalPosts?.count || 0,
    totalAuthors: totalAuthors?.count || 0,
    dateRange: {
      from: dateRange?.minDate ? new Date(dateRange.minDate * 1000) : null,
      to: dateRange?.maxDate ? new Date(dateRange.maxDate * 1000) : null,
    },
    platforms,
  };
}

// Get trending posts (high score relative to age)
export function getTrendingPosts(limit: number = 10): ForumPost[] {
  const now = Math.floor(Date.now() / 1000);

  return executeQuery<ForumPost>(
    `
    SELECT *,
      (score / (1.0 + ((? - created_utc) / 3600.0))) as trending_score
    FROM posts
    WHERE created_utc >= ? - 86400 * 7  -- Last week
    ORDER BY trending_score DESC
    LIMIT ?
  `,
    [now, now, limit]
  );
}

// Get post engagement metrics
export function getEngagementMetrics(days: number = 30): {
  avgScore: number;
  avgComments: number;
  engagementRate: number;
  topEngagementHour: number;
}[] {
  const now = Math.floor(Date.now() / 1000);
  const timeAgo = now - days * 86400;

  return executeQuery(
    `
    SELECT 
      AVG(score) as avgScore,
      AVG(num_comments) as avgComments,
      AVG(CAST(num_comments AS REAL) / NULLIF(score, 0)) as engagementRate,
      (
        SELECT CAST(strftime('%H', created_utc, 'unixepoch') AS INTEGER)
        FROM posts
        WHERE created_utc >= ?
        GROUP BY strftime('%H', created_utc, 'unixepoch')
        ORDER BY SUM(score + num_comments) DESC
        LIMIT 1
      ) as topEngagementHour
    FROM posts
    WHERE created_utc >= ?
  `,
    [timeAgo, timeAgo]
  );
}
