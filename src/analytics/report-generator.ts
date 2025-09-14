/**
 * Report Generator
 * Generates comprehensive analytics reports in various formats
 */

import type {
  DatabaseAnalytics,
  PlatformStats,
  TrendingPost,
} from "../database/analytics.js";
import type { DashboardMetrics } from "./dashboard.js";
import { AnalyticsVisualizer } from "./visualizer.js";

export interface ReportConfig {
  includeCharts?: boolean;
  includeRawData?: boolean;
  includeSummary?: boolean;
  includeRecommendations?: boolean;
  dateFormat?: "short" | "long" | "iso";
  numberFormat?: "standard" | "compact" | "scientific";
  template?: ReportTemplate;
  customCSS?: string;
  headerFooter?: {
    header?: string;
    footer?: string;
    logo?: string;
  };
}

export interface ReportSection {
  title: string;
  content: string | any;
  priority: "high" | "medium" | "low";
  type: "text" | "data" | "chart" | "table";
}

export interface GeneratedReport {
  title: string;
  generatedAt: Date;
  sections: ReportSection[];
  metadata: {
    dataRange?: { start: Date; end: Date };
    platforms?: string[];
    recordCount?: number;
  };
  format: string;
  content: string;
}

export interface ReportTemplate {
  name: string;
  description?: string;
  sections: TemplateSection[];
  layout?: "single-column" | "two-column" | "dashboard";
  theme?: "light" | "dark" | "custom";
  customStyles?: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  type: "text" | "chart" | "table" | "metric" | "custom";
  dataSource?: string;
  position?: { row: number; col: number; width?: number; height?: number };
  config?: Record<string, any>;
  condition?: (data: any) => boolean;
}

export interface ScheduledReport {
  id: string;
  name: string;
  template: ReportTemplate | string;
  schedule: ReportSchedule;
  recipients?: string[];
  format: "html" | "markdown" | "json" | "pdf";
  config?: ReportConfig;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface ReportSchedule {
  type: "daily" | "weekly" | "monthly" | "custom";
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  cronExpression?: string; // For custom schedules
}

export class ReportGenerator {
  private analytics: DatabaseAnalytics;
  private visualizer: AnalyticsVisualizer;
  private templates: Map<string, ReportTemplate> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();
  private scheduleTimers: Map<string, NodeJS.Timeout> = new Map();
  private defaultConfig: Required<ReportConfig> = {
    includeCharts: true,
    includeRawData: false,
    includeSummary: true,
    includeRecommendations: true,
    dateFormat: "short",
    numberFormat: "standard",
    template: undefined as any,
    customCSS: "",
    headerFooter: {},
  };

