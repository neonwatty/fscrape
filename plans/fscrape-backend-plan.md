# Forum Scraper (fscrape) - Multi-Platform Data Collection Tool
## Supporting Reddit and Future Platforms (Hacker News, etc.)
## Using Playwright, TypeScript, and SQLite

## Project Structure
```
fscrape/                    # NPM package directory
├── src/
│   ├── platforms/         # Platform-specific implementations
│   │   ├── base/
│   │   │   ├── scraper.interface.ts  # Base scraper interface
│   │   │   ├── post.interface.ts     # Base post interface
│   │   │   └── types.ts              # Shared types
│   │   ├── reddit/
│   │   │   ├── scraper.ts            # Reddit scraper implementation
│   │   │   ├── types.ts              # Reddit-specific types
│   │   │   ├── validator.ts          # Reddit data validation
│   │   │   └── url-builder.ts        # Reddit URL construction
│   │   └── hackernews/                # Future: HN implementation
│   │       ├── scraper.ts
│   │       ├── types.ts
│   │       └── api-client.ts
│   ├── database.ts        # SQLite database operations
│   ├── cli.ts             # CLI entry point
│   ├── validator.ts       # Common data validation with Zod
│   ├── rateLimiter.ts     # Rate limiting and retry logic
│   ├── exporter.ts        # CSV/JSON export functionality
│   ├── config.ts          # Configuration management
│   ├── platform-factory.ts # Factory for creating platform scrapers
│   └── utils.ts           # Utility functions
├── tests/
│   ├── unit/
│   │   ├── database.test.ts
│   │   ├── scraper.test.ts
│   │   ├── validator.test.ts
│   │   └── utils.test.ts
│   ├── integration/
│   │   ├── reddit-api.test.ts
│   │   └── end-to-end.test.ts
│   └── fixtures/
│       └── mock-posts.json
├── data/
│   └── forum_posts.db     # SQLite database (multi-platform)
├── logs/                   # Scraping logs
├── exports/                # Exported CSV/JSON files
├── config/
│   ├── default.json       # Default configuration
│   └── scraper.config.json # User configuration
├── package.json
├── tsconfig.json
├── vitest.config.ts       # Vitest testing configuration
└── .env                    # Environment variables

# After running 'fscrape init' in a project:
my-project/
├── .fscraperс              # Configuration file (just DB path)
├── .fscrape/               # Data directory
│   ├── forum_posts.db     # SQLite database
│   ├── exports/           # Export directory
│   └── logs/              # Log files
└── .gitignore              # Auto-updated to include .fscrape/
```

## Implementation Steps

### 1. Project Setup
- Initialize TypeScript project with npm
- Install dependencies:
  - **Core:**
    - `playwright` - Browser automation
    - `better-sqlite3` - SQLite database (synchronous, faster)
    - `commander` - CLI framework
    - `dotenv` - Environment configuration
    - `winston` - Logging
    - `chalk` - Terminal styling
  - **Data Processing:**
    - `zod` - Schema validation
    - `csv-writer` - CSV export
    - `p-limit` - Concurrency control
    - `p-retry` - Retry logic with exponential backoff
  - **Testing:**
    - `vitest` - Testing framework
    - `@vitest/ui` - Test UI
    - `@playwright/test` - E2E testing
    - `msw` - Mock service worker for API mocking
  - **Development:**
    - TypeScript type definitions
    - `tsx` - TypeScript execution
    - `nodemon` - Development auto-reload

