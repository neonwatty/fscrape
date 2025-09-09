import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { PreparedQueries } from "../../src/database/queries.js";
import { MigrationManager } from "../../src/database/migrations.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("PreparedQueries", () => {
  let db: Database.Database;
  let queries: PreparedQueries;
  let tempDir: string;
  let dbPath: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fscrape-test-"));
    dbPath = join(tempDir, "test.db");
  });

  beforeEach(() => {
    db = new Database(dbPath);
    
    const migrationManager = new MigrationManager(db);
    migrationManager.loadSchemaFromFile();
    
    queries = new PreparedQueries(db);
  });

  afterAll(() => {
    if (db) db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Statement Preparation", () => {
    it("should prepare all post statements", () => {
      expect(queries.posts.insert).toBeDefined();
      expect(queries.posts.update).toBeDefined();
      expect(queries.posts.upsert).toBeDefined();
      expect(queries.posts.getById).toBeDefined();
      expect(queries.posts.getByPlatform).toBeDefined();
      expect(queries.posts.getRecent).toBeDefined();
    });

    it("should prepare all comment statements", () => {
      expect(queries.comments.insert).toBeDefined();
      expect(queries.comments.update).toBeDefined();
      expect(queries.comments.upsert).toBeDefined();
      expect(queries.comments.getByPost).toBeDefined();
      expect(queries.comments.getByUser).toBeDefined();
      expect(queries.comments.getThread).toBeDefined();
    });

    it("should prepare all user statements", () => {
      expect(queries.users.insert).toBeDefined();
      expect(queries.users.update).toBeDefined();
      expect(queries.users.upsert).toBeDefined();
      expect(queries.users.getById).toBeDefined();
      expect(queries.users.getByUsername).toBeDefined();
      expect(queries.users.getTopByKarma).toBeDefined();
    });

    it("should prepare all session statements", () => {
      expect(queries.sessions.create).toBeDefined();
      expect(queries.sessions.update).toBeDefined();
      expect(queries.sessions.get).toBeDefined();
      expect(queries.sessions.getActive).toBeDefined();
      expect(queries.sessions.getByPlatform).toBeDefined();
    });

    it("should prepare all metrics statements", () => {
      expect(queries.metrics.postsPerPlatform).toBeDefined();
      expect(queries.metrics.commentsPerPlatform).toBeDefined();
      expect(queries.metrics.avgScoreByPlatform).toBeDefined();
      expect(queries.metrics.topPostsByScore).toBeDefined();
      expect(queries.metrics.topUsersByKarma).toBeDefined();
      expect(queries.metrics.engagementByPlatform).toBeDefined();
    });

    it("should prepare all rate limit statements", () => {
      expect(queries.rateLimit.check).toBeDefined();
      expect(queries.rateLimit.increment).toBeDefined();
      expect(queries.rateLimit.reset).toBeDefined();
    });
  });

  describe("Post Queries", () => {
    it("should insert a post using prepared statement", () => {
      const result = queries.posts.insert.run(
        "post1",
        "reddit",
        "Test Post",
        "Content",
        "author1",
        "user1",
        "https://reddit.com/post1",
        100,
        5,
        new Date().toISOString(),
        null,
        JSON.stringify({ subreddit: "test" })
      );
      
      expect(result.changes).toBe(1);
    });

    it("should get post by id", () => {
      queries.posts.insert.run(
        "post2",
        "reddit",
        "Test Post 2",
        "Content 2",
        "author2",
        null,
        "https://reddit.com/post2",
        50,
        2,
        new Date().toISOString(),
        null,
        null
      );
      
      const post = queries.posts.getById.get("post2") as any;
      expect(post).toBeDefined();
      expect(post.title).toBe("Test Post 2");
      expect(post.score).toBe(50);
    });

    it("should get posts by platform", () => {
      // Insert reddit posts
      queries.posts.insert.run(
        "r1", "reddit", "Reddit 1", null, "user1", null,
        "https://reddit.com/r1", 10, 0, new Date().toISOString(), null, null
      );
      queries.posts.insert.run(
        "r2", "reddit", "Reddit 2", null, "user2", null,
        "https://reddit.com/r2", 20, 0, new Date().toISOString(), null, null
      );
      
      // Insert hackernews post
      queries.posts.insert.run(
        "hn1", "hackernews", "HN 1", null, "user3", null,
        "https://news.ycombinator.com/item?id=hn1", 30, 0, new Date().toISOString(), null, null
      );
      
      const redditPosts = queries.posts.getByPlatform.all("reddit", 10) as any[];
      expect(redditPosts).toHaveLength(2);
      expect(redditPosts.every(p => p.platform === "reddit")).toBe(true);
    });

    it("should upsert posts correctly", () => {
      // Initial insert
      queries.posts.upsert.run(
        "upsert1", "reddit", "Initial Title", "Initial Content", "author1", null,
        "https://reddit.com/upsert1", 100, 5, new Date().toISOString(), null, null
      );
      
      // Update with new values
      queries.posts.upsert.run(
        "upsert1", "reddit", "Updated Title", "Updated Content", "author1", null,
        "https://reddit.com/upsert1", 200, 10, new Date().toISOString(), null, null
      );
      
      const post = queries.posts.getById.get("upsert1") as any;
      expect(post.title).toBe("Updated Title");
      expect(post.score).toBe(200);
      expect(post.comment_count).toBe(10);
    });
  });

  describe("Comment Queries", () => {
    beforeEach(() => {
      // Insert a parent post for comments
      queries.posts.insert.run(
        "parent-post", "reddit", "Parent Post", "Content", "author", null,
        "https://reddit.com/parent", 100, 0, new Date().toISOString(), null, null
      );
    });

    it("should insert a comment", () => {
      const result = queries.comments.insert.run(
        "comment1",
        "parent-post",
        null,
        "reddit",
        "commenter1",
        "user1",
        "This is a comment",
        10,
        new Date().toISOString(),
        0,
        null
      );
      
      expect(result.changes).toBe(1);
    });

    it("should get comments by post", () => {
      // Insert multiple comments
      queries.comments.insert.run(
        "c1", "parent-post", null, "reddit", "user1", null,
        "Comment 1", 5, new Date().toISOString(), 0, null
      );
      queries.comments.insert.run(
        "c2", "parent-post", null, "reddit", "user2", null,
        "Comment 2", 10, new Date().toISOString(), 0, null
      );
      queries.comments.insert.run(
        "c3", "parent-post", "c1", "reddit", "user3", null,
        "Reply to c1", 3, new Date().toISOString(), 1, null
      );
      
      const comments = queries.comments.getByPost.all("parent-post") as any[];
      expect(comments).toHaveLength(3);
      expect(comments.every(c => c.post_id === "parent-post")).toBe(true);
    });

    it("should handle comment threads", () => {
      // Create a comment thread
      queries.comments.insert.run(
        "root", "parent-post", null, "reddit", "user1", null,
        "Root comment", 10, new Date().toISOString(), 0, null
      );
      queries.comments.insert.run(
        "child1", "parent-post", "root", "reddit", "user2", null,
        "First reply", 5, new Date().toISOString(), 1, null
      );
      queries.comments.insert.run(
        "child2", "parent-post", "child1", "reddit", "user3", null,
        "Second reply", 2, new Date().toISOString(), 2, null
      );
      
      const thread = queries.comments.getThread.all("root") as any[];
      expect(thread).toHaveLength(3);
      expect(thread[0].id).toBe("root");
      expect(thread[1].parent_id).toBe("root");
      expect(thread[2].parent_id).toBe("child1");
    });
  });

  describe("User Queries", () => {
    it("should insert a user", () => {
      const result = queries.users.insert.run(
        "user123",
        "reddit",
        "testuser",
        1000,
        new Date().toISOString(),
        JSON.stringify({ verified: true })
      );
      
      expect(result.changes).toBe(1);
    });

    it("should get user by id", () => {
      queries.users.insert.run(
        "user456", "reddit", "another", 500,
        new Date().toISOString(), null
      );
      
      const user = queries.users.getById.get("user456") as any;
      expect(user).toBeDefined();
      expect(user.username).toBe("another");
      expect(user.karma).toBe(500);
    });

    it("should get user by username and platform", () => {
      queries.users.insert.run(
        "u1", "reddit", "commonname", 100,
        new Date().toISOString(), null
      );
      queries.users.insert.run(
        "u2", "hackernews", "commonname", 200,
        new Date().toISOString(), null
      );
      
      const redditUser = queries.users.getByUsername.get("commonname", "reddit") as any;
      expect(redditUser.id).toBe("u1");
      expect(redditUser.karma).toBe(100);
      
      const hnUser = queries.users.getByUsername.get("commonname", "hackernews") as any;
      expect(hnUser.id).toBe("u2");
      expect(hnUser.karma).toBe(200);
    });

    it("should get top users by karma", () => {
      queries.users.insert.run("u1", "reddit", "low", 10, new Date().toISOString(), null);
      queries.users.insert.run("u2", "reddit", "mid", 50, new Date().toISOString(), null);
      queries.users.insert.run("u3", "reddit", "high", 100, new Date().toISOString(), null);
      
      const topUsers = queries.users.getTopByKarma.all("reddit", 2) as any[];
      expect(topUsers).toHaveLength(2);
      expect(topUsers[0].karma).toBe(100);
      expect(topUsers[1].karma).toBe(50);
    });
  });

  describe("Session Queries", () => {
    it("should create a session", () => {
      const result = queries.sessions.create.run(
        "reddit",
        "in_progress",
        JSON.stringify({ query: "typescript" }),
        null,
        0, 0, 0,
        null, null,
        new Date().toISOString(),
        null
      );
      
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it("should update session progress", () => {
      const createResult = queries.sessions.create.run(
        "reddit", "in_progress", null, null,
        0, 0, 0, null, null,
        new Date().toISOString(), null
      );
      
      const sessionId = createResult.lastInsertRowid as number;
      
      queries.sessions.update.run(
        "in_progress",
        10, 50, 15,
        null, null,
        null,
        sessionId
      );
      
      const session = queries.sessions.get.get(sessionId) as any;
      expect(session.total_posts).toBe(10);
      expect(session.total_comments).toBe(50);
      expect(session.total_users).toBe(15);
    });

    it("should get active sessions", () => {
      // Create multiple sessions
      queries.sessions.create.run(
        "reddit", "in_progress", null, null, 0, 0, 0, null, null,
        new Date().toISOString(), null
      );
      queries.sessions.create.run(
        "hackernews", "completed", null, null, 10, 20, 5, null, null,
        new Date().toISOString(), new Date().toISOString()
      );
      queries.sessions.create.run(
        "reddit", "in_progress", null, null, 5, 10, 3, null, null,
        new Date().toISOString(), null
      );
      
      const activeSessions = queries.sessions.getActive.all() as any[];
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.every(s => s.status === "in_progress")).toBe(true);
    });
  });

  describe("Metrics Queries", () => {
    beforeEach(() => {
      // Insert test data
      queries.posts.insert.run(
        "p1", "reddit", "Post 1", null, "u1", null,
        "url1", 100, 10, new Date().toISOString(), null, null
      );
      queries.posts.insert.run(
        "p2", "reddit", "Post 2", null, "u2", null,
        "url2", 50, 5, new Date().toISOString(), null, null
      );
      queries.posts.insert.run(
        "p3", "hackernews", "Post 3", null, "u3", null,
        "url3", 200, 20, new Date().toISOString(), null, null
      );
      
      queries.users.insert.run("u1", "reddit", "user1", 1000, new Date().toISOString(), null);
      queries.users.insert.run("u2", "reddit", "user2", 500, new Date().toISOString(), null);
      queries.users.insert.run("u3", "hackernews", "user3", 2000, new Date().toISOString(), null);
    });

    it("should get posts per platform", () => {
      const metrics = queries.metrics.postsPerPlatform.all() as any[];
      expect(metrics).toHaveLength(2);
      
      const reddit = metrics.find(m => m.platform === "reddit");
      expect(reddit.post_count).toBe(2);
      
      const hn = metrics.find(m => m.platform === "hackernews");
      expect(hn.post_count).toBe(1);
    });

    it("should get average score by platform", () => {
      const metrics = queries.metrics.avgScoreByPlatform.all() as any[];
      
      const reddit = metrics.find(m => m.platform === "reddit");
      expect(reddit.avg_score).toBe(75); // (100 + 50) / 2
      
      const hn = metrics.find(m => m.platform === "hackernews");
      expect(hn.avg_score).toBe(200);
    });

    it("should get top posts by score", () => {
      const topPosts = queries.metrics.topPostsByScore.all(2) as any[];
      expect(topPosts).toHaveLength(2);
      expect(topPosts[0].score).toBe(200);
      expect(topPosts[1].score).toBe(100);
    });

    it("should get top users by karma", () => {
      const topUsers = queries.metrics.topUsersByKarma.all(2) as any[];
      expect(topUsers).toHaveLength(2);
      expect(topUsers[0].karma).toBe(2000);
      expect(topUsers[1].karma).toBe(1000);
    });
  });

  describe("Rate Limiting Queries", () => {
    it("should check rate limit", () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const limit = queries.rateLimit.check.get("reddit", oneHourAgo) as any;
      expect(limit).toBeDefined();
      expect(limit.request_count).toBe(0);
    });

    it("should increment rate limit", () => {
      queries.rateLimit.increment.run("reddit", new Date().toISOString());
      queries.rateLimit.increment.run("reddit", new Date().toISOString());
      
      const now = new Date().toISOString();
      const limit = queries.rateLimit.check.get("reddit", now) as any;
      expect(limit.request_count).toBe(2);
    });

    it("should reset old rate limits", () => {
      const oldDate = new Date(Date.now() - 7200000); // 2 hours ago
      queries.rateLimit.increment.run("reddit", oldDate.toISOString());
      
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      queries.rateLimit.reset.run(oneHourAgo);
      
      const limit = queries.rateLimit.check.get("reddit", new Date().toISOString()) as any;
      expect(limit.request_count).toBe(0);
    });
  });
});