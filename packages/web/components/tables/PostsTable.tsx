'use client';

import React, { useState } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  MessageCircle,
  TrendingUp,
  Clock,
  User,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { type ForumPost } from '@/lib/db/queries';
import { formatLargeNumber } from '@/lib/utils/formatters';

interface PostsTableProps {
  data: ForumPost[];
  loading?: boolean;
  pageSize?: number;
  showPagination?: boolean;
  showFilters?: boolean;
  mobileBreakpoint?: number;
}

// Platform color mapping
const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'reddit':
      return 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 dark:text-orange-400';
    case 'hackernews':
      return 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400';
    default:
      return 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-400';
  }
};

// Column definitions
const columns: ColumnDef<ForumPost>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent font-medium"
      >
        Title
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const title = row.original.title;
      const url = row.original.url;
      const subreddit = row.original.subreddit;

      return (
        <div className="space-y-1 max-w-[500px]">
          <div className="flex items-start gap-2">
            <span className="font-medium line-clamp-2">{title}</span>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Open external link"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {subreddit && <div className="text-xs text-muted-foreground">r/{subreddit}</div>}
        </div>
      );
    },
  },
  {
    accessorKey: 'author',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent font-medium"
      >
        Author
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const author = row.getValue('author') as string | null;
      return (
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{author || 'Unknown'}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'score',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent font-medium"
      >
        Score
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.getValue('score') as number;
      return (
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{formatLargeNumber(score)}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'num_comments',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent font-medium"
      >
        Comments
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const comments = row.getValue('num_comments') as number;
      return (
        <div className="flex items-center gap-1">
          <MessageCircle className="h-3 w-3 text-muted-foreground" />
          <span>{formatLargeNumber(comments)}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'platform',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent font-medium"
      >
        Platform
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const platform = row.getValue('platform') as string;
      return (
        <Badge variant="secondary" className={getPlatformColor(platform)}>
          {platform}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'created_utc',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent font-medium"
      >
        Posted
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const timestamp = row.getValue('created_utc') as number;
      return (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true })}</span>
        </div>
      );
    },
  },
];

// Mobile card component
function MobilePostCard({ post }: { post: ForumPost }) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title and link */}
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium line-clamp-2 text-sm">{post.title}</h3>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {post.subreddit && (
              <div className="text-xs text-muted-foreground">r/{post.subreddit}</div>
            )}
          </div>

          {/* Platform and author */}
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className={getPlatformColor(post.platform)}>
              {post.platform}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{post.author || 'Unknown'}</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{formatLargeNumber(post.score)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3 text-muted-foreground" />
                <span>{formatLargeNumber(post.num_comments)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="text-xs">
                {formatDistanceToNow(new Date(post.created_utc * 1000), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PostsTable({
  data,
  loading = false,
  pageSize = 10,
  showPagination = true,
  showFilters = true,
  mobileBreakpoint = 768,
}: PostsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_utc', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile view
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileBreakpoint]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // Render mobile view
  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Mobile filters */}
        {showFilters && (
          <div className="space-y-2">
            <Input
              placeholder="Search posts..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-full"
            />
          </div>
        )}

        {/* Mobile cards */}
        <div>
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading posts...
              </CardContent>
            </Card>
          ) : data.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No posts available
              </CardContent>
            </Card>
          ) : (
            <>
              {table.getRowModel().rows.map((row) => (
                <MobilePostCard key={row.id} post={row.original} />
              ))}
            </>
          )}
        </div>

        {/* Mobile pagination */}
        {showPagination && data.length > 0 && (
          <div className="flex items-center justify-between px-2">
            <div className="text-xs text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search posts..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
          <div className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} posts
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading posts...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No posts available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * pageSize + 1} to{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, data.length)} of{' '}
            {data.length} posts
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-sm">Page</span>
              <Select
                value={`${table.getState().pagination.pageIndex + 1}`}
                onValueChange={(value) => table.setPageIndex(Number(value) - 1)}
              >
                <SelectTrigger className="w-16 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: table.getPageCount() }, (_, i) => (
                    <SelectItem key={i} value={`${i + 1}`}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm">of {table.getPageCount()}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
