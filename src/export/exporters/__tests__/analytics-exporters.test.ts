/**
 * Tests for Analytics JSON and CSV Exporters
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AnalyticsJsonExporter } from "../analytics-json-exporter.js";
import { AnalyticsCsvExporter } from "../analytics-csv-exporter.js";
import type {
  PlatformStats,
  TrendingPost,
  UserActivity,
  TimeSeriesData,
} from "../../../database/analytics.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Analytics Exporters", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "analytics-export-test-"));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("AnalyticsJsonExporter", () => {
    it("should export analytics data with statistical metadata", async () => {
      const exporter = new AnalyticsJsonExporter({
        pretty: true,
        includeStatistics: true,
        includeConfidenceIntervals: true,
      });

      const testData = {
        platformStats: [
          {
            platform: "reddit" as const,
            totalPosts: 100,
            totalComments: 500,
            totalUsers: 50,
            avgScore: 25.5,
            avgPostScore: 30.2,
            avgCommentScore: 20.8,
            avgCommentCount: 5,
            mostActiveUser: { username: "testuser", posts: 10, comments: 50 },
            lastUpdateTime: new Date(),
          },
        ] as PlatformStats[],
        trendingPosts: [
          {
            id: "1",
            title: "Test Post 1",
            url: "https://example.com/1",
            author: "user1",
            score: 100,
            commentCount: 20,
            hotness: 95.5,
            createdAt: new Date(),
            platform: "reddit" as const,
          },
          {
            id: "2",
            title: "Test Post 2",
            url: "https://example.com/2",
            author: "user2",
            score: 50,
            commentCount: 10,
            hotness: 45.5,
            createdAt: new Date(),
            platform: "reddit" as const,
          },
        ] as TrendingPost[],
      };

      const outputPath = path.join(tempDir, "analytics.json");
      const files = await exporter.export(testData, outputPath);

      expect(files).toHaveLength(1);
      expect(fs.existsSync(files[0])).toBe(true);

      const content = JSON.parse(fs.readFileSync(files[0], "utf-8"));
      expect(content.metadata).toBeDefined();
      expect(content.metadata.statisticalConfig).toBeDefined();
      expect(content.platformStats).toBeDefined();
      expect(content.trendingPosts).toHaveLength(2);

      // Check for statistical enhancements
      expect(content.trendingPosts[0].relativePerformance).toBeDefined();
      expect(
        content.trendingPosts[0].relativePerformance.percentile,
      ).toBeDefined();
      expect(content.trendingPosts[0].relativePerformance.zScore).toBeDefined();
    });

    it("should calculate confidence intervals correctly", async () => {
      const exporter = new AnalyticsJsonExporter({
        includeConfidenceIntervals: true,
        confidenceLevel: 0.95,
      });

      const testData = {
        trendingPosts: Array.from({ length: 30 }, (_, i) => ({
          id: `post-${i}`,
          title: `Post ${i}`,
          url: `https://example.com/${i}`,
          author: `user${i}`,
          score: 50 + Math.random() * 100,
          commentCount: Math.floor(Math.random() * 50),
          hotness: Math.random() * 100,
          createdAt: new Date(),
          platform: "reddit" as const,
        })) as TrendingPost[],
      };

      const outputPath = path.join(tempDir, "confidence.json");
      const files = await exporter.export(testData, outputPath);

      const content = JSON.parse(fs.readFileSync(files[0], "utf-8"));
      expect(content.aggregateStatistics).toBeDefined();
      expect(content.aggregateStatistics.posts).toBeDefined();
      expect(
        content.aggregateStatistics.posts.confidenceInterval,
      ).toBeDefined();
      expect(content.aggregateStatistics.posts.confidenceInterval.level).toBe(
        0.95,
      );
      expect(
        content.aggregateStatistics.posts.confidenceInterval.lower,
      ).toBeLessThan(
        content.aggregateStatistics.posts.confidenceInterval.upper,
      );
    });

    it("should export to separate files when configured", async () => {
      const exporter = new AnalyticsJsonExporter({
        separateFiles: true,
      });

      const testData = {
        platformStats: [
          {
            platform: "reddit" as const,
            totalPosts: 100,
            totalComments: 500,
            totalUsers: 50,
            avgScore: 25.5,
            avgPostScore: 30.2,
            avgCommentScore: 20.8,
            avgCommentCount: 5,
            mostActiveUser: null,
            lastUpdateTime: new Date(),
          },
        ] as PlatformStats[],
        trendingPosts: [
          {
            id: "1",
            title: "Test Post",
            url: "https://example.com",
            author: "user1",
            score: 100,
            commentCount: 20,
            hotness: 95.5,
            createdAt: new Date(),
            platform: "reddit" as const,
          },
        ] as TrendingPost[],
        userActivity: [
          {
            username: "testuser",
            platform: "reddit" as const,
            postCount: 10,
            commentCount: 50,
            totalKarma: 500,
            avgPostScore: 30,
            avgCommentScore: 10,
            firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            lastSeen: new Date(),
          },
        ] as UserActivity[],
      };

      const outputPath = path.join(tempDir, "analytics.json");
      const files = await exporter.export(testData, outputPath);

      expect(files.length).toBeGreaterThan(1);
      expect(files.some((f) => f.includes("platform-stats"))).toBe(true);
      expect(files.some((f) => f.includes("trending"))).toBe(true);
      expect(files.some((f) => f.includes("users"))).toBe(true);
      expect(files.some((f) => f.includes("statistics"))).toBe(true);

      files.forEach((file) => {
        expect(fs.existsSync(file)).toBe(true);
      });
    });
  });

  describe("AnalyticsCsvExporter", () => {
    it("should export trending posts with statistical columns", async () => {
      const exporter = new AnalyticsCsvExporter({
        includeStatistics: true,
        includePercentiles: true,
        includeZScores: true,
      });

      const testData = {
        trendingPosts: [
          {
            id: "1",
            title: "High Score Post",
            url: "https://example.com/1",
            author: "user1",
            score: 1000,
            commentCount: 100,
            hotness: 95.5,
            createdAt: new Date(),
            platform: "reddit" as const,
          },
          {
            id: "2",
            title: "Medium Score Post",
            url: "https://example.com/2",
            author: "user2",
            score: 100,
            commentCount: 20,
            hotness: 45.5,
            createdAt: new Date(),
            platform: "reddit" as const,
          },
          {
            id: "3",
            title: "Low Score Post",
            url: "https://example.com/3",
            author: "user3",
            score: 10,
            commentCount: 2,
            hotness: 5.5,
            createdAt: new Date(),
            platform: "reddit" as const,
          },
        ] as TrendingPost[],
      };

      const outputPath = path.join(tempDir, "trending.csv");
      const files = await exporter.export(testData, outputPath);

      expect(files).toHaveLength(1);
      expect(fs.existsSync(files[0])).toBe(true);

      const content = fs.readFileSync(files[0], "utf-8");
      const lines = content.split("\n");

      // Check headers include statistical columns
      expect(lines[0]).toContain("Score Percentile");
      expect(lines[0]).toContain("Score Z-Score");
      expect(lines[0]).toContain("Is Outlier");
      expect(lines[0]).toContain("Significance");

      // Check data rows exist
      expect(lines.length).toBeGreaterThanOrEqual(4); // Header + 3 data rows
    });

    it("should export time series with moving averages", async () => {
      const exporter = new AnalyticsCsvExporter({
        includeMovingAverages: true,
        movingAverageWindow: 3,
      });

      const now = new Date();
      const testData = {
        timeSeries: Array.from({ length: 10 }, (_, i) => ({
          timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
          posts: 10 + Math.floor(Math.random() * 20),
          comments: 50 + Math.floor(Math.random() * 100),
          users: 5 + Math.floor(Math.random() * 10),
          avgScore: 20 + Math.random() * 30,
        })) as TimeSeriesData[],
      };

      const outputPath = path.join(tempDir, "timeseries.csv");
      const files = await exporter.export(testData, outputPath);

      expect(files).toHaveLength(1);
      expect(fs.existsSync(files[0])).toBe(true);

      const content = fs.readFileSync(files[0], "utf-8");
      const lines = content.split("\n");

      // Check headers include moving average columns
      expect(lines[0]).toContain("Posts MA(3)");
      expect(lines[0]).toContain("Comments MA(3)");
      expect(lines[0]).toContain("Score MA(3)");
    });

    it("should export summary statistics", async () => {
      const exporter = new AnalyticsCsvExporter({
        separateFiles: true,
      });

      const testData = {
        platformStats: [
          {
            platform: "reddit" as const,
            totalPosts: 100,
            totalComments: 500,
            totalUsers: 50,
            avgScore: 25.5,
            avgPostScore: 30.2,
            avgCommentScore: 20.8,
            avgCommentCount: 5,
            mostActiveUser: null,
            lastUpdateTime: new Date(),
          },
        ] as PlatformStats[],
        trendingPosts: Array.from({ length: 20 }, (_, i) => ({
          id: `post-${i}`,
          title: `Post ${i}`,
          url: `https://example.com/${i}`,
          author: `user${i}`,
          score: Math.floor(Math.random() * 1000),
          commentCount: Math.floor(Math.random() * 100),
          hotness: Math.random() * 100,
          createdAt: new Date(),
          platform: "reddit" as const,
        })) as TrendingPost[],
      };

      const outputPath = path.join(tempDir, "analytics.csv");
      const files = await exporter.export(testData, outputPath);

      // Should create multiple files including summary
      expect(files.length).toBeGreaterThan(1);
      const summaryFile = files.find((f) => f.includes("summary-stats"));
      expect(summaryFile).toBeDefined();

      if (summaryFile) {
        const content = fs.readFileSync(summaryFile, "utf-8");
        const lines = content.split("\n");

        // Check summary statistics headers
        expect(lines[0]).toContain("Metric");
        expect(lines[0]).toContain("Mean");
        expect(lines[0]).toContain("Median");
        expect(lines[0]).toContain("Std Dev");
        expect(lines[0]).toContain("CI Lower");
        expect(lines[0]).toContain("CI Upper");
      }
    });

    it("should format numbers with specified decimal places", async () => {
      const exporter = new AnalyticsCsvExporter({
        decimalPlaces: 2,
      });

      const testData = {
        trendingPosts: [
          {
            id: "1",
            title: "Test Post",
            url: "https://example.com",
            author: "user1",
            score: 123.456789,
            commentCount: 20,
            hotness: 95.123456,
            createdAt: new Date(),
            platform: "reddit" as const,
          },
        ] as TrendingPost[],
      };

      const outputPath = path.join(tempDir, "formatted.csv");
      const files = await exporter.export(testData, outputPath);

      const content = fs.readFileSync(files[0], "utf-8");
      const lines = content.split("\n");

      // Check that hotness is formatted to 2 decimal places
      expect(lines[1]).toContain("95.12");
      expect(lines[1]).not.toContain("95.123456");
    });
  });

  describe("Integration", () => {
    it("should export same data in both JSON and CSV formats", async () => {
      const jsonExporter = new AnalyticsJsonExporter({
        includeStatistics: true,
      });
      const csvExporter = new AnalyticsCsvExporter({
        includeStatistics: true,
      });

      const testData = {
        trendingPosts: Array.from({ length: 5 }, (_, i) => ({
          id: `post-${i}`,
          title: `Post ${i}`,
          url: `https://example.com/${i}`,
          author: `user${i}`,
          score: (i + 1) * 100,
          commentCount: (i + 1) * 10,
          hotness: (i + 1) * 20,
          createdAt: new Date(),
          platform: "reddit" as const,
        })) as TrendingPost[],
      };

      const jsonPath = path.join(tempDir, "data.json");
      const csvPath = path.join(tempDir, "data.csv");

      const [jsonFiles, csvFiles] = await Promise.all([
        jsonExporter.export(testData, jsonPath),
        csvExporter.export(testData, csvPath),
      ]);

      expect(jsonFiles).toHaveLength(1);
      expect(csvFiles).toHaveLength(1);

      // Verify both files contain the same data points
      const jsonContent = JSON.parse(fs.readFileSync(jsonFiles[0], "utf-8"));
      const csvContent = fs.readFileSync(csvFiles[0], "utf-8");

      expect(jsonContent.trendingPosts).toHaveLength(5);
      expect(csvContent.split("\n").filter((line) => line.trim())).toHaveLength(
        6,
      ); // Header + 5 rows
    });
  });
});
