/**
 * Data transformation utilities for export operations
 */

import type { ForumPost, Comment, User, ScrapeResult } from '../types/core.js';

interface ExtendedForumPost extends ForumPost {
  ranking?: {
    position: number;
    percentile: number;
  };
  mentions?: string[];
  links?: string[];
}

interface ExtendedComment extends Comment {
  mentions?: string[];
  links?: string[];
}

interface ExtendedUser extends User {
  ranking?: number;
}

interface TransformStatistics {
  posts: {
    total: number;
    averageScore: number;
    averageComments: number;
    topScore: number;
    platforms: Record<string, number>;
  };
  comments: {
    total: number;
    averageScore: number;
    averageDepth: number;
  };
  users: {
    total: number;
    averageKarma: number;
    topKarma: number;
  };
}

interface ExtendedMetadata {
  scrapedAt: Date | string | number;
  totalPosts: number;
  totalComments?: number;
  platform: 'reddit' | 'hackernews' | 'discourse' | 'lemmy' | 'lobsters' | 'custom';
  query?: string;
  subreddit?: string;
  category?: string;
  statistics?: TransformStatistics;
  exportedAt?: string;
  processingTime?: number;
  groupedByPlatform?: Record<string, { posts: ForumPost[]; comments: Comment[]; users: User[] }>;
  groupedByDate?: Record<string, ForumPost[]>;
  groupedByAuthor?: Record<string, ForumPost[]>;
}

interface _ExtendedScrapeResult
  extends Omit<ScrapeResult, 'metadata' | 'posts' | 'comments' | 'users'> {
  posts: ExtendedForumPost[];
  comments?: ExtendedComment[];
  users?: ExtendedUser[];
  metadata: ExtendedMetadata;
}

export interface TransformOptions {
  // Field transformations
  truncateContent?: number;
  stripHtml?: boolean;
  normalizeWhitespace?: boolean;
  removeEmojis?: boolean;

  // Data enrichment
  addStatistics?: boolean;
  addRankings?: boolean;
  addTimestamps?: boolean;

  // Anonymization
  anonymizeUsers?: boolean;
  hashUserIds?: boolean;

  // Format conversions
  convertDates?: 'timestamp' | 'iso' | 'locale' | 'relative';
  convertUrls?: 'absolute' | 'relative' | 'domain';

  // Content processing
  extractLinks?: boolean;
  extractMentions?: boolean;
  summarizeContent?: boolean;

  // Aggregation
  groupByPlatform?: boolean;
  groupByDate?: boolean;
  groupByAuthor?: boolean;

  // Custom transformations
  transformPost?: (post: ForumPost) => ForumPost;
  transformComment?: (comment: Comment) => Comment;
  transformUser?: (user: User) => User;
}

export class DataTransformer {
  private options: TransformOptions;

  constructor(options: TransformOptions = {}) {
    this.options = {
      normalizeWhitespace: true,
      convertDates: 'iso',
      ...options,
    };
  }

  /**
   * Transform complete ScrapeResult
   */
  transformScrapeResult(data: ScrapeResult): ScrapeResult {
    const transformed: ScrapeResult = {
      posts: this.transformPosts(data.posts),
      comments: data.comments ? this.transformComments(data.comments) : undefined,
      users: data.users ? this.transformUsers(data.users) : undefined,
      metadata: this.transformMetadata(data),
    };

    // Add statistics if requested
    if (this.options.addStatistics) {
      (transformed.metadata as ExtendedMetadata).statistics = this.generateStatistics(data);
    }

    // Group data if requested
    if (this.options.groupByPlatform || this.options.groupByDate || this.options.groupByAuthor) {
      return this.groupData(transformed);
    }

    return transformed;
  }

  /**
   * Transform posts
   */
  transformPosts(posts: ForumPost[]): ForumPost[] {
    return posts.map((post, index) => {
      let transformed: ExtendedForumPost = { ...post };

      // Apply custom transform if provided
      if (this.options.transformPost) {
        transformed = this.options.transformPost(transformed);
      }

      // Content transformations
      if (post.content) {
        transformed.content = this.transformContent(post.content);
      }

      if (post.title && !this.options.transformPost) {
        transformed.title = this.transformText(post.title);
      }

      // Date transformations
      transformed.createdAt = this.transformDate(post.createdAt) as any;
      if (post.updatedAt) {
        transformed.updatedAt = this.transformDate(post.updatedAt) as any;
      }

      // URL transformations
      if (this.options.convertUrls) {
        transformed.url = this.transformUrl(post.url);
      }

      // Add rankings if requested
      if (this.options.addRankings) {
        transformed.ranking = {
          position: index + 1,
          percentile: ((posts.length - index) / posts.length) * 100,
        };
      }

      // Anonymize author if requested
      if (this.options.anonymizeUsers) {
        transformed.author = this.anonymizeUsername(post.author);
        if (post.authorId) {
          transformed.authorId = this.hashId(post.authorId);
        }
      }

      // Extract mentions and links
      if (this.options.extractMentions && post.content) {
        transformed.mentions = this.extractMentions(post.content);
      }

      if (this.options.extractLinks && post.content) {
        transformed.links = this.extractLinks(post.content);
      }

      return transformed;
    });
  }

