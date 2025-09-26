'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDatabase } from '@/lib/db/database-context';
import {
  Activity,
  Database,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  BarChart3,
  MessageCircle,
  Minus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPosts } from '@/lib/db/queries';
import {
  formatLargeNumber,
  formatTrend,
  getTrendIndicator,
  calculatePercentageChange,
  getTrendColorClass,
  formatPreciseNumber,
} from '@/lib/utils/formatters';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
}

function StatsCard({ title, value, description, icon, trend }: StatsCardProps) {
  const trendIndicator = trend ? getTrendIndicator(trend.value) : null;
  const TrendIcon =
    trendIndicator === 'up' ? TrendingUp : trendIndicator === 'down' ? TrendingDown : Minus;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <div
            className={`flex items-center gap-1 mt-2 text-xs ${getTrendColorClass(trendIndicator!)}`}
          >
            <TrendIcon className="h-3 w-3" />
            <span className="font-medium">{formatTrend(trend.value)}</span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActivityMetrics {
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  trend24h: number;
  trend7d: number;
  trend30d: number;
}

interface EngagementMetrics {
  avgScore: number;
  avgComments: number;
  totalEngagement: number;
  engagementTrend: number;
  topPost: {
    score: number;
    comments: number;
    title?: string;
  };
}

export function StatsCards() {
  const { summary, isInitialized } = useDatabase();
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics>({
    last24Hours: 0,
    last7Days: 0,
    last30Days: 0,
    trend24h: 0,
    trend7d: 0,
    trend30d: 0,
  });
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics>({
    avgScore: 0,
    avgComments: 0,
    totalEngagement: 0,
    engagementTrend: 0,
    topPost: { score: 0, comments: 0 },
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    if (isInitialized) {
      // Calculate activity metrics for different time periods
      const now = new Date();

      // 24 hours
      const dayAgo = new Date(now);
      dayAgo.setDate(dayAgo.getDate() - 1);
      const posts24h = getPosts({
        dateFrom: dayAgo,
        limit: 1000,
      });

      // Previous 24 hours for comparison
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const prevPosts24h = getPosts({
        dateFrom: twoDaysAgo,
        dateTo: dayAgo,
        limit: 1000,
      });

      // 7 days
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const posts7d = getPosts({
        dateFrom: weekAgo,
        limit: 5000,
      });

      // Previous 7 days for comparison
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const prevPosts7d = getPosts({
        dateFrom: twoWeeksAgo,
        dateTo: weekAgo,
        limit: 5000,
      });

      // 30 days
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const posts30d = getPosts({
        dateFrom: monthAgo,
        limit: 10000,
      });

      // Previous 30 days for comparison
      const twoMonthsAgo = new Date(now);
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
      const prevPosts30d = getPosts({
        dateFrom: twoMonthsAgo,
        dateTo: monthAgo,
        limit: 10000,
      });

      // Calculate trends
      const trend24h = calculatePercentageChange(prevPosts24h.length, posts24h.length);
      const trend7d = calculatePercentageChange(prevPosts7d.length, posts7d.length);
      const trend30d = calculatePercentageChange(prevPosts30d.length, posts30d.length);

      setActivityMetrics({
        last24Hours: posts24h.length,
        last7Days: posts7d.length,
        last30Days: posts30d.length,
        trend24h,
        trend7d,
        trend30d,
      });

      // Calculate engagement metrics
      if (posts7d.length > 0) {
        const totalScore = posts7d.reduce((sum, post) => sum + post.score, 0);
        const totalComments = posts7d.reduce((sum, post) => sum + post.num_comments, 0);
        const avgScore = totalScore / posts7d.length;
        const avgComments = totalComments / posts7d.length;

        // Find top post
        const topPost = posts7d.reduce(
          (top, post) => (post.score > top.score ? post : top),
          posts7d[0]
        );

        // Calculate engagement trend
        const prevTotalEngagement = prevPosts7d.reduce(
          (sum, post) => sum + post.score + post.num_comments,
          0
        );
        const currentTotalEngagement = totalScore + totalComments;
        const engagementTrend = calculatePercentageChange(
          prevTotalEngagement,
          currentTotalEngagement
        );

        setEngagementMetrics({
          avgScore,
          avgComments,
          totalEngagement: currentTotalEngagement,
          engagementTrend,
          topPost: {
            score: topPost.score,
            comments: topPost.num_comments,
            title: topPost.title,
          },
        });
      }
    }
  }, [isInitialized]);

  // Main stats cards
  const mainStats = [
    {
      title: 'Total Posts',
      value: formatPreciseNumber(summary?.totalPosts || 0),
      description: 'Across all platforms',
      icon: <Database className="h-4 w-4 text-muted-foreground" />,
      trend:
        activityMetrics.trend30d !== 0
          ? {
              value: activityMetrics.trend30d,
              label: 'vs last 30d',
            }
          : undefined,
    },
    {
      title: 'Active Authors',
      value: formatPreciseNumber(summary?.totalAuthors || 0),
      description: 'Unique contributors',
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: 'Last 7 Days',
      value: formatLargeNumber(activityMetrics.last7Days),
      description: 'Posts collected',
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      trend:
        activityMetrics.trend7d !== 0
          ? {
              value: activityMetrics.trend7d,
              label: 'vs prev 7d',
            }
          : undefined,
    },
    {
      title: 'Avg Engagement',
      value: formatLargeNumber(Math.round(engagementMetrics.avgScore)),
      description: `${Math.round(engagementMetrics.avgComments)} avg comments`,
      icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
      trend:
        engagementMetrics.engagementTrend !== 0
          ? {
              value: engagementMetrics.engagementTrend,
              label: 'engagement',
            }
          : undefined,
    },
  ];

  // Activity period cards
  const activityCards = [
    {
      title: '24 Hour Activity',
      value: formatLargeNumber(activityMetrics.last24Hours),
      description: 'Posts in last day',
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      trend:
        activityMetrics.trend24h !== 0
          ? {
              value: activityMetrics.trend24h,
              label: 'vs prev 24h',
            }
          : undefined,
    },
    {
      title: '7 Day Activity',
      value: formatLargeNumber(activityMetrics.last7Days),
      description: 'Posts in last week',
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      trend:
        activityMetrics.trend7d !== 0
          ? {
              value: activityMetrics.trend7d,
              label: 'vs prev week',
            }
          : undefined,
    },
    {
      title: '30 Day Activity',
      value: formatLargeNumber(activityMetrics.last30Days),
      description: 'Posts in last month',
      icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
      trend:
        activityMetrics.trend30d !== 0
          ? {
              value: activityMetrics.trend30d,
              label: 'vs prev month',
            }
          : undefined,
    },
    {
      title: 'Top Post Score',
      value: formatLargeNumber(engagementMetrics.topPost.score),
      description: `${engagementMetrics.topPost.comments} comments`,
      icon: <MessageCircle className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {mainStats.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
            trend={stat.trend}
          />
        ))}
      </div>

      {/* Activity period statistics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Activity Metrics</h3>
          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedPeriod === period
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {activityCards.map((stat) => (
            <StatsCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              trend={stat.trend}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
