import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BatchProcessor, BatchConfig } from '../batch-processor.js';
import { OutputFormatter } from '../output-formatter.js';
import { DatabaseManager } from '../../database/database.js';
import { RedditScraper } from '../../platforms/reddit/scraper.js';
import { HackerNewsScraper } from '../../platforms/hackernews/scraper.js';
import { ExportManager } from '../../export/export-manager.js';
import { promises as fs } from 'fs';

// Mock all external dependencies
vi.mock('../output-formatter.js');
vi.mock('../../database/database.js');
vi.mock('../../platforms/reddit/scraper.js');
vi.mock('../../platforms/hackernews/scraper.js');
vi.mock('../../export/export-manager.js');
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  },
}));
vi.mock('inquirer');

describe('BatchProcessor', () => {
  let processor: BatchProcessor;
  let mockFormatter: any;
  let mockDatabase: any;
  let mockRedditScraper: any;
  let mockHackerNewsScraper: any;
  let mockExportManager: any;

  beforeEach(() => {
    // Setup mocks
    mockFormatter = {
      startBatch: vi.fn(),
      updateBatch: vi.fn(),
      endBatch: vi.fn(),
      completeBatch: vi.fn(),
      log: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      startSpinner: vi.fn(),
      stopSpinner: vi.fn(),
    };

    mockDatabase = {
      initialize: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      upsertPost: vi.fn().mockResolvedValue({}),
      queryPosts: vi.fn().mockResolvedValue([
        { id: '1', title: 'Post 1', content: 'Content 1', platform: 'reddit' },
        {
          id: '2',
          title: 'Post 2',
          content: 'Content 2',
          platform: 'hackernews',
        },
      ]),
      queryComments: vi.fn().mockResolvedValue([
        { id: 'c1', postId: '1', content: 'Comment 1' },
        { id: 'c2', postId: '1', content: 'Comment 2' },
      ]),
      queryUsers: vi.fn().mockResolvedValue([
        { id: 'u1', username: 'user1', karma: 100 },
        { id: 'u2', username: 'user2', karma: 200 },
      ]),
      getAllPosts: vi.fn().mockResolvedValue([
        { id: '1', title: 'Post 1', content: 'Content 1' },
        { id: '2', title: 'Post 2', content: 'Content 2' },
      ]),
      getAllComments: vi.fn().mockResolvedValue([
        { id: 'c1', postId: '1', content: 'Comment 1' },
        { id: 'c2', postId: '1', content: 'Comment 2' },
      ]),
      getAllUsers: vi.fn().mockResolvedValue([
        { id: 'u1', username: 'user1' },
        { id: 'u2', username: 'user2' },
      ]),
      deletePosts: vi.fn().mockResolvedValue({ deletedCount: 2 }),
      deleteComments: vi.fn().mockResolvedValue({ deletedCount: 2 }),
      deleteUsers: vi.fn().mockResolvedValue({ deletedCount: 2 }),
      backup: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      savePosts: vi.fn().mockResolvedValue(undefined),
      saveComments: vi.fn().mockResolvedValue(undefined),
      saveUsers: vi.fn().mockResolvedValue(undefined),
    };

    mockRedditScraper = {
      scrapeSubreddit: vi.fn().mockResolvedValue({
        posts: [{ id: 'r1', title: 'Reddit Post' }],
        comments: [{ id: 'rc1', content: 'Reddit Comment' }],
      }),
      scrapeCategory: vi.fn().mockResolvedValue([
        { id: 'r1', title: 'Reddit Post 1', platform: 'reddit' },
        { id: 'r2', title: 'Reddit Post 2', platform: 'reddit' },
      ]),
      scrapePost: vi.fn().mockResolvedValue({
        id: 'rp1',
        title: 'Single Reddit Post',
        platform: 'reddit',
      }),
    };

    mockHackerNewsScraper = {
      scrapeStory: vi.fn().mockResolvedValue({
        post: { id: 'hn1', title: 'HN Story' },
        comments: [{ id: 'hnc1', content: 'HN Comment' }],
      }),
      scrapePost: vi.fn().mockResolvedValue({
        id: 'hn1',
        title: 'HN Story',
        platform: 'hackernews',
      }),
      scrapePosts: vi.fn().mockResolvedValue([
        { id: 'hnt1', title: 'Top HN Story 1', platform: 'hackernews' },
        { id: 'hnt2', title: 'Top HN Story 2', platform: 'hackernews' },
      ]),
      scrapeTopStories: vi.fn().mockResolvedValue({
        posts: [{ id: 'hnt1', title: 'Top HN Story' }],
        comments: [],
      }),
    };

    mockExportManager = {
      exportData: vi.fn().mockResolvedValue('export-file.json'),
    };

    // Mock constructor returns
    vi.mocked(OutputFormatter).mockImplementation(() => mockFormatter);
    vi.mocked(DatabaseManager).mockImplementation(() => mockDatabase);
    vi.mocked(RedditScraper).mockImplementation(() => mockRedditScraper);
    vi.mocked(HackerNewsScraper).mockImplementation(() => mockHackerNewsScraper);
    vi.mocked(ExportManager).mockImplementation(() => mockExportManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      const config: BatchConfig = {
        operations: [],
      };
      processor = new BatchProcessor(config);
      expect(processor).toBeDefined();
    });

    it('should create instance with full config', () => {
      const config: BatchConfig = {
        operations: [{ type: 'scrape', platform: 'reddit', items: ['test'] }],
        parallel: true,
        maxConcurrency: 5,
        continueOnError: true,
        dryRun: false,
        verbose: true,
        outputPath: './output',
        database: './test.db',
      };
      processor = new BatchProcessor(config);
      expect(processor).toBeDefined();
    });
  });

  describe('Load from File', () => {
    it('should load JSON config from file', async () => {
      const mockConfig = {
        operations: [{ type: 'scrape', platform: 'reddit', items: ['test'] }],
        parallel: true,
      };
      (fs.readFile as any).mockResolvedValueOnce(JSON.stringify(mockConfig));

      const config = await BatchProcessor.loadFromFile('batch.json');
      expect(config).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith('batch.json', 'utf-8');
    });

    it('should parse text file with commands', async () => {
      const textContent = `
scrape reddit /r/programming
export posts ./exports
clean old-posts
`;
      (fs.readFile as any).mockResolvedValueOnce(textContent);

      const config = await BatchProcessor.loadFromFile('batch.txt');
      expect(config.operations).toHaveLength(3);
      expect(config.operations[0].type).toBe('scrape');
      expect(config.operations[1].type).toBe('export');
      expect(config.operations[2].type).toBe('clean');
    });

    it('should throw error for unsupported file format', async () => {
      (fs.readFile as any).mockResolvedValueOnce('content');
      await expect(BatchProcessor.loadFromFile('batch.xml')).rejects.toThrow(
        'Unsupported batch file format'
      );
    });
  });

  describe('Execute Operations', () => {
    beforeEach(() => {
      const config: BatchConfig = {
        operations: [],
        database: './test.db',
      };
      processor = new BatchProcessor(config);
    });

    describe('Scrape Operations', () => {
      it('should execute reddit scrape operation', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'scrape',
              platform: 'reddit',
              items: ['/r/programming'],
              options: { limit: 10 },
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockRedditScraper.scrapeCategory).toHaveBeenCalledWith('programming', { limit: 10 });
      });

      it('should execute hackernews scrape operation', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'scrape',
              platform: 'hackernews',
              items: ['12345'],
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockHackerNewsScraper.scrapePost).toHaveBeenCalledWith('12345');
      });

      it('should handle scrape operation failures', async () => {
        mockRedditScraper.scrapeCategory.mockRejectedValue(new Error('Scrape failed'));

        const config: BatchConfig = {
          operations: [
            {
              type: 'scrape',
              platform: 'reddit',
              items: ['/r/test'],
            },
          ],
          continueOnError: true,
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('failed');
        expect(results[0].error?.message).toBe('Scrape failed');
      });
    });

    describe('Export Operations', () => {
      it('should export posts as CSV', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'export',
              options: {
                data: 'posts',
                format: 'csv',
                output: './exports',
              },
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockExportManager.exportData).toHaveBeenCalled();
      });

      it('should export comments as JSON', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'export',
              options: {
                data: 'comments',
                format: 'json',
                output: './exports',
              },
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockExportManager.exportData).toHaveBeenCalled();
      });

      it('should handle export failures', async () => {
        mockExportManager.exportData.mockRejectedValue(new Error('Export failed'));

        const config: BatchConfig = {
          operations: [
            {
              type: 'export',
              options: {
                data: 'posts',
                format: 'csv',
              },
            },
          ],
          continueOnError: true,
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('failed');
        expect(results[0].error?.message).toBe('Export failed');
      });
    });

    describe('Clean Operations', () => {
      it('should clean old posts', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'clean',
              options: {
                target: 'old-posts',
                days: 30,
              },
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockDatabase.deletePosts).toHaveBeenCalled();
      });

      it('should clean all data', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'clean',
              options: {
                target: 'all',
              },
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockDatabase.deletePosts).toHaveBeenCalled();
        expect(mockDatabase.deleteComments).toHaveBeenCalled();
        expect(mockDatabase.deleteUsers).toHaveBeenCalled();
      });
    });

    describe('Migrate Operations', () => {
      it('should perform database backup', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'migrate',
              options: {
                action: 'backup',
                path: './backup.db',
              },
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockDatabase.backup).toHaveBeenCalledWith('./backup.db');
      });

      it('should perform database restore', async () => {
        const config: BatchConfig = {
          operations: [
            {
              type: 'migrate',
              options: {
                action: 'restore',
                path: './backup.db',
              },
            },
          ],
          database: './test.db',
        };
        processor = new BatchProcessor(config);

        const results = await processor.execute();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(mockDatabase.restore).toHaveBeenCalledWith('./backup.db');
      });
    });
  });

  describe('Parallel Execution', () => {
    it('should execute operations in parallel', async () => {
      const config: BatchConfig = {
        operations: [
          { type: 'scrape', platform: 'reddit', items: ['/r/test1'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test2'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test3'] },
        ],
        parallel: true,
        maxConcurrency: 2,
        database: './test.db',
      };
      processor = new BatchProcessor(config);

      const results = await processor.execute();

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === 'success')).toBe(true);
      expect(mockRedditScraper.scrapeCategory).toHaveBeenCalledTimes(3);
    });

    it('should respect max concurrency', async () => {
      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockRedditScraper.scrapeSubreddit.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrentCalls--;
        return { posts: [], comments: [] };
      });

      const config: BatchConfig = {
        operations: Array(10)
          .fill(null)
          .map((_, i) => ({
            type: 'scrape' as const,
            platform: 'reddit' as const,
            items: [`/r/test${i}`],
          })),
        parallel: true,
        maxConcurrency: 3,
        database: './test.db',
      };
      processor = new BatchProcessor(config);

      await processor.execute();

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('Dry Run Mode', () => {
    it('should not execute operations in dry run mode', async () => {
      const config: BatchConfig = {
        operations: [
          { type: 'scrape', platform: 'reddit', items: ['/r/test'] },
          { type: 'export', options: { data: 'posts', format: 'csv' } },
          { type: 'clean', options: { target: 'all' } },
        ],
        dryRun: true,
        database: './test.db',
      };
      processor = new BatchProcessor(config);

      const results = await processor.execute();

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === 'skipped')).toBe(true);
      expect(mockRedditScraper.scrapeCategory).not.toHaveBeenCalled();
      expect(mockExportManager.exportData).not.toHaveBeenCalled();
      expect(mockDatabase.deletePosts).not.toHaveBeenCalled();
    });
  });

  describe('Continue on Error', () => {
    it('should stop on first error when continueOnError is false', async () => {
      mockRedditScraper.scrapeCategory.mockRejectedValue(new Error('First operation failed'));

      const config: BatchConfig = {
        operations: [
          { type: 'scrape', platform: 'reddit', items: ['/r/test1'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test2'] },
        ],
        continueOnError: false,
        database: './test.db',
      };
      processor = new BatchProcessor(config);

      await expect(processor.execute()).rejects.toThrow('First operation failed');
      expect(mockRedditScraper.scrapeCategory).toHaveBeenCalledTimes(1);
    });

    it('should continue after error when continueOnError is true', async () => {
      mockRedditScraper.scrapeCategory
        .mockRejectedValueOnce(new Error('First operation failed'))
        .mockResolvedValueOnce([]);

      const config: BatchConfig = {
        operations: [
          { type: 'scrape', platform: 'reddit', items: ['/r/test1'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test2'] },
        ],
        continueOnError: true,
        database: './test.db',
      };
      processor = new BatchProcessor(config);

      const results = await processor.execute();

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('failed');
      expect(results[1].status).toBe('success');
      expect(mockRedditScraper.scrapeCategory).toHaveBeenCalledTimes(2);
    });
  });

  describe('Save Results', () => {
    it('should save results to file', async () => {
      const config: BatchConfig = {
        operations: [{ type: 'scrape', platform: 'reddit', items: ['/r/test'] }],
        database: './test.db',
      };
      processor = new BatchProcessor(config);

      await processor.execute();
      await processor.saveResults('results.json');

      expect(fs.writeFile).toHaveBeenCalledWith(
        'results.json',
        expect.stringContaining('"status":"success"'),
        'utf-8'
      );
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress for batch operations', async () => {
      const config: BatchConfig = {
        operations: [
          { type: 'scrape', platform: 'reddit', items: ['/r/test1'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test2'] },
          { type: 'scrape', platform: 'reddit', items: ['/r/test3'] },
        ],
        verbose: true,
        database: './test.db',
      };
      processor = new BatchProcessor(config);

      await processor.execute();

      expect(mockFormatter.startBatch).toHaveBeenCalledWith(3, 'Executing operations');
      expect(mockFormatter.updateBatch).toHaveBeenCalledTimes(3);
    });
  });
});
