import { ForumPost } from '@/lib/db/types';

/**
 * Enhanced heatmap data with engagement metrics
 */
export interface EngagementHeatmapData {
  hour: number;
  day: number;
  week?: number; // Added for 4-week view
  posts: number;
  totalScore: number;
  totalComments: number;
  avgScore: number;
  avgComments: number;
  avgEngagement: number;
  label: string;
  bestPost?: {
    title: string;
    score: number;
    url: string;
  };
}

/**
 * Heatmap filter options
 */
export interface HeatmapFilters {
  platform?: 'all' | 'reddit' | 'hackernews';
  source?: string;
  metric?: 'posts' | 'avgScore' | 'avgComments' | 'avgEngagement';
  minPosts?: number;
}

/**
 * Time slot performance metrics
 */
export interface TimeSlotPerformance {
  day: string;
  hour: string;
  performance: 'excellent' | 'good' | 'average' | 'poor';
  score: number;
  recommendation: string;
}

/**
 * Generate engagement-based heatmap data
 */
export function generateEngagementHeatmap(
  posts: ForumPost[],
  filters: HeatmapFilters = {}
): EngagementHeatmapData[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const _shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Apply filters
  let filteredPosts = posts;

  if (filters.platform && filters.platform !== 'all') {
    filteredPosts = filteredPosts.filter((p) => p.platform.toLowerCase() === filters.platform);
  }

  if (filters.source) {
    filteredPosts = filteredPosts.filter((p) =>
      (p.source || p.subreddit || '').toLowerCase().includes(filters.source!.toLowerCase())
    );
  }

  // Initialize heatmap grid
  const heatmapGrid: Map<string, ForumPost[]> = new Map();

  // Group posts by day and hour
  filteredPosts.forEach((post) => {
    const date = new Date(post.created_utc * 1000);
    const day = date.getDay();
    const hour = date.getHours();
    const key = `${day}-${hour}`;

    if (!heatmapGrid.has(key)) {
      heatmapGrid.set(key, []);
    }
    heatmapGrid.get(key)!.push(post);
  });

  // Calculate metrics for each cell
  const data: EngagementHeatmapData[] = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      const cellPosts = heatmapGrid.get(key) || [];

      if (filters.minPosts && cellPosts.length < filters.minPosts) {
        continue;
      }

      const totalScore = cellPosts.reduce((sum, p) => sum + p.score, 0);
      const totalComments = cellPosts.reduce((sum, p) => sum + p.num_comments, 0);
      const avgScore = cellPosts.length > 0 ? totalScore / cellPosts.length : 0;
      const avgComments = cellPosts.length > 0 ? totalComments / cellPosts.length : 0;
      const avgEngagement = avgScore + avgComments * 2; // Weight comments more

      // Find best performing post in this time slot
      const bestPost = cellPosts.reduce(
        (best, post) => {
          if (!best || post.score > best.score) return post;
          return best;
        },
        null as ForumPost | null
      );

      const hourStr = `${hour}:00-${hour + 1}:00`;
      const label = `${dayNames[day]} ${hourStr}: ${cellPosts.length} posts, avg score ${avgScore.toFixed(0)}`;

      data.push({
        day,
        hour,
        posts: cellPosts.length,
        totalScore,
        totalComments,
        avgScore,
        avgComments,
        avgEngagement,
        label,
        bestPost: bestPost
          ? {
              title: bestPost.title,
              score: bestPost.score,
              url: bestPost.url || bestPost.permalink,
            }
          : undefined,
      });
    }
  }

  return data;
}

/**
 * Generate 4-week engagement heatmap data
 */
