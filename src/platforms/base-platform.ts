import type {
  ForumPost,
  Comment,
  User,
  ScrapeResult,
  Platform,
  Pagination,
  SortOption,
} from "../types/core.js";
import type { RateLimiter } from "../scrapers/rate-limiter.js";
import winston from "winston";

/**
 * Options for scraping operations
 */
export interface ScrapeOptions {
  limit?: number;
  sortBy?: SortOption;
  timeRange?: "hour" | "day" | "week" | "month" | "year" | "all";
  includeComments?: boolean;
  maxDepth?: number;
  pagination?: Pagination;
}

/**
 * Platform-specific configuration for scrapers
 */
export interface BasePlatformConfig {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  userAgent?: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitPerMinute?: number;
}

/**
 * Platform capabilities - what features the platform supports
 */
export interface BasePlatformCapabilities {
  supportsCommentThreads: boolean;
  supportsUserProfiles: boolean;
  supportsSearch: boolean;
  supportsCategories: boolean;
  supportsPagination: boolean;
  supportsRealtime: boolean;
  maxCommentDepth?: number;
  maxItemsPerRequest?: number;
}

/**
 * Abstract base class for all platform implementations
 */
export abstract class BasePlatform {
  protected readonly platform: Platform;
  protected readonly config: BasePlatformConfig;
  protected readonly logger: winston.Logger;
  protected rateLimiter?: RateLimiter;

  constructor(
    platform: Platform,
    config: BasePlatformConfig = {},
    logger?: winston.Logger,
  ) {
    this.platform = platform;
    this.config = this.mergeWithDefaults(config);
    this.logger =
      logger ||
      winston.createLogger({
        level: "info",
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      });
  }

  /**
   * Get platform capabilities
   */
  abstract getCapabilities(): BasePlatformCapabilities;

  /**
   * Initialize the platform (setup auth, validate config, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Scrape posts from the platform
   */
  abstract scrapePosts(options?: ScrapeOptions): Promise<ForumPost[]>;

  /**
   * Scrape posts from a specific category/subreddit
   */
  abstract scrapeCategory(
    category: string,
    options?: ScrapeOptions,
  ): Promise<ForumPost[]>;

  /**
   * Scrape a single post by ID
   */
  abstract scrapePost(postId: string): Promise<ForumPost | null>;

  /**
   * Scrape comments for a post
   */
  abstract scrapeComments(
    postId: string,
    options?: ScrapeOptions,
  ): Promise<Comment[]>;

  /**
   * Scrape user profile information
   */
  abstract scrapeUser(username: string): Promise<User | null>;

  /**
   * Search for posts
   */
  abstract search(query: string, options?: ScrapeOptions): Promise<ForumPost[]>;

  /**
   * Get trending/hot posts
   */
  abstract getTrending(options?: ScrapeOptions): Promise<ForumPost[]>;

  /**
   * Test platform connectivity and authentication
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Get platform name
   */
  getPlatformName(): Platform {
    return this.platform;
  }

  /**
   * Set rate limiter
   */
  setRateLimiter(rateLimiter: RateLimiter): void {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Execute a full scrape operation with all data
   */
  async scrape(options?: ScrapeOptions): Promise<ScrapeResult> {
    const posts = await this.scrapePosts(options);
    const comments: Comment[] = [];
    const users = new Map<string, User>();

    // Collect comments if requested
    if (options?.includeComments) {
      for (const post of posts) {
        try {
          const postComments = await this.scrapeComments(post.id, options);
          comments.push(...postComments);

          // Collect unique users from comments
          for (const comment of postComments) {
            if (!users.has(comment.author)) {
              const user = await this.scrapeUser(comment.author);
              if (user) {
                users.set(user.username, user);
              }
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch comments for post ${post.id}:`,
            error,
          );
        }
      }
    }

    // Collect unique users from posts
    for (const post of posts) {
      if (!users.has(post.author)) {
        try {
          const user = await this.scrapeUser(post.author);
          if (user) {
            users.set(user.username, user);
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch user ${post.author}:`, error);
        }
      }
    }

    return {
      posts,
      comments: comments.length > 0 ? comments : undefined,
      users: users.size > 0 ? Array.from(users.values()) : undefined,
      metadata: {
        scrapedAt: new Date(),
        totalPosts: posts.length,
        totalComments: comments.length,
        platform: this.platform,
      },
    };
  }

  /**
   * Merge provided config with platform defaults
   */
  protected mergeWithDefaults(config: BasePlatformConfig): BasePlatformConfig {
    return {
      timeout: 30000,
      retryAttempts: 3,
      rateLimitPerMinute: 60,
      ...config,
    };
  }

  /**
   * Wait for rate limit if necessary
   */
  protected async waitForRateLimit(): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.waitIfNeeded();
    }
  }

  /**
   * Helper to handle API errors consistently
   */
  protected handleApiError(error: any, context: string): never {
    const message = error.message || "Unknown error";
    this.logger.error(`${context}: ${message}`, error);
    throw new Error(`${this.platform} API error in ${context}: ${message}`);
  }
}
