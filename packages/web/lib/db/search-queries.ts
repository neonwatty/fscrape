import { ForumPost } from '@/lib/db/types';
import { executeQuery, executeQueryFirst, getDatabase } from '@/lib/db/sql-loader';

// Search result with highlighted text
export interface SearchResult extends ForumPost {
  titleHighlighted?: string;
  contentHighlighted?: string;
  relevanceScore?: number;
}

// Search suggestion
export interface SearchSuggestion {
  term: string;
  count: number;
  type: 'title' | 'author' | 'tag';
}

// Check if FTS5 is available
export function checkFTSSupport(): boolean {
  try {
    const result = executeQueryFirst<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='posts_fts'"
    );
    return (result?.count ?? 0) > 0;
  } catch {
    return false;
  }
}

// Create FTS5 virtual table for full-text search
export function createFTSTable(): void {
  const db = getDatabase();
  if (!db) return;

  try {
    // Drop existing FTS table if it exists
    db.run('DROP TABLE IF EXISTS posts_fts');

    // Create FTS5 virtual table
    db.run(`
      CREATE VIRTUAL TABLE posts_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        author,
        platform UNINDEXED,
        source UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 1',
        prefix = '2 3'
      )
    `);

    // Populate FTS table with existing data
    db.run(`
      INSERT INTO posts_fts (id, title, content, author, platform, source)
      SELECT 
        id,
        title,
        COALESCE(content, ''),
        COALESCE(author, ''),
        platform,
        COALESCE(source, subreddit, '')
      FROM posts
    `);

    // Optimize the FTS index
    db.run("INSERT INTO posts_fts(posts_fts) VALUES('optimize')");

    console.log('FTS5 table created and populated successfully');
  } catch (error) {
    console.error('Failed to create FTS table:', error);
  }
}

// Full-text search with FTS5
export function searchPostsFTS(
  query: string,
  limit: number = 50,
  offset: number = 0
): SearchResult[] {
  if (!checkFTSSupport()) {
    // Fall back to regular search if FTS is not available
    return searchPostsRegular(query, limit, offset);
  }

  // Prepare the search query for FTS5
  const ftsQuery = prepareFTSQuery(query);

  try {
    const results = executeQuery<SearchResult>(
      `
      SELECT 
        p.*,
        highlight(posts_fts, 1, '<mark>', '</mark>') as titleHighlighted,
        highlight(posts_fts, 2, '<mark>', '</mark>') as contentHighlighted,
        bm25(posts_fts) as relevanceScore
      FROM posts_fts f
      JOIN posts p ON f.id = p.id
      WHERE posts_fts MATCH ?
      ORDER BY relevanceScore
      LIMIT ? OFFSET ?
    `,
      [ftsQuery, limit, offset]
    );

    return results.map(formatSearchResult);
  } catch (error) {
    console.error('FTS search failed, falling back to regular search:', error);
    return searchPostsRegular(query, limit, offset);
  }
}

// Regular LIKE-based search (fallback)
export function searchPostsRegular(
  query: string,
  limit: number = 50,
  offset: number = 0
): SearchResult[] {
  const searchPattern = `%${query}%`;

  const results = executeQuery<ForumPost>(
    `
    SELECT *,
      CASE 
        WHEN title LIKE ? THEN 10
        WHEN content LIKE ? THEN 5
        WHEN author LIKE ? THEN 3
        ELSE 1
      END as relevanceScore
    FROM posts
    WHERE 
      title LIKE ? OR 
      content LIKE ? OR
      author LIKE ? OR
      source LIKE ? OR
      subreddit LIKE ?
    ORDER BY relevanceScore DESC, score DESC
    LIMIT ? OFFSET ?
  `,
    [
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      limit,
      offset,
    ]
  );

  return results.map((result) => ({
    ...result,
    titleHighlighted: highlightText(result.title, query),
    contentHighlighted: highlightText(result.content || '', query),
  }));
}

