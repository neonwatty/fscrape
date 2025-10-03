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
