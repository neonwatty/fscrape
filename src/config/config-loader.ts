import fs from "fs";
import path from "path";
import { homedir } from "os";
import { logger } from "../utils/logger.js";
import { defaultConfig } from "./default-config.js";
import {
  validatePartialConfig,
  mergeConfigs,
  safeValidateConfig,
} from "./config-validator.js";
import type { Config, PartialConfig } from "./config-validator.js";

/**
 * Configuration file names to search for
 */
const CONFIG_FILE_NAMES = [
  ".fscraperrc",
  ".fscraperrc.json",
  "fscraper.config.json",
];

/**
 * Environment variable prefix for configuration
 */
const ENV_PREFIX = "FSCRAPER_";

/**
 * Configuration loader with discovery chain
 *
 * Discovery chain (in order of precedence, highest to lowest):
 * 1. CLI flags (passed as overrides)
 * 2. Local config file (current directory)
 * 3. Parent directory configs (walking up)
 * 4. Global config (~/.fscraperrc)
 * 5. Environment variables
 * 6. Default configuration
 */
export class ConfigLoader {
  private configCache: Config | null = null;
  private configPath: string | null = null;

  /**
   * Loads configuration with full discovery chain
   */
  async loadConfig(cliOverrides?: PartialConfig): Promise<Config> {
    if (this.configCache && !cliOverrides) {
      return this.configCache;
    }

    const configs: PartialConfig[] = [];

    // 1. Start with default configuration
    configs.push(defaultConfig);

    // 2. Load environment variables
    const envConfig = this.loadFromEnvironment();
    if (envConfig) {
      logger.debug("Loaded configuration from environment variables");
      configs.push(envConfig);
    }

    // 3. Load global configuration
    const globalConfig = await this.loadGlobalConfig();
    if (globalConfig) {
      logger.debug("Loaded global configuration");
      configs.push(globalConfig);
    }

    // 4. Load local/parent directory configurations
    const localConfig = await this.loadLocalConfig();
    if (localConfig) {
      logger.debug(`Loaded configuration from ${this.configPath}`);
      configs.push(localConfig);
    }

    // 5. Apply CLI overrides if provided
    if (cliOverrides) {
      logger.debug("Applying CLI overrides");
      configs.push(cliOverrides);
    }

    // Merge all configurations
    const mergedConfig = mergeConfigs(...configs);

    // Validate final configuration
    const validation = safeValidateConfig(mergedConfig);
    if (!validation.success) {
      logger.error("Configuration validation failed:", validation.error!);
      throw new Error(`Invalid configuration: ${validation.error!.message}`);
    }

    this.configCache = validation.data!;
    return this.configCache;
  }

  /**
   * Loads configuration from environment variables
   */
  private loadFromEnvironment(): PartialConfig | null {
    const config: any = {};
    let hasEnvVars = false;

    // Database path
    if (process.env[`${ENV_PREFIX}DATABASE_PATH`]) {
      config.database = { path: process.env[`${ENV_PREFIX}DATABASE_PATH`] };
      hasEnvVars = true;
    }

    // Logging level
    if (process.env[`${ENV_PREFIX}LOG_LEVEL`]) {
      config.logging = { level: process.env[`${ENV_PREFIX}LOG_LEVEL`] };
      hasEnvVars = true;
    }

    // Reddit API credentials
    if (process.env.REDDIT_CLIENT_ID || process.env.REDDIT_CLIENT_SECRET) {
      config.api = {
        reddit: {
          clientId: process.env.REDDIT_CLIENT_ID,
          clientSecret: process.env.REDDIT_CLIENT_SECRET,
          refreshToken: process.env.REDDIT_REFRESH_TOKEN,
        },
      };
      hasEnvVars = true;
    }

    // Development flags
    if (process.env[`${ENV_PREFIX}DEBUG`] === "true") {
      config.development = { debug: true };
      hasEnvVars = true;
    }

    if (process.env[`${ENV_PREFIX}DRY_RUN`] === "true") {
      config.development = { ...config.development, dryRun: true };
      hasEnvVars = true;
    }

    return hasEnvVars ? validatePartialConfig(config) : null;
  }

