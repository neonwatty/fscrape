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
} as const;

// Default settings values
export const DEFAULT_SETTINGS = {
  [SETTINGS_KEYS.DEFAULT_POST_LIMIT]: 1000,
  [SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS]: null,
  [SETTINGS_KEYS.THEME]: 'system',
  [SETTINGS_KEYS.ENABLE_NOTIFICATIONS]: false,
} as const;

// Message types for communication between content script and background
export enum MessageType {
  // Content script → Background
  SAVE_POST = 'SAVE_POST',
  TOGGLE_PIN = 'TOGGLE_PIN',
  GET_PINNED_STATUS = 'GET_PINNED_STATUS',

  // Background → Content script
  PINNED_STATUS = 'PINNED_STATUS',

  // Popup/Sidebar → Background
  GET_STATS = 'GET_STATS',
  GET_SUBREDDITS = 'GET_SUBREDDITS',
  GET_POSTS = 'GET_POSTS',
  DELETE_POST = 'DELETE_POST',
  DELETE_ALL_DATA = 'DELETE_ALL_DATA',
  EXPORT_DATA = 'EXPORT_DATA',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  GET_SETTINGS = 'GET_SETTINGS',
}

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface SavePostMessage extends Message {
  type: MessageType.SAVE_POST;
  payload: Post;
}

export interface TogglePinMessage extends Message {
  type: MessageType.TOGGLE_PIN;
  payload: {
    subreddit: string;
  };
}

export interface GetPinnedStatusMessage extends Message {
  type: MessageType.GET_PINNED_STATUS;
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
