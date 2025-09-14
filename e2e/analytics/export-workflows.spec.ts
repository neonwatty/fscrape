/**
 * End-to-End Export Workflows Tests
 * Tests complete export workflows from analytics generation to file output
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DatabaseManager } from "../../src/database/database.js";
import { ReportGenerator } from "../../src/analytics/report-generator.js";
import { AnalyticsJsonExporter } from "../../src/analytics/analytics-json-exporter.js";
import { AnalyticsCsvExporter } from "../../src/analytics/analytics-csv-exporter.js";
import { SvgGenerator } from "../../src/analytics/svg-generator.js";
import { StatisticsEngine } from "../../src/analytics/statistics.js";
import { TrendAnalyzer } from "../../src/analytics/trend-analyzer.js";
import { AnomalyDetector } from "../../src/analytics/anomaly-detector.js";
import { ForecastingEngine } from "../../src/analytics/forecasting.js";
import type { Post } from "../../src/types/core.js";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, rm, readFile, access, readdir } from "fs/promises";
import { constants } from "fs";
import { execSync } from "child_process";

describe("E2E Export Workflows", () => {
  let tempDir: string;
  let dbPath: string;
  let dbManager: DatabaseManager;
  let reportGenerator: ReportGenerator;
  let jsonExporter: AnalyticsJsonExporter;
  let csvExporter: AnalyticsCsvExporter;
  let svgGenerator: SvgGenerator;

  beforeAll(async () => {
    // Setup test environment
    tempDir = await mkdtemp(join(tmpdir(), "fscrape-export-e2e-"));
    dbPath = join(tempDir, "export-test.db");
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Complete Analytics to Export Pipeline", () => {
    beforeEach(async () => {
      // Fresh database for each test
      dbManager = new DatabaseManager({
        type: "sqlite",
        path: dbPath,
        connectionPoolSize: 5,
      });
      await dbManager.initialize();

      const analytics = dbManager.getAnalytics();
      reportGenerator = new ReportGenerator(analytics);
      jsonExporter = new AnalyticsJsonExporter(analytics);
      csvExporter = new AnalyticsCsvExporter(analytics);
      svgGenerator = new SvgGenerator();

      // Seed comprehensive test data
      await seedAnalyticsData(dbManager);
    });

    it("should generate and export comprehensive markdown report", async () => {
      const analytics = dbManager.getAnalytics();

      // Step 1: Gather all analytics data
      const statsEngine = new StatisticsEngine();
      const trendAnalyzer = new TrendAnalyzer();
      const anomalyDetector = new AnomalyDetector();
      const forecaster = new ForecastingEngine();

      const timeSeriesData = analytics.getEngagementOverTime(30);
      const values = timeSeriesData.map((d: any) => d.engagement || 0);

      const statistics = statsEngine.calculate(values);
      const trends = trendAnalyzer.analyzeTrend(values);
      const anomalies = anomalyDetector.detectAnomalies(values);
      const forecast = forecaster.forecast(values, 7);

      // Step 2: Generate comprehensive report
      const reportData = {
        statistics,
        trends,
        anomalies,
        forecast,
        timeRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
        platforms: ["reddit", "hackernews"],
      };

      const markdownReport = reportGenerator.generate(reportData, {
        format: "markdown",
        sections: ["summary", "statistics", "trends", "anomalies", "forecast"],
      });

      // Step 3: Export to file
      const outputPath = join(tempDir, "analytics-report.md");
      await reportGenerator.save(markdownReport, outputPath);

      // Step 4: Verify export
      await access(outputPath, constants.F_OK);
      const content = await readFile(outputPath, "utf-8");

      expect(content).toContain("# Analytics Report");
      expect(content).toContain("## Executive Summary");
      expect(content).toContain("## Statistical Analysis");
      expect(content).toContain("## Trend Analysis");
      expect(content).toContain("## Anomaly Detection");
      expect(content).toContain("## Forecast");

      // Verify markdown structure
      const headers = content.match(/^#{1,3} .+$/gm);
      expect(headers).toBeTruthy();
      expect(headers!.length).toBeGreaterThan(5);

      // Verify data tables
      expect(content).toMatch(/\|.*\|.*\|/); // Table structure
      expect(content).toContain("Mean");
      expect(content).toContain("Median");
      expect(content).toContain("Standard Deviation");
    });

    it("should generate and export HTML report with charts", async () => {
      const analytics = dbManager.getAnalytics();

      // Step 1: Generate analytics
      const timeSeriesData = analytics.getEngagementOverTime(30);
      const platformStats = analytics.getBasicStats();

      // Step 2: Generate HTML report
      const reportData = {
        timeSeriesData,
        platformStats,
        generatedAt: new Date(),
      };

      const htmlReport = reportGenerator.generate(reportData, {
        format: "html",
        includeCharts: true,
        style: "professional",
      });

      // Step 3: Export HTML
      const outputPath = join(tempDir, "analytics-report.html");
      await reportGenerator.save(htmlReport, outputPath);

      // Step 4: Verify HTML structure
      const content = await readFile(outputPath, "utf-8");

      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<html");
      expect(content).toContain("<head>");
      expect(content).toContain("<body>");
      expect(content).toContain("Analytics Report");

      // Verify chart containers
      expect(content).toContain("chart-container");
      expect(content).toContain("<svg");

      // Verify CSS styling
      expect(content).toContain("<style>");
      expect(content).toMatch(/font-family:.*sans-serif/i);

      // Verify responsive design
      expect(content).toContain("viewport");
      expect(content).toMatch(/max-width:.*100%/);
    });

    it("should export analytics data to JSON with proper structure", async () => {
      const analytics = dbManager.getAnalytics();

      // Step 1: Gather comprehensive analytics
      const exportData = await jsonExporter.prepareExportData({
        timeRange: { days: 30 },
        includePlatforms: ["reddit", "hackernews"],
        includeMetrics: ["engagement", "posts", "comments"],
        includeAnalytics: true,
      });

      // Step 2: Export to JSON
      const outputPath = join(tempDir, "analytics-export.json");
      await jsonExporter.export(exportData, outputPath);

      // Step 3: Verify JSON structure
      const content = await readFile(outputPath, "utf-8");
      const jsonData = JSON.parse(content);

      expect(jsonData).toHaveProperty("metadata");
      expect(jsonData).toHaveProperty("data");
      expect(jsonData).toHaveProperty("analytics");

      // Verify metadata
      expect(jsonData.metadata).toHaveProperty("exportedAt");
      expect(jsonData.metadata).toHaveProperty("version");
      expect(jsonData.metadata).toHaveProperty("timeRange");

      // Verify data structure
      expect(jsonData.data).toHaveProperty("timeSeries");
      expect(jsonData.data).toHaveProperty("platforms");
      expect(Array.isArray(jsonData.data.timeSeries)).toBe(true);

      // Verify analytics
      expect(jsonData.analytics).toHaveProperty("statistics");
      expect(jsonData.analytics).toHaveProperty("trends");

      // Verify data integrity
      expect(jsonData.data.timeSeries.length).toBeGreaterThan(0);
      jsonData.data.timeSeries.forEach((item: any) => {
        expect(item).toHaveProperty("date");
        expect(item).toHaveProperty("engagement");
      });
    });

    it("should export data to CSV with proper formatting", async () => {
      const analytics = dbManager.getAnalytics();

      // Step 1: Prepare CSV data
      const timeSeriesData = analytics.getEngagementOverTime(30);

      const csvData = {
        headers: ["Date", "Platform", "Posts", "Engagement", "Comments"],
        rows: timeSeriesData.map((d: any) => [
          d.date,
          d.platform || "all",
          d.posts || 0,
          d.engagement || 0,
          d.comments || 0,
        ]),
      };

      // Step 2: Export to CSV
      const outputPath = join(tempDir, "analytics-export.csv");
      await csvExporter.export(csvData, outputPath);

      // Step 3: Verify CSV structure
      const content = await readFile(outputPath, "utf-8");
      const lines = content.split("\n");

      // Verify headers
      expect(lines[0]).toContain("Date");
      expect(lines[0]).toContain("Platform");
      expect(lines[0]).toContain("Engagement");

      // Verify data rows
      expect(lines.length).toBeGreaterThan(1);

      // Parse and verify data
      const dataRows = lines.slice(1).filter(line => line.trim());
      dataRows.forEach(row => {
        const columns = row.split(",");
        expect(columns.length).toBe(5);

        // Verify date format
        expect(columns[0]).toMatch(/^\d{4}-\d{2}-\d{2}/);

        // Verify numeric values
        expect(Number(columns[2])).not.toBeNaN();
        expect(Number(columns[3])).not.toBeNaN();
        expect(Number(columns[4])).not.toBeNaN();
      });
    });

    it("should generate SVG charts and export them", async () => {
      const analytics = dbManager.getAnalytics();

      // Step 1: Prepare chart data
      const timeSeriesData = analytics.getEngagementOverTime(30);
      const chartData = {
        type: "line",
        data: timeSeriesData.map((d: any) => ({
          x: new Date(d.date),
          y: d.engagement || 0,
        })),
        title: "Engagement Over Time",
        xLabel: "Date",
        yLabel: "Engagement",
      };

      // Step 2: Generate SVG
      const svg = svgGenerator.generateLineChart(chartData, {
        width: 800,
        height: 400,
        margin: { top: 20, right: 30, bottom: 40, left: 50 },
      });

      // Step 3: Export SVG
      const outputPath = join(tempDir, "engagement-chart.svg");
      await svgGenerator.save(svg, outputPath);

      // Step 4: Verify SVG structure
      const content = await readFile(outputPath, "utf-8");

      expect(content).toContain("<svg");
      expect(content).toContain("</svg>");
      expect(content).toContain('width="800"');
      expect(content).toContain('height="400"');

      // Verify chart elements
      expect(content).toContain("<path"); // Line path
      expect(content).toContain("<g"); // Groups
      expect(content).toContain("<text"); // Labels

      // Verify title and labels
      expect(content).toContain("Engagement Over Time");
      expect(content).toContain("Date");
      expect(content).toContain("Engagement");
    });

    it("should handle batch export of multiple formats", async () => {
      const analytics = dbManager.getAnalytics();

      // Step 1: Prepare export data
      const exportData = {
        timeSeries: analytics.getEngagementOverTime(30),
        statistics: new StatisticsEngine().calculate(
          analytics.getEngagementOverTime(30).map((d: any) => d.engagement || 0)
        ),
        platforms: ["reddit", "hackernews"],
      };

      // Step 2: Batch export to multiple formats
      const formats = ["json", "csv", "markdown", "html"];
      const exportPromises = formats.map(async (format) => {
        const filename = `batch-export.${format}`;
        const outputPath = join(tempDir, filename);

        switch (format) {
          case "json":
            await jsonExporter.export(exportData, outputPath);
            break;
          case "csv":
            const csvData = {
              headers: ["Date", "Engagement"],
              rows: exportData.timeSeries.map((d: any) => [d.date, d.engagement || 0]),
            };
            await csvExporter.export(csvData, outputPath);
            break;
          case "markdown":
          case "html":
            const report = reportGenerator.generate(exportData, { format });
            await reportGenerator.save(report, outputPath);
            break;
        }

        return outputPath;
      });

      const exportedFiles = await Promise.all(exportPromises);

      // Step 3: Verify all exports
      for (const filepath of exportedFiles) {
        await access(filepath, constants.F_OK);
        const stats = await readFile(filepath, "utf-8");
        expect(stats.length).toBeGreaterThan(0);
      }

      // Verify directory contains all exports
      const files = await readdir(tempDir);
      expect(files.filter(f => f.startsWith("batch-export")).length).toBe(4);
    });

    it("should export with data compression for large datasets", async () => {
      // Step 1: Generate large dataset
      const largePosts = generateLargeDataset(1000);
      const dbInstance = dbManager.getConnection();

      for (const post of largePosts) {
        await dbInstance.insertPost(post);
      }

      const analytics = dbManager.getAnalytics();
      const largeData = analytics.getEngagementOverTime(365);

      // Step 2: Export with compression
      const outputPath = join(tempDir, "large-export.json");
      const compressedPath = join(tempDir, "large-export.json.gz");

      await jsonExporter.export(largeData, outputPath, {
        compress: true,
        compressionLevel: 9,
      });

      // Step 3: Verify compression
      const originalSize = (await readFile(outputPath, "utf-8")).length;

      // Use gzip to compress the file
      execSync(`gzip -9 -c ${outputPath} > ${compressedPath}`);

      const compressedContent = await readFile(compressedPath);
      const compressionRatio = compressedContent.length / originalSize;

      expect(compressionRatio).toBeLessThan(0.5); // At least 50% compression
    });

    it("should handle incremental exports with proper versioning", async () => {
      const analytics = dbManager.getAnalytics();

      // Step 1: Initial export
      const v1Data = {
        version: "1.0.0",
        data: analytics.getEngagementOverTime(10),
        exportedAt: new Date(),
      };

      const v1Path = join(tempDir, "export-v1.json");
      await jsonExporter.export(v1Data, v1Path);

      // Step 2: Add more data
      const morePosts = generateLargeDataset(20);
      const dbInstance = dbManager.getConnection();
      for (const post of morePosts) {
        await dbInstance.insertPost(post);
      }

      // Step 3: Incremental export
      const v2Data = {
        version: "2.0.0",
        data: analytics.getEngagementOverTime(30),
        exportedAt: new Date(),
        previousVersion: "1.0.0",
      };

      const v2Path = join(tempDir, "export-v2.json");
      await jsonExporter.export(v2Data, v2Path);

      // Step 4: Verify versioning
      const v1Content = JSON.parse(await readFile(v1Path, "utf-8"));
      const v2Content = JSON.parse(await readFile(v2Path, "utf-8"));

      expect(v1Content.version).toBe("1.0.0");
      expect(v2Content.version).toBe("2.0.0");
      expect(v2Content.previousVersion).toBe("1.0.0");
      expect(v2Content.data.length).toBeGreaterThan(v1Content.data.length);
    });

    it("should perform performance benchmarking during export", async () => {
      const analytics = dbManager.getAnalytics();
      const benchmarks: { format: string; time: number; size: number }[] = [];

      // Generate test data
      const testData = analytics.getEngagementOverTime(100);

      // Benchmark each format
      const formats = ["json", "csv", "markdown", "html"];

      for (const format of formats) {
        const startTime = performance.now();
        const outputPath = join(tempDir, `benchmark.${format}`);

        switch (format) {
          case "json":
            await jsonExporter.export(testData, outputPath);
            break;
          case "csv":
            const csvData = {
              headers: ["Date", "Value"],
              rows: testData.map((d: any) => [d.date, d.engagement || 0]),
            };
            await csvExporter.export(csvData, outputPath);
            break;
          case "markdown":
          case "html":
            const report = reportGenerator.generate({ data: testData }, { format });
            await reportGenerator.save(report, outputPath);
            break;
        }

        const endTime = performance.now();
        const content = await readFile(outputPath, "utf-8");

        benchmarks.push({
          format,
          time: endTime - startTime,
          size: content.length,
        });
      }

      // Verify performance expectations
      benchmarks.forEach(benchmark => {
        expect(benchmark.time).toBeLessThan(1000); // Less than 1 second
        expect(benchmark.size).toBeGreaterThan(0);
      });

      // JSON should be one of the fastest
      const jsonBenchmark = benchmarks.find(b => b.format === "json");
      const avgTime = benchmarks.reduce((sum, b) => sum + b.time, 0) / benchmarks.length;
      expect(jsonBenchmark!.time).toBeLessThan(avgTime * 1.5);
    });
  });
});

// Helper functions
async function seedAnalyticsData(dbManager: DatabaseManager): Promise<void> {
  const posts: Post[] = [];
  const platforms = ["reddit", "hackernews"];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30);

  for (let day = 0; day < 30; day++) {
    for (const platform of platforms) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + day);

      // Create 5-10 posts per platform per day
      const postCount = Math.floor(Math.random() * 6) + 5;

      for (let i = 0; i < postCount; i++) {
        posts.push({
          platform: platform as any,
          id: `${platform}_${day}_${i}`,
          title: `${platform} Post ${day}-${i}`,
          content: `Content for ${platform} post on day ${day}`,
          author: `user_${Math.floor(Math.random() * 10)}`,
          url: `https://${platform}.com/post_${day}_${i}`,
          score: Math.floor(Math.random() * 500) + 50,
          comments: Math.floor(Math.random() * 100) + 10,
          created: date,
          scraped: date,
        });
      }
    }
  }

  const dbInstance = dbManager.getConnection();
  for (const post of posts) {
    await dbInstance.insertPost(post);
  }
}

function generateLargeDataset(count: number): Post[] {
  const posts: Post[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - count);

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    posts.push({
      platform: "reddit",
      id: `large_${i}`,
      title: `Large Dataset Post ${i}`,
      content: `Content for large dataset post ${i}. `.repeat(10), // Make content larger
      author: `user_${i % 100}`,
      url: `https://reddit.com/r/test/large_${i}`,
      score: Math.floor(Math.random() * 1000),
      comments: Math.floor(Math.random() * 200),
      created: date,
      scraped: date,
      metadata: {
        tags: Array.from({ length: 5 }, (_, j) => `tag_${j}`),
        category: `category_${i % 10}`,
        sentiment: Math.random(),
      },
    });
  }

  return posts;
}