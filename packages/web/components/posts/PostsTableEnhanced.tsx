'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  flexRender,
  FilterFn,
} from '@tanstack/react-table';
import { useDatabase } from '@/lib/db/database-context';
import { getRecentPosts } from '@/lib/db/queries';
import { ForumPost } from '@/lib/db/types';
import { searchPostsFTS, SearchResult } from '@/lib/db/search-queries';
import { SearchInput } from '@/components/search/SearchInput';
import { TableFilters } from '@/components/tables/TableFilters';
import { applyFilters, PostFilters } from '@/lib/utils/filters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  Calendar,
  User,
  MessageSquare,
  TrendingUp,
  Download,
  Copy,
  Trash2,
  MoreHorizontal,
  Settings2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { VirtualizedTable } from './VirtualizedTable';
import { TablePagination } from '@/components/tables/TablePagination';
import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';
import { ExportDialog } from './ExportDialog';

// Custom filter functions
const fuzzyFilter: FilterFn<ForumPost> = (row, columnId, value) => {
  const itemValue = row.getValue(columnId);
  if (typeof itemValue !== 'string') return false;

  const searchValue = value.toLowerCase();
  const cellValue = itemValue.toLowerCase();

  return cellValue.includes(searchValue);
};

interface PostsTableEnhancedProps {
  initialPosts?: ForumPost[];
  enableVirtualization?: boolean;
  enableInfiniteScroll?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  onSelectionChange?: (selectedPosts: ForumPost[]) => void;
  pageSizeOptions?: number[];
}

