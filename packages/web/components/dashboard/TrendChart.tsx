'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useDatabase } from '@/lib/db/database-context';
import { getPostsTimeSeries, getPostsByHour, getPlatformStats, getPosts } from '@/lib/db/queries';
import { Calendar, Clock, TrendingUp, BarChart3, Activity } from 'lucide-react';
import { formatLargeNumber } from '@/lib/utils/formatters';

interface ChartDataPoint {
  date: string;
  fullDate: string;
  posts: number;
  avgScore: number;
  avgComments: number;
  value: number; // Added for TimeSeriesChart compatibility
  [key: string]: string | number; // Index signature for TimeSeriesDataPoint compatibility
}

interface HourlyDataPoint {
  hour: string;
  hourNum: number;
  posts: number;
  avgScore: number;
}

interface PlatformData {
  reddit: ChartDataPoint[];
  hackernews: ChartDataPoint[];
  all: ChartDataPoint[];
}

export function TrendChart() {
  const { isInitialized } = useDatabase();
  const [timeSeriesData, setTimeSeriesData] = useState<PlatformData>({
    reddit: [],
    hackernews: [],
    all: [],
  });
  const [hourlyData, setHourlyData] = useState<HourlyDataPoint[]>([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'reddit' | 'hackernews'>('all');
  const [timeRange, setTimeRange] = useState<7 | 14 | 30 | 60>(30);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [_loading, setLoading] = useState(false);
  const [_zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null);

  // Fetch data based on filters
  const fetchData = useCallback(() => {
    if (!isInitialized) return;

    setLoading(true);
    try {
      // Get available platforms
      const platformStats = getPlatformStats();
      const availablePlatforms = platformStats.map((p) => p.platform.toLowerCase());
      setPlatforms(availablePlatforms);

      // Get time series data for all platforms
      const tsData = getPostsTimeSeries(timeRange);

      // Process data for each platform
      const platformTimeSeriesData: PlatformData = {
        all: [],
        reddit: [],
        hackernews: [],
      };

      // Get data for each platform separately
      const allDates = new Set<string>();

      // Fetch platform-specific data
      availablePlatforms.forEach((platform) => {
        const platformPosts = getPosts({
          platform,
          dateFrom: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000),
          limit: 10000,
        });

        // Group by date
        const dateGroups = platformPosts.reduce(
          (acc, post) => {
            const date = new Date(post.created_utc * 1000).toISOString().split('T')[0];
            allDates.add(date);
            if (!acc[date]) {
              acc[date] = { count: 0, totalScore: 0, totalComments: 0 };
            }
            acc[date].count++;
            acc[date].totalScore += post.score;
            acc[date].totalComments += post.num_comments;
            return acc;
          },
          {} as Record<string, { count: number; totalScore: number; totalComments: number }>
        );

        // Convert to array format
        const platformData = Object.entries(dateGroups)
          .map(([date, data]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            fullDate: date,
            posts: data.count,
            avgScore: Math.round(data.totalScore / data.count),
            avgComments: Math.round(data.totalComments / data.count),
            value: data.count, // Add value for TimeSeriesChart compatibility
          }))
          .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

        if (platform === 'reddit') {
          platformTimeSeriesData.reddit = platformData;
        } else if (platform === 'hackernews') {
          platformTimeSeriesData.hackernews = platformData;
        }
      });

      // Combine all platform data
      const allData = tsData
        .map((item) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: item.date,
          posts: item.count,
          avgScore: Math.round(item.avgScore || 0),
          avgComments: Math.round(item.avgComments || 0),
          value: item.count, // Add value for TimeSeriesChart compatibility
        }))
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

      platformTimeSeriesData.all = allData;
      setTimeSeriesData(platformTimeSeriesData);

      // Get hourly distribution
      const hourData = getPostsByHour(7);
      const formattedHourData = hourData.map((item) => ({
        hour: `${item.hour}:00`,
        hourNum: item.hour,
        posts: item.count,
        avgScore: Math.round(item.avgScore || 0),
      }));
      setHourlyData(formattedHourData);
    } finally {
      setLoading(false);
    }
  }, [isInitialized, timeRange]);

  useEffect(() => {
    fetchData();
  }, [isInitialized, timeRange, fetchData]);

  const handleZoom = (startIndex: number, endIndex: number) => {
    setZoomRange({ start: startIndex, end: endIndex });
  };

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: string | number; color?: string; fill?: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">{entry.name}:</span>
              </div>
              <span className="font-medium">
                {formatLargeNumber(typeof entry.value === 'number' ? entry.value : 0)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'reddit':
        return '#FF4500';
      case 'hackernews':
        return '#FF6600';
      default:
        return '#8884d8';
    }
  };

  const currentData = timeSeriesData[selectedPlatform] || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activity Trends
            </CardTitle>
            <CardDescription>
              Interactive time-series visualization with zoom and platform filtering
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Time range selector */}
            <Select
              value={timeRange.toString()}
              onValueChange={(v) => setTimeRange(Number(v) as 7 | 14 | 30 | 60)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
              </SelectContent>
            </Select>

            {/* Platform filter */}
            <Select
              value={selectedPlatform}
              onValueChange={(v) => setSelectedPlatform(v as 'all' | 'reddit' | 'hackernews')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="reddit">Reddit</SelectItem>
                <SelectItem value="hackernews">Hacker News</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="daily" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Daily Activity
            </TabsTrigger>
            <TabsTrigger value="hourly" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Hourly Distribution
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Platform Comparison
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Posts Over Time</h4>
                <div className="flex gap-2">
                  {platforms.map((platform) => (
                    <Badge
                      key={platform}
                      variant={selectedPlatform === platform ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedPlatform(platform as 'all' | 'reddit' | 'hackernews')
                      }
                    >
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
              <TimeSeriesChart
                data={currentData}
                lines={[
                  {
                    dataKey: 'posts',
                    name: 'Posts',
                    color: getPlatformColor(selectedPlatform),
                    strokeWidth: 2,
                    dot: false,
                  },
                ]}
                chartType="area"
                height={400}
                showBrush={true}
                brushHeight={50}
                zoomEnabled={true}
                onZoom={handleZoom}
                customTooltip={CustomTooltip}
                gradientColors={[
                  {
                    id: 'posts',
                    startColor: getPlatformColor(selectedPlatform),
                    endColor: getPlatformColor(selectedPlatform),
                    startOpacity: 0.8,
                    endOpacity: 0,
                  },
                ]}
              />
            </div>
          </TabsContent>

          <TabsContent value="hourly" className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Activity by Hour of Day</h4>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                  <XAxis
                    dataKey="hour"
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickFormatter={(value) => formatLargeNumber(value)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="posts" name="Posts" radius={[4, 4, 0, 0]}>
                    {hourlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.hourNum >= 9 && entry.hourNum <= 17 ? '#22c55e' : '#3b82f6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground">
                Green bars indicate business hours (9 AM - 5 PM)
              </p>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Engagement Metrics Over Time</h4>
              <TimeSeriesChart
                data={currentData}
                lines={[
                  {
                    dataKey: 'avgScore',
                    name: 'Avg Score',
                    color: '#ff7300',
                    strokeWidth: 2,
                    dot: false,
                  },
                  {
                    dataKey: 'avgComments',
                    name: 'Avg Comments',
                    color: '#387908',
                    strokeWidth: 2,
                    dot: false,
                  },
                ]}
                chartType="line"
                height={400}
                showBrush={true}
                zoomEnabled={true}
                customTooltip={CustomTooltip}
              />
            </div>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Platform Activity Comparison</h4>
              <TimeSeriesChart
                data={timeSeriesData.all}
                lines={[
                  {
                    dataKey: 'posts',
                    name: 'All Platforms',
                    color: '#8884d8',
                    strokeWidth: 2,
                    type: 'monotone',
                    dot: false,
                  },
                ]}
                chartType="line"
                height={400}
                showBrush={true}
                zoomEnabled={true}
                customTooltip={CustomTooltip}
                referenceLines={[
                  {
                    y: Math.max(...(timeSeriesData.all.map((d) => d.posts) || [0])) * 0.8,
                    label: '80% Peak',
                    color: '#666',
                  },
                ]}
              />
              <div className="grid grid-cols-2 gap-4 mt-4">
                {platforms.map((platform) => {
                  const platformData =
                    platform === 'reddit' ? timeSeriesData.reddit : timeSeriesData.hackernews;
                  const totalPosts = platformData.reduce((sum, d) => sum + d.posts, 0);
                  const avgPosts = platformData.length > 0 ? totalPosts / platformData.length : 0;

                  return (
                    <div key={platform} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium capitalize">{platform}</span>
                        <Badge
                          variant="outline"
                          style={{ backgroundColor: getPlatformColor(platform) + '20' }}
                        >
                          {formatLargeNumber(totalPosts)} posts
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg: {formatLargeNumber(Math.round(avgPosts))}/day
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
