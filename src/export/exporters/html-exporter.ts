/**
 * HTML exporter for forum data with rich formatting
 */

import type {
  ForumPost,
  Comment,
  User,
  ScrapeResult,
} from "../../types/core.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface HtmlExportOptions {
  includeComments?: boolean;
  includeUsers?: boolean;
  includeMetadata?: boolean;
  includeStyles?: boolean;
  darkMode?: boolean;
  embedImages?: boolean;
  collapsibleComments?: boolean;
  maxCommentDepth?: number;
  includeSearch?: boolean;
}

export class HtmlExporter {
  private options: HtmlExportOptions;

  constructor(options: HtmlExportOptions = {}) {
    this.options = {
      includeComments: true,
      includeUsers: false,
      includeMetadata: true,
      includeStyles: true,
      darkMode: false,
      embedImages: false,
      collapsibleComments: true,
      maxCommentDepth: 10,
      includeSearch: true,
      ...options,
    };
  }

  /**
   * Export ScrapeResult to HTML format
   */
  async export(data: ScrapeResult, outputPath: string): Promise<string> {
    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Add extension if not present
    if (!outputPath.endsWith(".html")) {
      outputPath = `${outputPath}.html`;
    }

    const html = this.generateHtml(data);
    writeFileSync(outputPath, html);
    return outputPath;
  }

