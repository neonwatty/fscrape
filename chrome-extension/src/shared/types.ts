/**
 * Shared type definitions for fscrape Chrome Extension
 */

export interface Post {
  // Primary identifiers
  id: string;                    // reddit_${postId}
  platform_id: string;           // Reddit post ID (e.g., "t3_abc123")
  subreddit: string;             // e.g., "datascience"

  // Content fields
  title: string;
  author: string;
  author_id?: string;
  url: string;
  content?: string;              // Selftext

  // Metrics
  score: number;
  comment_count: number;

  // Timestamps (Unix milliseconds)
  created_at: number;
  scraped_at: number;

  // Metadata
  flair?: string;
  is_nsfw: boolean;
  is_locked: boolean;
  is_stickied: boolean;
  thumbnail_url?: string;
  metadata?: string;             // JSON string for additional data
}

export interface Subreddit {
  name: string;                  // Primary key (e.g., "datascience")
  display_name: string;          // With r/ prefix (e.g., "r/datascience")
  is_pinned: boolean;
  post_limit: number;            // Max posts to keep (default 1000)
  time_limit_days?: number;      // Optional time-based limit
  post_count: number;            // Current count of posts
  last_scraped_at: number;       // Last time we scraped
  first_scraped_at: number;      // When user first pinned
  created_at: number;            // When user pinned this subreddit
}

export interface Settings {
  key: string;                   // Primary key
  value: any;                    // Value (can be any type)
}

// Settings keys constants
export const SETTINGS_KEYS = {
  DEFAULT_POST_LIMIT: 'default_post_limit',
  DEFAULT_TIME_LIMIT_DAYS: 'default_time_limit_days',
  THEME: 'theme',
  ENABLE_NOTIFICATIONS: 'enable_notifications',
  SIDEBAR_ALWAYS_VISIBLE: 'sidebar_always_visible',
  SIDEBAR_AUTO_OPEN: 'sidebar_auto_open',
} as const;

