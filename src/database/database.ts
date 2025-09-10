import Database from "better-sqlite3";
import winston from "winston";
import { DatabaseConnection } from "./connection.js";
import { PreparedQueries } from "./queries.js";
import { DatabaseAnalytics } from "./analytics.js";
import { initializeDatabase } from "./migrations.js";
import type {
  ForumPost,
  Comment,
  User,
  Platform,
  ScrapeResult,
} from "../types/core.js";
import type { DatabaseConfig } from "../types/config.js";

export interface SessionInfo {
  id: number;
  sessionId: string;
  platform: Platform;
  queryType?: string;
  queryValue?: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  totalItemsTarget?: number;
  totalItemsScraped: number;
  totalPosts?: number;
  totalComments?: number;
  totalUsers?: number;
  lastItemId?: string;
  resumeToken?: string;
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;
  errorCount: number;
  lastError?: string;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  errors: Array<{ item: any; error: string }>;
}

export class DatabaseManager {
  private db: Database.Database;
  private connection?: DatabaseConnection;
  private queries: PreparedQueries;
  private analytics: DatabaseAnalytics;
  private logger: winston.Logger;
  private sessionNumericId?: number;

  constructor(
    configOrDb: DatabaseConfig | Database.Database,
    logger?: winston.Logger,
  ) {
    this.logger =
      logger ||
      winston.createLogger({
        level: "info",
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      });

    // Check if we're passed a database directly (for testing)
    if ("prepare" in configOrDb && typeof configOrDb.prepare === "function") {
      // Direct database object passed (for testing)
      this.db = configOrDb as Database.Database;
    } else {
      // Normal configuration passed
      const config = configOrDb as DatabaseConfig;
      this.connection = new DatabaseConnection(config, this.logger);
      this.db = this.connection.connect();
    }

    // Initialize components
    this.queries = new PreparedQueries(this.db);
    this.analytics = new DatabaseAnalytics(this.db);
  }

  async initialize(): Promise<void> {
    await initializeDatabase(this.db, this.logger);
  }

  // ============================================================================
  // Post Operations
  // ============================================================================

  upsertPost(post: ForumPost): any {
    try {
      const existing = this.db
        .prepare("SELECT * FROM forum_posts WHERE platform = ? AND id = ?")
        .get(post.platform, post.id);

      if (existing) {
        // Update existing post
        const result = this.queries.updatePost.run({
          score: post.score,
          commentCount: post.commentCount,
          updatedAt: post.updatedAt?.getTime() || Date.now(),
          metadata: post.metadata ? JSON.stringify(post.metadata) : null,
          id: post.id,
          platform: post.platform,
        });

        return result;
      } else {
        // Insert new post
        const platformId = this.extractPlatformId(post);

        const result = this.queries.insertPost.run(
          post.id,
          post.platform,
          platformId,
          post.title,
          post.content,
          post.author,
          post.authorId || null,
          post.url,
          post.score,
          post.commentCount,
          post.createdAt.getTime(),
          post.updatedAt?.getTime() || null,
          post.metadata ? JSON.stringify(post.metadata) : null,
        );

        return result;
      }
    } catch (error) {
      this.logger.error(`Failed to upsert post ${post.id}:`, error);
      throw error;
    }
  }