  /**
   * Transform comments
   */
  transformComments(comments: Comment[]): Comment[] {
    return comments.map((comment) => {
      let transformed: ExtendedComment = { ...comment };

      // Apply custom transform if provided
      if (this.options.transformComment) {
        transformed = this.options.transformComment(transformed);
      }

      // Content transformations
      if (!this.options.transformComment) {
        transformed.content = this.transformContent(comment.content);
      }

      // Date transformations
      transformed.createdAt = this.transformDate(comment.createdAt) as any;
      if (comment.updatedAt) {
        transformed.updatedAt = this.transformDate(comment.updatedAt) as any;
      }

      // Anonymize author if requested
      if (this.options.anonymizeUsers) {
        transformed.author = this.anonymizeUsername(comment.author);
        if (comment.authorId) {
          transformed.authorId = this.hashId(comment.authorId);
        }
      }

      return transformed;
    });
  }

  /**
   * Transform users
   */
  transformUsers(users: User[]): User[] {
    return users.map((user, index) => {
      let transformed: ExtendedUser = { ...user };

      // Apply custom transform if provided
      if (this.options.transformUser) {
        transformed = this.options.transformUser(transformed);
      }

      // Anonymize if requested
      if (this.options.anonymizeUsers && !this.options.transformUser) {
        transformed.username = this.anonymizeUsername(user.username);
        transformed.id = this.hashId(user.id);
      }

      // Date transformations
      if (user.createdAt) {
        transformed.createdAt = this.transformDate(user.createdAt) as any;
      }

      // Add rankings if requested
      if (this.options.addRankings) {
        transformed.ranking = index + 1;
      }

      return transformed;
    });
  }

  /**
   * Transform metadata
   */
  private transformMetadata(data: ScrapeResult): ScrapeResult['metadata'] {
    const metadata = { ...data.metadata } as any;

    // Add timestamps if requested
    if (this.options.addTimestamps) {
      metadata.exportedAt = new Date().toISOString();
      metadata.processingTime = Date.now();
    }

    // Transform existing dates
    if (metadata.scrapedAt) {
      metadata.scrapedAt = this.transformDate(metadata.scrapedAt);
    }

    return metadata as ScrapeResult['metadata'];
  }

  /**
   * Transform content text
   */
  private transformContent(content: string): string {
    let transformed = content;

    // Strip HTML if requested
    if (this.options.stripHtml) {
      transformed = this.stripHtmlTags(transformed);
    }

    // Normalize whitespace
    if (this.options.normalizeWhitespace) {
      transformed = this.normalizeWhitespace(transformed);
    }

    // Remove emojis if requested
    if (this.options.removeEmojis) {
      transformed = this.removeEmojis(transformed);
    }

    // Truncate if requested
    if (this.options.truncateContent && this.options.truncateContent > 0) {
      transformed = this.truncateText(transformed, this.options.truncateContent);
    }

    // Summarize if requested (simplified version)
    if (this.options.summarizeContent) {
      transformed = this.summarizeText(transformed);
    }

    return transformed;
  }

  /**
   * Transform regular text
   */
  private transformText(text: string): string {
    let transformed = text;

    if (this.options.normalizeWhitespace) {
      transformed = this.normalizeWhitespace(transformed);
    }

    if (this.options.removeEmojis) {
      transformed = this.removeEmojis(transformed);
    }

    return transformed;
  }

  /**
   * Transform date based on options
   */
  private transformDate(date: Date): string | number {
    const d = date instanceof Date ? date : new Date(date);

    switch (this.options.convertDates) {
      case 'timestamp':
        return d.getTime();
      case 'locale':
        return d.toLocaleString();
      case 'relative':
        return this.getRelativeTime(d);
      case 'iso':
      default:
        return d.toISOString();
    }
  }

  /**
   * Transform URL based on options
   */
  private transformUrl(url: string): string {
    switch (this.options.convertUrls) {
      case 'domain':
        try {
          const parsed = new URL(url);
          return parsed.hostname;
        } catch {
          return url;
        }
      case 'relative':
        try {
          const parsed = new URL(url);
          return parsed.pathname + parsed.search + parsed.hash;
        } catch {
          return url;
        }
      case 'absolute':
      default:
        return url;
    }
  }

  /**
   * Generate statistics for the data
   */
  private generateStatistics(data: ScrapeResult): TransformStatistics {
    const posts = data.posts;
    const comments = data.comments || [];
    const users = data.users || [];

    return {
      posts: {
        total: posts.length,
        averageScore: posts.reduce((sum, p) => sum + p.score, 0) / posts.length,
        averageComments: posts.reduce((sum, p) => sum + p.commentCount, 0) / posts.length,
        topScore: Math.max(...posts.map((p) => p.score)),
        platforms: this.countByField(posts, 'platform'),
      },
      comments: {
        total: comments.length,
        averageScore:
          comments.length > 0 ? comments.reduce((sum, c) => sum + c.score, 0) / comments.length : 0,
        averageDepth:
          comments.length > 0 ? comments.reduce((sum, c) => sum + c.depth, 0) / comments.length : 0,
      },
      users: {
        total: users.length,
        averageKarma:
          users.length > 0 ? users.reduce((sum, u) => sum + (u.karma || 0), 0) / users.length : 0,
        topKarma: Math.max(...users.map((u) => u.karma || 0)),
      },
    };
  }

