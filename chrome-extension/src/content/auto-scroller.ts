/**
 * Auto-Scroller
 * Automatically scrolls the page to trigger Reddit's lazy loading
 */

export interface AutoScrollOptions {
  targetPostCount?: number;  // Stop after this many posts loaded (default: 100)
  maxScrolls?: number;        // Max number of scroll attempts (default: 50)
  scrollDelay?: number;       // Ms to wait between scrolls (default: 500)
  onProgress?: (loaded: number, target: number) => void;
  onComplete?: (totalLoaded: number) => void;
}

export class AutoScroller {
  private isScrolling = false;
  private scrollCount = 0;
  private lastPostCount = 0;
  private stagnantScrolls = 0; // Track scrolls with no new posts

  /**
   * Start auto-scrolling to load more posts
   */
  async start(options: AutoScrollOptions = {}): Promise<number> {
    if (this.isScrolling) {
      console.log('Auto-scroll already in progress');
      return 0;
    }

    const {
      targetPostCount = 100,
      maxScrolls = 50,
      scrollDelay = 500,
      onProgress,
      onComplete,
    } = options;

    this.isScrolling = true;
    this.scrollCount = 0;
    this.lastPostCount = this.getPostCount();
    this.stagnantScrolls = 0;

    console.log(`🤖 Auto-scroll started: targeting ${targetPostCount} posts...`);

    try {
      while (this.isScrolling && this.scrollCount < maxScrolls) {
        // Scroll down first
        this.scrollDown();
        this.scrollCount++;

        // Wait for smooth scroll animation to complete (~500ms) + Reddit to detect scroll
        await this.sleep(800);

        // Wait additional time for Reddit to load and render posts
        await this.sleep(scrollDelay);

        // Now check post count after scroll and delay
        const currentPostCount = this.getPostCount();

        // Check if we've reached target
        if (currentPostCount >= targetPostCount) {
          console.log(`✅ Target reached: ${currentPostCount} posts loaded`);
          break;
        }

        // Check if we've stopped loading new posts (reached end)
        if (currentPostCount === this.lastPostCount) {
          this.stagnantScrolls++;

          // If no new posts after 8 scrolls, we've probably hit the end
          if (this.stagnantScrolls >= 8) {
            console.log(`⚠️ No new posts loading after ${this.stagnantScrolls} attempts (likely reached end)`);
            break;
          }
        } else {
          this.stagnantScrolls = 0; // Reset counter when posts are found
        }

        // Update progress
        if (onProgress) {
          onProgress(currentPostCount, targetPostCount);
        }

        console.log(`[Scroll ${this.scrollCount}/${maxScrolls}] Posts: ${currentPostCount}/${targetPostCount} (stagnant: ${this.stagnantScrolls})`);

        this.lastPostCount = currentPostCount;
      }

      const finalCount = this.getPostCount();
      console.log(`✅ Auto-scroll complete: ${finalCount} total posts in DOM`);

      if (onComplete) {
        onComplete(finalCount);
      }

      return finalCount;
    } finally {
      this.isScrolling = false;
    }
  }

  /**
   * Stop auto-scrolling
   */
  stop(): void {
    console.log('🛑 Auto-scroll stopped by user');
    this.isScrolling = false;
  }

  /**
   * Check if currently auto-scrolling
   */
  isActive(): boolean {
    return this.isScrolling;
  }

  /**
   * Scroll down by viewport height
   */
  private scrollDown(): void {
    window.scrollBy({
      top: window.innerHeight * 0.8, // Scroll 80% of viewport height
      behavior: 'smooth',
    });
  }

  /**
   * Get current post count in DOM
   */
  private getPostCount(): number {
    // Try to detect Reddit UI and count posts
    let postElements: NodeListOf<Element> | null = null;

    // New new Reddit (shreddit)
    postElements = document.querySelectorAll('shreddit-post');
    if (postElements.length > 0) {
      return postElements.length;
    }

    // New Reddit
    postElements = document.querySelectorAll('[data-testid="post-container"]');
    if (postElements.length > 0) {
      return postElements.length;
    }

    // Old Reddit
    postElements = document.querySelectorAll('.thing.link');
    if (postElements.length > 0) {
      return postElements.length;
    }

    return 0;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
