import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server, resetHandlers } from '../mocks/server';
import { HackerNewsScraper } from '../../src/platforms/hackernews/scraper';
import { HackerNewsClient } from '../../src/platforms/hackernews/client';
import type { HackerNewsScraperConfig } from '../../src/platforms/hackernews/scraper';
import type { ForumPost, Comment, User } from '../../src/types/core';

describe('Hacker News Platform Integration Tests', () => {
  let scraper: HackerNewsScraper;
  let client: HackerNewsClient;

  const config: HackerNewsScraperConfig = {
    rateLimit: {
      requestsPerSecond: 1,
      requestsPerMinute: 30,
    },
  };

  beforeAll(async () => {
    // Start the MSW server
    server.listen({ onUnhandledRequest: 'error' });
    
    // Initialize the client and scraper
    client = new HackerNewsClient();
    scraper = new HackerNewsScraper(config);
    await scraper.initialize();
  });

  afterEach(() => {
    // Reset handlers between tests to ensure clean state
    resetHandlers();
  });

  afterAll(() => {
    // Clean up after all tests
    server.close();
  });

  describe('Initialization', () => {
    it('should initialize without authentication', async () => {
      // HN doesn't require authentication
      const authenticated = await scraper.authenticate();
      expect(authenticated).toBe(true);
      expect(scraper.isAuthValid()).toBe(true);
    });
  });

  describe('Story Scraping', () => {
    it('should scrape top stories', async () => {
      const posts = await scraper.scrapePosts({
        limit: 10,
        sortBy: 'hot',
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBeGreaterThan(0);
      expect(posts[0]).toMatchObject({
        platform: 'hackernews',
        author: expect.any(String),
        title: expect.any(String),
      });
    });

    it('should scrape new stories', async () => {
      const posts = await scraper.scrapePosts({
        limit: 10,
        sortBy: 'new',
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBeGreaterThan(0);
    });

    it('should scrape best stories', async () => {
      const posts = await scraper.scrapeCategory('best', {
        limit: 5,
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBeGreaterThan(0);
    });

    it('should scrape Ask HN stories', async () => {
      const posts = await scraper.scrapeCategory('ask', {
        limit: 5,
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBeGreaterThan(0);
      
      // Check if at least one has Ask HN in title
      const askPosts = posts.filter(p => p.title?.includes('Ask HN'));
      expect(askPosts.length).toBeGreaterThan(0);
    });

    it('should scrape Show HN stories', async () => {
      const posts = await scraper.scrapeCategory('show', {
        limit: 5,
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBeGreaterThan(0);
      
      // Check if at least one has Show HN in title
      const showPosts = posts.filter(p => p.title?.includes('Show HN'));
      expect(showPosts.length).toBeGreaterThan(0);
    });

    it('should scrape job stories', async () => {
      const posts = await scraper.scrapeCategory('jobs', {
        limit: 5,
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBeGreaterThan(0);
    });
  });

  describe('Single Post Scraping', () => {
    it('should scrape a single post by ID', async () => {
      const post = await scraper.scrapePost('12345');

      expect(post).toBeTruthy();
      expect(post).toMatchObject({
        id: '12345',
        title: 'Mock HN Story',
        author: 'mock_user',
        platform: 'hackernews',
        score: 100,
        commentCount: 15,
      });
    });

    it('should handle non-existent post IDs', async () => {
      const post = await scraper.scrapePost('99999');
      expect(post).toBeNull();
    });

    it('should handle text posts (Ask/Show HN)', async () => {
      const askPost = await scraper.scrapePost('12350');
      
      expect(askPost).toBeTruthy();
      expect(askPost?.content).toBeTruthy();
      expect(askPost?.content).toBe('This is the text of an Ask HN post');
    });

    it('should handle job posts', async () => {
      const jobPost = await scraper.scrapePost('12370');
      
      expect(jobPost).toBeTruthy();
      expect(jobPost).toMatchObject({
        title: expect.stringContaining('Is Hiring'),
        platform: 'hackernews',
      });
    });
  });

  describe('Comment Scraping', () => {
    it('should scrape comments for a story', async () => {
      const comments = await scraper.scrapeComments('12345', {
        limit: 100,
      });

      expect(comments).toBeDefined();
      expect(comments.length).toBeGreaterThan(0);
      expect(comments[0]).toMatchObject({
        author: expect.any(String),
        content: expect.any(String),
        platform: 'hackernews',
        postId: '12345',
      });
    });

    it('should handle nested comment threads', async () => {
      const comments = await scraper.scrapeComments('12345', {
        maxDepth: 5,
      });

      // Find comments with replies
      // Top-level comments have the postId as their parentId
      const topLevelComments = comments.filter(c => c.parentId === '12345');
      // Replies have other comment IDs as their parentId
      const replies = comments.filter(c => c.parentId && c.parentId !== '12345');

      expect(topLevelComments.length).toBeGreaterThan(0);
      expect(replies.length).toBeGreaterThan(0);
      
      // Check parent-child relationship
      const parentComment = comments.find(c => c.id === '12346');
      const childComment = comments.find(c => c.parentId === '12346');
      
      expect(parentComment).toBeTruthy();
      expect(childComment).toBeTruthy();
    });

    it('should respect maxDepth parameter', async () => {
      const comments = await scraper.scrapeComments('12345', {
        maxDepth: 1,
      });

      // All comments should have depth <= 1
      comments.forEach(comment => {
        if (comment.depth !== undefined) {
          expect(comment.depth).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('User Scraping', () => {
    it('should scrape user profile', async () => {
      const user = await scraper.scrapeUser('mock_user');

      expect(user).toBeTruthy();
      expect(user).toMatchObject({
        username: 'mock_user',
        platform: 'hackernews',
        karma: 5000,
        createdAt: expect.any(Date),
      });
    });

    it('should handle non-existent users', async () => {
      const user = await scraper.scrapeUser('nonexistent');
      expect(user).toBeNull();
    });

    it('should include user metadata', async () => {
      const user = await scraper.scrapeUser('mock_user');
      
      expect(user?.metadata).toBeDefined();
      expect(user?.metadata?.about).toBe('Mock user bio');
    });
  });

  describe('Search Functionality', () => {
    it('should search for stories', async () => {
      const results = await scraper.search('javascript', {
        limit: 10,
        sortBy: 'relevance',
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toMatchObject({
        title: expect.stringContaining('Search result'),
        platform: 'hackernews',
      });
    });

    it('should search with date sorting', async () => {
      const results = await scraper.search('typescript', {
        limit: 10,
        sortBy: 'new',
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Check if results are sorted by date (newest first)
      if (results.length > 1) {
        const firstDate = results[0].createdAt;
        const secondDate = results[1].createdAt;
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });

    it('should handle search with pagination', async () => {
      const result = await scraper.searchWithPagination('programming', {
        limit: 50,
        maxPages: 3,
      });

      expect(result.posts).toBeDefined();
      expect(result.paginationState).toBeDefined();
    });
  });

  describe('Trending Content', () => {
    it('should fetch trending stories', async () => {
      const trending = await scraper.getTrending({
        limit: 10,
      });

      expect(trending).toBeDefined();
      expect(trending.length).toBeGreaterThan(0);
      expect(trending[0]).toMatchObject({
        platform: 'hackernews',
        score: expect.any(Number),
      });
    });
  });

  describe('Data Transformation', () => {
    it('should correctly transform HN items to ForumPost format', async () => {
      const post = await scraper.scrapePost('12345');
      
      expect(post).toMatchObject({
        id: '12345',
        title: expect.any(String),
        author: expect.any(String),
        platform: 'hackernews',
        createdAt: expect.any(Date),
        score: expect.any(Number),
        commentCount: expect.any(Number),
        url: expect.any(String),
      });
    });

    it('should correctly transform comments', async () => {
      const comments = await scraper.scrapeComments('12345');
      
      comments.forEach(comment => {
        expect(comment).toMatchObject({
          id: expect.any(String),
          content: expect.any(String),
          author: expect.any(String),
          platform: 'hackernews',
          createdAt: expect.any(Date),
          postId: '12345',
        });
      });
    });

    it('should handle HN-specific fields', async () => {
      const post = await scraper.scrapePost('12345');
      
      // Check HN-specific metadata
      if (post?.metadata) {
        expect(post.metadata).toMatchObject({
          type: expect.any(String),
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle API timeouts gracefully', async () => {
      // This would normally timeout but MSW can simulate it
      try {
        await client.getItem(99999); // Non-existent item
      } catch (error) {
        // Should handle gracefully
        expect(error).toBeDefined();
      }
    });

    it('should retry failed requests', async () => {
      let attemptCount = 0;
      
      // Mock the client's getItem method to simulate network failures
      const originalGetItem = scraper['client'].getItem;
      scraper['client'].getItem = vi.fn().mockImplementation(async (id: number) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Network error');
        }
        return originalGetItem.call(scraper['client'], id);
      });

      const post = await scraper.scrapePost('12345');
      expect(post).toBeTruthy();
      expect(attemptCount).toBeGreaterThanOrEqual(2);

      // Restore the original method
      scraper['client'].getItem = originalGetItem;
    });
  });

  describe('Connection Testing', () => {
    it('should successfully test HN connection', async () => {
      const isConnected = await scraper.testConnection();
      expect(isConnected).toBe(true);
    });
  });

  describe('Platform Capabilities', () => {
    it('should report correct platform capabilities', () => {
      const capabilities = scraper.getCapabilities();
      
      expect(capabilities).toMatchObject({
        supportsCommentThreads: true,
        supportsUserProfiles: true,
        supportsSearch: true,
        supportsCategories: true,
        supportsPagination: true,
        supportsRealtime: false,
        maxCommentDepth: expect.any(Number),
        rateLimit: {
          requestsPerSecond: 1,
          requestsPerMinute: 30,
        },
      });
    });

    it('should identify as Hacker News platform', () => {
      expect(scraper.getPlatformName()).toBe('hackernews');
    });
  });

  describe('Real-time Features', () => {
    it('should get maximum item ID', async () => {
      const maxId = await client.getMaxItem();
      expect(maxId).toBe(20000); // Based on mock
    });
  });

  describe('Batch Operations', () => {
    it('should fetch multiple items efficiently', async () => {
      const ids = [12345, 12346, 12347, 12348];
      const items = await client.getItems(ids);
      
      expect(items).toHaveLength(4);
      items.forEach((item, index) => {
        expect(item.id).toBe(ids[index]);
      });
    });
  });
});