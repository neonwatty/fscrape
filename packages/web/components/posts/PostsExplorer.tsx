'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  FilterFn,
} from '@tanstack/react-table';
import { useDatabase } from '@/lib/db/database-context';
import { getRecentPosts } from '@/lib/db/queries';
import { ForumPost } from '@/lib/db/types';
import { searchPostsFTS, SearchResult } from '@/lib/db/search-queries';
import { SearchInput } from '@/components/search/SearchInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Filter,
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  Calendar,
  User,
  MessageSquare,
  TrendingUp,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Custom filter functions
const fuzzyFilter: FilterFn<ForumPost> = (row, columnId, value, _addMeta) => {
  const itemValue = row.getValue(columnId);
  if (typeof itemValue !== 'string') return false;

  const searchValue = value.toLowerCase();
  const cellValue = itemValue.toLowerCase();

  return cellValue.includes(searchValue);
};

const rangeFilter: FilterFn<ForumPost> = (row, columnId, value) => {
  const rowValue = row.getValue(columnId) as number;
  const [min, max] = value as [number, number];

  if (min !== undefined && rowValue < min) return false;
  if (max !== undefined && rowValue > max) return false;

  return true;
};

interface PostsExplorerProps {
  initialPosts?: ForumPost[];
}

export function PostsExplorer({ initialPosts = [] }: PostsExplorerProps) {
  const { isInitialized, database } = useDatabase();
  const [posts, setPosts] = useState<ForumPost[]>(initialPosts);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_utc', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  // Filter states
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [scoreRange, setScoreRange] = useState<[number | undefined, number | undefined]>([
    undefined,
    undefined,
  ]);
  const [_dateRange, _setDateRange] = useState<[Date | undefined, Date | undefined]>([
    undefined,
    undefined,
  ]);

  // Load posts with search support
  const loadPosts = useCallback(async () => {
    if (!isInitialized || !database) return;

    setLoading(true);
    try {
      let fetchedPosts: ForumPost[] = [];
      let searchData: SearchResult[] = [];

      if (globalFilter) {
        // Use FTS search when available
        searchData = searchPostsFTS(globalFilter, 1000);
        fetchedPosts = searchData;
        setSearchResults(searchData);
      } else {
        fetchedPosts = getRecentPosts(1000); // Load more posts for exploration
        setSearchResults([]);
      }

      // Apply platform filter
      if (platformFilter !== 'all') {
        fetchedPosts = fetchedPosts.filter(
          (post) => post.platform.toLowerCase() === platformFilter.toLowerCase()
        );
      }

      // Apply score range filter
      if (scoreRange[0] !== undefined || scoreRange[1] !== undefined) {
        fetchedPosts = fetchedPosts.filter((post) => {
          if (scoreRange[0] !== undefined && post.score < scoreRange[0]) return false;
          if (scoreRange[1] !== undefined && post.score > scoreRange[1]) return false;
          return true;
        });
      }

      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }, [isInitialized, database, globalFilter, platformFilter, scoreRange]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Table columns definition
  const columns = useMemo<ColumnDef<ForumPost>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
            className="rounded border-gray-300"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(!!e.target.checked)}
            className="rounded border-gray-300"
          />
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

          // Check if this row has highlighted title from search
          const searchResult = searchResults.find((sr) => sr.id === row.original.id);
          const displayTitle = searchResult?.titleHighlighted || title;

          return (
            <div className="max-w-[500px]">
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
          return (
            <Badge variant="outline" className="capitalize">
              {platform}
            </Badge>
          );
        },
        filterFn: 'equals',
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
              <span className="text-sm">{author}</span>
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
        filterFn: rangeFilter,
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
        filterFn: rangeFilter,
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
          const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
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
        header: 'Actions',
        cell: ({ row }) => {
          const post = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  onClick={() => window.open(post.url || post.permalink, '_blank')}
                >
                  Open in new tab
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  onClick={() => navigator.clipboard.writeText(post.url || post.permalink)}
                >
                  Copy link
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem onClick={() => navigator.clipboard.writeText(post.title)}>
                  Copy title
                </DropdownMenuCheckboxItem>
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

  // Initialize table
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
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    filterFns: {
      fuzzy: fuzzyFilter,
      range: rangeFilter,
    },
  });

  // Clear all filters
  const clearFilters = () => {
    setGlobalFilter('');
    setColumnFilters([]);
    setPlatformFilter('all');
    setScoreRange([undefined, undefined]);
    _setDateRange([undefined, undefined]);
  };

  const hasActiveFilters =
    globalFilter ||
    platformFilter !== 'all' ||
    scoreRange[0] !== undefined ||
    scoreRange[1] !== undefined;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-2xl">Posts Explorer</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? 'Loading...' : `${table.getFilteredRowModel().rows.length} posts found`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Enhanced search with suggestions */}
            <SearchInput
              value={globalFilter}
              onChange={setGlobalFilter}
              onSearch={(value) => {
                setSearchLoading(true);
                setGlobalFilter(value);
                setTimeout(() => setSearchLoading(false), 100);
              }}
              placeholder="Search posts..."
              className="w-full sm:w-[300px]"
              loading={searchLoading}
              showSuggestions={true}
              debounceMs={300}
            />

            {/* Column visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  Columns
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Platform filter */}
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="reddit">Reddit</SelectItem>
              <SelectItem value="hackernews">Hacker News</SelectItem>
            </SelectContent>
          </Select>

          {/* Score range filter */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min score"
              className="w-[120px]"
              value={scoreRange[0] ?? ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                setScoreRange([value, scoreRange[1]]);
              }}
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="number"
              placeholder="Max score"
              className="w-[120px]"
              value={scoreRange[1] ?? ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                setScoreRange([scoreRange[0], value]);
              }}
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              <X className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
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
                // Loading skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns.length}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
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
                    No posts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${pagination.pageSize}`}
              onValueChange={(value) => {
                setPagination({ ...pagination, pageSize: Number(value) });
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
