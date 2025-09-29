'use client';

import { useState, useEffect } from 'react';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { HeatMap } from '@/components/charts/HeatMap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPosts } from '@/lib/db/queries';
import { ForumPost } from '@/lib/db/types';

export default function AnalyticsPage() {
  const { database, isLoading: dbLoading, error } = useDatabase();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!database) {
      setIsLoading(dbLoading);
      return;
    }

    try {
      const allPosts = getPosts({});
      setPosts(allPosts);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load posts:', err);
      setIsLoading(false);
    }
  }, [database, dbLoading]);

  if (error) {
    return (
      <div className="container py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">Advanced posting time analysis and insights</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading data: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">Advanced posting time analysis and insights</p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Advanced posting time analysis and engagement insights
        </p>
      </div>

      <HeatMap
        posts={posts}
        title="Posting Time Heatmap"
        description="Discover optimal posting times based on engagement metrics"
        showFilters={true}
        showOptimalTimes={true}
      />

      <Card>
        <CardHeader>
          <CardTitle>About This Analysis</CardTitle>
          <CardDescription>How to interpret the heatmap and optimal posting times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Heatmap View</h3>
            <p className="text-sm text-muted-foreground">
              The heatmap shows posting activity and engagement across different days and hours.
              Darker colors indicate higher engagement or activity. Hover over cells to see detailed
              statistics.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Optimal Times</h3>
            <p className="text-sm text-muted-foreground">
              The optimal times tab shows the best time slots for posting based on historical
              engagement data. These recommendations consider post volume, average scores, and
              comment activity.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Filters</h3>
            <p className="text-sm text-muted-foreground">
              Use the filters to customize the analysis by platform, metric (engagement, post count,
              upvotes, or comments), source/subreddit, and minimum post threshold.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
