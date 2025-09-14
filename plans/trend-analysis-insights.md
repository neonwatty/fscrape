# Trend Analysis & Insights Feature Plan (Personal Use Edition)

## Overview
A comprehensive trend analysis and insights system for fscrape that transforms scraped data into actionable intelligence about online communities. Designed for efficient single-user operation with focus on performance, accuracy, and convenience.

## Core Features

## 1. Time-Series Analysis (`fscrape analyze trends`)

### Basic Commands
```bash
# Basic trend analysis
fscrape analyze trends --days 30
# → Shows posting frequency, engagement patterns, peak activity times

# Platform-specific trends
fscrape analyze trends --platform reddit --subreddit programming
# → Identifies rising topics, declining discussions, seasonal patterns

# Comparative trends
fscrape analyze trends --compare reddit hackernews --metric engagement
# → Side-by-side platform activity comparison

# Quick analysis with cached results
fscrape analyze trends --cached --days 7
# → Uses pre-computed metrics for instant results
```

### Sample Output
```
📈 Trend Analysis (Last 30 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Peak Activity: Tue-Thu 2-4pm EST
Growth Rate: +23% posts, +45% comments
Trending Up: "rust", "ai-tools", "typescript"
Trending Down: "web3", "nft"

Daily Average:
  Mon: ████████ 142 posts
  Tue: ████████████ 203 posts  
  Wed: ███████████ 189 posts
  Thu: ████████████ 198 posts
  Fri: ██████ 98 posts
  Sat: ████ 67 posts
  Sun: ████ 71 posts

Cache Status: Fresh (updated 2 min ago)
Query Time: 0.3s (from cache)
```

## 2. Content Pattern Recognition (`fscrape analyze patterns`)

### Commands
```bash
# Identify content patterns with progress indicator
fscrape analyze patterns --identify-topics --progress
# → Uses keyword clustering to find discussion themes

# Sentiment trends with caching
fscrape analyze patterns --sentiment --by-day --cache-ttl 3600
# → Tracks positive/negative sentiment over time

# Engagement patterns with custom thresholds
fscrape analyze patterns --engagement-factors --min-posts 10
# → What makes posts successful (title length, posting time, keywords)

# Save pattern configuration
fscrape analyze patterns --save-config my-patterns
# → Saves current analysis parameters for reuse
```

### Key Metrics
- **Topic Velocity**: How fast topics gain/lose traction
- **Engagement Predictors**: Factors correlating with high engagement
- **Content Lifecycle**: Average lifespan of discussions
- **Cross-pollination**: Topics appearing across platforms

## 3. Comprehensive Testing Suite

### Unit Testing Framework

#### Statistical Function Tests
```javascript
// test/unit/analytics/statistics.test.js
describe('Statistical Functions', () => {
  describe('Mean Calculation', () => {
    test('handles empty datasets', () => {
      expect(calculateMean([])).toBe(null);
    });
    
    test('handles single value', () => {
      expect(calculateMean([5])).toBe(5);
    });
    
    test('handles negative values', () => {
      expect(calculateMean([-10, -5, 0, 5, 10])).toBe(0);
    });
    
    test('handles large datasets efficiently', () => {
      const largeDataset = Array(1000000).fill(1);
      const start = performance.now();
      calculateMean(largeDataset);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should process 1M items < 100ms
    });
    
    test('maintains precision with floating points', () => {
      expect(calculateMean([0.1, 0.2, 0.3])).toBeCloseTo(0.2, 10);
    });
  });

  describe('Trend Detection', () => {
    test('identifies upward trend', () => {
      const data = [1, 2, 3, 4, 5, 6, 7];
      expect(detectTrend(data)).toEqual({
        direction: 'up',
        strength: 1.0,
        confidence: 0.99
      });
    });
    
    test('identifies seasonal patterns', () => {
      const seasonal = [10, 5, 10, 5, 10, 5, 10, 5];
      expect(detectSeasonality(seasonal)).toEqual({
        hasSeason: true,
        period: 2,
        amplitude: 5
      });
    });
    
    test('handles noisy data', () => {
      const noisy = [1, 3, 2, 4, 3, 5, 4, 6];
      const trend = detectTrend(noisy);
      expect(trend.direction).toBe('up');
      expect(trend.confidence).toBeGreaterThan(0.7);
    });
  });
});
```

