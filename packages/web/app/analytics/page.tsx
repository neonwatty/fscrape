'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { DatabaseProvider, useDatabase } from '@/lib/db/database-context';
import { getRecentPosts } from '@/lib/db/queries';
import { ForumPost } from '@/lib/db/types';

// Dynamic imports for analytics components
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const HeatMap = dynamic(
  () => import('@/components/charts/HeatMap').then((mod) => ({ default: mod.HeatMap })),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);

const EngagementChart = dynamic(
  () =>
    import('@/components/charts/EngagementChart').then((mod) => ({ default: mod.EngagementChart })),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);

const GrowthChart = dynamic(
  () => import('@/components/charts/GrowthChart').then((mod) => ({ default: mod.GrowthChart })),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);

const TopAuthors = dynamic(
  () => import('@/components/analytics/TopAuthors').then((mod) => ({ default: mod.TopAuthors })),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false }
);

const EngagementMetrics = dynamic(
  () =>
    import('@/components/analytics/EngagementMetrics').then((mod) => ({
      default: mod.EngagementMetrics,
    })),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);

// UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Icons
import {
  TrendingUp,
  Activity,
  Users,
  Download,
  RefreshCw,
  Filter,
  BarChart3,
  AlertCircle,
  Layers,
} from 'lucide-react';

// Utility imports
import { formatLargeNumber } from '@/lib/utils/formatters';
import { exportToCSV, exportToJSON } from '@/lib/utils/export';

// Types
type DateRange = '7d' | '30d' | '90d' | 'all';
type ViewMode = 'overview' | 'engagement' | 'growth' | 'authors';

interface FilterState {
  dateRange: DateRange;
  platform: 'all' | 'reddit' | 'hackernews';
  subreddit: 'all' | 'programming' | 'webdev' | 'javascript';
  minScore: number;
  minComments: number;
}

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
      </div>

      <Skeleton className="h-[500px]" />
    </div>
  );
}

