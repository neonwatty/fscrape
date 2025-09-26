'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  TrendData,
  PlatformMetrics,
  AuthorMetrics,
  TimeSeriesDataPoint,
} from '@/lib/analytics/analytics-utils';
import { formatLargeNumber } from '@/lib/utils/formatters';

// Color palette
const COLORS = {
  reddit: '#FF4500',
  hackernews: '#FF6600',
  primary: 'hsl(var(--primary))',
  chart1: '#8884d8',
  chart2: '#82ca9d',
  chart3: '#ffc658',
  chart4: '#ff7c7c',
  chart5: '#8dd1e1',
};

interface TrendComparisonChartProps {
  data: TrendData[];
  title?: string;
  description?: string;
  className?: string;
}

export function TrendComparisonChart({
  data,
  title = 'Platform Trends',
  description = 'Posts over time by platform',
  className,
}: TrendComparisonChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => formatLargeNumber(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="reddit"
              stackId="1"
              stroke={COLORS.reddit}
              fill={COLORS.reddit}
              fillOpacity={0.6}
              name="Reddit"
            />
            <Area
              type="monotone"
              dataKey="hackernews"
              stackId="1"
              stroke={COLORS.hackernews}
              fill={COLORS.hackernews}
              fillOpacity={0.6}
              name="Hacker News"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface EngagementTrendChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  description?: string;
  className?: string;
}

export function EngagementTrendChart({
  data,
  title = 'Engagement Trends',
  description = 'Score and comments over time',
  className,
}: EngagementTrendChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => formatLargeNumber(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => formatLargeNumber(value)}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="score"
              stroke={COLORS.chart1}
              strokeWidth={2}
              dot={false}
              name="Total Score"
            />
            <Line
              type="monotone"
              dataKey="comments"
              stroke={COLORS.chart2}
              strokeWidth={2}
              dot={false}
              name="Total Comments"
            />
            <Line
              type="monotone"
              dataKey="posts"
              stroke={COLORS.chart3}
              strokeWidth={2}
              dot={false}
              name="Posts Count"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface PlatformDistributionChartProps {
  data: PlatformMetrics[];
  title?: string;
  description?: string;
  className?: string;
}

export function PlatformDistributionChart({
  data,
  title = 'Platform Distribution',
  description = 'Posts by platform',
  className,
}: PlatformDistributionChartProps) {
  const pieData = data.map((d) => ({
    name: d.platform,
    value: d.posts,
    percentage: d.percentage,
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { name: string; value: number; percentage: number } }>;
  }) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-2 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm">{data.value} posts</p>
          <p className="text-sm text-muted-foreground">{data.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.percentage?.toFixed(0) || 0}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.name === 'reddit' ? COLORS.reddit : COLORS.hackernews}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4">
          {data.map((platform) => (
            <div key={platform.platform} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    platform.platform === 'reddit' ? COLORS.reddit : COLORS.hackernews,
                }}
              />
              <span className="text-sm capitalize">{platform.platform}</span>
              <span className="text-sm text-muted-foreground">
                ({platform.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface TopAuthorsChartProps {
  data: AuthorMetrics[];
  title?: string;
  description?: string;
  className?: string;
}

export function TopAuthorsChart({
  data,
  title = 'Top Authors',
  description = 'Most active contributors',
  className,
}: TopAuthorsChartProps) {
  const chartData = data.slice(0, 10).map((author) => ({
    name: author.author.length > 15 ? author.author.substring(0, 15) + '...' : author.author,
    posts: author.posts,
    score: author.totalScore,
    avgScore: author.avgScore,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => formatLargeNumber(value)}
            />
            <YAxis
              dataKey="name"
              type="category"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [
                formatLargeNumber(value),
                name === 'score' ? 'Total Score' : 'Posts',
              ]}
            />
            <Legend />
            <Bar dataKey="score" fill={COLORS.chart1} name="Total Score" />
            <Bar dataKey="posts" fill={COLORS.chart2} name="Posts" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface MiniTrendChartProps {
  data: TimeSeriesDataPoint[];
  dataKey: 'posts' | 'score' | 'comments' | 'avgEngagement';
  color?: string;
  className?: string;
}

export function MiniTrendChart({
  data,
  dataKey,
  color = COLORS.primary,
  className,
}: MiniTrendChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={60}>
        <AreaChart data={data}>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
