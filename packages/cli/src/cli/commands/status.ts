/**
 * Status command - Display database and scraping statistics
 */

import { Command } from 'commander';
import {
  validateStatusOptions,
  validatePath,
  validatePositiveInt,
  formatError,
} from '../validation.js';
import type { StatusOptions } from '../validation.js';
import type { StatusCommandOptions } from '../../types/cli.js';
import { DatabaseManager } from '../../database/database.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as fs from 'fs';

/**
 * Create the status command
 */
export function createStatusCommand(): Command {
  const command = new Command('status')
    .description('Display database statistics and scraping status')
    .option('-d, --database <path>', 'Database path', 'fscrape.db')
    .option('-f, --format <format>', 'Output format (json, table, summary)', 'table')
    .option('-p, --platform <platform>', 'Filter by platform')
    .option(
      '--days <number>',
      'Number of days to include in stats',
      (value) => validatePositiveInt(value, 'Days'),
      7
    )
    .option('--verbose', 'Show detailed statistics', false)
    .action(async (options: StatusCommandOptions) => {
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
async function handleStatus(options: StatusCommandOptions): Promise<void> {
  // Validate options
  const statusOptions = validateStatusOptions({
    database: options.database,
    format: options.format,
    platform: options.platform,
    days: options.days,
  });

  // Connect to database
  const dbPath = validatePath(statusOptions.database || 'fscrape.db', true);
  const dbManager = new DatabaseManager({
    type: 'sqlite' as const,
    path: dbPath,
    connectionPoolSize: 5,
  });
  await dbManager.initialize();

  // Gather statistics
  const stats = await gatherStatistics(statusOptions, dbManager);

  // Display based on format
  switch (statusOptions.format) {
    case 'json':
      displayJson(stats);
      break;
    case 'summary':
      displaySummary(stats);
      break;
    case 'table':
    default:
      displayTable(stats, options.verbose || false);
      break;
  }
}

/**
 * Gather statistics from database
 */
interface DatabaseStats {
  overview: {
    totalPosts: number;
    totalComments: number;
    totalUsers: number;
    databaseSize: number;
    lastActivity: number;
  };
  platforms: Record<
    string,
    {
      postCount: number;
      commentCount: number;
      userCount: number;
      avgScore: number;
    }
  >;
  recent: {
    posts: {
      data: Array<{ date: string; count: number }>;
    };
    comments: {
      data: Array<{ date: string; count: number }>;
    };
  };
  activeSessions: unknown[];
  recentSessions: unknown[];
  systemHealth: {
    databaseSize: number;
    tableCount: number;
    indexCount?: number;
    cacheHitRate?: number;
    fragmentation?: number;
  };
  topContent: {
    posts: Array<{
      id: string;
      title: string;
      score: number;
      commentCount: number;
      author: string;
      platform: string;
    }>;
    users: unknown[];
  };
}

async function gatherStatistics(
  options: StatusOptions,
  dbManager: DatabaseManager
): Promise<DatabaseStats> {
  const stats: DatabaseStats = {
    overview: {
      totalPosts: 0,
      totalComments: 0,
      totalUsers: 0,
      databaseSize: 0,
      lastActivity: 0,
    },
    platforms: {},
    recent: {
      posts: { data: [] },
      comments: { data: [] },
    },
    activeSessions: [],
    recentSessions: [],
    systemHealth: {
      databaseSize: 0,
      tableCount: 0,
    },
    topContent: {
      posts: [],
      users: [],
    },
  };

  // Get basic database counts using existing methods
  const allPosts = dbManager.getPosts(undefined, 999999, 0); // Get all posts with high limit
  const _redditPosts = dbManager.getPosts('reddit', 999999, 0);
  const _hackernewsPosts = dbManager.getPosts('hackernews', 999999, 0);

  // Calculate totals from posts
  const totalPosts = allPosts.total;
  const totalComments = allPosts.posts.reduce((sum, post) => sum + (post.commentCount || 0), 0);

  // Find latest activity
  const lastActivity = Math.max(
    ...allPosts.posts.map((post) => post.updatedAt?.getTime() || post.createdAt.getTime() || 0)
  );

  // Set overview stats
  stats.overview = {
    totalPosts,
    totalComments,
    totalUsers: 0, // Will calculate from posts
    databaseSize: 0, // Will be set from file size
    lastActivity,
  };

  // Get platform-specific stats
  if (options.platform) {
    // Get stats for specific platform
    const platformPosts = dbManager.getPosts(options.platform, 999999, 0);
    const platformCommentCount = platformPosts.posts.reduce(
      (sum, post) => sum + (post.commentCount || 0),
      0
    );
    const avgScore =
      platformPosts.posts.length > 0
        ? platformPosts.posts.reduce((sum, post) => sum + (post.score || 0), 0) /
          platformPosts.posts.length
        : 0;

    stats.platforms[options.platform] = {
      postCount: platformPosts.total,
      commentCount: platformCommentCount,
      userCount: new Set(platformPosts.posts.map((post) => post.author)).size,
      avgScore,
    };
  } else {
    // Get stats for all platforms
    const platforms = ['reddit', 'hackernews'] as const;
    for (const platform of platforms) {
      const platformPosts = dbManager.getPosts(platform, 999999, 0);
      if (platformPosts.total > 0) {
        const platformCommentCount = platformPosts.posts.reduce(
          (sum, post) => sum + (post.commentCount || 0),
          0
        );
        const avgScore =
          platformPosts.posts.length > 0
            ? platformPosts.posts.reduce((sum, post) => sum + (post.score || 0), 0) /
              platformPosts.posts.length
            : 0;

        stats.platforms[platform] = {
          postCount: platformPosts.total,
          commentCount: platformCommentCount,
          userCount: new Set(platformPosts.posts.map((post) => post.author)).size,
          avgScore,
        };
      }
    }
  }

  // Get recent activity data (simplified - just recent counts, no daily breakdown)
  const days = options.days || 7;
  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

  // Filter posts by date from the already fetched data
  const recentPosts = options.platform
    ? dbManager
        .getPosts(options.platform, 999999, 0)
        .posts.filter((post) => (post.createdAt?.getTime() || 0) > cutoffDate)
    : allPosts.posts.filter((post) => (post.createdAt?.getTime() || 0) > cutoffDate);

  const recentCommentCount = recentPosts.reduce((sum, post) => sum + (post.commentCount || 0), 0);

  stats.recent = {
    posts: {
      data: [
        {
          date: new Date().toISOString().split('T')[0],
          count: recentPosts.length,
        },
      ],
    },
    comments: {
      data: [
        {
          date: new Date().toISOString().split('T')[0],
          count: recentCommentCount,
        },
      ],
    },
  };

  // Get top posts (simplified)
  const topPostsData = options.platform
    ? dbManager.getPosts(options.platform, 999999, 0).posts
    : allPosts.posts;

  const topPosts = topPostsData.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);

  stats.topContent = {
    posts: topPosts.map((post) => ({
      id: post.id,
      title: post.title,
      score: post.score,
      commentCount: post.commentCount || 0,
      author: post.author,
      platform: post.platform,
    })),
    users: [], // Simplified - no user stats for now
  };

  // Get active sessions (if available)
  try {
    const activeSessions = dbManager.getActiveSessions ? dbManager.getActiveSessions(5) : [];
    stats.activeSessions = activeSessions;
  } catch (_error) {
    // Sessions methods might not exist
    stats.activeSessions = [];
  }

  // Get basic system health (database file size)
  try {
    // Try to get database path from options or use default
    const dbPath = options.database || 'fscrape.db';
    const stat = fs.statSync(dbPath);
    stats.systemHealth = {
      databaseSize: stat.size,
      tableCount: 0, // Would need to query sqlite_master
    };
    stats.overview.databaseSize = stat.size;
  } catch (_error) {
    stats.systemHealth = {
      databaseSize: 0,
      tableCount: 0,
    };
  }

  // Update total users count from platform stats
  stats.overview.totalUsers = Object.values(stats.platforms).reduce(
    (sum: number, platform) => sum + (platform.userCount || 0),
    0
  );

  return stats;
}

/**
 * Display statistics as JSON
 */
function displayJson(stats: DatabaseStats): void {
  console.log(JSON.stringify(stats, null, 2));
}

/**
 * Display statistics as summary
 */
function displaySummary(stats: DatabaseStats): void {
  console.log(chalk.bold.cyan('\n📊 Database Statistics Summary\n'));

  // Overview
  console.log(chalk.yellow('Overview:'));
  console.log(`  Total Posts: ${stats.overview.totalPosts?.toLocaleString() || 0}`);
  console.log(`  Total Comments: ${stats.overview.totalComments?.toLocaleString() || 0}`);
  console.log(`  Total Users: ${stats.overview.totalUsers?.toLocaleString() || 0}`);
  console.log(`  Database Size: ${formatBytes(stats.overview.databaseSize || 0)}`);
  if (stats.overview.lastActivity) {
    console.log(`  Last Activity: ${new Date(stats.overview.lastActivity).toLocaleString()}`);
  }

  // Active sessions
  if (stats.activeSessions && stats.activeSessions.length > 0) {
    console.log(chalk.yellow('\nActive Sessions:'));
    stats.activeSessions.forEach((session: unknown) => {
      const sess = session as {
        platform: string;
        status: string;
        startedAt: string;
        totalItemsScraped?: number;
      };
      console.log(`  ${chalk.green('●')} ${sess.platform} - ${sess.status}`);
      console.log(`    Started: ${new Date(sess.startedAt).toLocaleString()}`);
      console.log(`    Items scraped: ${sess.totalItemsScraped || 0}`);
    });
  } else {
    console.log(chalk.yellow('\nActive Sessions:'));
    console.log(`  ${chalk.gray('No active sessions')}`);
  }

  // System health
  if (stats.systemHealth && Object.keys(stats.systemHealth).length > 0) {
    console.log(chalk.yellow('\nSystem Health:'));
    console.log(`  Tables: ${stats.systemHealth.tableCount || 0}`);
    console.log(`  Indexes: ${stats.systemHealth.indexCount || 0}`);
    if (stats.systemHealth.cacheHitRate !== undefined) {
      console.log(`  Cache Hit Rate: ${(stats.systemHealth.cacheHitRate * 100).toFixed(1)}%`);
    }
    if (stats.systemHealth.fragmentation !== undefined) {
      const fragColor =
        stats.systemHealth.fragmentation > 30
          ? chalk.red
          : stats.systemHealth.fragmentation > 10
            ? chalk.yellow
            : chalk.green;
      console.log(
        `  Fragmentation: ${fragColor(stats.systemHealth.fragmentation.toFixed(1) + '%')}`
      );
    }
  }

  // Platform breakdown
  if (Object.keys(stats.platforms).length > 0) {
    console.log(chalk.yellow('\nPlatform Breakdown:'));
    for (const [platform, platformStats] of Object.entries(stats.platforms)) {
      const pStats = platformStats;
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
    console.log(chalk.yellow('\nRecent Activity:'));
    const recentPosts = stats.recent.posts.data.reduce((sum: number, day) => sum + day.count, 0);
    const recentComments =
      stats.recent.comments?.data?.reduce((sum: number, day) => sum + day.count, 0) || 0;
    console.log(
      `  Posts (last ${stats.recent.posts.data.length} days): ${recentPosts.toLocaleString()}`
    );
    console.log(
      `  Comments (last ${stats.recent.comments?.data?.length || 0} days): ${recentComments.toLocaleString()}`
    );
  }

  // Top content
  if (stats.topContent && stats.topContent.posts && stats.topContent.posts.length > 0) {
    console.log(chalk.yellow('\nTop Posts:'));
    stats.topContent.posts.forEach((post, index: number) => {
      console.log(`  ${index + 1}. ${truncateString(post.title, 50)}`);
      console.log(`     Score: ${post.score} | Comments: ${post.commentCount}`);
    });
  }
}

/**
 * Display statistics as table
 */
function displayTable(stats: DatabaseStats, verbose: boolean): void {
  console.log(chalk.bold.cyan('\n📊 Database Statistics\n'));

  // Overview table
  const overviewTable = new Table({
    head: [chalk.yellow('Metric'), chalk.yellow('Value')],
    colWidths: [25, 35],
  });

  overviewTable.push(
    ['Total Posts', stats.overview.totalPosts?.toLocaleString() || '0'],
    ['Total Comments', stats.overview.totalComments?.toLocaleString() || '0'],
    ['Total Users', stats.overview.totalUsers?.toLocaleString() || '0'],
    ['Database Size', formatBytes(stats.overview.databaseSize || 0)],
    [
      'Last Activity',
      stats.overview.lastActivity ? new Date(stats.overview.lastActivity).toLocaleString() : 'N/A',
    ]
  );

  // Add system health metrics
  if (stats.systemHealth && stats.systemHealth.cacheHitRate !== undefined) {
    overviewTable.push([
      'Cache Hit Rate',
      `${(stats.systemHealth.cacheHitRate * 100).toFixed(1)}%`,
    ]);
  }
  if (stats.systemHealth && stats.systemHealth.fragmentation !== undefined) {
    const fragColor =
      stats.systemHealth.fragmentation > 30
        ? chalk.red
        : stats.systemHealth.fragmentation > 10
          ? chalk.yellow
          : chalk.green;
    overviewTable.push([
      'DB Fragmentation',
      fragColor(`${stats.systemHealth.fragmentation.toFixed(1)}%`),
    ]);
  }

  console.log(overviewTable.toString());

  // Platform stats table
  if (Object.keys(stats.platforms).length > 0) {
    const platformTable = new Table({
      head: [
        chalk.yellow('Platform'),
        chalk.yellow('Posts'),
        chalk.yellow('Comments'),
        chalk.yellow('Users'),
        chalk.yellow('Avg Score'),
      ],
      colWidths: [15, 12, 12, 12, 12],
    });

    for (const [platform, platformStats] of Object.entries(stats.platforms)) {
      const pStats = platformStats;
      platformTable.push([
        platform,
        pStats.postCount.toLocaleString(),
        pStats.commentCount.toLocaleString(),
        pStats.userCount.toLocaleString(),
        pStats.avgScore?.toFixed(1) || 'N/A',
      ]);
    }

    console.log(chalk.bold.cyan('\nPlatform Statistics'));
    console.log(platformTable.toString());
  }

  // Active sessions table
  if (stats.activeSessions && stats.activeSessions.length > 0) {
    const sessionsTable = new Table({
      head: [
        chalk.yellow('Platform'),
        chalk.yellow('Status'),
        chalk.yellow('Started'),
        chalk.yellow('Items'),
        chalk.yellow('Errors'),
      ],
      colWidths: [12, 10, 20, 10, 8],
    });

    stats.activeSessions.forEach((session: unknown) => {
      const sess = session as {
        platform: string;
        status: string;
        startedAt: string;
        totalItemsScraped?: number;
        errorCount?: number;
      };
      const statusColor =
        sess.status === 'running'
          ? chalk.green
          : sess.status === 'pending'
            ? chalk.yellow
            : sess.status === 'failed'
              ? chalk.red
              : chalk.gray;
      sessionsTable.push([
        sess.platform,
        statusColor(sess.status),
        new Date(sess.startedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        sess.totalItemsScraped?.toString() || '0',
        sess.errorCount?.toString() || '0',
      ]);
    });

    console.log(chalk.bold.cyan('\nActive Sessions'));
    console.log(sessionsTable.toString());
  }

  // Recent activity chart (simple ASCII)
  if (verbose && stats.recent.posts && stats.recent.posts.data) {
    console.log(chalk.bold.cyan('\nRecent Activity (Posts)'));
    displayMiniChart(stats.recent.posts.data);
  }

  // Top posts table
  if (stats.topContent && stats.topContent.posts && stats.topContent.posts.length > 0) {
    const topPostsTable = new Table({
      head: [
        chalk.yellow('#'),
        chalk.yellow('Title'),
        chalk.yellow('Score'),
        chalk.yellow('Comments'),
      ],
      colWidths: [5, 45, 10, 12],
    });

    stats.topContent.posts.forEach((post, index: number) => {
      topPostsTable.push([
        (index + 1).toString(),
        truncateString(post.title, 40),
        post.score.toString(),
        post.commentCount.toString(),
      ]);
    });

    console.log(chalk.bold.cyan('\nTop Posts'));
    console.log(topPostsTable.toString());
  }

  // Top users table
  if (verbose && stats.topContent && stats.topContent.users && stats.topContent.users.length > 0) {
    const topUsersTable = new Table({
      head: [
        chalk.yellow('#'),
        chalk.yellow('Username'),
        chalk.yellow('Posts'),
        chalk.yellow('Comments'),
        chalk.yellow('Karma'),
      ],
      colWidths: [5, 20, 10, 12, 12],
    });

    stats.topContent.users.forEach((user: unknown, index: number) => {
      const u = user as {
        username: string;
        postCount: number;
        commentCount: number;
        karma?: number;
      };
      topUsersTable.push([
        (index + 1).toString(),
        truncateString(u.username, 18),
        u.postCount.toString(),
        u.commentCount.toString(),
        u.karma?.toString() || 'N/A',
      ]);
    });

    console.log(chalk.bold.cyan('\nTop Users'));
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
    const bar = '█'.repeat(barLength);
    const date = new Date(day.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    console.log(`  ${date.padEnd(10)} ${bar} ${day.count}`);
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate string with ellipsis
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
