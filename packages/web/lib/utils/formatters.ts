/**
 * Utility functions for formatting numbers, dates, and statistics
 */

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatLargeNumber(num: number): string {
  if (num === 0) return '0';

  const absNum = Math.abs(num);

  if (absNum >= 1e9) {
    return `${(num / 1e9).toFixed(1)}B`;
  }
  if (absNum >= 1e6) {
    return `${(num / 1e6).toFixed(1)}M`;
  }
  if (absNum >= 1e3) {
    return `${(num / 1e3).toFixed(1)}K`;
  }

  return num.toLocaleString();
}

/**
 * Format percentage with specified decimal places
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0;
  }
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Format trend value with + or - prefix
 */
export function formatTrend(value: number, decimals: number = 1): string {
  const formatted = Math.abs(value).toFixed(decimals);
  if (value > 0) {
    return `+${formatted}%`;
  }
  if (value < 0) {
    return `-${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Get trend indicator (up, down, or neutral)
 */
export function getTrendIndicator(value: number): 'up' | 'down' | 'neutral' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'neutral';
}

/**
 * Format time period label
 */
export function formatTimePeriod(period: '24h' | '7d' | '30d'): string {
  switch (period) {
    case '24h':
      return 'Last 24 hours';
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    default:
      return period;
  }
}

/**
 * Format engagement rate
 */
export function formatEngagementRate(comments: number, score: number): string {
  if (score === 0) return '0%';
  const rate = (comments / score) * 100;
  return formatPercentage(rate, 1);
}

/**
 * Get color class based on trend
 */
export function getTrendColorClass(trend: 'up' | 'down' | 'neutral'): string {
  switch (trend) {
    case 'up':
      return 'text-green-600 dark:text-green-400';
    case 'down':
      return 'text-red-600 dark:text-red-400';
    case 'neutral':
      return 'text-gray-500 dark:text-gray-400';
  }
}

/**
 * Format relative time difference
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'Just now';
}

/**
 * Format number with appropriate precision
 */
export function formatPreciseNumber(num: number): string {
  if (num >= 1000000) {
    return formatLargeNumber(num);
  }
  return num.toLocaleString();
}
