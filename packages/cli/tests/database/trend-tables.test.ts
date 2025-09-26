import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { MigrationManager } from "../../src/database/migrations.js";
import { DATABASE_SCHEMA, DATABASE_INDEXES } from "../../src/database/schema.js";

describe("Trend Analysis Tables", () => {
  let db: Database.Database;
  let migrationManager: MigrationManager;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(":memory:");
    migrationManager = new MigrationManager(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("Schema Validation", () => {
    it("should create all trend analysis tables", () => {
      // Create tables using schema definitions
      for (const [tableName, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
        db.exec(tableSchema);
      }

      // Create indexes
      for (const indexSql of DATABASE_INDEXES) {
        db.exec(indexSql);
      }

      // Verify tables exist
      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name IN (
            'trend_metrics', 'time_series_hourly', 'time_series_daily',
            'keyword_trends', 'user_influence_scores'
          )`
        )
        .all() as { name: string }[];

      expect(tables).toHaveLength(5);
      expect(tables.map(t => t.name).sort()).toEqual([
        'keyword_trends',
        'time_series_daily',
        'time_series_hourly',
        'trend_metrics',
        'user_influence_scores'
      ]);
    });

    it("should have correct columns in trend_metrics table", () => {
      db.exec(DATABASE_SCHEMA.trend_metrics);

      const columns = db
        .prepare("PRAGMA table_info(trend_metrics)")
        .all() as any[];

      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('platform');
      expect(columnNames).toContain('metric_type');
      expect(columnNames).toContain('metric_name');
      expect(columnNames).toContain('metric_value');
      expect(columnNames).toContain('time_window');
      expect(columnNames).toContain('calculated_at');
      expect(columnNames).toContain('metadata');
    });

    it("should have correct columns in time_series_hourly table", () => {
      db.exec(DATABASE_SCHEMA.time_series_hourly);

      const columns = db
        .prepare("PRAGMA table_info(time_series_hourly)")
        .all() as any[];

      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('platform');
      expect(columnNames).toContain('hour_bucket');
      expect(columnNames).toContain('posts_count');
      expect(columnNames).toContain('comments_count');
      expect(columnNames).toContain('avg_score');
      expect(columnNames).toContain('engagement_rate');
    });

    it("should have correct columns in keyword_trends table", () => {
      db.exec(DATABASE_SCHEMA.keyword_trends);

      const columns = db
        .prepare("PRAGMA table_info(keyword_trends)")
        .all() as any[];

      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('keyword');
      expect(columnNames).toContain('platform');
      expect(columnNames).toContain('date');
      expect(columnNames).toContain('frequency');
      expect(columnNames).toContain('trending_score');
    });

    it("should have correct columns in user_influence_scores table", () => {
      db.exec(DATABASE_SCHEMA.user_influence_scores);

      const columns = db
        .prepare("PRAGMA table_info(user_influence_scores)")
        .all() as any[];

      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('platform');
      expect(columnNames).toContain('calculation_date');
      expect(columnNames).toContain('influence_score');
      expect(columnNames).toContain('percentile_rank');
    });
  });

  describe("Data Integrity", () => {
    beforeEach(() => {
      // Create all tables
      for (const [tableName, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
        db.exec(tableSchema);
      }
    });

    it("should insert and retrieve data from trend_metrics", () => {
      const stmt = db.prepare(`
        INSERT INTO trend_metrics (platform, metric_type, metric_name, metric_value, time_window, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run('reddit', 'engagement', 'avg_comment_ratio', 0.75, 'daily', Date.now());

      const result = db.prepare("SELECT * FROM trend_metrics").get() as any;
      expect(result).toBeDefined();
      expect(result.platform).toBe('reddit');
      expect(result.metric_type).toBe('engagement');
      expect(result.metric_value).toBe(0.75);
    });

    it("should insert and retrieve data from time_series_hourly", () => {
      const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60);

      const stmt = db.prepare(`
        INSERT INTO time_series_hourly (platform, hour_bucket, posts_count, avg_score)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run('hackernews', hourBucket, 42, 156.5);

      const result = db.prepare("SELECT * FROM time_series_hourly").get() as any;
      expect(result).toBeDefined();
      expect(result.platform).toBe('hackernews');
      expect(result.posts_count).toBe(42);
      expect(result.avg_score).toBe(156.5);
    });

    it("should enforce unique constraints on keyword_trends", () => {
      const stmt = db.prepare(`
        INSERT INTO keyword_trends (keyword, platform, date, frequency)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run('javascript', 'reddit', '2025-01-01', 100);

      // Should throw error on duplicate
      expect(() => {
        stmt.run('javascript', 'reddit', '2025-01-01', 200);
      }).toThrow();
    });

    it("should enforce primary key constraints on user_influence_scores", () => {
      const stmt = db.prepare(`
        INSERT INTO user_influence_scores (user_id, platform, calculation_date, influence_score)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run('user123', 'reddit', '2025-01-01', 85.5);

      // Should throw error on duplicate primary key
      expect(() => {
        stmt.run('user123', 'reddit', '2025-01-01', 90.0);
      }).toThrow();
    });
  });

  describe("Index Performance", () => {
    beforeEach(() => {
      // Create all tables and indexes
      for (const [tableName, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
        db.exec(tableSchema);
      }
      for (const indexSql of DATABASE_INDEXES) {
        db.exec(indexSql);
      }
    });

    it("should have indexes on trend analysis tables", () => {
      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%trend%' OR name LIKE 'idx_%influence%' OR name LIKE 'idx_time_series%'`
        )
        .all() as { name: string }[];

      // Verify key indexes exist
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('idx_trend_metrics_platform');
      expect(indexNames).toContain('idx_keyword_trends_keyword');
      expect(indexNames).toContain('idx_user_influence_score');
      expect(indexNames).toContain('idx_time_series_hourly_platform');
      expect(indexNames).toContain('idx_time_series_daily_date');
    });
  });
});