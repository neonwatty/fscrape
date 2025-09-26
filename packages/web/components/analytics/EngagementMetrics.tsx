'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  ThumbsUp,
  FileText,
  Activity,
  BarChart3,
} from 'lucide-react';
import {
  EngagementMetrics as MetricsType,
  calculateGrowthRate,
} from '@/lib/analytics/analytics-utils';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: { rate: number; isPositive: boolean };
  icon: React.ReactNode;
  className?: string;
}

function MetricCard({ title, value, subtitle, change, icon, className }: MetricCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {change && (
          <div
            className={cn(
              'flex items-center gap-1 mt-2 text-xs font-medium',
              change.isPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            {change.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{change.rate.toFixed(1)}%</span>
            <span className="text-muted-foreground ml-1">vs last period</span>
          </div>
        )}
      </CardContent>
      {/* Decorative gradient */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 h-1',
          change?.isPositive
            ? 'bg-gradient-to-r from-green-500 to-green-600'
            : change && !change.isPositive
              ? 'bg-gradient-to-r from-red-500 to-red-600'
              : 'bg-gradient-to-r from-primary/50 to-primary'
        )}
      />
    </Card>
  );
}

interface EngagementMetricsProps {
  current: MetricsType;
  previous?: MetricsType;
  className?: string;
}

export function EngagementMetrics({ current, previous, className }: EngagementMetricsProps) {
  // Calculate growth rates if previous data is available
  const postsGrowth = previous
    ? calculateGrowthRate(current.totalPosts, previous.totalPosts)
    : undefined;

  const scoreGrowth = previous
    ? calculateGrowthRate(current.totalScore, previous.totalScore)
    : undefined;

  const commentsGrowth = previous
    ? calculateGrowthRate(current.totalComments, previous.totalComments)
    : undefined;

  const engagementGrowth = previous
    ? calculateGrowthRate(current.engagementRate, previous.engagementRate)
    : undefined;

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      <MetricCard
        title="Total Posts"
        value={current.totalPosts.toLocaleString()}
        subtitle="Published content"
        change={postsGrowth}
        icon={<FileText className="h-4 w-4" />}
      />

      <MetricCard
        title="Total Score"
        value={current.totalScore.toLocaleString()}
        subtitle={`Avg ${current.avgScore.toFixed(1)} per post`}
        change={scoreGrowth}
        icon={<ThumbsUp className="h-4 w-4" />}
      />

      <MetricCard
        title="Total Comments"
        value={current.totalComments.toLocaleString()}
        subtitle={`Avg ${current.avgComments.toFixed(1)} per post`}
        change={commentsGrowth}
        icon={<MessageSquare className="h-4 w-4" />}
      />

      <MetricCard
        title="Engagement Rate"
        value={current.engagementRate.toFixed(1)}
        subtitle="Combined metric"
        change={engagementGrowth}
        icon={<Activity className="h-4 w-4" />}
      />
    </div>
  );
}

interface CompactMetricsProps {
  metrics: MetricsType;
  className?: string;
}

export function CompactMetrics({ metrics, className }: CompactMetricsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Quick Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Posts</p>
            <p className="text-xl font-semibold">{metrics.totalPosts.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Score</p>
            <p className="text-xl font-semibold">{metrics.totalScore.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Comments</p>
            <p className="text-xl font-semibold">{metrics.totalComments.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Engagement</p>
            <p className="text-xl font-semibold">{metrics.engagementRate.toFixed(1)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
