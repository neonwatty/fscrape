'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  generateEngagementHeatmap,
  generateFourWeekHeatmap,
  getOptimalPostingTimes,
  getHeatmapColor,
  getHeatmapCellLabel,
  type EngagementHeatmapData,
  type HeatmapFilters,
} from '@/lib/analytics/heatmap-utils';
import { ForumPost } from '@/lib/db/types';
import { cn } from '@/lib/utils';
import { Activity, TrendingUp, MessageSquare, Users, Clock, ChevronRight } from 'lucide-react';

interface HeatMapProps {
  posts: ForumPost[];
  title?: string;
  description?: string;
  className?: string;
  showFilters?: boolean;
  showOptimalTimes?: boolean;
  defaultMetric?: HeatmapFilters['metric'];
}

export function HeatMap({
  posts,
  title = 'Engagement Heatmap',
  description = 'Discover optimal posting times based on engagement metrics',
  className,
  showFilters = true,
  showOptimalTimes = true,
  defaultMetric = 'avgEngagement',
}: HeatMapProps) {
  const [filters, setFilters] = useState<HeatmapFilters>({
    platform: 'all',
    metric: defaultMetric,
    minPosts: 0,
  });
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedCell, setSelectedCell] = useState<EngagementHeatmapData | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Generate heatmap data
  const heatmapData = useMemo(() => {
    if (viewMode === 'month') {
      return generateFourWeekHeatmap(posts, {
        ...filters,
        source: sourceFilter || undefined,
      });
    }
    return generateEngagementHeatmap(posts, {
      ...filters,
      source: sourceFilter || undefined,
    });
  }, [posts, filters, sourceFilter, viewMode]);

  // Get optimal posting times
  const optimalTimes = useMemo(() => {
    if (!showOptimalTimes || heatmapData.length === 0) return [];
    return getOptimalPostingTimes(heatmapData, filters.metric, 5);
  }, [heatmapData, filters.metric, showOptimalTimes]);

  // Calculate max values for color scaling
  const maxValues = useMemo(() => {
    return {
      posts: Math.max(...heatmapData.map((d) => d.posts), 1),
      avgScore: Math.max(...heatmapData.map((d) => d.avgScore), 1),
      avgComments: Math.max(...heatmapData.map((d) => d.avgComments), 1),
      avgEngagement: Math.max(...heatmapData.map((d) => d.avgEngagement), 1),
    };
  }, [heatmapData]);

  // Get unique sources for filtering
  const sources = useMemo(() => {
    const sourceSet = new Set<string>();
    posts.forEach((post) => {
      const source = post.source || post.subreddit || '';
      if (source) sourceSet.add(source);
    });
    return Array.from(sourceSet).sort();
  }, [posts]);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Create array of all 24 hours explicitly
  const hourLabels = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  ];

  // Get data for specific cell
  const getCellData = (day: number, hour: number, week?: number) => {
    if (week !== undefined) {
      return heatmapData.find((d) => d.week === week && d.day === day && d.hour === hour);
    }
    return heatmapData.find((d) => d.day === day && d.hour === hour);
  };

  // Format hour label
  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  };

  // Get metric icon
  const getMetricIcon = (metric: HeatmapFilters['metric']) => {
    switch (metric) {
      case 'posts':
        return <Activity className="h-4 w-4" />;
      case 'avgScore':
        return <TrendingUp className="h-4 w-4" />;
      case 'avgComments':
        return <MessageSquare className="h-4 w-4" />;
      case 'avgEngagement':
        return <Users className="h-4 w-4" />;
    }
  };

  return (
    <Card className={cn(className, 'overflow-hidden')}>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'month')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week View</SelectItem>
                  <SelectItem value="month">4 Weeks</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.platform || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, platform: value as HeatmapFilters['platform'] }))
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="hackernews">Hacker News</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.metric || 'avgEngagement'}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, metric: value as HeatmapFilters['metric'] }))
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avgEngagement">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Engagement
                    </div>
                  </SelectItem>
                  <SelectItem value="posts">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3" />
                      Post Count
                    </div>
                  </SelectItem>
                  <SelectItem value="avgScore">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" />
                      Avg Upvotes
                    </div>
                  </SelectItem>
                  <SelectItem value="avgComments">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3" />
                      Avg Comments
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {sources.length > 0 && (
                <Input
                  placeholder="Filter by source..."
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-[180px]"
                />
              )}

              <Select
                value={String(filters.minPosts || 0)}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, minPosts: parseInt(value) }))
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Min posts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All cells</SelectItem>
                  <SelectItem value="1">≥1 post</SelectItem>
                  <SelectItem value="5">≥5 posts</SelectItem>
                  <SelectItem value="10">≥10 posts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="heatmap" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mx-6 mt-0">
            <TabsTrigger value="heatmap">Heatmap View</TabsTrigger>
            <TabsTrigger value="optimal">Optimal Times</TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap" className="mt-6 px-6 pb-6 overflow-x-auto">
            <div className="inline-block min-w-max">
              {/* Hour labels */}
              <div className="flex gap-1 pl-12">
                {hourLabels.map((hour) => (
                  <div
                    key={hour}
                    className="w-6 h-4 text-xs text-muted-foreground text-center flex-shrink-0"
                  >
                    {hour % 3 === 0 ? formatHour(hour) : ''}
                  </div>
                ))}
              </div>

              {/* Heatmap grid */}
              <TooltipProvider>
                <div className="space-y-1">
                  {viewMode === 'week' ? (
                    // Single week view
                    dayLabels.map((day, dayIndex) => (
                      <div key={day} className="flex gap-1 items-center">
                        <div className="w-12 text-sm font-medium text-muted-foreground text-right flex-shrink-0">
                          {day}
                        </div>
                        <div className="flex gap-1" data-row={`day-${dayIndex}`}>
                          {hourLabels.map((hour) => {
                            const cellData = getCellData(dayIndex, hour);
                            if (!cellData) {
                              return (
                                <div
                                  key={hour}
                                  className="w-6 h-6 rounded-sm bg-muted"
                                  aria-label={`${day} ${formatHour(hour)}: No data`}
                                  data-hour={hour}
                                />
                              );
                            }

                            const value =
                              filters.metric === 'posts'
                                ? cellData.posts
                                : filters.metric === 'avgScore'
                                  ? cellData.avgScore
                                  : filters.metric === 'avgComments'
                                    ? cellData.avgComments
                                    : cellData.avgEngagement;

                            const maxValue = maxValues[filters.metric || 'avgEngagement'];
                            const colorClass = getHeatmapColor(value, maxValue, filters.metric);
                            const label = getHeatmapCellLabel(cellData, filters.metric);

                            return (
                              <Tooltip key={hour}>
                                <TooltipTrigger asChild>
                                  <button
                                    className={cn(
                                      'w-6 h-6 rounded-sm cursor-pointer transition-all hover:scale-110 hover:ring-2 hover:ring-primary/50',
                                      colorClass,
                                      selectedCell === cellData && 'ring-2 ring-primary'
                                    )}
                                    onClick={() => setSelectedCell(cellData)}
                                    aria-label={label}
                                  />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="space-y-2">
                                    <p className="font-semibold">{label}</p>
                                    <div className="text-xs space-y-1">
                                      <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">Posts:</span>
                                        <span className="font-mono">{cellData.posts}</span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">Avg Score:</span>
                                        <span className="font-mono">
                                          {cellData.avgScore.toFixed(0)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">Avg Comments:</span>
                                        <span className="font-mono">
                                          {cellData.avgComments.toFixed(0)}
                                        </span>
                                      </div>
                                    </div>
                                    {cellData.bestPost && (
                                      <div className="pt-2 border-t">
                                        <p className="text-xs text-muted-foreground mb-1">
                                          Best post:
                                        </p>
                                        <p className="text-xs line-clamp-2">
                                          {cellData.bestPost.title}
                                        </p>
                                        <p className="text-xs font-mono mt-1">
                                          Score: {cellData.bestPost.score}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    // 4-week view
                    <div className="space-y-4">
                      {[0, 1, 2, 3].map((weekIndex) => (
                        <div key={weekIndex} className="space-y-1">
                          <div className="text-sm font-semibold text-muted-foreground mb-2">
                            Week {weekIndex + 1}
                          </div>
                          {dayLabels.map((day, dayIndex) => (
                            <div key={`${weekIndex}-${day}`} className="flex gap-1 items-center">
                              <div className="w-12 text-sm font-medium text-muted-foreground text-right flex-shrink-0">
                                {day}
                              </div>
                              <div className="flex gap-1">
                                {hourLabels.map((hour) => {
                                  const cellData = getCellData(dayIndex, hour, weekIndex);
                                  if (!cellData) {
                                    return (
                                      <div
                                        key={hour}
                                        className="w-6 h-6 rounded-sm bg-muted"
                                        aria-label={`Week ${weekIndex + 1}, ${day} ${formatHour(hour)}: No data`}
                                      />
                                    );
                                  }

                                  const value =
                                    filters.metric === 'posts'
                                      ? cellData.posts
                                      : filters.metric === 'avgScore'
                                        ? cellData.avgScore
                                        : filters.metric === 'avgComments'
                                          ? cellData.avgComments
                                          : cellData.avgEngagement;

                                  const maxValue = maxValues[filters.metric || 'avgEngagement'];
                                  const colorClass = getHeatmapColor(
                                    value,
                                    maxValue,
                                    filters.metric
                                  );
                                  const label = getHeatmapCellLabel(cellData, filters.metric);

                                  return (
                                    <Tooltip key={hour}>
                                      <TooltipTrigger asChild>
                                        <button
                                          className={cn(
                                            'w-6 h-6 rounded-sm cursor-pointer transition-all hover:scale-110 hover:ring-2 hover:ring-primary/50',
                                            colorClass,
                                            selectedCell === cellData && 'ring-2 ring-primary'
                                          )}
                                          onClick={() => setSelectedCell(cellData)}
                                          aria-label={label}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="space-y-2">
                                          <p className="font-semibold">{label}</p>
                                          <div className="text-xs space-y-1">
                                            <div className="flex justify-between gap-4">
                                              <span className="text-muted-foreground">Posts:</span>
                                              <span className="font-mono">{cellData.posts}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                              <span className="text-muted-foreground">
                                                Avg Score:
                                              </span>
                                              <span className="font-mono">
                                                {cellData.avgScore.toFixed(0)}
                                              </span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                              <span className="text-muted-foreground">
                                                Avg Comments:
                                              </span>
                                              <span className="font-mono">
                                                {cellData.avgComments.toFixed(0)}
                                              </span>
                                            </div>
                                          </div>
                                          {cellData.bestPost && (
                                            <div className="pt-2 border-t">
                                              <p className="text-xs text-muted-foreground mb-1">
                                                Best post:
                                              </p>
                                              <p className="text-xs line-clamp-2">
                                                {cellData.bestPost.title}
                                              </p>
                                              <p className="text-xs font-mono mt-1">
                                                Score: {cellData.bestPost.score}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TooltipProvider>

              {/* Legend */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">Less</span>
                  <div className="flex gap-1">
                    <div className={cn('w-4 h-4 rounded-sm', 'bg-muted')} />
                    <div
                      className={cn(
                        'w-4 h-4 rounded-sm',
                        filters.metric === 'posts'
                          ? 'bg-blue-200 dark:bg-blue-900'
                          : filters.metric === 'avgComments'
                            ? 'bg-purple-200 dark:bg-purple-900'
                            : 'bg-green-200 dark:bg-green-900'
                      )}
                    />
                    <div
                      className={cn(
                        'w-4 h-4 rounded-sm',
                        filters.metric === 'posts'
                          ? 'bg-blue-300 dark:bg-blue-800'
                          : filters.metric === 'avgComments'
                            ? 'bg-purple-300 dark:bg-purple-800'
                            : 'bg-green-300 dark:bg-green-800'
                      )}
                    />
                    <div
                      className={cn(
                        'w-4 h-4 rounded-sm',
                        filters.metric === 'posts'
                          ? 'bg-blue-400 dark:bg-blue-700'
                          : filters.metric === 'avgComments'
                            ? 'bg-purple-400 dark:bg-purple-700'
                            : 'bg-green-400 dark:bg-green-700'
                      )}
                    />
                    <div
                      className={cn(
                        'w-4 h-4 rounded-sm',
                        filters.metric === 'posts'
                          ? 'bg-blue-500 dark:bg-blue-600'
                          : filters.metric === 'avgComments'
                            ? 'bg-purple-500 dark:bg-purple-600'
                            : 'bg-green-500 dark:bg-green-600'
                      )}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">More</span>
                </div>

                <div className="flex items-center gap-2">
                  {getMetricIcon(filters.metric)}
                  <span className="text-sm font-medium">
                    {filters.metric === 'posts'
                      ? 'Post Count'
                      : filters.metric === 'avgScore'
                        ? 'Average Score'
                        : filters.metric === 'avgComments'
                          ? 'Average Comments'
                          : 'Engagement Score'}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="optimal" className="mt-6 px-6">
            {optimalTimes.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Top {optimalTimes.length} optimal posting times based on{' '}
                  {filters.metric === 'posts'
                    ? 'post volume'
                    : filters.metric === 'avgScore'
                      ? 'average score'
                      : filters.metric === 'avgComments'
                        ? 'average comments'
                        : 'overall engagement'}
                </div>

                {optimalTimes.map((slot, index) => (
                  <div
                    key={`${slot.day}-${slot.hour}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                        <span className="text-sm font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {slot.day} at {slot.hour}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{slot.recommendation}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          slot.performance === 'excellent'
                            ? 'default'
                            : slot.performance === 'good'
                              ? 'secondary'
                              : slot.performance === 'average'
                                ? 'outline'
                                : 'destructive'
                        }
                      >
                        {slot.performance}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${slot.score}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {slot.score.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>💡 Pro tip:</strong> These optimal times are based on historical
                    engagement data. Consider your specific audience and test different posting
                    times to find what works best for your content.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No data available for optimal posting times.</p>
                <p className="text-sm mt-2">Try adjusting your filters or collecting more data.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Selected cell details */}
        {selectedCell && (
          <div className="mt-6 p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">Selected Time Slot</h4>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCell(null)}>
                Clear
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-medium">
                  {dayLabels[selectedCell.day]} {formatHour(selectedCell.hour)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Posts</p>
                <p className="text-sm font-medium">{selectedCell.posts}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className="text-sm font-medium">{selectedCell.avgScore.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Comments</p>
                <p className="text-sm font-medium">{selectedCell.avgComments.toFixed(0)}</p>
              </div>
            </div>
            {selectedCell.bestPost && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Best performing post</p>
                <p className="text-sm line-clamp-2 mb-2">{selectedCell.bestPost.title}</p>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">Score: {selectedCell.bestPost.score}</Badge>
                  {selectedCell.bestPost.url && (
                    <a
                      href={selectedCell.bestPost.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View post <ChevronRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SimpleEngagementHeatmap({
  posts,
  className,
}: {
  posts: ForumPost[];
  className?: string;
}) {
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const heatmapData = useMemo(
    () => generateEngagementHeatmap(posts, { metric: 'avgEngagement' }),
    [posts]
  );

  const maxEngagement = Math.max(...heatmapData.map((d) => d.avgEngagement), 1);

  const getCellData = (day: number, hour: number) => {
    return heatmapData.find((d) => d.day === day && d.hour === hour);
  };

  const getColorClass = (engagement: number) => {
    if (engagement === 0) return 'bg-muted';
    const intensity = (engagement / maxEngagement) * 100;

    if (intensity <= 25) return 'bg-emerald-200 dark:bg-emerald-900';
    if (intensity <= 50) return 'bg-emerald-400 dark:bg-emerald-700';
    if (intensity <= 75) return 'bg-emerald-500 dark:bg-emerald-600';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  return (
    <div className={cn('space-y-1', className)}>
      <TooltipProvider>
        {dayLabels.map((day, dayIndex) => (
          <div key={day} className="flex gap-0.5 items-center">
            <div className="w-4 text-xs text-muted-foreground">{day}</div>
            <div className="flex gap-0.5">
              {Array.from({ length: 24 }, (_, hour) => {
                const cellData = getCellData(dayIndex, hour);
                const engagement = cellData?.avgEngagement || 0;
                const label = cellData
                  ? `${cellData.posts} posts, ${engagement.toFixed(0)} engagement`
                  : 'No data';

                return (
                  <Tooltip key={hour}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn('w-2 h-2 rounded-sm', getColorClass(engagement))}
                        aria-label={label}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </TooltipProvider>
    </div>
  );
}
