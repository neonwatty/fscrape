export const MATERIALIZED_VIEWS = {
  mv_daily_aggregations: `
    CREATE TABLE IF NOT EXISTS mv_daily_aggregations (
      platform TEXT NOT NULL,
      date TEXT NOT NULL,
      posts_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      unique_users INTEGER DEFAULT 0,
      new_users INTEGER DEFAULT 0,
      avg_post_score REAL DEFAULT 0,
      median_post_score REAL DEFAULT 0,
      avg_comment_score REAL DEFAULT 0,
      total_engagement INTEGER DEFAULT 0,
      avg_engagement_rate REAL DEFAULT 0,
      top_post_id TEXT,
      top_post_score INTEGER,
      top_author TEXT,
      top_author_posts INTEGER,
      active_hours INTEGER DEFAULT 0,
      peak_hour INTEGER,
      peak_hour_posts INTEGER,
      last_refreshed INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (platform, date)
    )
  `,

  mv_hourly_aggregations: `
    CREATE TABLE IF NOT EXISTS mv_hourly_aggregations (
      platform TEXT NOT NULL,
      hour_bucket INTEGER NOT NULL,
      posts_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      unique_users INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      max_score INTEGER DEFAULT 0,
      min_score INTEGER DEFAULT 0,
      total_engagement INTEGER DEFAULT 0,
      avg_response_time_minutes REAL DEFAULT 0,
      posts_velocity REAL DEFAULT 0,
      comments_velocity REAL DEFAULT 0,
      last_refreshed INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (platform, hour_bucket)
    )
  `,

  mv_user_engagement_scores: `
    CREATE TABLE IF NOT EXISTS mv_user_engagement_scores (
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      platform TEXT NOT NULL,
      total_posts INTEGER DEFAULT 0,
      total_comments INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      avg_post_score REAL DEFAULT 0,
      avg_comment_score REAL DEFAULT 0,
      post_engagement_rate REAL DEFAULT 0,
      comment_engagement_rate REAL DEFAULT 0,
      consistency_score REAL DEFAULT 0,
      influence_score REAL DEFAULT 0,
      activity_percentile REAL DEFAULT 0,
      score_percentile REAL DEFAULT 0,
      first_seen INTEGER,
      last_seen INTEGER,
      active_days INTEGER DEFAULT 0,
      last_refreshed INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (user_id, platform)
    )
  `,

  mv_trending_content: `
    CREATE TABLE IF NOT EXISTS mv_trending_content (
      post_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      url TEXT NOT NULL,
      score INTEGER NOT NULL,
      comment_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      age_hours REAL DEFAULT 0,
      velocity_score REAL DEFAULT 0,
      hotness_score REAL DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      comment_velocity REAL DEFAULT 0,
      rank_overall INTEGER,
      rank_platform INTEGER,
      rank_daily INTEGER,
      trending_category TEXT,
      last_refreshed INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (post_id, platform)
    )
  `,

  mv_platform_comparison: `
    CREATE TABLE IF NOT EXISTS mv_platform_comparison (
      metric_date TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      reddit_value REAL DEFAULT 0,
      hackernews_value REAL DEFAULT 0,
      reddit_rank INTEGER DEFAULT 0,
      hackernews_rank INTEGER DEFAULT 0,
      relative_difference REAL DEFAULT 0,
      last_refreshed INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (metric_date, metric_name)
    )
  `,
};

