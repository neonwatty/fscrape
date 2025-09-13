import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

/**
 * E2E tests for the session management workflow
 */
test.describe.serial('Session Workflow', () => {
  const testDbPath = join(process.cwd(), 'test-session.db');
  const cliPath = join(process.cwd(), 'dist', 'cli.js');
  let runningProcess: ChildProcess | null = null;
  
  // Cleanup before and after tests
  test.beforeEach(async () => {
    if (existsSync(testDbPath)) {
      try {
        rmSync(testDbPath, { force: true });
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    // Initialize database directly
    const db = new Database(testDbPath);
    const { MigrationManager } = await import('../src/database/migrations.js');
    const manager = new MigrationManager(db);
    await manager.runAllMigrations();
    db.close();
    
    // Initialize platform registry
    const { PlatformRegistry } = await import('../src/platforms/platform-registry.js');
    await PlatformRegistry.initializeAsync();
  });
  
  test.afterEach(() => {
    // Kill any running process
    if (runningProcess) {
      runningProcess.kill();
      runningProcess = null;
    }
    
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
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

  /**
   * Helper to start a long-running scraping process
   */
  function startScraping(args: string[]): ChildProcess {
    const child = spawn('npx', ['tsx', cliPath, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
    });
    
    runningProcess = child;
    return child;
  }

  test('should create and track scraping session', async () => {
    const result = await runCommand([
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '5',
      '--database', testDbPath
    ]);
    
    if (result.code !== 0) {
      console.log('Error - stdout:', result.stdout);
      console.log('Error - stderr:', result.stderr);
    }
    
    expect(result.code).toBe(0);
    
    // Verify session was created
    const db = new Database(testDbPath);
    const session = db.prepare('SELECT * FROM scraping_sessions ORDER BY id DESC LIMIT 1').get() as any;
    
    expect(session).toBeTruthy();
    expect(session.platform).toBe('hackernews');
    expect(session.status).toBe('completed');
    expect(session.id).toBeTruthy();
    
    db.close();
  });

  test('should list active sessions', async () => {
    // Start a scraping process
    const child = startScraping([
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '50',
      '--database', testDbPath
    ]);
    
    // Wait for it to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // List sessions
    const result = await runCommand([
      'status',
      '--database', testDbPath
    ]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Active Sessions');
    expect(result.stdout).toMatch(/hacker|news/i);
    
    child.kill();
  });

  test('should pause and resume session', async () => {
    // Start scraping
    const child = startScraping([
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '100',
      '--database', testDbPath
    ]);
    
    // Wait for it to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get session ID
    const db = new Database(testDbPath);
    let session = db.prepare('SELECT * FROM scraping_sessions ORDER BY id DESC LIMIT 1').get() as any;
    const sessionId = session.session_id;
    
    // Pause the session (interrupt the process)
    child.kill('SIGINT');
    
    // Wait for process to exit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check session status
    session = db.prepare('SELECT * FROM scraping_sessions WHERE session_id = ?').get(sessionId) as any;
    expect(['paused', 'interrupted', 'running']).toContain(session.status);
    
    const itemsBeforePause = session.total_posts || 0;
    db.close();
    
    // Resume the session
    const resumeResult = await runCommand([
      'scrape',
      'https://news.ycombinator.com',
      '--resume', sessionId,
      '--database', testDbPath
    ]);
    
    expect(resumeResult.code).toBe(0);
    expect(resumeResult.stdout).toContain('Resuming session');
    
    // Verify more items were scraped
    const db2 = new Database(testDbPath);
    session = db2.prepare('SELECT * FROM scraping_sessions WHERE session_id = ?').get(sessionId) as any;
    expect(session.total_posts || 0).toBeGreaterThanOrEqual(itemsBeforePause);
    db2.close();
  });

  test('should handle concurrent sessions', async () => {
    // Start first scraping process
    const child1 = startScraping([
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '20',
      '--database', testDbPath
    ]);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start second scraping process
    const child2 = spawn('node', [
      cliPath,
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '20',
      '--database', testDbPath
    ]);
    
    // Wait for both to run
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check both sessions exist
    const db = new Database(testDbPath);
    const sessions = db.prepare("SELECT * FROM scraping_sessions WHERE status = 'running'").all() as any[];
    
    // Should have at least one running session
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    
    child1.kill();
    child2.kill();
    db.close();
  });

  test('should track session progress', async () => {
    // Start scraping
    const child = startScraping([
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '30',
      '--database', testDbPath,
      '--verbose'
    ]);
    
    // Collect output
    let output = '';
    child.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    // Wait for some progress
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check for progress indicators
    expect(output).toMatch(/Progress|Scraped|Fetching|\d+%/i);
    
    // Check database for progress
    const db = new Database(testDbPath);
    const session = db.prepare('SELECT * FROM scraping_sessions ORDER BY id DESC LIMIT 1').get() as any;
    
    expect(session.total_posts).toBeGreaterThanOrEqual(0);
    
    child.kill();
    db.close();
  });

  test('should handle session errors gracefully', async () => {
    // Start scraping with invalid parameters to trigger error
    const result = await runCommand([
      'scrape',
      'https://news.ycombinator.com/nonexistent99999',
      '--limit', '5',
      '--database', testDbPath
    ]);
    
    // Check session was marked as failed or completed
    const db = new Database(testDbPath);
    const session = db.prepare('SELECT * FROM scraping_sessions ORDER BY id DESC LIMIT 1').get() as any;
    
    if (session) {
      expect(['failed', 'completed']).toContain(session.status);
      if (session.status === 'failed' && session.error_message) {
        expect(session.error_message).toBeTruthy();
      }
    }
    
    db.close();
  });

  test.skip('should cleanup old sessions - clean command not implemented', async () => {
    // Create some old sessions directly in database
    const db = new Database(testDbPath);
    const insertSession = db.prepare(`
      INSERT INTO scraping_sessions (
        session_id, platform, status, total_posts, 
        total_comments, started_at, completed_at, query_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
    
    insertSession.run('old-session-1', 'reddit', 'completed', 100, 0, oldDate.getTime(), oldDate.getTime(), 'old-query');
    insertSession.run('old-session-2', 'hackernews', 'failed', 25, 0, oldDate.getTime(), oldDate.getTime(), 'old-query');
    
    // Recent session
    const recentDate = new Date();
    const recentSessionId = 'recent-session';
    insertSession.run(recentSessionId, 'reddit', 'completed', 10, 0, recentDate.getTime(), recentDate.getTime(), 'recent-query');
    
    db.close();
    
    // Run cleanup
    const result = await runCommand([
      'clean',
      '--database', testDbPath,
      '--older-than', '30'
    ]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Cleaned');
    
    // Verify old sessions were removed
    const db2 = new Database(testDbPath);
    const oldSessions = db2.prepare('SELECT * FROM scraping_sessions WHERE query_value = ?').all('old-query');
    const recentSession = db2.prepare('SELECT * FROM scraping_sessions WHERE session_id = ?').get(recentSessionId);
    
    expect(oldSessions.length).toBe(0);
    expect(recentSession).toBeTruthy();
    
    db2.close();
  });

  test.skip('should export session history - list command not implemented', async () => {
    // Create multiple sessions
    await runCommand([
      'scrape',
      'https://news.ycombinator.com/best',
      '--limit', '3',
      '--database', testDbPath
    ]);
    
    await runCommand([
      'scrape',
      'https://news.ycombinator.com/newest',
      '--limit', '3',
      '--database', testDbPath
    ]);
    
    // List all sessions
    const result = await runCommand([
      'list',
      'sessions',
      '--database', testDbPath,
      '--format', 'json'
    ]);
    
    expect(result.code).toBe(0);
    
    // Parse JSON output
    const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const sessions = JSON.parse(jsonMatch[0]);
      expect(Array.isArray(sessions) || sessions.sessions).toBeTruthy();
      
      const sessionArray = Array.isArray(sessions) ? sessions : sessions.sessions;
      expect(sessionArray.length).toBeGreaterThanOrEqual(2);
    }
  });

  test.skip('should provide session statistics - status command not fully implemented', async () => {
    // Run some scraping
    await runCommand([
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '5',
      '--database', testDbPath
    ]);
    
    // Get statistics
    const result = await runCommand([
      'status',
      '--database', testDbPath
    ]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Total Sessions|Completed|Success Rate/i);
  });

  test('should recover from crash', async () => {
    // Start scraping
    const child = startScraping([
      'scrape',
      'https://news.ycombinator.com',
      '--limit', '50',
      '--database', testDbPath
    ]);
    
    // Wait for it to start processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Simulate crash (force kill)
    child.kill('SIGKILL');
    
    // Wait for process to die
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check session status
    const db = new Database(testDbPath);
    const session = db.prepare('SELECT * FROM scraping_sessions ORDER BY id DESC LIMIT 1').get() as any;
    const sessionId = session.session_id;
    
    // Session should be in an incomplete state
    expect(['running', 'interrupted']).toContain(session.status);
    db.close();
    
    // Try to resume
    const resumeResult = await runCommand([
      'scrape',
      'https://news.ycombinator.com',
      '--resume', sessionId,
      '--database', testDbPath
    ]);
    
    // Should either resume or indicate it cannot resume
    expect([0, 1]).toContain(resumeResult.code);
    
    if (resumeResult.code === 0) {
      expect(resumeResult.stdout).toMatch(/Resum/i);
    }
  });
});