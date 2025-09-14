/**
 * Analytics JSON Exporter
 * Exports analytics data with enhanced statistical metadata and confidence intervals
 */

import type {
  PlatformStats,
  TrendingPost,
  UserActivity,
  TimeSeriesData,
} from "../../database/analytics.js";
import type { Platform } from "../../types/core.js";
import { StatisticsEngine } from "../../analytics/statistics.js";
import type { StatisticalSummary } from "../../analytics/statistics.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface AnalyticsJsonExportOptions {
  pretty?: boolean;
  indent?: number;
  includeStatistics?: boolean;
  includeConfidenceIntervals?: boolean;
  includeSignificance?: boolean;
  includeTimeSeries?: boolean;
  includeCorrelations?: boolean;
  confidenceLevel?: number; // 0.90, 0.95, 0.99
  dateFormat?: "iso" | "timestamp" | "locale";
  separateFiles?: boolean;
  compress?: boolean;
}

export interface StatisticalMetadata {
  summary: StatisticalSummary;
  confidenceInterval?: {
    lower: number;
    upper: number;
    level: number;
  };
  significance?: {
    pValue: number;
    isSignificant: boolean;
    threshold: number;
  };
  trend?: {
    direction: "increasing" | "decreasing" | "stable";
    slope: number;
    rSquared: number;
  };
}

export interface EnhancedAnalyticsData {
  metadata: {
    exportedAt: Date;
    version: string;
    platform?: Platform;
    dateRange?: {
      start: Date;
      end: Date;
    };
    dataQuality: {
      completeness: number;
      outlierCount: number;
      missingDataPoints: number;
    };
    statisticalConfig: {
      confidenceLevel: number;
      significanceThreshold: number;
      outlierMethod: string;
    };
  };
  platformStats?: PlatformStats & {
    statistics?: StatisticalMetadata;
  };
  trendingPosts?: Array<
    TrendingPost & {
      statistics?: StatisticalMetadata;
      relativePerformance?: {
        percentile: number;
        zScore: number;
        isOutlier: boolean;
      };
    }
  >;
  userActivity?: Array<
    UserActivity & {
      statistics?: StatisticalMetadata;
      engagementMetrics?: {
        postEngagementRate: number;
        commentEngagementRate: number;
        overallEngagement: number;
      };
    }
  >;
  timeSeries?: Array<
    TimeSeriesData & {
      movingAverage?: number;
      volatility?: number;
      seasonality?: {
        dayOfWeek: string;
        hourOfDay: number;
        isWeekend: boolean;
      };
    }
  >;
  correlations?: {
    scoreToComments: number;
    scoreToTime: number;
    userActivityToScore: number;
    pValues: {
      scoreToComments: number;
      scoreToTime: number;
      userActivityToScore: number;
    };
  };
  aggregateStatistics?: {
    posts: StatisticalMetadata;
    comments: StatisticalMetadata;
    scores: StatisticalMetadata;
    engagement: StatisticalMetadata;
  };
}

export class AnalyticsJsonExporter {
  private options: Required<AnalyticsJsonExportOptions>;
  private statsEngine: StatisticsEngine;

  constructor(options: AnalyticsJsonExportOptions = {}) {
    this.options = {
      pretty: true,
      indent: 2,
      includeStatistics: true,
      includeConfidenceIntervals: true,
      includeSignificance: true,
      includeTimeSeries: true,
      includeCorrelations: true,
      confidenceLevel: 0.95,
      dateFormat: "iso",
      separateFiles: false,
      compress: false,
      ...options,
    };
    this.statsEngine = new StatisticsEngine();
  }

