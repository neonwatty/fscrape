/**
 * Analytics Exporter
 * Exports analytics data with rich visualizations
 */

import type { GeneratedReport, ReportSection } from "../../analytics/report-generator.js";
import type { DashboardMetrics } from "../../analytics/dashboard.js";
import { AnalyticsVisualizer } from "../../analytics/visualizer.js";
import type { DataPoint, MultiSeriesData, ChartOptions } from "../../analytics/visualizer.js";
import fs from "fs/promises";
import path from "path";

export interface AnalyticsExportOptions {
  includeVisualizations?: boolean;
  includeRawData?: boolean;
  chartOptions?: ChartOptions;
  format?: "text" | "html" | "svg" | "json";
  outputStyle?: "minimal" | "detailed" | "dashboard";
  theme?: "light" | "dark" | "terminal";
}

export interface AnalyticsExportResult {
  files: string[];
  metadata: {
    exportedAt: Date;
    format: string;
    visualizationCount?: number;
    dataPointCount?: number;
  };
}

export class AnalyticsExporter {
  private visualizer: AnalyticsVisualizer;
  private defaultOptions: Required<AnalyticsExportOptions> = {
    includeVisualizations: true,
    includeRawData: false,
    chartOptions: {
      width: 120,
      height: 30,
      showLabels: true,
      showLegend: true,
      showGrid: true,
      colors: true,
      style: "detailed",
    },
    format: "text",
    outputStyle: "detailed",
    theme: "terminal",
  };

