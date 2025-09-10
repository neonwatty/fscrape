/**
 * HackerNews scraper implementation
 */

import { BasePlatform } from "../base-platform.js";
import type {
  BasePlatformConfig,
  BasePlatformCapabilities,
  ScrapeOptions,
} from "../base-platform.js";
import type {
  ForumPost,
  Comment,
  User,
  ScrapeResult,
  ScrapeError,
  Platform,
} from "../../types/core.js";
import { HackerNewsClient, type StoryListType } from "./client.js";
import {
  parsePost,
  parseComment,
  parseUser,
  parseJob,
  buildCommentTree,
  cleanContent,
} from "./parsers.js";
import type { Logger } from "winston";
import winston from "winston";

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
export class HackerNewsScraper extends BasePlatform {
  public readonly platform: Platform = "hackernews";
  private client: HackerNewsClient;
  private config: HackerNewsScraperConfig;
  private logger: Logger;

  constructor(config: HackerNewsScraperConfig = {}) {
    super(config);
    this.config = {
      maxConcurrent: 5,
      batchSize: 10,
      ...config,
    };
    
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.simple(),
      transports: [new winston.transports.Console()],
    });

    this.client = new HackerNewsClient({
      baseUrl: config.baseUrl,
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
      supportsSearch: false, // Native API doesn't support search
      supportsCategories: true, // Different story types
      supportsPagination: false, // API returns full lists
      supportsVoting: false,
      supportsEditing: false,
      supportsDeleting: false,
      maxCommentDepth: 100,
      maxPageSize: 500,
      rateLimits: {
        requestsPerMinute: 600, // No official limit, but be respectful
        requestsPerHour: 10000,
      },
    };
  }

  /**
   * Scrape posts from a category
   */
  async scrapePosts(
    category: string,
    options: ScrapeOptions = {}
  ): Promise<ScrapeResult> {
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
      const storyIds = await this.client.getStoryList(storyType, limit);
      
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
          const post = item.type === "job" ? parseJob(item) : parsePost(item);
          if (post) {
            // Clean HTML content
            post.content = cleanContent(post.content);
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
              
              // Clean comment content and collect users
              for (const comment of postComments) {
                comment.content = cleanContent(comment.content);
                comment.postId = post.id;
                comments.push(comment);
                
                if (comment.authorId && comment.authorId !== "deleted") {
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
    } catch (error) {
      this.logger.error("Error scraping posts:", error);
      errors.push({
        code: "SCRAPE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      });
    }

    return this.createResult(posts, comments, Array.from(users.values()), errors, startTime);
  }

  /**
   * Scrape a single post with comments
   */
  async scrapePost(
    postId: string,
    options: ScrapeOptions = {}
  ): Promise<ScrapeResult> {
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
      const post = item.type === "job" ? parseJob(item) : parsePost(item);
      if (post) {
        post.content = cleanContent(post.content);
        posts.push(post);
        
        // Collect user
        if (item.by) {
          const user = await this.fetchUser(item.by);
          if (user) users.set(user.id, user);
        }
        
        // Fetch comments
        if (options.includeComments !== false && item.kids) {
          const postComments = await this.fetchComments(
            item.id,
            item.kids,
            options.maxDepth || 10
          );
          
          for (const comment of postComments) {
            comment.content = cleanContent(comment.content);
            comment.postId = post.id;
            comments.push(comment);
            
            if (comment.authorId && comment.authorId !== "deleted") {
              const user = await this.fetchUser(comment.authorId);
              if (user) users.set(user.id, user);
            }
          }
        }
      }

      this.logger.info(`Scraped post with ${comments.length} comments`);
    } catch (error) {
      this.logger.error("Error scraping post:", error);
      errors.push({
        code: "SCRAPE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      });
    }

    return this.createResult(posts, comments, Array.from(users.values()), errors, startTime);
  }

  /**
   * Scrape user profile
   */
  async scrapeUser(username: string): Promise<ScrapeResult> {
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

      const user = parseUser(hnUser);
      users.push(user);
      
      // Optionally fetch recent submissions
      if (hnUser.submitted && hnUser.submitted.length > 0) {
        const recentIds = hnUser.submitted.slice(0, 30); // Get last 30 submissions
        const items = await this.client.getItems(recentIds);
        
        for (const item of items) {
          if (!item) continue;
          
          if (item.type === "story" || item.type === "job") {
            const post = item.type === "job" ? parseJob(item) : parsePost(item);
            if (post) {
              post.content = cleanContent(post.content);
              posts.push(post);
            }
          } else if (item.type === "comment") {
            const comment = parseComment(item);
            if (comment) {
              comment.content = cleanContent(comment.content);
              comments.push(comment);
            }
          }
        }
      }

      this.logger.info(`Scraped user with ${posts.length} posts and ${comments.length} comments`);
    } catch (error) {
      this.logger.error("Error scraping user:", error);
      errors.push({
        code: "SCRAPE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      });
    }

    return this.createResult(posts, comments, users, errors, startTime);
  }

  /**
   * Search functionality (not natively supported)
   */
  async search(
    query: string,
    options: ScrapeOptions = {}
  ): Promise<ScrapeResult> {
    const startTime = Date.now();
    const errors: ScrapeError[] = [];
    
    this.logger.warn("HackerNews API doesn't support native search");
    errors.push({
      code: "NOT_SUPPORTED",
      message: "Search is not supported by HackerNews API. Consider using Algolia HN Search API.",
      timestamp: new Date(),
    });
    
    return this.createResult([], [], [], errors, startTime);
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
      top: "topstories",
      new: "newstories",
      best: "beststories",
      ask: "askstories",
      show: "showstories",
      job: "jobstories",
      jobs: "jobstories",
    };
    
    return categoryMap[category.toLowerCase()] || "topstories";
  }

  /**
   * Helper: Fetch comments recursively
   */
  private async fetchComments(
    postId: number,
    kidIds: number[],
    maxDepth: number
  ): Promise<Comment[]> {
    const comments: Comment[] = [];
    const queue: Array<{ id: number; depth: number; parentId?: string }> = [];
    
    // Initialize with top-level comments
    for (const kidId of kidIds) {
      queue.push({ id: kidId, depth: 1 });
    }
    
    while (queue.length > 0) {
      const batch = queue.splice(0, this.config.batchSize!);
      const items = await this.client.getItems(batch.map(b => b.id));
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const { depth, parentId } = batch[i];
        
        if (!item || item.type !== "comment") continue;
        
        const comment = parseComment(item, postId.toString());
        if (comment) {
          comment.depth = depth;
          comment.parentId = parentId;
          comments.push(comment);
          
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
      
      // Rate limiting
      if (queue.length > 0) {
        await this.delay(100);
      }
    }
    
    return comments;
  }

  /**
   * Helper: Fetch user
   */
  private async fetchUser(username: string): Promise<User | null> {
    if (!username || username === "[deleted]") return null;
    
    try {
      const hnUser = await this.client.getUser(username);
      return hnUser ? parseUser(hnUser) : null;
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}