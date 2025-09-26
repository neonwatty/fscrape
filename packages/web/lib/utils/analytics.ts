import { ForumPost } from '@/lib/db/types';

/**
 * Calculate correlation coefficient between two numeric arrays
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate linear regression (trend line) parameters
 */
export function calculateLinearRegression(
  x: number[],
  y: number[]
): { slope: number; intercept: number } {
  if (x.length !== y.length || x.length === 0) {
    return { slope: 0, intercept: 0 };
  }

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Generate trend line points
 */
export function generateTrendLine(
  x: number[],
  y: number[],
  xMin?: number,
  xMax?: number
): Array<{ x: number; y: number }> {
  const { slope, intercept } = calculateLinearRegression(x, y);
  const minX = xMin ?? Math.min(...x);
  const maxX = xMax ?? Math.max(...x);

  return [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept },
  ];
}

/**
 * Calculate engagement metrics for posts
 */
export function calculateEngagementMetrics(posts: ForumPost[]) {
  const scoreData: Array<{ x: number; y: number; title: string; comments: number; id: string }> =
    [];
  const commentPatterns: Map<number, number> = new Map();
  const hourlyEngagement: Map<number, { total: number; count: number }> = new Map();

  posts.forEach((post) => {
    const date = new Date(post.created_utc * 1000);
    const hour = date.getHours();
    const timeOfDay = hour + date.getMinutes() / 60; // Decimal hours

    // Score vs time data
    scoreData.push({
      x: timeOfDay,
      y: post.score,
      title: post.title,
      comments: post.num_comments,
      id: post.id,
    });

    // Comment patterns by hour
    const currentComments = commentPatterns.get(hour) || 0;
    commentPatterns.set(hour, currentComments + post.num_comments);

    // Hourly engagement aggregation
    const engagement = post.score + post.num_comments * 2; // Weight comments more
    const hourData = hourlyEngagement.get(hour) || { total: 0, count: 0 };
    hourlyEngagement.set(hour, {
      total: hourData.total + engagement,
      count: hourData.count + 1,
    });
  });

  // Calculate correlations
  const timeValues = scoreData.map((d) => d.x);
  const scoreValues = scoreData.map((d) => d.y);
  const commentValues = scoreData.map((d) => d.comments);

  const scoreTimeCorrelation = calculateCorrelation(timeValues, scoreValues);
  const scoreCommentCorrelation = calculateCorrelation(scoreValues, commentValues);

  // Format comment pattern data for bar chart
  const commentPatternData = Array.from({ length: 24 }, (_, hour) => ({
    hour: hour.toString().padStart(2, '0') + ':00',
    comments: commentPatterns.get(hour) || 0,
  }));

  // Format hourly engagement trend
  const engagementTrendData = Array.from({ length: 24 }, (_, hour) => {
    const data = hourlyEngagement.get(hour);
    return {
      hour: hour.toString().padStart(2, '0') + ':00',
      avgEngagement: data ? data.total / data.count : 0,
      posts: data?.count || 0,
    };
  });

  return {
    scoreData,
    commentPatternData,
    engagementTrendData,
    correlations: {
      scoreTime: scoreTimeCorrelation,
      scoreComment: scoreCommentCorrelation,
    },
    statistics: {
      totalPosts: posts.length,
      avgScore: scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length,
      avgComments: commentValues.reduce((a, b) => a + b, 0) / commentValues.length,
      peakHour: engagementTrendData.reduce((max, curr) =>
        curr.avgEngagement > max.avgEngagement ? curr : max
      ).hour,
    },
  };
}

/**
 * Get engagement level classification
 */
export function getEngagementLevel(score: number, comments: number): string {
  const engagement = score + comments * 2;
  if (engagement > 1000) return 'viral';
  if (engagement > 500) return 'high';
  if (engagement > 100) return 'medium';
  return 'low';
}

/**
 * Format correlation value for display
 */
export function formatCorrelation(value: number): string {
  const absValue = Math.abs(value);
  let strength = '';

  if (absValue >= 0.7) strength = 'Strong';
  else if (absValue >= 0.4) strength = 'Moderate';
  else if (absValue >= 0.2) strength = 'Weak';
  else strength = 'Very Weak';

  const direction = value >= 0 ? 'positive' : 'negative';
  return `${strength} ${direction} (${value.toFixed(3)})`;
}
