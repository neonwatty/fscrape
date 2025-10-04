/**
 * Content Script - Main Entry Point
 * Runs on all Reddit pages
 */

import { RedditScraper } from './reddit-scraper';
import { ScrollObserver } from './scroll-observer';
import { UIInjector } from './ui-injector';
import { MessageType } from '../shared/types';
import './styles.css';

console.log('fscrape content script loaded');

class ContentScript {
  private scraper: RedditScraper;
  private scrollObserver: ScrollObserver;
  private uiInjector: UIInjector;

  constructor() {
    this.scraper = new RedditScraper();
    this.scrollObserver = new ScrollObserver(
      this.scraper,
      (count) => {
        // Update UI with new post count
        this.uiInjector.updatePostCount(count);
      }
    );
    this.uiInjector = new UIInjector();
  }

  /**
   * Initialize content script
   */
  async init(): Promise<void> {
    console.log('Initializing fscrape content script');

    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }

    // Listen for navigation changes (Reddit is SPA)
    this.watchForNavigation();
  }

  /**
   * Start scraping on current page
   */
  private async start(): Promise<void> {
    try {
      // Check if we're on a subreddit page
      const subreddit = this.scraper.getCurrentSubreddit();

      if (!subreddit) {
        console.log('Not on a subreddit page, skipping');
        return;
      }

      console.log(`On subreddit: r/${subreddit}`);

      // Check for restricted access (private, quarantined, banned)
      if (this.isRestrictedSubreddit()) {
        console.warn(`r/${subreddit} appears to be private, quarantined, or restricted`);
        // Still allow pinning, but user may not see posts
      }

      // Check if subreddit is pinned
      const isPinned = await this.checkIfPinned(subreddit);

      // Inject pin button with callback
      this.uiInjector.inject(subreddit, async (pinned: boolean) => {
        if (pinned) {
          console.log(`r/${subreddit} pinned, starting to track posts as you scroll...`);
          this.scrollObserver.start();
          await this.updatePostCount(subreddit);
        } else {
          console.log(`r/${subreddit} unpinned, stopping scroll observer`);
          this.scrollObserver.stop();
          this.uiInjector.updatePostCount(0);
        }
      });

      // Start scroll observer if already pinned
      if (isPinned) {
        console.log(`r/${subreddit} is already pinned, tracking posts as you scroll...`);
        this.scrollObserver.start();
        // Fetch and display total post count from storage
        await this.updatePostCount(subreddit);
      } else {
        console.log(`r/${subreddit} is not pinned, waiting for user to pin`);
      }
    } catch (error) {
      console.error('Error starting content script:', error);
      // Don't crash - continue running in degraded state
    }
  }

  /**
   * Stop scraping
   */
  private stop(): void {
    this.scrollObserver.stop();
    this.uiInjector.remove();
  }

  /**
   * Watch for navigation changes in SPA
   */
  private watchForNavigation(): void {
    let lastUrl = location.href;

    // Use MutationObserver to detect URL changes
    new MutationObserver(() => {
      const currentUrl = location.href;

      if (currentUrl !== lastUrl) {
        console.log('Navigation detected:', currentUrl);
        lastUrl = currentUrl;

        // Stop current observers
        this.stop();

        // Restart on new page after short delay
        setTimeout(() => {
          this.start();
        }, 500);
      }
    }).observe(document, { subtree: true, childList: true });

    // Also listen to popstate for back/forward navigation
    window.addEventListener('popstate', () => {
      console.log('Popstate navigation detected');
      this.stop();
      setTimeout(() => this.start(), 500);
    });
  }

  /**
   * Check if current subreddit is restricted (private, quarantined, banned)
   */
  private isRestrictedSubreddit(): boolean {
    // Check for common Reddit restriction indicators
    const indicators = [
      'This community is private',
      'This community is quarantined',
      'This subreddit was banned',
      'You must be invited to visit',
      'This community has been banned',
      'r/all does not allow',
    ];

    const bodyText = document.body.textContent || '';
    return indicators.some((indicator) => bodyText.includes(indicator));
  }

  /**
   * Check if subreddit is pinned (with retry logic)
   */
  private async checkIfPinned(subreddit: string): Promise<boolean> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.GET_PINNED_STATUS,
          payload: { subreddit },
        });

        return response?.success && response?.data?.isPinned;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Error checking pinned status (attempt ${attempt}/${maxRetries}):`, error);

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }
      }
    }

    console.error('Failed to check pinned status after retries:', lastError);
    return false;
  }

  /**
   * Fetch and update post count from storage (with retry logic)
   */
  private async updatePostCount(subreddit: string): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.GET_SUBREDDIT_POST_COUNT,
          payload: { subreddit },
        });

        if (response?.success) {
          this.uiInjector.updatePostCount(response.data.count);
          return;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`Error fetching post count (attempt ${attempt}/${maxRetries}):`, error);

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }
      }
    }

    console.error('Failed to fetch post count after retries:', lastError);
    // Don't throw - just log and continue with 0 count
  }
}

// Initialize content script
const contentScript = new ContentScript();
contentScript.init();
