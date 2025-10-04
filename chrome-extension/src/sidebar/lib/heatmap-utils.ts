/**
 * Heatmap utilities for engagement analysis
 * Analyzes posting patterns by day of week and hour of day
 */

import type { Post } from '../../shared/types';

/**
 * Enhanced heatmap data with engagement metrics
 */
export interface EngagementHeatmapData {
  hour: number;
  day: number;
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
  subreddit?: string;
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
  posts: Post[],
  filters: HeatmapFilters = {}
): EngagementHeatmapData[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Apply filters
  let filteredPosts = posts;

  if (filters.subreddit) {
    filteredPosts = filteredPosts.filter((p) => p.subreddit === filters.subreddit);
  }

  // Initialize heatmap grid
  const heatmapGrid: Map<string, Post[]> = new Map();

  // Group posts by day and hour
  filteredPosts.forEach((post) => {
    const date = new Date(post.created_at);
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
      const totalComments = cellPosts.reduce((sum, p) => sum + p.comment_count, 0);
      const avgScore = cellPosts.length > 0 ? totalScore / cellPosts.length : 0;
      const avgComments = cellPosts.length > 0 ? totalComments / cellPosts.length : 0;
      const avgEngagement = avgScore + avgComments * 2; // Weight comments more

      // Find best performing post in this time slot
      const bestPost = cellPosts.reduce(
        (best, post) => {
          if (!best || post.score > best.score) return post;
          return best;
        },
        null as Post | null
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
              url: bestPost.url,
            }
          : undefined,
      });
    }
  }

  return data;
}

/**
 * Get optimal posting times based on engagement data
 */
export function getOptimalPostingTimes(
  heatmapData: EngagementHeatmapData[],
  metric: HeatmapFilters['metric'] = 'avgEngagement',
  topN: number = 5
): TimeSlotPerformance[] {
  if (heatmapData.length === 0) return [];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Sort by selected metric
  const sorted = [...heatmapData].sort((a, b) => {
    const aVal = metric === 'posts' ? a.posts :
                 metric === 'avgScore' ? a.avgScore :
                 metric === 'avgComments' ? a.avgComments : a.avgEngagement;
    const bVal = metric === 'posts' ? b.posts :
                 metric === 'avgScore' ? b.avgScore :
                 metric === 'avgComments' ? b.avgComments : b.avgEngagement;
    return bVal - aVal;
  });

  // Get max value for normalization
  const maxValue = Math.max(
    ...heatmapData.map((d) =>
      metric === 'posts' ? d.posts :
      metric === 'avgScore' ? d.avgScore :
      metric === 'avgComments' ? d.avgComments : d.avgEngagement
    ),
    1
  );

  // Get top N slots
  return sorted.slice(0, topN).map((slot) => {
    const value = metric === 'posts' ? slot.posts :
                  metric === 'avgScore' ? slot.avgScore :
                  metric === 'avgComments' ? slot.avgComments : slot.avgEngagement;

    const score = (value / maxValue) * 100;

    const performance: TimeSlotPerformance['performance'] =
      score >= 80 ? 'excellent' :
      score >= 60 ? 'good' :
      score >= 40 ? 'average' : 'poor';

    const formatHour = (h: number) => {
      if (h === 0) return '12am';
      if (h < 12) return `${h}am`;
      if (h === 12) return '12pm';
      return `${h - 12}pm`;
    };

    const recommendation =
      performance === 'excellent' ? `Peak engagement time with ${slot.posts} posts averaging ${slot.avgScore.toFixed(0)} upvotes` :
      performance === 'good' ? `Strong performance with ${slot.posts} posts` :
      performance === 'average' ? `Moderate activity with ${slot.posts} posts` :
      `Lower activity with ${slot.posts} posts`;

    return {
      day: dayNames[slot.day],
      hour: formatHour(slot.hour),
      performance,
      score,
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
  metric: HeatmapFilters['metric'] = 'avgEngagement'
): string {
  const ratio = value / Math.max(maxValue, 1);

  // Choose color scheme based on metric
  const colorScheme =
    metric === 'posts' ? 'blue' :
    metric === 'avgComments' ? 'purple' : 'green';

  if (ratio === 0) return 'bg-gray-100 dark:bg-gray-800';
  if (ratio < 0.25) return `bg-${colorScheme}-200 dark:bg-${colorScheme}-900`;
  if (ratio < 0.5) return `bg-${colorScheme}-300 dark:bg-${colorScheme}-800`;
  if (ratio < 0.75) return `bg-${colorScheme}-400 dark:bg-${colorScheme}-700`;
  return `bg-${colorScheme}-500 dark:bg-${colorScheme}-600`;
}

/**
 * Get CSS color value for heatmap cell
 */
export function getHeatmapColorValue(
  value: number,
  maxValue: number,
  metric: HeatmapFilters['metric'] = 'avgEngagement'
): string {
  const ratio = value / Math.max(maxValue, 1);

  // Choose color scheme based on metric
  const colors =
    metric === 'posts' ? ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb'] :
    metric === 'avgComments' ? ['#e9d5ff', '#c084fc', '#a855f7', '#9333ea', '#7e22ce'] :
    ['#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a'];

  if (ratio === 0) return '#f3f4f6';
  if (ratio < 0.25) return colors[0];
  if (ratio < 0.5) return colors[1];
  if (ratio < 0.75) return colors[2];
  if (ratio < 0.9) return colors[3];
  return colors[4];
}
