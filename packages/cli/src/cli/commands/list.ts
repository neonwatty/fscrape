/**
 * List command for CLI
 * Handles listing and querying data from database
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { DatabaseManager } from '../../database/database.js';
import { formatError } from '../validation.js';
import { table } from 'table';

export interface ListCommandOptions {
  database?: string;
  platform?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  author?: string;
  minScore?: number;
  startDate?: string;
  endDate?: string;
  format?: 'table' | 'json' | 'simple';
  verbose?: boolean;
}

/**
 * Create the list command
 */
export function createListCommand(): Command {
  const command = new Command('list');

  command.description('List and query data from database').action(async () => {
    console.log(
      chalk.yellow('Please specify a subcommand: posts, comments, users, stats, or search')
    );
    console.log(chalk.gray('Example: fscrape list posts --platform reddit'));
  });

  // Subcommands for specific data types
  command
    .command('posts')
    .description('List posts from database')
    .option('-d, --database <path>', 'Database file path', 'fscrape.db')
    .option('-p, --platform <platform>', 'Filter by platform')
    .option('-l, --limit <number>', 'Maximum posts to show', parseInt, 10)
    .option('--offset <number>', 'Skip first N posts', parseInt, 0)
    .option('--sort-by <field>', 'Sort by field', 'date')
    .option('--sort-order <order>', 'Sort order', 'desc')
    .option('--author <username>', 'Filter by author')
    .option('--min-score <number>', 'Minimum score', parseInt)
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('-f, --format <format>', 'Output format', 'table')
    .option('-v, --verbose', 'Show full content', false)
    .action(async (options) => {
      await handleList('posts', options);
    });

  command
    .command('comments')
    .description('List comments from database')
    .option('-d, --database <path>', 'Database file path', 'fscrape.db')
    .option('-p, --platform <platform>', 'Filter by platform')
    .option('--post-id <id>', 'Filter by post ID')
    .option('-l, --limit <number>', 'Maximum comments to show', parseInt, 10)
    .option('--offset <number>', 'Skip first N comments', parseInt, 0)
    .option('--author <username>', 'Filter by author')
    .option('--min-score <number>', 'Minimum score', parseInt)
    .option('-f, --format <format>', 'Output format', 'table')
    .option('-v, --verbose', 'Show full content', false)
    .action(async (options) => {
      await handleListComments(options);
    });

  command
    .command('users')
    .description('List users from database')
    .option('-d, --database <path>', 'Database file path', 'fscrape.db')
    .option('-p, --platform <platform>', 'Filter by platform')
    .option('-l, --limit <number>', 'Maximum users to show', parseInt, 10)
    .option('--offset <number>', 'Skip first N users', parseInt, 0)
    .option('--min-karma <number>', 'Minimum karma/score', parseInt)
    .option('--sort-by <field>', 'Sort by field (karma, created)', 'karma')
    .option('--sort-order <order>', 'Sort order', 'desc')
    .option('-f, --format <format>', 'Output format', 'table')
    .action(async (options) => {
      await handleListUsers(options);
    });

  command
    .command('stats')
    .description('Show database statistics')
    .option('-d, --database <path>', 'Database file path', 'fscrape.db')
    .option('-p, --platform <platform>', 'Filter by platform')
    .option('--start-date <date>', 'Start date for stats')
    .option('--end-date <date>', 'End date for stats')
    .action(async (options) => {
      await handleStats(options);
    });

  command
    .command('search <query>')
    .description('Search posts and comments')
    .option('-d, --database <path>', 'Database file path', 'fscrape.db')
    .option('-p, --platform <platform>', 'Filter by platform')
    .option('-l, --limit <number>', 'Maximum results', parseInt, 20)
    .option('--in <fields>', 'Search in fields (title,content,author)', 'title,content')
    .option('-f, --format <format>', 'Output format', 'table')
    .action(async (query: string, options) => {
      await handleSearch(query, options);
    });

  return command;
}

/**
 * Handle list command
 */
