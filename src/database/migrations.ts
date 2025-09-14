import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import winston from "winston";
import {
  DATABASE_SCHEMA,
  DATABASE_INDEXES,
  DATABASE_TRIGGERS,
} from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export class MigrationManager {
  private db: Database.Database;
  private logger: winston.Logger;

  constructor(db: Database.Database, logger?: winston.Logger) {
    this.db = db;
    this.logger =
      logger ||
      winston.createLogger({
        level: "info",
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      });

    this.initMigrationsTable();
  }

  private initMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        checksum TEXT
      )
    `);
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    const row = this.db
      .prepare("SELECT MAX(version) as version FROM schema_migrations")
      .get() as { version: number | null };
    return row?.version || 0;
  }

  /**
   * Check if a migration has been applied
   */
  isMigrationApplied(version: number): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
      .get(version);
    return !!row;
  }

  /**
   * Apply a single migration
   */
  applyMigration(migration: Migration): void {
    if (this.isMigrationApplied(migration.version)) {
      this.logger.debug(`Migration ${migration.version} already applied`);
      return;
    }

    this.logger.info(
      `Applying migration ${migration.version}: ${migration.name}`,
    );

    const transaction = this.db.transaction(() => {
      migration.up(this.db);

      this.db
        .prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)")
        .run(migration.version, migration.name);
    });

    transaction();
    this.logger.info(`Migration ${migration.version} applied successfully`);
  }

  /**
   * Rollback a migration
   */
  rollbackMigration(migration: Migration): void {
    if (!this.isMigrationApplied(migration.version)) {
      this.logger.debug(`Migration ${migration.version} not applied`);
      return;
    }

    if (!migration.down) {
      throw new Error(
        `Migration ${migration.version} does not support rollback`,
      );
    }

    this.logger.info(
      `Rolling back migration ${migration.version}: ${migration.name}`,
    );

    const transaction = this.db.transaction(() => {
      migration.down!(this.db);

      this.db
        .prepare("DELETE FROM schema_migrations WHERE version = ?")
        .run(migration.version);
    });

    transaction();
    this.logger.info(`Migration ${migration.version} rolled back successfully`);
  }

  /**
   * Run all pending migrations
   */
  runMigrations(migrations: Migration[]): void {
    const sortedMigrations = [...migrations].sort(
      (a, b) => a.version - b.version,
    );
    const currentVersion = this.getCurrentVersion();

    const pendingMigrations = sortedMigrations.filter(
      (m) => m.version > currentVersion,
    );

    if (pendingMigrations.length === 0) {
      this.logger.info("No pending migrations");
      return;
    }

    this.logger.info(`Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      this.applyMigration(migration);
    }

    this.logger.info("All migrations completed successfully");
  }

  /**
   * Run all available migrations
   */
  async runAllMigrations(): Promise<number> {
    // Load the schema first
    this.loadSchemaFromFile();

    // Get built-in migrations
    const migrations: Migration[] = this.getBuiltInMigrations();

    // Run migrations that haven't been applied
    let appliedCount = 0;
    for (const migration of migrations) {
      if (!this.isMigrationApplied(migration.version)) {
        this.applyMigration(migration);
        appliedCount++;
      }
    }

    return appliedCount;
  }

  /**
   * Get built-in migrations
   */
  private getBuiltInMigrations(): Migration[] {
    return [
      {
        version: 1,
        name: "initial_schema",
        up: (_db: Database.Database) => {
          // Initial schema is handled by loadSchemaFromFile
        },
      },
    ];
  }

  /**
   * Load and run SQL schema file
   */
  loadSchemaFromFile(schemaPath?: string): void {
    const defaultPath = path.join(__dirname, "schema.sql");
    const sqlPath = schemaPath || defaultPath;

    if (!fs.existsSync(sqlPath)) {
      this.logger.warn(`Schema file not found: ${sqlPath}`);
      return;
    }

    let sql = fs.readFileSync(sqlPath, "utf-8");

    // Remove all SQL comments
    sql = sql.replace(/--.*$/gm, "");

    // Split the SQL into individual statements
    // This regex handles CREATE TRIGGER ... END; blocks specially
    const statements: string[] = [];

    // First, extract triggers (they contain semicolons in their body)
    const triggerRegex = /CREATE\s+TRIGGER[^;]+BEGIN[\s\S]*?END;/gi;
    const triggers = sql.match(triggerRegex) || [];

    // Remove triggers from main SQL
    let mainSql = sql;
    triggers.forEach((trigger) => {
      mainSql = mainSql.replace(trigger, "");
    });

    // Split remaining SQL by semicolons
    const mainStatements = mainSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s + ";");

    // Combine all statements
    statements.push(...mainStatements, ...triggers);

    // Separate PRAGMA and other statements
    const pragmaStatements = statements.filter((s) =>
      s.toUpperCase().trim().startsWith("PRAGMA"),
    );
    const otherStatements = statements.filter(
      (s) => !s.toUpperCase().trim().startsWith("PRAGMA"),
    );

    // Execute PRAGMA statements first (outside transaction)
    for (const statement of pragmaStatements) {
      try {
        this.db.exec(statement);
      } catch (error) {
        this.logger.debug(`Pragma statement warning: ${error}`);
      }
    }

    // Execute other statements
    for (const statement of otherStatements) {
      try {
        this.db.exec(statement);
      } catch (error) {
        // Ignore errors for IF NOT EXISTS statements
        if (!statement.toUpperCase().includes("IF NOT EXISTS")) {
          this.logger.error(`Failed to execute statement: ${error}`);
          this.logger.error(`Statement: ${statement.substring(0, 200)}...`);
          throw error;
        } else {
          // Log but continue for IF NOT EXISTS
          this.logger.debug(`Ignoring error for IF NOT EXISTS: ${error}`);
        }
      }
    }

    this.logger.info("Schema loaded from file successfully");
  }
}

