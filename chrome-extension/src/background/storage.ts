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

  // ==================== LIBRARY - SAVED POSTS ====================

  /**
   * Add or update a saved post
   */
  async addSavedPost(post: import('../shared/types').SavedPost): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);

    return new Promise((resolve, reject) => {
      const request = store.put(post);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get saved post by ID
   */
  async getSavedPost(id: string): Promise<import('../shared/types').SavedPost | null> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all saved posts (with optional limit)
   */
  async getAllSavedPosts(limit?: number): Promise<import('../shared/types').SavedPost[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);
    const index = store.index(INDEX_NAMES.SAVED_POSTS_BY_SAVED_AT);

    const posts: import('../shared/types').SavedPost[] = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // Newest first

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
   * Get saved posts by folder
   */
  async getSavedPostsByFolder(
    folderId: string,
    limit?: number
  ): Promise<import('../shared/types').SavedPost[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);
    const index = store.index(INDEX_NAMES.SAVED_POSTS_BY_FOLDER);

    const posts: import('../shared/types').SavedPost[] = [];

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.only(folderId);
      const request = index.openCursor(range, 'prev');

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
   * Get saved posts by tag
   */
  async getSavedPostsByTag(
    tag: string,
    limit?: number
  ): Promise<import('../shared/types').SavedPost[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);
    const index = store.index(INDEX_NAMES.SAVED_POSTS_BY_TAGS);

    const posts: import('../shared/types').SavedPost[] = [];

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.only(tag);
      const request = index.openCursor(range, 'prev');

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
   * Get favorited posts
   */
  async getFavoritedPosts(limit?: number): Promise<import('../shared/types').SavedPost[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);
    const index = store.index(INDEX_NAMES.SAVED_POSTS_BY_FAVORITED);

    const posts: import('../shared/types').SavedPost[] = [];

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.only(true);
      const request = index.openCursor(range, 'prev');

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
   * Get unread posts
   */
  async getUnreadPosts(limit?: number): Promise<import('../shared/types').SavedPost[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);
    const index = store.index(INDEX_NAMES.SAVED_POSTS_BY_READ);

    const posts: import('../shared/types').SavedPost[] = [];

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.only(false);
      const request = index.openCursor(range, 'prev');

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
   * Update a saved post
   */
  async updateSavedPost(
    id: string,
    updates: Partial<import('../shared/types').SavedPost>
  ): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);

    return new Promise((resolve, reject) => {
      // Get existing post
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingPost = getRequest.result;

        if (!existingPost) {
          reject(new Error(`SavedPost with id ${id} not found`));
          return;
        }

        // Merge updates
        const updatedPost = { ...existingPost, ...updates };

        // Save updated post
        const putRequest = store.put(updatedPost);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete a saved post
   */
  async deleteSavedPost(id: string): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get total saved post count
   */
  async getTotalSavedPostCount(): Promise<number> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.SAVED_POSTS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.SAVED_POSTS);

    return new Promise((resolve, reject) => {
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== LIBRARY - TAGS ====================

  /**
   * Add or update a tag
   */
  async addTag(tag: import('../shared/types').Tag): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.TAGS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.TAGS);

    return new Promise((resolve, reject) => {
      const request = store.put(tag);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get tag by name
   */
  async getTag(name: string): Promise<import('../shared/types').Tag | null> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.TAGS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.TAGS);

    return new Promise((resolve, reject) => {
      const request = store.get(name);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all tags
   */
  async getAllTags(): Promise<import('../shared/types').Tag[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.TAGS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.TAGS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update a tag
   */
  async updateTag(name: string, updates: Partial<import('../shared/types').Tag>): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.TAGS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.TAGS);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(name);

      getRequest.onsuccess = () => {
        const existingTag = getRequest.result;

        if (!existingTag) {
          reject(new Error(`Tag with name ${name} not found`));
          return;
        }

        const updatedTag = { ...existingTag, ...updates };
        const putRequest = store.put(updatedTag);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete a tag
   */
  async deleteTag(name: string): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.TAGS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.TAGS);

    return new Promise((resolve, reject) => {
      const request = store.delete(name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Increment tag post count
   */
  async incrementTagCount(name: string): Promise<void> {
    const tag = await this.getTag(name);
    if (tag) {
      await this.updateTag(name, { post_count: tag.post_count + 1 });
    }
  }

  /**
   * Decrement tag post count
   */
  async decrementTagCount(name: string): Promise<void> {
    const tag = await this.getTag(name);
    if (tag && tag.post_count > 0) {
      await this.updateTag(name, { post_count: tag.post_count - 1 });
    }
  }

  // ==================== LIBRARY - FOLDERS ====================

  /**
   * Add or update a folder
   */
  async addFolder(folder: import('../shared/types').Folder): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.FOLDERS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.FOLDERS);

    return new Promise((resolve, reject) => {
      const request = store.put(folder);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get folder by ID
   */
  async getFolder(id: string): Promise<import('../shared/types').Folder | null> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.FOLDERS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.FOLDERS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all folders
   */
  async getAllFolders(): Promise<import('../shared/types').Folder[]> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.FOLDERS, 'readonly');
    const store = tx.objectStore(STORE_NAMES.FOLDERS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update a folder
   */
  async updateFolder(
    id: string,
    updates: Partial<import('../shared/types').Folder>
  ): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.FOLDERS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.FOLDERS);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingFolder = getRequest.result;

        if (!existingFolder) {
          reject(new Error(`Folder with id ${id} not found`));
          return;
        }

        const updatedFolder = { ...existingFolder, ...updates, updated_at: Date.now() };
        const putRequest = store.put(updatedFolder);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete a folder
   */
  async deleteFolder(id: string): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(STORE_NAMES.FOLDERS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.FOLDERS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Increment folder post count
   */
  async incrementFolderCount(id: string): Promise<void> {
    const folder = await this.getFolder(id);
    if (folder) {
      await this.updateFolder(id, { post_count: folder.post_count + 1 });
    }
  }

  /**
   * Decrement folder post count
   */
  async decrementFolderCount(id: string): Promise<void> {
    const folder = await this.getFolder(id);
    if (folder && folder.post_count > 0) {
      await this.updateFolder(id, { post_count: folder.post_count - 1 });
    }
  }
}
