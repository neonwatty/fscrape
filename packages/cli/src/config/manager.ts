import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import dotenv from 'dotenv';
import {
  ScraperConfigSchema,
  type ScraperConfig,
  type DatabaseConfig,
  type RateLimitConfig,
  type CacheConfig,
  type ExportConfig,
  type LoggingConfig,
  type ProxyConfig,
} from '../types/config.js';
import type { Platform } from '../types/core.js';

export class ConfigManager {
  private config: ScraperConfig | null = null;
  private configPath: string;
  private envLoaded = false;

  constructor(configPath?: string) {
    this.configPath = configPath || this.findConfigFile();
  }

  private findConfigFile(): string {
    const possiblePaths = [
      '.fscraperс',
      '.fscraper.json',
      'fscraper.config.json',
      path.join(process.cwd(), '.fscraperс'),
      path.join(process.cwd(), '.fscraper.json'),
      path.join(process.cwd(), 'fscraper.config.json'),
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    // Return default path if no config found
    return '.fscraperс';
  }

  loadConfig(): ScraperConfig {
    if (this.config) {
      return this.config;
    }

    // Load environment variables first
    if (!this.envLoaded) {
      dotenv.config();
      this.envLoaded = true;
    }

    // Start with default configuration
    let configData: Partial<ScraperConfig> = this.getDefaultConfig();

    // Try to load from file
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        configData = this.mergeConfigs(configData, fileConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${this.configPath}:`, error);
      }
    }

    // Override with environment variables
    configData = this.applyEnvironmentOverrides(configData);

    // Validate configuration
    try {
      this.config = ScraperConfigSchema.parse(configData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid configuration: ${error.errors.map((e) => e.message).join(', ')}`);
      }
      throw error;
    }