  upsertPosts(posts: ForumPost[]): UpsertResult {
    const result: UpsertResult = { inserted: 0, updated: 0, errors: [] };

    const transaction = this.db.transaction((posts: ForumPost[]) => {
      for (const post of posts) {
        try {
          const upsertResult = this.upsertPost(post);
          if (upsertResult.inserted) {
            result.inserted++;
          } else {
            result.updated++;
          }
        } catch (error) {
          result.errors.push({
            item: post,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    transaction(posts);
    return result;
  }

  getPost(id: string, platform: Platform): ForumPost | null {
    const row = this.db
      .prepare("SELECT * FROM forum_posts WHERE platform = ? AND id = ?")
      .get(platform, id);
    return row ? this.mapRowToPost(row) : null;
  }

  getPosts(
    platform?: Platform,
    limit = 100,
    offset = 0,
  ): { posts: ForumPost[]; total: number } {
    const posts = platform
      ? this.queries.posts.getByPlatform.all(platform, limit, offset)
      : this.queries.posts.getAll.all(limit, offset);

    const total = platform
      ? (this.queries.posts.countByPlatform.get(platform) as any).count
      : (this.queries.posts.count.get() as any).count;

    return {
      posts: posts.map((row) => this.mapRowToPost(row as any)),
      total,
    };
  }

  // ============================================================================
  // Comment Operations
  // ============================================================================

  upsertComment(comment: Comment): any {
    try {
      const existing = this.db
        .prepare("SELECT * FROM comments WHERE platform = ? AND id = ?")
        .get(comment.platform, comment.id);

      if (existing) {
        // Update existing comment
        const result = this.queries.updateComment.run({
          score: comment.score,
          updatedAt: comment.updatedAt?.getTime() || Date.now(),
          id: comment.id,
          platform: comment.platform,
        });

        return result;
      } else {
        // Insert new comment
        const platformId = this.extractPlatformId(comment);

        const result = this.queries.insertComment.run(
          comment.id,
          comment.postId,
          comment.parentId || null,
          comment.platform,
          platformId,
          comment.author,
          comment.authorId || null,
          comment.content,
          comment.score,
          comment.depth,
          comment.createdAt.getTime(),
          comment.updatedAt?.getTime() || null,
        );

        return result;
      }
    } catch (error) {
      this.logger.error(`Failed to upsert comment ${comment.id}:`, error);
      throw error;
    }
  }

  upsertComments(comments: Comment[]): UpsertResult {
    const result: UpsertResult = { inserted: 0, updated: 0, errors: [] };

    const transaction = this.db.transaction((comments: Comment[]) => {
      for (const comment of comments) {
        try {
          const upsertResult = this.upsertComment(comment);
          if (upsertResult.inserted) {
            result.inserted++;
          } else {
            result.updated++;
          }
        } catch (error) {
          result.errors.push({
            item: comment,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    transaction(comments);
    return result;
  }

  getCommentsByPost(postId: string): Comment[] {
    const rows = this.queries.comments.getByPost.all(postId);
    return rows.map((row) => this.mapRowToComment(row as any));
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  upsertUser(user: User): any {
    try {
      const existing = this.db
        .prepare("SELECT * FROM users WHERE platform = ? AND id = ?")
        .get(user.platform, user.id);

      if (existing) {
        // Update existing user
        const result = this.queries.updateUser.run({
          karma: user.karma || null,
          lastSeenAt: Date.now(),
          metadata: user.metadata ? JSON.stringify(user.metadata) : null,
          id: user.id,
          platform: user.platform,
        });

        return result;
      } else {
        // Insert new user
        const result = this.queries.insertUser.run(
          user.id,
          user.platform,
          user.username,
          user.karma || null,
          user.createdAt?.getTime() || null,
          Date.now(),
        );

        return result;
      }
    } catch (error) {
      this.logger.error(`Failed to upsert user ${user.id}:`, error);
      throw error;
    }
  }

  // Bulk upsert methods for compatibility
  async bulkUpsertUsers(users: User[]): Promise<{ totalChanges: number }> {
    let totalChanges = 0;
    const transaction = this.db.transaction((users: User[]) => {
      for (const user of users) {
        try {
          this.upsertUser(user);
          totalChanges++;
        } catch (error) {
          this.logger.error(`Failed to upsert user ${user.id}:`, error);
        }
      }
    });
    transaction(users);
    return { totalChanges };
  }

  async bulkUpsertPosts(posts: ForumPost[]): Promise<{ totalChanges: number }> {
    let totalChanges = 0;
    const transaction = this.db.transaction((posts: ForumPost[]) => {
      for (const post of posts) {
        // Validate URL format
        if (
          post.url &&
          !post.url.startsWith("http://") &&
          !post.url.startsWith("https://")
        ) {
          throw new Error(
            `Invalid URL format for post ${post.id}: ${post.url}`,
          );
        }

        try {
          this.upsertPost(post);
          totalChanges++;
        } catch (error) {
          this.logger.error(`Failed to upsert post ${post.id}:`, error);
          throw error; // Re-throw to trigger rollback
        }
      }
    });
    transaction(posts);
    return { totalChanges };
  }

  async bulkUpsertComments(
    comments: Comment[],
  ): Promise<{ totalChanges: number }> {
    let totalChanges = 0;
    const transaction = this.db.transaction((comments: Comment[]) => {
      for (const comment of comments) {
        try {
          this.upsertComment(comment);
          totalChanges++;
        } catch (error) {
          this.logger.error(`Failed to upsert comment ${comment.id}:`, error);
        }
      }
    });
    transaction(comments);
    return { totalChanges };
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  createSession(params: {
    platform: Platform;
    query?: string;
    subreddit?: string;
    queryType?: string;
    queryValue?: string;
  }): number {
    const sessionId = `${params.platform}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}`;

    const now = Date.now();
    const queryType =
      params.queryType ||
      (params.subreddit ? "subreddit" : params.query ? "search" : null);
    const queryValue =
      params.queryValue || params.subreddit || params.query || null;

    const result = this.queries.sessions.create.run(
      sessionId, // session_id
      params.platform,
      "running",
      queryType,
      queryValue,
      null, // total_items_target
      0, // total_items_scraped
      0, // total_posts
      0, // total_comments
      0, // total_users
      now, // started_at
      now, // last_activity_at
    );

    this.sessionNumericId = result.lastInsertRowid as number;
    return this.sessionNumericId;
  }

  updateSession(
    sessionId: number,
    updates: Partial<{
      status: SessionInfo["status"];
      totalItemsTarget: number;
      totalItemsScraped: number;
      totalPosts: number;
      totalComments: number;
      totalUsers: number;
      lastItemId: string;
      resumeToken: string;
      errorCount: number;
      lastError: string;
      errorMessage: string;
    }>,
  ): void {
    // Get the session_id string from the numeric id
    const session = this.db
      .prepare("SELECT session_id FROM scraping_sessions WHERE id = ?")
      .get(sessionId) as any;
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Initialize params with all required fields for the query
    const params: any = {
      sessionId: session.session_id,
      status: null,
      totalItemsTarget: null,
      totalItemsScraped: null,
      totalPosts: null,
      totalComments: null,
      totalUsers: null,
      lastItemId: null,
      resumeToken: null,
      errorCount: null,
      lastError: null,
      completedAt: null,
      lastActivityAt: Date.now(),
    };

    // Override with provided updates
    if (updates.status !== undefined) params.status = updates.status;
    if (updates.totalItemsTarget !== undefined)
      params.totalItemsTarget = updates.totalItemsTarget;
    if (updates.totalItemsScraped !== undefined)
      params.totalItemsScraped = updates.totalItemsScraped;

    // Handle the separate count fields
    if (updates.totalPosts !== undefined)
      params.totalPosts = updates.totalPosts;
    if (updates.totalComments !== undefined)
      params.totalComments = updates.totalComments;
    if (updates.totalUsers !== undefined)
      params.totalUsers = updates.totalUsers;

    if (updates.lastItemId !== undefined)
      params.lastItemId = updates.lastItemId;
    if (updates.resumeToken !== undefined)
      params.resumeToken = updates.resumeToken;
    if (updates.errorCount !== undefined)
      params.errorCount = updates.errorCount;
    if (updates.lastError !== undefined) params.lastError = updates.lastError;
    if (updates.errorMessage !== undefined)
      params.lastError = updates.errorMessage;

    // Mark completed if status is completed/failed/cancelled
    if (["completed", "failed", "cancelled"].includes(updates.status || "")) {
      params.completedAt = Date.now();
    }

    this.queries.updateSession.run(params);
  }

  getSession(sessionId: number): SessionInfo | null {
    const row = this.db
      .prepare("SELECT * FROM scraping_sessions WHERE id = ?")
      .get(sessionId);
    return row ? this.mapRowToSession(row as any) : null;
  }

  getResumableSessions(platform?: Platform): SessionInfo[] {
    const rows = platform
      ? this.db
          .prepare(
            'SELECT * FROM scraping_sessions WHERE platform = ? AND status IN ("pending", "running")',
          )
          .all(platform)
      : this.db
          .prepare(
            'SELECT * FROM scraping_sessions WHERE status IN ("pending", "running")',
          )
          .all();

    return rows.map((row) => this.mapRowToSession(row as any));
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  saveScrapeResult(result: ScrapeResult): {
    posts: UpsertResult;
    comments: UpsertResult;
    users: UpsertResult;
  } {
    const results = {
      posts: { inserted: 0, updated: 0, errors: [] as any[] },
      comments: { inserted: 0, updated: 0, errors: [] as any[] },
      users: { inserted: 0, updated: 0, errors: [] as any[] },
    };

    // Use a transaction for all operations
    const transaction = this.db.transaction(() => {
      // Upsert posts
      if (result.posts.length > 0) {
        results.posts = this.upsertPosts(result.posts);
      }

      // Upsert comments
      if (result.comments && result.comments.length > 0) {
        results.comments = this.upsertComments(result.comments);
      }

      // Upsert users
      if (result.users && result.users.length > 0) {
        for (const user of result.users) {
          try {
            const upsertResult = this.upsertUser(user);
            if (upsertResult.inserted) {
              results.users.inserted++;
            } else {
              results.users.updated++;
            }
          } catch (error) {
            results.users.errors.push({
              item: user,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Update session if active
      if (this.sessionNumericId) {
        const lastItemId = result.posts[0]?.id;
        this.updateSession(this.sessionNumericId, {
          totalItemsScraped:
            results.posts.inserted +
            results.posts.updated +
            results.comments.inserted +
            results.comments.updated,
          ...(lastItemId && { lastItemId }),
        });
      }
    });

    transaction();
    return results;
  }

  // ============================================================================
  // Analytics & Metrics
  // ============================================================================

  getAnalytics() {
    return this.analytics;
  }

  recordMetric(
    sessionId: string,
    metrics: {
      requestsMade?: number;
      requestsSuccessful?: number;
      requestsFailed?: number;
      postsScraped?: number;
      commentsScraped?: number;
      usersScraped?: number;
      avgResponseTimeMs?: number;
      rateLimitHits?: number;
    },
  ): void {
    const timeBucket =
      Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);
    this.queries.metrics.upsert.run({
      sessionId,
      platform: this.getCurrentPlatform(),
      timeBucket,
      ...metrics,
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private extractPlatformId(item: { id: string; url?: string }): string {
    // Extract platform-specific ID from the item
    // For Reddit: t3_xxx for posts, t1_xxx for comments
    // For HackerNews: numeric IDs
    if (item.id.includes("_")) {
      const parts = item.id.split("_");
      return parts[1] || item.id;
    }
    return item.id;
  }

  private getCurrentPlatform(): Platform {
    if (this.sessionNumericId) {
      const session = this.getSession(this.sessionNumericId);
      if (session) return session.platform;
    }
    return "reddit"; // Default
  }

  private mapRowToPost(row: any): ForumPost {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      author: row.author,
      authorId: row.author_id || undefined,
      url: row.url,
      score: row.score,
      commentCount: row.comment_count,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      platform: row.platform as Platform,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private mapRowToComment(row: any): Comment {
    return {
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id,
      author: row.author,
      authorId: row.author_id || undefined,
      content: row.content,
      score: row.score,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      depth: row.depth,
      platform: row.platform as Platform,
    };
  }

  private mapRowToSession(row: any): SessionInfo {
    const session: SessionInfo = {
      id: row.id,
      sessionId: row.session_id,
      platform: row.platform as Platform,
      status: row.status,
      totalItemsScraped: row.total_items_scraped,
      startedAt: new Date(row.started_at),
      lastActivityAt: new Date(row.last_activity_at),
      errorCount: row.error_count,
    };

    if (row.query_type) session.queryType = row.query_type;
    if (row.query_value) session.queryValue = row.query_value;
    if (row.total_items_target)
      session.totalItemsTarget = row.total_items_target;
    if (row.total_posts !== null && row.total_posts !== undefined)
      session.totalPosts = row.total_posts;
    if (row.total_comments !== null && row.total_comments !== undefined)
      session.totalComments = row.total_comments;
    if (row.total_users !== null && row.total_users !== undefined)
      session.totalUsers = row.total_users;
    if (row.last_item_id) session.lastItemId = row.last_item_id;
    if (row.resume_token) session.resumeToken = row.resume_token;
    if (row.completed_at) session.completedAt = new Date(row.completed_at);
    if (row.last_error) {
      session.lastError = row.last_error;
      // Add errorMessage property for test compatibility
      (session as any).errorMessage = row.last_error;
    }

    return session;
  }

  // ============================================================================
  // Cleanup & Maintenance
  // ============================================================================

  vacuum(): void {
    this.db.pragma("vacuum");
    this.db.pragma("optimize");
  }

  close(): void {
    this.queries.cleanup();
    if (this.connection) {
      this.connection.disconnect();
    }
  }
}
