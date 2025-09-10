import type { RedditPost } from "./client.js";
import type { Comment } from "../../types/core.js";

/**
 * Reddit-specific parsing utilities
 */
export class RedditParsers {
  /**
   * Extract media URLs from Reddit post
   */
  static extractMediaUrls(post: RedditPost): string[] {
    const urls: string[] = [];

    // Add main URL if it's a media URL
    if (post.url && !post.is_self) {
      urls.push(post.url);
    }

    // Extract from preview
    if (post.preview?.images) {
      for (const image of post.preview.images) {
        if (image.source?.url) {
          urls.push(this.decodeRedditUrl(image.source.url));
        }

        // Add resolutions
        if (image.resolutions) {
          for (const resolution of image.resolutions) {
            if (resolution.url) {
              urls.push(this.decodeRedditUrl(resolution.url));
            }
          }
        }
      }
    }

    // Extract video URLs
    if (post.media?.reddit_video?.fallback_url) {
      urls.push(post.media.reddit_video.fallback_url);
    }

    // Extract gallery URLs if present
    if ((post as any).media_metadata) {
      for (const [, media] of Object.entries((post as any).media_metadata)) {
        if ((media as any).s?.u) {
          urls.push(this.decodeRedditUrl((media as any).s.u));
        }
      }
    }

    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Decode Reddit's HTML-encoded URLs
   */
  static decodeRedditUrl(url: string): string {
    return url.replace(/&amp;/g, "&");
  }

  /**
   * Parse Reddit flair into tags
   */
  static parseFlairToTags(post: RedditPost): string[] {
    const tags: string[] = [];

    if (post.link_flair_text) {
      tags.push(post.link_flair_text);
    }

    if (post.author_flair_text) {
      tags.push(`author:${post.author_flair_text}`);
    }

    if (post.over_18) {
      tags.push("NSFW");
    }

    if (post.spoiler) {
      tags.push("Spoiler");
    }

    if (post.stickied) {
      tags.push("Pinned");
    }

    if (post.locked) {
      tags.push("Locked");
    }

    if (post.distinguished) {
      tags.push(`distinguished:${post.distinguished}`);
    }

    return tags;
  }

  /**
   * Parse Reddit awards (gold, silver, etc.)
   */
  static parseAwards(data: any): Record<string, number> {
    const awards: Record<string, number> = {};

    if (data.all_awardings) {
      for (const award of data.all_awardings) {
        awards[award.name] = award.count || 1;
      }
    }

    // Legacy awards
    if (data.gilded) {
      awards["Gold"] = data.gilded;
    }

    return awards;
  }

  /**
   * Clean Reddit text content (remove markdown artifacts)
   */
  static cleanContent(text: string | undefined): string | null {
    if (!text) return null;

    // Remove Reddit-specific markdown
    const cleaned = text
      .replace(/^&gt;!(.+?)!&lt;/gm, "$1") // Spoiler tags
      .replace(/^&gt;\s*/gm, "") // Quote markers
      .replace(/\\/g, "") // Escaped characters
      .trim();

    return cleaned || null;
  }

  /**
   * Parse subreddit rules from about endpoint
   */
  static parseSubredditRules(
    rules: any[],
  ): Array<{ name: string; description: string }> {
    if (!Array.isArray(rules)) return [];

    return rules.map((rule) => ({
      name: rule.short_name || rule.kind || "Rule",
      description: rule.description || rule.violation_reason || "",
    }));
  }

  /**
   * Extract mentioned users from text
   */
  static extractMentions(text: string | undefined | null): string[] {
    if (!text) return [];
    const mentions: string[] = [];
    const mentionRegex = /(?:^|\s)(?:\/)?u\/([a-zA-Z0-9_-]+)/g;

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1]) mentions.push(match[1]);
    }

    return [...new Set(mentions)];
  }

  /**
   * Extract subreddit references from text
   */
  static extractSubreddits(text: string | undefined | null): string[] {
    if (!text) return [];
    const subreddits: string[] = [];
    const subredditRegex = /(?:^|\s)(?:\/)?r\/([a-zA-Z0-9_]+)/g;

    let match;
    while ((match = subredditRegex.exec(text)) !== null) {
      if (match[1]) subreddits.push(match[1]);
    }

    return [...new Set(subreddits)];
  }

  /**
   * Calculate comment thread statistics
   */
  static calculateThreadStats(comments: Comment[]): {
    totalComments: number;
    maxDepth: number;
    uniqueAuthors: number;
    averageScore: number;
  } {
    const depths = new Map<string, number>();
    const scores: number[] = [];
    const authors = new Set<string>();

    // Build depth map
    for (const comment of comments) {
      authors.add(comment.author);
      scores.push(comment.score || 0);

      let depth = 0;
      let currentId = comment.parentId;

      while (currentId) {
        depth++;
        const parent = comments.find((c) => c.id === currentId);
        currentId = parent?.parentId || null;
      }

      depths.set(comment.id, depth);
    }

    const maxDepth = Math.max(...Array.from(depths.values()), 0);
    const averageScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      totalComments: comments.length,
      maxDepth,
      uniqueAuthors: authors.size,
      averageScore,
    };
  }

  /**
   * Parse Reddit timestamp (seconds since epoch)
   */
  static parseTimestamp(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  /**
   * Format Reddit permalink to full URL
   */
  static formatPermalink(permalink: string): string {
    if (permalink.startsWith("http")) {
      return permalink;
    }
    return `https://reddit.com${permalink}`;
  }

  /**
   * Determine post type from Reddit post data
   */
  static determinePostType(
    post: RedditPost,
  ): "text" | "link" | "image" | "video" | "gallery" {
    if (post.is_self) {
      return "text";
    }

    if (post.is_video || post.media?.reddit_video) {
      return "video";
    }

    if ((post as any).is_gallery || (post as any).media_metadata) {
      return "gallery";
    }

    // Check URL for image extensions
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const url = post.url.toLowerCase();

    if (imageExtensions.some((ext) => url.includes(ext))) {
      return "image";
    }

    return "link";
  }

  /**
   * Extract crosspost information
   */
  static extractCrosspostInfo(post: any): {
    originalSubreddit: string;
    originalAuthor: string;
    originalId: string;
  } | null {
    if (
      !post.crosspost_parent_list ||
      post.crosspost_parent_list.length === 0
    ) {
      return null;
    }

    const original = post.crosspost_parent_list[0];

    return {
      originalSubreddit: original.subreddit || "",
      originalAuthor: original.author || "",
      originalId: original.id || "",
    };
  }

  /**
   * Parse vote ratio to upvotes/downvotes estimate
   */
  static estimateVotes(
    score: number,
    upvoteRatio: number,
  ): {
    upvotes: number;
    downvotes: number;
  } {
    if (upvoteRatio === 0 || score === 0) {
      return { upvotes: 0, downvotes: 0 };
    }

    // Reddit's formula: score = upvotes - downvotes
    // upvote_ratio = upvotes / (upvotes + downvotes)
    const totalVotes = Math.round(Math.abs(score) / (2 * upvoteRatio - 1));
    const upvotes = Math.round(totalVotes * upvoteRatio);
    const downvotes = totalVotes - upvotes;

    return {
      upvotes: Math.max(0, upvotes),
      downvotes: Math.max(0, downvotes),
    };
  }

  /**
   * Check if content contains potential spoilers
   */
  static containsSpoilers(text: string): boolean {
    const spoilerPatterns = [
      /&gt;!.+?!&lt;/g, // Reddit spoiler syntax
      /\bspoiler\b/i,
      /\bspoilers\b/i,
      /\bleaks?\b/i,
    ];

    return spoilerPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Extract domains from URLs in post
   */
  static extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }
}

