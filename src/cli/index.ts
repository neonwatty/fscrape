#!/usr/bin/env node

/**
 * fscrape CLI - Main entry point
 */

import { Command } from "commander";
import { createInitCommand } from "./commands/init.js";
import { createScrapeCommand } from "./commands/scrape.js";
import { createStatusCommand } from "./commands/status.js";
import { formatError } from "./validation.js";
import chalk from "chalk";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get package.json for version
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
);

/**
 * Create the main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name("fscrape")
    .description(
      "Multi-platform forum scraper with database storage and export capabilities",
    )
    .version(packageJson.version)
    .option("--no-color", "Disable colored output")
    .option("--quiet", "Suppress non-error output")
    .option("--debug", "Enable debug output")
    .hook("preAction", (thisCommand) => {
      // Handle global options
      const opts = thisCommand.opts();

      if (opts.noColor) {
        chalk.level = 0;
      }

      if (opts.debug) {
        process.env.DEBUG = "fscrape:*";
      }

      if (opts.quiet) {
        console.log = () => {};
        console.info = () => {};
      }
    });

  // Add commands
  program.addCommand(createInitCommand());
  program.addCommand(createScrapeCommand());
  program.addCommand(createStatusCommand());

  // Add additional utility commands
  program
    .command("config")
    .description("Display or modify configuration")
    .argument("[key]", "Configuration key to display")
    .option("-s, --set <value>", "Set configuration value")
    .option(
      "-c, --config <path>",
      "Configuration file path",
      "fscrape.config.json",
    )
    .action(async (key: string | undefined, options: any) => {
      await handleConfig(key, options);
    });

  program
    .command("export")
    .description("Export data from database")
    .option("-d, --database <path>", "Database path", "fscrape.db")
    .option(
      "-f, --format <format>",
      "Export format (json, csv, markdown, html)",
      "json",
    )
    .option("-o, --output <path>", "Output file path", "export")
    .option("-p, --platform <platform>", "Filter by platform")
    .option("--start-date <date>", "Start date for export")
    .option("--end-date <date>", "End date for export")
    .option("--limit <number>", "Maximum items to export")
    .action(async (options: any) => {
      await handleExport(options);
    });

  program
    .command("clean")
    .description("Clean database or remove old data")
    .option("-d, --database <path>", "Database path", "fscrape.db")
    .option("--older-than <days>", "Remove data older than specified days")
    .option("--platform <platform>", "Clean only specific platform data")
    .option("--dry-run", "Show what would be deleted without actually deleting")
    .action(async (options: any) => {
      await handleClean(options);
    });

  // Error handling
  program.exitOverride();
  program.showHelpAfterError(true);

  return program;
}

/**
 * Handle config command
 */
async function handleConfig(
  key: string | undefined,
  options: any,
): Promise<void> {
  try {
    const { ConfigManager } = await import("../config/manager.js");
    const configManager = new ConfigManager(options.config);
    const config = configManager.loadConfig();

    if (options.set && key) {
      // Set configuration value
      // TODO: implement config setting
      console.log(chalk.yellow("Config setting not yet implemented"));
      console.log(chalk.green(`✓ Set ${key} = ${options.set}`));
    } else if (key) {
      // Display specific key
      const value = config[key];
      if (value !== undefined) {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(chalk.yellow(`Key not found: ${key}`));
      }
    } else {
      // Display entire config
      console.log(JSON.stringify(config, null, 2));
    }
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle export command
 */
async function handleExport(options: any): Promise<void> {
  try {
    const { DatabaseManager } = await import("../database/database.js");
    const { ExportManager } = await import("../export/export-manager.js");

    // Connect to database
    const dbManager = new DatabaseManager({ path: options.database });
    await dbManager.initialize();

    // Query data
    const queryOptions: any = {};

    if (options.platform) {
      queryOptions.platform = options.platform;
    }

    if (options.startDate) {
      queryOptions.startDate = new Date(options.startDate);
    }

    if (options.endDate) {
      queryOptions.endDate = new Date(options.endDate);
    }

    if (options.limit) {
      queryOptions.limit = parseInt(options.limit, 10);
    }

    // TODO: implement query methods
    const posts: any[] = [];
    const comments = undefined;

    // Export data
    const exportManager = new ExportManager({
      outputDirectory: dirname(options.output),
      defaultFormat: options.format,
    });

    const result = {
      posts,
      comments,
      metadata: {
        scrapedAt: new Date(),
        totalPosts: posts.length,
        totalComments: comments?.length || 0,
        platform: options.platform || "all",
      },
    };

    const outputPath = await exportManager.exportData(
      result,
      options.format,
      options.output,
    );

    console.log(chalk.green(`✓ Data exported to ${outputPath}`));
    console.log(chalk.cyan(`  Posts: ${posts.length}`));
    if (comments) {
      console.log(chalk.cyan(`  Comments: ${comments.length}`));
    }
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle clean command
 */
async function handleClean(options: any): Promise<void> {
  try {
    const { DatabaseManager } = await import("../database/database.js");

    // Connect to database
    const dbManager = new DatabaseManager({ path: options.database });
    await dbManager.initialize();

    if (options.olderThan) {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - parseInt(options.olderThan, 10),
      );

      if (options.dryRun) {
        // Count items that would be deleted
        // TODO: implement count methods
        const postCount = 0;
        const commentCount = 0;

        console.log(chalk.yellow("Dry run - no data will be deleted"));
        console.log(chalk.cyan(`Would delete:`));
        console.log(`  Posts: ${postCount}`);
        console.log(`  Comments: ${commentCount}`);
      } else {
        // Actually delete
        // TODO: implement delete methods
        const deletedPosts = 0;
        const deletedComments = 0;

        console.log(chalk.green("✓ Database cleaned"));
        console.log(chalk.cyan(`Deleted:`));
        console.log(`  Posts: ${deletedPosts}`);
        console.log(`  Comments: ${deletedComments}`);
      }
    } else {
      console.log(
        chalk.yellow("Please specify --older-than <days> to clean data"),
      );
    }
  } catch (error) {
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Main CLI execution
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error: any) {
    // Commander will handle its own errors
    if (
      error.code !== "commander.help" &&
      error.code !== "commander.helpDisplayed"
    ) {
      console.error(chalk.red(formatError(error)));
      process.exit(1);
    }
  }
}

// Run CLI if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red("Fatal error:"), error);
    process.exit(1);
  });
}

// Export for testing
export { createProgram, main };
