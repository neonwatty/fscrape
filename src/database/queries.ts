import Database from "better-sqlite3";

/**
 * Prepared statements for database operations
 * All statements are pre-compiled for performance
 */
export class PreparedQueries {
  readonly posts: {
    insert: Database.Statement;
    update: Database.Statement;
    upsert: Database.Statement;
    getById: Database.Statement;
    getByPlatform: Database.Statement;
    getRecent: Database.Statement;
    getAll: Database.Statement;
    count: Database.Statement;
    countByPlatform: Database.Statement;
  };

  readonly comments: {
    insert: Database.Statement;
    update: Database.Statement;
    upsert: Database.Statement;
    getById: Database.Statement;
    getByPost: Database.Statement;
    getByUser: Database.Statement;
    getByParent: Database.Statement;
    getThread: Database.Statement;
    count: Database.Statement;
  };

  readonly users: {
    insert: Database.Statement;
    update: Database.Statement;
    upsert: Database.Statement;
    getById: Database.Statement;
    getByUsername: Database.Statement;
    getTopByKarma: Database.Statement;
    getByPlatform: Database.Statement;
  };

  readonly sessions: {
    create: Database.Statement;
    update: Database.Statement;
    get: Database.Statement;
    getActive: Database.Statement;
    getByPlatform: Database.Statement;
    complete: Database.Statement;
  };

  readonly metrics: {
    insert: Database.Statement;
    upsert: Database.Statement;
    getBySession: Database.Statement;
    getByTimeRange: Database.Statement;
    postsPerPlatform: Database.Statement;
    commentsPerPlatform: Database.Statement;
    avgScoreByPlatform: Database.Statement;
    topPostsByScore: Database.Statement;
    topUsersByKarma: Database.Statement;
    engagementByPlatform: Database.Statement;
  };

  readonly rateLimit: {
    check: Database.Statement;
    increment: Database.Statement;
    reset: Database.Statement;
    get: Database.Statement;
  };

  // Keep legacy properties for backward compatibility
  readonly insertPost: Database.Statement;
  readonly updatePost: Database.Statement;
  readonly insertComment: Database.Statement;
  readonly updateComment: Database.Statement;
  readonly insertUser: Database.Statement;
  readonly updateUser: Database.Statement;
  readonly insertSession: Database.Statement;
  readonly updateSession: Database.Statement;