// Default settings values
export const DEFAULT_SETTINGS = {
  [SETTINGS_KEYS.DEFAULT_POST_LIMIT]: 1000,
  [SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS]: null,
  [SETTINGS_KEYS.THEME]: 'system',
  [SETTINGS_KEYS.ENABLE_NOTIFICATIONS]: false,
  [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: false,
  [SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]: false,
} as const;

// Message types for communication between content script and background
export const MessageType = {
  // Content script → Background (Passive Tracking)
  SAVE_POST: 'SAVE_POST',
  TOGGLE_PIN: 'TOGGLE_PIN',
  GET_PINNED_STATUS: 'GET_PINNED_STATUS',
  GET_SUBREDDIT_POST_COUNT: 'GET_SUBREDDIT_POST_COUNT',

  // Background → Content script
  PINNED_STATUS: 'PINNED_STATUS',

  // Popup/Sidebar → Background (Passive Tracking)
  GET_STATS: 'GET_STATS',
  GET_SUBREDDITS: 'GET_SUBREDDITS',
  GET_POSTS: 'GET_POSTS',
  DELETE_POST: 'DELETE_POST',
  DELETE_ALL_DATA: 'DELETE_ALL_DATA',
  EXPORT_DATA: 'EXPORT_DATA',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  GET_SETTINGS: 'GET_SETTINGS',
  OPEN_SIDEBAR: 'OPEN_SIDEBAR',
  CLOSE_SIDEBAR: 'CLOSE_SIDEBAR',
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',

  // Library - Saved Posts
  SAVE_POST_TO_LIBRARY: 'SAVE_POST_TO_LIBRARY',
  GET_SAVED_POST: 'GET_SAVED_POST',
  GET_ALL_SAVED_POSTS: 'GET_ALL_SAVED_POSTS',
  GET_SAVED_POSTS_BY_FOLDER: 'GET_SAVED_POSTS_BY_FOLDER',
  GET_SAVED_POSTS_BY_TAG: 'GET_SAVED_POSTS_BY_TAG',
  GET_FAVORITED_POSTS: 'GET_FAVORITED_POSTS',
  GET_UNREAD_POSTS: 'GET_UNREAD_POSTS',
  UPDATE_SAVED_POST: 'UPDATE_SAVED_POST',
  DELETE_SAVED_POST: 'DELETE_SAVED_POST',
  TOGGLE_FAVORITE: 'TOGGLE_FAVORITE',
  TOGGLE_READ: 'TOGGLE_READ',

  // Library - Tags
  CREATE_TAG: 'CREATE_TAG',
  GET_ALL_TAGS: 'GET_ALL_TAGS',
  UPDATE_TAG: 'UPDATE_TAG',
  DELETE_TAG: 'DELETE_TAG',

  // Library - Folders
  CREATE_FOLDER: 'CREATE_FOLDER',
  GET_ALL_FOLDERS: 'GET_ALL_FOLDERS',
  UPDATE_FOLDER: 'UPDATE_FOLDER',
  DELETE_FOLDER: 'DELETE_FOLDER',

  // Library - Stats
  GET_LIBRARY_STATS: 'GET_LIBRARY_STATS',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface SavePostMessage extends Message {
  type: typeof MessageType.SAVE_POST;
  payload: Post;
}

export interface TogglePinMessage extends Message {
  type: typeof MessageType.TOGGLE_PIN;
  payload: {
    subreddit: string;
  };
}

export interface GetPinnedStatusMessage extends Message {
  type: typeof MessageType.GET_PINNED_STATUS;
  payload: {
    subreddit: string;
  };
}

export interface Stats {
  total_posts: number;
  total_subreddits: number;
  pinned_subreddits: number;
  last_scraped_at?: number;
  storage_used_mb: number;
}

// ==================== LIBRARY TYPES ====================

/**
 * Manually saved post (separate from passive tracking)
 */
export interface SavedPost {
  // Primary identifiers
  id: string;                    // saved_${postId}
  platform_id: string;           // Reddit post ID (e.g., "t3_abc123")
  subreddit: string;             // e.g., "datascience"

  // Content fields
  title: string;
  author: string;
  author_id?: string;
  url: string;
  content?: string;              // Selftext

  // Metrics
  score: number;
  comment_count: number;

  // Timestamps (Unix milliseconds)
  created_at: number;            // When post was created on Reddit
  saved_at: number;              // When user saved to library

  // Library-specific fields
  tags: string[];                // Tag names: ["research", "python"]
  folder_id: string | null;      // UUID of folder, or null if unfiled
  notes: string;                 // User notes about this post
  is_favorited: boolean;         // Starred/favorite flag
  is_read: boolean;              // Read/unread status

  // Metadata
  flair?: string;
  is_nsfw: boolean;
  is_locked: boolean;
  is_stickied: boolean;
  thumbnail_url?: string;
  metadata?: string;             // JSON string for additional data
}

/**
 * Tag for organizing saved posts
 */
export interface Tag {
  name: string;                  // Primary key, lowercase: "research"
  display_name: string;          // Display format: "Research"
  color: string;                 // Hex color: "#3b82f6"
  post_count: number;            // Number of saved posts with this tag
  created_at: number;            // When tag was created
}

/**
 * Folder for organizing saved posts
 */
export interface Folder {
  id: string;                    // UUID
  name: string;                  // Display name: "Python Tutorials"
  description: string;           // Optional description
  post_count: number;            // Number of saved posts in folder
  created_at: number;            // When folder was created
  updated_at: number;            // Last modified timestamp
}

/**
 * Library statistics
 */
export interface LibraryStats {
  total_saved: number;           // Total saved posts in library
  total_tags: number;            // Total tags created
  total_folders: number;         // Total folders created
  favorited: number;             // Count of favorited posts
  unread: number;                // Count of unread posts
}
