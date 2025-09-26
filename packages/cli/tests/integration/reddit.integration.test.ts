import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server, resetHandlers } from '../mocks/server';
import { RedditScraper } from '../../src/platforms/reddit/scraper';
import { RedditClient } from '../../src/platforms/reddit/client';
import type { RedditScraperConfig } from '../../src/platforms/reddit/scraper';
import type { ForumPost, Comment, User } from '../../src/types/core';

describe('Reddit Platform Integration Tests', () => {
  let scraper: RedditScraper;
  let client: RedditClient;

  const config: RedditScraperConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    userAgent: 'test-user-agent',
    username: 'test-username',
    password: 'test-password',
    rateLimit: {
      requestsPerSecond: 1,
      requestsPerMinute: 30,
    },
  };

  beforeAll(async () => {
    // Start the MSW server
    server.listen({ onUnhandledRequest: 'error' });
    
    // Initialize the client and scraper
    client = new RedditClient(config);
    scraper = new RedditScraper(config);
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

  describe('Authentication Flow', () => {
    it('should successfully authenticate with Reddit API', async () => {
      const isAuthenticated = await scraper.authenticate();
      expect(isAuthenticated).toBe(true);
      expect(scraper.isAuthValid()).toBe(true);
    });

    it('should refresh authentication token when needed', async () => {
      const refreshed = await scraper.refreshAuth();
      expect(refreshed).toBe(true);
    });
  });

  describe('Post Scraping', () => {
    it('should scrape posts from a subreddit', async () => {
      const posts = await scraper.scrapeCategory('programming', {
        limit: 10,
        sortBy: 'hot',
      });

      expect(posts).toHaveLength(2); // Based on mock data
      expect(posts[0]).toMatchObject({
        title: expect.stringContaining('Mock hot post'),
        author: 'mock_user',
        platform: 'reddit',
        category: 'programming',
      });
    });

    it('should scrape a single post by ID', async () => {
      const post = await scraper.scrapePost('post1');

      expect(post).toBeTruthy();
      expect(post).toMatchObject({
        id: 'post1',
        title: 'Mock post by ID',
        content: 'Post content retrieved by ID',
        platform: 'reddit',
      });
    });

    it('should handle post not found gracefully', async () => {
      const post = await scraper.scrapePost('notfound');
      expect(post).toBeNull();
    });

    it('should scrape posts with pagination', async () => {
      const result = await scraper.scrapeCategoryWithPagination('technology', {
        limit: 50,
        maxPages: 3,
      });

      expect(result.posts).toBeDefined();
      expect(result.paginationState).toBeDefined();
      expect(result.paginationState.hasMore).toBeDefined();
    });
  });

  describe('Comment Scraping', () => {
    it('should scrape comments for a post', async () => {
      const comments = await scraper.scrapeComments('post1', {
        limit: 100,
      });

      expect(comments.length).toBeGreaterThan(0);
      expect(comments[0]).toMatchObject({
        author: expect.any(String),
        content: expect.any(String),
        platform: 'reddit',
      });
    });

    it('should handle nested comment threads', async () => {
      const comments = await scraper.scrapeComments('post1', {
        maxDepth: 5,
      });

      // Check for parent-child relationships
      const topLevelComments = comments.filter(c => !c.parentId || c.parentId === null);
      const replies = comments.filter(c => c.parentId && c.parentId !== null);

      expect(topLevelComments.length).toBeGreaterThan(0);
      expect(replies.length).toBeGreaterThan(0);
    });
  });

  describe('User Scraping', () => {
    it('should scrape user profile information', async () => {
      const user = await scraper.scrapeUser('mock_user');

      expect(user).toBeTruthy();
      expect(user).toMatchObject({
        username: 'mock_user',
        platform: 'reddit',
        karma: expect.any(Number),
      });
    });

    it('should handle non-existent users', async () => {
      const user = await scraper.scrapeUser('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('Search Functionality', () => {
    it('should search for posts', async () => {
      const posts = await scraper.search('javascript', {
        limit: 10,
        sortBy: 'relevance',
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBeGreaterThan(0);
      expect(posts[0]).toMatchObject({
        title: expect.stringContaining('Search result'),
        platform: 'reddit',
      });
    });

    it('should search with pagination', async () => {
      const result = await scraper.searchWithPagination('typescript', {
        limit: 100,
        maxPages: 5,
      });

      expect(result.posts).toBeDefined();
      expect(result.paginationState).toBeDefined();
    });
  });

  describe('Trending Content', () => {
    it('should fetch trending posts', async () => {
      const trending = await scraper.getTrending({
        limit: 25,
      });

      expect(trending).toBeDefined();
      expect(trending.length).toBeGreaterThan(0);
      expect(trending[0]).toMatchObject({
        platform: 'reddit',
        score: expect.any(Number),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting gracefully', async () => {
      // Add rate limit header to trigger rate limiting
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url, options) => {
        return originalFetch(url, {
          ...options,
          headers: {
            ...options?.headers,
            'X-Test-Rate-Limit': 'true',
          },
        });
      });

      try {
        await scraper.scrapeCategory('test');
      } catch (error: any) {
        expect(error.code).toBe('RATE_LIMIT');
      }

      global.fetch = originalFetch;
    });

    it('should retry failed requests with exponential backoff', async () => {
      let attemptCount = 0;
      const originalFetch = global.fetch;
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        attemptCount++;
        if (attemptCount < 3) {
          const error: any = new Error('Connection reset');
          error.code = 'ECONNRESET';
          return Promise.reject(error);
        }
        return originalFetch(url, options);
      });

      try {
        const posts = await scraper.scrapeCategory('test', { limit: 5 });
        expect(posts).toBeDefined();
        expect(attemptCount).toBeGreaterThanOrEqual(3);
      } finally {
        global.fetch = originalFetch;
      }
    }, 30000);
  });

  describe('Data Transformation', () => {
    it('should correctly transform Reddit posts to ForumPost format', async () => {
      const posts = await scraper.scrapeCategory('programming');
      
      posts.forEach(post => {
        expect(post).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          author: expect.any(String),
          platform: 'reddit',
          createdAt: expect.any(Date),
          score: expect.any(Number),
          commentCount: expect.any(Number),
        });

        // Check optional fields
        if (post.category) {
          expect(typeof post.category).toBe('string');
        }
        if (post.tags) {
          expect(Array.isArray(post.tags)).toBe(true);
        }
        if (post.metadata) {
          expect(typeof post.metadata).toBe('object');
        }
      });
    });

    it('should correctly transform comments', async () => {
      const comments = await scraper.scrapeComments('post1');
      
      comments.forEach(comment => {
        expect(comment).toMatchObject({
          id: expect.any(String),
          content: expect.any(String),
          author: expect.any(String),
          platform: 'reddit',
          createdAt: expect.any(Date),
          score: expect.any(Number),
        });

        // Check optional fields
        if (comment.parentId) {
          expect(typeof comment.parentId).toBe('string');
        }
        if (comment.depth !== undefined) {
          expect(typeof comment.depth).toBe('number');
        }
      });
    });
  });

  describe('Connection Testing', () => {
    it('should successfully test Reddit connection', async () => {
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
      });
    });

    it('should identify as Reddit platform', () => {
      expect(scraper.getPlatformName()).toBe('reddit');
    });
  });
});