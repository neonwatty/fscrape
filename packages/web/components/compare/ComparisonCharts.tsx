'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Source } from './SourceSelector';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  Activity,
  Layers,
} from 'lucide-react';

export interface TimeSeriesData {
  date: string;
  [sourceId: string]: number | string;
}

export interface ComparisonMetric {
  name: string;
  [sourceId: string]: number | string;
}

interface ComparisonChartsProps {
  sources: Source[];
  timeSeriesData: TimeSeriesData[];
  metricsData?: ComparisonMetric[];
  className?: string;
  enableSideBySide?: boolean;
  normalizeData?: boolean;
  aggregation?: 'daily' | 'weekly' | 'monthly';
}

// Chart type configurations
const chartTypes = [
  { id: 'line', label: 'Line', icon: LineChartIcon },
  { id: 'area', label: 'Area', icon: Layers },
  { id: 'bar', label: 'Bar', icon: BarChart3 },
  { id: 'composed', label: 'Mixed', icon: Activity },
] as const;

type ChartType = (typeof chartTypes)[number]['id'];

// Color palette for sources (up to 8 sources)
const sourceColors = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

// Custom tooltip component
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; fill?: string; name: string; value: number | string }>;
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium mb-2">{label && format(parseISO(label), 'MMM dd, yyyy')}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
          </div>
          <span className="font-medium tabular-nums">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Normalize data to 0-100 scale for fair comparison
const normalizeValue = (value: number, min: number, max: number): number => {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
};

