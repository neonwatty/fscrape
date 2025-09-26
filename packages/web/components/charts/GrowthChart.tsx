'use client';

import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceArea,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ForumPost } from '@/lib/db/types';
import {
  calculateGrowthTrends,
  calculatePlatformAdoption,
  calculateSourceActivity,
  calculateGrowthSummary,
  formatGrowthRate,
  getGrowthTrendEmoji,
  type TimeGranularity,
  type GrowthSummary,
} from '@/lib/analytics/growth-utils';
import { formatLargeNumber } from '@/lib/utils/formatters';
import { TrendingUp, Activity, BarChart3, Layers, ZoomOut } from 'lucide-react';

export interface GrowthChartProps {
  posts: ForumPost[];
  title?: string;
  description?: string;
  className?: string;
  height?: number;
  showFilters?: boolean;
  showSummary?: boolean;
  defaultGranularity?: TimeGranularity;
}

interface ZoomState {
  refAreaLeft: string | null;
  refAreaRight: string | null;
  left: string | null;
  right: string | null;
  animation: boolean;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; fill?: string; name: string; value: number | string }>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color || entry.fill }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {typeof entry.value === 'number' ? formatLargeNumber(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function GrowthChart({
  posts,
  title = 'Growth Trends',
  description = 'Track posting volume growth and platform adoption over time',
  className = '',
  height = 400,
  showFilters = true,
  showSummary = true,
  defaultGranularity = 'day',
}: GrowthChartProps) {
  const [activeTab, setActiveTab] = useState<'volume' | 'platforms' | 'sources'>('volume');
  const [granularity, setGranularity] = useState<TimeGranularity>(defaultGranularity);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [zoomState, setZoomState] = useState<ZoomState>({
    refAreaLeft: null,
    refAreaRight: null,
    left: null,
    right: null,
    animation: true,
  });

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    if (dateRange === 'all') return { startDate: undefined, endDate: undefined };

    const end = new Date();
    const start = new Date();

    switch (dateRange) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
    }

    return { startDate: start, endDate: end };
  }, [dateRange]);

  // Calculate growth trends
  const growthData = useMemo(() => {
    return calculateGrowthTrends(posts, granularity, startDate, endDate);
  }, [posts, granularity, startDate, endDate]);

  // Calculate platform adoption
  const platformData = useMemo(() => {
    return calculatePlatformAdoption(posts, granularity);
  }, [posts, granularity]);

  // Calculate source activity
  const sourceData = useMemo(() => {
    return calculateSourceActivity(posts, granularity, 5);
  }, [posts, granularity]);

  // Calculate growth summary
  const summary: GrowthSummary = useMemo(() => {
    return calculateGrowthSummary(growthData);
  }, [growthData]);

  // Get unique platforms for line chart
  const platforms = useMemo(() => {
    const platformSet = new Set<string>();
    posts.forEach((post) => platformSet.add(post.platform));
    return Array.from(platformSet);
  }, [posts]);

  // Platform colors
  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      reddit: '#FF4500',
      hackernews: '#FF6600',
      default: '#8884d8',
    };
    return colors[platform.toLowerCase()] || colors.default;
  };

  // Handle zoom
  const handleMouseDown = (e: { activeLabel?: string }) => {
    if (!e) return;
    const { activeLabel } = e;
    if (activeLabel) {
      setZoomState({
        ...zoomState,
        refAreaLeft: activeLabel,
        refAreaRight: activeLabel,
      });
    }
  };

  const handleMouseMove = (e: { activeLabel?: string }) => {
    if (!e || !zoomState.refAreaLeft) return;
    const { activeLabel } = e;
    if (activeLabel) {
      setZoomState({
        ...zoomState,
        refAreaRight: activeLabel,
      });
    }
  };

  const handleMouseUp = () => {
    if (!zoomState.refAreaLeft || !zoomState.refAreaRight) return;

    let left = zoomState.refAreaLeft;
    let right = zoomState.refAreaRight;

    if (left === right || !left || !right) {
      setZoomState({
        ...zoomState,
        refAreaLeft: null,
        refAreaRight: null,
      });
      return;
    }

    // Swap if needed
    if (left > right) {
      [left, right] = [right, left];
    }

    setZoomState({
      refAreaLeft: null,
      refAreaRight: null,
      left,
      right,
      animation: false,
    });
  };

  const handleZoomOut = () => {
    setZoomState({
      refAreaLeft: null,
      refAreaRight: null,
      left: null,
      right: null,
      animation: true,
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {showSummary && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {formatLargeNumber(summary.totalPosts)} posts
              </Badge>
              <Badge
                variant={summary.growthRate > 0 ? 'default' : 'secondary'}
                className="flex items-center gap-1"
              >
                {getGrowthTrendEmoji(summary.trend)}
                {formatGrowthRate(summary.growthRate)}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Select value={granularity} onValueChange={(v) => setGranularity(v as TimeGranularity)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hourly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            {zoomState.left && zoomState.right && (
              <Button
                onClick={handleZoomOut}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
              >
                <ZoomOut className="w-4 h-4" />
                Reset Zoom
              </Button>
            )}
          </div>
        )}

        {/* Summary Stats */}
        {showSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Daily Average</div>
              <div className="font-semibold">{formatLargeNumber(summary.averageDailyPosts)}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Peak Day</div>
              <div className="font-semibold text-sm">{summary.peakDay}</div>
              <div className="text-xs text-muted-foreground">{summary.peakVolume} posts</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Growth Trend</div>
              <div className="font-semibold flex items-center gap-1">
                {getGrowthTrendEmoji(summary.trend)}
                <span className="capitalize">{summary.trend}</span>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
              <div className="font-semibold">{formatLargeNumber(summary.totalPosts)}</div>
            </div>
          </div>
        )}

        {/* Chart Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="volume" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              Volume Growth
            </TabsTrigger>
            <TabsTrigger value="platforms" className="flex items-center gap-1">
              <Layers className="w-4 h-4" />
              Platform Adoption
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              Source Activity
            </TabsTrigger>
          </TabsList>

          {/* Volume Growth Chart */}
          <TabsContent value="volume">
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart
                data={growthData}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  domain={[zoomState.left || 'dataMin', zoomState.right || 'dataMax']}
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (granularity === 'hour') return `${date.getHours()}:00`;
                    if (granularity === 'month')
                      return date.toLocaleDateString('en', { month: 'short' });
                    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis
                  yAxisId="left"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => formatLargeNumber(value)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => formatLargeNumber(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="postVolume"
                  name="Post Volume"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#volumeGradient)"
                  animationDuration={zoomState.animation ? 300 : 0}
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cumulativeVolume"
                  name="Cumulative"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                  animationDuration={zoomState.animation ? 300 : 0}
                />

                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="engagementVolume"
                  name="Engagement"
                  stroke="#10b981"
                  strokeWidth={1}
                  fill="url(#engagementGradient)"
                  opacity={0.5}
                  animationDuration={zoomState.animation ? 300 : 0}
                />

                {/* Zoom selection area */}
                {zoomState.refAreaLeft && zoomState.refAreaRight && (
                  <ReferenceArea
                    x1={zoomState.refAreaLeft}
                    x2={zoomState.refAreaRight}
                    strokeOpacity={0.3}
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                )}

                <Brush
                  dataKey="date"
                  height={30}
                  stroke="#3b82f6"
                  fill="#f0f0f0"
                  fillOpacity={0.2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Platform Adoption Chart */}
          <TabsContent value="platforms">
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={platformData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  {platforms.map((platform) => (
                    <linearGradient
                      key={platform}
                      id={`gradient-${platform}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={getPlatformColor(platform)} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={getPlatformColor(platform)} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (granularity === 'month')
                      return date.toLocaleDateString('en', { month: 'short' });
                    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => formatLargeNumber(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {platforms.map((platform) => (
                  <Area
                    key={platform}
                    type="monotone"
                    dataKey={platform}
                    name={platform}
                    stackId="1"
                    stroke={getPlatformColor(platform)}
                    fill={`url(#gradient-${platform})`}
                  />
                ))}

                <Brush
                  dataKey="date"
                  height={30}
                  stroke="#3b82f6"
                  fill="#f0f0f0"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Source Activity Chart */}
          <TabsContent value="sources">
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={sourceData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (granularity === 'month')
                      return date.toLocaleDateString('en', { month: 'short' });
                    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis className="text-xs" tick={{ fill: 'currentColor', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const data = payload[0].payload;

                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-3">
                        <p className="font-medium text-sm mb-2">{label}</p>
                        <p className="text-sm mb-2">
                          Top Source: <span className="font-medium">{data.topSource}</span>
                        </p>
                        {data.sources.slice(0, 5).map((source: any, i: number) => (
                          <div key={i} className="text-xs flex justify-between gap-4">
                            <span className="text-muted-foreground">{source.name}:</span>
                            <span className="font-medium">{source.count} posts</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />

                {/* Show lines for top 3 sources */}
                {sourceData.length > 0 &&
                  (() => {
                    const topSources = new Set<string>();
                    sourceData.forEach((d) => {
                      d.sources.slice(0, 3).forEach((s) => topSources.add(s.name));
                    });
                    const sourceList = Array.from(topSources).slice(0, 5);
                    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

                    return sourceList.map((source, i) => (
                      <Line
                        key={source}
                        type="monotone"
                        dataKey={(d: { sources: Array<{ name: string; count: number }> }) => {
                          const sourceData = d.sources.find((s) => s.name === source);
                          return sourceData?.count || 0;
                        }}
                        name={source}
                        stroke={colors[i]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ));
                  })()}

                <Brush
                  dataKey="date"
                  height={30}
                  stroke="#3b82f6"
                  fill="#f0f0f0"
                  fillOpacity={0.2}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
