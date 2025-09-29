import type {
  ForumPost,
  Comment,
  User,
  ScrapeResult,
  Platform,
  Pagination,
  SortOption,
  ScrapeError,
} from '../types/core.js';
import type { AuthConfig, SessionState } from '../types/platform.js';
import type { RateLimiter } from '../scrapers/rate-limiter.js';
import winston from 'winston';

/**
 * Options for scraping operations
 */
export interface ScrapeOptions {
  limit?: number;
  sortBy?: SortOption;
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
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
  auth?: AuthConfig;
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
 * Authentication state for the platform
 */
export interface AuthenticationState {
  isAuthenticated: boolean;
  sessionState?: SessionState;
  expiresAt?: Date;
}

/**
 * Abstract base class for all platform implementations
 */
export abstract class BasePlatform {
  protected readonly platform: Platform;
  protected readonly config: BasePlatformConfig;
  protected readonly logger: winston.Logger;
  protected rateLimiter?: RateLimiter;
  protected authState: AuthenticationState;

  constructor(platform: Platform, config: BasePlatformConfig = {}, logger?: winston.Logger) {
    this.platform = platform;
    this.config = this.mergeWithDefaults(config);
    this.logger =
      logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      });
    this.authState = { isAuthenticated: false };
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
   * Authenticate with the platform
   */
  abstract authenticate(): Promise<boolean>;

  /**
   * Refresh authentication if needed
   */
  abstract refreshAuth(): Promise<boolean>;

  /**
   * Check if authentication is valid
   */
  abstract isAuthValid(): boolean;

  /**
   * Scrape posts from the platform
   */
  abstract scrapePosts(options?: ScrapeOptions): Promise<ForumPost[]>;

  /**
   * Scrape posts from a specific category/subreddit
   */
  abstract scrapeCategory(category: string, options?: ScrapeOptions): Promise<ForumPost[]>;

  /**
   * Scrape a single post by ID
   */
  abstract scrapePost(postId: string): Promise<ForumPost | null>;

  /**
   * Scrape comments for a post
   */
  abstract scrapeComments(postId: string, options?: ScrapeOptions): Promise<Comment[]>;

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
   * Get authentication state
   */
  getAuthState(): AuthenticationState {
    return this.authState;
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState | undefined {
    return this.authState.sessionState;
  }

  /**
   * Update session state
   */
  protected updateSessionState(state: Partial<SessionState>): void {
    this.authState.sessionState = {
      ...this.authState.sessionState,
      platform: this.platform,
      ...state,
    } as SessionState;

    if (state.expiresAt) {
      this.authState.expiresAt = state.expiresAt;
    }

    this.authState.isAuthenticated = state.authenticated ?? this.authState.isAuthenticated;
  }

  /**
   * Clear authentication state
   */
  protected clearAuthState(): void {
    this.authState = { isAuthenticated: false };
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
          this.logger.warn(`Failed to fetch comments for post ${post.id}:`, error);
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
  protected handleApiError(error: unknown, context: string): never {
    const message = (error as any)?.message || 'Unknown error';
    this.logger.error(`${context}: ${message}`, error);

    const scrapeError: ScrapeError = {
      code: (error as any)?.code || 'UNKNOWN_ERROR',
      message: `${this.platform} API error in ${context}: ${message}`,
      details: error,
      timestamp: new Date(),
      platform: this.platform,
      retryable: this.isRetryableError(error),
    };

    throw scrapeError;
  }

  /**
   * Determine if an error is retryable
   */
  protected isRetryableError(error: unknown): boolean {
    // Check for common retryable error conditions
    if ((error as any)?.code) {
      const retryableCodes = [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'RATE_LIMIT',
        '429',
        '503',
        '504',
      ];
      return retryableCodes.includes((error as any).code.toString());
    }

    if ((error as any)?.statusCode) {
      // Retry on rate limits and server errors
      return (
        (error as any).statusCode === 429 ||
        ((error as any).statusCode >= 500 && (error as any).statusCode < 600)
      );
    }

    return false;
  }

  /**
   * Retry logic wrapper for API calls
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    context: string,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts || this.config.retryAttempts || 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        // Wait for rate limit before each attempt
        await this.waitForRateLimit();

        // Try the operation
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === attempts) {
          break;
        }

        // Calculate exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.logger.warn(`${context}: Attempt ${attempt} failed, retrying in ${delay}ms...`, error);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All attempts failed - throw the error so calling methods can handle it
    const message = (lastError as Error)?.message || 'Unknown error';
    this.logger.error(`${context}: ${message}`, lastError);

    const scrapeError: ScrapeError = {
      code: (lastError as { code?: string })?.code || 'UNKNOWN_ERROR',
      message: `${this.platform} API error in ${context}: ${message}`,
      details: lastError,
      timestamp: new Date(),
      platform: this.platform,
      retryable: false, // Already retried
    };

    throw scrapeError;
  }

  /**
   * Ensure authentication before operations
   */
  protected async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthValid()) {
      const refreshed = await this.refreshAuth();
      if (!refreshed) {
        const authenticated = await this.authenticate();
        if (!authenticated) {
          throw {
            code: 'AUTH_FAILED',
            message: 'Failed to authenticate with platform',
            platform: this.platform,
            retryable: false,
          } as ScrapeError;
        }
      }
    }
  }
}
