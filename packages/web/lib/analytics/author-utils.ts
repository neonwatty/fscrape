import { ForumPost, AuthorStats } from '@/lib/db/types';

/**
 * Enhanced author statistics with trends
 */
export interface EnhancedAuthorStats extends AuthorStats {
  rank: number;
  avgEngagement: number;
  topPost: {
    title: string;
    score: number;
    url: string | null;
  } | null;
  recentActivity: number; // posts in last 7 days
  trend: 'rising' | 'stable' | 'declining';
  trendValue: number; // percentage change
  platforms: string[];
  sources: string[];
}

/**
 * Calculate enhanced author statistics from posts
 */
export function calculateEnhancedAuthorStats(posts: ForumPost[]): EnhancedAuthorStats[] {
  const authorMap = new Map<
    string,
    {
      posts: ForumPost[];
      recentPosts: ForumPost[];
      olderPosts: ForumPost[];
    }
  >();

  const now = Date.now() / 1000;
  const weekAgo = now - 7 * 86400;
  const twoWeeksAgo = now - 14 * 86400;

  // Group posts by author
  posts.forEach((post) => {
    if (!post.author || post.author === '[deleted]') return;

    if (!authorMap.has(post.author)) {
      authorMap.set(post.author, { posts: [], recentPosts: [], olderPosts: [] });
    }

    const authorData = authorMap.get(post.author)!;
    authorData.posts.push(post);

    if (post.created_utc > weekAgo) {
      authorData.recentPosts.push(post);
    } else if (post.created_utc > twoWeeksAgo) {
      authorData.olderPosts.push(post);
    }
  });

  // Calculate stats for each author
  const stats: EnhancedAuthorStats[] = [];

  authorMap.forEach((data, author) => {
    const { posts: authorPosts, recentPosts, olderPosts } = data;

    // Basic stats
    const postCount = authorPosts.length;
    const totalScore = authorPosts.reduce((sum, p) => sum + p.score, 0);
    const totalComments = authorPosts.reduce((sum, p) => sum + p.num_comments, 0);
    const avgScore = totalScore / postCount;
    const avgEngagement = (totalScore + totalComments * 2) / postCount;

    // Find top post
    const topPost = authorPosts.reduce(
      (top, post) => (!top || post.score > top.score ? post : top),
      null as ForumPost | null
    );

    // Calculate trend
    const recentAvgScore =
      recentPosts.length > 0
        ? recentPosts.reduce((sum, p) => sum + p.score, 0) / recentPosts.length
        : 0;
    const olderAvgScore =
      olderPosts.length > 0
        ? olderPosts.reduce((sum, p) => sum + p.score, 0) / olderPosts.length
        : avgScore;

    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    let trendValue = 0;

    if (recentPosts.length > 0 && olderPosts.length > 0) {
      trendValue = ((recentAvgScore - olderAvgScore) / olderAvgScore) * 100;
      if (trendValue > 10) trend = 'rising';
      else if (trendValue < -10) trend = 'declining';
    }

    // Get unique platforms and sources
    const platforms = [...new Set(authorPosts.map((p) => p.platform))];
    const sources = [
      ...new Set(authorPosts.map((p) => p.source || p.subreddit || '').filter(Boolean)),
    ];

    stats.push({
      author,
      rank: 0, // Will be set after sorting
      postCount,
      totalScore,
      avgScore,
      totalComments,
      avgEngagement,
      topPost: topPost
        ? {
            title: topPost.title,
            score: topPost.score,
            url: topPost.url,
          }
        : null,
      recentActivity: recentPosts.length,
      trend,
      trendValue,
      platforms,
      sources,
    });
  });

  // Sort by total engagement and assign ranks
  stats.sort((a, b) => b.totalScore - a.totalScore);
  stats.forEach((stat, index) => {
    stat.rank = index + 1;
  });

  return stats;
}

/**
 * Filter author stats based on criteria
 */
export interface AuthorFilterCriteria {
  minPosts?: number;
  platform?: string;
  source?: string;
  trend?: 'rising' | 'stable' | 'declining' | 'all';
  search?: string;
}

export function filterAuthorStats(
  stats: EnhancedAuthorStats[],
  criteria: AuthorFilterCriteria
): EnhancedAuthorStats[] {
  return stats.filter((stat) => {
    if (criteria.minPosts && stat.postCount < criteria.minPosts) return false;
    if (criteria.platform && !stat.platforms.includes(criteria.platform)) return false;
    if (
      criteria.source &&
      !stat.sources.some((s) => s.toLowerCase().includes(criteria.source!.toLowerCase()))
    )
      return false;
    if (criteria.trend && criteria.trend !== 'all' && stat.trend !== criteria.trend) return false;
    if (criteria.search && !stat.author.toLowerCase().includes(criteria.search.toLowerCase()))
      return false;

    return true;
  });
}

/**
 * Sort author stats by different metrics
 */
export type AuthorSortKey =
  | 'rank'
  | 'author'
  | 'postCount'
  | 'avgScore'
  | 'totalScore'
  | 'avgEngagement'
  | 'recentActivity'
  | 'trend';

export function sortAuthorStats(
  stats: EnhancedAuthorStats[],
  sortKey: AuthorSortKey,
  descending: boolean = true
): EnhancedAuthorStats[] {
  const sorted = [...stats].sort((a, b) => {
    let aValue: number | string = 0;
    let bValue: number | string = 0;

    switch (sortKey) {
      case 'rank':
        aValue = a.rank;
        bValue = b.rank;
        break;
      case 'author':
        aValue = a.author.toLowerCase();
        bValue = b.author.toLowerCase();
        break;
      case 'postCount':
        aValue = a.postCount;
        bValue = b.postCount;
        break;
      case 'avgScore':
        aValue = a.avgScore;
        bValue = b.avgScore;
        break;
      case 'totalScore':
        aValue = a.totalScore;
        bValue = b.totalScore;
        break;
      case 'avgEngagement':
        aValue = a.avgEngagement;
        bValue = b.avgEngagement;
        break;
      case 'recentActivity':
        aValue = a.recentActivity;
        bValue = b.recentActivity;
        break;
      case 'trend':
        aValue = a.trendValue;
        bValue = b.trendValue;
        break;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return descending ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
    }

    return descending
      ? (bValue as number) - (aValue as number)
      : (aValue as number) - (bValue as number);
  });

  return sorted;
}

/**
 * Get author performance tier based on metrics
 */
export function getAuthorTier(stat: EnhancedAuthorStats): 'elite' | 'top' | 'active' | 'casual' {
  if (stat.avgScore > 1000 && stat.postCount > 10) return 'elite';
  if (stat.avgScore > 500 || stat.totalScore > 10000) return 'top';
  if (stat.postCount > 5 || stat.avgScore > 100) return 'active';
  return 'casual';
}

/**
 * Format trend value for display
 */
export function formatTrend(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
