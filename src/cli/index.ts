#!/usr/bin/env node

/**
 * fscrape CLI - Main entry point
 */

import { Command } from "commander";
import { createInitCommand } from "./commands/init.js";
import { createScrapeCommand } from "./commands/scrape.js";
import { createStatusCommand } from "./commands/status.js";
import { createExportCommand } from "./commands/export.js";
import { createListCommand } from "./commands/list.js";
import { 
  formatError,
  validateCleanOptions,
  validateConfigOptions,
} from "./validation.js";
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
  program.addCommand(createExportCommand());
  program.addCommand(createListCommand());

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
    // Validate options
    const validatedOptions = validateConfigOptions({
      key,
      value: options.set,
      set: !!options.set,
      get: !options.set && !!key,
      list: !options.set && !key,
      config: options.config,
      format: "json",
    });

    const { ConfigManager } = await import("../config/manager.js");
    const configManager = new ConfigManager(validatedOptions.config || options.config);
    const config = configManager.loadConfig();

    if (validatedOptions.set && key) {
      // Set configuration value
      const { set: _set, ...configData } = config as any;
      configData[key] = options.set;
      configManager.saveConfig(configData);
      console.log(chalk.green(`✓ Set ${key} = ${options.set}`));
    } else if (validatedOptions.get && key) {
      // Display specific key
      const value = (config as any)[key];
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
 * Handle clean command
 */
async function handleClean(options: any): Promise<void> {
  try {
    // Validate options
    const validatedOptions = validateCleanOptions({
      database: options.database,
      olderThan: options.olderThan ? parseInt(options.olderThan, 10) : undefined,
      platform: options.platform,
      dryRun: options.dryRun || false,
      force: false,
    });

    const { DatabaseManager } = await import("../database/database.js");

    // Connect to database
    const dbManager = new DatabaseManager({
      type: "sqlite" as const,
      path: validatedOptions.database || options.database,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    if (validatedOptions.olderThan) {
      const olderThanDays = validatedOptions.olderThan;

      if (validatedOptions.dryRun) {
        // Count items that would be deleted
        const countOptions: { olderThanDays: number; platform?: any } = {
          olderThanDays,
        };
        if (validatedOptions.platform) {
          countOptions.platform = validatedOptions.platform;
        }
        const counts = dbManager.countOldData(countOptions);

        console.log(chalk.yellow("Dry run - no data will be deleted"));
        console.log(chalk.cyan(`Would delete:`));
        console.log(`  Posts: ${counts.posts}`);
        console.log(`  Comments: ${counts.comments}`);
        console.log(`  Users: ${counts.users}`);
      } else {
        // Actually delete
        const deleteOptions: { olderThanDays: number; platform?: any } = {
          olderThanDays,
        };
        if (validatedOptions.platform) {
          deleteOptions.platform = validatedOptions.platform;
        }
        const result = dbManager.deleteOldData(deleteOptions);

        console.log(chalk.green("✓ Database cleaned"));
        console.log(chalk.cyan(`Deleted:`));
        console.log(`  Posts: ${result.deletedPosts}`);
        console.log(`  Comments: ${result.deletedComments}`);
        console.log(`  Users: ${result.deletedUsers}`);
        
        // Run vacuum to reclaim space
        dbManager.vacuum();
        console.log(chalk.green("✓ Database optimized"));
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

// Export for testing and as module
export { createProgram, main };

// Only run if directly executed (not when imported)
// This prevents double execution when imported by src/cli.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red("Fatal error:"), error);
    process.exit(1);
  });
}