#### Time-Series Processing Tests
```javascript
// test/unit/analytics/timeseries.test.js
describe('Time-Series Processing', () => {
  describe('Gap Detection', () => {
    test('identifies missing data points', () => {
      const data = [
        { timestamp: '2024-01-01T00:00:00Z', value: 10 },
        { timestamp: '2024-01-01T01:00:00Z', value: 20 },
        // Missing 2:00
        { timestamp: '2024-01-01T03:00:00Z', value: 30 }
      ];
      
      const gaps = findTimeGaps(data, 'hourly');
      expect(gaps).toEqual([{
        start: '2024-01-01T01:00:00Z',
        end: '2024-01-01T03:00:00Z',
        missing: 1
      }]);
    });
    
    test('handles timezone transitions', () => {
      const dstData = [
        { timestamp: '2024-03-10T01:00:00-05:00', value: 10 }, // Before DST
        { timestamp: '2024-03-10T03:00:00-04:00', value: 20 }  // After DST
      ];
      
      const normalized = normalizeTimezones(dstData);
      expect(normalized[1].timestamp).toBe('2024-03-10T02:00:00-05:00');
    });
    
    test('interpolates missing values correctly', () => {
      const sparse = [
        { timestamp: '2024-01-01', value: 10 },
        { timestamp: '2024-01-03', value: 30 }
      ];
      
      const filled = interpolateGaps(sparse, 'linear');
      expect(filled[1]).toEqual({
        timestamp: '2024-01-02',
        value: 20,
        interpolated: true
      });
    });
  });

  describe('Aggregation Accuracy', () => {
    test('daily aggregation handles edge cases', () => {
      const hourlyData = generateHourlyData(24 * 7); // 1 week
      const daily = aggregateToDaily(hourlyData);
      
      expect(daily).toHaveLength(7);
      expect(daily[0].count).toBe(24);
      expect(daily[6].count).toBe(24);
    });
    
    test('preserves sum totals during aggregation', () => {
      const detailed = Array(100).fill({ value: 1 });
      const aggregated = aggregate(detailed, 'sum');
      expect(aggregated.total).toBe(100);
    });
  });
});
```

### Integration Testing

#### Full Pipeline Tests
```javascript
// test/integration/pipeline.test.js
describe('Analytics Pipeline Integration', () => {
  let testDb;
  
  beforeEach(async () => {
    testDb = await createTestDatabase();
    await seedTestData(testDb, {
      posts: 10000,
      dateRange: 90,
      patterns: 'realistic'
    });
  });

  test('end-to-end trend analysis', async () => {
    // Scrape → Store → Analyze → Cache → Export
    const scrapeResult = await fscrape.scrape({
      platform: 'reddit',
      subreddit: 'test',
      limit: 100
    });
    
    expect(scrapeResult.posts).toHaveLength(100);
    
    const analysisResult = await fscrape.analyze.trends({
      days: 7,
      useCache: false
    });
    
    expect(analysisResult).toMatchObject({
      trends: expect.any(Array),
      statistics: expect.any(Object),
      insights: expect.any(Array)
    });
    
    // Verify cache was populated
    const cachedResult = await fscrape.analyze.trends({
      days: 7,
      useCache: true
    });
    
    expect(cachedResult.queryTime).toBeLessThan(10); // Cache hit should be <10ms
    expect(cachedResult).toEqual(analysisResult);
    
    // Export and verify
    const exported = await fscrape.export({
      format: 'json',
      compress: true
    });
    
    const decompressed = await decompress(exported);
    expect(decompressed.posts).toHaveLength(100);
  });

  test('handles concurrent operations', async () => {
    const operations = [
      fscrape.analyze.trends({ days: 30 }),
      fscrape.analyze.patterns({ identify: true }),
      fscrape.analyze.anomalies({ threshold: 3 }),
      fscrape.export({ format: 'csv' })
    ];
    
    const results = await Promise.all(operations);
    
    results.forEach(result => {
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  test('recovery from partial failures', async () => {
    // Simulate network failure during scraping
    const scrapeWithFailure = fscrape.scrape({
      platform: 'reddit',
      failAfter: 50 // Fail after 50 posts
    });
    
    await expect(scrapeWithFailure).rejects.toThrow();
    
    // Verify partial data was saved
    const saved = await fscrape.db.query('SELECT COUNT(*) FROM posts');
    expect(saved.count).toBe(50);
    
    // Resume from checkpoint
    const resumed = await fscrape.scrape({
      platform: 'reddit',
      resume: true
    });
    
    expect(resumed.posts).toHaveLength(50); // Got remaining 50
  });
});
```

### Load & Performance Testing

