/**
 * Tests for output formatter
 * Validates output formatting, colors, tables, and progress indicators
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';
import { OutputFormatter } from '../output-formatter.js';
import type { OutputOptions } from '../output-formatter.js';
import type { ForumPost, Comment } from '../../types/core.js';

// Mock ora spinner
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
    color: 'cyan',
  })),
}));

// Mock table
vi.mock('table', () => ({
  table: vi.fn((data: string[][]) => {
    return data.map((row) => row.join(' | ')).join('\n');
  }),
}));

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    // Reset chalk for testing
    chalk.level = 3;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Options', () => {
    it('should create formatter with default options', () => {
      formatter = new OutputFormatter();
      expect(formatter).toBeDefined();
    });

    it('should accept custom options', () => {
      const options: OutputOptions = {
        format: 'json',
        level: 'verbose',
        color: true,
        timestamp: true,
        showProgress: true,
        showStats: true,
      };
      formatter = new OutputFormatter(options);
      expect(formatter).toBeDefined();
    });

    it('should disable colors when color option is false', () => {
      const originalLevel = chalk.level;
      formatter = new OutputFormatter({ color: false });
      expect(chalk.level).toBe(0);
      chalk.level = originalLevel;
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      formatter = new OutputFormatter({ level: 'verbose' });
    });

    it('should log messages based on level', () => {
      formatter.log('Test message', 'normal');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).toContain('Test message');
    });

    it('should not log verbose messages in normal mode', () => {
      formatter = new OutputFormatter({ level: 'normal' });
      formatter.log('Verbose message', 'verbose');
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should log debug messages only in debug mode', () => {
      formatter = new OutputFormatter({ level: 'debug' });
      formatter.debug('Debug message');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).toContain('Debug message');
    });

    it('should log error messages with red color', () => {
      formatter.error('Error message');
      expect(mockConsoleError).toHaveBeenCalled();
      const output = mockConsoleError.mock.calls[0][0];
      expect(output).toContain('❌');
      expect(output).toContain('Error message');
    });

    it('should log error stack in debug mode', () => {
      formatter = new OutputFormatter({ level: 'debug' });
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      formatter.error('Error occurred', error);
      expect(mockConsoleError).toHaveBeenCalledTimes(2);
      const stackOutput = mockConsoleError.mock.calls[1][0];
      expect(stackOutput).toContain('Error stack trace');
    });

    it('should log success messages with green color', () => {
      formatter.success('Success message');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).toContain('✓');
      expect(output).toContain('Success message');
    });

    it('should log warning messages with yellow color', () => {
      formatter.warning('Warning message');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).toContain('⚠');
      expect(output).toContain('Warning message');
    });

    it('should log info messages in verbose mode', () => {
      formatter.info('Info message');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).toContain('ℹ');
      expect(output).toContain('Info message');
    });
  });

  describe('Timestamp Formatting', () => {
    it('should include timestamp when enabled', () => {
      formatter = new OutputFormatter({ timestamp: true });
      formatter.log('Message with timestamp');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should not include timestamp when disabled', () => {
      formatter = new OutputFormatter({ timestamp: false });
      formatter.log('Message without timestamp');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Spinner Methods', () => {
    beforeEach(() => {
      formatter = new OutputFormatter({ showProgress: true });
    });

    it('should start spinner with text', async () => {
      const ora = vi.mocked((await import('ora')).default);
      formatter.startSpinner('Loading...');
      expect(ora).toHaveBeenCalled();
      const spinner = ora.mock.results[0].value;
      expect(spinner.start).toHaveBeenCalled();
    });

    it('should update spinner text', async () => {
      const ora = vi.mocked((await import('ora')).default);
      formatter.startSpinner('Loading...');
      formatter.updateSpinner('Still loading...');
      const spinner = ora.mock.results[0].value;
      expect(spinner.text).toBeDefined();
    });

    it('should succeed spinner', async () => {
      const ora = vi.mocked((await import('ora')).default);
      formatter.startSpinner('Loading...');
      formatter.succeedSpinner('Done!');
      const spinner = ora.mock.results[0].value;
      expect(spinner.succeed).toHaveBeenCalled();
    });

    it('should fail spinner', async () => {
      const ora = vi.mocked((await import('ora')).default);
      formatter.startSpinner('Loading...');
      formatter.failSpinner('Failed!');
      const spinner = ora.mock.results[0].value;
      expect(spinner.fail).toHaveBeenCalled();
    });

    it('should not start spinner when showProgress is false', async () => {
      formatter = new OutputFormatter({ showProgress: false });
      const ora = vi.mocked((await import('ora')).default);
      formatter.startSpinner('Loading...');
      expect(ora).not.toHaveBeenCalled();
    });
  });

  describe('Batch Progress', () => {
    beforeEach(() => {
      formatter = new OutputFormatter({ showProgress: true });
    });

    it('should start batch progress tracking', () => {
      formatter.startBatch(100, 'Processing items');
      // Spinner should be started
      expect(mockConsoleLog).not.toHaveBeenCalled(); // No direct log, uses spinner
    });

    it('should update batch progress', () => {
      formatter.startBatch(10);
      formatter.updateBatch('Item 1', 'completed');
      formatter.updateBatch('Item 2', 'failed');
      formatter.updateBatch('Item 3', 'skipped');
      // Progress should be tracked internally
    });

    it('should end batch and show summary', () => {
      formatter = new OutputFormatter({ showStats: true });
      formatter.startBatch(3);
      formatter.updateBatch('Item 1', 'completed');
      formatter.updateBatch('Item 2', 'failed');
      formatter.updateBatch('Item 3', 'completed');
      formatter.endBatch(true);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Batch Processing Summary');
    });
  });

  describe('Format Posts', () => {
    const mockPosts: ForumPost[] = [
      {
        id: '1',
        title: 'Test Post 1',
        content: 'Content 1',
        author: 'user1',
        url: 'https://example.com/1',
        score: 100,
        commentCount: 10,
        createdAt: new Date('2024-01-01'),
        platform: 'reddit',
      },
      {
        id: '2',
        title: 'Test Post 2',
        content: 'Content 2',
        author: 'user2',
        url: 'https://example.com/2',
        score: 50,
        commentCount: 5,
        createdAt: new Date('2024-01-02'),
        platform: 'hackernews',
      },
    ];

    it('should format posts as table', () => {
      formatter = new OutputFormatter({ format: 'table' });
      formatter.formatPosts(mockPosts);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Test Post 1');
      expect(output).toContain('user1');
    });

    it('should format posts as JSON', () => {
      formatter = new OutputFormatter({ format: 'json' });
      formatter.formatPosts(mockPosts);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Test Post 1');
    });

    it('should format posts as CSV', () => {
      formatter = new OutputFormatter({ format: 'csv' });
      formatter.formatPosts(mockPosts);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('id,title,author,score,comments,platform,url,created_at');
      expect(output).toContain('Test Post 1');
    });

    it('should format posts as simple', () => {
      formatter = new OutputFormatter({ format: 'simple' });
      formatter.formatPosts(mockPosts);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('1. Test Post 1');
      expect(output).toContain('Author: user1');
      expect(output).toContain('Score: 100');
    });

    it('should format posts as verbose', () => {
      formatter = new OutputFormatter({ format: 'verbose' });
      formatter.formatPosts(mockPosts);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Post 1: Test Post 1');
      expect(output).toContain('ID:');
      expect(output).toContain('URL:');
      expect(output).toContain('Content:');
    });

    it('should handle empty posts array', () => {
      formatter = new OutputFormatter({ format: 'table' });
      formatter.formatPosts([]);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      expect(output).toContain('No posts to display');
    });
  });

  describe('Format Comments', () => {
    const mockComments: Comment[] = [
      {
        id: 'c1',
        postId: 'p1',
        parentId: null,
        author: 'commenter1',
        content: 'Comment content 1',
        score: 25,
        createdAt: new Date('2024-01-01'),
        depth: 0,
        platform: 'reddit',
      },
      {
        id: 'c2',
        postId: 'p1',
        parentId: 'c1',
        author: 'commenter2',
        content: 'Reply to comment 1',
        score: 10,
        createdAt: new Date('2024-01-02'),
        depth: 1,
        platform: 'reddit',
      },
    ];

    it('should format comments as table', () => {
      formatter = new OutputFormatter({ format: 'table' });
      formatter.formatComments(mockComments);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('commenter1');
      expect(output).toContain('Comment content 1');
    });

    it('should format comments as JSON', () => {
      formatter = new OutputFormatter({ format: 'json' });
      formatter.formatComments(mockComments);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].content).toBe('Comment content 1');
    });

    it('should format comments as CSV', () => {
      formatter = new OutputFormatter({ format: 'csv' });
      formatter.formatComments(mockComments);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('id,post_id,author,content,score,platform,created_at');
      expect(output).toContain('commenter1');
    });

    it('should format comments as verbose', () => {
      formatter = new OutputFormatter({ format: 'verbose' });
      formatter.formatComments(mockComments);
      expect(mockConsoleLog).toHaveBeenCalled();
      // Check that all calls were made with the expected arguments
      const calls = mockConsoleLog.mock.calls;
      // Should have multiple console.log calls for verbose output
      expect(calls.length).toBeGreaterThan(0);
      // Join all arguments from all calls into one string for checking
      const output = calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('Comment 1:');
      expect(output).toContain('commenter1');
      expect(output).toContain('Content:');
      expect(output).toContain('Comment content 1');
    });
  });

  describe('Format Statistics', () => {
    it('should format stats as table', () => {
      formatter = new OutputFormatter({ format: 'table' });
      const stats = {
        totalPosts: 100,
        totalComments: 500,
        totalUsers: 50,
        platforms: {
          reddit: 60,
          hackernews: 40,
        },
      };
      formatter.formatStats(stats);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Statistics');
      expect(output).toContain('totalPosts');
      expect(output).toContain('100');
    });

    it('should format stats as JSON', () => {
      formatter = new OutputFormatter({ format: 'json' });
      const stats = {
        totalPosts: 100,
        totalComments: 500,
      };
      formatter.formatStats(stats);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.totalPosts).toBe(100);
      expect(parsed.totalComments).toBe(500);
    });
  });

  describe('Progress Bar', () => {
    it('should format progress bar correctly', () => {
      formatter = new OutputFormatter();
      const progressBar = formatter.formatProgressBar(50, 100);
      expect(progressBar).toContain('50%');
      expect(progressBar).toContain('50/100');
      expect(progressBar).toContain('█'); // Filled blocks
      expect(progressBar).toContain('░'); // Empty blocks
    });

    it('should handle 0% progress', () => {
      formatter = new OutputFormatter();
      const progressBar = formatter.formatProgressBar(0, 100);
      expect(progressBar).toContain('0%');
      expect(progressBar).toContain('0/100');
    });

    it('should handle 100% progress', () => {
      formatter = new OutputFormatter();
      const progressBar = formatter.formatProgressBar(100, 100);
      expect(progressBar).toContain('100%');
      expect(progressBar).toContain('100/100');
    });

    it('should handle custom width', () => {
      formatter = new OutputFormatter();
      const progressBar = formatter.formatProgressBar(25, 100, 20);
      expect(progressBar).toContain('25%');
      // The bar should contain 20 visual characters (5 filled + 15 empty)
      expect(progressBar).toContain('█████');
      expect(progressBar).toContain('░░░░░░░░░░░░░░░');
      expect(progressBar).toContain('(25/100)');
    });
  });

  describe('Output Level Filtering', () => {
    it('should respect quiet level', () => {
      formatter = new OutputFormatter({ level: 'quiet' });
      formatter.log('Normal message', 'normal');
      formatter.log('Verbose message', 'verbose');
      formatter.debug('Debug message');
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should respect normal level', () => {
      formatter = new OutputFormatter({ level: 'normal' });
      formatter.log('Normal message', 'normal');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);

      mockConsoleLog.mockClear();
      formatter.log('Verbose message', 'verbose');
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should respect verbose level', () => {
      formatter = new OutputFormatter({ level: 'verbose' });
      formatter.log('Normal message', 'normal');
      formatter.log('Verbose message', 'verbose');
      expect(mockConsoleLog).toHaveBeenCalledTimes(2);

      mockConsoleLog.mockClear();
      formatter.debug('Debug message');
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should respect debug level', () => {
      formatter = new OutputFormatter({ level: 'debug' });
      formatter.log('Normal message', 'normal');
      formatter.log('Verbose message', 'verbose');
      formatter.debug('Debug message');
      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null or undefined values gracefully', () => {
      formatter = new OutputFormatter();
      expect(() => formatter.log('')).not.toThrow();
      expect(() => formatter.error('')).not.toThrow();
      expect(() => formatter.formatPosts([])).not.toThrow();
    });

    it('should truncate long content appropriately', () => {
      formatter = new OutputFormatter({ format: 'table' });
      const longPost: ForumPost = {
        id: '1',
        title: 'A'.repeat(100), // Very long title
        content: 'B'.repeat(1000), // Very long content
        author: 'user',
        url: 'https://example.com',
        score: 0,
        commentCount: 0,
        createdAt: new Date(),
        platform: 'reddit',
      };
      formatter.formatPosts([longPost]);
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      // Title should be truncated in table view
      expect(output).toContain('...');
    });
  });
});
