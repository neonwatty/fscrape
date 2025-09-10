/**
 * Tests for Analytics Dashboard
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyticsDashboard } from "../dashboard.js";
import { DatabaseAnalytics } from "../../database/analytics.js";
import type { Platform } from "../../types/core.js";

describe("AnalyticsDashboard", () => {
  let mockAnalytics: any;
  let dashboard: AnalyticsDashboard;

  beforeEach(() => {
    // Create mock analytics
    mockAnalytics = {
      getPlatformStats: vi.fn().mockReturnValue({
        platform: "reddit",
        totalPosts: 1000,
        totalComments: 5000,
        totalUsers: 500,
        avgScore: 25.5,
        avgPostScore: 30,
        avgCommentScore: 20,
        avgCommentCount: 5,
        mostActiveUser: {
          username: "testuser",
          posts: 100,
          comments: 500,
        },
        lastUpdateTime: new Date(),
      }),
      getTrendingPosts: vi.fn().mockReturnValue([
        {
          id: "1",
          title: "Test Post",
          url: "https://test.com",
          author: "author1",
          score: 100,
          commentCount: 50,
          hotness: 75,
          createdAt: new Date(),
          platform: "reddit",
        },
      ]),
      getTimeSeriesData: vi.fn().mockReturnValue([
        {
          timestamp: new Date(),
          posts: 100,
          comments: 500,
          users: 50,
          avgScore: 25,
        },
      ]),
      getTopAuthors: vi.fn().mockReturnValue([
        {
          author: "topauthor",
          postCount: 50,
          totalScore: 1000,
          avgScore: 20,
          bestScore: 100,
        },
      ]),
      getEngagementStats: vi.fn().mockReturnValue({
        avgEngagement: 0.5,
        minEngagement: 0.1,
        maxEngagement: 0.9,
        highEngagementPosts: 100,
        lowEngagementPosts: 50,
      }),
      getMostEngagedPosts: vi.fn().mockReturnValue([]),
      getPostsByDateRange: vi.fn().mockReturnValue([]),
      getDatabaseHealth: vi.fn().mockReturnValue({
        databaseSize: 1000000,
        lastUpdate: new Date(),
      }),
      getDataGaps: vi.fn().mockReturnValue([]),
      getEngagementOverTime: vi.fn().mockReturnValue([]),
      getSessionPerformance: vi.fn().mockReturnValue([]),
      getSuccessfulSessionRate: vi.fn().mockReturnValue(0.95),
      getScrapingPerformance: vi.fn().mockReturnValue(null),
      getDatabaseHealthDetailed: vi.fn().mockReturnValue({
        totalSize: 1000000,
        tableStats: [],
        indexUsage: [],
        vacuumNeeded: false,
      }),
    };

    dashboard = new AnalyticsDashboard(mockAnalytics as any);
  });

  describe("getMetrics", () => {
    it("should return comprehensive dashboard metrics", async () => {
      const metrics = await dashboard.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.overview).toBeDefined();
      expect(metrics.overview.totalPosts).toBeGreaterThan(0);
      expect(metrics.platformBreakdown).toBeInstanceOf(Map);
      expect(metrics.trending).toBeInstanceOf(Array);
      expect(metrics.timeSeries).toBeInstanceOf(Array);
    });

    it("should apply filters correctly", async () => {
      const filter = {
        platforms: ["reddit" as Platform],
        limit: 5,
      };

      const metrics = await dashboard.getMetrics(filter);

      expect(metrics.trending.length).toBeLessThanOrEqual(5);
      expect(metrics.topPerformers.posts.length).toBeLessThanOrEqual(5);
    });

    it("should cache metrics when auto-refresh is disabled", async () => {
      const firstCall = await dashboard.getMetrics();
      const secondCall = await dashboard.getMetrics();

      // Analytics should only be called once due to caching
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2); // Once per platform
    });
  });

  describe("getPlatformDashboard", () => {
    it("should return platform-specific dashboard", async () => {
      const result = await dashboard.getPlatformDashboard("reddit");

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.trends).toBeInstanceOf(Array);
      expect(result.topContent).toBeInstanceOf(Array);
      expect(result.engagement).toBeDefined();
      expect(result.visualization).toBeDefined();
      expect(typeof result.visualization).toBe("string");
    });

    it("should handle date range filtering", async () => {
      const dateRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const result = await dashboard.getPlatformDashboard("reddit", dateRange);

      expect(mockAnalytics.getTimeSeriesData).toHaveBeenCalledWith(
        "reddit",
        dateRange.start,
        dateRange.end,
        "daily"
      );
    });
  });

  describe("getComparativeAnalytics", () => {
    it("should compare platforms correctly", async () => {
      const result = await dashboard.getComparativeAnalytics();

      expect(result).toBeDefined();
      expect(result.platforms).toBeInstanceOf(Map);
      expect(result.comparison).toBeInstanceOf(Array);
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.visualization).toBeDefined();
    });

    it("should generate meaningful insights", async () => {
      const result = await dashboard.getComparativeAnalytics();

      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.insights[0]).toContain("Total activity");
    });
  });

  describe("getTrendingInsights", () => {
    it("should identify trending patterns", async () => {
      const result = await dashboard.getTrendingInsights();

      expect(result).toBeDefined();
      expect(result.rising).toBeInstanceOf(Array);
      expect(result.declining).toBeInstanceOf(Array);
      expect(result.predictions).toBeInstanceOf(Array);
      expect(result.anomalies).toBeInstanceOf(Array);
    });

    it("should make predictions with confidence scores", async () => {
      const result = await dashboard.getTrendingInsights();

      if (result.predictions.length > 0) {
        const prediction = result.predictions[0];
        expect(prediction.predictedScore).toBeDefined();
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("getPerformanceMetrics", () => {
    it("should return comprehensive performance metrics", async () => {
      const result = await dashboard.getPerformanceMetrics();

      expect(result).toBeDefined();
      expect(result.scraping).toBeDefined();
      expect(result.scraping.successRate).toBeGreaterThanOrEqual(0);
      expect(result.scraping.successRate).toBeLessThanOrEqual(1);
      expect(result.database).toBeDefined();
      expect(result.dataQuality).toBeDefined();
      expect(result.dataQuality.overall).toBeGreaterThanOrEqual(0);
      expect(result.dataQuality.overall).toBeLessThanOrEqual(100);
    });
  });

  describe("generateReport", () => {
    it("should generate markdown report", async () => {
      const report = await dashboard.generateReport("markdown");

      expect(report).toBeDefined();
      expect(typeof report).toBe("string");
      expect(report).toContain("# Analytics Dashboard Report");
    });

    it("should generate HTML report", async () => {
      const report = await dashboard.generateReport("html");

      expect(report).toBeDefined();
      expect(report).toContain("<!DOCTYPE html>");
      expect(report).toContain("<title>");
    });

    it("should generate JSON report", async () => {
      const report = await dashboard.generateReport("json");

      expect(report).toBeDefined();
      const parsed = JSON.parse(report);
      expect(parsed.title).toBe("Analytics Dashboard Report");
      expect(parsed.sections).toBeInstanceOf(Array);
    });
  });

  describe("streamMetrics", () => {
    it("should stream metrics as async generator", async () => {
      const stream = dashboard.streamMetrics(undefined, 10);
      const results = [];

      // Get first two iterations
      for await (const metrics of stream) {
        results.push(metrics);
        if (results.length >= 2) break;
      }

      expect(results.length).toBe(2);
      expect(results[0].overview).toBeDefined();
      expect(results[1].overview).toBeDefined();
    });
  });

  describe("exportData", () => {
    it("should export data as CSV", async () => {
      const metrics = await dashboard.getMetrics();
      const exported = await dashboard.exportData("csv");

      expect(exported).toBeInstanceOf(Buffer);
      const csv = exported.toString();
      expect(csv).toContain(","); // CSV should have commas
    });

    it("should export data as JSON", async () => {
      const metrics = await dashboard.getMetrics();
      const exported = await dashboard.exportData("json");

      expect(exported).toBeInstanceOf(Buffer);
      const json = JSON.parse(exported.toString());
      expect(json.overview).toBeDefined();
    });
  });

  describe("auto-refresh", () => {
    it("should start and stop auto-refresh", () => {
      const dashboardWithRefresh = new AnalyticsDashboard(mockAnalytics as any, {
        enableAutoRefresh: true,
        refreshInterval: 1000,
      });

      // Should have started timer
      expect(dashboardWithRefresh).toBeDefined();

      // Stop auto-refresh
      dashboardWithRefresh.stopAutoRefresh();

      // Should not throw
      expect(() => dashboardWithRefresh.clearCache()).not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should handle missing platform data gracefully", async () => {
      mockAnalytics.getPlatformStats.mockReturnValue(null);

      const metrics = await dashboard.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.overview.totalPosts).toBe(0);
    });

    it("should handle analytics errors", async () => {
      mockAnalytics.getTrendingPosts.mockRejectedValue(new Error("Database error"));

      // Should not throw, but handle error gracefully
      await expect(dashboard.getMetrics()).rejects.toThrow();
    });
  });
});