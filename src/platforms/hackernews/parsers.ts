/**
 * HackerNews data parsers
 * Transforms HN API data to our common data structures
 */

import type { ForumPost, Comment, User } from "../../types/core.js";
import type { HNItem, HNUser } from "./client.js";

/**
 * Parse HackerNews story/post to ForumPost
 */
export function parsePost(item: HNItem): ForumPost | null {
  if (!item || item.type !== "story" || item.deleted || item.dead) {
    return null;
  }

  return {
    id: item.id.toString(),
    platform: "hackernews",
    title: item.title || "",
    content: item.text || "",
    author: item.by || "[deleted]",
    authorId: item.by || "deleted",
    createdAt: new Date(item.time * 1000),
    updatedAt: new Date(item.time * 1000),
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score || 0,
    commentCount: item.descendants || 0,
    metadata: {
      type: item.type,
      hasUrl: !!item.url,
      isDead: item.dead || false,
      isDeleted: item.deleted || false,
      kids: item.kids || [],
    },
  };
}

/**
 * Parse HackerNews comment to Comment
 */
export function parseComment(item: HNItem, postId?: string): Comment | null {
  if (!item || item.type !== "comment" || item.deleted || item.dead) {
    return null;
  }

  return {
    id: item.id.toString(),
    platform: "hackernews",
    postId: postId || (item.parent ? item.parent.toString() : ""),
    parentId: item.parent ? item.parent.toString() : undefined,
    content: item.text || "",
    author: item.by || "[deleted]",
    authorId: item.by || "deleted",
    createdAt: new Date(item.time * 1000),
    updatedAt: new Date(item.time * 1000),
    score: item.score || 0,
    depth: 0, // Will be calculated separately if needed
    metadata: {
      isDead: item.dead || false,
      isDeleted: item.deleted || false,
      kids: item.kids || [],
    },
  };
}

/**
 * Parse HackerNews user to User
 */
export function parseUser(hnUser: HNUser): User {
  return {
    id: hnUser.id,
    platform: "hackernews",
    username: hnUser.id,
    createdAt: new Date(hnUser.created * 1000),
    karma: hnUser.karma,
    metadata: {
      about: hnUser.about || "",
      submittedCount: hnUser.submitted?.length || 0,
      submitted: hnUser.submitted || [],
    },
  };
}

/**
 * Build comment tree from flat list of comments
 */
export function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];
  
  // First pass: create map
  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, replies: [] });
  }
  
  // Second pass: build tree
  for (const comment of commentMap.values()) {
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies = parent.replies || [];
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
 * Calculate comment depth
 */
export function calculateDepth(comment: Comment, commentMap: Map<string, Comment>): number {
  let depth = 0;
  let current = comment;
  
  while (current.parentId) {
    const parent = commentMap.get(current.parentId);
    if (!parent) break;
    depth++;
    current = parent;
  }
  
  return depth;
}

/**
 * Parse job posting (special type of story)
 */
export function parseJob(item: HNItem): ForumPost | null {
  if (!item || item.type !== "job" || item.deleted || item.dead) {
    return null;
  }

  return {
    id: item.id.toString(),
    platform: "hackernews",
    title: item.title || "",
    content: item.text || "",
    author: item.by || "jobs",
    authorId: item.by || "jobs",
    createdAt: new Date(item.time * 1000),
    updatedAt: new Date(item.time * 1000),
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score || 0,
    commentCount: 0,
    metadata: {
      type: "job",
      hasUrl: !!item.url,
      isDead: item.dead || false,
      isDeleted: item.deleted || false,
    },
  };
}

/**
 * Parse poll (special type of story with options)
 */
export function parsePoll(item: HNItem, pollOptions?: HNItem[]): ForumPost | null {
  if (!item || item.type !== "poll" || item.deleted || item.dead) {
    return null;
  }

  const options = pollOptions?.filter(opt => opt.type === "pollopt").map(opt => ({
    id: opt.id,
    text: opt.text || "",
    score: opt.score || 0,
  }));

  return {
    id: item.id.toString(),
    platform: "hackernews",
    title: item.title || "",
    content: item.text || "",
    author: item.by || "[deleted]",
    authorId: item.by || "deleted",
    createdAt: new Date(item.time * 1000),
    updatedAt: new Date(item.time * 1000),
    url: `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score || 0,
    commentCount: item.descendants || 0,
    metadata: {
      type: "poll",
      pollOptions: options || [],
      parts: item.parts || [],
      isDead: item.dead || false,
      isDeleted: item.deleted || false,
    },
  };
}

/**
 * Filter and clean HTML from HN content
 */
export function cleanContent(html: string): string {
  if (!html) return "";
  
  // HN returns HTML-encoded content, decode it
  return html
    .replace(/<p>/g, "\n\n")
    .replace(/<\/p>/g, "")
    .replace(/<pre><code>/g, "\n```\n")
    .replace(/<\/code><\/pre>/g, "\n```\n")
    .replace(/<code>/g, "`")
    .replace(/<\/code>/g, "`")
    .replace(/<i>/g, "_")
    .replace(/<\/i>/g, "_")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>/g, "[$1](")
    .replace(/<\/a>/g, ")")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/<[^>]*>/g, "") // Remove any remaining HTML tags
    .trim();
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date): string {
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
 * Parse story type from title
 */
export function parseStoryType(title: string): string {
  if (title.toLowerCase().startsWith("ask hn:")) return "ask";
  if (title.toLowerCase().startsWith("show hn:")) return "show";
  if (title.toLowerCase().startsWith("launch hn:")) return "launch";
  return "story";
}

/**
 * Batch parse items
 */
export function batchParseItems(items: HNItem[]): {
  posts: ForumPost[];
  comments: Comment[];
} {
  const posts: ForumPost[] = [];
  const comments: Comment[] = [];
  
  for (const item of items) {
    if (!item || item.deleted || item.dead) continue;
    
    switch (item.type) {
      case "story":
        const post = parsePost(item);
        if (post) posts.push(post);
        break;
      case "comment":
        const comment = parseComment(item);
        if (comment) comments.push(comment);
        break;
      case "job":
        const job = parseJob(item);
        if (job) posts.push(job);
        break;
      case "poll":
        const poll = parsePoll(item);
        if (poll) posts.push(poll);
        break;
    }
  }
  
  return { posts, comments };
}