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
    const content = `
## Key Metrics
- Total Posts: ${this.formatNumber(overview.totalPosts)}
- Total Comments: ${this.formatNumber(overview.totalComments)}
- Total Users: ${this.formatNumber(overview.totalUsers)}
- Average Engagement: ${overview.avgEngagement.toFixed(2)}
- Growth Rate: ${overview.growthRate > 0 ? "+" : ""}${overview.growthRate.toFixed(1)}%

## Platform Performance
${Array.from(metrics.platformBreakdown.entries())
  .map(
    ([platform, stats]) =>
      `- ${platform}: ${stats.totalPosts} posts, ${stats.avgScore.toFixed(2)} avg score`,
  )
  .join("\n")}

## Data Health
- Database Size: ${this.formatBytes(metrics.health.databaseSize)}
- Data Quality Score: ${metrics.health.dataQuality}/100
- Last Update: ${this.formatDate(metrics.health.lastUpdate)}
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
- Success Rate: ${(performance.scraping.successRate * 100).toFixed(1)}%
- Avg Response Time: ${performance.scraping.avgResponseTime.toFixed(0)}ms
- Items/Second: ${performance.scraping.itemsPerSecond.toFixed(2)}
- Error Rate: ${performance.scraping.errorRate.toFixed(1)}%

## Database Performance
- Size: ${this.formatBytes(performance.database.size)}
- Query Performance: ${performance.database.queryPerformance}%
- Index Efficiency: ${performance.database.indexEfficiency}%

## Data Quality
- Completeness: ${performance.dataQuality.completeness}%
- Freshness: ${performance.dataQuality.freshness}%
- Consistency: ${performance.dataQuality.consistency}%
- Overall: ${performance.dataQuality.overall}%
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
    const recommendations: string[] = [];

    // Growth recommendations
    if (data.metrics.overview.growthRate < 0) {
      recommendations.push(
        "⚠️ Negative growth detected. Consider increasing scraping frequency or expanding data sources.",
      );
    }

    // Data quality recommendations
    if (data.metrics.health.dataQuality < 80) {
      recommendations.push(
        "📊 Data quality below optimal. Review data collection processes and validation rules.",
      );
    }

    // Performance recommendations
    if (data.performance?.scraping.errorRate > 5) {
      recommendations.push(
        "🔧 High error rate in scraping. Check API rate limits and connection stability.",
      );
    }

    // Gap recommendations
    if (data.metrics.health.gaps.length > 0) {
      recommendations.push(
        "📅 Data gaps detected. Consider backfilling missing periods for complete analysis.",
      );
    }

    // Database recommendations
    if (data.performance?.database.size > 1000000000) {
      // 1GB
      recommendations.push(
        "💾 Database size exceeding 1GB. Consider archiving old data or optimizing storage.",
      );
    }

    const content =
      recommendations.length > 0
        ? recommendations.join("\n\n")
        : "✅ All systems operating within normal parameters.";

    return {
      title: "Recommendations",
      content,
      priority: "high",
      type: "text",
    };
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
      return `${(num / 1000).toFixed(1)}K`;
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
  public validateTemplate(template: ReportTemplate): { valid: boolean; errors: string[] } {
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
          errors.push(`Section ${section.id} must have position in dashboard layout`);
        } else {
          const key = `${section.position.row},${section.position.col}`;
          if (positions.has(key)) {
            errors.push(`Position conflict at row ${section.position.row}, col ${section.position.col}`);
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
    config?: ReportConfig,
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

      const sectionData = this.extractDataFromSource(data, templateSection.dataSource);
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
            ${typeof section.content === "string" 
              ? section.content.replace(/\n/g, "<br>")
              : `<pre>${JSON.stringify(section.content, null, 2)}</pre>`}
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
    console.log(`Sending report ${report.name} to ${report.recipients?.join(", ")}`);
  }

  /**
   * Save generated report (placeholder)
   */
  private async saveGeneratedReport(reportId: string, content: string): Promise<void> {
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
  public updateScheduledReport(reportId: string, updates: Partial<ScheduledReport>): void {
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
    const html = await this.generateFromTemplate("executive", data, "html", config);
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
