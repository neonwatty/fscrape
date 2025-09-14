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
      "Metric to analyze (posts, comments, engagement)",
      "engagement",
    )
    .option(
      "--method <method>",
      "Analysis method (mann-kendall, regression, seasonal)",
      "regression",
    )
    .option(
      "-f, --format <format>",
      "Output format (json, table, chart)",
      "table",
    )
    .option("--breakpoints", "Detect breakpoints in trends", false)
    .option(
      "--seasonal-period <number>",
      "Period for seasonal analysis",
      (value) => validatePositiveInt(value, "Period"),
      7,
    )
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
    const dbPath = validatePath(parentOpts.database || "fscrape.db", true);
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const analytics = dbManager.getAnalytics();
    const analyzer = new TrendAnalyzer();

    // Get time series data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (options.days || 30));

    const metrics = analytics.getEngagementOverTime(
      options.days || 30,
      options.platform,
    );

    const timeSeries = metrics.map((m: any) => ({
      timestamp: new Date(m.date),
      value: m[options.metric] || m.engagement || 0,
    }));

    // Analyze trends based on method
    let result: any;
    switch (options.method) {
      case "mann-kendall":
        const mannKendallValues = timeSeries.map((ts) => ts.value);
        result = analyzer.mannKendallTest(mannKendallValues);
        break;
      case "seasonal":
        result = analyzer.seasonalDecomposition(
          timeSeries,
          options.seasonalPeriod || 7,
        );
        break;
      case "regression":
      default:
        const trendValues = timeSeries.map((ts) => ts.value);
        const trendTimestamps = timeSeries.map((ts) => ts.timestamp);
        result = analyzer.analyzeTrend(trendValues, trendTimestamps);
        break;
    }

    // Detect breakpoints if requested
    if (options.breakpoints) {
      const breakpointValues = timeSeries.map((ts) => ts.value);
      const breakpoints = analyzer.detectBreakpoints(breakpointValues);
      result.breakpoints = breakpoints;
    }

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else if (options.format === "chart") {
      // Simple ASCII chart
      console.log(chalk.cyan("📈 Trend Analysis"));
      const maxValue = Math.max(...timeSeries.map((ts) => ts.value));
      const scale = 20 / maxValue;

      timeSeries.slice(-20).forEach((point) => {
        const barLength = Math.round(point.value * scale);
        const bar = "█".repeat(barLength);
        const date = format(point.timestamp, "MM/dd");
        console.log(`${date} ${bar} ${point.value.toFixed(1)}`);
      });

      if (result.trend) {
        console.log(chalk.green(`\nTrend: ${result.trend}`));
        console.log(chalk.gray(`Slope: ${result.slope?.toFixed(4) || "N/A"}`));
      }
    } else {
      // Table format
      const table = new Table({
        head: ["Metric", "Value"],
        style: { head: ["cyan"] },
      });

      if (options.method === "mann-kendall") {
        table.push(
          ["Trend", result.trend],
          ["Statistic", result.statistic.toFixed(3)],
          ["P-Value", result.pValue.toFixed(4)],
          ["Significant", result.significant ? "Yes" : "No"],
        );
      } else if (options.method === "seasonal") {
        table.push(
          ["Trend", result.trend?.direction || "N/A"],
          ["Seasonal Strength", result.seasonalStrength?.toFixed(2) || "N/A"],
          ["Trend Strength", result.trendStrength?.toFixed(2) || "N/A"],
        );
      } else {
        table.push(
          ["Trend", result.trend || "No clear trend"],
          ["Direction", result.direction || "Neutral"],
          ["Slope", result.slope?.toFixed(4) || "0"],
          ["R²", result.rSquared?.toFixed(3) || "N/A"],
          ["Change %", result.changePercent?.toFixed(1) || "0"],
        );
      }

      if (result.breakpoints && result.breakpoints.length > 0) {
        table.push(["Breakpoints", result.breakpoints.join(", ")]);
      }

      console.log(chalk.cyan("📈 Trend Analysis"));
      console.log(table.toString());
    }
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
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
