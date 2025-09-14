/**
 * End-to-End Analytics Workflow Tests
 * Tests complete analytics workflows from data collection to report generation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Database } from "../../src/database/database.js";
import { DatabaseAnalytics } from "../../src/database/analytics.js";
import { AnalyticsDashboard } from "../../src/analytics/dashboard.js";
import { ReportGenerator } from "../../src/analytics/report-generator.js";
import { AnalyticsJsonExporter } from "../../src/analytics/analytics-json-exporter.js";
import { AnalyticsCsvExporter } from "../../src/analytics/analytics-csv-exporter.js";
import { CachedAnalytics } from "../../src/analytics/cached-analytics.js";
import { TrendAnalyzer } from "../../src/analytics/trend-analyzer.js";
import { AnomalyDetector } from "../../src/analytics/anomaly-detector.js";
import { ForecastingEngine } from "../../src/analytics/forecasting.js";
import { SvgGenerator } from "../../src/analytics/svg-generator.js";
import { TerminalVisualizer } from "../../src/analytics/terminal-visualizer.js";
import type { Post, Comment, User } from "../../src/types/core.js";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";

describe("E2E Analytics Workflow", () => {
  let tempDir: string;
  let db: Database;
  let analytics: DatabaseAnalytics;
  let dashboard: AnalyticsDashboard;
  let reportGenerator: ReportGenerator;

  beforeAll(async () => {
    // Setup test environment
    tempDir = await mkdtemp(join(tmpdir(), "fscrape-e2e-"));
    const dbPath = join(tempDir, "test.db");

    db = new Database(dbPath);
    await db.initialize();

    // Seed comprehensive test data
    await seedComprehensiveTestData(db);

    analytics = new DatabaseAnalytics(db);
    dashboard = new AnalyticsDashboard(analytics);
    reportGenerator = new ReportGenerator(analytics);
  });

  afterAll(async () => {
    await db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Complete Data Collection to Report Workflow", () => {
    it("should execute full analytics pipeline from data to insights", async () => {
      // Step 1: Collect metrics
      const metrics = await dashboard.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.overview.totalPosts).toBeGreaterThan(0);

      // Step 2: Analyze trends
      const trendAnalyzer = new TrendAnalyzer(db);
      const trends = await trendAnalyzer.analyzeAllTrends();
      expect(trends.platforms.size).toBeGreaterThan(0);

      // Step 3: Detect anomalies
      const detector = new AnomalyDetector();
      const timeSeries = analytics.getTimeSeriesData(
        "reddit",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
        "daily"
      );
      const scores = timeSeries.map(d => d.avgScore);
      const anomalies = detector.detectAnomalies(scores);
      expect(anomalies).toHaveProperty("threshold");

      // Step 4: Generate forecasts
      const forecaster = new ForecastingEngine();
      const values = timeSeries.map(d => d.posts);
      const forecast = forecaster.forecast(values, 7);
      expect(forecast.predictions).toHaveLength(7);

      // Step 5: Generate comprehensive report
      const reportData = {
        metrics,
        trending: trends,
        anomalies,
        forecast,
        generatedAt: new Date(),
      };

      const report = reportGenerator.generateComprehensiveReport(
        reportData,
        "markdown",
        { reportType: "detailed" }
      );

      expect(report).toContain("Comprehensive Analytics Report");
      expect(report).toContain("Executive Summary");
      expect(report).toContain("Statistical Analysis");
      expect(report).toContain("Platform Overview");

      // Step 6: Export to file
      const reportPath = join(tempDir, "analytics-report.md");
      await writeFile(reportPath, report);

      const savedReport = await readFile(reportPath, "utf-8");
      expect(savedReport).toBe(report);
    });

    it("should handle cached analytics workflow", async () => {
      const cachedAnalytics = new CachedAnalytics(analytics);

      // First request - hits database
      const stats1 = cachedAnalytics.getPlatformStats("reddit");
      const cacheStats1 = cachedAnalytics.getCacheStats();
      expect(cacheStats1.misses).toBe(1);

      // Second request - hits cache
      const stats2 = cachedAnalytics.getPlatformStats("reddit");
      const cacheStats2 = cachedAnalytics.getCacheStats();
      expect(cacheStats2.hits).toBe(1);

      expect(stats1).toEqual(stats2);

      // Generate dashboard with cached data
      const cachedDashboard = new AnalyticsDashboard(cachedAnalytics);
      const metrics = await cachedDashboard.getMetrics();
      expect(metrics).toBeDefined();

      // Clear cache and verify
      cachedAnalytics.clearCache();
      const cacheStats3 = cachedAnalytics.getCacheStats();
      expect(cacheStats3.size).toBe(0);
    });

    it("should export analytics in multiple formats", async () => {
      const metrics = await dashboard.getMetrics();

      // JSON export
      const jsonExporter = new AnalyticsJsonExporter(analytics);
      const jsonData = await jsonExporter.exportDashboardMetrics();
      const jsonPath = join(tempDir, "metrics.json");
      await writeFile(jsonPath, jsonData);

      const savedJson = await readFile(jsonPath, "utf-8");
      const parsed = JSON.parse(savedJson);
      expect(parsed).toHaveProperty("metrics");
      expect(parsed).toHaveProperty("generatedAt");

      // CSV export
      const csvExporter = new AnalyticsCsvExporter(analytics);
      const csvData = csvExporter.exportPlatformStats();
      const csvPath = join(tempDir, "platform-stats.csv");
      await writeFile(csvPath, csvData);

      const savedCsv = await readFile(csvPath, "utf-8");
      expect(savedCsv).toContain("Platform,");
      expect(savedCsv).toContain("reddit");

      // HTML report
      const htmlReport = reportGenerator.generateComprehensiveReport(
        { metrics, generatedAt: new Date() },
        "html",
        { reportType: "executive" }
      );
      const htmlPath = join(tempDir, "report.html");
      await writeFile(htmlPath, htmlReport);

      const savedHtml = await readFile(htmlPath, "utf-8");
      expect(savedHtml).toContain("<!DOCTYPE html>");
      expect(savedHtml).toContain("<style>");
      expect(savedHtml).toContain("Executive Analytics Summary");
    });

    it("should generate visualizations end-to-end", async () => {
      const metrics = await dashboard.getMetrics();
      const svgGenerator = new SvgGenerator();

      // Generate line chart
      const lineChartData = metrics.timeSeries.map(t => ({
        date: t.timestamp,
        value: t.posts,
      }));
      const lineChart = svgGenerator.generateLineChart(
        lineChartData,
        "Posts Over Time"
      );
      expect(lineChart).toContain("<svg");
      expect(lineChart).toContain("</svg>");

      // Generate bar chart
      const barChartData = Array.from(metrics.platformBreakdown.entries()).map(
        ([platform, stats]) => ({
          label: platform,
          value: stats.totalPosts || 0,
        })
      );
      const barChart = svgGenerator.generateBarChart(
        barChartData,
        "Posts by Platform"
      );
      expect(barChart).toContain("<svg");

      // Generate pie chart
      const pieChart = svgGenerator.generatePieChart(
        barChartData,
        "Platform Distribution"
      );
      expect(pieChart).toContain("<svg");

      // Save visualizations
      const chartsPath = join(tempDir, "charts.html");
      const chartsHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Analytics Charts</title></head>
        <body>
          <h1>Analytics Visualizations</h1>
          <div>${lineChart}</div>
          <div>${barChart}</div>
          <div>${pieChart}</div>
        </body>
        </html>
      `;
      await writeFile(chartsPath, chartsHtml);

      const savedCharts = await readFile(chartsPath, "utf-8");
      expect(savedCharts).toContain("Posts Over Time");
    });

    it("should handle terminal visualization workflow", () => {
      const visualizer = new TerminalVisualizer();
      const metrics = dashboard.getMetrics();

      // Generate terminal-based visualizations
      const header = visualizer.formatHeader("Analytics Dashboard");
      expect(header).toContain("═");

      const table = visualizer.formatTable(
        [
          ["Platform", "Posts", "Comments", "Users"],
          ["Reddit", "6000", "30000", "1200"],
          ["HackerNews", "4000", "20000", "800"],
        ],
        { borders: true }
      );
      expect(table).toContain("│");
      expect(table).toContain("Platform");

      const progressBar = visualizer.formatProgressBar(0.75, 30, {
        showPercentage: true,
      });
      expect(progressBar).toContain("75%");

      const sparkline = visualizer.formatSparkline([1, 2, 3, 4, 5, 4, 3]);
      expect(sparkline.length).toBeGreaterThan(0);

      // Create complete terminal report
      const terminalReport = [
        header,
        "",
        visualizer.formatSection("Platform Statistics"),
        table,
        "",
        visualizer.formatSection("Growth Rate"),
        progressBar,
        "",
        visualizer.formatSection("Activity Trend"),
        sparkline,
      ].join("\n");

      expect(terminalReport).toContain("Analytics Dashboard");
      expect(terminalReport).toContain("Platform Statistics");
    });
  });

  describe("Real-time Analytics Workflow", () => {
    it("should handle streaming analytics updates", async () => {
      const updates = [];
      const stream = dashboard.streamMetrics(undefined, 100);

      let count = 0;
      for await (const update of stream) {
        updates.push(update);
        count++;
        if (count >= 3) break;
      }

      expect(updates).toHaveLength(3);
      updates.forEach(update => {
        expect(update).toHaveProperty("overview");
        expect(update).toHaveProperty("platformBreakdown");
      });
    });

    it("should handle incremental data updates", async () => {
      const initialMetrics = await dashboard.getMetrics();
      const initialCount = initialMetrics.overview.totalPosts;

      // Add new data
      await db.run(
        `INSERT INTO posts (id, platform, title, url, author, score, comment_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "e2e-test-post",
          "reddit",
          "E2E Test Post",
          "http://example.com/e2e",
          "testuser",
          100,
          10,
          new Date().toISOString(),
        ]
      );

      const updatedMetrics = await dashboard.getMetrics();
      expect(updatedMetrics.overview.totalPosts).toBe(initialCount + 1);

      // Clean up
      await db.run(`DELETE FROM posts WHERE id = ?`, ["e2e-test-post"]);
    });
  });

  describe("Cross-Platform Analytics Workflow", () => {
    it("should analyze and compare multiple platforms", async () => {
      const comparison = await dashboard.getComparativeAnalytics();

      expect(comparison).toHaveProperty("platforms");
      expect(comparison.platforms.size).toBeGreaterThanOrEqual(2);

      expect(comparison).toHaveProperty("comparison");
      comparison.comparison.forEach(metric => {
        expect(metric).toHaveProperty("metric");
        expect(metric).toHaveProperty("winner");
        expect(metric).toHaveProperty("values");
      });

      expect(comparison).toHaveProperty("insights");
      expect(Array.isArray(comparison.insights)).toBe(true);

      // Generate comparative report
      const report = reportGenerator.generateComprehensiveReport(
        {
          metrics: await dashboard.getMetrics(),
          comparative: comparison,
          generatedAt: new Date(),
        },
        "markdown",
        { reportType: "detailed" }
      );

      expect(report).toContain("Platform Comparison");
    });
  });

  describe("Performance Analytics Workflow", () => {
    it("should analyze system performance end-to-end", async () => {
      // Simulate performance data
      await db.run(
        `INSERT INTO scraping_logs (platform, url, success, response_time, items_scraped, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["reddit", "http://reddit.com", 1, 250, 25, null, new Date().toISOString()]
      );

      const performance = analytics.getScrapingPerformance(7);

      if (performance) {
        expect(performance).toHaveProperty("avgResponseTime");
        expect(performance).toHaveProperty("successRate");
        expect(performance).toHaveProperty("errorRate");
        expect(performance).toHaveProperty("itemsPerSecond");

        // Generate performance report
        const report = reportGenerator.generateComprehensiveReport(
          {
            metrics: await dashboard.getMetrics(),
            performance: {
              scraping: performance,
              database: {
                queryPerformance: 85,
                indexEfficiency: 90,
                size: analytics.getDatabaseHealth().totalSize,
              },
            },
            generatedAt: new Date(),
          },
          "markdown",
          { reportType: "technical" }
        );

        expect(report).toContain("Technical Analytics Report");
        expect(report).toContain("System Performance");
      }
    });
  });

  describe("Error Recovery Workflow", () => {
    it("should handle and recover from errors gracefully", async () => {
      // Test with invalid database
      const invalidDb = new Database(":memory:");
      await invalidDb.initialize();

      const emptyAnalytics = new DatabaseAnalytics(invalidDb);
      const emptyDashboard = new AnalyticsDashboard(emptyAnalytics);

      // Should handle empty data
      const emptyMetrics = await emptyDashboard.getMetrics();
      expect(emptyMetrics.overview.totalPosts).toBe(0);
      expect(emptyMetrics.overview.totalComments).toBe(0);

      // Should generate report even with empty data
      const emptyReport = reportGenerator.generateComprehensiveReport(
        { metrics: emptyMetrics, generatedAt: new Date() },
        "markdown"
      );
      expect(emptyReport).toContain("Executive Summary");
      expect(emptyReport).not.toContain("undefined");
      expect(emptyReport).not.toContain("NaN");

      await invalidDb.close();
    });

    it("should validate data integrity", async () => {
      const metrics = await dashboard.getMetrics();

      // Verify data consistency
      const postCount = await db.get(
        "SELECT COUNT(*) as count FROM posts"
      );
      const commentCount = await db.get(
        "SELECT COUNT(*) as count FROM comments"
      );
      const userCount = await db.get(
        "SELECT COUNT(*) as count FROM users"
      );

      expect(metrics.overview.totalPosts).toBe(postCount.count);
      expect(metrics.overview.totalComments).toBe(commentCount.count);
      expect(metrics.overview.totalUsers).toBe(userCount.count);
    });
  });
});

/**
 * Seed comprehensive test data for E2E tests
 */