  constructor(options?: AnalyticsExportOptions) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    this.visualizer = new AnalyticsVisualizer();
  }

  /**
   * Export analytics report with visualizations
   */
  async exportReport(
    report: GeneratedReport,
    outputPath: string,
    options?: AnalyticsExportOptions,
  ): Promise<AnalyticsExportResult> {
    const opts = { ...this.defaultOptions, ...options };
    const files: string[] = [];
    let visualizationCount = 0;

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Process based on format
    switch (opts.format) {
      case "html":
        const htmlContent = await this.generateHtmlReport(report, opts);
        await fs.writeFile(outputPath, htmlContent);
        files.push(outputPath);
        break;

      case "svg":
        const svgFiles = await this.generateSvgCharts(report, outputPath, opts);
        files.push(...svgFiles);
        visualizationCount = svgFiles.length;
        break;

      case "json":
        const jsonContent = await this.generateJsonReport(report, opts);
        await fs.writeFile(outputPath, jsonContent);
        files.push(outputPath);
        break;

      case "text":
      default:
        const textContent = await this.generateTextReport(report, opts);
        await fs.writeFile(outputPath, textContent);
        files.push(outputPath);
        break;
    }

    return {
      files,
      metadata: {
        exportedAt: new Date(),
        format: opts.format,
        visualizationCount,
        dataPointCount: this.countDataPoints(report),
      },
    };
  }

  /**
   * Export dashboard metrics with visualizations
   */
  async exportDashboard(
    metrics: DashboardMetrics,
    outputPath: string,
    options?: AnalyticsExportOptions,
  ): Promise<AnalyticsExportResult> {
    const opts = { ...this.defaultOptions, ...options };
    const files: string[] = [];

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Generate dashboard visualizations
    const dashboardContent = await this.generateDashboardVisualization(metrics, opts);

    // Save based on format
    if (opts.format === "html") {
      const htmlContent = this.wrapInHtml(dashboardContent, "Analytics Dashboard", opts);
      await fs.writeFile(outputPath, htmlContent);
    } else {
      await fs.writeFile(outputPath, dashboardContent);
    }

    files.push(outputPath);

    // Export raw data if requested
    if (opts.includeRawData) {
      const dataPath = outputPath.replace(/\.[^.]+$/, "-data.json");
      await fs.writeFile(dataPath, JSON.stringify(metrics, null, 2));
      files.push(dataPath);
    }

    return {
      files,
      metadata: {
        exportedAt: new Date(),
        format: opts.format,
        visualizationCount: this.countDashboardVisualizations(metrics),
        dataPointCount: this.countDashboardDataPoints(metrics),
      },
    };
  }

  /**
   * Generate text report with ASCII visualizations
   */
  private async generateTextReport(
    report: GeneratedReport,
    options: Required<AnalyticsExportOptions>,
  ): Promise<string> {
    const lines: string[] = [];

    // Header
    lines.push("=" .repeat(80));
    lines.push(this.centerText(report.title, 80));
    lines.push("=" .repeat(80));
    lines.push("");
    lines.push(`Generated: ${report.generatedAt.toLocaleString()}`);
    lines.push("");

    // Process sections
    for (const section of report.sections) {
      lines.push("-".repeat(60));
      lines.push(section.title);
      lines.push("-".repeat(60));

      if (section.type === "chart" && options.includeVisualizations) {
        const chart = this.generateChartFromSection(section, options.chartOptions);
        lines.push(chart);
      } else if (section.type === "table") {
        const table = this.formatTableSection(section);
        lines.push(table);
      } else {
        lines.push(String(section.content));
      }

      lines.push("");
    }

    // Footer
    if (report.metadata) {
      lines.push("-".repeat(80));
      lines.push("Metadata:");
      if (report.metadata.dataRange) {
        lines.push(`  Data Range: ${report.metadata.dataRange.start.toLocaleDateString()} - ${report.metadata.dataRange.end.toLocaleDateString()}`);
      }
      if (report.metadata.platforms) {
        lines.push(`  Platforms: ${report.metadata.platforms.join(", ")}`);
      }
      if (report.metadata.recordCount) {
        lines.push(`  Records: ${report.metadata.recordCount.toLocaleString()}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate HTML report with embedded visualizations
   */
  private async generateHtmlReport(
    report: GeneratedReport,
    options: Required<AnalyticsExportOptions>,
  ): Promise<string> {
    const styles = this.getHtmlStyles(options.theme);
    const sections: string[] = [];

    // Process sections
    for (const section of report.sections) {
      let sectionHtml = `<div class="section ${section.priority}">`;
      sectionHtml += `<h2>${section.title}</h2>`;

      if (section.type === "chart" && options.includeVisualizations) {
        const chart = this.generateChartFromSection(section, options.chartOptions);
        sectionHtml += `<pre class="chart">${this.escapeHtml(chart)}</pre>`;
      } else if (section.type === "table") {
        sectionHtml += this.formatHtmlTable(section);
      } else {
        sectionHtml += `<div class="content">${this.escapeHtml(String(section.content))}</div>`;
      }

      sectionHtml += "</div>";
      sections.push(sectionHtml);
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${report.title}</h1>
      <p class="generated">Generated: ${report.generatedAt.toLocaleString()}</p>
    </header>
    <main>
      ${sections.join("\n")}
    </main>
    <footer>
      ${this.generateHtmlFooter(report.metadata)}
    </footer>
  </div>
</body>
</html>`;
  }

  /**
   * Generate SVG charts from report
   */
  private async generateSvgCharts(
    report: GeneratedReport,
    basePath: string,
    options: Required<AnalyticsExportOptions>,
  ): Promise<string[]> {
    const files: string[] = [];
    const baseDir = path.dirname(basePath);
    const baseName = path.basename(basePath, path.extname(basePath));

    let chartIndex = 0;
    for (const section of report.sections) {
      if (section.type === "chart") {
        const svgContent = this.generateSvgChart(section, options.chartOptions);
        const fileName = `${baseName}-chart-${++chartIndex}.svg`;
        const filePath = path.join(baseDir, fileName);

        await fs.writeFile(filePath, svgContent);
        files.push(filePath);
      }
    }

    return files;
  }

  /**
   * Generate JSON report with embedded visualizations as text
   */
  private async generateJsonReport(
    report: GeneratedReport,
    options: Required<AnalyticsExportOptions>,
  ): Promise<string> {
    const exportData: any = {
      title: report.title,
      generatedAt: report.generatedAt,
      metadata: report.metadata,
      sections: [],
    };

    for (const section of report.sections) {
      const exportSection: any = {
        title: section.title,
        type: section.type,
        priority: section.priority,
      };

      if (section.type === "chart" && options.includeVisualizations) {
        exportSection.visualization = this.generateChartFromSection(section, options.chartOptions);
      }

      if (options.includeRawData || section.type !== "chart") {
        exportSection.content = section.content;
      }

      exportData.sections.push(exportSection);
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate dashboard visualization
   */
  private async generateDashboardVisualization(
    metrics: DashboardMetrics,
    options: Required<AnalyticsExportOptions>,
  ): Promise<string> {
    const lines: string[] = [];

    // Title
    lines.push("╔" + "═".repeat(118) + "╗");
    lines.push("║" + this.centerText("ANALYTICS DASHBOARD", 118) + "║");
    lines.push("╚" + "═".repeat(118) + "╝");
    lines.push("");

    // Overview metrics
    lines.push("┌" + "─".repeat(58) + "┬" + "─".repeat(59) + "┐");
    lines.push("│" + this.centerText("OVERVIEW", 58) + "│" + this.centerText("GROWTH", 59) + "│");
    lines.push("├" + "─".repeat(58) + "┼" + "─".repeat(59) + "┤");

    const overview = metrics.overview;
    lines.push(
      "│ Total Posts:     " + this.padRight(overview.totalPosts.toLocaleString(), 39) +
      "│ Growth Rate:     " + this.padRight((overview.growthRate * 100).toFixed(2) + "%", 40) + "│"
    );
    lines.push(
      "│ Total Comments:  " + this.padRight(overview.totalComments.toLocaleString(), 39) +
      "│ Avg Engagement:  " + this.padRight(overview.avgEngagement.toFixed(2), 40) + "│"
    );
    lines.push(
      "│ Total Users:     " + this.padRight(overview.totalUsers.toLocaleString(), 39) +
      "│" + " ".repeat(59) + "│"
    );
    lines.push("└" + "─".repeat(58) + "┴" + "─".repeat(59) + "┘");
    lines.push("");

    // Platform breakdown chart
    if (metrics.platformBreakdown.size > 0) {
      lines.push("Platform Distribution:");
      const platformData: MultiSeriesData[] = [];
      metrics.platformBreakdown.forEach((stats, platform) => {
        platformData.push({
          label: platform,
          posts: stats.postCount,
          comments: stats.commentCount,
        });
      });

      const chart = this.visualizer.createBarChart(
        platformData,
        undefined,
        { ...options.chartOptions, height: 15 }
      );
      lines.push(chart);
      lines.push("");
    }

    // Time series trend
    if (metrics.timeSeries && metrics.timeSeries.length > 0) {
      lines.push("Activity Trend:");
      const trendData: DataPoint[] = metrics.timeSeries.map(ts => ({
        date: ts.date,
        value: ts.postCount + ts.commentCount,
      }));

      const trendChart = this.visualizer.createLineChart(
        trendData,
        undefined,
        { ...options.chartOptions, height: 15 }
      );
      lines.push(trendChart);
      lines.push("");
    }

    // Trending posts
    if (metrics.trending && metrics.trending.length > 0) {
      lines.push("Top Trending Posts:");
      lines.push("─".repeat(118));
      metrics.trending.slice(0, 5).forEach((post, i) => {
        const bar = this.visualizer.createProgressBar(post.score, metrics.trending[0].score, 40);
        lines.push(`${i + 1}. ${this.padRight(post.title.substring(0, 60), 62)} ${bar}`);
      });
      lines.push("");
    }

    // Health metrics
    if (metrics.health) {
      lines.push("System Health:");
      lines.push(`Database Size: ${(metrics.health.databaseSize / (1024 * 1024)).toFixed(2)} MB`);
      lines.push(`Data Quality: ${this.visualizer.createProgressBar(metrics.health.dataQuality, 100, 30)}`);
      lines.push(`Last Update: ${metrics.health.lastUpdate.toLocaleString()}`);
    }

    return lines.join("\n");
  }

  /**
   * Generate chart from section data
   */
  private generateChartFromSection(section: ReportSection, options?: ChartOptions): string {
    if (!section.content || typeof section.content !== "object") {
      return "No chart data available";
    }

    const data = section.content;

    // Determine chart type from data structure
    if (Array.isArray(data)) {
      if (data.length > 0) {
        if ("value" in data[0] && ("date" in data[0] || "label" in data[0])) {
          // Line chart data
          return this.visualizer.createLineChart(data as DataPoint[], section.title, options);
        } else if ("label" in data[0] && Object.keys(data[0]).length > 1) {
          // Bar chart data
          return this.visualizer.createBarChart(data as MultiSeriesData[], section.title, options);
        }
      }
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate SVG chart
   */
  private generateSvgChart(section: ReportSection, _options?: ChartOptions): string {
    // Simplified SVG generation - in a real implementation, this would create proper SVG charts
    const width = 800;
    const height = 400;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f0f0f0"/>
  <text x="${width/2}" y="30" text-anchor="middle" font-size="20" font-weight="bold">
    ${section.title}
  </text>
  <text x="${width/2}" y="${height/2}" text-anchor="middle" font-size="14">
    [Chart visualization would be rendered here]
  </text>
</svg>`;
  }

  /**
   * Format table section
   */
  private formatTableSection(section: ReportSection): string {
    if (!section.content || !Array.isArray(section.content)) {
      return "No table data available";
    }

    return this.visualizer.createComparisonTable(section.content);
  }

  /**
   * Format HTML table
   */
  private formatHtmlTable(section: ReportSection): string {
    if (!section.content || !Array.isArray(section.content)) {
      return "<p>No table data available</p>";
    }

    const data = section.content;
    if (data.length === 0) return "<p>Empty table</p>";

    const headers = Object.keys(data[0]);

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    headers.forEach(h => {
      html += `<th>${this.escapeHtml(h)}</th>`;
    });
    html += '</tr></thead>';

    html += '<tbody>';
    data.forEach(row => {
      html += '<tr>';
      headers.forEach(h => {
        html += `<td>${this.escapeHtml(String(row[h] || ""))}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    return html;
  }

  /**
   * Get HTML styles based on theme
   */
  private getHtmlStyles(theme: string): string {
    const baseStyles = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
      }
      .container {
        max-width: 1200px;
        margin: 0 auto;
      }
      header {
        border-bottom: 2px solid #ddd;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      h1 {
        margin: 0 0 10px 0;
      }
      .generated {
        color: #666;
        font-size: 14px;
      }
      .section {
        margin-bottom: 30px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 8px;
      }
      .section.high {
        border-color: #ff6b6b;
        background: #fff5f5;
      }
      .section.medium {
        border-color: #ffd93d;
        background: #fffef5;
      }
      .section.low {
        border-color: #6bcf7f;
        background: #f5fff7;
      }
      .chart {
        font-family: 'Courier New', monospace;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
      }
      .data-table th,
      .data-table td {
        padding: 8px 12px;
        text-align: left;
        border: 1px solid #ddd;
      }
      .data-table th {
        background: #f8f9fa;
        font-weight: bold;
      }
      footer {
        margin-top: 50px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        color: #666;
        font-size: 14px;
      }
    `;

    if (theme === "dark") {
      return baseStyles + `
        body {
          background: #1a1a1a;
          color: #e0e0e0;
        }
        .section {
          background: #2a2a2a;
          border-color: #444;
        }
        .chart {
          background: #333;
          color: #0f0;
        }
      `;
    }

    return baseStyles;
  }

  /**
   * Generate HTML footer
   */
  private generateHtmlFooter(metadata?: any): string {
    if (!metadata) return "";

    let footer = "<div class='metadata'>";
    if (metadata.dataRange) {
      footer += `<p>Data Range: ${metadata.dataRange.start.toLocaleDateString()} - ${metadata.dataRange.end.toLocaleDateString()}</p>`;
    }
    if (metadata.platforms) {
      footer += `<p>Platforms: ${metadata.platforms.join(", ")}</p>`;
    }
    if (metadata.recordCount) {
      footer += `<p>Total Records: ${metadata.recordCount.toLocaleString()}</p>`;
    }
    footer += "</div>";

    return footer;
  }

  /**
   * Utility methods
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return " ".repeat(leftPad) + text + " ".repeat(rightPad);
  }

  private padRight(text: string, width: number): string {
    return text.padEnd(width, " ");
  }

  private countDataPoints(report: GeneratedReport): number {
    let count = 0;
    for (const section of report.sections) {
      if (section.type === "chart" && Array.isArray(section.content)) {
        count += section.content.length;
      }
    }
    return count;
  }

  private countDashboardVisualizations(metrics: DashboardMetrics): number {
    let count = 0;
    if (metrics.platformBreakdown.size > 0) count++;
    if (metrics.timeSeries && metrics.timeSeries.length > 0) count++;
    if (metrics.trending && metrics.trending.length > 0) count++;
    return count;
  }

  private countDashboardDataPoints(metrics: DashboardMetrics): number {
    let count = 0;
    count += metrics.platformBreakdown.size;
    count += metrics.timeSeries?.length || 0;
    count += metrics.trending?.length || 0;
    return count;
  }
}