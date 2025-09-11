/**
 * Hacker News API client
 * Uses the official Firebase-based API
 */

import axios, { type AxiosInstance } from "axios";
import type { Logger } from "winston";
import winston from "winston";

/**
 * HackerNews API item types
 */
export type HNItemType = "story" | "comment" | "job" | "poll" | "pollopt";

/**
 * HackerNews API item structure
 */
export interface HNItem {
  id: number;
  type: HNItemType;
  by?: string;
  time: number;
  text?: string;
  dead?: boolean;
  deleted?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  parts?: number[];
  descendants?: number;
}

/**
 * HackerNews user structure
 */
export interface HNUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted?: number[];
}

/**
 * Story list types available on HackerNews
 */
export type StoryListType =
  | "topstories"
  | "newstories"
  | "beststories"
  | "askstories"
  | "showstories"
  | "jobstories";

/**
 * HackerNews API client configuration
 */
export interface HNClientConfig {
  baseUrl?: string;
  timeout?: number;
  userAgent?: string;
  logger?: Logger;
}

/**
 * HackerNews API client
 */
export class HackerNewsClient {
  private readonly client: AxiosInstance;
  private readonly logger: Logger;
  private readonly baseUrl: string;

  constructor(config: HNClientConfig = {}) {
    this.baseUrl = config.baseUrl || "https://hacker-news.firebaseio.com/v0";
    this.logger =
      config.logger ||
      winston.createLogger({
        level: "info",
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      });

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        "User-Agent": config.userAgent || "fscrape/1.0",
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error("HackerNews API error:", {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      },
    );
  }

  /**
   * Initialize the client (for compatibility with tests)
   */
  async initialize(): Promise<void> {
    // No actual initialization needed, but kept for API compatibility
    return Promise.resolve();
  }

  /**
   * Get a single item by ID
   */
  async getItem(id: number): Promise<HNItem | null> {
    try {
      const response = await this.client.get<HNItem>(`/item/${id}.json`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get item ${id}:`, error);
      return null;
    }
  }

  /**
   * Get multiple items by IDs
   */
  async getItems(ids: number[]): Promise<(HNItem | null)[]> {
    const promises = ids.map((id) => this.getItem(id));
    return Promise.all(promises);
  }

  /**
   * Get a user by username
   */
  async getUser(username: string): Promise<HNUser | null> {
    try {
      const response = await this.client.get<HNUser>(`/user/${username}.json`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get user ${username}:`, error);
      return null;
    }
  }

  /**
   * Get story list (top, new, best, ask, show, job)
   */
  async getStoryList(type: StoryListType, limit?: number): Promise<number[]> {
    try {
      const response = await this.client.get<number[]>(`/${type}.json`);
      const stories = response.data || [];
      return limit ? stories.slice(0, limit) : stories;
    } catch (error) {
      this.logger.error(`Failed to get ${type}:`, error);
      return [];
    }
  }

  /**
   * Get top stories
   */
  async getTopStories(limit?: number): Promise<number[]> {
    return this.getStoryList("topstories", limit);
  }

  /**
   * Get new stories
   */
  async getNewStories(limit?: number): Promise<number[]> {
    return this.getStoryList("newstories", limit);
  }

  /**
   * Get best stories
   */
  async getBestStories(limit?: number): Promise<number[]> {
    return this.getStoryList("beststories", limit);
  }

  /**
   * Get ask stories
   */
  async getAskStories(limit?: number): Promise<number[]> {
    return this.getStoryList("askstories", limit);
  }

  /**
   * Get show stories
   */
  async getShowStories(limit?: number): Promise<number[]> {
    return this.getStoryList("showstories", limit);
  }

  /**
   * Get job stories
   */
  async getJobStories(limit?: number): Promise<number[]> {
    return this.getStoryList("jobstories", limit);
  }

  /**
   * Get the maximum item ID
   */
  async getMaxItem(): Promise<number> {
    try {
      const response = await this.client.get<number>("/maxitem.json");
      return response.data || 0;
    } catch (error) {
      this.logger.error("Failed to get max item:", error);
      return 0;
    }
  }

  /**
   * Get all comments for a story (recursive)
   */
  async getComments(itemId: number, maxDepth: number = 10): Promise<HNItem[]> {
    const comments: HNItem[] = [];
    const queue: Array<{ id: number; depth: number }> = [];

    const item = await this.getItem(itemId);
    if (!item || !item.kids) {
      return comments;
    }

    // Initialize queue with top-level comments
    for (const kidId of item.kids) {
      queue.push({ id: kidId, depth: 1 });
    }

    // Process queue
    while (queue.length > 0) {
      const batch = queue.splice(0, 10); // Process in batches
      const items = await this.getItems(batch.map((b) => b.id));

      for (let i = 0; i < items.length; i++) {
        const comment = items[i];
        const depth = batch[i].depth;

        if (
          comment &&
          comment.type === "comment" &&
          !comment.deleted &&
          !comment.dead
        ) {
          comments.push(comment);

          // Add child comments to queue if within depth limit
          if (comment.kids && depth < maxDepth) {
            for (const kidId of comment.kids) {
              queue.push({ id: kidId, depth: depth + 1 });
            }
          }
        }
      }

      // Small delay to avoid hammering the API
      if (queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return comments;
  }

  /**
   * Search for stories (Note: HN API doesn't have native search, this is a placeholder)
   * In a real implementation, you might want to use Algolia's HN Search API
   */
  async searchStories(query: string, options: any = {}): Promise<any> {
    this.logger.warn(
      "Native HN API doesn't support search. Consider using Algolia HN Search API.",
    );
    // For now, return empty results in Algolia format for compatibility
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
    };
  }

  /**
   * Get stories from a specific time range
   */
  async getStoriesInRange(
    startTime: number,
    endTime: number,
    limit: number = 100,
  ): Promise<HNItem[]> {
    const stories: HNItem[] = [];
    const maxId = await this.getMaxItem();

    // Walk backwards from max item
    for (let id = maxId; id > 0 && stories.length < limit; id--) {
      const item = await this.getItem(id);

      if (item && item.type === "story" && !item.deleted && !item.dead) {
        if (item.time >= startTime && item.time <= endTime) {
          stories.push(item);
        } else if (item.time < startTime) {
          // We've gone too far back
          break;
        }
      }

      // Rate limiting
      if (id % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return stories;
  }

  /**
   * Get updated items since a given time
   */
  async getUpdates(): Promise<{ items: number[]; profiles: string[] }> {
    try {
      const response = await this.client.get<{
        items: number[];
        profiles: string[];
      }>("/updates.json");
      return response.data || { items: [], profiles: [] };
    } catch (error) {
      this.logger.error("Failed to get updates:", error);
      return { items: [], profiles: [] };
    }
  }
}
