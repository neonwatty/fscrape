# fscrape: API-First Multi-Platform Forum Scraper - Comprehensive Implementation Plan

## 🎯 Executive Summary

**Objective**: Build a production-ready CLI tool that scrapes multiple forum platforms using direct API calls instead of browser automation, while maintaining comprehensive enterprise features.

**Key Innovation**: Replace Playwright browser automation with direct Reddit JSON API + Hacker News Firebase API for 10x performance improvement while preserving all sophisticated features from the original plan.

---

## 🏗️ Technical Architecture

### Core Philosophy: API-First + Enterprise Features
- **Performance**: Direct API calls (no browser overhead)
- **Reliability**: APIs don't break like UIs do
- **Scalability**: Handle thousands of posts efficiently
- **Extensibility**: Plugin system for new platforms
- **Enterprise-Ready**: Comprehensive logging, monitoring, configuration

### Platform Abstraction Layer
```typescript
abstract class PlatformScraper {
  // Core API methods every platform must implement
  abstract buildApiUrl(config: ScraperConfig): string;
  abstract parseResponse(response: any): ForumPost[];
  abstract getNextPageToken(response: any): string | null;
  abstract getRateLimit(): { requestsPerMinute: number; burst: number };
  abstract mapToForumPost(item: any): ForumPost;
  
  // Shared functionality across all platforms
  protected async fetchWithRetry(url: string): Promise<any>;
  protected respectRateLimit(): Promise<void>;
  protected cacheResponse(key: string, data: any): void;
}
```

### Multi-Tier Rate Limiting Strategy
```typescript
class AdvancedRateLimiter {
  // 1. Request Queue (prevents overwhelming APIs)
  private queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 1 });
  
  // 2. Exponential Backoff (handles temporary failures)
  async requestWithBackoff(url: string, retries = 3): Promise<Response>;
  
  // 3. Response Caching (reduces API calls)
  private cache = new LRUCache<string, { data: any, expires: number }>({ max: 1000 });
  
  // 4. Adaptive Rate Limiting (learns from API responses)
  adjustRate(platform: string, statusCode: number): void;
  
  // 5. Platform-Specific Limits
  private platformLimits = {
    reddit: { rpm: 60, burst: 5 },
    hackernews: { rpm: 300, burst: 20 }
  };
}
```

---

## 📊 Database Design (Multi-Platform Schema)

### Core Tables
```sql
-- Platform-agnostic posts table
CREATE TABLE forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,              -- 'reddit', 'hackernews', etc.
    platform_id TEXT NOT NULL,           -- Platform's unique ID
    source TEXT NOT NULL,                 -- Subreddit, HN category, etc.
    title TEXT NOT NULL,
    author TEXT,
    created_utc INTEGER NOT NULL,
    score INTEGER,
    num_comments INTEGER,
    post_url TEXT NOT NULL,
    selftext TEXT,                        -- Text content for self posts
    is_video BOOLEAN DEFAULT 0,
    is_self BOOLEAN DEFAULT 0,
    is_crosspost BOOLEAN DEFAULT 0,
    media_url TEXT,
    thumbnail TEXT,
    flair TEXT,
    awards_count INTEGER DEFAULT 0,
    upvote_ratio REAL,
    post_hint TEXT,
    is_deleted BOOLEAN DEFAULT 0,
    is_removed BOOLEAN DEFAULT 0,
    platform_metadata JSON,              -- Platform-specific fields
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_period TEXT,
    category TEXT,
    
    -- Auto-generated date fields for analytics
    year INTEGER GENERATED ALWAYS AS (strftime('%Y', datetime(created_utc, 'unixepoch'))),
    month INTEGER GENERATED ALWAYS AS (strftime('%m', datetime(created_utc, 'unixepoch'))),
    day_of_week TEXT GENERATED ALWAYS AS (strftime('%w', datetime(created_utc, 'unixepoch'))),
    hour INTEGER GENERATED ALWAYS AS (strftime('%H', datetime(created_utc, 'unixepoch'))),
    
    UNIQUE(platform, platform_id)
);

-- Session tracking for resume capability
CREATE TABLE scraping_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    source TEXT NOT NULL,
    time_period TEXT,
    category TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    posts_found INTEGER DEFAULT 0,
    posts_new INTEGER DEFAULT 0,
    posts_updated INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',       -- running, completed, failed
    error_message TEXT
);

-- Performance metrics
CREATE TABLE scraping_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    metric_name TEXT,                    -- 'requests_per_minute', 'cache_hit_rate', etc.
    metric_value REAL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES scraping_sessions(session_id)
);

-- Optimized indexes
CREATE UNIQUE INDEX idx_platform_id ON forum_posts(platform, platform_id);
CREATE INDEX idx_platform_source_time ON forum_posts(platform, source, created_utc);
CREATE INDEX idx_author ON forum_posts(author);
CREATE INDEX idx_score ON forum_posts(score DESC);
CREATE INDEX idx_category ON forum_posts(category, platform);
```