export function generateFourWeekHeatmap(
  posts: ForumPost[],
  filters: HeatmapFilters = {}
): EngagementHeatmapData[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Apply filters
  let filteredPosts = posts;

  if (filters.platform && filters.platform !== 'all') {
    filteredPosts = filteredPosts.filter((p) => p.platform.toLowerCase() === filters.platform);
  }

  if (filters.source) {
    filteredPosts = filteredPosts.filter((p) =>
      (p.source || p.subreddit || '').toLowerCase().includes(filters.source!.toLowerCase())
    );
  }

  // Get current date and 4 weeks ago
  const now = Date.now();
  const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;

  // Filter posts to last 4 weeks
  filteredPosts = filteredPosts.filter((post) => {
    const postDate = post.created_utc * 1000;
    return postDate >= fourWeeksAgo && postDate <= now;
  });

  // Initialize heatmap grid for 4 weeks
  const heatmapGrid: Map<string, ForumPost[]> = new Map();

  // Group posts by week, day and hour
  filteredPosts.forEach((post) => {
    const postDate = new Date(post.created_utc * 1000);
    const daysSinceStart = Math.floor((postDate.getTime() - fourWeeksAgo) / (24 * 60 * 60 * 1000));
    const week = Math.floor(daysSinceStart / 7);

    // Skip posts outside the 0-3 week range
    if (week < 0 || week > 3) return;

    const day = postDate.getDay();
    const hour = postDate.getHours();
    const key = `${week}-${day}-${hour}`;

    if (!heatmapGrid.has(key)) {
      heatmapGrid.set(key, []);
    }
    heatmapGrid.get(key)!.push(post);
  });

  // Calculate metrics for each cell
  const data: EngagementHeatmapData[] = [];

  for (let week = 0; week < 4; week++) {
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${week}-${day}-${hour}`;
        const cellPosts = heatmapGrid.get(key) || [];

        if (filters.minPosts && cellPosts.length < filters.minPosts) {
          continue;
        }

        const totalScore = cellPosts.reduce((sum, p) => sum + p.score, 0);
        const totalComments = cellPosts.reduce((sum, p) => sum + p.num_comments, 0);
        const avgScore = cellPosts.length > 0 ? totalScore / cellPosts.length : 0;
        const avgComments = cellPosts.length > 0 ? totalComments / cellPosts.length : 0;
        const avgEngagement = avgScore + avgComments * 2;

        // Find best performing post in this time slot
        const bestPost = cellPosts.reduce(
          (best, post) => {
            if (!best || post.score > best.score) return post;
            return best;
          },
          null as ForumPost | null
        );

        data.push({
          week,
          day,
          hour,
          posts: cellPosts.length,
          totalScore,
          totalComments,
          avgScore,
          avgComments,
          avgEngagement,
          label: `Week ${week + 1}, ${dayNames[day]} ${
            hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`
          }`,
          bestPost: bestPost
            ? {
                title: bestPost.title,
                score: bestPost.score,
                url: bestPost.url || bestPost.permalink,
              }
            : undefined,
        });
      }
    }
  }

  return data;
}

/**
 * Get optimal posting times based on engagement
 */
export function getOptimalPostingTimes(
  heatmapData: EngagementHeatmapData[],
  metric: HeatmapFilters['metric'] = 'avgEngagement',
  topN: number = 10
): TimeSlotPerformance[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Sort by selected metric
  const sorted = [...heatmapData].sort((a, b) => {
    switch (metric) {
      case 'posts':
        return b.posts - a.posts;
      case 'avgScore':
        return b.avgScore - a.avgScore;
      case 'avgComments':
        return b.avgComments - a.avgComments;
      case 'avgEngagement':
      default:
        return b.avgEngagement - a.avgEngagement;
    }
  });

  // Calculate performance thresholds
  const values = sorted.map((d) => {
    switch (metric) {
      case 'posts':
        return d.posts;
      case 'avgScore':
        return d.avgScore;
      case 'avgComments':
        return d.avgComments;
      default:
        return d.avgEngagement;
    }
  });

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  // Get top N time slots
  return sorted.slice(0, topN).map((slot) => {
    const value =
      metric === 'posts'
        ? slot.posts
        : metric === 'avgScore'
          ? slot.avgScore
          : metric === 'avgComments'
            ? slot.avgComments
            : slot.avgEngagement;

    const normalized = range > 0 ? ((value - min) / range) * 100 : 50;

    let performance: TimeSlotPerformance['performance'];
    let recommendation: string;

    if (normalized >= 75) {
      performance = 'excellent';
      recommendation = 'Best time to post for maximum engagement';
    } else if (normalized >= 50) {
      performance = 'good';
      recommendation = 'Good time to post with above-average engagement';
    } else if (normalized >= 25) {
      performance = 'average';
      recommendation = 'Average engagement expected';
    } else {
      performance = 'poor';
      recommendation = 'Consider posting at a different time';
    }

    const hourStr =
      slot.hour < 12
        ? `${slot.hour === 0 ? 12 : slot.hour}:00 AM`
        : `${slot.hour === 12 ? 12 : slot.hour - 12}:00 PM`;

    return {
      day: dayNames[slot.day],
      hour: hourStr,
      performance,
      score: normalized,
      recommendation,
    };
  });
}

