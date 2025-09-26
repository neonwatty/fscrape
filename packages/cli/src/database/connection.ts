import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DATABASE_SCHEMA, DATABASE_INDEXES, DATABASE_TRIGGERS } from './schema.js';
import type { DatabaseConfig } from '../types/config.js';
import winston from 'winston';

export class DatabaseConnection {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private logger: winston.Logger;

  constructor(config: DatabaseConfig, logger?: winston.Logger) {
    this.config = config;
    this.logger =
      logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      });
  }

  connect(): Database.Database {
    if (this.db) {
      return this.db;
    }

    try {
      // Ensure directory exists for file-based databases
      if (this.config.path && this.config.path !== ':memory:') {
        const dbDir = path.dirname(this.config.path);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
      }

      // Create database connection
      this.db = new Database(this.config.path || ':memory:', {
        verbose: process.env.DEBUG === 'true' ? console.log : undefined,
      });

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Set journal mode for better concurrency
      this.db.pragma('journal_mode = WAL');

      // Initialize schema
      this.initializeSchema();

      this.logger.info(`Database connected: ${this.config.path}`);

      return this.db;
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw new Error(
        `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private initializeSchema(): void {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    // Check if schema already exists by checking for the posts table
    const tableExists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
      .get();

    if (tableExists) {
      this.logger.debug('Database schema already exists, skipping initialization');
      return;
    }

    const transaction = this.db.transaction(() => {
      // Create tables
      for (const [tableName, schema] of Object.entries(DATABASE_SCHEMA)) {
        this.db!.exec(schema);
        this.logger.debug(`Table ${tableName} initialized`);
      }

      // Create indexes
      for (const indexSql of DATABASE_INDEXES) {
        this.db!.exec(indexSql);
      }

      // Create triggers
      for (const triggerSql of DATABASE_TRIGGERS) {
        this.db!.exec(triggerSql);
      }
    });

    transaction();
    this.logger.info('Database schema initialized');
  }

  disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info('Database disconnected');
    }
  }

  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  // Utility method for testing
  static createInMemory(logger?: winston.Logger): DatabaseConnection {
    const config: DatabaseConfig = {
      type: 'sqlite',
      path: ':memory:',
      connectionPoolSize: 1,
    };

    const connection = new DatabaseConnection(config, logger);
    connection.connect();
    return connection;
  }

  // Transaction helper
  transaction<T>(fn: () => T): () => T {
    const db = this.getDatabase();
    return db.transaction(fn);
  }

  // Prepared statement cache
  private statements = new Map<string, Database.Statement>();

  prepare(sql: string): Database.Statement {
    if (!this.statements.has(sql)) {
      const stmt = this.getDatabase().prepare(sql);
      this.statements.set(sql, stmt);
    }
    return this.statements.get(sql)!;
  }

  clearStatementCache(): void {
    this.statements.clear();
  }
}
