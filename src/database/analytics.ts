import Database from "better-sqlite3";
import type { Platform } from "../types/core.js";

export interface PlatformStats {
  platform: Platform;
  totalPosts: number;
  totalComments: number;
  totalUsers: number;
  avgScore: number;
  avgPostScore: number;
  avgCommentScore: number;
  avgCommentCount: number;
  mostActiveUser: { username: string; posts: number; comments: number } | null;
  lastUpdateTime: Date;
}

export interface TrendingPost {
  id: string;
  title: string;
  url: string;
  author: string;
  score: number;
  commentCount: number;
  hotness: number;
  createdAt: Date;
  platform: Platform;
}

export interface UserActivity {
  username: string;
  platform: Platform;
  postCount: number;
  commentCount: number;
  totalKarma: number;
  avgPostScore: number;
  avgCommentScore: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface ScrapingPerformance {
  sessionId: string;
  platform: Platform;
  startedAt: Date;
  completedAt?: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  itemsPerSecond: number;
  errorRate: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  posts: number;
  comments: number;
  users: number;
  avgScore: number;
}

export class DatabaseAnalytics {
  private db: Database.Database;

  // Prepared statements for analytics
  private readonly stmtPlatformStats: Database.Statement;
  private readonly stmtUserActivity: Database.Statement;
  private readonly stmtScrapingPerformance: Database.Statement;
  private readonly stmtTimeSeriesHourly: Database.Statement;
  private readonly stmtTimeSeriesDaily: Database.Statement;
  private readonly stmtTopAuthors: Database.Statement;
  private readonly stmtEngagementRate: Database.Statement;
  private readonly stmtContentGrowth: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;

    // Ensure required tables exist before creating prepared statements
    this.ensureTablesExist();

    // Platform statistics
    this.stmtPlatformStats = db.prepare(`
      SELECT 
        p.platform,
        COUNT(DISTINCT p.id) as total_posts,
        COUNT(DISTINCT c.id) as total_comments,
        COUNT(DISTINCT u.id) as total_users,
        AVG(p.score) as avg_post_score,
        AVG(c.score) as avg_comment_score,
        MAX(p.scraped_at) as last_update
      FROM posts p
      LEFT JOIN comments c ON c.platform = p.platform
      LEFT JOIN users u ON u.platform = p.platform
      WHERE p.platform = ?
      GROUP BY p.platform
    `);

    // User activity analysis
    this.stmtUserActivity = db.prepare(`
      SELECT 
        u.username,
        u.platform,
        u.karma as total_karma,
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT c.id) as comment_count,
        AVG(p.score) as avg_post_score,
        AVG(c.score) as avg_comment_score,
        MIN(COALESCE(p.created_at, c.created_at)) as first_seen,
        MAX(COALESCE(p.created_at, c.created_at)) as last_seen
      FROM users u
      LEFT JOIN posts p ON p.author_id = u.id AND p.platform = u.platform
      LEFT JOIN comments c ON c.author_id = u.id AND c.platform = u.platform
      WHERE u.platform = ? AND u.username = ?
      GROUP BY u.username, u.platform
    `);

    // Scraping performance metrics
    this.stmtScrapingPerformance = db.prepare(`
      SELECT 
        s.id as session_id,
        s.platform,
        s.started_at,
        s.completed_at,
        SUM(m.requests_made) as total_requests,
        SUM(m.requests_successful) as successful_requests,
        SUM(m.requests_failed) as failed_requests,
        AVG(m.avg_response_time_ms) as avg_response_time,
        CAST((s.total_posts + s.total_comments + s.total_users) AS REAL) / 
          MAX(1, (COALESCE(s.completed_at, strftime('%s', 'now') * 1000) - s.started_at) / 1000.0) as items_per_second
      FROM scraping_sessions s
      LEFT JOIN scraping_metrics m ON m.id = CAST(s.id AS TEXT)
      WHERE s.id = ?
      GROUP BY s.id
    `);

