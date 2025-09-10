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
    if (source.hasOwnProperty(key)) {
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