// Advanced search with filters
export function searchPostsAdvanced(
  query: string,
  filters: {
    platform?: string;
    author?: string;
    dateFrom?: Date;
    dateTo?: Date;
    scoreMin?: number;
    scoreMax?: number;
    hasComments?: boolean;
    sortBy?: 'relevance' | 'date' | 'score' | 'comments';
  } = {},
  limit: number = 50,
  offset: number = 0
): SearchResult[] {
  const conditions: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  // Add search condition
  if (query) {
    if (checkFTSSupport()) {
      conditions.push(`
        p.id IN (
          SELECT id FROM posts_fts 
          WHERE posts_fts MATCH ?
        )
      `);
      params.push(prepareFTSQuery(query));
    } else {
      conditions.push(`(
        title LIKE ? OR 
        content LIKE ? OR
        author LIKE ?
      )`);
      const pattern = `%${query}%`;
      params.push(pattern, pattern, pattern);
    }
  }

  // Add filter conditions
  if (filters.platform) {
    conditions.push('platform = ?');
    params.push(filters.platform);
  }

  if (filters.author) {
    conditions.push('author LIKE ?');
    params.push(`%${filters.author}%`);
  }

  if (filters.dateFrom) {
    conditions.push('created_utc >= ?');
    params.push(Math.floor(filters.dateFrom.getTime() / 1000));
  }

  if (filters.dateTo) {
    conditions.push('created_utc <= ?');
    params.push(Math.floor(filters.dateTo.getTime() / 1000));
  }

  if (filters.scoreMin !== undefined) {
    conditions.push('score >= ?');
    params.push(filters.scoreMin);
  }

  if (filters.scoreMax !== undefined) {
    conditions.push('score <= ?');
    params.push(filters.scoreMax);
  }

  if (filters.hasComments) {
    conditions.push('num_comments > 0');
  }

  // Build the WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Determine sort order
  let orderBy = 'score DESC';
  switch (filters.sortBy) {
    case 'date':
      orderBy = 'created_utc DESC';
      break;
    case 'score':
      orderBy = 'score DESC';
      break;
    case 'comments':
      orderBy = 'num_comments DESC';
      break;
    case 'relevance':
      if (query && checkFTSSupport()) {
        orderBy = 'relevanceScore DESC';
      }
      break;
  }

  // Build and execute query
  const sql = `
    SELECT p.*
    ${query && checkFTSSupport() ? `, bm25(posts_fts) as relevanceScore` : ''}
    FROM posts p
    ${query && checkFTSSupport() ? `JOIN posts_fts f ON p.id = f.id` : ''}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);
  const results = executeQuery<any>(sql, params);

  return results.map((result) => ({
    ...result,
    titleHighlighted: query ? highlightText(result.title, query) : result.title,
    contentHighlighted: query ? highlightText(result.content || '', query) : result.content,
  }));
}

// Get search suggestions based on partial query
export function getSearchSuggestions(partial: string, limit: number = 10): SearchSuggestion[] {
  const suggestions: SearchSuggestion[] = [];
  const pattern = `${partial}%`;

  // Get title suggestions
  const titleSuggestions = executeQuery<{ term: string; count: number }>(
    `
    SELECT 
      SUBSTR(title, 1, 50) as term,
      COUNT(*) as count
    FROM posts
    WHERE title LIKE ?
    GROUP BY SUBSTR(title, 1, 50)
    ORDER BY count DESC
    LIMIT ?
  `,
    [pattern, Math.ceil(limit / 3)]
  );

  suggestions.push(
    ...titleSuggestions.map((s) => ({
      ...s,
      type: 'title' as const,
    }))
  );

  // Get author suggestions
  const authorSuggestions = executeQuery<{ term: string; count: number }>(
    `
    SELECT 
      author as term,
      COUNT(*) as count
    FROM posts
    WHERE author LIKE ? AND author IS NOT NULL
    GROUP BY author
    ORDER BY count DESC
    LIMIT ?
  `,
    [pattern, Math.ceil(limit / 3)]
  );

  suggestions.push(
    ...authorSuggestions.map((s) => ({
      ...s,
      type: 'author' as const,
    }))
  );

  // Get tag/flair suggestions
  const tagSuggestions = executeQuery<{ term: string; count: number }>(
    `
    SELECT 
      link_flair_text as term,
      COUNT(*) as count
    FROM posts
    WHERE link_flair_text LIKE ? AND link_flair_text IS NOT NULL
    GROUP BY link_flair_text
    ORDER BY count DESC
    LIMIT ?
  `,
    [pattern, Math.ceil(limit / 3)]
  );

  suggestions.push(
    ...tagSuggestions.map((s) => ({
      ...s,
      type: 'tag' as const,
    }))
  );

  // Sort by count and limit
  return suggestions.sort((a, b) => b.count - a.count).slice(0, limit);
}

// Get popular search terms
export function getPopularSearchTerms(limit: number = 20): string[] {
  // This would ideally track actual search queries
  // For now, return most common terms from titles
  const results = executeQuery<{ term: string }>(
    `
    SELECT 
      LOWER(SUBSTR(title, 1, 30)) as term
    FROM posts
    WHERE score > 100
    GROUP BY LOWER(SUBSTR(title, 1, 30))
    ORDER BY COUNT(*) DESC, AVG(score) DESC
    LIMIT ?
  `,
    [limit]
  );

  return results.map((r) => r.term);
}

// Helper: Prepare query for FTS5
function prepareFTSQuery(query: string): string {
  // Escape special characters
  let ftsQuery = query.replace(/[^\w\s]/g, ' ');

  // Handle phrases (quoted text)
  const phrases = query.match(/"[^"]+"/g) || [];
  phrases.forEach((phrase) => {
    ftsQuery = ftsQuery.replace(phrase, phrase);
  });

  // Add prefix matching to each word (for autocomplete)
  const words = ftsQuery.split(/\s+/).filter((w) => w.length > 0);
  if (words.length > 0) {
    ftsQuery = words
      .map((word) => {
        // Don't add * to quoted phrases
        if (word.startsWith('"') && word.endsWith('"')) {
          return word;
        }
        // Add prefix matching
        return word + '*';
      })
      .join(' ');
  }

  return ftsQuery;
}

// Helper: Highlight matching text
function highlightText(text: string, query: string): string {
  if (!text || !query) return text;

  // Escape special regex characters in query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create regex for case-insensitive matching
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  // Replace matches with highlighted version
  return text.replace(regex, '<mark>$1</mark>');
}

// Helper: Format search result
function formatSearchResult(row: any): SearchResult {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    created_utc: row.created_utc,
    scraped_at: row.scraped_at,
    platform: row.platform,
    source: row.source || row.subreddit,
    content: row.content,
    url: row.url,
    permalink: row.permalink,
    score: row.score,
    num_comments: row.num_comments,
    upvote_ratio: row.upvote_ratio,
    subreddit: row.subreddit,
    link_flair_text: row.link_flair_text,
    is_self: row.is_self,
    is_video: row.is_video,
    is_original_content: row.is_original_content,
    over_18: row.over_18,
    spoiler: row.spoiler,
    stickied: row.stickied,
    locked: row.locked,
    distinguished: row.distinguished,
    edited: row.edited,
    author_flair_text: row.author_flair_text,
    removed_by_category: row.removed_by_category,
    domain: row.domain,
    thumbnail: row.thumbnail,
    gilded: row.gilded,
    total_awards_received: row.total_awards_received,
    deleted: row.deleted,
    removed: row.removed,
    titleHighlighted: row.titleHighlighted,
    contentHighlighted: row.contentHighlighted,
    relevanceScore: row.relevanceScore,
  };
}
