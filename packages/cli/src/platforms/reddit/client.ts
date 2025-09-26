// @ts-nocheck
import { logger } from '../../utils/logger.js';
import { RedditAuth, type RedditAuthConfig } from './auth.js';
import { RedditEndpoints, QueryParams, REDDIT_BASE_URL } from './endpoints.js';
import { AdvancedRateLimiter, RateLimiterFactory } from '../../utils/rate-limiter.js';
import { AdvancedRetry, ErrorClassifier } from '../../utils/backoff-strategy.js';
import type { ForumPost, Comment, User, Platform } from '../../types/core.js';

/**
 * Reddit API client configuration
 */
export interface RedditClientConfig extends RedditAuthConfig {
  maxRetries?: number;
  requestTimeout?: number;
  maxConcurrentRequests?: number;
}

/**
 * Reddit API response types
 */
export interface RedditListing<T> {
  kind: string;
  data: {
    modhash?: string;
    dist?: number;
    children: Array<{
      kind: string;
      data: T;
    }>;
    after?: string | null;
    before?: string | null;
  };
}

export interface RedditPost {
  id: string;
  name: string;
  subreddit: string;
  subreddit_id: string;
  title: string;
  selftext?: string;
  selftext_html?: string;
  url: string;
  permalink: string;
  author: string;
  author_fullname?: string;
  created_utc: number;
  edited: boolean | number;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  is_video: boolean;
  is_self: boolean;
  thumbnail?: string;
  preview?: any;
  media?: any;
  over_18: boolean;
  spoiler: boolean;
  locked: boolean;
  stickied: boolean;
  distinguished?: string;
  link_flair_text?: string;
  link_flair_css_class?: string;
  author_flair_text?: string;
  author_flair_css_class?: string;
}

export interface RedditComment {
  id: string;
  name: string;
  parent_id: string;
  link_id: string;
  subreddit: string;
  subreddit_id: string;
  body: string;
  body_html: string;
  author: string;
  author_fullname?: string;
  created_utc: number;
  edited: boolean | number;
  score: number;
  ups: number;
  downs: number;
  controversiality: number;
  depth: number;
  is_submitter: boolean;
  distinguished?: string;
  stickied: boolean;
  score_hidden: boolean;
  collapsed: boolean;
  replies?: RedditListing<RedditComment> | '';
}

export interface RedditUser {
  id: string;
  name: string;
  created_utc: number;
  link_karma: number;
  comment_karma: number;
  total_karma: number;
  is_gold: boolean;
  is_mod: boolean;
  is_employee: boolean;
  icon_img?: string;
  subreddit?: {
    display_name: string;
    public_description: string;
    subscribers: number;
  };
}

export interface RedditSubreddit {
  id: string;
  name: string;
  display_name: string;
  display_name_prefixed: string;
  title: string;
  public_description: string;
  description: string;
  subscribers: number;
  active_user_count?: number;
  created_utc: number;
  over18: boolean;
  lang: string;
  url: string;
  icon_img?: string;
  banner_img?: string;
  header_img?: string;
}

/**
 * Reddit API client
 */
export class RedditClient {
  private auth: RedditAuth;
  private rateLimiter: AdvancedRateLimiter;
  private retryClient: AdvancedRetry;
  private config: RedditClientConfig;
  private readonly platform: Platform = 'reddit';

  constructor(config: RedditClientConfig) {
    this.config = config;
    this.auth = new RedditAuth(config);

    // Initialize rate limiter for Reddit
    this.rateLimiter = RateLimiterFactory.get(this.platform);

    // Setup retry client
    this.retryClient = AdvancedRetry.withExponentialBackoff(
      {
        retries: config.maxRetries ?? 3,
        minTimeout: 1000,
        maxTimeout: 30000,
        onFailedAttempt: (error) => {
          logger.warn(`Reddit API retry attempt ${error.attemptNumber}: ${error.message}`);
        },
        shouldRetry: (error) => ErrorClassifier.isRetryable(error),
      },
      {
        initialDelayMs: 1000,
        maxDelayMs: 60000,
      }
    );
  }

  /**
   * Make authenticated request to Reddit API
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    baseUrl: string = REDDIT_BASE_URL
  ): Promise<T> {
    return this.rateLimiter.execute(async () => {
      return this.retryClient.execute(async () => {
        const authHeader = await this.auth.getAuthHeader();

        const response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers: {
            Authorization: authHeader,
            'User-Agent': this.config.userAgent,
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          signal: AbortSignal.timeout(this.config.requestTimeout ?? 30000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(
            `Reddit API error: ${response.status} ${response.statusText} - ${errorText}`
          );
          (error as any).statusCode = response.status;
          throw error;
        }

        return response.json() as Promise<T>;
      });
    });
  }

  /**
   * Get subreddit information
   */
  async getSubreddit(name: string): Promise<RedditSubreddit> {
    const endpoint = RedditEndpoints.subreddit.about(name);
    const response = await this.request<{
      kind: string;
      data: RedditSubreddit;
    }>(endpoint);
    return response.data;
  }

  /**
   * Get posts from a subreddit
   */
  async getSubredditPosts(
    subreddit: string,
    sort: 'hot' | 'new' | 'top' | 'rising' | 'controversial' = 'hot',
    options?: {
      limit?: number;
      after?: string;
      before?: string;
      t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    }
  ): Promise<RedditListing<RedditPost>> {
    const endpoint = RedditEndpoints.subreddit[sort](subreddit);
    const params = QueryParams.listing(options);
    const endpointWithParams =
      params && params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    return this.request<RedditListing<RedditPost>>(endpointWithParams);
  }

