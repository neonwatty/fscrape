import { z } from "zod";
import { Platform } from "../types/platforms.js";

/**
 * Zod schemas for configuration validation
 */

// Database configuration schema
const DatabaseConfigSchema = z.object({
  path: z.string().min(1),
  enableWAL: z.boolean().default(true),
  busyTimeout: z.number().positive().default(5000),
  cacheSize: z.number().positive().default(10000),
  synchronous: z.enum(["OFF", "NORMAL", "FULL", "EXTRA"]).default("NORMAL"),
});

// Rate limit configuration schema
const RateLimitConfigSchema = z.object({
  requestsPerMinute: z.number().positive(),
  requestsPerHour: z.number().positive(),
  backoffMultiplier: z.number().min(1).default(2),
  maxBackoffMs: z.number().positive().default(60000),
});

// Session configuration schema
const SessionConfigSchema = z.object({
  defaultBatchSize: z.number().positive().max(100).default(25),
  maxBatchSize: z.number().positive().max(1000).default(100),
  timeoutMs: z.number().positive().default(30000),
  maxRetries: z.number().min(0).max(10).default(3),
  resumeOnError: z.boolean().default(true),
});

// Content filter configuration schema
const FilterConfigSchema = z.object({
  minScore: z.number().default(0),
  minComments: z.number().min(0).default(0),
  maxAgeDays: z.number().positive().nullable().default(null),
  excludeDeleted: z.boolean().default(true),
  excludeRemoved: z.boolean().default(true),
});

// Scraping configuration schema
const ScrapingConfigSchema = z.object({
  rateLimit: z.object({
    reddit: RateLimitConfigSchema,
    hackernews: RateLimitConfigSchema,
  }),
  session: SessionConfigSchema,
  filters: FilterConfigSchema,
});

// Reddit API configuration schema
const RedditApiConfigSchema = z.object({
  userAgent: z.string().min(1),
  clientId: z.string().default(""),
  clientSecret: z.string().default(""),
  refreshToken: z.string().default(""),
});

// HackerNews API configuration schema
const HackerNewsApiConfigSchema = z.object({
  baseUrl: z.string().url(),
  algoliaUrl: z.string().url(),
});

// API configuration schema
const ApiConfigSchema = z.object({
  reddit: RedditApiConfigSchema,
  hackernews: HackerNewsApiConfigSchema,
});

// Logging configuration schema
const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  format: z.enum(["json", "pretty"]).default("pretty"),
  destination: z.enum(["console", "file", "both"]).default("console"),
  filePath: z.string().default("./logs/fscrape.log"),
  maxFileSize: z
    .string()
    .regex(/^\d+[KMG]?B$/)
    .default("10MB"),
  maxFiles: z.number().positive().max(100).default(5),
});

// Cache configuration schema
const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttlSeconds: z.number().positive().default(300),
  maxSize: z.number().positive().max(10000).default(1000),
  strategy: z.enum(["lru", "fifo"]).default("lru"),
});

// Export configuration schema
const ExportConfigSchema = z.object({
  defaultFormat: z.enum(["json", "csv", "markdown"]).default("json"),
  prettify: z.boolean().default(true),
  includeMetadata: z.boolean().default(false),
  outputDir: z.string().default("./exports"),
});

// CLI configuration schema
const CliConfigSchema = z.object({
  defaultPlatform: z.nativeEnum(Platform).default(Platform.Reddit),
  defaultLimit: z.number().positive().max(10000).default(100),
  interactive: z.boolean().default(true),
  showProgress: z.boolean().default(true),
  confirmDestructive: z.boolean().default(true),
});

// Development configuration schema
const DevelopmentConfigSchema = z.object({
  debug: z.boolean().default(false),
  verbose: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  mockApi: z.boolean().default(false),
});

// Analytics cache configuration schema
const AnalyticsCacheSchema = z.object({
  enabled: z.boolean().default(true),
  defaultTTL: z.number().positive().default(300000),
  maxSize: z.number().positive().default(52428800),
  maxEntries: z.number().positive().default(1000),
  cleanupInterval: z.number().positive().default(60000),
  compressionThreshold: z.number().positive().default(1024),
  strategy: z.enum(["lru", "fifo", "lfu"]).default("lru"),
  backgroundRefresh: z.boolean().default(false),
  ttlVariation: z.number().min(0).max(1).default(0.1),
});