---

## 🎛️ CLI Interface Design

### Command Structure
```bash
# Project initialization
fscrape init [--db-path <path>] [--global] [--force]

# Core scraping commands
fscrape [PLATFORM] [SOURCE] [OPTIONS]

# Examples:
fscrape reddit programming --time week --sort top --limit 100 --export csv
fscrape hackernews --category top --limit 50 --export json
fscrape --platform reddit --source typescript --time month --verbose
```

### CLI Options (Comprehensive)
```bash
# Platform Selection
--platform, -p     Platform to scrape (reddit, hackernews) [default: reddit]

# Source Selection (Required)
--source, -s        Source identifier (subreddit for Reddit, category for HN)

# Time & Sorting
--time, -t          Time period (hour, day, week, month, year, all)
--sort              Sort type (hot, new, top, rising, controversial)

# Data Control
--limit, -l         Maximum posts to collect [default: 100]
--pages             Maximum pages to scrape [default: 10]

# Performance & Behavior
--delay, -d         Delay between requests in ms [default: 1000]
--retry             Max retry attempts [default: 3]
--batch-size        Database batch insert size [default: 100]
--cache-ttl         Response cache TTL in minutes [default: 5]

# Output & Export
--export, -e        Export format (csv, json, both, none) [default: none]
--export-path       Custom export directory
--verbose, -v       Verbose logging
--quiet, -q         Minimal output

# Advanced Options
--config            Path to config file
--resume            Resume from session ID
--proxy             Proxy URL for requests
--user-agent        Custom user agent string
--no-cache          Disable response caching
--dry-run           Show what would be scraped without doing it
```

---

## ⚙️ Configuration Management

### Configuration File Structure (.fscraperс)
```json
{
  "database": {
    "path": "./.fscrape/forum_posts.db",
    "vacuum": true,
    "maxSizeMB": 500,
    "backupEnabled": true
  },
  "platforms": {
    "reddit": {
      "userAgent": "fscrape/1.0.0 (Educational Research Tool)",
      "rateLimit": { "rpm": 60, "burst": 5 },
      "timeout": 10000,
      "defaultSort": "top"
    },
    "hackernews": {
      "rateLimit": { "rpm": 300, "burst": 20 },
      "timeout": 5000,
      "batchSize": 50
    }
  },
  "defaults": {
    "platform": "reddit",
    "delay": 1000,
    "retryAttempts": 3,
    "exportFormat": "none",
    "cacheEnabled": true,
    "cacheTTL": 5
  },
  "export": {
    "path": "./.fscrape/exports",
    "autoExport": false,
    "formats": ["csv"],
    "compression": false
  },
  "logging": {
    "level": "info",
    "path": "./.fscrape/logs",
    "maxFileSize": "10MB",
    "maxFiles": 5
  }
}
```

### Configuration Discovery Chain
1. CLI `--config` flag
2. Current directory `.fscraperс`  
3. Parent directories (walk up tree)
4. Global config `~/.fscrape/`
5. Built-in defaults

---

## 📁 Project Structure

