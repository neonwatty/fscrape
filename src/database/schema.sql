-- fscrape Multi-Platform Database Schema
-- Supports Reddit, HackerNews, and future platforms
-- Version: 1.0.0

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Forum posts table with generated columns for analytics
CREATE TABLE IF NOT EXISTS posts (
    -- Primary identifiers
    id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('reddit', 'hackernews')),
    platform_id TEXT NOT NULL,  -- Platform-specific ID
    
    -- Content fields
    title TEXT NOT NULL,
    content TEXT,
    url TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id TEXT,
    
    -- Metrics
    score INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps (stored as Unix milliseconds)
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    -- Metadata (JSON)
    metadata TEXT,
    
    -- Generated columns for analytics
    score_normalized REAL GENERATED ALWAYS AS (
        CASE 
            WHEN score < 0 THEN 0.0
            WHEN score > 10000 THEN 1.0
            ELSE score / 10000.0
        END
    ) STORED,
    
    engagement_rate REAL GENERATED ALWAYS AS (
        CASE
            WHEN score = 0 THEN 0.0
            ELSE CAST(comment_count AS REAL) / (score + 1)
        END
    ) STORED,
    
    -- Constraints
    PRIMARY KEY (platform, platform_id),
    UNIQUE(id),
    CHECK(length(title) > 0),
    CHECK(created_at > 0)
);

-- Comments table with hierarchical support
CREATE TABLE IF NOT EXISTS comments (
    -- Primary identifiers
    id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('reddit', 'hackernews')),
    platform_id TEXT NOT NULL,
    
    -- Relationships
    post_id TEXT NOT NULL,
    parent_id TEXT,
    
    -- Content
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id TEXT,
    
    -- Metrics
    score INTEGER NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 0 CHECK(depth >= 0),
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    -- Constraints
    PRIMARY KEY (platform, platform_id),
    UNIQUE(id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    CHECK(length(content) > 0)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    -- Primary identifiers
    id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('reddit', 'hackernews')),
    username TEXT NOT NULL,
    
    -- Metrics
    karma INTEGER,
    post_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER,
    last_seen_at INTEGER,
    scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    -- Metadata
    metadata TEXT,
    
    -- Constraints
    PRIMARY KEY (platform, id),
    UNIQUE(platform, username),
    CHECK(length(username) > 0)
);

-- ============================================================================
-- Scraping Management Tables
-- ============================================================================

-- Scraping sessions for resume capability
CREATE TABLE IF NOT EXISTS scraping_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('reddit', 'hackernews')),
    
    -- Query parameters
    query_type TEXT CHECK(query_type IN ('subreddit', 'search', 'user', 'post', 'frontpage')),
    query_value TEXT,
    sort_by TEXT,
    time_range TEXT,
    
    -- Session state
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Progress tracking
    total_items_target INTEGER,
    total_items_scraped INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    last_item_id TEXT,
    resume_token TEXT,
    
    -- Timing
    started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    completed_at INTEGER,
    last_activity_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    -- Error handling
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Metadata
    metadata TEXT,
    
    -- Constraints
    CHECK(completed_at IS NULL OR completed_at >= started_at)
);

