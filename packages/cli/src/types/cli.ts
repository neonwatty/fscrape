/**
 * CLI command option type definitions
 */

import type { Platform } from './core.js';

/**
 * Base options shared by all commands
 */
export interface BaseCommandOptions {
  database?: string;
  verbose?: boolean;
  config?: string;
}

/**
 * Scrape command options
 */
export interface ScrapeCommandOptions extends BaseCommandOptions {
  platform?: Platform;
  limit?: number;
  includeComments?: boolean;
  includeUsers?: boolean;
  maxDepth?: number;
  sortBy?: 'score' | 'date' | 'comments';
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  output?: string;
  format?: 'json' | 'csv' | 'markdown' | 'html';
  save?: boolean;
}

/**
 * List command options for posts
 */
export interface ListPostsOptions extends BaseCommandOptions {
  limit?: number;
  offset?: number;
  platform?: Platform;
  author?: string;
  sortBy?: 'created' | 'score' | 'comments';
  sortOrder?: 'asc' | 'desc';
  format?: 'table' | 'json' | 'csv';
}

/**
 * List command options for comments
 */
export interface ListCommentsOptions extends BaseCommandOptions {
  limit?: number;
  offset?: number;
  platform?: Platform;
  postId?: string;
  format?: 'table' | 'json' | 'csv';
}

/**
 * List command options for users
 */
export interface ListUsersOptions extends BaseCommandOptions {
  limit?: number;
  offset?: number;
  platform?: Platform;
  minKarma?: number;
  sortBy?: 'created' | 'karma';
  sortOrder?: 'asc' | 'desc';
  format?: 'table' | 'json' | 'csv';
}

/**
 * Stats command options
 */
export interface StatsCommandOptions extends BaseCommandOptions {
  platform?: Platform;
  format?: 'table' | 'json';
}

/**
 * Search command options
 */
export interface SearchCommandOptions extends BaseCommandOptions {
  query: string;
  in?: string;
  platform?: Platform;
  limit?: number;
  format?: 'table' | 'json';
}

/**
 * Export command options
 */
export interface ExportCommandOptions extends BaseCommandOptions {
  platform?: Platform;
  format?: 'json' | 'csv' | 'markdown' | 'html';
  output?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
  includeComments?: boolean;
  includeUsers?: boolean;
  query?: string;
  author?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  groupBy?: string;
  aggregate?: boolean;
}

/**
 * Export comments command options
 */
export interface ExportCommentsOptions extends BaseCommandOptions {
  platform?: Platform;
  format?: 'json' | 'csv' | 'markdown';
  output?: string;
  limit?: number;
  postId?: string;
}

/**
 * Export users command options
 */
export interface ExportUsersOptions extends BaseCommandOptions {
  platform?: Platform;
  format?: 'json' | 'csv' | 'markdown';
  output?: string;
  limit?: number;
  minKarma?: number;
}

/**
 * Status command options
 */
export interface StatusCommandOptions extends BaseCommandOptions {
  format?: 'summary' | 'table' | 'json';
  platform?: Platform;
  days?: number;
}

/**
 * Init command options
 */
export interface InitCommandOptions extends BaseCommandOptions {
  force?: boolean;
  interactive?: boolean;
}

/**
 * Config command options
 */
export interface ConfigCommandOptions extends BaseCommandOptions {
  list?: boolean;
  get?: string;
  set?: string;
  value?: string;
  reset?: boolean;
  validate?: boolean;
}

/**
 * Clean command options
 */
export interface CleanCommandOptions extends BaseCommandOptions {
  olderThan?: number;
  platform?: Platform;
  dryRun?: boolean;
}

/**
 * Batch command options
 */
export interface BatchCommandOptions extends BaseCommandOptions {
  interactive?: boolean;
  dryRun?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
}

/**
 * Generic command options (for commands not yet typed)
 */
export interface GenericCommandOptions extends BaseCommandOptions {
  [key: string]: unknown;
}

/**
 * Type guard to check if options have a platform
 */
export function hasPlatform(
  options: BaseCommandOptions
): options is BaseCommandOptions & { platform: Platform } {
  return 'platform' in options && typeof options.platform === 'string';
}

/**
 * Type guard to check if options have a limit
 */
export function hasLimit(
  options: BaseCommandOptions
): options is BaseCommandOptions & { limit: number } {
  return 'limit' in options && typeof options.limit === 'number';
}

/**
 * Type guard to check if options have a format
 */
export function hasFormat(
  options: BaseCommandOptions
): options is BaseCommandOptions & { format: string } {
  return 'format' in options && typeof options.format === 'string';
}

/**
 * Normalize command options with defaults
 */
export function normalizeOptions<T extends BaseCommandOptions>(
  options: T,
  defaults: Partial<T>
): T {
  return { ...defaults, ...options };
}

/**
 * Validate required options are present
 */
export function validateRequiredOptions<T extends BaseCommandOptions>(
  options: T,
  required: (keyof T)[]
): void {
  for (const key of required) {
    if (options[key] === undefined || options[key] === null) {
      throw new Error(`Missing required option: ${String(key)}`);
    }
  }
}
