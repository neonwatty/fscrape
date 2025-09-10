import type { HNItem, HNUser } from "./client.js";
import type { ForumPost, Comment, User } from "../../types/core.js";

/**
 * Hacker News response parsers
 * Converts HN API responses to standardized models
 */
export class HackerNewsParsers {
  /**
   * Convert HN story/post to ForumPost
   */
  static parsePost(item: HNItem): ForumPost | null {
    if (!item || item.deleted || item.dead) {
      return null;
    }

    // Only stories, jobs, and polls are considered posts
    if (!["story", "job", "poll"].includes(item.type)) {
      return null;
    }

    return {
      id: item.id.toString(),
      title: item.title || "Untitled",
      content: this.cleanContent(item.text) || null,
      author: item.by || "[deleted]",
      authorId: item.by,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      score: item.score || 0,
      commentCount: item.descendants || 0,
      createdAt: new Date(item.time * 1000),
      updatedAt: new Date(item.time * 1000),
      platform: "hackernews",
      metadata: {
        type: item.type,
        dead: item.dead || false,
        kids: item.kids || [],
        parts: item.parts || [],
        poll: item.poll,
        domain: this.extractDomain(item.url),
        storyType: this.determineStoryType(item),
        tags: this.extractTags(item),
      },
    };
  }

  /**
   * Convert HN comment to Comment
   */
  static parseComment(item: HNItem, postId: string, depth: number = 0): Comment | null {
    if (!item || item.deleted || item.dead) {
      return null;
    }

    // Only comments are parsed here
    if (item.type !== "comment") {
      return null;
    }

    return {
      id: item.id.toString(),
      postId: postId,
      parentId: item.parent ? item.parent.toString() : null,
      author: item.by || "[deleted]",
      authorId: item.by,
      content: this.cleanContent(item.text) || "",
      score: item.score || 0,
      createdAt: new Date(item.time * 1000),
      updatedAt: new Date(item.time * 1000),
      depth: depth,
      platform: "hackernews",
    };
  }

  /**
   * Convert HN user to User
   */
  static parseUser(user: HNUser): User {
    return {
      id: user.id,
      username: user.id,
      karma: user.karma,
      createdAt: new Date(user.created * 1000),
      platform: "hackernews",
      metadata: {
        about: this.cleanContent(user.about),
        submitted: user.submitted || [],
        submittedCount: user.submitted?.length || 0,
      },
    };
  }

  /**
   * Parse a thread of comments recursively
   */
  static async parseCommentThread(
    items: HNItem[],
    postId: string,
    parentId: number | null = null,
    depth: number = 0,
  ): Promise<Comment[]> {
    const comments: Comment[] = [];

    for (const item of items) {
      if (item.type === "comment" && !item.deleted && !item.dead) {
        const comment = this.parseComment(item, postId, depth);
        if (comment) {
          comments.push(comment);
        }
      }
    }

    return comments;
  }

  /**
   * Extract URLs from HN post/comment text
   */
  static extractUrls(text: string | undefined): string[] {
    if (!text) return [];

    const urls: string[] = [];
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      urls.push(match[0]);
    }

