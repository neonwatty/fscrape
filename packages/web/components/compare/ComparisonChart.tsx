'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Source } from './SourceSelector';

export interface ComparisonData {
  date: string;
  [sourceId: string]: number | string;
}

interface ComparisonChartProps {
  data: ComparisonData[];
  sources: Source[];
  metric: 'posts' | 'engagement' | 'sentiment' | 'growth';
  chartType?: 'line' | 'bar' | 'area' | 'composed';
  showDualAxis?: boolean;
  className?: string;
  height?: number;
}

const metricConfigs = {
  posts: {
    label: 'Post Count',
    format: (value: number) => value.toLocaleString(),
    color: '#3b82f6',
  },
  engagement: {
    label: 'Engagement Rate',
    format: (value: number) => `${(value * 100).toFixed(1)}%`,
    color: '#10b981',
  },
  sentiment: {
    label: 'Sentiment Score',
    format: (value: number) => value.toFixed(2),
    color: '#f59e0b',
  },
  growth: {
    label: 'Growth Rate',
    format: (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`,
    color: '#ef4444',
  },
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; fill?: string; name: string; value: number | string }>;
  label?: string | number;
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium mb-2">
        {format(new Date(label as string), 'MMM dd, yyyy')}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
          </div>
          <span className="font-medium">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function ComparisonChart({
  data,
  sources,
  metric,
  chartType = 'line',
  showDualAxis = false,
  className,
  height = 400,
}: ComparisonChartProps) {
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  const config = metricConfigs[metric];

  const toggleSource = (sourceId: string) => {
    const newHidden = new Set(hiddenSources);
    if (newHidden.has(sourceId)) {
      newHidden.delete(sourceId);
    } else {
      newHidden.add(sourceId);
    }
    setHiddenSources(newHidden);
  };

  const visibleSources = sources.filter((s) => !hiddenSources.has(s.id));

  // Prepare data for dual axis if needed
  const dualAxisSources = showDualAxis
    ? [
        visibleSources.slice(0, Math.ceil(visibleSources.length / 2)),
        visibleSources.slice(Math.ceil(visibleSources.length / 2)),
      ]
    : [visibleSources, []];

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              className="text-xs"
            />
            <YAxis tickFormatter={config.format} className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              onClick={(e) => toggleSource(e.dataKey as string)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
            {visibleSources.map((source) => (
              <Bar
                key={source.id}
                dataKey={source.id}
                name={source.name}
                fill={source.color || config.color}
                opacity={hiddenSources.has(source.id) ? 0.3 : 1}
              />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              className="text-xs"
            />
            <YAxis tickFormatter={config.format} className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              onClick={(e) => toggleSource(e.dataKey as string)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
            {visibleSources.map((source) => (
              <Area
                key={source.id}
                type="monotone"
                dataKey={source.id}
                name={source.name}
                stroke={source.color || config.color}
                fill={source.color || config.color}
                fillOpacity={0.3}
                strokeWidth={2}
                opacity={hiddenSources.has(source.id) ? 0.3 : 1}
              />
            ))}
          </ComposedChart>
        );

      case 'composed':
        return (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              className="text-xs"
            />
            {showDualAxis ? (
              <>
                <YAxis yAxisId="left" tickFormatter={config.format} className="text-xs" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={config.format}
                  className="text-xs"
                />
              </>
            ) : (
              <YAxis tickFormatter={config.format} className="text-xs" />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              onClick={(e) => toggleSource(e.dataKey as string)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
            {showDualAxis ? (
              <>
                {dualAxisSources[0].map((source) => (
                  <Line
                    key={source.id}
                    yAxisId="left"
                    type="monotone"
                    dataKey={source.id}
                    name={source.name}
                    stroke={source.color || config.color}
                    strokeWidth={2}
                    dot={false}
                    opacity={hiddenSources.has(source.id) ? 0.3 : 1}
                  />
                ))}
                {dualAxisSources[1].map((source) => (
                  <Bar
                    key={source.id}
                    yAxisId="right"
                    dataKey={source.id}
                    name={source.name}
                    fill={source.color || config.color}
                    opacity={hiddenSources.has(source.id) ? 0.3 : 1}
                  />
                ))}
              </>
            ) : (
              visibleSources.map((source, index) =>
                index % 2 === 0 ? (
                  <Line
                    key={source.id}
                    type="monotone"
                    dataKey={source.id}
                    name={source.name}
                    stroke={source.color || config.color}
                    strokeWidth={2}
                    dot={false}
                    opacity={hiddenSources.has(source.id) ? 0.3 : 1}
                  />
                ) : (
                  <Bar
                    key={source.id}
                    dataKey={source.id}
                    name={source.name}
                    fill={source.color || config.color}
                    opacity={hiddenSources.has(source.id) ? 0.3 : 1}
                  />
                )
              )
            )}
          </ComposedChart>
        );

      case 'line':
      default:
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              className="text-xs"
            />
            {showDualAxis && dualAxisSources[1].length > 0 ? (
              <>
                <YAxis yAxisId="left" tickFormatter={config.format} className="text-xs" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={config.format}
                  className="text-xs"
                />
              </>
            ) : (
              <YAxis tickFormatter={config.format} className="text-xs" />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              onClick={(e) => toggleSource(e.dataKey as string)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
            {showDualAxis && dualAxisSources[1].length > 0 ? (
              <>
                {dualAxisSources[0].map((source) => (
                  <Line
                    key={source.id}
                    yAxisId="left"
                    type="monotone"
                    dataKey={source.id}
                    name={source.name}
                    stroke={source.color || config.color}
                    strokeWidth={2}
                    dot={false}
                    opacity={hiddenSources.has(source.id) ? 0.3 : 1}
                  />
                ))}
                {dualAxisSources[1].map((source) => (
                  <Line
                    key={source.id}
                    yAxisId="right"
                    type="monotone"
                    dataKey={source.id}
                    name={source.name}
                    stroke={source.color || '#ef4444'}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    opacity={hiddenSources.has(source.id) ? 0.3 : 1}
                  />
                ))}
              </>
            ) : (
              visibleSources.map((source) => (
                <Line
                  key={source.id}
                  type="monotone"
                  dataKey={source.id}
                  name={source.name}
                  stroke={source.color || config.color}
                  strokeWidth={2}
                  dot={false}
                  opacity={hiddenSources.has(source.id) ? 0.3 : 1}
                />
              ))
            )}
          </LineChart>
        );
    }
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{config.label} Comparison</h3>
        <p className="text-sm text-muted-foreground">Click legend items to show/hide sources</p>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
