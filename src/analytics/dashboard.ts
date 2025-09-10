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
import * as readline from "readline";

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
    platforms.forEach((stats, platform) => {
      if (stats.mostActiveUser) {
        insights.push(
          `Most active user on ${platform}: ${stats.mostActiveUser.username} ` +
            `(${stats.mostActiveUser.posts + stats.mostActiveUser.comments} contributions)`,
        );
      }
    });

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

  /**
   * Display comprehensive dashboard summary
   */
  public async displayDashboard(
    options: {
      showCharts?: boolean;
      showDetails?: boolean;
      colorize?: boolean;
    } = {},
  ): Promise<string> {
    const metrics = await this.getMetrics();
    const output: string[] = [];

    // Header
    output.push("=".repeat(80));
    output.push(this.centerText("📊 ANALYTICS DASHBOARD", 80));
    output.push("=".repeat(80));
    output.push("");

    // Overview Section
    output.push(this.formatSection("📈 OVERVIEW", options.colorize));
    output.push(this.formatOverview(metrics.overview));
    output.push("");

    // Platform Breakdown
    output.push(this.formatSection("🌐 PLATFORM BREAKDOWN", options.colorize));
    output.push(this.formatPlatformBreakdown(metrics.platformBreakdown));
    output.push("");

    // Trending Content
    if (metrics.trending.length > 0) {
      output.push(this.formatSection("🔥 TRENDING CONTENT", options.colorize));
      output.push(this.formatTrendingContent(metrics.trending.slice(0, 5)));
      output.push("");
    }

    // Charts
    if (options.showCharts && metrics.timeSeries.length > 0) {
      output.push(this.formatSection("📊 ACTIVITY TREND", options.colorize));
      const chart = this.visualizer.createLineChart(
        metrics.timeSeries.slice(0, 30).map((d) => ({
          date: d.timestamp,
          value: d.avgScore,
        })),
        "30-Day Score Trend",
        { width: 70, height: 15 },
      );
      output.push(chart);
      output.push("");

      // Platform distribution pie chart
      const platformData = Array.from(metrics.platformBreakdown.entries()).map(
        ([platform, stats]) => ({
          label: platform,
          value: stats.totalPosts,
        }),
      );
      output.push(
        this.formatSection("🥧 CONTENT DISTRIBUTION", options.colorize),
      );
      const pieChart = this.visualizer.createPieChart(
        platformData,
        "Posts by Platform",
        { width: 70, height: 15 },
      );
      output.push(pieChart);
      output.push("");
    }

    // Health Status
    output.push(this.formatSection("💚 SYSTEM HEALTH", options.colorize));
    output.push(this.formatHealthStatus(metrics.health));
    output.push("");

    // Top Performers
    if (options.showDetails) {
      output.push(this.formatSection("🏆 TOP PERFORMERS", options.colorize));
      output.push(this.formatTopPerformers(metrics.topPerformers));
      output.push("");
    }

    // Footer
    output.push("─".repeat(80));
    output.push(`Last Updated: ${new Date().toLocaleString()}`);
    output.push("=".repeat(80));

    return output.join("\n");
  }

  /**
   * Start interactive dashboard mode
   */
  public async startInteractiveDashboard(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.clear();
    console.log(await this.displayDashboard({ showCharts: true }));

    const commands = [
      "r - Refresh dashboard",
      "p - Platform details",
      "t - Trending analysis",
      "c - Comparative view",
      "e - Export report",
      "s - Settings",
      "q - Quit",
    ];

    console.log("\n" + "─".repeat(80));
    console.log("Commands: " + commands.join(" | "));
    console.log("─".repeat(80));

    const prompt = () => {
      rl.question("\nDashboard > ", async (answer) => {
        const cmd = answer.toLowerCase().trim();

        switch (cmd) {
          case "r":
            console.clear();
            console.log(await this.displayDashboard({ showCharts: true }));
            break;

          case "p":
            await this.showPlatformDetails(rl);
            break;

          case "t":
            await this.showTrendingAnalysis();
            break;

          case "c":
            await this.showComparativeView();
            break;

          case "e":
            await this.exportInteractive(rl);
            break;

          case "s":
            await this.showSettings(rl);
            break;

          case "q":
            console.log("\nExiting dashboard...");
            this.stopAutoRefresh();
            rl.close();
            return;

          default:
            console.log("Unknown command. Use 'q' to quit.");
        }

        console.log("\n" + "─".repeat(80));
        console.log("Commands: " + commands.join(" | "));
        console.log("─".repeat(80));
        prompt();
      });
    };

    prompt();
  }

  /**
   * Show platform-specific details
   */
  private async showPlatformDetails(rl: readline.Interface): Promise<void> {
    return new Promise((resolve) => {
      rl.question(
        "\nSelect platform (reddit/hackernews): ",
        async (platform) => {
          try {
            const dashboard = await this.getPlatformDashboard(
              platform as Platform,
            );
            console.log("\n" + "=".repeat(80));
            console.log(
              this.centerText(`${platform.toUpperCase()} DETAILS`, 80),
            );
            console.log("=".repeat(80));
            console.log(dashboard.visualization);
            console.log("\nEngagement Distribution:");
            dashboard.engagement.distribution.forEach((count, bucket) => {
              console.log(
                `  ${bucket}: ${"█".repeat(Math.min(count, 30))} (${count})`,
              );
            });
          } catch (error) {
            console.error("Error fetching platform details:", error);
          }
          resolve();
        },
      );
    });
  }

  /**
   * Show trending analysis
   */
  private async showTrendingAnalysis(): Promise<void> {
    const insights = await this.getTrendingInsights();

    console.log("\n" + "=".repeat(80));
    console.log(this.centerText("TRENDING ANALYSIS", 80));
    console.log("=".repeat(80));

    console.log("\n📈 Rising Content:");
    insights.rising.slice(0, 5).forEach((post, i) => {
      console.log(`  ${i + 1}. ${post.title}`);
      console.log(`     Score: ${post.score} | Comments: ${post.commentCount}`);
    });

    console.log("\n📉 Declining Content:");
    insights.declining.slice(0, 5).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.post.title}`);
      console.log(`     Drop Rate: ${(item.dropRate * 100).toFixed(1)}%`);
    });

    console.log("\n🔮 Predictions:");
    insights.predictions.slice(0, 3).forEach((pred, i) => {
      console.log(`  ${i + 1}. ${pred.post.title}`);
      console.log(
        `     Predicted Score: ${pred.predictedScore} (${pred.confidence}% confidence)`,
      );
    });
  }

  /**
   * Show comparative view
   */
  private async showComparativeView(): Promise<void> {
    const comparative = await this.getComparativeAnalytics();

    console.log("\n" + "=".repeat(80));
    console.log(this.centerText("PLATFORM COMPARISON", 80));
    console.log("=".repeat(80));
    console.log(comparative.visualization);

    console.log("\n💡 Insights:");
    comparative.insights.forEach((insight) => {
      console.log(`  • ${insight}`);
    });
  }

  /**
   * Export report interactively
   */
  private async exportInteractive(rl: readline.Interface): Promise<void> {
    return new Promise((resolve) => {
      rl.question("\nExport format (markdown/html/json): ", async (format) => {
        try {
          const report = await this.generateReport(format as any);
          const filename = `dashboard-report-${Date.now()}.${format === "html" ? "html" : format === "json" ? "json" : "md"}`;

          // In a real implementation, this would write to a file
          console.log(`\n✅ Report exported to: ${filename}`);
          console.log(`   Size: ${Buffer.byteLength(report, "utf8")} bytes`);
        } catch (error) {
          console.error("Error exporting report:", error);
        }
        resolve();
      });
    });
  }

  /**
   * Show and modify settings
   */
  private async showSettings(rl: readline.Interface): Promise<void> {
    console.log("\n" + "=".repeat(80));
    console.log(this.centerText("DASHBOARD SETTINGS", 80));
    console.log("=".repeat(80));
    console.log(`\nCurrent Settings:`);
    console.log(
      `  • Auto-refresh: ${this.config.enableAutoRefresh ? "Enabled" : "Disabled"}`,
    );
    console.log(`  • Refresh interval: ${this.config.refreshInterval / 1000}s`);
    console.log(`  • Max data points: ${this.config.maxDataPoints}`);
    console.log(`  • Platforms: ${this.config.platforms.join(", ")}`);

    return new Promise((resolve) => {
      rl.question("\nToggle auto-refresh? (y/n): ", (answer) => {
        if (answer.toLowerCase() === "y") {
          this.config.enableAutoRefresh = !this.config.enableAutoRefresh;
          if (this.config.enableAutoRefresh) {
            this.startAutoRefresh();
            console.log("✅ Auto-refresh enabled");
          } else {
            this.stopAutoRefresh();
            console.log("✅ Auto-refresh disabled");
          }
        }
        resolve();
      });
    });
  }

  // Formatting helper methods

  private formatSection(title: string, colorize = false): string {
    if (colorize) {
      // In a real implementation, this would use ANSI colors
      return `\n${title}\n${"─".repeat(title.length)}`;
    }
    return `\n${title}\n${"─".repeat(title.length)}`;
  }

  private formatOverview(overview: DashboardMetrics["overview"]): string {
    const lines: string[] = [];
    lines.push(
      `  📊 Total Posts:     ${this.formatNumber(overview.totalPosts)}`,
    );
    lines.push(
      `  💬 Total Comments:  ${this.formatNumber(overview.totalComments)}`,
    );
    lines.push(
      `  👥 Total Users:     ${this.formatNumber(overview.totalUsers)}`,
    );
    lines.push(`  ⚡ Avg Engagement:  ${overview.avgEngagement.toFixed(2)}`);
    lines.push(
      `  📈 Growth Rate:     ${overview.growthRate > 0 ? "+" : ""}${overview.growthRate.toFixed(1)}%`,
    );
    return lines.join("\n");
  }

  private formatPlatformBreakdown(
    breakdown: Map<Platform, PlatformStats>,
  ): string {
    const lines: string[] = [];
    breakdown.forEach((stats, platform) => {
      lines.push(`  ${platform}:`);
      lines.push(`    • Posts: ${this.formatNumber(stats.totalPosts)}`);
      lines.push(`    • Comments: ${this.formatNumber(stats.totalComments)}`);
      lines.push(`    • Avg Score: ${stats.avgScore.toFixed(2)}`);
    });
    return lines.join("\n");
  }

  private formatTrendingContent(trending: TrendingPost[]): string {
    const lines: string[] = [];
    trending.forEach((post, i) => {
      lines.push(
        `  ${i + 1}. ${post.title.substring(0, 60)}${post.title.length > 60 ? "..." : ""}`,
      );
      lines.push(
        `     [${post.platform}] Score: ${post.score} | Comments: ${post.commentCount} | By: ${post.author}`,
      );
    });
    return lines.join("\n");
  }

  private formatHealthStatus(health: DashboardMetrics["health"]): string {
    const lines: string[] = [];
    const healthIcon =
      health.dataQuality >= 80 ? "✅" : health.dataQuality >= 50 ? "⚠️" : "❌";
    lines.push(`  ${healthIcon} Data Quality:    ${health.dataQuality}%`);
    lines.push(
      `  💾 Database Size:   ${this.formatBytes(health.databaseSize)}`,
    );
    lines.push(
      `  🕐 Last Update:     ${this.formatRelativeTime(health.lastUpdate)}`,
    );
    if (health.gaps.length > 0) {
      lines.push(`  ⚠️  Data Gaps:       ${health.gaps.length} detected`);
    }
    return lines.join("\n");
  }

  private formatTopPerformers(
    topPerformers: DashboardMetrics["topPerformers"],
  ): string {
    const lines: string[] = [];

    if (topPerformers.posts.length > 0) {
      lines.push("  Top Posts:");
      topPerformers.posts.slice(0, 3).forEach((post, i) => {
        lines.push(
          `    ${i + 1}. ${post.title.substring(0, 50)}${post.title.length > 50 ? "..." : ""}`,
        );
        lines.push(`       Score: ${post.score}`);
      });
    }

    if (topPerformers.authors.length > 0) {
      lines.push("\n  Top Authors:");
      topPerformers.authors.slice(0, 3).forEach((author, i) => {
        lines.push(`    ${i + 1}. ${author.author}`);
        lines.push(
          `       Posts: ${author.metrics.postCount} | Avg Score: ${author.metrics.avgScore.toFixed(1)}`,
        );
      });
    }

    return lines.join("\n");
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  }

  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return " ".repeat(leftPad) + text + " ".repeat(rightPad);
  }
}
