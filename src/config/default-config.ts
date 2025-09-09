import { Platform } from "../types/platforms.js";

/**
 * Default configuration for the fscrape application
 */
export const defaultConfig = {
  // Database configuration
  database: {
    path: "./fscrape.db",
    enableWAL: true,
    busyTimeout: 5000,
    cacheSize: 10000,
    synchronous: "NORMAL" as "OFF" | "NORMAL" | "FULL" | "EXTRA",
  },

  // Scraping configuration
  scraping: {
    // Rate limiting per platform
    rateLimit: {
      reddit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        backoffMultiplier: 2,
        maxBackoffMs: 60000,
      },
      hackernews: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
        backoffMultiplier: 1.5,
        maxBackoffMs: 30000,
      },
    },

    // Session configuration
    session: {
      defaultBatchSize: 25,
      maxBatchSize: 100,
      timeoutMs: 30000,
      maxRetries: 3,
      resumeOnError: true,
    },

    // Content filtering
    filters: {
      minScore: 0,
      minComments: 0,
      maxAgeDays: null,
      excludeDeleted: true,
      excludeRemoved: true,
    },
  },

  // API configuration
  api: {
    reddit: {
      userAgent: "fscrape/1.0.0",
      clientId: process.env.REDDIT_CLIENT_ID || "",
      clientSecret: process.env.REDDIT_CLIENT_SECRET || "",
      refreshToken: process.env.REDDIT_REFRESH_TOKEN || "",
    },
    hackernews: {
      baseUrl: "https://hacker-news.firebaseio.com/v0",
      algoliaUrl: "https://hn.algolia.com/api/v1",
    },
  },

  // Logging configuration
  logging: {
    level: "info" as "debug" | "info" | "warn" | "error",
    format: "pretty" as "json" | "pretty",
    destination: "console" as "console" | "file" | "both",
    filePath: "./logs/fscrape.log",
    maxFileSize: "10MB",
    maxFiles: 5,
  },

  // Cache configuration
  cache: {
    enabled: true,
    ttlSeconds: 300,
    maxSize: 1000,
    strategy: "lru" as "lru" | "fifo",
  },

  // Export configuration
  export: {
    defaultFormat: "json" as "json" | "csv" | "markdown",
    prettify: true,
    includeMetadata: false,
    outputDir: "./exports",
  },

  // CLI configuration
  cli: {
    defaultPlatform: "reddit" as Platform,
    defaultLimit: 100,
    interactive: true,
    showProgress: true,
    confirmDestructive: true,
  },

  // Development configuration
  development: {
    debug: false,
    verbose: false,
    dryRun: false,
    mockApi: false,
  },
};

export type Config = typeof defaultConfig;