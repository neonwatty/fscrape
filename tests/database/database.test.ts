import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { DatabaseManager } from "../../src/database/database.js";
import { DATABASE_SCHEMA, DATABASE_INDEXES } from "../../src/database/schema.js";
import type { ForumPost, Comment, User } from "../../src/types/core.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("DatabaseManager", () => {
  let db: Database.Database;
  let dbManager: DatabaseManager;
  let tempDir: string;
  let dbPath: string;

  beforeAll(() => {
    // Create temp directory for test database
    tempDir = mkdtempSync(join(tmpdir(), "fscrape-test-"));
    dbPath = join(tempDir, "test.db");
  });

  beforeEach(() => {
    // Create fresh database for each test
    db = new Database(dbPath);
    
    // Drop all tables first to ensure clean state
    db.exec(`
      DROP TABLE IF EXISTS comments;
      DROP TABLE IF EXISTS posts;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS scrape_sessions;
      DROP TABLE IF EXISTS rate_limit_state;
      DROP TABLE IF EXISTS scraping_metrics;
    `);
    
    // Initialize schema from schema.ts
    for (const [, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
      db.exec(tableSchema as string);
    }
    
    for (const indexSql of DATABASE_INDEXES) {
      db.exec(indexSql);
    }
    
    dbManager = new DatabaseManager(db);
  });

  afterEach(() => {
    // Clean up database between tests
    db.exec(`
      DELETE FROM comments;
      DELETE FROM posts;
      DELETE FROM users;
      DELETE FROM scrape_sessions;
      DELETE FROM rate_limit_state;
      DELETE FROM scraping_metrics;
    `);
  });

  afterAll(() => {
    // Clean up temp directory
    if (db) db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Post Operations", () => {
    const samplePost: ForumPost = {
      id: "post123",
      title: "Test Post",
      content: "This is test content",
      author: "testuser",
      authorId: "user123",
      url: "https://reddit.com/r/test/post123",
      score: 100,
      commentCount: 5,
      createdAt: new Date("2024-01-01"),
      platform: "reddit",
      metadata: { subreddit: "test" },
    };

    it("should upsert a new post", async () => {
      const result = await dbManager.upsertPost(samplePost);
      expect(result.changes).toBe(1);
    });

    it("should update an existing post", async () => {
      await dbManager.upsertPost(samplePost);
      
      const updatedPost = { ...samplePost, score: 200 };
      const result = await dbManager.upsertPost(updatedPost);
      
      expect(result.changes).toBe(1);
      const post = db.prepare("SELECT score FROM posts WHERE id = ?").get(samplePost.id) as any;
      expect(post.score).toBe(200);
    });

    it("should handle bulk post operations", async () => {
      const posts: ForumPost[] = [
        samplePost,
        { ...samplePost, id: "post456", title: "Another Post" },
        { ...samplePost, id: "post789", title: "Third Post" },
      ];

      const result = await dbManager.bulkUpsertPosts(posts);
      expect(result.totalChanges).toBe(3);
    });

    it("should retrieve posts by platform", async () => {
      await dbManager.upsertPost(samplePost);
      await dbManager.upsertPost({
        ...samplePost,
        id: "hn123",
        platform: "hackernews",
      });

      const redditPosts = db
        .prepare("SELECT * FROM posts WHERE platform = ?")
        .all("reddit") as any[];
      
      expect(redditPosts).toHaveLength(1);
      expect(redditPosts[0].platform).toBe("reddit");
    });
  });

  describe("Comment Operations", () => {
    const sampleComment: Comment = {
      id: "comment123",
      postId: "post123",
      parentId: null,
      author: "commenter",
      authorId: "user456",
      content: "Test comment",
      score: 10,
      createdAt: new Date("2024-01-02"),
      depth: 0,
      platform: "reddit",
    };

    beforeEach(async () => {
      // Insert parent post
      const post: ForumPost = {
        id: "post123",
        title: "Parent Post",
        content: "Content",
        author: "author",
        url: "https://reddit.com/post123",
        score: 50,
        commentCount: 1,
        createdAt: new Date("2024-01-01"),
        platform: "reddit",
      };
      await dbManager.upsertPost(post);
    });

    it("should upsert a new comment", async () => {
      const result = await dbManager.upsertComment(sampleComment);
      expect(result.changes).toBe(1);
    });

    it("should handle nested comments", async () => {
      await dbManager.upsertComment(sampleComment);
      
      const nestedComment: Comment = {
        ...sampleComment,
        id: "comment456",
        parentId: "comment123",
        depth: 1,
      };
      
      const result = await dbManager.upsertComment(nestedComment);
      expect(result.changes).toBe(1);
      
      const comment = db
        .prepare("SELECT * FROM comments WHERE id = ?")
        .get("comment456") as any;
      expect(comment.parent_id).toBe("comment123");
      expect(comment.depth).toBe(1);
    });

    it("should handle bulk comment operations", async () => {
      const comments: Comment[] = [
        sampleComment,
        { ...sampleComment, id: "comment456" },
        { ...sampleComment, id: "comment789" },
      ];

      const result = await dbManager.bulkUpsertComments(comments);
      expect(result.totalChanges).toBe(3);
    });
  });

  describe("User Operations", () => {
    const sampleUser: User = {
      id: "user123",
      username: "testuser",
      karma: 1000,
      createdAt: new Date("2020-01-01"),
      platform: "reddit",
      metadata: { verified: true },
    };

    it("should upsert a new user", async () => {
      const result = await dbManager.upsertUser(sampleUser);
      expect(result.changes).toBe(1);
    });

    it("should update user karma", async () => {
      await dbManager.upsertUser(sampleUser);
      
      const updatedUser = { ...sampleUser, karma: 2000 };
      await dbManager.upsertUser(updatedUser);
      
      const user = db
        .prepare("SELECT karma FROM users WHERE id = ?")
        .get(sampleUser.id) as any;
      expect(user.karma).toBe(2000);
    });

    it("should handle bulk user operations", async () => {
      const users: User[] = [
        sampleUser,
        { ...sampleUser, id: "user456", username: "another" },
        { ...sampleUser, id: "user789", username: "third" },
      ];

      const result = await dbManager.bulkUpsertUsers(users);
      expect(result.totalChanges).toBe(3);
    });
  });

  describe("Session Management", () => {
    it("should create a new scrape session", async () => {
      const sessionId = await dbManager.createSession({
        platform: "reddit",
        query: "typescript",
        subreddit: "programming",
      });

      expect(sessionId).toBeGreaterThan(0);
      
      const session = await dbManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.platform).toBe("reddit");
      expect(session?.status).toBe("running");
    });

    it("should update session progress", async () => {
      const sessionId = await dbManager.createSession({
        platform: "reddit",
      });

      await dbManager.updateSession(sessionId, {
        totalPosts: 10,
        totalComments: 50,
        totalUsers: 15,
      });

      const session = await dbManager.getSession(sessionId);
      expect(session?.totalPosts).toBe(10);
      expect(session?.totalComments).toBe(50);
      expect(session?.totalUsers).toBe(15);
    });

    it("should complete a session", async () => {
      const sessionId = await dbManager.createSession({
        platform: "reddit",
      });

      await dbManager.updateSession(sessionId, {
        status: "completed",
        totalPosts: 25,
      });

      const session = await dbManager.getSession(sessionId);
      expect(session?.status).toBe("completed");
      expect(session?.completedAt).toBeDefined();
    });

    it("should handle session errors", async () => {
      const sessionId = await dbManager.createSession({
        platform: "hackernews",
      });

      await dbManager.updateSession(sessionId, {
        status: "failed",
        errorMessage: "Rate limit exceeded",
      });

      const session = await dbManager.getSession(sessionId);
      expect(session?.status).toBe("failed");
      expect(session?.errorMessage).toBe("Rate limit exceeded");
    });

    it("should find active sessions", async () => {
      // Create multiple sessions
      await dbManager.createSession({ platform: "reddit" });
      const activeId = await dbManager.createSession({ platform: "hackernews" });
      await dbManager.createSession({ platform: "reddit" });

      // Complete one session
      await dbManager.updateSession(activeId, { status: "completed" });

      const activeSessions = db
        .prepare("SELECT * FROM scrape_sessions WHERE status = 'running'")
        .all() as any[];
      
      expect(activeSessions).toHaveLength(2);
    });
  });

  describe("Transaction Handling", () => {
    it("should rollback on error in bulk operations", async () => {
      const posts: ForumPost[] = [
        {
          id: "post1",
          title: "Valid Post",
          content: "Content",
          author: "user",
          url: "https://reddit.com/post1",
          score: 10,
          commentCount: 0,
          createdAt: new Date(),
          platform: "reddit",
        },
        {
          id: "post2",
          title: "Invalid Post",
          content: "Content",
          author: "user",
          url: "invalid-url", // This will cause validation error
          score: 10,
          commentCount: 0,
          createdAt: new Date(),
          platform: "reddit" as any,
        },
      ];

      // This should throw and rollback
      await expect(dbManager.bulkUpsertPosts(posts)).rejects.toThrow();

      // Verify no posts were inserted
      const count = db.prepare("SELECT COUNT(*) as count FROM posts").get() as any;
      expect(count.count).toBe(0);
    });

    it("should handle concurrent operations safely", async () => {
      const promises = [];
      
      // Create 10 concurrent post insertions
      for (let i = 0; i < 10; i++) {
        const post: ForumPost = {
          id: `concurrent-${i}`,
          title: `Concurrent Post ${i}`,
          content: "Content",
          author: "user",
          url: `https://reddit.com/post${i}`,
          score: i,
          commentCount: 0,
          createdAt: new Date(),
          platform: "reddit",
        };
        promises.push(dbManager.upsertPost(post));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      
      const count = db.prepare("SELECT COUNT(*) as count FROM posts").get() as any;
      expect(count.count).toBe(10);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null and undefined values correctly", async () => {
      const post: ForumPost = {
        id: "null-test",
        title: "Test",
        content: null, // null content
        author: "user",
        url: "https://reddit.com/test",
        score: 0,
        commentCount: 0,
        createdAt: new Date(),
        platform: "reddit",
        // undefined optional fields
      };

      const result = await dbManager.upsertPost(post);
      expect(result.changes).toBe(1);
      
      const saved = db.prepare("SELECT * FROM posts WHERE id = ?").get("null-test") as any;
      expect(saved.content).toBeNull();
      expect(saved.author_id).toBeNull();
      expect(saved.updated_at).toBeNull();
    });

    it("should handle very long text content", async () => {
      const longContent = "x".repeat(10000);
      const post: ForumPost = {
        id: "long-content",
        title: "Long Post",
        content: longContent,
        author: "user",
        url: "https://reddit.com/long",
        score: 0,
        commentCount: 0,
        createdAt: new Date(),
        platform: "reddit",
      };

      const result = await dbManager.upsertPost(post);
      expect(result.changes).toBe(1);
      
      const saved = db.prepare("SELECT * FROM posts WHERE id = ?").get("long-content") as any;
      expect(saved.content).toHaveLength(10000);
    });

    it("should handle special characters in content", async () => {
      const specialContent = "Test with 'quotes' and \"double quotes\" and \n newlines";
      const comment: Comment = {
        id: "special-chars",
        postId: "post123",
        parentId: null,
        author: "user",
        content: specialContent,
        score: 0,
        createdAt: new Date(),
        depth: 0,
        platform: "reddit",
      };

      // Insert parent post first
      await dbManager.upsertPost({
        id: "post123",
        title: "Parent",
        content: "Content",
        author: "author",
        url: "https://reddit.com/post123",
        score: 0,
        commentCount: 0,
        createdAt: new Date(),
        platform: "reddit",
      });

      const result = await dbManager.upsertComment(comment);
      expect(result.changes).toBe(1);
      
      const saved = db.prepare("SELECT * FROM comments WHERE id = ?").get("special-chars") as any;
      expect(saved.content).toBe(specialContent);
    });
  });
});