```
fscrape/
├── src/
│   ├── platforms/                    # Platform implementations
│   │   ├── base/
│   │   │   ├── platform-scraper.ts  # Abstract base class
│   │   │   ├── rate-limiter.ts      # Advanced rate limiting
│   │   │   ├── cache.ts             # Response caching
│   │   │   ├── types.ts             # Common platform types
│   │   │   └── validator.ts         # Data validation schemas
│   │   ├── reddit/
│   │   │   ├── reddit-scraper.ts    # Reddit JSON API implementation
│   │   │   ├── reddit-api.ts        # Low-level API client
│   │   │   ├── reddit-mapper.ts     # Reddit → ForumPost mapping
│   │   │   ├── reddit-types.ts      # Reddit-specific types
│   │   │   └── reddit-validator.ts  # Reddit data validation
│   │   └── hackernews/
│   │       ├── hn-scraper.ts        # HN Firebase API implementation
│   │       ├── hn-api.ts            # HN API client
│   │       ├── hn-mapper.ts         # HN → ForumPost mapping
│   │       └── hn-types.ts          # HN-specific types
│   ├── database/
│   │   ├── database.ts              # SQLite operations
│   │   ├── migrations.ts            # Database migrations
│   │   ├── queries.ts               # Pre-built queries
│   │   └── analytics.ts             # Analytics queries
│   ├── export/
│   │   ├── exporter.ts              # Export coordinator
│   │   ├── csv-exporter.ts          # CSV generation
│   │   ├── json-exporter.ts         # JSON generation
│   │   └── formats.ts               # Export format types
│   ├── session/
│   │   ├── session-manager.ts       # Session tracking
│   │   ├── progress-tracker.ts      # Progress monitoring
│   │   └── resume-handler.ts        # Resume capability
│   ├── config/
│   │   ├── config-loader.ts         # Configuration management
│   │   ├── config-validator.ts      # Config validation
│   │   └── default-config.ts        # Default configurations
│   ├── cli/
│   │   ├── cli.ts                   # Main CLI entry point
│   │   ├── commands/                # Individual commands
│   │   │   ├── init.ts              # Init command
│   │   │   ├── scrape.ts            # Scrape command
│   │   │   └── status.ts            # Status command
│   │   ├── parsers/                 # Argument parsing
│   │   └── validators/              # CLI validation
│   ├── utils/
│   │   ├── logger.ts                # Winston logging setup
│   │   ├── errors.ts                # Custom error classes
│   │   ├── helpers.ts               # Utility functions
│   │   └── constants.ts             # App constants
│   ├── platform-factory.ts         # Platform registration system
│   └── index.ts                     # Main export
├── tests/
│   ├── unit/
│   │   ├── platforms/
│   │   ├── database/
│   │   ├── export/
│   │   └── utils/
│   ├── integration/
│   │   ├── reddit-api.test.ts
│   │   ├── hn-api.test.ts
│   │   └── end-to-end.test.ts
│   ├── fixtures/
│   │   ├── mock-reddit-response.json
│   │   ├── mock-hn-response.json
│   │   └── test-config.json
│   └── helpers/
│       ├── test-setup.ts
│       └── mock-api-server.ts
├── config/
│   ├── default.json                 # Default configuration
│   └── development.json             # Development overrides
├── docs/
│   ├── API.md                       # API documentation
│   ├── CONFIGURATION.md             # Configuration guide
│   └── EXTENDING.md                 # Platform extension guide
├── data/                            # Created by init
├── exports/                         # Created by init
├── logs/                            # Created by init
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
└── README.md
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation & Reddit Support (Weeks 1-2)
**Goal**: Working Reddit scraper with core features

#### Week 1: Core Infrastructure
- [ ] Set up TypeScript project with dependencies
- [ ] Create platform abstraction layer (`PlatformScraper`)
- [ ] Implement advanced rate limiter with caching
- [ ] Design multi-platform database schema
- [ ] Create Reddit API client with JSON endpoints
- [ ] Implement Reddit → ForumPost mapping

#### Week 2: Reddit Integration
- [ ] Complete Reddit scraper implementation
- [ ] Add pagination support for Reddit API
- [ ] Implement data validation with Zod schemas  
- [ ] Create basic CLI interface with Reddit support
- [ ] Add session management and progress tracking
- [ ] Implement database operations (CRUD, upsert)

### Phase 2: CLI & Configuration (Weeks 3-4)  
**Goal**: Professional CLI with comprehensive configuration

#### Week 3: Advanced CLI
- [ ] Implement comprehensive CLI with all options
- [ ] Add `fscrape init` command with directory setup
- [ ] Create configuration management system
- [ ] Add config file discovery chain
- [ ] Implement environment variable support
- [ ] Add input validation and error handling

#### Week 4: Export & Analytics
- [ ] Implement CSV/JSON export functionality
- [ ] Create analytics queries (trending, statistics)
- [ ] Add export automation and scheduling
- [ ] Implement logging with Winston (multiple levels)
- [ ] Create progress reporting and status display
- [ ] Add resume capability for failed sessions

### Phase 3: Hacker News & Multi-Platform (Weeks 5-6)
**Goal**: Multi-platform support with HN integration

#### Week 5: Hacker News Support
- [ ] Implement HN Firebase API client
- [ ] Create HN → ForumPost mapper
- [ ] Add HN-specific CLI options and validation
- [ ] Implement two-phase HN scraping (IDs → details)
- [ ] Add platform detection and factory system
- [ ] Test cross-platform data consistency

#### Week 6: Platform Framework
- [ ] Finalize platform plugin system
- [ ] Create platform registration mechanism
- [ ] Add platform-specific rate limiting
- [ ] Implement platform-specific error handling
- [ ] Create platform extension documentation
- [ ] Add platform health checking

### Phase 4: Production Features (Weeks 7-8)
**Goal**: Production-ready with monitoring & testing

#### Week 7: Error Handling & Recovery
- [ ] Implement comprehensive error handling
- [ ] Add retry logic with exponential backoff
- [ ] Create graceful shutdown handling (SIGINT/SIGTERM)
- [ ] Implement data backup and recovery
- [ ] Add input sanitization and security measures
- [ ] Create error reporting and alerting

#### Week 8: Testing & Documentation
- [ ] Write comprehensive unit tests (Vitest)
- [ ] Create integration tests with mock APIs
- [ ] Add end-to-end testing scenarios
- [ ] Write API documentation
- [ ] Create configuration guide
- [ ] Add platform extension tutorial

### Phase 5: Performance & Monitoring (Weeks 9-10)
**Goal**: Optimized performance with observability

#### Week 9: Performance Optimization
- [ ] Implement connection pooling
- [ ] Add memory optimization for large datasets
- [ ] Create batch processing optimization
- [ ] Add caching strategy optimization  
- [ ] Implement parallel processing where safe
- [ ] Add performance benchmarking

#### Week 10: Monitoring & Observability
- [ ] Implement metrics collection and storage
- [ ] Add performance monitoring dashboard data
- [ ] Create health check endpoints
- [ ] Add alerting for critical failures
- [ ] Implement usage analytics
- [ ] Create monitoring documentation

---

## 🧪 Testing Strategy

### Unit Testing (Vitest)
```typescript
// Platform contract testing
describe('PlatformScraper Contract', () => {
  ['reddit', 'hackernews'].forEach(platform => {
    describe(`${platform} implementation`, () => {
      test('should implement all required methods');
      test('should respect rate limits');
      test('should handle API errors gracefully');
      test('should map data to ForumPost correctly');
      test('should handle pagination correctly');
    });
  });
});