export function ComparisonCharts({
  sources,
  timeSeriesData,
  metricsData,
  className,
  enableSideBySide = true,
  normalizeData = false,
  aggregation = 'daily',
}: ComparisonChartsProps) {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [showTrend, setShowTrend] = useState(true);

  // Aggregate data based on selected period
  const aggregatedData = useMemo(() => {
    if (aggregation === 'daily') return timeSeriesData;

    const grouped: Record<string, TimeSeriesData> = {};

    timeSeriesData.forEach((item) => {
      const date = parseISO(item.date);
      let key: string;

      if (aggregation === 'weekly') {
        key = format(startOfWeek(date), 'yyyy-MM-dd');
      } else {
        key = format(startOfMonth(date), 'yyyy-MM-dd');
      }

      if (!grouped[key]) {
        grouped[key] = { date: key };
        sources.forEach((source) => {
          grouped[key][source.id] = 0;
        });
      }

      sources.forEach((source) => {
        const value = item[source.id];
        if (typeof value === 'number') {
          grouped[key][source.id] = (grouped[key][source.id] as number) + value;
        }
      });
    });

    return Object.values(grouped).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [timeSeriesData, sources, aggregation]);

  // Normalize data if requested
  const processedData = useMemo(() => {
    if (!normalizeData) return aggregatedData;

    // Find min and max for each source
    const ranges: Record<string, { min: number; max: number }> = {};

    sources.forEach((source) => {
      const values = aggregatedData
        .map((item) => item[source.id])
        .filter((v) => typeof v === 'number') as number[];

      ranges[source.id] = {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    });

    // Normalize the data
    return aggregatedData.map((item) => {
      const normalized: TimeSeriesData = { date: item.date };

      sources.forEach((source) => {
        const value = item[source.id];
        if (typeof value === 'number') {
          const { min, max } = ranges[source.id];
          normalized[source.id] = normalizeValue(value, min, max);
        } else {
          normalized[source.id] = value;
        }
      });

      return normalized;
    });
  }, [aggregatedData, sources, normalizeData]);

  // Calculate trend lines
  const trendLines = useMemo(() => {
    if (!showTrend) return {};

    const trends: Record<string, number> = {};

    sources.forEach((source) => {
      const values = processedData
        .map((item) => item[source.id])
        .filter((v) => typeof v === 'number') as number[];

      if (values.length > 1) {
        // Simple linear regression for trend
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((sum, v) => sum + v, 0);
        const sumXY = values.reduce((sum, v, i) => sum + v * i, 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        trends[source.id] = slope;
      }
    });

    return trends;
  }, [processedData, sources, showTrend]);

  // Render chart based on type
  const renderChart = (data: TimeSeriesData[]) => {
    const chartProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const commonAxisProps = {
      stroke: '#888',
      fontSize: 12,
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
              {...commonAxisProps}
            />
            <YAxis
              {...commonAxisProps}
              tickFormatter={(value) => (normalizeData ? `${value}%` : value.toLocaleString())}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {sources.map((source, index) => (
              <Area
                key={source.id}
                type="monotone"
                dataKey={source.id}
                name={source.name}
                stroke={source.color || sourceColors[index % sourceColors.length]}
                fill={source.color || sourceColors[index % sourceColors.length]}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
            {showTrend &&
              sources.map((source) => {
                const trend = trendLines[source.id];
                if (!trend) return null;
                return (
                  <ReferenceLine
                    key={`trend-${source.id}`}
                    stroke={
                      source.color || sourceColors[sources.indexOf(source) % sourceColors.length]
                    }
                    strokeDasharray="5 5"
                    segment={[
                      { x: data[0].date, y: data[0][source.id] as number },
                      {
                        x: data[data.length - 1].date,
                        y: (data[0][source.id] as number) + trend * data.length,
                      },
                    ]}
                  />
                );
              })}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
              {...commonAxisProps}
            />
            <YAxis
              {...commonAxisProps}
              tickFormatter={(value) => (normalizeData ? `${value}%` : value.toLocaleString())}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {sources.map((source, index) => (
              <Bar
                key={source.id}
                dataKey={source.id}
                name={source.name}
                fill={source.color || sourceColors[index % sourceColors.length]}
              />
            ))}
          </BarChart>
        );

      case 'composed':
        return (
          <ComposedChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
              {...commonAxisProps}
            />
            <YAxis
              {...commonAxisProps}
              tickFormatter={(value) => (normalizeData ? `${value}%` : value.toLocaleString())}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {sources.map((source, index) => {
              // Alternate between bar and line
              if (index % 2 === 0) {
                return (
                  <Bar
                    key={source.id}
                    dataKey={source.id}
                    name={source.name}
                    fill={source.color || sourceColors[index % sourceColors.length]}
                    opacity={0.8}
                  />
                );
              } else {
                return (
                  <Line
                    key={source.id}
                    type="monotone"
                    dataKey={source.id}
                    name={source.name}
                    stroke={source.color || sourceColors[index % sourceColors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                );
              }
            })}
          </ComposedChart>
        );

      case 'line':
      default:
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
              {...commonAxisProps}
            />
            <YAxis
              {...commonAxisProps}
              tickFormatter={(value) => (normalizeData ? `${value}%` : value.toLocaleString())}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {sources.map((source, index) => (
              <Line
                key={source.id}
                type="monotone"
                dataKey={source.id}
                name={source.name}
                stroke={source.color || sourceColors[index % sourceColors.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
            <Brush
              dataKey="date"
              height={30}
              stroke="#8884d8"
              tickFormatter={(value) => format(parseISO(value), 'MM/dd')}
            />
          </LineChart>
        );
    }
  };

  // Render radar chart for metrics comparison
  const renderRadarChart = () => {
    if (!metricsData || metricsData.length === 0) return null;

    return (
      <RadarChart width={400} height={300} data={metricsData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="name" />
        <PolarRadiusAxis angle={90} domain={[0, 100]} />
        {sources.map((source, index) => (
          <Radar
            key={source.id}
            name={source.name}
            dataKey={source.id}
            stroke={source.color || sourceColors[index % sourceColors.length]}
            fill={source.color || sourceColors[index % sourceColors.length]}
            fillOpacity={0.3}
          />
        ))}
        <Legend />
      </RadarChart>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {chartTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setChartType(type.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                'min-h-[44px]',
                chartType === type.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              )}
            >
              <type.icon className="h-4 w-4" />
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowTrend(!showTrend)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              'min-h-[44px]',
              showTrend ? 'bg-primary/10' : 'bg-secondary'
            )}
          >
            {showTrend ? 'Hide' : 'Show'} Trends
          </button>
        </div>
      </div>

      {/* Charts */}
      {enableSideBySide ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Posting Patterns */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              Posting Patterns
              {Object.values(trendLines).some((t) => t > 0) && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              {Object.values(trendLines).some((t) => t < 0) && (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </h3>
            <div className="border rounded-lg p-4 bg-card">
              <ResponsiveContainer width="100%" height={300}>
                {renderChart(processedData.slice(0, Math.ceil(processedData.length / 2)))}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Engagement Metrics</h3>
            <div className="border rounded-lg p-4 bg-card">
              <ResponsiveContainer width="100%" height={300}>
                {renderChart(processedData.slice(Math.floor(processedData.length / 2)))}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Growth Trends */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Growth Trends</h3>
            <div className="border rounded-lg p-4 bg-card">
              <ResponsiveContainer width="100%" height={300}>
                {renderChart(processedData)}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metrics Radar */}
          {metricsData && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Overall Comparison</h3>
              <div className="border rounded-lg p-4 bg-card flex items-center justify-center">
                {renderRadarChart()}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-card">
          <ResponsiveContainer width="100%" height={400}>
            {renderChart(processedData)}
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend Info */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Primary Source</span>
        </div>
        {normalizeData && (
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3" />
            <span>Data normalized to 0-100 scale</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span>Aggregation: {aggregation}</span>
        </div>
      </div>
    </div>
  );
}