### 2. Database Schema (Multi-Platform)
Create SQLite tables supporting multiple platforms:
```sql
-- Main posts table (platform-agnostic)
CREATE TABLE forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,          -- 'reddit', 'hackernews', etc.
    platform_id TEXT NOT NULL,       -- Platform-specific ID (e.g., Reddit's "t3_abc123")
    source TEXT NOT NULL,             -- Subreddit, HN category, etc.
    title TEXT NOT NULL,
    author TEXT,
    created_utc INTEGER NOT NULL,
    score INTEGER,
    num_comments INTEGER,
    post_url TEXT NOT NULL,
    selftext TEXT,              -- Text content for self posts
    is_video BOOLEAN DEFAULT 0,
    is_self BOOLEAN DEFAULT 0,
    is_crosspost BOOLEAN DEFAULT 0,
    media_url TEXT,             -- URL for images/videos
    thumbnail TEXT,
    flair TEXT,
    awards_count INTEGER DEFAULT 0,
    upvote_ratio REAL,
    post_hint TEXT,             -- Type hint (image, video, link, etc.)
    is_deleted BOOLEAN DEFAULT 0,
    is_removed BOOLEAN DEFAULT 0,
    platform_metadata JSON,         -- Platform-specific fields as JSON
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_period TEXT,           -- The time period used when scraping
    category TEXT,              -- hot, new, rising, controversial, top
    year INTEGER GENERATED ALWAYS AS (strftime('%Y', datetime(created_utc, 'unixepoch'))),
    month INTEGER GENERATED ALWAYS AS (strftime('%m', datetime(created_utc, 'unixepoch'))),
    day_of_week TEXT GENERATED ALWAYS AS (strftime('%w', datetime(created_utc, 'unixepoch'))),
    hour INTEGER GENERATED ALWAYS AS (strftime('%H', datetime(created_utc, 'unixepoch'))),
    UNIQUE(platform, platform_id)  -- Ensure uniqueness per platform
);

-- Scraping sessions table for tracking
CREATE TABLE scraping_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    source TEXT NOT NULL,           -- Subreddit, HN category, etc.
    time_period TEXT,
    category TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    posts_found INTEGER DEFAULT 0,
    posts_new INTEGER DEFAULT 0,
    posts_updated INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',  -- running, completed, failed
    error_message TEXT
);

-- Metrics table for monitoring
CREATE TABLE scraping_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    metric_name TEXT,
    metric_value REAL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES scraping_sessions(session_id)
);

CREATE UNIQUE INDEX idx_platform_id ON forum_posts(platform, platform_id);
CREATE INDEX idx_platform_source ON forum_posts(platform, source, created_utc);
CREATE INDEX idx_author ON forum_posts(author);
CREATE INDEX idx_score ON forum_posts(score);
CREATE INDEX idx_category ON forum_posts(category);
CREATE INDEX idx_platform ON forum_posts(platform);
```

### 3. CLI Implementation
Command-line interface with platform support:
```bash
# First time setup (run in your project directory)
fscrape init

# Basic usage (Reddit is default platform)
fscrape --source chrome_extensions --time year

# Explicit platform selection
fscrape --platform reddit --subreddit chrome_extensions --time year

# Future: Hacker News support
fscrape --platform hn --category top --time day

# All options
fscrape [--platform <reddit|hn>] -s <source> -t <hour|day|week|month|year|all> [options]
```

**CLI Features**:
- Optional: `--platform/-p` - Platform to scrape (reddit, hn) (default: reddit)
- Required: `--source/-s` - Source identifier (subreddit for Reddit, category for HN)
- Required: `--time/-t` - Time period (hour, day, week, month, year, all)
- Optional: `--limit/-l` - Max posts to collect (default: all available)
- Optional: `--category/-c` - Category (hot, new, top, rising, controversial) (default: top)
- Optional: `--headless` - Run browser in headless mode (default: true)
- Optional: `--verbose/-v` - Verbose logging
- Optional: `--export/-e` - Export format (csv, json, both)
- Optional: `--delay/-d` - Delay between requests in ms (default: 1000)
- Optional: `--retry` - Max retry attempts (default: 3)
- Optional: `--proxy` - Proxy URL for requests
- Optional: `--user-agent` - Custom user agent string
- Optional: `--resume` - Resume from last failed session
- Optional: `--config` - Path to config file

### 4. Init Process and Configuration

#### Init Command
The `fscrape init` command sets up a project for scraping:

```bash
$ fscrape init
✓ Created .fscraperс configuration file
✓ Created .fscrape/ directory structure
✓ Initialized database at .fscrape/forum_posts.db
✓ Added .fscrape/ to .gitignore

Ready to scrape! Try: fscrape --source chrome_extensions --time day
```

**Init Options**:
- `fscrape init --db-path <path>` - Custom database location
- `fscrape init --force` - Overwrite existing configuration
- `fscrape init --global` - Initialize global configuration at ~/.fscrape/

#### Configuration File (.fscraperс)
Minimal configuration with just database path:
```json
{
  "database": {
    "path": "./.fscrape/forum_posts.db"
  }
}
```

