'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ForumPost } from '@/lib/db/types';
import {
  calculateEnhancedAuthorStats,
  filterAuthorStats,
  sortAuthorStats,
  getAuthorTier,
  formatTrend,
  type EnhancedAuthorStats,
  type AuthorSortKey,
  type AuthorFilterCriteria,
} from '@/lib/analytics/author-utils';
import { formatLargeNumber } from '@/lib/utils/formatters';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
  Activity,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Search,
  Filter,
} from 'lucide-react';

export interface TopAuthorsProps {
  posts: ForumPost[];
  title?: string;
  description?: string;
  className?: string;
  limit?: number;
  showFilters?: boolean;
  showTrends?: boolean;
}

const getTierBadge = (tier: string) => {
  switch (tier) {
    case 'elite':
      return (
        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">Elite</Badge>
      );
    case 'top':
      return <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">Top</Badge>;
    case 'active':
      return <Badge variant="secondary">Active</Badge>;
    default:
      return <Badge variant="outline">Casual</Badge>;
  }
};

const getTrendIcon = (trend: 'rising' | 'stable' | 'declining', value: number) => {
  if (trend === 'rising') {
    return (
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <TrendingUp className="w-4 h-4" />
        <span className="text-xs font-medium">{formatTrend(value)}</span>
      </div>
    );
  } else if (trend === 'declining') {
    return (
      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <TrendingDown className="w-4 h-4" />
        <span className="text-xs font-medium">{formatTrend(value)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Minus className="w-4 h-4" />
      <span className="text-xs">Stable</span>
    </div>
  );
};

const getRankBadge = (rank: number) => {
  if (rank === 1) {
    return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">🥇 #1</Badge>;
  } else if (rank === 2) {
    return <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400">🥈 #2</Badge>;
  } else if (rank === 3) {
    return <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400">🥉 #3</Badge>;
  }
  return <span className="text-sm text-muted-foreground">#{rank}</span>;
};

export function TopAuthors({
  posts,
  title = 'Top Authors',
  description = 'Leading contributors ranked by engagement and activity',
  className = '',
  limit = 20,
  showFilters = true,
  showTrends = true,
}: TopAuthorsProps) {
  const [sortKey, setSortKey] = useState<AuthorSortKey>('totalScore');
  const [sortDesc, setSortDesc] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'metrics'>('leaderboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AuthorFilterCriteria>({
    minPosts: 0,
    platform: undefined,
    source: undefined,
    trend: 'all',
  });

  // Calculate enhanced author stats
  const allAuthorStats = useMemo(() => {
    return calculateEnhancedAuthorStats(posts);
  }, [posts]);

  // Apply filters
  const filteredStats = useMemo(() => {
    return filterAuthorStats(allAuthorStats, {
      ...filters,
      search: searchQuery,
    });
  }, [allAuthorStats, filters, searchQuery]);

  // Sort and limit results
  const displayStats = useMemo(() => {
    const sorted = sortAuthorStats(filteredStats, sortKey, sortDesc);
    return sorted.slice(0, limit);
  }, [filteredStats, sortKey, sortDesc, limit]);

  // Get unique platforms and sources for filters
  const platforms = useMemo(() => {
    return [...new Set(posts.map((p) => p.platform))];
  }, [posts]);

  // Handle sorting
  const handleSort = (key: AuthorSortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  // Mobile card view for small screens
  const MobileAuthorCard = ({ stat }: { stat: EnhancedAuthorStats }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {getRankBadge(stat.rank)}
            <span className="font-semibold">{stat.author}</span>
          </div>
          {getTierBadge(getAuthorTier(stat))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <span className="text-muted-foreground">Posts:</span>
            <span className="ml-1 font-medium">{stat.postCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Score:</span>
            <span className="ml-1 font-medium">{formatLargeNumber(stat.avgScore)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Score:</span>
            <span className="ml-1 font-medium">{formatLargeNumber(stat.totalScore)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Comments:</span>
            <span className="ml-1 font-medium">{formatLargeNumber(stat.totalComments)}</span>
          </div>
        </div>

        {showTrends && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="w-3 h-3" />
              {stat.recentActivity} recent posts
            </div>
            {getTrendIcon(stat.trend, stat.trendValue)}
          </div>
        )}

        {stat.topPost && (
          <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
            <div className="font-medium mb-1 line-clamp-2">{stat.topPost.title}</div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Score: {formatLargeNumber(stat.topPost.score)}
              </span>
              {stat.topPost.url && (
                <a
                  href={stat.topPost.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline" className="hidden sm:flex items-center gap-1">
            <User className="w-3 h-3" />
            {allAuthorStats.length} authors
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        {showFilters && (
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search authors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={filters.platform || 'all'}
                onValueChange={(v) =>
                  setFilters((prev) => ({
                    ...prev,
                    platform: v === 'all' ? undefined : v,
                  }))
                }
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Platform" />
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

              {showTrends && (
                <Select
                  value={filters.trend || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      trend: v as AuthorFilterCriteria['trend'],
                    }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Trend" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trends</SelectItem>
                    <SelectItem value="rising">Rising</SelectItem>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="declining">Declining</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={filters.minPosts?.toString() || '0'}
                onValueChange={(v) =>
                  setFilters((prev) => ({
                    ...prev,
                    minPosts: parseInt(v),
                  }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Authors</SelectItem>
                  <SelectItem value="5">5+ Posts</SelectItem>
                  <SelectItem value="10">10+ Posts</SelectItem>
                  <SelectItem value="20">20+ Posts</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Showing {displayStats.length} of {filteredStats.length} authors
              </span>
            </div>
          </div>
        )}

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="leaderboard" className="flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              Metrics
            </TabsTrigger>
          </TabsList>

          {/* Leaderboard View */}
          <TabsContent value="leaderboard">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('author')}
                          className="p-0 h-auto font-medium hover:bg-transparent"
                        >
                          Author
                          {sortKey === 'author' &&
                            (sortDesc ? (
                              <ChevronDown className="ml-1 w-3 h-3" />
                            ) : (
                              <ChevronUp className="ml-1 w-3 h-3" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('postCount')}
                          className="p-0 h-auto font-medium hover:bg-transparent"
                        >
                          Posts
                          {sortKey === 'postCount' &&
                            (sortDesc ? (
                              <ChevronDown className="ml-1 w-3 h-3" />
                            ) : (
                              <ChevronUp className="ml-1 w-3 h-3" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('avgScore')}
                          className="p-0 h-auto font-medium hover:bg-transparent"
                        >
                          Avg Score
                          {sortKey === 'avgScore' &&
                            (sortDesc ? (
                              <ChevronDown className="ml-1 w-3 h-3" />
                            ) : (
                              <ChevronUp className="ml-1 w-3 h-3" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('totalScore')}
                          className="p-0 h-auto font-medium hover:bg-transparent"
                        >
                          Total Score
                          {sortKey === 'totalScore' &&
                            (sortDesc ? (
                              <ChevronDown className="ml-1 w-3 h-3" />
                            ) : (
                              <ChevronUp className="ml-1 w-3 h-3" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('avgEngagement')}
                          className="p-0 h-auto font-medium hover:bg-transparent"
                        >
                          Engagement
                          {sortKey === 'avgEngagement' &&
                            (sortDesc ? (
                              <ChevronDown className="ml-1 w-3 h-3" />
                            ) : (
                              <ChevronUp className="ml-1 w-3 h-3" />
                            ))}
                        </Button>
                      </TableHead>
                      {showTrends && (
                        <TableHead className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('trend')}
                            className="p-0 h-auto font-medium hover:bg-transparent"
                          >
                            Trend
                            {sortKey === 'trend' &&
                              (sortDesc ? (
                                <ChevronDown className="ml-1 w-3 h-3" />
                              ) : (
                                <ChevronUp className="ml-1 w-3 h-3" />
                              ))}
                          </Button>
                        </TableHead>
                      )}
                      <TableHead>Top Post</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayStats.map((stat) => (
                      <TableRow key={stat.author}>
                        <TableCell>{getRankBadge(stat.rank)}</TableCell>
                        <TableCell className="font-medium">{stat.author}</TableCell>
                        <TableCell>{getTierBadge(getAuthorTier(stat))}</TableCell>
                        <TableCell className="text-right">{stat.postCount}</TableCell>
                        <TableCell className="text-right">
                          {formatLargeNumber(stat.avgScore)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatLargeNumber(stat.totalScore)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatLargeNumber(stat.avgEngagement)}
                        </TableCell>
                        {showTrends && (
                          <TableCell className="text-center">
                            {getTrendIcon(stat.trend, stat.trendValue)}
                          </TableCell>
                        )}
                        <TableCell>
                          {stat.topPost && (
                            <div className="max-w-xs">
                              <div className="text-sm line-clamp-1">{stat.topPost.title}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Score: {formatLargeNumber(stat.topPost.score)}</span>
                                {stat.topPost.url && (
                                  <a
                                    href={stat.topPost.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {displayStats.map((stat) => (
                <MobileAuthorCard key={stat.author} stat={stat} />
              ))}
            </div>
          </TabsContent>

          {/* Metrics View */}
          <TabsContent value="metrics">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayStats.slice(0, 9).map((stat) => (
                <Card key={stat.author}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getRankBadge(stat.rank)}
                        <span className="font-semibold text-sm">{stat.author}</span>
                      </div>
                      {getTierBadge(getAuthorTier(stat))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Posts</span>
                        <span className="font-medium">{stat.postCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Score</span>
                        <span className="font-medium">{formatLargeNumber(stat.avgScore)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Engagement</span>
                        <span className="font-medium">{formatLargeNumber(stat.avgEngagement)}</span>
                      </div>
                      {showTrends && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Trend</span>
                          {getTrendIcon(stat.trend, stat.trendValue)}
                        </div>
                      )}
                    </div>

                    {stat.platforms.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {stat.platforms.map((platform) => (
                          <Badge key={platform} variant="outline" className="text-xs">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
