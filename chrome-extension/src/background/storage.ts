/**
 * Storage Manager - IndexedDB wrapper with CRUD operations
 */

import type { Post, Subreddit, Settings } from '../shared/types';
import { DBSchema } from '../shared/db-schema';
import { STORE_NAMES, INDEX_NAMES, DEFAULT_QUERY_LIMIT } from '../shared/constants';

export class StorageManager {
  private static instance: StorageManager | null = null;
  private db: IDBDatabase | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static async getInstance(): Promise<StorageManager> {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
      await StorageManager.instance.init();
    }
    return StorageManager.instance;
  }

  /**
   * Initialize database connection
   */
  private async init(): Promise<void> {
    this.db = await DBSchema.init();
  }

  /**
   * Ensure database is initialized
   */
  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // ==================== POSTS ====================

  /**
   * Add or update a post
   */
  async addPost(post: Post): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.POSTS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.POSTS);

    return new Promise((resolve, reject) => {
      const request = store.put(post);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get post by ID
   */
  async getPostById(id: string): Promise<Post | null> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.POSTS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get posts by subreddit
   */
  async getPostsBySubreddit(
    subreddit: string,
    limit: number = DEFAULT_QUERY_LIMIT
  ): Promise<Post[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.POSTS);
    const index = store.index(INDEX_NAMES.POSTS_BY_SUBREDDIT);

    const posts: Post[] = [];

    return new Promise((resolve, reject) => {
      // Create range for this subreddit
      const range = IDBKeyRange.bound(
        [subreddit, 0],
        [subreddit, Date.now()],
        false,
        false
      );

      const request = index.openCursor(range, 'prev'); // Newest first

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && posts.length < limit) {
          posts.push(cursor.value);
          cursor.continue();
        } else {
          resolve(posts);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all posts (with optional limit)
   */
  async getAllPosts(limit?: number): Promise<Post[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.POSTS);

    const posts: Post[] = [];

    return new Promise((resolve, reject) => {
      const request = store.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && (!limit || posts.length < limit)) {
          posts.push(cursor.value);
          cursor.continue();
        } else {
          resolve(posts);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count posts for a subreddit
   */
  async countPostsBySubreddit(subreddit: string): Promise<number> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.POSTS);
    const index = store.index(INDEX_NAMES.POSTS_BY_SUBREDDIT);

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound(
        [subreddit, 0],
        [subreddit, Date.now()],
        false,
        false
      );

      const request = index.count(range);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a post by ID
   */
  async deletePost(id: string): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.POSTS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.POSTS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete oldest posts for a subreddit beyond limit
   */
  async deleteOldestPosts(subreddit: string, keepCount: number): Promise<number> {
    const posts = await this.getPostsBySubreddit(subreddit, 999999);

    if (posts.length <= keepCount) {
      return 0; // Nothing to delete
    }

    // Sort by created_at ascending (oldest first)
    const sortedPosts = posts.sort((a, b) => a.created_at - b.created_at);

    // Delete oldest posts beyond limit
    const toDelete = sortedPosts.slice(0, posts.length - keepCount);

    for (const post of toDelete) {
      await this.deletePost(post.id);
    }

    return toDelete.length;
  }

  // ==================== SUBREDDITS ====================

  /**
   * Add or update a subreddit
   */
  async addSubreddit(subreddit: Subreddit): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SUBREDDITS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SUBREDDITS);

    return new Promise((resolve, reject) => {
      const request = store.put(subreddit);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get subreddit by name
   */
  async getSubreddit(name: string): Promise<Subreddit | null> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SUBREDDITS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SUBREDDITS);

    return new Promise((resolve, reject) => {
      const request = store.get(name);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all subreddits
   */
  async getAllSubreddits(): Promise<Subreddit[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SUBREDDITS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SUBREDDITS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pinned subreddits
   */
  async getPinnedSubreddits(): Promise<Subreddit[]> {
    const all = await this.getAllSubreddits();
    return all.filter((sub) => sub.is_pinned);
  }

  /**
   * Delete a subreddit
   */
  async deleteSubreddit(name: string): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SUBREDDITS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SUBREDDITS);

    return new Promise((resolve, reject) => {
      const request = store.delete(name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SETTINGS ====================

  /**
   * Set a setting value
   */
  async setSetting(key: string, value: any): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SETTINGS);

    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a setting value
   */
  async getSetting(key: string): Promise<any | null> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SETTINGS);

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as Settings | undefined;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Record<string, any>> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SETTINGS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const settings: Record<string, any> = {};
        const results = request.result as Settings[];

        for (const setting of results) {
          settings[setting.key] = setting.value;
        }

        resolve(settings);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== UTILITY ====================

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    const db = this.ensureDB();

    const stores = [STORE_NAMES.POSTS, STORE_NAMES.SUBREDDITS, STORE_NAMES.SETTINGS];

    for (const storeName of stores) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  /**
   * Get total post count across all subreddits
   */
  async getTotalPostCount(): Promise<number> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.POSTS);

    return new Promise((resolve, reject) => {
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
