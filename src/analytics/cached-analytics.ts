/**
 * Cached Analytics Integration
 *
 * Demonstrates integration of the cache layer with analytics modules
 * for improved performance and reduced database load.
 */

import { CacheLayer, CacheDependency, Cacheable } from "./cache-layer.js";
import type { DatabaseAnalytics } from "../database/analytics.js";
import type { Platform } from "../types/core.js";
import { StatisticalAnalyzer } from "./statistics.js";
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
  private statsAnalyzer: StatisticalAnalyzer;
  private trendAnalyzer: TrendAnalyzer;
  private anomalyDetector: AnomalyDetector;
  private forecastEngine: ForecastingEngine;

  constructor(analytics: DatabaseAnalytics, cache?: CacheLayer) {
    this.analytics = analytics;
    this.cache = cache ?? new CacheLayer({
      defaultTTL: 5 * 60 * 1000,  // 5 minutes
      maxSize: 50 * 1024 * 1024,   // 50MB for analytics
      enableMetrics: true,
    });

    // Initialize analyzers
    this.statsAnalyzer = new StatisticalAnalyzer();
    this.trendAnalyzer = new TrendAnalyzer();
    this.anomalyDetector = new AnomalyDetector();
    this.forecastEngine = new ForecastingEngine();
  }

  /**
   * Get platform statistics with caching
   */
  async getPlatformStats(
    platform?: Platform,
    dateRange?: { start: Date; end: Date }
  ): Promise<any> {
    const cacheKey = this.cache.generateKey("platform_stats", {
      platform,
      dateRange,
    });

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Compute statistics
    const stats = await this.analytics.getPlatformStats({
      platform,
      startDate: dateRange?.start,
      endDate: dateRange?.end,
    });

    // Cache with dependencies
    this.cache.set(cacheKey, stats, {
      ttl: 10 * 60 * 1000, // 10 minutes for platform stats
      dependencies: [
        CacheDependency.DATA,
        platform ? `platform:${platform}` : CacheDependency.PLATFORM,
      ],
    });

    return stats;
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
    const cacheKey = this.cache.generateKey("engagement_metrics", options);

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
    const cacheKey = this.cache.generateKey("trending_analysis", options);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get trending posts
    const trending = await this.analytics.getTrendingPosts({
      platform: options.platform,
      limit: options.limit ?? 10,
      timeWindow: options.timeWindow ?? 24,
    });

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
    const cacheKey = this.cache.generateKey("anomaly_detection", options);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get time series data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days ?? 30));

    const data = await this.getTimeSeriesData({
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
    const cacheKey = this.cache.generateKey("forecast", options);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // 60 days of history

    const data = await this.getTimeSeriesData({
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
        key: this.cache.generateKey("platform_stats", { platform }),
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
          key: this.cache.generateKey("engagement_metrics", { platform, metric }),
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

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // Helper methods

  private async getTimeSeriesData(options: {
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

  private predictPeakEngagement(post: any): Date {
    // Simple prediction: most posts peak 6-12 hours after posting
    const createdAt = new Date(post.createdAt);
    const peakHours = 6 + Math.random() * 6; // 6-12 hours

    return new Date(createdAt.getTime() + peakHours * 60 * 60 * 1000);
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

  @Cacheable({
    ttl: 10 * 60 * 1000,
    namespace: "weekly_summary",
    dependencies: [CacheDependency.DATA, CacheDependency.TIME_RANGE],
  })
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

  @Cacheable({
    ttl: 5 * 60 * 1000,
    namespace: "real_time_metrics",
    dependencies: [CacheDependency.DATA],
  })
  async getRealTimeMetrics(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [recentPosts, activeUsers, trending] = await Promise.all([
      this.analytics.getPostStats({ startDate: oneHourAgo, endDate: now }),
      this.analytics.getUserStats({ startDate: oneHourAgo, endDate: now }),
      this.analytics.getTrendingPosts({ limit: 5, timeWindow: 1 }),
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