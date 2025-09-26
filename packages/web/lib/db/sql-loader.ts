import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

// Database singleton and state
let db: Database | null = null;
let sqliteInitialized = false;
let SQL: SqlJsStatic | null = null;

// Database configuration
export interface DatabaseConfig {
  databasePath?: string;
  wasmPath?: string;
  validateSchema?: boolean;
  schemaVersion?: number;
}

// Default configuration
const DEFAULT_CONFIG: Required<DatabaseConfig> = {
  databasePath: '/data/sample.db',
  wasmPath: '/sql-js/',
  validateSchema: true,
  schemaVersion: 1,
};

// Schema validation queries
const SCHEMA_CHECKS = {
  tables: ['posts', 'authors'],
  postsColumns: [
    'id',
    'platform',
    'title',
    'author',
    'created_utc',
    'score',
    'num_comments',
    'url',
    'permalink',
  ],
};

// Initialize SQL.js library (lazy loading)
async function initializeSqlJs(wasmPath: string): Promise<SqlJsStatic> {
  if (SQL) {
    return SQL;
  }

  try {
    SQL = await initSqlJs({
      locateFile: (file: string) => {
        // Support both local and CDN paths
        if (wasmPath.startsWith('http')) {
          return `${wasmPath}${file}`;
        }
        return `${wasmPath}${file}`;
      },
    });
    return SQL;
  } catch (error) {
    throw new Error(
      `Failed to initialize SQL.js: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Validate database schema
async function validateDatabaseSchema(database: Database): Promise<boolean> {
  try {
    // Check if required tables exist
    const tables =
      database
        .exec("SELECT name FROM sqlite_master WHERE type='table'")[0]
        ?.values.map((row) => row[0]) || [];

    for (const requiredTable of SCHEMA_CHECKS.tables) {
      if (!tables.includes(requiredTable)) {
        console.warn(`Missing required table: ${requiredTable}`);
        return false;
      }
    }

    // Check posts table structure
    const postsInfo = database.exec(`PRAGMA table_info(posts)`)[0];
    if (postsInfo) {
      const columns = postsInfo.values.map((row) => row[1] as string);
      for (const requiredColumn of SCHEMA_CHECKS.postsColumns) {
        if (!columns.includes(requiredColumn)) {
          console.warn(`Missing required column in posts table: ${requiredColumn}`);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Schema validation failed:', error);
    return false;
  }
}

// Main database initialization function
export async function initializeDatabase(config: DatabaseConfig = {}): Promise<Database> {
  // Return existing database if already initialized
  if (db && sqliteInitialized) {
    return db;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Initialize SQL.js if not already done
    const sqlJs = await initializeSqlJs(finalConfig.wasmPath);

    // Handle different database sources
    let data: Uint8Array | undefined;

    if (finalConfig.databasePath) {
      // Try to load database from path
      try {
        const response = await fetch(finalConfig.databasePath);

        if (response.ok) {
          const buffer = await response.arrayBuffer();
          data = new Uint8Array(buffer);
          console.log(`Database loaded from ${finalConfig.databasePath}`);
        } else if (response.status === 404) {
          console.log('Database file not found, creating new database');
          // Continue with empty database
        } else {
          throw new Error(`Failed to load database: ${response.statusText}`);
        }
      } catch (fetchError) {
        // Handle network errors or CORS issues
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
          console.log('Database fetch failed, creating new database');
        } else {
          throw fetchError;
        }
      }
    }

    // Create database instance (empty if no data)
    db = new sqlJs.Database(data);

    // Validate schema if requested and data was loaded
    if (finalConfig.validateSchema && data) {
      const isValid = await validateDatabaseSchema(db);
      if (!isValid) {
        console.warn('Database schema validation failed, database may be corrupted');
        // Optionally create a new database or throw an error
        // For now, we'll continue with the loaded database
      }
    }

    sqliteInitialized = true;
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    // Clean up on error
    if (db) {
      db.close();
      db = null;
    }
    sqliteInitialized = false;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to initialize database:', errorMessage);
    throw new Error(`Database initialization failed: ${errorMessage}`);
  }
}

// Create a new empty database with schema
export async function createEmptyDatabase(config: DatabaseConfig = {}): Promise<Database> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config, databasePath: undefined };

  try {
    // Initialize SQL.js
    const sqlJs = await initializeSqlJs(finalConfig.wasmPath);

    // Create new empty database
    const newDb = new sqlJs.Database();

    // Create schema
    newDb.run(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        subreddit TEXT,
        title TEXT,
        author TEXT,
        body TEXT,
        created_utc INTEGER,
        score INTEGER,
        num_comments INTEGER,
        url TEXT,
        permalink TEXT,
        platform TEXT DEFAULT 'reddit'
      );

      CREATE TABLE IF NOT EXISTS authors (
        username TEXT PRIMARY KEY,
        total_posts INTEGER,
        total_score INTEGER,
        first_seen INTEGER,
        last_seen INTEGER,
        platform TEXT DEFAULT 'reddit'
      );

      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_utc);
      CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
      CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit);
      CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
    `);

    return newDb;
  } catch (error) {
    throw new Error(
      `Failed to create empty database: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Get current database instance
export function getDatabase(): Database {
  if (!db || !sqliteInitialized) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

// Check if database is initialized
export function isDatabaseInitialized(): boolean {
  return sqliteInitialized && db !== null;
}

// Close database connection
export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
    } catch (error) {
      console.error('Error closing database:', error);
    }
    db = null;
    sqliteInitialized = false;
  }
}

// Execute a query and return results with proper typing
export function executeQuery<T = unknown>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase();

  try {
    const stmt = database.prepare(sql);
    stmt.bind(params as Parameters<typeof stmt.bind>[0]);

    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row as T);
    }

    stmt.free();
    return results;
  } catch (error) {
    throw new Error(
      `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Execute a query and return the first result
export function executeQueryFirst<T = unknown>(sql: string, params: unknown[] = []): T | null {
  const results = executeQuery<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Get database statistics
export function getDatabaseStats() {
  if (!isDatabaseInitialized()) {
    return null;
  }

  try {
    const totalPosts = executeQueryFirst<{ count: number }>('SELECT COUNT(*) as count FROM posts');

    const platforms = executeQuery<{ platform: string; count: number }>(
      'SELECT platform, COUNT(*) as count FROM posts GROUP BY platform'
    );

    const lastScraped = executeQueryFirst<{ last_scraped: string }>(
      'SELECT MAX(created_utc) as last_scraped FROM posts'
    );

    return {
      totalPosts: totalPosts?.count || 0,
      platforms,
      lastScraped: lastScraped?.last_scraped || null,
      isInitialized: true,
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return null;
  }
}

// Export database to Uint8Array
export function exportDatabase(): Uint8Array | null {
  if (!isDatabaseInitialized()) {
    return null;
  }

  try {
    const database = getDatabase();
    return database.export();
  } catch (error) {
    console.error('Failed to export database:', error);
    return null;
  }
}

// Load database from Uint8Array
export async function loadDatabaseFromData(
  data: Uint8Array,
  config: DatabaseConfig = {}
): Promise<Database> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Close existing database if any
    closeDatabase();

    // Initialize SQL.js
    const sqlJs = await initializeSqlJs(finalConfig.wasmPath);

    // Create database from data
    db = new sqlJs.Database(data);

    // Validate schema if requested
    if (finalConfig.validateSchema) {
      const isValid = await validateDatabaseSchema(db);
      if (!isValid) {
        throw new Error('Invalid database schema');
      }
    }

    sqliteInitialized = true;
    return db;
  } catch (error) {
    // Clean up on error
    if (db) {
      db.close();
      db = null;
    }
    sqliteInitialized = false;

    throw new Error(
      `Failed to load database from data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