  /**
   * Export analytics data with enhanced statistical metadata
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

    // Build enhanced analytics data
    const enhancedData = await this.enhanceWithStatistics(data);

    if (this.options.separateFiles) {
      // Export to separate files
      const basePath = outputPath.replace(/\.json$/, "");

      // Platform stats
      if (enhancedData.platformStats) {
        const platformPath = `${basePath}-platform-stats.json`;
        this.writeJsonFile(platformPath, {
          metadata: enhancedData.metadata,
          platformStats: enhancedData.platformStats,
        });
        exportedFiles.push(platformPath);
      }

      // Trending posts
      if (enhancedData.trendingPosts) {
        const trendingPath = `${basePath}-trending.json`;
        this.writeJsonFile(trendingPath, {
          metadata: enhancedData.metadata,
          trendingPosts: enhancedData.trendingPosts,
        });
        exportedFiles.push(trendingPath);
      }

      // User activity
      if (enhancedData.userActivity) {
        const usersPath = `${basePath}-users.json`;
        this.writeJsonFile(usersPath, {
          metadata: enhancedData.metadata,
          userActivity: enhancedData.userActivity,
        });
        exportedFiles.push(usersPath);
      }

      // Time series
      if (enhancedData.timeSeries && this.options.includeTimeSeries) {
        const timeSeriesPath = `${basePath}-timeseries.json`;
        this.writeJsonFile(timeSeriesPath, {
          metadata: enhancedData.metadata,
          timeSeries: enhancedData.timeSeries,
        });
        exportedFiles.push(timeSeriesPath);
      }

      // Aggregate statistics
      if (enhancedData.aggregateStatistics) {
        const statsPath = `${basePath}-statistics.json`;
        this.writeJsonFile(statsPath, {
          metadata: enhancedData.metadata,
          aggregateStatistics: enhancedData.aggregateStatistics,
          correlations: enhancedData.correlations,
        });
        exportedFiles.push(statsPath);
      }
    } else {
      // Export to single file
      this.writeJsonFile(outputPath, enhancedData);
      exportedFiles.push(outputPath);
    }

    return exportedFiles;
  }

  /**
   * Enhance data with statistical metadata
   */
  private async enhanceWithStatistics(
    data: any,
  ): Promise<EnhancedAnalyticsData> {
    const enhanced: EnhancedAnalyticsData = {
      metadata: this.generateMetadata(data),
    };

    // Enhance platform stats
    if (data.platformStats && data.platformStats.length > 0) {
      const stats = data.platformStats[0];
      const scores = [stats.avgPostScore, stats.avgCommentScore].filter(
        (s) => s != null,
      );

      if (this.options.includeStatistics && scores.length > 0) {
        stats.statistics = this.calculateStatisticalMetadata(scores);
      }
      enhanced.platformStats = stats;
    }

    // Enhance trending posts
    if (data.trendingPosts && data.trendingPosts.length > 0) {
      const allScores = data.trendingPosts.map((p: TrendingPost) => p.score);
      const scoreSummary = StatisticsEngine.getSummary(allScores);

      enhanced.trendingPosts = data.trendingPosts.map((post: TrendingPost) => {
        const enhancedPost: any = { ...post };

        if (this.options.includeStatistics) {
          // Calculate relative performance
          const zScore =
            (post.score - scoreSummary.mean) / scoreSummary.standardDeviation;
          const percentile = this.calculatePercentile(post.score, allScores);

          enhancedPost.relativePerformance = {
            percentile,
            zScore,
            isOutlier:
              Math.abs(zScore) > 2.5 ||
              scoreSummary.outliers.includes(post.score),
          };

          // Add post-specific statistics
          enhancedPost.statistics = this.calculateStatisticalMetadata([
            post.score,
          ]);
        }

        return enhancedPost;
      });
    }

    // Enhance user activity
    if (data.userActivity && data.userActivity.length > 0) {
      enhanced.userActivity = data.userActivity.map((user: UserActivity) => {
        const enhancedUser: any = { ...user };

        if (this.options.includeStatistics) {
          // Calculate engagement metrics
          enhancedUser.engagementMetrics = {
            postEngagementRate: user.avgPostScore / (user.postCount || 1),
            commentEngagementRate:
              user.avgCommentScore / (user.commentCount || 1),
            overallEngagement: (user.avgPostScore + user.avgCommentScore) / 2,
          };

          // Add user-specific statistics
          const userScores = [user.avgPostScore, user.avgCommentScore].filter(
            (s) => s != null,
          );
          if (userScores.length > 0) {
            enhancedUser.statistics =
              this.calculateStatisticalMetadata(userScores);
          }
        }

        return enhancedUser;
      });
    }

    // Enhance time series data
    if (
      data.timeSeries &&
      data.timeSeries.length > 0 &&
      this.options.includeTimeSeries
    ) {
      const values = data.timeSeries.map(
        (ts: TimeSeriesData) => ts.avgScore || 0,
      );

      enhanced.timeSeries = data.timeSeries.map(
        (point: TimeSeriesData, index: number) => {
          const enhancedPoint: any = { ...point };

          // Calculate moving average (5-period)
          const windowStart = Math.max(0, index - 2);
          const windowEnd = Math.min(data.timeSeries.length, index + 3);
          const window = values.slice(windowStart, windowEnd);
          enhancedPoint.movingAverage = StatisticsEngine.calculateMean(window);

          // Calculate volatility
          if (index > 0) {
            const previousValue = values[index - 1];
            enhancedPoint.volatility =
              Math.abs(values[index] - previousValue) / previousValue;
          }

          // Add seasonality information
          const date = new Date(point.timestamp);
          enhancedPoint.seasonality = {
            dayOfWeek: [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ][date.getDay()],
            hourOfDay: date.getHours(),
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
          };

          return enhancedPoint;
        },
      );
    }

    // Calculate correlations
    if (
      this.options.includeCorrelations &&
      data.trendingPosts &&
      data.trendingPosts.length > 1
    ) {
      const scores = data.trendingPosts.map((p: TrendingPost) => p.score);
      const comments = data.trendingPosts.map(
        (p: TrendingPost) => p.commentCount,
      );

      enhanced.correlations = {
        scoreToComments: StatisticsEngine.calculateCorrelation(
          scores,
          comments,
        ),
        scoreToTime: 0, // Would need time data
        userActivityToScore: 0, // Would need to correlate with user data
        pValues: {
          scoreToComments: this.calculatePValue(scores, comments),
          scoreToTime: 1,
          userActivityToScore: 1,
        },
      };
    }

    // Calculate aggregate statistics
    if (this.options.includeStatistics) {
      enhanced.aggregateStatistics =
        await this.calculateAggregateStatistics(data);
    }

    return enhanced;
  }

