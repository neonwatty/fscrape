import type { Platform } from "../types/core.js";
import type { BasePlatform, BasePlatformConfig } from "./base-platform.js";
import { PlatformRegistry } from "./platform-registry.js";
import winston from "winston";

/**
 * Platform constructor type
 */
export type PlatformConstructor = new (
  config: BasePlatformConfig,
  logger?: winston.Logger,
) => BasePlatform;

/**
 * Factory options for creating platform instances
 */
export interface FactoryOptions {
  config?: BasePlatformConfig;
  logger?: winston.Logger;
  initialize?: boolean;
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

  /**
   * Create a platform instance
   */
  static async create(
    platform: Platform,
    options: FactoryOptions = {},
  ): Promise<BasePlatform> {
    const { config = {}, logger = this.logger, initialize = true } = options;

    // Get the platform constructor from registry
    const PlatformClass = PlatformRegistry.get(platform);
    if (!PlatformClass) {
      throw new Error(
        `Platform "${platform}" is not registered. Available platforms: ${PlatformRegistry.list().join(
          ", ",
        )}`,
      );
    }

    // Create platform instance
    const instance = new PlatformClass(config, logger);

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
}