export function PostsTableEnhanced({
  initialPosts = [],
  enableVirtualization = false,
  enableInfiniteScroll = false,
  showFilters = true,
  showSearch = true,
  onSelectionChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
}: PostsTableEnhancedProps) {
  const { isInitialized, database } = useDatabase();
  const [posts, setPosts] = useState<ForumPost[]>(initialPosts);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Table state
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_utc', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });
  const [allPosts, setAllPosts] = useState<ForumPost[]>([]);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<PostFilters>({});

  // Load posts with search and filters
  const loadPosts = useCallback(
    async (append = false) => {
      if (!isInitialized || !database) return;

      setLoading(true);
      try {
        let fetchedPosts: ForumPost[] = [];
        let searchData: SearchResult[] = [];

        if (globalFilter) {
          // Use FTS search
          searchData = searchPostsFTS(globalFilter, 5000);
          fetchedPosts = searchData;
          setSearchResults(searchData);
        } else {
          // Load recent posts
          fetchedPosts = getRecentPosts(5000);
          setSearchResults([]);
        }

        // Apply custom filters
        if (Object.keys(filters).length > 0) {
          fetchedPosts = applyFilters(fetchedPosts, filters);
        }

        setAllPosts(fetchedPosts);

        // For infinite scroll, append data
        if (enableInfiniteScroll && append) {
          setPosts((prev) => [
            ...prev,
            ...fetchedPosts.slice(prev.length, prev.length + pagination.pageSize),
          ]);
          setHasMoreData(fetchedPosts.length > posts.length + pagination.pageSize);
        } else if (enableInfiniteScroll) {
          // Initial load for infinite scroll
          setPosts(fetchedPosts.slice(0, pagination.pageSize));
          setHasMoreData(fetchedPosts.length > pagination.pageSize);
        } else {
          // Regular pagination
          setPosts(fetchedPosts);
        }
      } catch (error) {
        console.error('Error loading posts:', error);
      } finally {
        setLoading(false);
      }
    },
    [
      isInitialized,
      database,
      globalFilter,
      filters,
      enableInfiniteScroll,
      pagination.pageSize,
      posts.length,
    ]
  );

  useEffect(() => {
    loadPosts(false);
  }, [globalFilter, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll handler
  const loadMorePosts = useCallback(() => {
    if (enableInfiniteScroll && hasMoreData && !loading) {
      const nextBatch = allPosts.slice(posts.length, posts.length + pagination.pageSize);
      if (nextBatch.length > 0) {
        setPosts((prev) => [...prev, ...nextBatch]);
        setHasMoreData(allPosts.length > posts.length + nextBatch.length);
      } else {
        setHasMoreData(false);
      }
    }
  }, [enableInfiniteScroll, hasMoreData, loading, allPosts, posts.length, pagination.pageSize]);

  // Setup infinite scroll
  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: loadMorePosts,
    hasMore: hasMoreData && enableInfiniteScroll,
    isLoading: loading,
    rootMargin: '200px',
    threshold: 0.1,
    enabled: enableInfiniteScroll,
  });

  // Column definitions with selection
  const columns = useMemo<ColumnDef<ForumPost>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 font-semibold"
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const title = row.getValue('title') as string;
          const url = row.original.url || row.original.permalink;

          // Check for search highlighting
          const searchResult = searchResults.find((sr) => sr.id === row.original.id);
          const displayTitle = searchResult?.titleHighlighted || title;

          return (
            <div className="max-w-[500px]">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-primary transition-colors line-clamp-2"
                    >
                      {searchResult?.titleHighlighted ? (
                        <span dangerouslySetInnerHTML={{ __html: displayTitle }} />
                      ) : (
                        title
                      )}
                      <ExternalLink className="inline-block ml-1 h-3 w-3" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{title}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'platform',
        header: 'Platform',
        cell: ({ row }) => {
          const platform = row.getValue('platform') as string;
          const variant = platform === 'reddit' ? 'default' : 'secondary';
          return (
            <Badge variant={variant} className="capitalize">
              {platform}
            </Badge>
          );
        },
        filterFn: 'equals',
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => {
          const source = row.original.source || row.original.subreddit || '';
          return <div className="text-sm text-muted-foreground">{source}</div>;
        },
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'author',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 font-semibold"
          >
            <User className="mr-2 h-4 w-4" />
            Author
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const author = row.getValue('author') as string;
          return (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{author || 'unknown'}</span>
            </div>
          );
        },
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'score',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 font-semibold"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Score
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const score = row.getValue('score') as number;
          return (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{score.toLocaleString()}</span>
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
            className="h-auto p-0 font-semibold"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Comments
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const comments = row.getValue('num_comments') as number;
          return (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span>{comments.toLocaleString()}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'created_utc',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 font-semibold"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const timestamp = row.getValue('created_utc') as number;
          const date = new Date(timestamp * 1000);
          return (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const post = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => window.open(post.url || post.permalink, '_blank')}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in new tab
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(post.url || post.permalink)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [searchResults]
  );

  // Table instance
  const table = useReactTable({
    data: posts,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: fuzzyFilter,
  });

  // Handle selection change
  useEffect(() => {
    const selectedRows = table.getSelectedRowModel().flatRows;
    const selectedPosts = selectedRows.map((row) => row.original);
    onSelectionChange?.(selectedPosts);
  }, [rowSelection, onSelectionChange, table]);

  // Get selected posts
  const getSelectedPosts = useCallback(() => {
    const selectedRows = table.getSelectedRowModel().flatRows;
    return selectedRows.map((row) => row.original);
  }, [table]);

  const handleBulkDelete = useCallback(() => {
    const selectedRows = table.getSelectedRowModel().flatRows;
    if (selectedRows.length === 0) return;

    if (confirm(`Are you sure you want to archive ${selectedRows.length} posts?`)) {
      // Implementation would go here
      console.log(
        'Archiving posts:',
        selectedRows.map((r) => r.original.id)
      );
      table.resetRowSelection();
    }
  }, [table]);

  const selectedCount = Object.keys(rowSelection).length;
  const hasSelection = selectedCount > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl">Enhanced Posts Table</CardTitle>
              <CardDescription className="mt-1">
                {loading ? 'Loading...' : `${table.getFilteredRowModel().rows.length} posts`}
                {hasSelection && ` • ${selectedCount} selected`}
              </CardDescription>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Bulk actions */}
              {hasSelection && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Export ({selectedCount})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Archive ({selectedCount})
                  </Button>
                </div>
              )}

              {/* Column visibility */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="mr-2 h-4 w-4" />
                    View
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        >
                          {column.id.replace(/_/g, ' ')}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Export all button (when no selection) */}
          {!hasSelection && (
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export All
            </Button>
          )}

          {/* Search and filters */}
          {(showSearch || showFilters) && (
            <div className="flex flex-col gap-4">
              {showSearch && (
                <SearchInput
                  value={globalFilter}
                  onChange={setGlobalFilter}
                  onSearch={(value) => {
                    setSearchLoading(true);
                    setGlobalFilter(value);
                    setTimeout(() => setSearchLoading(false), 100);
                  }}
                  placeholder="Search posts..."
                  className="w-full lg:w-[400px]"
                  loading={searchLoading}
                  showSuggestions={true}
                  debounceMs={300}
                />
              )}

              {showFilters && (
                <TableFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  filterOptions={{
                    platforms: ['reddit', 'hackernews'],
                    sources: Array.from(
                      new Set(posts.map((p) => p.source || p.subreddit || '').filter(Boolean))
                    ),
                  }}
                  showPresets={true}
                  showAdvanced={true}
                />
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          {enableVirtualization && table.getRowModel().rows.length > 100 ? (
            <VirtualizedTable table={table} rowHeight={53} overscan={10} className="h-[600px]" />
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={cn('transition-colors', row.getIsSelected() && 'bg-muted/50')}
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
                      {loading ? 'Loading posts...' : 'No results found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Infinite scroll sentinel or pagination */}
        {enableInfiniteScroll ? (
          <>
            {hasMoreData && (
              <div ref={sentinelRef} className="py-4 text-center">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">Loading more posts...</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Scroll for more</span>
                )}
              </div>
            )}
            {!hasMoreData && posts.length > 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No more posts to load
              </div>
            )}
            <div className="py-2 text-center text-sm text-muted-foreground">
              Showing {posts.length} of {allPosts.length} posts
              {hasSelection && ` • ${selectedCount} selected`}
            </div>
          </>
        ) : (
          <TablePagination
            currentPage={table.getState().pagination.pageIndex}
            totalPages={table.getPageCount()}
            pageSize={table.getState().pagination.pageSize}
            totalItems={table.getFilteredRowModel().rows.length}
            pageSizeOptions={pageSizeOptions}
            onPageChange={(page) => table.setPageIndex(page)}
            onPageSizeChange={(size) => {
              table.setPageSize(size);
              setPagination((prev) => ({ ...prev, pageSize: size }));
            }}
            showPageSizeSelector={true}
            showItemCount={true}
            showPageJump={true}
            disabled={loading}
            className="py-4"
            mobileOptimized={true}
          />
        )}
      </CardContent>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        posts={table.getFilteredRowModel().rows.map((row) => row.original)}
        selectedPosts={hasSelection ? getSelectedPosts() : undefined}
        title="Export Posts"
      />
    </Card>
  );
}
