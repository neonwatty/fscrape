/**
 * CLI input validation utilities
 */

import { z } from 'zod';
import type { Platform } from '../types/core.js';
import { existsSync, mkdirSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Platform validation
 */
export const VALID_PLATFORMS: Platform[] = [
  'reddit',
  'hackernews',
  'discourse',
  'lemmy',
  'lobsters',
  'custom',
];

export function validatePlatform(value: string): Platform {
  if (!VALID_PLATFORMS.includes(value as Platform)) {
    throw new Error(`Invalid platform: ${value}. Valid options: ${VALID_PLATFORMS.join(', ')}`);
  }
  return value as Platform;
}

/**
 * URL validation
 */
export function validateUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('URL must use HTTP or HTTPS protocol');
    }
    return value;
  } catch (_error) {
    throw new Error(`Invalid URL: ${value}`);
  }
}

/**
 * Path validation
 */
export function validatePath(value: string, mustExist = false): string {
  const resolvedPath = resolve(value);

  if (mustExist && !existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  return resolvedPath;
}

/**
 * Positive integer validation
 */
export function validatePositiveInt(value: string, name: string): number {
  const num = parseInt(value, 10);

  if (isNaN(num) || num <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return num;
}

/**
 * Date/time validation
 */
export function validateDateTime(value: string): Date {
  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date/time: ${value}`);
  }

  return date;
}

/**
 * Scrape options schema
 */
export const ScrapeOptionsSchema = z.object({
  platform: z.enum(['reddit', 'hackernews', 'discourse', 'lemmy', 'lobsters', 'custom']),
  limit: z.number().int().positive().optional(),
  sortBy: z.enum(['hot', 'new', 'top', 'controversial', 'old']).optional(),
  timeRange: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).optional(),
  includeComments: z.boolean().optional(),
  maxDepth: z.number().int().positive().optional(),
  output: z.string().optional(),
  format: z.enum(['json', 'csv', 'markdown', 'html']).optional(),
  database: z.string().optional(),
  config: z.string().optional(),
});

export type ScrapeOptions = z.infer<typeof ScrapeOptionsSchema>;

/**
 * Init options schema
 */
export const InitOptionsSchema = z.object({
  name: z.string().min(1),
  database: z.string().optional(),
  platform: z.enum(['reddit', 'hackernews', 'discourse', 'lemmy', 'lobsters', 'custom']).optional(),
  force: z.boolean().optional(),
});

export type InitOptions = z.infer<typeof InitOptionsSchema>;

/**
 * Status options schema
 */
export const StatusOptionsSchema = z.object({
  database: z.string().optional(),
  format: z.enum(['json', 'table', 'summary']).optional(),
  platform: z.enum(['reddit', 'hackernews', 'discourse', 'lemmy', 'lobsters', 'custom']).optional(),
  days: z.number().int().positive().optional(),
});

export type StatusOptions = z.infer<typeof StatusOptionsSchema>;

/**
 * Validate and parse scrape options
 */
export function validateScrapeOptions(options: unknown): ScrapeOptions {
  try {
    return ScrapeOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Invalid options:\n${issues.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Validate and parse init options
 */
export function validateInitOptions(options: unknown): InitOptions {
  try {
    return InitOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Invalid options:\n${issues.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Validate and parse status options
 */
export function validateStatusOptions(options: unknown): StatusOptions {
  try {
    return StatusOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Invalid options:\n${issues.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Check if running in TTY (interactive terminal)
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

/**
 * Format error message for CLI output
 */
export function formatError(error: Error | unknown): string {
  if (error instanceof z.ZodError) {
    return formatZodError(error);
  }
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('ENOENT')) {
      return `File or directory not found: ${error.message.split("'")[1] || 'unknown'}`;
    }
    if (error.message.includes('EACCES')) {
      return `Permission denied: ${error.message.split("'")[1] || 'unknown'}`;
    }
    if (error.message.includes('SQLITE')) {
      return `Database error: ${error.message}`;
    }
    return error.message;
  }
  return String(error);
}

/**
 * Format Zod validation errors
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `  • ${path}${issue.message}`;
  });
  return `Validation failed:\n${issues.join('\n')}`;
}

/**
 * Format success message
 */
export function formatSuccess(message: string): string {
  return `✓ ${message}`;
}

/**
 * Format warning message
 */
export function formatWarning(message: string): string {
  return `⚠ ${message}`;
}

/**
 * Format info message
 */
export function formatInfo(message: string): string {
  return `ℹ ${message}`;
}

/**
 * Export options schema
 */
export const ExportOptionsSchema = z
  .object({
    database: z
      .string()
      .optional()
      .transform((val) => (val ? validatePath(val, true) : undefined)),
    format: z.enum(['json', 'csv', 'markdown', 'html']).default('json'),
    output: z.string().optional(),
    platform: z
      .enum(['reddit', 'hackernews', 'discourse', 'lemmy', 'lobsters', 'custom'])
      .optional(),
    startDate: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        const date = new Date(val);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid start date: ${val}`);
        }
        return date;
      }),
    endDate: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        const date = new Date(val);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid end date: ${val}`);
        }
        return date;
      }),
    limit: z.number().int().positive().max(10000).optional(),
  })
  .refine((data) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      throw new Error('Start date must be before end date');
    }
    return true;
  });

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

/**
 * Clean options schema
 */
export const CleanOptionsSchema = z
  .object({
    database: z
      .string()
      .optional()
      .transform((val) => (val ? validatePath(val, true) : undefined)),
    olderThan: z.number().int().positive().max(365).optional(),
    platform: z
      .enum(['reddit', 'hackernews', 'discourse', 'lemmy', 'lobsters', 'custom'])
      .optional(),
    dryRun: z.boolean().default(false),
    force: z.boolean().default(false),
  })
  .refine((data) => {
    if (!data.olderThan && !data.force) {
      throw new Error('Must specify --older-than <days> or use --force to clean all data');
    }
    return true;
  });

export type CleanOptions = z.infer<typeof CleanOptionsSchema>;

/**
 * Config options schema
 */
export const ConfigOptionsSchema = z
  .object({
    key: z.string().optional(),
    value: z.string().optional(),
    set: z.boolean().default(false),
    get: z.boolean().default(false),
    list: z.boolean().default(false),
    config: z
      .string()
      .optional()
      .transform((val) => (val ? validatePath(val, false) : undefined)),
    format: z.enum(['json', 'yaml', 'env']).default('json'),
  })
  .refine((data) => {
    const actionCount = [data.set, data.get, data.list].filter(Boolean).length;
    if (actionCount > 1) {
      throw new Error('Can only specify one of --set, --get, or --list');
    }
    if (data.set && (!data.key || !data.value)) {
      throw new Error('Both key and value are required when using --set');
    }
    if (data.get && !data.key) {
      throw new Error('Key is required when using --get');
    }
    return true;
  });

export type ConfigOptions = z.infer<typeof ConfigOptionsSchema>;

/**
 * Validate and parse export options
 */
export function validateExportOptions(options: unknown): ExportOptions {
  try {
    return ExportOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Invalid export options:\n${issues.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Validate and parse clean options
 */
export function validateCleanOptions(options: unknown): CleanOptions {
  try {
    return CleanOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Invalid clean options:\n${issues.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Validate and parse config options
 */
export function validateConfigOptions(options: unknown): ConfigOptions {
  try {
    return ConfigOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Invalid config options:\n${issues.join('\n')}`);
    }
    throw error;
  }
}

