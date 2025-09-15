/**
 * Export command for CLI
 * Handles data export from database to various formats
 */

import { Command } from "commander";
import chalk from "chalk";
import { DatabaseManager } from "../../database/database.js";
import { ExportManager } from "../../export/export-manager.js";
import type { FilterOptions } from "../../export/filters.js";
import type { TransformOptions } from "../../export/transformers.js";
import { formatError } from "../validation.js";
import { dirname, extname } from "path";
import { existsSync, mkdirSync } from "fs";

export interface ExportCommandOptions {
  database?: string;
  format?: string;
  output?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  includeComments?: boolean;
  includeUsers?: boolean;
  minScore?: number;
  author?: string;
  query?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  groupBy?: string;
  aggregate?: boolean;
  pretty?: boolean;
  overwrite?: boolean;
}

/**
 * Create the export command
 */
export function createExportCommand(): Command {
  const command = new Command("export");

  command
    .description("Export data from database in various formats")
    .option("-d, --database <path>", "Database file path", "fscrape.db")
    .option(
      "-f, --format <format>",
      "Export format (json, csv, markdown, html)",
      "json",
    )
    .option("-o, --output <path>", "Output file path")
    .option(
      "-p, --platform <platform>",
      "Filter by platform (reddit, hackernews)",
    )
    .option("--start-date <date>", "Start date for export (YYYY-MM-DD)")
    .option("--end-date <date>", "End date for export (YYYY-MM-DD)")
    .option("-l, --limit <number>", "Maximum items to export", parseInt)
    .option("--include-comments", "Include comments in export")
    .option("--include-users", "Include user data in export")
    .option("--min-score <number>", "Minimum score filter", parseInt)
    .option("--author <username>", "Filter by author username")
    .option("-q, --query <text>", "Search query for title/content")
    .option(
      "--sort-by <field>",
      "Sort by field (date, score, comments)",
      "date",
    )
    .option("--sort-order <order>", "Sort order (asc, desc)", "desc")
    .option(
      "--group-by <field>",
      "Group results by field (platform, author, date)",
    )
    .option("--aggregate", "Include aggregated statistics")
    .option("--pretty", "Pretty print JSON output", false)
    .option("--overwrite", "Overwrite existing output file", false)
    .action(async (options: ExportCommandOptions) => {
      await handleExport(options);
    });

  // Add subcommands for specific export types
  command
    .command("posts")
    .description("Export only posts")
    .option("-d, --database <path>", "Database file path", "fscrape.db")
    .option("-f, --format <format>", "Export format", "json")
    .option("-o, --output <path>", "Output file path")
    .option("-p, --platform <platform>", "Filter by platform")
    .option("--limit <number>", "Maximum posts to export", parseInt)
    .action(async (options) => {
      await handleExport({
        ...options,
        includeComments: false,
        includeUsers: false,
      });
    });

  command
    .command("comments")
    .description("Export only comments")
    .option("-d, --database <path>", "Database file path", "fscrape.db")
    .option("-f, --format <format>", "Export format", "json")
    .option("-o, --output <path>", "Output file path")
    .option("-p, --platform <platform>", "Filter by platform")
    .option("--post-id <id>", "Filter by post ID")
    .option("--limit <number>", "Maximum comments to export", parseInt)
    .action(async (options) => {
      await handleExportComments(options);
    });

  command
    .command("users")
    .description("Export user data")
    .option("-d, --database <path>", "Database file path", "fscrape.db")
    .option("-f, --format <format>", "Export format", "json")
    .option("-o, --output <path>", "Output file path")
    .option("-p, --platform <platform>", "Filter by platform")
    .option("--min-karma <number>", "Minimum karma/score", parseInt)
    .option("--limit <number>", "Maximum users to export", parseInt)
    .action(async (options) => {
      await handleExportUsers(options);
    });

  return command;
}

/**
 * Handle the main export command
 */
