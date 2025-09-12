/**
 * Tests for Report Generator
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ReportGenerator } from "../report-generator.js";
import type {
  ReportConfig,
  ReportTemplate,
  ScheduledReport,
} from "../report-generator.js";

describe("ReportGenerator", () => {
  let mockAnalytics: any;
  let generator: ReportGenerator;

  beforeEach(() => {
    // Create mock analytics
    mockAnalytics = {
      getPlatformStats: vi.fn().mockReturnValue({
        platform: "reddit",
        totalPosts: 1000,
        totalComments: 5000,
        totalUsers: 500,
        avgScore: 25.5,
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
        },
      ]),
      getMostEngagedPosts: vi.fn().mockReturnValue([]),
      getPostsByDateRange: vi.fn().mockReturnValue([]),
      getDatabaseHealth: vi.fn().mockReturnValue({
        databaseSize: 1000000,
        lastUpdate: new Date(),
        newestPost: new Date(),
      }),
      getDataGaps: vi.fn().mockReturnValue([]),
      getEngagementStats: vi.fn().mockReturnValue({
        avgEngagement: 0.5,
      }),
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

    generator = new ReportGenerator(mockAnalytics as any);
  });

  afterEach(() => {
    // Clean up timers
    generator.cleanup();
    vi.clearAllTimers();
  });

  describe("Template Management", () => {
    it("should initialize with default templates", () => {
      const templates = generator.getTemplates();

      expect(templates.has("executive")).toBe(true);
      expect(templates.has("detailed")).toBe(true);
      expect(templates.has("dashboard")).toBe(true);
    });

    it("should register custom template", () => {
      const customTemplate: ReportTemplate = {
        name: "Custom Report",
        description: "My custom template",
        layout: "single-column",
        theme: "light",
        sections: [
          {
            id: "section1",
            title: "Section 1",
            type: "text",
            dataSource: "data",
          },
        ],
      };

      generator.registerTemplate("custom", customTemplate);
      const retrieved = generator.getTemplate("custom");

      expect(retrieved).toEqual(customTemplate);
    });

    it("should validate template correctly", () => {
      const validTemplate: ReportTemplate = {
        name: "Valid Template",
        sections: [
          {
            id: "section1",
            title: "Section 1",
            type: "text",
          },
        ],
      };

      const validation = generator.validateTemplate(validTemplate);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect invalid template", () => {
      const invalidTemplate: ReportTemplate = {
        name: "",
        sections: [],
      };

      const validation = generator.validateTemplate(invalidTemplate);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Template must have a name");
      expect(validation.errors).toContain(
        "Template must have at least one section",
      );
    });

    it("should validate dashboard layout positions", () => {
      const dashboardTemplate: ReportTemplate = {
        name: "Dashboard",
        layout: "dashboard",
        sections: [
          {
            id: "section1",
            title: "Section 1",
            type: "metric",
            position: { row: 0, col: 0 },
          },
          {
            id: "section2",
            title: "Section 2",
            type: "metric",
            position: { row: 0, col: 0 }, // Conflict!
          },
        ],
      };

      const validation = generator.validateTemplate(dashboardTemplate);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Position conflict at row 0, col 0");
    });
  });

  describe("Report Generation", () => {
    it("should generate dashboard report in markdown", () => {
      const mockData = {
        metrics: {
          overview: {
            totalPosts: 1000,
            totalComments: 5000,
            totalUsers: 500,
            avgEngagement: 0.75,
            growthRate: 5.5,
          },
          platformBreakdown: new Map([
            ["reddit", mockAnalytics.getPlatformStats()],
          ]),
          trending: mockAnalytics.getTrendingPosts(),
          timeSeries: mockAnalytics.getTimeSeriesData(),
          topPerformers: {
            posts: [],
            authors: [],
          },
          health: {
            databaseSize: 1000000,
            lastUpdate: new Date(),
            dataQuality: 85,
            gaps: [],
          },
        },
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(mockData, "markdown");

      expect(report).toContain("# Analytics Dashboard Report");
      expect(report).toContain("Executive Summary");
      expect(report).toContain("Total Posts:");
      expect(report).toContain("1000");
    });

    it("should generate dashboard report in HTML", () => {
      const mockData = {
        metrics: {
          overview: {
            totalPosts: 1000,
            totalComments: 5000,
            totalUsers: 500,
            avgEngagement: 0.75,
            growthRate: 5.5,
          },
          platformBreakdown: new Map([
            ["reddit", mockAnalytics.getPlatformStats()],
          ]),
          trending: [],
          timeSeries: [],
          topPerformers: {
            posts: [],
            authors: [],
          },
          health: {
            databaseSize: 1000000,
            lastUpdate: new Date(),
            dataQuality: 85,
            gaps: [],
          },
        },
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(mockData, "html");

      expect(report).toContain("<!DOCTYPE html>");
      expect(report).toContain("<title>Analytics Dashboard Report</title>");
      expect(report).toContain("<h1>Analytics Dashboard Report</h1>");
      expect(report).toContain("Executive Summary");
    });

    it("should generate dashboard report in JSON", () => {
      const mockData = {
        metrics: {
          overview: {
            totalPosts: 1000,
            totalComments: 5000,
            totalUsers: 500,
            avgEngagement: 0.75,
            growthRate: 5.5,
          },
          platformBreakdown: new Map(),
          trending: [],
          timeSeries: [],
          topPerformers: {
            posts: [],
            authors: [],
          },
          health: {
            databaseSize: 1000000,
            lastUpdate: new Date(),
            dataQuality: 85,
            gaps: [],
          },
        },
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(mockData, "json");
      const parsed = JSON.parse(report);

      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("sections");
      expect(parsed).toHaveProperty("generatedAt");
    });

    it("should generate platform-specific report", () => {
      const stats = mockAnalytics.getPlatformStats();
      const additionalData = {
        trending: mockAnalytics.getTrendingPosts(),
        topAuthors: mockAnalytics.getTopAuthors(),
        timeSeries: mockAnalytics.getTimeSeriesData(),
      };

      const report = generator.generatePlatformReport(
        "reddit",
        stats,
        additionalData,
        "markdown",
      );

      expect(report).toContain("# reddit Analytics Report");
      expect(report).toContain("REDDIT Platform Summary");
      expect(report).toContain("Trending Content");
      expect(report).toContain("Top Contributors");
    });

    it("should generate custom report", () => {
      const report = generator.generateCustomReport(
        "Custom Analysis",
        {
          platforms: ["reddit"],
          dateRange: {
            start: new Date("2024-01-01"),
            end: new Date("2024-01-31"),
          },
          limit: 10,
        },
        "markdown",
      );

      expect(report).toContain("# Custom Analysis");
      expect(report).toContain("reddit Statistics");
    });

    it("should respect config options", () => {
      const mockData = {
        metrics: {
          overview: {
            totalPosts: 1000,
            totalComments: 5000,
            totalUsers: 500,
            avgEngagement: 0.75,
            growthRate: 5.5,
          },
          platformBreakdown: new Map(),
          trending: [],
          timeSeries: [],
          topPerformers: {
            posts: [],
            authors: [],
          },
          health: {
            databaseSize: 1000000,
            lastUpdate: new Date(),
            dataQuality: 85,
            gaps: [],
          },
        },
        generatedAt: new Date(),
      };

      const config: ReportConfig = {
        includeSummary: false,
        includeCharts: false,
        includeRecommendations: false,
      };

      const report = generator.generateDashboardReport(
        mockData,
        "markdown",
        config,
      );

      expect(report).not.toContain("Executive Summary");
      expect(report).not.toContain("Recommendations");
    });
  });

  describe("Template-based Generation", () => {
    it("should generate report from template", async () => {
      const data = {
        metrics: {
          totalPosts: 1000,
          totalUsers: 500,
          avgEngagement: 0.75,
        },
        overview: "Test overview",
        trending: [],
      };

      const report = await generator.generateFromTemplate(
        "executive",
        data,
        "markdown",
      );

      expect(report).toContain("Executive Summary");
      expect(report).toBeDefined();
    });

    it("should throw error for non-existent template", async () => {
      await expect(
        generator.generateFromTemplate("nonexistent", {}, "markdown"),
      ).rejects.toThrow("Template 'nonexistent' not found");
    });

    it("should apply conditional sections", async () => {
      const template: ReportTemplate = {
        name: "Conditional Template",
        sections: [
          {
            id: "always",
            title: "Always Show",
            type: "text",
            dataSource: "message",
          },
          {
            id: "conditional",
            title: "Conditional",
            type: "text",
            dataSource: "conditionalMessage",
            condition: (data) => data.showConditional === true,
          },
        ],
      };

      generator.registerTemplate("conditional", template);

      const dataWithCondition = {
        message: "Always visible",
        conditionalMessage: "Sometimes visible",
        showConditional: true,
      };

      const dataWithoutCondition = {
        message: "Always visible",
        conditionalMessage: "Sometimes visible",
        showConditional: false,
      };

      const report1 = await generator.generateFromTemplate(
        "conditional",
        dataWithCondition,
        "markdown",
      );
      const report2 = await generator.generateFromTemplate(
        "conditional",
        dataWithoutCondition,
        "markdown",
      );

      expect(report1).toContain("Always Show");
      expect(report1).toContain("Sometimes visible");
      expect(report2).toContain("Always Show");
      expect(report2).not.toContain("Sometimes visible");
    });

    it("should extract nested data from source path", async () => {
      const template: ReportTemplate = {
        name: "Nested Data",
        sections: [
          {
            id: "nested",
            title: "Nested Value",
            type: "metric",
            dataSource: "deeply.nested.value",
          },
        ],
      };

      generator.registerTemplate("nested", template);

      const data = {
        deeply: {
          nested: {
            value: 42,
          },
        },
      };

      const report = await generator.generateFromTemplate(
        "nested",
        data,
        "markdown",
      );

      expect(report).toContain("Nested Value");
      expect(report).toContain("42");
    });

    it("should apply template theme and layout", async () => {
      const template: ReportTemplate = {
        name: "Themed Report",
        theme: "dark",
        layout: "two-column",
        sections: [
          {
            id: "section1",
            title: "Section 1",
            type: "text",
            dataSource: "data",
          },
        ],
      };

      generator.registerTemplate("themed", template);

      const report = await generator.generateFromTemplate(
        "themed",
        { data: "Test content" },
        "html",
      );

      expect(report).toContain('class="theme-dark"');
      expect(report).toContain('class="layout-two-column"');
      expect(report).toContain("grid-template-columns: 1fr 1fr");
    });
  });

  describe("Report Scheduling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should schedule a report", () => {
      const scheduledReport: ScheduledReport = {
        id: "daily-report",
        name: "Daily Summary",
        template: "executive",
        schedule: {
          type: "daily",
          time: "09:00",
        },
        format: "markdown",
        enabled: true,
      };

      generator.scheduleReport(scheduledReport);
      const scheduled = generator.getScheduledReports();

      expect(scheduled.has("daily-report")).toBe(true);
      expect(scheduled.get("daily-report")?.nextRun).toBeDefined();
    });

    it("should not start disabled scheduled report", () => {
      const scheduledReport: ScheduledReport = {
        id: "disabled-report",
        name: "Disabled Report",
        template: "executive",
        schedule: {
          type: "daily",
        },
        format: "markdown",
        enabled: false,
      };

      generator.scheduleReport(scheduledReport);
      const scheduled = generator.getScheduledReports();

      expect(scheduled.has("disabled-report")).toBe(true);
      expect(scheduled.get("disabled-report")?.nextRun).toBeUndefined();
    });

    it("should update scheduled report", () => {
      const scheduledReport: ScheduledReport = {
        id: "update-test",
        name: "Update Test",
        template: "executive",
        schedule: {
          type: "daily",
        },
        format: "markdown",
        enabled: false,
      };

      generator.scheduleReport(scheduledReport);
      generator.updateScheduledReport("update-test", {
        enabled: true,
        name: "Updated Name",
      });

      const updated = generator.getScheduledReports().get("update-test");
      expect(updated?.enabled).toBe(true);
      expect(updated?.name).toBe("Updated Name");
    });

    it("should delete scheduled report", () => {
      const scheduledReport: ScheduledReport = {
        id: "delete-test",
        name: "Delete Test",
        template: "executive",
        schedule: {
          type: "daily",
        },
        format: "markdown",
        enabled: true,
      };

      generator.scheduleReport(scheduledReport);
      expect(generator.getScheduledReports().has("delete-test")).toBe(true);

      generator.deleteScheduledReport("delete-test");
      expect(generator.getScheduledReports().has("delete-test")).toBe(false);
    });

    it("should calculate correct intervals", () => {
      const dailyReport: ScheduledReport = {
        id: "daily",
        name: "Daily",
        template: "executive",
        schedule: { type: "daily" },
        format: "markdown",
        enabled: true,
      };

      const weeklyReport: ScheduledReport = {
        id: "weekly",
        name: "Weekly",
        template: "executive",
        schedule: { type: "weekly" },
        format: "markdown",
        enabled: true,
      };

      const monthlyReport: ScheduledReport = {
        id: "monthly",
        name: "Monthly",
        template: "executive",
        schedule: { type: "monthly" },
        format: "markdown",
        enabled: true,
      };

      generator.scheduleReport(dailyReport);
      generator.scheduleReport(weeklyReport);
      generator.scheduleReport(monthlyReport);

      const daily = generator.getScheduledReports().get("daily");
      const weekly = generator.getScheduledReports().get("weekly");
      const monthly = generator.getScheduledReports().get("monthly");

      // Check next run times are set correctly
      expect(daily?.nextRun).toBeDefined();
      expect(weekly?.nextRun).toBeDefined();
      expect(monthly?.nextRun).toBeDefined();

      // Daily should be ~24 hours from now
      const dailyDiff = daily!.nextRun!.getTime() - Date.now();
      expect(dailyDiff).toBeCloseTo(24 * 60 * 60 * 1000, -3);

      // Weekly should be ~7 days from now
      const weeklyDiff = weekly!.nextRun!.getTime() - Date.now();
      expect(weeklyDiff).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3);

      // Monthly should be ~30 days from now
      const monthlyDiff = monthly!.nextRun!.getTime() - Date.now();
      expect(monthlyDiff).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -3);
    });
  });

  describe("Data Export", () => {
    it("should export data as CSV", async () => {
      const data = {
        overview: {
          totalPosts: 1000,
          totalComments: 5000,
        },
      };

      const buffer = await generator.exportData(data, "csv");
      const csv = buffer.toString();

      expect(csv).toContain("overview.totalPosts,overview.totalComments");
      expect(csv).toContain("1000,5000");
    });

    it("should export data as JSON", async () => {
      const data = {
        totalPosts: 1000,
        totalComments: 5000,
      };

      const buffer = await generator.exportData(data, "json");
      const json = JSON.parse(buffer.toString());

      expect(json.totalPosts).toBe(1000);
      expect(json.totalComments).toBe(5000);
    });

    it("should export array data as CSV", async () => {
      const data = [
        { name: "Item 1", value: 100 },
        { name: "Item 2", value: 200 },
      ];

      const buffer = await generator.exportData(data, "csv");
      const csv = buffer.toString();

      expect(csv).toContain("name,value");
      expect(csv).toContain("Item 1,100");
      expect(csv).toContain("Item 2,200");
    });

    it("should escape CSV values correctly", async () => {
      const data = [
        { name: "Item with, comma", value: 100 },
        { name: 'Item with "quotes"', value: 200 },
      ];

      const buffer = await generator.exportData(data, "csv");
      const csv = buffer.toString();

      expect(csv).toContain('"Item with, comma"');
      expect(csv).toContain('"Item with ""quotes"""');
    });
  });

  describe("PDF Generation", () => {
    it("should generate PDF report (placeholder)", async () => {
      const data = {
        metrics: {
          totalPosts: 1000,
          totalUsers: 500,
          avgEngagement: 0.75,
        },
      };

      const buffer = await generator.generatePDFReport("Test PDF", data);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // Since it's a placeholder returning HTML, check for HTML content
      expect(buffer.toString()).toContain("<!DOCTYPE html>");
    });
  });

  describe("Resource Cleanup", () => {
    it("should clean up all timers on cleanup", () => {
      const report1: ScheduledReport = {
        id: "cleanup1",
        name: "Cleanup 1",
        template: "executive",
        schedule: { type: "daily" },
        format: "markdown",
        enabled: true,
      };

      const report2: ScheduledReport = {
        id: "cleanup2",
        name: "Cleanup 2",
        template: "executive",
        schedule: { type: "weekly" },
        format: "markdown",
        enabled: true,
      };

      generator.scheduleReport(report1);
      generator.scheduleReport(report2);

      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      generator.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing template gracefully", async () => {
      await expect(
        generator.generateFromTemplate("nonexistent", {}, "markdown"),
      ).rejects.toThrow();
    });

    it("should validate report schedule has ID", () => {
      const invalidReport: ScheduledReport = {
        id: "",
        name: "Invalid",
        template: "executive",
        schedule: { type: "daily" },
        format: "markdown",
        enabled: true,
      };

      expect(() => generator.scheduleReport(invalidReport)).toThrow(
        "Scheduled report must have an id",
      );
    });

    it("should handle update of non-existent scheduled report", () => {
      expect(() =>
        generator.updateScheduledReport("nonexistent", { name: "New Name" }),
      ).toThrow("Scheduled report 'nonexistent' not found");
    });
  });
});
