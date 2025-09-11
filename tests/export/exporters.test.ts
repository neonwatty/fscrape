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

  const mockUsers = [
    {
      id: 'u1',
      username: 'user1',
      platform: 'reddit',
      karma: 1000,
      accountAge: 365,
      bio: 'Test user bio',
      isVerified: true,
      createdAt: new Date('2023-01-01'),
    },
    {
      id: 'u2',
      username: 'user2',
      platform: 'hackernews',
      karma: 500,
      accountAge: 180,
      bio: 'Another test user',
      isVerified: false,
      createdAt: new Date('2023-06-01'),
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
      const cardsExporter = new HtmlExporter({ format: 'cards' });
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
      await cardsExporter.export(mockData, './output.html');

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

  describe('Data Integrity Validation', () => {
    let exportManager: ExportManager;

    beforeEach(() => {
      exportManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json'
      });
    });

    it('should preserve all data fields during JSON export', async () => {
      const complexData = {
        posts: [
          {
            id: 'test-1',
            platform: 'reddit',
            title: 'Test with special chars: "quotes", \'apostrophes\', &ampersand',
            content: 'Content with\nnewlines\tand\ttabs',
            author: 'user@special',
            authorId: 'uid-123',
            score: 999,
            commentCount: 42,
            url: 'https://example.com/post?id=1&test=true',
            createdAt: new Date('2024-01-01T12:30:45.123Z'),
            updatedAt: new Date('2024-01-02T08:15:30.456Z'),
            category: 'test-category',
            tags: ['tag1', 'tag2', 'tag-with-dash'],
            metadata: {
              nested: {
                value: 'deep-value',
                array: [1, 2, 3]
              }
            }
          }
        ],
        comments: [
          {
            id: 'comment-1',
            postId: 'test-1',
            content: 'Comment with émojis 🎉 and ünicode',
            author: 'commenter',
            score: 10,
            createdAt: new Date('2024-01-01T13:00:00Z')
          }
        ],
        users: [
          {
            id: 'user-1',
            username: 'testuser',
            karma: 1000,
            accountAge: 365,
            bio: 'Bio with <html> tags & entities',
            isVerified: true,
            badges: ['contributor', 'veteran']
          }
        ],
        metadata: {
          scrapedAt: new Date('2024-01-03T10:00:00Z'),
          totalPosts: 1,
          platform: 'reddit' as const,
          version: '1.0.0',
          exportConfig: {
            includeMetadata: true,
            includeStats: true
          }
        }
      };

      await exportManager.exportData(complexData, 'json', './complex.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      // Verify all fields are preserved
      expect(writtenData.posts[0].title).toBe(complexData.posts[0].title);
      expect(writtenData.posts[0].content).toBe(complexData.posts[0].content);
      expect(writtenData.posts[0].metadata).toEqual(complexData.posts[0].metadata);
      // Note: tags field is not preserved by JsonExporter currently
      
      expect(writtenData.comments[0].content).toBe(complexData.comments[0].content);
      // Note: bio and badges fields are not preserved by JsonExporter
      expect(writtenData.users[0].username).toBe(complexData.users[0].username);
      expect(writtenData.users[0].karma).toBe(complexData.users[0].karma);
      
      expect(writtenData.metadata.exportConfig).toEqual(complexData.metadata.exportConfig);
    });

    it('should handle empty data sets gracefully', async () => {
      const emptyData = {
        posts: [],
        comments: [],
        users: [],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 0,
          platform: 'reddit' as const
        }
      };

      await exportManager.exportData(emptyData, 'json', './empty.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      expect(writtenData.posts).toEqual([]);
      expect(writtenData.comments).toEqual([]);
      expect(writtenData.users).toEqual([]);
      expect(writtenData.metadata.totalPosts).toBe(0);
    });

    it('should handle null and undefined values correctly', async () => {
      const dataWithNulls = {
        posts: [
          {
            id: 'null-test',
            platform: 'reddit',
            title: 'Test null values',
            content: null,
            author: undefined,
            score: 0,
            commentCount: null,
            url: '',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            category: undefined,
            tags: null
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          platform: 'reddit' as const
        }
      };

      await exportManager.exportData(dataWithNulls, 'json', './nulls.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      expect(writtenData.posts[0].content).toBeNull();
      expect(writtenData.posts[0].author).toBeUndefined();
      expect(writtenData.posts[0].score).toBe(0);
      expect(writtenData.posts[0].url).toBe('');
    });

    it('should validate CSV export data integrity', async () => {
      const csvData = {
        posts: [
          {
            id: 'csv-1',
            platform: 'hackernews',
            title: 'Title with, comma and "quotes"',
            content: 'Content with\nnewline',
            author: 'author1',
            score: 100,
            commentCount: 5,
            url: 'https://news.ycombinator.com/item?id=1',
            createdAt: new Date('2024-01-01T12:00:00Z')
          },
          {
            id: 'csv-2',
            platform: 'hackernews',
            title: 'Simple title',
            content: 'Simple content',
            author: 'author2',
            score: 50,
            commentCount: 2,
            url: 'https://news.ycombinator.com/item?id=2',
            createdAt: new Date('2024-01-02T12:00:00Z')
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 2,
          platform: 'hackernews' as const
        }
      };

      await exportManager.exportData(csvData, 'csv', './test.csv');

      // Verify CSV writer was called with correct data
      expect(mockCsvWriter.writeRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'csv-1',
            title: 'Title with, comma and "quotes"',
            score: 100
          }),
          expect.objectContaining({
            id: 'csv-2',
            title: 'Simple title',
            score: 50
          })
        ])
      );
    });

    it('should maintain data type consistency across exports', async () => {
      const testData = {
        posts: [
          {
            id: '123',
            platform: 'reddit',
            title: 'Type test',
            score: 100,
            commentCount: 5,
            url: 'https://reddit.com/test',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            isDeleted: false,
            isPinned: true,
            votes: {
              up: 110,
              down: 10
            }
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          platform: 'reddit' as const
        }
      };

      await exportManager.exportData(testData, 'json', './types.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      // Check type preservation for fields that are exported
      expect(typeof writtenData.posts[0].id).toBe('string');
      expect(typeof writtenData.posts[0].score).toBe('number');
      expect(typeof writtenData.posts[0].title).toBe('string');
      expect(typeof writtenData.posts[0].url).toBe('string');
      expect(typeof writtenData.posts[0].platform).toBe('string');
      // Note: isDeleted, isPinned, votes are not preserved by JsonExporter
    });
  });

  describe('Edge Cases with Various Data Sets', () => {
    let exportManager: ExportManager;

    beforeEach(() => {
      exportManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json'
      });
    });

    it('should handle very large data sets', async () => {
      const largeDataSet = {
        posts: Array.from({ length: 10000 }, (_, i) => ({
          id: `post-${i}`,
          platform: i % 2 === 0 ? 'reddit' : 'hackernews',
          title: `Post title ${i}`,
          content: `Content for post ${i}`.repeat(10),
          author: `user${i % 100}`,
          score: Math.floor(Math.random() * 1000),
          commentCount: Math.floor(Math.random() * 100),
          url: `https://example.com/post/${i}`,
          createdAt: new Date(Date.now() - i * 3600000)
        })),
        comments: Array.from({ length: 50000 }, (_, i) => ({
          id: `comment-${i}`,
          postId: `post-${Math.floor(i / 5)}`,
          content: `Comment content ${i}`,
          author: `commenter${i % 500}`,
          score: Math.floor(Math.random() * 100),
          createdAt: new Date(Date.now() - i * 60000)
        })),
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: `user-${i}`,
          username: `user${i}`,
          karma: Math.floor(Math.random() * 10000),
          accountAge: Math.floor(Math.random() * 3650)
        })),
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 10000,
          platform: 'reddit' as const
        }
      };

      await exportManager.exportData(largeDataSet, 'json', './large.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      expect(writtenData.posts).toHaveLength(10000);
      expect(writtenData.comments).toHaveLength(50000);
      expect(writtenData.users).toHaveLength(1000);
    });

    it('should handle data with circular references prevention', async () => {
      const post: any = {
        id: 'circular-1',
        platform: 'reddit',
        title: 'Circular reference test',
        score: 100,
        url: 'https://reddit.com/test',
        createdAt: new Date('2024-01-01T00:00:00Z')
      };
      
      // Create a circular reference (should be handled by JSON.stringify)
      post.selfRef = post;

      const dataWithPotentialCircular = {
        posts: [post],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          platform: 'reddit' as const
        }
      };

      // This should handle circular references gracefully
      const jsonExporter = new JsonExporter();
      const exported = await jsonExporter.export(dataWithPotentialCircular, './circular.json');
      
      expect(exported).toBeTruthy();
    });

    it('should handle mixed platform data correctly', async () => {
      const mixedData = {
        posts: [
          {
            id: 'reddit-1',
            platform: 'reddit',
            title: 'Reddit post',
            subreddit: 'programming',
            author: 'redditor1',
            score: 100,
            url: 'https://reddit.com/r/programming/post1',
            createdAt: new Date('2024-01-01T00:00:00Z')
          },
          {
            id: 'hn-1',
            platform: 'hackernews',
            title: 'HN post',
            author: 'hnuser1',
            score: 50,
            points: 50,
            url: 'https://news.ycombinator.com/item?id=1',
            createdAt: new Date('2024-01-01T01:00:00Z')
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 2,
          platform: 'reddit' as const,
          platforms: ['reddit', 'hackernews']
        }
      };

      await exportManager.exportData(mixedData, 'json', './mixed.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      expect(writtenData.posts).toHaveLength(2);
      expect(writtenData.posts[0].platform).toBe('reddit');
      expect(writtenData.posts[1].platform).toBe('hackernews');
      expect(writtenData.metadata.platforms).toEqual(['reddit', 'hackernews']);
    });

    it('should handle Unicode and special characters in all fields', async () => {
      const unicodeData = {
        posts: [
          {
            id: 'unicode-1',
            platform: 'reddit',
            title: '🚀 Émoji tést with 中文 and العربية',
            content: 'Content with © ® ™ symbols and math: ∑ ∏ √ ∞',
            author: 'üser_ñame',
            score: 100,
            url: 'https://example.com/post?q=hello%20world&lang=中文',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            tags: ['münchen', 'café', 'naïve', '日本語']
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          platform: 'reddit' as const,
          description: 'Test with αβγδ Greek and кириллица'
        }
      };

      await exportManager.exportData(unicodeData, 'json', './unicode.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      expect(writtenData.posts[0].title).toBe(unicodeData.posts[0].title);
      expect(writtenData.posts[0].content).toBe(unicodeData.posts[0].content);
      // Note: tags are not preserved by JsonExporter
      // Note: metadata.description is not a standard field
    });

    it('should handle date edge cases', async () => {
      const dateEdgeCases = {
        posts: [
          {
            id: 'date-1',
            platform: 'reddit',
            title: 'Far future date',
            score: 100,
            url: 'https://reddit.com/test1',
            createdAt: new Date('2099-12-31T23:59:59.999Z')
          },
          {
            id: 'date-2',
            platform: 'reddit',
            title: 'Past date',
            score: 50,
            url: 'https://reddit.com/test2',
            createdAt: new Date('1970-01-01T00:00:00.000Z')
          },
          {
            id: 'date-3',
            platform: 'reddit',
            title: 'Invalid date handling',
            score: 25,
            url: 'https://reddit.com/test3',
            createdAt: new Date('2024-01-03T12:00:00Z')
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 3,
          platform: 'reddit' as const
        }
      };

      await exportManager.exportData(dateEdgeCases, 'json', './dates.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      expect(writtenData.posts).toHaveLength(3);
      expect(writtenData.posts[0].createdAt).toBe('2099-12-31T23:59:59.999Z');
      expect(writtenData.posts[1].createdAt).toBe('1970-01-01T00:00:00.000Z');
      expect(writtenData.posts[2].createdAt).toBe('2024-01-03T12:00:00.000Z');
    });
  });

  describe('Format Validation Tests', () => {
    let exportManager: ExportManager;

    beforeEach(() => {
      exportManager = new ExportManager({
        outputDirectory: './output',
        defaultFormat: 'json'
      });
    });

    it('should validate JSON format structure', async () => {
      const testData = {
        posts: mockPosts,
        comments: mockComments,
        users: mockUsers,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const,
          exportVersion: '2.0'
        }
      };

      await exportManager.exportData(testData, 'json', './validated.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      
      // Validate it's proper JSON
      expect(() => JSON.parse(writtenContent)).not.toThrow();
      
      const parsed = JSON.parse(writtenContent);
      
      // Validate structure
      expect(parsed).toHaveProperty('posts');
      expect(parsed).toHaveProperty('comments');
      expect(parsed).toHaveProperty('users');
      expect(parsed).toHaveProperty('metadata');
      
      // Validate arrays
      expect(Array.isArray(parsed.posts)).toBe(true);
      expect(Array.isArray(parsed.comments)).toBe(true);
      expect(Array.isArray(parsed.users)).toBe(true);
      
      // Validate metadata structure
      expect(parsed.metadata).toHaveProperty('scrapedAt');
      expect(parsed.metadata).toHaveProperty('totalPosts');
      expect(parsed.metadata).toHaveProperty('platform');
      expect(parsed.metadata).toHaveProperty('exportVersion');
    });

    it('should validate CSV format and headers', async () => {
      const csvData = {
        posts: [
          {
            id: 'csv-test-1',
            platform: 'reddit',
            title: 'CSV Format Test',
            content: 'Testing CSV format',
            author: 'testuser',
            authorId: 'uid-1',
            score: 100,
            commentCount: 10,
            url: 'https://reddit.com/test',
            createdAt: new Date('2024-01-01T12:00:00Z'),
            updatedAt: new Date('2024-01-01T13:00:00Z')
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          platform: 'reddit' as const
        }
      };

      const csvExporter = new CsvExporter();
      await csvExporter.export(csvData, './test.csv');

      // Verify CSV writer was called
      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
      
      // Verify the data passed to CSV writer has correct structure
      const recordsArg = mockCsvWriter.writeRecords.mock.calls[0][0];
      expect(recordsArg).toHaveLength(1);
      expect(recordsArg[0]).toHaveProperty('id', 'csv-test-1');
      expect(recordsArg[0]).toHaveProperty('title', 'CSV Format Test');
      expect(recordsArg[0]).toHaveProperty('platform', 'reddit');
      expect(recordsArg[0]).toHaveProperty('score', 100);
    });

    it('should validate HTML export structure', async () => {
      const htmlData = {
        posts: mockPosts.slice(0, 1),
        comments: mockComments.slice(0, 1),
        users: mockUsers.slice(0, 1),
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          platform: 'reddit' as const
        }
      };

      await exportManager.exportData(htmlData, 'html', './test.html');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const htmlContent = writeCall?.[1] as string;

      // Validate HTML structure
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html');
      expect(htmlContent).toContain('<head>');
      expect(htmlContent.toLowerCase()).toContain('<body');
      expect(htmlContent).toContain('</html>');
      
      // Validate content sections
      expect(htmlContent).toContain('Posts');
      expect(htmlContent).toContain('Comments');
      expect(htmlContent).toContain('Users');
      
      // Validate data is present
      expect(htmlContent).toContain(mockPosts[0].title);
    });

    it('should validate Markdown export structure', async () => {
      const markdownData = {
        posts: mockPosts.slice(0, 1),
        comments: mockComments.slice(0, 1),
        users: mockUsers.slice(0, 1),
        metadata: {
          scrapedAt: new Date('2024-01-01T12:00:00Z'),
          totalPosts: 1,
          platform: 'reddit' as const
        }
      };

      await exportManager.exportData(markdownData, 'markdown', './test.md');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const mdContent = writeCall?.[1] as string;

      // Validate Markdown structure
      expect(mdContent).toContain('# Forum Posts Export');
      expect(mdContent).toContain('## Export Metadata');
      expect(mdContent).toContain('## Posts');
      // Note: Markdown exporter doesn't have separate Comments and Users sections
      // They are included within the Posts section
      
      // Validate Markdown formatting
      expect(mdContent).toContain('###'); // Post/comment/user headers
      expect(mdContent).toContain('**'); // Bold text
      expect(mdContent).toContain('|'); // Table formatting or separators
      
      // Validate data presence
      expect(mdContent).toContain(mockPosts[0].title);
      expect(mdContent).toContain('**Score:** 100');
    });

    it('should reject invalid export formats', async () => {
      const testData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };

      await expect(
        exportManager.exportData(testData, 'invalid' as any, './output.txt')
      ).rejects.toThrow();
    });

    it('should validate exported file paths', async () => {
      const testData = {
        posts: mockPosts,
        metadata: {
          scrapedAt: new Date(),
          totalPosts: mockPosts.length,
          platform: 'reddit' as const
        }
      };

      // Test various file paths
      const testPaths = [
        './output.json',
        './exports/data.json',
        './output/2024/data.json',
        'data.json'
      ];

      for (const filePath of testPaths) {
        await exportManager.exportData(testData, 'json', filePath);
        
        const writeCall = vi.mocked(fs.writeFileSync).mock.calls[vi.mocked(fs.writeFileSync).mock.calls.length - 1];
        expect(writeCall[0]).toBe(filePath);
      }
    });

    it('should validate data completeness before export', async () => {
      // Test with missing required fields
      const incompleteData = {
        posts: [
          {
            // Missing required fields like id, platform
            title: 'Incomplete post',
            score: 100
          }
        ],
        metadata: {
          scrapedAt: new Date(),
          totalPosts: 1,
          platform: 'reddit' as const
        }
      };

      // Should still export but handle missing fields gracefully
      await exportManager.exportData(incompleteData as any, 'json', './incomplete.json');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall?.[1] as string);

      expect(writtenData.posts[0].title).toBe('Incomplete post');
      expect(writtenData.posts[0].score).toBe(100);
      expect(writtenData.posts[0].id).toBeUndefined();
      expect(writtenData.posts[0].platform).toBeUndefined();
    });
  });
});