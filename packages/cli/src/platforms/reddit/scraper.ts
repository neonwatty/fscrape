import type { ForumPost, Comment, User, SortOption } from '../../types/core.js';
import {
  BasePlatform,
  type BasePlatformConfig,
  type BasePlatformCapabilities,
  type ScrapeOptions,
} from '../base-platform.js';
import { RedditClient, type RedditClientConfig } from './client.js';
import type { RedditPost, RedditComment, RedditListing } from './client.js';
import winston from 'winston';

/**
 * Reddit scraper configuration
 */
export interface RedditScraperConfig extends BasePlatformConfig {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  refreshToken?: string;
  deviceId?: string;
  userAgent?: string;
}

/**
 * Pagination state for tracking multi-page fetches
 */
interface PaginationState {
  after?: string;
  before?: string;
  count: number;
  hasMore: boolean;
}

/**
 * Reddit platform implementation
 */
export class RedditScraper extends BasePlatform {
  private client: RedditClient;
  private readonly capabilities: BasePlatformCapabilities = {
    supportsCommentThreads: true,
    supportsUserProfiles: true,
    supportsSearch: true,
    supportsCategories: true,
    supportsPagination: true,
    supportsRealtime: false,
    maxItemsPerRequest: 100,
    maxCommentDepth: 10, // Reddit's default max depth
  };

  constructor(config: RedditScraperConfig, customLogger?: winston.Logger) {
    super('reddit', config, customLogger);

    // Validate required config
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Reddit clientId and clientSecret are required');
    }