  constructor(db: Database.Database) {
    // Ensure required tables exist before creating prepared statements
    this.ensureTablesExist(db);
    // ============================================================================
    // Post Queries
    // ============================================================================

    const insertPost = db.prepare(`
      INSERT INTO posts (
        id, platform, platform_id, title, content, author, author_id, url,
        score, comment_count, created_at, updated_at, metadata
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const updatePost = db.prepare(`
      UPDATE posts
      SET score = @score,
          comment_count = @commentCount,
          updated_at = @updatedAt,
          metadata = @metadata
      WHERE id = @id AND platform = @platform
    `);

    const upsertPost = db.prepare(`
      INSERT OR REPLACE INTO posts (
        id, platform, platform_id, title, content, author, author_id, url,
        score, comment_count, created_at, updated_at, metadata
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const getPostById = db.prepare(`
      SELECT * FROM posts
      WHERE id = ?
    `);

    const getPostsByPlatform = db.prepare(`
      SELECT * FROM posts
      WHERE platform = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const getRecentPosts = db.prepare(`
      SELECT * FROM posts
      WHERE created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const getAllPosts = db.prepare(`
      SELECT * FROM posts
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const countPosts = db.prepare(`
      SELECT COUNT(*) as count FROM posts
    `);

    const countPostsByPlatform = db.prepare(`
      SELECT COUNT(*) as count FROM posts
      WHERE platform = ?
    `);

    this.posts = {
      insert: insertPost,
      update: updatePost,
      upsert: upsertPost,
      getById: getPostById,
      getByPlatform: getPostsByPlatform,
      getRecent: getRecentPosts,
      getAll: getAllPosts,
      count: countPosts,
      countByPlatform: countPostsByPlatform,
    };

    // Legacy compatibility
    this.insertPost = insertPost;
    this.updatePost = updatePost;

    // ============================================================================
    // Comment Queries
    // ============================================================================

    const insertComment = db.prepare(`
      INSERT INTO comments (
        id, post_id, platform, parent_id, author, author_id,
        content, score, created_at, updated_at, depth
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const updateComment = db.prepare(`
      UPDATE comments
      SET score = @score, updated_at = @updatedAt
      WHERE id = @id AND platform = @platform
    `);

    const upsertComment = db.prepare(`
      INSERT OR REPLACE INTO comments (
        id, post_id, parent_id, platform, author, author_id,
        content, score, depth, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const getCommentById = db.prepare(`
      SELECT * FROM comments
      WHERE id = ?
    `);

    const getCommentsByPost = db.prepare(`
      SELECT * FROM comments
      WHERE post_id = ?
      ORDER BY created_at ASC
    `);

    const getCommentsByUser = db.prepare(`
      SELECT * FROM comments
      WHERE author_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const getCommentsByParent = db.prepare(`
      SELECT * FROM comments
      WHERE parent_id = ?
      ORDER BY created_at ASC
    `);

    const getCommentThread = db.prepare(`
      WITH RECURSIVE thread AS (
        SELECT * FROM comments WHERE id = ?
        UNION ALL
        SELECT c.* FROM comments c
        INNER JOIN thread t ON c.parent_id = t.id
      )
      SELECT * FROM thread
    `);

    const countComments = db.prepare(`
      SELECT COUNT(*) as count FROM comments
      WHERE post_id = ?
    `);

    this.comments = {
      insert: insertComment,
      update: updateComment,
      upsert: upsertComment,
      getById: getCommentById,
      getByPost: getCommentsByPost,
      getByUser: getCommentsByUser,
      getByParent: getCommentsByParent,
      getThread: getCommentThread,
      count: countComments,
    };

    // Legacy compatibility
    this.insertComment = insertComment;
    this.updateComment = updateComment;

    // ============================================================================
    // User Queries
    // ============================================================================

    const insertUser = db.prepare(`
      INSERT INTO users (
        id, platform, username, karma, created_at, last_seen_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `);

    const updateUser = db.prepare(`
      UPDATE users
      SET karma = @karma,
          last_seen_at = @lastSeenAt,
          metadata = @metadata
      WHERE id = @id AND platform = @platform
    `);

    const upsertUser = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, platform, username, karma, created_at, last_seen_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `);

    const getUserById = db.prepare(`
      SELECT * FROM users
      WHERE id = ?
    `);

    const getUserByUsername = db.prepare(`
      SELECT * FROM users
      WHERE platform = ? AND username = ?
    `);

    const getTopUsersByKarma = db.prepare(`
      SELECT * FROM users
      ORDER BY karma DESC
      LIMIT ?
    `);

    const getUsersByPlatform = db.prepare(`
      SELECT * FROM users
      WHERE platform = ?
      ORDER BY karma DESC
      LIMIT ? OFFSET ?
    `);

    this.users = {
      insert: insertUser,
      update: updateUser,
      upsert: upsertUser,
      getById: getUserById,
      getByUsername: getUserByUsername,
      getTopByKarma: getTopUsersByKarma,
      getByPlatform: getUsersByPlatform,
    };

    // Legacy compatibility
    this.insertUser = insertUser;
    this.updateUser = updateUser;

    // ============================================================================
    // Session Queries
    // ============================================================================

    const createSession = db.prepare(`
      INSERT INTO scraping_sessions (
        session_id, platform, query_type, query_value, started_at, 
        status, total_posts, total_comments, total_users, metadata
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const updateSession = db.prepare(`
      UPDATE scraping_sessions
      SET status = COALESCE(@status, status),
          total_posts = COALESCE(@totalPosts, total_posts),
          total_comments = COALESCE(@totalComments, total_comments),
          total_users = COALESCE(@totalUsers, total_users),
          completed_at = COALESCE(@completedAt, completed_at),
          last_error = COALESCE(@errorMessage, last_error),
          metadata = COALESCE(@metadata, metadata)
      WHERE id = @id
    `);

    const getSession = db.prepare(`
      SELECT * FROM scraping_sessions
      WHERE id = ?
    `);

    const getActiveSessions = db.prepare(`
      SELECT * FROM scraping_sessions
      WHERE status IN ('pending', 'running')
      ORDER BY started_at DESC
    `);

    const getSessionsByPlatform = db.prepare(`
      SELECT * FROM scraping_sessions
      WHERE platform = ?
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);

    const completeSession = db.prepare(`
      UPDATE scraping_sessions
      SET status = 'completed',
          completed_at = @completedAt
      WHERE id = @id
    `);

    this.sessions = {
      create: createSession,
      update: updateSession,
      get: getSession,
      getActive: getActiveSessions,
      getByPlatform: getSessionsByPlatform,
      complete: completeSession,
    };

    // Legacy compatibility
    this.insertSession = createSession;
    this.updateSession = updateSession;

    // ============================================================================
    // Metrics Queries
    // ============================================================================

    const insertMetric = db.prepare(`
      INSERT INTO scraping_metrics (
        id, platform, time_bucket,
        requests_made, requests_successful, requests_failed,
        posts_scraped, comments_scraped, users_scraped,
        avg_response_time_ms, rate_limit_hits
      ) VALUES (
        @sessionId, @platform, @timeBucket,
        @requestsMade, @requestsSuccessful, @requestsFailed,
        @postsScraped, @commentsScraped, @usersScraped,
        @avgResponseTimeMs, @rateLimitHits
      )
    `);

    const upsertMetric = db.prepare(`
      INSERT OR REPLACE INTO scraping_metrics (
        id, platform, time_bucket,
        requests_made, requests_successful, requests_failed,
        posts_scraped, comments_scraped, users_scraped,
        avg_response_time_ms, rate_limit_hits
      ) VALUES (
        @sessionId, @platform, @timeBucket,
        COALESCE(@requestsMade, 0) + COALESCE((SELECT requests_made FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0),
        COALESCE(@requestsSuccessful, 0) + COALESCE((SELECT requests_successful FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0),
        COALESCE(@requestsFailed, 0) + COALESCE((SELECT requests_failed FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0),
        COALESCE(@postsScraped, 0) + COALESCE((SELECT posts_scraped FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0),
        COALESCE(@commentsScraped, 0) + COALESCE((SELECT comments_scraped FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0),
        COALESCE(@usersScraped, 0) + COALESCE((SELECT users_scraped FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0),
        CASE
          WHEN @avgResponseTimeMs IS NULL THEN (SELECT avg_response_time_ms FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket)
          WHEN (SELECT avg_response_time_ms FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket) IS NULL THEN @avgResponseTimeMs
          ELSE (@avgResponseTimeMs + COALESCE((SELECT avg_response_time_ms FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0)) / 2
        END,
        COALESCE(@rateLimitHits, 0) + COALESCE((SELECT rate_limit_hits FROM scraping_metrics WHERE id = @sessionId AND time_bucket = @timeBucket), 0)
      )
    `);

    const getMetricsBySession = db.prepare(`
      SELECT * FROM scraping_metrics
      WHERE id = ?
      ORDER BY time_bucket DESC
    `);

    const getMetricsByTimeRange = db.prepare(`
      SELECT 
        time_bucket,
        SUM(requests_made) as total_requests,
        SUM(requests_successful) as total_successful,
        SUM(requests_failed) as total_failed,
        SUM(posts_scraped) as total_posts,
        SUM(comments_scraped) as total_comments,
        SUM(users_scraped) as total_users,
        AVG(avg_response_time_ms) as avg_response_time,
        SUM(rate_limit_hits) as total_rate_limits
      FROM scraping_metrics
      WHERE platform = ? AND time_bucket >= ? AND time_bucket <= ?
      GROUP BY time_bucket
      ORDER BY time_bucket DESC
    `);

    const postsPerPlatform = db.prepare(`
      SELECT platform, COUNT(*) as count
      FROM posts
      GROUP BY platform
    `);

    const commentsPerPlatform = db.prepare(`
      SELECT platform, COUNT(*) as count
      FROM comments
      GROUP BY platform
    `);

    const avgScoreByPlatform = db.prepare(`
      SELECT platform, AVG(score) as avg_score
      FROM posts
      GROUP BY platform
    `);

    const topPostsByScore = db.prepare(`
      SELECT * FROM posts
      ORDER BY score DESC
      LIMIT ?
    `);

    const topUsersByKarma = db.prepare(`
      SELECT * FROM users
      ORDER BY karma DESC
      LIMIT ?
    `);

    const engagementByPlatform = db.prepare(`
      SELECT 
        platform,
        COUNT(*) as total_posts,
        AVG(score) as avg_score,
        AVG(comment_count) as avg_comments,
        SUM(score) as total_score,
        SUM(comment_count) as total_comments
      FROM posts
      GROUP BY platform
    `);

    this.metrics = {
      insert: insertMetric,
      upsert: upsertMetric,
      getBySession: getMetricsBySession,
      getByTimeRange: getMetricsByTimeRange,
      postsPerPlatform: postsPerPlatform,
      commentsPerPlatform: commentsPerPlatform,
      avgScoreByPlatform: avgScoreByPlatform,
      topPostsByScore: topPostsByScore,
      topUsersByKarma: topUsersByKarma,
      engagementByPlatform: engagementByPlatform,
    };

    // ============================================================================
    // Rate Limit Queries
    // ============================================================================

    const checkRateLimit = db.prepare(`
      SELECT COUNT(*) as request_count
      FROM rate_limit_state
      WHERE platform = ? AND last_request_at >= ?
    `);

    const incrementRateLimit = db.prepare(`
      INSERT OR REPLACE INTO rate_limit_state (
        platform, window_start, requests_in_window, 
        last_request_at, retry_after
      ) VALUES (
        ?, ?, 
        COALESCE((SELECT requests_in_window FROM rate_limit_state WHERE platform = ?), 0) + 1,
        ?, NULL
      )
    `);

    const resetRateLimit = db.prepare(`
      UPDATE rate_limit_state
      SET requests_in_window = 0,
          window_start = @windowStart,
          consecutive_errors = 0,
          retry_after = NULL,
          updated_at = strftime('%s', 'now') * 1000
      WHERE platform = @platform
    `);

    const getRateLimit = db.prepare(`
      SELECT * FROM rate_limit_state
      WHERE platform = ?
    `);

    this.rateLimit = {
      check: checkRateLimit,
      increment: incrementRateLimit,
      reset: resetRateLimit,
      get: getRateLimit,
    };
  }

  private ensureTablesExist(db: Database.Database): void {
    // Create basic table structures if they don't exist
    // This is a failsafe - proper schema should be created via migrations
    const tableCreations = [
      `CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        platform_id TEXT,
        title TEXT,
        content TEXT,
        url TEXT,
        author TEXT,
        author_id TEXT,
        score INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        metadata TEXT,
        engagement_rate REAL GENERATED ALWAYS AS (
          CASE 
            WHEN (score + comment_count) = 0 THEN 0.0
            ELSE CAST(comment_count AS REAL) / (score + comment_count)
          END
        ) STORED
      )`,
      `CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        platform_id TEXT,
        post_id TEXT,
        parent_id TEXT,
        author TEXT,
        author_id TEXT,
        content TEXT,
        score INTEGER DEFAULT 0,
        depth INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        username TEXT,
        display_name TEXT,
        karma INTEGER DEFAULT 0,
        created_at INTEGER,
        last_seen_at INTEGER,
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS scraping_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        platform TEXT NOT NULL,
        query_type TEXT,
        query_value TEXT,
        status TEXT DEFAULT 'pending',
        total_items_target INTEGER,
        total_items_scraped INTEGER DEFAULT 0,
        total_posts INTEGER DEFAULT 0,
        total_comments INTEGER DEFAULT 0,
        total_users INTEGER DEFAULT 0,
        last_item_id TEXT,
        resume_token TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        last_activity_at INTEGER,
        error_count INTEGER DEFAULT 0,
        last_error TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS scraping_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT,
        platform TEXT,
        time_bucket INTEGER,
        requests_made INTEGER DEFAULT 0,
        requests_successful INTEGER DEFAULT 0,
        requests_failed INTEGER DEFAULT 0,
        posts_scraped INTEGER DEFAULT 0,
        comments_scraped INTEGER DEFAULT 0,
        users_scraped INTEGER DEFAULT 0,
        items_scraped INTEGER DEFAULT 0,
        avg_response_time REAL DEFAULT 0,
        avg_response_time_ms REAL DEFAULT 0,
        rate_limit_hits INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(id, time_bucket)
      )`,
      `CREATE TABLE IF NOT EXISTS rate_limit_state (
        platform TEXT PRIMARY KEY,
        window_start INTEGER,
        requests_in_window INTEGER DEFAULT 0,
        last_request_at INTEGER,
        retry_after INTEGER,
        consecutive_errors INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )`,
    ];

    for (const sql of tableCreations) {
      try {
        db.exec(sql);
      } catch (_error) {
        // Table might already exist with different schema, that's ok
        // The migrations will handle proper schema updates
      }
    }

    // Add new columns to scraping_sessions if they don't exist
    const columnAdditions = [
      `ALTER TABLE scraping_sessions ADD COLUMN total_posts INTEGER DEFAULT 0`,
      `ALTER TABLE scraping_sessions ADD COLUMN total_comments INTEGER DEFAULT 0`,
      `ALTER TABLE scraping_sessions ADD COLUMN total_users INTEGER DEFAULT 0`,
    ];

    for (const sql of columnAdditions) {
      try {
        db.exec(sql);
      } catch (_error) {
        // Column already exists or table doesn't exist, ignore
      }
    }
  }

  cleanup(): void {
    // Finalize all prepared statements
    // This is automatically done when the database closes,
    // but we can do it explicitly for clean shutdown
  }
}
