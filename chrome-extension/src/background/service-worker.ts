/**
 * Background Service Worker
 * Handles message passing and data management
 */

import { StorageManager } from './storage';
import { DataManager } from './data-manager';
import { MessageType, type Message, SETTINGS_KEYS } from '../shared/types';

console.log('Background service worker loaded');

let dataManager: DataManager | null = null;

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');

  // Initialize storage and data manager
  const storage = await StorageManager.getInstance();
  dataManager = new DataManager(storage);

  // Initialize default settings
  await dataManager.initializeSettings();

  // Check if sidebar should auto-open
  const autoOpen = await storage.getSetting(SETTINGS_KEYS.SIDEBAR_AUTO_OPEN);
  if (autoOpen) {
    // Auto-open sidebar on install
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    for (const window of windows) {
      if (window.id) {
        await chrome.sidePanel.open({ windowId: window.id }).catch(console.error);
      }
    }
  }

  console.log('Storage and data manager initialized');
});

// Handle messages from content scripts and popup/sidebar
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('Received message:', message.type);

  // Handle async operations
  handleMessage(message, sender)
    .then((response) => sendResponse({ success: true, data: response }))
    .catch((error) => {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate async response
  return true;
});

async function handleMessage(message: Message, _sender: chrome.runtime.MessageSender) {
  // Ensure data manager is initialized
  if (!dataManager) {
    const storage = await StorageManager.getInstance();
    dataManager = new DataManager(storage);
    await dataManager.initializeSettings();
  }

  const storage = await StorageManager.getInstance();

  switch (message.type) {
    case MessageType.SAVE_POST: {
      const post = message.payload;
      const wasNew = await dataManager.savePost(post);
      if (wasNew) {
        console.log(`Saved post: ${post.id} from r/${post.subreddit}`);
      }
      return { postId: post.id, wasNew };
    }

    case MessageType.TOGGLE_PIN: {
      const { subreddit } = message.payload;
      const isPinned = await dataManager.togglePin(subreddit);
      console.log(`Toggled r/${subreddit}: ${isPinned ? 'pinned' : 'unpinned'}`);
      return { subreddit, isPinned };
    }

    case MessageType.GET_PINNED_STATUS: {
      const { subreddit } = message.payload;
      const isPinned = await dataManager.isPinned(subreddit);
      return { subreddit, isPinned };
    }

    case MessageType.GET_SUBREDDIT_POST_COUNT: {
      const { subreddit } = message.payload;
      const count = await storage.countPostsBySubreddit(subreddit);
      return { subreddit, count };
    }

    case MessageType.GET_STATS: {
      const totalPosts = await storage.getTotalPostCount();
      const subreddits = await storage.getAllSubreddits();
      const pinnedSubreddits = subreddits.filter((s) => s.is_pinned);

      // Estimate storage usage (rough calculation)
      // Average post size: ~1-2KB, subreddit metadata: ~500 bytes
      const estimatedPostsSize = totalPosts * 1.5; // KB
      const estimatedSubsSize = subreddits.length * 0.5; // KB
      const totalStorageKB = estimatedPostsSize + estimatedSubsSize;
      const totalStorageMB = totalStorageKB / 1024;

      return {
        total_posts: totalPosts,
        total_subreddits: subreddits.length,
        pinned_subreddits: pinnedSubreddits.length,
        last_scraped_at: Math.max(...subreddits.map((s) => s.last_scraped_at), 0),
        storage_used_mb: totalStorageMB,
      };
    }

    case MessageType.GET_SUBREDDITS: {
      const subreddits = await storage.getAllSubreddits();
      return { subreddits };
    }

    case MessageType.GET_POSTS: {
      const { subreddit, limit } = message.payload || {};

      if (subreddit) {
        const posts = await storage.getPostsBySubreddit(subreddit, limit);
        return { posts };
      } else {
        const posts = await storage.getAllPosts(limit);
        return { posts };
      }
    }

    case MessageType.DELETE_POST: {
      const { postId } = message.payload;
      await storage.deletePost(postId);
      return { deleted: true };
    }

    case MessageType.DELETE_ALL_DATA: {
      await storage.clearAllData();
      console.log('Cleared all data');
      return { cleared: true };
    }

    case MessageType.GET_SETTINGS: {
      const settings = await storage.getAllSettings();
      return { settings };
    }

    case MessageType.UPDATE_SETTINGS: {
      const { key, value } = message.payload;
      console.log('UPDATE_SETTINGS received:', { key, value });
      await storage.setSetting(key, value);

      // Note: We cannot open the sidebar here because chrome.sidePanel.open()
      // requires a user gesture. The sidebar is opened from the Settings component
      // when the toggle is clicked (which has a user gesture).

      return { updated: true };
    }

    case MessageType.OPEN_SIDEBAR: {
      const { windowId } = message.payload || {};
      if (windowId) {
        await chrome.sidePanel.open({ windowId });
      } else {
        const window = await chrome.windows.getCurrent();
        if (window.id) {
          await chrome.sidePanel.open({ windowId: window.id });
        }
      }
      return { opened: true };
    }

    case MessageType.CLOSE_SIDEBAR: {
      // Note: Chrome Side Panel API doesn't have a direct close method
      // Users must close it manually from the browser UI
      // This is more of a placeholder for future API updates
      console.log('Close sidebar requested (manual close required)');
      return { message: 'Sidebar must be closed manually by the user' };
    }

    case MessageType.TOGGLE_SIDEBAR: {
      const { windowId } = message.payload || {};
      const targetWindowId = windowId || (await chrome.windows.getCurrent()).id;

      if (targetWindowId) {
        // Side Panel API doesn't have a toggle method, so we'll just open it
        // Users can close it manually
        await chrome.sidePanel.open({ windowId: targetWindowId });
      }
      return { toggled: true };
    }

    // ==================== LIBRARY - SAVED POSTS ====================

    case MessageType.SAVE_POST_TO_LIBRARY: {
      const savedPost = message.payload;
      await storage.addSavedPost(savedPost);

      // Update tag counts
      for (const tagName of savedPost.tags) {
        await storage.incrementTagCount(tagName);
      }

      // Update folder count
      if (savedPost.folder_id) {
        await storage.incrementFolderCount(savedPost.folder_id);
      }

      console.log(`Saved post to library: ${savedPost.id}`);
      return { saved: true };
    }

    case MessageType.GET_SAVED_POST: {
      const { id } = message.payload;
      const post = await storage.getSavedPost(id);
      return post;
    }

    case MessageType.GET_ALL_SAVED_POSTS: {
      const { limit } = message.payload || {};
      const posts = await storage.getAllSavedPosts(limit);
      return posts;
    }

    case MessageType.GET_SAVED_POSTS_BY_FOLDER: {
      const { folderId, limit } = message.payload;
      const posts = await storage.getSavedPostsByFolder(folderId, limit);
      return posts;
    }

    case MessageType.GET_SAVED_POSTS_BY_TAG: {
      const { tag, limit } = message.payload;
      const posts = await storage.getSavedPostsByTag(tag, limit);
      return posts;
    }

    case MessageType.GET_FAVORITED_POSTS: {
      const { limit } = message.payload || {};
      const posts = await storage.getFavoritedPosts(limit);
      return posts;
    }

    case MessageType.GET_UNREAD_POSTS: {
      const { limit } = message.payload || {};
      const posts = await storage.getUnreadPosts(limit);
      return posts;
    }

    case MessageType.UPDATE_SAVED_POST: {
      const { id, updates } = message.payload;
      const oldPost = await storage.getSavedPost(id);

      if (oldPost) {
        // Handle tag count changes
        if (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(oldPost.tags)) {
          // Remove old tag counts
          for (const tagName of oldPost.tags) {
            if (!updates.tags.includes(tagName)) {
              await storage.decrementTagCount(tagName);
            }
          }
          // Add new tag counts
          for (const tagName of updates.tags) {
            if (!oldPost.tags.includes(tagName)) {
              await storage.incrementTagCount(tagName);
            }
          }
        }

        // Handle folder count changes
        if (updates.folder_id !== undefined && updates.folder_id !== oldPost.folder_id) {
          if (oldPost.folder_id) {
            await storage.decrementFolderCount(oldPost.folder_id);
          }
          if (updates.folder_id) {
            await storage.incrementFolderCount(updates.folder_id);
          }
        }
      }

      await storage.updateSavedPost(id, updates);
      return { updated: true };
    }

    case MessageType.DELETE_SAVED_POST: {
      const { id } = message.payload;
      const post = await storage.getSavedPost(id);

      if (post) {
        // Decrement tag counts
        for (const tagName of post.tags) {
          await storage.decrementTagCount(tagName);
        }

        // Decrement folder count
        if (post.folder_id) {
          await storage.decrementFolderCount(post.folder_id);
        }

        await storage.deleteSavedPost(id);
        console.log(`Deleted saved post: ${id}`);
      }

      return { deleted: true };
    }

    case MessageType.TOGGLE_FAVORITE: {
      const { id } = message.payload;
      const post = await storage.getSavedPost(id);

      if (post) {
        await storage.updateSavedPost(id, { is_favorited: !post.is_favorited });
        return { is_favorited: !post.is_favorited };
      }

      throw new Error('Post not found');
    }

    case MessageType.TOGGLE_READ: {
      const { id } = message.payload;
      const post = await storage.getSavedPost(id);

      if (post) {
        await storage.updateSavedPost(id, { is_read: !post.is_read });
        return { is_read: !post.is_read };
      }

      throw new Error('Post not found');
    }

    // ==================== LIBRARY - TAGS ====================

    case MessageType.CREATE_TAG: {
      const tag = message.payload;
      await storage.addTag(tag);
      console.log(`Created tag: ${tag.name}`);
      return { created: true };
    }

    case MessageType.GET_ALL_TAGS: {
      const tags = await storage.getAllTags();
      return tags;
    }

    case MessageType.UPDATE_TAG: {
      const { name, updates } = message.payload;
      await storage.updateTag(name, updates);
      return { updated: true };
    }

    case MessageType.DELETE_TAG: {
      const { name } = message.payload;
      await storage.deleteTag(name);
      console.log(`Deleted tag: ${name}`);
      return { deleted: true };
    }

    // ==================== LIBRARY - FOLDERS ====================

    case MessageType.CREATE_FOLDER: {
      const folder = message.payload;
      await storage.addFolder(folder);
      console.log(`Created folder: ${folder.name}`);
      return { created: true };
    }

    case MessageType.GET_ALL_FOLDERS: {
      const folders = await storage.getAllFolders();
      return folders;
    }

    case MessageType.UPDATE_FOLDER: {
      const { id, updates } = message.payload;
      await storage.updateFolder(id, updates);
      return { updated: true };
    }

    case MessageType.DELETE_FOLDER: {
      const { id } = message.payload;
      await storage.deleteFolder(id);
      console.log(`Deleted folder: ${id}`);
      return { deleted: true };
    }

    // ==================== LIBRARY - STATS ====================

    case MessageType.GET_LIBRARY_STATS: {
      const totalSaved = await storage.getTotalSavedPostCount();
      const tags = await storage.getAllTags();
      const folders = await storage.getAllFolders();
      const favorited = await storage.getFavoritedPosts();
      const unread = await storage.getUnreadPosts();

      return {
        total_saved: totalSaved,
        total_tags: tags.length,
        total_folders: folders.length,
        favorited: favorited.length,
        unread: unread.length,
      };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
