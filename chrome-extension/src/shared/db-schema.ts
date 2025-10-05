/**
 * IndexedDB schema definition and initialization
 */

import { DB_NAME, DB_VERSION, STORE_NAMES, INDEX_NAMES } from './constants';

export class DBSchema {
  /**
   * Initialize IndexedDB with schema
   */
  static async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion || DB_VERSION;

        console.log(`Database upgrade: v${oldVersion} → v${newVersion}`);

        // V1: Initial schema (Passive Tracking)
        if (oldVersion < 1) {
          // Create posts store
          if (!db.objectStoreNames.contains(STORE_NAMES.POSTS)) {
            const postsStore = db.createObjectStore(STORE_NAMES.POSTS, {
              keyPath: 'id',
            });

            // Create indexes for efficient querying
            postsStore.createIndex(
              INDEX_NAMES.POSTS_BY_SUBREDDIT,
              ['subreddit', 'created_at'],
              { unique: false }
            );

            postsStore.createIndex(
              INDEX_NAMES.POSTS_BY_CREATED_AT,
              'created_at',
              { unique: false }
            );

            postsStore.createIndex(
              INDEX_NAMES.POSTS_BY_SCORE,
              'score',
              { unique: false }
            );

            console.log('Created posts store with indexes');
          }

          // Create subreddits store
          if (!db.objectStoreNames.contains(STORE_NAMES.SUBREDDITS)) {
            db.createObjectStore(STORE_NAMES.SUBREDDITS, {
              keyPath: 'name',
            });

            console.log('Created subreddits store');
          }

          // Create settings store
          if (!db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) {
            db.createObjectStore(STORE_NAMES.SETTINGS, {
              keyPath: 'key',
            });

            console.log('Created settings store');
          }
        }

        // V2: Library feature (Manual Saves, Tags, Folders)
        if (oldVersion < 2) {
          // Create saved_posts store
          if (!db.objectStoreNames.contains(STORE_NAMES.SAVED_POSTS)) {
            const savedPostsStore = db.createObjectStore(STORE_NAMES.SAVED_POSTS, {
              keyPath: 'id',
            });

            // Index for chronological sorting (most recent first)
            savedPostsStore.createIndex(
              INDEX_NAMES.SAVED_POSTS_BY_SAVED_AT,
              'saved_at',
              { unique: false }
            );

            // Index for folder filtering
            savedPostsStore.createIndex(
              INDEX_NAMES.SAVED_POSTS_BY_FOLDER,
              'folder_id',
              { unique: false }
            );

            // Multi-entry index for tag filtering
            savedPostsStore.createIndex(
              INDEX_NAMES.SAVED_POSTS_BY_TAGS,
              'tags',
              { unique: false, multiEntry: true }
            );

            // Index for favorited posts
            savedPostsStore.createIndex(
              INDEX_NAMES.SAVED_POSTS_BY_FAVORITED,
              'is_favorited',
              { unique: false }
            );

            // Index for read/unread filtering
            savedPostsStore.createIndex(
              INDEX_NAMES.SAVED_POSTS_BY_READ,
              'is_read',
              { unique: false }
            );

            console.log('Created saved_posts store with indexes');
          }

          // Create tags store
          if (!db.objectStoreNames.contains(STORE_NAMES.TAGS)) {
            db.createObjectStore(STORE_NAMES.TAGS, {
              keyPath: 'name',
            });

            console.log('Created tags store');
          }

          // Create folders store
          if (!db.objectStoreNames.contains(STORE_NAMES.FOLDERS)) {
            db.createObjectStore(STORE_NAMES.FOLDERS, {
              keyPath: 'id',
            });

            console.log('Created folders store');
          }
        }
      };
    });
  }

  /**
   * Delete the database (for testing/cleanup)
   */
  static async delete(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onerror = () => {
        reject(new Error(`Failed to delete database: ${request.error}`));
      };

      request.onsuccess = () => {
        console.log('Database deleted successfully');
        resolve();
      };
    });
  }
}
