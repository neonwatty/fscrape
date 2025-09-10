/**
 * Export manager for handling data exports in various formats
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface ExportConfig {
  outputDirectory: string;
  defaultFormat: string;
  includeMetadata?: boolean;
}

export class ExportManager {
  constructor(config: ExportConfig) {
    // Config can be used for future enhancements
    void config;
  }

  /**
   * Export data in specified format
   */
  async exportData(
    data: any,
    format: string,
    outputPath: string,
  ): Promise<string> {
    // Ensure output directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Add extension if not present
    if (!outputPath.includes(".")) {
      outputPath = `${outputPath}.${format}`;
    }

    switch (format) {
      case "json":
        await this.exportAsJson(data, outputPath);
        break;
      case "csv":
        await this.exportAsCsv(data, outputPath);
        break;
      case "markdown":
        await this.exportAsMarkdown(data, outputPath);
        break;
      case "html":
        await this.exportAsHtml(data, outputPath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return outputPath;
  }

  private async exportAsJson(data: any, outputPath: string): Promise<void> {
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }

  private async exportAsCsv(data: any, outputPath: string): Promise<void> {
    // Simple CSV export for posts
    const posts = data.posts || [];
    const headers = ["id", "title", "author", "score", "commentCount", "createdAt", "platform"];
    const rows = [headers.join(",")];

    for (const post of posts) {
      const row = [
        post.id,
        `"${post.title.replace(/"/g, '""')}"`,
        post.author,
        post.score || 0,
        post.commentCount || 0,
        post.createdAt,
        post.platform,
      ];
      rows.push(row.join(","));
    }

    writeFileSync(outputPath, rows.join("\n"));
  }

  private async exportAsMarkdown(data: any, outputPath: string): Promise<void> {
    const posts = data.posts || [];
    let markdown = "# Scraped Data\n\n";

    if (data.metadata) {
      markdown += "## Metadata\n\n";
      markdown += `- **Platform**: ${data.metadata.platform}\n`;
      markdown += `- **Total Posts**: ${data.metadata.totalPosts}\n`;
      markdown += `- **Scraped At**: ${data.metadata.scrapedAt}\n\n`;
    }

    markdown += "## Posts\n\n";
    for (const post of posts) {
      markdown += `### ${post.title}\n\n`;
      markdown += `- **Author**: ${post.author}\n`;
      markdown += `- **Score**: ${post.score || 0}\n`;
      markdown += `- **Comments**: ${post.commentCount || 0}\n`;
      markdown += `- **URL**: ${post.url}\n\n`;
      
      if (post.content) {
        markdown += `${post.content}\n\n`;
      }
    }

    writeFileSync(outputPath, markdown);
  }

  private async exportAsHtml(data: any, outputPath: string): Promise<void> {
    const posts = data.posts || [];
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Scraped Data</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .post { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
    .meta { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Scraped Data</h1>`;

    if (data.metadata) {
      html += `
  <div class="metadata">
    <h2>Metadata</h2>
    <p>Platform: ${data.metadata.platform}</p>
    <p>Total Posts: ${data.metadata.totalPosts}</p>
    <p>Scraped At: ${data.metadata.scrapedAt}</p>
  </div>`;
    }

    html += "\n  <div class=\"posts\">\n    <h2>Posts</h2>";
    
    for (const post of posts) {
      html += `
    <div class="post">
      <h3>${post.title}</h3>
      <div class="meta">
        Author: ${post.author} | Score: ${post.score || 0} | Comments: ${post.commentCount || 0}
      </div>
      ${post.content ? `<p>${post.content}</p>` : ""}
      <a href="${post.url}">View Original</a>
    </div>`;
    }

    html += "\n  </div>\n</body>\n</html>";
    writeFileSync(outputPath, html);
  }
}