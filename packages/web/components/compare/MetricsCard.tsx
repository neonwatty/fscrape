'use client';

import { ArrowUp, ArrowDown, Minus, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Source } from './SourceSelector';

export interface MetricData {
  sourceId: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
}

interface MetricsCardProps {
  title: string;
  description?: string;
  metrics: MetricData[];
  sources: Source[];
  format?: (value: number) => string;
  showSparkline?: boolean;
  compareMode?: 'absolute' | 'percentage' | 'indexed';
  baselineSourceId?: string;
  className?: string;
}

const defaultFormat = (value: number) => value.toLocaleString();

export function MetricsCard({
  title,
  description,
  metrics,
  sources,
  format = defaultFormat,
  showSparkline = false,
  compareMode = 'absolute',
  baselineSourceId,
  className,
}: MetricsCardProps) {
  const getSourceById = (id: string) => sources.find((s) => s.id === id);

  const baselineValue = baselineSourceId
    ? metrics.find((m) => m.sourceId === baselineSourceId)?.value || 0
    : Math.max(...metrics.map((m) => m.value));

  const getComparativeValue = (metric: MetricData) => {
    switch (compareMode) {
      case 'percentage':
        if (baselineValue === 0) return 0;
        return ((metric.value - baselineValue) / baselineValue) * 100;
      case 'indexed':
        if (baselineValue === 0) return 0;
        return (metric.value / baselineValue) * 100;
      case 'absolute':
      default:
        return metric.value;
    }
  };

  const formatComparativeValue = (value: number) => {
    switch (compareMode) {
      case 'percentage':
        return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
      case 'indexed':
        return `${value.toFixed(0)}`;
      case 'absolute':
      default:
        return format(value);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-4 w-4" />;
      case 'down':
        return <ArrowDown className="h-4 w-4" />;
      case 'neutral':
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const renderSparkline = (data?: number[]) => {
    if (!data || data.length === 0) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 60;
    const height = 30;

    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="inline-block ml-2">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary opacity-50"
        />
      </svg>
    );
  };

  const sortedMetrics = [...metrics].sort((a, b) => b.value - a.value);

  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          {title}
        </h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>

      <div className="space-y-4">
        {sortedMetrics.map((metric, index) => {
          const source = getSourceById(metric.sourceId);
          if (!source) return null;

          const comparativeValue = getComparativeValue(metric);
          const isBaseline = metric.sourceId === baselineSourceId;
          const isLeading = index === 0;

          return (
            <div
              key={metric.sourceId}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg',
                'transition-colors hover:bg-accent/50',
                isBaseline && 'ring-2 ring-primary/20',
                isLeading && !isBaseline && 'bg-primary/5'
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                {source.color && (
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: source.color }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{source.name}</span>
                    {isBaseline && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Baseline
                      </span>
                    )}
                    {isLeading && !isBaseline && (
                      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded">
                        Leading
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{source.platform}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold">{formatComparativeValue(comparativeValue)}</div>
                  {compareMode !== 'absolute' && (
                    <div className="text-xs text-muted-foreground">{format(metric.value)}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      metric.trend === 'up' && metric.change > 0 && 'text-green-600',
                      metric.trend === 'down' && metric.change < 0 && 'text-red-600',
                      metric.trend === 'neutral' && 'text-muted-foreground'
                    )}
                  >
                    {getTrendIcon(metric.trend)}
                    <span className="text-xs">{Math.abs(metric.change).toFixed(1)}%</span>
                  </div>

                  {showSparkline && renderSparkline(metric.sparklineData)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {compareMode !== 'absolute' && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Comparison Mode: {compareMode}</span>
            {baselineSourceId && <span>Baseline: {getSourceById(baselineSourceId)?.name}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
