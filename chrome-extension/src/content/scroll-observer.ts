/**
 * Scroll Observer
 * Tracks posts as they become visible and sends them to background for storage
 */

import { RedditScraper } from './reddit-scraper';
import type { Post } from '../shared/types';
import { MessageType } from '../shared/types';

export class ScrollObserver {
  private observer: IntersectionObserver;
  private mutationObserver: MutationObserver;
  private processedPostIds = new Set<string>();
  private scraper: RedditScraper;
  private isActive = false;
  private onCountUpdate?: (count: number) => void;

  constructor(scraper: RedditScraper, onCountUpdate?: (count: number) => void) {
    this.scraper = scraper;
    this.onCountUpdate = onCountUpdate;

    // Create IntersectionObserver to detect when posts become visible
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        threshold: 0.1, // Trigger when 10% of post is visible
        rootMargin: '50px', // Start observing slightly before element enters viewport
      }
    );

    // Create MutationObserver to watch for new posts added by infinite scroll
    this.mutationObserver = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
  }

  /**
   * Start observing posts
   */
  start(): void {
    if (this.isActive) {
      console.log('ScrollObserver already active');
      return;
    }

    console.log('Starting ScrollObserver');
    this.isActive = true;

    // Save all existing posts in DOM immediately (no need to wait for scroll)
    this.saveAllPostsInDOM();

    // Observe all existing posts on page
    this.observeExistingPosts();

    // Start watching for new posts added dynamically
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Stop observing
   */
  stop(): void {
    console.log('Stopping ScrollObserver');
    this.isActive = false;
    this.observer.disconnect();
    this.mutationObserver.disconnect();
    this.processedPostIds.clear();
  }

  /**
   * Observe all existing posts on the page
   */
  private observeExistingPosts(): void {
    const uiVersion = this.scraper.detectRedditUI();
    let postElements: NodeListOf<Element>;

    switch (uiVersion) {
      case 'sh':
        postElements = document.querySelectorAll('shreddit-post');
        break;
      case 'new':
        postElements = document.querySelectorAll('[data-testid="post-container"]');
        break;
      case 'old':
        postElements = document.querySelectorAll('.thing.link');
        break;
      default:
        console.warn('Unknown Reddit UI, cannot observe posts');
        return;
    }

    console.log(`Found ${postElements.length} existing posts to observe`);

    postElements.forEach((element) => {
      this.observer.observe(element);
    });
  }

  /**
   * Handle mutations (new posts added to DOM)
   */
  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          // Check if the node itself is a post
          if (this.scraper.isPostElement(node)) {
            this.observer.observe(node);
          }

          // Check if any descendants are posts
          const uiVersion = this.scraper.detectRedditUI();
          let selector: string;

          switch (uiVersion) {
            case 'sh':
              selector = 'shreddit-post';
              break;
            case 'new':
              selector = '[data-testid="post-container"]';
              break;
            case 'old':
              selector = '.thing.link';
              break;
            default:
              return;
          }

          const posts = node.querySelectorAll(selector);
          posts.forEach((post) => {
            this.observer.observe(post);
          });
        }
      });
    }
  }

  /**
   * Handle intersection events (posts becoming visible)
   */
  private async handleIntersection(entries: IntersectionObserverEntry[]): Promise<void> {
    for (const entry of entries) {
      // Only process when element becomes visible
      if (!entry.isIntersecting) {
        continue;
      }

      const element = entry.target;

      try {
        const post = this.scraper.extractPostFromElement(element);

        if (!post) {
          continue;
        }

        // Skip if already processed
        if (this.processedPostIds.has(post.platform_id)) {
          continue;
        }

        // Mark as processed
        this.processedPostIds.add(post.platform_id);

        // Send to background for storage
        const wasNew = await this.savePost(post);

        if (wasNew) {
          console.log(`Saved post: ${post.title.substring(0, 50)}... (r/${post.subreddit})`);
        } else {
          console.log(`Skipped duplicate: ${post.title.substring(0, 50)}... (r/${post.subreddit})`);
        }
      } catch (error) {
        console.error('Error processing post:', error);
      }
    }
  }

  /**
   * Send post to background script for storage
   * @returns true if post was newly saved, false if it was a duplicate
   */
  private async savePost(post: Post): Promise<boolean> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: MessageType.SAVE_POST,
          payload: post,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response?.success) {
            // Update count callback after successful save (even for duplicates, to sync count)
            if (this.onCountUpdate) {
              this.fetchAndUpdateCount(post.subreddit);
            }
            resolve(response.data?.wasNew || false);
          } else {
            reject(new Error(response?.error || 'Failed to save post'));
          }
        }
      );
    });
  }

  /**
   * Fetch total post count for subreddit from background
   */
  private async fetchAndUpdateCount(subreddit: string): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_SUBREDDIT_POST_COUNT,
        payload: { subreddit },
      });

      if (response?.success && this.onCountUpdate) {
        this.onCountUpdate(response.data.count);
      }
    } catch (error) {
      console.error('Error fetching post count:', error);
    }
  }

  /**
   * Get count of processed posts
   */
  getProcessedCount(): number {
    return this.processedPostIds.size;
  }

  /**
   * Reset processed posts (useful when navigating to new subreddit)
   */
  reset(): void {
    this.processedPostIds.clear();
  }

  /**
   * Save all posts currently in the DOM (regardless of viewport visibility)
   * This catches everything Reddit has loaded, even posts above/below the fold
   */
  private async saveAllPostsInDOM(): Promise<void> {
    const uiVersion = this.scraper.detectRedditUI();
    let postElements: NodeListOf<Element>;

    switch (uiVersion) {
      case 'sh':
        postElements = document.querySelectorAll('shreddit-post');
        break;
      case 'new':
        postElements = document.querySelectorAll('[data-testid="post-container"]');
        break;
      case 'old':
        postElements = document.querySelectorAll('.thing.link');
        break;
      default:
        console.warn('Unknown Reddit UI, cannot save posts');
        return;
    }

    console.log(`📦 Saving ${postElements.length} posts from DOM (including off-screen)...`);

    let savedCount = 0;
    let skippedCount = 0;

    for (const element of postElements) {
      try {
        const post = this.scraper.extractPostFromElement(element);

        if (!post) {
          continue;
        }

        // Skip if already processed
        if (this.processedPostIds.has(post.platform_id)) {
          skippedCount++;
          continue;
        }

        // Mark as processed
        this.processedPostIds.add(post.platform_id);

        // Send to background for storage
        const wasNew = await this.savePost(post);

        if (wasNew) {
          savedCount++;
          console.log(`[${savedCount}/${postElements.length}] Saved: ${post.title.substring(0, 50)}...`);
        } else {
          skippedCount++;
          console.log(`[${skippedCount} skipped] Duplicate: ${post.title.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error('Error saving post from DOM:', error);
      }
    }

    console.log(`✅ Batch save complete: ${savedCount} new posts saved, ${skippedCount} duplicates skipped`);
  }
}