    return [...new Set(urls)];
  }

  /**
   * Clean HN HTML content
   */
  static cleanContent(html: string | undefined): string {
    if (!html) return "";

    // HN uses very minimal HTML - mainly <p> tags and <a> links
    return html
      .replace(/<p>/g, "\n\n")
      .replace(/<\/p>/g, "")
      .replace(/<pre><code>/g, "```\n")
      .replace(/<\/code><\/pre>/g, "\n```")
      .replace(/<code>/g, "`")
      .replace(/<\/code>/g, "`")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, "[$2]($1)")
      .replace(/<i>/g, "_")
      .replace(/<\/i>/g, "_")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .trim();
  }

  /**
   * Determine story type from HN item
   */
  static determineStoryType(item: HNItem): "link" | "text" | "job" | "poll" | "show" | "ask" {
    if (item.type === "job") {
      return "job";
    }

    if (item.type === "poll") {
      return "poll";
    }

    if (item.title) {
      if (item.title.toLowerCase().startsWith("show hn:")) {
        return "show";
      }
      if (item.title.toLowerCase().startsWith("ask hn:")) {
        return "ask";
      }
    }

    if (item.url) {
      return "link";
    }

    return "text";
  }

  /**
   * Format HN item URL
   */
  static formatItemUrl(itemId: number | string): string {
    return `https://news.ycombinator.com/item?id=${itemId}`;
  }

  /**
   * Format HN user URL
   */
  static formatUserUrl(username: string): string {
    return `https://news.ycombinator.com/user?id=${username}`;
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string | undefined): string | null {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }

  /**
   * Parse HN timestamp (seconds since epoch)
   */
  static parseTimestamp(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  /**
   * Calculate comment statistics
   */
  static calculateCommentStats(comments: Comment[]): {
    totalComments: number;
    maxDepth: number;
    uniqueAuthors: number;
    averageScore: number;
  } {
    if (comments.length === 0) {
      return {
        totalComments: 0,
        maxDepth: 0,
        uniqueAuthors: 0,
        averageScore: 0,
      };
    }

    const authors = new Set(comments.map(c => c.author));
    const scores = comments.map(c => c.score || 0);
    const depths = comments.map(c => c.depth);

    return {
      totalComments: comments.length,
      maxDepth: Math.max(...depths, 0),
      uniqueAuthors: authors.size,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    };
  }

  /**
   * Extract tags from HN post
   */
  static extractTags(item: HNItem): string[] {
    const tags: string[] = [];

    if (item.title?.toLowerCase().startsWith("show hn:")) {
      tags.push("Show HN");
    }

    if (item.title?.toLowerCase().startsWith("ask hn:")) {
      tags.push("Ask HN");
    }

    if (item.type === "job") {
      tags.push("Job");
    }

    if (item.type === "poll") {
      tags.push("Poll");
    }

    if (item.dead) {
      tags.push("Dead");
    }

    return tags;
  }

  /**
   * Parse poll options if present
   */
  static parsePollOptions(item: HNItem, pollOptions: HNItem[]): {
    question: string;
    options: Array<{
      id: string;
      text: string;
      score: number;
    }>;
  } | null {
    if (item.type !== "poll" || !item.parts) {
      return null;
    }

    const options = pollOptions
      .filter(opt => opt.type === "pollopt" && !opt.deleted && !opt.dead)
      .map(opt => ({
        id: opt.id.toString(),
        text: this.cleanContent(opt.text || ""),
        score: opt.score || 0,
      }));

    return {
      question: item.title || "",
      options,
    };
  }

  /**
   * Build comment tree from flat list
   */
  static buildCommentTree(comments: Comment[]): Comment[] {
    const commentMap = new Map<string, Comment & { replies?: Comment[] }>();
    const rootComments: Comment[] = [];

    // First pass: create map
    for (const comment of comments) {
      commentMap.set(comment.id, { ...comment, replies: [] });
    }

    // Second pass: build tree
    for (const comment of commentMap.values()) {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent && parent.replies) {
          parent.replies.push(comment);
          comment.depth = (parent.depth || 0) + 1;
        } else {
          // Parent not in our set, treat as root
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    }

    return rootComments;
  }

  /**
   * Format relative time
   */
  static formatRelativeTime(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months ago`;
    return `${Math.floor(seconds / 31536000)} years ago`;
  }

  /**
   * Extract mentioned users from text
   */
  static extractMentions(text: string | undefined): string[] {
    if (!text) return [];
    const mentions: string[] = [];
    // HN doesn't have a formal mention system, but people often refer to others by username
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1]) mentions.push(match[1]);
    }

    return [...new Set(mentions)];
  }

  /**
   * Batch parse items
   */
  static batchParseItems(items: HNItem[]): {
    posts: ForumPost[];
    comments: Comment[];
  } {
    const posts: ForumPost[] = [];
    const comments: Comment[] = [];

    for (const item of items) {
      if (!item || item.deleted || item.dead) continue;

      switch (item.type) {
        case "story":
        case "job":
        case "poll":
          const post = this.parsePost(item);
          if (post) posts.push(post);
          break;
        case "comment":
          // For batch parsing, we don't have postId context
          const comment = this.parseComment(item, item.parent?.toString() || "unknown");
          if (comment) comments.push(comment);
          break;
      }
    }

    return { posts, comments };
  }
}

/**
 * Hacker News data validators
 */
export class HackerNewsValidators {
  /**
   * Validate HN item ID
   */
  static isValidItemId(id: number | string): boolean {
    const numId = typeof id === "string" ? parseInt(id, 10) : id;
    return !isNaN(numId) && numId > 0;
  }

  /**
   * Validate HN username
   */
  static isValidUsername(username: string): boolean {
    // HN usernames are case-sensitive and can contain letters, numbers, and underscores
    const pattern = /^[a-zA-Z0-9_]+$/;
    return pattern.test(username) && username.length <= 15;
  }

  /**
   * Check if URL is a HN URL
   */
  static isHackerNewsUrl(url: string): boolean {
    const hnDomains = [
      "news.ycombinator.com",
      "ycombinator.com",
      "hacker-news.firebaseio.com",
    ];

    try {
      const urlObj = new URL(url);
      return hnDomains.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  /**
   * Extract item ID from HN URL
   */
  static extractItemIdFromUrl(url: string): number | null {
    const pattern = /[?&]id=(\d+)/;
    const match = url.match(pattern);
    
    if (match && match[1]) {
      const id = parseInt(match[1], 10);
      return isNaN(id) ? null : id;
    }

    return null;
  }

  /**
   * Extract username from HN user URL
   */
  static extractUsernameFromUrl(url: string): string | null {
    const pattern = /[?&]id=([^&]+)/;
    const match = url.match(pattern);
    
    return match && match[1] ? decodeURIComponent(match[1]) : null;
  }
}