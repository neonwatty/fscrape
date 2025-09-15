/**
 * Scrape command - Main scraping functionality
 */

import { Command } from "commander";
import {
  validateScrapeOptions,
  validateUrl,
  validatePath,
  validatePositiveInt,
  formatError,
  formatWarning,
  formatInfo,
} from "../validation.js";
import { PlatformFactory } from "../../platforms/platform-factory.js";
import { PlatformRegistry } from "../../platforms/platform-registry.js";
import { DatabaseManager } from "../../database/database.js";
import { ExportManager } from "../../export/export-manager.js";
import { ConfigManager } from "../../config/manager.js";
import type { Platform, ScrapeResult, SortOption } from "../../types/core.js";
import chalk from "chalk";
import ora from "ora";

/**
 * Create the scrape command
 */
export function createScrapeCommand(): Command {
  const command = new Command("scrape")
    .description("Scrape content from a forum or platform")
    .argument("<url>", "URL to scrape", validateUrl)
    .option(
      "-p, --platform <platform>",
      "Platform type (reddit, hackernews, etc.)",
    )
    .option(
      "-l, --limit <number>",
      "Maximum number of items to scrape (Reddit: auto-paginates for limits > 100)",
      (value) => validatePositiveInt(value, "Limit"),
    )
    .option(
      "-s, --sort-by <sort>",
      "Sort order (hot, new, top, controversial, old)",
    )
    .option(
      "-t, --time-range <range>",
      "Time range (hour, day, week, month, year, all)",
    )
    .option("-c, --include-comments", "Include comments in scrape", false)
    .option("-d, --max-depth <number>", "Maximum comment depth", (value) =>
      validatePositiveInt(value, "Max depth"),
    )
    .option("-o, --output <path>", "Output file path")
    .option(
      "-f, --format <format>",
      "Output format (json, csv, markdown, html)",
      "json",
    )
    .option("--database <path>", "Database path (overrides config)")
    .option("--config <path>", "Configuration file path", "fscrape.config.json")
    .option("--no-save", "Don't save to database")
    .option("--stdout", "Output scraped data to terminal (stdout)", false)
    .option("--verbose", "Verbose output", false)
    .action(async (url: string, options: any) => {
      try {
        await handleScrape(url, options);
      } catch (error) {
        console.error(chalk.red(formatError(error)));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Handle the scrape command
 */
async function handleScrape(url: string, options: any): Promise<void> {
  // Load configuration
  const configPath = validatePath(options.config || "fscrape.config.json");
  const configManager = new ConfigManager(configPath);
  let config: any = {};

  try {
    config = configManager.loadConfig();
    if (options.verbose) {
      console.log(
        chalk.gray(formatInfo(`Loaded configuration from ${configPath}`)),
      );
    }
  } catch (error) {
    if (options.verbose) {
      console.warn(
        chalk.yellow(
          formatWarning(`Could not load config: ${formatError(error)}`),
        ),
      );
    }
  }

  // Detect platform from URL if not specified
  const platform = options.platform || detectPlatformFromUrl(url);
  if (!platform) {
    throw new Error(
      "Could not detect platform. Please specify with --platform option.",
    );
  }

  // Validate options
  const scrapeOptions = validateScrapeOptions({
    platform,
    limit: options.limit,
    sortBy: options.sortBy,
    timeRange: options.timeRange,
    includeComments: options.includeComments,
    maxDepth: options.maxDepth,
    output: options.output,
    format: options.format,
    database: options.database,
    config: options.config,
  });

  // Initialize database if saving
  let dbManager: DatabaseManager | null = null;
  if (options.save !== false) {
    const dbPath = options.database || config.database?.path || "fscrape.db";
    dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();
    if (options.verbose) {
      console.log(chalk.gray(formatInfo(`Connected to database: ${dbPath}`)));
    }
  }

  // Create platform scraper
  const spinner = ora(`Initializing ${platform} scraper...`).start();

  try {
    // Initialize platform registry first
    await PlatformRegistry.initializeAsync();

    const platformConfig = config.platforms?.[platform] || {};
    const scraper = await PlatformFactory.create(platform, platformConfig);

    await scraper.initialize();
    spinner.succeed(chalk.green(`${platform} scraper initialized`));

    // Parse URL to determine what to scrape
    const scrapeTarget = parseUrlForTarget(url, platform);

    // Start scraping
    spinner.start(`Scraping from ${platform}...`);

    let result: ScrapeResult;

    if (scrapeTarget.type === "category") {
      const categoryOptions: any = {};
      if (scrapeOptions.limit !== undefined)
        categoryOptions.limit = scrapeOptions.limit;
      if (scrapeOptions.sortBy !== undefined)
        categoryOptions.sortBy = scrapeOptions.sortBy as SortOption;
      if (scrapeOptions.timeRange !== undefined)
        categoryOptions.timeRange = scrapeOptions.timeRange;
      if (scrapeOptions.includeComments !== undefined)
        categoryOptions.includeComments = scrapeOptions.includeComments;
      if (scrapeOptions.maxDepth !== undefined)
        categoryOptions.maxDepth = scrapeOptions.maxDepth;

      const posts = await scraper.scrapeCategory(
        scrapeTarget.value,
        categoryOptions,
      );

      result = {
        posts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: posts.length,
          platform: platform as Platform,
        },
      };
    } else if (scrapeTarget.type === "post") {
      const post = await scraper.scrapePost(scrapeTarget.value);
      if (!post) {
        throw new Error(`Post not found: ${scrapeTarget.value}`);
      }

      let comments: any[] | undefined = undefined;
      if (scrapeOptions.includeComments) {
        comments = await scraper.scrapeComments(scrapeTarget.value, {
          ...(scrapeOptions.maxDepth !== undefined && {
            maxDepth: scrapeOptions.maxDepth,
          }),
        });
      }

      result = {
        posts: [post],
        comments,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          totalComments: comments?.length || 0,
          platform: platform as Platform,
        },
      };
    } else {
      // General scrape
      const generalOptions: any = {};
      if (scrapeOptions.limit !== undefined)
        generalOptions.limit = scrapeOptions.limit;
      if (scrapeOptions.sortBy !== undefined)
        generalOptions.sortBy = scrapeOptions.sortBy as SortOption;
      if (scrapeOptions.timeRange !== undefined)
        generalOptions.timeRange = scrapeOptions.timeRange;
      if (scrapeOptions.includeComments !== undefined)
        generalOptions.includeComments = scrapeOptions.includeComments;
      if (scrapeOptions.maxDepth !== undefined)
        generalOptions.maxDepth = scrapeOptions.maxDepth;

      result = await scraper.scrape(generalOptions);
    }

    spinner.succeed(
      chalk.green(
        `Scraped ${result.posts.length} posts${result.comments ? ` and ${result.comments.length} comments` : ""}`,
      ),
    );

    // Save to database
    if (dbManager && options.save !== false) {
      spinner.start("Saving to database...");

      for (const post of result.posts) {
        await dbManager.upsertPost(post);
      }

      if (result.comments) {
        for (const comment of result.comments) {
          await dbManager.upsertComment(comment);
        }
      }

      if (result.users) {
        for (const user of result.users) {
          await dbManager.upsertUser(user);
        }
      }

      spinner.succeed(chalk.green("Data saved to database"));
    }

    // Export to file if requested
    if (options.output) {
      spinner.start("Exporting data...");

      const exportManager = new ExportManager({
        outputDirectory: options.output,
        defaultFormat: scrapeOptions.format || "json",
      });

      const outputPath = await exportManager.exportData(
        result,
        scrapeOptions.format || "json",
        options.output as string,
      );

      spinner.succeed(chalk.green(`Data exported to ${outputPath}`));
    }

    // Output to stdout if requested
    if (options.stdout) {
      console.log(JSON.stringify(result, null, 2));
    }

    // Display summary
    displaySummary(result, options.verbose);
  } catch (error) {
    spinner.fail(chalk.red(formatError(error)));
    throw error;
  }
}

/**
 * Detect platform from URL
 */
function detectPlatformFromUrl(url: string): Platform | null {
  const urlLower = url.toLowerCase();

  if (urlLower.includes("reddit.com") || urlLower.includes("redd.it")) {
    return "reddit";
  }
  if (
    urlLower.includes("news.ycombinator.com") ||
    urlLower.includes("hackernews")
  ) {
    return "hackernews";
  }
  if (urlLower.includes("lobste.rs") || urlLower.includes("lobsters")) {
    return "lobsters";
  }
  if (urlLower.includes("lemmy") || urlLower.includes("lemm.ee")) {
    return "lemmy";
  }

  return null;
}

/**
 * Parse URL to determine scrape target
 */
function parseUrlForTarget(
  url: string,
  platform: string,
): { type: "category" | "post" | "general"; value: string } {
  const urlObj = new URL(url);
  const path = urlObj.pathname;

  if (platform === "reddit") {
    // Check for subreddit
    const subredditMatch = path.match(/\/r\/([^/]+)/);
    if (subredditMatch) {
      // Check if it's a specific post
      const postMatch = path.match(/\/comments\/([a-z0-9]+)/);
      if (postMatch && postMatch[1]) {
        return { type: "post", value: postMatch[1] };
      }
      return { type: "category", value: subredditMatch[1] || "" };
    }
  }

  // Add more platform-specific parsing as needed

  return { type: "general", value: url };
}

/**
 * Display scraping summary
 */
function displaySummary(result: ScrapeResult, verbose: boolean): void {
  console.log("\n" + chalk.bold("Scraping Summary"));
  console.log(chalk.white("─".repeat(40)));

  console.log(chalk.cyan("Platform:") + ` ${result.metadata.platform}`);
  console.log(chalk.cyan("Posts scraped:") + ` ${result.metadata.totalPosts}`);

  if (result.metadata.totalComments) {
    console.log(
      chalk.cyan("Comments scraped:") + ` ${result.metadata.totalComments}`,
    );
  }

  if (result.users) {
    console.log(chalk.cyan("Users collected:") + ` ${result.users.length}`);
  }

  console.log(
    chalk.cyan("Scraped at:") +
      ` ${result.metadata.scrapedAt.toLocaleString()}`,
  );

  if (verbose && result.posts.length > 0) {
    console.log("\n" + chalk.bold("Top Posts:"));
    result.posts.slice(0, 5).forEach((post, index) => {
      console.log(chalk.gray(`${index + 1}. ${post.title}`));
      if (post.score !== undefined) {
        console.log(
          chalk.gray(
            `   Score: ${post.score} | Comments: ${post.commentCount || 0}`,
          ),
        );
      }
    });
  }
}
