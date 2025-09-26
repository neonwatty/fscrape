'use client';

import { useState, useMemo } from 'react';
import { ResponsiveTable, type ColumnDefinition } from './ResponsiveTable';
import { MobileCard, MobileCardGrid, SwipeableCard } from './MobileCard';
import { type ForumPost } from '@/lib/db/queries';
import { formatDistanceToNow } from 'date-fns';
import { formatLargeNumber } from '@/lib/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  TrendingUp,
  Clock,
  User,
  ExternalLink,
  Filter,
  SortAsc,
  SortDesc,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ResponsivePostsTableProps {
  posts: ForumPost[];
  className?: string;
  pageSize?: number;
  onPostClick?: (post: ForumPost) => void;
}

export function ResponsivePostsTable({
  posts,
  className,
  pageSize = 10,
  onPostClick,
}: ResponsivePostsTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'comments'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [compactMode, setCompactMode] = useState(false);

  // Filter and sort posts
  const processedPosts = useMemo(() => {
    let filtered = posts;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (post.author && post.author.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Platform filter
    if (selectedPlatform !== 'all') {
      filtered = filtered.filter((post) => post.platform === selectedPlatform);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.created_utc - b.created_utc;
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'comments':
          comparison = a.num_comments - b.num_comments;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [posts, searchTerm, selectedPlatform, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(processedPosts.length / pageSize);
  const paginatedPosts = processedPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Get unique platforms
  const platforms = useMemo(() => {
    const uniquePlatforms = new Set(posts.map((p) => p.platform));
    return Array.from(uniquePlatforms);
  }, [posts]);

  // Table columns definition
  const columns: ColumnDefinition<ForumPost>[] = [
    {
      key: 'title',
      header: 'Title',
      accessor: (post) => (
        <div className="space-y-1">
          <div className="font-medium line-clamp-2">{post.title}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{post.author || 'Unknown'}</span>
            <Clock className="h-3 w-3 ml-2" />
            <span>
              {formatDistanceToNow(new Date(post.created_utc * 1000), { addSuffix: true })}
            </span>
          </div>
        </div>
      ),
      priority: 'essential',
      sortable: true,
    },
    {
      key: 'platform',
      header: 'Platform',
      accessor: (post) => (
        <Badge variant="outline" className="text-xs">
          {post.platform}
        </Badge>
      ),
      priority: 'important',
      align: 'center',
    },
    {
      key: 'score',
      header: (
        <div className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4" />
          Score
        </div>
      ),
      accessor: (post) => <span className="font-medium">{formatLargeNumber(post.score)}</span>,
      priority: 'essential',
      align: 'right',
      sortable: true,
    },
    {
      key: 'comments',
      header: (
        <div className="flex items-center gap-1">
          <MessageCircle className="h-4 w-4" />
          Comments
        </div>
      ),
      accessor: (post) => formatLargeNumber(post.num_comments),
      priority: 'important',
      align: 'right',
      sortable: true,
    },
    {
      key: 'url',
      header: 'Link',
      accessor: (post) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            if (post.url) {
              window.open(post.url, '_blank');
            }
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      ),
      priority: 'optional',
      align: 'center',
    },
  ];

  // Handle page navigation with swipe
  const handleSwipeLeft = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleSwipeRight = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Touch-friendly controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="flex-1 sm:flex-initial"
          >
            <List className="h-4 w-4 mr-2" />
            Table
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="flex-1 sm:flex-initial"
          >
            <Grid3x3 className="h-4 w-4 mr-2" />
            Cards
          </Button>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 flex-1">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as 'date' | 'score' | 'comments')}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="score">Score</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Filter button */}
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {(searchTerm || selectedPlatform !== 'all') && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Posts</SheetTitle>
              <SheetDescription>Refine your search with these filters</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 mt-6">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search title or author..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Platform filter */}
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {platforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Compact mode */}
              <div className="flex items-center justify-between">
                <Label htmlFor="compact">Compact Mode</Label>
                <Button
                  variant={compactMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompactMode(!compactMode)}
                >
                  {compactMode ? 'On' : 'Off'}
                </Button>
              </div>

              {/* Clear filters */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedPlatform('all');
                  setFilterOpen(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Table or Cards view */}
      {viewMode === 'table' ? (
        <ResponsiveTable
          data={paginatedPosts}
          columns={columns}
          onRowClick={onPostClick}
          expandableRows
          compact={compactMode}
          striped
          emptyMessage="No posts found"
        />
      ) : (
        <SwipeableCard onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>
          <MobileCardGrid columns={compactMode ? 2 : 1}>
            {paginatedPosts.map((post) => (
              <MobileCard
                key={post.id}
                title={post.title}
                subtitle={`by ${post.author || 'Unknown'} • ${formatDistanceToNow(new Date(post.created_utc * 1000), { addSuffix: true })}`}
                fields={[
                  {
                    label: 'Platform',
                    value: post.platform,
                    badge: true,
                    priority: 'primary',
                  },
                  {
                    label: 'Score',
                    value: formatLargeNumber(post.score),
                    priority: 'primary',
                  },
                  {
                    label: 'Comments',
                    value: formatLargeNumber(post.num_comments),
                    priority: 'primary',
                  },
                  {
                    label: 'URL',
                    value: 'View Post',
                    link: post.url || undefined,
                    priority: 'secondary',
                  },
                  {
                    label: 'Source',
                    value: post.source || 'Unknown',
                    priority: 'tertiary',
                  },
                ]}
                actions={[
                  {
                    label: 'Open',
                    icon: <ExternalLink className="h-4 w-4" />,
                    onClick: () => {
                      if (post.url) window.open(post.url, '_blank');
                    },
                  },
                ]}
                onClick={() => onPostClick?.(post)}
                compact={compactMode}
              />
            ))}
          </MobileCardGrid>
        </SwipeableCard>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} • {processedPosts.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