#### Scalability Tests
```javascript
// test/performance/load.test.js
describe('Load Testing', () => {
  describe('Query Performance', () => {
    const datasets = [
      { size: 1000, maxTime: 50 },
      { size: 10000, maxTime: 200 },
      { size: 100000, maxTime: 1000 },
      { size: 1000000, maxTime: 5000 }
    ];
    
    datasets.forEach(({ size, maxTime }) => {
      test(`handles ${size} posts within ${maxTime}ms`, async () => {
        await seedDatabase(size);
        
        const queries = [
          'SELECT COUNT(*) FROM posts',
          'SELECT AVG(score) FROM posts WHERE created_at > ?',
          'SELECT platform, COUNT(*) FROM posts GROUP BY platform',
          'SELECT * FROM posts ORDER BY score DESC LIMIT 100'
        ];
        
        for (const query of queries) {
          const start = performance.now();
          await db.run(query);
          const duration = performance.now() - start;
          
          expect(duration).toBeLessThan(maxTime);
        }
      });
    });
  });

  describe('Concurrent User Simulation', () => {
    test('handles multiple concurrent analyses', async () => {
      const concurrentUsers = 10;
      const operationsPerUser = 5;
      
      const users = Array(concurrentUsers).fill(null).map((_, userId) => 
        simulateUser(userId, operationsPerUser)
      );
      
      const results = await Promise.all(users);
      
      // All users should complete successfully
      results.forEach(userResults => {
        expect(userResults.completed).toBe(operationsPerUser);
        expect(userResults.errors).toBe(0);
        expect(userResults.avgResponseTime).toBeLessThan(2000);
      });
    });
  });

  describe('Memory Usage', () => {
    test('memory stays within bounds during large analysis', async () => {
      const memorySnapshots = [];
      
      const largeAnalysis = async () => {
        for (let i = 0; i < 100; i++) {
          await fscrape.analyze.trends({ days: 365 });
          memorySnapshots.push(process.memoryUsage().heapUsed);
          
          if (i % 10 === 0) {
            global.gc(); // Force garbage collection
          }
        }
      };
      
      await largeAnalysis();
      
      const maxMemory = Math.max(...memorySnapshots);
      const avgMemory = memorySnapshots.reduce((a, b) => a + b) / memorySnapshots.length;
      
      expect(maxMemory).toBeLessThan(500 * 1024 * 1024); // < 500MB
      expect(avgMemory).toBeLessThan(300 * 1024 * 1024); // < 300MB avg
    });
  });
});
```

### Cache Testing

#### Cache Coherency & Invalidation
```javascript
// test/integration/cache.test.js
describe('Cache System', () => {
  describe('Multi-level Cache Coherency', () => {
    test('all cache levels stay synchronized', async () => {
      const query = { type: 'trends', days: 7 };
      
      // Initial computation
      const result1 = await analyze(query);
      
      // Should hit memory cache
      const result2 = await analyze(query);
      expect(result2.cacheLevel).toBe('memory');
      expect(result2).toEqual(result1);
      
      // Clear memory cache, should hit disk
      cache.clearMemory();
      const result3 = await analyze(query);
      expect(result3.cacheLevel).toBe('disk');
      expect(result3).toEqual(result1);
      
      // Clear disk cache, should hit database cache
      cache.clearDisk();
      const result4 = await analyze(query);
      expect(result4.cacheLevel).toBe('database');
      expect(result4).toEqual(result1);
    });
    
    test('invalidation cascades through all levels', async () => {
      const query = { type: 'trends', days: 7 };
      
      // Populate all cache levels
      await analyze(query);
      
      // Add new data that should invalidate cache
      await addPost({ platform: 'reddit', score: 1000 });
      
      // All cache levels should be invalidated
      const result = await analyze(query);
      expect(result.cacheLevel).toBe('computed');
      expect(result.trends).toContainEqual(
        expect.objectContaining({ score: 1000 })
      );
    });
    
    test('TTL expiration works correctly', async () => {
      const query = { type: 'trends', days: 7, ttl: 100 }; // 100ms TTL
      
      const result1 = await analyze(query);
      expect(result1.cacheLevel).toBe('computed');
      
      // Immediate query should hit cache
      const result2 = await analyze(query);
      expect(result2.cacheLevel).toBe('memory');
      
      // Wait for TTL expiration
      await sleep(150);
      
      const result3 = await analyze(query);
      expect(result3.cacheLevel).toBe('computed');
    });
  });

  describe('Cache Performance', () => {
    test('maintains target hit ratio', async () => {
      const queries = generateRandomQueries(1000);
      const hits = { memory: 0, disk: 0, database: 0, miss: 0 };
      
      for (const query of queries) {
        const result = await analyze(query);
        hits[result.cacheLevel || 'miss']++;
      }
      
      const hitRatio = (hits.memory + hits.disk + hits.database) / 1000;
      expect(hitRatio).toBeGreaterThan(0.8); // >80% cache hit ratio
    });
  });
});
```

### Edge Case Testing