  /**
   * Group data by specified criteria
   */
  private groupData(data: ScrapeResult): ScrapeResult {
    if (this.options.groupByPlatform) {
      const grouped: Record<string, { posts: ForumPost[]; comments: Comment[]; users: User[] }> =
        {};

      data.posts.forEach((post) => {
        if (!grouped[post.platform]) {
          grouped[post.platform] = {
            posts: [],
            comments: [],
            users: [],
          };
        }
        grouped[post.platform].posts.push(post);
      });

      // Add grouped structure to metadata
      (data.metadata as ExtendedMetadata).groupedByPlatform = grouped;
    }

    if (this.options.groupByDate) {
      const grouped: Record<string, ForumPost[]> = {};

      data.posts.forEach((post) => {
        const date = new Date(post.createdAt).toISOString().split('T')[0];
        if (date && !grouped[date]) {
          grouped[date] = [];
        }
        if (date) {
          grouped[date].push(post);
        }
      });

      (data.metadata as ExtendedMetadata).groupedByDate = grouped;
    }

    if (this.options.groupByAuthor) {
      const grouped: Record<string, ForumPost[]> = {};

      data.posts.forEach((post) => {
        if (!grouped[post.author]) {
          grouped[post.author] = [];
        }
        grouped[post.author].push(post);
      });

      (data.metadata as ExtendedMetadata).groupedByAuthor = grouped;
    }

    return data;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  /**
   * Normalize whitespace in text
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Remove emoji characters from text
   */
  private removeEmojis(text: string): string {
    return text.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ''
    );
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Create a simple summary of text
   */
  private summarizeText(text: string): string {
    // Simple summarization: take first paragraph or first 200 chars
    const paragraphs = text.split('\n\n');
    const firstParagraph = paragraphs[0];

    if (!firstParagraph) {
      return '';
    }

    if (firstParagraph.length > 200) {
      return this.truncateText(firstParagraph, 200);
    }

    return firstParagraph;
  }

  /**
   * Anonymize username
   */
  private anonymizeUsername(username: string): string {
    const hash = this.simpleHash(username);
    return `user_${hash.substring(0, 8)}`;
  }

  /**
   * Hash ID for anonymization
   */
  private hashId(id: string): string {
    return this.simpleHash(id);
  }

  /**
   * Simple hash function for anonymization
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Extract mentions from text
   */
  private extractMentions(text: string): string[] {
    const mentions = text.match(/@[\w-]+/g) || [];
    return [...new Set(mentions)];
  }

  /**
   * Extract links from text
   */
  private extractLinks(text: string): string[] {
    const links = text.match(/https?:\/\/[^\s]+/g) || [];
    return [...new Set(links)];
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  }

  /**
   * Count occurrences by field value
   */
  private countByField(
    items: Array<Record<string, unknown>>,
    field: string
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const value = item[field] as string;
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }
}

/**
 * Predefined transformation presets
 */
export const TransformPresets = {
  /**
   * Minimal transformation for clean output
   */
  minimal: (): TransformOptions => ({
    normalizeWhitespace: true,
    stripHtml: true,
    convertDates: 'iso',
  }),

  /**
   * Full anonymization
   */
  anonymized: (): TransformOptions => ({
    anonymizeUsers: true,
    hashUserIds: true,
    stripHtml: true,
    removeEmojis: true,
  }),

  /**
   * Optimized for analysis
   */
  analysis: (): TransformOptions => ({
    addStatistics: true,
    addRankings: true,
    extractMentions: true,
    extractLinks: true,
    normalizeWhitespace: true,
    stripHtml: true,
  }),

  /**
   * Compact output
   */
  compact: (): TransformOptions => ({
    truncateContent: 200,
    summarizeContent: true,
    convertDates: 'timestamp',
    convertUrls: 'domain',
  }),

  /**
   * Grouped output
   */
  grouped: (): TransformOptions => ({
    groupByPlatform: true,
    addStatistics: true,
    normalizeWhitespace: true,
  }),
};

/**
 * Chain multiple transformers together
 */
export class TransformChain {
  private transformers: DataTransformer[] = [];

  add(transformer: DataTransformer | TransformOptions): TransformChain {
    if (transformer instanceof DataTransformer) {
      this.transformers.push(transformer);
    } else {
      this.transformers.push(new DataTransformer(transformer));
    }
    return this;
  }

  apply(data: ScrapeResult): ScrapeResult {
    return this.transformers.reduce(
      (result, transformer) => transformer.transformScrapeResult(result),
      data
    );
  }

  applyToPosts(posts: ForumPost[]): ForumPost[] {
    return this.transformers.reduce(
      (result, transformer) => transformer.transformPosts(result),
      posts
    );
  }
}
