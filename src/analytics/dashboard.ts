/**
 * Analytics Dashboard
 * Provides comprehensive analytics overview with real-time data and trends
 */

import type {
  DatabaseAnalytics,
  PlatformStats,
  TrendingPost,
  TimeSeriesData,
} from "../database/analytics.js";
import type { Platform } from "../types/core.js";
import { AnalyticsVisualizer } from "./visualizer.js";
import { ReportGenerator } from "./report-generator.js";

export interface DashboardConfig {
  refreshInterval?: number; // in milliseconds
  maxDataPoints?: number;
  platforms?: Platform[];
  enableAutoRefresh?: boolean;
}

export interface DashboardMetrics {
  overview: {
    totalPosts: number;
    totalComments: number;
    totalUsers: number;
    avgEngagement: number;
    growthRate: number;
  };
  platformBreakdown: Map<Platform, PlatformStats>;
  trending: TrendingPost[];
  timeSeries: TimeSeriesData[];
  topPerformers: {
    posts: TrendingPost[];
    authors: Array<{
      author: string;
      metrics: {
        postCount: number;
        totalScore: number;
        avgScore: number;
      };
    }>;
  };
  health: {
    databaseSize: number;
    lastUpdate: Date;
    dataQuality: number; // 0-100 score
    gaps: Array<{
      platform: Platform;
      startDate: Date;
      endDate: Date;
      gapDays: number;
    }>;
  };
}

export interface DashboardFilter {
  platforms?: Platform[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  metrics?: string[];
  sortBy?: "score" | "engagement" | "date" | "comments";
  limit?: number;
}

export class AnalyticsDashboard {
  private analytics: DatabaseAnalytics;
  private visualizer: AnalyticsVisualizer;
  private reportGenerator: ReportGenerator;
  private config: Required<DashboardConfig>;
  private refreshTimer?: NodeJS.Timeout;
  private cachedMetrics?: DashboardMetrics;
  private lastRefresh?: Date;

