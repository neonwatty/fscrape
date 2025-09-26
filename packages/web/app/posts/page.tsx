'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { DatabaseProvider } from '@/lib/db/database-context';
import { ForumPost } from '@/lib/db/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableLoading } from '@/app/loading';

// Lazy load the heavy PostsTableEnhanced component
const PostsTableEnhanced = dynamic(
  () =>
    import('@/components/posts/PostsTableEnhanced').then((mod) => ({
      default: mod.PostsTableEnhanced,
    })),
  {
    loading: () => <TableLoading rows={10} />,
    ssr: false, // Disable SSR for this heavy component
  }
);

function PostsExplorerSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-4 w-[150px] mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[300px]" />
            <Skeleton className="h-10 w-[100px]" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PostsPage() {
  const [selectedPosts, setSelectedPosts] = useState<ForumPost[]>([]);

  return (
    <DatabaseProvider>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">Posts Explorer</h1>
          <p className="text-muted-foreground text-lg">
            Browse, search, and filter through all scraped forum posts with advanced analytics
          </p>
        </div>

        <Tabs defaultValue="enhanced" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="enhanced">Enhanced Table</TabsTrigger>
            <TabsTrigger value="infinite">Infinite Scroll</TabsTrigger>
            <TabsTrigger value="virtualized">Virtualized</TabsTrigger>
          </TabsList>

          <TabsContent value="enhanced" className="mt-6">
            <Suspense fallback={<PostsExplorerSkeleton />}>
              <PostsTableEnhanced
                enableVirtualization={false}
                enableInfiniteScroll={false}
                showFilters={true}
                showSearch={true}
                onSelectionChange={setSelectedPosts}
                pageSizeOptions={[10, 20, 30, 50, 100]}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="infinite" className="mt-6">
            <Suspense fallback={<PostsExplorerSkeleton />}>
              <PostsTableEnhanced
                enableVirtualization={false}
                enableInfiniteScroll={true}
                showFilters={true}
                showSearch={true}
                onSelectionChange={setSelectedPosts}
                pageSizeOptions={[20, 50, 100]}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="virtualized" className="mt-6">
            <Suspense fallback={<PostsExplorerSkeleton />}>
              <PostsTableEnhanced
                enableVirtualization={true}
                enableInfiniteScroll={false}
                showFilters={true}
                showSearch={true}
                onSelectionChange={setSelectedPosts}
                pageSizeOptions={[50, 100, 200, 500]}
              />
            </Suspense>
          </TabsContent>
        </Tabs>

        {selectedPosts.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {selectedPosts.length} posts selected for bulk operations
            </p>
          </div>
        )}
      </div>
    </DatabaseProvider>
  );
}
