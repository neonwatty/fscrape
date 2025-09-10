/**
 * Markdown exporter for forum data
 */

import type {
  ForumPost,
  Comment,
  User,
  ScrapeResult,
} from "../../types/core.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface MarkdownExportOptions {
  includeComments?: boolean;
  includeUsers?: boolean;
  includeMetadata?: boolean;
  includeTableOfContents?: boolean;
  commentThreading?: boolean;
  maxCommentDepth?: number;
  dateFormat?: "short" | "long" | "iso";
  includeStats?: boolean;
}

export class MarkdownExporter {
  private options: MarkdownExportOptions;

  constructor(options: MarkdownExportOptions = {}) {
    this.options = {
      includeComments: true,
      includeUsers: false,
      includeMetadata: true,
      includeTableOfContents: true,
      commentThreading: true,
      maxCommentDepth: 10,
      dateFormat: "short",
      includeStats: true,
      ...options,
    };
  }

  /**
   * Export ScrapeResult to Markdown format
   */
  async export(data: ScrapeResult, outputPath: string): Promise<string> {
    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Add extension if not present
    if (!outputPath.endsWith(".md")) {
      outputPath = `${outputPath}.md`;
    }

    const markdown = this.generateMarkdown(data);
    writeFileSync(outputPath, markdown);
    return outputPath;
  }

  /**
   * Generate complete Markdown document
   */
  private generateMarkdown(data: ScrapeResult): string {
    const sections: string[] = [];

    // Title
    sections.push("# Forum Data Export\n");

    // Metadata section
    if (this.options.includeMetadata && data.metadata) {
      sections.push(this.generateMetadataSection(data.metadata));
    }

    // Statistics section
    if (this.options.includeStats) {
      sections.push(this.generateStatsSection(data));
    }

    // Table of Contents
    if (this.options.includeTableOfContents && data.posts.length > 5) {
      sections.push(this.generateTableOfContents(data.posts));
    }

    // Posts section
    sections.push(this.generatePostsSection(data));

    // Users section
    if (this.options.includeUsers && data.users && data.users.length > 0) {
      sections.push(this.generateUsersSection(data.users));
    }

    return sections.join("\n");
  }

