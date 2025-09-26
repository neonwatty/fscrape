import { ForumPost } from '@/lib/db/types';

/**
 * Time period types for analytics
 */
export type TimePeriod = 'hour' | 'day' | 'week' | 'month';
export type DateRange = 'last7days' | 'last30days' | 'last90days' | 'all';

/**
 * Analytics data types
 */
export interface EngagementMetrics {
  totalPosts: number;
  totalScore: number;
  totalComments: number;
  avgScore: number;
  avgComments: number;
  engagementRate: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  timestamp: number;
  posts: number;
  score: number;
  comments: number;
  avgEngagement: number;
}

export interface PlatformMetrics {
  platform: string;
  posts: number;
  score: number;
  comments: number;
  avgScore: number;
  avgComments: number;
  percentage: number;
}

export interface AuthorMetrics {
  author: string;
  posts: number;
  totalScore: number;
  totalComments: number;
  avgScore: number;
  avgComments: number;
  topPost?: ForumPost;
}

export interface HeatmapData {
  hour: number;
  day: number;
  value: number;
  label: string;
}

export interface TrendData {
  date: string;
  reddit: number;
  hackernews: number;
  total: number;
}

/**
 * Calculate engagement metrics from posts
 */
export function calculateEngagementMetrics(posts: ForumPost[]): EngagementMetrics {
  if (posts.length === 0) {
    return {
      totalPosts: 0,
      totalScore: 0,
      totalComments: 0,
      avgScore: 0,
      avgComments: 0,
      engagementRate: 0,
    };
  }

  const totalScore = posts.reduce((sum, post) => sum + post.score, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.num_comments, 0);

  return {
    totalPosts: posts.length,
    totalScore,
    totalComments,
    avgScore: totalScore / posts.length,
    avgComments: totalComments / posts.length,
    engagementRate: (totalScore + totalComments * 2) / posts.length,
  };
}

/**
 * Generate time series data from posts
 */