#### Configuration Discovery
When running fscrape commands, configuration is discovered in this order:
1. **Command line**: `--config` flag if provided
2. **Current directory**: `./.fscraperс`
3. **Parent directories**: Walk up looking for `.fscraperс`
4. **Global config**: `~/.fscrape/` if no local config found
5. **Defaults**: In-memory defaults if no config exists

#### Directory Structure After Init
```
.fscrape/
├── forum_posts.db         # SQLite database
├── exports/               # CSV/JSON exports
│   ├── 2024-01-15_reddit_chrome_extensions.csv
│   └── 2024-01-15_reddit_chrome_extensions.json
└── logs/                  # Scraping logs
    └── fscrape.log
```

#### Usage After Init
```bash
# In project with .fscraperс (uses local config automatically)
fscrape --source chrome_extensions --time day

# From any directory (config discovery walks up)
cd subdir && fscrape --source webdev --time week

# Override config location
fscrape --config ~/other-project/.fscraperс --source reactjs --time month

# Use global config explicitly
fscrape --global --source typescript --time day
```

### 5. Scraper Implementation
- **Platform Factory**: Create appropriate scraper based on platform
  ```typescript
  const scraper = ScraperFactory.create(platform);
  const posts = await scraper.scrape(config);
  ```
- **Rate Limiting**:
  - Configurable delays between requests (default: 1000ms)
  - Exponential backoff on failures
  - Respect Reddit's rate limits
- **Data Extraction**:
  - Extract Reddit's unique post ID from post elements
  - Parse timestamps (convert relative to UTC)
  - Extract all metadata including media URLs
  - Detect deleted/removed posts
  - Handle different post types (text, link, image, video)
- **Pagination**: 
  - Handle infinite scroll with scroll detection
  - Implement scroll timeout and retry logic
  - Track loaded posts to detect when no new content
- **Duplicate Prevention**: 
  - Use Reddit's post ID for deduplication
  - Update existing posts if score/comments changed
- **Error Recovery**:
  - Save progress periodically
  - Resume capability from last successful point
  - Graceful degradation on partial failures

### 6. Data Processing & Validation
- **Data Validation**:
  - Use Zod schemas for type-safe validation
  - Sanitize HTML and special characters
  - Validate URLs and timestamps
  - Handle missing or malformed data gracefully
- **Unique Identifier**: Extract Reddit's post ID (format: "t3_xxxxx")
- **Upsert Logic**: 
  - INSERT OR REPLACE for complete updates
  - Track changes between scrapes
  - Maintain history of score/comment changes
- **Batch Processing**: 
  - Insert posts in configurable batch sizes
  - Use transactions for consistency
  - Implement connection pooling
- **Statistics**: 
  - Report new posts vs existing posts
  - Calculate scraping velocity
  - Track success/failure rates
  - Generate performance metrics

## Code Components

### Types (types.ts)
```typescript
// Base post interface (platform-agnostic)
interface ForumPost {
  platform: 'reddit' | 'hackernews' | string;
  platform_id: string;    // Platform's unique identifier
  source: string;         // Subreddit, HN category, etc.
  title: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  post_url: string;
  selftext?: string;
  is_video: boolean;
  is_self: boolean;
  is_crosspost: boolean;
  media_url?: string;
  thumbnail?: string;
  flair?: string;
  awards_count: number;
  upvote_ratio?: number;
  post_hint?: string;
  is_deleted: boolean;
  is_removed: boolean;
  time_period: string;
  category: string;
  platform_metadata?: Record<string, any>; // Platform-specific data
}

// Reddit-specific post interface
interface RedditPost extends ForumPost {
  platform: 'reddit';
  subreddit: string;  // Alias for source
  reddit_specific: {
    is_crosspost: boolean;
    awards_count: number;
    upvote_ratio?: number;
    post_hint?: string;
  };
}

type Platform = 'reddit' | 'hackernews';
type TimePeriod = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
type Category = 'hot' | 'new' | 'top' | 'rising' | 'controversial';
type ExportFormat = 'csv' | 'json' | 'both';

interface ScraperConfig {
  platform: Platform;
  source: string;        // Subreddit for Reddit, category for HN
  timePeriod: TimePeriod;
  category: Category;
  limit?: number;
  delay: number;
  retryAttempts: number;
  headless: boolean;
  userAgent?: string;
  proxy?: string;
  exportFormat?: ExportFormat;
}

interface ScrapingSession {
  sessionId: string;
  platform: string;
  source: string;
  timePeriod: string;
  category: string;
  startedAt: Date;
  completedAt?: Date;
  postsFound: number;
  postsNew: number;
  postsUpdated: number;
  status: 'running' | 'completed' | 'failed';
  errorMessage?: string;
}
```