/**
 * Reddit-specific data validators
 */
export class RedditValidators {
  /**
   * Validate Reddit username format
   */
  static isValidUsername(username: string): boolean {
    // Reddit usernames: 3-20 characters, alphanumeric with underscores and hyphens
    const pattern = /^[a-zA-Z0-9_-]{3,20}$/;
    return pattern.test(username);
  }

  /**
   * Validate subreddit name format
   */
  static isValidSubreddit(name: string): boolean {
    // Subreddit names: 3-21 characters, alphanumeric with underscores
    const pattern = /^[a-zA-Z0-9_]{3,21}$/;
    return pattern.test(name);
  }

  /**
   * Validate Reddit post ID format
   */
  static isValidPostId(id: string): boolean {
    // Reddit IDs are base36 strings
    const pattern = /^[a-z0-9]+$/;
    return pattern.test(id);
  }

  /**
   * Check if URL is a Reddit URL
   */
  static isRedditUrl(url: string): boolean {
    const redditDomains = [
      "reddit.com",
      "www.reddit.com",
      "old.reddit.com",
      "new.reddit.com",
      "m.reddit.com",
      "i.reddit.com",
      "v.redd.it",
      "redd.it",
    ];

    try {
      const urlObj = new URL(url);
      return redditDomains.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  /**
   * Extract post ID from Reddit URL
   */
  static extractPostIdFromUrl(url: string | undefined | null): string | null {
    if (!url) return null;
    const patterns = [/\/comments\/([a-z0-9]+)/i, /redd\.it\/([a-z0-9]+)/i];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract subreddit from Reddit URL
   */
  static extractSubredditFromUrl(
    url: string | undefined | null,
  ): string | null {
    if (!url) return null;
    const pattern = /\/r\/([a-zA-Z0-9_]+)/;
    const match = url.match(pattern);
    return match && match[1] ? match[1] : null;
  }
}