// Analytics computation configuration schema
const AnalyticsComputationSchema = z.object({
  maxDataPoints: z.number().positive().default(100000),
  samplingThreshold: z.number().positive().default(10000),
  parallelProcessing: z.boolean().default(true),
  workerThreads: z.number().positive().default(4),
  timeoutMs: z.number().positive().default(30000),
  precision: z.number().positive().default(4),
  optimizationLevel: z.number().min(0).max(2).default(2),
});

// Analytics visualization configuration schema
const AnalyticsVisualizationSchema = z.object({
  defaultChartType: z.enum(["line", "bar", "pie", "scatter", "heatmap"]).default("line"),
  maxSeriesPoints: z.number().positive().default(1000),
  enableInteractive: z.boolean().default(true),
  colorScheme: z.enum(["default", "dark", "colorblind", "monochrome"]).default("default"),
  exportFormats: z.array(z.enum(["png", "svg", "json", "csv"])).default(["png", "svg", "json"]),
  animationDuration: z.number().positive().default(750),
  responsiveResize: z.boolean().default(true),
});

// Analytics performance configuration schema
const AnalyticsPerformanceSchema = z.object({
  enableProfiling: z.boolean().default(false),
  metricsInterval: z.number().positive().default(5000),
  slowQueryThreshold: z.number().positive().default(1000),
  enableOptimizations: z.boolean().default(true),
  memoryLimit: z.number().positive().default(512),
  gcInterval: z.number().positive().default(300000),
});

// Analytics statistics configuration schema
const AnalyticsStatisticsSchema = z.object({
  confidenceLevel: z.number().min(0).max(1).default(0.95),
  significanceLevel: z.number().min(0).max(1).default(0.05),
  bootstrapSamples: z.number().positive().default(1000),
  outlierMethod: z.enum(["iqr", "zscore", "isolation"]).default("iqr"),
  outlierThreshold: z.number().positive().default(1.5),
});

// Analytics trends configuration schema
const AnalyticsTrendsSchema = z.object({
  minDataPoints: z.number().positive().default(10),
  smoothingWindow: z.number().positive().default(7),
  seasonalityDetection: z.boolean().default(true),
  trendStrengthThreshold: z.number().min(0).max(1).default(0.7),
});

// Analytics anomalies configuration schema
const AnalyticsAnomaliesSchema = z.object({
  enabled: z.boolean().default(true),
  method: z.enum(["isolation", "zscore", "mad", "ensemble"]).default("isolation"),
  sensitivity: z.number().min(0).max(1).default(0.5),
  minSamples: z.number().positive().default(30),
  lookbackWindow: z.number().positive().default(100),
});

// Analytics forecasting configuration schema
const AnalyticsForecastingSchema = z.object({
  defaultMethod: z.enum(["auto", "arima", "exponential", "linear"]).default("auto"),
  horizonDays: z.number().positive().default(7),
  confidenceIntervals: z.array(z.number().min(0).max(1)).default([0.80, 0.95]),
  maxModelComplexity: z.number().min(1).max(5).default(3),
});

// Complete analytics configuration schema
const AnalyticsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cache: AnalyticsCacheSchema,
  computation: AnalyticsComputationSchema,
  visualization: AnalyticsVisualizationSchema,
  performance: AnalyticsPerformanceSchema,
  statistics: AnalyticsStatisticsSchema,
  trends: AnalyticsTrendsSchema,
  anomalies: AnalyticsAnomaliesSchema,
  forecasting: AnalyticsForecastingSchema,
});

// Base schemas without defaults for partial validation
const DevelopmentConfigSchemaBase = z.object({
  debug: z.boolean(),
  verbose: z.boolean(),
  dryRun: z.boolean(),
  mockApi: z.boolean(),
});

/**
 * Complete configuration schema
 */
