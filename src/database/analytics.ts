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
      FROM forum_posts p
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
      LEFT JOIN forum_posts p ON p.author_id = u.id AND p.platform = u.platform
      LEFT JOIN comments c ON c.author_id = u.id AND c.platform = u.platform
      WHERE u.platform = ? AND u.username = ?
      GROUP BY u.username, u.platform
    `);

    // Scraping performance metrics
    this.stmtScrapingPerformance = db.prepare(`
      SELECT 
        s.session_id,
        s.platform,
        s.started_at,
        s.completed_at,
        SUM(m.requests_made) as total_requests,
        SUM(m.requests_successful) as successful_requests,
        SUM(m.requests_failed) as failed_requests,
        AVG(m.avg_response_time_ms) as avg_response_time,
        CAST(s.total_items_scraped AS REAL) / 
          MAX(1, (COALESCE(s.completed_at, s.last_activity_at) - s.started_at) / 1000.0) as items_per_second
      FROM scraping_sessions s
      LEFT JOIN scraping_metrics m ON m.session_id = s.session_id
      WHERE s.session_id = ?
      GROUP BY s.session_id
    `);

    // Time series data - hourly
    this.stmtTimeSeriesHourly = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', datetime(created_at / 1000, 'unixepoch')) as hour,
        COUNT(*) as posts,
        AVG(score) as avg_score
      FROM forum_posts
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
      FROM forum_posts
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
      FROM forum_posts
      WHERE platform = ?
        AND created_at >= ?
    `);

    // Content growth over time
    this.stmtContentGrowth = db.prepare(`
      SELECT 
        date(created_at / 1000, 'unixepoch') as day,
        COUNT(*) as new_posts,
        SUM(COUNT(*)) OVER (ORDER BY date(created_at / 1000, 'unixepoch')) as cumulative_posts
      FROM forum_posts
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
      ? `SELECT * FROM forum_posts WHERE created_at >= ? AND created_at <= ? AND platform = ? ORDER BY created_at DESC`
      : `SELECT * FROM forum_posts WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`;

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
        FROM forum_posts
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
        FROM forum_posts
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
        FROM forum_posts
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
        FROM forum_posts
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
        FROM forum_posts
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
        FROM forum_posts
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
        FROM forum_posts
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
        FROM forum_posts
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
        FROM forum_posts
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
        session_id,
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
      LEFT JOIN forum_posts p ON p.author_id = u.id
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
      FROM forum_posts
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
      LEFT JOIN forum_posts p ON p.author_id = u.id AND p.platform = u.platform
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
        FROM forum_posts p
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
        FROM forum_posts p
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
      "forum_posts",
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
      forum_posts: `
        CREATE TABLE IF NOT EXISTS forum_posts (
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
        .prepare("SELECT COUNT(*) as count FROM forum_posts")
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
        .prepare("SELECT MIN(created_at) as created_at FROM forum_posts")
        .get() as any;
      const newestPost = this.db
        .prepare("SELECT MAX(created_at) as created_at FROM forum_posts")
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
        FROM forum_posts
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
    } catch (error) {
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
      } catch (error) {
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
}
