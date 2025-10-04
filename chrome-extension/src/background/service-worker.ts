/**
 * Background Service Worker
 * Handles message passing and data management
 */

import { StorageManager } from './storage';
import { DataManager } from './data-manager';
import { MessageType, type Message } from '../shared/types';

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

      return {
        total_posts: totalPosts,
        total_subreddits: subreddits.length,
        pinned_subreddits: pinnedSubreddits.length,
        last_scraped_at: Math.max(...subreddits.map((s) => s.last_scraped_at), 0),
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
      await storage.setSetting(key, value);
      return { updated: true };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
