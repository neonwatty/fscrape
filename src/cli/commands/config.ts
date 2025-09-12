/**
 * Config command for CLI
 * Handles configuration management with interactive prompts
 */

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { promises as fs } from "fs";
import path from "path";
import { isNodeError } from "../../types/errors.js";
import { homedir } from "os";
import { formatError } from "../validation.js";

export interface ConfigOptions {
  config?: string;
  global?: boolean;
  reset?: boolean;
  interactive?: boolean;
  list?: boolean;
  get?: string;
  set?: string[];
}

export interface ConfigData {
  defaultDatabase?: string;
  defaultPlatform?: string;
  outputFormat?: "json" | "csv" | "table";
  verbose?: boolean;
  maxConcurrency?: number;
  retryAttempts?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  rateLimit?: {
    reddit?: number;
    hackernews?: number;
  };
  export?: {
    defaultPath?: string;
    defaultFormat?: string;
  };
  batch?: {
    maxSize?: number;
    timeout?: number;
  };
}

/**
 * Create the config command
 */
export function createConfigCommand(): Command {
  const command = new Command("config");

  command
    .description("Manage fscrape configuration")
    .option("-c, --config <path>", "Configuration file path")
    .option("-g, --global", "Use global configuration", false)
    .option("-r, --reset", "Reset configuration to defaults", false)
    .option("-i, --interactive", "Interactive configuration mode", false)
    .option("-l, --list", "List all configuration values", false)
    .option("--get <key>", "Get a specific configuration value")
    .option("--set <key=value...>", "Set configuration values")
    .action(async (options: ConfigOptions) => {
      await handleConfig(options);
    });

  return command;
}

/**
 * Get configuration file path
 */
function getConfigPath(options: ConfigOptions): string {
  if (options.config) {
    return options.config;
  }

  if (options.global) {
    const configDir = path.join(homedir(), ".fscrape");
    return path.join(configDir, "config.json");
  }

  return path.join(process.cwd(), "fscrape.config.json");
}

/**
 * Load configuration from file
 */
async function loadConfig(configPath: string): Promise<ConfigData> {
  try {
    const data = await fs.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return getDefaultConfig();
    }
    throw error;
  }
}

/**
 * Save configuration to file
 */
async function saveConfig(
  configPath: string,
  config: ConfigData,
): Promise<void> {
  const dir = path.dirname(configPath);

  // Ensure directory exists
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Get default configuration
 */
function getDefaultConfig(): ConfigData {
  return {
    defaultDatabase: "fscrape.db",
    defaultPlatform: "reddit",
    outputFormat: "table",
    verbose: false,
    maxConcurrency: 5,
    retryAttempts: 3,
    cacheEnabled: true,
    cacheTTL: 3600,
    rateLimit: {
      reddit: 60,
      hackernews: 30,
    },
    export: {
      defaultPath: "./exports",
      defaultFormat: "json",
    },
    batch: {
      maxSize: 100,
      timeout: 30000,
    },
  };
}

/**
 * Interactive configuration prompts
 */
async function interactiveConfig(
  currentConfig: ConfigData,
): Promise<ConfigData> {
  console.log(chalk.cyan("🔧 Interactive Configuration Setup\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "defaultDatabase",
      message: "Default database path:",
      default: currentConfig.defaultDatabase,
    },
    {
      type: "list",
      name: "defaultPlatform",
      message: "Default platform:",
      choices: ["reddit", "hackernews", "both"],
      default: currentConfig.defaultPlatform,
    },
    {
      type: "list",
      name: "outputFormat",
      message: "Default output format:",
      choices: ["table", "json", "csv"],
      default: currentConfig.outputFormat,
    },
    {
      type: "confirm",
      name: "verbose",
      message: "Enable verbose output by default?",
      default: currentConfig.verbose,
    },
    {
      type: "number",
      name: "maxConcurrency",
      message: "Maximum concurrent requests:",
      default: currentConfig.maxConcurrency,
      validate: (value: number) => {
        if (value < 1 || value > 20) {
          return "Please enter a value between 1 and 20";
        }
        return true;
      },
    },
    {
      type: "confirm",
      name: "cacheEnabled",
      message: "Enable caching?",
      default: currentConfig.cacheEnabled,
    },
    {
      type: "number",
      name: "cacheTTL",
      message: "Cache TTL (seconds):",
      default: currentConfig.cacheTTL,
      when: (answers) => answers.cacheEnabled,
    },
    {
      type: "confirm",
      name: "configureBatch",
      message: "Configure batch processing settings?",
      default: false,
    },
    {
      type: "number",
      name: "batchMaxSize",
      message: "Maximum batch size:",
      default: currentConfig.batch?.maxSize || 100,
      when: (answers) => answers.configureBatch,
    },
    {
      type: "number",
      name: "batchTimeout",
      message: "Batch timeout (ms):",
      default: currentConfig.batch?.timeout || 30000,
      when: (answers) => answers.configureBatch,
    },
  ]);

  // Construct new config from answers
  const newConfig: ConfigData = {
    defaultDatabase: answers.defaultDatabase,
    defaultPlatform: answers.defaultPlatform,
    outputFormat: answers.outputFormat,
    verbose: answers.verbose,
    maxConcurrency: answers.maxConcurrency,
    retryAttempts: currentConfig.retryAttempts,
    cacheEnabled: answers.cacheEnabled,
    cacheTTL: answers.cacheTTL || currentConfig.cacheTTL,
    rateLimit: currentConfig.rateLimit,
    export: currentConfig.export,
    batch: {
      maxSize: answers.batchMaxSize || currentConfig.batch?.maxSize || 100,
      timeout: answers.batchTimeout || currentConfig.batch?.timeout || 30000,
    },
  };

  return newConfig;
}

