'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDatabase } from '@/lib/db/database-context';
import { getRecentPosts } from '@/lib/db/queries';
import { ForumPost } from '@/lib/db/types';
import {
  calculateEngagementMetrics,
  generateTimeSeries,
  calculatePlatformMetrics,
  calculateTopAuthors,
  generateActivityHeatmap,
  generateTrendComparison,
  DateRange,
  TimePeriod,
} from '@/lib/analytics/analytics-utils';
import { EngagementMetrics } from '@/components/analytics/EngagementMetrics';
import { ActivityHeatmap } from '@/components/analytics/ActivityHeatmap';
import { HeatMap } from '@/components/charts/HeatMap';
import {
  TrendComparisonChart,
  EngagementTrendChart,
  PlatformDistributionChart,
  TopAuthorsChart,
} from '@/components/analytics/TrendCharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, TrendingUp, Users, Activity, BarChart3, Clock } from 'lucide-react';

export function AnalyticsDashboard() {
  const { isInitialized, database } = useDatabase();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('last30days');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('day');

  // Load posts data
  useEffect(() => {
    if (!isInitialized || !database) return;

    setLoading(true);
    try {
      const allPosts = getRecentPosts(10000); // Load more posts for analytics
      setPosts(allPosts);
    } catch (error) {
      console.error('Error loading posts for analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [isInitialized, database]);

  // Calculate all metrics
  const analytics = useMemo(() => {
    if (posts.length === 0) return null;

    // Filter posts by date range
    const now = Date.now() / 1000;
    let cutoff: number;
    let previousCutoff: number;

    switch (dateRange) {
      case 'last7days':
        cutoff = now - 7 * 24 * 60 * 60;
        previousCutoff = now - 14 * 24 * 60 * 60;
        break;
      case 'last30days':
        cutoff = now - 30 * 24 * 60 * 60;
        previousCutoff = now - 60 * 24 * 60 * 60;
        break;
      case 'last90days':
        cutoff = now - 90 * 24 * 60 * 60;
        previousCutoff = now - 180 * 24 * 60 * 60;
        break;
      default:
        cutoff = 0;
        previousCutoff = 0;
    }

    const currentPosts = cutoff > 0 ? posts.filter((p) => p.created_utc >= cutoff) : posts;
    const previousPosts =
      previousCutoff > 0 && cutoff > 0
        ? posts.filter((p) => p.created_utc >= previousCutoff && p.created_utc < cutoff)
        : [];

    return {
      currentMetrics: calculateEngagementMetrics(currentPosts),
      previousMetrics:
        previousPosts.length > 0 ? calculateEngagementMetrics(previousPosts) : undefined,
      timeSeries: generateTimeSeries(currentPosts, timePeriod),
      platformMetrics: calculatePlatformMetrics(currentPosts),
      topAuthors: calculateTopAuthors(currentPosts, 10),
      heatmapData: generateActivityHeatmap(currentPosts),
      trendComparison: generateTrendComparison(currentPosts, timePeriod),
      totalPosts: currentPosts.length,
    };
  }, [posts, dateRange, timePeriod]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!analytics || posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <CardContent>
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No data available</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start scraping posts to see analytics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Overview</h2>
          <p className="text-muted-foreground">
            Analyzing {analytics.totalPosts.toLocaleString()} posts
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
            <SelectTrigger className="w-[140px]">
              <CalendarDays className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Last 7 days</SelectItem>
              <SelectItem value="last30days">Last 30 days</SelectItem>
              <SelectItem value="last90days">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
            <SelectTrigger className="w-[120px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hourly</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Engagement Metrics Cards */}
      <EngagementMetrics current={analytics.currentMetrics} previous={analytics.previousMetrics} />

      {/* Main Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="trends" className="text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4 mr-1" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="platforms" className="text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 mr-1" />
            Platforms
          </TabsTrigger>
          <TabsTrigger value="authors" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1" />
            Authors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <EngagementTrendChart
              data={analytics.timeSeries}
              title="Engagement Over Time"
              description="Track score, comments, and post volume trends"
            />
            <TrendComparisonChart
              data={analytics.trendComparison}
              title="Platform Comparison"
              description="Compare activity between Reddit and Hacker News"
            />
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <HeatMap
            posts={posts.filter(
              (p) =>
                dateRange === 'all' ||
                p.created_utc >=
                  Date.now() / 1000 -
                    (dateRange === 'last7days'
                      ? 7 * 24 * 60 * 60
                      : dateRange === 'last30days'
                        ? 30 * 24 * 60 * 60
                        : 90 * 24 * 60 * 60)
            )}
            title="Engagement Heatmap"
            description="Discover optimal posting times based on engagement metrics"
            showFilters={true}
            showOptimalTimes={true}
            defaultMetric="avgEngagement"
          />
          <ActivityHeatmap
            data={analytics.heatmapData}
            title="Posting Volume Patterns"
            description="Raw posting frequency by day and hour"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Peak Activity Times</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getPeakTimes(analytics.heatmapData).map((peak, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 rounded-lg bg-muted"
                    >
                      <span className="text-sm font-medium">{peak.label}</span>
                      <span className="text-sm text-muted-foreground">{peak.value} posts</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Most Active Day</p>
                    <p className="text-lg">{getMostActiveDay(analytics.heatmapData)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Most Active Hour</p>
                    <p className="text-lg">{getMostActiveHour(analytics.heatmapData)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Average Daily Posts</p>
                    <p className="text-lg">
                      {(analytics.totalPosts / getDayCount(dateRange)).toFixed(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <PlatformDistributionChart
              data={analytics.platformMetrics}
              title="Platform Distribution"
              description="Breakdown of posts by platform"
            />
            <Card>
              <CardHeader>
                <CardTitle>Platform Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.platformMetrics.map((platform) => (
                    <div key={platform.platform} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">{platform.platform}</span>
                        <span className="text-sm text-muted-foreground">
                          {platform.posts} posts
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Avg Score: </span>
                          <span className="font-medium">{platform.avgScore.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Comments: </span>
                          <span className="font-medium">{platform.avgComments.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${platform.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="authors" className="space-y-4">
          <TopAuthorsChart
            data={analytics.topAuthors}
            title="Top Contributors"
            description="Most active authors by total score"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {analytics.topAuthors.slice(0, 6).map((author) => (
              <Card key={author.author}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{author.author}</p>
                      <p className="text-sm text-muted-foreground">
                        {author.posts} posts • {author.totalScore.toLocaleString()} total score
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{author.avgScore.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">avg score</p>
                    </div>
                  </div>
                  {author.topPost && (
                    <div className="mt-3 p-2 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Top post:</p>
                      <p className="text-sm line-clamp-1">{author.topPost.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Score: {author.topPost.score.toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px]" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px]" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper functions
function getPeakTimes(heatmapData: ReturnType<typeof generateActivityHeatmap>) {
  const sorted = [...heatmapData].sort((a, b) => b.value - a.value).slice(0, 5);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return sorted.map((item) => ({
    label: `${dayNames[item.day]} ${item.hour}:00`,
    value: item.value,
  }));
}

function getMostActiveDay(heatmapData: ReturnType<typeof generateActivityHeatmap>) {
  const dayTotals = Array(7).fill(0);
  heatmapData.forEach((item) => {
    dayTotals[item.day] += item.value;
  });

  const maxDay = dayTotals.indexOf(Math.max(...dayTotals));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[maxDay];
}

function getMostActiveHour(heatmapData: ReturnType<typeof generateActivityHeatmap>) {
  const hourTotals = Array(24).fill(0);
  heatmapData.forEach((item) => {
    hourTotals[item.hour] += item.value;
  });

  const maxHour = hourTotals.indexOf(Math.max(...hourTotals));
  return `${maxHour}:00 - ${maxHour + 1}:00`;
}

function getDayCount(dateRange: DateRange): number {
  switch (dateRange) {
    case 'last7days':
      return 7;
    case 'last30days':
      return 30;
    case 'last90days':
      return 90;
    default:
      return 365;
  }
}