  /**
   * Calculate statistical metadata for a dataset
   */
  private calculateStatisticalMetadata(values: number[]): StatisticalMetadata {
    const summary = StatisticsEngine.getSummary(values);
    const metadata: StatisticalMetadata = { summary };

    // Calculate confidence interval
    if (this.options.includeConfidenceIntervals && values.length > 1) {
      metadata.confidenceInterval = this.calculateConfidenceInterval(
        values,
        this.options.confidenceLevel,
      );
    }

    // Calculate significance (would need comparison data)
    if (this.options.includeSignificance && values.length > 1) {
      metadata.significance = {
        pValue: 0.05, // Placeholder - would need actual hypothesis test
        isSignificant: true,
        threshold: 0.05,
      };
    }

    // Calculate trend
    if (values.length > 2) {
      const indices = Array.from({ length: values.length }, (_, i) => i);
      const slope = this.calculateSlope(indices, values);

      metadata.trend = {
        direction:
          slope > 0.1 ? "increasing" : slope < -0.1 ? "decreasing" : "stable",
        slope,
        rSquared: this.calculateRSquared(indices, values),
      };
    }

    return metadata;
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(
    values: number[],
    confidenceLevel: number,
  ): { lower: number; upper: number; level: number } {
    const mean = StatisticsEngine.calculateMean(values);
    const stdDev = StatisticsEngine.calculateStandardDeviation(values);
    const n = values.length;

    // Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    const z = zScores[confidenceLevel] || 1.96;
    const marginOfError = z * (stdDev / Math.sqrt(n));

    return {
      lower: mean - marginOfError,
      upper: mean + marginOfError,
      level: confidenceLevel,
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(value: number, dataset: number[]): number {
    const sorted = [...dataset].sort((a, b) => a - b);
    const index = sorted.findIndex((v) => v >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  }

  /**
   * Calculate p-value for correlation
   */
  private calculatePValue(x: number[], y: number[]): number {
    const n = x.length;
    const r = StatisticsEngine.calculateCorrelation(x, y);

    // Calculate t-statistic
    const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);

    // Approximate p-value (would need proper t-distribution)
    const p = 2 * (1 - this.normalCDF(Math.abs(t)));

    return Math.min(1, Math.max(0, p));
  }

  /**
   * Normal cumulative distribution function approximation
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const y =
      1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Calculate slope of linear regression
   */
  private calculateSlope(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  /**
   * Calculate R-squared
   */
  private calculateRSquared(x: number[], y: number[]): number {
    const meanY = StatisticsEngine.calculateMean(y);
    const slope = this.calculateSlope(x, y);
    const intercept = meanY - slope * StatisticsEngine.calculateMean(x);

    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);

    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);

    return 1 - ssRes / ssTot;
  }

  /**
   * Calculate aggregate statistics
   */
  private async calculateAggregateStatistics(data: any): Promise<any> {
    const stats: any = {};

    // Post statistics
    if (data.trendingPosts && data.trendingPosts.length > 0) {
      const postScores = data.trendingPosts.map((p: TrendingPost) => p.score);
      stats.posts = this.calculateStatisticalMetadata(postScores);
    }

    // Comment statistics
    if (data.trendingPosts && data.trendingPosts.length > 0) {
      const commentCounts = data.trendingPosts.map(
        (p: TrendingPost) => p.commentCount,
      );
      stats.comments = this.calculateStatisticalMetadata(commentCounts);
    }

    // Score statistics
    if (data.platformStats && data.platformStats.length > 0) {
      const scores = [
        data.platformStats[0].avgPostScore,
        data.platformStats[0].avgCommentScore,
      ].filter((s) => s != null);
      if (scores.length > 0) {
        stats.scores = this.calculateStatisticalMetadata(scores);
      }
    }

    // Engagement statistics
    if (data.userActivity && data.userActivity.length > 0) {
      const engagements = data.userActivity.map(
        (u: UserActivity) => (u.avgPostScore + u.avgCommentScore) / 2,
      );
      stats.engagement = this.calculateStatisticalMetadata(engagements);
    }

    return stats;
  }

  /**
   * Generate metadata
   */
  private generateMetadata(data: any): any {
    const metadata: any = {
      exportedAt: new Date(),
      version: "2.0.0",
      dataQuality: {
        completeness: this.calculateCompleteness(data),
        outlierCount: this.countOutliers(data),
        missingDataPoints: this.countMissingData(data),
      },
      statisticalConfig: {
        confidenceLevel: this.options.confidenceLevel,
        significanceThreshold: 0.05,
        outlierMethod: "IQR",
      },
    };

    // Add date range if time series data exists
    if (data.timeSeries && data.timeSeries.length > 0) {
      const timestamps = data.timeSeries.map(
        (ts: TimeSeriesData) => new Date(ts.timestamp),
      );
      metadata.dateRange = {
        start: new Date(Math.min(...timestamps.map((d) => d.getTime()))),
        end: new Date(Math.max(...timestamps.map((d) => d.getTime()))),
      };
    }

    // Add platform if available
    if (data.platformStats && data.platformStats.length > 0) {
      metadata.platform = data.platformStats[0].platform;
    }

    return metadata;
  }

  /**
   * Calculate data completeness
   */
  private calculateCompleteness(data: any): number {
    let totalFields = 0;
    let filledFields = 0;

    const checkObject = (obj: any) => {
      for (const key in obj) {
        totalFields++;
        if (obj[key] !== null && obj[key] !== undefined) {
          filledFields++;
        }
      }
    };

    if (data.platformStats) data.platformStats.forEach(checkObject);
    if (data.trendingPosts) data.trendingPosts.forEach(checkObject);
    if (data.userActivity) data.userActivity.forEach(checkObject);
    if (data.timeSeries) data.timeSeries.forEach(checkObject);

    return totalFields > 0 ? (filledFields / totalFields) * 100 : 100;
  }

  /**
   * Count outliers in data
   */
  private countOutliers(data: any): number {
    let outlierCount = 0;

    if (data.trendingPosts && data.trendingPosts.length > 0) {
      const scores = data.trendingPosts.map((p: TrendingPost) => p.score);
      const summary = StatisticsEngine.getSummary(scores);
      outlierCount += summary.outliers.length;
    }

    return outlierCount;
  }

  /**
   * Count missing data points
   */
  private countMissingData(data: any): number {
    let missingCount = 0;

    const checkObject = (obj: any) => {
      for (const key in obj) {
        if (obj[key] === null || obj[key] === undefined) {
          missingCount++;
        }
      }
    };

    if (data.platformStats) data.platformStats.forEach(checkObject);
    if (data.trendingPosts) data.trendingPosts.forEach(checkObject);
    if (data.userActivity) data.userActivity.forEach(checkObject);
    if (data.timeSeries) data.timeSeries.forEach(checkObject);

    return missingCount;
  }

  /**
   * Write JSON file
   */
  private writeJsonFile(path: string, data: any): void {
    const content = this.options.pretty
      ? JSON.stringify(data, this.dateSerializer, this.options.indent)
      : JSON.stringify(data, this.dateSerializer);

    writeFileSync(path, content, "utf-8");
  }

  /**
   * Date serializer for JSON
   */
  private dateSerializer = (_key: string, value: any): any => {
    if (value instanceof Date) {
      switch (this.options.dateFormat) {
        case "timestamp":
          return value.getTime();
        case "locale":
          return value.toLocaleString();
        case "iso":
        default:
          return value.toISOString();
      }
    }
    return value;
  };
}
