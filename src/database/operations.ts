import { DatabaseConnection } from "./connection.js";
import type {
  ForumPost,
  Comment,
  User,
  Platform,
  ScrapeResult,
} from "../types/core.js";

export class DatabaseOperations {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  // Post operations
  insertPost(post: ForumPost): void {
    const stmt = this.connection.prepare(`
      INSERT OR REPLACE INTO posts (
        id, platform, title, content, author, author_id, url, 
        score, comment_count, created_at, updated_at, metadata
      ) VALUES (
        @id, @platform, @title, @content, @author, @authorId, @url,
        @score, @commentCount, @createdAt, @updatedAt, @metadata
      )
    `);

    stmt.run({
      ...post,
      createdAt: post.createdAt.getTime(),
      updatedAt: post.updatedAt?.getTime() || null,
      metadata: post.metadata ? JSON.stringify(post.metadata) : null,
      authorId: post.authorId || null,
    });
  }

  insertPosts(posts: ForumPost[]): void {
    this.connection.transaction(() => {
      for (const post of posts) {
        this.insertPost(post);
      }
    })();
  }

  getPost(id: string, platform: Platform): ForumPost | null {
    const stmt = this.connection.prepare(`
      SELECT * FROM posts WHERE id = ? AND platform = ?
    `);

    const row = stmt.get(id, platform) as any;

    if (!row) return null;

    return this.mapRowToPost(row);
  }

  getPosts(platform?: Platform, limit = 100, offset = 0): ForumPost[] {
    let query = "SELECT * FROM posts";
    const params: any[] = [];

    if (platform) {
      query += " WHERE platform = ?";
      params.push(platform);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const stmt = this.connection.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => this.mapRowToPost(row));
  }

  // Comment operations
  insertComment(comment: Comment): void {
    const stmt = this.connection.prepare(`
      INSERT OR REPLACE INTO comments (
        id, post_id, platform, parent_id, author, author_id,
        content, score, created_at, updated_at, depth
      ) VALUES (
        @id, @postId, @platform, @parentId, @author, @authorId,
        @content, @score, @createdAt, @updatedAt, @depth
      )
    `);

    stmt.run({
      ...comment,
      createdAt: comment.createdAt.getTime(),
      updatedAt: comment.updatedAt?.getTime() || null,
      authorId: comment.authorId || null,
      parentId: comment.parentId || null,
    });
  }

  insertComments(comments: Comment[]): void {
    this.connection.transaction(() => {
      for (const comment of comments) {
        this.insertComment(comment);
      }
    })();
  }

  getComments(postId: string, platform: Platform): Comment[] {
    const stmt = this.connection.prepare(`
      SELECT * FROM comments 
      WHERE post_id = ? AND platform = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(postId, platform) as any[];

    return rows.map((row) => this.mapRowToComment(row));
  }

  // User operations
  insertUser(user: User): void {
    const stmt = this.connection.prepare(`
      INSERT OR REPLACE INTO users (
        id, platform, username, karma, created_at, metadata
      ) VALUES (
        @id, @platform, @username, @karma, @createdAt, @metadata
      )
    `);

    stmt.run({
      ...user,
      createdAt: user.createdAt?.getTime() || null,
      metadata: user.metadata ? JSON.stringify(user.metadata) : null,
      karma: user.karma || null,
    });
  }

  insertUsers(users: User[]): void {
    this.connection.transaction(() => {
      for (const user of users) {
        this.insertUser(user);
      }
    })();
  }

  getUser(id: string, platform: Platform): User | null {
    const stmt = this.connection.prepare(`
      SELECT * FROM users WHERE id = ? AND platform = ?
    `);

    const row = stmt.get(id, platform) as any;

    if (!row) return null;

    return this.mapRowToUser(row);
  }

  // Session operations
  createSession(
    platform: Platform,
    query?: string,
    subreddit?: string,
    category?: string,
  ): number {
    const stmt = this.connection.prepare(`
      INSERT INTO scrape_sessions (
        platform, query, subreddit, category, started_at, status
      ) VALUES (
        @platform, @query, @subreddit, @category, @startedAt, 'running'
      )
    `);

    const result = stmt.run({
      platform,
      query: query || null,
      subreddit: subreddit || null,
      category: category || null,
      startedAt: Date.now(),
    });

    return Number(result.lastInsertRowid);
  }

  updateSession(
    sessionId: number,
    status: "completed" | "failed",
    stats?: { posts: number; comments: number; users: number },
    error?: string,
  ): void {
    const stmt = this.connection.prepare(`
      UPDATE scrape_sessions
      SET status = @status,
          completed_at = @completedAt,
          total_posts = @totalPosts,
          total_comments = @totalComments,
          total_users = @totalUsers,
          error_message = @errorMessage
      WHERE id = @id
    `);

    stmt.run({
      id: sessionId,
      status,
      completedAt: Date.now(),
      totalPosts: stats?.posts || 0,
      totalComments: stats?.comments || 0,
      totalUsers: stats?.users || 0,
      errorMessage: error || null,
    });
  }

  // Bulk operations
  saveScrapeResult(result: ScrapeResult): void {
    const sessionId = this.createSession(
      result.metadata.platform,
      result.metadata.query,
      result.metadata.subreddit,
      result.metadata.category,
    );

    try {
      this.connection.transaction(() => {
        // Insert posts
        if (result.posts.length > 0) {
          this.insertPosts(result.posts);
        }

        // Insert comments
        if (result.comments && result.comments.length > 0) {
          this.insertComments(result.comments);
        }

        // Insert users
        if (result.users && result.users.length > 0) {
          this.insertUsers(result.users);
        }
      })();

      // Update session with success
      this.updateSession(sessionId, "completed", {
        posts: result.posts.length,
        comments: result.comments?.length || 0,
        users: result.users?.length || 0,
      });
    } catch (error) {
      // Update session with failure
      this.updateSession(
        sessionId,
        "failed",
        undefined,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw error;
    }
  }

  // Statistics operations
  getStatistics(platform?: Platform): any {
    const db = this.connection.getDatabase();

    const baseQuery = platform ? " WHERE platform = ?" : "";
    const params = platform ? [platform] : [];

    const postCount = db
      .prepare(`SELECT COUNT(*) as count FROM posts${baseQuery}`)
      .get(...params) as any;
    const commentCount = db
      .prepare(`SELECT COUNT(*) as count FROM comments${baseQuery}`)
      .get(...params) as any;
    const userCount = db
      .prepare(`SELECT COUNT(*) as count FROM users${baseQuery}`)
      .get(...params) as any;

    const recentSessions = db
      .prepare(
        `
      SELECT * FROM scrape_sessions${baseQuery}
      ORDER BY started_at DESC
      LIMIT 10
    `,
      )
      .all(...params);

    return {
      totalPosts: postCount.count,
      totalComments: commentCount.count,
      totalUsers: userCount.count,
      recentSessions,
    };
  }

  // Cleanup operations
  deleteOldData(daysOld: number): void {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    this.connection.transaction(() => {
      const db = this.connection.getDatabase();

      db.prepare("DELETE FROM comments WHERE scraped_at < ?").run(cutoffTime);
      db.prepare("DELETE FROM posts WHERE scraped_at < ?").run(cutoffTime);
      db.prepare("DELETE FROM users WHERE scraped_at < ?").run(cutoffTime);
      db.prepare("DELETE FROM scrape_sessions WHERE started_at < ?").run(
        cutoffTime,
      );
    })();
  }

  // Helper methods
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

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      karma: row.karma || undefined,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      platform: row.platform as Platform,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
