/**
 * Data filtering utilities for export operations
 */

import type { ForumPost, Comment, User, ScrapeResult, Platform } from "../types/core.js";

export interface FilterOptions {
  // Platform filters
  platforms?: Platform[];
  excludePlatforms?: Platform[];

  // Date filters
  startDate?: Date | string;
  endDate?: Date | string;

  // Score filters
  minScore?: number;
  maxScore?: number;

  // Comment filters
  minComments?: number;
  maxComments?: number;

  // Author filters
  authors?: string[];
  excludeAuthors?: string[];

  // Content filters
  searchTerms?: string[];
  excludeTerms?: string[];
  caseSensitive?: boolean;

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sortBy?: "date" | "score" | "comments" | "author";
  sortOrder?: "asc" | "desc";
}

export class DataFilter {
  private options: FilterOptions;

  constructor(options: FilterOptions = {}) {
    this.options = {
      caseSensitive: false,
      sortOrder: "desc",
      ...options,
    };
  }

  /**
   * Filter complete ScrapeResult
   */
  filterScrapeResult(data: ScrapeResult): ScrapeResult {
    const filteredPosts = this.filterPosts(data.posts);
    const postIds = new Set(filteredPosts.map(p => p.id));

    // Filter comments to only include those for filtered posts
    const filteredComments = data.comments
      ? data.comments.filter(c => postIds.has(c.postId))
      : undefined;

    // Filter users to only include those who authored filtered content
    const authorNames = new Set([
      ...filteredPosts.map(p => p.author),
      ...(filteredComments?.map(c => c.author) || []),
    ]);

    const filteredUsers = data.users
      ? data.users.filter(u => authorNames.has(u.username))
      : undefined;

    // Update metadata
    const metadata = {
      ...data.metadata,
      totalPosts: filteredPosts.length,
      totalComments: filteredComments?.length || 0,
      filtered: true,
      filterOptions: this.options,
    };

    return {
      posts: filteredPosts,
      comments: filteredComments,
      users: filteredUsers,
      metadata,
    };
  }

  /**
   * Filter posts based on criteria
   */
  filterPosts(posts: ForumPost[]): ForumPost[] {
    let filtered = [...posts];

    // Platform filters
    if (this.options.platforms && this.options.platforms.length > 0) {
      filtered = filtered.filter(p => this.options.platforms!.includes(p.platform));
    }

    if (this.options.excludePlatforms && this.options.excludePlatforms.length > 0) {
      filtered = filtered.filter(p => !this.options.excludePlatforms!.includes(p.platform));
    }

    // Date filters
    if (this.options.startDate) {
      const startDate = this.parseDate(this.options.startDate);
      filtered = filtered.filter(p => new Date(p.createdAt) >= startDate);
    }

    if (this.options.endDate) {
      const endDate = this.parseDate(this.options.endDate);
      filtered = filtered.filter(p => new Date(p.createdAt) <= endDate);
    }

    // Score filters
    if (this.options.minScore !== undefined) {
      filtered = filtered.filter(p => p.score >= this.options.minScore!);
    }

    if (this.options.maxScore !== undefined) {
      filtered = filtered.filter(p => p.score <= this.options.maxScore!);
    }

    // Comment count filters
    if (this.options.minComments !== undefined) {
      filtered = filtered.filter(p => p.commentCount >= this.options.minComments!);
    }

    if (this.options.maxComments !== undefined) {
      filtered = filtered.filter(p => p.commentCount <= this.options.maxComments!);
    }

    // Author filters
    if (this.options.authors && this.options.authors.length > 0) {
      const authors = new Set(this.options.authors.map(a => 
        this.options.caseSensitive ? a : a.toLowerCase()
      ));
      filtered = filtered.filter(p => {
        const author = this.options.caseSensitive ? p.author : p.author.toLowerCase();
        return authors.has(author);
      });
    }

    if (this.options.excludeAuthors && this.options.excludeAuthors.length > 0) {
      const excludeAuthors = new Set(this.options.excludeAuthors.map(a => 
        this.options.caseSensitive ? a : a.toLowerCase()
      ));
      filtered = filtered.filter(p => {
        const author = this.options.caseSensitive ? p.author : p.author.toLowerCase();
        return !excludeAuthors.has(author);
      });
    }

    // Content filters
    if (this.options.searchTerms && this.options.searchTerms.length > 0) {
      filtered = filtered.filter(p => this.matchesSearchTerms(p));
    }

    if (this.options.excludeTerms && this.options.excludeTerms.length > 0) {
      filtered = filtered.filter(p => !this.matchesExcludeTerms(p));
    }

    // Sort
    filtered = this.sortPosts(filtered);

    // Pagination
    if (this.options.offset !== undefined) {
      filtered = filtered.slice(this.options.offset);
    }

    if (this.options.limit !== undefined) {
      filtered = filtered.slice(0, this.options.limit);
    }

    return filtered;
  }

