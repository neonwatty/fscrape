import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { DatabaseAnalytics } from "../../src/database/analytics.js";
import { MATERIALIZED_VIEWS, MATERIALIZED_VIEW_INDEXES } from "../../src/database/schema.js";
import { initializeDatabase } from "../../src/database/migrations.js";

describe("Materialized Views", () => {
  let db: Database.Database;
  let analytics: DatabaseAnalytics;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(":memory:");

    // Initialize database with schema and migrations
    await initializeDatabase(db);

    // Create analytics instance
    analytics = new DatabaseAnalytics(db);

    // Seed test data
    seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  function seedTestData(db: Database.Database) {
    const now = Date.now();
    const insertPost = db.prepare(`
      INSERT INTO posts (id, platform, platform_id, title, content, author, author_id, url, score, comment_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertComment = db.prepare(`
      INSERT INTO comments (id, post_id, platform, platform_id, author, author_id, content, score, created_at, depth)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUser = db.prepare(`
      INSERT INTO users (id, platform, username, karma, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Create users
    insertUser.run("user1", "reddit", "testuser1", 1000, now - 30 * 24 * 60 * 60 * 1000);
    insertUser.run("user2", "reddit", "testuser2", 500, now - 20 * 24 * 60 * 60 * 1000);
    insertUser.run("user3", "hackernews", "testuser3", 2000, now - 25 * 24 * 60 * 60 * 1000);

    // Create posts across different days and platforms
    for (let day = 0; day < 30; day++) {
      const dayTimestamp = now - (day * 24 * 60 * 60 * 1000);

      // Reddit posts
      for (let i = 0; i < 5; i++) {
        const postId = `reddit_post_${day}_${i}`;
        const score = Math.floor(Math.random() * 500) + 50;
        const comments = Math.floor(Math.random() * 100);
        insertPost.run(
          postId,
          "reddit",
          `r_${postId}`,
          `Reddit Post ${day}-${i}`,
          `Content for post ${day}-${i}`,
          "testuser1",
          "user1",
          `https://reddit.com/post/${postId}`,
          score,
          comments,
          dayTimestamp + (i * 3600000)
        );

        // Add some comments
        for (let c = 0; c < 3; c++) {
          insertComment.run(
            `${postId}_comment_${c}`,
            postId,
            "reddit",
            `rc_${postId}_${c}`,
            "testuser2",
            "user2",
            `Comment ${c} on post ${postId}`,
            Math.floor(Math.random() * 50),
            dayTimestamp + (i * 3600000) + (c * 600000),
            0
          );
        }
      }

      // HackerNews posts
      for (let i = 0; i < 3; i++) {
        const postId = `hn_post_${day}_${i}`;
        const score = Math.floor(Math.random() * 300) + 30;
        const comments = Math.floor(Math.random() * 50);
        insertPost.run(
          postId,
          "hackernews",
          `hn_${postId}`,
          `HN Post ${day}-${i}`,
          `Content for post ${day}-${i}`,
          "testuser3",
          "user3",
          `https://news.ycombinator.com/item?id=${postId}`,
          score,
          comments,
          dayTimestamp + (i * 3600000)
        );
      }
    }
  }

  describe("Daily Aggregations", () => {
    it("should refresh daily aggregations", () => {
      analytics.refreshDailyAggregations(30);

      const result = db.prepare(`
        SELECT COUNT(*) as count FROM mv_daily_aggregations
      `).get() as any;

      expect(result.count).toBeGreaterThan(0);
    });

    it("should calculate correct daily metrics", () => {
      analytics.refreshDailyAggregations(30);

      const result = db.prepare(`
        SELECT * FROM mv_daily_aggregations
        WHERE platform = 'reddit'
        ORDER BY date DESC
        LIMIT 1
      `).get() as any;

      expect(result).toBeDefined();
      expect(result.posts_count).toBeGreaterThan(0);
      expect(result.platform).toBe('reddit');
      expect(result.avg_post_score).toBeGreaterThan(0);
    });

    it("should identify top post and author", () => {
      analytics.refreshDailyAggregations(30);

      const result = db.prepare(`
        SELECT top_post_id, top_author FROM mv_daily_aggregations
        WHERE platform = 'reddit' AND top_post_id IS NOT NULL
        LIMIT 1
      `).get() as any;

      expect(result).toBeDefined();
      expect(result.top_post_id).toBeTruthy();
      expect(result.top_author).toBeTruthy();
    });
  });

  describe("Hourly Aggregations", () => {
    it("should refresh hourly aggregations", () => {
      analytics.refreshHourlyAggregations(168);

      const result = db.prepare(`
        SELECT COUNT(*) as count FROM mv_hourly_aggregations
      `).get() as any;

      expect(result.count).toBeGreaterThan(0);
    });

    it("should calculate velocity metrics", () => {
      analytics.refreshHourlyAggregations(168);

      const result = db.prepare(`
        SELECT * FROM mv_hourly_aggregations
        WHERE platform = 'reddit' AND posts_count > 0
        ORDER BY hour_bucket DESC
        LIMIT 1
      `).get() as any;

      expect(result).toBeDefined();
      expect(result.posts_velocity).toBeDefined();
      expect(result.comments_velocity).toBeDefined();
    });
  });

  describe("User Engagement Scores", () => {
    it("should refresh user engagement scores", () => {
      analytics.refreshUserEngagementScores();

      const result = db.prepare(`
        SELECT COUNT(*) as count FROM mv_user_engagement_scores
      `).get() as any;

      expect(result.count).toBeGreaterThan(0);
    });

    it("should calculate influence scores", () => {
      analytics.refreshUserEngagementScores();

      const result = db.prepare(`
        SELECT * FROM mv_user_engagement_scores
        WHERE username = 'testuser1'
      `).get() as any;

      expect(result).toBeDefined();
      expect(result.influence_score).toBeGreaterThan(0);
      expect(result.activity_percentile).toBeDefined();
      expect(result.score_percentile).toBeDefined();
    });

    it("should calculate consistency scores", () => {
      analytics.refreshUserEngagementScores();

      const result = db.prepare(`
        SELECT consistency_score FROM mv_user_engagement_scores
        WHERE total_posts > 0
        LIMIT 1
      `).get() as any;

      expect(result).toBeDefined();
      expect(result.consistency_score).toBeDefined();
    });
  });

  describe("Trending Content", () => {
    it("should refresh trending content", () => {
      analytics.refreshTrendingContent(48);

      const result = db.prepare(`
        SELECT COUNT(*) as count FROM mv_trending_content
      `).get() as any;

      expect(result.count).toBeGreaterThan(0);
    });

    it("should calculate hotness scores", () => {
      analytics.refreshTrendingContent(48);

      const result = db.prepare(`
        SELECT * FROM mv_trending_content
        ORDER BY hotness_score DESC
        LIMIT 1
      `).get() as any;

      expect(result).toBeDefined();
      expect(result.hotness_score).toBeGreaterThan(0);
      expect(result.velocity_score).toBeDefined();
      expect(result.age_hours).toBeGreaterThan(0);
    });

    it("should rank content correctly", () => {
      analytics.refreshTrendingContent(48);

      const results = db.prepare(`
        SELECT rank_overall, rank_platform FROM mv_trending_content
        WHERE rank_overall IS NOT NULL
        ORDER BY rank_overall
        LIMIT 10
      `).all() as any[];

      expect(results.length).toBeGreaterThan(0);

      // Check that ranks are sequential
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].rank_overall).toBeLessThanOrEqual(results[i + 1].rank_overall);
      }
    });
  });

  describe("Refresh All Views", () => {
    it("should refresh all materialized views", () => {
      analytics.refreshAllMaterializedViews();

      const views = [
        'mv_daily_aggregations',
        'mv_hourly_aggregations',
        'mv_user_engagement_scores',
        'mv_trending_content'
      ];

      for (const view of views) {
        const result = db.prepare(`SELECT COUNT(*) as count FROM ${view}`).get() as any;
        expect(result.count).toBeGreaterThan(0);
      }
    });
  });

  describe("View Status", () => {
    it("should get materialized view status", () => {
      analytics.refreshAllMaterializedViews();

      const status = analytics.getMaterializedViewStatus();

      expect(status).toBeDefined();
      expect(status.length).toBeGreaterThan(0);

      const dailyStatus = status.find(s => s.viewName === 'mv_daily_aggregations');
      expect(dailyStatus).toBeDefined();
      expect(dailyStatus?.rowCount).toBeGreaterThan(0);
      expect(dailyStatus?.lastRefreshed).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("should refresh views within reasonable time", () => {
      const startTime = Date.now();
      analytics.refreshAllMaterializedViews();
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds for test data
      expect(duration).toBeLessThan(5000);
    });

    it("should handle large datasets efficiently", () => {
      // Add more test data
      const insertPost = db.prepare(`
        INSERT INTO posts (id, platform, platform_id, title, content, author, author_id, url, score, comment_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      for (let i = 0; i < 1000; i++) {
        insertPost.run(
          `bulk_post_${i}`,
          "reddit",
          `r_bulk_${i}`,
          `Bulk Post ${i}`,
          `Content ${i}`,
          "bulkuser",
          "bulk_user_id",
          `https://reddit.com/bulk/${i}`,
          Math.floor(Math.random() * 1000),
          Math.floor(Math.random() * 200),
          now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
        );
      }

      const startTime = Date.now();
      analytics.refreshDailyAggregations(30);
      const duration = Date.now() - startTime;

      // Should still be reasonably fast
      expect(duration).toBeLessThan(3000);
    });
  });
});