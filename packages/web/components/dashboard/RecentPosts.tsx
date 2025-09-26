'use client';

import { useEffect, useState } from 'react';
import { useDatabase } from '@/lib/db/database-context';
import { getPosts, type ForumPost } from '@/lib/db/queries';
import { PostsTable } from '@/components/tables/PostsTable';

interface RecentPostsProps {
  limit?: number;
  pageSize?: number;
  showPagination?: boolean;
  showFilters?: boolean;
  className?: string;
}

export function RecentPosts({
  limit = 100,
  pageSize = 10,
  showPagination = true,
  showFilters = false,
  className = '',
}: RecentPostsProps) {
  const { isInitialized } = useDatabase();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      setLoading(true);
      try {
        const recentPosts = getPosts({
          limit,
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
    }
  }, [isInitialized, limit]);

  return (
    <div className={className}>
      <PostsTable
        data={posts}
        loading={loading}
        pageSize={pageSize}
        showPagination={showPagination}
        showFilters={showFilters}
      />
    </div>
  );
}