// ============================================================================
// Custom Validation Helpers
// ============================================================================

/**
 * Validate file extension
 */
export function validateFileExtension(path: string, validExtensions: string[]): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext || !validExtensions.includes(ext)) {
    throw new Error(`Invalid file extension. Expected one of: ${validExtensions.join(', ')}`);
  }
  return path;
}

/**
 * Validate directory path (creates if doesn't exist)
 */
export function validateDirectory(path: string, create = false): string {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    if (create) {
      try {
        mkdirSync(resolvedPath, { recursive: true });
      } catch (_error) {
        throw new Error(`Failed to create directory: ${resolvedPath}`);
      }
    } else {
      throw new Error(`Directory does not exist: ${resolvedPath}`);
    }
  }

  const stats = statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  return resolvedPath;
}

/**
 * Validate database connection string
 */
export function validateDatabaseConnection(connStr: string): string {
  // SQLite file path
  if (!connStr.includes('://')) {
    return validatePath(connStr, false);
  }

  // URL-based connection string
  try {
    const url = new URL(connStr);
    const validProtocols = ['sqlite:', 'postgresql:', 'mysql:', 'mongodb:'];
    if (!validProtocols.includes(url.protocol)) {
      throw new Error(`Invalid database protocol. Expected one of: ${validProtocols.join(', ')}`);
    }
    return connStr;
  } catch (_error) {
    throw new Error(`Invalid database connection string: ${connStr}`);
  }
}

