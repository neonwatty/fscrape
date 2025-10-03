/**
 * Content Script - Main Entry Point
 * Runs on all Reddit pages
 */

import { RedditScraper } from './reddit-scraper';
import { ScrollObserver } from './scroll-observer';
import { UIInjector } from './ui-injector';
import './styles.css';

console.log('fscrape content script loaded');

class ContentScript {
  private scraper: RedditScraper;
  private scrollObserver: ScrollObserver;
  private uiInjector: UIInjector;
  private currentSubreddit: string | null = null;

  constructor() {
    this.scraper = new RedditScraper();
    this.scrollObserver = new ScrollObserver(this.scraper);
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
    // Check if we're on a subreddit page
    const subreddit = this.scraper.getCurrentSubreddit();

    if (!subreddit) {
      console.log('Not on a subreddit page, skipping');
      return;
    }

    console.log(`On subreddit: r/${subreddit}`);
    this.currentSubreddit = subreddit;

    // Check if subreddit is pinned
    const isPinned = await this.checkIfPinned(subreddit);

    // Inject pin button
    this.uiInjector.inject(subreddit);

    // Start scroll observer if pinned
    if (isPinned) {
      console.log(`r/${subreddit} is pinned, starting scroll observer`);
      this.scrollObserver.start();
    } else {
      console.log(`r/${subreddit} is not pinned, waiting for user to pin`);
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
   * Check if subreddit is pinned
   */
  private async checkIfPinned(subreddit: string): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PINNED_STATUS',
        payload: { subreddit },
      });

      return response?.success && response?.data?.isPinned;
    } catch (error) {
      console.error('Error checking pinned status:', error);
      return false;
    }
  }
}

// Initialize content script
const contentScript = new ContentScript();
contentScript.init();