/**
 * Get nested config value
 */
function getConfigValue(config: ConfigData, key: string): any {
  const keys = key.split(".");
  let value: any = config;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Set nested config value
 */
function setConfigValue(config: ConfigData, key: string, value: any): void {
  const keys = key.split(".");
  let obj: any = config;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in obj) || typeof obj[k] !== "object") {
      obj[k] = {};
    }
    obj = obj[k];
  }

  const lastKey = keys[keys.length - 1];

  // Try to parse value as JSON first, then as number, then as boolean
  try {
    obj[lastKey] = JSON.parse(value);
  } catch {
    if (value === "true") {
      obj[lastKey] = true;
    } else if (value === "false") {
      obj[lastKey] = false;
    } else if (!isNaN(Number(value))) {
      obj[lastKey] = Number(value);
    } else {
      obj[lastKey] = value;
    }
  }
}

/**
 * Display configuration in a formatted way
 */
function displayConfig(config: ConfigData, indent = 0): void {
  const spaces = " ".repeat(indent);

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "object" && value !== null) {
      console.log(chalk.cyan(`${spaces}${key}:`));
      displayConfig(value as any, indent + 2);
    } else {
      const displayValue = typeof value === "string" ? `"${value}"` : value;
      console.log(`${spaces}${chalk.gray(key)}: ${chalk.yellow(displayValue)}`);
    }
  }
}

/**
 * Handle config command
 */
async function handleConfig(options: ConfigOptions): Promise<void> {
  try {
    const configPath = getConfigPath(options);

    // Handle reset
    if (options.reset) {
      const config = getDefaultConfig();
      await saveConfig(configPath, config);
      console.log(chalk.green("✓ Configuration reset to defaults"));
      console.log(chalk.gray(`Configuration file: ${configPath}`));
      return;
    }

    // Load current config
    let config = await loadConfig(configPath);

    // Handle interactive mode
    if (options.interactive) {
      config = await interactiveConfig(config);
      await saveConfig(configPath, config);
      console.log(chalk.green("\n✓ Configuration saved"));
      console.log(chalk.gray(`Configuration file: ${configPath}`));
      return;
    }

    // Handle get
    if (options.get) {
      const value = getConfigValue(config, options.get);
      if (value !== undefined) {
        if (typeof value === "object") {
          console.log(JSON.stringify(value, null, 2));
        } else {
          console.log(value);
        }
      } else {
        console.log(
          chalk.yellow(`Configuration key not found: ${options.get}`),
        );
      }
      return;
    }

    // Handle set
    if (options.set && options.set.length > 0) {
      for (const pair of options.set) {
        const [key, ...valueParts] = pair.split("=");
        const value = valueParts.join("=");

        if (!value) {
          console.log(chalk.red(`Invalid format: ${pair}`));
          console.log(chalk.gray("Use format: key=value"));
          continue;
        }

        setConfigValue(config, key, value);
        console.log(chalk.green(`✓ Set ${key} = ${value}`));
      }

      await saveConfig(configPath, config);
      console.log(chalk.gray(`Configuration saved to: ${configPath}`));
      return;
    }

    // Default: list configuration
    console.log(chalk.cyan("\n📋 Current Configuration\n"));
    displayConfig(config);
    console.log(chalk.gray(`\nConfiguration file: ${configPath}`));

    // Show help
    if (!options.list) {
      console.log(chalk.gray("\nUse --interactive for guided setup"));
      console.log(chalk.gray("Use --get <key> to get a specific value"));
      console.log(chalk.gray("Use --set key=value to set values"));
      console.log(chalk.gray("Use --reset to restore defaults"));
    }
  } catch (error) {
    console.error(chalk.red("❌ Config failed:"));
    console.error(chalk.red(formatError(error)));
    process.exit(1);
  }
}