async function handleList(type: string, options: ListCommandOptions): Promise<void> {
  try {
    // Connect to database
    const dbManager = new DatabaseManager({
      type: 'sqlite',
      path: options.database || 'fscrape.db',
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    // Build query options
    const queryOptions: any = {
      platform: options.platform,
      limit: options.limit || 10,
      offset: options.offset || 0,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    };

    if (options.author) {
      queryOptions.author = options.author;
    }
    if (options.minScore !== undefined) {
      queryOptions.minScore = options.minScore;
    }
    if (options.startDate) {
      queryOptions.startDate = new Date(options.startDate);
    }
    if (options.endDate) {
      queryOptions.endDate = new Date(options.endDate);
    }

    // Query posts
    const posts = await dbManager.queryPosts(queryOptions);

    if (posts.length === 0) {
      console.log(chalk.yellow('No posts found'));
      return;
    }

    // Sort posts
    if (options.sortBy) {
      posts.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (options.sortBy) {
          case 'score':
            aVal = a.score || 0;
            bVal = b.score || 0;
            break;
          case 'comments':
            aVal = a.commentCount || 0;
            bVal = b.commentCount || 0;
            break;
          case 'date':
          default:
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
            break;
        }
        return options.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    // Display results
    if (options.format === 'json') {
      console.log(JSON.stringify(posts, null, 2));
    } else if (options.format === 'simple') {
      posts.forEach((post, index) => {
        console.log(chalk.cyan(`${index + 1}. ${post.title}`));
        console.log(
          chalk.gray(
            `   Author: ${post.author} | Score: ${post.score} | Comments: ${post.commentCount}`
          )
        );
        console.log(
          chalk.gray(
            `   Platform: ${post.platform} | Date: ${new Date(post.createdAt).toLocaleDateString()}`
          )
        );
        if (options.verbose && post.content) {
          console.log(chalk.gray(`   ${post.content.substring(0, 200)}...`));
        }
        console.log();
      });
    } else {
      // Table format
      const tableData = [['#', 'Title', 'Author', 'Score', 'Comments', 'Platform', 'Date']];

      posts.forEach((post, index) => {
        const title = post.title.length > 50 ? post.title.substring(0, 47) + '...' : post.title;

        tableData.push([
          (index + 1).toString(),
          title,
          post.author,
          post.score?.toString() || '0',
          post.commentCount?.toString() || '0',
          post.platform,
          new Date(post.createdAt).toLocaleDateString(),
        ]);
      });

      console.log(
        table(tableData, {
          header: {
            alignment: 'center',
            content: chalk.cyan('Posts'),
          },
        })
      );
    }

    // Show summary
    if (options.format !== 'json') {
      console.log(chalk.gray(`\nShowing ${posts.length} posts (offset: ${options.offset || 0})`));
    }

    await dbManager.close();
  } catch (error) {
    console.error(chalk.red('❌ List failed:'));
    console.error(chalk.red(`Error: ${formatError(error)}`));
    process.exit(1);
  }
}

/**
 * Handle list comments
 */
async function handleListComments(options: any): Promise<void> {
  try {
    const dbManager = new DatabaseManager({
      type: 'sqlite',
      path: options.database || 'fscrape.db',
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const queryOptions: any = {
      platform: options.platform,
      limit: options.limit || 10,
      offset: options.offset || 0,
    };

    if (options.postId) {
      queryOptions.postIds = [options.postId];
    }
    if (options.author) {
      queryOptions.author = options.author;
    }
    if (options.minScore !== undefined) {
      queryOptions.minScore = options.minScore;
    }

    const comments = await dbManager.queryComments(queryOptions);

    if (comments.length === 0) {
      console.log(chalk.yellow('No comments found'));
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(comments, null, 2));
    } else if (options.format === 'simple') {
      comments.forEach((comment, index) => {
        const content =
          comment.content.length > 200
            ? comment.content.substring(0, 197) + '...'
            : comment.content;

        console.log(chalk.cyan(`${index + 1}. ${comment.author}:`));
        console.log(chalk.gray(`   ${content}`));
        console.log(
          chalk.gray(
            `   Score: ${comment.score} | Platform: ${comment.platform} | Date: ${new Date(comment.createdAt).toLocaleDateString()}`
          )
        );
        console.log();
      });
    } else {
      // Table format
      const tableData = [['#', 'Author', 'Content', 'Score', 'Platform', 'Date']];

      comments.forEach((comment, index) => {
        const content =
          comment.content.length > 40 ? comment.content.substring(0, 37) + '...' : comment.content;

        tableData.push([
          (index + 1).toString(),
          comment.author,
          content,
          comment.score?.toString() || '0',
          comment.platform,
          new Date(comment.createdAt).toLocaleDateString(),
        ]);
      });

      console.log(
        table(tableData, {
          header: {
            alignment: 'center',
            content: chalk.cyan('Comments'),
          },
        })
      );
    }

    if (options.format !== 'json') {
      console.log(chalk.gray(`\nShowing ${comments.length} comments`));
    }

    await dbManager.close();
  } catch (error) {
    console.error(chalk.red('❌ List failed:'));
    console.error(chalk.red(`Error: ${formatError(error)}`));
    process.exit(1);
  }
}

/**
 * Handle list users
 */
async function handleListUsers(options: any): Promise<void> {
  try {
    const dbManager = new DatabaseManager({
      type: 'sqlite',
      path: options.database || 'fscrape.db',
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const queryOptions: any = {
      platform: options.platform,
      limit: options.limit || 10,
      offset: options.offset || 0,
    };

    if (options.minKarma !== undefined) {
      queryOptions.minKarma = options.minKarma;
    }

    const users = await dbManager.queryUsers(queryOptions);

    if (users.length === 0) {
      console.log(chalk.yellow('No users found'));
      return;
    }

    // Sort users
    if (options.sortBy) {
      users.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (options.sortBy) {
          case 'created':
            aVal = new Date(a.createdAt || 0).getTime();
            bVal = new Date(b.createdAt || 0).getTime();
            break;
          case 'karma':
          default:
            aVal = a.karma || 0;
            bVal = b.karma || 0;
            break;
        }
        return options.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(users, null, 2));
    } else {
      // Table format
      const tableData = [['#', 'Username', 'Karma', 'Platform', 'Created']];

      users.forEach((user, index) => {
        tableData.push([
          (index + 1).toString(),
          user.username,
          user.karma?.toString() || '0',
          user.platform,
          user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
        ]);
      });

      console.log(
        table(tableData, {
          header: {
            alignment: 'center',
            content: chalk.cyan('Users'),
          },
        })
      );
    }

    if (options.format !== 'json') {
      console.log(chalk.gray(`\nShowing ${users.length} users`));
    }

    await dbManager.close();
  } catch (error) {
    console.error(chalk.red('❌ List failed:'));
    console.error(chalk.red(`Error: ${formatError(error)}`));
    process.exit(1);
  }
}

/**
 * Handle stats command
 */
async function handleStats(options: any): Promise<void> {
  try {
    const dbManager = new DatabaseManager({
      type: 'sqlite',
      path: options.database || 'fscrape.db',
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const stats = await dbManager.getStatistics({
      platform: options.platform,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
    });

    console.log(chalk.cyan('\n📊 Database Statistics\n'));

    const statsTable = [
      ['Metric', 'Count'],
      ['Total Posts', stats.totalPosts.toString()],
      ['Total Comments', stats.totalComments.toString()],
      ['Total Users', stats.totalUsers.toString()],
    ];

    console.log(table(statsTable));

    if (stats.platformBreakdown && Object.keys(stats.platformBreakdown).length > 0) {
      console.log(chalk.cyan('\n📈 Platform Breakdown\n'));
      const platformTable = [['Platform', 'Posts', 'Comments', 'Users']];

      Object.entries(stats.platformBreakdown).forEach(([platform, data]: [string, any]) => {
        platformTable.push([
          platform,
          data.posts?.toString() || '0',
          data.comments?.toString() || '0',
          data.users?.toString() || '0',
        ]);
      });

      console.log(table(platformTable));
    }

    // Date range information removed as part of analytics simplification

    await dbManager.close();
  } catch (error) {
    console.error(chalk.red('❌ Stats failed:'));
    console.error(chalk.red(`Error: ${formatError(error)}`));
    process.exit(1);
  }
}

/**
 * Handle search command
 */
async function handleSearch(query: string, options: any): Promise<void> {
  try {
    const dbManager = new DatabaseManager({
      type: 'sqlite',
      path: options.database || 'fscrape.db',
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    console.log(chalk.cyan(`🔍 Searching for: "${query}"\n`));

    // Search in specified fields
    const searchFields = options.in ? options.in.split(',') : ['title', 'content'];
    const searchOptions: any = {
      query,
      fields: searchFields,
      platform: options.platform,
      limit: options.limit || 20,
    };

    // Search content
    const searchResults = await dbManager.searchContent(searchOptions);
    const posts = searchResults.posts || [];
    const comments = searchResults.comments || [];

    if (posts.length === 0 && comments.length === 0) {
      console.log(chalk.yellow('No results found'));
      return;
    }

    // Display posts
    if (posts.length > 0) {
      console.log(chalk.cyan(`📝 Posts (${posts.length} results):\n`));

      if (options.format === 'json') {
        console.log(JSON.stringify(posts, null, 2));
      } else {
        posts.forEach((post, index) => {
          console.log(chalk.yellow(`${index + 1}. ${post.title}`));
          console.log(chalk.gray(`   Author: ${post.author} | Platform: ${post.platform}`));

          // Highlight matching text
          if (post.content) {
            const excerpt = post.content.substring(0, 150);
            const highlighted = excerpt.replace(new RegExp(query, 'gi'), (match: string) =>
              chalk.bgYellow.black(match)
            );
            console.log(chalk.gray(`   ${highlighted}...`));
          }
          console.log();
        });
      }
    }

    // Display comments
    if (comments.length > 0) {
      console.log(chalk.cyan(`💬 Comments (${comments.length} results):\n`));

      if (options.format === 'json') {
        console.log(JSON.stringify(comments, null, 2));
      } else {
        comments.forEach((comment, index) => {
          const excerpt = comment.content.substring(0, 150);
          const highlighted = excerpt.replace(new RegExp(query, 'gi'), (match: string) =>
            chalk.bgYellow.black(match)
          );

          console.log(chalk.yellow(`${index + 1}. ${comment.author}:`));
          console.log(chalk.gray(`   ${highlighted}...`));
          console.log(chalk.gray(`   Platform: ${comment.platform}`));
          console.log();
        });
      }
    }

    console.log(chalk.gray(`\nTotal results: ${posts.length + comments.length}`));

    await dbManager.close();
  } catch (error) {
    console.error(chalk.red('❌ Search failed:'));
    console.error(chalk.red(`Error: ${formatError(error)}`));
    process.exit(1);
  }
}