### CLI Structure (cli.ts)
```typescript
// Parse arguments with Commander
// Default platform to 'reddit' if not specified
// Load configuration from file if provided
// Merge CLI args with config file
// Validate all inputs with Zod
// Create appropriate scraper based on platform
// Initialize database and check schema
// Create scraping session with platform info
// Setup signal handlers for graceful shutdown
// Initialize rate limiter
// Run scraper with progress tracking
// Export data if requested
// Generate and display statistics
// Report results and metrics
```

### Database Operations (database.ts)
- Initialize database with connection pooling
- Create tables with migration support
- Upsert posts with transaction support
- Batch insert with configurable size
- Query methods:
  - Get posts by platform and date range
  - Get top posts by score and platform
  - Get posts by author and platform
  - Full-text search support
- Statistics methods:
  - Count by platform/source/time period
  - Average scores by day/hour
  - Growth trends analysis
  - User activity patterns
- Session management:
  - Create/update scraping sessions
  - Track metrics per session
  - Resume from failed sessions
- Data export queries for CSV/JSON

### Platform-Specific Scraper Logic

#### Reddit Scraper (platforms/reddit/scraper.ts)
- Launch Playwright browser with custom user agent
- Configure proxy if provided
- Navigate to subreddit with filters
- Wait for initial content load
- Implement rate limiting between actions
- Extract comprehensive post data:
  - Parse all post metadata
  - Detect post type and media
  - Handle deleted/removed posts
  - Extract award information
- Handle pagination:
  - Scroll with intersection observer
  - Detect when no new content loads
  - Implement timeout and retry logic
- Progress tracking with ETA
- Memory management for large scrapes
- Return validated array of ForumPost objects

