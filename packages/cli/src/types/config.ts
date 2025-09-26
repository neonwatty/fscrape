import { z } from 'zod';
import type { Platform, SortOption, TimeRange } from './core.js';

// Rate Limit Configuration Schema and Type
export const RateLimitConfigSchema = z.object({
  maxRequestsPerSecond: z.number().positive().default(1),
  maxRequestsPerMinute: z.number().positive().default(30),
  maxRequestsPerHour: z.number().positive().default(1000),
  retryAfter: z.number().positive().default(60000), // milliseconds
  backoffMultiplier: z.number().positive().default(2),
  maxRetries: z.number().int().nonnegative().default(3),
  respectRateLimitHeaders: z.boolean().default(true),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

// Cache Configuration Schema and Type
export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().positive().default(3600000), // 1 hour in milliseconds
  maxSize: z.number().positive().default(100), // max items in cache
  strategy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  persistToFile: z.boolean().default(false),
  cacheDir: z.string().optional(),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

// Proxy Configuration Schema and Type
export const ProxyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().url().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  rotateProxies: z.boolean().default(false),
  proxyList: z.array(z.string().url()).optional(),
});

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;

// Database Configuration Schema and Type
export const DatabaseConfigSchema = z.object({
  type: z.enum(['sqlite', 'postgresql', 'mysql']).default('sqlite'),
  path: z.string().default('./data/fscrape.db'),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
  connectionPoolSize: z.number().int().positive().default(10),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// Export Configuration Schema and Type
export const ExportConfigSchema = z.object({
  format: z.enum(['json', 'csv', 'jsonl', 'sqlite']).default('json'),
  outputDir: z.string().default('./output'),
  filename: z.string().optional(),
  includeComments: z.boolean().default(false),
  includeUsers: z.boolean().default(false),
  prettify: z.boolean().default(true),
  compression: z.enum(['none', 'gzip', 'zip']).default('none'),
});

export type ExportConfig = z.infer<typeof ExportConfigSchema>;

// Logging Configuration Schema and Type
export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  file: z.string().optional(),
  console: z.boolean().default(true),
  format: z.enum(['json', 'simple', 'pretty']).default('pretty'),
  maxFiles: z.number().int().positive().default(5),
  maxSize: z.string().default('10m'), // e.g., '10m', '100k'
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// Main Scraper Configuration Schema and Type
export const ScraperConfigSchema = z.object({
  platform: z.custom<Platform>(),
  rateLimit: RateLimitConfigSchema.optional(),
  cache: CacheConfigSchema.optional(),
  proxy: ProxyConfigSchema.optional(),
  database: DatabaseConfigSchema.optional(),
  export: ExportConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
  userAgent: z.string().default('fscrape/1.0'),
  timeout: z.number().positive().default(30000), // 30 seconds
  maxConcurrent: z.number().int().positive().default(5),
  followRedirects: z.boolean().default(true),
  validateSSL: z.boolean().default(true),
  headers: z.record(z.string()).optional(),
});

export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;

// Query Configuration Schema and Type
export const QueryConfigSchema = z.object({
  query: z.string().optional(),
  subreddit: z.string().optional(),
  category: z.string().optional(),
  sort: z.custom<SortOption>().optional(),
  timeRange: z.custom<TimeRange>().optional(),
  limit: z.number().int().positive().default(100),
  includeComments: z.boolean().default(false),
  commentDepth: z.number().int().nonnegative().default(3),
  after: z.string().optional(),
  before: z.string().optional(),
});

export type QueryConfig = z.infer<typeof QueryConfigSchema>;