  /**
   * Loads global configuration from user home directory
   */
  private async loadGlobalConfig(): Promise<PartialConfig | null> {
    const homeDir = homedir();

    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(homeDir, fileName);
      const config = await this.loadConfigFile(configPath);
      if (config) {
        return config;
      }
    }

    return null;
  }

  /**
   * Loads local configuration by walking up directory tree
   */
  private async loadLocalConfig(): Promise<PartialConfig | null> {
    let currentDir = process.cwd();
    const homeDir = homedir();
    const visitedDirs = new Set<string>();

    while (currentDir !== homeDir && !visitedDirs.has(currentDir)) {
      visitedDirs.add(currentDir);

      for (const fileName of CONFIG_FILE_NAMES) {
        const configPath = path.join(currentDir, fileName);
        const config = await this.loadConfigFile(configPath);
        if (config) {
          this.configPath = configPath;
          return config;
        }
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break; // Reached root
      }
      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Loads and validates a configuration file
   */
  private async loadConfigFile(
    filePath: string,
  ): Promise<PartialConfig | null> {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = await fs.promises.readFile(filePath, "utf-8");
      const rawConfig = JSON.parse(content);

      return validatePartialConfig(rawConfig);
    } catch (error) {
      if ((error as any).code !== "ENOENT") {
        logger.warn(`Failed to load config from ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * Saves configuration to a file
   */
  async saveConfig(config: PartialConfig, filePath?: string): Promise<void> {
    const targetPath =
      filePath || this.configPath || path.join(process.cwd(), ".fscraperrc");

    const validation = safeValidateConfig({ ...defaultConfig, ...config });
    if (!validation.success) {
      throw new Error(`Invalid configuration: ${validation.error!.message}`);
    }

    const content = JSON.stringify(config, null, 2);
    await fs.promises.writeFile(targetPath, content, "utf-8");

    logger.info(`Configuration saved to ${targetPath}`);
    this.configPath = targetPath;
  }

  /**
   * Gets the current configuration file path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Resets the configuration cache
   */
  resetCache(): void {
    this.configCache = null;
    this.configPath = null;
  }

  /**
   * Creates a CLI override configuration from command options
   */
  createCliOverrides(options: any): PartialConfig {
    const overrides: any = {};

    // Database options
    if (options.database) {
      overrides.database = { path: options.database };
    }

    // Logging options
    if (options.logLevel) {
      overrides.logging = { level: options.logLevel };
    }

    if (options.verbose) {
      overrides.development = { verbose: true };
      overrides.logging = { level: "debug" };
    }

    // Scraping options
    if (options.limit) {
      overrides.cli = { defaultLimit: options.limit };
    }

    if (options.batchSize) {
      overrides.scraping = {
        session: { defaultBatchSize: options.batchSize },
      };
    }

    // Development options
    if (options.debug) {
      overrides.development = { ...overrides.development, debug: true };
    }

    if (options.dryRun) {
      overrides.development = { ...overrides.development, dryRun: true };
    }

    // Export options
    if (options.format) {
      overrides.export = { ...overrides.export, defaultFormat: options.format };
    }

    if (options.output) {
      overrides.export = { ...overrides.export, outputDir: options.output };
    }

    return validatePartialConfig(overrides);
  }

  /**
   * Displays current configuration (with secrets masked)
   */
  displayConfig(config: Config): void {
    const masked = this.maskSecrets(config);
    console.log(JSON.stringify(masked, null, 2));
  }

  /**
   * Masks sensitive values in configuration
   */
  private maskSecrets(config: any): any {
    const masked = JSON.parse(JSON.stringify(config));

    // Mask API credentials
    if (masked.api?.reddit?.clientId) {
      masked.api.reddit.clientId = this.maskString(masked.api.reddit.clientId);
    }
    if (masked.api?.reddit?.clientSecret) {
      masked.api.reddit.clientSecret = "***";
    }
    if (masked.api?.reddit?.refreshToken) {
      masked.api.reddit.refreshToken = "***";
    }

    return masked;
  }

  /**
   * Partially masks a string
   */
  private maskString(str: string): string {
    if (str.length <= 4) {
      return "***";
    }
    return (
      str.substring(0, 2) +
      "*".repeat(str.length - 4) +
      str.substring(str.length - 2)
    );
  }
}

// Export singleton instance
export const configLoader = new ConfigLoader();