  /**
   * Generate complete HTML document
   */
  private generateHtml(data: ScrapeResult): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forum Data Export - ${data.metadata?.platform || "All Platforms"}</title>
    ${this.options.includeStyles ? this.generateStyles() : ""}
</head>
<body class="${this.options.darkMode ? "dark-mode" : ""}">
    <div class="container">
        ${this.generateHeader(data)}
        ${this.options.includeMetadata ? this.generateMetadataSection(data) : ""}
        ${this.options.includeSearch ? this.generateSearchSection() : ""}
        ${this.generatePostsSection(data)}
        ${this.options.includeUsers && data.users ? this.generateUsersSection(data.users) : ""}
    </div>
    ${this.options.includeSearch || this.options.collapsibleComments ? this.generateScripts() : ""}
</body>
</html>`;
  }

  /**
   * Generate CSS styles
   */
  private generateStyles(): string {
    return `<style>
        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f8f9fa;
            --bg-tertiary: #e9ecef;
            --text-primary: #212529;
            --text-secondary: #6c757d;
            --border-color: #dee2e6;
            --link-color: #0066cc;
            --link-hover: #0052a3;
            --score-positive: #28a745;
            --score-negative: #dc3545;
            --shadow: 0 1px 3px rgba(0,0,0,0.12);
        }

        body.dark-mode {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2d2d2d;
            --bg-tertiary: #3a3a3a;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --border-color: #4a4a4a;
            --link-color: #5db3ff;
            --link-hover: #7dc3ff;
            --score-positive: #5cb85c;
            --score-negative: #d9534f;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background-color: var(--bg-primary);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            background: var(--bg-secondary);
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: var(--shadow);
        }

        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        h2 {
            font-size: 1.8em;
            margin: 30px 0 20px;
            color: var(--text-primary);
        }

        h3 {
            font-size: 1.4em;
            margin: 20px 0 15px;
        }

        .metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            background: var(--bg-secondary);
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: var(--bg-primary);
            padding: 15px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
        }

        .stat-label {
            font-size: 0.9em;
            color: var(--text-secondary);
            margin-bottom: 5px;
        }

        .stat-value {
            font-size: 1.5em;
            font-weight: bold;
        }

        .search-container {
            margin-bottom: 30px;
        }

        .search-input {
            width: 100%;
            padding: 12px 20px;
            font-size: 16px;
            border: 2px solid var(--border-color);
            border-radius: 8px;
            background: var(--bg-primary);
            color: var(--text-primary);
        }

        .post {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: var(--shadow);
            transition: transform 0.2s;
        }

        .post:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .post-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 15px;
        }

        .post-title {
            font-size: 1.3em;
            font-weight: 600;
            color: var(--text-primary);
            text-decoration: none;
            flex: 1;
        }

        .post-title:hover {
            color: var(--link-hover);
        }

        .post-meta {
            display: flex;
            gap: 20px;
            color: var(--text-secondary);
            font-size: 0.9em;
            margin-bottom: 15px;
        }

        .post-content {
            background: var(--bg-primary);
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .comments-section {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid var(--border-color);
        }

        .comment {
            background: var(--bg-primary);
            border-left: 3px solid var(--border-color);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 4px;
        }

        .comment-nested {
            margin-left: 20px;
        }

        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 0.9em;
            color: var(--text-secondary);
        }

        .comment-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .collapsible {
            cursor: pointer;
            user-select: none;
        }

        .collapsible::before {
            content: "▼ ";
            display: inline-block;
            transition: transform 0.2s;
        }

        .collapsible.collapsed::before {
            transform: rotate(-90deg);
        }

        .collapsed + .comment-thread {
            display: none;
        }

        .score {
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
        }

        .score-positive {
            background: var(--score-positive);
            color: white;
        }

        .score-negative {
            background: var(--score-negative);
            color: white;
        }

        .users-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg-secondary);
            border-radius: 8px;
            overflow: hidden;
        }

        .users-table th,
        .users-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        .users-table th {
            background: var(--bg-tertiary);
            font-weight: 600;
        }

        .users-table tr:hover {
            background: var(--bg-tertiary);
        }

        a {
            color: var(--link-color);
            text-decoration: none;
        }

        a:hover {
            color: var(--link-hover);
            text-decoration: underline;
        }

        .platform-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
            background: var(--bg-tertiary);
            color: var(--text-primary);
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .post-header {
                flex-direction: column;
            }

            .post-meta {
                flex-direction: column;
                gap: 5px;
            }
        }
    </style>`;
  }

  /**
   * Generate JavaScript for interactivity
   */
  private generateScripts(): string {
    return `<script>
        // Search functionality
        if (document.getElementById('search-input')) {
            document.getElementById('search-input').addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase();
                const posts = document.querySelectorAll('.post');
                
                posts.forEach(post => {
                    const title = post.querySelector('.post-title').textContent.toLowerCase();
                    const content = post.querySelector('.post-content')?.textContent.toLowerCase() || '';
                    const author = post.querySelector('.author').textContent.toLowerCase();
                    
                    if (title.includes(searchTerm) || content.includes(searchTerm) || author.includes(searchTerm)) {
                        post.style.display = '';
                    } else {
                        post.style.display = 'none';
                    }
                });
            });
        }

        // Collapsible comments
        document.querySelectorAll('.collapsible').forEach(element => {
            element.addEventListener('click', function() {
                this.classList.toggle('collapsed');
            });
        });

        // Sort table functionality
        document.querySelectorAll('th[data-sortable]').forEach(header => {
            header.addEventListener('click', function() {
                const table = this.closest('table');
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const columnIndex = Array.from(this.parentNode.children).indexOf(this);
                const isNumeric = this.dataset.sortable === 'numeric';
                
                rows.sort((a, b) => {
                    const aValue = a.children[columnIndex].textContent;
                    const bValue = b.children[columnIndex].textContent;
                    
                    if (isNumeric) {
                        return parseFloat(aValue) - parseFloat(bValue);
                    }
                    return aValue.localeCompare(bValue);
                });
                
                if (this.dataset.sortOrder === 'asc') {
                    rows.reverse();
                    this.dataset.sortOrder = 'desc';
                } else {
                    this.dataset.sortOrder = 'asc';
                }
                
                tbody.innerHTML = '';
                rows.forEach(row => tbody.appendChild(row));
            });
        });
    </script>`;
  }

  /**
   * Generate header section
   */
  private generateHeader(data: ScrapeResult): string {
    const platform = data.metadata?.platform || "All Platforms";
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `<header>
        <h1>📊 Forum Data Export</h1>
        <p>Platform: <span class="platform-badge">${platform}</span> | Exported: ${date}</p>
    </header>`;
  }

  /**
   * Generate metadata section
   */
  private generateMetadataSection(data: ScrapeResult): string {
    // metadata variable removed - not used
    const stats = [
      { label: "Total Posts", value: data.posts.length.toLocaleString() },
      {
        label: "Total Comments",
        value: (data.comments?.length || 0).toLocaleString(),
      },
      {
        label: "Unique Users",
        value: (data.users?.length || 0).toLocaleString(),
      },
      {
        label: "Average Score",
        value: this.calculateAverageScore(data.posts).toFixed(1),
      },
    ];

    return `<section class="metadata">
        ${stats
          .map(
            (stat) => `
            <div class="stat-card">
                <div class="stat-label">${stat.label}</div>
                <div class="stat-value">${stat.value}</div>
            </div>
        `,
          )
          .join("")}
    </section>`;
  }

  /**
   * Generate search section
   */
  private generateSearchSection(): string {
    return `<section class="search-container">
        <input type="text" id="search-input" class="search-input" placeholder="Search posts by title, content, or author...">
    </section>`;
  }

  /**
   * Generate posts section
   */
  private generatePostsSection(data: ScrapeResult): string {
    const postsHtml = data.posts
      .map((post) => this.generatePost(post, data.comments))
      .join("");

    return `<section class="posts-section">
        <h2>Posts</h2>
        ${postsHtml}
    </section>`;
  }

  /**
   * Generate single post
   */
  private generatePost(post: ForumPost, allComments?: Comment[]): string {
    const postComments = allComments?.filter((c) => c.postId === post.id) || [];
    const scoreClass = post.score >= 0 ? "score-positive" : "score-negative";

    return `<article class="post">
        <div class="post-header">
            <a href="${post.url}" target="_blank" class="post-title">${this.escapeHtml(post.title)}</a>
        </div>
        <div class="post-meta">
            <span class="author">👤 ${this.escapeHtml(post.author)}</span>
            <span class="score ${scoreClass}">⬆️ ${post.score}</span>
            <span>💬 ${post.commentCount} comments</span>
            <span>📅 ${this.formatDate(post.createdAt)}</span>
            <span class="platform-badge">${post.platform}</span>
        </div>
        ${post.content ? `<div class="post-content">${this.escapeHtml(post.content)}</div>` : ""}
        ${this.options.includeComments && postComments.length > 0 ? this.generateCommentsSection(postComments) : ""}
    </article>`;
  }

  /**
   * Generate comments section
   */
  private generateCommentsSection(comments: Comment[]): string {
    const tree = this.buildCommentTree(comments);

    return `<div class="comments-section">
        <h3 ${this.options.collapsibleComments ? 'class="collapsible"' : ""}>Comments (${comments.length})</h3>
        <div class="comment-thread">
            ${this.renderCommentTree(tree)}
        </div>
    </div>`;
  }

  /**
   * Build comment tree structure
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
    const comments = tree.get(parentId) || [];

    return comments
      .map((comment) => {
        const children =
          depth < this.options.maxCommentDepth!
            ? this.renderCommentTree(tree, comment.id, depth + 1)
            : "";

        return this.renderComment(comment, children, depth);
      })
      .join("");
  }

  /**
   * Render single comment
   */
  private renderComment(
    comment: Comment,
    children: string,
    depth: number,
  ): string {
    const nestedClass = depth > 0 ? "comment-nested" : "";

    return `<div class="comment ${nestedClass}">
        <div class="comment-header">
            <span>👤 <strong>${this.escapeHtml(comment.author)}</strong></span>
            <span>${comment.score} points • ${this.formatDate(comment.createdAt)}</span>
        </div>
        <div class="comment-content">${this.escapeHtml(comment.content)}</div>
        ${children}
    </div>`;
  }

  /**
   * Generate users section
   */
  private generateUsersSection(users: User[]): string {
    const sortedUsers = [...users].sort(
      (a, b) => (b.karma || 0) - (a.karma || 0),
    );
    const topUsers = sortedUsers.slice(0, 100);

    return `<section class="users-section">
        <h2>Top Users</h2>
        <table class="users-table">
            <thead>
                <tr>
                    <th data-sortable="text">Username</th>
                    <th data-sortable="text">Platform</th>
                    <th data-sortable="numeric">Karma</th>
                    <th data-sortable="text">Member Since</th>
                </tr>
            </thead>
            <tbody>
                ${topUsers
                  .map(
                    (user) => `
                    <tr>
                        <td>${this.escapeHtml(user.username)}</td>
                        <td><span class="platform-badge">${user.platform}</span></td>
                        <td>${user.karma?.toLocaleString() || "N/A"}</td>
                        <td>${user.createdAt ? this.formatDate(user.createdAt) : "N/A"}</td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
        ${users.length > 100 ? `<p><em>Showing top 100 of ${users.length} users</em></p>` : ""}
    </section>`;
  }

  /**
   * Calculate average score
   */
  private calculateAverageScore(posts: ForumPost[]): number {
    if (posts.length === 0) return 0;
    const total = posts.reduce((sum, post) => sum + post.score, 0);
    return total / posts.length;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    if (!date) return "Unknown";
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m] || m);
  }
}