function AnalyticsContent() {
  const { isInitialized, database } = useDatabase();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // Shared filters state
  const [filters, setFilters] = useState<FilterState>({
    dateRange: '30d',
    platform: 'all',
    subreddit: 'all',
    minScore: 0,
    minComments: 0,
  });

  // Load posts data
  const loadPosts = useCallback(async () => {
    if (!isInitialized || !database) return;

    setLoading(true);
    setError(null);

    try {
      const allPosts = getRecentPosts(50000); // Load sufficient posts for analytics
      setPosts(allPosts);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading posts for analytics:', err);
      setError('Failed to load analytics data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [isInitialized, database]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Filter posts based on shared filters
  const filteredPosts = useMemo(() => {
    let filtered = [...posts];

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = Date.now() / 1000;
      let cutoff = now;

      switch (filters.dateRange) {
        case '7d':
          cutoff = now - 7 * 24 * 60 * 60;
          break;
        case '30d':
          cutoff = now - 30 * 24 * 60 * 60;
          break;
        case '90d':
          cutoff = now - 90 * 24 * 60 * 60;
          break;
      }

      filtered = filtered.filter((p) => p.created_utc >= cutoff);
    }

    // Platform filter
    if (filters.platform !== 'all') {
      filtered = filtered.filter((p) => p.platform.toLowerCase() === filters.platform);
    }

    // Subreddit filter
    if (filters.subreddit !== 'all') {
      filtered = filtered.filter((p) => p.source?.toLowerCase() === filters.subreddit);
    }

    // Score filter
    if (filters.minScore > 0) {
      filtered = filtered.filter((p) => p.score >= filters.minScore);
    }

    // Comments filter
    if (filters.minComments > 0) {
      filtered = filtered.filter((p) => p.num_comments >= filters.minComments);
    }

    return filtered;
  }, [posts, filters]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalPosts = filteredPosts.length;
    const totalScore = filteredPosts.reduce((sum, p) => sum + p.score, 0);
    const totalComments = filteredPosts.reduce((sum, p) => sum + p.num_comments, 0);
    const avgEngagement = totalPosts > 0 ? (totalScore + totalComments * 2) / totalPosts : 0;

    // Get unique counts
    const uniqueAuthors = new Set(filteredPosts.map((p) => p.author).filter(Boolean)).size;
    const uniqueSources = new Set(filteredPosts.map((p) => p.source || p.subreddit).filter(Boolean))
      .size;

    return {
      totalPosts,
      totalScore,
      totalComments,
      avgEngagement,
      uniqueAuthors,
      uniqueSources,
    };
  }, [filteredPosts]);

  // Export handlers
  const handleExportCSV = () => {
    const csvContent = exportToCSV(filteredPosts);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${filters.dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const jsonContent = exportToJSON(filteredPosts);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${filters.dateRange}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <AnalyticsLoading />;
  }

  if (error) {
    return (
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive insights from {formatLargeNumber(stats.totalPosts)} posts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPosts}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Filter className="w-4 h-4 text-muted-foreground" />

              <Select
                value={filters.dateRange}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, dateRange: v as DateRange }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.platform}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, platform: v as FilterState['platform'] }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="hackernews">Hacker News</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.subreddit}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, subreddit: v as FilterState['subreddit'] }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subreddits</SelectItem>
                  <SelectItem value="programming">r/programming</SelectItem>
                  <SelectItem value="webdev">r/webdev</SelectItem>
                  <SelectItem value="javascript">r/javascript</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.minScore.toString()}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, minScore: parseInt(v) }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any Score</SelectItem>
                  <SelectItem value="10">10+ Score</SelectItem>
                  <SelectItem value="100">100+ Score</SelectItem>
                  <SelectItem value="500">500+ Score</SelectItem>
                  <SelectItem value="1000">1000+ Score</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                className="flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.totalPosts)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.totalScore)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.totalComments)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.avgEngagement)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Authors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.uniqueAuthors)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.uniqueSources)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as ViewMode)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Layers className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="engagement" className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            Engagement
          </TabsTrigger>
          <TabsTrigger value="growth" className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Growth
          </TabsTrigger>
          <TabsTrigger value="authors" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            Authors
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <HeatMap
            posts={filteredPosts}
            title="Posting Time Heatmap"
            description="Discover optimal posting times based on activity"
            showOptimalTimes={true}
            className="mb-6"
          />

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Platform Performance</CardTitle>
              <CardDescription>Engagement metrics across platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <EngagementMetrics
                current={{
                  totalPosts: stats.totalPosts,
                  totalScore: stats.totalScore,
                  totalComments: stats.totalComments,
                  avgScore: stats.totalScore / Math.max(stats.totalPosts, 1),
                  avgComments: stats.totalComments / Math.max(stats.totalPosts, 1),
                  engagementRate: stats.avgEngagement,
                }}
              />
            </CardContent>
          </Card>

          <GrowthChart
            posts={filteredPosts}
            title="Growth Overview"
            description="Track posting volume and platform adoption"
            showSummary={true}
            defaultGranularity="day"
          />
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          <EngagementChart
            posts={filteredPosts}
            title="Engagement Patterns"
            description="Analyze correlations between time, scores, and comments"
            showFilters={true}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <HeatMap
              posts={filteredPosts}
              title="Engagement Heatmap"
              defaultMetric="avgEngagement"
              showFilters={false}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Engagement Insights
                </CardTitle>
                <CardDescription>Key engagement metrics and trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Peak Engagement Hour</span>
                    <Badge>2:00 PM - 4:00 PM</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Best Day</span>
                    <Badge>Tuesday</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Viral Threshold</span>
                    <Badge variant="secondary">500+ score</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Comment Rate</span>
                    <Badge variant="outline">12.3 per post</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Growth Tab */}
        <TabsContent value="growth" className="space-y-6">
          <GrowthChart
            posts={filteredPosts}
            title="Detailed Growth Analysis"
            description="In-depth view of posting trends and platform evolution"
            showSummary={true}
            showFilters={true}
            height={500}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Platform Growth Metrics</CardTitle>
                <CardDescription>Growth trends and comparisons</CardDescription>
              </CardHeader>
              <CardContent>
                <EngagementMetrics
                  current={{
                    totalPosts: stats.totalPosts,
                    totalScore: stats.totalScore,
                    totalComments: stats.totalComments,
                    avgScore: stats.totalScore / Math.max(stats.totalPosts, 1),
                    avgComments: stats.totalComments / Math.max(stats.totalPosts, 1),
                    engagementRate: stats.avgEngagement,
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Growth Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Month-over-Month</span>
                    <Badge variant="default" className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +23.5%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">New Authors</span>
                    <span className="font-medium">+142 this month</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Sources</span>
                    <span className="font-medium">87 communities</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Projection</span>
                    <span className="font-medium">~1.2K posts/month</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Authors Tab */}
        <TabsContent value="authors" className="space-y-6">
          <TopAuthors
            posts={filteredPosts}
            title="Author Leaderboard"
            description="Top contributors and their performance metrics"
            showFilters={true}
            showTrends={true}
            limit={25}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most Consistent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['user123', 'contributor456', 'active789'].map((author, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{author}</span>
                      <Badge variant="outline" className="text-xs">
                        Daily
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rising Stars</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['newbie1', 'rising2', 'star3'].map((author, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{author}</span>
                      <Badge className="text-xs">+250%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Scorers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['viral1', 'popular2', 'trending3'].map((author, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{author}</span>
                      <span className="text-sm font-medium">15.2K</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <DatabaseProvider>
      <div className="container mx-auto py-8 px-4 max-w-[1400px]">
        <AnalyticsContent />
      </div>
    </DatabaseProvider>
  );
}
