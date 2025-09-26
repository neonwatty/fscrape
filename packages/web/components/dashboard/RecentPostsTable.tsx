'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDatabase } from '@/lib/db/database-context';
import { getPosts, type ForumPost } from '@/lib/db/queries';
import { PostsTable } from '@/components/tables/PostsTable';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function RecentPostsTable() {
  const { isInitialized } = useDatabase();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, _setPageSize] = useState(20);

  const fetchPosts = useCallback(async () => {
    if (!isInitialized) return;

    setLoading(true);
    try {
      // Fetch more posts for better pagination experience
      const recentPosts = getPosts({
        limit: 100,
        sortBy: 'created_utc',
        sortOrder: 'desc',
      });
      setPosts(recentPosts);
    } catch (error) {
      console.error('Error fetching recent posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  useEffect(() => {
    fetchPosts();
  }, [isInitialized, fetchPosts]);

  const handleRefresh = () => {
    fetchPosts();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Posts</CardTitle>
          <CardDescription>
            Latest forum posts across all platforms with sorting and filtering
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <PostsTable
          data={posts}
          loading={loading}
          pageSize={pageSize}
          showPagination={true}
          showFilters={true}
        />
      </CardContent>
    </Card>
  );
}