async function seedComprehensiveTestData(db: Database): Promise<void> {
  // Create diverse user base
  const platforms = ["reddit", "hackernews", "lobsters", "lemmy"];
  const users: User[] = [];

  for (let i = 0; i < 50; i++) {
    const platform = platforms[i % platforms.length];
    users.push({
      username: `user_${i}`,
      karma: Math.floor(Math.random() * 10000),
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      platform,
    });
  }

  for (const user of users) {
    await db.run(
      `INSERT OR IGNORE INTO users (username, karma, created_at, platform)
       VALUES (?, ?, ?, ?)`,
      [user.username, user.karma, user.created_at.toISOString(), user.platform]
    );
  }

  // Create posts with realistic distribution over time
  const now = Date.now();
  for (let i = 0; i < 500; i++) {
    const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
    const hoursOffset = Math.floor(Math.random() * 24);
    const createdAt = new Date(now - (daysAgo * 24 + hoursOffset) * 60 * 60 * 1000);
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const author = users[Math.floor(Math.random() * users.length)];

    // Create realistic score distribution (power law)
    const score = Math.floor(Math.exp(Math.random() * 6));
    const commentCount = Math.floor(Math.exp(Math.random() * 4));

    await db.run(
      `INSERT OR IGNORE INTO posts (id, platform, title, url, author, score, comment_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `e2e-post-${i}`,
        platform,
        `Test Post ${i} - ${platform}`,
        `http://example.com/post/${i}`,
        author.username,
        score,
        commentCount,
        createdAt.toISOString(),
      ]
    );

    // Add comments for posts
    for (let j = 0; j < Math.min(commentCount, 10); j++) {
      const commentAuthor = users[Math.floor(Math.random() * users.length)];
      const commentCreated = new Date(
        createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000
      );

      await db.run(
        `INSERT OR IGNORE INTO comments (id, post_id, parent_id, author, content, score, created_at, platform)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `e2e-comment-${i}-${j}`,
          `e2e-post-${i}`,
          null,
          commentAuthor.username,
          `Test comment ${j} on post ${i}`,
          Math.floor(Math.random() * 100),
          commentCreated.toISOString(),
          platform,
        ]
      );
    }
  }

  // Add some trending posts
  for (let i = 0; i < 10; i++) {
    const trendingCreated = new Date(now - Math.random() * 2 * 24 * 60 * 60 * 1000);
    await db.run(
      `INSERT OR IGNORE INTO posts (id, platform, title, url, author, score, comment_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `trending-${i}`,
        "reddit",
        `Trending Post ${i}`,
        `http://example.com/trending/${i}`,
        users[0].username,
        1000 + i * 100,
        50 + i * 10,
        trendingCreated.toISOString(),
      ]
    );
  }
}