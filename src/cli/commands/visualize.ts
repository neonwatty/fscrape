/**
 * Visualization command for analytics data
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { DatabaseAnalytics } from "../../database/analytics.js";
import { AnalyticsVisualizer } from "../../analytics/visualizer.js";
import { TerminalVisualizer } from "../../analytics/terminal-visualizer.js";
import { SvgGenerator } from "../../analytics/svg-generator.js";
import { AnalyticsExporter } from "../../export/exporters/analytics-exporter.js";
import { ReportGenerator } from "../../analytics/report-generator.js";
import type { Platform } from "../../types/core.js";
import fs from "fs/promises";
import path from "path";

export const visualizeCommand = new Command("visualize")
  .alias("viz")
  .description("Generate visualizations from analytics data")
  .option("-d, --database <path>", "Path to database", "scraped_data.db")
  .option(
    "-t, --type <type>",
    "Visualization type (chart|dashboard|report)",
    "chart",
  )
  .option("-o, --output <path>", "Output file path")
  .option(
    "-f, --format <format>",
    "Output format (terminal|text|html|svg|json)",
    "terminal",
  )
  .option(
    "--chart <type>",
    "Chart type (line|bar|pie|scatter|heatmap|histogram)",
  )
  .option(
    "--metric <metric>",
    "Metric to visualize (score|comments|engagement)",
  )
  .option("--platform <platform>", "Filter by platform")
  .option("--days <number>", "Number of days to include", "30")
  .option("--width <number>", "Chart width", "120")
  .option("--height <number>", "Chart height", "30")
  .option("--colors", "Use colors in terminal output", true)
  .option("--unicode", "Use Unicode characters", true)
  .option(
    "--theme <theme>",
    "Color theme (default|vibrant|pastel|monochrome)",
    "default",
  )
  .option(
    "--style <style>",
    "Visualization style (minimal|standard|rich)",
    "rich",
  )
  .option("--interactive", "Interactive mode for dashboard")
  .action(async (options) => {
    const spinner = ora("Initializing visualization...").start();

    try {
      // Initialize analytics
      const analytics = new DatabaseAnalytics(options.database);

      // Determine visualization type and generate
      switch (options.type) {
        case "chart":
          await generateChart(analytics, options, spinner);
          break;

        case "dashboard":
          await generateDashboard(analytics, options, spinner);
          break;

        case "report":
          await generateReport(analytics, options, spinner);
          break;

        default:
          throw new Error(`Unknown visualization type: ${options.type}`);
      }

      spinner.succeed("Visualization complete!");
    } catch (error) {
      spinner.fail(
        `Visualization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

/**
 * Generate a single chart visualization
 */
