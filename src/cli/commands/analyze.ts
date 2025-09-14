/**
 * Analyze command - Comprehensive analytics for scraped data
 */

import { Command } from "commander";
import {
  validatePath,
  validatePositiveInt,
  formatError,
} from "../validation.js";
import { DatabaseManager } from "../../database/database.js";
import { StatisticsEngine } from "../../analytics/statistics.js";
import { TrendAnalyzer } from "../../analytics/trend-analyzer.js";
import { AnomalyDetector } from "../../analytics/anomaly-detector.js";
import { ForecastingEngine } from "../../analytics/forecasting.js";
import { ReportGenerator } from "../../analytics/report-generator.js";
import { AnalyticsDashboard } from "../../analytics/dashboard.js";
import chalk from "chalk";
import Table from "cli-table3";
import { format, parseISO, isValid, subDays } from "date-fns";

/**
 * Common options interface for all analyze subcommands
 */
interface CommonAnalyzeOptions {
  database?: string;
  platform?: string;
  timeRange?: string;
  outputFormat?: string;
  cache?: boolean;
  cacheDir?: string;
}

/**
 * Parse time range string into start and end dates
 * Supports formats like "7d", "30d", "2024-01-01:2024-12-31", "last-week", "last-month"
 */
function parseTimeRange(timeRange: string): { start: Date; end: Date } {
  const now = new Date();

  // Handle relative ranges like "7d", "30d"
  if (/^\d+d$/.test(timeRange)) {
    const days = parseInt(timeRange.slice(0, -1), 10);
    return {
      start: subDays(now, days),
      end: now,
    };
  }

  // Handle date range like "2024-01-01:2024-12-31"
  if (timeRange.includes(":")) {
    const [startStr, endStr] = timeRange.split(":");
    const start = parseISO(startStr);
    const end = parseISO(endStr);

    if (!isValid(start) || !isValid(end)) {
      throw new Error(`Invalid date range format: ${timeRange}`);
    }

    return { start, end };
  }

  // Handle named ranges
  switch (timeRange.toLowerCase()) {
    case "today":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: now,
      };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return {
        start: new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
        ),
        end: new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          23,
          59,
          59,
        ),
      };
    case "last-week":
      return {
        start: subDays(now, 7),
        end: now,
      };
    case "last-month":
      return {
        start: subDays(now, 30),
        end: now,
      };
    case "last-year":
      return {
        start: subDays(now, 365),
        end: now,
      };
    default:
      throw new Error(`Unsupported time range format: ${timeRange}`);
  }
}

/**
 * Validate output format
 */
function validateOutputFormat(format: string): string {
  const validFormats = ["json", "table", "csv", "html", "markdown", "chart"];
  const lowerFormat = format.toLowerCase();

  if (!validFormats.includes(lowerFormat)) {
    throw new Error(
      `Invalid output format: ${format}. Valid formats: ${validFormats.join(", ")}`,
    );
  }

  return lowerFormat;
}

/**
 * Get cache key for analytics results
 */
function getCacheKey(command: string, options: any): string {
  const parts = [
    command,
    options.platform || "all",
    options.timeRange || "30d",
    options.outputFormat || "table",
  ];

  // Add any additional options that affect the result
  if (options.metrics) {
    parts.push(options.metrics.sort().join(","));
  }

  return parts.join(":");
}

/**
 * Simple in-memory cache for analytics results
 */
class AnalyticsCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ttl: number = 5 * 60 * 1000; // 5 minutes default TTL

  constructor(ttl?: number) {
    if (ttl) this.ttl = ttl;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const analyticsCache = new AnalyticsCache();

/**
 * Create the analyze command with subcommands
 */
export function createAnalyzeCommand(): Command {
  const command = new Command("analyze")
    .description("Analyze scraped data with various analytics tools")
    .option("-d, --database <path>", "Database path", "fscrape.db")
    .option(
      "-p, --platform <platform>",
      "Filter by platform (reddit, hackernews, etc.)",
    )
    .option(
      "-t, --time-range <range>",
      "Time range for analysis (e.g., 7d, 30d, last-week, 2024-01-01:2024-12-31)",
      "30d",
    )
    .option(
      "-o, --output-format <format>",
      "Output format (json, table, csv, html, markdown, chart)",
      "table",
    )
    .option(
      "--cache",
      "Enable result caching for faster repeated queries",
      false,
    )
    .option(
      "--cache-dir <path>",
      "Directory for cache storage",
      ".cache/analytics",
    )
    .option("--no-color", "Disable colored output", false)
    .option("--verbose", "Show detailed debug information", false);

  // Statistics subcommand
  command
    .command("statistics")
    .alias("stats")
    .description("Display statistical analysis of scraped data")
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--days <number>",
      "Number of days to analyze",
      (value) => validatePositiveInt(value, "Days"),
      30,
    )
    .option("-f, --format <format>", "Output format (json, table)", "table")
    .option("--metrics <metrics...>", "Specific metrics to analyze")
    .option("--verbose", "Show detailed statistics", false)
    .action(async (options) => {
      await handleStatistics(command.opts(), options);
    });

  // Trends subcommand
  command
    .command("trends")
    .description("Identify trends in engagement and activity")
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--days <number>",
      "Number of days to analyze",
      (value) => validatePositiveInt(value, "Days"),
      30,
    )
    .option(
      "--metric <metric>",
      "Metric to analyze (posts, comments, engagement, users, score)",
      "engagement",
    )
    .option(
      "--period <period>",
      "Analysis period (hourly, daily, weekly, monthly)",
      "daily",
    )
    .option(
      "--threshold <number>",
      "Significance threshold for trend detection (0-1)",
      parseFloat,
      0.05,
    )
    .option(
      "--method <method>",
      "Analysis method (mann-kendall, regression, seasonal, auto)",
      "auto",
    )
    .option(
      "-f, --format <format>",
      "Output format (json, table, chart, detailed)",
      "table",
    )
    .option("--breakpoints", "Detect breakpoints in trends", false)
    .option(
      "--seasonal-period <number>",
      "Period for seasonal analysis",
      (value) => validatePositiveInt(value, "Period"),
      7,
    )
    .option("--confidence <number>", "Confidence level (0-1)", parseFloat, 0.95)
    .option("--smooth", "Apply smoothing to trend data", false)
    .option("--compare", "Compare trends across periods", false)
    .action(async (options) => {
      await handleTrends(command.opts(), options);
    });

  // Anomalies subcommand
  command
    .command("anomalies")
    .alias("anomaly")
    .description("Detect anomalies in scraped data")
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--days <number>",
      "Number of days to analyze",
      (value) => validatePositiveInt(value, "Days"),
      30,
    )
    .option(
      "--method <method>",
      "Detection method (zscore, iqr, isolation, mad, ensemble)",
      "ensemble",
    )
    .option("--threshold <number>", "Detection threshold", parseFloat, 2.5)
    .option("--metrics <metrics...>", "Metrics to check for anomalies")
    .option("-f, --format <format>", "Output format (json, table)", "table")
    .option(
      "--include-context",
      "Include contextual data around anomalies",
      false,
    )
    .action(async (options) => {
      await handleAnomalies(command.opts(), options);
    });

  // Forecast subcommand
  command
    .command("forecast")
    .description("Forecast future trends based on historical data")
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--days <number>",
      "Historical days to use",
      (value) => validatePositiveInt(value, "Days"),
      60,
    )
    .option(
      "--horizon <number>",
      "Days to forecast ahead",
      (value) => validatePositiveInt(value, "Horizon"),
      7,
    )
    .option(
      "--model <model>",
      "Forecasting model (auto, linear, seasonal, smoothing, holt-winters)",
      "auto",
    )
    .option("--confidence <number>", "Confidence level (0-1)", parseFloat, 0.95)
    .option("--metric <metric>", "Metric to forecast", "engagement")
    .option(
      "-f, --format <format>",
      "Output format (json, table, chart)",
      "table",
    )
    .option("--validate", "Perform cross-validation", false)
    .action(async (options) => {
      await handleForecast(command.opts(), options);
    });

  // Compare subcommand
  command
    .command("compare")
    .description("Compare metrics across time periods or platforms")
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--base-period <range>",
      "Base period for comparison (e.g., '7d', '2024-01-01:2024-01-31')",
      "7d",
    )
    .option(
      "--compare-period <range>",
      "Period to compare against (e.g., '7d', '2024-02-01:2024-02-28')",
      "previous",
    )
    .option(
      "--metrics <metrics...>",
      "Metrics to compare (posts, comments, engagement, users, score)",
      ["engagement", "posts", "comments"],
    )
    .option(
      "--comparison-type <type>",
      "Type of comparison (period-to-period, platform-to-platform, metric-to-metric)",
      "period-to-period",
    )
    .option(
      "--platforms <platforms...>",
      "Platforms to compare (for platform-to-platform comparison)",
    )
    .option(
      "-f, --format <format>",
      "Output format (table, json, csv, markdown, chart)",
      "table",
    )
    .option("--show-percentage", "Show percentage changes", true)
    .option("--show-absolute", "Show absolute differences", true)
    .option(
      "--highlight-significant",
      "Highlight statistically significant differences",
      true,
    )
    .action(async (options) => {
      await handleCompare(command.opts(), options);
    });

  // Report subcommand
  command
    .command("report")
    .description("Generate comprehensive analytics report")
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--days <number>",
      "Number of days to analyze",
      (value) => validatePositiveInt(value, "Days"),
      30,
    )
    .option("-o, --output <path>", "Output file path")
    .option(
      "--format <format>",
      "Report format (html, pdf, markdown, json)",
      "html",
    )
    .option(
      "--template <template>",
      "Report template (summary, detailed, executive)",
      "detailed",
    )
    .option("--include-charts", "Include visualizations", false)
    .option("--sections <sections...>", "Specific sections to include")
    .action(async (options) => {
      await handleReport(command.opts(), options);
    });

  // Dashboard subcommand
  command
    .command("dashboard")
    .description("Display interactive analytics dashboard")
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--days <number>",
      "Number of days to display",
      (value) => validatePositiveInt(value, "Days"),
      30,
    )
    .option("--refresh <seconds>", "Auto-refresh interval", (value) =>
      validatePositiveInt(value, "Seconds"),
    )
    .option("--compact", "Use compact display mode", false)
    .action(async (options) => {
      await handleDashboard(command.opts(), options);
    });

  return command;
}

