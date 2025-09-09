# Multi-Platform Forum Scraper CLI - Focused Implementation Plan

## 🔧 Proven Working API Commands

### Reddit JSON API (✅ Tested & Working)
```bash
# Hot posts (default)
curl -s -H "User-Agent: Mozilla/5.0" "https://www.reddit.com/r/{subreddit}/hot.json?limit=N"

# All sorting options
curl -s -H "User-Agent: Mozilla/5.0" "https://www.reddit.com/r/{subreddit}/{sort}.json?limit=N"
# where {sort} = hot | new | top | best | controversial | rising

# Time filters (for top/controversial)
curl -s -H "User-Agent: Mozilla/5.0" "https://www.reddit.com/r/{subreddit}/top.json?t={period}&limit=N"
# where {period} = hour | day | week | month | year | all

# Pagination
curl -s -H "User-Agent: Mozilla/5.0" "https://www.reddit.com/r/{subreddit}/hot.json?limit=N&after={token}"
```

### Hacker News API (✅ Tested & Working)
```bash
# Top stories (returns array of IDs)
curl -s "https://hacker-news.firebaseio.com/v0/topstories.json"

# Story categories
curl -s "https://hacker-news.firebaseio.com/v0/{category}stories.json"
# where {category} = top | new | best | ask | show | job

# Individual story details
curl -s "https://hacker-news.firebaseio.com/v0/item/{id}.json"
```

## ⚡ Rate Limiting Analysis & Solutions

### Current Rate Limit Status
- **Reddit**: Unofficial JSON endpoints (~60 req/min with proper User-Agent)
- **Hacker News**: No documented limits, Firebase-backed (very generous)

### Rate Limiting Strategy (Multi-Tier Defense)
```typescript
class RateLimiter {
  // 1. Request Queue with Delay
  private queue = new PQueue({ 
    concurrency: 1, 
    interval: 1000,  // 1 request per second default
    intervalCap: 1 
  });
  
  // 2. Exponential Backoff
  async requestWithBackoff(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.queue.add(() => fetch(url, { headers }));
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.delay(Math.pow(2, i) * 1000); // 1s, 2s, 4s
      }
    }
  }
  
  // 3. Response Caching (5min default)
  private cache = new Map<string, { data: any, expires: number }>();
  
  // 4. Adaptive Rate Limiting
  adjustRate(platform: string, statusCode: number) {
    if (statusCode === 429) this.intervals[platform] *= 2; // Slow down
    if (statusCode === 200) this.intervals[platform] *= 0.9; // Speed up gradually
  }
}
```

## 🏗️ Platform-Agnostic Architecture Design

### Core Abstraction Layer
```typescript
// Base interface that all platforms implement
abstract class PlatformScraper extends AbstractScraper {
  abstract buildApiUrl(config: ScraperConfig): string;
  abstract parseResponse(response: any): ForumPost[];
  abstract getNextPageToken(response: any): string | null;
  abstract getRateLimit(): { requestsPerMinute: number; burst: number };
  abstract mapToForumPost(item: any): ForumPost;
  
  // Common functionality for all platforms
  protected async fetchWithRetry(url: string): Promise<any> { /* ... */ }
  protected respectRateLimit(): Promise<void> { /* ... */ }
  protected cacheResponse(key: string, data: any): void { /* ... */ }
}
```

### Platform Plugin System
```typescript
// Easy platform registration
const platformRegistry = new Map<string, typeof PlatformScraper>();
platformRegistry.set('reddit', RedditScraper);
platformRegistry.set('hackernews', HackerNewsScraper);

// Future platforms just implement the interface:
class TwitterScraper extends PlatformScraper { /* ... */ }
class StackOverflowScraper extends PlatformScraper { /* ... */ }
```

## 📁 Implementation Structure

### Phase 1: Core Platform Framework
```
src/
├── platforms/
│   ├── base/
│   │   ├── platform-scraper.ts     # Abstract base class
│   │   ├── rate-limiter.ts         # Universal rate limiting
│   │   ├── cache.ts                # Response caching
│   │   └── types.ts                # Common platform types
│   ├── reddit/
│   │   ├── reddit-scraper.ts       # Reddit implementation
│   │   ├── reddit-api.ts           # Reddit API client
│   │   └── reddit-mapper.ts        # Reddit -> ForumPost mapping
│   └── hackernews/
│       ├── hn-scraper.ts           # Hacker News implementation
│       ├── hn-api.ts               # HN API client
│       └── hn-mapper.ts            # HN -> ForumPost mapping
```

### Phase 2: CLI Interface
```typescript
// Multi-platform CLI design
fscrape reddit programming --sort top --time week --limit 100 --pages 3
fscrape hackernews --category top --limit 50 --export csv

// Platform-specific options automatically available
fscrape reddit programming --sort controversial --time all
fscrape hackernews --category ask --min-score 10
```

## 🎛️ Configuration System

### Platform-Specific Configs
```typescript
interface PlatformConfig {
  reddit: {
    rateLimit: { rpm: 60, burst: 5 };
    userAgent: string;
    defaultSort: RedditSort;
    timeout: number;
  };
  hackernews: {
    rateLimit: { rpm: 300, burst: 20 };
    timeout: number;
    batchSize: number;  // HN needs individual item requests
  };
}
```

## 🧪 Testing Strategy

### Platform-Agnostic Testing
```typescript
// Base test suite that all platforms must pass
describe('PlatformScraper Contract', () => {
  const platforms = ['reddit', 'hackernews'];
  
  platforms.forEach(platform => {
    describe(`${platform} platform`, () => {
      test('should implement required methods');
      test('should respect rate limits');  
      test('should handle pagination');
      test('should map to ForumPost correctly');
      test('should handle API errors gracefully');
    });
  });
});
```

## 🚀 Implementation Priority

### Sprint 1: Reddit Foundation
1. Implement `RedditScraper` with all tested endpoints
2. Add rate limiting and caching
3. Create basic CLI interface
4. Add CSV/JSON export

### Sprint 2: Platform Framework & Hacker News
1. Extract common functionality to `PlatformScraper`
2. Refactor Reddit implementation to use base class
3. Add platform registration system
4. Implement `HackerNewsScraper` with two-step process (ID list → item details)
5. Add HN-specific CLI options
6. Cross-platform data normalization

## 🔍 Extension Points for Future Platforms

### Adding New Platforms (Example: Stack Overflow)
```typescript
class StackOverflowScraper extends PlatformScraper {
  buildApiUrl(config) {
    return `https://api.stackexchange.com/2.3/questions?site=stackoverflow&sort=${config.sort}`;
  }
  
  parseResponse(response) {
    return response.items.map(item => this.mapToForumPost(item));
  }
  
  getRateLimit() {
    return { requestsPerMinute: 300, burst: 10 }; // SO's documented limits
  }
  
  mapToForumPost(item): ForumPost {
    return {
      platform: 'stackoverflow',
      platformId: item.question_id.toString(),
      title: item.title,
      url: item.link,
      score: item.score,
      author: item.owner.display_name,
      // ... rest of mapping
    };
  }
}

// Register and use immediately
platformRegistry.set('stackoverflow', StackOverflowScraper);
// CLI: fscrape stackoverflow --tags typescript --sort votes
```

This focused plan delivers a solid foundation with Reddit and Hacker News support, plus an extensible architecture for adding new platforms easily.