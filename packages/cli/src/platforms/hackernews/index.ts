/**
 * HackerNews platform module exports
 */

export { HackerNewsScraper } from './scraper.js';
export type { HackerNewsScraperConfig } from './scraper.js';

export { HackerNewsClient } from './client.js';
export type { HNItem, HNUser, HNItemType, StoryListType, HNClientConfig } from './client.js';

export { HackerNewsParsers, HackerNewsValidators } from './parsers.js';

// Import for platform constructor
import { HackerNewsScraper } from './scraper.js';
import type { PlatformConstructor } from '../platform-factory.js';
import type { BasePlatform, BasePlatformConfig, ScrapeOptions } from '../base-platform.js';
import type { RateLimiter } from '../../scrapers/rate-limiter.js';
import type winston from 'winston';

/**
 * HackerNews platform constructor for platform registry
 * Wraps HackerNewsScraper to match the expected PlatformConstructor interface
 */
export const HackerNewsPlatform: any = class implements BasePlatform {
  private scraper: HackerNewsScraper;
  public readonly platform = 'hackernews' as const;

  constructor(_platform: string, config: BasePlatformConfig, logger?: winston.Logger) {
    this.scraper = new HackerNewsScraper({
      ...config,
    } as any);
  }

  // Delegate all methods to the scraper instance
  getCapabilities() {
    return this.scraper.getCapabilities();
  }

  async initialize() {
    return this.scraper.initialize();
  }

  async scrapePosts(category: string, options: ScrapeOptions): Promise<any> {
    return this.scraper.scrapePosts(category, options);
  }

  async scrapePost(postId: string, options?: ScrapeOptions): Promise<any> {
    return this.scraper.scrapePost(postId);
  }

  async scrapeUser(username: string) {
    return this.scraper.scrapeUser(username);
  }

  async scrape(options: ScrapeOptions): Promise<any> {
    // Default scrape implementation - scrape top stories
    const posts = await this.scraper.scrapePosts('topstories', {
      limit: options?.limit || 10,
      includeComments: options?.includeComments || false,
    });

    return {
      posts,
      metadata: {
        scrapedAt: new Date(),
        totalPosts: Array.isArray(posts) ? posts.length : 0,
        platform: 'hackernews' as const,
      },
    };
  }

  async scrapeCategory(category: string, options: ScrapeOptions) {
    return this.scraper.scrapeCategory(category, options);
  }

  async scrapeComments(postId: string, options: ScrapeOptions) {
    return this.scraper.scrapeComments(postId, options);
  }

  async search(query: string, options: ScrapeOptions) {
    return this.scraper.search(query, options);
  }

  async validateAuth() {
    return this.scraper.validateAuth();
  }

  async testConnection() {
    return this.scraper.validateAuth();
  }

  setRateLimiter(_rateLimiter: RateLimiter) {
    // HackerNewsScraper doesn't use external rate limiter, has internal delay
    // This is a no-op for compatibility
  }
};

// Default export for platform registration
export default HackerNewsPlatform;
