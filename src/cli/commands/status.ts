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
  const stats = await gatherStatistics(analytics, statusOptions, dbManager);

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
  dbManager?: any,
): Promise<any> {
  const stats: any = {
    overview: {},
    platforms: {},
    recent: {},
    trends: {},
    activeSessions: [],
    recentSessions: [],
    systemHealth: {},
  };

  // Get overall platform stats
  const allPlatformStats = analytics.getPlatformStatistics();
  if (allPlatformStats && allPlatformStats.length > 0) {
    // Aggregate overall stats
    stats.overview = {
      totalPosts: allPlatformStats.reduce((sum: number, p: any) => sum + p.totalPosts, 0),
      totalComments: allPlatformStats.reduce((sum: number, p: any) => sum + p.totalComments, 0),
      totalUsers: allPlatformStats.reduce((sum: number, p: any) => sum + p.totalUsers, 0),
      databaseSize: 0, // Will be set from health metrics
      lastActivity: Math.max(...allPlatformStats.map((p: any) => p.lastUpdateTime?.getTime() || 0)),
    };
  }

  // Get platform-specific stats
  if (options.platform) {
    const platformStats = analytics.getPlatformStats(options.platform);
    if (platformStats) {
      stats.platforms[options.platform] = {
        postCount: platformStats.totalPosts,
        commentCount: platformStats.totalComments,
        userCount: platformStats.totalUsers,
        avgScore: platformStats.avgPostScore,
      };
    }
  } else {
    // Get stats for all platforms
    const platforms = ["reddit", "hackernews"] as const;
    for (const platform of platforms) {
      const platformStats = analytics.getPlatformStats(platform);
      if (platformStats) {
        stats.platforms[platform] = {
          postCount: platformStats.totalPosts,
          commentCount: platformStats.totalComments,
          userCount: platformStats.totalUsers,
          avgScore: platformStats.avgPostScore,
        };
      }
    }
  }

  // Get recent activity data
  const days = options.days || 7;

  // Get engagement over time
  const engagementData = analytics.getEngagementOverTime(days, options.platform);
  if (engagementData && engagementData.length > 0) {
    // Process engagement data into daily stats
    const dailyStats: { [date: string]: { posts: number; comments: number } } = {};
    
    engagementData.forEach((item: any) => {
      const dateStr = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
      if (dateStr) {
        if (!dailyStats[dateStr]) {
          dailyStats[dateStr] = { posts: 0, comments: 0 };
        }
        dailyStats[dateStr].posts += item.post_count || 0;
        dailyStats[dateStr].comments += item.comment_count || 0;
      }
    });

    stats.recent.posts = {
      data: Object.entries(dailyStats).map(([date, data]) => ({
        date,
        count: data.posts,
      })),
    };
    stats.recent.comments = {
      data: Object.entries(dailyStats).map(([date, data]) => ({
        date,
        count: data.comments,
      })),
    };
  }

  // Get top content
  const trendingPosts = analytics.getTrendingPosts ? analytics.getTrendingPosts(5) : [];
  const topUsers = analytics.getTopUsersByKarma(5, options.platform);
  
  stats.topContent = {
    posts: trendingPosts.map((post: any) => ({
      id: post.id,
      title: post.title,
      score: post.score,
      commentCount: post.commentCount || post.comment_count || 0,
      author: post.author,
      platform: post.platform,
    })),
    users: topUsers.map((user: any) => ({
      id: user.id,
      username: user.username,
      karma: user.karma,
      platform: user.platform,
      postCount: 0, // Would need additional query
      commentCount: 0, // Would need additional query
    })),
  };

  // Get active and recent sessions if dbManager provided
  if (dbManager) {
    stats.activeSessions = dbManager.getActiveSessions ? dbManager.getActiveSessions(5) : [];
    stats.recentSessions = dbManager.getRecentSessions ? dbManager.getRecentSessions(10, options.platform) : [];
  }

  // Get system health metrics
  const healthDetailed = analytics.getDatabaseHealthDetailed ? analytics.getDatabaseHealthDetailed() : null;
  if (healthDetailed && healthDetailed.size) {
    stats.systemHealth = {
      databaseSize: healthDetailed.size.totalSize || 0,
      tableCount: healthDetailed.tables?.length || 0,
      indexCount: healthDetailed.indexes?.total || 0,
      cacheHitRate: healthDetailed.performance?.cacheHitRate,
      queryCount: healthDetailed.performance?.queryCount,
      fragmentation: healthDetailed.fragmentation,
    };
    // Update overview with actual database size
    stats.overview.databaseSize = healthDetailed.size.totalSize || 0;
  } else {
    // Provide basic health metrics if detailed not available
    const health = analytics.getDatabaseHealth ? analytics.getDatabaseHealth() : null;
    if (health) {
      stats.systemHealth = {
        databaseSize: health.size || 0,
        tableCount: health.tables || 0,
      };
      stats.overview.databaseSize = health.size || 0;
    }
  }

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
  console.log(`  Total Posts: ${stats.overview.totalPosts?.toLocaleString() || 0}`);
  console.log(
    `  Total Comments: ${stats.overview.totalComments?.toLocaleString() || 0}`,
  );
  console.log(`  Total Users: ${stats.overview.totalUsers?.toLocaleString() || 0}`);
  console.log(`  Database Size: ${formatBytes(stats.overview.databaseSize || 0)}`);
  if (stats.overview.lastActivity) {
    console.log(
      `  Last Activity: ${new Date(stats.overview.lastActivity).toLocaleString()}`,
    );
  }

  // Active sessions
  if (stats.activeSessions && stats.activeSessions.length > 0) {
    console.log(chalk.yellow("\nActive Sessions:"));
    stats.activeSessions.forEach((session: any) => {
      console.log(`  ${chalk.green("●")} ${session.platform} - ${session.status}`);
      console.log(`    Started: ${new Date(session.startedAt).toLocaleString()}`);
      console.log(`    Items scraped: ${session.totalItemsScraped || 0}`);
    });
  } else {
    console.log(chalk.yellow("\nActive Sessions:"));
    console.log(`  ${chalk.gray("No active sessions")}`);
  }

  // System health
  if (stats.systemHealth && Object.keys(stats.systemHealth).length > 0) {
    console.log(chalk.yellow("\nSystem Health:"));
    console.log(`  Tables: ${stats.systemHealth.tableCount || 0}`);
    console.log(`  Indexes: ${stats.systemHealth.indexCount || 0}`);
    if (stats.systemHealth.cacheHitRate !== undefined) {
      console.log(`  Cache Hit Rate: ${(stats.systemHealth.cacheHitRate * 100).toFixed(1)}%`);
    }
    if (stats.systemHealth.fragmentation !== undefined) {
      const fragColor = stats.systemHealth.fragmentation > 30 ? chalk.red : 
                       stats.systemHealth.fragmentation > 10 ? chalk.yellow : chalk.green;
      console.log(`  Fragmentation: ${fragColor(stats.systemHealth.fragmentation.toFixed(1) + '%')}`);
    }
  }

  // Platform breakdown
  if (Object.keys(stats.platforms).length > 0) {
    console.log(chalk.yellow("\nPlatform Breakdown:"));
    for (const [platform, platformStats] of Object.entries(stats.platforms)) {
      const pStats = platformStats as any;
      console.log(`  ${chalk.cyan(platform)}:`);
      console.log(`    Posts: ${pStats.postCount?.toLocaleString() || 0}`);
      console.log(`    Comments: ${pStats.commentCount?.toLocaleString() || 0}`);
      console.log(`    Users: ${pStats.userCount?.toLocaleString() || 0}`);
      if (pStats.avgScore !== undefined) {
        console.log(`    Avg Score: ${pStats.avgScore.toFixed(1)}`);
      }
    }
  }

  // Recent activity
  if (stats.recent.posts && stats.recent.posts.data) {
    console.log(chalk.yellow("\nRecent Activity:"));
    const recentPosts = stats.recent.posts.data.reduce(
      (sum: number, day: any) => sum + day.count,
      0,
    );
    const recentComments = stats.recent.comments?.data?.reduce(
      (sum: number, day: any) => sum + day.count,
      0,
    ) || 0;
    console.log(
      `  Posts (last ${stats.recent.posts.data.length} days): ${recentPosts.toLocaleString()}`,
    );
    console.log(
      `  Comments (last ${stats.recent.comments?.data?.length || 0} days): ${recentComments.toLocaleString()}`,
    );
  }

  // Top content
  if (stats.topContent && stats.topContent.posts && stats.topContent.posts.length > 0) {
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
    ["Total Posts", stats.overview.totalPosts?.toLocaleString() || "0"],
    ["Total Comments", stats.overview.totalComments?.toLocaleString() || "0"],
    ["Total Users", stats.overview.totalUsers?.toLocaleString() || "0"],
    ["Database Size", formatBytes(stats.overview.databaseSize || 0)],
    ["Last Activity", stats.overview.lastActivity ? new Date(stats.overview.lastActivity).toLocaleString() : "N/A"],
  );
  
  // Add system health metrics
  if (stats.systemHealth && stats.systemHealth.cacheHitRate !== undefined) {
    overviewTable.push(
      ["Cache Hit Rate", `${(stats.systemHealth.cacheHitRate * 100).toFixed(1)}%`]
    );
  }
  if (stats.systemHealth && stats.systemHealth.fragmentation !== undefined) {
    const fragColor = stats.systemHealth.fragmentation > 30 ? chalk.red : 
                     stats.systemHealth.fragmentation > 10 ? chalk.yellow : chalk.green;
    overviewTable.push(
      ["DB Fragmentation", fragColor(`${stats.systemHealth.fragmentation.toFixed(1)}%`)]
    );
  }

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

  // Active sessions table
  if (stats.activeSessions && stats.activeSessions.length > 0) {
    const sessionsTable = new Table({
      head: [
        chalk.yellow("Platform"),
        chalk.yellow("Status"),
        chalk.yellow("Started"),
        chalk.yellow("Items"),
        chalk.yellow("Errors"),
      ],
      colWidths: [12, 10, 20, 10, 8],
    });

    stats.activeSessions.forEach((session: any) => {
      const statusColor = session.status === 'running' ? chalk.green :
                         session.status === 'pending' ? chalk.yellow :
                         session.status === 'failed' ? chalk.red : chalk.gray;
      sessionsTable.push([
        session.platform,
        statusColor(session.status),
        new Date(session.startedAt).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        session.totalItemsScraped?.toString() || "0",
        session.errorCount?.toString() || "0",
      ]);
    });

    console.log(chalk.bold.cyan("\nActive Sessions"));
    console.log(sessionsTable.toString());
  }

  // Recent activity chart (simple ASCII)
  if (verbose && stats.recent.posts && stats.recent.posts.data) {
    console.log(chalk.bold.cyan("\nRecent Activity (Posts)"));
    displayMiniChart(stats.recent.posts.data);
  }

  // Top posts table
  if (stats.topContent && stats.topContent.posts && stats.topContent.posts.length > 0) {
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
  if (verbose && stats.topContent && stats.topContent.users && stats.topContent.users.length > 0) {
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