export function generateTimeSeries(
  posts: ForumPost[],
  period: TimePeriod = 'day',
  dateRange?: DateRange
): TimeSeriesDataPoint[] {
  // Filter posts by date range
  const filteredPosts = filterByDateRange(posts, dateRange);

  // Group posts by time period
  const grouped = new Map<string, ForumPost[]>();

  filteredPosts.forEach((post) => {
    const key = getTimeKey(post.created_utc, period);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(post);
  });

  // Convert to time series data
  return Array.from(grouped.entries())
    .map(([date, posts]) => {
      const metrics = calculateEngagementMetrics(posts);
      return {
        date,
        timestamp: new Date(date).getTime(),
        posts: posts.length,
        score: metrics.totalScore,
        comments: metrics.totalComments,
        avgEngagement: metrics.engagementRate,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate platform metrics
 */
export function calculatePlatformMetrics(posts: ForumPost[]): PlatformMetrics[] {
  const platformMap = new Map<string, ForumPost[]>();

  // Group posts by platform
  posts.forEach((post) => {
    const platform = post.platform.toLowerCase();
    if (!platformMap.has(platform)) {
      platformMap.set(platform, []);
    }
    platformMap.get(platform)!.push(post);
  });

  // Calculate metrics for each platform
  const metrics: PlatformMetrics[] = [];

  platformMap.forEach((platformPosts, platform) => {
    const engagement = calculateEngagementMetrics(platformPosts);
    metrics.push({
      platform,
      posts: platformPosts.length,
      score: engagement.totalScore,
      comments: engagement.totalComments,
      avgScore: engagement.avgScore,
      avgComments: engagement.avgComments,
      percentage: (platformPosts.length / posts.length) * 100,
    });
  });

  return metrics.sort((a, b) => b.posts - a.posts);
}

/**
 * Calculate top authors
 */
export function calculateTopAuthors(posts: ForumPost[], limit: number = 10): AuthorMetrics[] {
  const authorMap = new Map<string, ForumPost[]>();

  // Group posts by author
  posts.forEach((post) => {
    const author = post.author || 'unknown';
    if (!authorMap.has(author)) {
      authorMap.set(author, []);
    }
    authorMap.get(author)!.push(post);
  });

  // Calculate metrics for each author
  const metrics: AuthorMetrics[] = [];

  authorMap.forEach((authorPosts, author) => {
    const engagement = calculateEngagementMetrics(authorPosts);
    const topPost = authorPosts.reduce(
      (top, post) => (post.score > (top?.score || 0) ? post : top),
      authorPosts[0]
    );

    metrics.push({
      author,
      posts: authorPosts.length,
      totalScore: engagement.totalScore,
      totalComments: engagement.totalComments,
      avgScore: engagement.avgScore,
      avgComments: engagement.avgComments,
      topPost,
    });
  });

  return metrics.sort((a, b) => b.totalScore - a.totalScore).slice(0, limit);
}

/**
 * Generate heatmap data for posting activity
 */
export function generateActivityHeatmap(posts: ForumPost[]): HeatmapData[] {
  const heatmap: number[][] = Array(7)
    .fill(null)
    .map(() => Array(24).fill(0));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Count posts by hour and day
  posts.forEach((post) => {
    const date = new Date(post.created_utc * 1000);
    const day = date.getDay();
    const hour = date.getHours();
    heatmap[day][hour]++;
  });

  // Convert to heatmap data format
  const data: HeatmapData[] = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      data.push({
        day,
        hour,
        value: heatmap[day][hour],
        label: `${dayNames[day]} ${hour}:00 - ${heatmap[day][hour]} posts`,
      });
    }
  }

  return data;
}

/**
 * Generate trend comparison data
 */
export function generateTrendComparison(
  posts: ForumPost[],
  period: TimePeriod = 'day'
): TrendData[] {
  const grouped = new Map<string, { reddit: number; hackernews: number }>();

  posts.forEach((post) => {
    const key = getTimeKey(post.created_utc, period);
    if (!grouped.has(key)) {
      grouped.set(key, { reddit: 0, hackernews: 0 });
    }

    const data = grouped.get(key)!;
    if (post.platform.toLowerCase() === 'reddit') {
      data.reddit++;
    } else if (post.platform.toLowerCase() === 'hackernews') {
      data.hackernews++;
    }
  });

  return Array.from(grouped.entries())
    .map(([date, data]) => ({
      date,
      reddit: data.reddit,
      hackernews: data.hackernews,
      total: data.reddit + data.hackernews,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Calculate growth rate
 */
export function calculateGrowthRate(
  current: number,
  previous: number
): { rate: number; isPositive: boolean } {
  if (previous === 0) {
    return { rate: current > 0 ? 100 : 0, isPositive: current > 0 };
  }

  const rate = ((current - previous) / previous) * 100;
  return { rate: Math.abs(rate), isPositive: rate >= 0 };
}

/**
 * Helper: Filter posts by date range
 */
function filterByDateRange(posts: ForumPost[], dateRange?: DateRange): ForumPost[] {
  if (!dateRange || dateRange === 'all') return posts;

  const now = Date.now() / 1000; // Current time in seconds
  let cutoff: number;

  switch (dateRange) {
    case 'last7days':
      cutoff = now - 7 * 24 * 60 * 60;
      break;
    case 'last30days':
      cutoff = now - 30 * 24 * 60 * 60;
      break;
    case 'last90days':
      cutoff = now - 90 * 24 * 60 * 60;
      break;
    default:
      return posts;
  }

  return posts.filter((post) => post.created_utc >= cutoff);
}

/**
 * Helper: Get time key for grouping
 */
function getTimeKey(timestamp: number, period: TimePeriod): string {
  const date = new Date(timestamp * 1000);

  switch (period) {
    case 'hour':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;

    case 'day':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    case 'week': {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    }

    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Get trend direction
 */
export function getTrendDirection(data: number[]): 'up' | 'down' | 'stable' {
  if (data.length < 2) return 'stable';

  const recent = data.slice(-5); // Last 5 data points
  const older = data.slice(-10, -5); // Previous 5 data points

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'up' : 'down';
}
