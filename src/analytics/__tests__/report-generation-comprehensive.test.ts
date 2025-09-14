/**
 * Comprehensive Tests for Enhanced Report Generator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReportGenerator } from "../report-generator.js";
import type { DashboardMetrics } from "../dashboard.js";

describe("ReportGenerator - Comprehensive Enhancements", () => {
  let mockAnalytics: any;
  let generator: ReportGenerator;
  let mockMetrics: DashboardMetrics;

  beforeEach(() => {
    // Create comprehensive mock data
    mockMetrics = {
      overview: {
        totalPosts: 10000,
        totalComments: 50000,
        totalUsers: 2000,
        avgEngagement: 0.75,
        growthRate: 12.5,
      },
      platformBreakdown: new Map([
        ["reddit", {
          platform: "reddit",
          totalPosts: 6000,
          totalComments: 30000,
          totalUsers: 1200,
          avgScore: 25.5,
          avgCommentCount: 5,
          mostActiveUser: { username: "poweruser", posts: 100, comments: 500 },
          lastUpdateTime: new Date(),
        }],
        ["hackernews", {
          platform: "hackernews",
          totalPosts: 4000,
          totalComments: 20000,
          totalUsers: 800,
          avgScore: 30.2,
          avgCommentCount: 5,
          mostActiveUser: null,
          lastUpdateTime: new Date(),
        }],
      ]),
      timeSeries: [
        { timestamp: new Date("2024-01-01"), posts: 100, comments: 500, users: 50, avgScore: 20 },
        { timestamp: new Date("2024-01-02"), posts: 150, comments: 700, users: 60, avgScore: 25 },
        { timestamp: new Date("2024-01-03"), posts: 200, comments: 900, users: 70, avgScore: 30 },
      ],
      trends: {
        rising: [],
        declining: [],
        predictions: [],
      },
      health: {
        databaseSize: 2500000000,
        lastUpdate: new Date(),
        gaps: [],
        dataQuality: 85,
      },
    };

    mockAnalytics = {
      getPlatformStats: vi.fn(),
      getTrendingPosts: vi.fn().mockReturnValue([]),
      getPostsByDateRange: vi.fn().mockReturnValue([]),
    };

    generator = new ReportGenerator(mockAnalytics);
  });

  describe("Executive Summary Enhancements", () => {
    it("should generate executive insights with summary and recommendations", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Executive Overview");
      expect(report).toContain("Key Performance Indicators");
      expect(report).toContain("Strategic Recommendations");
      expect(report).toContain("strong growth with high user engagement");
    });

    it("should calculate KPIs correctly", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Content Velocity");
      expect(report).toContain("Engagement Rate");
      expect(report).toContain("Platform Diversity");
      expect(report).toContain("Data Freshness");
      expect(report).toContain("Growth Momentum");
    });

    it("should identify key trends", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Key Trends & Insights");
      expect(report).toContain("Strong growth momentum");
      expect(report).toContain("reddit is the dominant platform");
    });

    it("should provide quality indicators", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Data Quality Score: 85/100");
      expect(report).toMatch(/[🟢🟡🟠🔴]/); // Should contain quality indicator emoji
    });
  });

  describe("Detailed Statistical Breakdowns", () => {
    it("should generate comprehensive statistical summary", () => {
      const breakdown = generator.generateDetailedBreakdown(mockMetrics);

      expect(breakdown).toContain("Statistical Summary");
      expect(breakdown).toContain("Central Tendency");
      expect(breakdown).toContain("Mean Score");
      expect(breakdown).toContain("Median Score");
      expect(breakdown).toContain("Standard Deviation");
      expect(breakdown).toContain("Skewness");
      expect(breakdown).toContain("Kurtosis");
    });

    it("should analyze distributions", () => {
      const breakdown = generator.generateDetailedBreakdown(mockMetrics);

      expect(breakdown).toContain("Distribution Analysis");
      expect(breakdown).toContain("Platform Distribution");
      expect(breakdown).toContain("Temporal Distribution");
      expect(breakdown).toContain("Engagement Distribution");
      expect(breakdown).toContain("Score Distribution");
    });

    it("should generate correlation analysis", () => {
      const breakdown = generator.generateDetailedBreakdown(mockMetrics);

      expect(breakdown).toContain("Correlation Analysis");
      expect(breakdown).toContain("Strong Positive Correlations");
      expect(breakdown).toContain("Key Insights");
    });

    it("should provide predictive insights", () => {
      const breakdown = generator.generateDetailedBreakdown(mockMetrics);

      expect(breakdown).toContain("Predictive Analytics");
      expect(breakdown).toContain("Growth Predictions");
      expect(breakdown).toContain("Next 7 Days");
      expect(breakdown).toContain("Next 30 Days");
      expect(breakdown).toContain("Confidence Level");
      expect(breakdown).toContain("Risk Factors");
    });

    it("should allow selective section generation", () => {
      const breakdown = generator.generateDetailedBreakdown(mockMetrics, {
        includeStatistics: true,
        includeDistributions: false,
        includeCorrelations: false,
        includePredictions: true,
      });

      expect(breakdown).toContain("Statistical Summary");
      expect(breakdown).not.toContain("Distribution Analysis");
      expect(breakdown).not.toContain("Correlation Analysis");
      expect(breakdown).toContain("Predictive Analytics");
    });
  });

  describe("Actionable Insights Engine", () => {
    it("should generate priority actions with impact and effort", () => {
      const data = {
        metrics: { ...mockMetrics, overview: { ...mockMetrics.overview, growthRate: -5 } },
        performance: { scraping: { errorRate: 15 } },
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Priority Actions");
      expect(report).toContain("Reverse Negative Growth Trend");
      expect(report).toContain("Impact:");
      expect(report).toContain("Effort:");
    });

    it("should identify optimization opportunities", () => {
      const data = {
        metrics: { ...mockMetrics, overview: { ...mockMetrics.overview, avgEngagement: 0.3 } },
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Optimization Opportunities");
      expect(report).toContain("Increase scraping frequency");
    });

    it("should provide risk mitigation strategies", () => {
      const data = {
        metrics: { ...mockMetrics, health: { ...mockMetrics.health, databaseSize: 4000000000 } },
        performance: { database: { queryPerformance: 60 } },
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Risk Mitigation");
      expect(report).toContain("Storage Capacity");
      expect(report).toContain("Implement data archiving strategy");
    });

    it("should generate strategic recommendations", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateDashboardReport(data, "markdown");

      expect(report).toContain("Long-term Strategic Recommendations");
      expect(report).toContain("Develop predictive models");
      expect(report).toContain("Implement real-time analytics dashboard");
    });
  });

  describe("Comprehensive Report Generation", () => {
    it("should generate executive report type", () => {
      const data = {
        metrics: mockMetrics,
        trending: { rising: [], declining: [], predictions: [] },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "executive",
      });

      expect(report).toContain("Executive Analytics Summary");
      expect(report).toContain("Executive Summary");
      expect(report).toContain("Platform Overview");
      expect(report).not.toContain("Statistical Analysis");
    });

    it("should generate technical report type", () => {
      const data = {
        metrics: mockMetrics,
        performance: {
          scraping: { successRate: 0.95, avgResponseTime: 200, errorRate: 5 },
          database: { queryPerformance: 85, indexEfficiency: 90, size: 1000000 },
        },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "technical",
      });

      expect(report).toContain("Technical Analytics Report");
      expect(report).toContain("Statistical Analysis");
      expect(report).toContain("System Architecture Analysis");
      expect(report).toContain("Data Pipeline Health");
      expect(report).toContain("Scalability Assessment");
    });

    it("should generate detailed report type", () => {
      const data = {
        metrics: mockMetrics,
        comparative: { comparison: [], insights: [] },
        trending: { rising: [], declining: [], predictions: [] },
        performance: { scraping: {}, database: {} },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "detailed",
      });

      expect(report).toContain("Comprehensive Analytics Report");
      expect(report).toContain("Table of Contents");
      expect(report).toContain("Statistical Analysis");
      expect(report).toContain("Platform Overview");
    });

    it("should support section filtering", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        includeSections: ["Executive Summary", "Platform Overview"],
      });

      expect(report).toContain("Executive Summary");
      expect(report).toContain("Platform Overview");
      expect(report).not.toContain("Statistical Analysis");
    });

    it("should support section exclusion", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        excludeSections: ["Platform Overview"],
      });

      expect(report).toContain("Executive Summary");
      expect(report).not.toContain("Platform Overview");
    });
  });

  describe("Enhanced Report Formatting", () => {
    it("should generate enhanced markdown with metadata", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown");

      expect(report).toContain("Report Metadata");
      expect(report).toContain("| Property | Value |");
      expect(report).toContain("| Generated |");
      expect(report).toContain("| Platforms |");
      expect(report).toContain("| Version | 2.0 |");
    });

    it("should generate enhanced HTML with styles", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "html");

      expect(report).toContain("<!DOCTYPE html>");
      expect(report).toContain('<style>');
      expect(report).toContain('class="report-header"');
      expect(report).toContain('class="report-section');
      expect(report).toContain('class="table-of-contents"');
      expect(report).toContain('<script>');
    });

    it("should generate structured JSON format", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "json");
      const parsed = JSON.parse(report);

      expect(parsed).toHaveProperty("metadata");
      expect(parsed).toHaveProperty("summary");
      expect(parsed).toHaveProperty("sections");
      expect(parsed).toHaveProperty("insights");
      expect(parsed.metadata).toHaveProperty("title");
      expect(parsed.metadata).toHaveProperty("generatedAt");
    });

    it("should include table of contents for detailed reports", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "detailed",
      });

      expect(report).toContain("Table of Contents");
      expect(report).toMatch(/\d+\. \[.*\]\(#.*\)/); // Markdown TOC format
    });

    it("should handle HTML conversion from markdown content", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "html", {
        reportType: "executive",
      });

      expect(report).toContain("<strong>");
      expect(report).toContain("<h2>");
      expect(report).toContain("<ul>");
    });
  });

  describe("Technical Insights", () => {
    it("should calculate database efficiency", () => {
      const data = {
        metrics: mockMetrics,
        performance: {
          database: { queryPerformance: 90, indexEfficiency: 85 },
        },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "technical",
      });

      expect(report).toContain("Database Efficiency: 88%");
    });

    it("should assess current load", () => {
      const data = {
        metrics: { ...mockMetrics, health: { ...mockMetrics.health, databaseSize: 500000000 } },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "technical",
      });

      expect(report).toContain("Current Load: Low");
    });

    it("should calculate capacity utilization", () => {
      const data = {
        metrics: { ...mockMetrics, health: { ...mockMetrics.health, databaseSize: 5000000000 } },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "technical",
      });

      expect(report).toContain("Capacity Utilization: 50%");
    });

    it("should provide scaling recommendations", () => {
      const data = {
        metrics: { ...mockMetrics, health: { ...mockMetrics.health, databaseSize: 8000000000 } },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "technical",
      });

      expect(report).toContain("Consider horizontal scaling");
    });
  });

  describe("Report Completeness Validation", () => {
    it("should include all required sections for executive report", () => {
      const data = {
        metrics: mockMetrics,
        trending: { rising: [], declining: [], predictions: [] },
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown", {
        reportType: "executive",
      });

      const requiredSections = [
        "Executive Summary",
        "Platform Overview",
        "Actionable Insights & Recommendations",
      ];

      requiredSections.forEach(section => {
        expect(report).toContain(section);
      });
    });

    it("should handle missing data gracefully", () => {
      const minimalMetrics = {
        ...mockMetrics,
        timeSeries: [],
        platformBreakdown: new Map(),
      };

      const data = {
        metrics: minimalMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown");

      expect(report).toBeDefined();
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain("Executive Summary");
    });

    it("should format numbers consistently", () => {
      const data = {
        metrics: mockMetrics,
        generatedAt: new Date(),
      };

      const report = generator.generateComprehensiveReport(data, "markdown");

      expect(report).toMatch(/10K/); // 10000 posts formatted
      expect(report).toMatch(/50K/); // 50000 comments formatted
      expect(report).toMatch(/\d+\.\d+%/); // Percentages with decimal
    });
  });
});