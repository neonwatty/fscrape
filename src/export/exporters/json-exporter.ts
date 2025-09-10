/**
 * JSON exporter for forum data with formatting options
 */

import type {
  ForumPost,
  Comment,
  User,
  ScrapeResult,
} from "../../types/core.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface JsonExportOptions {
  pretty?: boolean;
  indent?: number;
  includeMetadata?: boolean;
  includeComments?: boolean;
  includeUsers?: boolean;
  separateFiles?: boolean;
  dateFormat?: "iso" | "timestamp" | "locale";
  excludeNull?: boolean;
  compress?: boolean;
}

export class JsonExporter {
  private options: JsonExportOptions;

  constructor(options: JsonExportOptions = {}) {
    this.options = {
      pretty: true,
      indent: 2,
      includeMetadata: true,
      includeComments: true,
      includeUsers: true,
      separateFiles: false,
      dateFormat: "iso",
      excludeNull: false,
      compress: false,
      ...options,
    };
  }

  /**
   * Export ScrapeResult to JSON format
   */
  async export(data: ScrapeResult, outputPath: string): Promise<string[]> {
    const exportedFiles: string[] = [];

    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Remove extension if present for base path
    const basePath = outputPath.replace(/\.json$/, "");

    if (this.options.separateFiles) {
      // Export to separate files
      const postsFile = await this.exportPosts(
        data.posts,
        `${basePath}_posts.json`,
      );
      exportedFiles.push(postsFile);

      if (this.options.includeComments && data.comments) {
        const commentsFile = await this.exportComments(
          data.comments,
          `${basePath}_comments.json`,
        );
        exportedFiles.push(commentsFile);
      }

      if (this.options.includeUsers && data.users) {
        const usersFile = await this.exportUsers(
          data.users,
          `${basePath}_users.json`,
        );
        exportedFiles.push(usersFile);
      }

      if (this.options.includeMetadata && data.metadata) {
        const metadataFile = await this.exportMetadata(
          data.metadata,
          `${basePath}_metadata.json`,
        );
        exportedFiles.push(metadataFile);
      }
    } else {
      // Export everything to single file
      const file = await this.exportAll(data, `${basePath}.json`);
      exportedFiles.push(file);
    }

    return exportedFiles;
  }

  /**
   * Export complete data to JSON
   */
  async exportAll(data: ScrapeResult, outputPath: string): Promise<string> {
    const exportData = this.transformData(data);
    const jsonString = this.stringify(exportData);
    writeFileSync(outputPath, jsonString);
    return outputPath;
  }

  /**
   * Export posts to JSON
   */
  async exportPosts(posts: ForumPost[], outputPath: string): Promise<string> {
    const transformedPosts = posts.map((post) => this.transformPost(post));
    const jsonString = this.stringify(transformedPosts);
    writeFileSync(outputPath, jsonString);
    return outputPath;
  }

  /**
   * Export comments to JSON
   */
  async exportComments(
    comments: Comment[],
    outputPath: string,
  ): Promise<string> {
    const transformedComments = comments.map((comment) =>
      this.transformComment(comment),
    );
    const jsonString = this.stringify(transformedComments);
    writeFileSync(outputPath, jsonString);
    return outputPath;
  }

  /**
   * Export users to JSON
   */
  async exportUsers(users: User[], outputPath: string): Promise<string> {
    const transformedUsers = users.map((user) => this.transformUser(user));
    const jsonString = this.stringify(transformedUsers);
    writeFileSync(outputPath, jsonString);
    return outputPath;
  }

  /**
   * Export metadata to JSON
   */
  async exportMetadata(metadata: any, outputPath: string): Promise<string> {
    const transformedMetadata = this.transformMetadata(metadata);
    const jsonString = this.stringify(transformedMetadata);
    writeFileSync(outputPath, jsonString);
    return outputPath;
  }

  /**
   * Transform complete data for export
   */
  private transformData(data: ScrapeResult): any {
    const result: any = {
      posts: data.posts.map((post) => this.transformPost(post)),
    };

    if (this.options.includeComments && data.comments) {
      result.comments = data.comments.map((comment) =>
        this.transformComment(comment),
      );
    }

    if (this.options.includeUsers && data.users) {
      result.users = data.users.map((user) => this.transformUser(user));
    }

    if (this.options.includeMetadata && data.metadata) {
      result.metadata = this.transformMetadata(data.metadata);
    }

    return result;
  }

  /**
   * Transform post for export
   */
  private transformPost(post: ForumPost): any {
    const transformed: any = {
      id: post.id,
      title: post.title,
      author: post.author,
      url: post.url,
      score: post.score,
      commentCount: post.commentCount,
      platform: post.platform,
      createdAt: this.formatDate(post.createdAt),
    };

    // Handle optional fields
    if (!this.options.excludeNull || post.content !== null) {
      transformed.content = post.content;
    }

    if (post.authorId) {
      transformed.authorId = post.authorId;
    }

    if (post.updatedAt) {
      transformed.updatedAt = this.formatDate(post.updatedAt);
    }

    if (post.metadata) {
      transformed.metadata = post.metadata;
    }

    return transformed;
  }

  /**
   * Transform comment for export
   */
  private transformComment(comment: Comment): any {
    const transformed: any = {
      id: comment.id,
      postId: comment.postId,
      author: comment.author,
      content: comment.content,
      score: comment.score,
      depth: comment.depth,
      platform: comment.platform,
      createdAt: this.formatDate(comment.createdAt),
    };

    // Handle optional fields
    if (!this.options.excludeNull || comment.parentId !== null) {
      transformed.parentId = comment.parentId;
    }

    if (comment.authorId) {
      transformed.authorId = comment.authorId;
    }

    if (comment.updatedAt) {
      transformed.updatedAt = this.formatDate(comment.updatedAt);
    }

    return transformed;
  }

  /**
   * Transform user for export
   */
  private transformUser(user: User): any {
    const transformed: any = {
      id: user.id,
      username: user.username,
      platform: user.platform,
    };

    if (user.karma !== undefined) {
      transformed.karma = user.karma;
    }

    if (user.createdAt) {
      transformed.createdAt = this.formatDate(user.createdAt);
    }

    if (user.metadata) {
      transformed.metadata = user.metadata;
    }

    return transformed;
  }

  /**
   * Transform metadata for export
   */
  private transformMetadata(metadata: any): any {
    const transformed: any = {
      ...metadata,
    };

    // Format date fields in metadata
    if (metadata.scrapedAt) {
      transformed.scrapedAt = this.formatDate(metadata.scrapedAt);
    }

    return transformed;
  }

  /**
   * Format date based on options
   */
  private formatDate(date: Date): string | number {
    if (!date) return "";

    const d = date instanceof Date ? date : new Date(date);

    switch (this.options.dateFormat) {
      case "timestamp":
        return d.getTime();
      case "locale":
        return d.toLocaleString();
      case "iso":
      default:
        return d.toISOString();
    }
  }

  /**
   * Stringify data with formatting options
   */
  private stringify(data: any): string {
    if (this.options.compress) {
      return JSON.stringify(data);
    }

    if (this.options.pretty) {
      return JSON.stringify(data, null, this.options.indent);
    }

    return JSON.stringify(data);
  }
}
