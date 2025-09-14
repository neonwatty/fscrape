/**
 * Cached Analytics Integration
 *
 * Demonstrates integration of the cache layer with analytics modules
 * for improved performance and reduced database load.
 */

import { CacheLayer, CacheDependency } from "./cache-layer.js";
import type { DatabaseAnalytics } from "../database/analytics.js";
import type { Platform } from "../types/core.js";
import { StatisticsEngine } from "./statistics.js";
import { TrendAnalyzer } from "./trend-analyzer.js";
import { AnomalyDetector } from "./anomaly-detector.js";
import { ForecastingEngine } from "./forecasting.js";

/**
 * Cached Analytics Service
 *
 * Wraps analytics modules with intelligent caching
 */
export class CachedAnalyticsService {
  private cache: CacheLayer;
  private analytics: DatabaseAnalytics;
  private statsAnalyzer: StatisticsEngine;
  private trendAnalyzer: TrendAnalyzer;
  private anomalyDetector: AnomalyDetector;
  private forecastEngine: ForecastingEngine;
  private cacheEnabled: boolean = true;
  private options: any;
  private cacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    entries: 0,
  };
  private backgroundRefreshTimer?: NodeJS.Timeout;
  private accessedKeys = new Set<string>();

  constructor(analytics: DatabaseAnalytics, options: any = {}) {
    this.analytics = analytics;

    // Support both simple TTL and per-method TTL
    const defaultTTL = typeof options.ttl === 'number' ? options.ttl : (options.ttl?.default ?? 5 * 60 * 1000);

    this.cache = new CacheLayer({
      defaultTTL,
      maxSize: options.maxSize ?? 50 * 1024 * 1024,   // 50MB for analytics
      maxEntries: options.maxCacheSize ?? 1000,       // Support maxCacheSize option
      enableMetrics: true,
    });

    // Store options for method-specific TTLs
    this.options = options;

    // Initialize analyzers
    this.statsAnalyzer = new StatisticsEngine();
    this.trendAnalyzer = new TrendAnalyzer();
    this.anomalyDetector = new AnomalyDetector();
    this.forecastEngine = new ForecastingEngine();

    // Setup background refresh if enabled
    if (options.backgroundRefresh) {
      this.startBackgroundRefresh(options.refreshInterval || 60000);
    }
  }

  /**
   * Get platform statistics with caching
   */
  getPlatformStats(
    platform?: Platform,
    dateRange?: { start: Date; end: Date }
  ): any {
    const cacheKey = `getPlatformStats:${platform ?? 'all'}:${dateRange?.start?.toISOString() ?? 'none'}:${dateRange?.end?.toISOString() ?? 'none'}`;

    // Track accessed keys for background refresh
    this.accessedKeys.add(cacheKey);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      // If cached value is an error, throw it
      if (cached instanceof Error) {
        throw cached;
      }
      return cached;
    }
    this.cacheStats.misses++;

    // Call the underlying method
    try {
      const result = this.analytics.getPlatformStats(platform);

      // Handle both sync and async results
      if (result instanceof Promise) {
        const promise = result
          .then(data => {
            // Only cache successful results unless configured otherwise
            if (!this.options.cacheErrors) {
              this.cache.set(cacheKey, data, {
                ttl: this.getMethodTTL('getPlatformStats'),
                dependencies: [
                  CacheDependency.DATA,
                  platform ? `platform:${platform}` : CacheDependency.PLATFORM,
                ],
              });
              this.cacheStats.size++;
            }
            return data;
          })
          .catch(error => {
            // Only cache errors if explicitly configured
            if (this.options.cacheErrors) {
              this.cache.set(cacheKey, error, {
                ttl: this.options.errorTTL || this.getMethodTTL('getPlatformStats'),
                dependencies: [CacheDependency.DATA],
              });
            }
            throw error;
          });

        return promise;
      } else {
        // Sync result - cache and return
        this.cache.set(cacheKey, result, {
          ttl: this.getMethodTTL('getPlatformStats'),
          dependencies: [
            CacheDependency.DATA,
            platform ? `platform:${platform}` : CacheDependency.PLATFORM,
          ],
        });
        this.cacheStats.size++;
        return result;
      }
    } catch (error) {
      // Only cache errors if explicitly configured
      if (this.options.cacheErrors) {
        this.cache.set(cacheKey, error, {
          ttl: this.options.errorTTL || this.getMethodTTL('getPlatformStats'),
          dependencies: [CacheDependency.DATA],
        });
      }
      throw error;
    }
  }

  /**
   * Get engagement metrics with caching
   */
  async getEngagementMetrics(
    options: {
      platform?: Platform;
      days?: number;
      metric?: string;
    } = {}
  ): Promise<any> {
    const cacheKey = `engagement_metrics:${options.platform ?? 'all'}:${options.days ?? 30}:${options.metric ?? 'all'}`;

    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Compute engagement metrics
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days ?? 30));

    const metrics = await this.analytics.getEngagementStats({
      platform: options.platform,
      startDate,
      endDate,
    });

    // Process with statistical analyzer
    const processed = this.statsAnalyzer.analyzeTimeSeries(
      metrics.dailyRates.map((rate, i) => ({
        timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
        value: rate,
      }))
    );

    const result = {
      raw: metrics,
      statistics: processed,
      summary: {
        mean: processed.mean,
        trend: processed.trend,
        volatility: processed.standardDeviation / processed.mean,
      },
    };

    // Cache with appropriate TTL and dependencies
    this.cache.set(cacheKey, result, {
      ttl: 5 * 60 * 1000, // 5 minutes for engagement metrics
      dependencies: [
        CacheDependency.DATA,
        CacheDependency.TIME_RANGE,
        options.platform ? `platform:${options.platform}` : CacheDependency.PLATFORM,
      ],
    });

    return result;
  }

  /**
   * Get trending analysis with caching
   */
  async getTrendingAnalysis(
    options: {
      platform?: Platform;
      limit?: number;
      timeWindow?: number; // hours
    } = {}
  ): Promise<any> {
    const cacheKey = `trending_analysis:${JSON.stringify(options)}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get trending posts
    const trending = await this.analytics.getTrendingPosts(
      options.limit ?? 10,
      options.platform
    );

    // Analyze trends
    const analysis = trending.map(post => {
      const trendScore = this.calculateTrendScore(post);
      return {
        ...post,
        trendScore,
        momentum: this.calculateMomentum(post),
        predictedPeak: this.predictPeakEngagement(post),
      };
    });

    // Cache with shorter TTL for trending data
    this.cache.set(cacheKey, analysis, {
      ttl: 2 * 60 * 1000, // 2 minutes for trending data
      dependencies: [
        CacheDependency.DATA,
        options.platform ? `platform:${options.platform}` : CacheDependency.PLATFORM,
      ],
    });

    return analysis;
  }

  /**
   * Detect anomalies with caching
   */
  async detectAnomalies(
    options: {
      platform?: Platform;
      metric?: string;
      sensitivity?: number;
      days?: number;
    } = {}
  ): Promise<any> {
    const cacheKey = `anomaly_detection:${JSON.stringify(options)}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get time series data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days ?? 30));

    const data = await this.getTimeSeriesDataInternal({
      platform: options.platform,
      metric: options.metric ?? "engagement",
      startDate,
      endDate,
    });

    // Detect anomalies
    const anomalies = this.anomalyDetector.detectAnomalies(data, {
      sensitivity: options.sensitivity ?? 2,
      method: "isolation-forest",
    });

    // Cache results
    this.cache.set(cacheKey, anomalies, {
      ttl: 15 * 60 * 1000, // 15 minutes for anomaly detection
      dependencies: [
        CacheDependency.DATA,
        CacheDependency.TIME_RANGE,
        options.platform ? `platform:${options.platform}` : CacheDependency.PLATFORM,
      ],
    });

    return anomalies;
  }

  /**
   * Generate forecast with caching
   */
  async generateForecast(
    options: {
      platform?: Platform;
      metric?: string;
      horizon?: number;
      model?: string;
    } = {}
  ): Promise<any> {
    const cacheKey = `forecast:${JSON.stringify(options)}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // 60 days of history

    const data = await this.getTimeSeriesDataInternal({
      platform: options.platform,
      metric: options.metric ?? "engagement",
      startDate,
      endDate,
    });

    // Generate forecast
    const forecast = this.forecastEngine.forecast(
      data.map(d => d.value),
      data.map(d => d.timestamp)
    );

    // Cache forecast
    this.cache.set(cacheKey, forecast, {
      ttl: 30 * 60 * 1000, // 30 minutes for forecasts
      dependencies: [
        CacheDependency.DATA,
        options.platform ? `platform:${options.platform}` : CacheDependency.PLATFORM,
      ],
    });

    return forecast;
  }

  /**
   * Warm up cache with common queries
   */
  async warmUpCache(): Promise<void> {
    const platforms: (Platform | undefined)[] = [
      undefined, // All platforms
      "reddit",
      "hackernews",
    ];

    const metrics = ["engagement", "posts", "comments"];

    const warmUpTasks = [];

    // Warm up platform stats
    for (const platform of platforms) {
      warmUpTasks.push({
        key: `platform_stats:${platform}:none:none`,
        compute: () => this.getPlatformStats(platform),
        ttl: 10 * 60 * 1000,
        dependencies: [
          CacheDependency.DATA,
          platform ? `platform:${platform}` : CacheDependency.PLATFORM,
        ],
      });
    }

    // Warm up engagement metrics
    for (const platform of platforms) {
      for (const metric of metrics) {
        warmUpTasks.push({
          key: `engagement_metrics:${platform}:30:${metric}`,
          compute: () => this.getEngagementMetrics({ platform, metric }),
          ttl: 5 * 60 * 1000,
          dependencies: [
            CacheDependency.DATA,
            platform ? `platform:${platform}` : CacheDependency.PLATFORM,
          ],
        });
      }
    }

    await this.cache.warmUp(warmUpTasks);
  }

  /**
   * Invalidate cache for specific dependencies
   */
  invalidateCache(dependency: CacheDependency | string): number {
    return this.cache.invalidateByDependency(dependency);
  }


  // Helper methods

  private async getTimeSeriesDataInternal(options: {
    platform?: Platform;
    metric: string;
    startDate: Date;
    endDate: Date;
  }): Promise<Array<{ timestamp: Date; value: number }>> {
    const stats = await this.analytics.getEngagementStats({
      platform: options.platform,
      startDate: options.startDate,
      endDate: options.endDate,
    });

    const metricData = stats[`daily${options.metric.charAt(0).toUpperCase() + options.metric.slice(1)}`]
      ?? stats.dailyRates;

    return metricData.map((value: number, index: number) => ({
      timestamp: new Date(
        options.startDate.getTime() + index * 24 * 60 * 60 * 1000
      ),
      value,
    }));
  }

  private calculateTrendScore(post: any): number {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    const velocityScore = post.score / Math.max(1, ageHours);
    const engagementScore = post.commentCount / Math.max(1, ageHours);

    return velocityScore * 0.7 + engagementScore * 0.3;
  }

  private calculateMomentum(post: any): number {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);

    if (ageHours < 1) return 100; // Very new, high momentum
    if (ageHours < 6) return 80;
    if (ageHours < 12) return 60;
    if (ageHours < 24) return 40;

    return 20; // Older than 24 hours, low momentum
  }

  private getMethodTTL(methodName: string): number {
    if (typeof this.options.ttl === 'object' && this.options.ttl[methodName]) {
      return this.options.ttl[methodName];
    }
    return typeof this.options.ttl === 'number' ? this.options.ttl : (5 * 60 * 1000);
  }

  private predictPeakEngagement(post: any): Date {
    // Simple prediction: most posts peak 6-12 hours after posting
    const createdAt = new Date(post.createdAt);
    const peakHours = 6 + Math.random() * 6; // 6-12 hours

    return new Date(createdAt.getTime() + peakHours * 60 * 60 * 1000);
  }

  /**
   * Get time series data with caching
   */
  getTimeSeriesData(
    platform: Platform | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const cacheKey = `getTimeSeriesData:${platform ?? 'all'}:${startDate.toISOString()}:${endDate.toISOString()}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    this.cacheStats.misses++;

    const result = this.analytics.getTimeSeriesData(platform, startDate, endDate);
    const promise = Promise.resolve(result).then(data => {
      // Update cache with resolved promise
      this.cache.set(cacheKey, Promise.resolve(data), {
        ttl: this.getMethodTTL('getTimeSeriesData'),
        dependencies: [CacheDependency.DATA],
      });
      return data;
    });

    // Cache the promise immediately
    this.cache.set(cacheKey, promise, {
      ttl: this.getMethodTTL('getTimeSeriesData'),
      dependencies: [CacheDependency.DATA],
    });

    return promise;
  }

  /**
   * Get trending posts with caching
   */
  getTrendingPosts(limit: number = 10): any {
    const cacheKey = `getTrendingPosts:${limit}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    this.cacheStats.misses++;

    const result = this.analytics.getTrendingPosts(limit);

    // Handle Promise results
    if (result instanceof Promise) {
      const promise = result.then(data => {
        // Check if we should cache this result
        let shouldCacheResult = true;

        if (this.options.shouldCache) {
          shouldCacheResult = this.options.shouldCache('getTrendingPosts', [limit], data);
        }

        if (this.options.excludeMethods?.includes('getTrendingPosts')) {
          shouldCacheResult = false;
        }

        if (!shouldCacheResult) {
          // Remove from cache if we shouldn't cache it
          this.cache.delete(cacheKey);
        } else {
          this.cacheStats.size++;
        }

        return data;
      });

      // Always cache the promise initially
      this.cache.set(cacheKey, promise, {
        ttl: this.getMethodTTL('getTrendingPosts'),
        dependencies: [CacheDependency.DATA],
      });

      return promise;
    } else {
      // Handle sync results
      let shouldCacheResult = true;

      if (this.options.shouldCache) {
        shouldCacheResult = this.options.shouldCache('getTrendingPosts', [limit], result);
      }

      if (this.options.excludeMethods?.includes('getTrendingPosts')) {
        shouldCacheResult = false;
      }

      if (shouldCacheResult) {
        this.cache.set(cacheKey, result, {
          ttl: this.getMethodTTL('getTrendingPosts'),
          dependencies: [CacheDependency.DATA],
        });
        this.cacheStats.size++;
      }

      return result;
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0,
    };
  }

  /**
   * Clear cache for specific method
   */
  clearCacheFor(methodName: string): void {
    // Clear all entries that start with the method name
    const keys = this.cache.getKeys();
    for (const key of keys) {
      if (key.toLowerCase().includes(methodName.toLowerCase())) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: RegExp): void {
    const keys = this.cache.getKeys();
    for (const key of keys) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    const cacheInfo = this.cache.getMetrics();
    const cacheSize = this.cacheStats.size;
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
      size: cacheSize,
      entries: cacheSize,
      memoryUsage: cacheInfo?.memoryUsage || 1,  // Return at least 1 to indicate cache has data
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0,
    };
  }

  /**
   * Serialize cache to JSON
   */
  serialize(): string {
    const keys = this.cache.getKeys ? this.cache.getKeys() : [];
    const cacheData: any = {};
    for (const key of keys) {
      cacheData[key] = this.cache.get(key);
    }
    return JSON.stringify({
      cache: cacheData,
      stats: this.cacheStats,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Deserialize cache from JSON
   */
  deserialize(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.cache) {
        for (const [key, value] of Object.entries(data.cache)) {
          this.cache.set(key, value);
        }
      }
      if (data.stats) {
        this.cacheStats = { ...this.cacheStats, ...data.stats };
      }
    } catch (error) {
      // Handle invalid JSON gracefully
      console.error('Failed to deserialize cache:', error);
    }
  }

  /**
   * Get database health
   */
  async getDatabaseHealth(): Promise<any> {
    return this.analytics.getDatabaseHealth();
  }

  /**
   * Start background refresh
   */
  private startBackgroundRefresh(interval: number): void {
    this.backgroundRefreshTimer = setInterval(() => {
      // Refresh cached items that have been accessed
      this.accessedKeys.forEach(key => {
        // Re-fetch the data based on the key
        if (key.startsWith('getPlatformStats:')) {
          const parts = key.split(':');
          const platform = parts[1] === 'all' ? undefined : parts[1] as Platform;
          this.analytics.getPlatformStats(platform);
        }
      });
    }, interval);
  }

  /**
   * Stop background refresh
   */
  stopBackgroundRefresh(): void {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = undefined;
    }
  }

  /**
   * Warmup cache
   */
  async warmup(queries: Array<{ method: string; args: any[] }>): Promise<void> {
    const promises = queries.map(async (query) => {
      const method = (this as any)[query.method];
      if (typeof method === 'function') {
        await method.call(this, ...query.args);
      }
    });
    await Promise.all(promises);
  }
}

/**
 * Example usage with decorators
 */
export class CachedAnalyticsQueries {
  constructor(
    private analytics: DatabaseAnalytics,
    private cache: CacheLayer
  ) {}

  async getWeeklySummary(platform?: Platform): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const [posts, comments, users, engagement] = await Promise.all([
      this.analytics.getPostStats({ platform, startDate, endDate }),
      this.analytics.getCommentStats({ platform, startDate, endDate }),
      this.analytics.getUserStats({ platform, startDate, endDate }),
      this.analytics.getEngagementStats({ platform, startDate, endDate }),
    ]);

    return {
      period: { start: startDate, end: endDate },
      platform,
      posts: posts.total,
      comments: comments.total,
      users: users.uniqueUsers,
      avgEngagement: engagement.avgEngagement,
      topPosts: posts.topPosts?.slice(0, 5),
    };
  }

  async getRealTimeMetrics(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [recentPosts, activeUsers, trending] = await Promise.all([
      this.analytics.getPostStats({ startDate: oneHourAgo, endDate: now }),
      this.analytics.getUserStats({ startDate: oneHourAgo, endDate: now }),
      this.analytics.getTrendingPosts(5),
    ]);

    return {
      timestamp: now,
      lastHour: {
        posts: recentPosts.total,
        activeUsers: activeUsers.uniqueUsers,
        trending: trending.map(p => ({
          title: p.title,
          score: p.score,
          platform: p.platform,
        })),
      },
    };
  }
}

// Export alias for backward compatibility
export { CachedAnalyticsService as CachedAnalytics };