export const ConfigSchema = z.object({
  database: DatabaseConfigSchema.default({
    path: "./fscrape.db",
    enableWAL: true,
    busyTimeout: 5000,
    cacheSize: 10000,
    synchronous: "NORMAL",
  }),
  scraping: ScrapingConfigSchema.default({
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
    session: {
      defaultBatchSize: 25,
      maxBatchSize: 100,
      timeoutMs: 30000,
      maxRetries: 3,
      resumeOnError: true,
    },
    filters: {
      minScore: 0,
      minComments: 0,
      maxAgeDays: null,
      excludeDeleted: true,
      excludeRemoved: true,
    },
  }),
  api: ApiConfigSchema.default({
    reddit: {
      userAgent: "fscrape/1.0.0",
      clientId: "",
      clientSecret: "",
      refreshToken: "",
    },
    hackernews: {
      baseUrl: "https://hacker-news.firebaseio.com/v0",
      algoliaUrl: "https://hn.algolia.com/api/v1",
    },
  }),
  logging: LoggingConfigSchema.default({
    level: "info",
    format: "pretty",
    destination: "console",
    filePath: "./logs/fscrape.log",
    maxFileSize: "10MB",
    maxFiles: 5,
  }),
  cache: CacheConfigSchema.default({
    enabled: true,
    ttlSeconds: 300,
    maxSize: 1000,
    strategy: "lru",
  }),
  export: ExportConfigSchema.default({
    defaultFormat: "json",
    prettify: true,
    includeMetadata: false,
    outputDir: "./exports",
  }),
  cli: CliConfigSchema.default({
    defaultPlatform: Platform.Reddit,
    defaultLimit: 100,
    interactive: true,
    showProgress: true,
    confirmDestructive: true,
  }),
  development: DevelopmentConfigSchema.default({
    debug: false,
    verbose: false,
    dryRun: false,
    mockApi: false,
  }),
  analytics: AnalyticsConfigSchema.default({
    enabled: true,
    cache: {
      enabled: true,
      defaultTTL: 300000,
      maxSize: 52428800,
      maxEntries: 1000,
      cleanupInterval: 60000,
      compressionThreshold: 1024,
      strategy: "lru",
      backgroundRefresh: false,
      ttlVariation: 0.1,
    },
    computation: {
      maxDataPoints: 100000,
      samplingThreshold: 10000,
      parallelProcessing: true,
      workerThreads: 4,
      timeoutMs: 30000,
      precision: 4,
      optimizationLevel: 2,
    },
    visualization: {
      defaultChartType: "line",
      maxSeriesPoints: 1000,
      enableInteractive: true,
      colorScheme: "default",
      exportFormats: ["png", "svg", "json"],
      animationDuration: 750,
      responsiveResize: true,
    },
    performance: {
      enableProfiling: false,
      metricsInterval: 5000,
      slowQueryThreshold: 1000,
      enableOptimizations: true,
      memoryLimit: 512,
      gcInterval: 300000,
    },
    statistics: {
      confidenceLevel: 0.95,
      significanceLevel: 0.05,
      bootstrapSamples: 1000,
      outlierMethod: "iqr",
      outlierThreshold: 1.5,
    },
    trends: {
      minDataPoints: 10,
      smoothingWindow: 7,
      seasonalityDetection: true,
      trendStrengthThreshold: 0.7,
    },
    anomalies: {
      enabled: true,
      method: "isolation",
      sensitivity: 0.5,
      minSamples: 30,
      lookbackWindow: 100,
    },
    forecasting: {
      defaultMethod: "auto",
      horizonDays: 7,
      confidenceIntervals: [0.80, 0.95],
      maxModelComplexity: 3,
    },
  }),
});

/**
 * Base configuration schema without defaults for partial validation
 */