#### Boundary Conditions
```javascript
// test/unit/edge-cases.test.js
describe('Edge Cases', () => {
  describe('Empty Dataset Handling', () => {
    test('handles analysis on empty database', async () => {
      const result = await fscrape.analyze.trends({ days: 30 });
      
      expect(result).toEqual({
        trends: [],
        statistics: {
          count: 0,
          mean: null,
          median: null,
          stdDev: null
        },
        insights: ['No data available for analysis']
      });
    });
    
    test('handles single data point', async () => {
      await addPost({ score: 42 });
      
      const result = await fscrape.analyze.trends({ days: 30 });
      
      expect(result.statistics).toEqual({
        count: 1,
        mean: 42,
        median: 42,
        stdDev: 0
      });
    });
  });

  describe('Extreme Values', () => {
    test('handles very large scores', async () => {
      await addPost({ score: Number.MAX_SAFE_INTEGER });
      
      const result = await fscrape.analyze.trends({ days: 30 });
      expect(result.statistics.max).toBe(Number.MAX_SAFE_INTEGER);
    });
    
    test('handles negative scores', async () => {
      await addPost({ score: -1000 });
      
      const result = await fscrape.analyze.trends({ days: 30 });
      expect(result.statistics.min).toBe(-1000);
    });
    
    test('handles Unicode in content', async () => {
      const unicodeTitle = '🚀 Test 测试 テスト тест';
      await addPost({ title: unicodeTitle });
      
      const result = await fscrape.analyze.patterns();
      expect(result.topWords).toContain('Test');
    });
  });

  describe('Date/Time Edge Cases', () => {
    test('handles leap year boundaries', async () => {
      const leapDay = '2024-02-29';
      await addPost({ created_at: leapDay });
      
      const result = await fscrape.analyze.trends({
        startDate: '2024-02-28',
        endDate: '2024-03-01'
      });
      
      expect(result.posts).toHaveLength(1);
    });
    
    test('handles DST transitions', async () => {
      // Spring forward - 2AM becomes 3AM
      const beforeDST = '2024-03-10T01:59:00-05:00';
      const afterDST = '2024-03-10T03:01:00-04:00';
      
      await addPost({ created_at: beforeDST });
      await addPost({ created_at: afterDST });
      
      const result = await fscrape.analyze.trends({ 
        date: '2024-03-10',
        timezone: 'America/New_York'
      });
      
      expect(result.posts).toHaveLength(2);
      expect(result.hourlyGap).toBe(true); // Should detect the gap
    });
    
    test('handles year boundaries', async () => {
      await addPost({ created_at: '2023-12-31T23:59:59Z' });
      await addPost({ created_at: '2024-01-01T00:00:01Z' });
      
      const result = await fscrape.analyze.trends({
        startDate: '2023-12-31',
        endDate: '2024-01-01'
      });
      
      expect(result.posts).toHaveLength(2);
      expect(result.yearTransition).toBe(true);
    });
  });
});
```

### Regression Testing

#### Baseline Comparison Tests
```javascript
// test/regression/baseline.test.js
describe('Regression Tests', () => {
  const baseline = loadBaseline('v1.0.0');
  
  describe('Statistical Accuracy', () => {
    test('trend detection remains consistent', async () => {
      const testData = baseline.datasets.trending;
      const currentResult = await detectTrend(testData);
      
      expect(currentResult).toMatchObject({
        direction: baseline.expected.trending.direction,
        strength: expect.closeTo(baseline.expected.trending.strength, 2),
        confidence: expect.closeTo(baseline.expected.trending.confidence, 2)
      });
    });
    
    test('anomaly detection maintains accuracy', async () => {
      const testData = baseline.datasets.anomalies;
      const detected = await detectAnomalies(testData);
      
      // Should detect same anomalies as baseline
      expect(detected.map(a => a.index).sort()).toEqual(
        baseline.expected.anomalies.indices.sort()
      );
    });
  });

  describe('Performance Regression', () => {
    test('query performance does not degrade', async () => {
      const queries = baseline.performanceQueries;
      
      for (const query of queries) {
        const start = performance.now();
        await runQuery(query.sql);
        const duration = performance.now() - start;
        
        // Allow 10% performance degradation
        expect(duration).toBeLessThan(query.baselineTime * 1.1);
      }
    });
  });

  describe('Output Format Stability', () => {
    test('API responses maintain structure', async () => {
      const response = await fscrape.analyze.trends({ days: 30 });
      
      // Verify response structure matches baseline
      expect(response).toMatchObject({
        trends: expect.any(Array),
        statistics: {
          count: expect.any(Number),
          mean: expect.any(Number),
          median: expect.any(Number),
          stdDev: expect.any(Number)
        },
        insights: expect.any(Array),
        metadata: {
          queryTime: expect.any(Number),
          cacheHit: expect.any(Boolean),
          version: expect.any(String)
        }
      });
    });
  });
});
```

### Test Data Generation

