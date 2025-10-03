/**
 * Background Service Worker
 * Handles message passing and data management
 */

import { StorageManager } from './storage';
import { MessageType, type Message } from '../shared/types';

console.log('Background service worker loaded');

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');

  // Initialize storage
  const storage = await StorageManager.getInstance();
  console.log('Storage initialized');
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

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender) {
  const storage = await StorageManager.getInstance();

  switch (message.type) {
    case MessageType.SAVE_POST: {
      const post = message.payload;
      await storage.addPost(post);
      console.log(`Saved post: ${post.id} from r/${post.subreddit}`);
      return { postId: post.id };
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

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
