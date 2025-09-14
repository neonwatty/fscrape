/**
 * Analytics CSV Exporter
 * Exports analytics data to CSV format with statistical columns and significance indicators
 */

import { createObjectCsvWriter } from "csv-writer";
import type {
  PlatformStats,
  TrendingPost,
  UserActivity,
  TimeSeriesData,
} from "../../database/analytics.js";
import { StatisticsEngine } from "../../analytics/statistics.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface AnalyticsCsvExportOptions {
  includeStatistics?: boolean;
  includeConfidenceIntervals?: boolean;
  includePercentiles?: boolean;
  includeZScores?: boolean;
  includeMovingAverages?: boolean;
  separateFiles?: boolean;
  delimiter?: string;
  headers?: boolean;
  confidenceLevel?: number;
  movingAverageWindow?: number;
  decimalPlaces?: number;
}

export class AnalyticsCsvExporter {
  private options: Required<AnalyticsCsvExportOptions>;

  constructor(options: AnalyticsCsvExportOptions = {}) {
    this.options = {
      includeStatistics: true,
      includeConfidenceIntervals: true,
      includePercentiles: true,
      includeZScores: true,
      includeMovingAverages: true,
      separateFiles: false,
      delimiter: ",",
      headers: true,
      confidenceLevel: 0.95,
      movingAverageWindow: 5,
      decimalPlaces: 4,
      ...options,
    };
  }

  /**
   * Export analytics data to CSV with statistical columns
   */
  async export(
    data: {
      platformStats?: PlatformStats[];
      trendingPosts?: TrendingPost[];
      userActivity?: UserActivity[];
      timeSeries?: TimeSeriesData[];
    },
    outputPath: string,
  ): Promise<string[]> {
    const exportedFiles: string[] = [];

    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const basePath = outputPath.replace(/\.csv$/, "");

    if (this.options.separateFiles) {
      // Export each data type to separate CSV files
      if (data.platformStats && data.platformStats.length > 0) {
        const platformPath = `${basePath}-platform-stats.csv`;
        await this.exportPlatformStats(data.platformStats, platformPath);
        exportedFiles.push(platformPath);
      }

      if (data.trendingPosts && data.trendingPosts.length > 0) {
        const trendingPath = `${basePath}-trending.csv`;
        await this.exportTrendingPosts(data.trendingPosts, trendingPath);
        exportedFiles.push(trendingPath);
      }

      if (data.userActivity && data.userActivity.length > 0) {
        const usersPath = `${basePath}-users.csv`;
        await this.exportUserActivity(data.userActivity, usersPath);
        exportedFiles.push(usersPath);
      }

      if (data.timeSeries && data.timeSeries.length > 0) {
        const timeSeriesPath = `${basePath}-timeseries.csv`;
        await this.exportTimeSeries(data.timeSeries, timeSeriesPath);
        exportedFiles.push(timeSeriesPath);
      }

      // Export summary statistics
      const summaryPath = `${basePath}-summary-stats.csv`;
      await this.exportSummaryStatistics(data, summaryPath);
      exportedFiles.push(summaryPath);
    } else {
      // Export all data to a single CSV (trending posts as primary)
      if (data.trendingPosts && data.trendingPosts.length > 0) {
        await this.exportTrendingPosts(data.trendingPosts, outputPath);
        exportedFiles.push(outputPath);
      } else if (data.userActivity && data.userActivity.length > 0) {
        await this.exportUserActivity(data.userActivity, outputPath);
        exportedFiles.push(outputPath);
      } else if (data.timeSeries && data.timeSeries.length > 0) {
        await this.exportTimeSeries(data.timeSeries, outputPath);
        exportedFiles.push(outputPath);
      } else if (data.platformStats && data.platformStats.length > 0) {
        await this.exportPlatformStats(data.platformStats, outputPath);
        exportedFiles.push(outputPath);
      }
    }

    return exportedFiles;
  }

