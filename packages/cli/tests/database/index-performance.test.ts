import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { DATABASE_SCHEMA, DATABASE_INDEXES } from "../../src/database/schema.js";

describe("Index Performance Tests", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");

    // Create all tables
    for (const [tableName, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
      db.exec(tableSchema);
    }

    // Create all indexes
    for (const indexSql of DATABASE_INDEXES) {
      db.exec(indexSql);
    }
  });

  afterEach(() => {
    db.close();
  });

  describe("Compound Index Verification", () => {
    it("should have compound indexes for time-range + platform queries", () => {
      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND (
            name LIKE '%platform_created%' OR
            name LIKE '%platform_date%' OR
            name LIKE '%platform_bucket%'
          )`
        )
        .all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);

      // Verify compound indexes exist
      expect(indexNames).toContain('idx_posts_platform_created');
      expect(indexNames).toContain('idx_comments_platform_created');
      expect(indexNames).toContain('idx_time_series_hourly_platform_bucket');
      expect(indexNames).toContain('idx_time_series_daily_platform_date');
      expect(indexNames).toContain('idx_keyword_trends_platform_date');
    });

    it("should have compound indexes for trend metrics", () => {
      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%trend_metrics%'`
        )
        .all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);

      expect(indexNames).toContain('idx_trend_metrics_platform_time');
      expect(indexNames).toContain('idx_trend_metrics_platform_type_time');
      expect(indexNames).toContain('idx_trend_metrics_type_name_window');
    });

    it("should have compound indexes for user influence queries", () => {
      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%user_influence%'`
        )
        .all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);

      expect(indexNames).toContain('idx_user_influence_platform_date');
      expect(indexNames).toContain('idx_user_influence_platform_score');
      expect(indexNames).toContain('idx_user_influence_user_platform_date');
    });

    it("should have compound indexes for keyword trend analysis", () => {
      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%keyword_trends%'`
        )
        .all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);

      expect(indexNames).toContain('idx_keyword_trends_keyword_platform_date');
      expect(indexNames).toContain('idx_keyword_trends_platform_score');
    });
  });

  describe("Query Performance with Indexes", () => {
    beforeEach(() => {
      // Insert test data
      const insertPost = db.prepare(`
        INSERT INTO posts (id, platform, platform_id, title, content, author, author_id, url, score, comment_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        insertPost.run(
          `post_${i}`,
          i % 2 === 0 ? 'reddit' : 'hackernews',
          `platform_${i}`,
          `Title ${i}`,
          `Content ${i}`,
          `author_${i % 10}`,
          `author_id_${i % 10}`,
          `https://example.com/${i}`,
          Math.floor(Math.random() * 1000),
          Math.floor(Math.random() * 100),
          now - (i * 3600000) // Each post 1 hour apart
        );
      }

      // Insert trend metrics
      const insertMetric = db.prepare(`
        INSERT INTO trend_metrics (platform, metric_type, metric_name, metric_value, time_window, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < 50; i++) {
        insertMetric.run(
          i % 2 === 0 ? 'reddit' : 'hackernews',
          'engagement',
          `metric_${i % 5}`,
          Math.random() * 100,
          i % 3 === 0 ? 'hourly' : 'daily',
          now - (i * 3600000)
        );
      }
    });

    it("should efficiently query posts by platform and time range", () => {
      const query = db.prepare(`
        SELECT * FROM posts
        WHERE platform = ? AND created_at > ?
        ORDER BY created_at DESC
        LIMIT 10
      `);

      const now = Date.now();
      const dayAgo = now - (24 * 3600000);

      const results = query.all('reddit', dayAgo);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it("should efficiently query trend metrics by platform and type", () => {
      const query = db.prepare(`
        SELECT * FROM trend_metrics
        WHERE platform = ? AND metric_type = ? AND calculated_at > ?
        ORDER BY calculated_at DESC
      `);

      const now = Date.now();
      const weekAgo = now - (7 * 24 * 3600000);

      const results = query.all('reddit', 'engagement', weekAgo);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    it("should use EXPLAIN QUERY PLAN to verify index usage", () => {
      const explainResult = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM posts
        WHERE platform = 'reddit' AND created_at > 1000000000000
        ORDER BY created_at DESC
      `).all() as any[];

      // Verify that an index is being used (not a full table scan)
      const planText = explainResult.map(r => r.detail).join(' ');
      expect(planText).toMatch(/USING.*INDEX/i);
    });

    it("should use compound index for time series queries", () => {
      // Insert time series data
      const insertHourly = db.prepare(`
        INSERT INTO time_series_hourly (platform, hour_bucket, posts_count, avg_score)
        VALUES (?, ?, ?, ?)
      `);

      const now = Date.now();
      const hourBucket = Math.floor(now / (1000 * 60 * 60)) * (1000 * 60 * 60);

      for (let i = 0; i < 24; i++) {
        insertHourly.run('reddit', hourBucket - (i * 3600000), 10 + i, 100 + i);
      }

      const explainResult = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM time_series_hourly
        WHERE platform = 'reddit' AND hour_bucket > ?
        ORDER BY hour_bucket DESC
      `).all(hourBucket - (24 * 3600000)) as any[];

      const planText = explainResult.map(r => r.detail).join(' ');
      expect(planText).toMatch(/USING.*INDEX.*platform_bucket/i);
    });
  });
});