#### Hacker News Scraper (platforms/hackernews/scraper.ts) - Future
- Use HN API (https://github.com/HackerNews/API)
- No browser automation needed
- Fetch posts using REST endpoints
- Transform to ForumPost format

## Error Handling & Recovery
- **Input Validation**:
  - Invalid subreddit names (404 detection)
  - Invalid time periods (validation before request)
  - Malformed configuration files
- **Network Issues**:
  - Network timeouts with configurable limits
  - Retry with exponential backoff
  - Proxy failures and fallback
  - Rate limit detection and throttling
- **Data Issues**:
  - Malformed HTML parsing
  - Missing required fields
  - Invalid data types
  - Character encoding problems
- **Database Issues**:
  - Connection failures
  - Write failures with rollback
  - Disk space monitoring
  - Deadlock detection
- **Recovery Mechanisms**:
  - Save progress on partial failures
  - Resume from last checkpoint
  - Graceful browser cleanup
  - Signal handling (SIGINT, SIGTERM)
  - Error reporting with context

## Output & Reporting
After each run, display:
- **Summary**:
  - Subreddit scraped
  - Time period and category used
  - Session ID for reference
- **Statistics**:
  - Total posts found
  - New posts added
  - Posts updated
  - Duplicate posts skipped
  - Deleted/removed posts detected
- **Performance**:
  - Execution time
  - Posts per minute rate
  - Memory usage
  - Network requests made
  - Retry attempts
- **Export Results** (if requested):
  - File paths for exports
  - Export file sizes
  - Records exported
- **Warnings/Errors**:
  - Rate limit warnings
  - Failed extractions
  - Validation errors

## Example Usage
```bash
# Initialize fscrape in your project
fscrape init

# Reddit scraping (default platform)
fscrape --source chrome_extensions --time year
fscrape -s chrome_extensions -t year  # Short form

# Explicit Reddit platform
fscrape --platform reddit --source webdev --time month --limit 50 --export csv

# Future: Hacker News scraping
fscrape --platform hn --category top --time day
fscrape -p hn -c show --time week --export json

# Scrape with verbose logging and export to both formats
fscrape -s reactjs -t week --verbose --export both

# Use configuration file
fscrape --config ./config/production.json

# Resume failed session
fscrape --resume session_abc123

# Run tests
npm run test              # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests
npm run test:coverage    # Generate coverage report

# Package installation and global CLI
npm install -g fscrape    # Install globally
fscrape --help           # Show help and available platforms
```

## Testing Strategy

### Unit Tests (Vitest)
- **Database Operations**:
  - Connection management
  - CRUD operations
  - Transaction handling
  - Query performance
- **Data Validation**:
  - Zod schema validation
  - Data sanitization
  - Type checking
- **Rate Limiting**:
  - Delay calculations
  - Retry logic
  - Backoff strategies
- **Export Functions**:
  - CSV generation
  - JSON formatting
  - File writing

### Integration Tests
- **Reddit Scraping** (with mocked responses):
  - Page navigation
  - Data extraction
  - Pagination handling
- **End-to-End Flow**:
  - Complete scraping session
  - Database persistence
  - Export generation
- **Error Scenarios**:
  - Network failures
  - Invalid data
  - Rate limiting

### Test Configuration
```typescript
// vitest.config.ts
export default {
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'tests']
    },
    setupFiles: ['./tests/setup.ts']
  }
};
```

## Performance Optimizations
- **Database**:
  - Connection pooling with configurable size
  - Prepared statements for repeated queries
  - Batch inserts with optimal size (default: 100)
  - Index optimization for common queries
- **Memory Management**:
  - Stream processing for large datasets
  - Periodic garbage collection hints
  - Limited in-memory cache size
- **Network**:
  - HTTP/2 support where available
  - Keep-alive connections
  - Parallel processing with concurrency limits
- **Caching**:
  - LRU cache for frequently accessed data
  - Session-based result caching
  - Configurable cache TTL

## Monitoring & Observability
- **Metrics Collection**:
  - Scraping velocity (posts/minute)
  - Success/failure rates
  - Response times
  - Memory usage over time
- **Health Checks**:
  - Database connectivity
  - Disk space availability
  - Network connectivity
  - Browser process health
- **Logging Levels**:
  - ERROR: Critical failures
  - WARN: Recoverable issues
  - INFO: Progress updates
  - DEBUG: Detailed operations
  - TRACE: Full data dumps
- **Alerting** (via log monitoring):
  - Scraping failures
  - Rate limit hits
  - Database errors
  - Performance degradation

## Configuration Management

### Simple Configuration (.fscraperс)
The configuration is kept minimal - just the database path:
```json
{
  "database": {
    "path": "./.fscrape/forum_posts.db"
  }
}
```

All other settings are provided via CLI flags with sensible defaults:
- `--delay` (default: 1000ms)
- `--retry` (default: 3)
- `--headless` (default: true)
- `--verbose` (default: false)
- `--export` (default: none)

### Advanced Configuration (Optional)
For users who need more control, the config can be extended:
```json
{
  "database": {
    "path": "./.fscrape/forum_posts.db",
    "vacuum": true,
    "maxSizeMB": 100
  },
  "defaults": {
    "platform": "reddit",
    "delay": 1500,
    "headless": true
  },
  "export": {
    "path": "./.fscrape/exports",
    "autoExport": true,
    "formats": ["csv", "json"]
  },
  "frontend": {
    "syncPath": "../fscrape-frontend/public/data/",
    "autoSync": false
  }
}
```

### Environment Variables
```bash
# Override config path
FSCRAPE_CONFIG=./custom/.fscraperс fscrape --source webdev --time day

# Override database path
FSCRAPE_DB=./other.db fscrape --source reactjs --time week
```

## Security Considerations
- **Input Sanitization**: All user inputs validated and sanitized
- **SQL Injection Prevention**: Use parameterized queries only
- **Rate Limiting**: Respect Reddit's terms of service
- **User Agent**: Identify bot appropriately
- **Proxy Support**: Optional proxy for privacy
- **No Credential Storage**: No Reddit login required

## Future Enhancements
- Comment scraping with thread structure
- User profile analysis
- Subreddit statistics dashboard
- Multiple subreddit support in single run
- WebSocket support for real-time updates
- GraphQL API for data access
- Docker containerization
- Kubernetes deployment manifests
- Webhook notifications for completed scrapes
- Machine learning for content classification