// Database operations
describe('Database Operations', () => {
  test('should upsert posts without duplicates');
  test('should handle concurrent writes safely');
  test('should maintain data integrity');
  test('should perform analytics queries efficiently');
});
```

### Integration Testing
```typescript
// API integration with mocked responses
describe('Reddit API Integration', () => {
  test('should handle all sort types correctly');
  test('should paginate through multiple pages');
  test('should handle rate limiting gracefully');
  test('should recover from temporary failures');
});
```

### End-to-End Testing
```typescript
// Complete workflow testing
describe('Complete Scraping Workflow', () => {
  test('should scrape, store, and export data successfully');
  test('should resume interrupted sessions');
  test('should handle configuration changes');
  test('should export data in multiple formats');
});
```

---

## 📦 Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "better-sqlite3": "^8.7.0",     // Fast SQLite database
    "commander": "^11.1.0",          // CLI framework
    "zod": "^3.22.4",                // Schema validation
    "winston": "^3.11.0",            // Logging
    "chalk": "^5.3.0",               // Terminal styling
    "p-queue": "^7.4.1",             // Rate limiting queue
    "p-retry": "^5.1.2",             // Retry with backoff
    "node-fetch": "^3.3.2",          // HTTP client
    "lru-cache": "^10.0.1",          // Response caching
    "csv-writer": "^1.6.0",          // CSV export
    "dotenv": "^16.3.1",             // Environment config
    "ora": "^7.0.1",                 // Loading spinners
    "inquirer": "^9.2.12"            // Interactive prompts
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "vitest": "^0.34.6",
    "@vitest/ui": "^0.34.6",
    "tsx": "^3.14.0",
    "msw": "^1.3.2"                  // API mocking
  }
}
```

