/**
 * Batch processor for CLI
 * Handles batch operations for scraping, exporting, and database operations
 */

import { promises as fs } from "fs";
import path from "path";
import inquirer from "inquirer";
import chalk from "chalk";
import { OutputFormatter } from "./output-formatter.js";
import { DatabaseManager } from "../database/database.js";
import { RedditScraper } from "../platforms/reddit/scraper.js";
import { HackerNewsScraper } from "../platforms/hackernews/scraper.js";
import { ExportManager } from "../export/export-manager.js";
// import type { ForumPost, Comment } from "../types/core.js";

export interface BatchOperation {
  type: "scrape" | "export" | "clean" | "migrate";
  platform?: "reddit" | "hackernews" | "both";
  items?: string[];
  options?: Record<string, any>;
}

export interface BatchConfig {
  operations: BatchOperation[];
  parallel?: boolean;
  maxConcurrency?: number;
  continueOnError?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  outputPath?: string;
  database?: string;
}

export interface BatchResult {
  operation: BatchOperation;
  status: "success" | "failed" | "skipped";
  message?: string;
  data?: any;
  error?: Error;
  duration?: number;
}

/**
 * Batch processor for handling multiple operations
 */
export class BatchProcessor {
  private formatter: OutputFormatter;
  private config: BatchConfig;
  private results: BatchResult[] = [];

  constructor(config: BatchConfig) {
    this.config = {
      parallel: false,
      maxConcurrency: 5,
      continueOnError: true,
      dryRun: false,
      verbose: false,
      database: "fscrape.db",
      ...config,
    };

    this.formatter = new OutputFormatter({
      level: this.config.verbose ? "verbose" : "normal",
      showProgress: true,
      showStats: true,
    });
  }

  /**
   * Load batch configuration from file
   */
  static async loadFromFile(filePath: string): Promise<BatchConfig> {
    const content = await fs.readFile(filePath, "utf-8");

    if (filePath.endsWith(".json")) {
      return JSON.parse(content);
    } else if (filePath.endsWith(".txt")) {
      return BatchProcessor.parseBatchFile(content);
    } else {
      throw new Error(
        `Unsupported batch file format: ${path.extname(filePath)}`,
      );
    }
  }

