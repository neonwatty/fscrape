import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
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

  afterEach(() => {
    // Clean up database between tests
    if (db) {
      db.exec(`
        DELETE FROM forum_posts;
        DELETE FROM comments;
        DELETE FROM users;
        DELETE FROM scraping_sessions;
        DELETE FROM rate_limit_state;
      `);
      db.close();
    }
  });

  afterAll(() => {
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
        "post1",        // id
        "reddit",       // platform
        "post1",        // platform_id
        "Test Post",    // title
        "Content",      // content
        "author1",      // author
        "user1",        // author_id
        "https://reddit.com/post1", // url
        100,             // score
        5,               // comment_count
        new Date().toISOString(), // created_at
        null,            // updated_at
        JSON.stringify({ subreddit: "test" }) // metadata
      );
      
      expect(result.changes).toBe(1);
    });

    it("should get post by id", () => {
      queries.posts.insert.run(
        "post2",        // id
        "reddit",       // platform
        "post2",        // platform_id
        "Test Post 2",  // title
        "Content 2",    // content
        "author2",      // author
        null,            // author_id
        "https://reddit.com/post2", // url
        50,              // score
        2,               // comment_count
        new Date().toISOString(), // created_at
        null,            // updated_at
        null             // metadata
      );
      
      const post = queries.posts.getById.get("post2") as any;
      expect(post).toBeDefined();
      expect(post.title).toBe("Test Post 2");
      expect(post.score).toBe(50);
    });

    it("should get posts by platform", () => {
      // Insert reddit posts
      queries.posts.insert.run(
        "r1", "reddit", "r1", "Reddit 1", null, "user1", null,
        "https://reddit.com/r1", 10, 0, new Date().toISOString(), null, null
      );
      queries.posts.insert.run(
        "r2", "reddit", "r2", "Reddit 2", null, "user2", null,
        "https://reddit.com/r2", 20, 0, new Date().toISOString(), null, null
      );
      
      // Insert hackernews post
      queries.posts.insert.run(
        "hn1", "hackernews", "hn1", "HN 1", null, "user3", null,
        "https://news.ycombinator.com/item?id=hn1", 30, 0, new Date().toISOString(), null, null
      );
      
      const redditPosts = queries.posts.getByPlatform.all("reddit", 10, 0) as any[];
      expect(redditPosts).toHaveLength(2);
      expect(redditPosts.every(p => p.platform === "reddit")).toBe(true);
    });

    it("should upsert posts correctly", () => {
      // Initial insert
      queries.posts.upsert.run(
        "upsert1", "reddit", "upsert1", "Initial Title", "Initial Content", "author1", null,
        "https://reddit.com/upsert1", 100, 5, new Date().toISOString(), null, null
      );
      
      // Update with new values (title and content won't change - only metrics)
      queries.posts.upsert.run(
        "upsert1", "reddit", "upsert1", "Updated Title", "Updated Content", "author1", null,
        "https://reddit.com/upsert1", 200, 10, new Date().toISOString(), null, null
      );
      
      const post = queries.posts.getById.get("upsert1") as any;
      expect(post.title).toBe("Initial Title"); // Title doesn't change on upsert
      expect(post.score).toBe(200);
      expect(post.comment_count).toBe(10);
    });
  });

  describe("Comment Queries", () => {
    beforeEach(() => {
      // Insert a parent post for comments
      queries.posts.insert.run(
        "parent-post", "reddit", "parent-post", "Parent Post", "Content", "author", null,
        "https://reddit.com/parent", 100, 0, new Date().toISOString(), null, null
      );
    });

    it("should insert a comment", () => {
      const result = queries.comments.insert.run(
        "comment1",       // id
        "parent-post",    // post_id
        null,             // parent_id
        "reddit",         // platform
        "comment1",       // platform_id
        "commenter1",     // author
        "user1",          // author_id
        "This is a comment", // content
        10,               // score
        0,                // depth
        new Date().toISOString(), // created_at
        null              // updated_at
      );
      
      expect(result.changes).toBe(1);
    });

    it("should get comments by post", () => {
      // Insert multiple comments
      queries.comments.insert.run(
        "c1", "parent-post", null, "reddit", "c1", "user1", null,
        "Comment 1", 5, 0, new Date().toISOString(), null
      );
      queries.comments.insert.run(
        "c2", "parent-post", null, "reddit", "c2", "user2", null,
        "Comment 2", 10, 0, new Date().toISOString(), null
      );
      queries.comments.insert.run(
        "c3", "parent-post", "c1", "reddit", "c3", "user3", null,
        "Reply to c1", 3, 1, new Date().toISOString(), null
      );
      
      const comments = queries.comments.getByPost.all("parent-post") as any[];
      expect(comments).toHaveLength(3);
      expect(comments.every(c => c.post_id === "parent-post")).toBe(true);
    });

    it("should handle comment threads", () => {
      // Create a comment thread
      queries.comments.insert.run(
        "root", "parent-post", null, "reddit", "root", "user1", null,
        "Root comment", 10, 0, new Date().toISOString(), null
      );
      queries.comments.insert.run(
        "child1", "parent-post", "root", "reddit", "child1", "user2", null,
        "First reply", 5, 1, new Date().toISOString(), null
      );
      queries.comments.insert.run(
        "child2", "parent-post", "child1", "reddit", "child2", "user3", null,
        "Second reply", 2, 2, new Date().toISOString(), null
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
      
      const redditUser = queries.users.getByUsername.get("reddit", "commonname") as any;
      expect(redditUser.id).toBe("u1");
      expect(redditUser.karma).toBe(100);
      
      const hnUser = queries.users.getByUsername.get("hackernews", "commonname") as any;
      expect(hnUser.id).toBe("u2");
      expect(hnUser.karma).toBe(200);
    });

    it("should get top users by karma", () => {
      queries.users.insert.run("u1", "reddit", "low", 10, new Date().toISOString(), null);
      queries.users.insert.run("u2", "reddit", "mid", 50, new Date().toISOString(), null);
      queries.users.insert.run("u3", "reddit", "high", 100, new Date().toISOString(), null);
      
      const topUsers = queries.users.getTopByKarma.all(2) as any[];
      expect(topUsers).toHaveLength(2);
      expect(topUsers[0].karma).toBe(100);
      expect(topUsers[1].karma).toBe(50);
    });
  });

  describe("Session Queries", () => {
    it("should create a session", () => {
      const sessionId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const result = queries.sessions.create.run(
        sessionId,       // session_id
        "reddit",        // platform
        "running",       // status
        "search",        // query_type
        "typescript",    // query_value
        null,            // total_items_target
        0,               // total_items_scraped
        0,               // total_posts
        0,               // total_comments
        0,               // total_users
        Date.now(),      // started_at
        Date.now()       // last_activity_at
      );
      
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it("should update session progress", () => {
      const sessionIdStr = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const createResult = queries.sessions.create.run(
        sessionIdStr,    // session_id
        "reddit",        // platform
        "running",       // status
        null,            // query_type
        null,            // query_value
        null,            // total_items_target
        0,               // total_items_scraped
        0,               // total_posts
        0,               // total_comments
        0,               // total_users
        Date.now(),      // started_at
        Date.now()       // last_activity_at
      );
      
      const rowId = createResult.lastInsertRowid as number;
      
      queries.sessions.update.run({
        sessionId: sessionIdStr,
        status: "running",
        totalItemsTarget: 10,
        totalItemsScraped: 5,
        totalPosts: 2,
        totalComments: 3,
        totalUsers: 1,
        lastItemId: null,
        resumeToken: null,
        lastActivityAt: Date.now(),
        completedAt: null,
        errorCount: null,
        lastError: null
      });
      
      const session = queries.sessions.get.get(sessionIdStr) as any;
      expect(session.total_items_target).toBe(10);
      expect(session.total_items_scraped).toBe(5);
    });

    it("should get active sessions", () => {
      // Create multiple sessions
      const sid1 = `test-${Date.now()}-1`;
      queries.sessions.create.run(
        sid1, "reddit", "running", null, null, null, 0, 0, 0, 0, Date.now(), Date.now()
      );
      const sid2 = `test-${Date.now()}-2`;
      queries.sessions.create.run(
        sid2, "hackernews", "completed", null, null, 10, 5, 2, 3, 1, Date.now(), Date.now()
      );
      const sid3 = `test-${Date.now()}-3`;
      queries.sessions.create.run(
        sid3, "reddit", "running", null, null, 5, 3, 1, 2, 0, Date.now(), Date.now()
      );
      
      const activeSessions = queries.sessions.getActive.all() as any[];
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.every(s => s.status === "running")).toBe(true);
    });
  });

  describe("Metrics Queries", () => {
    beforeEach(() => {
      // Insert test data
      queries.posts.insert.run(
        "p1", "reddit", "p1", "Post 1", null, "u1", null,
        "url1", 100, 10, new Date().toISOString(), null, null
      );
      queries.posts.insert.run(
        "p2", "reddit", "p2", "Post 2", null, "u2", null,
        "url2", 50, 5, new Date().toISOString(), null, null
      );
      queries.posts.insert.run(
        "p3", "hackernews", "p3", "Post 3", null, "u3", null,
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
      expect(reddit.count).toBe(2);
      
      const hn = metrics.find(m => m.platform === "hackernews");
      expect(hn.count).toBe(1);
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
      const now = Date.now();
      queries.rateLimit.increment.run("reddit", now, now, now);
      queries.rateLimit.increment.run("reddit", now, now, now);
      
      const limit = queries.rateLimit.get.get("reddit") as any;
      expect(limit.requests_in_window).toBe(2);
    });

    it("should reset old rate limits", () => {
      const oldDate = Date.now() - 7200000; // 2 hours ago
      queries.rateLimit.increment.run("reddit", oldDate, oldDate, oldDate);
      
      const oneHourAgo = Date.now() - 3600000;
      queries.rateLimit.reset.run({ platform: "reddit", windowStart: oneHourAgo });
      
      const limit = queries.rateLimit.check.get("reddit", new Date().toISOString()) as any;
      expect(limit.request_count).toBe(0);
    });
  });
});