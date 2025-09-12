import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { DatabaseAnalytics } from "../../src/database/analytics.js";
import { DatabaseManager } from "../../src/database/database.js";
import { DATABASE_SCHEMA, DATABASE_INDEXES } from "../../src/database/schema.js";
import type { ForumPost, Comment, User } from "../../src/types/core.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("DatabaseAnalytics", () => {
  let db: Database.Database;
  let analytics: DatabaseAnalytics;
  let dbManager: DatabaseManager;
  let tempDir: string;
  let dbPath: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fscrape-test-"));
    dbPath = join(tempDir, "test.db");
  });

  beforeEach(() => {
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
    
    // Create tables
    for (const [, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
      db.exec(tableSchema as string);
    }
    
    // Create indexes
    for (const indexSql of DATABASE_INDEXES) {
      db.exec(indexSql);
    }
    
    dbManager = new DatabaseManager(db);
    analytics = new DatabaseAnalytics(db);
  });

  afterEach(() => {
    // Clean up database between tests
    if (db) {
      db.exec(`
        DELETE FROM comments;
        DELETE FROM posts;
        DELETE FROM users;
        DELETE FROM scrape_sessions;
        DELETE FROM rate_limit_state;
      `);
      db.close();
    }
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function seedTestData() {
    // Clear any existing data first
    db.exec(`
      DELETE FROM comments;
      DELETE FROM posts;
      DELETE FROM users;
    `);
    // Create posts with different scores and dates
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 23 hours ago to be within 24 hour window
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const posts: ForumPost[] = [
      {
        id: "reddit1",
        title: "High Score Recent Reddit",
        content: "Content",
        author: "user1",
        authorId: "u1",
        url: "https://reddit.com/1",
        score: 500,
        commentCount: 50,
        createdAt: now,
        platform: "reddit",
        metadata: { subreddit: "programming" },
      },
      {
        id: "reddit2",
        title: "Medium Score Reddit",
        content: "Content",
        author: "user2",
        authorId: "u2",
        url: "https://reddit.com/2",
        score: 100,
        commentCount: 10,
        createdAt: oneDayAgo,
        platform: "reddit",
        metadata: { subreddit: "technology" },
      },
      {
        id: "reddit3",
        title: "Old Reddit Post",
        content: "Content",
        author: "user1",
        authorId: "u1",
        url: "https://reddit.com/3",
        score: 50,
        commentCount: 5,
        createdAt: oneWeekAgo,
        platform: "reddit",
      },
      {
        id: "hn1",
        title: "High Score HN",
        content: "Content",
        author: "hnuser1",
        authorId: "hnu1",
        url: "https://news.ycombinator.com/1",
        score: 300,
        commentCount: 30,
        createdAt: now,
        platform: "hackernews",
      },
      {
        id: "hn2",
        title: "Recent HN Post", 
        content: "Content",
        author: "hnuser2",
        authorId: "hnu2",
        url: "https://news.ycombinator.com/2",
        score: 150,
        commentCount: 15,
        createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
        platform: "hackernews",
      },
    ];

    const users: User[] = [
      {
        id: "u1",
        username: "user1",
        karma: 1000,
        createdAt: oneWeekAgo,
        platform: "reddit",
      },
      {
        id: "u2",
        username: "user2",
        karma: 500,
        createdAt: oneDayAgo,
        platform: "reddit",
      },
      {
        id: "hnu1",
        username: "hnuser1",
        karma: 2000,
        createdAt: oneWeekAgo,
        platform: "hackernews",
      },
      {
        id: "hnu2",
        username: "hnuser2",
        karma: 100,
        createdAt: twoDaysAgo,
        platform: "hackernews",
      },
    ];

    const comments: Comment[] = [
      {
        id: "c1",
        postId: "reddit1",
        parentId: null,
        author: "user2",
        authorId: "u2",
        content: "Great post!",
        score: 10,
        createdAt: now,
        depth: 0,
        platform: "reddit",
      },
      {
        id: "c2",
        postId: "reddit1",
        parentId: "c1",
        author: "user1",
        authorId: "u1",
        content: "Thanks!",
        score: 5,
        createdAt: now,
        depth: 1,
        platform: "reddit",
      },
      {
        id: "c3",
        postId: "hn1",
        parentId: null,
        author: "hnuser2",
        authorId: "hnu2",
        content: "Interesting perspective",
        score: 15,
        createdAt: now,
        depth: 0,
        platform: "hackernews",
      },
    ];

    // Insert data in order: users, posts, then comments (respects foreign keys)
    await dbManager.bulkUpsertUsers(users);
    await dbManager.bulkUpsertPosts(posts);
    await dbManager.bulkUpsertComments(comments);
  }

  describe("Platform Statistics", () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it("should get platform statistics", async () => {
      const stats = await analytics.getPlatformStatistics();
      
      expect(stats).toHaveLength(2);
      
      const redditStats = stats.find(s => s.platform === "reddit");
      expect(redditStats).toBeDefined();
      expect(redditStats?.totalPosts).toBe(3);
      expect(redditStats?.totalComments).toBe(2);
      expect(redditStats?.totalUsers).toBe(2);
      expect(redditStats?.avgScore).toBeCloseTo(216.67, 1);
      expect(redditStats?.avgCommentCount).toBeCloseTo(21.67, 1);
      
      const hnStats = stats.find(s => s.platform === "hackernews");
      expect(hnStats).toBeDefined();
      expect(hnStats?.totalPosts).toBe(2);
      expect(hnStats?.totalComments).toBe(1);
      expect(hnStats?.totalUsers).toBe(2);
      expect(hnStats?.avgScore).toBe(225);
    });

    it("should get statistics for specific platform", async () => {
      const redditStats = await analytics.getPlatformStatistics("reddit");
      
      expect(redditStats).toHaveLength(1);
      expect(redditStats[0].platform).toBe("reddit");
      expect(redditStats[0].totalPosts).toBe(3);
    });
  });

  describe("Trending Posts", () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it("should get trending posts across all platforms", async () => {
      const trending = await analytics.getTrendingPosts(3);
      
      expect(trending).toHaveLength(3);
      expect(trending[0].score).toBeGreaterThanOrEqual(trending[1].score);
      expect(trending[1].score).toBeGreaterThanOrEqual(trending[2].score);
    });

    it("should get trending posts for specific platform", async () => {
      const redditTrending = await analytics.getTrendingPosts(2, "reddit");
      
      expect(redditTrending).toHaveLength(2);
      expect(redditTrending.every(p => p.platform === "reddit")).toBe(true);
      expect(redditTrending[0].id).toBe("reddit1");
      expect(redditTrending[1].id).toBe("reddit2");
    });

    it("should get trending posts within time window", async () => {
      const recentDate = new Date(Date.now() - 36 * 60 * 60 * 1000); // 36 hours ago
      const recentTrending = await analytics.getTrendingPosts(10, undefined, recentDate);
      
      // Should exclude posts older than 36 hours
      expect(recentTrending.every(p => new Date(p.createdAt) >= recentDate)).toBe(true);
    });
  });

  describe("User Activity", () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it("should get top users by karma", async () => {
      const topUsers = await analytics.getTopUsersByKarma(3);
      
      expect(topUsers).toHaveLength(3);
      expect(topUsers[0].karma).toBe(2000);
      expect(topUsers[1].karma).toBe(1000);
      expect(topUsers[2].karma).toBe(500);
    });

    it("should get top users for specific platform", async () => {
      const redditUsers = await analytics.getTopUsersByKarma(2, "reddit");
      
      expect(redditUsers).toHaveLength(2);
      expect(redditUsers.every(u => u.platform === "reddit")).toBe(true);
      expect(redditUsers[0].username).toBe("user1");
      expect(redditUsers[1].username).toBe("user2");
    });

    it("should get user activity stats", async () => {
      const activity = await analytics.getUserActivity("u1");
      
      expect(activity.userId).toBe("u1");
      expect(activity.postCount).toBe(2);
      expect(activity.commentCount).toBe(1);
      expect(activity.avgPostScore).toBe(275); // (500 + 50) / 2
      expect(activity.avgCommentScore).toBe(5);
      expect(activity.totalEngagement).toBe(3);
    });

    it("should handle user with no activity", async () => {
      // Create user with no posts or comments
      await dbManager.upsertUser({
        id: "inactive",
        username: "inactive_user",
        karma: 0,
        createdAt: new Date(),
        platform: "reddit",
      });
      
      const activity = await analytics.getUserActivity("inactive");
      
      expect(activity.userId).toBe("inactive");
      expect(activity.postCount).toBe(0);
      expect(activity.commentCount).toBe(0);
      expect(activity.avgPostScore).toBe(0);
      expect(activity.avgCommentScore).toBe(0);
      expect(activity.totalEngagement).toBe(0);
    });
  });

  describe("Time Series Analysis", () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it("should get posts by date range", async () => {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const recentPosts = await analytics.getPostsByDateRange(twoDaysAgo, tomorrow);
      
      // Should include posts from last 2 days
      expect(recentPosts.length).toBeGreaterThan(0);
      
      // The database returns created_at (snake_case) not createdAt (camelCase)
      expect(recentPosts.every(p => p.created_at >= twoDaysAgo.getTime())).toBe(true);
    });

    it("should get posts by date range for specific platform", async () => {
      // Use slightly more than 7 days to ensure we capture posts created exactly 7 days ago
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000); // Add 1 second buffer
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const redditPosts = await analytics.getPostsByDateRange(
        oneWeekAgo,
        tomorrow,
        "reddit"
      );
      
      expect(redditPosts.every(p => p.platform === "reddit")).toBe(true);
      expect(redditPosts).toHaveLength(3);
    });

    it("should get engagement over time", async () => {
      const engagement = await analytics.getEngagementOverTime(7);
      
      expect(engagement).toBeDefined();
      expect(engagement.length).toBeGreaterThan(0);
      
      // Check structure
      engagement.forEach(day => {
        expect(day).toHaveProperty("date");
        expect(day).toHaveProperty("platform");
        expect(day).toHaveProperty("posts");  // The query returns 'posts' not 'postCount'
        expect(day).toHaveProperty("totalComments");  // Adjust these based on actual query
        expect(day).toHaveProperty("avgScore");
      });
    });

    it("should get engagement over time for specific platform", async () => {
      const redditEngagement = await analytics.getEngagementOverTime(7, "reddit");
      
      expect(redditEngagement.every(e => e.platform === "reddit")).toBe(true);
    });
  });

  describe("Content Analysis", () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it("should get most engaged posts", async () => {
      const engaged = await analytics.getMostEngagedPosts(2);
      
      expect(engaged).toHaveLength(2);
      // First post should have higher engagement (score + comments)
      expect(engaged[0].id).toBe("reddit1"); // 500 score + 50 comments = 550
      expect(engaged[1].id).toBe("hn1"); // 300 score + 30 comments = 330
    });

    it("should get most discussed posts", async () => {
      const discussed = await analytics.getMostDiscussedPosts(2);
      
      expect(discussed).toHaveLength(2);
      expect(discussed[0].commentCount).toBeGreaterThanOrEqual(discussed[1].commentCount);
    });

    it("should get posts with high comment-to-score ratio", async () => {
      // Add a post with high comment ratio
      await dbManager.upsertPost({
        id: "high-ratio",
        title: "Controversial Post",
        content: "Content",
        author: "user3",
        url: "https://reddit.com/high-ratio",
        score: 10,
        commentCount: 100,
        createdAt: new Date(),
        platform: "reddit",
      });
      
      const highRatio = await analytics.getPostsWithHighCommentRatio(1);
      
      expect(highRatio).toHaveLength(1);
      expect(highRatio[0].id).toBe("high-ratio");
    });
  });

  describe("Database Health Metrics", () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it("should get database health metrics", async () => {
      const health = await analytics.getDatabaseHealth();
      
      expect(health.totalPosts).toBe(5);
      expect(health.totalComments).toBe(3);
      expect(health.totalUsers).toBe(4);
      expect(health.databaseSize).toBeGreaterThan(0);
      expect(health.oldestPost).toBeDefined();
      expect(health.newestPost).toBeDefined();
      expect(health.avgPostsPerDay).toBeGreaterThan(0);
      expect(health.avgCommentsPerPost).toBeCloseTo(0.6, 1);
    });

    it("should calculate database size correctly", async () => {
      const health = await analytics.getDatabaseHealth();
      
      // Database should have some size after inserting data
      expect(health.databaseSize).toBeGreaterThan(0);
      expect(typeof health.databaseSize).toBe("number");
    });

    it("should identify data gaps", async () => {
      const gaps = await analytics.getDataGaps(1); // 1 day threshold
      
      // Should identify gaps between posts
      expect(Array.isArray(gaps)).toBe(true);
      
      gaps.forEach(gap => {
        expect(gap).toHaveProperty("platform");
        expect(gap).toHaveProperty("startDate");
        expect(gap).toHaveProperty("endDate");
        expect(gap).toHaveProperty("gapDays");
        expect(gap.gapDays).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Session Analytics", () => {
    it("should analyze session performance", async () => {
      // Create test sessions
      const session1 = await dbManager.createSession({
        platform: "reddit",
        query: "typescript",
      });
      
      await dbManager.updateSession(session1, {
        status: "completed",
        totalPosts: 50,
        totalComments: 200,
        totalUsers: 30,
      });
      
      const session2 = await dbManager.createSession({
        platform: "hackernews",
      });
      
      await dbManager.updateSession(session2, {
        status: "completed",
        totalPosts: 25,
        totalComments: 100,
        totalUsers: 20,
      });
      
      const performance = await analytics.getSessionPerformance();
      
      expect(performance).toHaveLength(2);
      // The order depends on which session was created first
      // Since they're created sequentially, session1 starts first, but ORDER BY started_at DESC means latest first
      // So session2 (created second) should be first in the results
      const totals = performance.map((p: any) => p.totalItems).sort((a: number, b: number) => a - b);
      expect(totals).toEqual([145, 280]);
    });

    it("should get successful session rate", async () => {
      // Create mix of successful and failed sessions
      const s1 = await dbManager.createSession({ platform: "reddit" });
      await dbManager.updateSession(s1, { status: "completed" });
      
      const s2 = await dbManager.createSession({ platform: "reddit" });
      await dbManager.updateSession(s2, { status: "failed", errorMessage: "Rate limited" });
      
      const s3 = await dbManager.createSession({ platform: "hackernews" });
      await dbManager.updateSession(s3, { status: "completed" });
      
      const rate = await analytics.getSuccessfulSessionRate();
      
      expect(rate).toBeCloseTo(0.667, 2); // 2 out of 3 successful
    });
  });

  describe("Aggregation Functions", () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it("should aggregate metrics by subreddit", async () => {
      const subredditStats = db
        .prepare(`
          SELECT 
            json_extract(metadata, '$.subreddit') as subreddit,
            COUNT(*) as post_count,
            AVG(score) as avg_score
          FROM posts
          WHERE platform = 'reddit' 
            AND json_extract(metadata, '$.subreddit') IS NOT NULL
          GROUP BY json_extract(metadata, '$.subreddit')
        `)
        .all() as any[];
      
      expect(subredditStats).toHaveLength(2);
      
      const programming = subredditStats.find(s => s.subreddit === "programming");
      expect(programming).toBeDefined();
      expect(programming.post_count).toBe(1);
      expect(programming.avg_score).toBe(500);
    });

    it("should calculate engagement rate", async () => {
      const engagementRates = db
        .prepare(`
          SELECT 
            id,
            title,
            score,
            comment_count,
            CAST(comment_count AS REAL) / NULLIF(score, 0) as engagement_rate
          FROM posts
          WHERE score > 0
          ORDER BY engagement_rate DESC
        `)
        .all() as any[];
      
      expect(engagementRates.length).toBeGreaterThan(0);
      
      engagementRates.forEach(post => {
        expect(post.engagement_rate).toBeDefined();
        expect(post.engagement_rate).toBe(post.comment_count / post.score);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle empty database gracefully", async () => {
      // Fresh database with no data
      const emptyDb = new Database(":memory:");
      
      // Create tables
      for (const [, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
        emptyDb.exec(tableSchema as string);
      }
      
      const emptyAnalytics = new DatabaseAnalytics(emptyDb);
      
      const stats = await emptyAnalytics.getPlatformStatistics();
      expect(stats).toEqual([]);
      
      const trending = await emptyAnalytics.getTrendingPosts(10);
      expect(trending).toEqual([]);
      
      const health = await emptyAnalytics.getDatabaseHealth();
      expect(health.totalPosts).toBe(0);
      expect(health.totalComments).toBe(0);
      expect(health.totalUsers).toBe(0);
      
      emptyDb.close();
    });

    it("should handle invalid user ID gracefully", async () => {
      const activity = await analytics.getUserActivity("non-existent-user");
      
      expect(activity.userId).toBe("non-existent-user");
      expect(activity.postCount).toBe(0);
      expect(activity.commentCount).toBe(0);
      expect(activity.avgPostScore).toBe(0);
      expect(activity.avgCommentScore).toBe(0);
    });

    it("should handle invalid date ranges", async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const moreFutureDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000);
      
      const posts = await analytics.getPostsByDateRange(futureDate, moreFutureDate);
      expect(posts).toEqual([]);
    });
  });
});