    return this.config;
  }

  private getDefaultConfig(): Partial<ScraperConfig> {
    return {
      platform: 'reddit' as Platform,
      userAgent: 'fscrape/1.0',
      timeout: 30000,
      maxConcurrent: 5,
      followRedirects: true,
      validateSSL: true,
      database: {
        type: 'sqlite',
        path: './data/fscrape.db',
        connectionPoolSize: 10,
      },
      rateLimit: {
        maxRequestsPerSecond: 1,
        maxRequestsPerMinute: 30,
        maxRequestsPerHour: 1000,
        retryAfter: 60000,
        backoffMultiplier: 2,
        maxRetries: 3,
        respectRateLimitHeaders: true,
      },
      cache: {
        enabled: true,
        ttl: 3600000,
        maxSize: 100,
        strategy: 'lru',
        persistToFile: false,
      },
      export: {
        format: 'json',
        outputDir: './output',
        includeComments: false,
        includeUsers: false,
        prettify: true,
        compression: 'none',
      },
      logging: {
        level: 'info',
        console: true,
        format: 'pretty',
        maxFiles: 5,
        maxSize: '10m',
      },
    };
  }

  private mergeConfigs(
    base: Partial<ScraperConfig>,
    override: Partial<ScraperConfig>
  ): Partial<ScraperConfig> {
    const merged: Partial<ScraperConfig> = { ...base };

    for (const key in override) {
      const overrideValue = (override as Record<string, unknown>)[key];

      if (overrideValue !== undefined && overrideValue !== null) {
        if (typeof overrideValue === 'object' && !Array.isArray(overrideValue)) {
          // Recursively merge nested objects
          merged[key as keyof ScraperConfig] = {
            ...(((base as Record<string, unknown>)[key] as Record<string, unknown>) || {}),
            ...overrideValue,
          } as any;
        } else {
          merged[key as keyof ScraperConfig] = overrideValue as any;
        }
      }
    }

    return merged as Partial<ScraperConfig>;
  }

  private applyEnvironmentOverrides(config: Partial<ScraperConfig>): Partial<ScraperConfig> {
    // Platform
    if (process.env.FSCRAPE_PLATFORM) {
      config.platform = process.env.FSCRAPE_PLATFORM as Platform;
    }

    // Database
    if (process.env.FSCRAPE_DB_PATH) {
      if (!config.database) {
        config.database = {
          type: 'sqlite',
          path: process.env.FSCRAPE_DB_PATH,
          connectionPoolSize: 10,
        };
      } else {
        (config.database as DatabaseConfig).path = process.env.FSCRAPE_DB_PATH;
      }
    }

    // Rate limiting
    if (process.env.FSCRAPE_RATE_LIMIT) {
      const rateLimit = parseInt(process.env.FSCRAPE_RATE_LIMIT, 10);
      if (!isNaN(rateLimit)) {
        if (!config.rateLimit) {
          config.rateLimit = this.getDefaultConfig().rateLimit as RateLimitConfig;
        }
        (config.rateLimit as RateLimitConfig).maxRequestsPerSecond = rateLimit;
      }
    }

    // Logging
    if (process.env.FSCRAPE_LOG_LEVEL) {
      if (!config.logging) {
        config.logging = this.getDefaultConfig().logging as LoggingConfig;
      }
      (config.logging as LoggingConfig).level = process.env.FSCRAPE_LOG_LEVEL as
        | 'debug'
        | 'info'
        | 'warn'
        | 'error';
    }

    // Proxy
    if (process.env.FSCRAPE_PROXY_URL) {
      if (!config.proxy) {
        config.proxy = {
          enabled: true,
          url: process.env.FSCRAPE_PROXY_URL,
          rotateProxies: false,
        };
      } else {
        (config.proxy as ProxyConfig).enabled = true;
        (config.proxy as ProxyConfig).url = process.env.FSCRAPE_PROXY_URL;
      }
    }

    // User agent
    if (process.env.FSCRAPE_USER_AGENT) {
      config.userAgent = process.env.FSCRAPE_USER_AGENT;
    }

    return config;
  }

  saveConfig(config?: ScraperConfig): void {
    const configToSave = config || this.config;

    if (!configToSave) {
      throw new Error('No configuration to save');
    }

    const configJson = JSON.stringify(configToSave, null, 2);
    fs.writeFileSync(this.configPath, configJson, 'utf-8');
  }

  updateConfig(updates: Partial<ScraperConfig>): ScraperConfig {
    const currentConfig = this.loadConfig();
    this.config = this.mergeConfigs(currentConfig, updates) as ScraperConfig;

    // Re-validate
    this.config = ScraperConfigSchema.parse(this.config);

    return this.config;
  }

  getConfig(): ScraperConfig {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config!;
  }

  getDatabaseConfig(): DatabaseConfig {
    const config = this.getConfig();
    return config.database || (this.getDefaultConfig().database as DatabaseConfig);
  }

  getRateLimitConfig(): RateLimitConfig {
    const config = this.getConfig();
    return config.rateLimit || (this.getDefaultConfig().rateLimit as RateLimitConfig);
  }

  getCacheConfig(): CacheConfig {
    const config = this.getConfig();
    return config.cache || (this.getDefaultConfig().cache as CacheConfig);
  }

  getExportConfig(): ExportConfig {
    const config = this.getConfig();
    return config.export || (this.getDefaultConfig().export as ExportConfig);
  }

  getLoggingConfig(): LoggingConfig {
    const config = this.getConfig();
    return config.logging || (this.getDefaultConfig().logging as LoggingConfig);
  }

  getProxyConfig(): ProxyConfig | undefined {
    return this.getConfig().proxy;
  }

  // Utility method to create example config
  static createExampleConfig(): string {
    const example: Partial<ScraperConfig> = {
      platform: 'reddit',
      userAgent: 'fscrape/1.0 (https://github.com/yourusername/fscrape)',
      timeout: 30000,
      maxConcurrent: 5,
      database: {
        type: 'sqlite',
        path: './data/fscrape.db',
        connectionPoolSize: 10,
      },
      rateLimit: {
        maxRequestsPerSecond: 1,
        maxRequestsPerMinute: 30,
        maxRequestsPerHour: 1000,
        retryAfter: 60000,
        backoffMultiplier: 2,
        maxRetries: 3,
        respectRateLimitHeaders: true,
      },
      cache: {
        enabled: true,
        ttl: 3600000,
        maxSize: 100,
        strategy: 'lru',
        persistToFile: false,
      },
      export: {
        format: 'json',
        outputDir: './output',
        includeComments: true,
        includeUsers: true,
        prettify: true,
        compression: 'none',
      },
      logging: {
        level: 'info',
        console: true,
        format: 'pretty',
        maxFiles: 5,
        maxSize: '10m',
      },
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    };

    return JSON.stringify(example, null, 2);
  }
}
