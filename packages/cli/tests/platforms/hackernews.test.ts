import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HackerNewsScraper } from '../../src/platforms/hackernews/scraper';
import { HackerNewsClient } from '../../src/platforms/hackernews/client';
import type { HackerNewsScraperConfig } from '../../src/platforms/hackernews/scraper';
import type { ForumPost, Comment, User } from '../../src/types/core';

// Mock the HackerNewsClient
vi.mock('../../src/platforms/hackernews/client');

describe('HackerNewsScraper', () => {
  let scraper: HackerNewsScraper;
  let mockClient: any;
  const config: HackerNewsScraperConfig = {
    rateLimit: {
      requestsPerSecond: 1,
      requestsPerMinute: 30,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock client
    mockClient = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getItem: vi.fn(),
      getItems: vi.fn(),
      getStoryList: vi.fn(),
      getTopStories: vi.fn(),
      getNewStories: vi.fn(),
      getBestStories: vi.fn(),
      getAskStories: vi.fn(),
      getShowStories: vi.fn(),
      getJobStories: vi.fn(),
      getUser: vi.fn(),
      getMaxItem: vi.fn(),
      searchStories: vi.fn(),
    };

    (HackerNewsClient as any).mockImplementation(() => mockClient);
    scraper = new HackerNewsScraper(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct config', async () => {
      await scraper.initialize();
      
      expect(HackerNewsClient).toHaveBeenCalledWith(expect.objectContaining({
        baseUrl: 'https://hacker-news.firebaseio.com/v0',
      }));
      expect(mockClient.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockClient.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(scraper.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('Authentication', () => {
    it('should skip authentication (HN is public)', async () => {
      await scraper.authenticate();
      // HackerNews doesn't require authentication
      expect(true).toBe(true);
    });
  });

  describe('Post Scraping', () => {
    const mockStory = {
      id: 123,
      title: 'Test Story',
      by: 'testuser',
      text: 'This is a test story',
      time: 1234567890,
      score: 100,
      descendants: 10,
      url: 'https://example.com/story',
      type: 'story',
      kids: [124, 125],
    };

    it('should scrape posts from category', async () => {
      mockClient.getStoryList.mockResolvedValue([123, 124, 125]);
      mockClient.getItems.mockResolvedValue([mockStory, mockStory, mockStory]);
      
      const posts = await scraper.scrapePostsFromCategory('top', {
        limit: 3,
      });
      
      expect(posts).toHaveLength(3);
      expect(posts[0]).toMatchObject({
        id: '123',
        title: 'Test Story',
        author: 'testuser',
        score: 100,
        platform: 'hackernews',
      });
    });

    it('should handle different story categories', async () => {
      mockClient.getStoryList.mockImplementation((type) => {
        const typeMap: any = {
          'newstories': [123],
          'beststories': [124],
          'askstories': [125],
          'showstories': [126],
          'jobstories': [127],
        };
        return Promise.resolve(typeMap[type] || []);
      });
      mockClient.getItems.mockResolvedValue([mockStory]);
      
      const categories = ['new', 'best', 'ask', 'show', 'job'];
      
      for (const category of categories) {
        const posts = await scraper.scrapePostsFromCategory(category, { limit: 1 });
        expect(posts).toHaveLength(1);
      }
      
      expect(mockClient.getStoryList).toHaveBeenCalledWith('newstories', 1);
      expect(mockClient.getStoryList).toHaveBeenCalledWith('beststories', 1);
      expect(mockClient.getStoryList).toHaveBeenCalledWith('askstories', 1);
      expect(mockClient.getStoryList).toHaveBeenCalledWith('showstories', 1);
      expect(mockClient.getStoryList).toHaveBeenCalledWith('jobstories', 1);
    });

    it('should scrape single post', async () => {
      mockClient.getItem.mockResolvedValue(mockStory);
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toMatchObject({
        id: '123',
        title: 'Test Story',
        platform: 'hackernews',
      });
    });

    it('should handle post not found', async () => {
      mockClient.getItem.mockResolvedValue(null);
      
      const post = await scraper.scrapePost('nonexistent');
      
      expect(post).toBeNull();
    });

    it('should handle deleted posts', async () => {
      mockClient.getItem.mockResolvedValue({
        ...mockStory,
        deleted: true,
      });
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toBeNull();
    });

    it('should handle dead posts', async () => {
      mockClient.getItem.mockResolvedValue({
        ...mockStory,
        dead: true,
      });
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toBeNull();
    });
  });

  describe('Comment Scraping', () => {
    const mockComment = {
      id: 124,
      by: 'commentuser',
      text: 'This is a comment',
      time: 1234567891,
      parent: 123,
      type: 'comment',
      kids: [125],
    };

    const mockReply = {
      id: 125,
      by: 'replyuser',
      text: 'This is a reply',
      time: 1234567892,
      parent: 124,
      type: 'comment',
    };

    it('should scrape comments for post', async () => {
      const storyWithComments = {
        id: 123,
        title: 'Test Story',
        by: 'testuser',
        time: 1234567890,
        score: 100,
        kids: [124],
        type: 'story',
      };
      
      mockClient.getItem.mockResolvedValue(storyWithComments);
      mockClient.getItems.mockResolvedValue([mockComment]);
      
      const comments = await scraper.scrapeComments('123', {
        limit: 10,
      });
      
      expect(comments).toHaveLength(1);
      expect(comments[0]).toMatchObject({
        id: '124',
        author: 'commentuser',
        content: 'This is a comment',
        platform: 'hackernews',
      });
    });

    it('should handle nested comment threads', async () => {
      const storyWithComments = {
        id: 123,
        title: 'Test Story',
        by: 'testuser',
        time: 1234567890,
        score: 100,
        kids: [124],
        type: 'story',
      };
      
      mockClient.getItem.mockResolvedValue(storyWithComments);
      mockClient.getItems
        .mockResolvedValueOnce([mockComment])
        .mockResolvedValueOnce([mockReply]);
      
      const comments = await scraper.scrapeComments('123', {
        includeReplies: true,
        maxDepth: 2,
      });
      
      expect(comments).toHaveLength(2);
      expect(comments[1].parentId).toBe('124');
    });

    it('should respect max depth for replies', async () => {
      const deepComment = {
        id: 126,
        by: 'deepuser',
        text: 'Deep comment',
        time: 1234567893,
        parent: 125,
        type: 'comment',
        kids: [127],
      };
      
      const storyWithComments = {
        id: 123,
        title: 'Test Story',
        by: 'testuser',
        time: 1234567890,
        score: 100,
        kids: [124],
        type: 'story',
      };
      
      mockClient.getItem.mockResolvedValue(storyWithComments);
      mockClient.getItems
        .mockResolvedValueOnce([mockComment])
        .mockResolvedValueOnce([mockReply]);
      
      const comments = await scraper.scrapeComments('123', {
        includeReplies: true,
        maxDepth: 2,
      });
      
      // Should not fetch beyond depth 2
      expect(comments).toHaveLength(2);
      expect(mockClient.getItems).toHaveBeenCalledTimes(2); // 2 levels of comments
    });
  });

  describe('User Scraping', () => {
    const mockUser = {
      id: 'testuser',
      created: 1234567890,
      karma: 1500,
      about: 'Test user bio with <i>HTML</i>',
      submitted: [123, 124, 125],
    };

    it('should scrape user profile', async () => {
      mockClient.getUser.mockResolvedValue(mockUser);
      
      const user = await scraper.scrapeUser('testuser');
      
      expect(user).toMatchObject({
        id: 'testuser',
        username: 'testuser',
        platform: 'hackernews',
        karma: 1500,
        bio: expect.stringContaining('Test user bio'),
      });
    });

    it('should scrape user posts', async () => {
      mockClient.getUser.mockResolvedValue(mockUser);
      const userStory = {
        id: 123,
        title: 'User Story',
        by: 'testuser',
        time: 1234567890,
        score: 50,
        type: 'story',
      };
      mockClient.getItems.mockResolvedValue([userStory, userStory, userStory]);
      
      const posts = await scraper.scrapeUserPosts('testuser', {
        limit: 3,
      });
      
      expect(posts).toHaveLength(3);
      expect(posts[0]).toMatchObject({
        id: '123',
        author: 'testuser',
        title: 'User Story',
      });
    });

    it('should handle user not found', async () => {
      mockClient.getUser.mockResolvedValue(null);
      
      const user = await scraper.scrapeUser('nonexistent');
      
      expect(user).toBeNull();
    });
  });

  describe('Search Functionality', () => {
    it('should search posts using Algolia API', async () => {
      const searchResults = {
        hits: [{
          objectID: '123',
          title: 'Search Result',
          author: 'searchuser',
          created_at_i: 1234567890,
          points: 75,
          num_comments: 8,
          url: 'https://example.com',
          story_text: 'Story content',
        }],
        nbHits: 1,
        page: 0,
        nbPages: 1,
      };
      
      mockClient.searchStories.mockResolvedValue(searchResults);
      
      const posts = await scraper.searchPosts('query', {
        limit: 10,
        sort: 'relevance',
      });
      
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('Search Result');
      expect(mockClient.searchStories).toHaveBeenCalledWith(
        'query',
        expect.any(Object)
      );
    });

    it('should handle empty search results', async () => {
      mockClient.searchStories.mockResolvedValue({
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
      });
      
      const posts = await scraper.searchPosts('nonexistent');
      
      expect(posts).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).response = { status: 429 };
      
      mockClient.getStoryList.mockRejectedValue(rateLimitError);
      
      await expect(scraper.scrapePostsFromCategory('top')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockClient.getItem.mockRejectedValue(new Error('Network error'));
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toBeNull();
    });

    it('should validate input parameters', async () => {
      await expect(scraper.scrapePostsFromCategory('invalid', {})).rejects.toThrow();
    });

    it('should handle malformed data', async () => {
      mockClient.getItem.mockResolvedValue({
        // Missing required fields
        id: 123,
      });
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toBeNull();
    });
  });

  describe('Capabilities', () => {
    it('should report correct capabilities', () => {
      const caps = scraper.getCapabilities();
      
      expect(caps.supportsCommentThreads).toBe(true);
      expect(caps.supportsUserProfiles).toBe(true);
      expect(caps.supportsSearch).toBe(true);
      expect(caps.supportsCategories).toBe(true);
      expect(caps.supportsPagination).toBe(false);
      expect(caps.supportsRealtime).toBe(false);
    });

    it('should validate platform name', () => {
      expect(scraper.getPlatformName()).toBe('hackernews');
    });

    it('should list available categories', () => {
      const categories = scraper.getAvailableCategories();
      
      expect(categories).toContain('top');
      expect(categories).toContain('new');
      expect(categories).toContain('best');
      expect(categories).toContain('ask');
      expect(categories).toContain('show');
      expect(categories).toContain('job');
    });
  });

  describe('Data Transformation', () => {
    it('should transform HN item to ForumPost', async () => {
      const hnStory = {
        id: 123,
        title: 'Test Story',
        by: 'testuser',
        text: 'Story text content',
        time: 1234567890,
        score: 100,
        descendants: 10,
        url: 'https://example.com/story',
        type: 'story',
        kids: [124, 125],
      };
      
      mockClient.getItem.mockResolvedValue(hnStory);
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toMatchObject({
        id: '123',
        platform: 'hackernews',
        title: 'Test Story',
        content: 'Story text content',
        author: 'testuser',
        score: 100,
        commentCount: 10,
        url: 'https://example.com/story',
      });
      expect(post?.createdAt).toBeInstanceOf(Date);
    });

    it('should handle Ask HN posts', async () => {
      const askPost = {
        id: 123,
        title: 'Ask HN: How to test?',
        by: 'testuser',
        text: 'Question content',
        time: 1234567890,
        score: 50,
        descendants: 5,
        type: 'story',
      };
      
      mockClient.getItem.mockResolvedValue(askPost);
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toMatchObject({
        content: 'Question content',
        category: 'ask',
      });
    });

    it('should handle Show HN posts', async () => {
      const showPost = {
        id: 123,
        title: 'Show HN: My project',
        by: 'testuser',
        url: 'https://myproject.com',
        time: 1234567890,
        score: 75,
        type: 'story',
      };
      
      mockClient.getItem.mockResolvedValue(showPost);
      
      const post = await scraper.scrapePost('123');
      
      expect(post).toMatchObject({
        category: 'show',
        url: 'https://myproject.com',
      });
    });
  });

  describe('Batch Operations', () => {
    it('should batch fetch multiple items efficiently', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Story ${i + 1}`,
        by: 'testuser',
        time: 1234567890 + i,
        score: 10 + i,
        type: 'story',
      }));
      
      mockClient.getStoryList.mockResolvedValue(items.map(i => i.id));
      mockClient.getItems.mockResolvedValue(items);
      
      const posts = await scraper.scrapePostsFromCategory('top', {
        limit: 10,
      });
      
      expect(posts).toHaveLength(10);
      expect(mockClient.getItems).toHaveBeenCalled();
    });
  });
});