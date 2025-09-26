'use client';

import React, { useState, useMemo } from 'react';
import {
  Scatter,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ComposedChart,
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
  calculateEngagementMetrics,
  generateTrendLine,
  formatCorrelation,
  getEngagementLevel,
} from '@/lib/utils/analytics';
import { formatLargeNumber } from '@/lib/utils/formatters';
import {
  TrendingUp,
  MessageSquare,
  Activity,
  Clock,
  ScatterChart as ScatterIcon,
} from 'lucide-react';

export interface EngagementChartProps {
  posts: ForumPost[];
  title?: string;
  description?: string;
  className?: string;
  height?: number;
  showFilters?: boolean;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      title?: string;
      comments?: number;
      [key: string]: unknown;
    };
    color?: string;
    fill?: string;
    name: string;
    value: number | string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      {data.title && <p className="font-medium text-sm mb-1 max-w-xs truncate">{data.title}</p>}
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
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
      {data.comments !== undefined && (
        <div className="flex items-center gap-2 text-sm mt-1">
          <MessageSquare className="w-3 h-3" />
          <span className="text-muted-foreground">Comments:</span>
          <span className="font-medium">{formatLargeNumber(data.comments)}</span>
        </div>
      )}
    </div>
  );
};

export function EngagementChart({
  posts,
  title = 'Engagement Patterns Analysis',
  description = 'Analyze correlations between posting time, scores, and comments',
  className = '',
  height = 400,
  showFilters = true,
}: EngagementChartProps) {
  const [activeTab, setActiveTab] = useState('scatter');
  const [scatterMetric, setScatterMetric] = useState<'score' | 'comments'>('score');
  const [showTrendLine, setShowTrendLine] = useState(true);
  const [timeRange, setTimeRange] = useState<'all' | 'morning' | 'afternoon' | 'evening' | 'night'>(
    'all'
  );

  // Filter posts by time range
  const filteredPosts = useMemo(() => {
    if (timeRange === 'all') return posts;

    return posts.filter((post) => {
      const hour = new Date(post.created_utc * 1000).getHours();
      switch (timeRange) {
        case 'morning':
          return hour >= 5 && hour < 12;
        case 'afternoon':
          return hour >= 12 && hour < 17;
        case 'evening':
          return hour >= 17 && hour < 21;
        case 'night':
          return hour >= 21 || hour < 5;
        default:
          return true;
      }
    });
  }, [posts, timeRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    return calculateEngagementMetrics(filteredPosts);
  }, [filteredPosts]);

  // Generate trend line data
  const trendLineData = useMemo(() => {
    if (!showTrendLine || metrics.scoreData.length < 2) return [];

    const xValues = metrics.scoreData.map((d) => d.x);
    const yValues =
      scatterMetric === 'score'
        ? metrics.scoreData.map((d) => d.y)
        : metrics.scoreData.map((d) => d.comments);

    return generateTrendLine(xValues, yValues, 0, 24);
  }, [metrics.scoreData, scatterMetric, showTrendLine]);

  // Get color based on engagement level
  const getScatterColor = (score: number, comments: number) => {
    const level = getEngagementLevel(score, comments);
    switch (level) {
      case 'viral':
        return '#ef4444';
      case 'high':
        return '#f59e0b';
      case 'medium':
        return '#3b82f6';
      default:
        return '#94a3b8';
    }
  };

  // Get bar color based on value
  const getBarColor = (value: number, max: number) => {
    const ratio = value / max;
    if (ratio > 0.75) return '#10b981';
    if (ratio > 0.5) return '#3b82f6';
    if (ratio > 0.25) return '#f59e0b';
    return '#94a3b8';
  };

  const maxComments = Math.max(...metrics.commentPatternData.map((d) => d.comments));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {/* Statistics badges */}
            <div className="flex gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {metrics.statistics.totalPosts} posts
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Peak: {metrics.statistics.peakHour}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-4 mb-4">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Day</SelectItem>
                <SelectItem value="morning">Morning (5-12)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12-17)</SelectItem>
                <SelectItem value="evening">Evening (17-21)</SelectItem>
                <SelectItem value="night">Night (21-5)</SelectItem>
              </SelectContent>
            </Select>

            {activeTab === 'scatter' && (
              <>
                <Select
                  value={scatterMetric}
                  onValueChange={(v) => setScatterMetric(v as typeof scatterMetric)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Score vs Time</SelectItem>
                    <SelectItem value="comments">Comments vs Time</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant={showTrendLine ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowTrendLine(!showTrendLine)}
                >
                  Trend Line
                </Button>
              </>
            )}
          </div>
        )}

        {/* Correlation badges */}
        <div className="flex gap-4 mb-4">
          <Badge variant="secondary" className="py-1">
            Score/Time: {formatCorrelation(metrics.correlations.scoreTime)}
          </Badge>
          <Badge variant="secondary" className="py-1">
            Score/Comments: {formatCorrelation(metrics.correlations.scoreComment)}
          </Badge>
          <Badge variant="secondary" className="py-1">
            Avg Score: {formatLargeNumber(metrics.statistics.avgScore)}
          </Badge>
          <Badge variant="secondary" className="py-1">
            Avg Comments: {formatLargeNumber(metrics.statistics.avgComments)}
          </Badge>
        </div>

        {/* Chart tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="scatter" className="flex items-center gap-1">
              <ScatterIcon className="w-4 h-4" />
              Scatter Plot
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              Comment Patterns
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Engagement Trends
            </TabsTrigger>
          </TabsList>

          {/* Scatter Chart */}
          <TabsContent value="scatter">
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 24]}
                  ticks={[0, 4, 8, 12, 16, 20, 24]}
                  tickFormatter={(value) => `${value}:00`}
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => formatLargeNumber(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Scatter points */}
                <Scatter
                  name={scatterMetric === 'score' ? 'Post Score' : 'Post Comments'}
                  data={metrics.scoreData.map((d) => ({
                    ...d,
                    y: scatterMetric === 'score' ? d.y : d.comments,
                  }))}
                  fill="#8884d8"
                >
                  {metrics.scoreData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getScatterColor(entry.y, entry.comments)}
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>

                {/* Trend line */}
                {showTrendLine && trendLineData.length > 0 && (
                  <Line
                    type="linear"
                    data={trendLineData}
                    dataKey="y"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Trend"
                    opacity={0.7}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Comment Patterns Bar Chart */}
          <TabsContent value="comments">
            <ResponsiveContainer width="100%" height={height}>
              <BarChart
                data={metrics.commentPatternData}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis
                  dataKey="hour"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  interval={2}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => formatLargeNumber(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="comments" name="Total Comments" fill="#8884d8">
                  {metrics.commentPatternData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.comments, maxComments)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Engagement Trends Line Chart */}
          <TabsContent value="trends">
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart
                data={metrics.engagementTrendData}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis
                  dataKey="hour"
                  className="text-xs"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  interval={2}
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
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                <Bar
                  yAxisId="right"
                  dataKey="posts"
                  name="Post Count"
                  fill="#94a3b8"
                  opacity={0.3}
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgEngagement"
                  name="Avg Engagement"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />

                {/* Add reference line for average */}
                <ReferenceLine
                  yAxisId="left"
                  y={metrics.statistics.avgScore + metrics.statistics.avgComments * 2}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label="Overall Avg"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