const ConfigSchemaBase = z.object({
  database: z.object({
    path: z.string().min(1),
    enableWAL: z.boolean(),
    busyTimeout: z.number().positive(),
    cacheSize: z.number().positive(),
    synchronous: z.enum(["OFF", "NORMAL", "FULL", "EXTRA"]),
  }),
  scraping: z.object({
    rateLimit: z.object({
      reddit: z.object({
        requestsPerMinute: z.number().positive(),
        requestsPerHour: z.number().positive(),
        backoffMultiplier: z.number().min(1),
        maxBackoffMs: z.number().positive(),
      }),
      hackernews: z.object({
        requestsPerMinute: z.number().positive(),
        requestsPerHour: z.number().positive(),
        backoffMultiplier: z.number().min(1),
        maxBackoffMs: z.number().positive(),
      }),
    }),
    session: z.object({
      defaultBatchSize: z.number().positive().max(100),
      maxBatchSize: z.number().positive().max(1000),
      timeoutMs: z.number().positive(),
      maxRetries: z.number().min(0).max(10),
      resumeOnError: z.boolean(),
    }),
    filters: z.object({
      minScore: z.number(),
      minComments: z.number().min(0),
      maxAgeDays: z.number().positive().nullable(),
      excludeDeleted: z.boolean(),
      excludeRemoved: z.boolean(),
    }),
  }),
  api: z.object({
    reddit: z.object({
      userAgent: z.string().min(1),
      clientId: z.string(),
      clientSecret: z.string(),
      refreshToken: z.string(),
    }),
    hackernews: z.object({
      baseUrl: z.string().url(),
      algoliaUrl: z.string().url(),
    }),
  }),
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]),
    format: z.enum(["json", "pretty"]),
    destination: z.enum(["console", "file", "both"]),
    filePath: z.string(),
    maxFileSize: z.string().regex(/^\d+[KMG]?B$/),
    maxFiles: z.number().positive().max(100),
  }),
  cache: z.object({
    enabled: z.boolean(),
    ttlSeconds: z.number().positive(),
    maxSize: z.number().positive().max(10000),
    strategy: z.enum(["lru", "fifo"]),
  }),
  export: z.object({
    defaultFormat: z.enum(["json", "csv", "markdown"]),
    prettify: z.boolean(),
    includeMetadata: z.boolean(),
    outputDir: z.string(),
  }),
  cli: z.object({
    defaultPlatform: z.nativeEnum(Platform),
    defaultLimit: z.number().positive().max(10000),
    interactive: z.boolean(),
    showProgress: z.boolean(),
    confirmDestructive: z.boolean(),
  }),
  development: DevelopmentConfigSchemaBase,
  analytics: z.object({
    enabled: z.boolean(),
    cache: z.object({
      enabled: z.boolean(),
      defaultTTL: z.number().positive(),
      maxSize: z.number().positive(),
      maxEntries: z.number().positive(),
      cleanupInterval: z.number().positive(),
      compressionThreshold: z.number().positive(),
      strategy: z.enum(["lru", "fifo", "lfu"]),
      backgroundRefresh: z.boolean(),
      ttlVariation: z.number().min(0).max(1),
    }),
    computation: z.object({
      maxDataPoints: z.number().positive(),
      samplingThreshold: z.number().positive(),
      parallelProcessing: z.boolean(),
      workerThreads: z.number().positive(),
      timeoutMs: z.number().positive(),
      precision: z.number().positive(),
      optimizationLevel: z.number().min(0).max(2),
    }),
    visualization: z.object({
      defaultChartType: z.enum(["line", "bar", "pie", "scatter", "heatmap"]),
      maxSeriesPoints: z.number().positive(),
      enableInteractive: z.boolean(),
      colorScheme: z.enum(["default", "dark", "colorblind", "monochrome"]),
      exportFormats: z.array(z.enum(["png", "svg", "json", "csv"])),
      animationDuration: z.number().positive(),
      responsiveResize: z.boolean(),
    }),
    performance: z.object({
      enableProfiling: z.boolean(),
      metricsInterval: z.number().positive(),
      slowQueryThreshold: z.number().positive(),
      enableOptimizations: z.boolean(),
      memoryLimit: z.number().positive(),
      gcInterval: z.number().positive(),
    }),
    statistics: z.object({
      confidenceLevel: z.number().min(0).max(1),
      significanceLevel: z.number().min(0).max(1),
      bootstrapSamples: z.number().positive(),
      outlierMethod: z.enum(["iqr", "zscore", "isolation"]),
      outlierThreshold: z.number().positive(),
    }),
    trends: z.object({
      minDataPoints: z.number().positive(),
      smoothingWindow: z.number().positive(),
      seasonalityDetection: z.boolean(),
      trendStrengthThreshold: z.number().min(0).max(1),
    }),
    anomalies: z.object({
      enabled: z.boolean(),
      method: z.enum(["isolation", "zscore", "mad", "ensemble"]),
      sensitivity: z.number().min(0).max(1),
      minSamples: z.number().positive(),
      lookbackWindow: z.number().positive(),
    }),
    forecasting: z.object({
      defaultMethod: z.enum(["auto", "arima", "exponential", "linear"]),
      horizonDays: z.number().positive(),
      confidenceIntervals: z.array(z.number().min(0).max(1)),
      maxModelComplexity: z.number().min(1).max(5),
    }),
  }),
});

/**
 * Partial configuration schema for merging
 * All fields are optional to support partial configs
 */
export const PartialConfigSchema = ConfigSchemaBase.deepPartial();

/**
 * Configuration types
 */
export type Config = z.infer<typeof ConfigSchema>;
export type PartialConfig = z.infer<typeof PartialConfigSchema>;

/**
 * Validates a complete configuration object
 */
export function validateConfig(config: unknown): Config {
  return ConfigSchema.parse(config);
}

/**
 * Validates a partial configuration object
 */
export function validatePartialConfig(config: unknown): PartialConfig {
  return PartialConfigSchema.parse(config);
}