/**
 * Validate cron expression
 */
export function validateCronExpression(expr: string): string {
  // Simple cron validation (5 or 6 fields)
  const parts = expr.split(' ');
  if (parts.length !== 5 && parts.length !== 6) {
    throw new Error("Invalid cron expression. Expected format: '* * * * *' or '* * * * * *'");
  }

  // Basic validation of each field
  const limits = [
    { min: 0, max: 59 }, // minute
    { min: 0, max: 23 }, // hour
    { min: 1, max: 31 }, // day of month
    { min: 1, max: 12 }, // month
    { min: 0, max: 7 }, // day of week
  ];

  for (let i = 0; i < Math.min(parts.length, 5); i++) {
    const part = parts[i];
    if (!part || part === '*') continue;

    const limit = limits[i];
    if (!limit) continue;

    // Handle step values (e.g., */5, 0-23/2)
    if (part.includes('/')) {
      const stepParts = part.split('/');
      if (stepParts.length !== 2) {
        throw new Error(`Invalid cron field at position ${i + 1}: ${part}`);
      }
      const range = stepParts[0];
      const step = stepParts[1];
      if (!range || !step) {
        throw new Error(`Invalid step syntax at position ${i + 1}: ${part}`);
      }
      const stepNum = Number(step);
      if (isNaN(stepNum) || stepNum <= 0) {
        throw new Error(`Invalid step value at position ${i + 1}: ${part}`);
      }
      // Validate the range part if it's not *
      if (range !== '*' && range.includes('-')) {
        const rangeParts = range.split('-');
        if (rangeParts.length === 2) {
          const start = Number(rangeParts[0]);
          const end = Number(rangeParts[1]);
          if (isNaN(start) || isNaN(end) || start < limit.min || end > limit.max) {
            throw new Error(`Invalid range in step at position ${i + 1}: ${part}`);
          }
        }
      }
      continue;
    }

    // Handle ranges (e.g., "1-5")
    if (part.includes('-')) {
      const rangeParts = part.split('-');
      if (rangeParts.length !== 2) {
        throw new Error(`Invalid cron field at position ${i + 1}: ${part}`);
      }
      const start = Number(rangeParts[0]);
      const end = Number(rangeParts[1]);
      if (isNaN(start) || isNaN(end) || start < limit.min || end > limit.max) {
        throw new Error(`Invalid cron field at position ${i + 1}: ${part}`);
      }
      continue;
    }

    // Handle lists (e.g., "1,3,5")
    if (part.includes(',')) {
      const values = part.split(',').map(Number);
      for (const val of values) {
        if (isNaN(val) || val < limit.min || val > limit.max) {
          throw new Error(`Invalid cron field at position ${i + 1}: ${part}`);
        }
      }
      continue;
    }

    // Single value
    const val = Number(part);
    if (isNaN(val) || val < limit.min || val > limit.max) {
      throw new Error(`Invalid cron field at position ${i + 1}: ${part}`);
    }
  }

  return expr;
}

