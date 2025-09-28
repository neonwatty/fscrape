#!/usr/bin/env node

/**
 * fscrape CLI - Main entry point
 */

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createScrapeCommand } from './commands/scrape.js';
import { createStatusCommand } from './commands/status.js';
import { createExportCommand } from './commands/export.js';
import { createListCommand } from './commands/list.js';
import { createConfigCommand } from './commands/config.js';
import { formatError, validateCleanOptions } from './validation.js';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Platform } from '../types/core.js';

interface BatchCommandOptions {
  interactive?: boolean;
  dryRun?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
  verbose?: boolean;
  output?: string;
}

interface CleanCommandOptions {
  database?: string;
  olderThan?: string;
  platform?: Platform;
  dryRun?: boolean;
}

// Get package.json for version
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

/**
 * Create the main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('fscrape')
    .description('Multi-platform forum scraper with database storage and export capabilities')
    .version(packageJson.version, '-v, --version', 'output the version number')
    .option('--no-color', 'Disable colored output')
    .option('--quiet', 'Suppress non-error output')
    .option('--debug', 'Enable debug output')
    .hook('preAction', (thisCommand) => {
      // Handle global options
      const opts = thisCommand.opts();

      if (opts.color === false) {
        chalk.level = 0;
      }

      if (opts.debug) {
        process.env.DEBUG = 'fscrape:*';
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
  program.addCommand(createConfigCommand());

  // Add batch command
  program
    .command('batch')
    .description('Execute batch operations from file or interactively')
    .argument('[file]', 'Batch file path (JSON or text format)')
    .option('-i, --interactive', 'Interactive batch creation', false)
    .option('-d, --dry-run', 'Perform dry run without making changes', false)
    .option('-p, --parallel', 'Run operations in parallel', false)
    .option('--max-concurrency <number>', 'Maximum concurrent operations', parseInt, 5)
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (file: string | undefined, options: BatchCommandOptions) => {
      await handleBatch(file, options);
    });

  program
    .command('clean')
    .description('Clean database or remove old data')
    .option('-d, --database <path>', 'Database path', 'fscrape.db')
    .option('--older-than <days>', 'Remove data older than specified days')
    .option('--platform <platform>', 'Clean only specific platform data')
    .option('--dry-run', 'Show what would be deleted without actually deleting')
    .action(async (options: CleanCommandOptions) => {
      await handleClean(options);
    });

  // Error handling
  program.showHelpAfterError(true);

  return program;
}

/**
 * Handle batch command
 */
async function handleBatch(file: string | undefined, options: BatchCommandOptions): Promise<void> {
  try {
    const { BatchProcessor } = await import('./batch-processor.js');

    let batchConfig;

    if (options.interactive) {
      // Create batch configuration interactively
      batchConfig = await BatchProcessor.createInteractive();
    } else if (file) {
      // Load batch configuration from file
      batchConfig = await BatchProcessor.loadFromFile(file);
    } else {
      console.log(chalk.yellow('Please provide a batch file or use --interactive mode'));
      console.log(chalk.gray('Example: fscrape batch operations.json'));
      console.log(chalk.gray('Example: fscrape batch --interactive'));
      return;
    }

    // Apply command-line options
    if (options.dryRun !== undefined) batchConfig.dryRun = options.dryRun;
    if (options.parallel !== undefined) batchConfig.parallel = options.parallel;
    if (options.maxConcurrency !== undefined) batchConfig.maxConcurrency = options.maxConcurrency;
    if (options.verbose !== undefined) batchConfig.verbose = options.verbose;

    // Create and execute batch processor
    const processor = new BatchProcessor(batchConfig);
    const results = await processor.execute();

    // Save results if requested
    if (options.output) {
      await processor.saveResults(options.output);
    }

    // Exit with appropriate code
    const hasFailures = results.some((r) => r.status === 'failed');
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('❌ Batch execution failed:'));
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}

/**
 * Handle clean command
 */
async function handleClean(options: CleanCommandOptions): Promise<void> {
  try {
    // Validate options
    const validatedOptions = validateCleanOptions({
      database: options.database,
      olderThan: options.olderThan ? parseInt(options.olderThan, 10) : undefined,
      platform: options.platform,
      dryRun: options.dryRun || false,
      force: false,
    });

    const { DatabaseManager } = await import('../database/database.js');

    // Connect to database
    const dbManager = new DatabaseManager({
      type: 'sqlite' as const,
      path: validatedOptions.database || options.database,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();

    if (validatedOptions.olderThan) {
      const olderThanDays = validatedOptions.olderThan;

      if (validatedOptions.dryRun) {
        // Count items that would be deleted
        const countOptions: { olderThanDays: number; platform?: Platform } = {
          olderThanDays,
        };
        if (validatedOptions.platform) {
          countOptions.platform = validatedOptions.platform;
        }
        const counts = dbManager.countOldData(countOptions);

        console.log(chalk.yellow('Dry run - no data will be deleted'));
        console.log(chalk.cyan(`Would delete:`));
        console.log(`  Posts: ${counts.posts}`);
        console.log(`  Comments: ${counts.comments}`);
        console.log(`  Users: ${counts.users}`);
      } else {
        // Actually delete
        const deleteOptions: { olderThanDays: number; platform?: Platform } = {
          olderThanDays,
        };
        if (validatedOptions.platform) {
          deleteOptions.platform = validatedOptions.platform;
        }
        const result = dbManager.deleteOldData(deleteOptions);

        console.log(chalk.green('✓ Database cleaned'));
        console.log(chalk.cyan(`Deleted:`));
        console.log(`  Posts: ${result.deletedPosts}`);
        console.log(`  Comments: ${result.deletedComments}`);
        console.log(`  Users: ${result.deletedUsers}`);

        // Run vacuum to reclaim space
        dbManager.vacuum();
        console.log(chalk.green('✓ Database optimized'));
      }
    } else {
      console.log(chalk.yellow('Please specify --older-than <days> to clean data'));
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
  await program.parseAsync(process.argv);
}

// Export for testing and as module
export { createProgram, main };

// Execute main if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