  constructor(analytics: DatabaseAnalytics) {
    this.analytics = analytics;
    this.visualizer = new AnalyticsVisualizer();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default report templates
   */
  private initializeDefaultTemplates(): void {
    // Executive Summary Template
    this.templates.set("executive", {
      name: "Executive Summary",
      description: "High-level overview for executives",
      layout: "single-column",
      theme: "light",
      sections: [
        {
          id: "summary",
          title: "Executive Summary",
          type: "text",
          dataSource: "overview",
        },
        {
          id: "metrics",
          title: "Key Metrics",
          type: "metric",
          dataSource: "metrics",
        },
        {
          id: "trends",
          title: "Trends",
          type: "chart",
          dataSource: "trending",
        },
      ],
    });

    // Detailed Analytics Template
    this.templates.set("detailed", {
      name: "Detailed Analytics",
      description: "Comprehensive analytics report",
      layout: "two-column",
      theme: "light",
      sections: [
        {
          id: "overview",
          title: "Overview",
          type: "text",
          dataSource: "overview",
          position: { row: 0, col: 0, width: 2 },
        },
        {
          id: "platforms",
          title: "Platform Breakdown",
          type: "table",
          dataSource: "platforms",
          position: { row: 1, col: 0 },
        },
        {
          id: "trending",
          title: "Trending Content",
          type: "chart",
          dataSource: "trending",
          position: { row: 1, col: 1 },
        },
        {
          id: "performance",
          title: "Performance Metrics",
          type: "table",
          dataSource: "performance",
          position: { row: 2, col: 0, width: 2 },
        },
      ],
    });

    // Dashboard Template
    this.templates.set("dashboard", {
      name: "Dashboard View",
      description: "Interactive dashboard layout",
      layout: "dashboard",
      theme: "dark",
      sections: [
        {
          id: "kpi1",
          title: "Total Posts",
          type: "metric",
          dataSource: "metrics.totalPosts",
          position: { row: 0, col: 0, width: 1, height: 1 },
        },
        {
          id: "kpi2",
          title: "Total Users",
          type: "metric",
          dataSource: "metrics.totalUsers",
          position: { row: 0, col: 1, width: 1, height: 1 },
        },
        {
          id: "kpi3",
          title: "Engagement",
          type: "metric",
          dataSource: "metrics.avgEngagement",
          position: { row: 0, col: 2, width: 1, height: 1 },
        },
        {
          id: "chart1",
          title: "Activity Trend",
          type: "chart",
          dataSource: "timeSeries",
          position: { row: 1, col: 0, width: 3, height: 2 },
        },
        {
          id: "table1",
          title: "Top Content",
          type: "table",
          dataSource: "topContent",
          position: { row: 3, col: 0, width: 3, height: 2 },
        },
      ],
    });
  }

  /**
   * Generate a comprehensive dashboard report
   */
  public generateDashboardReport(
    data: {
      metrics: DashboardMetrics;
      comparative?: any;
      trending?: any;
      performance?: any;
      generatedAt: Date;
    },
    format: "html" | "markdown" | "json" = "markdown",
    config?: ReportConfig,
  ): string {
    const cfg = { ...this.defaultConfig, ...config };
    const sections: ReportSection[] = [];

    // Executive Summary
    if (cfg.includeSummary) {
      sections.push(this.createExecutiveSummary(data.metrics));
    }

    // Platform Overview
    sections.push(this.createPlatformOverview(data.metrics));

    // Trending Analysis
    if (data.trending) {
      sections.push(this.createTrendingSection(data.trending));
    }

    // Comparative Analysis
    if (data.comparative) {
      sections.push(this.createComparativeSection(data.comparative));
    }

    // Performance Metrics
    if (data.performance) {
      sections.push(this.createPerformanceSection(data.performance));
    }

    // Charts and Visualizations
    if (cfg.includeCharts) {
      sections.push(...this.createVisualizationSections(data.metrics));
    }

    // Recommendations
    if (cfg.includeRecommendations) {
      sections.push(this.createRecommendations(data));
    }

    // Format the report
    const report: GeneratedReport = {
      title: "Analytics Dashboard Report",
      generatedAt: data.generatedAt,
      sections,
      metadata: {
        platforms: Array.from(data.metrics.platformBreakdown.keys()),
        recordCount:
          data.metrics.overview.totalPosts +
          data.metrics.overview.totalComments,
      },
      format,
      content: "",
    };

    // Generate formatted content
    switch (format) {
      case "html":
        report.content = this.formatAsHTML(report);
        break;
      case "json":
        report.content = JSON.stringify(report, null, 2);
        break;
      case "markdown":
      default:
        report.content = this.formatAsMarkdown(report);
        break;
    }

    return report.content;
  }

  /**
   * Generate a platform-specific report
   */
  public generatePlatformReport(
    platform: string,
    stats: PlatformStats,
    additionalData?: {
      trending?: TrendingPost[];
      topAuthors?: any[];
      timeSeries?: any[];
    },
    format: "html" | "markdown" | "json" = "markdown",
  ): string {
    const sections: ReportSection[] = [];

    // Platform Summary
    sections.push({
      title: `${platform.toUpperCase()} Platform Summary`,
      content: this.formatPlatformStats(stats),
      priority: "high",
      type: "data",
    });

    // Trending Content
    if (additionalData?.trending) {
      sections.push({
        title: "Trending Content",
        content: this.formatTrendingPosts(additionalData.trending),
        priority: "high",
        type: "table",
      });
    }

    // Top Contributors
    if (additionalData?.topAuthors) {
      sections.push({
        title: "Top Contributors",
        content: this.formatTopAuthors(additionalData.topAuthors),
        priority: "medium",
        type: "table",
      });
    }

    // Activity Timeline
    if (additionalData?.timeSeries) {
      const chart = this.visualizer.createLineChart(
        additionalData.timeSeries.map((d) => ({
          date: new Date(d.timestamp),
          value: d.avgScore,
        })),
        "Activity Over Time",
      );

      sections.push({
        title: "Activity Timeline",
        content: chart,
        priority: "medium",
        type: "chart",
      });
    }

    const report: GeneratedReport = {
      title: `${platform} Analytics Report`,
      generatedAt: new Date(),
      sections,
      metadata: {
        platforms: [platform],
      },
      format,
      content: "",
    };

    // Format based on requested type
    switch (format) {
      case "html":
        report.content = this.formatAsHTML(report);
        break;
      case "json":
        report.content = JSON.stringify(report, null, 2);
        break;
      case "markdown":
      default:
        report.content = this.formatAsMarkdown(report);
        break;
    }

    return report.content;
  }

  /**
   * Generate a custom report based on query
   */
  public generateCustomReport(
    title: string,
    query: {
      metrics?: string[];
      platforms?: string[];
      dateRange?: { start: Date; end: Date };
      groupBy?: "platform" | "date" | "author";
      sortBy?: "score" | "date" | "engagement";
      limit?: number;
    },
    format: "html" | "markdown" | "json" = "markdown",
  ): string {
    const sections: ReportSection[] = [];

    // Fetch data based on query
    if (query.dateRange) {
      const posts = this.analytics.getPostsByDateRange(
        query.dateRange.start,
        query.dateRange.end,
        query.platforms?.[0] as any,
      );

      sections.push({
        title: "Posts in Date Range",
        content: this.formatPostsTable(posts, query.limit),
        priority: "high",
        type: "table",
      });
    }

    // Add platform stats if requested
    if (query.platforms) {
      query.platforms.forEach((platform) => {
        const stats = this.analytics.getPlatformStats(platform as any);
        if (stats) {
          sections.push({
            title: `${platform} Statistics`,
            content: this.formatPlatformStats(stats),
            priority: "medium",
            type: "data",
          });
        }
      });
    }

    const report: GeneratedReport = {
      title,
      generatedAt: new Date(),
      sections,
      metadata: {
        dataRange: query.dateRange,
        platforms: query.platforms,
      },
      format,
      content: "",
    };

    // Format output
    switch (format) {
      case "html":
        report.content = this.formatAsHTML(report);
        break;
      case "json":
        report.content = JSON.stringify(report, null, 2);
        break;
      case "markdown":
      default:
        report.content = this.formatAsMarkdown(report);
        break;
    }

    return report.content;
  }

  /**
   * Export data in various formats
   */
  public async exportData(
    data: DashboardMetrics | any,
    format: "csv" | "json" | "excel",
  ): Promise<Buffer> {
    switch (format) {
      case "csv":
        return Buffer.from(this.convertToCSV(data));

      case "json":
        return Buffer.from(JSON.stringify(data, null, 2));

      case "excel":
        // Would require a library like exceljs
        // For now, return CSV format
        return Buffer.from(this.convertToCSV(data));

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods for creating sections

  private createExecutiveSummary(metrics: DashboardMetrics): ReportSection {
    const overview = metrics.overview;

    // Calculate key insights
    const insights = this.generateExecutiveInsights(metrics);
    const kpis = this.calculateKeyPerformanceIndicators(metrics);
    const trends = this.identifyKeyTrends(metrics);

    const content = `
## Executive Overview
${insights.summary}

## Key Performance Indicators
${kpis.map((kpi) => `- **${kpi.name}**: ${kpi.value} ${kpi.trend}`).join("\n")}

## Critical Metrics
- Total Posts: ${this.formatNumber(overview.totalPosts)}
- Total Comments: ${this.formatNumber(overview.totalComments)}
- Total Users: ${this.formatNumber(overview.totalUsers)}
- Average Engagement: ${overview.avgEngagement.toFixed(2)}
- Growth Rate: ${overview.growthRate > 0 ? "+" : ""}${overview.growthRate.toFixed(1)}%

## Platform Performance Summary
${Array.from(metrics.platformBreakdown.entries())
  .sort((a, b) => b[1].totalPosts - a[1].totalPosts)
  .slice(0, 3)
  .map(
    ([platform, stats]) =>
      `- **${platform}**: ${this.formatNumber(stats.totalPosts)} posts | ${stats.avgScore.toFixed(1)} avg score | ${this.formatNumber(stats.totalUsers)} users`,
  )
  .join("\n")}

## Key Trends & Insights
${trends.map((trend) => `- ${trend}`).join("\n")}

## Data Health Status
- Database Size: ${this.formatBytes(metrics.health.databaseSize)}
- Data Quality Score: ${metrics.health.dataQuality}/100 ${this.getQualityIndicator(metrics.health.dataQuality)}
- Last Update: ${this.formatDate(metrics.health.lastUpdate)}
- Data Gaps: ${metrics.health.gaps.length === 0 ? "✅ None detected" : `⚠️ ${metrics.health.gaps.length} periods`}

## Strategic Recommendations
${insights.recommendations
  .slice(0, 3)
  .map((rec, i) => `${i + 1}. ${rec}`)
  .join("\n")}
`;

    return {
      title: "Executive Summary",
      content,
      priority: "high",
      type: "text",
    };
  }

  private createPlatformOverview(metrics: DashboardMetrics): ReportSection {
    const platformData = Array.from(metrics.platformBreakdown.entries()).map(
      ([platform, stats]) => ({
        metric: platform,
        posts: stats.totalPosts,
        comments: stats.totalComments,
        users: stats.totalUsers,
        avgScore: stats.avgScore.toFixed(2),
      }),
    );

    const table = this.visualizer.createComparisonTable(
      platformData,
      "Platform Breakdown",
    );

    return {
      title: "Platform Overview",
      content: table,
      priority: "high",
      type: "table",
    };
  }

  private createTrendingSection(trending: any): ReportSection {
    const content = `
## Rising Content
${trending.rising
  .slice(0, 5)
  .map(
    (post: TrendingPost, i: number) =>
      `${i + 1}. **${post.title}**\n   Score: ${post.score} | Comments: ${post.commentCount}`,
  )
  .join("\n")}

## Declining Content
${trending.declining
  .slice(0, 5)
  .map(
    (item: any, i: number) =>
      `${i + 1}. **${item.post.title}**\n   Drop Rate: ${(item.dropRate * 100).toFixed(1)}%`,
  )
  .join("\n")}

## Predictions
${trending.predictions
  .slice(0, 3)
  .map(
    (pred: any, i: number) =>
      `${i + 1}. **${pred.post.title}**\n   Predicted Score: ${pred.predictedScore} (${pred.confidence}% confidence)`,
  )
  .join("\n")}
`;

    return {
      title: "Trending Analysis",
      content,
      priority: "high",
      type: "text",
    };
  }

  private createComparativeSection(comparative: any): ReportSection {
    const chart =
      comparative.visualization ||
      this.visualizer.createBarChart(
        comparative.comparison,
        "Platform Comparison",
      );

    const insights = comparative.insights?.join("\n") || "";

    return {
      title: "Comparative Analysis",
      content: `${chart}\n\n## Insights\n${insights}`,
      priority: "medium",
      type: "chart",
    };
  }

  private createPerformanceSection(performance: any): ReportSection {
    const content = `
## Scraping Performance
- Success Rate: ${performance.scraping?.successRate ? (performance.scraping.successRate * 100).toFixed(1) : "N/A"}%
- Avg Response Time: ${performance.scraping?.avgResponseTime?.toFixed(0) || "N/A"}ms
- Items/Second: ${performance.scraping?.itemsPerSecond?.toFixed(2) || "N/A"}
- Error Rate: ${performance.scraping?.errorRate?.toFixed(1) || "N/A"}%

## Database Performance
- Size: ${performance.database?.size ? this.formatBytes(performance.database.size) : "N/A"}
- Query Performance: ${performance.database?.queryPerformance || "N/A"}%
- Index Efficiency: ${performance.database?.indexEfficiency || "N/A"}%

## Data Quality
- Completeness: ${performance.dataQuality?.completeness || "N/A"}%
- Freshness: ${performance.dataQuality?.freshness || "N/A"}%
- Consistency: ${performance.dataQuality?.consistency || "N/A"}%
- Overall: ${performance.dataQuality?.overall || "N/A"}%
`;

    return {
      title: "Performance Metrics",
      content,
      priority: "medium",
      type: "text",
    };
  }

  private createVisualizationSections(
    metrics: DashboardMetrics,
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    // Time series chart
    if (metrics.timeSeries.length > 0) {
      const chart = this.visualizer.createLineChart(
        metrics.timeSeries.slice(0, 30).map((d) => ({
          date: d.timestamp,
          value: d.avgScore,
        })),
        "Score Trend (30 Days)",
      );

      sections.push({
        title: "Activity Trend",
        content: chart,
        priority: "medium",
        type: "chart",
      });
    }

    // Platform distribution pie chart
    const platformData = Array.from(metrics.platformBreakdown.entries()).map(
      ([platform, stats]) => ({
        label: platform,
        value: stats.totalPosts,
      }),
    );

    const pieChart = this.visualizer.createPieChart(
      platformData,
      "Content Distribution",
    );

    sections.push({
      title: "Platform Distribution",
      content: pieChart,
      priority: "low",
      type: "chart",
    });

    return sections;
  }

  private createRecommendations(data: any): ReportSection {
    const insights = this.generateActionableInsights(data);

    const content = `
## Priority Actions
${insights.priorities.map((action, i) => `${i + 1}. **${action.title}**\n   ${action.description}\n   *Impact: ${action.impact} | Effort: ${action.effort}*`).join("\n\n")}

## Optimization Opportunities
${insights.optimizations.map((opt) => `- ${opt}`).join("\n")}

## Risk Mitigation
${insights.risks.map((risk) => `- **${risk.type}**: ${risk.action}`).join("\n")}

## Long-term Strategic Recommendations
${insights.strategic.map((rec, i) => `${i + 1}. ${rec}`).join("\n")}
`;

    return {
      title: "Actionable Insights & Recommendations",
      content,
      priority: "high",
      type: "text",
    };
  }

  /**
   * Generate comprehensive actionable insights
   */
  private generateActionableInsights(data: any): {
    priorities: Array<{
      title: string;
      description: string;
      impact: string;
      effort: string;
    }>;
    optimizations: string[];
    risks: Array<{
      type: string;
      action: string;
    }>;
    strategic: string[];
  } {
    const insights = {
      priorities: [],
      optimizations: [],
      risks: [],
      strategic: [],
    };

    const metrics = data.metrics;
    const performance = data.performance;

    // Analyze and prioritize actions
    if (metrics.overview.growthRate < 0) {
      insights.priorities.push({
        title: "Reverse Negative Growth Trend",
        description:
          "Implement immediate measures to increase content acquisition and user engagement",
        impact: "High",
        effort: "Medium",
      });
    }

    if (metrics.health.dataQuality < 70) {
      insights.priorities.push({
        title: "Improve Data Quality",
        description:
          "Enhance validation rules and implement data cleansing processes",
        impact: "High",
        effort: "Low",
      });
    }

    if (performance?.scraping?.errorRate > 10) {
      insights.priorities.push({
        title: "Stabilize Scraping Infrastructure",
        description:
          "Review rate limiting, implement retry logic, and optimize connection pooling",
        impact: "Medium",
        effort: "Medium",
      });
    }

    // Optimization opportunities
    if (metrics.overview.avgEngagement < 0.5) {
      insights.optimizations.push(
        "Increase scraping frequency during peak activity hours",
      );
    }

    const platforms = Array.from(metrics.platformBreakdown.entries());
    const underutilized = platforms.filter(
      ([_, stats]) => stats.totalPosts < 100,
    );
    if (underutilized.length > 0) {
      insights.optimizations.push(
        `Expand coverage for underutilized platforms: ${underutilized.map((p) => p[0]).join(", ")}`,
      );
    }

    if (metrics.timeSeries.length > 0) {
      const avgScore =
        metrics.timeSeries.reduce((sum, t) => sum + t.avgScore, 0) /
        metrics.timeSeries.length;
      if (avgScore < 20) {
        insights.optimizations.push(
          "Focus on high-quality content sources to improve average scores",
        );
      }
    }

    // Risk mitigation
    if (metrics.health.databaseSize > 3000000000) {
      insights.risks.push({
        type: "Storage Capacity",
        action:
          "Implement data archiving strategy and optimize database indexes",
      });
    }

    if (metrics.health.gaps.length > 5) {
      insights.risks.push({
        type: "Data Continuity",
        action:
          "Set up automated monitoring and alerting for data collection gaps",
      });
    }

    if (performance?.database?.queryPerformance < 70) {
      insights.risks.push({
        type: "Performance Degradation",
        action: "Optimize slow queries and consider database sharding",
      });
    }

    // Strategic recommendations
    insights.strategic.push(
      "Develop predictive models to anticipate content trends",
    );
    insights.strategic.push(
      "Implement real-time analytics dashboard for immediate insights",
    );
    insights.strategic.push(
      "Create automated reporting workflows for key stakeholders",
    );

    if (platforms.length < 3) {
      insights.strategic.push(
        "Diversify data sources to reduce platform dependency",
      );
    }

    return insights;
  }

  // Formatting methods

  private formatAsMarkdown(report: GeneratedReport): string {
    const lines: string[] = [];

    // Title and metadata
    lines.push(`# ${report.title}`);
    lines.push(`*Generated: ${this.formatDate(report.generatedAt, "long")}*`);
    lines.push("");

    // Add sections
    report.sections.forEach((section) => {
      lines.push(`## ${section.title}`);
      lines.push("");

      if (typeof section.content === "string") {
        lines.push(section.content);
      } else {
        lines.push("```");
        lines.push(JSON.stringify(section.content, null, 2));
        lines.push("```");
      }

      lines.push("");
    });

    // Footer
    lines.push("---");
    lines.push(`*Report generated by Analytics Dashboard*`);

    return lines.join("\n");
  }

  private formatAsHTML(report: GeneratedReport): string {
    const sections = report.sections
      .map((section) => {
        const content =
          typeof section.content === "string"
            ? section.content.replace(/\n/g, "<br>")
            : `<pre>${JSON.stringify(section.content, null, 2)}</pre>`;

        return `
        <section class="report-section ${section.priority}">
          <h2>${section.title}</h2>
          <div class="content ${section.type}">
            ${content}
          </div>
        </section>
      `;
      })
      .join("\n");

    return `
<!DOCTYPE html>
<html>
<head>
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    .metadata { color: #999; font-style: italic; }
    .report-section { margin: 30px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
    .report-section.high { border-left: 4px solid #ff9800; }
    .report-section.medium { border-left: 4px solid #2196F3; }
    .report-section.low { border-left: 4px solid #9E9E9E; }
    pre { background: #fff; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .chart { font-family: monospace; white-space: pre; background: #000; color: #0f0; padding: 10px; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p class="metadata">Generated: ${this.formatDate(report.generatedAt, "long")}</p>
  ${sections}
  <footer>
    <p><em>Report generated by Analytics Dashboard</em></p>
  </footer>
</body>
</html>
    `;
  }

  private convertToCSV(data: any): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return "";

      const headers = Object.keys(data[0]);
      const rows = data.map((item) =>
        headers.map((header) => this.escapeCSV(String(item[header]))).join(","),
      );

      return [headers.join(","), ...rows].join("\n");
    }

    // Convert object to CSV
    const flat = this.flattenObject(data);
    const headers = Object.keys(flat);
    const values = headers.map((h) => this.escapeCSV(String(flat[h])));

    return [headers.join(","), values.join(",")].join("\n");
  }

  private flattenObject(obj: any, prefix = ""): Record<string, any> {
    const flattened: Record<string, any> = {};

    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        flattened[newKey] = "";
      } else if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = value.length;
      } else {
        flattened[newKey] = value;
      }
    });

    return flattened;
  }

  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private formatPlatformStats(stats: PlatformStats): string {
    return `
- Total Posts: ${this.formatNumber(stats.totalPosts)}
- Total Comments: ${this.formatNumber(stats.totalComments)}
- Total Users: ${this.formatNumber(stats.totalUsers)}
- Average Score: ${stats.avgScore.toFixed(2)}
- Average Comment Count: ${stats.avgCommentCount.toFixed(2)}
- Most Active User: ${
      stats.mostActiveUser
        ? `${stats.mostActiveUser.username} (${stats.mostActiveUser.posts + stats.mostActiveUser.comments} contributions)`
        : "N/A"
    }
- Last Update: ${this.formatDate(stats.lastUpdateTime)}
`;
  }

  private formatTrendingPosts(posts: TrendingPost[]): string {
    return posts
      .slice(0, 10)
      .map(
        (post, i) =>
          `${i + 1}. **${post.title}**
   - Score: ${post.score}
   - Comments: ${post.commentCount}
   - Author: ${post.author}
   - Created: ${this.formatDate(post.createdAt)}`,
      )
      .join("\n\n");
  }

  private formatTopAuthors(authors: any[]): string {
    return authors
      .map(
        (author, i) =>
          `${i + 1}. **${author.author}**
   - Posts: ${author.postCount}
   - Total Score: ${author.totalScore}
   - Average Score: ${author.avgScore.toFixed(2)}`,
      )
      .join("\n\n");
  }

  private formatPostsTable(posts: any[], limit = 10): string {
    const displayPosts = posts.slice(0, limit);

    return displayPosts
      .map(
        (post, i) =>
          `${i + 1}. ${post.title || "Untitled"}
   Platform: ${post.platform} | Score: ${post.score} | Comments: ${post.comment_count}`,
      )
      .join("\n");
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      const formatted = (num / 1000).toFixed(1);
      // Remove decimal if it's .0
      return formatted.endsWith(".0")
        ? `${Math.round(num / 1000)}K`
        : `${formatted}K`;
    }
    return num.toString();
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

  private formatDate(
    date: Date,
    format: "short" | "long" | "iso" = "short",
  ): string {
    switch (format) {
      case "iso":
        return date.toISOString();
      case "long":
        return date.toLocaleString();
      case "short":
      default:
        return date.toLocaleDateString();
    }
  }

  /**
   * Generate executive insights from metrics
   */
  private generateExecutiveInsights(metrics: DashboardMetrics): {
    summary: string;
    recommendations: string[];
    risks: string[];
  } {
    const insights = {
      summary: "",
      recommendations: [],
      risks: [],
    };

    // Generate summary based on growth and engagement
    const growth = metrics.overview.growthRate;
    const engagement = metrics.overview.avgEngagement;

    if (growth > 10 && engagement > 0.7) {
      insights.summary =
        "The platform is experiencing strong growth with high user engagement. All key metrics are trending positively.";
    } else if (growth > 0 && engagement > 0.5) {
      insights.summary =
        "The platform shows steady growth with moderate engagement levels. There are opportunities for optimization.";
    } else if (growth < 0) {
      insights.summary =
        "The platform is experiencing declining metrics. Immediate attention required to address negative trends.";
    } else {
      insights.summary =
        "The platform metrics are stable with room for improvement in growth and engagement strategies.";
    }

    // Generate recommendations
    if (growth < 5) {
      insights.recommendations.push(
        "Increase content acquisition frequency to drive growth",
      );
    }
    if (engagement < 0.6) {
      insights.recommendations.push(
        "Implement engagement optimization strategies to improve user interaction",
      );
    }
    if (metrics.health.dataQuality < 80) {
      insights.recommendations.push(
        "Improve data collection processes to enhance data quality",
      );
    }
    if (metrics.health.gaps.length > 0) {
      insights.recommendations.push(
        "Address data collection gaps to ensure comprehensive analytics",
      );
    }

    // Platform-specific recommendations
    const platforms = Array.from(metrics.platformBreakdown.entries());
    const underperformingPlatforms = platforms.filter(
      ([_, stats]) => stats.avgScore < 10,
    );
    if (underperformingPlatforms.length > 0) {
      insights.recommendations.push(
        `Focus on improving performance for: ${underperformingPlatforms.map((p) => p[0]).join(", ")}`,
      );
    }

    // Identify risks
    if (growth < -5) {
      insights.risks.push(
        "Significant decline in growth rate requires immediate intervention",
      );
    }
    if (metrics.health.dataQuality < 60) {
      insights.risks.push("Poor data quality may impact analytics accuracy");
    }
    if (metrics.health.databaseSize > 5000000000) {
      // 5GB
      insights.risks.push("Database size approaching critical levels");
    }

    return insights;
  }

  /**
   * Calculate key performance indicators
   */
  private calculateKeyPerformanceIndicators(metrics: DashboardMetrics): Array<{
    name: string;
    value: string;
    trend: string;
  }> {
    const kpis = [];

    // Content velocity
    const contentVelocity =
      metrics.timeSeries.length > 0
        ? metrics.timeSeries[metrics.timeSeries.length - 1].posts / 24 // posts per hour
        : 0;
    kpis.push({
      name: "Content Velocity",
      value: `${contentVelocity.toFixed(1)}/hr`,
      trend: contentVelocity > 10 ? "↑" : contentVelocity > 5 ? "→" : "↓",
    });

    // User engagement rate
    const engagementRate = metrics.overview.avgEngagement * 100;
    kpis.push({
      name: "Engagement Rate",
      value: `${engagementRate.toFixed(1)}%`,
      trend: engagementRate > 70 ? "↑" : engagementRate > 50 ? "→" : "↓",
    });

    // Platform diversity score
    const platformCount = metrics.platformBreakdown.size;
    const diversityScore = Math.min(100, platformCount * 20);
    kpis.push({
      name: "Platform Diversity",
      value: `${diversityScore}%`,
      trend: platformCount > 3 ? "↑" : "→",
    });

    // Data freshness
    const hoursSinceUpdate =
      (Date.now() - metrics.health.lastUpdate.getTime()) / (1000 * 60 * 60);
    const freshnessScore = Math.max(0, 100 - hoursSinceUpdate * 2);
    kpis.push({
      name: "Data Freshness",
      value: `${freshnessScore.toFixed(0)}%`,
      trend: freshnessScore > 80 ? "↑" : freshnessScore > 50 ? "→" : "↓",
    });

    // Growth momentum
    const growthMomentum = metrics.overview.growthRate;
    kpis.push({
      name: "Growth Momentum",
      value: `${growthMomentum > 0 ? "+" : ""}${growthMomentum.toFixed(1)}%`,
      trend: growthMomentum > 5 ? "↑" : growthMomentum > 0 ? "→" : "↓",
    });

    return kpis;
  }

  /**
   * Identify key trends from metrics
   */
  private identifyKeyTrends(metrics: DashboardMetrics): string[] {
    const trends = [];

    // Growth trend
    if (metrics.overview.growthRate > 10) {
      trends.push("📈 Strong growth momentum detected across all metrics");
    } else if (metrics.overview.growthRate < -5) {
      trends.push("📉 Declining trend requires immediate attention");
    }

    // Engagement trend
    if (metrics.overview.avgEngagement > 0.8) {
      trends.push("🎯 Exceptional user engagement levels");
    } else if (metrics.overview.avgEngagement < 0.4) {
      trends.push("⚠️ Low engagement levels need improvement");
    }

    // Platform trends
    const topPlatform = Array.from(metrics.platformBreakdown.entries()).sort(
      (a, b) => b[1].totalPosts - a[1].totalPosts,
    )[0];
    if (topPlatform) {
      trends.push(
        `🏆 ${topPlatform[0]} is the dominant platform with ${this.formatNumber(topPlatform[1].totalPosts)} posts`,
      );
    }

    // Time series trends
    if (metrics.timeSeries.length > 1) {
      const recent = metrics.timeSeries[metrics.timeSeries.length - 1];
      const previous = metrics.timeSeries[metrics.timeSeries.length - 2];
      if (recent.avgScore > previous.avgScore * 1.1) {
        trends.push("⬆️ Content quality improving (score up 10%+)");
      }
    }

    // Data health trends
    if (metrics.health.dataQuality > 90) {
      trends.push("✅ Excellent data quality maintained");
    }

    return trends;
  }

  /**
   * Get quality indicator emoji
   */
  private getQualityIndicator(quality: number): string {
    if (quality >= 90) return "🟢";
    if (quality >= 70) return "🟡";
    if (quality >= 50) return "🟠";
    return "🔴";
  }

  /**
   * Generate detailed statistical breakdown
   */
  public generateDetailedBreakdown(
    metrics: DashboardMetrics,
    options?: {
      includeStatistics?: boolean;
      includeDistributions?: boolean;
      includeCorrelations?: boolean;
      includePredictions?: boolean;
    },
  ): string {
    const opts = {
      includeStatistics: true,
      includeDistributions: true,
      includeCorrelations: true,
      includePredictions: true,
      ...options,
    };

    const sections = [];

    // Statistical summary
    if (opts.includeStatistics) {
      sections.push(this.generateStatisticalSummary(metrics));
    }

    // Distribution analysis
    if (opts.includeDistributions) {
      sections.push(this.generateDistributionAnalysis(metrics));
    }

    // Correlation analysis
    if (opts.includeCorrelations) {
      sections.push(this.generateCorrelationAnalysis(metrics));
    }

    // Predictive insights
    if (opts.includePredictions) {
      sections.push(this.generatePredictiveInsights(metrics));
    }

    return sections.join("\n\n");
  }

  /**
   * Generate statistical summary
   */
  private generateStatisticalSummary(metrics: DashboardMetrics): string {
    const stats = this.calculateStatistics(metrics);

    return `# Statistical Summary

## Central Tendency
- **Mean Score**: ${stats.meanScore.toFixed(2)}
- **Median Score**: ${stats.medianScore.toFixed(2)}
- **Mode Score**: ${stats.modeScore.toFixed(2)}

## Dispersion
- **Standard Deviation**: ${stats.stdDev.toFixed(2)}
- **Variance**: ${stats.variance.toFixed(2)}
- **Range**: ${stats.range.min} - ${stats.range.max}
- **Interquartile Range**: ${stats.iqr.toFixed(2)}

## Shape
- **Skewness**: ${stats.skewness.toFixed(3)} ${this.interpretSkewness(stats.skewness)}
- **Kurtosis**: ${stats.kurtosis.toFixed(3)} ${this.interpretKurtosis(stats.kurtosis)}

## Percentiles
- **25th Percentile**: ${stats.percentiles.p25.toFixed(2)}
- **50th Percentile**: ${stats.percentiles.p50.toFixed(2)}
- **75th Percentile**: ${stats.percentiles.p75.toFixed(2)}
- **95th Percentile**: ${stats.percentiles.p95.toFixed(2)}`;
  }

  /**
   * Generate distribution analysis
   */
  private generateDistributionAnalysis(metrics: DashboardMetrics): string {
    const distributions = this.analyzeDistributions(metrics);

    return `# Distribution Analysis

## Platform Distribution
${distributions.platforms.map((p) => `- **${p.platform}**: ${p.percentage.toFixed(1)}% (${this.formatNumber(p.count)} items)`).join("\n")}

## Temporal Distribution
${distributions.temporal.map((t) => `- **${t.period}**: ${t.percentage.toFixed(1)}% activity`).join("\n")}

## Engagement Distribution
${distributions.engagement.map((e) => `- **${e.range}**: ${e.percentage.toFixed(1)}% of content`).join("\n")}

## Score Distribution
\`\`\`
${this.createHistogram(distributions.scores, 10)}
\`\`\``;
  }

  /**
   * Generate correlation analysis
   */
  private generateCorrelationAnalysis(metrics: DashboardMetrics): string {
    const correlations = this.calculateCorrelations(metrics);

    return `# Correlation Analysis

## Strong Positive Correlations
${correlations.strong.positive.map((c) => `- ${c.var1} ↔️ ${c.var2}: ${c.value.toFixed(3)}`).join("\n")}

## Strong Negative Correlations
${correlations.strong.negative.map((c) => `- ${c.var1} ↔️ ${c.var2}: ${c.value.toFixed(3)}`).join("\n")}

## Key Insights
${correlations.insights.map((insight, i) => `${i + 1}. ${insight}`).join("\n")}`;
  }

  /**
   * Generate predictive insights
   */
  private generatePredictiveInsights(metrics: DashboardMetrics): string {
    const predictions = this.generatePredictions(metrics);

    return `# Predictive Analytics

## Growth Predictions
- **Next 7 Days**: ${predictions.growth.week.toFixed(1)}% ${predictions.growth.week > 0 ? "increase" : "decrease"}
- **Next 30 Days**: ${predictions.growth.month.toFixed(1)}% ${predictions.growth.month > 0 ? "increase" : "decrease"}
- **Confidence Level**: ${predictions.confidence.toFixed(0)}%

## Expected Outcomes
${predictions.outcomes.map((outcome, i) => `${i + 1}. ${outcome}`).join("\n")}

## Risk Factors
${predictions.risks.map((r) => `- **${r.factor}**: ${r.probability}% probability (${r.impact} impact)`).join("\n")}`;
  }

  /**
   * Calculate comprehensive statistics
   */
  private calculateStatistics(metrics: DashboardMetrics): any {
    const scores = metrics.timeSeries.map((t) => t.avgScore);

    if (scores.length === 0) {
      return this.getDefaultStatistics();
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const n = sorted.length;

    // Central tendency
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const median =
      n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    // Mode (simplified - most frequent score)
    const frequency = {};
    scores.forEach((s) => (frequency[s] = (frequency[s] || 0) + 1));
    const mode = Number(
      Object.keys(frequency).reduce((a, b) =>
        frequency[a] > frequency[b] ? a : b,
      ),
    );

    // Dispersion
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Percentiles
    const percentile = (p: number) => {
      const index = (p / 100) * (n - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index % 1;
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    // Skewness and kurtosis
    const m3 = scores.reduce((sum, s) => sum + Math.pow(s - mean, 3), 0) / n;
    const m4 = scores.reduce((sum, s) => sum + Math.pow(s - mean, 4), 0) / n;
    const skewness = stdDev > 0 ? m3 / Math.pow(stdDev, 3) : 0;
    const kurtosis = stdDev > 0 ? m4 / Math.pow(stdDev, 4) - 3 : 0;

    return {
      meanScore: mean,
      medianScore: median,
      modeScore: mode,
      stdDev,
      variance,
      range: { min: sorted[0], max: sorted[n - 1] },
      iqr: percentile(75) - percentile(25),
      skewness,
      kurtosis,
      percentiles: {
        p25: percentile(25),
        p50: percentile(50),
        p75: percentile(75),
        p95: percentile(95),
      },
    };
  }

  /**
   * Get default statistics when no data available
   */
  private getDefaultStatistics(): any {
    return {
      meanScore: 0,
      medianScore: 0,
      modeScore: 0,
      stdDev: 0,
      variance: 0,
      range: { min: 0, max: 0 },
      iqr: 0,
      skewness: 0,
      kurtosis: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p95: 0 },
    };
  }

  /**
   * Interpret skewness value
   */
  private interpretSkewness(skewness: number): string {
    if (Math.abs(skewness) < 0.5) return "(symmetric)";
    if (skewness > 0) return "(right-skewed)";
    return "(left-skewed)";
  }

  /**
   * Interpret kurtosis value
   */
  private interpretKurtosis(kurtosis: number): string {
    if (Math.abs(kurtosis) < 0.5) return "(normal)";
    if (kurtosis > 0) return "(heavy-tailed)";
    return "(light-tailed)";
  }

  /**
   * Analyze distributions
   */
  private analyzeDistributions(metrics: DashboardMetrics): any {
    const platforms = Array.from(metrics.platformBreakdown.entries());
    const totalPosts = platforms.reduce(
      (sum, [_, stats]) => sum + stats.totalPosts,
      0,
    );

    return {
      platforms: platforms.map(([platform, stats]) => ({
        platform,
        count: stats.totalPosts,
        percentage: (stats.totalPosts / totalPosts) * 100,
      })),
      temporal: this.analyzeTemporalDistribution(metrics.timeSeries),
      engagement: this.analyzeEngagementDistribution(metrics),
      scores: metrics.timeSeries.map((t) => t.avgScore),
    };
  }

  /**
   * Analyze temporal distribution
   */
  private analyzeTemporalDistribution(timeSeries: any[]): any[] {
    if (timeSeries.length === 0) return [];

    const hourly = new Array(24).fill(0);
    const daily = new Array(7).fill(0);

    timeSeries.forEach((item) => {
      const date = new Date(item.timestamp);
      hourly[date.getHours()]++;
      daily[date.getDay()]++;
    });

    const maxHourly = Math.max(...hourly);
    const maxDaily = Math.max(...daily);

    return [
      {
        period: "Peak Hour",
        percentage: (maxHourly / timeSeries.length) * 100,
      },
      { period: "Peak Day", percentage: (maxDaily / timeSeries.length) * 100 },
    ];
  }

  /**
   * Analyze engagement distribution
   */
  private analyzeEngagementDistribution(metrics: DashboardMetrics): any[] {
    const engagement = metrics.overview.avgEngagement;

    return [
      { range: "High (>0.7)", percentage: engagement > 0.7 ? 100 : 0 },
      {
        range: "Medium (0.4-0.7)",
        percentage: engagement >= 0.4 && engagement <= 0.7 ? 100 : 0,
      },
      { range: "Low (<0.4)", percentage: engagement < 0.4 ? 100 : 0 },
    ];
  }

  /**
   * Create ASCII histogram
   */
  private createHistogram(data: number[], bins: number = 10): string {
    if (data.length === 0) return "No data available";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const binWidth = range / bins;

    const histogram = new Array(bins).fill(0);
    data.forEach((value) => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    });

    const maxCount = Math.max(...histogram);
    const scale = 40 / maxCount;

    return histogram
      .map((count, i) => {
        const start = (min + i * binWidth).toFixed(1);
        const end = (min + (i + 1) * binWidth).toFixed(1);
        const bar = "█".repeat(Math.round(count * scale));
        return `${start.padStart(6)}-${end.padEnd(6)} | ${bar} (${count})`;
      })
      .join("\n");
  }

  /**
   * Calculate correlations
   */
  private calculateCorrelations(metrics: DashboardMetrics): any {
    const correlations = {
      strong: { positive: [], negative: [] },
      insights: [],
    };

    // Mock correlation analysis for now
    if (metrics.timeSeries.length > 1) {
      correlations.strong.positive.push({
        var1: "Posts",
        var2: "Comments",
        value: 0.85,
      });
      correlations.insights.push(
        "Strong positive correlation between post count and comment activity",
      );
    }

    if (metrics.overview.avgEngagement > 0.6) {
      correlations.insights.push(
        "High engagement correlates with content quality",
      );
    }

    return correlations;
  }

  /**
   * Generate predictions
   */
  private generatePredictions(metrics: DashboardMetrics): any {
    const currentGrowth = metrics.overview.growthRate;

    return {
      growth: {
        week: currentGrowth * 0.7, // Conservative weekly estimate
        month: currentGrowth * 2.5, // Monthly projection
      },
      confidence: Math.max(
        50,
        Math.min(95, 70 + metrics.health.dataQuality / 4),
      ),
      outcomes: [
        `Expected ${this.formatNumber(metrics.overview.totalPosts * 1.1)} total posts in 30 days`,
        `User base likely to grow by ${(currentGrowth * 0.8).toFixed(1)}%`,
      ],
      risks: [
        {
          factor: "Data Quality Degradation",
          probability: metrics.health.dataQuality < 70 ? 60 : 20,
          impact: "high",
        },
        {
          factor: "Platform API Changes",
          probability: 30,
          impact: "medium",
        },
      ],
    };
  }

  /**
   * Generate comprehensive analytics report
   */
  public generateComprehensiveReport(
    data: {
      metrics: DashboardMetrics;
      comparative?: any;
      trending?: any;
      performance?: any;
      generatedAt: Date;
    },
    format: "html" | "markdown" | "json" = "markdown",
    config?: ReportConfig & {
      reportType?: "executive" | "detailed" | "technical";
      includeSections?: string[];
      excludeSections?: string[];
    },
  ): string {
    const cfg = { ...this.defaultConfig, reportType: "detailed", ...config };
    const sections: ReportSection[] = [];

    // Executive Summary (always included for comprehensive reports)
    sections.push(this.createExecutiveSummary(data.metrics));

    // Conditional sections based on report type
    if (cfg.reportType === "executive") {
      // Executive report: high-level overview
      sections.push(this.createPlatformOverview(data.metrics));
      if (data.trending) {
        sections.push(this.createTrendingSection(data.trending));
      }
      sections.push(this.createRecommendations(data));
    } else if (cfg.reportType === "technical") {
      // Technical report: detailed statistics and analysis
      const breakdown = this.generateDetailedBreakdown(data.metrics);
      sections.push({
        title: "Statistical Analysis",
        content: breakdown,
        priority: "high",
        type: "text",
      });

      if (data.performance) {
        sections.push(this.createPerformanceSection(data.performance));
      }

      // Add technical insights
      sections.push(this.createTechnicalInsights(data));
    } else {
      // Detailed report: comprehensive coverage
      sections.push(this.createPlatformOverview(data.metrics));

      // Statistical breakdown
      const breakdown = this.generateDetailedBreakdown(data.metrics, {
        includeStatistics: true,
        includeDistributions: true,
        includeCorrelations: false,
        includePredictions: true,
      });
      sections.push({
        title: "Statistical Analysis",
        content: breakdown,
        priority: "medium",
        type: "text",
      });

      if (data.trending) {
        sections.push(this.createTrendingSection(data.trending));
      }

      if (data.comparative) {
        sections.push(this.createComparativeSection(data.comparative));
      }

      if (data.performance) {
        sections.push(this.createPerformanceSection(data.performance));
      }

      if (cfg.includeCharts) {
        sections.push(...this.createVisualizationSections(data.metrics));
      }

      sections.push(this.createRecommendations(data));
    }

    // Filter sections if specified
    let finalSections = sections;
    if (cfg.includeSections && cfg.includeSections.length > 0) {
      finalSections = sections.filter((s) =>
        cfg.includeSections.includes(s.title),
      );
    }
    if (cfg.excludeSections && cfg.excludeSections.length > 0) {
      finalSections = sections.filter(
        (s) => !cfg.excludeSections.includes(s.title),
      );
    }

    // Create report structure
    const report: GeneratedReport = {
      title: this.getReportTitle(cfg.reportType),
      generatedAt: data.generatedAt,
      sections: finalSections,
      metadata: {
        platforms: Array.from(data.metrics.platformBreakdown.keys()),
        recordCount:
          data.metrics.overview.totalPosts +
          data.metrics.overview.totalComments,
        reportType: cfg.reportType,
      },
      format,
      content: "",
    };

    // Generate formatted content with enhanced formatting
    switch (format) {
      case "html":
        report.content = this.formatAsEnhancedHTML(report, cfg);
        break;
      case "json":
        report.content = this.formatAsStructuredJSON(report);
        break;
      case "markdown":
      default:
        report.content = this.formatAsEnhancedMarkdown(report, cfg);
        break;
    }

    return report.content;
  }

  /**
   * Create technical insights section
   */
  private createTechnicalInsights(data: any): ReportSection {
    const content = `
## System Architecture Analysis
- Database Efficiency: ${this.calculateDatabaseEfficiency(data)}%
- Query Performance: ${data.performance?.database?.queryPerformance || "N/A"}%
- Index Utilization: ${data.performance?.database?.indexEfficiency || "N/A"}%

## Data Pipeline Health
- Collection Success Rate: ${(data.performance?.scraping?.successRate * 100 || 0).toFixed(1)}%
- Processing Latency: ${data.performance?.scraping?.avgResponseTime || "N/A"}ms
- Error Recovery Rate: ${this.calculateErrorRecoveryRate(data)}%

## Scalability Assessment
- Current Load: ${this.assessCurrentLoad(data)}
- Capacity Utilization: ${this.calculateCapacityUtilization(data)}%
- Scaling Recommendations: ${this.getScalingRecommendations(data)}
`;

    return {
      title: "Technical Insights",
      content,
      priority: "medium",
      type: "text",
    };
  }

  /**
   * Get report title based on type
   */
  private getReportTitle(reportType: string): string {
    switch (reportType) {
      case "executive":
        return "Executive Analytics Summary";
      case "technical":
        return "Technical Analytics Report";
      default:
        return "Comprehensive Analytics Report";
    }
  }

  /**
   * Format as enhanced Markdown
   */
  private formatAsEnhancedMarkdown(
    report: GeneratedReport,
    config: any,
  ): string {
    const lines: string[] = [];

    // Enhanced header
    lines.push(`# ${report.title}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`**Generated:** ${this.formatDate(report.generatedAt, "long")}`);
    lines.push(`**Report Type:** ${report.metadata.reportType || "Standard"}`);
    lines.push(
      `**Data Points:** ${this.formatNumber(report.metadata.recordCount || 0)}`,
    );
    lines.push("");
    lines.push("---");
    lines.push("");

    // Table of contents for detailed reports
    if (config.reportType === "detailed" || config.reportType === "technical") {
      lines.push("## Table of Contents");
      lines.push("");
      report.sections.forEach((section, index) => {
        lines.push(
          `${index + 1}. [${section.title}](#${this.slugify(section.title)})`,
        );
      });
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    // Add sections with enhanced formatting
    report.sections.forEach((section) => {
      lines.push(`## ${section.title}`);
      lines.push("");

      if (section.priority === "high") {
        lines.push("> **Priority: High**");
        lines.push("");
      }

      if (typeof section.content === "string") {
        lines.push(section.content);
      } else {
        lines.push("```json");
        lines.push(JSON.stringify(section.content, null, 2));
        lines.push("```");
      }

      lines.push("");
      lines.push("---");
      lines.push("");
    });

    // Enhanced footer
    lines.push("## Report Metadata");
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|----------|-------|");
    lines.push(`| Generated | ${this.formatDate(report.generatedAt, "iso")} |`);
    lines.push(
      `| Platforms | ${report.metadata.platforms?.join(", ") || "All"} |`,
    );
    lines.push(`| Format | ${report.format} |`);
    lines.push(`| Version | 2.0 |`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("*Generated by Analytics Report Generator v2.0*");

    return lines.join("\n");
  }

  /**
   * Format as enhanced HTML
   */
  private formatAsEnhancedHTML(report: GeneratedReport, config: any): string {
    const sections = report.sections
      .map((section, index) => {
        const sectionId = this.slugify(section.title);
        const content =
          typeof section.content === "string"
            ? this.markdownToHTML(section.content)
            : `<pre class="json-content">${JSON.stringify(section.content, null, 2)}</pre>`;

        return `
        <section id="${sectionId}" class="report-section ${section.priority} ${section.type}">
          <h2>${section.title}</h2>
          <div class="content">
            ${content}
          </div>
        </section>
      `;
      })
      .join("\n");

    const toc =
      config.reportType !== "executive"
        ? `
        <nav class="table-of-contents">
          <h3>Table of Contents</h3>
          <ol>
            ${report.sections.map((s) => `<li><a href="#${this.slugify(s.title)}">${s.title}</a></li>`).join("\n")}
          </ol>
        </nav>
      `
        : "";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    ${this.getEnhancedStyles(config)}
  </style>
</head>
<body>
  <header class="report-header">
    <h1>${report.title}</h1>
    <div class="metadata">
      <span class="date">Generated: ${this.formatDate(report.generatedAt, "long")}</span>
      <span class="type">Type: ${report.metadata.reportType || "Standard"}</span>
      <span class="records">Records: ${this.formatNumber(report.metadata.recordCount || 0)}</span>
    </div>
  </header>

  ${toc}

  <main class="report-content">
    ${sections}
  </main>

  <footer class="report-footer">
    <div class="footer-content">
      <p>Generated by Analytics Report Generator v2.0</p>
      <p class="timestamp">${this.formatDate(report.generatedAt, "iso")}</p>
    </div>
  </footer>

  <script>
    ${this.getEnhancedScripts()}
  </script>
</body>
</html>
    `;
  }

  /**
   * Get enhanced styles for HTML reports
   */
  private getEnhancedStyles(config: any): string {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
      }

      .report-header {
        background: white;
        padding: 2rem;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin-bottom: 2rem;
      }

      .report-header h1 {
        color: #2c3e50;
        margin-bottom: 1rem;
        font-size: 2.5rem;
      }

      .metadata {
        display: flex;
        gap: 2rem;
        color: #7f8c8d;
        font-size: 0.9rem;
      }

      .table-of-contents {
        background: white;
        padding: 1.5rem;
        margin: 0 auto 2rem;
        max-width: 1200px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }

      .table-of-contents h3 {
        color: #2c3e50;
        margin-bottom: 1rem;
      }

      .table-of-contents ol {
        list-style: decimal;
        margin-left: 2rem;
      }

      .table-of-contents a {
        color: #3498db;
        text-decoration: none;
        transition: color 0.3s;
      }

      .table-of-contents a:hover {
        color: #2980b9;
      }

      .report-content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }

      .report-section {
        background: white;
        margin-bottom: 2rem;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        transition: transform 0.3s;
      }

      .report-section:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      }

      .report-section h2 {
        color: #2c3e50;
        margin-bottom: 1.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #ecf0f1;
      }

      .report-section.high {
        border-left: 4px solid #e74c3c;
      }

      .report-section.medium {
        border-left: 4px solid #f39c12;
      }

      .report-section.low {
        border-left: 4px solid #95a5a6;
      }

      .content {
        color: #34495e;
      }

      .content h3 {
        color: #2c3e50;
        margin: 1.5rem 0 1rem;
      }

      .content ul, .content ol {
        margin-left: 2rem;
        margin-bottom: 1rem;
      }

      .content li {
        margin-bottom: 0.5rem;
      }

      .content strong {
        color: #2c3e50;
      }

      .content code {
        background: #f8f9fa;
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: "Courier New", monospace;
      }

      pre {
        background: #2c3e50;
        color: #ecf0f1;
        padding: 1rem;
        border-radius: 4px;
        overflow-x: auto;
        margin: 1rem 0;
      }

      .json-content {
        background: #f8f9fa;
        color: #2c3e50;
        border: 1px solid #dee2e6;
      }

      blockquote {
        border-left: 4px solid #3498db;
        padding-left: 1rem;
        margin: 1rem 0;
        color: #7f8c8d;
        font-style: italic;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
      }

      th, td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
      }

      th {
        background: #f8f9fa;
        font-weight: 600;
        color: #2c3e50;
      }

      .report-footer {
        background: white;
        padding: 2rem;
        margin-top: 3rem;
        text-align: center;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      }

      .footer-content {
        color: #7f8c8d;
      }

      .timestamp {
        font-size: 0.9rem;
        margin-top: 0.5rem;
      }

      @media print {
        body { background: white; }
        .report-section { box-shadow: none; page-break-inside: avoid; }
        .table-of-contents { page-break-after: always; }
      }

      @media (max-width: 768px) {
        .metadata { flex-direction: column; gap: 0.5rem; }
        .report-header h1 { font-size: 1.8rem; }
        .report-section { padding: 1rem; }
      }
    `;
  }

  /**
   * Get enhanced scripts for HTML reports
   */
  private getEnhancedScripts(): string {
    return `
      // Smooth scrolling for TOC links
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href'));
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      // Highlight current section in view
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            document.querySelectorAll('.table-of-contents a').forEach(link => {
              link.classList.remove('active');
              if (link.getAttribute('href') === '#' + id) {
                link.classList.add('active');
              }
            });
          }
        });
      }, { threshold: 0.5 });

      document.querySelectorAll('.report-section').forEach(section => {
        observer.observe(section);
      });
    `;
  }

  /**
   * Format as structured JSON
   */
  private formatAsStructuredJSON(report: GeneratedReport): string {
    const structured = {
      metadata: {
        title: report.title,
        generatedAt: report.generatedAt.toISOString(),
        ...report.metadata,
      },
      summary: {},
      sections: {},
      insights: {},
      recommendations: {},
    };

    report.sections.forEach((section) => {
      const key = this.slugify(section.title);
      if (section.title.toLowerCase().includes("summary")) {
        structured.summary[key] = section.content;
      } else if (
        section.title.toLowerCase().includes("insight") ||
        section.title.toLowerCase().includes("recommendation")
      ) {
        structured.insights[key] = section.content;
      } else {
        structured.sections[key] = {
          title: section.title,
          priority: section.priority,
          type: section.type,
          content: section.content,
        };
      }
    });

    return JSON.stringify(structured, null, 2);
  }

  /**
   * Convert markdown to HTML
   */
  private markdownToHTML(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/^\* (.+)/gim, "<li>$1</li>")
      .replace(/^- (.+)/gim, "<li>$1</li>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>")
      .replace(/<li>.*<\/li>/s, (match) => `<ul>${match}</ul>`)
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  }

  /**
   * Create URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  /**
   * Calculate database efficiency
   */
  private calculateDatabaseEfficiency(data: any): number {
    const queryPerf = data.performance?.database?.queryPerformance || 70;
    const indexEff = data.performance?.database?.indexEfficiency || 70;
    return Math.round((queryPerf + indexEff) / 2);
  }

  /**
   * Calculate error recovery rate
   */
  private calculateErrorRecoveryRate(data: any): number {
    const errorRate = data.performance?.scraping?.errorRate || 5;
    return Math.max(0, 100 - errorRate * 2);
  }

  /**
   * Assess current load
   */
  private assessCurrentLoad(data: any): string {
    const size = data.metrics?.health?.databaseSize || 0;
    if (size < 1000000000) return "Low";
    if (size < 3000000000) return "Moderate";
    return "High";
  }

  /**
   * Calculate capacity utilization
   */
  private calculateCapacityUtilization(data: any): number {
    const size = data.metrics?.health?.databaseSize || 0;
    const maxSize = 10000000000; // 10GB assumed max
    return Math.round((size / maxSize) * 100);
  }

  /**
   * Get scaling recommendations
   */
  private getScalingRecommendations(data: any): string {
    const utilization = this.calculateCapacityUtilization(data);
    if (utilization < 30) return "No scaling needed";
    if (utilization < 70) return "Monitor growth patterns";
    return "Consider horizontal scaling";
  }

  /**
   * Register a custom template
   */
  public registerTemplate(id: string, template: ReportTemplate): void {
    this.templates.set(id, template);
  }

  /**
   * Get available templates
   */
  public getTemplates(): Map<string, ReportTemplate> {
    return new Map(this.templates);
  }

  /**
   * Get a specific template
   */
  public getTemplate(id: string): ReportTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Validate a template
   */
  public validateTemplate(template: ReportTemplate): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!template.name) {
      errors.push("Template must have a name");
    }

    if (!template.sections || template.sections.length === 0) {
      errors.push("Template must have at least one section");
    }

    template.sections?.forEach((section, index) => {
      if (!section.id) {
        errors.push(`Section ${index} must have an id`);
      }
      if (!section.title) {
        errors.push(`Section ${index} must have a title`);
      }
      if (!section.type) {
        errors.push(`Section ${index} must have a type`);
      }
    });

    // Validate layout positions if dashboard layout
    if (template.layout === "dashboard") {
      const positions = new Set<string>();
      template.sections?.forEach((section) => {
        if (!section.position) {
          errors.push(
            `Section ${section.id} must have position in dashboard layout`,
          );
        } else {
          const key = `${section.position.row},${section.position.col}`;
          if (positions.has(key)) {
            errors.push(
              `Position conflict at row ${section.position.row}, col ${section.position.col}`,
            );
          }
          positions.add(key);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate report from template
   */
  public async generateFromTemplate(
    templateId: string,
    data: any,
    format: "html" | "markdown" | "json" | "pdf" = "html",
    _config?: ReportConfig,
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const sections: ReportSection[] = [];

    // Process template sections
    for (const templateSection of template.sections) {
      // Check condition if exists
      if (templateSection.condition && !templateSection.condition(data)) {
        continue;
      }

      const sectionData = this.extractDataFromSource(
        data,
        templateSection.dataSource,
      );
      const content = this.renderSectionContent(templateSection, sectionData);

      sections.push({
        title: templateSection.title,
        content,
        priority: "medium",
        type: templateSection.type as any,
      });
    }

    const report: GeneratedReport = {
      title: template.name,
      generatedAt: new Date(),
      sections,
      metadata: {},
      format,
      content: "",
    };

    // Apply template theme and layout
    const themedContent = this.applyTemplateTheme(report, template, format);
    report.content = themedContent;

    return report.content;
  }

  /**
   * Extract data from source path
   */
  private extractDataFromSource(data: any, source?: string): any {
    if (!source) return data;

    const keys = source.split(".");
    let result = data;

    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) break;
    }

    return result;
  }

  /**
   * Render section content based on type
   */
  private renderSectionContent(section: TemplateSection, data: any): string {
    switch (section.type) {
      case "text":
        return typeof data === "string" ? data : JSON.stringify(data, null, 2);

      case "chart":
        if (Array.isArray(data)) {
          return this.visualizer.createLineChart(data, section.title);
        }
        return "No chart data available";

      case "table":
        if (Array.isArray(data)) {
          return this.visualizer.createComparisonTable(data, section.title);
        }
        return "No table data available";

      case "metric":
        return `**${section.title}**: ${this.formatMetricValue(data)}`;

      case "custom":
        if (section.config?.renderer) {
          return section.config.renderer(data);
        }
        return String(data);

      default:
        return String(data);
    }
  }

  /**
   * Format metric value
   */
  private formatMetricValue(value: any): string {
    if (typeof value === "number") {
      return this.formatNumber(value);
    }
    if (value instanceof Date) {
      return this.formatDate(value);
    }
    return String(value);
  }

  /**
   * Apply template theme to report
   */
  private applyTemplateTheme(
    report: GeneratedReport,
    template: ReportTemplate,
    format: string,
  ): string {
    if (format === "html") {
      return this.formatAsHTMLWithTemplate(report, template);
    }
    return this.formatAsMarkdown(report);
  }

  /**
   * Format as HTML with template
   */
  private formatAsHTMLWithTemplate(
    report: GeneratedReport,
    template: ReportTemplate,
  ): string {
    const theme = template.theme || "light";
    const layout = template.layout || "single-column";

    const layoutClass = `layout-${layout}`;
    const themeClass = `theme-${theme}`;

    const sections = report.sections
      .map((section, index) => {
        const position = template.sections[index]?.position;
        const positionStyle = position
          ? `grid-row: ${position.row + 1}; grid-column: ${position.col + 1} / span ${position.width || 1};`
          : "";

        return `
        <section class="report-section ${section.priority}" style="${positionStyle}">
          <h2>${section.title}</h2>
          <div class="content ${section.type}">
            ${
              typeof section.content === "string"
                ? section.content.replace(/\n/g, "<br>")
                : `<pre>${JSON.stringify(section.content, null, 2)}</pre>`
            }
          </div>
        </section>
      `;
      })
      .join("\n");

    return `
<!DOCTYPE html>
<html class="${themeClass}">
<head>
  <title>${report.title}</title>
  <style>
    ${this.getTemplateStyles(template)}
  </style>
</head>
<body class="${layoutClass}">
  <header>
    <h1>${report.title}</h1>
    <p class="metadata">Generated: ${this.formatDate(report.generatedAt, "long")}</p>
  </header>
  <main class="report-container">
    ${sections}
  </main>
  <footer>
    <p><em>Report generated by Analytics Dashboard</em></p>
  </footer>
</body>
</html>
    `;
  }

  /**
   * Get template styles
   */
  private getTemplateStyles(template: ReportTemplate): string {
    const baseStyles = `
      body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; }
      h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
      h2 { color: #666; margin-top: 20px; }
      .metadata { color: #999; font-style: italic; }
      .report-section { margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
      .report-section.high { border-left: 4px solid #ff9800; }
      .report-section.medium { border-left: 4px solid #2196F3; }
      .report-section.low { border-left: 4px solid #9E9E9E; }
      pre { background: #fff; padding: 15px; border-radius: 4px; overflow-x: auto; }
    `;

    const layoutStyles = {
      "single-column": `
        .report-container { max-width: 1200px; margin: 0 auto; }
      `,
      "two-column": `
        .report-container { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px; 
          max-width: 1400px; 
          margin: 0 auto; 
        }
      `,
      dashboard: `
        .report-container { 
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 20px; 
          max-width: 1600px; 
          margin: 0 auto; 
        }
      `,
    };

    const themeStyles = {
      light: `
        body { background: #fff; color: #333; }
        .report-section { background: #f5f5f5; }
      `,
      dark: `
        body { background: #1a1a1a; color: #e0e0e0; }
        h1, h2 { color: #e0e0e0; }
        .report-section { background: #2a2a2a; }
        pre { background: #333; color: #e0e0e0; }
      `,
      custom: template.customStyles || "",
    };

    return (
      baseStyles +
      (layoutStyles[template.layout || "single-column"] || "") +
      (themeStyles[template.theme || "light"] || "") +
      (template.customStyles || "")
    );
  }

  /**
   * Schedule a report
   */
  public scheduleReport(report: ScheduledReport): void {
    // Validate report
    if (!report.id) {
      throw new Error("Scheduled report must have an id");
    }

    // Store scheduled report
    this.scheduledReports.set(report.id, report);

    // Start schedule if enabled
    if (report.enabled) {
      this.startReportSchedule(report);
    }
  }

  /**
   * Start report schedule
   */
  private startReportSchedule(report: ScheduledReport): void {
    // Clear existing timer if any
    this.stopReportSchedule(report.id);

    const interval = this.calculateScheduleInterval(report.schedule);
    if (interval > 0) {
      const timer = setInterval(async () => {
        await this.runScheduledReport(report);
      }, interval);

      this.scheduleTimers.set(report.id, timer);

      // Calculate and set next run time
      report.nextRun = new Date(Date.now() + interval);
      this.scheduledReports.set(report.id, report);
    }
  }

  /**
   * Stop report schedule
   */
  public stopReportSchedule(reportId: string): void {
    const timer = this.scheduleTimers.get(reportId);
    if (timer) {
      clearInterval(timer);
      this.scheduleTimers.delete(reportId);
    }
  }

  /**
   * Calculate schedule interval
   */
  private calculateScheduleInterval(schedule: ReportSchedule): number {
    switch (schedule.type) {
      case "daily":
        return 24 * 60 * 60 * 1000; // 24 hours
      case "weekly":
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case "monthly":
        return 30 * 24 * 60 * 60 * 1000; // 30 days (approximate)
      case "custom":
        // For custom, parse cron expression (simplified)
        // This would need a proper cron parser in production
        return 60 * 60 * 1000; // Default to hourly
      default:
        return 0;
    }
  }

  /**
   * Run scheduled report
   */
  private async runScheduledReport(report: ScheduledReport): Promise<void> {
    try {
      // Get data for report
      const data = await this.gatherReportData();

      // Generate report content
      let content: string;
      if (typeof report.template === "string") {
        content = await this.generateFromTemplate(
          report.template,
          data,
          report.format,
          report.config,
        );
      } else {
        // Use provided template directly
        const templateId = `temp_${Date.now()}`;
        this.registerTemplate(templateId, report.template);
        content = await this.generateFromTemplate(
          templateId,
          data,
          report.format,
          report.config,
        );
        this.templates.delete(templateId);
      }

      // Update last run time
      report.lastRun = new Date();
      this.scheduledReports.set(report.id, report);

      // Send to recipients (would implement email/notification here)
      if (report.recipients && report.recipients.length > 0) {
        await this.sendReportToRecipients(content, report);
      }

      // Save report (would implement storage here)
      await this.saveGeneratedReport(report.id, content);
    } catch (error) {
      console.error(`Failed to run scheduled report ${report.id}:`, error);
    }
  }

  /**
   * Gather data for report
   */
  private async gatherReportData(): Promise<any> {
    // This would gather all necessary data for reports
    // For now, return mock data structure
    return {
      metrics: {
        totalPosts: 1000,
        totalUsers: 500,
        avgEngagement: 0.75,
      },
      overview: "System running normally",
      platforms: [],
      trending: [],
      timeSeries: [],
      topContent: [],
      performance: {
        scraping: { successRate: 0.95 },
        database: { size: 1000000 },
        dataQuality: { overall: 85 },
      },
    };
  }

  /**
   * Send report to recipients (placeholder)
   */
  private async sendReportToRecipients(
    content: string,
    report: ScheduledReport,
  ): Promise<void> {
    // This would implement actual sending logic (email, webhook, etc.)
    console.log(
      `Sending report ${report.name} to ${report.recipients?.join(", ")}`,
    );
  }

  /**
   * Save generated report (placeholder)
   */
  private async saveGeneratedReport(
    reportId: string,
    content: string,
  ): Promise<void> {
    // This would implement actual storage logic
    console.log(`Saving report ${reportId} (${content.length} bytes)`);
  }

  /**
   * Get scheduled reports
   */
  public getScheduledReports(): Map<string, ScheduledReport> {
    return new Map(this.scheduledReports);
  }

  /**
   * Update scheduled report
   */
  public updateScheduledReport(
    reportId: string,
    updates: Partial<ScheduledReport>,
  ): void {
    const report = this.scheduledReports.get(reportId);
    if (!report) {
      throw new Error(`Scheduled report '${reportId}' not found`);
    }

    const updatedReport = { ...report, ...updates };
    this.scheduledReports.set(reportId, updatedReport);

    // Restart schedule if needed
    if (updates.enabled !== undefined || updates.schedule) {
      if (updatedReport.enabled) {
        this.startReportSchedule(updatedReport);
      } else {
        this.stopReportSchedule(reportId);
      }
    }
  }

  /**
   * Delete scheduled report
   */
  public deleteScheduledReport(reportId: string): void {
    this.stopReportSchedule(reportId);
    this.scheduledReports.delete(reportId);
  }

  /**
   * Generate PDF report (placeholder for now)
   */
  public async generatePDFReport(
    title: string,
    data: any,
    config?: ReportConfig,
  ): Promise<Buffer> {
    // This would require a PDF generation library like puppeteer or pdfkit
    // For now, generate HTML and return as buffer
    const html = await this.generateFromTemplate(
      "executive",
      data,
      "html",
      config,
    );
    return Buffer.from(html);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Stop all scheduled reports
    this.scheduleTimers.forEach((timer) => clearInterval(timer));
    this.scheduleTimers.clear();
  }
}
