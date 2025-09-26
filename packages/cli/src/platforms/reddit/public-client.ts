// @ts-nocheck
/**
 * Simple Reddit Public JSON API Client
 * Uses public .json endpoints without authentication
 */

import { logger } from '../../utils/logger.js';
import type { ForumPost, Comment, Platform } from '../../types/core.js';

/**
 * Reddit public client configuration
 */
export interface RedditPublicClientConfig {
  userAgent?: string;
  requestTimeout?: number;
  maxRetries?: number;
}

/**
 * Reddit JSON API response types
 */
export interface RedditJsonListing<T> {
  kind: string;
  data: {
    children: Array<{
      kind: string;
      data: T;
    }>;
    after?: string | null;
    before?: string | null;
  };
}

export interface RedditJsonPost {
  id: string;
  name: string;
  subreddit: string;
  title: string;
  selftext?: string;
  url: string;
  permalink: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  ups: number;
  downs: number;
  is_self: boolean;
  domain: string;
  thumbnail?: string;
}

export interface RedditJsonComment {
  id: string;
  name: string;
  author: string;
  body: string;
  body_html?: string;
  score: number;
  created_utc: number;
  parent_id: string;
  link_id: string;
  subreddit: string;
  permalink: string;
  depth: number;
  replies?: RedditJsonListing<RedditJsonComment> | string;
  ups: number;
  downs: number;
}

/**
 * Simple Reddit client using public JSON endpoints
 */
export class RedditPublicClient {
  private config: RedditPublicClientConfig;
  private readonly baseUrl = 'https://www.reddit.com';
  private readonly platform: Platform = 'reddit';

  constructor(config: RedditPublicClientConfig = {}) {
    this.config = {
      userAgent: 'fscrape/1.0.0',
      requestTimeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Make request to Reddit JSON API
   */
  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}.json`;

    logger.info(`Making Reddit request to: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent!,
      },
      signal: AbortSignal.timeout(this.config.requestTimeout!),
    });

    if (!response.ok) {
      const responseText = await response.text();
      logger.error(
        `Reddit API error: ${response.status} ${response.statusText} - ${responseText.slice(0, 200)}`
      );
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get posts from a subreddit
   */
  async getSubredditPosts(
    subreddit: string,
    sort: string = 'hot',
    limit: number = 25,
    after?: string
  ): Promise<RedditJsonListing<RedditJsonPost>> {
    let endpoint = `/r/${subreddit}/${sort}`;
    const params = new URLSearchParams();

    if (limit) params.append('limit', limit.toString());
    if (after) params.append('after', after);

    // Add .json before query params
    endpoint += '.json';
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    // Remove .json from request method since we're adding it here
    const url = `${this.baseUrl}${endpoint}`;

    logger.info(`Making Reddit request to: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent!,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(this.config.requestTimeout!),
    });

    if (!response.ok) {
      const responseText = await response.text();
      logger.error(
        `Reddit API error: ${response.status} ${response.statusText} - ${responseText.slice(0, 200)}`
      );
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<RedditJsonListing<RedditJsonPost>>;
  }

  /**
   * Get post with comments
   */
  async getPostWithComments(
    subreddit: string,
    postId: string,
    sort: string = 'best',
    limit?: number
  ): Promise<[RedditJsonListing<RedditJsonPost>, RedditJsonListing<RedditJsonComment>]> {
    let endpoint = `/r/${subreddit}/comments/${postId}`;
    const params = new URLSearchParams();

    if (sort) params.append('sort', sort);
    if (limit) params.append('limit', limit.toString());

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return this.request<[RedditJsonListing<RedditJsonPost>, RedditJsonListing<RedditJsonComment>]>(
      endpoint
    );
  }

  /**
   * Get user profile (public info only)
   */
  async getUser(username: string): Promise<any> {
    return this.request<any>(`/user/${username}/about`);
  }

  /**
   * Search subreddit
   */
  async searchSubreddit(
    subreddit: string,
    query: string,
    sort: string = 'relevance',
    limit: number = 25,
    after?: string
  ): Promise<RedditJsonListing<RedditJsonPost>> {
    let endpoint = `/r/${subreddit}/search`;
    const params = new URLSearchParams();

    params.append('q', query);
    params.append('restrict_sr', '1');
    if (sort) params.append('sort', sort);
    if (limit) params.append('limit', limit.toString());
    if (after) params.append('after', after);

    endpoint += `?${params.toString()}`;

    return this.request<RedditJsonListing<RedditJsonPost>>(endpoint);
  }

  /**
   * Convert Reddit JSON post to ForumPost
   */
  convertPost(redditPost: RedditJsonPost): ForumPost {
    return {
      id: redditPost.id,
      platformId: redditPost.id, // Use id for both id and platformId
      platform: this.platform,
      title: redditPost.title,
      content: redditPost.selftext || null,
      author: redditPost.author,
      authorId: redditPost.author,
      url: redditPost.url,
      score: redditPost.score,
      commentCount: redditPost.num_comments,
      createdAt: new Date(redditPost.created_utc * 1000),
      updatedAt: undefined,
      metadata: {
        name: redditPost.name, // Keep the full name (t3_xxx) in metadata
        permalink: redditPost.permalink,
        domain: redditPost.domain,
        is_self: redditPost.is_self,
        thumbnail: redditPost.thumbnail,
        subreddit: redditPost.subreddit,
        ups: redditPost.ups,
        downs: redditPost.downs,
      },
    };
  }

  /**
   * Convert Reddit JSON comment to Comment
   */
  convertComment(redditComment: RedditJsonComment): Comment {
    return {
      id: redditComment.id,
      platformId: redditComment.name,
      platform: this.platform,
      postId: redditComment.link_id.replace('t3_', ''), // Remove t3_ prefix
      parentId: redditComment.parent_id.startsWith('t1_')
        ? redditComment.parent_id.replace('t1_', '')
        : null,
      author: redditComment.author,
      authorId: redditComment.author,
      content: redditComment.body,
      score: redditComment.score,
      depth: redditComment.depth || 0,
      createdAt: new Date(redditComment.created_utc * 1000),
      updatedAt: undefined,
    };
  }

  /**
   * Test connection to Reddit (no auth needed)
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getSubredditPosts('test', 'hot', 1);
      return true;
    } catch (error) {
      logger.error('Reddit connection test failed:', error);
      return false;
    }
  }
}
