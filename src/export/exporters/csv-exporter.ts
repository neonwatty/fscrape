/**
 * CSV exporter for forum data using csv-writer library
 */

import { createObjectCsvWriter } from "csv-writer";
import type { ForumPost, Comment, User, ScrapeResult } from "../../types/core.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface CsvExportOptions {
  includeComments?: boolean;
  includeUsers?: boolean;
  separateFiles?: boolean;
  delimiter?: string;
  headers?: boolean;
}

export class CsvExporter {
  private options: CsvExportOptions;

  constructor(options: CsvExportOptions = {}) {
    this.options = {
      includeComments: true,
      includeUsers: false,
      separateFiles: false,
      delimiter: ",",
      headers: true,
      ...options,
    };
  }

  /**
   * Export ScrapeResult to CSV format
   */
  async export(data: ScrapeResult, outputPath: string): Promise<string[]> {
    const exportedFiles: string[] = [];

    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Remove extension if present for base path
    const basePath = outputPath.replace(/\.csv$/, "");

    if (this.options.separateFiles) {
      // Export to separate files
      const postsFile = await this.exportPosts(data.posts, `${basePath}_posts.csv`);
      exportedFiles.push(postsFile);

      if (this.options.includeComments && data.comments) {
        const commentsFile = await this.exportComments(data.comments, `${basePath}_comments.csv`);
        exportedFiles.push(commentsFile);
      }

      if (this.options.includeUsers && data.users) {
        const usersFile = await this.exportUsers(data.users, `${basePath}_users.csv`);
        exportedFiles.push(usersFile);
      }
    } else {
      // Export posts to single file (default behavior)
      const file = await this.exportPosts(data.posts, `${basePath}.csv`);
      exportedFiles.push(file);
    }

    return exportedFiles;
  }

  /**
   * Export posts to CSV
   */
  async exportPosts(posts: ForumPost[], outputPath: string): Promise<string> {
    if (posts.length === 0) {
      writeFileSync(outputPath, "");
      return outputPath;
    }

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: "id", title: "ID" },
        { id: "title", title: "Title" },
        { id: "author", title: "Author" },
        { id: "authorId", title: "Author ID" },
        { id: "url", title: "URL" },
        { id: "score", title: "Score" },
        { id: "commentCount", title: "Comment Count" },
        { id: "platform", title: "Platform" },
        { id: "createdAt", title: "Created At" },
        { id: "updatedAt", title: "Updated At" },
        { id: "content", title: "Content" },
      ],
    });

    // Transform posts for CSV output
    const records = posts.map((post) => ({
      id: post.id,
      title: this.escapeField(post.title),
      author: post.author,
      authorId: post.authorId || "",
      url: post.url,
      score: post.score,
      commentCount: post.commentCount,
      platform: post.platform,
      createdAt: this.formatDate(post.createdAt),
      updatedAt: post.updatedAt ? this.formatDate(post.updatedAt) : "",
      content: post.content ? this.escapeField(post.content) : "",
    }));

    await csvWriter.writeRecords(records);
    return outputPath;
  }

  /**
   * Export comments to CSV
   */
  async exportComments(comments: Comment[], outputPath: string): Promise<string> {
    if (comments.length === 0) {
      writeFileSync(outputPath, "");
      return outputPath;
    }

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: "id", title: "ID" },
        { id: "postId", title: "Post ID" },
        { id: "parentId", title: "Parent ID" },
        { id: "author", title: "Author" },
        { id: "authorId", title: "Author ID" },
        { id: "content", title: "Content" },
        { id: "score", title: "Score" },
        { id: "depth", title: "Depth" },
        { id: "platform", title: "Platform" },
        { id: "createdAt", title: "Created At" },
        { id: "updatedAt", title: "Updated At" },
      ],
    });

    // Transform comments for CSV output
    const records = comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId || "",
      author: comment.author,
      authorId: comment.authorId || "",
      content: this.escapeField(comment.content),
      score: comment.score,
      depth: comment.depth,
      platform: comment.platform,
      createdAt: this.formatDate(comment.createdAt),
      updatedAt: comment.updatedAt ? this.formatDate(comment.updatedAt) : "",
    }));

    await csvWriter.writeRecords(records);
    return outputPath;
  }

  /**
   * Export users to CSV
   */
  async exportUsers(users: User[], outputPath: string): Promise<string> {
    if (users.length === 0) {
      writeFileSync(outputPath, "");
      return outputPath;
    }

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: "id", title: "ID" },
        { id: "username", title: "Username" },
        { id: "karma", title: "Karma" },
        { id: "platform", title: "Platform" },
        { id: "createdAt", title: "Created At" },
      ],
    });

    // Transform users for CSV output
    const records = users.map((user) => ({
      id: user.id,
      username: user.username,
      karma: user.karma ?? "",
      platform: user.platform,
      createdAt: user.createdAt ? this.formatDate(user.createdAt) : "",
    }));

    await csvWriter.writeRecords(records);
    return outputPath;
  }

  /**
   * Escape field for CSV output
   * Already handled by csv-writer, but keeping for special cases
   */
  private escapeField(value: string): string {
    // csv-writer handles escaping, but we'll clean up newlines
    return value.replace(/\r?\n/g, " ").trim();
  }

  /**
   * Format date for CSV output
   */
  private formatDate(date: Date): string {
    if (date instanceof Date) {
      return date.toISOString();
    }
    return String(date);
  }
}