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
import { CsvExporter } from "../export/exporters/csv-exporter.js";
import { JsonExporter } from "../export/exporters/json-exporter.js";
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
        break;
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

    this.formatter.updateBatch(operationName, "completed");

    if (this.config.dryRun) {
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

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

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
          rateLimit: 60,
          maxRetries: 3,
          cacheEnabled: true,
        });

        for (const item of operation.items || []) {
          if (item.includes("/r/")) {
            const subreddit = item.split("/r/")[1].split("/")[0];
            const posts = await scraper.scrapeSubreddit(subreddit, {
              sortBy: "hot",
              limit: operation.options?.limit || 100,
            });

            for (const post of posts) {
              await dbManager.insertPost(post);
              results.posts++;
            }
          }
        }
      }

      if (
        operation.platform === "hackernews" ||
        operation.platform === "both"
      ) {
        const scraper = new HackerNewsScraper({
          rateLimit: 30,
          maxRetries: 3,
          cacheEnabled: true,
        });

        const posts = await scraper.scrapeTopStories(
          operation.options?.limit || 100,
        );

        for (const post of posts) {
          await dbManager.insertPost(post);
          results.posts++;
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

      let exporter: CsvExporter | JsonExporter;
      if (format === "csv") {
        exporter = new CsvExporter({ outputPath: outputDir });
      } else {
        exporter = new JsonExporter({ outputPath: outputDir });
      }

      const results: any = {};

      if (dataType === "posts" || dataType === "all") {
        const posts = await dbManager.queryPosts({ limit: 10000 });
        const filePath = await exporter.exportPosts(posts);
        results.posts = { count: posts.length, file: filePath };
      }

      if (dataType === "comments" || dataType === "all") {
        const comments = await dbManager.queryComments({ limit: 10000 });
        const filePath = await exporter.exportComments(comments);
        results.comments = { count: comments.length, file: filePath };
      }

      if (dataType === "users" || dataType === "all") {
        const users = await dbManager.queryUsers({ limit: 10000 });
        const filePath = await exporter.exportUsers(users);
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

      const result = await dbManager.deleteOldData({
        olderThanDays,
        platform: operation.platform,
      });

      await dbManager.vacuum();

      return result;
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

    await fs.writeFile(filePath, JSON.stringify(output, null, 2));
    this.formatter.success(`Results saved to ${filePath}`);
  }
}