  /**
   * Get post by ID
   */
  async getPost(postId: string): Promise<RedditPost> {
    const endpoint = RedditEndpoints.post.byId(postId);
    const response = await this.request<RedditListing<RedditPost>>(endpoint);

    if (response.data.children.length === 0) {
      throw new Error(`Post not found: ${postId}`);
    }

    return response.data.children[0]!.data;
  }

  /**
   * Get comments for a post
   */
  async getComments(
    subreddit: string,
    postId: string,
    options?: {
      limit?: number;
      depth?: number;
      sort?: 'confidence' | 'top' | 'new' | 'controversial' | 'old' | 'random' | 'qa' | 'live';
    }
  ): Promise<[RedditListing<RedditPost>, RedditListing<RedditComment>]> {
    const endpoint = RedditEndpoints.post.comments(subreddit, postId);
    const params = QueryParams.comments(options);
    const endpointWithParams =
      params && params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    return this.request<[RedditListing<RedditPost>, RedditListing<RedditComment>]>(
      endpointWithParams
    );
  }

  /**
   * Get user information
   */
  async getUser(username: string): Promise<RedditUser> {
    const endpoint = RedditEndpoints.user.about(username);
    const response = await this.request<{ kind: string; data: RedditUser }>(endpoint);
    return response.data;
  }

  /**
   * Get user's posts
   */
  async getUserPosts(
    username: string,
    options?: {
      limit?: number;
      after?: string;
      before?: string;
      sort?: 'hot' | 'new' | 'top';
      t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    }
  ): Promise<RedditListing<RedditPost>> {
    const endpoint = RedditEndpoints.user.submitted(username);
    const params = QueryParams.listing(options);
    const endpointWithParams =
      params && params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    return this.request<RedditListing<RedditPost>>(endpointWithParams);
  }

  /**
   * Get user's comments
   */
  async getUserComments(
    username: string,
    options?: {
      limit?: number;
      after?: string;
      before?: string;
      sort?: 'hot' | 'new' | 'top';
      t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    }
  ): Promise<RedditListing<RedditComment>> {
    const endpoint = RedditEndpoints.user.comments(username);
    const params = QueryParams.listing(options);
    const endpointWithParams =
      params && params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    return this.request<RedditListing<RedditComment>>(endpointWithParams);
  }

  /**
   * Search Reddit
   */
  async search(
    query: string,
    options?: {
      sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
      t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      type?: 'link' | 'self' | 'image' | 'video' | 'videogif' | 'gallery';
      limit?: number;
      after?: string;
      restrict_sr?: boolean;
      subreddit?: string;
    }
  ): Promise<RedditListing<RedditPost>> {
    const endpoint = options?.subreddit
      ? RedditEndpoints.subreddit.search(options.subreddit)
      : RedditEndpoints.search.reddit();

    const params = QueryParams.search({
      q: query,
      ...options,
    });

    const endpointWithParams =
      params && params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
    return this.request<RedditListing<RedditPost>>(endpointWithParams);
  }

  /**
   * Convert Reddit post to ForumPost
   */
  convertToForumPost(post: RedditPost): ForumPost {
    return {
      id: post.id,
      title: post.title,
      content: post.selftext || null,
      author: post.author,
      authorId: post.author_fullname,
      url: `https://reddit.com${post.permalink}`,
      score: post.score,
      commentCount: post.num_comments,
      createdAt: new Date(post.created_utc * 1000),
      updatedAt: post.edited ? new Date((post.edited as number) * 1000) : undefined,
      platform: this.platform,
      category: post.subreddit,
      tags: post.link_flair_text ? [post.link_flair_text] : undefined,
      metadata: {
        subreddit: post.subreddit,
        isVideo: post.is_video,
        isSelf: post.is_self,
        thumbnail: post.thumbnail,
        over18: post.over_18,
        spoiler: post.spoiler,
        locked: post.locked,
        stickied: post.stickied,
        linkFlairText: post.link_flair_text,
        upvoteRatio: post.upvote_ratio,
      },
    };
  }

  /**
   * Convert Reddit comment to Comment
   */
  convertToComment(comment: RedditComment, postId: string): Comment {
    // Extract parent ID without prefix
    let parentId: string | null = null;
    if (comment.parent_id.startsWith('t1_')) {
      parentId = comment.parent_id.substring(3);
    }

    return {
      id: comment.id,
      postId,
      parentId,
      author: comment.author,
      authorId: comment.author_fullname,
      content: comment.body,
      score: comment.score,
      createdAt: new Date(comment.created_utc * 1000),
      updatedAt: comment.edited ? new Date((comment.edited as number) * 1000) : undefined,
      depth: comment.depth,
      platform: this.platform,
    };
  }

  /**
   * Convert Reddit user to User
   */
  convertToUser(user: RedditUser): User {
    return {
      id: user.id,
      username: user.name,
      karma: user.total_karma,
      createdAt: new Date(user.created_utc * 1000),
      platform: this.platform,
      metadata: {
        linkKarma: user.link_karma,
        commentKarma: user.comment_karma,
        isGold: user.is_gold,
        isMod: user.is_mod,
        isEmployee: user.is_employee,
        iconImg: user.icon_img,
      },
    };
  }

  /**
   * Initialize authentication
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Reddit client');

    // Authenticate based on available credentials
    if (this.config.username && this.config.password) {
      await this.auth.authenticateScript();
    } else if (this.config.deviceId) {
      await this.auth.authenticateInstalled();
    } else {
      await this.auth.authenticateClientCredentials();
    }

    logger.info('Reddit client initialized successfully');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.auth.isTokenValid();
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }
}
