'use client';

import { useEffect, Suspense, useState } from 'react';
import { DatabaseProvider, useDatabase } from '@/lib/db/database-context';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { RecentPostsTable } from '@/components/dashboard/RecentPostsTable';
import { PlatformSelector } from '@/components/dashboard/PlatformSelector';
import { PlatformPicker } from '@/components/dashboard/PlatformPicker';
import { HeatMap } from '@/components/charts/HeatMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createSampleDatabase } from '@/lib/db/sample-database';
import { getPosts } from '@/lib/db/queries';
import {
  Database,
  Upload,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Activity,
  Users,
  MessageSquare,
  Loader2,
  Clock,
} from 'lucide-react';

// Loading skeleton components
function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-[120px]" />
            <Skeleton className="h-3 w-[80px] mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-[150px]" />
        <Skeleton className="h-4 w-[200px]" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-[150px]" />
        <Skeleton className="h-4 w-[200px]" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Error boundary component
function ErrorDisplay({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <Alert variant="destructive" className="max-w-2xl mx-auto">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Dashboard</AlertTitle>
      <AlertDescription>
        <p className="mb-2">{error}</p>
        {retry && (
          <Button onClick={retry} variant="outline" size="sm">
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Loading state component - reserved for future use
function _LoadingState() {
  return (
    <div className="space-y-8">
      <StatsCardsSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}

// Welcome screen for uninitialized state
function WelcomeScreen({
  onLoadSample,
  onUploadFile,
  isLoading,
  error,
}: {
  onLoadSample: () => void;
  onUploadFile?: () => void;
  isLoading: boolean;
  error?: string | null;
}) {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Forum Analytics Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">
          Analyze and visualize scraped forum posts from Reddit and Hacker News
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="border-primary/20">
          <CardHeader>
            <Activity className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Real-time Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track posting trends, engagement metrics, and platform activity in real-time
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <BarChart3 className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Visual Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Interactive charts and graphs to explore your data from multiple perspectives
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <Users className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Author Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Discover top contributors and analyze posting patterns across platforms
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Database className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">Get Started</CardTitle>
          <CardDescription className="text-base">
            Load a database to begin exploring forum analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <ErrorDisplay error={error} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Button onClick={onLoadSample} disabled={isLoading} size="lg" className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Load Sample Data
                </>
              )}
            </Button>

            <Button
              variant="outline"
              disabled={isLoading || !onUploadFile}
              size="lg"
              className="w-full"
              onClick={onUploadFile}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Database
            </Button>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Sample data includes posts from Reddit and Hacker News for demonstration
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Main dashboard content
function DashboardContent() {
  const { isLoading, isInitialized, error, summary, loadDatabase, refreshData } = useDatabase();
  const [loadingComponents, setLoadingComponents] = useState({
    stats: true,
    charts: true,
    table: true,
  });

  const handleLoadSampleData = async () => {
    try {
      const sampleDb = await createSampleDatabase();
      const data = sampleDb.export();
      const blob = new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      await loadDatabase(url);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to load sample data:', err);
    }
  };

  const handleUploadFile = () => {
    // TODO: Implement file upload functionality
    console.log('File upload not yet implemented');
  };

  useEffect(() => {
    if (isInitialized) {
      refreshData();
      // Simulate component loading
      setTimeout(() => setLoadingComponents((prev) => ({ ...prev, stats: false })), 500);
      setTimeout(() => setLoadingComponents((prev) => ({ ...prev, charts: false })), 1000);
      setTimeout(() => setLoadingComponents((prev) => ({ ...prev, table: false })), 1500);
    }
  }, [isInitialized, refreshData]);

  // Show welcome screen if not initialized
  if (!isInitialized) {
    return (
      <WelcomeScreen
        onLoadSample={handleLoadSampleData}
        onUploadFile={handleUploadFile}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Show error state if there's an error after initialization
  if (error && isInitialized) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        </div>
        <ErrorDisplay error={error} retry={() => refreshData()} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header Section */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              {summary ? (
                <>
                  <span className="font-semibold text-foreground">
                    {summary.totalPosts.toLocaleString()}
                  </span>{' '}
                  posts from{' '}
                  <span className="font-semibold text-foreground">
                    {summary.totalAuthors.toLocaleString()}
                  </span>{' '}
                  authors across{' '}
                  <span className="font-semibold text-foreground">
                    {summary.platforms?.length || 0}
                  </span>{' '}
                  platforms
                </>
              ) : (
                'Loading dashboard statistics...'
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refreshData()}>
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:space-y-8">
        {/* Platform Filter Section */}
        <section className="space-y-4">
          <PlatformPicker
            onSelectionChange={(selection) => {
              console.log('Platform selection changed:', selection);
              // Trigger refresh with filters
              refreshData();
            }}
          />
        </section>

        {/* Stats Cards Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Key Metrics</h2>
          </div>
          {loadingComponents.stats ? (
            <StatsCardsSkeleton />
          ) : (
            <Suspense fallback={<StatsCardsSkeleton />}>
              <StatsCards />
            </Suspense>
          )}
        </section>

        {/* Platform Analytics Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Platform Analytics</h2>
          </div>
          <Suspense fallback={<ChartSkeleton />}>
            <PlatformSelector />
          </Suspense>
        </section>

        {/* Charts Grid Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Trends & Distribution</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {loadingComponents.charts ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
              </>
            ) : (
              <>
                <Suspense fallback={<ChartSkeleton />}>
                  <TrendChart />
                </Suspense>

                <Suspense fallback={<ChartSkeleton />}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Platform Distribution</CardTitle>
                      <CardDescription>Posts distribution across platforms</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {summary?.platforms && summary.platforms.length > 0 ? (
                        <div className="space-y-4">
                          {summary.platforms.map((platform) => (
                            <div key={platform.platform} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium capitalize">
                                  {platform.platform}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {Math.round((platform.totalPosts / summary.totalPosts) * 100)}%
                                </span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2.5">
                                <div
                                  className="bg-primary h-2.5 rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${(platform.totalPosts / summary.totalPosts) * 100}%`,
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{platform.totalPosts.toLocaleString()} posts</span>
                                <span>
                                  {platform.avgScore
                                    ? `Avg score: ${Math.round(platform.avgScore)}`
                                    : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                          No platform data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Suspense>
              </>
            )}
          </div>
        </section>

        {/* Posting Time Heatmap Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Posting Time Analysis</h2>
          </div>
          <Suspense fallback={<ChartSkeleton />}>
            <HeatMap
              posts={getPosts({})}
              title="Posting Time Heatmap"
              description="Discover optimal posting times based on engagement metrics"
              showFilters={true}
              showOptimalTimes={true}
            />
          </Suspense>
        </section>

        {/* Recent Posts Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Recent Posts</h2>
          </div>
          {loadingComponents.table ? (
            <TableSkeleton />
          ) : (
            <Suspense fallback={<TableSkeleton />}>
              <RecentPostsTable />
            </Suspense>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <DatabaseProvider>
      <DashboardContent />
    </DatabaseProvider>
  );
}