  /**
   * Export platform statistics to CSV
   */
  private async exportPlatformStats(
    stats: PlatformStats[],
    outputPath: string,
  ): Promise<void> {
    const headers = [
      { id: "platform", title: "Platform" },
      { id: "totalPosts", title: "Total Posts" },
      { id: "totalComments", title: "Total Comments" },
      { id: "totalUsers", title: "Total Users" },
      { id: "avgScore", title: "Average Score" },
      { id: "avgPostScore", title: "Avg Post Score" },
      { id: "avgCommentScore", title: "Avg Comment Score" },
      { id: "avgCommentCount", title: "Avg Comment Count" },
    ];

    if (this.options.includeStatistics) {
      headers.push(
        { id: "scoreStdDev", title: "Score Std Dev" },
        { id: "scoreVariance", title: "Score Variance" },
        { id: "engagementRate", title: "Engagement Rate" },
      );
    }

    if (this.options.includeConfidenceIntervals) {
      headers.push(
        { id: "scoreCI_lower", title: `Score CI Lower (${this.options.confidenceLevel * 100}%)` },
        { id: "scoreCI_upper", title: `Score CI Upper (${this.options.confidenceLevel * 100}%)` },
      );
    }

    const records = stats.map(stat => {
      const record: any = {
        platform: stat.platform,
        totalPosts: stat.totalPosts,
        totalComments: stat.totalComments,
        totalUsers: stat.totalUsers,
        avgScore: this.formatNumber(stat.avgScore),
        avgPostScore: this.formatNumber(stat.avgPostScore),
        avgCommentScore: this.formatNumber(stat.avgCommentScore),
        avgCommentCount: this.formatNumber(stat.avgCommentCount),
      };

      if (this.options.includeStatistics) {
        const scores = [stat.avgPostScore, stat.avgCommentScore].filter(s => s != null);
        if (scores.length > 0) {
          const stdDev = StatisticsEngine.calculateStandardDeviation(scores);
          record.scoreStdDev = this.formatNumber(stdDev);
          record.scoreVariance = this.formatNumber(stdDev * stdDev);
          record.engagementRate = this.formatNumber(
            stat.avgCommentCount / stat.totalPosts * 100,
          );
        }
      }

      if (this.options.includeConfidenceIntervals) {
        const ci = this.calculateConfidenceInterval(
          [stat.avgPostScore, stat.avgCommentScore].filter(s => s != null),
        );
        record.scoreCI_lower = this.formatNumber(ci.lower);
        record.scoreCI_upper = this.formatNumber(ci.upper);
      }

      return record;
    });

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: headers,
    });

    await csvWriter.writeRecords(records);
  }

  /**
   * Export trending posts to CSV with statistical columns
   */
  private async exportTrendingPosts(
    posts: TrendingPost[],
    outputPath: string,
  ): Promise<void> {
    // Calculate statistics for the entire dataset
    const allScores = posts.map(p => p.score);
    const allComments = posts.map(p => p.commentCount);
    const scoreSummary = StatisticsEngine.getSummary(allScores);
    const commentSummary = StatisticsEngine.getSummary(allComments);

    const headers = [
      { id: "id", title: "ID" },
      { id: "title", title: "Title" },
      { id: "author", title: "Author" },
      { id: "platform", title: "Platform" },
      { id: "score", title: "Score" },
      { id: "commentCount", title: "Comments" },
      { id: "hotness", title: "Hotness" },
      { id: "createdAt", title: "Created At" },
    ];

    if (this.options.includePercentiles) {
      headers.push(
        { id: "scorePercentile", title: "Score Percentile" },
        { id: "commentPercentile", title: "Comment Percentile" },
      );
    }

    if (this.options.includeZScores) {
      headers.push(
        { id: "scoreZScore", title: "Score Z-Score" },
        { id: "commentZScore", title: "Comment Z-Score" },
        { id: "isOutlier", title: "Is Outlier" },
      );
    }

    if (this.options.includeStatistics) {
      headers.push(
        { id: "relativeScore", title: "Relative Score (%)" },
        { id: "engagementRatio", title: "Engagement Ratio" },
        { id: "significanceIndicator", title: "Significance" },
      );
    }

    const records = posts.map((post, index) => {
      const record: any = {
        id: post.id,
        title: post.title.substring(0, 100),
        author: post.author,
        platform: post.platform,
        score: post.score,
        commentCount: post.commentCount,
        hotness: this.formatNumber(post.hotness),
        createdAt: post.createdAt.toISOString(),
      };

      if (this.options.includePercentiles) {
        record.scorePercentile = this.formatNumber(
          this.calculatePercentile(post.score, allScores),
        );
        record.commentPercentile = this.formatNumber(
          this.calculatePercentile(post.commentCount, allComments),
        );
      }

      if (this.options.includeZScores) {
        const scoreZ = (post.score - scoreSummary.mean) / scoreSummary.standardDeviation;
        const commentZ = (post.commentCount - commentSummary.mean) / commentSummary.standardDeviation;

        record.scoreZScore = this.formatNumber(scoreZ);
        record.commentZScore = this.formatNumber(commentZ);
        record.isOutlier = Math.abs(scoreZ) > 2.5 || Math.abs(commentZ) > 2.5 ? "Yes" : "No";
      }

      if (this.options.includeStatistics) {
        record.relativeScore = this.formatNumber((post.score / scoreSummary.mean) * 100);
        record.engagementRatio = this.formatNumber(
          post.commentCount > 0 ? post.score / post.commentCount : 0,
        );

        // Significance indicator based on z-score
        const zScore = (post.score - scoreSummary.mean) / scoreSummary.standardDeviation;
        if (Math.abs(zScore) > 2.576) record.significanceIndicator = "***"; // p < 0.01
        else if (Math.abs(zScore) > 1.96) record.significanceIndicator = "**"; // p < 0.05
        else if (Math.abs(zScore) > 1.645) record.significanceIndicator = "*"; // p < 0.10
        else record.significanceIndicator = "";
      }

      return record;
    });

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: headers,
    });

    await csvWriter.writeRecords(records);
  }

  /**
   * Export user activity to CSV with statistical columns
   */
  private async exportUserActivity(
    users: UserActivity[],
    outputPath: string,
  ): Promise<void> {
    // Calculate statistics for the dataset
    const allKarma = users.map(u => u.totalKarma);
    const allPostScores = users.map(u => u.avgPostScore);
    const karmaSummary = StatisticsEngine.getSummary(allKarma);

    const headers = [
      { id: "username", title: "Username" },
      { id: "platform", title: "Platform" },
      { id: "postCount", title: "Posts" },
      { id: "commentCount", title: "Comments" },
      { id: "totalKarma", title: "Total Karma" },
      { id: "avgPostScore", title: "Avg Post Score" },
      { id: "avgCommentScore", title: "Avg Comment Score" },
      { id: "firstSeen", title: "First Seen" },
      { id: "lastSeen", title: "Last Seen" },
    ];

    if (this.options.includeStatistics) {
      headers.push(
        { id: "activityScore", title: "Activity Score" },
        { id: "engagementRate", title: "Engagement Rate" },
        { id: "daysActive", title: "Days Active" },
        { id: "postsPerDay", title: "Posts/Day" },
      );
    }

    if (this.options.includePercentiles) {
      headers.push(
        { id: "karmaPercentile", title: "Karma Percentile" },
        { id: "activityPercentile", title: "Activity Percentile" },
      );
    }

    if (this.options.includeZScores) {
      headers.push(
        { id: "karmaZScore", title: "Karma Z-Score" },
        { id: "isTopUser", title: "Top User" },
      );
    }

    const records = users.map(user => {
      const record: any = {
        username: user.username,
        platform: user.platform,
        postCount: user.postCount,
        commentCount: user.commentCount,
        totalKarma: user.totalKarma,
        avgPostScore: this.formatNumber(user.avgPostScore),
        avgCommentScore: this.formatNumber(user.avgCommentScore),
        firstSeen: user.firstSeen.toISOString(),
        lastSeen: user.lastSeen.toISOString(),
      };

      if (this.options.includeStatistics) {
        const daysActive = Math.ceil(
          (user.lastSeen.getTime() - user.firstSeen.getTime()) / (1000 * 60 * 60 * 24),
        );
        record.activityScore = this.formatNumber(
          (user.postCount + user.commentCount) / Math.max(1, daysActive),
        );
        record.engagementRate = this.formatNumber(
          (user.avgPostScore + user.avgCommentScore) / 2,
        );
        record.daysActive = daysActive;
        record.postsPerDay = this.formatNumber(user.postCount / Math.max(1, daysActive));
      }

      if (this.options.includePercentiles) {
        record.karmaPercentile = this.formatNumber(
          this.calculatePercentile(user.totalKarma, allKarma),
        );
        const activityScore = user.postCount + user.commentCount;
        const allActivity = users.map(u => u.postCount + u.commentCount);
        record.activityPercentile = this.formatNumber(
          this.calculatePercentile(activityScore, allActivity),
        );
      }

      if (this.options.includeZScores) {
        const karmaZ = (user.totalKarma - karmaSummary.mean) / karmaSummary.standardDeviation;
        record.karmaZScore = this.formatNumber(karmaZ);
        record.isTopUser = karmaZ > 2 ? "Yes" : "No";
      }

      return record;
    });

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: headers,
    });

    await csvWriter.writeRecords(records);
  }

  /**
   * Export time series data to CSV with moving averages
   */
  private async exportTimeSeries(
    timeSeries: TimeSeriesData[],
    outputPath: string,
  ): Promise<void> {
    const headers = [
      { id: "timestamp", title: "Timestamp" },
      { id: "posts", title: "Posts" },
      { id: "comments", title: "Comments" },
      { id: "users", title: "Users" },
      { id: "avgScore", title: "Avg Score" },
    ];

    if (this.options.includeMovingAverages) {
      headers.push(
        { id: "postsMA", title: `Posts MA(${this.options.movingAverageWindow})` },
        { id: "commentsMA", title: `Comments MA(${this.options.movingAverageWindow})` },
        { id: "scoreMA", title: `Score MA(${this.options.movingAverageWindow})` },
      );
    }

    if (this.options.includeStatistics) {
      headers.push(
        { id: "dayOfWeek", title: "Day of Week" },
        { id: "hourOfDay", title: "Hour" },
        { id: "isWeekend", title: "Weekend" },
        { id: "volatility", title: "Volatility" },
        { id: "trend", title: "Trend" },
      );
    }

    const postValues = timeSeries.map(ts => ts.posts);
    const commentValues = timeSeries.map(ts => ts.comments);
    const scoreValues = timeSeries.map(ts => ts.avgScore);

    const records = timeSeries.map((point, index) => {
      const record: any = {
        timestamp: point.timestamp.toISOString(),
        posts: point.posts,
        comments: point.comments,
        users: point.users,
        avgScore: this.formatNumber(point.avgScore),
      };

      if (this.options.includeMovingAverages) {
        record.postsMA = this.formatNumber(
          this.calculateMovingAverage(postValues, index, this.options.movingAverageWindow),
        );
        record.commentsMA = this.formatNumber(
          this.calculateMovingAverage(commentValues, index, this.options.movingAverageWindow),
        );
        record.scoreMA = this.formatNumber(
          this.calculateMovingAverage(scoreValues, index, this.options.movingAverageWindow),
        );
      }

      if (this.options.includeStatistics) {
        const date = new Date(point.timestamp);
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        record.dayOfWeek = dayNames[date.getDay()];
        record.hourOfDay = date.getHours();
        record.isWeekend = date.getDay() === 0 || date.getDay() === 6 ? "Yes" : "No";

        // Calculate volatility
        if (index > 0) {
          const previousScore = scoreValues[index - 1];
          record.volatility = this.formatNumber(
            Math.abs(point.avgScore - previousScore) / previousScore,
          );
        } else {
          record.volatility = 0;
        }

        // Calculate trend
        if (index >= 2) {
          const recent = scoreValues.slice(Math.max(0, index - 2), index + 1);
          const slope = this.calculateSimpleSlope(recent);
          record.trend = slope > 0.01 ? "Up" : slope < -0.01 ? "Down" : "Stable";
        } else {
          record.trend = "N/A";
        }
      }

      return record;
    });

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: headers,
    });

    await csvWriter.writeRecords(records);
  }

  /**
   * Export summary statistics to CSV
   */
  private async exportSummaryStatistics(
    data: any,
    outputPath: string,
  ): Promise<void> {
    const summaryRows: any[] = [];

    // Platform stats summary
    if (data.platformStats && data.platformStats.length > 0) {
      const stats = data.platformStats[0];
      summaryRows.push({
        metric: "Platform Overview",
        value: "",
        mean: "",
        median: "",
        stdDev: "",
        min: "",
        max: "",
        confidence_lower: "",
        confidence_upper: "",
      });

      summaryRows.push({
        metric: "Total Posts",
        value: stats.totalPosts,
        mean: "",
        median: "",
        stdDev: "",
        min: "",
        max: "",
        confidence_lower: "",
        confidence_upper: "",
      });

      summaryRows.push({
        metric: "Total Comments",
        value: stats.totalComments,
        mean: "",
        median: "",
        stdDev: "",
        min: "",
        max: "",
        confidence_lower: "",
        confidence_upper: "",
      });
    }

    // Trending posts summary
    if (data.trendingPosts && data.trendingPosts.length > 0) {
      const scores = data.trendingPosts.map((p: TrendingPost) => p.score);
      const summary = StatisticsEngine.getSummary(scores);
      const ci = this.calculateConfidenceInterval(scores);

      summaryRows.push({
        metric: "Post Scores",
        value: scores.length,
        mean: this.formatNumber(summary.mean),
        median: this.formatNumber(summary.median),
        stdDev: this.formatNumber(summary.standardDeviation),
        min: this.formatNumber(summary.min),
        max: this.formatNumber(summary.max),
        confidence_lower: this.formatNumber(ci.lower),
        confidence_upper: this.formatNumber(ci.upper),
      });

      const comments = data.trendingPosts.map((p: TrendingPost) => p.commentCount);
      const commentSummary = StatisticsEngine.getSummary(comments);
      const commentCi = this.calculateConfidenceInterval(comments);

      summaryRows.push({
        metric: "Comment Counts",
        value: comments.length,
        mean: this.formatNumber(commentSummary.mean),
        median: this.formatNumber(commentSummary.median),
        stdDev: this.formatNumber(commentSummary.standardDeviation),
        min: this.formatNumber(commentSummary.min),
        max: this.formatNumber(commentSummary.max),
        confidence_lower: this.formatNumber(commentCi.lower),
        confidence_upper: this.formatNumber(commentCi.upper),
      });

      // Correlation
      const correlation = StatisticsEngine.calculateCorrelation(scores, comments);
      summaryRows.push({
        metric: "Score-Comment Correlation",
        value: this.formatNumber(correlation),
        mean: "",
        median: "",
        stdDev: "",
        min: "",
        max: "",
        confidence_lower: "",
        confidence_upper: "",
      });
    }

    // User activity summary
    if (data.userActivity && data.userActivity.length > 0) {
      const karma = data.userActivity.map((u: UserActivity) => u.totalKarma);
      const summary = StatisticsEngine.getSummary(karma);
      const ci = this.calculateConfidenceInterval(karma);

      summaryRows.push({
        metric: "User Karma",
        value: karma.length,
        mean: this.formatNumber(summary.mean),
        median: this.formatNumber(summary.median),
        stdDev: this.formatNumber(summary.standardDeviation),
        min: this.formatNumber(summary.min),
        max: this.formatNumber(summary.max),
        confidence_lower: this.formatNumber(ci.lower),
        confidence_upper: this.formatNumber(ci.upper),
      });
    }

    const headers = [
      { id: "metric", title: "Metric" },
      { id: "value", title: "Count/Value" },
      { id: "mean", title: "Mean" },
      { id: "median", title: "Median" },
      { id: "stdDev", title: "Std Dev" },
      { id: "min", title: "Min" },
      { id: "max", title: "Max" },
      { id: "confidence_lower", title: `CI Lower (${this.options.confidenceLevel * 100}%)` },
      { id: "confidence_upper", title: `CI Upper (${this.options.confidenceLevel * 100}%)` },
    ];

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: headers,
    });

    await csvWriter.writeRecords(summaryRows);
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(
    values: number[],
  ): { lower: number; upper: number } {
    if (values.length === 0) return { lower: 0, upper: 0 };

    const mean = StatisticsEngine.calculateMean(values);
    const stdDev = StatisticsEngine.calculateStandardDeviation(values);
    const n = values.length;

    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    const z = zScores[this.options.confidenceLevel] || 1.96;
    const marginOfError = z * (stdDev / Math.sqrt(n));

    return {
      lower: mean - marginOfError,
      upper: mean + marginOfError,
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(value: number, dataset: number[]): number {
    const sorted = [...dataset].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(
    values: number[],
    index: number,
    window: number,
  ): number {
    const start = Math.max(0, index - Math.floor(window / 2));
    const end = Math.min(values.length, start + window);
    const windowValues = values.slice(start, end);

    return StatisticsEngine.calculateMean(windowValues);
  }

  /**
   * Calculate simple slope for trend
   */
  private calculateSimpleSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  /**
   * Format number to specified decimal places
   */
  private formatNumber(value: number): string {
    if (value == null || isNaN(value)) return "";
    return value.toFixed(this.options.decimalPlaces);
  }
}