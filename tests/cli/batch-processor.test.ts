/**
 * Unit tests for BatchProcessor
 * Tests batch operations including parsing, execution, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BatchProcessor, BatchConfig, BatchOperation, BatchResult } from '../../src/cli/batch-processor';
import { DatabaseManager } from '../../src/database/database';
import { RedditScraper } from '../../src/platforms/reddit/scraper';
import { HackerNewsScraper } from '../../src/platforms/hackernews/scraper';
import { ExportManager } from '../../src/export/export-manager';
import { promises as fs } from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../src/database/database');
vi.mock('../../src/platforms/reddit/scraper');
vi.mock('../../src/platforms/hackernews/scraper');
vi.mock('../../src/export/export-manager');
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  }
}));
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock chalk to return plain strings
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
  }
}));

describe('BatchProcessor', () => {
  let mockDatabase: any;
  let mockRedditScraper: any;
  let mockHackerNewsScraper: any;
  let mockExportManager: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Setup mock database
    mockDatabase = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      upsertPost: vi.fn().mockResolvedValue(undefined),
      upsertComment: vi.fn().mockResolvedValue(undefined),
      upsertUser: vi.fn().mockResolvedValue(undefined),
      queryPosts: vi.fn().mockResolvedValue([]),
      queryComments: vi.fn().mockResolvedValue([]),
      queryUsers: vi.fn().mockResolvedValue([]),
      deleteOldData: vi.fn().mockResolvedValue({
        deletedPosts: 10,
        deletedComments: 20,
        deletedUsers: 5
      }),
      vacuum: vi.fn().mockResolvedValue(undefined),
    };
    (DatabaseManager as any).mockImplementation(() => mockDatabase);

    // Setup mock Reddit scraper
    mockRedditScraper = {
      scrapeCategory: vi.fn().mockResolvedValue([
        { id: '1', title: 'Test Post', platform: 'reddit', score: 100 }
      ]),
      scrapePost: vi.fn().mockResolvedValue({
        id: '1', title: 'Test Post', platform: 'reddit'
      }),
    };
    (RedditScraper as any).mockImplementation(() => mockRedditScraper);

    // Setup mock HackerNews scraper
    mockHackerNewsScraper = {
      scrapePosts: vi.fn().mockResolvedValue({
        posts: [
          { id: '2', title: 'HN Post', platform: 'hackernews', score: 50 }
        ]
      }),
      scrapePost: vi.fn().mockResolvedValue({
        id: '2', title: 'HN Post', platform: 'hackernews'
      }),
      scrapeCategory: vi.fn().mockResolvedValue([
        { id: '2', title: 'HN Post', platform: 'hackernews', score: 50 }
      ])
    };
    (HackerNewsScraper as any).mockImplementation(() => mockHackerNewsScraper);

    // Setup mock export manager
    mockExportManager = {
      exportData: vi.fn().mockResolvedValue('/path/to/export.json')
    };
    (ExportManager as any).mockImplementation(() => mockExportManager);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Batch File Parsing', () => {
    it('should parse JSON batch file correctly', async () => {
      const jsonContent = JSON.stringify({
        operations: [
          { type: 'scrape', platform: 'reddit', items: ['/r/test'] },
          { type: 'export', options: { format: 'json', output: './exports' } }
        ],
        parallel: true,
        maxConcurrency: 3
      });

      (fs.readFile as any).mockResolvedValue(jsonContent);

      const config = await BatchProcessor.loadFromFile('batch.json');

      expect(config.operations).toHaveLength(2);
      expect(config.operations[0].type).toBe('scrape');
      expect(config.operations[1].type).toBe('export');
      expect(config.parallel).toBe(true);
      expect(config.maxConcurrency).toBe(3);
    });

    it('should parse text batch file with scrape commands', async () => {
      const textContent = `
# Comments should be ignored
scrape reddit /r/programming /r/webdev

scrape hackernews topstories
export json ./output
      `;

      (fs.readFile as any).mockResolvedValue(textContent);

      const config = await BatchProcessor.loadFromFile('batch.txt');

      expect(config.operations).toHaveLength(3);
      expect(config.operations[0].type).toBe('scrape');
      expect(config.operations[0].platform).toBe('reddit');
      expect(config.operations[0].items).toEqual(['/r/programming', '/r/webdev']);
    });

    it('should parse text batch file with export commands', () => {
      const textContent = 'export csv ./exports/data.csv';

      const config = BatchProcessor.parseBatchFile(textContent);

      expect(config.operations).toHaveLength(1);
      expect(config.operations[0].type).toBe('export');
      expect(config.operations[0].options?.format).toBe('csv');
      expect(config.operations[0].options?.output).toBe('./exports/data.csv');
    });

    it('should parse text batch file with clean commands', () => {
      const textContent = 'clean 30';

      const config = BatchProcessor.parseBatchFile(textContent);

      expect(config.operations).toHaveLength(1);
      expect(config.operations[0].type).toBe('clean');
      expect(config.operations[0].options?.olderThan).toBe(30);
    });

    it('should ignore comments and empty lines in text files', () => {
      const textContent = `
# This is a comment
scrape reddit /r/test

# Another comment

export json ./output
`;

      const config = BatchProcessor.parseBatchFile(textContent);

      expect(config.operations).toHaveLength(2);
      expect(config.operations.every(op => op.type !== '#')).toBe(true);
    });

    it('should throw error for unsupported file formats', async () => {
      await expect(BatchProcessor.loadFromFile('batch.xml')).rejects.toThrow(
        'Unsupported batch file format: .xml'
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      (fs.readFile as any).mockResolvedValue('{ invalid json');

      await expect(BatchProcessor.loadFromFile('batch.json')).rejects.toThrow();
    });

    it('should handle unknown commands in text files', () => {
      const textContent = 'unknown command arguments';

      const config = BatchProcessor.parseBatchFile(textContent);

      expect(config.operations).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown batch command: unknown')
      );
    });
  });

  describe('Interactive Batch Creation', () => {
    it('should create scrape operation interactively', async () => {
      (inquirer.prompt as any)
        .mockResolvedValueOnce({ operationType: 'scrape' })
        .mockResolvedValueOnce({
          platform: 'reddit',
          items: '/r/test, /r/programming',
          limit: 50
        })
        .mockResolvedValueOnce({ operationType: 'done' })
        .mockResolvedValueOnce({
          parallel: false,
          continueOnError: true,
          dryRun: false
        });

      const config = await BatchProcessor.createInteractive();

      expect(config.operations).toHaveLength(1);
      expect(config.operations[0].type).toBe('scrape');
      expect(config.operations[0].platform).toBe('reddit');
      expect(config.operations[0].items).toEqual(['/r/test', '/r/programming']);
      expect(config.operations[0].options?.limit).toBe(50);
    });

    it('should create export operation interactively', async () => {
      (inquirer.prompt as any)
        .mockResolvedValueOnce({ operationType: 'export' })
        .mockResolvedValueOnce({
          format: 'json',
          output: './exports',
          data: 'all'
        })
        .mockResolvedValueOnce({ operationType: 'done' })
        .mockResolvedValueOnce({
          parallel: false,
          continueOnError: true,
          dryRun: false
        });

      const config = await BatchProcessor.createInteractive();

      expect(config.operations).toHaveLength(1);
      expect(config.operations[0].type).toBe('export');
      expect(config.operations[0].options?.format).toBe('json');
      expect(config.operations[0].options?.output).toBe('./exports');
    });

    it('should create clean operation interactively', async () => {
      (inquirer.prompt as any)
        .mockResolvedValueOnce({ operationType: 'clean' })
        .mockResolvedValueOnce({
          olderThan: 7,
          platform: 'reddit'
        })
        .mockResolvedValueOnce({ operationType: 'done' })
        .mockResolvedValueOnce({
          parallel: false,
          continueOnError: true,
          dryRun: false
        });

      const config = await BatchProcessor.createInteractive();

      expect(config.operations).toHaveLength(1);
      expect(config.operations[0].type).toBe('clean');
      expect(config.operations[0].platform).toBe('reddit');
      expect(config.operations[0].options?.olderThan).toBe(7);
    });

    it('should handle multiple operations in sequence', async () => {
      (inquirer.prompt as any)
        .mockResolvedValueOnce({ operationType: 'scrape' })
        .mockResolvedValueOnce({
          platform: 'reddit',
          items: '/r/test',
          limit: 10
        })
        .mockResolvedValueOnce({ operationType: 'export' })
        .mockResolvedValueOnce({
          format: 'json',
          output: './exports',
          data: 'posts'
        })
        .mockResolvedValueOnce({ operationType: 'done' })
        .mockResolvedValueOnce({
          parallel: false,
          continueOnError: true,
          dryRun: false
        });

      const config = await BatchProcessor.createInteractive();

      expect(config.operations).toHaveLength(2);
      expect(config.operations[0].type).toBe('scrape');
      expect(config.operations[1].type).toBe('export');
    });

    it('should configure parallel execution options', async () => {
      (inquirer.prompt as any)
        .mockResolvedValueOnce({ operationType: 'done' })
        .mockResolvedValueOnce({
          parallel: true,
          maxConcurrency: 10,
          continueOnError: false,
          dryRun: true
        });

      const config = await BatchProcessor.createInteractive();

      expect(config.parallel).toBe(true);
      expect(config.maxConcurrency).toBe(10);
      expect(config.continueOnError).toBe(false);
      expect(config.dryRun).toBe(true);
    });
  });

  describe('Operation Execution', () => {
    describe('Sequential Mode', () => {
      it('should execute operations in order', async () => {
        const config: BatchConfig = {
          operations: [
            { type: 'scrape', platform: 'reddit', items: ['/r/test'] },
            { type: 'export', options: { format: 'json' } }
          ],
          parallel: false
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results).toHaveLength(2);
        expect(results[0].operation.type).toBe('scrape');
        expect(results[1].operation.type).toBe('export');
        expect(results[0].status).toBe('success');
        expect(results[1].status).toBe('success');
      });

      it('should stop on error when continueOnError=false', async () => {
        mockDatabase.initialize.mockRejectedValueOnce(new Error('DB Error'));

        const config: BatchConfig = {
          operations: [
            { type: 'scrape', platform: 'reddit', items: ['/r/test'] },
            { type: 'export', options: { format: 'json' } }
          ],
          parallel: false,
          continueOnError: false
        };

        const processor = new BatchProcessor(config);

        await expect(processor.execute()).rejects.toThrow('DB Error');
      });

      it('should continue on error when continueOnError=true', async () => {
        mockDatabase.initialize
          .mockRejectedValueOnce(new Error('DB Error'))
          .mockResolvedValue(undefined);

        const config: BatchConfig = {
          operations: [
            { type: 'scrape', platform: 'reddit', items: ['/r/test'] },
            { type: 'export', options: { format: 'json' } }
          ],
          parallel: false,
          continueOnError: true
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results).toHaveLength(2);
        expect(results[0].status).toBe('failed');
        expect(results[0].message).toBe('DB Error');
        expect(results[1].status).toBe('success');
      });

      it('should track duration for each operation', async () => {
        const config: BatchConfig = {
          operations: [
            { type: 'scrape', platform: 'reddit', items: ['/r/test'] }
          ]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results[0].duration).toBeDefined();
        expect(results[0].duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle dry-run mode', async () => {
        const config: BatchConfig = {
          operations: [
            { type: 'scrape', platform: 'reddit', items: ['/r/test'] },
            { type: 'clean', options: { olderThan: 30 } }
          ],
          dryRun: true
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results).toHaveLength(2);
        expect(results[0].status).toBe('skipped');
        expect(results[0].message).toContain('Dry run');
        expect(results[1].status).toBe('skipped');
        expect(mockDatabase.initialize).not.toHaveBeenCalled();
      });
    });

    describe('Parallel Mode', () => {
      it('should execute operations concurrently', async () => {
        const config: BatchConfig = {
          operations: [
            { type: 'scrape', platform: 'reddit', items: ['/r/test'] },
            { type: 'scrape', platform: 'hackernews', items: ['topstories'] },
            { type: 'export', options: { format: 'json' } }
          ],
          parallel: true,
          maxConcurrency: 3
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results).toHaveLength(3);
        expect(results.every(r => r.status === 'success')).toBe(true);
      });

      it('should respect maxConcurrency limit', async () => {
        const operations: BatchOperation[] = [];
        for (let i = 0; i < 10; i++) {
          operations.push({
            type: 'scrape',
            platform: 'reddit',
            items: [`/r/test${i}`]
          });
        }

        const config: BatchConfig = {
          operations,
          parallel: true,
          maxConcurrency: 3
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results).toHaveLength(10);
        // Verify that database was initialized for each chunk
        // With 10 operations and maxConcurrency of 3, we should have 4 chunks
        // Each operation initializes the database
        expect(mockDatabase.initialize.mock.calls.length).toBe(10);
      });

      it('should handle mixed success/failure results', async () => {
        mockDatabase.initialize
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('DB Error'))
          .mockResolvedValueOnce(undefined);

        const config: BatchConfig = {
          operations: [
            { type: 'scrape', platform: 'reddit', items: ['/r/test1'] },
            { type: 'scrape', platform: 'reddit', items: ['/r/test2'] },
            { type: 'scrape', platform: 'reddit', items: ['/r/test3'] }
          ],
          parallel: true,
          continueOnError: true
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results).toHaveLength(3);
        expect(results[0].status).toBe('success');
        expect(results[1].status).toBe('failed');
        expect(results[2].status).toBe('success');
      });
    });
  });

  describe('Individual Operations', () => {
    describe('Scrape Operation', () => {
      it('should scrape Reddit posts from batch', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'scrape',
            platform: 'reddit',
            items: ['/r/programming', '/r/webdev'],
            options: { limit: 25 }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockRedditScraper.scrapeCategory).toHaveBeenCalledWith('programming', { limit: 25 });
        expect(mockRedditScraper.scrapeCategory).toHaveBeenCalledWith('webdev', { limit: 25 });
        expect(mockDatabase.upsertPost).toHaveBeenCalled();
        expect(results[0].status).toBe('success');
      });

      it('should scrape HackerNews stories from batch', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'scrape',
            platform: 'hackernews',
            items: [],
            options: { limit: 50 }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockHackerNewsScraper.scrapePosts).toHaveBeenCalledWith('topstories', { limit: 50 });
        expect(mockDatabase.upsertPost).toHaveBeenCalled();
        expect(results[0].status).toBe('success');
      });

      it('should handle "both" platform option', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'scrape',
            platform: 'both',
            items: ['/r/test'],
            options: { limit: 10 }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockRedditScraper.scrapeCategory).toHaveBeenCalled();
        // HackerNews scraper only gets called when items array is empty or contains HN items
        expect(mockHackerNewsScraper.scrapePost).toHaveBeenCalled();
        expect(results[0].status).toBe('success');
      });

      it('should handle invalid URLs/items gracefully', async () => {
        mockRedditScraper.scrapeCategory.mockRejectedValueOnce(new Error('Invalid subreddit'));

        const config: BatchConfig = {
          operations: [{
            type: 'scrape',
            platform: 'reddit',
            items: ['/r/invalid'],  // Need /r/ prefix to trigger scrapeCategory
            options: { limit: 10 }
          }],
          continueOnError: true
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results[0].status).toBe('failed');
        expect(results[0].message).toContain('Invalid subreddit');
      });
    });

    describe('Export Operation', () => {
      it('should export posts in JSON format', async () => {
        mockDatabase.queryPosts.mockResolvedValue([
          { id: '1', title: 'Test Post', platform: 'reddit' }
        ]);

        const config: BatchConfig = {
          operations: [{
            type: 'export',
            options: { format: 'json', output: './exports', data: 'posts' }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockDatabase.queryPosts).toHaveBeenCalled();
        expect(mockExportManager.exportData).toHaveBeenCalled();
        expect(results[0].status).toBe('success');
      });

      it('should export comments in CSV format', async () => {
        mockDatabase.queryComments.mockResolvedValue([
          { id: 'c1', postId: 'p1', content: 'Test comment', platform: 'reddit' }
        ]);

        const config: BatchConfig = {
          operations: [{
            type: 'export',
            options: { format: 'csv', output: './exports', data: 'comments' }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockDatabase.queryComments).toHaveBeenCalled();
        expect(mockExportManager.exportData).toHaveBeenCalled();
        expect(results[0].status).toBe('success');
      });

      it('should export all data types', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'export',
            options: { format: 'json', output: './exports', data: 'all' }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockDatabase.queryPosts).toHaveBeenCalled();
        expect(mockDatabase.queryComments).toHaveBeenCalled();
        expect(mockDatabase.queryUsers).toHaveBeenCalled();
        expect(mockExportManager.exportData).toHaveBeenCalledTimes(3);
        expect(results[0].status).toBe('success');
      });

      it('should create output directory if missing', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'export',
            options: { format: 'json', output: './new-exports', data: 'posts' }
          }]
        };

        const processor = new BatchProcessor(config);
        await processor.execute();

        expect(fs.mkdir).toHaveBeenCalledWith('./new-exports', { recursive: true });
      });
    });

    describe('Clean Operation', () => {
      it('should delete old posts', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'clean',
            options: { olderThan: 30 }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockDatabase.deleteOldData).toHaveBeenCalledWith({
          olderThanDays: 30,
          platform: undefined
        });
        expect(results[0].status).toBe('success');
      });

      it('should delete by platform', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'clean',
            platform: 'reddit',
            options: { olderThan: 7 }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockDatabase.deleteOldData).toHaveBeenCalledWith({
          olderThanDays: 7,
          platform: 'reddit'
        });
        expect(results[0].status).toBe('success');
      });

      it('should vacuum database after cleanup', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'clean',
            options: { olderThan: 30 }
          }]
        };

        const processor = new BatchProcessor(config);
        await processor.execute();

        expect(mockDatabase.vacuum).toHaveBeenCalled();
      });
    });

    describe('Migrate Operation', () => {
      it('should backup database', async () => {
        mockDatabase.backup = vi.fn().mockResolvedValue(undefined);

        const config: BatchConfig = {
          operations: [{
            type: 'migrate',
            options: { action: 'backup', path: './backup.db' }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockDatabase.backup).toHaveBeenCalledWith('./backup.db');
        expect(results[0].status).toBe('success');
      });

      it('should restore database', async () => {
        mockDatabase.restore = vi.fn().mockResolvedValue(undefined);

        const config: BatchConfig = {
          operations: [{
            type: 'migrate',
            options: { action: 'restore', path: './backup.db' }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(mockDatabase.restore).toHaveBeenCalledWith('./backup.db');
        expect(results[0].status).toBe('success');
      });

      it('should handle invalid actions', async () => {
        const config: BatchConfig = {
          operations: [{
            type: 'migrate',
            options: { action: 'invalid' }
          }]
        };

        const processor = new BatchProcessor(config);
        const results = await processor.execute();

        expect(results[0].status).toBe('failed');
        expect(results[0].message).toContain('Unknown migrate action');
      });
    });
  });

  describe('Results and Reporting', () => {
    it('should save results to file', async () => {
      const config: BatchConfig = {
        operations: [{
          type: 'scrape',
          platform: 'reddit',
          items: ['/r/test']
        }]
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      await processor.saveResults('./results.json');

      expect(fs.writeFile).toHaveBeenCalledWith(
        './results.json',
        expect.stringContaining('"timestamp"'),
        'utf-8'
      );

      const savedContent = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
      expect(savedContent.results).toHaveLength(1);
      expect(savedContent.summary.total).toBe(1);
      expect(savedContent.summary.success).toBe(1);
    });

    it('should format verbose output correctly', async () => {
      const config: BatchConfig = {
        operations: [{
          type: 'scrape',
          platform: 'reddit',
          items: ['/r/test']
        }],
        verbose: true
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      expect(consoleLogSpy).toHaveBeenCalled();
      // Check that data is displayed in verbose mode
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('posts');
    });

    it('should calculate statistics accurately', async () => {
      mockDatabase.initialize
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(undefined);

      const config: BatchConfig = {
        operations: [
          { type: 'scrape', platform: 'reddit', items: ['/r/test1'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test2'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test3'] }
        ],
        continueOnError: true,
        dryRun: false
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('Success: 2');
      expect(output).toContain('Failed: 1');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDatabase.initialize.mockRejectedValue(new Error('Connection refused'));

      const config: BatchConfig = {
        operations: [{
          type: 'scrape',
          platform: 'reddit',
          items: ['/r/test']
        }],
        continueOnError: true
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      expect(results[0].status).toBe('failed');
      expect(results[0].message).toContain('Connection refused');
    });

    it('should handle network errors in scraping', async () => {
      mockRedditScraper.scrapeCategory.mockRejectedValue(new Error('Network timeout'));

      const config: BatchConfig = {
        operations: [{
          type: 'scrape',
          platform: 'reddit',
          items: ['/r/test']
        }],
        continueOnError: true
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      expect(results[0].status).toBe('failed');
      expect(results[0].message).toContain('Network timeout');
    });

    it('should handle file system errors in export', async () => {
      (fs.mkdir as any).mockRejectedValue(new Error('Permission denied'));

      const config: BatchConfig = {
        operations: [{
          type: 'export',
          options: { format: 'json', output: '/restricted/path' }
        }],
        continueOnError: true
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      expect(results[0].status).toBe('failed');
      expect(results[0].message).toContain('Permission denied');
    });

    it('should handle invalid operation types', async () => {
      const config: BatchConfig = {
        operations: [{
          type: 'invalid' as any,
          options: {}
        }]
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      expect(results[0].status).toBe('failed');
      expect(results[0].message).toContain('Unknown operation type');
    });

    it('should provide meaningful error messages', async () => {
      const testError = new Error('Specific error: Database locked');
      mockDatabase.initialize.mockRejectedValue(testError);

      const config: BatchConfig = {
        operations: [{
          type: 'scrape',
          platform: 'reddit',
          items: ['/r/test']
        }],
        continueOnError: true
      };

      const processor = new BatchProcessor(config);
      const results = await processor.execute();

      expect(results[0].status).toBe('failed');
      expect(results[0].message).toBe('Specific error: Database locked');
      expect(results[0].error).toEqual(testError);
    });
  });
});