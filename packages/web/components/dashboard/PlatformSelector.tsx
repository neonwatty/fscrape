'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDatabase } from '@/lib/db/database-context';
import { getPlatformStats, getPlatformComparison } from '@/lib/db/queries';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Database, Users, TrendingUp, MessageCircle } from 'lucide-react';
import type { PlatformStats } from '@/lib/db/types';

interface PlatformSelectorProps {
  onPlatformChange?: (platform: string) => void;
}

export function PlatformSelector({ onPlatformChange }: PlatformSelectorProps) {
  const { isInitialized } = useDatabase();
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [platformComparison, setPlatformComparison] = useState<
    {
      platform: string;
      totalPosts: number;
      avgScore: number;
      avgComments: number;
      topHour: number;
      topDay: number;
    }[]
  >([]);

  useEffect(() => {
    if (isInitialized) {
      // Get platform statistics
      const stats = getPlatformStats();
      setPlatformStats(stats);

      // Get platform comparison data
      const comparison = getPlatformComparison();
      setPlatformComparison(comparison);
    }
  }, [isInitialized]);

  const handlePlatformChange = (value: string) => {
    setSelectedPlatform(value);
    onPlatformChange?.(value);
  };

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}:{' '}
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const selectedPlatformData =
    selectedPlatform === 'all'
      ? null
      : platformComparison.find((p) => p.platform.toLowerCase() === selectedPlatform.toLowerCase());

  const pieData = platformStats.map((stat) => ({
    name: stat.platform,
    value: stat.totalPosts,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Platform Overview</CardTitle>
              <CardDescription>Select a platform to view detailed analytics</CardDescription>
            </div>
            <Select value={selectedPlatform} onValueChange={handlePlatformChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platformStats.map((stat) => (
                  <SelectItem key={stat.platform} value={stat.platform.toLowerCase()}>
                    {stat.platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedPlatform === 'all' ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium mb-4">Platform Distribution</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) =>
                          `${entry.name} ${((entry.percent || 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-4">Average Engagement</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={platformComparison}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="platform"
                        className="text-xs"
                        tick={{ fill: 'currentColor' }}
                      />
                      <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="avgScore"
                        fill="#8884d8"
                        name="Avg Score"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="avgComments"
                        fill="#82ca9d"
                        name="Avg Comments"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {platformStats.map((stat, index) => (
                  <div key={stat.platform} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant="outline"
                        style={{ backgroundColor: COLORS[index % COLORS.length] + '20' }}
                      >
                        {stat.platform}
                      </Badge>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{stat.totalPosts.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">posts</p>
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Avg Score:</span>
                          <span>{Math.round(stat.avgScore || 0)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Avg Comments:</span>
                          <span>{Math.round(stat.avgComments || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedPlatformData ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Total Posts</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {selectedPlatformData.totalPosts.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Avg Score</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {Math.round(selectedPlatformData.avgScore || 0)}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Avg Comments</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {Math.round(selectedPlatformData.avgComments || 0)}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Peak Hour</span>
                  </div>
                  <p className="text-2xl font-bold">{selectedPlatformData.topHour || 0}:00</p>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Platform Insights</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Most active on day {selectedPlatformData.topDay || 0} of the week</p>
                  <p>Peak posting hour is {selectedPlatformData.topHour || 0}:00</p>
                  <p>
                    Average engagement rate:{' '}
                    {(
                      (selectedPlatformData.avgComments / selectedPlatformData.avgScore) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No data available for selected platform
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
