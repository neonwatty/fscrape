/**
 * Status command - Display database and scraping statistics
 */

import { Command } from "commander";
import {
  validateStatusOptions,
  validatePath,
  validatePositiveInt,
  formatError,
} from "../validation.js";
import type { StatusOptions } from "../validation.js";
import { DatabaseManager } from "../../database/database.js";
import chalk from "chalk";
import Table from "cli-table3";

/**
 * Create the status command
 */
export function createStatusCommand(): Command {
  const command = new Command("status")
    .description("Display database statistics and scraping status")
    .option("-d, --database <path>", "Database path", "fscrape.db")
    .option(
      "-f, --format <format>",
      "Output format (json, table, summary)",
      "table",
    )
    .option("-p, --platform <platform>", "Filter by platform")
    .option(
      "--days <number>",
      "Number of days to include in stats",
      (value) => validatePositiveInt(value, "Days"),
      7,
    )
    .option("--verbose", "Show detailed statistics", false)
    .action(async (options: any) => {
      try {
        await handleStatus(options);
      } catch (error) {
        console.error(chalk.red(formatError(error)));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Handle the status command
 */
async function handleStatus(options: any): Promise<void> {
  // Validate options
  const statusOptions = validateStatusOptions({
    database: options.database,
    format: options.format,
    platform: options.platform,
    days: options.days,
  });

  // Connect to database
  const dbPath = validatePath(statusOptions.database || "fscrape.db", true);
  const dbManager = new DatabaseManager({
    type: "sqlite" as const,
    path: dbPath,
    connectionPoolSize: 5,
  });
  await dbManager.initialize();

  // Get analytics from database manager
  const analytics = dbManager.getAnalytics();

  // Gather statistics
  const stats = await gatherStatistics(analytics, statusOptions);

  // Display based on format
  switch (statusOptions.format) {
    case "json":
      displayJson(stats);
      break;
    case "summary":
      displaySummary(stats);
      break;
    case "table":
    default:
      displayTable(stats, options.verbose);
      break;
  }
}

/**
 * Gather statistics from database
 */
async function gatherStatistics(
  analytics: any,
  options: StatusOptions,
): Promise<any> {
  const stats: any = {
    overview: analytics.getPlatformStats(),
    platforms: {},
    recent: {},
    trends: {},
  };

  // Get platform-specific stats
  if (options.platform) {
    stats.platforms[options.platform] = analytics.getPlatformStats(
      options.platform,
    );
  } else {
    // Get stats for all platforms
    const platforms = ["reddit", "hackernews"] as const; // TODO: get from analytics
    for (const platform of platforms) {
      stats.platforms[platform] = analytics.getPlatformStats(platform);
    }
  }

  // Get recent activity
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (options.days || 7));

  stats.recent = {
    posts: { data: [] }, // TODO: implement trends
    comments: { data: [] },
    users: { data: [] },
  };

  // Get top content
  stats.topContent = {
    posts: [], // TODO: implement top content
    users: [],
  };

  return stats;
}

/**
 * Display statistics as JSON
 */
function displayJson(stats: any): void {
  console.log(JSON.stringify(stats, null, 2));
}

/**
 * Display statistics as summary
 */
function displaySummary(stats: any): void {
  console.log(chalk.bold.cyan("\n📊 Database Statistics Summary\n"));

  // Overview
  console.log(chalk.yellow("Overview:"));
  console.log(`  Total Posts: ${stats.overview.totalPosts.toLocaleString()}`);
  console.log(
    `  Total Comments: ${stats.overview.totalComments.toLocaleString()}`,
  );
  console.log(`  Total Users: ${stats.overview.totalUsers.toLocaleString()}`);
  console.log(`  Database Size: ${formatBytes(stats.overview.databaseSize)}`);
  console.log(
    `  Last Activity: ${new Date(stats.overview.lastActivity).toLocaleString()}`,
  );

  // Platform breakdown
  if (Object.keys(stats.platforms).length > 0) {
    console.log(chalk.yellow("\nPlatform Breakdown:"));
    for (const [platform, platformStats] of Object.entries(stats.platforms)) {
      const pStats = platformStats as any;
      console.log(`  ${chalk.cyan(platform)}:`);
      console.log(`    Posts: ${pStats.postCount.toLocaleString()}`);
      console.log(`    Comments: ${pStats.commentCount.toLocaleString()}`);
      console.log(`    Users: ${pStats.userCount.toLocaleString()}`);
    }
  }

  // Recent activity
  if (stats.recent.posts) {
    console.log(chalk.yellow("\nRecent Activity:"));
    const recentPosts = stats.recent.posts.data.reduce(
      (sum: number, day: any) => sum + day.count,
      0,
    );
    const recentComments = stats.recent.comments.data.reduce(
      (sum: number, day: any) => sum + day.count,
      0,
    );
    console.log(
      `  Posts (last ${stats.recent.posts.data.length} days): ${recentPosts.toLocaleString()}`,
    );
    console.log(
      `  Comments (last ${stats.recent.comments.data.length} days): ${recentComments.toLocaleString()}`,
    );
  }

  // Top content
  if (stats.topContent.posts.length > 0) {
    console.log(chalk.yellow("\nTop Posts:"));
    stats.topContent.posts.forEach((post: any, index: number) => {
      console.log(`  ${index + 1}. ${truncateString(post.title, 50)}`);
      console.log(`     Score: ${post.score} | Comments: ${post.commentCount}`);
    });
  }
}

/**
 * Display statistics as table
 */
function displayTable(stats: any, verbose: boolean): void {
  console.log(chalk.bold.cyan("\n📊 Database Statistics\n"));

  // Overview table
  const overviewTable = new Table({
    head: [chalk.yellow("Metric"), chalk.yellow("Value")],
    colWidths: [25, 35],
  });

  overviewTable.push(
    ["Total Posts", stats.overview.totalPosts.toLocaleString()],
    ["Total Comments", stats.overview.totalComments.toLocaleString()],
    ["Total Users", stats.overview.totalUsers.toLocaleString()],
    ["Database Size", formatBytes(stats.overview.databaseSize)],
    ["Last Activity", new Date(stats.overview.lastActivity).toLocaleString()],
  );

  console.log(overviewTable.toString());

  // Platform stats table
  if (Object.keys(stats.platforms).length > 0) {
    const platformTable = new Table({
      head: [
        chalk.yellow("Platform"),
        chalk.yellow("Posts"),
        chalk.yellow("Comments"),
        chalk.yellow("Users"),
        chalk.yellow("Avg Score"),
      ],
      colWidths: [15, 12, 12, 12, 12],
    });

    for (const [platform, platformStats] of Object.entries(stats.platforms)) {
      const pStats = platformStats as any;
      platformTable.push([
        platform,
        pStats.postCount.toLocaleString(),
        pStats.commentCount.toLocaleString(),
        pStats.userCount.toLocaleString(),
        pStats.avgScore?.toFixed(1) || "N/A",
      ]);
    }

    console.log(chalk.bold.cyan("\nPlatform Statistics"));
    console.log(platformTable.toString());
  }

  // Recent activity chart (simple ASCII)
  if (verbose && stats.recent.posts) {
    console.log(chalk.bold.cyan("\nRecent Activity (Posts)"));
    displayMiniChart(stats.recent.posts.data);
  }

  // Top posts table
  if (stats.topContent.posts.length > 0) {
    const topPostsTable = new Table({
      head: [
        chalk.yellow("#"),
        chalk.yellow("Title"),
        chalk.yellow("Score"),
        chalk.yellow("Comments"),
      ],
      colWidths: [5, 45, 10, 12],
    });

    stats.topContent.posts.forEach((post: any, index: number) => {
      topPostsTable.push([
        (index + 1).toString(),
        truncateString(post.title, 40),
        post.score.toString(),
        post.commentCount.toString(),
      ]);
    });

    console.log(chalk.bold.cyan("\nTop Posts"));
    console.log(topPostsTable.toString());
  }

  // Top users table
  if (verbose && stats.topContent.users.length > 0) {
    const topUsersTable = new Table({
      head: [
        chalk.yellow("#"),
        chalk.yellow("Username"),
        chalk.yellow("Posts"),
        chalk.yellow("Comments"),
        chalk.yellow("Karma"),
      ],
      colWidths: [5, 20, 10, 12, 12],
    });

    stats.topContent.users.forEach((user: any, index: number) => {
      topUsersTable.push([
        (index + 1).toString(),
        truncateString(user.username, 18),
        user.postCount.toString(),
        user.commentCount.toString(),
        user.karma?.toString() || "N/A",
      ]);
    });

    console.log(chalk.bold.cyan("\nTop Users"));
    console.log(topUsersTable.toString());
  }
}

/**
 * Display a simple ASCII chart
 */
function displayMiniChart(data: Array<{ date: string; count: number }>): void {
  if (data.length === 0) return;

  const maxCount = Math.max(...data.map((d) => d.count));
  const scale = maxCount > 0 ? 20 / maxCount : 1;

  data.forEach((day) => {
    const barLength = Math.round(day.count * scale);
    const bar = "█".repeat(barLength);
    const date = new Date(day.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    console.log(`  ${date.padEnd(10)} ${bar} ${day.count}`);
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Truncate string with ellipsis
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}
