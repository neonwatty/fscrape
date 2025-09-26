import { ForumPost } from '@/lib/db/types';

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Export options configuration
 */
export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  dateFormat?: 'iso' | 'locale' | 'unix';
  columns?: ExportColumn[];
}

/**
 * Column configuration for export
 */
export interface ExportColumn {
  key: keyof ForumPost | string;
  label: string;
  formatter?: (value: unknown, post: ForumPost) => string;
}

/**
 * Export progress callback
 */
export type ExportProgressCallback = (progress: {
  current: number;
  total: number;
  percentage: number;
}) => void;

/**
 * Default columns for export
 */
export const defaultExportColumns: ExportColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'platform', label: 'Platform' },
  { key: 'source', label: 'Source', formatter: (_, post) => post.source || post.subreddit || '' },
  { key: 'score', label: 'Score' },
  { key: 'num_comments', label: 'Comments' },
  { key: 'url', label: 'URL', formatter: (_, post) => post.url || post.permalink },
  {
    key: 'created_utc',
    label: 'Date',
    formatter: (value) => new Date((value as number) * 1000).toISOString(),
  },
];

/**
 * Escape CSV field value
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);

  // Check if the field needs quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Format date based on format option
 */
function formatDate(timestamp: number, format: ExportOptions['dateFormat'] = 'iso'): string {
  const date = new Date(timestamp * 1000);

  switch (format) {
    case 'locale':
      return date.toLocaleString();
    case 'unix':
      return String(timestamp);
    case 'iso':
    default:
      return date.toISOString();
  }
}

/**
 * Export posts to CSV format
 */
export function exportToCSV(
  posts: ForumPost[],
  options: Partial<ExportOptions> = {},
  onProgress?: ExportProgressCallback
): string {
  const { includeHeaders = true, dateFormat = 'iso', columns = defaultExportColumns } = options;

  const lines: string[] = [];

  // Add headers
  if (includeHeaders) {
    const headers = columns.map((col) => escapeCSVField(col.label));
    lines.push(headers.join(','));
  }

  // Process each post
  posts.forEach((post, index) => {
    if (onProgress && index % 100 === 0) {
      onProgress({
        current: index,
        total: posts.length,
        percentage: Math.round((index / posts.length) * 100),
      });
    }

    const row = columns.map((col) => {
      let value: unknown = post[col.key as keyof ForumPost];

      // Apply custom formatter if provided
      if (col.formatter) {
        value = col.formatter(value, post);
      } else if (col.key === 'created_utc' && typeof value === 'number') {
        value = formatDate(value, dateFormat);
      }

      return escapeCSVField(value);
    });

    lines.push(row.join(','));
  });

  if (onProgress) {
    onProgress({
      current: posts.length,
      total: posts.length,
      percentage: 100,
    });
  }

  return lines.join('\n');
}

/**
 * Export posts to JSON format
 */
export function exportToJSON(
  posts: ForumPost[],
  options: Partial<ExportOptions> = {},
  onProgress?: ExportProgressCallback
): string {
  const { dateFormat = 'iso', columns = defaultExportColumns } = options;

  // If no columns specified, export all data
  if (columns === defaultExportColumns) {
    const processedPosts = posts.map((post, index) => {
      if (onProgress && index % 100 === 0) {
        onProgress({
          current: index,
          total: posts.length,
          percentage: Math.round((index / posts.length) * 100),
        });
      }

      return {
        ...post,
        created_utc_formatted: formatDate(post.created_utc, dateFormat),
      };
    });

    if (onProgress) {
      onProgress({
        current: posts.length,
        total: posts.length,
        percentage: 100,
      });
    }

    return JSON.stringify(processedPosts, null, 2);
  }

  // Export only specified columns
  const processedPosts = posts.map((post, index) => {
    if (onProgress && index % 100 === 0) {
      onProgress({
        current: index,
        total: posts.length,
        percentage: Math.round((index / posts.length) * 100),
      });
    }

    const exportedPost: Record<string, unknown> = {};

    columns.forEach((col) => {
      let value: unknown = post[col.key as keyof ForumPost];

      if (col.formatter) {
        value = col.formatter(value, post);
      } else if (col.key === 'created_utc' && typeof value === 'number') {
        value = formatDate(value, dateFormat);
      }

      exportedPost[col.label] = value;
    });

    return exportedPost;
  });

  if (onProgress) {
    onProgress({
      current: posts.length,
      total: posts.length,
      percentage: 100,
    });
  }

  return JSON.stringify(processedPosts, null, 2);
}

/**
 * Create and download a file from content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  // Create blob from content
  const blob = new Blob([content], { type: mimeType });

  // Create object URL
  const url = URL.createObjectURL(blob);

  // Create temporary download link
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);

  // Release object URL after a short delay to ensure download starts
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Export posts with automatic format detection
 */
export async function exportPosts(
  posts: ForumPost[],
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  const { format, filename = `posts-export-${new Date().toISOString().split('T')[0]}` } = options;

  let content: string;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case 'csv':
      content = exportToCSV(posts, options, onProgress);
      mimeType = 'text/csv;charset=utf-8;';
      extension = 'csv';
      break;

    case 'json':
      content = exportToJSON(posts, options, onProgress);
      mimeType = 'application/json;charset=utf-8;';
      extension = 'json';
      break;

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const fullFilename = filename.endsWith(`.${extension}`) ? filename : `${filename}.${extension}`;

  downloadFile(content, fullFilename, mimeType);
}

/**
 * Estimate export size in bytes
 */
export function estimateExportSize(posts: ForumPost[], format: ExportFormat): number {
  if (posts.length === 0) return 0;

  // Sample first 10 posts for estimation
  const sampleSize = Math.min(10, posts.length);
  const samplePosts = posts.slice(0, sampleSize);

  let sampleContent: string;
  if (format === 'csv') {
    sampleContent = exportToCSV(samplePosts, { includeHeaders: true });
  } else {
    sampleContent = exportToJSON(samplePosts);
  }

  // Calculate average bytes per post
  const bytesPerPost = new Blob([sampleContent]).size / sampleSize;

  // Estimate total size
  return Math.ceil(bytesPerPost * posts.length);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