  /**
   * Filter comments based on criteria
   */
  filterComments(comments: Comment[]): Comment[] {
    let filtered = [...comments];

    // Platform filters
    if (this.options.platforms && this.options.platforms.length > 0) {
      filtered = filtered.filter(c => this.options.platforms!.includes(c.platform));
    }

    // Date filters
    if (this.options.startDate) {
      const startDate = this.parseDate(this.options.startDate);
      filtered = filtered.filter(c => new Date(c.createdAt) >= startDate);
    }

    if (this.options.endDate) {
      const endDate = this.parseDate(this.options.endDate);
      filtered = filtered.filter(c => new Date(c.createdAt) <= endDate);
    }

    // Score filters
    if (this.options.minScore !== undefined) {
      filtered = filtered.filter(c => c.score >= this.options.minScore!);
    }

    // Author filters
    if (this.options.authors && this.options.authors.length > 0) {
      const authors = new Set(this.options.authors.map(a => 
        this.options.caseSensitive ? a : a.toLowerCase()
      ));
      filtered = filtered.filter(c => {
        const author = this.options.caseSensitive ? c.author : c.author.toLowerCase();
        return authors.has(author);
      });
    }

    return filtered;
  }

  /**
   * Filter users based on criteria
   */
  filterUsers(users: User[]): User[] {
    let filtered = [...users];

    // Platform filters
    if (this.options.platforms && this.options.platforms.length > 0) {
      filtered = filtered.filter(u => this.options.platforms!.includes(u.platform));
    }

    // Sort by karma if available
    filtered.sort((a, b) => (b.karma || 0) - (a.karma || 0));

    // Limit
    if (this.options.limit !== undefined) {
      filtered = filtered.slice(0, this.options.limit);
    }

    return filtered;
  }

  /**
   * Check if post matches search terms
   */
  private matchesSearchTerms(post: ForumPost): boolean {
    if (!this.options.searchTerms || this.options.searchTerms.length === 0) {
      return true;
    }

    const searchableText = this.options.caseSensitive
      ? `${post.title} ${post.content || ""}`
      : `${post.title} ${post.content || ""}`.toLowerCase();

    return this.options.searchTerms.some(term => {
      const searchTerm = this.options.caseSensitive ? term : term.toLowerCase();
      return searchableText.includes(searchTerm);
    });
  }

  /**
   * Check if post matches exclude terms
   */
  private matchesExcludeTerms(post: ForumPost): boolean {
    if (!this.options.excludeTerms || this.options.excludeTerms.length === 0) {
      return false;
    }

    const searchableText = this.options.caseSensitive
      ? `${post.title} ${post.content || ""}`
      : `${post.title} ${post.content || ""}`.toLowerCase();

    return this.options.excludeTerms.some(term => {
      const excludeTerm = this.options.caseSensitive ? term : term.toLowerCase();
      return searchableText.includes(excludeTerm);
    });
  }

  /**
   * Sort posts based on criteria
   */
  private sortPosts(posts: ForumPost[]): ForumPost[] {
    const sorted = [...posts];
    const multiplier = this.options.sortOrder === "asc" ? 1 : -1;

    switch (this.options.sortBy) {
      case "date":
        sorted.sort((a, b) => 
          multiplier * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
        break;
      case "score":
        sorted.sort((a, b) => multiplier * (b.score - a.score));
        break;
      case "comments":
        sorted.sort((a, b) => multiplier * (b.commentCount - a.commentCount));
        break;
      case "author":
        sorted.sort((a, b) => multiplier * a.author.localeCompare(b.author));
        break;
      default:
        // Default to date descending
        sorted.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    return sorted;
  }

  /**
   * Parse date from string or Date
   */
  private parseDate(date: Date | string): Date {
    if (date instanceof Date) {
      return date;
    }
    return new Date(date);
  }
}

/**
 * Predefined filter presets
 */
export const FilterPresets = {
  /**
   * Filter for high-quality posts
   */
  highQuality: (): FilterOptions => ({
    minScore: 100,
    minComments: 10,
    sortBy: "score",
    sortOrder: "desc",
  }),

  /**
   * Filter for recent posts (last 7 days)
   */
  recent: (): FilterOptions => ({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    sortBy: "date",
    sortOrder: "desc",
  }),

  /**
   * Filter for controversial posts
   */
  controversial: (): FilterOptions => ({
    minComments: 20,
    maxScore: 5,
    minScore: -5,
    sortBy: "comments",
    sortOrder: "desc",
  }),

  /**
   * Filter for specific platform
   */
  platform: (platform: Platform): FilterOptions => ({
    platforms: [platform],
    sortBy: "date",
    sortOrder: "desc",
  }),

  /**
   * Filter for top posts
   */
  top: (limit: number = 100): FilterOptions => ({
    sortBy: "score",
    sortOrder: "desc",
    limit,
  }),
};

/**
 * Chain multiple filters together
 */
export class FilterChain {
  private filters: DataFilter[] = [];

  add(filter: DataFilter | FilterOptions): FilterChain {
    if (filter instanceof DataFilter) {
      this.filters.push(filter);
    } else {
      this.filters.push(new DataFilter(filter));
    }
    return this;
  }

  apply(data: ScrapeResult): ScrapeResult {
    return this.filters.reduce((result, filter) => 
      filter.filterScrapeResult(result), data
    );
  }

  applyToPosts(posts: ForumPost[]): ForumPost[] {
    return this.filters.reduce((result, filter) => 
      filter.filterPosts(result), posts
    );
  }
}