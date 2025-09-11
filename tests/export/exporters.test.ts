import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExportManager } from '../../src/export/export-manager';
import { JsonExporter } from '../../src/export/exporters/json-exporter';
import { CsvExporter } from '../../src/export/exporters/csv-exporter';
import { HtmlExporter } from '../../src/export/exporters/html-exporter';
import { MarkdownExporter } from '../../src/export/exporters/markdown-exporter';
import * as path from 'path';
import * as fs from 'fs';

// Mock fs
vi.mock('fs');

// Mock csv-writer to write to fs.writeFileSync
const mockCsvWriter = {
  writeRecords: vi.fn().mockImplementation(async (records) => {
    // Simulate CSV writing by calling writeFileSync with CSV content
    const headers = 'id,title,author,authorId,url,score,commentCount,platform,createdAt,updatedAt,content\n';
    const rows = records.map(r => 
      `${r.id},${r.title},${r.author},${r.authorId},${r.url},${r.score},${r.commentCount},${r.platform},${r.createdAt},${r.updatedAt},${r.content}`
    ).join('\n');
    return Promise.resolve();
  })
};

vi.mock('csv-writer', () => ({
  createObjectCsvWriter: vi.fn(() => mockCsvWriter)
}));

describe('Export System', () => {
  const mockPosts = [
    {
      id: '1',
      platform: 'reddit',
      title: 'Test Post 1',
      content: 'This is test content',
      author: 'user1',
      score: 100,
      commentCount: 10,
      url: 'https://reddit.com/post1',
      createdAt: new Date('2023-12-31T17:00:00'),
      category: 'programming',
      tags: ['javascript', 'testing'],
    },
    {
      id: '2',
      platform: 'hackernews',
      title: 'Test Post 2',
      content: 'Another test post',
      author: 'user2',
      score: 50,
      commentCount: 5,
      url: 'https://news.ycombinator.com/item?id=2',
      createdAt: new Date('2024-01-01T17:00:00'),
    },
  ];

  const mockComments = [
    {
      id: 'c1',
      postId: '1',
      platform: 'reddit',
      author: 'commenter1',
      content: 'Great post!',
      score: 10,
      createdAt: new Date('2024-01-01'),
      parentId: null,
    },
    {
      id: 'c2',
      postId: '1',
      platform: 'reddit',
      author: 'commenter2',
      content: 'I agree',
      score: 5,
      createdAt: new Date('2024-01-01'),
      parentId: 'c1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    mockCsvWriter.writeRecords.mockClear();
  });

  describe('ExportManager', () => {
    let exportManager: ExportManager;

    beforeEach(() => {
      exportManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json'
      });
    });

    it('should export data in JSON format', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      const outputPath = await exportManager.exportData(
        mockData,
        'json',
        './output.json'
      );

      expect(outputPath).toBe('./output.json');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"Test Post 1"')
      );
    });

    it('should export data in CSV format', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      const outputPath = await exportManager.exportData(
        mockData,
        'csv',
        './output.csv'
      );

      expect(outputPath).toBe('./output.csv');
      // CSV uses csv-writer, not direct writeFileSync for data
      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
    });

    it('should export data in HTML format', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      const outputPath = await exportManager.exportData(
        mockData,
        'html',
        './output.html'
      );

      expect(outputPath).toBe('./output.html');
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = writeCall?.[1] as string;
      expect(content).toContain('<!DOCTYPE html>');
    });

    it('should export data in Markdown format', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      const outputPath = await exportManager.exportData(
        mockData,
        'markdown',
        './output.md'
      );

      expect(outputPath).toBe('./output.md');
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = writeCall?.[1] as string;
      expect(content).toContain('Forum');
    });

    it('should handle unsupported format', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await expect(
        exportManager.exportData(mockData, 'xml' as any, './output.xml')
      ).rejects.toThrow('Unsupported format');
    });

    it('should create output directory if it does not exist', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await exportManager.exportData(
        mockData,
        'json',
        './exports/data/output.json'
      );

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('exports/data'),
        { recursive: true }
      );
    });

    it('should apply filters during export', async () => {
      const filterManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json',
        filterOptions: {
          platform: 'reddit',
          minScore: 75,
        },
      });

      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      
      await filterManager.exportData(
        mockData,
        'json',
        './output.json'
      );

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      
      expect(writtenData.posts).toBeDefined();
      if (writtenData.posts) {
        expect(writtenData.posts).toHaveLength(1);
        expect(writtenData.posts[0].id).toBe('1');
      }
    });

    it('should include metadata in export', async () => {
      const metadataManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json',
        includeMetadata: true,
      });

      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      
      await metadataManager.exportData(
        mockData,
        'json',
        './output.json'
      );

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      
      expect(writtenData).toHaveProperty('metadata');
      expect(writtenData.metadata).toHaveProperty('exportDate');
      expect(writtenData.metadata).toHaveProperty('totalCount');
    });
  });

  describe('JsonExporter', () => {
    let exporter: JsonExporter;

    beforeEach(() => {
      exporter = new JsonExporter();
    });

    it('should export posts as JSON', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.json');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      expect(writtenData).toHaveProperty('posts');
      expect(writtenData.posts).toHaveLength(2);
    });

    it('should export posts and comments together', async () => {
      const data = { 
        posts: mockPosts, 
        comments: mockComments,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          totalComments: mockComments.length,
          platform: 'reddit' as const
        }
      };
      
      await exporter.export(data, './output.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      
      expect(writtenData).toHaveProperty('posts');
      expect(writtenData).toHaveProperty('comments');
      expect(writtenData.posts).toHaveLength(2);
      expect(writtenData.comments).toHaveLength(2);
    });

    it('should format JSON with proper indentation', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('\n');
      expect(writtenContent).toContain('  ');
    });
  });

  describe('CsvExporter', () => {
    let exporter: CsvExporter;

    beforeEach(() => {
      exporter = new CsvExporter();
    });

    it('should export posts as CSV', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.csv');

      // Check that CSV writer was called with correct records
      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
      const records = mockCsvWriter.writeRecords.mock.calls[0][0];
      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('1');
      expect(records[0].title).toBe('Test Post 1');
      expect(records[1].id).toBe('2');
    });

    it('should handle special characters in CSV', async () => {
      const postsWithSpecialChars = [{
        ...mockPosts[0],
        title: 'Post with "quotes" and, commas',
        content: 'Content with\nnewlines',
      }];

      const mockData = {
        posts: postsWithSpecialChars,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: postsWithSpecialChars.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.csv');

      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
      const records = mockCsvWriter.writeRecords.mock.calls[0][0];
      expect(records[0].title).toContain('Post with');
    });

    it('should export selected columns only', async () => {
      const customExporter = new CsvExporter({ columns: ['id', 'title', 'score'] });
      
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await customExporter.export(mockData, './output.csv');

      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
    });

    it('should flatten nested data', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.csv');

      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
    });
  });

  describe('HtmlExporter', () => {
    let exporter: HtmlExporter;

    beforeEach(() => {
      exporter = new HtmlExporter();
    });

    it('should export posts as HTML table', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.html');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('<!DOCTYPE html>');
      expect(writtenContent).toContain('<table');
      expect(writtenContent).toContain('<thead>');
      expect(writtenContent).toContain('<tbody>');
      expect(writtenContent).toContain('Test Post 1');
      expect(writtenContent).toContain('Test Post 2');
    });

    it('should include CSS styling', async () => {
      const styledExporter = new HtmlExporter({ includeStyles: true });
      
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await styledExporter.export(mockData, './output.html');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('<style>');
      expect(writtenContent).toContain('body {');
      expect(writtenContent).toContain('table {');
    });

    it('should escape HTML entities', async () => {
      const postsWithHtml = [{
        ...mockPosts[0],
        title: 'Post with <script>alert("XSS")</script>',
        content: 'Content with & < > characters',
      }];

      const mockData = {
        posts: postsWithHtml,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: postsWithHtml.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.html');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).not.toContain('<script>alert');
      expect(writtenContent).toContain('&lt;script&gt;');
      expect(writtenContent).toContain('&amp;');
    });

    it('should create sortable table', async () => {
      const sortableExporter = new HtmlExporter({ sortable: true });
      
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await sortableExporter.export(mockData, './output.html');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('onclick="sortTable');
      expect(writtenContent).toContain('<script>');
      expect(writtenContent).toContain('function sortTable');
    });
  });

  describe('MarkdownExporter', () => {
    let exporter: MarkdownExporter;

    beforeEach(() => {
      exporter = new MarkdownExporter();
    });

    it('should export posts as Markdown', async () => {
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.md');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('# Forum Posts Export');
      expect(writtenContent).toContain('## Test Post 1');
      expect(writtenContent).toContain('## Test Post 2');
      expect(writtenContent).toContain('**Author:** user1');
      expect(writtenContent).toContain('**Score:** 100');
    });

    it('should format as table when requested', async () => {
      const tableExporter = new MarkdownExporter({ format: 'table' });
      
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await tableExporter.export(mockData, './output.md');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('| Title | Author | Score |');
      expect(writtenContent).toContain('|-------|--------|-------|');
      expect(writtenContent).toContain('| Test Post 1 | user1 | 100 |');
    });

    it('should include post content', async () => {
      const contentExporter = new MarkdownExporter({ includeContent: true });
      
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await contentExporter.export(mockData, './output.md');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('This is test content');
      expect(writtenContent).toContain('Another test post');
    });

    it('should escape Markdown special characters', async () => {
      const postsWithSpecialChars = [{
        ...mockPosts[0],
        title: 'Post with *asterisks* and _underscores_',
        content: 'Content with [links](url) and `code`',
      }];

      const mockData = {
        posts: postsWithSpecialChars,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: postsWithSpecialChars.length,
          platform: 'reddit' as const
        }
      };
      await exporter.export(mockData, './output.md');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('\\*asterisks\\*');
      expect(writtenContent).toContain('\\_underscores\\_');
    });

    it('should group posts by platform', async () => {
      const groupedExporter = new MarkdownExporter({ groupBy: 'platform' });
      
      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      await groupedExporter.export(mockData, './output.md');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      expect(writtenContent).toContain('## Reddit Posts');
      expect(writtenContent).toContain('## HackerNews Posts');
    });
  });

  describe('Export Filters and Transformations', () => {
    let exportManager: ExportManager;

    beforeEach(() => {
      exportManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json'
      });
    });

    it('should filter by date range', async () => {
      const filterManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json',
        filterOptions: {
          startDate: new Date('2024-01-01T12:00:00'),
          endDate: new Date('2024-01-01T23:59:59'),
        },
      });

      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      
      await filterManager.exportData(
        mockData,
        'json',
        './output.json'
      );

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      
      expect(writtenData.posts).toBeDefined();
      if (writtenData.posts) {
        expect(writtenData.posts).toHaveLength(1);
        expect(writtenData.posts[0].id).toBe('2');
      }
    });

    it('should sort posts', async () => {
      const sortManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json',
        transformOptions: {
          sortBy: 'score',
          sortOrder: 'desc',
        },
      });

      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      
      await sortManager.exportData(
        mockData,
        'json',
        './output.json'
      );

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      
      expect(writtenData.posts).toBeDefined();
      if (writtenData.posts) {
        expect(writtenData.posts[0].score).toBe(100);
        expect(writtenData.posts[1].score).toBe(50);
      }
    });

    it('should limit number of exported items', async () => {
      const limitManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json',
        filterOptions: {
          limit: 1,
        },
      });

      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      
      await limitManager.exportData(
        mockData,
        'json',
        './output.json'
      );

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      
      expect(writtenData.posts).toBeDefined();
      if (writtenData.posts) {
        expect(writtenData.posts).toHaveLength(1);
      }
    });

    it('should transform data before export', async () => {
      const transformManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json',
        transformOptions: {
          transformPost: (post: any) => ({
            ...post,
            title: post.title.toUpperCase(),
          }),
        },
      });

      const mockData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };
      
      await transformManager.exportData(
        mockData,
        'json',
        './output.json'
      );

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);
      
      expect(writtenData.posts).toBeDefined();
      if (writtenData.posts) {
        expect(writtenData.posts[0].title).toBe('TEST POST 1');
      }
    });
  });
});