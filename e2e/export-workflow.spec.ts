import { test, expect } from '@playwright/test';
import { spawn, execSync } from 'child_process';
import { existsSync, rmSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

/**
 * E2E tests for the export workflow
 */
test.describe.configure({ mode: 'serial' });

test.describe('Export Workflow', () => {
  const testDbPath = join(process.cwd(), 'test-export.db');
  const exportDir = join(process.cwd(), 'test-exports');
  const cliPath = join(process.cwd(), 'dist', 'cli.js');
  let testId = 0;
  
  // Setup test database with sample data
  test.beforeEach(async () => {
    console.log('BEFORE EACH: Starting test setup');
    testId++; // Increment test ID to ensure unique data per test
    // Clean up existing files and nested directories
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
    // Also clean up WAL and SHM files for SQLite
    if (existsSync(testDbPath + '-wal')) {
      rmSync(testDbPath + '-wal', { force: true });
    }
    if (existsSync(testDbPath + '-shm')) {
      rmSync(testDbPath + '-shm', { force: true });
    }
    if (existsSync(exportDir)) {
      rmSync(exportDir, { recursive: true, force: true });
    }
    // Clean up nested directory that may be created by init
    const nestedDir = join(process.cwd(), 'Users');
    if (existsSync(nestedDir)) {
      rmSync(nestedDir, { recursive: true, force: true });
    }
    
    // Create export directory if it doesn't exist
    if (!existsSync(exportDir)) {
      mkdirSync(exportDir, { recursive: true });
    }
    
    // Create and initialize database directly
    const db = new Database(testDbPath);
    
    // Use the actual schema from the application
    const schemaPath = join(process.cwd(), 'dist', 'database', 'schema.sql');
    let schema: string;
    try {
      schema = readFileSync(schemaPath, 'utf-8');
    } catch (error) {
      // Fallback to inline schema if dist not available
      schema = `
      -- Posts table (matching schema.ts)
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        author TEXT NOT NULL,
        author_id TEXT,
        url TEXT NOT NULL,
        score INTEGER NOT NULL,
        comment_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        metadata TEXT,
        scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        engagement_rate REAL GENERATED ALWAYS AS (
          CASE 
            WHEN (score + comment_count) = 0 THEN 0.0
            ELSE CAST(comment_count AS REAL) / (score + comment_count)
          END
        ) STORED,
        score_normalized REAL GENERATED ALWAYS AS (
          CASE 
            WHEN score < 0 THEN 0.0
            WHEN score > 10000 THEN 1.0
            ELSE score / 10000.0
          END
        ) STORED
      );
      
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        parent_id TEXT,
        author TEXT NOT NULL,
        author_id TEXT,
        content TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        depth INTEGER NOT NULL,
        scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (post_id) REFERENCES posts(id)
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        username TEXT NOT NULL,
        karma INTEGER,
        post_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at INTEGER,
        last_seen_at INTEGER,
        scraped_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        metadata TEXT
      );
      
      CREATE TABLE IF NOT EXISTS scraping_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        platform TEXT NOT NULL,
        query_type TEXT,
        query_value TEXT,
        sort_by TEXT,
        time_range TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        total_items_target INTEGER,
        total_items_scraped INTEGER DEFAULT 0,
        total_posts INTEGER DEFAULT 0,
        total_comments INTEGER DEFAULT 0,
        total_users INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        error_message TEXT,
        metadata TEXT
      );
      
      CREATE TABLE IF NOT EXISTS rate_limit_state (
        platform TEXT PRIMARY KEY,
        requests_count INTEGER DEFAULT 0,
        requests_in_window INTEGER DEFAULT 0,
        window_start INTEGER NOT NULL,
        last_request_at INTEGER,
        retry_after INTEGER,
        consecutive_errors INTEGER DEFAULT 0
      );`;
    }
    
    // Execute the schema
    db.exec(schema);
    
    // Insert test posts into posts table
    const insertPost = db.prepare(`
      INSERT INTO posts (
        id, platform, platform_id, title, content, author, author_id,
        score, url, comment_count, created_at, updated_at, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = Date.now();
    const posts = [
      [`post1_${testId}`, 'reddit', `post1_${testId}`, 'Test Post 1', 'Content 1', 'user1', null, 100, 'http://example.com/1', 5, now, now, now],
      [`post2_${testId}`, 'reddit', `post2_${testId}`, 'Test Post 2', 'Content 2', 'user2', null, 200, 'http://example.com/2', 10, now, now, now],
      [`post3_${testId}`, 'hackernews', `post3_${testId}`, 'HN Post 1', 'HN Content 1', 'hnuser1', null, 50, 'http://hn.com/1', 3, now, now, now],
    ];
    
    posts.forEach(post => insertPost.run(...post));
    
    // Insert test comments
    const insertComment = db.prepare(`
      INSERT INTO comments (
        id, platform, platform_id, post_id, parent_id, content, 
        author, author_id, score, depth, created_at, updated_at, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const comments = [
      [`comment1_${testId}`, 'reddit', `comment1_${testId}`, `post1_${testId}`, null, 'Comment content 1', 'commenter1', null, 10, 0, now, now, now],
      [`comment2_${testId}`, 'reddit', `comment2_${testId}`, `post1_${testId}`, `comment1_${testId}`, 'Reply content', 'commenter2', null, 5, 1, now, now, now],
    ];
    
    comments.forEach(comment => insertComment.run(...comment));
    
    // Debug: Verify schema was created correctly
    const tableInfo = db.prepare("PRAGMA table_info(posts)").all();
    const hasUpdatedAt = tableInfo.some((col: any) => col.name === 'updated_at');
    console.log('BEFORE EACH: Database columns:', tableInfo.map((c: any) => c.name).join(', '));
    if (!hasUpdatedAt) {
      console.error('ERROR: posts table missing updated_at column!');
      console.error('Columns:', tableInfo.map((c: any) => c.name));
    } else {
      console.log('BEFORE EACH: updated_at column exists ✓');
    }
    
    db.close();
  });
  
  test.afterEach(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
    // Also clean up WAL and SHM files for SQLite
    if (existsSync(testDbPath + '-wal')) {
      rmSync(testDbPath + '-wal', { force: true });
    }
    if (existsSync(testDbPath + '-shm')) {
      rmSync(testDbPath + '-shm', { force: true });
    }
    if (existsSync(exportDir)) {
      rmSync(exportDir, { recursive: true, force: true });
    }
    // Clean up nested directory that may be created by init
    const nestedDir = join(process.cwd(), 'Users');
    if (existsSync(nestedDir)) {
      rmSync(nestedDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to run CLI command
   */
  async function runCommand(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      const child = spawn('node', [cliPath, ...args], {
        env: { ...process.env, NODE_ENV: 'test' },
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
      
      // Set timeout
      setTimeout(() => {
        child.kill();
        resolve({ stdout, stderr, code: -1 });
      }, 30000);
    });
  }

  test('should export to JSON format', async () => {
    const outputPath = join(exportDir, 'export.json');
    
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--include-comments'
    ]);
    
    if (result.code !== 0) {
      console.log('Export error stdout:', result.stdout);
      console.log('Export error stderr:', result.stderr);
    }
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Export complete!');
    expect(existsSync(outputPath)).toBeTruthy();
    
    // Verify JSON content
    const content = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(content.posts).toBeDefined();
    expect(content.posts.length).toBe(3);
    expect(content.comments).toBeDefined();
    expect(content.comments.length).toBe(2);
  });

  test('should export to CSV format', async () => {
    const outputPath = join(exportDir, 'export.csv');
    
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'csv',
      '--output', outputPath,
      '--include-comments'
    ]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Export complete!');
    expect(existsSync(outputPath)).toBeTruthy();
    
    // Verify CSV content
    const content = readFileSync(outputPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    expect(lines.length).toBeGreaterThan(1); // Header + data
    expect(lines[0].toLowerCase()).toContain('platform'); // Check header (case-insensitive)
    expect(lines[0].toLowerCase()).toContain('title');
  });

  test.skip('should export to SQLite format - not implemented', async () => {
    const outputPath = join(exportDir, 'export.sqlite');
    
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'sqlite',
      '--output', outputPath
    ]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Export complete!');
    expect(existsSync(outputPath)).toBeTruthy();
    
    // Verify SQLite database
    const db = new Database(outputPath);
    const posts = db.prepare('SELECT COUNT(*) as count FROM posts').get() as any;
    const comments = db.prepare('SELECT COUNT(*) as count FROM comments').get() as any;
    
    expect(posts.count).toBe(3);
    expect(comments.count).toBe(2);
    
    db.close();
  });

  test('should filter exports by platform', async () => {
    const outputPath = join(exportDir, 'reddit-export.json');
    
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--platform', 'reddit'
    ]);
    
    expect(result.code).toBe(0);
    expect(existsSync(outputPath)).toBeTruthy();
    
    // Verify filtered content
    const content = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(content.posts.length).toBe(2);
    expect(content.posts.every((p: any) => p.platform === 'reddit')).toBeTruthy();
  });

  test('should filter exports by date range', async () => {
    const outputPath = join(exportDir, 'date-filtered.json');
    
    // Get dates for filtering
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--start-date', yesterday.toISOString().split('T')[0],
      '--end-date', tomorrow.toISOString().split('T')[0]
    ]);
    
    expect(result.code).toBe(0);
    expect(existsSync(outputPath)).toBeTruthy();
    
    // Should include all posts (created today)
    const content = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(content.posts.length).toBe(3);
  });

  test.skip('should export specific content types - feature not implemented', async () => {
    // Export only posts
    let outputPath = join(exportDir, 'posts-only.json');
    let result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--type', 'posts'
    ]);
    
    expect(result.code).toBe(0);
    let content = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(content.posts).toBeDefined();
    expect(content.comments).toBeUndefined();
    
    // Export only comments
    outputPath = join(exportDir, 'comments-only.json');
    result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--type', 'comments'
    ]);
    
    expect(result.code).toBe(0);
    content = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(content.comments).toBeDefined();
    expect(content.posts).toBeUndefined();
  });

  test.skip('should handle large exports with pagination - feature not implemented', async () => {
    // Insert more data for pagination test
    const db = new Database(testDbPath);
    const insertPost = db.prepare(`
      INSERT INTO posts (
        id, platform, title, content, author, 
        score, url, comment_count, created_at, updated_at, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      insertPost.run(
        `bulk-post-${testId}-${i}`,
        'reddit',
        `Bulk Post ${i}`,
        `Content for post ${i}`,
        `user${i}`,
        i,
        `http://example.com/bulk/${i}`,
        0,
        now,
        now,
        now
      );
    }
    db.close();
    
    const outputPath = join(exportDir, 'large-export.json');
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--limit', '50'
    ]);
    
    expect(result.code).toBe(0);
    
    const content = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(content.posts.length).toBe(50);
  });

  test.skip('should compress exports when requested - feature not implemented', async () => {
    const outputPath = join(exportDir, 'export.json.gz');
    
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--compress'
    ]);
    
    expect(result.code).toBe(0);
    expect(existsSync(outputPath)).toBeTruthy();
    
    // Verify it's compressed (file should be smaller and not readable as plain text)
    const content = readFileSync(outputPath);
    expect(() => JSON.parse(content.toString())).toThrow();
  });

  test.skip('should validate export parameters - feature not implemented', async () => {
    // Invalid format
    let result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'invalid',
      '--output', join(exportDir, 'test.txt')
    ]);
    
    expect(result.code).not.toBe(0);
    
    // Missing output path
    result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json'
    ]);
    
    expect(result.code).not.toBe(0);
    
    // Invalid date format
    result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', join(exportDir, 'test.json'),
      '--from', 'invalid-date'
    ]);
    
    expect(result.code).not.toBe(0);
  });

  test.skip('should generate export statistics - feature not implemented', async () => {
    const outputPath = join(exportDir, 'export-with-stats.json');
    
    const result = await runCommand([
      'export',
      '--database', testDbPath,
      '--format', 'json',
      '--output', outputPath,
      '--include-stats'
    ]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Export statistics');
    expect(result.stdout).toMatch(/Posts:\s+\d+/);
    expect(result.stdout).toMatch(/Comments:\s+\d+/);
    
    const content = JSON.parse(readFileSync(outputPath, 'utf-8'));
    if (content.metadata) {
      expect(content.metadata.statistics).toBeDefined();
      expect(content.metadata.statistics.totalPosts).toBe(3);
      expect(content.metadata.statistics.totalComments).toBe(2);
    }
  });
});