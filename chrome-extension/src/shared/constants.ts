/**
 * Shared constants for fscrape Chrome Extension
 */

// IndexedDB configuration
export const DB_NAME = 'fscrape';
export const DB_VERSION = 2;  // Incremented for Library feature

// Store names
export const STORE_NAMES = {
  // Passive tracking stores
  POSTS: 'posts',
  SUBREDDITS: 'subreddits',
  SETTINGS: 'settings',

  // Library stores
  SAVED_POSTS: 'saved_posts',
  TAGS: 'tags',
  FOLDERS: 'folders',
} as const;

// Index names for passive tracking (posts store)
export const INDEX_NAMES = {
  POSTS_BY_SUBREDDIT: 'by_subreddit',
  POSTS_BY_CREATED_AT: 'by_created_at',
  POSTS_BY_SCORE: 'by_score',

  // Library indexes (saved_posts store)
  SAVED_POSTS_BY_SAVED_AT: 'by_saved_at',
  SAVED_POSTS_BY_FOLDER: 'by_folder',
  SAVED_POSTS_BY_TAGS: 'by_tags',
  SAVED_POSTS_BY_FAVORITED: 'by_favorited',
  SAVED_POSTS_BY_READ: 'by_is_read',
} as const;

// Default limits
export const DEFAULT_POST_LIMIT = 1000;
export const DEFAULT_QUERY_LIMIT = 1000;

// Storage quota (bytes)
export const STORAGE_QUOTA_WARNING_THRESHOLD = 0.8; // Warn at 80% usage
