/**
 * End-to-End Trend Analysis Workflow Tests
 * Tests complete trend analysis workflows from data ingestion to insights generation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Database } from "../../src/database/database.js";
import { DatabaseManager } from "../../src/database/database.js";
import { TrendAnalyzer } from "../../src/analytics/trend-analyzer.js";
import { StatisticsEngine } from "../../src/analytics/statistics.js";
import { CachedAnalyticsService } from "../../src/analytics/cached-analytics.js";
import type { Post } from "../../src/types/core.js";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { execSync } from "child_process";

describe("E2E Trend Analysis Workflows", () => {
  let tempDir: string;
  let dbPath: string;
  let dbManager: DatabaseManager;
  let trendAnalyzer: TrendAnalyzer;
  let statsEngine: StatisticsEngine;
  let cachedAnalytics: CachedAnalyticsService;

  beforeAll(async () => {
    // Setup test environment
    tempDir = await mkdtemp(join(tmpdir(), "fscrape-trend-e2e-"));
    dbPath = join(tempDir, "trend-test.db");
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Data Ingestion to Trend Detection Workflow", () => {
    beforeEach(async () => {
      // Fresh database for each test
      dbManager = new DatabaseManager({
        type: "sqlite",
        path: dbPath,
        connectionPoolSize: 5,
      });
      await dbManager.initialize();

      trendAnalyzer = new TrendAnalyzer();
      statsEngine = new StatisticsEngine();
      cachedAnalytics = new CachedAnalyticsService();
    });

    it("should detect increasing trends in engagement metrics", async () => {
      // Step 1: Ingest progressive engagement data
      const posts = generateProgressiveEngagementData(30);
      const dbInstance = dbManager.getConnection();

      for (const post of posts) {
        await dbInstance.insertPost(post);
      }

      // Step 2: Fetch time series data
      const analytics = dbManager.getAnalytics();
      const timeSeriesData = analytics.getEngagementOverTime(30);

      expect(timeSeriesData).toHaveLength(30);

      // Step 3: Analyze trend
      const timeSeries = timeSeriesData.map((d: any) => ({
        timestamp: new Date(d.date),
        value: d.engagement || 0,
      }));

      const trendResult = trendAnalyzer.analyzeTrend(
        timeSeries.map(ts => ts.value),
        timeSeries.map(ts => ts.timestamp)
      );

      expect(trendResult.slope).toBeGreaterThan(0);
      expect(trendResult.trend).toBe("increasing");
      expect(trendResult.confidence).toBeGreaterThan(0.7);

      // Step 4: Validate statistical significance
      const stats = statsEngine.calculate(timeSeries.map(ts => ts.value));
      expect(stats.trend).toBeDefined();
      expect(stats.standardDeviation).toBeGreaterThan(0);
    });

    it("should detect seasonal patterns in posting activity", async () => {
      // Step 1: Generate seasonal data (weekly pattern)
      const posts = generateSeasonalData(56); // 8 weeks of data
      const dbInstance = dbManager.getConnection();

      for (const post of posts) {
        await dbInstance.insertPost(post);
      }

      // Step 2: Analyze for seasonal decomposition
      const analytics = dbManager.getAnalytics();
      const timeSeriesData = analytics.getEngagementOverTime(56);

      const timeSeries = timeSeriesData.map((d: any) => ({
        timestamp: new Date(d.date),
        value: d.posts || 0,
      }));

      const seasonalResult = trendAnalyzer.seasonalDecomposition(timeSeries, 7);

      expect(seasonalResult.seasonal).toBeDefined();
      expect(seasonalResult.trend).toBeDefined();
      expect(seasonalResult.residual).toBeDefined();
      expect(seasonalResult.period).toBe(7);

      // Verify weekly pattern detection
      const seasonalComponent = seasonalResult.seasonal;
      expect(seasonalComponent.length).toBeGreaterThan(0);

      // Peak days should show higher values
      const peakDays = [1, 5]; // Monday and Friday
      peakDays.forEach(day => {
        const dayValues = seasonalComponent.filter((_: any, i: number) => i % 7 === day);
        const avgPeak = dayValues.reduce((a: number, b: number) => a + b, 0) / dayValues.length;
        expect(avgPeak).toBeGreaterThan(0);
      });
    });

    it("should identify trend breakpoints and changepoints", async () => {
      // Step 1: Generate data with clear breakpoint
      const posts = generateDataWithBreakpoint(60);
      const dbInstance = dbManager.getConnection();

      for (const post of posts) {
        await dbInstance.insertPost(post);
      }

      // Step 2: Detect breakpoints
      const analytics = dbManager.getAnalytics();
      const timeSeriesData = analytics.getEngagementOverTime(60);

      const values = timeSeriesData.map((d: any) => d.engagement || 0);
      const breakpoints = trendAnalyzer.detectBreakpoints(values);

      expect(breakpoints).toHaveLength(1);
      expect(breakpoints[0]).toBeCloseTo(30, 5); // Breakpoint around day 30

      // Step 3: Analyze trends before and after breakpoint
      const beforeBreak = values.slice(0, breakpoints[0]);
      const afterBreak = values.slice(breakpoints[0]);

      const trendBefore = trendAnalyzer.analyzeTrend(beforeBreak);
      const trendAfter = trendAnalyzer.analyzeTrend(afterBreak);

      expect(trendBefore.trend).toBe("stable");
      expect(trendAfter.trend).toBe("increasing");
    });

    it("should perform comparative trend analysis across platforms", async () => {
      // Step 1: Generate multi-platform data
      const redditPosts = generatePlatformData("reddit", 30, "increasing");
      const hnPosts = generatePlatformData("hackernews", 30, "decreasing");

      const dbInstance = dbManager.getConnection();

      for (const post of [...redditPosts, ...hnPosts]) {
        await dbInstance.insertPost(post);
      }

      // Step 2: Analyze trends per platform
      const analytics = dbManager.getAnalytics();

      const redditData = analytics.getEngagementOverTime(30, "reddit");
      const hnData = analytics.getEngagementOverTime(30, "hackernews");

      const redditTrend = trendAnalyzer.analyzeTrend(
        redditData.map((d: any) => d.engagement || 0)
      );
      const hnTrend = trendAnalyzer.analyzeTrend(
        hnData.map((d: any) => d.engagement || 0)
      );

      expect(redditTrend.trend).toBe("increasing");
      expect(hnTrend.trend).toBe("decreasing");

      // Step 3: Cross-correlation analysis
      const correlation = calculateCorrelation(
        redditData.map((d: any) => d.engagement || 0),
        hnData.map((d: any) => d.engagement || 0)
      );

      expect(correlation).toBeLessThan(0); // Negative correlation
    });

    it("should cache and retrieve trend analysis results efficiently", async () => {
      // Step 1: Generate and insert data
      const posts = generateProgressiveEngagementData(30);
      const dbInstance = dbManager.getConnection();

      for (const post of posts) {
        await dbInstance.insertPost(post);
      }

      // Step 2: First analysis (uncached)
      const analytics = dbManager.getAnalytics();
      const timeSeriesData = analytics.getEngagementOverTime(30);

      const startTime = Date.now();
      const trendResult = trendAnalyzer.analyzeTrend(
        timeSeriesData.map((d: any) => d.engagement || 0)
      );
      const firstRunTime = Date.now() - startTime;

      // Cache the result
      const cacheKey = "trend_analysis_30d";
      cachedAnalytics.set(cacheKey, trendResult);

      // Step 3: Second analysis (cached)
      const cachedStartTime = Date.now();
      const cachedResult = cachedAnalytics.get(cacheKey);
      const cachedRunTime = Date.now() - cachedStartTime;

      expect(cachedResult).toEqual(trendResult);
      expect(cachedRunTime).toBeLessThan(firstRunTime);

      // Step 4: Verify cache invalidation
      cachedAnalytics.invalidate(cacheKey);
      expect(cachedAnalytics.get(cacheKey)).toBeNull();
    });

    it("should handle real-time trend updates with streaming data", async () => {
      const dbInstance = dbManager.getConnection();
      const analytics = dbManager.getAnalytics();

      // Step 1: Initial batch of data
      const initialPosts = generateProgressiveEngagementData(20);
      for (const post of initialPosts) {
        await dbInstance.insertPost(post);
      }

      // Step 2: Initial trend analysis
      let timeSeriesData = analytics.getEngagementOverTime(20);
      let trendResult = trendAnalyzer.analyzeTrend(
        timeSeriesData.map((d: any) => d.engagement || 0)
      );

      const initialTrend = trendResult.trend;

      // Step 3: Stream new data points
      for (let i = 0; i < 10; i++) {
        const newPost = generateSinglePost(20 + i, 100 + i * 10);
        await dbInstance.insertPost(newPost);

        // Update analysis
        timeSeriesData = analytics.getEngagementOverTime(21 + i);
        trendResult = trendAnalyzer.analyzeTrend(
          timeSeriesData.map((d: any) => d.engagement || 0)
        );
      }

      // Step 4: Verify trend strengthened
      expect(trendResult.trend).toBe("increasing");
      expect(trendResult.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("Advanced Trend Analysis with Mann-Kendall Test", () => {
    beforeEach(async () => {
      dbManager = new DatabaseManager({
        type: "sqlite",
        path: dbPath,
        connectionPoolSize: 5,
      });
      await dbManager.initialize();
      trendAnalyzer = new TrendAnalyzer();
    });

    it("should perform Mann-Kendall test for monotonic trends", async () => {
      // Generate data with monotonic trend
      const posts = generateMonotonicData(50);
      const dbInstance = dbManager.getConnection();

      for (const post of posts) {
        await dbInstance.insertPost(post);
      }

      const analytics = dbManager.getAnalytics();
      const timeSeriesData = analytics.getEngagementOverTime(50);
      const values = timeSeriesData.map((d: any) => d.engagement || 0);

      const mkResult = trendAnalyzer.mannKendallTest(values);

      expect(mkResult.statistic).toBeDefined();
      expect(mkResult.pValue).toBeDefined();
      expect(mkResult.trend).toBe("increasing");
      expect(mkResult.pValue).toBeLessThan(0.05); // Statistically significant
    });
  });
});

// Helper functions
function generateProgressiveEngagementData(days: number): Post[] {
  const posts: Post[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // Progressive increase in engagement
    const baseEngagement = 50;
    const growth = i * 3;
    const noise = Math.random() * 10 - 5;

    posts.push({
      platform: "reddit",
      id: `post_${i}`,
      title: `Test Post ${i}`,
      content: `Content for day ${i}`,
      author: `user_${i % 5}`,
      url: `https://reddit.com/r/test/post_${i}`,
      score: Math.floor(baseEngagement + growth + noise),
      comments: Math.floor((baseEngagement + growth + noise) / 2),
      created: date,
      scraped: date,
    });
  }

  return posts;
}

function generateSeasonalData(days: number): Post[] {
  const posts: Post[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // Weekly seasonal pattern (high on Mon/Fri, low on weekends)
    const dayOfWeek = date.getDay();
    let multiplier = 1;
    if (dayOfWeek === 1 || dayOfWeek === 5) multiplier = 2; // Monday or Friday
    if (dayOfWeek === 0 || dayOfWeek === 6) multiplier = 0.5; // Weekend

    const baseValue = 50;
    const seasonalValue = baseValue * multiplier;
    const noise = Math.random() * 10 - 5;

    posts.push({
      platform: "reddit",
      id: `seasonal_${i}`,
      title: `Seasonal Post ${i}`,
      content: `Content for day ${i}`,
      author: `user_${i % 10}`,
      url: `https://reddit.com/r/test/seasonal_${i}`,
      score: Math.floor(seasonalValue + noise),
      comments: Math.floor((seasonalValue + noise) / 2),
      created: date,
      scraped: date,
    });
  }

  return posts;
}

function generateDataWithBreakpoint(days: number): Post[] {
  const posts: Post[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);
  const breakpointDay = 30;

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    let value: number;
    if (i < breakpointDay) {
      // Stable before breakpoint
      value = 50 + Math.random() * 10 - 5;
    } else {
      // Increasing after breakpoint
      value = 80 + (i - breakpointDay) * 2 + Math.random() * 10 - 5;
    }

    posts.push({
      platform: "reddit",
      id: `breakpoint_${i}`,
      title: `Breakpoint Post ${i}`,
      content: `Content for day ${i}`,
      author: `user_${i % 5}`,
      url: `https://reddit.com/r/test/breakpoint_${i}`,
      score: Math.floor(value),
      comments: Math.floor(value / 2),
      created: date,
      scraped: date,
    });
  }

  return posts;
}

function generatePlatformData(platform: string, days: number, trend: string): Post[] {
  const posts: Post[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    let value: number;
    if (trend === "increasing") {
      value = 50 + i * 2 + Math.random() * 10 - 5;
    } else if (trend === "decreasing") {
      value = 100 - i * 2 + Math.random() * 10 - 5;
    } else {
      value = 50 + Math.random() * 10 - 5;
    }

    posts.push({
      platform: platform as any,
      id: `${platform}_${i}`,
      title: `${platform} Post ${i}`,
      content: `Content for ${platform} day ${i}`,
      author: `${platform}_user_${i % 5}`,
      url: `https://${platform}.com/post_${i}`,
      score: Math.floor(value),
      comments: Math.floor(value / 2),
      created: date,
      scraped: date,
    });
  }

  return posts;
}

function generateMonotonicData(days: number): Post[] {
  const posts: Post[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // Monotonic increasing with small noise
    const value = 50 + i * 1.5 + Math.random() * 2;

    posts.push({
      platform: "reddit",
      id: `monotonic_${i}`,
      title: `Monotonic Post ${i}`,
      content: `Content for day ${i}`,
      author: `user_${i % 5}`,
      url: `https://reddit.com/r/test/monotonic_${i}`,
      score: Math.floor(value),
      comments: Math.floor(value / 2),
      created: date,
      scraped: date,
    });
  }

  return posts;
}

function generateSinglePost(dayOffset: number, engagement: number): Post {
  const date = new Date();
  date.setDate(date.getDate() - (30 - dayOffset));

  return {
    platform: "reddit",
    id: `stream_${dayOffset}`,
    title: `Streaming Post ${dayOffset}`,
    content: `Streaming content ${dayOffset}`,
    author: `user_stream`,
    url: `https://reddit.com/r/test/stream_${dayOffset}`,
    score: engagement,
    comments: Math.floor(engagement / 2),
    created: date,
    scraped: date,
  };
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}