/**
 * Content Script - Main Entry Point
 * Runs on all Reddit pages
 */

import { RedditScraper } from './reddit-scraper';
import { ScrollObserver } from './scroll-observer';
import { UIInjector } from './ui-injector';
import { SaveButtonInjector } from './save-button';
import { SaveModalManager } from './save-modal';
import { Onboarding } from './onboarding';
import { MessageType } from '../shared/types';
import './styles.css';

console.log('fscrape content script loaded');

class ContentScript {
  private scraper: RedditScraper;
  private scrollObserver: ScrollObserver;
  private uiInjector: UIInjector;
  private saveButtonInjector: SaveButtonInjector;
  private saveModalManager: SaveModalManager;

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
    this.saveButtonInjector = new SaveButtonInjector();
    this.saveModalManager = new SaveModalManager();
  }

  /**
   * Initialize content script
   */
  async init(): Promise<void> {
    console.log('Initializing fscrape content script');

    // Show welcome modal if first time
    await Onboarding.showWelcomeIfNeeded();

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

      // Add onboarding highlight if first time
      if (!isPinned) {
        const shouldShowPrompt = await Onboarding.showPinPromptIfNeeded();
        if (shouldShowPrompt) {
          // Wait for button to render, then highlight it
          setTimeout(() => {
            const buttonElement = document.querySelector('#fscrape-pin-container button');
            if (buttonElement instanceof HTMLElement) {
              Onboarding.addPinButtonHighlight(buttonElement);
            }
          }, 500);
        }
      }

      // Start scroll observer if already pinned
      if (isPinned) {
        console.log(`r/${subreddit} is already pinned, tracking posts as you scroll...`);
        this.scrollObserver.start();
        // Fetch and display total post count from storage
        await this.updatePostCount(subreddit);
      } else {
        console.log(`r/${subreddit} is not pinned, waiting for user to pin`);
      }

      // Inject save buttons onto visible posts
      this.injectSaveButtons();

      // Watch for new posts being added (infinite scroll)
      this.watchForNewPosts();
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
    this.saveButtonInjector.removeAll();
  }

  /**
   * Inject save buttons onto all visible posts
   */
  private injectSaveButtons(): void {
    // Find all post elements on the page
    const postElements = this.findAllPostElements();

    postElements.forEach((element) => {
      const post = this.scraper.extractPostFromElement(element);

      if (post && !this.saveButtonInjector.hasButton(post.id)) {
        this.saveButtonInjector.inject(
          element,
          post,
          (clickedPost, wasAlreadySaved) => {
            // If not already saved, show the modal
            if (!wasAlreadySaved) {
              this.saveModalManager.show(clickedPost);
            }
          }
        );
      }
    });
  }

  /**
   * Find all post elements on the current page
   */
  private findAllPostElements(): Element[] {
    const uiVersion = this.scraper.detectRedditUI();

    switch (uiVersion) {
      case 'sh':
        return Array.from(document.querySelectorAll('shreddit-post'));
      case 'new':
        return Array.from(document.querySelectorAll('[data-testid="post-container"]'));
      case 'old':
        return Array.from(document.querySelectorAll('.thing.link'));
      default:
        return [];
    }
  }

  /**
   * Watch for new posts being added to the page (infinite scroll)
   */
  private watchForNewPosts(): void {
    const observer = new MutationObserver((mutations) => {
      // Check if any new post elements were added
      let foundNewPosts = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              // Check if the node itself is a post
              if (this.scraper.isPostElement(node)) {
                foundNewPosts = true;
              }
              // Check if the node contains posts
              else if (this.findAllPostElements().some(el => node.contains(el))) {
                foundNewPosts = true;
              }
            }
          });
        }
      }

      // If new posts were found, inject save buttons
      if (foundNewPosts) {
        setTimeout(() => this.injectSaveButtons(), 100);
      }
    });

    // Observe the entire document for new posts
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
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