#### Synthetic Data Generator
```javascript
// test/utils/data-generator.js
class TestDataGenerator {
  generateRealisticPosts(count, options = {}) {
    const {
      startDate = '2024-01-01',
      endDate = '2024-12-31',
      platforms = ['reddit', 'hackernews'],
      seasonality = true,
      trends = true,
      anomalies = 0.01 // 1% anomalies
    } = options;
    
    const posts = [];
    
    for (let i = 0; i < count; i++) {
      const timestamp = this.randomDate(startDate, endDate);
      const platform = this.randomChoice(platforms);
      
      let score = this.generateScore(timestamp, {
        seasonality,
        trends,
        platform
      });
      
      // Add anomalies
      if (Math.random() < anomalies) {
        score *= this.randomBetween(5, 10); // Spike
      }
      
      posts.push({
        id: `test-${i}`,
        platform,
        title: this.generateTitle(),
        author: `user-${this.randomBetween(1, 100)}`,
        score: Math.round(score),
        comments: Math.round(score * this.randomBetween(0.5, 2)),
        created_at: timestamp,
        url: `https://example.com/post/${i}`
      });
    }
    
    return posts;
  }
  
  generateScore(timestamp, options) {
    let score = this.randomBetween(10, 100); // Base score
    
    if (options.seasonality) {
      // Weekly pattern - higher on weekdays
      const dayOfWeek = new Date(timestamp).getDay();
      const weekdayMultiplier = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1.5 : 0.7;
      score *= weekdayMultiplier;
      
      // Hourly pattern - peak at 2-4pm
      const hour = new Date(timestamp).getHours();
      const hourMultiplier = 1 + Math.sin((hour - 14) * Math.PI / 12) * 0.5;
      score *= hourMultiplier;
    }
    
    if (options.trends) {
      // Overall upward trend
      const daysSinceStart = this.daysSince('2024-01-01', timestamp);
      score *= 1 + (daysSinceStart / 365) * 0.5; // 50% growth over year
    }
    
    // Platform differences
    if (options.platform === 'reddit') {
      score *= 2; // Reddit typically has higher scores
    }
    
    return score;
  }
  
  generatePatternedData(pattern) {
    const patterns = {
      'steady-growth': (i) => i * 2,
      'exponential': (i) => Math.pow(1.1, i),
      'seasonal': (i) => 50 + 30 * Math.sin(i * Math.PI / 6),
      'volatile': (i) => 50 + Math.random() * 100,
      'plateau': (i) => i < 50 ? i : 50
    };
    
    return Array(100).fill(null).map((_, i) => ({
      timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
      value: patterns[pattern](i)
    }));
  }
}
```

### Test Configuration

#### Test Environment Setup
```javascript
// test/setup.js
module.exports = {
  testEnvironment: {
    // Use in-memory SQLite for speed
    database: ':memory:',
    
    // Disable caching for deterministic tests
    cache: {
      enabled: false
    },
    
    // Set fixed random seed for reproducibility
    randomSeed: 42,
    
    // Fast timeouts for testing
    timeouts: {
      query: 1000,
      analysis: 5000
    },
    
    // Parallel test execution
    maxWorkers: 4,
    
    // Coverage thresholds
    coverage: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  },
  
  // Test categories
  testSuites: {
    unit: 'test/unit/**/*.test.js',
    integration: 'test/integration/**/*.test.js',
    performance: 'test/performance/**/*.test.js',
    regression: 'test/regression/**/*.test.js',
    e2e: 'test/e2e/**/*.test.js'
  },
  
  // Custom matchers
  setupFilesAfterEnv: ['./test/matchers.js']
};
```

### Test Execution Strategy

```bash
# Quick tests during development
npm run test:unit          # ~5 seconds

# Pre-commit tests
npm run test:pre-commit    # Unit + critical integration (~30 seconds)

# Full test suite
npm run test:all          # Everything (~5 minutes)

# Continuous monitoring
npm run test:watch        # Auto-run on file changes

# Performance benchmarking
npm run test:perf -- --compare baseline.json

# Generate test coverage report
npm run test:coverage -- --reporter=html
```

### Test Coverage Requirements
- **Statistical Functions**: 100% coverage for mean, median, std dev, regression
- **Time-Series Operations**: Test for gaps, overlaps, timezone handling
- **Cache Invalidation**: Verify stale data is refreshed correctly
- **Edge Cases**: Empty datasets, single data points, extreme values
- **Performance Targets**: 
  - Simple queries < 100ms
  - Complex analysis < 2s
  - Cache hit ratio > 80%
- **Memory Management**: Max 500MB heap usage during large analyses
- **Concurrent Operations**: Handle 10+ simultaneous analyses
- **Data Integrity**: Zero data loss on crashes, consistent results

## 4. Database Performance & Indexing

### Schema Optimizations
```sql
-- Time-series optimized tables
CREATE TABLE analytics_cache (
  id INTEGER PRIMARY KEY,
  query_hash TEXT UNIQUE,
  result_data JSON,
  computed_at DATETIME,
  expires_at DATETIME,
  access_count INTEGER DEFAULT 0
);

-- Indexes for fast queries
CREATE INDEX idx_posts_created_date ON posts(created_at, platform);
CREATE INDEX idx_posts_author_date ON posts(author_id, created_at);
CREATE INDEX idx_posts_platform_score ON posts(platform, score DESC);
CREATE INDEX idx_comments_post_date ON comments(post_id, created_at);

-- Materialized views for common aggregations
CREATE VIEW daily_stats AS
SELECT 
  DATE(created_at) as date,
  platform,
  COUNT(*) as post_count,
  AVG(score) as avg_score,
  COUNT(DISTINCT author_id) as unique_authors
FROM posts
GROUP BY DATE(created_at), platform;
```

### Query Optimization
```javascript
// Batch queries for efficiency
const batchAnalytics = {
  // Use prepared statements
  preparedQueries: new Map(),
  
  // Connection pooling for parallel queries
  maxConnections: 5,
  
  // Query result caching
  queryCache: new LRU({ max: 1000, ttl: 3600 }),
  
  // Explain plan analysis
  analyzeQuery: async (sql) => {
    const plan = await db.run(`EXPLAIN QUERY PLAN ${sql}`);
    if (plan.includes('SCAN TABLE')) {
      console.warn('Table scan detected, consider adding index');
    }
  }
};
```

### Data Pruning & Archival
```bash
# Archive old data
fscrape db archive --older-than 365d --to archive.db
# → Moves old data to archive database

