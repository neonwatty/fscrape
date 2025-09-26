import { ForumPost } from '@/lib/db/types';

/**
 * Growth trend data point
 */
export interface GrowthDataPoint {
  date: string;
  timestamp: number;
  postVolume: number;
  cumulativeVolume: number;
  scoreVolume: number;
  commentVolume: number;
  engagementVolume: number;
  growthRate: number;
  platforms: Record<string, number>;
  sources: Record<string, number>;
}

/**
 * Platform adoption data
 */
export interface PlatformAdoptionData {
  date: string;
  timestamp: number;
  [platform: string]: string | number;
}

/**
 * Source activity data
 */
export interface SourceActivityData {
  date: string;
  timestamp: number;
  sources: Array<{
    name: string;
    count: number;
    score: number;
  }>;
  topSource: string;
}

/**
 * Growth summary statistics
 */
export interface GrowthSummary {
  totalPosts: number;
  growthRate: number;
  averageDailyPosts: number;
  peakDay: string;
  peakVolume: number;
  trend: 'accelerating' | 'steady' | 'decelerating';
  platformGrowth: Record<string, number>;
}

/**
 * Time granularity for aggregation
 */
export type TimeGranularity = 'hour' | 'day' | 'week' | 'month';

/**
 * Calculate growth trends over time
 */
export function calculateGrowthTrends(
  posts: ForumPost[],
  granularity: TimeGranularity = 'day',
  startDate?: Date,
  endDate?: Date
): GrowthDataPoint[] {
  // Filter posts by date range
  const filteredPosts = posts.filter((post) => {
    const postDate = new Date(post.created_utc * 1000);
    if (startDate && postDate < startDate) return false;
    if (endDate && postDate > endDate) return false;
    return true;
  });

  // Group posts by time period
  const grouped = new Map<string, ForumPost[]>();

  filteredPosts.forEach((post) => {
    const key = getTimeKey(new Date(post.created_utc * 1000), granularity);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(post);
  });

  // Sort dates
  const sortedDates = Array.from(grouped.keys()).sort();

  // Calculate growth data points
  let cumulativeVolume = 0;
  let previousVolume = 0;

  return sortedDates.map((date, index) => {
    const periodPosts = grouped.get(date) || [];
    const postVolume = periodPosts.length;
    cumulativeVolume += postVolume;

    // Calculate growth rate
    const growthRate =
      index === 0
        ? 0
        : previousVolume === 0
          ? 100
          : ((postVolume - previousVolume) / previousVolume) * 100;

    previousVolume = postVolume;

    // Calculate platform distribution
    const platforms: Record<string, number> = {};
    const sources: Record<string, number> = {};

    periodPosts.forEach((post) => {
      platforms[post.platform] = (platforms[post.platform] || 0) + 1;
      const source = post.source || post.subreddit || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    });

    // Calculate engagement volumes
    const scoreVolume = periodPosts.reduce((sum, p) => sum + p.score, 0);
    const commentVolume = periodPosts.reduce((sum, p) => sum + p.num_comments, 0);
    const engagementVolume = scoreVolume + commentVolume * 2;

    return {
      date,
      timestamp: new Date(date).getTime(),
      postVolume,
      cumulativeVolume,
      scoreVolume,
      commentVolume,
      engagementVolume,
      growthRate,
      platforms,
      sources,
    };
  });
}

/**
 * Calculate platform adoption over time
 */
export function calculatePlatformAdoption(
  posts: ForumPost[],
  granularity: TimeGranularity = 'day'
): PlatformAdoptionData[] {
  const grouped = new Map<string, Map<string, number>>();
  const platforms = new Set<string>();

  posts.forEach((post) => {
    const key = getTimeKey(new Date(post.created_utc * 1000), granularity);
    if (!grouped.has(key)) {
      grouped.set(key, new Map());
    }

    const platformCounts = grouped.get(key)!;
    platformCounts.set(post.platform, (platformCounts.get(post.platform) || 0) + 1);
    platforms.add(post.platform);
  });

  // Convert to array format
  const sortedDates = Array.from(grouped.keys()).sort();

  return sortedDates.map((date) => {
    const platformCounts = grouped.get(date)!;
    const dataPoint: PlatformAdoptionData = {
      date,
      timestamp: new Date(date).getTime(),
    };

    // Add count for each platform
    platforms.forEach((platform) => {
      dataPoint[platform] = platformCounts.get(platform) || 0;
    });

    return dataPoint;
  });
}

