import type { Platform } from "../types/core.js";
import type { BasePlatform, BasePlatformConfig } from "./base-platform.js";
import { PlatformRegistry } from "./platform-registry.js";
import { ConfigManager } from "../config/manager.js";
import type { ScraperConfig, RateLimitConfig } from "../types/config.js";
import type { PlatformConfig } from "../types/platform.js";
import { BasicRateLimiter } from "../scrapers/rate-limiter.js";
import winston from "winston";

/**
 * Platform constructor type
 */
export type PlatformConstructor = new (
  platform: Platform,
  config: BasePlatformConfig,
  logger?: winston.Logger,
) => BasePlatform;

/**
 * Factory options for creating platform instances
 */
export interface FactoryOptions {
  config?: BasePlatformConfig;
  scraperConfig?: ScraperConfig;
  platformConfig?: PlatformConfig;
  logger?: winston.Logger;
  initialize?: boolean;
  useRateLimiter?: boolean;
  configManager?: ConfigManager;
}

/**
 * Factory class for creating platform instances
 */
export class PlatformFactory {
  private static logger: winston.Logger = winston.createLogger({
    level: "info",
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
  });

  private static configManager: ConfigManager | null = null;

  /**
   * Create a platform instance with configuration
   */
  static async create(
    platform: Platform,
    options: FactoryOptions = {},
  ): Promise<BasePlatform> {
    const {
      config,
      scraperConfig,
      platformConfig,
      logger = this.logger,
      initialize = true,
      useRateLimiter = true,
      configManager = this.configManager,
    } = options;

    // Get the platform constructor from registry
    const PlatformClass = PlatformRegistry.get(platform);
    if (!PlatformClass) {
      throw new Error(
        `Platform "${platform}" is not registered. Available platforms: ${PlatformRegistry.list().join(
          ", ",
        )}`,
      );
    }

    // Build configuration from various sources
    const finalConfig = this.buildConfiguration(
      platform,
      config,
      scraperConfig,
      platformConfig,
      configManager,
    );

    // Create platform instance with proper constructor signature
    const instance = new PlatformClass(platform, finalConfig, logger);

    // Set up rate limiter if requested
    if (useRateLimiter) {
      const rateLimitConfig =
        scraperConfig?.rateLimit || this.getDefaultRateLimitConfig();
      const rateLimiter = new BasicRateLimiter(
        rateLimitConfig.maxRequestsPerMinute,
        60000, // 1 minute window
      );
      instance.setRateLimiter(rateLimiter);
    }

    // Initialize if requested
    if (initialize) {
      try {
        await instance.initialize();
        logger.info(`Platform "${platform}" initialized successfully`);
      } catch (error) {
        logger.error(`Failed to initialize platform "${platform}":`, error);
        throw error;
      }
    }

    return instance;
  }

  /**
   * Build configuration from various sources
   */
  private static buildConfiguration(
    platform: Platform,
    config?: BasePlatformConfig,
    scraperConfig?: ScraperConfig,
    platformConfig?: PlatformConfig,
    configManager?: ConfigManager | null,
  ): BasePlatformConfig {
    let finalConfig: BasePlatformConfig = {};

    // Load from config manager if available
    if (configManager) {
      try {
        const managedConfig = configManager.loadConfig();
        if (managedConfig) {
          if (managedConfig.userAgent) {
            finalConfig.userAgent = managedConfig.userAgent;
          }
          if (managedConfig.timeout) {
            finalConfig.timeout = managedConfig.timeout;
          }
          if (managedConfig.rateLimit?.maxRequestsPerMinute) {
            finalConfig.rateLimitPerMinute =
              managedConfig.rateLimit.maxRequestsPerMinute;
          }
        }
      } catch (error) {
        this.logger.warn("Failed to load managed configuration:", error);
      }
    }

    // Apply platform-specific configuration
    if (platformConfig && platformConfig.platform === platform) {
      if ("config" in platformConfig) {
        const platformSpecificConfig = platformConfig.config as any;
        finalConfig = {
          ...finalConfig,
          clientId: platformSpecificConfig.clientId,
          clientSecret: platformSpecificConfig.clientSecret,
          apiKey: platformSpecificConfig.apiKey,
          userAgent: platformSpecificConfig.userAgent || finalConfig.userAgent,
          baseUrl: platformSpecificConfig.baseUrl,
        };
      }
    }

    // Apply scraper configuration
    if (scraperConfig) {
      if (scraperConfig.userAgent) {
        finalConfig.userAgent = scraperConfig.userAgent;
      }
      if (scraperConfig.timeout) {
        finalConfig.timeout = scraperConfig.timeout;
      }
      if (scraperConfig.rateLimit?.maxRequestsPerMinute) {
        finalConfig.rateLimitPerMinute =
          scraperConfig.rateLimit.maxRequestsPerMinute;
      }
    }

    // Apply direct configuration (highest priority)
    if (config) {
      finalConfig = { ...finalConfig, ...config };
    }

    return finalConfig;
  }

