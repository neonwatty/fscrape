/**
 * Output formatter for CLI
 * Handles verbose output, batch operation formatting, and various output formats
 */

import chalk from "chalk";
import { table } from "table";
import ora, { Ora } from "ora";
import type { ForumPost, Comment, User } from "../types/core.js";

export type OutputFormat = "json" | "csv" | "table" | "simple" | "verbose";
export type OutputLevel = "quiet" | "normal" | "verbose" | "debug";

export interface OutputOptions {
  format?: OutputFormat;
  level?: OutputLevel;
  color?: boolean;
  timestamp?: boolean;
  showProgress?: boolean;
  showStats?: boolean;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentItem?: string;
  startTime: Date;
}

/**
 * Output formatter class for consistent CLI output
 */
export class OutputFormatter {
  private options: OutputOptions;
  private spinner: Ora | null = null;
  private batchProgress: BatchProgress | null = null;

  constructor(options: OutputOptions = {}) {
    this.options = {
      format: options.format || "table",
      level: options.level || "normal",
      color: options.color !== false,
      timestamp: options.timestamp || false,
      showProgress: options.showProgress !== false,
      showStats: options.showStats !== false,
    };

    // Disable colors if requested
    if (!this.options.color) {
      chalk.level = 0;
    }
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(): string {
    if (!this.options.timestamp) return "";
    const now = new Date();
    return chalk.gray(`[${now.toISOString()}] `);
  }

  /**
   * Log based on output level
   */
  log(message: string, level: OutputLevel = "normal"): void {
    const levels = ["quiet", "normal", "verbose", "debug"];
    const currentLevel = levels.indexOf(this.options.level || "normal");
    const messageLevel = levels.indexOf(level);

    if (messageLevel <= currentLevel) {
      console.log(this.formatTimestamp() + message);
    }
  }

  /**
   * Log error
   */
  error(message: string, error?: Error): void {
    console.error(this.formatTimestamp() + chalk.red("❌ " + message));

    if (error && this.options.level === "debug") {
      console.error(chalk.gray(error.stack || error.message));
    } else if (error && this.options.level === "verbose") {
      console.error(chalk.gray(error.message));
    }
  }

  /**
   * Log success
   */
  success(message: string): void {
    this.log(chalk.green("✓ " + message), "normal");
  }

  /**
   * Log warning
   */
  warning(message: string): void {
    this.log(chalk.yellow("⚠ " + message), "normal");
  }

  /**
   * Log info
   */
  info(message: string): void {
    this.log(chalk.cyan("ℹ " + message), "verbose");
  }

  /**
   * Log debug
   */
  debug(message: string): void {
    this.log(chalk.gray("🔍 " + message), "debug");
  }

  /**
   * Start spinner
   */
  startSpinner(text: string): void {
    if (this.options.showProgress && this.options.level !== "quiet") {
      this.spinner = ora({
        text,
        color: "cyan",
      }).start();
    }
  }

  /**
   * Update spinner text
   */
  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  /**
   * Stop spinner with success
   */
  succeedSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with failure
   */
  failSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner
   */
  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Start batch progress tracking
   */
  startBatch(total: number, description?: string): void {
    this.batchProgress = {
      total,
      completed: 0,
      failed: 0,
      skipped: 0,
      startTime: new Date(),
    };

    if (this.options.showProgress) {
      const message = description || "Processing batch";
      this.startSpinner(`${message} (0/${total})`);
    }
  }

  /**
   * Update batch progress
   */
  updateBatch(item: string, status: "completed" | "failed" | "skipped"): void {
    if (!this.batchProgress) return;

    this.batchProgress[status]++;
    this.batchProgress.currentItem = item;

    const { completed, failed, skipped, total } = this.batchProgress;
    const processed = completed + failed + skipped;

    if (this.options.showProgress) {
      const percentage = Math.round((processed / total) * 100);
      const statusText = failed > 0 ? chalk.yellow(`(${failed} failed)`) : "";

      this.updateSpinner(
        `Processing: ${item} - ${percentage}% (${processed}/${total}) ${statusText}`,
      );
    }

    // Log verbose details
    if (this.options.level === "verbose") {
      const statusSymbol = {
        completed: "✓",
        failed: "✗",
        skipped: "⊘",
      }[status];

      const statusColor = {
        completed: chalk.green,
        failed: chalk.red,
        skipped: chalk.gray,
      }[status];

      console.log(statusColor(`  ${statusSymbol} ${item}`));
    }
  }

  /**
   * End batch progress tracking
   */
  endBatch(summary?: boolean): void {
    if (!this.batchProgress) return;

    const { completed, failed, skipped, total, startTime } = this.batchProgress;
    const duration = Date.now() - startTime.getTime();
    const durationStr = this.formatDuration(duration);

    this.stopSpinner();

    if (summary || this.options.showStats) {
      console.log(chalk.cyan("\n📊 Batch Processing Summary\n"));

      const summaryData = [
        ["Metric", "Value"],
        ["Total Items", total.toString()],
        ["Completed", chalk.green(completed.toString())],
        ["Failed", failed > 0 ? chalk.red(failed.toString()) : "0"],
        ["Skipped", chalk.gray(skipped.toString())],
        ["Duration", durationStr],
        ["Rate", `${(total / (duration / 1000)).toFixed(2)} items/sec`],
      ];

      console.log(
        table(summaryData, {
          header: {
            alignment: "center",
            content: chalk.cyan("Batch Results"),
          },
        }),
      );
    }

    this.batchProgress = null;
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format posts output
   */
  formatPosts(posts: ForumPost[]): void {
    switch (this.options.format) {
      case "json":
        console.log(JSON.stringify(posts, null, 2));
        break;

      case "csv":
        this.formatPostsCSV(posts);
        break;

      case "simple":
        this.formatPostsSimple(posts);
        break;

      case "verbose":
        this.formatPostsVerbose(posts);
        break;

      case "table":
      default:
        this.formatPostsTable(posts);
        break;
    }
  }

  /**
   * Format posts as table
   */
  private formatPostsTable(posts: ForumPost[]): void {
    if (posts.length === 0) {
      this.warning("No posts to display");
      return;
    }

    const tableData = [
      ["#", "Title", "Author", "Score", "Comments", "Platform", "Date"],
    ];

    posts.forEach((post, index) => {
      const title =
        post.title.length > 50
          ? post.title.substring(0, 47) + "..."
          : post.title;

      tableData.push([
        (index + 1).toString(),
        title,
        post.author,
        post.score?.toString() || "0",
        post.commentCount?.toString() || "0",
        post.platform,
        new Date(post.createdAt).toLocaleDateString(),
      ]);
    });

    console.log(
      table(tableData, {
        header: {
          alignment: "center",
          content: chalk.cyan("Posts"),
        },
      }),
    );
  }

  /**
   * Format posts as CSV
   */
  private formatPostsCSV(posts: ForumPost[]): void {
    const headers = [
      "id",
      "title",
      "author",
      "score",
      "comments",
      "platform",
      "url",
      "created_at",
    ];
    console.log(headers.join(","));

    posts.forEach((post) => {
      const row = [
        post.id,
        `"${post.title.replace(/"/g, '""')}"`,
        post.author,
        post.score || 0,
        post.commentCount || 0,
        post.platform,
        post.url,
        new Date(post.createdAt).toISOString(),
      ];
      console.log(row.join(","));
    });
  }

  /**
   * Format posts as simple text
   */
  private formatPostsSimple(posts: ForumPost[]): void {
    posts.forEach((post, index) => {
      console.log(chalk.cyan(`${index + 1}. ${post.title}`));
      console.log(
        chalk.gray(
          `   Author: ${post.author} | Score: ${post.score} | Comments: ${post.commentCount}`,
        ),
      );
      console.log(
        chalk.gray(
          `   Platform: ${post.platform} | Date: ${new Date(post.createdAt).toLocaleDateString()}`,
        ),
      );
      console.log();
    });
  }

  /**
   * Format posts with verbose details
   */
  private formatPostsVerbose(posts: ForumPost[]): void {
    posts.forEach((post, index) => {
      console.log(chalk.cyan(`\n${"=".repeat(80)}`));
      console.log(chalk.cyan(`Post ${index + 1}: ${post.title}`));
      console.log(chalk.cyan("=".repeat(80)));

      console.log(chalk.gray("ID:"), post.id);
      console.log(chalk.gray("URL:"), post.url);
      console.log(chalk.gray("Author:"), post.author);
      console.log(chalk.gray("Platform:"), post.platform);
      console.log(chalk.gray("Score:"), post.score || 0);
      console.log(chalk.gray("Comments:"), post.commentCount || 0);
      console.log(
        chalk.gray("Created:"),
        new Date(post.createdAt).toISOString(),
      );

      if (post.updatedAt) {
        console.log(
          chalk.gray("Updated:"),
          new Date(post.updatedAt).toISOString(),
        );
      }

      if (post.content) {
        console.log(chalk.gray("\nContent:"));
        console.log(post.content.substring(0, 500));
        if (post.content.length > 500) {
          console.log(chalk.gray("... [truncated]"));
        }
      }

      if (post.metadata) {
        console.log(chalk.gray("\nMetadata:"));
        console.log(JSON.stringify(post.metadata, null, 2));
      }
    });

    console.log(chalk.cyan(`\n${"=".repeat(80)}`));
    console.log(chalk.gray(`Total posts: ${posts.length}`));
  }

  /**
   * Format comments output
   */
  formatComments(comments: Comment[]): void {
    switch (this.options.format) {
      case "json":
        console.log(JSON.stringify(comments, null, 2));
        break;

      case "csv":
        this.formatCommentsCSV(comments);
        break;

      case "verbose":
        this.formatCommentsVerbose(comments);
        break;

      case "simple":
      case "table":
      default:
        this.formatCommentsTable(comments);
        break;
    }
  }

  /**
   * Format comments as table
   */
  private formatCommentsTable(comments: Comment[]): void {
    if (comments.length === 0) {
      this.warning("No comments to display");
      return;
    }

    const tableData = [["#", "Author", "Content", "Score", "Platform", "Date"]];

    comments.forEach((comment, index) => {
      const content =
        comment.content.length > 40
          ? comment.content.substring(0, 37) + "..."
          : comment.content;

      tableData.push([
        (index + 1).toString(),
        comment.author,
        content,
        comment.score?.toString() || "0",
        comment.platform,
        new Date(comment.createdAt).toLocaleDateString(),
      ]);
    });

    console.log(
      table(tableData, {
        header: {
          alignment: "center",
          content: chalk.cyan("Comments"),
        },
      }),
    );
  }

  /**
   * Format comments as CSV
   */
  private formatCommentsCSV(comments: Comment[]): void {
    const headers = [
      "id",
      "post_id",
      "author",
      "content",
      "score",
      "platform",
      "created_at",
    ];
    console.log(headers.join(","));

    comments.forEach((comment) => {
      const row = [
        comment.id,
        comment.postId,
        comment.author,
        `"${comment.content.replace(/"/g, '""')}"`,
        comment.score || 0,
        comment.platform,
        new Date(comment.createdAt).toISOString(),
      ];
      console.log(row.join(","));
    });
  }

  /**
   * Format comments with verbose details
   */
  private formatCommentsVerbose(comments: Comment[]): void {
    comments.forEach((comment, index) => {
      console.log(chalk.cyan(`\nComment ${index + 1}:`));
      console.log(chalk.gray("Author:"), comment.author);
      console.log(chalk.gray("Score:"), comment.score || 0);
      console.log(chalk.gray("Platform:"), comment.platform);
      console.log(
        chalk.gray("Created:"),
        new Date(comment.createdAt).toISOString(),
      );
      console.log(chalk.gray("Content:"));
      console.log(comment.content);
      console.log(chalk.gray("-".repeat(40)));
    });
  }

  /**
   * Format statistics
   */
  formatStats(stats: Record<string, any>): void {
    if (this.options.format === "json") {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan("\n📊 Statistics\n"));

    const statsTable: string[][] = [["Metric", "Value"]];

    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === "object" && value !== null) {
        for (const [subKey, subValue] of Object.entries(value)) {
          statsTable.push([`${key}.${subKey}`, String(subValue)]);
        }
      } else {
        statsTable.push([key, String(value)]);
      }
    }

    console.log(table(statsTable));
  }

  /**
   * Format progress bar
   */
  formatProgressBar(current: number, total: number, width = 40): string {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;

    const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    return `${bar} ${percentage}% (${current}/${total})`;
  }
}