  /**
   * Generate metadata section
   */
  private generateMetadataSection(metadata: any): string {
    const lines: string[] = ["## Export Metadata\n"];

    const metaItems: string[] = [];

    if (metadata.platform) {
      metaItems.push(`**Platform:** ${metadata.platform}`);
    }

    if (metadata.scrapedAt) {
      metaItems.push(`**Scraped At:** ${this.formatDate(metadata.scrapedAt)}`);
    }

    if (metadata.query) {
      metaItems.push(`**Query:** ${metadata.query}`);
    }

    if (metadata.subreddit) {
      metaItems.push(`**Subreddit:** r/${metadata.subreddit}`);
    }

    if (metadata.category) {
      metaItems.push(`**Category:** ${metadata.category}`);
    }

    lines.push(metaItems.join(" | "));
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Generate statistics section
   */
  private generateStatsSection(data: ScrapeResult): string {
    const lines: string[] = ["## Statistics\n"];

    const stats: string[] = [];

    // Post statistics
    const totalPosts = data.posts.length;
    stats.push(`📊 **Total Posts:** ${totalPosts}`);

    if (totalPosts > 0) {
      const totalScore = data.posts.reduce((sum, post) => sum + post.score, 0);
      const avgScore = Math.round(totalScore / totalPosts);
      stats.push(`⬆️ **Average Score:** ${avgScore}`);

      const totalCommentCount = data.posts.reduce(
        (sum, post) => sum + post.commentCount,
        0,
      );
      const avgComments = Math.round(totalCommentCount / totalPosts);
      stats.push(`💬 **Average Comments per Post:** ${avgComments}`);
    }

    // Comment statistics
    if (data.comments) {
      stats.push(`💭 **Total Comments:** ${data.comments.length}`);
    }

    // User statistics
    if (data.users) {
      stats.push(`👥 **Unique Users:** ${data.users.length}`);
    }

    lines.push(stats.join(" | "));
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Generate table of contents
   */
  private generateTableOfContents(posts: ForumPost[]): string {
    const lines: string[] = ["## Table of Contents\n"];

    posts.slice(0, 20).forEach((post, index) => {
      const title = this.escapeMarkdown(post.title);
      const anchor = this.generateAnchor(post.title, index);
      lines.push(`${index + 1}. [${title}](#${anchor})`);
    });

    if (posts.length > 20) {
      lines.push(`\n*... and ${posts.length - 20} more posts*`);
    }

    lines.push("");
    return lines.join("\n");
  }

  /**
   * Generate posts section
   */
  private generatePostsSection(data: ScrapeResult): string {
    const lines: string[] = ["## Posts\n"];

    data.posts.forEach((post, index) => {
      lines.push(this.generatePost(post, index));

      // Add comments if available and enabled
      if (this.options.includeComments && data.comments) {
        const postComments = data.comments.filter((c) => c.postId === post.id);
        if (postComments.length > 0) {
          lines.push(this.generateCommentsSection(postComments));
        }
      }

      // Add separator between posts
      if (index < data.posts.length - 1) {
        lines.push("\n---\n");
      }
    });

    return lines.join("\n");
  }

  /**
   * Generate single post
   */
  private generatePost(post: ForumPost, index: number): string {
    const lines: string[] = [];

    // Post title with anchor
    const title = this.escapeMarkdown(post.title);
    const anchor = this.generateAnchor(post.title, index);
    lines.push(`### <a id="${anchor}"></a>${index + 1}. ${title}\n`);

    // Post metadata
    const metadata: string[] = [];
    metadata.push(`👤 **${post.author}**`);
    metadata.push(`⬆️ ${post.score} points`);
    metadata.push(`💬 ${post.commentCount} comments`);
    metadata.push(`📅 ${this.formatDate(post.createdAt)}`);
    metadata.push(`🔗 [View Original](${post.url})`);

    lines.push(metadata.join(" | "));
    lines.push("");

    // Post content
    if (post.content) {
      lines.push("#### Content\n");
      lines.push(this.formatContent(post.content));
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate comments section
   */
  private generateCommentsSection(comments: Comment[]): string {
    const lines: string[] = ["#### Comments\n"];

    if (this.options.commentThreading) {
      // Build comment tree
      const tree = this.buildCommentTree(comments);
      lines.push(this.renderCommentTree(tree));
    } else {
      // Flat list of comments
      comments.forEach((comment) => {
        lines.push(this.renderComment(comment, 0));
      });
    }

    return lines.join("\n");
  }

  /**
   * Build hierarchical comment tree
   */
  private buildCommentTree(comments: Comment[]): Map<string | null, Comment[]> {
    const tree = new Map<string | null, Comment[]>();

    comments.forEach((comment) => {
      const parentId = comment.parentId;
      if (!tree.has(parentId)) {
        tree.set(parentId, []);
      }
      tree.get(parentId)!.push(comment);
    });

    return tree;
  }

  /**
   * Render comment tree recursively
   */
  private renderCommentTree(
    tree: Map<string | null, Comment[]>,
    parentId: string | null = null,
    depth: number = 0,
  ): string {
    const lines: string[] = [];
    const comments = tree.get(parentId) || [];

    comments.forEach((comment) => {
      lines.push(this.renderComment(comment, depth));

      // Render children if within max depth
      if (depth < this.options.maxCommentDepth!) {
        const childrenOutput = this.renderCommentTree(
          tree,
          comment.id,
          depth + 1,
        );
        if (childrenOutput) {
          lines.push(childrenOutput);
        }
      }
    });

    return lines.join("\n");
  }

  /**
   * Render single comment
   */
  private renderComment(comment: Comment, depth: number): string {
    const indent = "  ".repeat(depth);
    const lines: string[] = [];

    // Comment header
    const header = `${indent}> **${comment.author}** (${comment.score} points) • ${this.formatDate(comment.createdAt)}`;
    lines.push(header);

    // Comment content (indented)
    const content = this.formatContent(comment.content);
    const contentLines = content.split("\n");
    contentLines.forEach((line) => {
      lines.push(`${indent}> ${line}`);
    });

    lines.push("");
    return lines.join("\n");
  }

  /**
   * Generate users section
   */
  private generateUsersSection(users: User[]): string {
    const lines: string[] = [
      "## Users\n",
      "| Username | Platform | Karma | Member Since |",
      "|----------|----------|-------|--------------|",
    ];

    // Sort users by karma (if available)
    const sortedUsers = [...users].sort(
      (a, b) => (b.karma || 0) - (a.karma || 0),
    );

    sortedUsers.slice(0, 50).forEach((user) => {
      const username = this.escapeMarkdown(user.username);
      const karma =
        user.karma !== undefined ? user.karma.toLocaleString() : "N/A";
      const memberSince = user.createdAt
        ? this.formatDate(user.createdAt)
        : "N/A";

      lines.push(
        `| ${username} | ${user.platform} | ${karma} | ${memberSince} |`,
      );
    });

    if (users.length > 50) {
      lines.push(`\n*... and ${users.length - 50} more users*`);
    }

    return lines.join("\n");
  }

  /**
   * Format date based on options
   */
  private formatDate(date: Date): string {
    if (!date) return "Unknown";

    const d = date instanceof Date ? date : new Date(date);

    switch (this.options.dateFormat) {
      case "iso":
        return d.toISOString();
      case "long":
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      case "short":
      default:
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
    }
  }

  /**
   * Format content for Markdown
   */
  private formatContent(content: string): string {
    // Preserve code blocks
    const codeBlocks: string[] = [];
    let formattedContent = content.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Format paragraphs
    formattedContent = formattedContent
      .split("\n\n")
      .map((para) => para.trim())
      .filter((para) => para.length > 0)
      .join("\n\n");

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      formattedContent = formattedContent.replace(
        `__CODE_BLOCK_${index}__`,
        block,
      );
    });

    return formattedContent;
  }

  /**
   * Escape special Markdown characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1");
  }

  /**
   * Generate anchor ID for table of contents
   */
  private generateAnchor(title: string, index: number): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);

    return `post-${index + 1}-${slug}`;
  }
}
