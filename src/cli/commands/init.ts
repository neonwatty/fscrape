/**
 * Init command - Initialize a new fscrape project
 */

import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  validateInitOptions,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
} from "../validation.js";
import type { InitOptions } from "../validation.js";
import type { ScraperConfig } from "../../types/config.js";
import { DatabaseManager } from "../../database/database.js";
import chalk from "chalk";
import * as inquirer from "inquirer";

/**
 * Create the init command
 */
export function createInitCommand(): Command {
  const command = new Command("init")
    .description("Initialize a new fscrape project")
    .argument("[directory]", "Project directory", process.cwd())
    .option("-n, --name <name>", "Project name")
    .option("-d, --database <path>", "Database path", "fscrape.db")
    .option(
      "-p, --platform <platform>",
      "Primary platform (reddit, hackernews, etc.)",
    )
    .option("-f, --force", "Overwrite existing configuration", false)
    .option("--no-interactive", "Skip interactive prompts")
    .action(async (directory: string, options: any) => {
      try {
        await handleInit(directory, options);
      } catch (error) {
        console.error(chalk.red(formatError(error)));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Handle the init command
 */
async function handleInit(directory: string, options: any): Promise<void> {
  const projectDir = resolve(directory);
  const configPath = join(projectDir, "fscrape.config.json");

  // Check if config already exists
  if (existsSync(configPath) && !options.force) {
    console.warn(
      chalk.yellow(
        formatWarning(
          "Configuration already exists. Use --force to overwrite.",
        ),
      ),
    );
    process.exit(1);
  }

  // Create project directory if it doesn't exist
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
    console.log(
      chalk.green(formatSuccess(`Created project directory: ${projectDir}`)),
    );
  }

  // Gather configuration through prompts if interactive
  let initOptions: InitOptions;

  if (options.interactive !== false && process.stdin.isTTY) {
    initOptions = await promptForOptions(options);
  } else {
    initOptions = validateInitOptions({
      name: options.name || "fscrape-project",
      database: options.database,
      platform: options.platform,
      force: options.force,
    });
  }

  // Create the configuration
  const config = await createConfiguration(projectDir, initOptions);

  // Write configuration file
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(
    chalk.green(formatSuccess(`Created configuration file: ${configPath}`)),
  );

  // Initialize database
  const dbPath = join(projectDir, initOptions.database || "fscrape.db");
  console.log(chalk.blue(formatInfo(`Initializing database: ${dbPath}`)));

  try {
    const dbManager = new DatabaseManager({
      type: "sqlite",
      path: dbPath,
      connectionPoolSize: 5,
    });
    await dbManager.initialize();
    console.log(
      chalk.green(formatSuccess("Database initialized successfully")),
    );
  } catch (error) {
    console.warn(
      chalk.yellow(
        formatWarning(`Database initialization failed: ${formatError(error)}`),
      ),
    );
  }

  // Create default directories
  const directories = ["data", "exports", "logs"];
  for (const dir of directories) {
    const dirPath = join(projectDir, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      console.log(chalk.green(formatSuccess(`Created directory: ${dir}/`)));
    }
  }

  // Create .gitignore if it doesn't exist
  const gitignorePath = join(projectDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    const gitignoreContent = [
      "# fscrape",
      "*.db",
      "*.db-journal",
      "*.db-shm",
      "*.db-wal",
      "logs/",
      "exports/",
      "data/",
      ".env",
      ".env.local",
      "node_modules/",
      ".DS_Store",
    ].join("\n");

    writeFileSync(gitignorePath, gitignoreContent);
    console.log(chalk.green(formatSuccess("Created .gitignore file")));
  }

  // Display summary
  console.log("\n" + chalk.bold.green("✨ Project initialized successfully!"));
  console.log(chalk.cyan("\nNext steps:"));
  console.log(
    chalk.white(
      "  1. Configure your platform credentials in fscrape.config.json",
    ),
  );
  console.log(chalk.white("  2. Run 'fscrape scrape <url>' to start scraping"));
  console.log(
    chalk.white("  3. Run 'fscrape status' to view scraping statistics"),
  );
}

/**
 * Prompt for configuration options
 */
async function promptForOptions(existingOptions: any): Promise<InitOptions> {
  const questions = [];

  if (!existingOptions.name) {
    questions.push({
      type: "input",
      name: "name",
      message: "Project name:",
      default: "fscrape-project",
      validate: (input: string) =>
        input.length > 0 || "Project name is required",
    });
  }

  if (!existingOptions.database) {
    questions.push({
      type: "input",
      name: "database",
      message: "Database path:",
      default: "fscrape.db",
    });
  }

  if (!existingOptions.platform) {
    questions.push({
      type: "list",
      name: "platform",
      message: "Primary platform:",
      choices: [
        { name: "Reddit", value: "reddit" },
        { name: "Hacker News", value: "hackernews" },
        { name: "Discourse", value: "discourse" },
        { name: "Lemmy", value: "lemmy" },
        { name: "Lobsters", value: "lobsters" },
        { name: "Custom", value: "custom" },
      ],
      default: "reddit",
    });
  }

  const answers = await inquirer.prompt(questions);

  return validateInitOptions({
    ...existingOptions,
    ...answers,
  });
}

/**
 * Create configuration object
 */
async function createConfiguration(
  projectDir: string,
  options: InitOptions,
): Promise<Partial<Config>> {
  const config: Partial<Config> = {
    projectName: options.name,
    database: {
      path: options.database || "fscrape.db",
      options: {
        verbose: false,
        timeout: 5000,
      },
    },
    platforms: {},
    scraping: {
      defaultLimit: 25,
      maxConcurrent: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      userAgent: `fscrape/1.0.0 (${options.name})`,
    },
    export: {
      defaultFormat: "json",
      outputDirectory: join(projectDir, "exports"),
      includeMetadata: true,
    },
    logging: {
      level: "info",
      directory: join(projectDir, "logs"),
      maxFiles: 10,
      maxSize: "10m",
    },
  };

  // Add platform-specific configuration template
  if (options.platform) {
    switch (options.platform) {
      case "reddit":
        config.platforms!.reddit = {
          clientId: "YOUR_CLIENT_ID",
          clientSecret: "YOUR_CLIENT_SECRET",
          userAgent: `fscrape/1.0.0 (${options.name})`,
        };
        break;
      case "hackernews":
        config.platforms!.hackernews = {
          baseUrl: "https://hacker-news.firebaseio.com/v0",
        };
        break;
      case "discourse":
        config.platforms!.discourse = {
          baseUrl: "YOUR_DISCOURSE_URL",
          apiKey: "YOUR_API_KEY",
        };
        break;
      case "lemmy":
        config.platforms!.lemmy = {
          instanceUrl: "YOUR_LEMMY_INSTANCE",
        };
        break;
      case "lobsters":
        config.platforms!.lobsters = {
          baseUrl: "https://lobste.rs",
        };
        break;
    }
  }

  return config;
}