-- Scraping metrics for monitoring
CREATE TABLE IF NOT EXISTS scraping_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('reddit', 'hackernews')),
    
    -- Time window (5-minute buckets)
    time_bucket INTEGER NOT NULL,
    
    -- Counts
    requests_made INTEGER DEFAULT 0,
    requests_successful INTEGER DEFAULT 0,
    requests_failed INTEGER DEFAULT 0,
    
    -- Data metrics
    posts_scraped INTEGER DEFAULT 0,
    comments_scraped INTEGER DEFAULT 0,
    users_scraped INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_response_time_ms INTEGER,
    min_response_time_ms INTEGER,
    max_response_time_ms INTEGER,
    
    -- Rate limiting
    rate_limit_hits INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    
    -- Constraints
    FOREIGN KEY (session_id) REFERENCES scraping_sessions(session_id) ON DELETE CASCADE,
    UNIQUE(session_id, time_bucket)
);

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limit_state (
    platform TEXT PRIMARY KEY CHECK(platform IN ('reddit', 'hackernews')),
    
    -- Current window
    window_start INTEGER NOT NULL,
    requests_in_window INTEGER DEFAULT 0,
    
    -- Rate limit info
    requests_per_minute INTEGER DEFAULT 60,
    requests_per_hour INTEGER DEFAULT 1000,
    
    -- Backoff state
    retry_after INTEGER,
    last_request_at INTEGER,
    consecutive_errors INTEGER DEFAULT 0,
    
    -- Updated timestamp
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Forum posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_engagement ON posts(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_posts_scraped_at ON posts(scraped_at DESC);

-- Covering index for common queries
CREATE INDEX IF NOT EXISTS idx_posts_listing ON posts(
    platform, created_at DESC, score DESC
) WHERE score > 0;

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_karma ON users(karma DESC) WHERE karma > 0;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_status ON scraping_sessions(status) 
    WHERE status IN ('running', 'pending');
CREATE INDEX IF NOT EXISTS idx_sessions_platform ON scraping_sessions(platform);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON scraping_sessions(started_at DESC);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_session ON scraping_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_metrics_time ON scraping_metrics(time_bucket DESC);

-- ============================================================================
-- Triggers for Data Integrity
-- ============================================================================

-- Update scraped_at on modifications
CREATE TRIGGER IF NOT EXISTS update_post_scraped_at
    AFTER UPDATE ON posts
    FOR EACH ROW
BEGIN
    UPDATE posts 
    SET scraped_at = strftime('%s', 'now') * 1000 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_comment_scraped_at
    AFTER UPDATE ON comments
    FOR EACH ROW
BEGIN
    UPDATE comments 
    SET scraped_at = strftime('%s', 'now') * 1000 
    WHERE id = NEW.id;
END;

-- Update user activity
CREATE TRIGGER IF NOT EXISTS update_user_activity
    AFTER INSERT ON posts
    FOR EACH ROW
BEGIN
    UPDATE users 
    SET post_count = post_count + 1,
        last_seen_at = NEW.created_at
    WHERE platform = NEW.platform AND id = NEW.author_id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_comment_activity
    AFTER INSERT ON comments
    FOR EACH ROW
BEGIN
    UPDATE users 
    SET comment_count = comment_count + 1,
        last_seen_at = NEW.created_at
    WHERE platform = NEW.platform AND id = NEW.author_id;
END;

-- Update session activity
CREATE TRIGGER IF NOT EXISTS update_session_activity
    AFTER UPDATE ON scraping_sessions
    FOR EACH ROW
    WHEN NEW.status = 'running'
BEGIN
    UPDATE scraping_sessions 
    SET last_activity_at = strftime('%s', 'now') * 1000 
    WHERE id = NEW.id;
END;

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Hot posts view
CREATE VIEW IF NOT EXISTS hot_posts AS
SELECT 
    p.*,
    CAST((p.score + p.comment_count * 2) AS REAL) / 
        (1 + (strftime('%s', 'now') * 1000 - p.created_at) / 3600000) AS hotness
FROM posts p
WHERE p.created_at > (strftime('%s', 'now') * 1000 - 86400000)  -- Last 24 hours
ORDER BY hotness DESC;

-- User statistics view
CREATE VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.platform,
    u.username,
    u.karma,
    u.post_count,
    u.comment_count,
    COUNT(DISTINCT p.id) AS actual_posts,
    COUNT(DISTINCT c.id) AS actual_comments,
    AVG(p.score) AS avg_post_score,
    AVG(c.score) AS avg_comment_score
FROM users u
LEFT JOIN posts p ON u.platform = p.platform AND u.id = p.author_id
LEFT JOIN comments c ON u.platform = c.platform AND u.id = c.author_id
GROUP BY u.platform, u.id;

-- Session performance view
CREATE VIEW IF NOT EXISTS session_performance AS
SELECT 
    s.session_id,
    s.platform,
    s.status,
    s.total_items_scraped,
    CAST(s.total_items_scraped AS REAL) / 
        MAX(1, (s.last_activity_at - s.started_at) / 1000) AS items_per_second,
    SUM(m.requests_made) AS total_requests,
    SUM(m.requests_failed) AS total_failures,
    AVG(m.avg_response_time_ms) AS avg_response_time
FROM scraping_sessions s
LEFT JOIN scraping_metrics m ON s.session_id = m.session_id
GROUP BY s.session_id;