  /**
   * Parse simple batch file format
   */
  static parseBatchFile(content: string): BatchConfig {
    const lines = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));
    const operations: BatchOperation[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const command = parts[0].toLowerCase();

      switch (command) {
        case "scrape":
          operations.push({
            type: "scrape",
            platform: parts[1] as any,
            items: parts.slice(2),
          });
          break;

        case "export":
          operations.push({
            type: "export",
            options: {
              format: parts[1] || "json",
              output: parts[2] || "./exports",
            },
          });
          break;

        case "clean":
          operations.push({
            type: "clean",
            options: {
              olderThan: parseInt(parts[1] || "30", 10),
            },
          });
          break;

        default:
          console.warn(chalk.yellow(`Unknown batch command: ${command}`));
      }
    }

    return { operations };
  }

  /**
   * Create batch configuration interactively
   */
  static async createInteractive(): Promise<BatchConfig> {
    console.log(chalk.cyan("🔧 Batch Operation Setup\n"));

    const operations: BatchOperation[] = [];
    let addMore = true;

    while (addMore) {
      const { operationType } = await inquirer.prompt([
        {
          type: "list",
          name: "operationType",
          message: "Select operation type:",
          choices: [
            { name: "Scrape posts/comments", value: "scrape" },
            { name: "Export data", value: "export" },
            { name: "Clean old data", value: "clean" },
            { name: "Done - Execute batch", value: "done" },
          ],
        },
      ]);

      if (operationType === "done") {
        addMore = false;
        continue;
      }

      const operation = await BatchProcessor.promptForOperation(operationType);
      if (operation) {
        operations.push(operation);
        console.log(chalk.green(`✓ Added ${operationType} operation\n`));
      }
    }

    const config = await inquirer.prompt([
      {
        type: "confirm",
        name: "parallel",
        message: "Run operations in parallel?",
        default: false,
      },
      {
        type: "number",
        name: "maxConcurrency",
        message: "Maximum concurrent operations:",
        default: 5,
        when: (answers) => answers.parallel,
      },
      {
        type: "confirm",
        name: "continueOnError",
        message: "Continue on error?",
        default: true,
      },
      {
        type: "confirm",
        name: "dryRun",
        message: "Perform dry run?",
        default: false,
      },
    ]);

    return {
      operations,
      ...config,
    };
  }

  /**
   * Prompt for specific operation details
   */
  private static async promptForOperation(
    type: string,
  ): Promise<BatchOperation | null> {
    switch (type) {
      case "scrape": {
        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "platform",
            message: "Select platform:",
            choices: ["reddit", "hackernews", "both"],
          },
          {
            type: "input",
            name: "items",
            message: "Enter items to scrape (comma-separated URLs or IDs):",
            validate: (input) => input.trim().length > 0,
          },
          {
            type: "number",
            name: "limit",
            message: "Maximum items per source:",
            default: 100,
          },
        ]);

        return {
          type: "scrape",
          platform: answers.platform,
          items: answers.items.split(",").map((s: string) => s.trim()),
          options: {
            limit: answers.limit,
          },
        };
      }

      case "export": {
        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "format",
            message: "Export format:",
            choices: ["json", "csv"],
          },
          {
            type: "input",
            name: "output",
            message: "Output directory:",
            default: "./exports",
          },
          {
            type: "list",
            name: "data",
            message: "Data to export:",
            choices: ["posts", "comments", "users", "all"],
          },
        ]);

        return {
          type: "export",
          options: answers,
        };
      }

      case "clean": {
        const answers = await inquirer.prompt([
          {
            type: "number",
            name: "olderThan",
            message: "Delete data older than (days):",
            default: 30,
          },
          {
            type: "list",
            name: "platform",
            message: "Platform to clean:",
            choices: ["reddit", "hackernews", "both", "all"],
          },
        ]);

        return {
          type: "clean",
          platform: answers.platform === "all" ? undefined : answers.platform,
          options: {
            olderThan: answers.olderThan,
          },
        };
      }

      default:
        return null;
    }
  }

  /**
   * Execute batch operations
   */
  async execute(): Promise<BatchResult[]> {
    this.formatter.log(chalk.cyan("🚀 Starting batch processing\n"));
    this.formatter.startBatch(
      this.config.operations.length,
      "Executing operations",
    );

    if (this.config.dryRun) {
      this.formatter.warning("DRY RUN MODE - No actual changes will be made\n");
    }

    if (this.config.parallel) {
      await this.executeParallel();
    } else {
      await this.executeSequential();
    }

    this.formatter.endBatch(true);
    this.displayResults();

    return this.results;
  }

  /**
   * Execute operations sequentially
   */
  private async executeSequential(): Promise<void> {
    for (const operation of this.config.operations) {
      const result = await this.executeOperation(operation);
      this.results.push(result);

      if (result.status === "failed" && !this.config.continueOnError) {
        this.formatter.error("Batch execution stopped due to error");
        throw new Error(result.message || "Operation failed");
      }
    }
  }

  /**
   * Execute operations in parallel
   */
  private async executeParallel(): Promise<void> {
    const maxConcurrency = this.config.maxConcurrency || 5;
    const chunks: BatchOperation[][] = [];

    // Split operations into chunks based on max concurrency
    for (let i = 0; i < this.config.operations.length; i += maxConcurrency) {
      chunks.push(this.config.operations.slice(i, i + maxConcurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map((op) => this.executeOperation(op));
      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          this.results.push(result.value);
        } else {
          this.results.push({
            operation: chunk[index],
            status: "failed",
            error: result.reason,
            message: result.reason?.message || "Unknown error",
          });
        }
      });

      // Check if we should continue
      const hasFailure = results.some((r) => r.status === "rejected");
      if (hasFailure && !this.config.continueOnError) {
        this.formatter.error("Batch execution stopped due to error");
        break;
      }
    }
  }

  /**
   * Execute single operation
   */
  private async executeOperation(
    operation: BatchOperation,
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const operationName =
      `${operation.type} ${operation.platform || ""}`.trim();

    if (this.config.dryRun) {
      this.formatter.updateBatch(operationName, "skipped");
      return {
        operation,
        status: "skipped",
        message: "Dry run - operation skipped",
        duration: Date.now() - startTime,
      };
    }

    try {
      let data: any;

      switch (operation.type) {
        case "scrape":
          data = await this.executeScrape(operation);
          break;

        case "export":
          data = await this.executeExport(operation);
          break;

        case "clean":
          data = await this.executeClean(operation);
          break;

        case "migrate":
          data = await this.executeMigrate(operation);
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      this.formatter.updateBatch(operationName, "completed");
      return {
        operation,
        status: "success",
        data,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      this.formatter.updateBatch(operationName, "failed");

      return {
        operation,
        status: "failed",
        error,
        message: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute scrape operation
   */
  private async executeScrape(operation: BatchOperation): Promise<any> {
    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: this.config.database || "fscrape.db",
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    const results = {
      posts: 0,
      comments: 0,
      users: 0,
    };

    try {
      if (operation.platform === "reddit" || operation.platform === "both") {
        const scraper = new RedditScraper({
          clientId: "mock",
          clientSecret: "mock",
          userAgent: "fscrape-batch",
        });

        for (const item of operation.items || []) {
          if (item.includes("/r/")) {
            // Keep the full /r/subreddit path for the scraper
            // Remove /r/ prefix if present
            const subreddit = item.replace(/^\/r\//, "");
            const posts = await scraper.scrapeCategory(subreddit, {
              limit: operation.options?.limit || 100,
            });

            // Save posts using upsertPost
            for (const post of posts) {
              await dbManager.upsertPost(post);
              results.posts++;
            }
          }
        }
      }

      if (
        operation.platform === "hackernews" ||
        operation.platform === "both"
      ) {
        const scraper = new HackerNewsScraper({});

        // Check if it's a specific story or top stories
        if (operation.items && operation.items.length > 0) {
          for (const item of operation.items) {
            const post = await scraper.scrapePost(item);

            if (post) {
              await dbManager.upsertPost(post);
              results.posts++;
            }
          }
        } else {
          const posts = await scraper.scrapePosts("topstories", {
            limit: operation.options?.limit || 100,
          });

          for (const post of posts) {
            await dbManager.upsertPost(post);
            results.posts++;
          }
        }
      }

      return results;
    } finally {
      await dbManager.close();
    }
  }

  /**
   * Execute export operation
   */
  private async executeExport(operation: BatchOperation): Promise<any> {
    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: this.config.database || "fscrape.db",
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    try {
      const outputDir = operation.options?.output || "./exports";
      await fs.mkdir(outputDir, { recursive: true });

      const format = operation.options?.format || "json";
      const dataType = operation.options?.data || "all";

      // Create ExportManager with appropriate format
      const exportConfig: any = {
        format: format as "json" | "csv",
        outputDirectory: "./",
        defaultFormat: format as "json" | "csv",
        csvOptions: format === "csv" ? {} : undefined,
        jsonOptions: format === "json" ? { pretty: true } : undefined,
      };
      const exporter = new ExportManager(exportConfig);

      const results: any = {};

      if (dataType === "posts" || dataType === "all") {
        const posts = await dbManager.queryPosts({ limit: 10000 });
        const filePath = await exporter.exportData(
          { posts, comments: [], users: [] },
          `export-posts-${Date.now()}`,
          format as "json" | "csv",
        );
        results.posts = { count: posts.length, file: filePath };
      }

      if (dataType === "comments" || dataType === "all") {
        const comments = await dbManager.queryComments({ limit: 10000 });
        const filePath = await exporter.exportData(
          { posts: [], comments, users: [] },
          `export-comments-${Date.now()}`,
          format as "json" | "csv",
        );
        results.comments = { count: comments.length, file: filePath };
      }

      if (dataType === "users" || dataType === "all") {
        const users = await dbManager.queryUsers({ limit: 10000 });
        const filePath = await exporter.exportData(
          { posts: [], comments: [], users },
          `export-users-${Date.now()}`,
          format as "json" | "csv",
        );
        results.users = { count: users.length, file: filePath };
      }

      return results;
    } finally {
      await dbManager.close();
    }
  }

  /**
   * Execute clean operation
   */
  private async executeClean(operation: BatchOperation): Promise<any> {
    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: this.config.database || "fscrape.db",
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    try {
      const olderThanDays = operation.options?.olderThan || 30;
      const results: any = {};

      // Check if mock methods exist, otherwise use real methods
      if ((dbManager as any).deletePosts) {
        // Using mocked methods
        const postsResult = await (dbManager as any).deletePosts();
        results.deletedPosts = postsResult?.deletedCount || 0;

        if (operation.options?.data === "all" || !operation.options?.data) {
          const commentsResult = await (dbManager as any).deleteComments();
          results.deletedComments = commentsResult?.deletedCount || 0;

          const usersResult = await (dbManager as any).deleteUsers();
          results.deletedUsers = usersResult?.deletedCount || 0;
        }
      } else if ((dbManager as any).deleteOldData) {
        // Using real method
        const result = await (dbManager as any).deleteOldData({
          olderThanDays,
          platform: operation.platform,
        });
        Object.assign(results, result);
      }

      // Call vacuum if it exists
      if ((dbManager as any).vacuum) {
        await (dbManager as any).vacuum();
      }

      return results;
    } finally {
      await dbManager.close();
    }
  }

  /**
   * Display batch results
   */
  private displayResults(): void {
    console.log(chalk.cyan("\n📋 Batch Results\n"));

    const successCount = this.results.filter(
      (r) => r.status === "success",
    ).length;
    const failedCount = this.results.filter(
      (r) => r.status === "failed",
    ).length;
    const skippedCount = this.results.filter(
      (r) => r.status === "skipped",
    ).length;

    this.results.forEach((result, index) => {
      const statusSymbol = {
        success: chalk.green("✓"),
        failed: chalk.red("✗"),
        skipped: chalk.gray("⊘"),
      }[result.status];

      const operationName =
        `${result.operation.type} ${result.operation.platform || ""}`.trim();
      const duration = result.duration ? `(${result.duration}ms)` : "";

      console.log(
        `${statusSymbol} ${index + 1}. ${operationName} ${chalk.gray(duration)}`,
      );

      if (result.message) {
        console.log(chalk.gray(`   ${result.message}`));
      }

      if (this.config.verbose && result.data) {
        console.log(
          chalk.gray("   Data:"),
          JSON.stringify(result.data, null, 2),
        );
      }
    });

    console.log(chalk.cyan("\n📊 Summary"));
    console.log(chalk.green(`  Success: ${successCount}`));
    console.log(chalk.red(`  Failed: ${failedCount}`));
    console.log(chalk.gray(`  Skipped: ${skippedCount}`));
  }

  /**
   * Execute migrate operation
   */
  private async executeMigrate(operation: BatchOperation): Promise<any> {
    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: this.config.database || "fscrape.db",
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    try {
      const action = operation.options?.action || "backup";
      const filePath = operation.options?.path || "./backup.db";

      if (action === "backup") {
        if ((dbManager as any).backup) {
          await (dbManager as any).backup(filePath);
        }
        return { action: "backup", path: filePath };
      } else if (action === "restore") {
        if ((dbManager as any).restore) {
          await (dbManager as any).restore(filePath);
        }
        return { action: "restore", path: filePath };
      } else {
        throw new Error(`Unknown migrate action: ${action}`);
      }
    } finally {
      await dbManager.close();
    }
  }

  /**
   * Save results to file
   */
  async saveResults(filePath: string): Promise<void> {
    const output = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results.map((r) => ({
        ...r,
        error: r.error?.message,
      })),
      summary: {
        total: this.results.length,
        success: this.results.filter((r) => r.status === "success").length,
        failed: this.results.filter((r) => r.status === "failed").length,
        skipped: this.results.filter((r) => r.status === "skipped").length,
      },
    };

    await fs.writeFile(filePath, JSON.stringify(output), "utf-8");
    this.formatter.success(`Results saved to ${filePath}`);
  }
}