  /**
   * Get default rate limit configuration
   */
  private static getDefaultRateLimitConfig(): RateLimitConfig {
    return {
      maxRequestsPerSecond: 1,
      maxRequestsPerMinute: 30,
      maxRequestsPerHour: 1000,
      retryAfter: 60000,
      backoffMultiplier: 2,
      maxRetries: 3,
      respectRateLimitHeaders: true,
    };
  }

  /**
   * Create multiple platform instances
   */
  static async createMultiple(
    platforms: Platform[],
    options: FactoryOptions = {},
  ): Promise<Map<Platform, BasePlatform>> {
    const instances = new Map<Platform, BasePlatform>();

    for (const platform of platforms) {
      try {
        const instance = await this.create(platform, options);
        instances.set(platform, instance);
      } catch (error) {
        this.logger.error(`Failed to create platform "${platform}":`, error);
      }
    }

    return instances;
  }

  /**
   * Test connection for a platform without keeping the instance
   */
  static async testPlatform(
    platform: Platform,
    config: BasePlatformConfig = {},
  ): Promise<boolean> {
    try {
      const instance = await this.create(platform, {
        config,
        initialize: true,
      });
      return await instance.testConnection();
    } catch (error) {
      this.logger.error(
        `Platform "${platform}" connection test failed:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get capabilities for a platform without creating an instance
   */
  static async getCapabilities(platform: Platform) {
    const instance = await this.create(platform, { initialize: false });
    return instance.getCapabilities();
  }

  /**
   * Set default logger for factory
   */
  static setLogger(logger: winston.Logger): void {
    this.logger = logger;
  }

  /**
   * Set default config manager for factory
   */
  static setConfigManager(configManager: ConfigManager): void {
    this.configManager = configManager;
  }

  /**
   * Create platform from configuration file
   */
  static async createFromConfig(
    configPath?: string,
    overrides?: Partial<FactoryOptions>,
  ): Promise<BasePlatform> {
    const configManager = new ConfigManager(configPath);
    const config = configManager.loadConfig();

    return this.create(config.platform, {
      scraperConfig: config,
      configManager,
      ...overrides,
    });
  }

  /**
   * Create platform with minimal configuration
   */
  static async createMinimal(
    platform: Platform,
    apiKey?: string,
    clientCredentials?: { clientId: string; clientSecret: string },
  ): Promise<BasePlatform> {
    const config: BasePlatformConfig = {};

    if (apiKey) {
      config.apiKey = apiKey;
    }
    if (clientCredentials) {
      config.clientId = clientCredentials.clientId;
      config.clientSecret = clientCredentials.clientSecret;
    }

    return this.create(platform, {
      config,
      initialize: true,
      useRateLimiter: true,
    });
  }

  /**
   * Validate platform configuration before creation
   */
  static validateConfiguration(
    platform: Platform,
    config: BasePlatformConfig,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Platform-specific validation
    if (platform === "reddit") {
      if (!config.clientId || !config.clientSecret) {
        errors.push("Reddit requires clientId and clientSecret");
      }
    }

    // Common validation
    if (config.timeout && config.timeout < 1000) {
      errors.push("Timeout must be at least 1000ms");
    }

    if (config.rateLimitPerMinute && config.rateLimitPerMinute < 1) {
      errors.push("Rate limit must be at least 1 request per minute");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get platform requirements
   */
  static getPlatformRequirements(platform: Platform): {
    required: string[];
    optional: string[];
  } {
    const requirements: Record<
      Platform,
      { required: string[]; optional: string[] }
    > = {
      reddit: {
        required: ["clientId", "clientSecret"],
        optional: ["username", "password", "userAgent", "refreshToken"],
      },
      hackernews: {
        required: [],
        optional: ["baseUrl", "userAgent"],
      },
      discourse: {
        required: ["baseUrl", "apiKey"],
        optional: ["username", "userAgent"],
      },
      lemmy: {
        required: ["baseUrl"],
        optional: ["username", "password", "userAgent"],
      },
      lobsters: {
        required: [],
        optional: ["baseUrl", "userAgent"],
      },
      custom: {
        required: ["baseUrl"],
        optional: ["apiKey", "userAgent", "headers"],
      },
    };

    return requirements[platform] || { required: [], optional: [] };
  }
}