    // Create Reddit client configuration
    const clientConfig: RedditClientConfig = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      userAgent: config.userAgent || 'fscrape/1.0.0',
      ...(config.username && { username: config.username }),
      ...(config.password && { password: config.password }),
      ...(config.refreshToken && { refreshToken: config.refreshToken }),
      ...(config.deviceId && { deviceId: config.deviceId }),
      ...(config.retryAttempts && { maxRetries: config.retryAttempts }),
      ...(config.timeout && { requestTimeout: config.timeout }),
    };

    this.client = new RedditClient(clientConfig);
  }

  /**
   * Get platform capabilities
   */
  getCapabilities(): BasePlatformCapabilities {
    return this.capabilities;
  }

  /**
   * Initialize the Reddit scraper
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Reddit scraper');
    await this.client.initialize();

    // Update auth state based on client state
    if (this.client.isAuthenticated()) {
      this.authState = {
        isAuthenticated: true,
        sessionState: {
          platform: 'reddit',
          authenticated: true,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour default
        },
      };
    }

    this.logger.info('Reddit scraper initialized successfully');
  }

  /**
   * Authenticate with Reddit
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.client.initialize();
      const isAuthenticated = this.client.isAuthenticated();

      if (isAuthenticated) {
        this.updateSessionState({
          authenticated: true,
          expiresAt: new Date(Date.now() + 3600000),
        });
      }

      return isAuthenticated;
    } catch (error) {
      this.logger.error('Failed to authenticate with Reddit', error);
      return false;
    }
  }

  /**
   * Refresh authentication if needed
   */
  async refreshAuth(): Promise<boolean> {
    try {
      // The client handles token refresh internally
      await this.client.initialize();
      return this.client.isAuthenticated();
    } catch (error) {
      this.logger.error('Failed to refresh Reddit authentication', error);
      return false;
    }
  }

  /**
   * Check if authentication is valid
   */
  isAuthValid(): boolean {
    return this.client.isAuthenticated();
  }

  /**
   * Scrape posts from Reddit front page
   * Automatically uses pagination for limits > 100
   */
  async scrapePosts(options?: ScrapeOptions): Promise<ForumPost[]> {
    await this.ensureAuthenticated();

    const limit = options?.limit || 25;

    // Use pagination for limits > 100
    if (limit > 100) {
      this.logger.info(`Limit ${limit} > 100, using automatic pagination for r/all`);

      const maxPages = Math.ceil(limit / 100);
      const result = await this.scrapeCategoryWithPagination('all', {
        ...options,
        limit,
        maxPages,
      });

      return result.posts;
    }

    // For limits <= 100, use single request
    const sort = this.mapSortOption(options?.sortBy);

    try {
      const listing = await this.retryOperation(
        () =>
          this.client.getSubredditPosts('all', sort, {
            limit,
            ...(options?.timeRange && { t: options.timeRange }),
          }),
        'scrapePosts'
      );

      return this.parsePostListing(listing);
    } catch (error) {
      this.handleApiError(error, 'scrapePosts');
    }
  }

  /**
   * Scrape posts from a specific subreddit
   * Automatically uses pagination for limits > 100
   */
  async scrapeCategory(category: string, options?: ScrapeOptions): Promise<ForumPost[]> {
    await this.ensureAuthenticated();

    const limit = options?.limit || 25;

    // Reddit's API max is 100 per request
    // If requesting more than 100, automatically use pagination
    if (limit > 100) {
      this.logger.info(`Limit ${limit} > 100, using automatic pagination for ${category}`);

      const maxPages = Math.ceil(limit / 100);
      const result = await this.scrapeCategoryWithPagination(category, {
        ...options,
        limit,
        maxPages,
      });

      return result.posts;
    }

    // For limits <= 100, use single request (original logic)
    const sort = this.mapSortOption(options?.sortBy);

    try {
      const listing = await this.retryOperation(
        () =>
          this.client.getSubredditPosts(category, sort, {
            limit,
            ...(options?.timeRange && { t: options.timeRange }),
            ...(options?.pagination?.after && {
              after: options.pagination.after,
            }),
            ...(options?.pagination?.before && {
              before: options.pagination.before,
            }),
          }),
        `scrapeCategory(${category})`
      );

      return this.parsePostListing(listing);
    } catch (error) {
      this.handleApiError(error, `scrapeCategory(${category})`);
    }
  }

  /**
   * Scrape posts with automatic pagination
   */
  async scrapeCategoryWithPagination(
    category: string,
    options?: ScrapeOptions & { maxPages?: number }
  ): Promise<{ posts: ForumPost[]; paginationState: PaginationState }> {
    await this.ensureAuthenticated();

    const sort = this.mapSortOption(options?.sortBy);
    const pageSize = Math.min(options?.limit || 25, 100); // Reddit max is 100
    const maxPages = options?.maxPages || 1;
    const targetTotal = options?.limit || pageSize;

    const allPosts: ForumPost[] = [];
    let paginationState: PaginationState = {
      count: 0,
      hasMore: true,
    };
    let pagesLoaded = 0;

    try {
      while (paginationState.hasMore && allPosts.length < targetTotal && pagesLoaded < maxPages) {
        const listing = await this.retryOperation(
          () =>
            this.client.getSubredditPosts(category, sort, {
              limit: Math.min(pageSize, targetTotal - allPosts.length),
              ...(options?.timeRange && { t: options.timeRange }),
              ...(paginationState.after && { after: paginationState.after }),
            }),
          `scrapeCategoryWithPagination(${category}, page ${pagesLoaded + 1})`
        );

        const posts = this.parsePostListing(listing);
        allPosts.push(...posts);
        pagesLoaded++;

        // Update pagination state
        paginationState = {
          ...(listing.data.after && { after: listing.data.after }),
          ...(listing.data.before && { before: listing.data.before }),
          count: allPosts.length,
          hasMore: !!listing.data.after && posts.length === pageSize,
        };

        this.logger.info(
          `Loaded page ${pagesLoaded} of ${category}: ${posts.length} posts (total: ${allPosts.length})`
        );
      }

      return {
        posts: allPosts.slice(0, targetTotal),
        paginationState,
      };
    } catch (error) {
      this.handleApiError(error, `scrapeCategoryWithPagination(${category})`);
    }
  }

  /**
   * Scrape a single post by ID
   */
  async scrapePost(postId: string): Promise<ForumPost | null> {
    await this.ensureAuthenticated();

    try {
      const post = await this.retryOperation(
        () => this.client.getPost(postId),
        `scrapePost(${postId})`
      );

      if (!post) {
        return null;
      }

      return this.client.convertToForumPost(post);
    } catch (error) {
      if (
        (error as any).message?.toLowerCase().includes('not found') ||
        (error as any).message?.toLowerCase().includes('network error')
      ) {
        return null;
      }
      this.handleApiError(error, `scrapePost(${postId})`);
    }
  }

  /**
   * Scrape comments for a post
   */
  async scrapeComments(postId: string, options?: ScrapeOptions): Promise<Comment[]> {
    await this.ensureAuthenticated();

    try {
      // Extract subreddit from post or use "all" as fallback
      const post = await this.client.getPost(postId);
      const subreddit = post.subreddit;

      const [, commentsListing] = await this.retryOperation(
        () =>
          this.client.getComments(subreddit, postId, {
            limit: options?.limit || 100,
            ...(options?.maxDepth && { depth: options.maxDepth }),
            sort: this.mapCommentSort(options?.sortBy),
          }),
        `scrapeComments(${postId})`
      );

      return this.parseCommentListing(commentsListing, postId, options?.maxDepth);
    } catch (error) {
      this.handleApiError(error, `scrapeComments(${postId})`);
    }
  }

  /**
   * Scrape user profile information
   */
  async scrapeUser(username: string): Promise<User | null> {
    await this.ensureAuthenticated();

    try {
      const user = await this.retryOperation(
        () => this.client.getUser(username),
        `scrapeUser(${username})`
      );

      return this.client.convertToUser(user);
    } catch (error) {
      if (
        (error as any).statusCode === 404 ||
        (error as any).message?.toLowerCase().includes('user not found') ||
        (error as any).message?.toLowerCase().includes('404 not found')
      ) {
        return null;
      }
      this.handleApiError(error, `scrapeUser(${username})`);
    }
  }

  /**
   * Search for posts on Reddit
   */
  async search(query: string, options?: ScrapeOptions): Promise<ForumPost[]> {
    await this.ensureAuthenticated();

    try {
      const listing = await this.retryOperation(
        () =>
          this.client.search(query, {
            sort: this.mapSearchSort(options?.sortBy),
            ...(options?.timeRange && { t: options.timeRange }),
            limit: options?.limit || 25,
            ...(options?.pagination?.after && {
              after: options.pagination.after,
            }),
          }),
        `search(${query})`
      );

      return this.parsePostListing(listing);
    } catch (error) {
      this.handleApiError(error, `search(${query})`);
    }
  }

  /**
   * Search with automatic pagination
   */
  async searchWithPagination(
    query: string,
    options?: ScrapeOptions & { maxPages?: number }
  ): Promise<{ posts: ForumPost[]; paginationState: PaginationState }> {
    await this.ensureAuthenticated();

    const pageSize = Math.min(options?.limit || 25, 100);
    const maxPages = options?.maxPages || 1;
    const targetTotal = options?.limit || pageSize;

    const allPosts: ForumPost[] = [];
    let paginationState: PaginationState = {
      count: 0,
      hasMore: true,
    };
    let pagesLoaded = 0;

    try {
      while (paginationState.hasMore && allPosts.length < targetTotal && pagesLoaded < maxPages) {
        const listing = await this.retryOperation(
          () =>
            this.client.search(query, {
              sort: this.mapSearchSort(options?.sortBy),
              ...(options?.timeRange && { t: options.timeRange }),
              limit: Math.min(pageSize, targetTotal - allPosts.length),
              ...(paginationState.after && { after: paginationState.after }),
            }),
          `searchWithPagination(${query}, page ${pagesLoaded + 1})`
        );

        const posts = this.parsePostListing(listing);
        allPosts.push(...posts);
        pagesLoaded++;

        // Update pagination state
        paginationState = {
          ...(listing.data.after && { after: listing.data.after }),
          ...(listing.data.before && { before: listing.data.before }),
          count: allPosts.length,
          hasMore: !!listing.data.after && posts.length === pageSize,
        };

        this.logger.info(
          `Search page ${pagesLoaded}: ${posts.length} posts (total: ${allPosts.length})`
        );
      }

      return {
        posts: allPosts.slice(0, targetTotal),
        paginationState,
      };
    } catch (error) {
      this.handleApiError(error, `searchWithPagination(${query})`);
    }
  }

  /**
   * Get trending/hot posts from Reddit
   */
  async getTrending(options?: ScrapeOptions): Promise<ForumPost[]> {
    await this.ensureAuthenticated();

    try {
      const listing = await this.retryOperation(
        () =>
          this.client.getSubredditPosts('all', 'hot', {
            limit: options?.limit || 25,
          }),
        'getTrending'
      );

      return this.parsePostListing(listing);
    } catch (error) {
      this.handleApiError(error, 'getTrending');
    }
  }

  /**
   * Test Reddit connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.initialize();

      // Try to fetch a small number of posts from /r/all
      await this.client.getSubredditPosts('all', 'hot', { limit: 1 });

      return true;
    } catch (error) {
      this.logger.error('Reddit connection test failed', error);
      return false;
    }
  }

  /**
   * Parse post listing to ForumPost array
   */
  private parsePostListing(listing: RedditListing<RedditPost>): ForumPost[] {
    return listing.data.children.map((child) => this.client.convertToForumPost(child.data));
  }

  /**
   * Parse comment listing to Comment array with depth control
   */
  private parseCommentListing(
    listing: RedditListing<RedditComment>,
    postId: string,
    maxDepth?: number
  ): Comment[] {
    const comments: Comment[] = [];
    const effectiveMaxDepth = maxDepth ?? this.capabilities.maxCommentDepth ?? 10;

    const processComment = (commentData: RedditComment, currentDepth: number = 0) => {
      // Add the comment
      comments.push(this.client.convertToComment(commentData, postId));

      // Process replies recursively with depth check
      if (
        currentDepth < effectiveMaxDepth &&
        commentData.replies &&
        typeof commentData.replies === 'object'
      ) {
        const repliesListing = commentData.replies as RedditListing<RedditComment>;
        for (const replyChild of repliesListing.data.children) {
          if (replyChild.kind === 't1') {
            processComment(replyChild.data, currentDepth + 1);
          }
        }
      }
    };

    // Process all top-level comments
    for (const child of listing.data.children) {
      if (child.kind === 't1') {
        processComment(child.data, 0);
      }
    }

    this.logger.info(`Parsed ${comments.length} comments with max depth ${effectiveMaxDepth}`);

    return comments;
  }

  /**
   * Map SortOption to Reddit sort parameter
   */
  private mapSortOption(
    sortOption?: SortOption
  ): 'hot' | 'new' | 'top' | 'rising' | 'controversial' {
    switch (sortOption) {
      case 'new':
        return 'new';
      case 'top':
        return 'top';
      case 'controversial':
        return 'controversial';
      case 'hot':
      default:
        return 'hot';
    }
  }

  /**
   * Map SortOption to Reddit comment sort
   */
  private mapCommentSort(
    sortOption?: SortOption
  ): 'confidence' | 'top' | 'new' | 'controversial' | 'old' {
    switch (sortOption) {
      case 'new':
        return 'new';
      case 'top':
        return 'top';
      case 'controversial':
        return 'controversial';
      case 'old' as any:
        return 'old';
      default:
        return 'confidence';
    }
  }

  /**
   * Map SortOption to Reddit search sort
   */
  private mapSearchSort(sortOption?: SortOption): 'relevance' | 'hot' | 'top' | 'new' | 'comments' {
    switch (sortOption) {
      case 'new':
        return 'new';
      case 'top':
        return 'top';
      case 'hot':
        return 'hot';
      default:
        return 'relevance';
    }
  }
}