async function generateChart(
  analytics: DatabaseAnalytics,
  options: any,
  spinner: any,
): Promise<void> {
  spinner.text = "Fetching data...";

  // Get date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(options.days));

  // Fetch data based on metric
  let data: any;
  const metric = options.metric || "score";
  const chartType = options.chart || "line";

  switch (metric) {
    case "score":
      const tsData = await analytics.getTimeSeriesData(
        startDate,
        endDate,
        "day",
        options.platform,
      );
      data = tsData;
      break;

    case "comments":
      // Comment trends - use time series for now
      const tsData = await analytics.getTimeSeriesData(
        startDate,
        endDate,
        "day",
        options.platform,
      );
      data = tsData.map((d: any) => ({ ...d, value: d.commentCount }));
      break;

    case "engagement":
      const engData = await analytics.getEngagementStats(
        startDate,
        endDate,
        options.platform,
      );
      data = [engData];
      break;

    default:
      const trending = await analytics.getTrendingPosts(10, options.platform);
      data = trending;
  }

  spinner.text = "Generating visualization...";

  // Create visualization based on format
  let output: string;

  if (options.format === "svg") {
    // Generate SVG
    const svgGen = new SvgGenerator({
      width: parseInt(options.width) * 8,
      height: parseInt(options.height) * 16,
      theme: options.theme === "monochrome" ? "dark" : "light",
    });

    switch (chartType) {
      case "pie":
        output = svgGen.generatePieChart(
          data.map((d: any) => ({
            label: d.title || d.date,
            value: d.score || d.value,
          })),
          `${metric.charAt(0).toUpperCase() + metric.slice(1)} Distribution`,
        );
        break;

      case "bar":
        output = svgGen.generateBarChart(
          data.map((d: any) => ({
            label: d.title || d.date,
            values: { [metric]: d.score || d.value || d.postCount },
          })),
          `${metric.charAt(0).toUpperCase() + metric.slice(1)} by Period`,
        );
        break;

      default:
        output = svgGen.generateLineChart(
          data.map((d: any) => ({
            x: d.date || new Date(),
            y: d.score || d.value || d.postCount,
          })),
          `${metric.charAt(0).toUpperCase() + metric.slice(1)} Trend`,
        );
    }
  } else if (options.format === "terminal" && options.colors) {
    // Generate rich terminal visualization
    const termViz = new TerminalVisualizer({
      width: parseInt(options.width),
      height: parseInt(options.height),
      useColors: options.colors,
      useUnicode: options.unicode,
      style: options.style,
      colorScheme: options.theme,
    });

    switch (chartType) {
      case "heatmap":
        // Convert data to 2D array for heatmap
        const heatmapData = [];
        for (let i = 0; i < Math.min(data.length, 10); i++) {
          const row = [];
          for (let j = 0; j < 7; j++) {
            row.push(Math.random() * 100); // Placeholder - would use real data
          }
          heatmapData.push(row);
        }
        output = termViz.createHeatMap(heatmapData, {
          title: `${metric} Heatmap`,
          rowLabels: data.slice(0, 10).map((d: any) => d.title || d.date),
          colLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        });
        break;

      case "comparison":
        output = termViz.createComparisonChart(
          data.slice(0, 10).map((d: any) => ({
            label: d.title || d.date,
            value1: d.score || d.postCount || 0,
            value2: d.commentCount || 0,
          })),
          {
            title: `${metric} Comparison`,
            labels: ["Posts", "Comments"],
          },
        );
        break;

      default:
        // Create sparkline for quick view
        const sparkline = termViz.createSparkline(
          data.map((d: any) => d.score || d.value || d.postCount),
        );

        // Create progress bars for top items
        const progressBars = data
          .slice(0, 5)
          .map((d: any, i: number) => {
            const maxValue = Math.max(
              ...data.map((item: any) => item.score || item.value || 0),
            );
            return `${i + 1}. ${termViz.createProgressBar(
              d.score || d.value || 0,
              maxValue,
              { label: d.title || d.date },
            )}`;
          })
          .join("\n");

        output =
          `${chalk.bold(`${metric.toUpperCase()} VISUALIZATION`)}\n\n` +
          `Trend: ${sparkline}\n\n` +
          `Top Items:\n${progressBars}`;
    }
  } else {
    // Generate standard ASCII visualization
    const visualizer = new AnalyticsVisualizer();

    switch (chartType) {
      case "bar":
        output = visualizer.createBarChart(
          data.map((d: any) => ({
            label: d.title || d.date || "Item",
            [metric]: d.score || d.value || d.postCount || 0,
          })),
          `${metric.charAt(0).toUpperCase() + metric.slice(1)} Chart`,
          {
            width: parseInt(options.width),
            height: parseInt(options.height),
            colors: false,
          },
        );
        break;

      case "pie":
        output = visualizer.createPieChart(
          data.slice(0, 8).map((d: any) => ({
            label: d.title || d.date || "Item",
            value: d.score || d.value || d.postCount || 0,
          })),
          `${metric.charAt(0).toUpperCase() + metric.slice(1)} Distribution`,
          {
            width: parseInt(options.width),
            height: parseInt(options.height),
          },
        );
        break;

      case "histogram":
        const values = data.map(
          (d: any) => d.score || d.value || d.postCount || 0,
        );
        output = visualizer.createHistogram(
          values,
          10,
          `${metric.charAt(0).toUpperCase() + metric.slice(1)} Distribution`,
          {
            width: parseInt(options.width),
            height: parseInt(options.height),
          },
        );
        break;

      default:
        output = visualizer.createLineChart(
          data.map((d: any) => ({
            date: d.date || new Date(),
            value: d.score || d.value || d.postCount || 0,
          })),
          `${metric.charAt(0).toUpperCase() + metric.slice(1)} Over Time`,
          {
            width: parseInt(options.width),
            height: parseInt(options.height),
            showGrid: true,
            showLegend: true,
          },
        );
    }
  }

  // Output or save
  if (options.output) {
    spinner.text = `Saving to ${options.output}...`;
    await fs.writeFile(options.output, output);
    console.log(chalk.green(`\n✓ Visualization saved to ${options.output}`));
  } else {
    spinner.stop();
    console.log("\n" + output);
  }
}

/**
 * Generate an interactive dashboard
 */