# Vacuum database
fscrape db optimize
# → Runs VACUUM, ANALYZE, and rebuilds indexes

# Incremental processing
fscrape analyze trends --incremental
# → Only processes new data since last run
```

## 5. Error Handling & Recovery

### Robust Error Management
```javascript
class AnalyticsErrorHandler {
  // Retry logic for transient failures
  async retryWithBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await sleep(Math.pow(2, i) * 1000);
      }
    }
  }
  
  // Graceful degradation
  async analyzeWithFallback(query) {
    try {
      return await this.fullAnalysis(query);
    } catch (error) {
      console.warn('Full analysis failed, using simplified version');
      return await this.simplifiedAnalysis(query);
    }
  }
  
  // Data validation
  validateData(dataset) {
    if (!dataset || dataset.length === 0) {
      throw new Error('Empty dataset');
    }
    
    // Check for data consistency
    const errors = [];
    dataset.forEach(item => {
      if (!item.created_at) errors.push('Missing timestamp');
      if (item.score < 0) errors.push('Invalid score');
    });
    
    if (errors.length > 0) {
      console.warn(`Data quality issues: ${errors.join(', ')}`);
    }
  }
}
```

### Recovery Mechanisms
```bash
# Resume interrupted analysis
fscrape analyze resume --session-id abc123
# → Continues from last checkpoint

# Repair corrupted cache
fscrape cache repair
# → Validates and fixes cache inconsistencies

# Fallback to raw data
fscrape analyze trends --skip-cache --skip-optimization
# → Direct database queries without optimizations
```

## 6. Configuration & Preferences

### User Configuration File
```yaml
# ~/.fscrape/analytics.config.yml
analytics:
  # Default parameters
  defaults:
    timeRange: 30d
    platforms: [reddit, hackernews]
    minEngagement: 10
    
  # Custom thresholds
  thresholds:
    trendingMinGrowth: 1.5  # 50% growth
    viralCommentCount: 50
    anomalyStdDev: 3
    
  # Saved queries
  savedQueries:
    weekly_report:
      command: "analyze trends"
      args: "--days 7 --visual heatmap"
    
    tech_trends:
      command: "analyze patterns"
      args: "--platform hackernews --identify-topics"
      
  # Performance settings
  performance:
    cacheSize: 1000  # MB
    maxQueryTime: 5000  # ms
    parallelQueries: 5
    
  # Export preferences
  export:
    defaultFormat: json
    includeMetadata: true
    compression: gzip
```

### Command Aliases
```bash
# Define shortcuts in config
aliases:
  trends7: "analyze trends --days 7 --cached"
  mypatterns: "analyze patterns --config my-patterns"
  quickcheck: "analyze anomalies --last 24h --simplified"

# Use aliases
fscrape trends7
# → Expands to: fscrape analyze trends --days 7 --cached
```

## 7. Caching Strategy

### Multi-Level Cache
```javascript
class AnalyticsCache {
  constructor() {
    // In-memory cache for hot data
    this.memoryCache = new LRU({
      max: 100,  // items
      ttl: 300   // 5 minutes
    });
    
    // Disk cache for larger datasets
    this.diskCache = new DiskCache({
      path: '~/.fscrape/cache',
      maxSize: '1GB',
      ttl: 3600  // 1 hour
    });
    
    // Query result cache in database
    this.dbCache = new DatabaseCache({
      table: 'analytics_cache',
      ttl: 86400  // 24 hours
    });
  }
  
  // Smart invalidation
  invalidate(pattern) {
    // Invalidate related queries
    if (pattern.includes('posts')) {
      this.memoryCache.delete(/post.*/);
      this.diskCache.delete(/trend.*/);
    }
  }
  
  // Pre-computation of expensive metrics
  async precompute() {
    const queries = [
      'daily_averages',
      'weekly_trends',
      'top_authors',
      'platform_comparison'
    ];
    
    for (const query of queries) {
      await this.computeAndCache(query);
    }
  }
}
```

### Cache Management Commands
```bash
# View cache status
fscrape cache status
# → Shows cache size, hit ratio, age

# Clear specific cache
fscrape cache clear --type memory
fscrape cache clear --query "trends*"

# Precompute common queries
fscrape cache warmup
# → Pre-calculates frequent analyses

# Export cache for backup
fscrape cache export --to cache-backup.tar.gz
```

## 8. CLI Experience Enhancements

### Interactive Mode
```bash
# Enter interactive analysis mode
fscrape analyze --interactive

fscrape> trends --days 7
[Shows results]
fscrape> drill-down tuesday
[Shows Tuesday details]
fscrape> save-view my-tuesday-analysis
View saved as 'my-tuesday-analysis'
fscrape> exit
```

### Progress Indicators
```javascript
class ProgressReporter {
  showProgress(task, current, total) {
    const percent = Math.round((current / total) * 100);
    const bar = '█'.repeat(percent / 2) + '░'.repeat(50 - percent / 2);
    
    process.stdout.write(`\r${task}: [${bar}] ${percent}% (${current}/${total})`);
  }
  
