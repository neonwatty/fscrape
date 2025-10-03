/**
 * Shared constants for fscrape Chrome Extension
 */

// IndexedDB configuration
export const DB_NAME = 'fscrape';
export const DB_VERSION = 1;

// Store names
export const STORE_NAMES = {
  POSTS: 'posts',
  SUBREDDITS: 'subreddits',
  SETTINGS: 'settings',
} as const;

// Index names
export const INDEX_NAMES = {
  POSTS_BY_SUBREDDIT: 'by_subreddit',
  POSTS_BY_CREATED_AT: 'by_created_at',
  POSTS_BY_SCORE: 'by_score',
} as const;

// Default limits
export const DEFAULT_POST_LIMIT = 1000;
export const DEFAULT_QUERY_LIMIT = 1000;

// Storage quota (bytes)
export const STORAGE_QUOTA_WARNING_THRESHOLD = 0.8; // Warn at 80% usage