/**
 * Validate memory size string (e.g., "1GB", "512MB", "2048KB")
 */
export function validateMemorySize(size: string): string {
  const match = size.match(/^(\d+)(KB|MB|GB|TB)$/i);
  if (!match) {
    throw new Error(
      "Invalid memory size format. Expected format: <number><unit> (e.g., '512MB', '2GB')"
    );
  }

  const valueStr = match[1];
  const unitStr = match[2];

  if (!valueStr || !unitStr) {
    throw new Error('Invalid memory size format');
  }

  const numValue = parseInt(valueStr, 10);

  if (numValue <= 0) {
    throw new Error('Memory size must be greater than 0');
  }

  // Convert to bytes for validation
  const multipliers: Record<string, number> = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  const multiplier = multipliers[unitStr.toUpperCase()];
  if (!multiplier) {
    throw new Error('Invalid memory unit');
  }

  const bytes = numValue * multiplier;

  // Check reasonable limits (1KB to 1TB)
  if (bytes < 1024 || bytes > 1024 * 1024 * 1024 * 1024) {
    throw new Error('Memory size must be between 1KB and 1TB');
  }

  return size;
}

// ============================================================================
// Command Argument Validators
// ============================================================================

/**
 * Create a platform validator for Commander.js
 */
export function createPlatformValidator() {
  return (value: string) => {
    return validatePlatform(value);
  };
}

/**
 * Create a URL validator for Commander.js
 */
export function createUrlValidator() {
  return (value: string) => {
    return validateUrl(value);
  };
}

/**
 * Create a path validator for Commander.js
 */
export function createPathValidator(mustExist = false) {
  return (value: string) => {
    return validatePath(value, mustExist);
  };
}

/**
 * Create a positive integer validator for Commander.js
 */
export function createPositiveIntValidator(name: string, max?: number) {
  return (value: string) => {
    const num = validatePositiveInt(value, name);
    if (max && num > max) {
      throw new Error(`${name} must not exceed ${max}`);
    }
    return num;
  };
}

/**
 * Create a date/time validator for Commander.js
 */
export function createDateTimeValidator() {
  return (value: string) => {
    return validateDateTime(value);
  };
}

// ============================================================================
// Advanced Validation Schemas
// ============================================================================

/**
 * Batch operation options schema
 */
export const BatchOptionsSchema = z.object({
  concurrency: z.number().int().min(1).max(100).default(5),
  batchSize: z.number().int().min(1).max(1000).default(100),
  delayMs: z.number().int().min(0).max(60000).default(0),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelayMs: z.number().int().min(100).max(60000).default(1000),
  stopOnError: z.boolean().default(false),
  progressInterval: z.number().int().min(100).max(10000).default(1000),
});

export type BatchOptions = z.infer<typeof BatchOptionsSchema>;

/**
 * Filter criteria schema for queries
 */
export const FilterCriteriaSchema = z
  .object({
    platforms: z
      .array(z.enum(['reddit', 'hackernews', 'discourse', 'lemmy', 'lobsters', 'custom']))
      .optional(),
    authors: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    excludeKeywords: z.array(z.string()).optional(),
    scoreMin: z.number().optional(),
    scoreMax: z.number().optional(),
    commentCountMin: z.number().int().min(0).optional(),
    commentCountMax: z.number().int().optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    hasComments: z.boolean().optional(),
    isDeleted: z.boolean().optional(),
    isRemoved: z.boolean().optional(),
  })
  .refine((data) => {
    if (
      data.scoreMin !== undefined &&
      data.scoreMax !== undefined &&
      data.scoreMin > data.scoreMax
    ) {
      throw new Error('Minimum score cannot be greater than maximum score');
    }
    if (
      data.commentCountMin !== undefined &&
      data.commentCountMax !== undefined &&
      data.commentCountMin > data.commentCountMax
    ) {
      throw new Error('Minimum comment count cannot be greater than maximum comment count');
    }
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      throw new Error('Start date cannot be after end date');
    }
    return true;
  });

