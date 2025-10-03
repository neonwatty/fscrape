/**
 * Reddit DOM Scraper
 * Extracts post data from different Reddit UI versions
 */

import type { Post } from '../shared/types';

export type RedditUIVersion = 'new' | 'old' | 'sh';

export class RedditScraper {
  /**
   * Detect which Reddit UI version is being used
   */
  detectRedditUI(): RedditUIVersion {
    if (window.location.hostname === 'old.reddit.com') {
      return 'old';
    }

    // New new Reddit (shreddit - custom elements)
    if (document.querySelector('shreddit-post')) {
      return 'sh';
    }

    // New Reddit (React-based)
    return 'new';
  }

  /**
   * Get current subreddit from URL
   */
  getCurrentSubreddit(): string | null {
    const match = window.location.pathname.match(/^\/r\/([^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract posts from current page based on UI version
   */
  extractPosts(): Post[] {
    const uiVersion = this.detectRedditUI();

    switch (uiVersion) {
      case 'sh':
        return this.extractFromShredditUI();
      case 'new':
        return this.extractFromNewReddit();
      case 'old':
        return this.extractFromOldReddit();
      default:
        console.warn('Unknown Reddit UI version');
        return [];
    }
  }

  /**
   * Extract post from a single element
   */
  extractPostFromElement(element: Element): Post | null {
    const uiVersion = this.detectRedditUI();

    switch (uiVersion) {
      case 'sh':
        return this.extractFromShredditElement(element as HTMLElement);
      case 'new':
        return this.extractFromNewRedditElement(element);
      case 'old':
        return this.extractFromOldRedditElement(element);
      default:
        return null;
    }
  }

  /**
   * Check if element is a post element
   */
  isPostElement(element: Element): boolean {
    const uiVersion = this.detectRedditUI();

    switch (uiVersion) {
      case 'sh':
        return element.tagName.toLowerCase() === 'shreddit-post';
      case 'new':
        return (
          element.hasAttribute('data-testid') &&
          element.getAttribute('data-testid') === 'post-container'
        );
      case 'old':
        return element.classList.contains('thing') && element.classList.contains('link');
      default:
        return false;
    }
  }

  // ==================== SHREDDIT UI (sh.reddit.com / new new Reddit) ====================

  private extractFromShredditUI(): Post[] {
    const postElements = document.querySelectorAll('shreddit-post');
    const posts: Post[] = [];

    postElements.forEach((el) => {
      const post = this.extractFromShredditElement(el as HTMLElement);
      if (post) {
        posts.push(post);
      }
    });

    return posts;
  }

  private extractFromShredditElement(el: HTMLElement): Post | null {
    try {
      const postId = el.getAttribute('id');
      const subreddit = el.getAttribute('subreddit-prefixed-name')?.replace('r/', '');
      const author = el.getAttribute('author');
      const createdTimestamp = el.getAttribute('created-timestamp');

      if (!postId || !subreddit || !author || !createdTimestamp) {
        return null;
      }

      // Extract title
      const titleEl = el.querySelector('h3, [slot="title"]');
      const title = titleEl?.textContent?.trim() || '';

      // Extract score and comments
      const score = parseInt(el.getAttribute('score') || '0');
      const commentCount = parseInt(el.getAttribute('comment-count') || '0');

      // Extract URL/permalink
      const permalink = el.getAttribute('content-href') || el.getAttribute('permalink') || '';
      const url = permalink.startsWith('http') ? permalink : `https://reddit.com${permalink}`;

      // Extract content (selftext)
      const contentEl = el.querySelector('[slot="text-body"]');
      const content = contentEl?.textContent?.trim() || '';

      // Extract metadata
      const flair = el.querySelector('flair-text')?.textContent?.trim();
      const isNsfw = el.hasAttribute('post-nsfw') || el.getAttribute('post-nsfw') === 'true';
      const isLocked = el.hasAttribute('post-locked') || el.getAttribute('post-locked') === 'true';
      const isStickied = el.hasAttribute('post-stickied') || el.getAttribute('post-stickied') === 'true';

      // Create Post object
      const post: Post = {
        id: `reddit_${postId}`,
        platform_id: postId,
        subreddit,
        title,
        author,
        author_id: el.getAttribute('author-id') || undefined,
        url,
        content: content || undefined,
        score,
        comment_count: commentCount,
        created_at: new Date(createdTimestamp).getTime(),
        scraped_at: Date.now(),
        flair: flair || undefined,
        is_nsfw: isNsfw,
        is_locked: isLocked,
        is_stickied: isStickied,
        thumbnail_url: el.getAttribute('thumbnail') || undefined,
      };

      return post;
    } catch (error) {
      console.error('Error extracting shreddit post:', error);
      return null;
    }
  }

  // ==================== NEW REDDIT UI (www.reddit.com - React) ====================

  private extractFromNewReddit(): Post[] {
    // New Reddit uses data-testid="post-container"
    const postElements = document.querySelectorAll('[data-testid="post-container"]');
    const posts: Post[] = [];

    postElements.forEach((el) => {
      const post = this.extractFromNewRedditElement(el);
      if (post) {
        posts.push(post);
      }
    });

    return posts;
  }

  private extractFromNewRedditElement(el: Element): Post | null {
    try {
      // Extract post ID from various possible locations
      const postIdMatch =
        el.getAttribute('id')?.match(/t3_([a-z0-9]+)/) ||
        el.querySelector('a[href*="/comments/"]')?.getAttribute('href')?.match(/\/comments\/([a-z0-9]+)\//);

      if (!postIdMatch) {
        return null;
      }

      const postId = `t3_${postIdMatch[1]}`;

      // Extract subreddit
      const subredditLink = el.querySelector('a[href^="/r/"]');
      const subredditMatch = subredditLink?.getAttribute('href')?.match(/^\/r\/([^\/]+)/);
      const subreddit = subredditMatch ? subredditMatch[1] : this.getCurrentSubreddit();

      if (!subreddit) {
        return null;
      }

      // Extract title
      const titleEl = el.querySelector('h3, [data-testid="post-title"]');
      const title = titleEl?.textContent?.trim() || '';

      // Extract author
      const authorLink = el.querySelector('a[href^="/user/"], a[href^="/u/"]');
      const author = authorLink?.textContent?.replace(/^u\//, '').trim() || '[deleted]';

      // Extract score
      const scoreEl = el.querySelector('[id^="vote-arrows"] div');
      const scoreText = scoreEl?.textContent?.trim() || '0';
      const score = this.parseScore(scoreText);

      // Extract comment count
      const commentEl = el.querySelector('a[href*="/comments/"] span');
      const commentText = commentEl?.textContent?.trim() || '0';
      const commentCount = this.parseCommentCount(commentText);

      // Extract URL
      const linkEl = el.querySelector('a[data-click-id="body"]') as HTMLAnchorElement;
      const url = linkEl?.href || window.location.href;

      // Extract timestamp
      const timeEl = el.querySelector('time');
      const timestamp = timeEl?.getAttribute('datetime') || timeEl?.getAttribute('title') || '';
      const createdAt = timestamp ? new Date(timestamp).getTime() : Date.now();

      // Extract flair
      const flairEl = el.querySelector('[data-testid="post-flair"]');
      const flair = flairEl?.textContent?.trim();

      // Extract NSFW/spoiler/locked flags
      const isNsfw = !!el.querySelector('[data-testid="post-nsfw-badge"]');
      const isLocked = !!el.querySelector('[aria-label*="locked"]');
      const isStickied = !!el.querySelector('[data-testid="post-stickied-badge"]');

      const post: Post = {
        id: `reddit_${postId}`,
        platform_id: postId,
        subreddit,
        title,
        author,
        url,
        score,
        comment_count: commentCount,
        created_at: createdAt,
        scraped_at: Date.now(),
        flair: flair || undefined,
        is_nsfw: isNsfw,
        is_locked: isLocked,
        is_stickied: isStickied,
      };

      return post;
    } catch (error) {
      console.error('Error extracting new Reddit post:', error);
      return null;
    }
  }

  // ==================== OLD REDDIT UI (old.reddit.com) ====================

  private extractFromOldReddit(): Post[] {
    const postElements = document.querySelectorAll('.thing.link');
    const posts: Post[] = [];

    postElements.forEach((el) => {
      const post = this.extractFromOldRedditElement(el);
      if (post) {
        posts.push(post);
      }
    });

    return posts;
  }

  private extractFromOldRedditElement(el: Element): Post | null {
    try {
      const postId = el.getAttribute('data-fullname');
      const subreddit = el.getAttribute('data-subreddit');
      const author = el.getAttribute('data-author');

      if (!postId || !subreddit || !author) {
        return null;
      }

      // Extract title
      const titleEl = el.querySelector('a.title');
      const title = titleEl?.textContent?.trim() || '';

      // Extract score
      const scoreEl = el.querySelector('.score.unvoted');
      const scoreText = scoreEl?.getAttribute('title') || scoreEl?.textContent || '0';
      const score = this.parseScore(scoreText);

      // Extract comment count
      const commentEl = el.querySelector('.comments');
      const commentText = commentEl?.textContent?.trim() || '0';
      const commentCount = this.parseCommentCount(commentText);

      // Extract URL
      const linkEl = titleEl as HTMLAnchorElement;
      const url = linkEl?.href || window.location.href;

      // Extract timestamp
      const timeEl = el.querySelector('time');
      const timestamp = timeEl?.getAttribute('datetime') || '';
      const createdAt = timestamp ? new Date(timestamp).getTime() : Date.now();

      // Extract flair
      const flairEl = el.querySelector('.linkflairlabel');
      const flair = flairEl?.textContent?.trim();

      // Extract flags
      const isNsfw = el.classList.contains('over18');
      const isLocked = el.classList.contains('locked');
      const isStickied = el.classList.contains('stickied');

      const post: Post = {
        id: `reddit_${postId}`,
        platform_id: postId,
        subreddit,
        title,
        author,
        url,
        score,
        comment_count: commentCount,
        created_at: createdAt,
        scraped_at: Date.now(),
        flair: flair || undefined,
        is_nsfw: isNsfw,
        is_locked: isLocked,
        is_stickied: isStickied,
      };

      return post;
    } catch (error) {
      console.error('Error extracting old Reddit post:', error);
      return null;
    }
  }

  // ==================== UTILITY METHODS ====================

  private parseScore(scoreText: string): number {
    // Handle "k" suffix (e.g., "1.2k" -> 1200)
    const match = scoreText.match(/([\d.]+)k?/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    return scoreText.toLowerCase().includes('k') ? Math.round(value * 1000) : Math.round(value);
  }

  private parseCommentCount(commentText: string): number {
    // Extract number from text like "123 comments" or "1.2k comments"
    const match = commentText.match(/([\d.]+)k?\s*comment/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    return commentText.toLowerCase().includes('k') ? Math.round(value * 1000) : Math.round(value);
  }
}