// Define migrations
export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: (db: Database.Database) => {
      // Load the initial schema from the schema.sql file
      // We need to manually specify the path since we're in a migration context
      const schemaPath = path.join(__dirname, "schema.sql");

      if (fs.existsSync(schemaPath)) {
        const manager = new MigrationManager(db);
        manager.loadSchemaFromFile(schemaPath);
      } else {
        // If schema.sql not found, use the schema from schema.ts
        // Create tables
        for (const [, tableSchema] of Object.entries(DATABASE_SCHEMA)) {
          db.exec(tableSchema as string);
        }

        // Create indexes
        for (const indexSql of DATABASE_INDEXES) {
          db.exec(indexSql);
        }

        // Create triggers
        for (const triggerSql of DATABASE_TRIGGERS) {
          db.exec(triggerSql);
        }
      }
    },
  },
  {
    version: 2,
    name: "add_analytics_columns",
    up: (db: Database.Database) => {
      // Add analytics columns if they don't exist
      // This is an example migration for future schema changes
      db.exec(`
        -- Add daily stats table for trend analysis
        CREATE TABLE IF NOT EXISTS daily_stats (
          date TEXT NOT NULL,
          platform TEXT NOT NULL,
          posts_count INTEGER DEFAULT 0,
          comments_count INTEGER DEFAULT 0,
          users_count INTEGER DEFAULT 0,
          avg_score REAL,
          avg_engagement REAL,
          PRIMARY KEY (date, platform)
        );
        
        CREATE INDEX IF NOT EXISTS idx_daily_stats_date 
        ON daily_stats(date DESC);
      `);
    },
    down: (db: Database.Database) => {
      db.exec("DROP TABLE IF EXISTS daily_stats");
    },
  },
  {
    version: 3,
    name: "add_user_metrics_columns",
    up: (db: Database.Database) => {
      // Add post_count and comment_count to users table if they don't exist
      try {
        const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
        const columnNames = tableInfo.map((col: any) => col.name);
        
        if (!columnNames.includes('post_count')) {
          db.exec(`ALTER TABLE users ADD COLUMN post_count INTEGER DEFAULT 0`);
          console.log('Added post_count column to users table');
        }
        
        if (!columnNames.includes('comment_count')) {
          db.exec(`ALTER TABLE users ADD COLUMN comment_count INTEGER DEFAULT 0`);
          console.log('Added comment_count column to users table');
        }
      } catch (error) {
        console.log('Note: user metrics columns might already exist');
      }
    },
    down: (db: Database.Database) => {
      // We don't remove columns in down migration to preserve data
      console.log('Preserving user metrics columns');
    },
  },
  {
    version: 4,
    name: "add_platform_id_column",
    up: (db: Database.Database) => {
      // Add platform_id column if it doesn't exist
      try {
        const tableInfo = db.prepare("PRAGMA table_info(posts)").all() as any[];
        const columnNames = tableInfo.map((col: any) => col.name);
        
        if (!columnNames.includes('platform_id')) {
          db.exec(`ALTER TABLE posts ADD COLUMN platform_id TEXT NOT NULL DEFAULT ''`);
          console.log('Added platform_id column to posts table');
        }
      } catch (error) {
        console.log('Note: platform_id column might already exist');
      }
    },
  },
  {
    version: 5,
    name: "add_content_hash_index",
    up: (db: Database.Database) => {
      // Add content hash column and index for duplicate detection
      // Note: SQLite doesn't have SHA1 built-in, so we'll use a simple approach
      try {
        // Check if column already exists
        const columnExists = db
          .prepare(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='forum_posts'",
          )
          .get() as { sql: string } | undefined;

        if (columnExists && !columnExists.sql.includes("content_hash")) {
          db.exec(`
            ALTER TABLE forum_posts 
            ADD COLUMN content_hash TEXT;
          `);
        }

        // Create index for duplicate detection
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_posts_content_hash 
          ON forum_posts(content_hash);
        `);
      } catch (_error) {
        // Column might already exist, continue
        console.log("Note: content_hash column might already exist");
      }
    },
  },
  {
    version: 6,
    name: "add_trend_analysis_tables",
    up: (db: Database.Database) => {
      // Add trend analysis tables for advanced analytics
      db.exec(`
        -- Trend metrics table for storing calculated metrics
        CREATE TABLE IF NOT EXISTS trend_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          metric_type TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          metric_value REAL NOT NULL,
          time_window TEXT NOT NULL,
          calculated_at INTEGER NOT NULL,
          metadata TEXT,
          UNIQUE(platform, metric_type, metric_name, time_window, calculated_at)
        );

        -- Time series hourly aggregation
        CREATE TABLE IF NOT EXISTS time_series_hourly (
          platform TEXT NOT NULL,
          hour_bucket INTEGER NOT NULL,
          posts_count INTEGER DEFAULT 0,
          comments_count INTEGER DEFAULT 0,
          users_count INTEGER DEFAULT 0,
          avg_score REAL DEFAULT 0,
          avg_comment_count REAL DEFAULT 0,
          total_score INTEGER DEFAULT 0,
          max_score INTEGER DEFAULT 0,
          min_score INTEGER DEFAULT 0,
          engagement_rate REAL DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          PRIMARY KEY (platform, hour_bucket)
        );

        -- Time series daily aggregation
        CREATE TABLE IF NOT EXISTS time_series_daily (
          platform TEXT NOT NULL,
          date TEXT NOT NULL,
          posts_count INTEGER DEFAULT 0,
          comments_count INTEGER DEFAULT 0,
          users_count INTEGER DEFAULT 0,
          new_users_count INTEGER DEFAULT 0,
          avg_score REAL DEFAULT 0,
          avg_comment_count REAL DEFAULT 0,
          total_score INTEGER DEFAULT 0,
          max_score INTEGER DEFAULT 0,
          min_score INTEGER DEFAULT 0,
          engagement_rate REAL DEFAULT 0,
          top_post_id TEXT,
          top_user_id TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          PRIMARY KEY (platform, date)
        );

        -- Keyword trends tracking
        CREATE TABLE IF NOT EXISTS keyword_trends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyword TEXT NOT NULL,
          platform TEXT NOT NULL,
          date TEXT NOT NULL,
          frequency INTEGER DEFAULT 0,
          posts_count INTEGER DEFAULT 0,
          comments_count INTEGER DEFAULT 0,
          avg_score REAL DEFAULT 0,
          trending_score REAL DEFAULT 0,
          first_seen_at INTEGER,
          last_seen_at INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          UNIQUE(keyword, platform, date)
        );

        -- User influence scores
        CREATE TABLE IF NOT EXISTS user_influence_scores (
          user_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          calculation_date TEXT NOT NULL,
          post_count INTEGER DEFAULT 0,
          comment_count INTEGER DEFAULT 0,
          total_karma INTEGER DEFAULT 0,
          avg_post_score REAL DEFAULT 0,
          avg_comment_score REAL DEFAULT 0,
          reply_count INTEGER DEFAULT 0,
          unique_interactions INTEGER DEFAULT 0,
          influence_score REAL DEFAULT 0,
          percentile_rank REAL DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          PRIMARY KEY (user_id, platform, calculation_date)
        );

        -- Create indexes for trend analysis tables
        CREATE INDEX IF NOT EXISTS idx_trend_metrics_platform ON trend_metrics(platform);
        CREATE INDEX IF NOT EXISTS idx_trend_metrics_type ON trend_metrics(metric_type);
        CREATE INDEX IF NOT EXISTS idx_trend_metrics_calculated ON trend_metrics(calculated_at DESC);

        CREATE INDEX IF NOT EXISTS idx_time_series_hourly_platform ON time_series_hourly(platform);
        CREATE INDEX IF NOT EXISTS idx_time_series_hourly_bucket ON time_series_hourly(hour_bucket DESC);

        CREATE INDEX IF NOT EXISTS idx_time_series_daily_platform ON time_series_daily(platform);
        CREATE INDEX IF NOT EXISTS idx_time_series_daily_date ON time_series_daily(date DESC);

        CREATE INDEX IF NOT EXISTS idx_keyword_trends_keyword ON keyword_trends(keyword);
        CREATE INDEX IF NOT EXISTS idx_keyword_trends_platform ON keyword_trends(platform);
        CREATE INDEX IF NOT EXISTS idx_keyword_trends_date ON keyword_trends(date DESC);
        CREATE INDEX IF NOT EXISTS idx_keyword_trends_score ON keyword_trends(trending_score DESC);

        CREATE INDEX IF NOT EXISTS idx_user_influence_user ON user_influence_scores(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_influence_platform ON user_influence_scores(platform);
        CREATE INDEX IF NOT EXISTS idx_user_influence_date ON user_influence_scores(calculation_date DESC);
        CREATE INDEX IF NOT EXISTS idx_user_influence_score ON user_influence_scores(influence_score DESC);
      `);
    },
    down: (db: Database.Database) => {
      db.exec(`
        DROP TABLE IF EXISTS trend_metrics;
        DROP TABLE IF EXISTS time_series_hourly;
        DROP TABLE IF EXISTS time_series_daily;
        DROP TABLE IF EXISTS keyword_trends;
        DROP TABLE IF EXISTS user_influence_scores;
      `);
    },
  },
];

/**
 * Run database migrations
 */
export async function runDatabaseMigrations(
  db: Database.Database,
  logger?: winston.Logger,
): Promise<void> {
  const manager = new MigrationManager(db, logger);
  manager.runMigrations(migrations);
}

/**
 * Initialize database with schema
 */
export async function initializeDatabase(
  db: Database.Database,
  logger?: winston.Logger,
): Promise<void> {
  const manager = new MigrationManager(db, logger);

  // Load the base schema if this is a fresh database
  const currentVersion = manager.getCurrentVersion();
  if (currentVersion === 0) {
    manager.loadSchemaFromFile();
  }

  // Run any pending migrations
  manager.runMigrations(migrations);
}

/**
 * Export migration status
 */
export function getMigrationStatus(db: Database.Database): {
  current: number;
  pending: number[];
  applied: Array<{ version: number; name: string; applied_at: number }>;
} {
  const manager = new MigrationManager(db);
  const currentVersion = manager.getCurrentVersion();

  const applied = db
    .prepare(
      "SELECT version, name, applied_at FROM schema_migrations ORDER BY version",
    )
    .all() as Array<{ version: number; name: string; applied_at: number }>;

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .map((m) => m.version);

  return {
    current: currentVersion,
    pending,
    applied,
  };
}
