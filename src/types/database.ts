/**
 * Database type definitions matching the SQLite schema
 */

import type { Platform } from './core.js';

/**
 * Base database row with common fields
 */
export interface BaseDBRow {
  scraped_at: number;
}

/**
 * Post table row structure
 */
export interface PostDBRow extends BaseDBRow {
  id: string;
  platform: string;
  platform_id: string;
  title: string;
  content: string | null;
  author: string;
  author_id: string | null;
  url: string;
  score: number;
  comment_count: number;
  created_at: number;
  updated_at: number | null;
  metadata: string | null;
  engagement_rate?: number; // Generated column
  score_normalized?: number; // Generated column
}

/**
 * Comment table row structure
 */
export interface CommentDBRow extends BaseDBRow {
  id: string;
  platform: string;
  platform_id: string;
  post_id: string;
  parent_id: string | null;
  author: string;
  author_id: string | null;
  content: string;
  score: number;
  depth: number;
  created_at: number;
  updated_at: number | null;
}

/**
 * User table row structure
 */
export interface UserDBRow extends BaseDBRow {
  id: string;
  platform: string;
  username: string;
  karma: number | null;
  post_count: number;
  comment_count: number;
  created_at: number | null;
  last_seen_at: number | null;
  metadata: string | null;
}

/**
 * Scrape session table row structure
 */
export interface SessionDBRow {
  id: number;
  session_id: string;
  platform: string;
  query_type: string | null;
  query_value: string | null;
  sort_by: string | null;
  time_range: string | null;
  status: string;
  total_items_target: number | null;
  total_items_scraped: number;
  total_posts: number;
  total_comments: number;
  total_users: number;
  last_item_id: string | null;
  resume_token: string | null;
  started_at: number;
  completed_at: number | null;
  last_activity_at: number;
  error_count: number;
  last_error: string | null;
  metadata: string | null;
}

/**
 * Rate limit state table row structure
 */
export interface RateLimitDBRow {
  platform: string;
  requests_in_window: number;
  window_start: number;
  last_request_at: number | null;
  retry_after: number | null;
  consecutive_errors: number;
  created_at: number;
  updated_at: number;
}

/**
 * Generic stats aggregation result
 */
export interface StatsResult {
  total: number;
  avg_score: number;
  max_score: number;
  min_score: number;
}

/**
 * Platform statistics query result
 */
export interface PlatformStatsRow {
  platform: string;
  post_count: number;
  comment_count: number;
  user_count: number;
  avg_score: number;
  max_score?: number;
  min_score?: number;
}

/**
 * Engagement metrics query result
 */
export interface EngagementMetricsRow {
  date: string | number;
  post_count: number;
  comment_count: number;
  avg_engagement: number;
  total_score: number;
}

/**
 * Top performers query result
 */
export interface TopPerformerRow {
  author: string;
  platform: string;
  post_count: number;
  comment_count: number;
  total_score: number;
  avg_score: number;
}

/**
 * Trending content query result
 */
export interface TrendingRow {
  id: string;
  title: string;
  platform: string;
  score: number;
  comment_count: number;
  velocity: number;
  created_at: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesRow {
  timestamp: number;
  value: number;
  label?: string;
}

/**
 * Database health metrics
 */
export interface DatabaseHealthRow {
  total_size: number;
  table_count: number;
  index_count: number;
  last_vacuum: number | null;
  fragmentation_ratio: number;
}

/**
 * Helper type for database operations that might return undefined
 */
export type MaybeDBRow<T> = T | undefined;

/**
 * Helper type for database operations that return arrays
 */
export type DBRowArray<T> = T[];

/**
 * Type guard to check if a value is a valid database row
 */
export function isValidDBRow<T extends BaseDBRow>(
  value: unknown
): value is T {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'scraped_at' in value
  );
}

/**
 * Convert database timestamp to Date
 */
export function dbTimestampToDate(timestamp: number | null): Date | null {
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Convert Date to database timestamp
 */
export function dateToDbTimestamp(date: Date | null): number | null {
  return date ? date.getTime() : null;
}

/**
 * Parse JSON metadata from database
 */
export function parseDBMetadata<T = unknown>(
  metadata: string | null
): T | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as T;
  } catch {
    return null;
  }
}

/**
 * Stringify metadata for database storage
 */
export function stringifyDBMetadata(metadata: unknown): string | null {
  if (!metadata) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}