**Removed Dependencies**: `playwright` (~200MB), `@playwright/test` (eliminated browser overhead)

---

## 🔒 Security & Privacy

### Data Protection
- **No Authentication Required**: Uses public APIs only
- **Input Sanitization**: All user inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries only
- **Rate Limiting Compliance**: Respects platform terms of service
- **User Agent Identification**: Transparent bot identification

### Privacy Considerations  
- **No Personal Data Collection**: Only public forum data
- **Optional Proxy Support**: For privacy-conscious users
- **Local Data Storage**: All data stored locally, no cloud transmission
- **Configurable Data Retention**: Users control data lifecycle

---

## 🎁 Key Benefits of Merged Approach

### Performance Improvements
- **10x Faster**: API calls vs browser automation
- **90% Less Memory**: No browser processes or DOM parsing
- **Better Reliability**: APIs don't break like UIs
- **Predictable Performance**: No waiting for page loads

### Enterprise Features Preserved
- **Comprehensive Configuration**: File-based + environment variables
- **Session Management**: Resume interrupted scrapes
- **Advanced Export**: CSV/JSON with custom formatting
- **Professional Logging**: Multiple levels with rotation
- **Analytics Queries**: Built-in data analysis capabilities
- **Monitoring & Metrics**: Performance tracking and alerting

### Extensibility Benefits
- **Plugin Architecture**: Easy platform addition
- **Clean Abstractions**: Well-defined interfaces
- **Configuration Driven**: New platforms via config
- **Testable Design**: Comprehensive test coverage

---

## 🚪 Extension Points

### Adding New Platforms
```typescript
// Example: Stack Overflow implementation
class StackOverflowScraper extends PlatformScraper {
  buildApiUrl(config: ScraperConfig): string {
    return `https://api.stackexchange.com/2.3/questions?site=stackoverflow&sort=${config.sort}&tagged=${config.source}`;
  }
  
  parseResponse(response: any): ForumPost[] {
    return response.items.map(item => this.mapToForumPost(item));
  }
  
  getRateLimit(): { requestsPerMinute: number; burst: number } {
    return { requestsPerMinute: 300, burst: 10 };
  }
  
  mapToForumPost(item: any): ForumPost {
    return {
      platform: 'stackoverflow',
      platform_id: item.question_id.toString(),
      source: item.tags.join(','),
      title: item.title,
      author: item.owner.display_name,
      created_utc: item.creation_date,
      score: item.score,
      num_comments: item.answer_count,
      post_url: item.link,
      // ... rest of mapping
    };
  }
}

// Register and use immediately
platformRegistry.set('stackoverflow', StackOverflowScraper);
```

### Future Platform Candidates
- **Stack Overflow**: Technical Q&A
- **Product Hunt**: Product launches  
- **GitHub Issues**: Development discussions
- **Discord/Slack**: Community forums (with API access)
- **Twitter/X**: Social media discussions (with API access)

---

## ✅ Success Metrics

### Technical Metrics
- **Performance**: <500ms avg response time per API call
- **Reliability**: >99% successful scrape completion rate
- **Efficiency**: >1000 posts per minute throughput
- **Memory**: <100MB memory usage for typical workloads

### Feature Completeness
- **Multi-Platform**: Reddit + Hacker News fully supported
- **Configuration**: Complete config management system
- **Export**: Multiple format support with automation
- **CLI**: Professional-grade command interface
- **Testing**: >90% code coverage

### User Experience
- **Ease of Use**: Single command setup (`fscrape init`)
- **Documentation**: Complete user and developer guides
- **Error Handling**: Clear error messages and recovery guidance
- **Performance**: Real-time progress indicators

This comprehensive plan merges the best of both approaches: the performance and reliability of direct API access with the sophisticated enterprise features that make fscrape a professional-grade tool.