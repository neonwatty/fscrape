import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import { join } from 'path';

/**
 * Basic E2E test to verify CLI functionality
 */
test.describe('Basic CLI Tests', () => {
  const cliPath = join(process.cwd(), 'dist', 'cli.js');

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
      }, 10000);
    });
  }

  test('should display version', async () => {
    const result = await runCommand(['--version']);
    expect(result.code).toBe(0);
    // Version might be in stdout or stderr depending on commander.js
    const output = result.stdout || result.stderr;
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  test('should display help', async () => {
    const result = await runCommand(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('fscrape');
    expect(result.stdout).toContain('scrape');
    expect(result.stdout).toContain('export');
  });

  test('should show error for invalid command', async () => {
    const result = await runCommand(['invalid-command']);
    expect(result.code).not.toBe(0);
  });
});