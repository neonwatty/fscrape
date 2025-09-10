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

export class ReportGenerator {
  private analytics: DatabaseAnalytics;
  private visualizer: AnalyticsVisualizer;
  private defaultConfig: Required<ReportConfig> = {
    includeCharts: true,
    includeRawData: false,
    includeSummary: true,
    includeRecommendations: true,
    dateFormat: "short",
    numberFormat: "standard",
  };

  constructor(analytics: DatabaseAnalytics) {
    this.analytics = analytics;
    this.visualizer = new AnalyticsVisualizer();
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
        dateRange: query.dateRange,
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
}