async function handleExport(options: ExportCommandOptions): Promise<void> {
  try {
    console.log(chalk.cyan("📦 Exporting data..."));

    // Validate format
    const validFormats = ["json", "csv", "markdown", "html"];
    if (options.format && !validFormats.includes(options.format)) {
      throw new Error(
        `Invalid format: ${options.format}. Valid formats: ${validFormats.join(", ")}`,
      );
    }

    // Connect to database
    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: options.database || "fscrape.db",
      connectionPoolSize: 5,
    });
    // Don't initialize if database already exists - just connect
    // await dbManager.initialize();

    // Build query options
    const queryOptions: any = {
      platform: options.platform,
      limit: options.limit,
    };

    // Add date filters
    if (options.startDate) {
      queryOptions.startDate = new Date(options.startDate);
    }
    if (options.endDate) {
      queryOptions.endDate = new Date(options.endDate);
    }

    // Query posts
    console.log(chalk.gray("  Querying posts..."));
    const posts = dbManager.queryPosts(queryOptions);

    if (posts.length === 0) {
      console.log(chalk.yellow("⚠️  No posts found matching criteria"));
      return;
    }

    // Query comments if requested
    let comments: any[] = [];
    if (options.includeComments && posts.length > 0) {
      console.log(chalk.gray("  Querying comments..."));
      const postIds = posts.map((p) => p.id);
      comments = dbManager.queryComments({
        postIds: postIds.slice(0, 1000), // Limit for performance
      });
    }

    // Query users if requested
    let users: any[] = [];
    if (options.includeUsers) {
      console.log(chalk.gray("  Querying users..."));
      const userIds = new Set<string>();
      posts.forEach((p) => {
        if (p.authorId) userIds.add(p.authorId);
      });
      comments.forEach((c) => {
        if (c.authorId) userIds.add(c.authorId);
      });

      if (userIds.size > 0) {
        users = dbManager.queryUsers({
          limit: 1000,
        });
      }
    }

    // Build filter options
    const filterOptions: FilterOptions = {};
    if (options.minScore !== undefined) {
      filterOptions.minScore = options.minScore;
    }
    if (options.author) {
      filterOptions.authors = [options.author];
    }
    if (options.query) {
      filterOptions.searchTerms = [options.query];
    }

    // Build transform options
    const transformOptions: TransformOptions = {
      addTimestamps: true,
      addStatistics: true,
    };

    // Determine output path
    let outputPath = options.output;
    if (!outputPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      outputPath = `export-${timestamp}`;
    }

    // Add extension if not present
    if (!extname(outputPath)) {
      const extensions: Record<string, string> = {
        json: ".json",
        csv: ".csv",
        markdown: ".md",
        html: ".html",
      };
      outputPath += extensions[options.format || "json"];
    }

    // Check if file exists
    if (existsSync(outputPath) && !options.overwrite) {
      throw new Error(
        `Output file already exists: ${outputPath}. Use --overwrite to replace.`,
      );
    }

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Create export manager
    const exportManager = new ExportManager({
      outputDirectory: outputDir,
      defaultFormat: options.format || "json",
      includeMetadata: true,
      filterOptions,
      transformOptions,
      jsonOptions: {
        pretty: options.pretty,
      },
    });

    // Prepare data
    const exportData = {
      posts,
      comments: comments.length > 0 ? comments : undefined,
      users: users.length > 0 ? users : undefined,
      metadata: {
        scrapedAt: new Date(),
        totalPosts: posts.length,
        totalComments: comments.length,
        totalUsers: users.length,
        platform: (options.platform as any) || "reddit",
        query: queryOptions,
      },
    };

    // Export data
    console.log(
      chalk.gray(`  Exporting to ${options.format || "json"} format...`),
    );
    const resultPath = await exportManager.exportData(
      exportData,
      options.format || "json",
      outputPath,
    );

    // Success message
    console.log(chalk.green(`✅ Export complete!`));
    console.log(chalk.cyan(`   Output: ${resultPath}`));
    console.log(chalk.gray(`   Posts: ${posts.length}`));
    if (comments.length > 0) {
      console.log(chalk.gray(`   Comments: ${comments.length}`));
    }
    if (users.length > 0) {
      console.log(chalk.gray(`   Users: ${users.length}`));
    }

    // Show file size
    const { statSync } = await import("fs");
    const stats = statSync(resultPath as string);
    const sizeInKB = (stats.size / 1024).toFixed(2);
    console.log(chalk.gray(`   File size: ${sizeInKB} KB`));
  } catch (error) {
    console.error(chalk.red("❌ Export failed:"));
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle export comments subcommand
 */
async function handleExportComments(options: any): Promise<void> {
  try {
    console.log(chalk.cyan("📦 Exporting comments..."));

    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: options.database || "fscrape.db",
      connectionPoolSize: 5,
    });
    // Don't initialize if database already exists - just connect
    // await dbManager.initialize();

    // Query comments
    const queryOptions: any = {
      platform: options.platform,
      limit: options.limit,
    };

    if (options.postId) {
      queryOptions.postIds = [options.postId];
    }

    const comments = dbManager.queryComments(queryOptions);

    if (comments.length === 0) {
      console.log(chalk.yellow("⚠️  No comments found"));
      return;
    }

    // Determine output path
    let outputPath = options.output || `comments-export`;
    if (!extname(outputPath)) {
      outputPath += options.format === "csv" ? ".csv" : ".json";
    }

    // Export
    const exportManager = new ExportManager({
      outputDirectory: dirname(outputPath),
      defaultFormat: options.format || "json",
    });

    const resultPath = await exportManager.exportData(
      {
        posts: [],
        comments,
        users: [],
        metadata: {
          platform: (options.platform as any) || "reddit",
          totalPosts: 0,
          totalComments: comments.length,
          scrapedAt: new Date()
        }
      },
      options.format || "json",
      outputPath,
    );

    console.log(
      chalk.green(`✅ Exported ${comments.length} comments to ${resultPath}`),
    );
  } catch (error) {
    console.error(chalk.red("❌ Export failed:"));
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle export users subcommand
 */
async function handleExportUsers(options: any): Promise<void> {
  try {
    console.log(chalk.cyan("📦 Exporting users..."));

    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: options.database || "fscrape.db",
      connectionPoolSize: 5,
    });
    // Don't initialize if database already exists - just connect
    // await dbManager.initialize();

    // Query users
    const queryOptions: any = {
      platform: options.platform,
      limit: options.limit,
    };

    if (options.minKarma) {
      queryOptions.minKarma = options.minKarma;
    }

    const users = dbManager.queryUsers(queryOptions);

    if (users.length === 0) {
      console.log(chalk.yellow("⚠️  No users found"));
      return;
    }

    // Determine output path
    let outputPath = options.output || `users-export`;
    if (!extname(outputPath)) {
      outputPath += options.format === "csv" ? ".csv" : ".json";
    }

    // Export
    const exportManager = new ExportManager({
      outputDirectory: dirname(outputPath),
      defaultFormat: options.format || "json",
    });

    const resultPath = await exportManager.exportData(
      {
        posts: [],
        comments: [],
        users,
        metadata: {
          platform: (options.platform as any) || "reddit",
          totalPosts: 0,
          scrapedAt: new Date()
        }
      },
      options.format || "json",
      outputPath,
    );

    console.log(
      chalk.green(`✅ Exported ${users.length} users to ${resultPath}`),
    );
  } catch (error) {
    console.error(chalk.red("❌ Export failed:"));
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}