/**
 * Calculate source activity trends
 */
export function calculateSourceActivity(
  posts: ForumPost[],
  granularity: TimeGranularity = 'day',
  topN: number = 10
): SourceActivityData[] {
  const grouped = new Map<string, ForumPost[]>();

  posts.forEach((post) => {
    const key = getTimeKey(new Date(post.created_utc * 1000), granularity);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(post);
  });

  const sortedDates = Array.from(grouped.keys()).sort();

  return sortedDates.map((date) => {
    const periodPosts = grouped.get(date) || [];
    const sourceMap = new Map<string, { count: number; score: number }>();

    periodPosts.forEach((post) => {
      const source = post.source || post.subreddit || 'unknown';
      const current = sourceMap.get(source) || { count: 0, score: 0 };
      sourceMap.set(source, {
        count: current.count + 1,
        score: current.score + post.score,
      });
    });

    // Get top N sources
    const sources = Array.from(sourceMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);

    const topSource = sources[0]?.name || 'none';

    return {
      date,
      timestamp: new Date(date).getTime(),
      sources,
      topSource,
    };
  });
}

/**
 * Calculate growth summary statistics
 */
export function calculateGrowthSummary(growthData: GrowthDataPoint[]): GrowthSummary {
  if (growthData.length === 0) {
    return {
      totalPosts: 0,
      growthRate: 0,
      averageDailyPosts: 0,
      peakDay: '',
      peakVolume: 0,
      trend: 'steady',
      platformGrowth: {},
    };
  }

  // Find peak day
  const peakPoint = growthData.reduce((peak, point) =>
    point.postVolume > peak.postVolume ? point : peak
  );

  // Calculate average growth rate
  const growthRates = growthData.slice(1).map((d) => d.growthRate);
  const avgGrowthRate =
    growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;

  // Determine trend
  const recentRates = growthRates.slice(-5);
  const olderRates = growthRates.slice(-10, -5);

  let trend: 'accelerating' | 'steady' | 'decelerating' = 'steady';
  if (recentRates.length > 0 && olderRates.length > 0) {
    const recentAvg = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
    const olderAvg = olderRates.reduce((a, b) => a + b, 0) / olderRates.length;

    if (recentAvg > olderAvg + 10) trend = 'accelerating';
    else if (recentAvg < olderAvg - 10) trend = 'decelerating';
  }

  // Calculate platform growth
  const firstPoint = growthData[0];
  const lastPoint = growthData[growthData.length - 1];
  const platformGrowth: Record<string, number> = {};

  if (lastPoint.platforms) {
    Object.keys(lastPoint.platforms).forEach((platform) => {
      const initial = firstPoint.platforms?.[platform] || 0;
      const final = lastPoint.platforms[platform];
      platformGrowth[platform] = initial === 0 ? 100 : ((final - initial) / initial) * 100;
    });
  }

  return {
    totalPosts: lastPoint.cumulativeVolume,
    growthRate: avgGrowthRate,
    averageDailyPosts: growthData.reduce((sum, d) => sum + d.postVolume, 0) / growthData.length,
    peakDay: peakPoint.date,
    peakVolume: peakPoint.postVolume,
    trend,
    platformGrowth,
  };
}

/**
 * Get time key for grouping
 */
function getTimeKey(date: Date, granularity: TimeGranularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');

  switch (granularity) {
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`;
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week': {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    }
    case 'month':
      return `${year}-${month}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Format growth rate for display
 */
export function formatGrowthRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

/**
 * Get growth trend emoji
 */
export function getGrowthTrendEmoji(trend: 'accelerating' | 'steady' | 'decelerating'): string {
  switch (trend) {
    case 'accelerating':
      return '🚀';
    case 'steady':
      return '➡️';
    case 'decelerating':
      return '📉';
    default:
      return '➡️';
  }
}