/**
 * Safely validates configuration without throwing
 */
export function safeValidateConfig(config: unknown): {
  success: boolean;
  data?: Config;
  error?: z.ZodError;
} {
  const result = ConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Default configuration values for merging
 */
const configDefaults = {
  database: {
    path: "./fscrape.db",
    enableWAL: true,
    busyTimeout: 5000,
    cacheSize: 10000,
    synchronous: "NORMAL" as const,
  },
  scraping: {
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
    session: {
      defaultBatchSize: 25,
      maxBatchSize: 100,
      timeoutMs: 30000,
      maxRetries: 3,
      resumeOnError: true,
    },
    filters: {
      minScore: 0,
      minComments: 0,
      maxAgeDays: null,
      excludeDeleted: true,
      excludeRemoved: true,
    },
  },
  api: {
    reddit: {
      userAgent: "fscrape/1.0.0",
      clientId: "",
      clientSecret: "",
      refreshToken: "",
    },
    hackernews: {
      baseUrl: "https://hacker-news.firebaseio.com/v0",
      algoliaUrl: "https://hn.algolia.com/api/v1",
    },
  },
  logging: {
    level: "info" as const,
    format: "pretty" as const,
    destination: "console" as const,
    filePath: "./logs/fscrape.log",
    maxFileSize: "10MB",
    maxFiles: 5,
  },
  cache: {
    enabled: true,
    ttlSeconds: 300,
    maxSize: 1000,
    strategy: "lru" as const,
  },
  export: {
    defaultFormat: "json" as const,
    prettify: true,
    includeMetadata: false,
    outputDir: "./exports",
  },
  cli: {
    defaultPlatform: Platform.Reddit,
    defaultLimit: 100,
    interactive: true,
    showProgress: true,
    confirmDestructive: true,
  },
  development: {
    debug: false,
    verbose: false,
    dryRun: false,
    mockApi: false,
  },
  analytics: {
    enabled: true,
    cache: {
      enabled: true,
      defaultTTL: 300000,
      maxSize: 52428800,
      maxEntries: 1000,
      cleanupInterval: 60000,
      compressionThreshold: 1024,
      strategy: "lru" as const,
      backgroundRefresh: false,
      ttlVariation: 0.1,
    },
    computation: {
      maxDataPoints: 100000,
      samplingThreshold: 10000,
      parallelProcessing: true,
      workerThreads: 4,
      timeoutMs: 30000,
      precision: 4,
      optimizationLevel: 2,
    },
    visualization: {
      defaultChartType: "line" as const,
      maxSeriesPoints: 1000,
      enableInteractive: true,
      colorScheme: "default" as const,
      exportFormats: ["png", "svg", "json"] as const,
      animationDuration: 750,
      responsiveResize: true,
    },
    performance: {
      enableProfiling: false,
      metricsInterval: 5000,
      slowQueryThreshold: 1000,
      enableOptimizations: true,
      memoryLimit: 512,
      gcInterval: 300000,
    },
    statistics: {
      confidenceLevel: 0.95,
      significanceLevel: 0.05,
      bootstrapSamples: 1000,
      outlierMethod: "iqr" as const,
      outlierThreshold: 1.5,
    },
    trends: {
      minDataPoints: 10,
      smoothingWindow: 7,
      seasonalityDetection: true,
      trendStrengthThreshold: 0.7,
    },
    anomalies: {
      enabled: true,
      method: "isolation" as const,
      sensitivity: 0.5,
      minSamples: 30,
      lookbackWindow: 100,
    },
    forecasting: {
      defaultMethod: "auto" as const,
      horizonDays: 7,
      confidenceIntervals: [0.80, 0.95],
      maxModelComplexity: 3,
    },
  },
};

/**
 * Merges multiple partial configurations with proper precedence
 * Later configs override earlier ones
 */
export function mergeConfigs(...configs: PartialConfig[]): Config {
  // Start with defaults and merge all configs
  const merged = configs.reduce(
    (acc, config) => {
      return deepMerge(acc, config);
    },
    deepMerge({}, configDefaults),
  );

  // Validate the final merged config
  return ConfigSchema.parse(merged);
}

/**
 * Deep merge utility for configuration objects
 */
function deepMerge(target: any, source: any): any {
  if (source === undefined || source === null) {
    return target;
  }

  if (typeof source !== "object" || Array.isArray(source)) {
    return source;
  }

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof result[key] === "object" &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}