async function generateDashboard(
  analytics: DatabaseAnalytics,
  options: any,
  spinner: any,
): Promise<void> {
  spinner.text = "Building dashboard...";

  // Get comprehensive metrics
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(options.days));

  const [overview, platformStats, trending, timeSeries] = await Promise.all([
    analytics.getOverviewStats(options.platform),
    analytics.getPlatformStats(startDate, endDate),
    analytics.getTrendingPosts(10, parseInt(options.days), options.platform),
    analytics.getTimeSeriesData(startDate, endDate, "day", options.platform),
  ]);

  // Build dashboard metrics object
  const metrics: any = {
    overview: {
      totalPosts: overview.totalPosts,
      totalComments: overview.totalComments,
      totalUsers: overview.uniqueAuthors,
      avgEngagement: overview.avgScore,
      growthRate: 0.15, // Placeholder
    },
    platformBreakdown: new Map(
      platformStats.map((stat) => [stat.platform as Platform, stat]),
    ),
    trending,
    timeSeries,
    topPerformers: {
      posts: trending.slice(0, 5),
      authors: [], // Would need to implement author metrics
    },
    health: {
      databaseSize: 0, // Would get from file system
      lastUpdate: new Date(),
      dataQuality: 95,
      gaps: [],
    },
  };

  spinner.text = "Rendering dashboard...";

  // Generate dashboard based on format
  if (options.format === "html") {
    const exporter = new AnalyticsExporter({
      format: "html",
      includeVisualizations: true,
      outputStyle: "dashboard",
    });

    const result = await exporter.exportDashboard(
      metrics,
      options.output || "dashboard.html",
    );

    spinner.succeed(`Dashboard saved to ${result.files.join(", ")}`);
  } else {
    // Terminal dashboard
    const termViz = new TerminalVisualizer({
      width: parseInt(options.width),
      useColors: options.colors,
      useUnicode: options.unicode,
      style: options.style,
      colorScheme: options.theme,
    });

    const sections = [
      {
        title: "OVERVIEW",
        content: [
          `Total Posts: ${overview.totalPosts.toLocaleString()}`,
          `Total Comments: ${overview.totalComments.toLocaleString()}`,
          `Unique Authors: ${overview.uniqueAuthors.toLocaleString()}`,
          `Average Score: ${overview.avgScore.toFixed(2)}`,
        ].join("\n"),
        style: "box" as const,
      },
      {
        title: "TRENDING POSTS",
        content: trending
          .slice(0, 5)
          .map(
            (post, i) =>
              `${i + 1}. ${post.title.substring(0, 60)} (${post.score})`,
          )
          .join("\n"),
        style: "box" as const,
      },
      {
        title: "ACTIVITY SPARKLINE",
        content: termViz.createSparkline(timeSeries.map((ts) => ts.postCount)),
        style: "simple" as const,
      },
    ];

    const dashboard = termViz.createDashboard(sections, {
      width: parseInt(options.width),
    });

    spinner.stop();
    console.log("\n" + dashboard);

    // Interactive mode
    if (options.interactive) {
      console.log(chalk.dim("\nPress Q to quit, R to refresh"));
      // Would implement interactive controls here
    }
  }
}

/**
 * Generate a comprehensive report
 */
async function generateReport(
  analytics: DatabaseAnalytics,
  options: any,
  spinner: any,
): Promise<void> {
  spinner.text = "Generating report...";

  const reportGen = new ReportGenerator(analytics, new AnalyticsVisualizer());

  // Build report configuration
  const reportConfig = {
    includeCharts: true,
    includeRawData: options.format === "json",
    includeSummary: true,
    includeRecommendations: true,
  };

  // Generate report
  const report = await reportGen.generateReport(
    "executive", // Use executive template
    reportConfig,
  );

  // Export report
  const exporter = new AnalyticsExporter({
    format: options.format,
    includeVisualizations: true,
    outputStyle: "detailed",
  });

  const outputPath =
    options.output ||
    `analytics-report.${options.format === "svg" ? "svg" : options.format}`;
  const result = await exporter.exportReport(report, outputPath, {
    format: options.format,
  });

  spinner.succeed(`Report saved to ${result.files.join(", ")}`);

  // Display summary
  console.log(chalk.blue("\nReport Summary:"));
  console.log(`  Title: ${report.title}`);
  console.log(`  Sections: ${report.sections.length}`);
  console.log(`  Generated: ${report.generatedAt.toLocaleString()}`);

  if (result.metadata.visualizationCount) {
    console.log(`  Visualizations: ${result.metadata.visualizationCount}`);
  }
  if (result.metadata.dataPointCount) {
    console.log(`  Data Points: ${result.metadata.dataPointCount}`);
  }
}

// Helper function to format dates
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