  // Spinner for indeterminate progress
  showSpinner(message) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    return setInterval(() => {
      process.stdout.write(`\r${frames[i++ % frames.length]} ${message}`);
    }, 80);
  }
}
```

### Command History & Autocomplete
```bash
# History stored in ~/.fscrape/history
fscrape history
# → Shows recent commands

# Autocomplete setup
fscrape completion install
# → Installs shell completions

# Smart suggestions
fscrape analyze tr[TAB]
# → Suggests: trends, trending
```

## 9. Data Management

### Backup & Restore
```bash
# Full backup
fscrape backup create --name "before-experiment"
# → Creates timestamped backup

# Incremental backup
fscrape backup create --incremental --since "2024-01-01"
# → Only backs up new data

# Restore from backup
fscrape backup restore --name "before-experiment"
# → Restores database state

# Merge databases
fscrape db merge laptop.db desktop.db --output combined.db
# → Combines data from multiple sources
```

### Database Maintenance
```javascript
class DatabaseMaintenance {
  async runMaintenance() {
    // Check integrity
    await this.checkIntegrity();
    
    // Remove duplicates
    await this.removeDuplicates();
    
    // Update statistics
    await db.run('ANALYZE');
    
    // Rebuild indexes if fragmented
    const fragmentation = await this.checkFragmentation();
    if (fragmentation > 30) {
      await this.rebuildIndexes();
    }
    
    // Archive old data
    await this.archiveOldData(365);
    
    // Vacuum
    await db.run('VACUUM');
  }
}
```

## 10. Automation & Scheduling

### Watch Mode
```bash
# Live monitoring
fscrape analyze watch --interval 5m
# → Updates analysis every 5 minutes

# Watch with alerts
fscrape analyze watch --alert-on "trending:rust>2x"
# → Notifies when rust trending doubles

# Background analysis
fscrape analyze daemon start
# → Runs analysis in background
fscrape analyze daemon status
# → Check daemon status
fscrape analyze daemon stop
```

### Scheduled Analysis
```javascript
// Schedule configuration
const schedules = {
  daily_report: {
    cron: '0 9 * * *',  // 9 AM daily
    command: 'analyze trends --days 1 --export daily-report.json'
  },
  
  weekly_insights: {
    cron: '0 10 * * MON',  // Monday 10 AM
    command: 'analyze insights --auto --export weekly-insights.html'
  },
  
  cache_warmup: {
    cron: '0 */6 * * *',  // Every 6 hours
    command: 'cache warmup'
  }
};
```

### Scriptable Output
```bash
# Machine-readable output
fscrape analyze trends --output json --quiet
# → JSON only, no decorations

# CSV for spreadsheets
fscrape analyze export --format csv --columns "date,posts,engagement"

# Pipe to other tools
fscrape analyze trends --format tsv | awk '{print $2}' | gnuplot
```

## 11. Debugging & Development

### Debug Mode
```bash
# Verbose logging
fscrape analyze trends --debug
# → Shows SQL queries, cache hits, timing

# Dry run
fscrape analyze trends --dry-run
# → Shows what would be done without executing

# Explain mode
fscrape analyze trends --explain
# → Shows query plan and optimization decisions

# Profile performance
fscrape analyze trends --profile
# → Outputs performance metrics
```

### Development Tools
```javascript
class DebugTools {
  // Query logger
  logQuery(sql, params, duration) {
    if (this.debugMode) {
      console.log(`
        SQL: ${sql}
        Params: ${JSON.stringify(params)}
        Duration: ${duration}ms
        Cache: ${this.cacheHit ? 'HIT' : 'MISS'}
      `);
    }
  }
  
  // Performance profiler
  profile(operation) {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;
    
    this.metrics.record({
      operation: operation.name,
      duration,
      memory: process.memoryUsage().heapUsed
    });
    
    return result;
  }
  
  // Data inspector
  inspect(dataset) {
    console.log({
      count: dataset.length,
      sample: dataset.slice(0, 5),
      schema: Object.keys(dataset[0] || {}),
      stats: this.calculateStats(dataset)
    });
  }
}
```

## 12. Visual Analytics Output

### Terminal Visualizations
```bash
# Terminal-based visualizations
fscrape analyze trends --visual sparkline
# → ASCII sparkline charts in terminal

fscrape analyze trends --visual heatmap
# → Activity heatmap (time vs day grid)

fscrape analyze trends --visual histogram
# → Distribution charts

