/**
 * Data Manager
 * Handles business logic for data storage and cleanup
 */

import { StorageManager } from './storage';
import type { Post, Subreddit } from '../shared/types';
import { DEFAULT_SETTINGS, SETTINGS_KEYS } from '../shared/types';

export class DataManager {
  private storage: StorageManager;

  constructor(storage: StorageManager) {
    this.storage = storage;
  }

  /**
   * Save a post (with deduplication)
   */
  async savePost(post: Post): Promise<void> {
    // Check if post already exists
    const existing = await this.storage.getPostById(post.id);

    if (existing) {
      console.log(`Post ${post.id} already exists, skipping`);
      return;
    }

    // Save post
    await this.storage.addPost(post);

    // Update subreddit stats
    await this.updateSubredditStats(post.subreddit);

    // Enforce limits
    await this.enforceSubredditLimit(post.subreddit);
  }

  /**
   * Toggle subreddit pinned status
   */
  async togglePin(subreddit: string): Promise<boolean> {
    let sub = await this.storage.getSubreddit(subreddit);

    if (!sub) {
      // Create new subreddit entry
      const defaultPostLimit = await this.storage.getSetting(SETTINGS_KEYS.DEFAULT_POST_LIMIT);
      const defaultTimeLimit = await this.storage.getSetting(SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS);

      sub = {
        name: subreddit,
        display_name: `r/${subreddit}`,
        is_pinned: true,
        post_limit: defaultPostLimit || DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT],
        time_limit_days: defaultTimeLimit || DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS],
        post_count: 0,
        last_scraped_at: Date.now(),
        first_scraped_at: Date.now(),
        created_at: Date.now(),
      };

      await this.storage.addSubreddit(sub);
      console.log(`Pinned new subreddit: r/${subreddit}`);
      return true;
    } else {
      // Toggle existing subreddit
      sub.is_pinned = !sub.is_pinned;

      if (sub.is_pinned) {
        sub.last_scraped_at = Date.now();
      }

      await this.storage.addSubreddit(sub);
      console.log(`Toggled r/${subreddit} pin status: ${sub.is_pinned}`);
      return sub.is_pinned;
    }
  }

  /**
   * Check if subreddit is pinned
   */
  async isPinned(subreddit: string): Promise<boolean> {
    const sub = await this.storage.getSubreddit(subreddit);
    return sub?.is_pinned || false;
  }

  /**
   * Update subreddit statistics
   */
  private async updateSubredditStats(subreddit: string): Promise<void> {
    const sub = await this.storage.getSubreddit(subreddit);

    if (!sub) {
      return;
    }

    // Update post count and timestamp
    sub.post_count = await this.storage.countPostsBySubreddit(subreddit);
    sub.last_scraped_at = Date.now();

    await this.storage.addSubreddit(sub);
  }

  /**
   * Enforce post limits for a subreddit
   */
  private async enforceSubredditLimit(subreddit: string): Promise<void> {
    const sub = await this.storage.getSubreddit(subreddit);

    if (!sub) {
      return;
    }

    // Enforce post count limit
    if (sub.post_limit && sub.post_limit > 0) {
      const deletedCount = await this.storage.deleteOldestPosts(subreddit, sub.post_limit);

      if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} old posts from r/${subreddit} (limit: ${sub.post_limit})`);
      }
    }

    // Enforce time-based limit
    if (sub.time_limit_days && sub.time_limit_days > 0) {
      const cutoffTime = Date.now() - sub.time_limit_days * 24 * 60 * 60 * 1000;
      const posts = await this.storage.getPostsBySubreddit(subreddit, 999999);
      const oldPosts = posts.filter((p) => p.created_at < cutoffTime);

      for (const post of oldPosts) {
        await this.storage.deletePost(post.id);
      }

      if (oldPosts.length > 0) {
        console.log(
          `Deleted ${oldPosts.length} old posts from r/${subreddit} (older than ${sub.time_limit_days} days)`
        );
      }
    }

    // Update post count after cleanup
    await this.updateSubredditStats(subreddit);
  }

  /**
   * Initialize default settings if not exist
   */
  async initializeSettings(): Promise<void> {
    const allSettings = await this.storage.getAllSettings();

    // Set defaults for missing settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in allSettings)) {
        await this.storage.setSetting(key, value);
        console.log(`Initialized setting: ${key} = ${value}`);
      }
    }
  }
}