  constructor(analytics: DatabaseAnalytics, config: DashboardConfig = {}) {
    this.analytics = analytics;
    this.visualizer = new AnalyticsVisualizer();
    this.reportGenerator = new ReportGenerator(analytics);

    this.config = {
      refreshInterval: config.refreshInterval || 60000, // 1 minute default
      maxDataPoints: config.maxDataPoints || 100,
      platforms: config.platforms || ["reddit", "hackernews"],
      enableAutoRefresh: config.enableAutoRefresh ?? false,
    };

    if (this.config.enableAutoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Get comprehensive dashboard metrics
   */
  public async getMetrics(filter?: DashboardFilter): Promise<DashboardMetrics> {
    // Use cache if available and fresh
    if (this.cachedMetrics && this.lastRefresh) {
      const cacheAge = Date.now() - this.lastRefresh.getTime();
      if (cacheAge < this.config.refreshInterval) {
        return this.applyFilter(this.cachedMetrics, filter);
      }
    }

    // Fetch fresh metrics
    const metrics = await this.fetchMetrics();
    this.cachedMetrics = metrics;
    this.lastRefresh = new Date();

    return this.applyFilter(metrics, filter);
  }

  /**
   * Get real-time streaming metrics
   */
  public async *streamMetrics(
    filter?: DashboardFilter,
    interval = 5000,
  ): AsyncGenerator<DashboardMetrics> {
    while (true) {
      yield await this.getMetrics(filter);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * Get platform-specific dashboard
   */
  public async getPlatformDashboard(
    platform: Platform,
    dateRange?: { start: Date; end: Date },
  ): Promise<{
    stats: PlatformStats;
    trends: TimeSeriesData[];
    topContent: TrendingPost[];
    engagement: {
      avgEngagement: number;
      distribution: Map<string, number>;
      peaks: Date[];
    };
    visualization: string; // ASCII chart
  }> {
    const stats = this.analytics.getPlatformStats(platform);
    if (!stats) {
      throw new Error(`No data available for platform: ${platform}`);
    }

    const endDate = dateRange?.end || new Date();
    const startDate =
      dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const trends = this.analytics.getTimeSeriesData(
      platform,
      startDate,
      endDate,
      "daily",
    );

    const topContent = this.analytics.getTrendingPosts(10, platform);
    const engagementStats = this.analytics.getEngagementStats(platform, 30);

    // Calculate engagement distribution
    const engagementData = this.analytics.getEngagementOverTime(30, platform);
    const distribution = new Map<string, number>();
    engagementData.forEach((day) => {
      const bucket = this.getEngagementBucket(day.avgScore);
      distribution.set(bucket, (distribution.get(bucket) || 0) + 1);
    });

    // Find engagement peaks
    const peaks = this.findPeaks(trends);

    // Generate visualization
    const chartData = trends.map((t) => ({
      date: t.timestamp,
      value: t.avgScore,
    }));
    const visualization = this.visualizer.createLineChart(
      chartData,
      "Average Score Trend",
      { width: 60, height: 15 },
    );

    return {
      stats,
      trends,
      topContent,
      engagement: {
        avgEngagement: engagementStats.avgEngagement,
        distribution,
        peaks,
      },
      visualization,
    };
  }

  /**
   * Get comparative analytics between platforms
   */
  public async getComparativeAnalytics(): Promise<{
    platforms: Map<Platform, PlatformStats>;
    comparison: {
      metric: string;
      reddit?: number;
      hackernews?: number;
      winner: Platform;
    }[];
    insights: string[];
    visualization: string;
  }> {
    const platforms = new Map<Platform, PlatformStats>();

    for (const platform of this.config.platforms) {
      const stats = this.analytics.getPlatformStats(platform);
      if (stats) {
        platforms.set(platform, stats);
      }
    }

    // Compare key metrics
    const comparison = this.compareMetrics(platforms);

    // Generate insights
    const insights = this.generateInsights(platforms, comparison);

    // Create comparison chart
    const visualization = this.visualizer.createBarChart(
      comparison.map((c) => ({
        label: c.metric,
        reddit: c.reddit || 0,
        hackernews: c.hackernews || 0,
      })),
      "Platform Comparison",
      { width: 60, height: 20 },
    );

    return {
      platforms,
      comparison,
      insights,
      visualization,
    };
  }

  /**
   * Get trending insights
   */
  public async getTrendingInsights(
    hours = 24,
    limit = 10,
  ): Promise<{
    rising: TrendingPost[];
    declining: Array<{
      post: TrendingPost;
      dropRate: number;
    }>;
    predictions: Array<{
      post: TrendingPost;
      predictedScore: number;
      confidence: number;
    }>;
    anomalies: TrendingPost[];
  }> {
    // Get current trending posts
    const currentTrending = this.analytics.getTrendingPosts(limit * 2);

    // Get historical data for comparison
    const historicalDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const historicalTrending = this.analytics.getTrendingPosts(
      limit * 2,
      undefined,
      historicalDate,
    );

    // Identify rising posts (new in trending)
    const historicalIds = new Set(historicalTrending.map((p) => p.id));
    const rising = currentTrending
      .filter((p) => !historicalIds.has(p.id))
      .slice(0, limit);

    // Identify declining posts
    const currentMap = new Map(currentTrending.map((p) => [p.id, p]));
    const declining = historicalTrending
      .filter((p) => currentMap.has(p.id))
      .map((historical) => {
        const current = currentMap.get(historical.id)!;
        const dropRate = (historical.score - current.score) / historical.score;
        return { post: current, dropRate };
      })
      .filter((p) => p.dropRate > 0)
      .sort((a, b) => b.dropRate - a.dropRate)
      .slice(0, limit);

    // Simple predictions based on momentum
    const predictions = this.predictTrending(currentTrending, hours);

    // Detect anomalies (posts with unusual engagement patterns)
    const anomalies = this.detectAnomalies(currentTrending);

    return {
      rising,
      declining,
      predictions,
      anomalies,
    };
  }

  /**
   * Get performance metrics
   */
  public async getPerformanceMetrics(): Promise<{
    scraping: {
      successRate: number;
      avgResponseTime: number;
      itemsPerSecond: number;
      errorRate: number;
    };
    database: {
      size: number;
      queryPerformance: number;
      indexEfficiency: number;
    };
    dataQuality: {
      completeness: number;
      freshness: number;
      consistency: number;
      overall: number;
    };
  }> {
    // Get scraping performance
    const sessions = this.analytics.getSessionPerformance();
    const recentSessions = sessions.slice(0, 10);

    const scrapingMetrics = {
      successRate: this.analytics.getSuccessfulSessionRate(),
      avgResponseTime: this.calculateAverage(
        recentSessions.map((s) => {
          const perf = this.analytics.getScrapingPerformance(s.session_id);
          return perf?.avgResponseTime || 0;
        }),
      ),
      itemsPerSecond: this.calculateAverage(
        recentSessions.map((s) => {
          const perf = this.analytics.getScrapingPerformance(s.session_id);
          return perf?.itemsPerSecond || 0;
        }),
      ),
      errorRate: this.calculateAverage(
        recentSessions.map((s) => {
          const perf = this.analytics.getScrapingPerformance(s.session_id);
          return perf?.errorRate || 0;
        }),
      ),
    };

    // Get database metrics
    const dbHealth = this.analytics.getDatabaseHealthDetailed();
    const databaseMetrics = {
      size: dbHealth.totalSize,
      queryPerformance: 95, // Placeholder - would need actual query timing
      indexEfficiency: dbHealth.vacuumNeeded ? 70 : 90,
    };

    // Calculate data quality
    const dataQuality = this.assessDataQuality();

    return {
      scraping: scrapingMetrics,
      database: databaseMetrics,
      dataQuality,
    };
  }

  /**
   * Generate dashboard report
   */
  public async generateReport(
    format: "html" | "markdown" | "json" = "markdown",
  ): Promise<string> {
    const metrics = await this.getMetrics();
    const comparative = await this.getComparativeAnalytics();
    const trending = await this.getTrendingInsights();
    const performance = await this.getPerformanceMetrics();

    return this.reportGenerator.generateDashboardReport(
      {
        metrics,
        comparative,
        trending,
        performance,
        generatedAt: new Date(),
      },
      format,
    );
  }

  /**
   * Export dashboard data
   */
  public async exportData(
    format: "csv" | "json" | "excel",
    filter?: DashboardFilter,
  ): Promise<Buffer> {
    const metrics = await this.getMetrics(filter);
    return this.reportGenerator.exportData(metrics, format);
  }

  // Private helper methods

  private async fetchMetrics(): Promise<DashboardMetrics> {
    // Fetch overview metrics
    const platformStats = new Map<Platform, PlatformStats>();
    let totalPosts = 0;
    let totalComments = 0;
    let totalUsers = 0;
    let totalEngagement = 0;

    for (const platform of this.config.platforms) {
      const stats = this.analytics.getPlatformStats(platform);
      if (stats) {
        platformStats.set(platform, stats);
        totalPosts += stats.totalPosts;
        totalComments += stats.totalComments;
        totalUsers += stats.totalUsers;
        totalEngagement += stats.avgScore;
      }
    }

    const avgEngagement =
      platformStats.size > 0 ? totalEngagement / platformStats.size : 0;

    // Calculate growth rate
    const growthRate = this.calculateGrowthRate();

    // Get trending posts - handle potential errors
    let trending;
    try {
      trending = await Promise.resolve(this.analytics.getTrendingPosts(20));
    } catch (error) {
      // Re-throw if this is a critical error
      throw error;
    }

    // Get time series data
    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const timeSeries: TimeSeriesData[] = [];

    for (const platform of this.config.platforms) {
      const data = this.analytics.getTimeSeriesData(
        platform,
        startDate,
        endDate,
        "daily",
      );
      timeSeries.push(...data);
    }

    // Get top performers
    const topPosts = this.analytics.getMostEngagedPosts(10);
    const topAuthors: Array<{ author: string; metrics: any }> = [];

    for (const platform of this.config.platforms) {
      const authors = this.analytics.getTopAuthors(platform, 7, 5);
      topAuthors.push(
        ...authors.map((a) => ({
          author: a.author,
          metrics: {
            postCount: a.postCount,
            totalScore: a.totalScore,
            avgScore: a.avgScore,
          },
        })),
      );
    }

    // Get health metrics
    const dbHealth = this.analytics.getDatabaseHealth();
    const gaps = this.analytics.getDataGaps(1);
    const dataQuality = this.assessDataQuality();

    return {
      overview: {
        totalPosts,
        totalComments,
        totalUsers,
        avgEngagement,
        growthRate,
      },
      platformBreakdown: platformStats,
      trending,
      timeSeries,
      topPerformers: {
        posts: topPosts as TrendingPost[],
        authors: topAuthors,
      },
      health: {
        databaseSize: dbHealth.databaseSize,
        lastUpdate: dbHealth.lastUpdate,
        dataQuality: dataQuality.overall,
        gaps: gaps.map((g) => ({
          platform: g.platform,
          startDate: new Date(g.startDate),
          endDate: new Date(g.endDate),
          gapDays: g.gapDays,
        })),
      },
    };
  }

  private applyFilter(
    metrics: DashboardMetrics,
    filter?: DashboardFilter,
  ): DashboardMetrics {
    if (!filter) return metrics;

    const filtered = { ...metrics };

    // Filter by platforms
    if (filter.platforms) {
      const platformSet = new Set(filter.platforms);
      filtered.platformBreakdown = new Map(
        Array.from(metrics.platformBreakdown.entries()).filter(([platform]) =>
          platformSet.has(platform),
        ),
      );

      filtered.trending = metrics.trending.filter((post) =>
        platformSet.has(post.platform),
      );
    }

    // Filter by date range
    if (filter.dateRange) {
      filtered.timeSeries = metrics.timeSeries.filter(
        (data) =>
          data.timestamp >= filter.dateRange!.start &&
          data.timestamp <= filter.dateRange!.end,
      );
    }

    // Apply sorting
    if (filter.sortBy) {
      filtered.trending = [...metrics.trending].sort((a, b) => {
        switch (filter.sortBy) {
          case "score":
            return b.score - a.score;
          case "engagement":
            return b.score + b.commentCount - (a.score + a.commentCount);
          case "date":
            return b.createdAt.getTime() - a.createdAt.getTime();
          case "comments":
            return b.commentCount - a.commentCount;
          default:
            return 0;
        }
      });
    }

    // Apply limit
    if (filter.limit) {
      filtered.trending = filtered.trending.slice(0, filter.limit);
      filtered.topPerformers.posts = filtered.topPerformers.posts.slice(
        0,
        filter.limit,
      );
      filtered.topPerformers.authors = filtered.topPerformers.authors.slice(
        0,
        filter.limit,
      );
    }

    return filtered;
  }

  private calculateGrowthRate(): number {
    const days = 7;
    const recentPosts = this.analytics.getPostsByDateRange(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      new Date(),
    );
    const previousPosts = this.analytics.getPostsByDateRange(
      new Date(Date.now() - 2 * days * 24 * 60 * 60 * 1000),
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    );

    if (previousPosts.length === 0) return 0;

    return (
      ((recentPosts.length - previousPosts.length) / previousPosts.length) * 100
    );
  }

  private assessDataQuality(): {
    completeness: number;
    freshness: number;
    consistency: number;
    overall: number;
  } {
    const dbHealth = this.analytics.getDatabaseHealth();

    // Completeness: based on null/missing values
    const completeness = 85; // Placeholder - would need actual null checks

    // Freshness: based on last update time
    const hoursSinceUpdate = dbHealth.newestPost
      ? (Date.now() - dbHealth.newestPost.getTime()) / (1000 * 60 * 60)
      : 999;
    const freshness = Math.max(0, 100 - hoursSinceUpdate * 2);

    // Consistency: based on data gaps
    const gaps = this.analytics.getDataGaps(1);
    const consistency = Math.max(0, 100 - gaps.length * 10);

    const overall = (completeness + freshness + consistency) / 3;

    return {
      completeness,
      freshness,
      consistency,
      overall,
    };
  }

  private compareMetrics(platforms: Map<Platform, PlatformStats>): Array<{
    metric: string;
    reddit?: number;
    hackernews?: number;
    winner: Platform;
  }> {
    const metrics = [
      "totalPosts",
      "totalComments",
      "totalUsers",
      "avgScore",
      "avgCommentCount",
    ];

    return metrics.map((metric) => {
      const redditStats = platforms.get("reddit");
      const hnStats = platforms.get("hackernews");

      const redditValue = redditStats ? (redditStats as any)[metric] || 0 : 0;
      const hnValue = hnStats ? (hnStats as any)[metric] || 0 : 0;

      return {
        metric,
        reddit: redditValue,
        hackernews: hnValue,
        winner: redditValue > hnValue ? "reddit" : "hackernews",
      };
    });
  }

  private generateInsights(
    platforms: Map<Platform, PlatformStats>,
    comparison: any[],
  ): string[] {
    const insights: string[] = [];

    // Overall activity insight
    const totalActivity = Array.from(platforms.values()).reduce(
      (sum, stats) => sum + stats.totalPosts + stats.totalComments,
      0,
    );
    insights.push(
      `Total activity across platforms: ${totalActivity.toLocaleString()} items`,
    );

    // Engagement insight
    const avgEngagement =
      Array.from(platforms.values()).reduce(
        (sum, stats) => sum + stats.avgScore,
        0,
      ) / platforms.size;
    insights.push(`Average engagement score: ${avgEngagement.toFixed(2)}`);

    // Platform dominance
    const winners = comparison.map((c) => c.winner);
    const redditWins = winners.filter((w) => w === "reddit").length;
    const hnWins = winners.filter((w) => w === "hackernews").length;

    if (redditWins > hnWins) {
      insights.push(
        `Reddit leads in ${redditWins} out of ${comparison.length} metrics`,
      );
    } else if (hnWins > redditWins) {
      insights.push(
        `HackerNews leads in ${hnWins} out of ${comparison.length} metrics`,
      );
    } else {
      insights.push("Both platforms show equal strength across metrics");
    }

    // Most active user insight
    for (const [platform, stats] of platforms) {
      if (stats.mostActiveUser) {
        insights.push(
          `Most active user on ${platform}: ${stats.mostActiveUser.username} ` +
            `(${stats.mostActiveUser.posts + stats.mostActiveUser.comments} contributions)`,
        );
      }
    }

    return insights;
  }

  private findPeaks(data: TimeSeriesData[]): Date[] {
    const peaks: Date[] = [];

    for (let i = 1; i < data.length - 1; i++) {
      if (
        data[i].avgScore > data[i - 1].avgScore &&
        data[i].avgScore > data[i + 1].avgScore
      ) {
        peaks.push(data[i].timestamp);
      }
    }

    return peaks;
  }

  private getEngagementBucket(score: number): string {
    if (score < 10) return "Low";
    if (score < 50) return "Medium";
    if (score < 100) return "High";
    return "Very High";
  }

  private predictTrending(
    posts: TrendingPost[],
    hours: number,
  ): Array<{
    post: TrendingPost;
    predictedScore: number;
    confidence: number;
  }> {
    return posts.slice(0, 10).map((post) => {
      // Simple linear projection based on age and current score
      const ageHours =
        (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
      const velocity = post.score / Math.max(ageHours, 1);
      const predictedScore = post.score + velocity * hours;

      // Confidence based on age and engagement
      const confidence = Math.min(
        100,
        (post.commentCount / Math.max(post.score, 1)) * 100,
      );

      return {
        post,
        predictedScore: Math.round(predictedScore),
        confidence: Math.round(confidence),
      };
    });
  }

  private detectAnomalies(posts: TrendingPost[]): TrendingPost[] {
    const avgScore = this.calculateAverage(posts.map((p) => p.score));
    const avgComments = this.calculateAverage(posts.map((p) => p.commentCount));

    return posts.filter((post) => {
      const scoreDeviation = Math.abs(post.score - avgScore) / avgScore;
      const commentDeviation =
        Math.abs(post.commentCount - avgComments) / avgComments;

      // Anomaly if either metric deviates by more than 200%
      return scoreDeviation > 2 || commentDeviation > 2;
    });
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(async () => {
      try {
        await this.fetchMetrics();
      } catch (error) {
        console.error("Dashboard auto-refresh error:", error);
      }
    }, this.config.refreshInterval);
  }

  /**
   * Stop auto-refresh
   */
  public stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cachedMetrics = undefined;
    this.lastRefresh = undefined;
  }
}
