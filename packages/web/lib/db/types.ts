// Database schema types matching the backend fscrape database structure

export interface ForumPost {
  // Core fields
  id: string;
  title: string;
  author: string | null;
  created_utc: number;
  scraped_at: string;

  // Platform fields
  platform: 'reddit' | 'hackernews' | string;
  source: string; // subreddit or category

  // Content fields
  content: string | null;
  url: string | null;
  permalink: string;

  // Engagement metrics
  score: number;
  num_comments: number;
  upvote_ratio?: number;

  // Reddit specific
  subreddit?: string;
  link_flair_text?: string | null;
  is_self?: boolean;
  is_video?: boolean;
  is_original_content?: boolean;
  over_18?: boolean;
  spoiler?: boolean;
  stickied?: boolean;
  locked?: boolean;
  distinguished?: string | null;
  edited?: boolean | number;
  author_flair_text?: string | null;
  removed_by_category?: string | null;

  // Additional metadata
  domain?: string | null;
  thumbnail?: string | null;
  gilded?: number;
  total_awards_received?: number;

  // Status flags
  deleted?: boolean;
  removed?: boolean;
}

export interface ScrapingSession {
  id: string;
  platform: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  posts_count: number;
  success: boolean;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ScrapingMetric {
  id: string;
  session_id: string;
  metric_name: string;
  metric_value: number;
  recorded_at: string;
}

// Query filter types
export interface PostFilters {
  platform?: string;
  source?: string;
  author?: string;
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
  scoreMin?: number;
  scoreMax?: number;
  commentsMin?: number;
  commentsMax?: number;
  category?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  sortBy?: 'created_utc' | 'score' | 'num_comments' | 'upvote_ratio';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Aggregation result types
export interface PlatformStats {
  platform: string;
  totalPosts: number;
  avgScore: number;
  avgComments: number;
  lastScraped: string;
}

export interface TimeSeriesData {
  date: string;
  count: number;
  avgScore: number;
  avgComments: number;
}

export interface AuthorStats {
  author: string;
  postCount: number;
  totalScore: number;
  avgScore: number;
  totalComments: number;
}
