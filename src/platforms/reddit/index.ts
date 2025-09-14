/**
 * Reddit platform implementation exports
 */

export { RedditScraper, type RedditScraperConfig } from "./scraper.js";
export { RedditClient, type RedditClientConfig } from "./client.js";
export { RedditAuth, type RedditAuthConfig } from "./auth.js";
export {
  RedditEndpoints,
  QueryParams,
  buildUrl,
  REDDIT_BASE_URL,
} from "./endpoints.js";
export { RedditParsers, RedditValidators } from "./parsers.js";

// Re-export types
export type {
  RedditPost,
  RedditComment,
  RedditUser,
  RedditSubreddit,
  RedditListing,
} from "./client.js";

export type { RedditTokenResponse, RedditAuthState } from "./auth.js";

// Import for platform constructor
// import { RedditScraper } from "./scraper.js";
import type { PlatformConstructor } from "../platform-factory.js";
import type { BasePlatform, BasePlatformConfig } from "../base-platform.js";
import type winston from "winston";

// Import the public client instead of the OAuth scraper
import {
  RedditPublicClient,
  type RedditPublicClientConfig,
} from "./public-client.js";

/**
 * Simple Reddit platform using public JSON endpoints
 * No authentication required!
 */
export const RedditPlatform: PlatformConstructor = class
  implements BasePlatform
{
  private client: RedditPublicClient;
  public readonly platform = "reddit" as const;

  constructor(
    _platform: string,
    config: BasePlatformConfig,
    _logger?: winston.Logger,
  ) {
    // Create simple config for public client
    const publicConfig: RedditPublicClientConfig = {
      userAgent: config.userAgent || "fscrape/1.0.0",
      requestTimeout: 30000,
      maxRetries: 3,
    };

    this.client = new RedditPublicClient(publicConfig);
  }

  // Platform capabilities for public Reddit access
  getCapabilities() {
    return {
      supportsCommentThreads: true,
      supportsUserProfiles: true,
      supportsSearch: true,
      supportsCategories: true,
      supportsPagination: true,
      supportsRealtime: false,
      maxItemsPerRequest: 100,
      maxCommentDepth: 10,
    };
  }

  async initialize() {
    // No initialization needed for public client
    return Promise.resolve();
  }

  async scrapePosts(options?: any) {
    const subreddit = options?.subreddit || "all";
    const limit = options?.limit || 25;
    const sort = options?.sortBy || "hot";

    const listing = await this.client.getSubredditPosts(subreddit, sort, limit);
    return listing.data.children.map((child) =>
      this.client.convertPost(child.data),
    );
  }

  async scrapeCategory(category: string, options?: any) {
    const limit = options?.limit || 25;
    const sort = options?.sortBy || "hot";

    const listing = await this.client.getSubredditPosts(category, sort, limit);
    console.log("DEBUG: scrapeCategory listing:", listing);
    console.log("DEBUG: listing.data:", listing.data);
    console.log("DEBUG: listing.data.children:", listing.data?.children);
    return listing.data.children.map((child) =>
      this.client.convertPost(child.data),
    );
  }

  async scrapePost(postId: string) {
    // For single post, we need subreddit info - this is a limitation of public API
    // We'll try to get it from r/all or return null
    try {
      const listing = await this.client.getSubredditPosts("all", "hot", 100);
      const post = listing.data.children.find(
        (child) => child.data.id === postId,
      );
      return post ? this.client.convertPost(post.data) : null;
    } catch (_error) {
      return null;
    }
  }

  async scrapeComments(postId: string, options?: any) {
    const subreddit = options?.subreddit || "all";
    const sort = options?.sort || "best";
    const limit = options?.limit;

    try {
      const [, commentListing] = await this.client.getPostWithComments(
        subreddit,
        postId,
        sort,
        limit,
      );
      return commentListing.data.children.map((child) =>
        this.client.convertComment(child.data),
      );
    } catch (_error) {
      return [];
    }
  }

  async scrapeUser(username: string) {
    try {
      const userData = await this.client.getUser(username);
      // Convert to User format (simplified)
      return {
        id: username,
        platformId: username,
        platform: "reddit" as const,
        username: username,
        displayName: username,
        karma: userData?.data?.total_karma || 0,
        createdAt: userData?.data?.created_utc
          ? new Date(userData.data.created_utc * 1000)
          : null,
        lastSeenAt: null,
        metadata: userData?.data || {},
      };
    } catch (_error) {
      return null;
    }
  }

  async search(query: string, options?: any) {
    const subreddit = options?.subreddit || "all";
    const limit = options?.limit || 25;
    const sort = options?.sort || "relevance";

    const listing = await this.client.searchSubreddit(
      subreddit,
      query,
      sort,
      limit,
    );
    return listing.data.children.map((child) =>
      this.client.convertPost(child.data),
    );
  }

  async getTrending(options?: any) {
    const limit = options?.limit || 25;

    // Use "hot" from popular subreddits as trending
    const listing = await this.client.getSubredditPosts(
      "popular",
      "hot",
      limit,
    );
    return listing.data.children.map((child) =>
      this.client.convertPost(child.data),
    );
  }

  async testConnection() {
    return this.client.testConnection();
  }

  // These methods are not needed for public API
  async authenticate() {
    return true; // Always authenticated for public access
  }

  async refreshAuth() {
    return true; // No auth refresh needed
  }

  setRateLimiter(_rateLimiter: any) {
    // Public client handles its own simple rate limiting
    // This is a no-op for compatibility
  }

  async scrape(options?: any) {
    // Generic scrape method - delegate to appropriate specific method
    if (options?.subreddit) {
      return {
        posts: await this.scrapeCategory(options.subreddit, options),
        comments: [],
      };
    } else {
      // Default to r/popular if no specific target
      return {
        posts: await this.scrapeCategory("popular", options),
        comments: [],
      };
    }
  }
} as any;

// Default export for platform registration
export default RedditPlatform;