/**
 * Get heatmap color based on value and metric
 */
export function getHeatmapColor(
  value: number,
  maxValue: number,
  metric: HeatmapFilters['metric'] = 'avgEngagement',
  theme: 'light' | 'dark' = 'light'
): string {
  if (value === 0) return theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100';

  const intensity = maxValue > 0 ? (value / maxValue) * 100 : 0;

  // Use different color schemes based on metric
  if (metric === 'avgScore' || metric === 'avgEngagement') {
    // Green gradient for engagement metrics
    if (intensity <= 20) return theme === 'dark' ? 'bg-green-950' : 'bg-green-50';
    if (intensity <= 40) return theme === 'dark' ? 'bg-green-900' : 'bg-green-100';
    if (intensity <= 60) return theme === 'dark' ? 'bg-green-800' : 'bg-green-200';
    if (intensity <= 80) return theme === 'dark' ? 'bg-green-700' : 'bg-green-300';
    return theme === 'dark' ? 'bg-green-600' : 'bg-green-400';
  } else if (metric === 'posts') {
    // Blue gradient for post count
    if (intensity <= 20) return theme === 'dark' ? 'bg-blue-950' : 'bg-blue-50';
    if (intensity <= 40) return theme === 'dark' ? 'bg-blue-900' : 'bg-blue-100';
    if (intensity <= 60) return theme === 'dark' ? 'bg-blue-800' : 'bg-blue-200';
    if (intensity <= 80) return theme === 'dark' ? 'bg-blue-700' : 'bg-blue-300';
    return theme === 'dark' ? 'bg-blue-600' : 'bg-blue-400';
  } else {
    // Purple gradient for comments
    if (intensity <= 20) return theme === 'dark' ? 'bg-purple-950' : 'bg-purple-50';
    if (intensity <= 40) return theme === 'dark' ? 'bg-purple-900' : 'bg-purple-100';
    if (intensity <= 60) return theme === 'dark' ? 'bg-purple-800' : 'bg-purple-200';
    if (intensity <= 80) return theme === 'dark' ? 'bg-purple-700' : 'bg-purple-300';
    return theme === 'dark' ? 'bg-purple-600' : 'bg-purple-400';
  }
}

/**
 * Format heatmap value for display
 */
export function formatHeatmapValue(
  data: EngagementHeatmapData,
  metric: HeatmapFilters['metric'] = 'avgEngagement'
): string {
  switch (metric) {
    case 'posts':
      return `${data.posts} posts`;
    case 'avgScore':
      return `${data.avgScore.toFixed(0)} avg score`;
    case 'avgComments':
      return `${data.avgComments.toFixed(0)} avg comments`;
    case 'avgEngagement':
    default:
      return `${data.avgEngagement.toFixed(0)} engagement`;
  }
}

/**
 * Get accessibility label for heatmap cell
 */
export function getHeatmapCellLabel(
  data: EngagementHeatmapData,
  metric: HeatmapFilters['metric'] = 'avgEngagement'
): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hourStr = `${data.hour}:00-${data.hour + 1}:00`;
  const metricValue = formatHeatmapValue(data, metric);

  return `${dayNames[data.day]} ${hourStr}: ${metricValue}`;
}
