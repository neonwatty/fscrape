export const DATABASE_SCHEMA = {
  posts: `
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
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

  scrape_sessions: `
    CREATE TABLE IF NOT EXISTS scrape_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      query TEXT,
      subreddit TEXT,
      category TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT NOT NULL,
      total_posts INTEGER DEFAULT 0,
      total_comments INTEGER DEFAULT 0,
      total_users INTEGER DEFAULT 0,
      error_message TEXT,
      metadata TEXT
    )
  `,

  rate_limit_state: `
    CREATE TABLE IF NOT EXISTS rate_limit_state (
      platform TEXT PRIMARY KEY,
      requests_count INTEGER DEFAULT 0,
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
};

export const DATABASE_INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform)",
  "CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author)",
  "CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(score)",

  "CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)",
  "CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)",
  "CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author)",
  "CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at)",

  "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
  "CREATE INDEX IF NOT EXISTS idx_users_platform ON users(platform)",
  "CREATE INDEX IF NOT EXISTS idx_users_karma ON users(karma DESC) WHERE karma > 0",

  "CREATE INDEX IF NOT EXISTS idx_sessions_platform ON scrape_sessions(platform)",
  "CREATE INDEX IF NOT EXISTS idx_sessions_status ON scrape_sessions(status)",
  "CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON scrape_sessions(started_at)",
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
