/**
 * Test utilities for E2E tests
 */

import { spawn } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Run a CLI command with retry logic
 */
export async function runCommandWithRetry(
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    retries?: number;
    timeout?: number;
  } = {}
): Promise<CommandResult> {
  const {
    cwd = process.cwd(),
    env = { ...process.env, NODE_ENV: 'test' },
    retries = 1,
    timeout = 30000
  } = options;

  const cliPath = join(cwd, 'dist', 'cli.js');
  
  let lastError: Error | null = null;
  let lastResult: CommandResult | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await runCommand(args, { cwd, env, timeout, cliPath });
      return result;
    } catch (error) {
      lastError = error as Error;
      lastResult = {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        code: 1
      };
      
      if (attempt < retries) {
        console.log(`Command failed (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return lastResult || { stdout: '', stderr: lastError?.message || 'Unknown error', code: 1 };
}

/**
 * Run a CLI command
 */
function runCommand(
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
    cliPath?: string;
  } = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const {
      cwd = process.cwd(),
      env = { ...process.env, NODE_ENV: 'test' },
      timeout = 30000,
      cliPath = join(cwd, 'dist', 'cli.js')
    } = options;

    const child = spawn('node', [cliPath, ...args], { cwd, env });
    
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!timedOut) {
        resolve({ stdout, stderr, code: code || 0 });
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Clean up test database and related files
 */
export function cleanupTestDatabase(dbPath: string): void {
  const extensions = ['', '-wal', '-shm'];
  
  for (const ext of extensions) {
    const filePath = dbPath + ext;
    if (existsSync(filePath)) {
      try {
        rmSync(filePath, { force: true });
      } catch (error) {
        console.warn(`Failed to remove ${filePath}:`, error);
      }
    }
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 100,
    message = 'Condition not met'
  } = options;

  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition: ${message}`);
}