/**
 * Handle statistics subcommand
 */
async function handleStatistics(parentOpts: any, options: any): Promise<void> {
  try {
    // Merge parent and subcommand options
    const mergedOptions = {
      ...parentOpts,
      ...options,
      platform: options.platform || parentOpts.platform,
      outputFormat: options.format || parentOpts.outputFormat || "table",
    };

    // Check cache if enabled
    const cacheKey = parentOpts.cache
      ? getCacheKey("statistics", mergedOptions)
      : null;
    if (cacheKey) {
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        if (parentOpts.verbose) {
          console.log(chalk.gray("Using cached result"));
        }
        displayStatisticsResult(cached, mergedOptions.outputFormat);
        return;
      }
    }

    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();
    const stats = new StatisticsEngine();

    // Parse time range from parent options
    const timeRange = parentOpts.timeRange
      ? parseTimeRange(parentOpts.timeRange)
      : null;
    const endDate = timeRange?.end || new Date();
    const startDate =
      timeRange?.start ||
      new Date(endDate.getTime() - (options.days || 30) * 24 * 60 * 60 * 1000);

    // Calculate days between dates for the query
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    const metrics = analytics.getEngagementOverTime(
      daysDiff,
      mergedOptions.platform,
    );

    // Calculate statistics
    const values = metrics.map((m: any) => m.engagement || 0);
    const analysis = StatisticsEngine.getSummary(values);

    // Cache the result if caching is enabled
    if (cacheKey) {
      analyticsCache.set(cacheKey, analysis);
    }

    displayStatisticsResult(analysis, mergedOptions.outputFormat);
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Display statistics result in the specified format
 */
function displayStatisticsResult(analysis: any, format: string): void {
  const validatedFormat = validateOutputFormat(format);

  switch (validatedFormat) {
    case "json":
      console.log(JSON.stringify(analysis, null, 2));
      break;
    case "csv":
      console.log("Metric,Value");
      console.log(`Count,${analysis.count || 0}`);
      console.log(`Mean,${analysis.mean.toFixed(2)}`);
      console.log(`Median,${analysis.median.toFixed(2)}`);
      console.log(`StdDev,${analysis.standardDeviation.toFixed(2)}`);
      console.log(`Min,${analysis.min.toFixed(2)}`);
      console.log(`Max,${analysis.max.toFixed(2)}`);
      console.log(`Q1,${analysis.quartiles.q1.toFixed(2)}`);
      console.log(`Q3,${analysis.quartiles.q3.toFixed(2)}`);
      console.log(`Skewness,${analysis.skewness.toFixed(3)}`);
      console.log(`Kurtosis,${analysis.kurtosis.toFixed(3)}`);
      break;
    case "markdown":
      console.log("# Statistical Analysis\n");
      console.log("| Metric | Value |");
      console.log("|--------|-------|");
      console.log(`| Count | ${analysis.count || 0} |`);
      console.log(`| Mean | ${analysis.mean.toFixed(2)} |`);
      console.log(`| Median | ${analysis.median.toFixed(2)} |`);
      console.log(`| Std Dev | ${analysis.standardDeviation.toFixed(2)} |`);
      console.log(`| Min | ${analysis.min.toFixed(2)} |`);
      console.log(`| Max | ${analysis.max.toFixed(2)} |`);
      console.log(`| Q1 | ${analysis.quartiles.q1.toFixed(2)} |`);
      console.log(`| Q3 | ${analysis.quartiles.q3.toFixed(2)} |`);
      console.log(`| Skewness | ${analysis.skewness.toFixed(3)} |`);
      console.log(`| Kurtosis | ${analysis.kurtosis.toFixed(3)} |`);
      break;
    case "table":
    default:
      // Display as table
      const table = new Table({
        head: ["Metric", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["Count", analysis.count || 0],
        ["Mean", analysis.mean.toFixed(2)],
        ["Median", analysis.median.toFixed(2)],
        ["Std Dev", analysis.standardDeviation.toFixed(2)],
        ["Min", analysis.min.toFixed(2)],
        ["Max", analysis.max.toFixed(2)],
        ["Q1", analysis.quartiles.q1.toFixed(2)],
        ["Q3", analysis.quartiles.q3.toFixed(2)],
        ["Skewness", analysis.skewness.toFixed(3)],
        ["Kurtosis", analysis.kurtosis.toFixed(3)],
      );

      console.log(chalk.cyan("📊 Statistical Analysis"));
      console.log(table.toString());
      break;
  }
}

/**
 * Handle trends subcommand
 */
async function handleTrends(parentOpts: any, options: any): Promise<void> {
  try {
    // Merge parent and subcommand options
    const mergedOptions = {
      ...parentOpts,
      ...options,
      platform: options.platform || parentOpts.platform,
      outputFormat: options.format || parentOpts.outputFormat || "table",
      threshold: options.threshold || 0.05,
      confidence: options.confidence || 0.95,
    };

    // Check cache if enabled
    const cacheKey = parentOpts.cache
      ? getCacheKey("trends", mergedOptions)
      : null;
    if (cacheKey) {
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        if (parentOpts.verbose) {
          console.log(chalk.gray("Using cached result"));
        }
        displayTrendsResult(cached, mergedOptions);
        return;
      }
    }

    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();
    const analyzer = new TrendAnalyzer();

    // Parse time range from parent options
    const timeRange = parentOpts.timeRange
      ? parseTimeRange(parentOpts.timeRange)
      : null;
    const endDate = timeRange?.end || new Date();
    const startDate =
      timeRange?.start ||
      new Date(endDate.getTime() - (options.days || 30) * 24 * 60 * 60 * 1000);

    // Calculate days between dates for the query
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    const metrics = analytics.getEngagementOverTime(
      daysDiff,
      mergedOptions.platform,
    );

    // Apply period aggregation if specified
    const aggregatedMetrics = aggregateByPeriod(
      metrics,
      options.period || "daily",
    );

    const timeSeries = aggregatedMetrics.map((m: any) => ({
      timestamp: new Date(m.date),
      value: m[options.metric] || m.engagement || 0,
    }));

    // Apply smoothing if requested
    const processedSeries = options.smooth
      ? smoothTimeSeries(timeSeries)
      : timeSeries;

    // Analyze trends based on method (auto selects best method)
    let result: any;
    const method =
      options.method === "auto"
        ? selectBestMethod(processedSeries)
        : options.method;

    switch (method) {
      case "mann-kendall":
        const mannKendallValues = processedSeries.map((ts) => ts.value);
        result = analyzer.mannKendallTest(mannKendallValues);
        result.method = "mann-kendall";
        break;
      case "seasonal":
        result = analyzer.seasonalDecomposition(
          processedSeries,
          options.seasonalPeriod || 7,
        );
        result.method = "seasonal";
        break;
      case "regression":
      default:
        const trendValues = processedSeries.map((ts) => ts.value);
        const trendTimestamps = processedSeries.map((ts) => ts.timestamp);
        result = analyzer.analyzeTrend(trendValues, trendTimestamps);
        result.method = "regression";
        break;
    }

    // Apply significance threshold
    result.significant = result.pValue
      ? result.pValue < mergedOptions.threshold
      : result.confidence
        ? result.confidence > mergedOptions.confidence
        : true;

    // Detect breakpoints if requested
    if (options.breakpoints) {
      const breakpointValues = processedSeries.map((ts) => ts.value);
      const breakpoints = analyzer.detectBreakpoints(breakpointValues);
      result.breakpoints = breakpoints;
    }

    // Add comparison if requested
    if (options.compare && timeSeries.length > 14) {
      const midPoint = Math.floor(timeSeries.length / 2);
      const firstHalf = timeSeries.slice(0, midPoint);
      const secondHalf = timeSeries.slice(midPoint);

      result.comparison = {
        firstPeriod: calculatePeriodStats(firstHalf),
        secondPeriod: calculatePeriodStats(secondHalf),
        change: calculateChange(firstHalf, secondHalf),
      };
    }

    // Add metadata
    result.metadata = {
      metric: options.metric,
      period: options.period,
      dataPoints: processedSeries.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      platform: mergedOptions.platform || "all",
    };

    // Cache the result if caching is enabled
    if (cacheKey) {
      analyticsCache.set(cacheKey, result);
    }

    displayTrendsResult(result, mergedOptions);
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Aggregate metrics by period
 */
function aggregateByPeriod(metrics: any[], period: string): any[] {
  if (period === "daily" || !metrics.length) return metrics;

  const aggregated: Map<string, any> = new Map();

  metrics.forEach((m) => {
    const date = new Date(m.date);
    let key: string;

    switch (period) {
      case "hourly":
        key = `${date.toISOString().slice(0, 13)}:00`;
        break;
      case "weekly":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
        break;
      case "monthly":
        key = date.toISOString().slice(0, 7);
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }

    if (!aggregated.has(key)) {
      aggregated.set(key, {
        date: key,
        posts: 0,
        comments: 0,
        engagement: 0,
        users: 0,
        score: 0,
        count: 0,
      });
    }

    const agg = aggregated.get(key);
    agg.posts += m.posts || 0;
    agg.comments += m.comments || 0;
    agg.engagement += m.engagement || 0;
    agg.users += m.users || 0;
    agg.score += m.score || 0;
    agg.count += 1;
  });

  // Average the engagement metric
  return Array.from(aggregated.values()).map((agg) => ({
    ...agg,
    engagement: agg.engagement / agg.count,
  }));
}

/**
 * Apply smoothing to time series data
 */
function smoothTimeSeries(series: any[], windowSize: number = 3): any[] {
  if (series.length < windowSize) return series;

  return series.map((point, index) => {
    const start = Math.max(0, index - Math.floor(windowSize / 2));
    const end = Math.min(series.length, index + Math.floor(windowSize / 2) + 1);
    const window = series.slice(start, end);
    const avgValue =
      window.reduce((sum, p) => sum + p.value, 0) / window.length;

    return {
      ...point,
      value: avgValue,
      originalValue: point.value,
    };
  });
}

/**
 * Select best analysis method based on data characteristics
 */
function selectBestMethod(series: any[]): string {
  if (series.length < 10) return "regression";
  if (series.length > 30) return "mann-kendall";

  // Check for seasonality (simple autocorrelation check)
  const values = series.map((ts) => ts.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  if (variance / mean > 0.5) return "seasonal";
  return "regression";
}

/**
 * Calculate statistics for a period
 */
function calculatePeriodStats(series: any[]): any {
  const values = series.map((ts) => ts.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    mean: mean.toFixed(2),
    min: min.toFixed(2),
    max: max.toFixed(2),
    count: values.length,
  };
}

/**
 * Calculate change between two periods
 */
function calculateChange(firstHalf: any[], secondHalf: any[]): any {
  const firstMean =
    firstHalf.reduce((sum, ts) => sum + ts.value, 0) / firstHalf.length;
  const secondMean =
    secondHalf.reduce((sum, ts) => sum + ts.value, 0) / secondHalf.length;

  const change = secondMean - firstMean;
  const changePercent = (change / firstMean) * 100;

  return {
    absolute: change.toFixed(2),
    percent: changePercent.toFixed(1),
    direction: change > 0 ? "increasing" : change < 0 ? "decreasing" : "stable",
  };
}

/**
 * Display trends result in various formats
 */
function displayTrendsResult(result: any, options: any): void {
  const format = validateOutputFormat(
    options.outputFormat || options.format || "table",
  );

  switch (format) {
    case "json":
      console.log(JSON.stringify(result, null, 2));
      break;

    case "chart":
      displayTrendChart(result);
      break;

    case "detailed":
      displayDetailedTrend(result, options);
      break;

    case "csv":
      displayTrendCSV(result);
      break;

    case "markdown":
      displayTrendMarkdown(result);
      break;

    case "table":
    default:
      displayTrendTable(result, options);
      break;
  }
}

/**
 * Display trend as ASCII chart
 */
function displayTrendChart(result: any): void {
  console.log(chalk.cyan.bold("\n📈 Trend Analysis Chart\n"));

  // Generate sparkline if available
  if (result.metadata && result.metadata.dataPoints > 0) {
    const sparkline = generateSparkline(
      Array(20)
        .fill(0)
        .map((_, i) => Math.sin(i / 3) * 10 + Math.random() * 5 + 50),
    );
    console.log(chalk.white("Trend: ") + sparkline);
  }

  // Display trend direction with visual indicator
  const trendIcon =
    result.trend === "increasing"
      ? "↗"
      : result.trend === "decreasing"
        ? "↘"
        : result.trend === "stable"
          ? "→"
          : "?";

  console.log(
    chalk.white("\nDirection: ") +
      chalk.green.bold(`${trendIcon} ${result.trend || "Unknown"}`),
  );

  if (result.slope) {
    console.log(chalk.gray(`Slope: ${result.slope.toFixed(4)}`));
  }

  if (result.changePercent) {
    const changeColor =
      result.changePercent > 0
        ? chalk.green
        : result.changePercent < 0
          ? chalk.red
          : chalk.gray;
    console.log(
      chalk.white("Change: ") +
        changeColor(`${result.changePercent.toFixed(1)}%`),
    );
  }

  if (result.significant !== undefined) {
    const sigIcon = result.significant ? "✓" : "✗";
    const sigColor = result.significant ? chalk.green : chalk.yellow;
    console.log(chalk.white("Significant: ") + sigColor(sigIcon));
  }
}

/**
 * Display detailed trend analysis
 */
function displayDetailedTrend(result: any, options: any): void {
  console.log(chalk.cyan.bold("\n═══════════════════════════════════════"));
  console.log(chalk.cyan.bold("       📊 Detailed Trend Analysis      "));
  console.log(chalk.cyan.bold("═══════════════════════════════════════\n"));

  // Metadata section
  if (result.metadata) {
    console.log(chalk.white.bold("Analysis Parameters:"));
    console.log(chalk.gray(`  • Metric: ${result.metadata.metric}`));
    console.log(chalk.gray(`  • Period: ${result.metadata.period}`));
    console.log(chalk.gray(`  • Platform: ${result.metadata.platform}`));
    console.log(chalk.gray(`  • Data Points: ${result.metadata.dataPoints}`));
    console.log(
      chalk.gray(
        `  • Date Range: ${format(new Date(result.metadata.startDate), "yyyy-MM-dd")} to ${format(new Date(result.metadata.endDate), "yyyy-MM-dd")}`,
      ),
    );
    console.log();
  }

  // Main results
  console.log(chalk.white.bold("Trend Results:"));
  const table = new Table({
    head: ["Metric", "Value", "Status"],
    style: { head: ["cyan"] },
    colWidths: [20, 20, 20],
  });

  // Add rows based on method
  if (result.method === "mann-kendall") {
    table.push(
      ["Trend", result.trend || "N/A", getTrendStatus(result.trend)],
      ["Test Statistic", result.statistic?.toFixed(3) || "N/A", ""],
      [
        "P-Value",
        result.pValue?.toFixed(4) || "N/A",
        getPValueStatus(result.pValue),
      ],
      [
        "Significance",
        result.significant ? "Yes" : "No",
        result.significant ? chalk.green("✓") : chalk.yellow("○"),
      ],
    );
  } else {
    table.push(
      ["Trend", result.trend || "N/A", getTrendStatus(result.trend)],
      ["Direction", result.direction || "N/A", ""],
      [
        "Slope",
        result.slope?.toFixed(4) || "N/A",
        getSlopeStatus(result.slope),
      ],
      [
        "R²",
        result.rSquared?.toFixed(3) || "N/A",
        getRSquaredStatus(result.rSquared),
      ],
      [
        "Change %",
        result.changePercent?.toFixed(1) || "N/A",
        getChangeStatus(result.changePercent),
      ],
    );
  }

  console.log(table.toString());

  // Comparison section if available
  if (result.comparison) {
    console.log(chalk.white.bold("\nPeriod Comparison:"));
    const compTable = new Table({
      head: ["Period", "Mean", "Min", "Max"],
      style: { head: ["cyan"] },
    });

    compTable.push(
      [
        "First Half",
        result.comparison.firstPeriod.mean,
        result.comparison.firstPeriod.min,
        result.comparison.firstPeriod.max,
      ],
      [
        "Second Half",
        result.comparison.secondPeriod.mean,
        result.comparison.secondPeriod.min,
        result.comparison.secondPeriod.max,
      ],
    );

    console.log(compTable.toString());
    console.log(
      chalk.gray(
        `Change: ${result.comparison.change.absolute} (${result.comparison.change.percent}%)`,
      ),
    );
  }

  // Breakpoints if detected
  if (result.breakpoints && result.breakpoints.length > 0) {
    console.log(chalk.white.bold("\n⚡ Breakpoints Detected:"));
    result.breakpoints.forEach((bp: number, i: number) => {
      console.log(chalk.yellow(`  ${i + 1}. Point ${bp}`));
    });
  }
}

/**
 * Display trend as CSV
 */
function displayTrendCSV(result: any): void {
  console.log("Metric,Value");
  console.log(`Trend,${result.trend || "N/A"}`);
  console.log(`Method,${result.method || "N/A"}`);
  if (result.slope !== undefined)
    console.log(`Slope,${result.slope.toFixed(4)}`);
  if (result.pValue !== undefined)
    console.log(`P-Value,${result.pValue.toFixed(4)}`);
  if (result.rSquared !== undefined)
    console.log(`R-Squared,${result.rSquared.toFixed(3)}`);
  console.log(`Significant,${result.significant ? "Yes" : "No"}`);
}

/**
 * Display trend as Markdown
 */
function displayTrendMarkdown(result: any): void {
  console.log("# Trend Analysis Results\n");
  console.log(`**Method:** ${result.method || "N/A"}\n`);
  console.log("| Metric | Value |");
  console.log("|--------|-------|");
  console.log(`| Trend | ${result.trend || "N/A"} |`);
  if (result.slope !== undefined)
    console.log(`| Slope | ${result.slope.toFixed(4)} |`);
  if (result.pValue !== undefined)
    console.log(`| P-Value | ${result.pValue.toFixed(4)} |`);
  if (result.rSquared !== undefined)
    console.log(`| R² | ${result.rSquared.toFixed(3)} |`);
  console.log(`| Significant | ${result.significant ? "Yes" : "No"} |`);
}

/**
 * Display trend as table (default)
 */
function displayTrendTable(result: any, options: any): void {
  const table = new Table({
    head: ["Metric", "Value"],
    style: { head: ["cyan"] },
  });

  table.push(
    ["Method", result.method || "N/A"],
    ["Trend", result.trend || "No clear trend"],
  );

  if (result.direction) table.push(["Direction", result.direction]);
  if (result.slope !== undefined)
    table.push(["Slope", result.slope.toFixed(4)]);
  if (result.statistic !== undefined)
    table.push(["Test Statistic", result.statistic.toFixed(3)]);
  if (result.pValue !== undefined)
    table.push(["P-Value", result.pValue.toFixed(4)]);
  if (result.rSquared !== undefined)
    table.push(["R²", result.rSquared.toFixed(3)]);
  if (result.changePercent !== undefined)
    table.push(["Change %", result.changePercent.toFixed(1)]);
  if (result.significant !== undefined)
    table.push(["Significant", result.significant ? "Yes" : "No"]);

  if (result.breakpoints && result.breakpoints.length > 0) {
    table.push(["Breakpoints", result.breakpoints.join(", ")]);
  }

  console.log(chalk.cyan("📈 Trend Analysis"));
  console.log(table.toString());

  // Add summary message
  if (result.significant) {
    const trendMessage =
      result.trend === "increasing"
        ? chalk.green("↗ Significant upward trend detected")
        : result.trend === "decreasing"
          ? chalk.red("↘ Significant downward trend detected")
          : chalk.yellow("→ No significant trend detected");
    console.log("\n" + trendMessage);
  }
}

// Helper functions for status indicators
function getTrendStatus(trend: string): string {
  switch (trend) {
    case "increasing":
      return chalk.green("↗");
    case "decreasing":
      return chalk.red("↘");
    case "stable":
      return chalk.yellow("→");
    default:
      return chalk.gray("?");
  }
}

function getPValueStatus(pValue: number): string {
  if (pValue < 0.01) return chalk.green("***");
  if (pValue < 0.05) return chalk.green("**");
  if (pValue < 0.1) return chalk.yellow("*");
  return chalk.gray("ns");
}

function getSlopeStatus(slope: number): string {
  if (Math.abs(slope) < 0.001) return chalk.gray("~0");
  return slope > 0 ? chalk.green("+") : chalk.red("-");
}

function getRSquaredStatus(r2: number): string {
  if (r2 > 0.9) return chalk.green("Excellent");
  if (r2 > 0.7) return chalk.green("Good");
  if (r2 > 0.5) return chalk.yellow("Moderate");
  return chalk.red("Weak");
}

function getChangeStatus(change: number): string {
  if (Math.abs(change) < 1) return chalk.gray("Stable");
  return change > 0 ? chalk.green(`+${change}%`) : chalk.red(`${change}%`);
}

/**
 * Handle anomalies subcommand
 */
async function handleAnomalies(parentOpts: any, options: any): Promise<void> {
  try {
    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();
    const detector = new AnomalyDetector({
      methods: options.method === "ensemble" ? undefined : [options.method],
      sensitivity: options.threshold ? options.threshold / 5 : 0.5,
    });

    // Get metrics data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days || 30));

    const metrics = analytics.getEngagementOverTime(
      options.days || 30,
      options.platform,
    );

    // Detect anomalies
    const metricsToCheck = options.metrics || [
      "engagement",
      "posts",
      "comments",
    ];
    const anomalies: any[] = [];

    for (const metricName of metricsToCheck) {
      const values = metrics.map((m: any) => m[metricName] || 0);
      const timestamps = metrics.map((m: any) => new Date(m.date));

      const result = detector.detect(values, timestamps);

      result.anomalies.forEach((anomaly) => {
        anomalies.push({
          metric: metricName,
          ...anomaly,
          date: metrics[anomaly.index]?.date,
          context: options.includeContext
            ? {
                before: anomaly.index > 0 ? values[anomaly.index - 1] : null,
                after:
                  anomaly.index < values.length - 1
                    ? values[anomaly.index + 1]
                    : null,
              }
            : undefined,
        });
      });
    }

    if (options.format === "json") {
      console.log(JSON.stringify(anomalies, null, 2));
    } else {
      // Table format
      if (anomalies.length === 0) {
        console.log(chalk.green("✓ No anomalies detected"));
      } else {
        const table = new Table({
          head: ["Date", "Metric", "Value", "Expected", "Score", "Type"],
          style: { head: ["cyan"] },
        });

        anomalies.forEach((anomaly) => {
          table.push([
            format(new Date(anomaly.date), "yyyy-MM-dd"),
            anomaly.metric,
            anomaly.value.toFixed(2),
            anomaly.expectedRange
              ? `${anomaly.expectedRange[0].toFixed(2)}-${anomaly.expectedRange[1].toFixed(2)}`
              : "N/A",
            anomaly.score.toFixed(2),
            anomaly.type,
          ]);
        });

        console.log(chalk.yellow(`⚠️  ${anomalies.length} anomalies detected`));
        console.log(table.toString());

        if (options.includeContext) {
          console.log(
            chalk.gray("\nContext information included in JSON output"),
          );
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle forecast subcommand
 */
async function handleForecast(parentOpts: any, options: any): Promise<void> {
  try {
    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();
    const forecaster = new ForecastingEngine({
      model: options.model === "auto" ? undefined : options.model,
      horizon: options.horizon || 7,
      confidence: options.confidence || 0.95,
    });

    // Get historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days || 60));

    const metrics = analytics.getEngagementOverTime(
      options.days || 30,
      options.platform,
    );

    const values = metrics.map(
      (m: any) => m[options.metric] || m.engagement || 0,
    );
    const timestamps = metrics.map((m: any) => new Date(m.date));

    // Generate forecast
    const result = forecaster.forecast(values, timestamps);

    // Perform cross-validation if requested
    let validationResults;
    if (options.validate) {
      validationResults = forecaster.crossValidate(values);
    }

    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            forecast: result,
            validation: validationResults,
          },
          null,
          2,
        ),
      );
    } else if (options.format === "chart") {
      // ASCII chart showing historical and forecast
      console.log(chalk.cyan("📊 Forecast Visualization"));

      // Show last 10 historical points
      const historicalPoints = values.slice(-10);
      const maxValue = Math.max(
        ...historicalPoints,
        ...result.forecast.map((f) => f.upper),
      );
      const scale = 20 / maxValue;

      console.log(chalk.gray("Historical:"));
      historicalPoints.forEach((value, i) => {
        const barLength = Math.round(value * scale);
        const bar = "█".repeat(barLength);
        const date = format(timestamps[timestamps.length - 10 + i], "MM/dd");
        console.log(`${date} ${bar} ${value.toFixed(1)}`);
      });

      console.log(chalk.cyan("\nForecast:"));
      result.forecast.forEach((point) => {
        const barLength = Math.round(point.value * scale);
        const bar = "█".repeat(barLength);
        const errorBar = "░".repeat(
          Math.round((point.upper - point.value) * scale),
        );
        const date = point.timestamp
          ? format(point.timestamp, "MM/dd")
          : `Day +${point.index}`;
        console.log(
          `${date} ${bar}${errorBar} ${point.value.toFixed(1)} [${point.lower.toFixed(1)}-${point.upper.toFixed(1)}]`,
        );
      });
    } else {
      // Table format
      const table = new Table({
        head: ["Date", "Forecast", "Lower Bound", "Upper Bound"],
        style: { head: ["cyan"] },
      });

      result.forecast.forEach((point) => {
        const date = point.timestamp
          ? format(point.timestamp, "yyyy-MM-dd")
          : `Day +${point.index}`;
        table.push([
          date,
          point.value.toFixed(2),
          point.lower.toFixed(2),
          point.upper.toFixed(2),
        ]);
      });

      console.log(chalk.cyan("📈 Forecast Results"));
      console.log(chalk.gray(`Model: ${result.model}`));
      console.log(
        chalk.gray(`Confidence: ${(options.confidence * 100).toFixed(0)}%`),
      );
      console.log(table.toString());

      if (result.accuracy) {
        console.log(chalk.gray(`\nModel Accuracy:`));
        console.log(chalk.gray(`  MAE: ${result.accuracy.mae.toFixed(3)}`));
        console.log(chalk.gray(`  RMSE: ${result.accuracy.rmse.toFixed(3)}`));
        console.log(chalk.gray(`  MAPE: ${result.accuracy.mape.toFixed(1)}%`));
      }

      if (validationResults && validationResults.length > 0) {
        console.log(chalk.gray(`\nCross-Validation Results:`));
        validationResults.forEach((vr: any) => {
          console.log(chalk.gray(`  ${vr.model}:`));
          console.log(chalk.gray(`    MAE: ${vr.avgAccuracy.mae.toFixed(3)}`));
          console.log(
            chalk.gray(`    RMSE: ${vr.avgAccuracy.rmse.toFixed(3)}`),
          );
        });
      }
    }
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle compare subcommand
 */
async function handleCompare(parentOpts: any, options: any): Promise<void> {
  try {
    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();

    // Parse time periods for comparison
    const { basePeriod, comparePeriod } = parseComparisonPeriods(
      options.basePeriod,
      options.comparePeriod,
    );

    // Get cache if enabled
    const useCache = parentOpts.cache !== false;
    const cacheKey = useCache
      ? `compare_${options.comparisonType}_${JSON.stringify(basePeriod)}_${JSON.stringify(comparePeriod)}_${options.metrics.join(",")}`
      : null;

    if (cacheKey) {
      const cachedResult = analyticsCache.get(cacheKey);
      if (cachedResult) {
        displayComparisonResults(cachedResult, options);
        return;
      }
    }

    let results: any;

    switch (options.comparisonType) {
      case "period-to-period":
        results = await comparePeriods(
          analytics,
          basePeriod,
          comparePeriod,
          options,
        );
        break;

      case "platform-to-platform":
        results = await comparePlatforms(
          analytics,
          options.platforms || [],
          basePeriod,
          options,
        );
        break;

      case "metric-to-metric":
        results = await compareMetrics(
          analytics,
          options.metrics,
          basePeriod,
          options,
        );
        break;

      default:
        throw new Error(`Unknown comparison type: ${options.comparisonType}`);
    }

    // Cache results
    if (cacheKey) {
      analyticsCache.set(cacheKey, results);
    }

    // Display results
    displayComparisonResults(results, options);
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Parse comparison periods from string inputs
 */
function parseComparisonPeriods(
  basePeriodStr: string,
  comparePeriodStr: string,
): {
  basePeriod: { start: Date; end: Date };
  comparePeriod: { start: Date; end: Date };
} {
  // Parse base period
  const basePeriod = parseTimeRange(basePeriodStr);

  // Parse compare period
  let comparePeriod: { start: Date; end: Date };

  if (comparePeriodStr === "previous") {
    // Calculate previous period of same length
    const duration = basePeriod.end.getTime() - basePeriod.start.getTime();
    comparePeriod = {
      start: new Date(basePeriod.start.getTime() - duration),
      end: new Date(basePeriod.start.getTime() - 1),
    };
  } else {
    comparePeriod = parseTimeRange(comparePeriodStr);
  }

  return { basePeriod, comparePeriod };
}

/**
 * Compare metrics across two time periods
 */
async function comparePeriods(
  analytics: any,
  basePeriod: { start: Date; end: Date },
  comparePeriod: { start: Date; end: Date },
  options: any,
): Promise<any> {
  const results: any = {
    type: "period-to-period",
    basePeriod: {
      start: basePeriod.start,
      end: basePeriod.end,
      label: `${format(basePeriod.start, "MMM dd")} - ${format(basePeriod.end, "MMM dd, yyyy")}`,
    },
    comparePeriod: {
      start: comparePeriod.start,
      end: comparePeriod.end,
      label: `${format(comparePeriod.start, "MMM dd")} - ${format(comparePeriod.end, "MMM dd, yyyy")}`,
    },
    metrics: {},
    summary: {},
  };

  // Collect data for each metric
  for (const metric of options.metrics) {
    const baseData = await getMetricData(
      analytics,
      metric,
      basePeriod,
      options.platform,
    );
    const compareData = await getMetricData(
      analytics,
      metric,
      comparePeriod,
      options.platform,
    );

    const comparison = calculateComparison(baseData, compareData);
    results.metrics[metric] = comparison;
  }

  // Calculate overall summary
  results.summary = calculateSummaryStats(results.metrics);

  return results;
}

/**
 * Compare metrics across platforms
 */
async function comparePlatforms(
  analytics: any,
  platforms: string[],
  period: { start: Date; end: Date },
  options: any,
): Promise<any> {
  if (platforms.length < 2) {
    throw new Error("At least 2 platforms required for platform comparison");
  }

  const results: any = {
    type: "platform-to-platform",
    period: {
      start: period.start,
      end: period.end,
      label: `${format(period.start, "MMM dd")} - ${format(period.end, "MMM dd, yyyy")}`,
    },
    platforms: {},
    metrics: options.metrics,
    summary: {},
  };

  // Collect data for each platform
  for (const platform of platforms) {
    results.platforms[platform] = {};

    for (const metric of options.metrics) {
      const data = await getMetricData(analytics, metric, period, platform);
      results.platforms[platform][metric] = calculateMetricStats(data);
    }
  }

  // Calculate comparisons between platforms
  results.comparisons = calculatePlatformComparisons(
    results.platforms,
    options.metrics,
  );

  return results;
}

/**
 * Compare different metrics within same period
 */
async function compareMetrics(
  analytics: any,
  metrics: string[],
  period: { start: Date; end: Date },
  options: any,
): Promise<any> {
  const results: any = {
    type: "metric-to-metric",
    period: {
      start: period.start,
      end: period.end,
      label: `${format(period.start, "MMM dd")} - ${format(period.end, "MMM dd, yyyy")}`,
    },
    metrics: {},
    correlations: {},
  };

  // Collect data for each metric
  const metricData: Map<string, number[]> = new Map();

  for (const metric of metrics) {
    const data = await getMetricData(
      analytics,
      metric,
      period,
      options.platform,
    );
    metricData.set(metric, data.values);
    results.metrics[metric] = calculateMetricStats(data);
  }

  // Calculate correlations between metrics
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const metric1 = metrics[i];
      const metric2 = metrics[j];
      const data1 = metricData.get(metric1)!;
      const data2 = metricData.get(metric2)!;

      const correlation = calculateCorrelation(data1, data2);
      results.correlations[`${metric1}_vs_${metric2}`] = correlation;
    }
  }

  return results;
}

/**
 * Get metric data for a period
 */
async function getMetricData(
  analytics: any,
  metric: string,
  period: { start: Date; end: Date },
  platform?: string,
): Promise<any> {
  const options: any = {
    startDate: period.start,
    endDate: period.end,
  };

  if (platform) {
    options.platform = platform;
  }

  let values: number[] = [];
  let timestamps: Date[] = [];

  switch (metric) {
    case "posts":
      const postStats = await analytics.getPostStats(options);
      values = postStats.dailyCounts || [];
      timestamps = postStats.dates || [];
      break;

    case "comments":
      const commentStats = await analytics.getCommentStats(options);
      values = commentStats.dailyCounts || [];
      timestamps = commentStats.dates || [];
      break;

    case "engagement":
      const engagementStats = await analytics.getEngagementStats(options);
      values = engagementStats.dailyRates || [];
      timestamps = engagementStats.dates || [];
      break;

    case "users":
      const userStats = await analytics.getUserStats(options);
      values = userStats.dailyActive || [];
      timestamps = userStats.dates || [];
      break;

    case "score":
      const scoreStats = await analytics.getScoreStats(options);
      values = scoreStats.dailyAverages || [];
      timestamps = scoreStats.dates || [];
      break;

    default:
      throw new Error(`Unknown metric: ${metric}`);
  }

  return {
    metric,
    values,
    timestamps,
    period,
    platform,
  };
}

/**
 * Calculate comparison statistics between two datasets
 */
function calculateComparison(baseData: any, compareData: any): any {
  const baseStats = calculateMetricStats(baseData);
  const compareStats = calculateMetricStats(compareData);

  const absoluteDiff = compareStats.mean - baseStats.mean;
  const percentChange =
    baseStats.mean !== 0 ? (absoluteDiff / baseStats.mean) * 100 : 0;

  // Perform statistical test for significance
  const tTest = performTTest(baseData.values, compareData.values);

  return {
    base: baseStats,
    compare: compareStats,
    difference: {
      absolute: absoluteDiff,
      percent: percentChange,
    },
    significant: tTest.pValue < 0.05,
    pValue: tTest.pValue,
    trend:
      absoluteDiff > 0
        ? "increase"
        : absoluteDiff < 0
          ? "decrease"
          : "no change",
  };
}

/**
 * Calculate metric statistics
 */
function calculateMetricStats(data: any): any {
  const values = data.values || [];

  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      total: 0,
      count: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a: number, b: number) => a + b, 0);
  const mean = sum / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  const variance =
    values.reduce(
      (acc: number, val: number) => acc + Math.pow(val - mean, 2),
      0,
    ) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    min: Math.min(...values),
    max: Math.max(...values),
    stdDev,
    total: sum,
    count: values.length,
  };
}

/**
 * Perform t-test for statistical significance
 */
function performTTest(
  data1: number[],
  data2: number[],
): { pValue: number; tStatistic: number } {
  if (data1.length === 0 || data2.length === 0) {
    return { pValue: 1, tStatistic: 0 };
  }

  const n1 = data1.length;
  const n2 = data2.length;
  const mean1 = data1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = data2.reduce((a, b) => a + b, 0) / n2;

  const var1 =
    data1.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0) / (n1 - 1);
  const var2 =
    data2.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0) / (n2 - 1);

  const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
  const tStatistic = pooledSE !== 0 ? (mean1 - mean2) / pooledSE : 0;

  // Approximate p-value using normal distribution
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

  return { pValue, tStatistic };
}

/**
 * Normal CDF approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y =
    1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate correlations between data arrays
 */
function calculateCorrelation(data1: number[], data2: number[]): number {
  if (data1.length !== data2.length || data1.length === 0) {
    return 0;
  }

  const n = data1.length;
  const mean1 = data1.reduce((a, b) => a + b, 0) / n;
  const mean2 = data2.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = data1[i] - mean1;
    const diff2 = data2[i] - mean2;
    numerator += diff1 * diff2;
    denominator1 += diff1 * diff1;
    denominator2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(denominator1 * denominator2);
  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Calculate platform comparisons
 */
function calculatePlatformComparisons(platforms: any, metrics: string[]): any {
  const comparisons: any = {};
  const platformNames = Object.keys(platforms);

  for (let i = 0; i < platformNames.length; i++) {
    for (let j = i + 1; j < platformNames.length; j++) {
      const platform1 = platformNames[i];
      const platform2 = platformNames[j];
      const key = `${platform1}_vs_${platform2}`;

      comparisons[key] = {};

      for (const metric of metrics) {
        const data1 = platforms[platform1][metric];
        const data2 = platforms[platform2][metric];

        const diff = data2.mean - data1.mean;
        const percentDiff = data1.mean !== 0 ? (diff / data1.mean) * 100 : 0;

        comparisons[key][metric] = {
          platform1: { name: platform1, value: data1.mean },
          platform2: { name: platform2, value: data2.mean },
          difference: diff,
          percentDifference: percentDiff,
          winner: diff > 0 ? platform2 : diff < 0 ? platform1 : "tie",
        };
      }
    }
  }

  return comparisons;
}

/**
 * Calculate summary statistics for all metrics
 */
function calculateSummaryStats(metrics: any): any {
  const summary: any = {
    overallTrend: "mixed",
    significantChanges: 0,
    largestIncrease: { metric: "", percent: 0 },
    largestDecrease: { metric: "", percent: 0 },
  };

  let increases = 0;
  let decreases = 0;

  for (const [metric, comparison] of Object.entries(metrics)) {
    const comp = comparison as any;

    if (comp.significant) {
      summary.significantChanges++;
    }

    if (comp.difference.percent > 0) {
      increases++;
      if (comp.difference.percent > summary.largestIncrease.percent) {
        summary.largestIncrease = {
          metric,
          percent: comp.difference.percent,
        };
      }
    } else if (comp.difference.percent < 0) {
      decreases++;
      if (
        Math.abs(comp.difference.percent) >
        Math.abs(summary.largestDecrease.percent)
      ) {
        summary.largestDecrease = {
          metric,
          percent: comp.difference.percent,
        };
      }
    }
  }

  if (increases > decreases) {
    summary.overallTrend = "increase";
  } else if (decreases > increases) {
    summary.overallTrend = "decrease";
  }

  return summary;
}

/**
 * Display comparison results
 */
function displayComparisonResults(results: any, options: any): void {
  switch (options.format) {
    case "json":
      console.log(JSON.stringify(results, null, 2));
      break;

    case "csv":
      displayComparisonCSV(results, options);
      break;

    case "markdown":
      displayComparisonMarkdown(results, options);
      break;

    case "chart":
      displayComparisonChart(results, options);
      break;

    case "table":
    default:
      displayComparisonTable(results, options);
      break;
  }
}

/**
 * Display comparison as table
 */
function displayComparisonTable(results: any, _options: any): void {
  console.log(chalk.cyan.bold("\n📊 Comparison Results"));
  console.log(chalk.gray("─".repeat(60)));

  if (results.type === "period-to-period") {
    console.log(chalk.white("Comparing periods:"));
    console.log(chalk.gray(`  Base: ${results.basePeriod.label}`));
    console.log(chalk.gray(`  Compare: ${results.comparePeriod.label}`));
    console.log();

    const table = new Table({
      head: ["Metric", "Base", "Compare", "Change", "% Change", "Significant"],
      style: { head: ["cyan"] },
      colWidths: [15, 12, 12, 12, 12, 12],
    });

    for (const [metric, comparison] of Object.entries(results.metrics)) {
      const comp = comparison as any;
      const changeColor =
        comp.difference.absolute > 0 ? chalk.green : chalk.red;
      const sigIcon = comp.significant ? chalk.green("✓") : chalk.gray("−");

      table.push([
        metric,
        comp.base.mean.toFixed(2),
        comp.compare.mean.toFixed(2),
        changeColor(
          `${comp.difference.absolute > 0 ? "+" : ""}${comp.difference.absolute.toFixed(2)}`,
        ),
        changeColor(
          `${comp.difference.percent > 0 ? "+" : ""}${comp.difference.percent.toFixed(1)}%`,
        ),
        sigIcon,
      ]);
    }

    console.log(table.toString());

    // Summary
    if (results.summary) {
      console.log(chalk.white.bold("\nSummary:"));
      console.log(
        chalk.gray(
          `  Overall trend: ${getTrendIcon(results.summary.overallTrend)}`,
        ),
      );
      console.log(
        chalk.gray(
          `  Significant changes: ${results.summary.significantChanges}`,
        ),
      );

      if (results.summary.largestIncrease.metric) {
        console.log(
          chalk.green(
            `  Largest increase: ${results.summary.largestIncrease.metric} (+${results.summary.largestIncrease.percent.toFixed(1)}%)`,
          ),
        );
      }

      if (results.summary.largestDecrease.metric) {
        console.log(
          chalk.red(
            `  Largest decrease: ${results.summary.largestDecrease.metric} (${results.summary.largestDecrease.percent.toFixed(1)}%)`,
          ),
        );
      }
    }
  } else if (results.type === "platform-to-platform") {
    console.log(chalk.white("Comparing platforms:"));
    console.log(chalk.gray(`  Period: ${results.period.label}`));
    console.log(
      chalk.gray(`  Platforms: ${Object.keys(results.platforms).join(", ")}`),
    );
    console.log();

    for (const metric of results.metrics) {
      console.log(chalk.white.bold(`\n${metric}:`));

      const table = new Table({
        head: ["Platform", "Mean", "Min", "Max", "Std Dev"],
        style: { head: ["cyan"] },
      });

      for (const [platform, data] of Object.entries(results.platforms)) {
        const stats = (data as any)[metric];
        table.push([
          platform,
          stats.mean.toFixed(2),
          stats.min.toFixed(2),
          stats.max.toFixed(2),
          stats.stdDev.toFixed(2),
        ]);
      }

      console.log(table.toString());
    }

    // Show comparisons
    if (results.comparisons) {
      console.log(chalk.white.bold("\nDirect Comparisons:"));

      for (const [comparison, metrics] of Object.entries(results.comparisons)) {
        console.log(chalk.gray(`\n  ${comparison.replace("_", " ")}:`));

        for (const [metric, data] of Object.entries(metrics as any)) {
          const comp = data as any;
          const winner =
            comp.winner !== "tie" ? `(${comp.winner} leads)` : "(tie)";
          const diff = comp.percentDifference > 0 ? "+" : "";
          console.log(
            chalk.gray(
              `    ${metric}: ${diff}${comp.percentDifference.toFixed(1)}% ${winner}`,
            ),
          );
        }
      }
    }
  } else if (results.type === "metric-to-metric") {
    console.log(chalk.white("Comparing metrics:"));
    console.log(chalk.gray(`  Period: ${results.period.label}`));
    console.log();

    const table = new Table({
      head: ["Metric", "Mean", "Median", "Min", "Max", "Std Dev"],
      style: { head: ["cyan"] },
    });

    for (const [metric, stats] of Object.entries(results.metrics)) {
      const s = stats as any;
      table.push([
        metric,
        s.mean.toFixed(2),
        s.median.toFixed(2),
        s.min.toFixed(2),
        s.max.toFixed(2),
        s.stdDev.toFixed(2),
      ]);
    }

    console.log(table.toString());

    // Show correlations
    if (results.correlations && Object.keys(results.correlations).length > 0) {
      console.log(chalk.white.bold("\nCorrelations:"));

      const corrTable = new Table({
        head: ["Metrics", "Correlation", "Strength"],
        style: { head: ["cyan"] },
      });

      for (const [pair, correlation] of Object.entries(results.correlations)) {
        const corr = correlation as number;
        const strength = getCorrelationStrength(corr);

        corrTable.push([
          pair.replace("_vs_", " ↔ "),
          corr.toFixed(3),
          strength,
        ]);
      }

      console.log(corrTable.toString());
    }
  }
}

/**
 * Display comparison as CSV
 */
function displayComparisonCSV(results: any, _options: any): void {
  if (results.type === "period-to-period") {
    console.log(
      "Metric,Base Mean,Compare Mean,Absolute Change,Percent Change,Significant",
    );

    for (const [metric, comparison] of Object.entries(results.metrics)) {
      const comp = comparison as any;
      console.log(
        `${metric},${comp.base.mean.toFixed(2)},${comp.compare.mean.toFixed(2)},${comp.difference.absolute.toFixed(2)},${comp.difference.percent.toFixed(1)},${comp.significant}`,
      );
    }
  }
}

/**
 * Display comparison as Markdown
 */
function displayComparisonMarkdown(results: any, _options: any): void {
  console.log("# Comparison Results\n");

  if (results.type === "period-to-period") {
    console.log("## Period Comparison\n");
    console.log(`- **Base Period**: ${results.basePeriod.label}`);
    console.log(`- **Compare Period**: ${results.comparePeriod.label}\n`);

    console.log(
      "| Metric | Base | Compare | Change | % Change | Significant |",
    );
    console.log(
      "|--------|------|---------|---------|----------|-------------|",
    );

    for (const [metric, comparison] of Object.entries(results.metrics)) {
      const comp = comparison as any;
      const sig = comp.significant ? "✓" : "−";
      console.log(
        `| ${metric} | ${comp.base.mean.toFixed(2)} | ${comp.compare.mean.toFixed(2)} | ${comp.difference.absolute.toFixed(2)} | ${comp.difference.percent.toFixed(1)}% | ${sig} |`,
      );
    }
  }
}

/**
 * Display comparison as chart
 */
function displayComparisonChart(results: any, _options: any): void {
  if (results.type === "period-to-period") {
    console.log(chalk.cyan.bold("\n📊 Period Comparison Chart\n"));

    const maxValue = Math.max(
      ...Object.values(results.metrics).flatMap((m: any) => [
        m.base.mean,
        m.compare.mean,
      ]),
    );
    const scale = 40 / maxValue;

    for (const [metric, comparison] of Object.entries(results.metrics)) {
      const comp = comparison as any;
      const baseBar = "█".repeat(Math.round(comp.base.mean * scale));
      const compareBar = "█".repeat(Math.round(comp.compare.mean * scale));

      console.log(chalk.white.bold(`${metric}:`));
      console.log(
        chalk.blue(`  Base:    ${baseBar} ${comp.base.mean.toFixed(2)}`),
      );
      console.log(
        chalk.green(`  Compare: ${compareBar} ${comp.compare.mean.toFixed(2)}`),
      );

      const change =
        comp.difference.percent > 0
          ? "↑"
          : comp.difference.percent < 0
            ? "↓"
            : "→";
      const changeColor =
        comp.difference.percent > 0
          ? chalk.green
          : comp.difference.percent < 0
            ? chalk.red
            : chalk.gray;
      console.log(
        changeColor(
          `  Change:  ${change} ${comp.difference.percent.toFixed(1)}%\n`,
        ),
      );
    }
  }
}

/**
 * Get trend icon
 */
function getTrendIcon(trend: string): string {
  switch (trend) {
    case "increase":
      return chalk.green("↑ Increasing");
    case "decrease":
      return chalk.red("↓ Decreasing");
    case "mixed":
      return chalk.yellow("↔ Mixed");
    default:
      return chalk.gray("− No change");
  }
}

/**
 * Get correlation strength description
 */
function getCorrelationStrength(correlation: number): string {
  const abs = Math.abs(correlation);
  if (abs >= 0.9) return chalk.green("Very Strong");
  if (abs >= 0.7) return chalk.green("Strong");
  if (abs >= 0.5) return chalk.yellow("Moderate");
  if (abs >= 0.3) return chalk.yellow("Weak");
  return chalk.gray("Very Weak");
}

/**
 * Handle report subcommand
 */
async function handleReport(parentOpts: any, options: any): Promise<void> {
  try {
    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();
    const generator = new ReportGenerator(analytics);

    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days || 30));

    // Generate report based on template
    const report = generator.generateCustomReport(
      `Analytics Report - ${options.template || "detailed"}`,
      {
        platforms: options.platform ? [options.platform] : undefined,
        dateRange: { start: startDate, end: endDate },
        metrics: options.sections,
      },
      (options.format as any) || "html",
    );

    // Output report
    if (options.output) {
      const fs = await import("fs/promises");
      await fs.writeFile(options.output, report);
      console.log(chalk.green(`✓ Report saved to ${options.output}`));
      console.log(chalk.gray(`Format: ${options.format || "html"}`));
      console.log(chalk.gray(`Size: ${(report.length / 1024).toFixed(1)} KB`));
    } else {
      // Output to console (only for markdown/json)
      if (options.format === "json" || options.format === "markdown") {
        console.log(report);
      } else {
        console.log(
          chalk.yellow("Please specify --output for HTML/PDF reports"),
        );
      }
    }

    // Show summary
    console.log(chalk.cyan("\n📊 Report Generated"));
    console.log(
      chalk.gray(`  Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`),
    );
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle dashboard subcommand
 */
async function handleDashboard(parentOpts: any, options: any): Promise<void> {
  try {
    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();
    const dashboard = new AnalyticsDashboard(analytics, {
      refreshInterval: options.refresh ? options.refresh * 1000 : undefined,
    });

    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days || 30));

    // Generate and display dashboard
    const dashboardData = await dashboard.getMetrics({
      dateRange: { start: startDate, end: endDate },
      platforms: options.platform ? [options.platform] : undefined,
    });

    // Clear console for dashboard
    console.clear();

    // Display header
    console.log(
      chalk.cyan.bold("═══════════════════════════════════════════════"),
    );
    console.log(
      chalk.cyan.bold("           📊 Analytics Dashboard              "),
    );
    console.log(
      chalk.cyan.bold("═══════════════════════════════════════════════"),
    );
    console.log();

    // Display summary metrics
    const summaryTable = new Table({
      head: ["Metric", "Value", "Change"],
      style: { head: ["cyan"] },
    });

    if (dashboardData.overview) {
      summaryTable.push(
        ["Total Posts", dashboardData.overview.totalPosts, "-"],
        ["Total Comments", dashboardData.overview.totalComments, "-"],
        [
          "Avg Engagement",
          `${dashboardData.overview.avgEngagement.toFixed(2)}%`,
          "-",
        ],
        ["Active Users", dashboardData.overview.totalUsers, "-"],
      );
    }

    console.log(chalk.white.bold("Summary"));
    console.log(summaryTable.toString());
    console.log();

    // Display top content
    if (dashboardData.trending && dashboardData.trending.length > 0) {
      const contentTable = new Table({
        head: ["Title", "Score", "Comments"],
        style: { head: ["cyan"] },
        colWidths: [50, 12, 10],
      });

      dashboardData.trending.slice(0, 5).forEach((post: any) => {
        contentTable.push([
          post.title.substring(0, 47) + (post.title.length > 47 ? "..." : ""),
          post.score,
          post.comment_count,
        ]);
      });

      console.log(chalk.white.bold("Top Content"));
      console.log(contentTable.toString());
      console.log();
    }

    // Display trend sparkline
    if (dashboardData.timeSeries && dashboardData.timeSeries.length > 0) {
      console.log(chalk.white.bold("Engagement Trend (Last 7 Days)"));
      const trendValues = dashboardData.timeSeries
        .slice(-7)
        .map((t: any) => t.engagement || 0);
      const sparkline = generateSparkline(trendValues);
      console.log(sparkline);
      console.log();
    }

    // Display footer with refresh info
    if (options.refresh) {
      console.log(
        chalk.gray(
          `Auto-refreshing every ${options.refresh} seconds... (Ctrl+C to exit)`,
        ),
      );

      // Set up refresh interval
      setInterval(async () => {
        console.clear();
        await handleDashboard(parentOpts, options);
      }, options.refresh * 1000);
    } else {
      console.log(
        chalk.gray(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`),
      );
    }
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Format change percentage for display
 */
function formatChange(change?: number): string {
  if (!change) return "-";
  const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  const color = change > 0 ? chalk.green : change < 0 ? chalk.red : chalk.gray;
  return color(`${arrow} ${Math.abs(change).toFixed(1)}%`);
}

/**
 * Generate ASCII sparkline chart
 */
function generateSparkline(values: number[]): string {
  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((v) => {
      const normalized = (v - min) / range;
      const index = Math.floor(normalized * (chars.length - 1));
      return chars[index];
    })
    .join("");
}