export type FilterCriteria = z.infer<typeof FilterCriteriaSchema>;

/**
 * Scheduling options schema
 */
export const ScheduleOptionsSchema = z
  .object({
    enabled: z.boolean().default(false),
    cron: z
      .string()
      .optional()
      .transform((val) => (val ? validateCronExpression(val) : undefined)),
    interval: z
      .object({
        value: z.number().int().positive(),
        unit: z.enum(['seconds', 'minutes', 'hours', 'days']),
      })
      .optional(),
    timezone: z.string().default('UTC'),
    maxRuns: z.number().int().positive().optional(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
  })
  .refine((data) => {
    if (data.enabled && !data.cron && !data.interval) {
      throw new Error('Schedule must have either cron expression or interval when enabled');
    }
    if (data.cron && data.interval) {
      throw new Error('Cannot specify both cron and interval');
    }
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      throw new Error('Schedule start time must be before end time');
    }
    return true;
  });

export type ScheduleOptions = z.infer<typeof ScheduleOptionsSchema>;

/**
 * Proxy configuration schema
 */
export const ProxyConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    protocol: z.enum(['http', 'https', 'socks4', 'socks5']).default('http'),
    username: z.string().optional(),
    password: z.string().optional(),
    rotateOnError: z.boolean().default(false),
    rotateInterval: z.number().int().positive().optional(),
  })
  .refine((data) => {
    if (data.enabled && (!data.host || !data.port)) {
      throw new Error('Proxy host and port are required when proxy is enabled');
    }
    if ((data.username && !data.password) || (!data.username && data.password)) {
      throw new Error('Both username and password are required for proxy authentication');
    }
    return true;
  });

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;

/**
 * Performance monitoring options schema
 */
export const PerformanceOptionsSchema = z.object({
  enabled: z.boolean().default(false),
  sampleRate: z.number().min(0).max(1).default(0.1),
  slowThresholdMs: z.number().int().positive().default(1000),
  memoryThresholdMB: z.number().int().positive().default(500),
  cpuThresholdPercent: z.number().min(0).max(100).default(80),
  logSlowQueries: z.boolean().default(true),
  logMemoryWarnings: z.boolean().default(true),
  metricsInterval: z.number().int().min(1000).default(60000),
});

export type PerformanceOptions = z.infer<typeof PerformanceOptionsSchema>;

// ============================================================================
// Combined Validation Utilities
// ============================================================================

/**
 * Validate all CLI options at once
 */
export function validateAllOptions(command: string, options: unknown): unknown {
  switch (command) {
    case 'scrape':
      return validateScrapeOptions(options);
    case 'init':
      return validateInitOptions(options);
    case 'status':
      return validateStatusOptions(options);
    case 'export':
      return validateExportOptions(options);
    case 'clean':
      return validateCleanOptions(options);
    case 'config':
      return validateConfigOptions(options);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Get validation schema for a command
 */
export function getValidationSchema(command: string): z.ZodSchema {
  switch (command) {
    case 'scrape':
      return ScrapeOptionsSchema;
    case 'init':
      return InitOptionsSchema;
    case 'status':
      return StatusOptionsSchema;
    case 'export':
      return ExportOptionsSchema;
    case 'clean':
      return CleanOptionsSchema;
    case 'config':
      return ConfigOptionsSchema;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Validate options with custom error messages
 */
export function validateWithCustomErrors<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  customErrors?: Record<string, string>
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => {
        const path = issue.path.join('.');
        const customMessage = customErrors?.[path];
        return customMessage || `${path}: ${issue.message}`;
      });
      throw new Error(`Validation failed:\n${issues.join('\n')}`);
    }
    throw error;
  }
}