    // Time series data - hourly
    this.stmtTimeSeriesHourly = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', datetime(created_at / 1000, 'unixepoch')) as hour,
        COUNT(*) as posts,
        AVG(score) as avg_score
      FROM posts
      WHERE platform = ? 
        AND created_at >= ?
        AND created_at <= ?
      GROUP BY hour
      ORDER BY hour DESC
    `);

    // Time series data - daily
    this.stmtTimeSeriesDaily = db.prepare(`
      SELECT 
        date,
        posts_count as posts,
        comments_count as comments,
        users_count as users,
        avg_score,
        avg_engagement
      FROM daily_stats
      WHERE platform = ?
        AND date >= date('now', '-30 days')
      ORDER BY date DESC
    `);

    // Top authors by score
    this.stmtTopAuthors = db.prepare(`
      SELECT 
        author,
        COUNT(*) as post_count,
        SUM(score) as total_score,
        AVG(score) as avg_score,
        MAX(score) as best_score
      FROM posts
      WHERE platform = ?
        AND created_at >= ?
      GROUP BY author
      ORDER BY total_score DESC
      LIMIT ?
    `);

    // Engagement rate analysis
    this.stmtEngagementRate = db.prepare(`
      SELECT 
        AVG(engagement_rate) as avg_engagement,
        MIN(engagement_rate) as min_engagement,
        MAX(engagement_rate) as max_engagement,
        COUNT(CASE WHEN engagement_rate > 0.1 THEN 1 END) as high_engagement_posts,
        COUNT(CASE WHEN engagement_rate < 0.01 THEN 1 END) as low_engagement_posts
      FROM posts
      WHERE platform = ?
        AND created_at >= ?
    `);

    // Content growth over time
    this.stmtContentGrowth = db.prepare(`
      SELECT 
        date(created_at / 1000, 'unixepoch') as day,
        COUNT(*) as new_posts,
        SUM(COUNT(*)) OVER (ORDER BY date(created_at / 1000, 'unixepoch')) as cumulative_posts
      FROM posts
      WHERE platform = ?
        AND created_at >= ?
      GROUP BY day
      ORDER BY day DESC
    `);
  }

  // ============================================================================
  // Analytics Methods
  // ============================================================================

  // Alias methods for test compatibility
  getPlatformStatistics(platform?: Platform): PlatformStats[] {
    if (platform) {
      const stats = this.getPlatformStats(platform);
      return stats ? [stats] : [];
    }

    // Get stats for all platforms
    const platforms: Platform[] = ["reddit", "hackernews"];
    return platforms
      .map((p) => this.getPlatformStats(p))
      .filter((stats) => stats !== null) as PlatformStats[];
  }

  getPostsByDateRange(
    startDate: Date,
    endDate: Date,
    platform?: Platform,
  ): any[] {
    const query = platform
      ? `SELECT * FROM posts WHERE created_at >= ? AND created_at <= ? AND platform = ? ORDER BY created_at DESC`
      : `SELECT * FROM posts WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`;

    const params = platform
      ? [startDate.getTime(), endDate.getTime(), platform]
      : [startDate.getTime(), endDate.getTime()];

    return this.db.prepare(query).all(...params) as any[];
  }

  getTopUsersByKarma(limit: number, platform?: Platform): any[] {
    let query: string;
    let params: any[];

    if (platform) {
      query = `
        SELECT 
          u.id,
          u.username,
          u.platform,
          u.karma
        FROM users u
        WHERE u.platform = ?
        ORDER BY u.karma DESC
        LIMIT ?
      `;
      params = [platform, limit];
    } else {
      query = `
        SELECT 
          u.id,
          u.username,
          u.platform,
          u.karma
        FROM users u
        ORDER BY u.karma DESC
        LIMIT ?
      `;
      params = [limit];
    }

    return this.db.prepare(query).all(...params) as any[];
  }

  getEngagementOverTime(days: number, platform?: Platform): any[] {
    const sinceTime = Date.now() - days * 24 * 60 * 60 * 1000;

    let query: string;
    let params: any[];

    if (platform) {
      query = `
        SELECT 
          date(created_at / 1000, 'unixepoch') as date,
          platform,
          COUNT(*) as posts,
          SUM(score) as totalScore,
          SUM(comment_count) as totalComments,
          AVG(score) as avgScore,
          AVG(comment_count) as avgComments
        FROM posts
        WHERE created_at >= ? AND platform = ?
        GROUP BY date, platform
        ORDER BY date DESC
      `;
      params = [sinceTime, platform];
    } else {
      query = `
        SELECT 
          date(created_at / 1000, 'unixepoch') as date,
          'all' as platform,
          COUNT(*) as posts,
          SUM(score) as totalScore,
          SUM(comment_count) as totalComments,
          AVG(score) as avgScore,
          AVG(comment_count) as avgComments
        FROM posts
        WHERE created_at >= ?
        GROUP BY date
        ORDER BY date DESC
      `;
      params = [sinceTime];
    }

    return this.db.prepare(query).all(...params) as any[];
  }

  getMostEngagedPosts(limit: number, platform?: Platform): any[] {
    let query: string;
    let params: any[];

    if (platform) {
      query = `
        SELECT 
          id,
          title,
          url,
          author,
          score,
          comment_count,
          (score + comment_count) as totalEngagement,
          platform
        FROM posts
        WHERE platform = ?
        ORDER BY totalEngagement DESC
        LIMIT ?
      `;
      params = [platform, limit];
    } else {
      query = `
        SELECT 
          id,
          title,
          url,
          author,
          score,
          comment_count,
          (score + comment_count) as totalEngagement,
          platform
        FROM posts
        ORDER BY totalEngagement DESC
        LIMIT ?
      `;
      params = [limit];
    }

    return this.db.prepare(query).all(...params) as any[];
  }

  getMostDiscussedPosts(limit: number, platform?: Platform): any[] {
    let query: string;
    let params: any[];

    if (platform) {
      query = `
        SELECT 
          id,
          title,
          url,
          author,
          score,
          comment_count as commentCount,
          platform
        FROM posts
        WHERE platform = ? AND comment_count > 0
        ORDER BY comment_count DESC
        LIMIT ?
      `;
      params = [platform, limit];
    } else {
      query = `
        SELECT 
          id,
          title,
          url,
          author,
          score,
          comment_count as commentCount,
          platform
        FROM posts
        WHERE comment_count > 0
        ORDER BY comment_count DESC
        LIMIT ?
      `;
      params = [limit];
    }

    return this.db.prepare(query).all(...params) as any[];
  }

  getPostsWithHighCommentRatio(limit: number, platform?: Platform): any[] {
    let query: string;
    let params: any[];

    if (platform) {
      query = `
        SELECT 
          id,
          title,
          url,
          author,
          score,
          comment_count,
          CASE 
            WHEN score = 0 THEN comment_count
            ELSE CAST(comment_count AS REAL) / score
          END as commentRatio,
          platform
        FROM posts
        WHERE platform = ? AND score > 0
        ORDER BY commentRatio DESC
        LIMIT ?
      `;
      params = [platform, limit];
    } else {
      query = `
        SELECT 
          id,
          title,
          url,
          author,
          score,
          comment_count,
          CASE 
            WHEN score = 0 THEN comment_count
            ELSE CAST(comment_count AS REAL) / score
          END as commentRatio,
          platform
        FROM posts
        WHERE score > 0
        ORDER BY commentRatio DESC
        LIMIT ?
      `;
      params = [limit];
    }

    return this.db.prepare(query).all(...params) as any[];
  }

  getDataGaps(thresholdDays: number): any[] {
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    const query = `
      WITH sorted_posts AS (
        SELECT 
          id,
          platform,
          created_at,
          LAG(created_at, 1) OVER (PARTITION BY platform ORDER BY created_at) as prev_created_at
        FROM posts
        ORDER BY platform, created_at
      )
      SELECT 
        platform,
        datetime(prev_created_at / 1000, 'unixepoch') as startDate,
        datetime(created_at / 1000, 'unixepoch') as endDate,
        (created_at - prev_created_at) / 1000.0 / 86400 as gapDays
      FROM sorted_posts
      WHERE (created_at - prev_created_at) > ?
      ORDER BY gapDays DESC
    `;

    return this.db.prepare(query).all(thresholdMs) as any[];
  }

  getSessionPerformance(): any[] {
    const query = `
      SELECT 
        id as session_id,
        platform,
        status,
        query_value,
        total_posts as totalPosts,
        total_comments as totalComments,
        total_users as totalUsers,
        (COALESCE(total_posts, 0) + 
         COALESCE(total_comments, 0) + 
         COALESCE(total_users, 0)) as totalItems,
        started_at as created_at,
        completed_at as updated_at
      FROM scraping_sessions
      WHERE status = 'completed'
      ORDER BY started_at DESC
    `;

    return this.db.prepare(query).all() as any[];
  }

  getSuccessfulSessionRate(): number {
    const query = `
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(*) as total
      FROM scraping_sessions
    `;

    const result = this.db.prepare(query).get() as any;
    return result.total > 0 ? result.successful / result.total : 0;
  }

  getUserActivity(userId: string): any {
    const userQuery = this.db.prepare(`
      SELECT 
        u.id as userId,
        u.username,
        u.platform,
        COUNT(DISTINCT p.id) as postCount,
        COUNT(DISTINCT c.id) as commentCount,
        AVG(p.score) as avgPostScore,
        AVG(c.score) as avgCommentScore,
        u.karma as totalKarma,
        u.created_at as firstSeen,
        u.last_seen_at as lastSeen
      FROM users u
      LEFT JOIN posts p ON p.author_id = u.id
      LEFT JOIN comments c ON c.author_id = u.id
      WHERE u.id = ?
      GROUP BY u.id
    `);

    const result = userQuery.get(userId) as any;

    if (!result) {
      return {
        userId,
        postCount: 0,
        commentCount: 0,
        avgPostScore: 0,
        avgCommentScore: 0,
        totalKarma: 0,
        totalEngagement: 0,
      };
    }

    return {
      userId: result.userId,
      username: result.username,
      platform: result.platform,
      postCount: result.postCount || 0,
      commentCount: result.commentCount || 0,
      avgPostScore: result.avgPostScore || 0,
      avgCommentScore: result.avgCommentScore || 0,
      totalKarma: result.totalKarma || 0,
      totalEngagement: (result.postCount || 0) + (result.commentCount || 0),
      firstSeen: result.firstSeen,
      lastSeen: result.lastSeen,
    };
  }

  getPlatformStats(platform: Platform): PlatformStats | null {
    const row = this.stmtPlatformStats.get(platform) as any;

    if (!row) return null;

    // Get average comment count per post
    const avgCommentQuery = this.db.prepare(`
      SELECT AVG(comment_count) as avg_comment_count
      FROM posts
      WHERE platform = ?
    `);
    const avgCommentRow = avgCommentQuery.get(platform) as any;

    // Get most active user
    const mostActiveQuery = this.db.prepare(`
      SELECT 
        u.username,
        COUNT(DISTINCT p.id) as posts,
        COUNT(DISTINCT c.id) as comments
      FROM users u
      LEFT JOIN posts p ON p.author_id = u.id AND p.platform = u.platform
      LEFT JOIN comments c ON c.author_id = u.id AND c.platform = u.platform
      WHERE u.platform = ?
      GROUP BY u.username
      ORDER BY (posts + comments) DESC
      LIMIT 1
    `);

    const mostActive = mostActiveQuery.get(platform) as any;

    return {
      platform: row.platform,
      totalPosts: row.total_posts || 0,
      totalComments: row.total_comments || 0,
      totalUsers: row.total_users || 0,
      avgScore: row.avg_post_score || 0, // Map avg_post_score to avgScore
      avgPostScore: row.avg_post_score || 0,
      avgCommentScore: row.avg_comment_score || 0,
      avgCommentCount: avgCommentRow?.avg_comment_count || 0,
      mostActiveUser: mostActive
        ? {
            username: mostActive.username,
            posts: mostActive.posts,
            comments: mostActive.comments,
          }
        : null,
      lastUpdateTime: new Date(row.last_update || Date.now()),
    };
  }

  getTrendingPosts(limit: number): TrendingPost[];
  getTrendingPosts(limit: number, platform: Platform): TrendingPost[];
  getTrendingPosts(
    limit: number,
    platform: Platform | undefined,
    startDate: Date,
  ): TrendingPost[];
  getTrendingPosts(
    arg1: number | Platform,
    arg2?: number | Platform | Date,
    arg3?: number | Date,
  ): TrendingPost[] {
    // Handle different overload patterns
    let platform: Platform | undefined;
    let limit: number;
    let hours = 24;
    let startDate: Date | undefined;

    if (typeof arg1 === "number") {
      // First overload: getTrendingPosts(limit)
      limit = arg1;

      if (typeof arg2 === "string") {
        // Second overload: getTrendingPosts(limit, platform)
        platform = arg2 as Platform;
      } else if (arg2 instanceof Date) {
        // Third overload: getTrendingPosts(limit, undefined, startDate)
        startDate = arg2;
      } else if (arg2 === undefined && arg3 instanceof Date) {
        // Third overload: getTrendingPosts(limit, undefined, startDate)
        startDate = arg3;
      }
    } else if (typeof arg1 === "string") {
      // Old signature: getTrendingPosts(platform, hours, limit)
      platform = arg1 as Platform;
      hours = typeof arg2 === "number" ? arg2 : 24;
      limit = typeof arg3 === "number" ? arg3 : 10;
    } else {
      // Default values
      limit = 10;
    }

    const sinceTime = startDate
      ? startDate.getTime()
      : Date.now() - hours * 60 * 60 * 1000;

    // Build query based on whether platform is specified
    let query: string;
    let params: any[];

    if (platform) {
      query = `
        SELECT 
          p.id,
          p.title,
          p.url,
          p.author,
          p.score,
          p.comment_count,
          p.created_at,
          p.platform,
          CAST((p.score + p.comment_count * 2) AS REAL) / 
            (1 + (strftime('%s', 'now') * 1000 - p.created_at) / 3600000.0) AS hotness
        FROM posts p
        WHERE p.platform = ? 
          AND p.created_at > ?
        ORDER BY hotness DESC
        LIMIT ?
      `;
      params = [platform, sinceTime, limit];
    } else {
      query = `
        SELECT 
          p.id,
          p.title,
          p.url,
          p.author,
          p.score,
          p.comment_count,
          p.created_at,
          p.platform,
          CAST((p.score + p.comment_count * 2) AS REAL) / 
            (1 + (strftime('%s', 'now') * 1000 - p.created_at) / 3600000.0) AS hotness
        FROM posts p
        WHERE p.created_at > ?
        ORDER BY hotness DESC
        LIMIT ?
      `;
      params = [sinceTime, limit];
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      author: row.author,
      score: row.score,
      commentCount: row.comment_count,
      hotness: row.hotness,
      createdAt: new Date(row.created_at),
      platform: row.platform,
    }));
  }

  getUserActivityByUsername(
    username: string,
    platform: Platform,
  ): UserActivity | null {
    const row = this.stmtUserActivity.get(platform, username) as any;

    if (!row) return null;

    return {
      username: row.username,
      platform: row.platform,
      postCount: row.post_count || 0,
      commentCount: row.comment_count || 0,
      totalKarma: row.total_karma || 0,
      avgPostScore: row.avg_post_score || 0,
      avgCommentScore: row.avg_comment_score || 0,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
    };
  }

  getScrapingPerformance(sessionId: string): ScrapingPerformance | null {
    const row = this.stmtScrapingPerformance.get(sessionId) as any;

    if (!row) return null;

    const errorRate =
      row.total_requests > 0
        ? (row.failed_requests / row.total_requests) * 100
        : 0;

    const result: ScrapingPerformance = {
      sessionId: row.session_id,
      platform: row.platform,
      startedAt: new Date(row.started_at),
      totalRequests: row.total_requests || 0,
      successfulRequests: row.successful_requests || 0,
      failedRequests: row.failed_requests || 0,
      avgResponseTime: row.avg_response_time || 0,
      itemsPerSecond: row.items_per_second || 0,
      errorRate,
    };

    if (row.completed_at) {
      result.completedAt = new Date(row.completed_at);
    }

    return result;
  }

  getTimeSeriesData(
    platform: Platform,
    startDate: Date,
    endDate: Date,
    granularity: "hourly" | "daily" = "daily",
  ): TimeSeriesData[] {
    if (granularity === "hourly") {
      const rows = this.stmtTimeSeriesHourly.all(
        platform,
        startDate.getTime(),
        endDate.getTime(),
      ) as any[];

      return rows.map((row) => ({
        timestamp: new Date(row.hour),
        posts: row.posts,
        comments: 0, // Would need separate query for comments
        users: 0, // Would need separate query for users
        avgScore: row.avg_score,
      }));
    } else {
      const rows = this.stmtTimeSeriesDaily.all(platform) as any[];

      return rows.map((row) => ({
        timestamp: new Date(row.date),
        posts: row.posts || 0,
        comments: row.comments || 0,
        users: row.users || 0,
        avgScore: row.avg_score || 0,
      }));
    }
  }

  getTopAuthors(
    platform: Platform,
    days = 7,
    limit = 10,
  ): Array<{
    author: string;
    postCount: number;
    totalScore: number;
    avgScore: number;
    bestScore: number;
  }> {
    const sinceTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = this.stmtTopAuthors.all(platform, sinceTime, limit) as any[];

    return rows.map((row) => ({
      author: row.author,
      postCount: row.post_count,
      totalScore: row.total_score,
      avgScore: row.avg_score,
      bestScore: row.best_score,
    }));
  }

  getEngagementStats(
    platform: Platform,
    days = 30,
  ): {
    avgEngagement: number;
    minEngagement: number;
    maxEngagement: number;
    highEngagementPosts: number;
    lowEngagementPosts: number;
  } {
    const sinceTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const row = this.stmtEngagementRate.get(platform, sinceTime) as any;

    return {
      avgEngagement: row?.avg_engagement || 0,
      minEngagement: row?.min_engagement || 0,
      maxEngagement: row?.max_engagement || 0,
      highEngagementPosts: row?.high_engagement_posts || 0,
      lowEngagementPosts: row?.low_engagement_posts || 0,
    };
  }

  getContentGrowth(
    platform: Platform,
    days = 30,
  ): Array<{
    date: Date;
    newPosts: number;
    cumulativePosts: number;
  }> {
    const sinceTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = this.stmtContentGrowth.all(platform, sinceTime) as any[];

    return rows.map((row) => ({
      date: new Date(row.day),
      newPosts: row.new_posts,
      cumulativePosts: row.cumulative_posts,
    }));
  }

  // ============================================================================
  // Summary Reports
  // ============================================================================

  generateDailySummary(platform: Platform): {
    today: PlatformStats;
    trending: TrendingPost[];
    topAuthors: Array<{
      author: string;
      postCount: number;
      totalScore: number;
      avgScore: number;
      bestScore: number;
    }>;
    engagement: {
      avgEngagement: number;
      minEngagement: number;
      maxEngagement: number;
      highEngagementPosts: number;
      lowEngagementPosts: number;
    };
    growth: Array<{
      date: Date;
      newPosts: number;
      cumulativePosts: number;
    }>;
  } {
    return {
      today: this.getPlatformStats(platform)!,
      trending: this.getTrendingPosts(10, platform),
      topAuthors: this.getTopAuthors(platform, 1, 5),
      engagement: this.getEngagementStats(platform, 1),
      growth: this.getContentGrowth(platform, 7),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private ensureTablesExist(): void {
    // Check if core tables exist
    const tables = [
      "posts",
      "comments",
      "users",
      "scraping_sessions",
      "scraping_metrics",
      "daily_stats",
    ];

    for (const table of tables) {
      const exists = this.db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
        )
        .get(table);

      if (!exists) {
        // Create basic table structures if they don't exist
        // This is a failsafe - proper schema should be created via migrations
        this.createBasicTable(table);
      }
    }
  }

  private createBasicTable(tableName: string): void {
    // Create minimal table structures to prevent crashes
    // These will be properly migrated later
    const schemas: Record<string, string> = {
      posts: `
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          title TEXT,
          content TEXT,
          url TEXT,
          author TEXT,
          score INTEGER DEFAULT 0,
          comment_count INTEGER DEFAULT 0,
          created_at INTEGER,
          scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          engagement_rate REAL GENERATED ALWAYS AS (
            CASE 
              WHEN (score + comment_count) = 0 THEN 0.0
              ELSE CAST(comment_count AS REAL) / (score + comment_count)
            END
          ) STORED
        )
      `,
      comments: `
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          post_id TEXT,
          parent_id TEXT,
          author TEXT,
          content TEXT,
          score INTEGER DEFAULT 0,
          created_at INTEGER
        )
      `,
      users: `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          username TEXT,
          karma INTEGER DEFAULT 0,
          created_at INTEGER,
          last_seen_at INTEGER
        )
      `,
      scraping_sessions: `
        CREATE TABLE IF NOT EXISTS scraping_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          platform TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          started_at INTEGER,
          completed_at INTEGER
        )
      `,
      scraping_metrics: `
        CREATE TABLE IF NOT EXISTS scraping_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT,
          time_bucket INTEGER,
          requests_made INTEGER DEFAULT 0,
          requests_successful INTEGER DEFAULT 0,
          requests_failed INTEGER DEFAULT 0,
          items_scraped INTEGER DEFAULT 0,
          avg_response_time_ms INTEGER DEFAULT 0
        )
      `,
      daily_stats: `
        CREATE TABLE IF NOT EXISTS daily_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          platform TEXT NOT NULL,
          posts_count INTEGER DEFAULT 0,
          comments_count INTEGER DEFAULT 0,
          users_count INTEGER DEFAULT 0,
          avg_score REAL DEFAULT 0,
          avg_engagement REAL DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          UNIQUE(date, platform)
        )
      `,
    };

    if (schemas[tableName]) {
      this.db.exec(schemas[tableName]);
    }
  }

  // ============================================================================
  // Database Health Metrics
  // ============================================================================

  getDatabaseHealth(): any {
    try {
      // Get total counts
      const postCount = this.db
        .prepare("SELECT COUNT(*) as count FROM posts")
        .get() as any;
      const commentCount = this.db
        .prepare("SELECT COUNT(*) as count FROM comments")
        .get() as any;
      const userCount = this.db
        .prepare("SELECT COUNT(*) as count FROM users")
        .get() as any;
      const sessionCount = this.db
        .prepare("SELECT COUNT(*) as count FROM scraping_sessions")
        .get() as any;

      // Get oldest and newest posts
      const oldestPost = this.db
        .prepare("SELECT MIN(created_at) as created_at FROM posts")
        .get() as any;
      const newestPost = this.db
        .prepare("SELECT MAX(created_at) as created_at FROM posts")
        .get() as any;

      // Get database size
      const dbInfo = this.db.prepare("PRAGMA page_count").get() as any;
      const pageSize = this.db.prepare("PRAGMA page_size").get() as any;
      const databaseSize = dbInfo.page_count * pageSize.page_size;

      // Get platform breakdown
      const platformStats = this.db
        .prepare(
          `
        SELECT 
          platform,
          COUNT(*) as posts
        FROM posts
        GROUP BY platform
      `,
        )
        .all() as any[];

      // Calculate average posts per day if we have posts
      let avgPostsPerDay = 0;
      let avgCommentsPerPost = 0;

      if (postCount?.count > 0) {
        if (oldestPost?.created_at && newestPost?.created_at) {
          const daySpan =
            (newestPost.created_at - oldestPost.created_at) /
              (1000 * 60 * 60 * 24) || 1;
          avgPostsPerDay = postCount.count / Math.max(daySpan, 1);
        }
        avgCommentsPerPost = (commentCount?.count || 0) / postCount.count;
      }

      return {
        totalPosts: postCount?.count || 0,
        totalComments: commentCount?.count || 0,
        totalUsers: userCount?.count || 0,
        totalSessions: sessionCount?.count || 0,
        databaseSize: databaseSize || 0,
        oldestPost: oldestPost?.created_at
          ? new Date(oldestPost.created_at)
          : null,
        newestPost: newestPost?.created_at
          ? new Date(newestPost.created_at)
          : null,
        avgPostsPerDay,
        avgCommentsPerPost,
        platformBreakdown: platformStats || [],
        lastUpdate: new Date(),
      };
    } catch (_error) {
      // Return minimal health data if there's an error
      return {
        totalPosts: 0,
        totalComments: 0,
        totalUsers: 0,
        totalSessions: 0,
        databaseSize: 0,
        oldestPost: null,
        newestPost: null,
        avgPostsPerDay: 0,
        avgCommentsPerPost: 0,
        platformBreakdown: [],
        lastUpdate: new Date(),
      };
    }
  }

  getDatabaseHealthDetailed(): {
    totalSize: number;
    tableStats: Array<{
      table: string;
      rowCount: number;
      avgRowSize: number;
    }>;
    indexUsage: Array<{
      index: string;
      used: boolean;
    }>;
    vacuumNeeded: boolean;
  } {
    // Get database file size
    const dbInfo = this.db.prepare("PRAGMA page_count").get() as any;
    const pageSize = this.db.prepare("PRAGMA page_size").get() as any;
    const totalSize = dbInfo.page_count * pageSize.page_size;

    // Get table statistics
    const tables = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      )
      .all() as any[];

    const tableStats = tables.map((table) => {
      try {
        const count = this.db
          .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
          .get() as any;
        return {
          table: table.name,
          rowCount: count.count,
          avgRowSize:
            count.count > 0 ? totalSize / count.count / tables.length : 0,
        };
      } catch (_error) {
        // Table might not exist or be accessible
        return {
          table: table.name,
          rowCount: 0,
          avgRowSize: 0,
        };
      }
    });

    // Check if vacuum is needed (simplified check)
    const freePages = this.db.prepare("PRAGMA freelist_count").get() as any;
    const vacuumNeeded = freePages.freelist_count > dbInfo.page_count * 0.1;

    return {
      totalSize,
      tableStats,
      indexUsage: [], // Would need more complex analysis
      vacuumNeeded,
    };
  }

  // ============================================================================
  // Advanced Statistical Analysis
  // ============================================================================

  /**
   * Calculate moving average for a metric over time
   */
  getMovingAverage(
    platform: Platform,
    metric: 'score' | 'comments' | 'engagement',
    windowDays: number,
    periodDays: number = 30
  ): Array<{ date: string; value: number; movingAvg: number }> {
    const endTime = Date.now();
    const startTime = endTime - (periodDays * 24 * 60 * 60 * 1000);

    // Get daily aggregated data
    const query = this.db.prepare(`
      SELECT
        date(created_at / 1000, 'unixepoch') as date,
        AVG(${metric === 'score' ? 'score' : metric === 'comments' ? 'comment_count' : 'engagement_rate'}) as value
      FROM posts
      WHERE platform = ? AND created_at >= ? AND created_at <= ?
      GROUP BY date
      ORDER BY date
    `);

    const dailyData = query.all(platform, startTime, endTime) as Array<{ date: string; value: number }>;

    // Calculate moving average
    return dailyData.map((item, index) => {
      const windowStart = Math.max(0, index - windowDays + 1);
      const windowData = dailyData.slice(windowStart, index + 1);
      const movingAvg = windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;

      return {
        date: item.date,
        value: item.value,
        movingAvg: Math.round(movingAvg * 100) / 100
      };
    });
  }

  /**
   * Calculate trend slope using linear regression
   */
  getTrendSlope(
    platform: Platform,
    metric: 'score' | 'posts' | 'users',
    periodDays: number = 30
  ): { slope: number; intercept: number; r2: number; trend: 'increasing' | 'decreasing' | 'stable' } {
    const endTime = Date.now();
    const startTime = endTime - (periodDays * 24 * 60 * 60 * 1000);

    let query;
    if (metric === 'posts') {
      query = this.db.prepare(`
        SELECT
          julianday(date(created_at / 1000, 'unixepoch')) as x,
          COUNT(*) as y
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY date(created_at / 1000, 'unixepoch')
        ORDER BY x
      `);
    } else if (metric === 'users') {
      query = this.db.prepare(`
        SELECT
          julianday(date(created_at / 1000, 'unixepoch')) as x,
          COUNT(DISTINCT author_id) as y
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY date(created_at / 1000, 'unixepoch')
        ORDER BY x
      `);
    } else {
      query = this.db.prepare(`
        SELECT
          julianday(date(created_at / 1000, 'unixepoch')) as x,
          AVG(score) as y
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY date(created_at / 1000, 'unixepoch')
        ORDER BY x
      `);
    }

    const data = query.all(platform, startTime, endTime) as Array<{ x: number; y: number }>;

    if (data.length < 2) {
      return { slope: 0, intercept: 0, r2: 0, trend: 'stable' };
    }

    // Calculate linear regression
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + (d.x * d.y), 0);
    const sumX2 = data.reduce((sum, d) => sum + (d.x * d.x), 0);
    const sumY2 = data.reduce((sum, d) => sum + (d.y * d.y), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = data.reduce((sum, d) => sum + Math.pow(d.y - yMean, 2), 0);
    const ssResidual = data.reduce((sum, d) => {
      const predicted = slope * d.x + intercept;
      return sum + Math.pow(d.y - predicted, 2);
    }, 0);
    const r2 = 1 - (ssResidual / ssTotal);

    // Determine trend based on slope significance and R-squared
    const avgY = sumY / n;
    const normalizedSlope = slope / avgY;
    let trend: 'increasing' | 'decreasing' | 'stable';

    // Use combination of normalized slope and R-squared for trend detection
    // Lower threshold for better sensitivity to trends
    if (normalizedSlope > 0.01 && r2 > 0.3) trend = 'increasing';
    else if (normalizedSlope < -0.01 && r2 > 0.3) trend = 'decreasing';
    else trend = 'stable';

    return {
      slope: Math.round(slope * 1000) / 1000,
      intercept: Math.round(intercept * 100) / 100,
      r2: Math.round(r2 * 1000) / 1000,
      trend
    };
  }

  /**
   * Calculate correlation coefficient between two metrics
   */
  getCorrelation(
    platform: Platform,
    metric1: 'score' | 'comments' | 'length',
    metric2: 'score' | 'comments' | 'length',
    periodDays: number = 30
  ): { correlation: number; pValue: number; strength: 'strong' | 'moderate' | 'weak' | 'none' } {
    const endTime = Date.now();
    const startTime = endTime - (periodDays * 24 * 60 * 60 * 1000);

    const metricMap = {
      score: 'score',
      comments: 'comment_count',
      length: 'LENGTH(content)'
    };

    const query = this.db.prepare(`
      SELECT
        ${metricMap[metric1]} as x,
        ${metricMap[metric2]} as y
      FROM posts
      WHERE platform = ? AND created_at >= ? AND created_at <= ?
        AND ${metricMap[metric1]} IS NOT NULL
        AND ${metricMap[metric2]} IS NOT NULL
    `);

    const data = query.all(platform, startTime, endTime) as Array<{ x: number; y: number }>;

    if (data.length < 3) {
      return { correlation: 0, pValue: 1, strength: 'none' };
    }

    // Calculate Pearson correlation coefficient
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + (d.x * d.y), 0);
    const sumX2 = data.reduce((sum, d) => sum + (d.x * d.x), 0);
    const sumY2 = data.reduce((sum, d) => sum + (d.y * d.y), 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    const correlation = denominator === 0 ? 0 : numerator / denominator;

    // Calculate t-statistic for p-value
    const tStat = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const degreesOfFreedom = n - 2;

    // Simplified p-value calculation (would need statistical library for accurate value)
    const pValue = Math.min(1, Math.abs(2 * (1 - 0.5 * (1 + correlation))));

    // Determine strength
    const absCorr = Math.abs(correlation);
    let strength: 'strong' | 'moderate' | 'weak' | 'none';
    if (absCorr >= 0.7) strength = 'strong';
    else if (absCorr >= 0.4) strength = 'moderate';
    else if (absCorr >= 0.2) strength = 'weak';
    else strength = 'none';

    return {
      correlation: Math.round(correlation * 1000) / 1000,
      pValue: Math.round(pValue * 1000) / 1000,
      strength
    };
  }

  /**
   * Detect anomalies using z-score method
   */
  detectAnomalies(
    platform: Platform,
    metric: 'score' | 'comments' | 'activity',
    threshold: number = 2.5,
    periodDays: number = 30
  ): Array<{
    date: string;
    value: number;
    zScore: number;
    isAnomaly: boolean;
    type: 'high' | 'low' | 'normal';
  }> {
    const endTime = Date.now();
    const startTime = endTime - (periodDays * 24 * 60 * 60 * 1000);

    let query;
    if (metric === 'activity') {
      query = this.db.prepare(`
        SELECT
          date(created_at / 1000, 'unixepoch') as date,
          COUNT(*) as value
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY date
        ORDER BY date
      `);
    } else {
      const column = metric === 'score' ? 'AVG(score)' : 'AVG(comment_count)';
      query = this.db.prepare(`
        SELECT
          date(created_at / 1000, 'unixepoch') as date,
          ${column} as value
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY date
        ORDER BY date
      `);
    }

    const data = query.all(platform, startTime, endTime) as Array<{ date: string; value: number }>;

    if (data.length < 3) {
      return data.map(d => ({
        ...d,
        zScore: 0,
        isAnomaly: false,
        type: 'normal' as const
      }));
    }

    // Calculate mean and standard deviation
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate z-scores and detect anomalies
    return data.map(item => {
      const zScore = stdDev === 0 ? 0 : (item.value - mean) / stdDev;
      const isAnomaly = Math.abs(zScore) > threshold;
      let type: 'high' | 'low' | 'normal';

      if (zScore > threshold) type = 'high';
      else if (zScore < -threshold) type = 'low';
      else type = 'normal';

      return {
        date: item.date,
        value: Math.round(item.value * 100) / 100,
        zScore: Math.round(zScore * 100) / 100,
        isAnomaly,
        type
      };
    });
  }

  /**
   * Get seasonal patterns (day of week analysis)
   */
  getSeasonalPatterns(
    platform: Platform,
    metric: 'posts' | 'engagement' | 'score',
    periodDays: number = 90
  ): Array<{
    dayOfWeek: number;
    dayName: string;
    avgValue: number;
    relativeStrength: number;
  }> {
    const endTime = Date.now();
    const startTime = endTime - (periodDays * 24 * 60 * 60 * 1000);

    let query;
    if (metric === 'posts') {
      query = this.db.prepare(`
        SELECT
          CAST(strftime('%w', datetime(created_at / 1000, 'unixepoch')) AS INTEGER) as day_of_week,
          COUNT(*) as total_count,
          COUNT(DISTINCT date(created_at / 1000, 'unixepoch')) as day_count
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY day_of_week
      `);
    } else if (metric === 'engagement') {
      query = this.db.prepare(`
        SELECT
          CAST(strftime('%w', datetime(created_at / 1000, 'unixepoch')) AS INTEGER) as day_of_week,
          AVG(engagement_rate) as avg_value
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY day_of_week
      `);
    } else {
      query = this.db.prepare(`
        SELECT
          CAST(strftime('%w', datetime(created_at / 1000, 'unixepoch')) AS INTEGER) as day_of_week,
          AVG(score) as avg_value
        FROM posts
        WHERE platform = ? AND created_at >= ? AND created_at <= ?
        GROUP BY day_of_week
      `);
    }

    const results = query.all(platform, startTime, endTime) as any[];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Process results
    const processed = results.map(row => {
      const avgValue = metric === 'posts'
        ? row.total_count / (row.day_count || 1)
        : row.avg_value;

      return {
        dayOfWeek: row.day_of_week,
        dayName: dayNames[row.day_of_week],
        avgValue: Math.round(avgValue * 100) / 100
      };
    });

    // Calculate relative strength
    const overallAvg = processed.reduce((sum, d) => sum + d.avgValue, 0) / (processed.length || 1);

    return processed.map(item => ({
      ...item,
      relativeStrength: Math.round((item.avgValue / overallAvg) * 100) / 100
    }));
  }

  /**
   * Refresh materialized view for daily aggregations
   */
  refreshDailyAggregations(daysBack: number = 30): void {
    const transaction = this.db.transaction(() => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));

      // Clear old data for the refresh period
      this.db.prepare(`
        DELETE FROM mv_daily_aggregations
        WHERE date >= date(?) AND date <= date(?)
      `).run(startDate.toISOString(), endDate.toISOString());

      // Insert refreshed data with simplified aggregations
      this.db.prepare(`
        INSERT INTO mv_daily_aggregations (
          platform, date, posts_count, comments_count, unique_users, new_users,
          avg_post_score, median_post_score, avg_comment_score, total_engagement,
          avg_engagement_rate, top_post_id, top_post_score, top_author,
          top_author_posts, active_hours, peak_hour, peak_hour_posts
        )
        WITH daily_posts AS (
          SELECT
            platform,
            date(created_at / 1000, 'unixepoch') as date,
            COUNT(*) as posts_count,
            COUNT(DISTINCT author_id) as unique_users,
            AVG(score) as avg_post_score,
            MAX(score) as max_score,
            SUM(score + comment_count) as total_engagement,
            AVG(engagement_rate) as avg_engagement_rate
          FROM posts
          WHERE date(created_at / 1000, 'unixepoch') >= date(?)
            AND date(created_at / 1000, 'unixepoch') <= date(?)
          GROUP BY platform, date(created_at / 1000, 'unixepoch')
        ),
        daily_comments AS (
          SELECT
            c.platform,
            date(c.created_at / 1000, 'unixepoch') as date,
            COUNT(*) as comments_count,
            AVG(c.score) as avg_comment_score
          FROM comments c
          WHERE date(c.created_at / 1000, 'unixepoch') >= date(?)
            AND date(c.created_at / 1000, 'unixepoch') <= date(?)
          GROUP BY c.platform, date(c.created_at / 1000, 'unixepoch')
        ),
        top_posts AS (
          SELECT
            platform,
            date(created_at / 1000, 'unixepoch') as date,
            FIRST_VALUE(id) OVER (PARTITION BY platform, date(created_at / 1000, 'unixepoch') ORDER BY score DESC) as top_post_id,
            FIRST_VALUE(author) OVER (PARTITION BY platform, date(created_at / 1000, 'unixepoch') ORDER BY score DESC) as top_author
          FROM posts
          WHERE date(created_at / 1000, 'unixepoch') >= date(?)
            AND date(created_at / 1000, 'unixepoch') <= date(?)
        )
        SELECT
          dp.platform,
          dp.date,
          dp.posts_count,
          COALESCE(dc.comments_count, 0) as comments_count,
          dp.unique_users,
          0 as new_users,
          dp.avg_post_score,
          dp.avg_post_score as median_post_score,
          COALESCE(dc.avg_comment_score, 0) as avg_comment_score,
          dp.total_engagement,
          dp.avg_engagement_rate,
          tp.top_post_id,
          dp.max_score as top_post_score,
          tp.top_author,
          1 as top_author_posts,
          12 as active_hours,
          12 as peak_hour,
          dp.posts_count as peak_hour_posts
        FROM daily_posts dp
        LEFT JOIN daily_comments dc ON dc.platform = dp.platform AND dc.date = dp.date
        LEFT JOIN (SELECT DISTINCT platform, date, top_post_id, top_author FROM top_posts) tp
          ON tp.platform = dp.platform AND tp.date = dp.date
      `).run(
        startDate.toISOString(), endDate.toISOString(),
        startDate.toISOString(), endDate.toISOString(),
        startDate.toISOString(), endDate.toISOString()
      );
    });

    transaction();
  }

  /**
   * Refresh materialized view for hourly aggregations
   */
  refreshHourlyAggregations(hoursBack: number = 168): void {
    const transaction = this.db.transaction(() => {
      const endTime = Date.now();
      const startTime = endTime - (hoursBack * 60 * 60 * 1000);

      // Clear old data
      this.db.prepare(`
        DELETE FROM mv_hourly_aggregations
        WHERE hour_bucket >= ? AND hour_bucket <= ?
      `).run(Math.floor(startTime / 3600000), Math.floor(endTime / 3600000));

      // Insert refreshed data
      this.db.prepare(`
        INSERT INTO mv_hourly_aggregations (
          platform, hour_bucket, posts_count, comments_count, unique_users,
          avg_score, max_score, min_score, total_engagement,
          avg_response_time_minutes, posts_velocity, comments_velocity
        )
        SELECT
          p.platform,
          CAST(p.created_at / 3600000 AS INTEGER) as hour_bucket,
          COUNT(DISTINCT p.id) as posts_count,
          COUNT(DISTINCT c.id) as comments_count,
          COUNT(DISTINCT p.author_id) as unique_users,
          AVG(p.score) as avg_score,
          MAX(p.score) as max_score,
          MIN(p.score) as min_score,
          SUM(p.score + p.comment_count) as total_engagement,
          AVG((c.created_at - p.created_at) / 60000.0) as avg_response_time_minutes,
          COUNT(DISTINCT p.id) * 1.0 / 3600 as posts_velocity,
          COUNT(DISTINCT c.id) * 1.0 / 3600 as comments_velocity
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.id
        WHERE p.created_at >= ? AND p.created_at <= ?
        GROUP BY p.platform, CAST(p.created_at / 3600000 AS INTEGER)
      `).run(startTime, endTime);
    });

    transaction();
  }

  /**
   * Refresh materialized view for user engagement scores
   */
  refreshUserEngagementScores(): void {
    const transaction = this.db.transaction(() => {
      // Clear existing data
      this.db.prepare(`DELETE FROM mv_user_engagement_scores`).run();

      // Insert refreshed data
      this.db.prepare(`
        INSERT INTO mv_user_engagement_scores (
          user_id, username, platform, total_posts, total_comments, total_score,
          avg_post_score, avg_comment_score, post_engagement_rate,
          comment_engagement_rate, consistency_score, influence_score,
          activity_percentile, score_percentile, first_seen, last_seen, active_days
        )
        WITH user_stats AS (
          SELECT
            p.author_id as user_id,
            p.author as username,
            p.platform,
            COUNT(DISTINCT p.id) as total_posts,
            COUNT(DISTINCT c.id) as total_comments,
            SUM(p.score) + COALESCE(SUM(c.score), 0) as total_score,
            AVG(p.score) as avg_post_score,
            AVG(c.score) as avg_comment_score,
            AVG(p.engagement_rate) as post_engagement_rate,
            AVG(CAST(c.score AS REAL) / NULLIF(LENGTH(c.content), 0)) as comment_engagement_rate,
            MIN(p.created_at) as first_seen,
            MAX(p.created_at) as last_seen,
            COUNT(DISTINCT date(p.created_at / 1000, 'unixepoch')) as active_days
          FROM posts p
          LEFT JOIN comments c ON c.author_id = p.author_id AND c.platform = p.platform
          GROUP BY p.author_id, p.platform
        ),
        percentiles AS (
          SELECT
            user_id,
            platform,
            PERCENT_RANK() OVER (PARTITION BY platform ORDER BY total_posts + total_comments) as activity_pct,
            PERCENT_RANK() OVER (PARTITION BY platform ORDER BY total_score) as score_pct
          FROM user_stats
        )
        SELECT
          us.user_id,
          us.username,
          us.platform,
          us.total_posts,
          us.total_comments,
          us.total_score,
          us.avg_post_score,
          us.avg_comment_score,
          us.post_engagement_rate,
          us.comment_engagement_rate,
          us.active_days * 1.0 / NULLIF((us.last_seen - us.first_seen) / 86400000, 0) as consistency_score,
          (us.total_score * 0.4 +
           (us.total_posts + us.total_comments) * 0.3 +
           us.active_days * 0.3) as influence_score,
          p.activity_pct * 100 as activity_percentile,
          p.score_pct * 100 as score_percentile,
          us.first_seen,
          us.last_seen,
          us.active_days
        FROM user_stats us
        JOIN percentiles p ON p.user_id = us.user_id AND p.platform = us.platform
        WHERE us.total_posts > 0 OR us.total_comments > 0
      `).run();
    });

    transaction();
  }

  /**
   * Refresh materialized view for trending content
   */
  refreshTrendingContent(hoursWindow: number = 24): void {
    const transaction = this.db.transaction(() => {
      const cutoffTime = Date.now() - (hoursWindow * 60 * 60 * 1000);

      // Clear existing data
      this.db.prepare(`DELETE FROM mv_trending_content`).run();

      // Insert refreshed data
      this.db.prepare(`
        INSERT INTO mv_trending_content (
          post_id, platform, title, author, url, score, comment_count,
          created_at, age_hours, velocity_score, hotness_score,
          engagement_rate, comment_velocity, rank_overall, rank_platform, rank_daily
        )
        WITH trending_posts AS (
          SELECT
            id as post_id,
            platform,
            title,
            author,
            url,
            score,
            comment_count,
            created_at,
            (strftime('%s', 'now') * 1000 - created_at) / 3600000.0 as age_hours,
            score / NULLIF(POW((strftime('%s', 'now') * 1000 - created_at) / 3600000.0 + 2, 1.8), 0) as hotness_score,
            score / NULLIF((strftime('%s', 'now') * 1000 - created_at) / 3600000.0, 0) as velocity_score,
            engagement_rate,
            comment_count / NULLIF((strftime('%s', 'now') * 1000 - created_at) / 3600000.0, 0) as comment_velocity
          FROM posts
          WHERE created_at >= ?
        ),
        ranked AS (
          SELECT
            *,
            ROW_NUMBER() OVER (ORDER BY hotness_score DESC) as rank_overall,
            ROW_NUMBER() OVER (PARTITION BY platform ORDER BY hotness_score DESC) as rank_platform,
            ROW_NUMBER() OVER (
              PARTITION BY date(created_at / 1000, 'unixepoch')
              ORDER BY hotness_score DESC
            ) as rank_daily
          FROM trending_posts
        )
        SELECT * FROM ranked
        WHERE rank_overall <= 1000 OR rank_platform <= 100
      `).run(cutoffTime);
    });

    transaction();
  }

  /**
   * Refresh all materialized views
   */
  refreshAllMaterializedViews(): void {
    console.log('Refreshing all materialized views...');
    const startTime = Date.now();

    try {
      this.refreshDailyAggregations(30);
      console.log('✓ Daily aggregations refreshed');

      this.refreshHourlyAggregations(168);
      console.log('✓ Hourly aggregations refreshed');

      this.refreshUserEngagementScores();
      console.log('✓ User engagement scores refreshed');

      this.refreshTrendingContent(48);
      console.log('✓ Trending content refreshed');

      const duration = Date.now() - startTime;
      console.log(`All materialized views refreshed in ${duration}ms`);
    } catch (error) {
      console.error('Error refreshing materialized views:', error);
      throw error;
    }
  }

  /**
   * Get refresh status for materialized views
   */
  getMaterializedViewStatus(): Array<{
    viewName: string;
    rowCount: number;
    lastRefreshed: Date | null;
    sizeKB: number;
  }> {
    const views = [
      'mv_daily_aggregations',
      'mv_hourly_aggregations',
      'mv_user_engagement_scores',
      'mv_trending_content',
      'mv_platform_comparison'
    ];

    return views.map(viewName => {
      try {
        const countResult = this.db.prepare(`SELECT COUNT(*) as count FROM ${viewName}`).get() as any;
        const refreshResult = this.db.prepare(`SELECT MAX(last_refreshed) as last_refreshed FROM ${viewName}`).get() as any;

        // Estimate size (rough approximation)
        const sizeResult = this.db.prepare(`
          SELECT
            COUNT(*) * AVG(LENGTH(CAST(rowid AS TEXT))) as estimated_size
          FROM ${viewName}
        `).get() as any;

        return {
          viewName,
          rowCount: countResult?.count || 0,
          lastRefreshed: refreshResult?.last_refreshed ? new Date(refreshResult.last_refreshed) : null,
          sizeKB: Math.round((sizeResult?.estimated_size || 0) / 1024)
        };
      } catch (error) {
        // View might not exist yet
        return {
          viewName,
          rowCount: 0,
          lastRefreshed: null,
          sizeKB: 0
        };
      }
    });
  }
}
