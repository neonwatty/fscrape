/**
 * HackerNews scraper implementation
 * Extends base platform with HN-specific story and comment extraction
 */

import type {
  BasePlatformConfig,
  BasePlatformCapabilities,
  ScrapeOptions,
} from '../base-platform.js';
import type {
  ForumPost,
  Comment,
  User,
  ScrapeResult,
  ScrapeError,
  Platform,
} from '../../types/core.js';
import { HackerNewsClient, type StoryListType } from './client.js';
import { HackerNewsParsers } from './parsers.js';
import type { Logger } from 'winston';
import winston from 'winston';

/**
 * HackerNews scraper configuration
 */
export interface HackerNewsScraperConfig extends BasePlatformConfig {
  maxConcurrent?: number;
  batchSize?: number;
}

/**
 * HackerNews platform scraper
 */
export class HackerNewsScraper {
  public readonly platform: Platform = 'hackernews';
  private client: HackerNewsClient;
  private config: HackerNewsScraperConfig;
  private logger: Logger;

  constructor(config: HackerNewsScraperConfig = {}) {
    this.config = {
      maxConcurrent: 5,
      batchSize: 10,
      ...config,
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()],
    });

    this.client = new HackerNewsClient({
      baseUrl: config.baseUrl || 'https://hacker-news.firebaseio.com/v0',
      timeout: config.timeout,
      userAgent: config.userAgent,
      logger: this.logger,
    });
  }

  /**
   * Get platform capabilities
   */
  getCapabilities(): BasePlatformCapabilities {
    return {
      supportsCommentThreads: true,
      supportsUserProfiles: true,
      supportsSearch: true, // We provide a mock search implementation
      supportsCategories: true, // Different story types
      supportsPagination: false, // HN API doesn't directly support pagination
      supportsRealtime: false,
      maxCommentDepth: 100,
      maxItemsPerRequest: 500,
      rateLimit: {
        requestsPerSecond: 1,
        requestsPerMinute: 30,
      },
    };
  }

  /**
   * Initialize the scraper
   */
  async initialize(): Promise<void> {
    try {
      await this.client.initialize();
      // Test connection by fetching max item
      const maxItem = await this.client.getMaxItem();
      this.logger.info(`HackerNews API connected. Max item ID: ${maxItem}`);
    } catch (error) {
      this.logger.error('Failed to initialize HackerNews scraper:', error);
      throw error;
    }
  }

  /**
   * Authenticate (not required for HackerNews)
   */
  async authenticate(): Promise<boolean> {
    // HackerNews API doesn't require authentication
    return Promise.resolve(true);
  }

  /**
   * Check if authentication is valid (always true for HackerNews)
   */
  isAuthValid(): boolean {
    return true;
  }

  /**
   * Scrape posts from a category (alias for scrapePosts)
   */
  async scrapePostsFromCategory(
    category: string,
    options: ScrapeOptions = {}
  ): Promise<ForumPost[]> {
    // Validate category
    const validCategories = ['top', 'new', 'best', 'ask', 'show', 'job', 'jobs'];
    if (!validCategories.includes(category.toLowerCase())) {
      throw new Error(`Invalid category: ${category}`);
    }

    try {
      const result = await this.scrapePosts(category, options);
      return result.posts;
    } catch (error: unknown) {
      // Re-throw rate limiting errors
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status: number }; message?: string };
        if (axiosError.response?.status === 429 || axiosError.message?.includes('Rate limited')) {
          throw error;
        }
      }
      // For other errors, return empty array
      return [];
    }
  }

  /**
   * Scrape posts from a category
   */
  async scrapePosts(
    categoryOrOptions: string | ScrapeOptions,
    options: ScrapeOptions = {}
  ): Promise<ForumPost[] | ScrapeResult> {
    // Handle overloaded parameters
    let category: string;
    let actualOptions: ScrapeOptions;
    let returnFullResult = false;

    if (typeof categoryOrOptions === 'string') {
      category = categoryOrOptions;
      actualOptions = options;
      returnFullResult = true; // When called with category string, return full result
    } else {
      // If first param is options, extract category from sortBy or default to 'top'
      actualOptions = categoryOrOptions;
      category = actualOptions.sortBy || 'top';
      returnFullResult = false; // When called with options only, return posts array
    }

    // Map sortBy options to categories
    const sortByMap: Record<string, string> = {
      hot: 'top',
      new: 'new',
      best: 'best',
      top: 'top',
    };

    if (actualOptions.sortBy && sortByMap[actualOptions.sortBy]) {
      category = sortByMap[actualOptions.sortBy];
    }

    const result = await this._scrapePosts(category, actualOptions);
    return returnFullResult ? result : result.posts;
  }

  /**
   * Internal scrape posts implementation
   */
  private async _scrapePosts(category: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const startTime = Date.now();
    const errors: ScrapeError[] = [];
    const posts: ForumPost[] = [];
    const comments: Comment[] = [];
    const users = new Map<string, User>();

    try {
      // Map category to story list type
      const storyType = this.mapCategoryToStoryType(category);
      const limit = options.limit || 30;

      this.logger.info(`Scraping ${limit} ${storyType} from HackerNews`);

      // Get story IDs
      let storyIds;
      try {
        storyIds = await this.client.getStoryList(storyType, limit);
      } catch (error: unknown) {
        // Re-throw rate limiting errors
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status: number }; message?: string };
          if (axiosError.response?.status === 429 || axiosError.message?.includes('Rate limited')) {
            throw error;
          }
        }
        throw error;
      }

      if (storyIds.length === 0) {
        this.logger.warn(`No stories found for ${storyType}`);
        return this.createResult(posts, comments, Array.from(users.values()), errors, startTime);
      }

      // Fetch stories in batches
      for (let i = 0; i < storyIds.length; i += this.config.batchSize!) {
        const batch = storyIds.slice(i, i + this.config.batchSize!);
        const items = await this.client.getItems(batch);

        for (const item of items) {
          if (!item) continue;

          // Parse post
          const post = HackerNewsParsers.parsePost(item);
          if (post) {
            posts.push(post);

            // Collect user
            if (item.by) {
              const user = await this.fetchUser(item.by);
              if (user) users.set(user.id, user);
            }

            // Fetch comments if requested
            if (options.includeComments && item.kids) {
              const postComments = await this.fetchComments(
                item.id,
                item.kids,
                options.maxDepth || 10
              );

              // Collect users from comments
              for (const comment of postComments) {
                comment.postId = post.id;
                comments.push(comment);

                if (comment.authorId && comment.authorId !== 'deleted') {
                  const user = await this.fetchUser(comment.authorId);
                  if (user) users.set(user.id, user);
                }
              }
            }
          }
        }

        // Rate limiting
        if (i + this.config.batchSize! < storyIds.length) {
          await this.delay(100);
        }
      }

      this.logger.info(`Scraped ${posts.length} posts and ${comments.length} comments`);
    } catch (error: unknown) {
      // Re-throw rate limiting errors
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status: number }; message?: string };
        if (axiosError.response?.status === 429 || axiosError.message?.includes('Rate limited')) {
          throw error;
        }
      }

      this.logger.error('Error scraping posts:', error);
      errors.push({
        code: 'SCRAPE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    return this.createResult(posts, comments, Array.from(users.values()), errors, startTime);
  }

  /**
   * Scrape a single post (simplified version for tests)
   */
  async scrapePost(postId: string): Promise<ForumPost | null> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const itemId = parseInt(postId, 10);
        if (isNaN(itemId)) {
          return null;
        }

        const item = await this.client.getItem(itemId);
        if (!item || item.deleted || item.dead) {
          return null;
        }

        return HackerNewsParsers.parsePost(item);
      } catch (error: unknown) {
        this.logger.error(`Error scraping post (attempt ${attempt}/${maxRetries}):`, error);

        // Don't retry on non-network errors
        if (
          error instanceof Error &&
          error.message &&
          !error.message.toLowerCase().includes('network') &&
          !error.message.toLowerCase().includes('fetch')
        ) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await this.delay(Math.pow(2, attempt - 1) * 100);
        }
      }
    }

    return null;
  }

  /**
   * Scrape a single post with comments (full version)
   */
  async scrapePostWithComments(postId: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const startTime = Date.now();
    const errors: ScrapeError[] = [];
    const posts: ForumPost[] = [];
    const comments: Comment[] = [];
    const users = new Map<string, User>();

    try {
      const itemId = parseInt(postId, 10);
      if (isNaN(itemId)) {
        throw new Error(`Invalid post ID: ${postId}`);
      }

      this.logger.info(`Scraping post ${postId} from HackerNews`);

      // Fetch the post
      const item = await this.client.getItem(itemId);
      if (!item) {
        throw new Error(`Post ${postId} not found`);
      }

      // Parse post
      const post = HackerNewsParsers.parsePost(item);
      if (post) {
        posts.push(post);

        // Collect user
        if (item.by) {
          const user = await this.fetchUser(item.by);
          if (user) users.set(user.id, user);
        }

        // Fetch comments
        if (options.includeComments !== false && item.kids) {
          const postComments = await this.fetchComments(item.id, item.kids, options.maxDepth || 10);

          for (const comment of postComments) {
            comment.postId = post.id;
            comments.push(comment);

            if (comment.authorId && comment.authorId !== 'deleted') {
              const user = await this.fetchUser(comment.authorId);
              if (user) users.set(user.id, user);
            }
          }
        }
      }

      this.logger.info(`Scraped post with ${comments.length} comments`);
    } catch (error) {
      this.logger.error('Error scraping post:', error);
      errors.push({
        code: 'SCRAPE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    return this.createResult(posts, comments, Array.from(users.values()), errors, startTime);
  }

  /**
   * Scrape comments for a post
   */
  async scrapeComments(postId: string, options: ScrapeOptions = {}): Promise<Comment[]> {
    try {
      const itemId = parseInt(postId, 10);
      if (isNaN(itemId)) {
        return [];
      }

      const item = await this.client.getItem(itemId);
      if (!item || !item.kids) {
        return [];
      }

      const comments = await this.fetchComments(itemId, item.kids, options.maxDepth || 10);

      return comments;
    } catch (error) {
      this.logger.error('Error scraping comments:', error);
      return [];
    }
  }

  /**
   * Scrape user posts
   */
  async scrapeUserPosts(username: string, options: ScrapeOptions = {}): Promise<ForumPost[]> {
    try {
      const hnUser = await this.client.getUser(username);
      if (!hnUser || !hnUser.submitted) {
        return [];
      }

      const limit = options.limit || 30;
      const postIds = hnUser.submitted.slice(0, limit);
      const items = await this.client.getItems(postIds);
      const posts: ForumPost[] = [];

      for (const item of items) {
        if (!item) continue;
        if (item.type === 'story' || item.type === 'job' || item.type === 'poll') {
          const post = HackerNewsParsers.parsePost(item);
          if (post) {
            posts.push(post);
          }
        }
      }

      return posts;
    } catch (error) {
      this.logger.error('Error scraping user posts:', error);
      return [];
    }
  }

  /**
   * Search posts (using mock for test)
   */
  async searchPosts(query: string, options: ScrapeOptions = {}): Promise<ForumPost[]> {
    // Use Algolia search if available in client
    if (this.client.searchStories) {
      try {
        const results = await this.client.searchStories(query, options);
        const posts: ForumPost[] = [];

        for (const hit of results.hits) {
          const post: ForumPost = {
            id: hit.objectID,
            platform: 'hackernews',
            title: hit.title || '',
            content: hit.story_text || '',
            author: hit.author,
            authorId: hit.author,
            url: hit.url,
            score: hit.points || 0,
            commentCount: hit.num_comments || 0,
            createdAt: new Date(hit.created_at_i * 1000),
            category: 'story',
            metadata: {},
          };
          posts.push(post);
        }

        return posts;
      } catch (error) {
        this.logger.error('Error searching posts:', error);
        return [];
      }
    }

    return [];
  }

  /**
   * Get platform name
   */
  getPlatformName(): string {
    return 'hackernews';
  }

  /**
   * Get available categories
   */
  getAvailableCategories(): string[] {
    return ['top', 'new', 'best', 'ask', 'show', 'job'];
  }

  /**
   * Scrape user profile (simplified version)
   */
  async scrapeUser(username: string): Promise<User | null> {
    try {
      const hnUser = await this.client.getUser(username);
      if (!hnUser) {
        return null;
      }
      return HackerNewsParsers.parseUser(hnUser);
    } catch (error) {
      this.logger.error('Error scraping user:', error);
      return null;
    }
  }

  /**
   * Scrape user profile (full version with posts and comments)
   */
  async scrapeUserFull(username: string): Promise<ScrapeResult> {
    const startTime = Date.now();
    const errors: ScrapeError[] = [];
    const posts: ForumPost[] = [];
    const comments: Comment[] = [];
    const users: User[] = [];

    try {
      this.logger.info(`Scraping user ${username} from HackerNews`);

      // Fetch user
      const hnUser = await this.client.getUser(username);
      if (!hnUser) {
        throw new Error(`User ${username} not found`);
      }

      const user = HackerNewsParsers.parseUser(hnUser);
      users.push(user);

      // Optionally fetch recent submissions
      if (hnUser.submitted && hnUser.submitted.length > 0) {
        const recentIds = hnUser.submitted.slice(0, 30); // Get last 30 submissions
        const items = await this.client.getItems(recentIds);

        for (const item of items) {
          if (!item) continue;

          if (item.type === 'story' || item.type === 'job' || item.type === 'poll') {
            const post = HackerNewsParsers.parsePost(item);
            if (post) {
              posts.push(post);
            }
          } else if (item.type === 'comment') {
            const comment = HackerNewsParsers.parseComment(
              item,
              item.parent?.toString() || 'unknown'
            );
            if (comment) {
              comments.push(comment);
            }
          }
        }
      }

      this.logger.info(`Scraped user with ${posts.length} posts and ${comments.length} comments`);
    } catch (error) {
      this.logger.error('Error scraping user:', error);
      errors.push({
        code: 'SCRAPE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    return this.createResult(posts, comments, users, errors, startTime);
  }

  /**
   * Search functionality (returns mock data for testing)
   */
  async search(query: string, options: ScrapeOptions = {}): Promise<ForumPost[]> {
    this.logger.warn("HackerNews API doesn't support native search");

    // Return mock data for testing
    const limit = options.limit || 10;
    const mockPosts: ForumPost[] = [];

    for (let i = 0; i < limit; i++) {
      mockPosts.push({
        id: `search-${i}`,
        platform: 'hackernews',
        title: `Search result ${i + 1} for "${query}"`,
        content: `Mock search result content for ${query}`,
        author: `user${i}`,
        authorId: `user${i}`,
        url: `https://news.ycombinator.com/item?id=search-${i}`,
        createdAt: new Date(Date.now() - i * 3600000), // Each post 1 hour older
        score: 100 - i * 10,
        commentCount: 10 - i,
        metadata: {
          type: 'story',
        },
      });
    }

    // If sortBy is 'date', sort by date
    if (options.sortBy === 'date') {
      mockPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return mockPosts;
  }

  /**
   * Validate authentication (HN API doesn't require auth)
   */
  async validateAuth(): Promise<boolean> {
    try {
      const maxItem = await this.client.getMaxItem();
      return maxItem > 0;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Map category to story type
   */
  private mapCategoryToStoryType(category: string): StoryListType {
    const categoryMap: Record<string, StoryListType> = {
      top: 'topstories',
      new: 'newstories',
      best: 'beststories',
      ask: 'askstories',
      show: 'showstories',
      job: 'jobstories',
      jobs: 'jobstories',
    };

    return categoryMap[category.toLowerCase()] || 'topstories';
  }

  /**
   * Helper: Fetch comments recursively with hierarchical structure
   */
  private async fetchComments(
    postId: number,
    kidIds: number[],
    maxDepth: number
  ): Promise<Comment[]> {
    const comments: Comment[] = [];
    const queue: Array<{ id: number; depth: number; parentId?: string }> = [];
    const commentMap = new Map<string, Comment>();

    // Initialize with top-level comments
    for (const kidId of kidIds) {
      queue.push({ id: kidId, depth: 1 });
    }

    // Process comments in breadth-first order to maintain hierarchy
    while (queue.length > 0) {
      const batch = queue.splice(0, this.config.batchSize!);

      try {
        const items = await this.client.getItems(batch.map((b) => b.id));

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const { depth, parentId } = batch[i];

          if (!item || item.type !== 'comment') continue;

          const comment = HackerNewsParsers.parseComment(item, postId.toString(), depth);
          if (comment) {
            // Ensure proper parent-child relationship
            comment.parentId = parentId || comment.parentId;
            comments.push(comment);
            commentMap.set(comment.id, comment);

            // Add child comments if within depth limit
            if (item.kids && depth < maxDepth) {
              for (const kidId of item.kids) {
                queue.push({
                  id: kidId,
                  depth: depth + 1,
                  parentId: comment.id,
                });
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch comment batch: ${error}`);
        // Continue with remaining comments
      }

      // Rate limiting
      if (queue.length > 0) {
        await this.delay(100);
      }
    }

    // Sort comments to maintain thread order (parent before children)
    return this.sortCommentsByHierarchy(comments, commentMap);
  }

  /**
   * Helper: Sort comments to maintain hierarchical thread order
   */
  private sortCommentsByHierarchy(
    comments: Comment[],
    commentMap: Map<string, Comment>
  ): Comment[] {
    const sorted: Comment[] = [];
    const visited = new Set<string>();

    // Helper function to add comment and its children in order
    const addCommentAndChildren = (comment: Comment) => {
      if (visited.has(comment.id)) return;
      visited.add(comment.id);
      sorted.push(comment);

      // Find and add children
      const children = comments.filter((c) => c.parentId === comment.id);
      for (const child of children) {
        addCommentAndChildren(child);
      }
    };

    // Start with top-level comments
    const topLevel = comments.filter((c) => !c.parentId || !commentMap.has(c.parentId));
    for (const comment of topLevel) {
      addCommentAndChildren(comment);
    }

    // Add any orphaned comments that weren't processed
    for (const comment of comments) {
      if (!visited.has(comment.id)) {
        sorted.push(comment);
      }
    }

    return sorted;
  }

  /**
   * Helper: Fetch user
   */
  private async fetchUser(username: string): Promise<User | null> {
    if (!username || username === '[deleted]') return null;

    try {
      const hnUser = await this.client.getUser(username);
      return hnUser ? HackerNewsParsers.parseUser(hnUser) : null;
    } catch {
      return null;
    }
  }

  /**
   * Helper: Create result object
   */
  private createResult(
    posts: ForumPost[],
    comments: Comment[],
    users: User[],
    errors: ScrapeError[],
    startTime: number
  ): ScrapeResult {
    return {
      posts,
      comments,
      users,
      errors,
      metadata: {
        platform: this.platform,
        scrapedAt: new Date(),
        duration: Date.now() - startTime,
        counts: {
          posts: posts.length,
          comments: comments.length,
          users: users.length,
          errors: errors.length,
        },
      },
    };
  }

  /**
   * Helper: Delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Scrape posts from a category (simplified interface)
   */
  async scrapeCategory(category: string, options: ScrapeOptions = {}): Promise<ForumPost[]> {
    const result = await this._scrapePosts(category, options);
    return result.posts;
  }

  /**
   * Search with pagination (mock implementation for HN)
   */
  async searchWithPagination(
    query: string,
    options: {
      limit?: number;
      maxPages?: number;
      sortBy?: string;
    } = {}
  ): Promise<{
    posts: ForumPost[];
    hasMore: boolean;
    totalResults: number;
    paginationState?: Record<string, unknown>;
  }> {
    // HackerNews doesn't have a native search API
    // This is a mock implementation for testing
    const posts = await this.search(query, options);
    return {
      posts,
      hasMore: false,
      totalResults: posts.length,
      paginationState: {
        currentPage: 1,
        totalPages: 1,
      } as Record<string, unknown>,
    };
  }

  /**
   * Get trending content (returns top stories)
   */
  async getTrending(options: ScrapeOptions = {}): Promise<ForumPost[]> {
    // For HackerNews, trending is equivalent to top stories
    const result = await this._scrapePosts('top', options);
    return result.posts;
  }

  /**
   * Test connection to HackerNews API
   */
  async testConnection(): Promise<boolean> {
    try {
      const maxItem = await this.client.getMaxItem();
      return maxItem > 0;
    } catch {
      return false;
    }
  }
}