export const DATABASE_SCHEMA = {
  posts: `
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      platform_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      content TEXT,
      author TEXT NOT NULL,
      author_id TEXT,
      url TEXT NOT NULL,
      score INTEGER NOT NULL,
      comment_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      metadata TEXT,
      scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      engagement_rate REAL GENERATED ALWAYS AS (
        CASE
          WHEN (score + comment_count) = 0 THEN 0.0
          ELSE CAST(comment_count AS REAL) / (score + comment_count)
        END
      ) STORED,
      score_normalized REAL GENERATED ALWAYS AS (
        CASE
          WHEN score < 0 THEN 0.0
          WHEN score > 10000 THEN 1.0
          ELSE score / 10000.0
        END
      ) STORED,
      UNIQUE(platform, id)
    )
  `,

  comments: `
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      parent_id TEXT,
      author TEXT NOT NULL,
      author_id TEXT,
      content TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      depth INTEGER NOT NULL,
      scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (post_id) REFERENCES posts(id),
      UNIQUE(platform, id)
    )
  `,

  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      karma INTEGER,
      created_at INTEGER,
      last_seen_at INTEGER,
      metadata TEXT,
      scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(platform, id)
    )
  `,

  scraping_sessions: `
    CREATE TABLE IF NOT EXISTS scraping_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL,
      query_type TEXT,
      query_value TEXT,
      sort_by TEXT,
      time_range TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      total_items_target INTEGER,
      total_items_scraped INTEGER DEFAULT 0,
      total_posts INTEGER DEFAULT 0,
      total_comments INTEGER DEFAULT 0,
      total_users INTEGER DEFAULT 0,
      last_item_id TEXT,
      resume_token TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      last_activity_at INTEGER,
      error_count INTEGER DEFAULT 0,
      last_error TEXT,
      metadata TEXT
    )
  `,

  rate_limit_state: `
    CREATE TABLE IF NOT EXISTS rate_limit_state (
      platform TEXT PRIMARY KEY,
      requests_in_window INTEGER DEFAULT 0,
      window_start INTEGER NOT NULL,
      last_request_at INTEGER,
      retry_after INTEGER,
      consecutive_errors INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `,

  scraping_metrics: `
    CREATE TABLE IF NOT EXISTS scraping_metrics (
      id TEXT NOT NULL,
      platform TEXT NOT NULL,
      time_bucket INTEGER NOT NULL,
      requests_made INTEGER DEFAULT 0,
      requests_successful INTEGER DEFAULT 0,
      requests_failed INTEGER DEFAULT 0,
      posts_scraped INTEGER DEFAULT 0,
      comments_scraped INTEGER DEFAULT 0,
      users_scraped INTEGER DEFAULT 0,
      avg_response_time_ms REAL,
      rate_limit_hits INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (id, platform, time_bucket)
    )
  `,

  trend_metrics: `
    CREATE TABLE IF NOT EXISTS trend_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      time_window TEXT NOT NULL,
      calculated_at INTEGER NOT NULL,
      metadata TEXT,
      UNIQUE(platform, metric_type, metric_name, time_window, calculated_at)
    )
  `,

  time_series_hourly: `
    CREATE TABLE IF NOT EXISTS time_series_hourly (
      platform TEXT NOT NULL,
      hour_bucket INTEGER NOT NULL,
      posts_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      users_count INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      avg_comment_count REAL DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      max_score INTEGER DEFAULT 0,
      min_score INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (platform, hour_bucket)
    )
  `,

  time_series_daily: `
    CREATE TABLE IF NOT EXISTS time_series_daily (
      platform TEXT NOT NULL,
      date TEXT NOT NULL,
      posts_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      users_count INTEGER DEFAULT 0,
      new_users_count INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      avg_comment_count REAL DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      max_score INTEGER DEFAULT 0,
      min_score INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      top_post_id TEXT,
      top_user_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (platform, date)
    )
  `,

  keyword_trends: `
    CREATE TABLE IF NOT EXISTS keyword_trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL,
      date TEXT NOT NULL,
      frequency INTEGER DEFAULT 0,
      posts_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      trending_score REAL DEFAULT 0,
      first_seen_at INTEGER,
      last_seen_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(keyword, platform, date)
    )
  `,

  user_influence_scores: `
    CREATE TABLE IF NOT EXISTS user_influence_scores (
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      calculation_date TEXT NOT NULL,
      post_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      total_karma INTEGER DEFAULT 0,
      avg_post_score REAL DEFAULT 0,
      avg_comment_score REAL DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      unique_interactions INTEGER DEFAULT 0,
      influence_score REAL DEFAULT 0,
      percentile_rank REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (user_id, platform, calculation_date)
    )
  `,
};

export const MATERIALIZED_VIEW_INDEXES = [
  // Daily aggregations indexes
  "CREATE INDEX IF NOT EXISTS idx_mv_daily_platform_date ON mv_daily_aggregations(platform, date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_daily_date ON mv_daily_aggregations(date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_daily_engagement ON mv_daily_aggregations(total_engagement DESC)",

  // Hourly aggregations indexes
  "CREATE INDEX IF NOT EXISTS idx_mv_hourly_platform_bucket ON mv_hourly_aggregations(platform, hour_bucket DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_hourly_bucket ON mv_hourly_aggregations(hour_bucket DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_hourly_velocity ON mv_hourly_aggregations(posts_velocity DESC)",

  // User engagement scores indexes
  "CREATE INDEX IF NOT EXISTS idx_mv_user_engagement_platform ON mv_user_engagement_scores(platform)",
  "CREATE INDEX IF NOT EXISTS idx_mv_user_engagement_influence ON mv_user_engagement_scores(influence_score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_user_engagement_username ON mv_user_engagement_scores(username)",
  "CREATE INDEX IF NOT EXISTS idx_mv_user_engagement_platform_influence ON mv_user_engagement_scores(platform, influence_score DESC)",

  // Trending content indexes
  "CREATE INDEX IF NOT EXISTS idx_mv_trending_platform ON mv_trending_content(platform)",
  "CREATE INDEX IF NOT EXISTS idx_mv_trending_hotness ON mv_trending_content(hotness_score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_trending_created ON mv_trending_content(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_trending_platform_hotness ON mv_trending_content(platform, hotness_score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_trending_rank_overall ON mv_trending_content(rank_overall) WHERE rank_overall IS NOT NULL",

  // Platform comparison indexes
  "CREATE INDEX IF NOT EXISTS idx_mv_platform_comp_date ON mv_platform_comparison(metric_date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_mv_platform_comp_metric ON mv_platform_comparison(metric_name)",
];

export const DATABASE_INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform)",
  "CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author)",
  "CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(score)",
  // Compound indexes for trend analysis on posts
  "CREATE INDEX IF NOT EXISTS idx_posts_platform_created ON posts(platform, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_posts_platform_score ON posts(platform, score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_posts_platform_created_score ON posts(platform, created_at DESC, score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_posts_created_engagement ON posts(created_at DESC, engagement_rate DESC)",

  "CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)",
  "CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)",
  "CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author)",
  "CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at)",
  // Compound indexes for trend analysis on comments
  "CREATE INDEX IF NOT EXISTS idx_comments_platform_created ON comments(platform, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC)",

  "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
  "CREATE INDEX IF NOT EXISTS idx_users_platform ON users(platform)",
  "CREATE INDEX IF NOT EXISTS idx_users_karma ON users(karma DESC) WHERE karma > 0",

  "CREATE INDEX IF NOT EXISTS idx_sessions_platform ON scraping_sessions(platform)",
  "CREATE INDEX IF NOT EXISTS idx_sessions_status ON scraping_sessions(status)",
  "CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON scraping_sessions(started_at)",

  // Trend metrics indexes
  "CREATE INDEX IF NOT EXISTS idx_trend_metrics_platform ON trend_metrics(platform)",
  "CREATE INDEX IF NOT EXISTS idx_trend_metrics_type ON trend_metrics(metric_type)",
  "CREATE INDEX IF NOT EXISTS idx_trend_metrics_calculated ON trend_metrics(calculated_at DESC)",
  // Compound indexes for trend metrics
  "CREATE INDEX IF NOT EXISTS idx_trend_metrics_platform_time ON trend_metrics(platform, calculated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_trend_metrics_platform_type_time ON trend_metrics(platform, metric_type, calculated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_trend_metrics_type_name_window ON trend_metrics(metric_type, metric_name, time_window)",

  // Time series hourly indexes
  "CREATE INDEX IF NOT EXISTS idx_time_series_hourly_platform ON time_series_hourly(platform)",
  "CREATE INDEX IF NOT EXISTS idx_time_series_hourly_bucket ON time_series_hourly(hour_bucket DESC)",
  // Compound indexes for time-range + platform queries
  "CREATE INDEX IF NOT EXISTS idx_time_series_hourly_platform_bucket ON time_series_hourly(platform, hour_bucket DESC)",

  // Time series daily indexes
  "CREATE INDEX IF NOT EXISTS idx_time_series_daily_platform ON time_series_daily(platform)",
  "CREATE INDEX IF NOT EXISTS idx_time_series_daily_date ON time_series_daily(date DESC)",
  // Compound indexes for time-range + platform queries
  "CREATE INDEX IF NOT EXISTS idx_time_series_daily_platform_date ON time_series_daily(platform, date DESC)",

  // Keyword trends indexes
  "CREATE INDEX IF NOT EXISTS idx_keyword_trends_keyword ON keyword_trends(keyword)",
  "CREATE INDEX IF NOT EXISTS idx_keyword_trends_platform ON keyword_trends(platform)",
  "CREATE INDEX IF NOT EXISTS idx_keyword_trends_date ON keyword_trends(date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_keyword_trends_score ON keyword_trends(trending_score DESC)",
  // Compound indexes for keyword analysis
  "CREATE INDEX IF NOT EXISTS idx_keyword_trends_platform_date ON keyword_trends(platform, date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_keyword_trends_keyword_platform_date ON keyword_trends(keyword, platform, date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_keyword_trends_platform_score ON keyword_trends(platform, trending_score DESC)",

  // User influence scores indexes
  "CREATE INDEX IF NOT EXISTS idx_user_influence_user ON user_influence_scores(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_user_influence_platform ON user_influence_scores(platform)",
  "CREATE INDEX IF NOT EXISTS idx_user_influence_date ON user_influence_scores(calculation_date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_user_influence_score ON user_influence_scores(influence_score DESC)",
  // Compound indexes for user influence queries
  "CREATE INDEX IF NOT EXISTS idx_user_influence_platform_date ON user_influence_scores(platform, calculation_date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_user_influence_platform_score ON user_influence_scores(platform, influence_score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_user_influence_user_platform_date ON user_influence_scores(user_id, platform, calculation_date DESC)",
];

export const DATABASE_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS update_post_scraped_at
   AFTER UPDATE ON posts
   BEGIN
     UPDATE posts SET scraped_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
   END`,

  `CREATE TRIGGER IF NOT EXISTS update_comment_scraped_at
   AFTER UPDATE ON comments
   BEGIN
     UPDATE comments SET scraped_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
   END`,

  `CREATE TRIGGER IF NOT EXISTS update_user_scraped_at
   AFTER UPDATE ON users
   BEGIN
     UPDATE users SET scraped_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
   END`,
];