fscrape analyze trends --export-charts html
# → Generate HTML with interactive charts
```

### Enhanced Visualizations
```
📊 Engagement Trend (7 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Posts:    ▁▃▅█▆▄▂  (+12%)
Comments: ▂▄▆█▇▅▃  (+23%)
Authors:  ▃▃▄▅▄▃▂  (-2%)

Peak Hours (PST):
  0  4  8  12  16  20  24
  ░░░░▓▓██████▓▓▓▓░░░░

Top Growing Topics:
1. rust      ████████████ +156%
2. ai-tools  ████████ +89%
3. golang    █████ +45%
```

## 13. Smart Insights Generation

### Auto-Generated Insights
```bash
fscrape analyze insights --auto
```

### Enhanced Insight Output
```
🔍 Key Insights (Auto-generated)

1. 📈 Posting Surge: 156% increase in "rust" discussions
   - Triggered by: New framework announcement
   - Sentiment: 78% positive
   - Your opportunity: Post rust content Tue-Thu 2-4pm
   
2. 🔄 Pattern Shift: European activity up 34%
   - Peak moved: 3pm → 11am EST
   - Recommendation: Adjust posting schedule
   
3. ⚡ Viral Threshold Identified
   - 5+ comments in first hour = 89% chance of top 10
   - Title length: 12-15 words optimal
   - Include code: +67% engagement
   
4. 🎯 Personal Best Times
   - Your posts perform best: Tuesday 2pm
   - Your comments get most upvotes: Wednesday 3pm
   
5. 🔮 Next Week Forecast
   - Expected high activity: Tuesday, Wednesday
   - Trending topics: "rust", "performance", "cli-tools"
   - Anomaly risk: Low
```

## 14. Export Capabilities

### Export Commands
```bash
# Export for analysis
fscrape analyze export --format json --compress
# → Compressed JSON with all metrics

# Excel-friendly export
fscrape analyze export --format xlsx --charts
# → Excel file with embedded charts

# SQL export
fscrape analyze export --format sql --table-prefix analytics_
# → SQL statements for import

# Notebook export
fscrape analyze export --format notebook --template analysis
# → Jupyter notebook with pre-loaded data
```

### Export Templates
```javascript
const exportTemplates = {
  daily_report: {
    sections: ['summary', 'trends', 'top_posts', 'insights'],
    format: 'html',
    styling: 'default'
  },
  
  data_science: {
    sections: ['raw_data', 'features', 'correlations'],
    format: 'parquet',
    compression: 'snappy'
  }
};
```

## Implementation Architecture

### Simplified Core Components
1. **Statistical Engine**: Fast time-series analysis with caching
2. **Pattern Matcher**: Efficient keyword extraction and clustering
3. **Cache Layer**: Multi-level caching for instant results
4. **Visualization Engine**: Terminal graphics with optional HTML export
5. **Configuration Manager**: User preferences and saved queries
6. **Error Handler**: Robust recovery and fallback mechanisms

### Data Processing Pipeline
```
Raw Data → Validation → Feature Extraction → Caching → Statistical Analysis → Visualization
                ↑                              ↑
                └── Incremental Updates ───────┘
```

### Technology Stack (Simplified)
- **Statistical Analysis**: Simple-statistics (lightweight, fast)
- **Caching**: LRU cache + SQLite for persistence
- **Visualization**: Blessed (terminal UI), Chart.js (HTML)
- **Configuration**: YAML/JSON with schema validation
- **Testing**: Vitest with generated test data
- **Progress**: ora/cli-progress for indicators

## Implementation Phases (Personal Use Optimized)

### Phase 1: Foundation (Week 1)
- Database indexes and query optimization
- Basic caching mechanism (memory + disk)
- Core statistical functions with tests
- Error handling and recovery
- Progress indicators

### Phase 2: Core Analytics (Week 2)
- Time-series analysis with trends
- Pattern detection algorithms
- Anomaly detection
- Basic predictions
- Terminal visualizations

### Phase 3: User Experience (Week 3)
- Configuration file support
- Command aliases and shortcuts
- Interactive mode
- Saved queries and templates
- Export capabilities

### Phase 4: Performance & Reliability (Week 4)
- Query optimization and benchmarking
- Cache precomputation
- Incremental processing
- Database maintenance commands
- Backup/restore functionality

### Phase 5: Automation & Polish (Week 5)
- Watch mode and scheduling
- Auto-generated insights
- Debug and profiling tools
- Advanced visualizations
- Documentation and examples

## Success Metrics (Personal Use)

- **Performance**:
  - Simple queries < 100ms
  - Complex analysis < 2s
  - Cache hit ratio > 80%
  - Memory usage < 500MB

- **Reliability**:
  - Zero data loss on crashes
  - Automatic recovery from errors
  - Consistent results across runs
  - Validated statistical accuracy

- **Usability**:
  - Common tasks < 3 commands
  - All features discoverable via --help
  - Meaningful error messages
  - Progress shown for operations > 1s

## Minimal Configuration Example

```yaml
# ~/.fscrape/analytics.yml (minimal)
defaults:
  days: 30
  cache: true
  
aliases:
  quick: "analyze trends --days 7 --cached"
  
performance:
  maxQueryTime: 5000
```

## Quick Start Commands

```bash
# First-time setup
fscrape analyze init
# → Creates indexes, warming cache

# Daily workflow
fscrape quick           # Your trending analysis
fscrape analyze watch   # Live monitoring
fscrape backup create   # Before experiments

# Maintenance (weekly)
fscrape db optimize
fscrape cache warmup
```

## Conclusion

This simplified trend analysis system focuses on personal productivity, removing multi-user complexity while adding critical features for reliability, performance, and convenience. The system prioritizes fast queries, accurate analysis, and seamless workflow integration for a single power user.