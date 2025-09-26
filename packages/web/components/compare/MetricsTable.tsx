'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Source } from './SourceSelector';
import {
  StatisticalSummary,
  compareMetrics,
  calculateStatistics,
  generateInsights,
  calculateRelativePerformance,
  normalizeByTimePeriod,
  isHigherBetter,
} from '@/lib/utils/comparison';

interface MetricsTableProps {
  sources: Source[];
  metricsData: Record<string, Record<string, number>>;
  normalizationMethod?: 'minmax' | 'zscore' | 'robust' | 'none';
  showStatistics?: boolean;
  showInsights?: boolean;
  compactMode?: boolean;
  className?: string;
  timePeriodDays?: number;
  baselineSourceId?: string;
}

// Format functions for different metric types
const formatters: Record<string, (value: number) => string> = {
  posts: (v) => v.toLocaleString(),
  engagement: (v) => `${(v * 100).toFixed(1)}%`,
  sentiment: (v) => v.toFixed(2),
  growth: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  percentage: (v) => `${v.toFixed(1)}%`,
  default: (v) => v.toLocaleString(),
};

export function MetricsTable({
  sources,
  metricsData,
  normalizationMethod = 'minmax',
  showStatistics = true,
  showInsights = true,
  compactMode = false,
  className,
  timePeriodDays = 30,
  baselineSourceId,
}: MetricsTableProps) {
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'raw' | 'normalized' | 'rank'>('normalized');

  // Process metrics with normalization
  const processedMetrics = useMemo(() => {
    // Normalize by time period if specified
    const normalizedData = { ...metricsData };
    if (timePeriodDays && timePeriodDays !== 30) {
      for (const [metric, values] of Object.entries(normalizedData)) {
        for (const [sourceId, value] of Object.entries(values)) {
          normalizedData[metric][sourceId] = normalizeByTimePeriod(
            value,
            timePeriodDays,
            'monthly'
          );
        }
      }
    }

    return compareMetrics(sources, normalizedData, normalizationMethod);
  }, [sources, metricsData, normalizationMethod, timePeriodDays]);

  // Calculate statistics for each metric
  const statistics = useMemo(() => {
    if (!showStatistics) return {};

    const stats: Record<string, StatisticalSummary> = {};
    for (const metric of processedMetrics) {
      stats[metric.name] = calculateStatistics(metric.values.map((v) => v.rawValue));
    }
    return stats;
  }, [processedMetrics, showStatistics]);

  // Generate insights
  const insights = useMemo(() => {
    if (!showInsights) return [];
    return generateInsights(processedMetrics);
  }, [processedMetrics, showInsights]);

  // Calculate relative performance if baseline is set
  const relativePerformance = useMemo(() => {
    if (!baselineSourceId) return {};

    const performance: Record<string, Record<string, number>> = {};
    for (const source of sources) {
      if (source.id !== baselineSourceId) {
        performance[source.id] = calculateRelativePerformance(
          baselineSourceId,
          source.id,
          processedMetrics
        );
      }
    }
    return performance;
  }, [baselineSourceId, sources, processedMetrics]);

  const toggleMetricExpansion = (metricName: string) => {
    const newExpanded = new Set(expandedMetrics);
    if (newExpanded.has(metricName)) {
      newExpanded.delete(metricName);
    } else {
      newExpanded.add(metricName);
    }
    setExpandedMetrics(newExpanded);
  };

  const getFormatter = (metricName: string) => {
    return formatters[metricName] || formatters.default;
  };

  const _getTrendIcon = (value: number, higherIsBetter: boolean = true) => {
    if (value === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if ((value > 0 && higherIsBetter) || (value < 0 && !higherIsBetter)) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getValueColor = (percentile: number | undefined) => {
    if (!percentile) return '';
    if (percentile >= 75) return 'text-green-600 dark:text-green-400';
    if (percentile <= 25) return 'text-red-600 dark:text-red-400';
    return '';
  };

  // Sort metrics for display
  const sortedMetrics = useMemo(() => {
    return [...processedMetrics].sort((a, b) => {
      // Sort by selected source's performance
      if (selectedMetric) {
        const aValue = a.values.find((v) => v.sourceId === selectedMetric);
        const bValue = b.values.find((v) => v.sourceId === selectedMetric);
        if (aValue && bValue) {
          switch (sortBy) {
            case 'raw':
              return bValue.rawValue - aValue.rawValue;
            case 'rank':
              return (aValue.rank || 0) - (bValue.rank || 0);
            case 'normalized':
            default:
              return (bValue.normalizedValue || 0) - (aValue.normalizedValue || 0);
          }
        }
      }
      return 0;
    });
  }, [processedMetrics, selectedMetric, sortBy]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Normalization:</span>
          <div className="flex gap-1">
            {(['none', 'minmax', 'zscore', 'robust'] as const).map((method) => (
              <button
                key={method}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  normalizationMethod === method
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
                onClick={() => {
                  /* Update normalization method */
                }}
              >
                {method === 'minmax'
                  ? 'Min-Max'
                  : method === 'zscore'
                    ? 'Z-Score'
                    : method === 'robust'
                      ? 'Robust'
                      : 'None'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sort by:</span>
          <div className="flex gap-1">
            {(['normalized', 'raw', 'rank'] as const).map((sort) => (
              <button
                key={sort}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors capitalize',
                  sortBy === sort
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
                onClick={() => setSortBy(sort)}
              >
                {sort}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Metrics Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Metric</TableHead>
              {sources.map((source) => (
                <TableHead
                  key={source.id}
                  className={cn(
                    'text-center cursor-pointer hover:bg-accent/50',
                    source.id === baselineSourceId && 'bg-primary/5',
                    selectedMetric === source.id && 'bg-accent'
                  )}
                  onClick={() => setSelectedMetric(selectedMetric === source.id ? null : source.id)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium">{source.name}</span>
                    {source.id === baselineSourceId && (
                      <span className="text-xs text-primary">Baseline</span>
                    )}
                  </div>
                </TableHead>
              ))}
              {showStatistics && <TableHead className="text-center">Statistics</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMetrics.map((metric) => {
              const isExpanded = expandedMetrics.has(metric.name);
              const stats = statistics[metric.name];
              const _higherBetter = isHigherBetter(metric.name);
              const formatter = getFormatter(metric.name);

              return (
                <>
                  <TableRow
                    key={metric.name}
                    className={cn(
                      'cursor-pointer hover:bg-accent/50',
                      isExpanded && 'bg-accent/20'
                    )}
                    onClick={() => toggleMetricExpansion(metric.name)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        {metric.label}
                      </div>
                    </TableCell>

                    {sources.map((source) => {
                      const value = metric.values.find((v) => v.sourceId === source.id);
                      const relPerf = relativePerformance[source.id]?.[metric.name];

                      return (
                        <TableCell key={source.id} className="text-center">
                          <div className="space-y-1">
                            <div className={cn('font-medium', getValueColor(value?.percentile))}>
                              {value ? formatter(value.rawValue) : '-'}
                            </div>

                            {!compactMode && value && (
                              <div className="text-xs text-muted-foreground">
                                {normalizationMethod !== 'none' && (
                                  <div>Norm: {(value.normalizedValue || 0).toFixed(2)}</div>
                                )}
                                <div className="flex items-center justify-center gap-1">
                                  <span>Rank #{value.rank}</span>
                                  {relPerf !== undefined && (
                                    <>
                                      <span>•</span>
                                      <span
                                        className={cn(
                                          relPerf > 0 ? 'text-green-600' : 'text-red-600'
                                        )}
                                      >
                                        {relPerf > 0 ? '+' : ''}
                                        {relPerf.toFixed(1)}%
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}

                    {showStatistics && stats && (
                      <TableCell className="text-center">
                        <div className="text-xs space-y-1">
                          <div>μ: {formatter(stats.mean)}</div>
                          <div>σ: {formatter(stats.stdDev)}</div>
                          <div>CV: {stats.cv.toFixed(1)}%</div>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>

                  {/* Expanded details */}
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={sources.length + (showStatistics ? 2 : 1)}>
                        <div className="p-4 bg-muted/30 rounded space-y-3">
                          {/* Statistical details */}
                          {stats && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Min:</span>
                                <span className="ml-2 font-medium">{formatter(stats.min)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Max:</span>
                                <span className="ml-2 font-medium">{formatter(stats.max)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Median:</span>
                                <span className="ml-2 font-medium">{formatter(stats.median)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">IQR:</span>
                                <span className="ml-2 font-medium">{formatter(stats.iqr)}</span>
                              </div>
                              {stats.skewness !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Skewness:</span>
                                  <span className="ml-2 font-medium">
                                    {stats.skewness.toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {stats.kurtosis !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Kurtosis:</span>
                                  <span className="ml-2 font-medium">
                                    {stats.kurtosis.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Visual bar chart */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <BarChart3 className="h-4 w-4" />
                              Normalized Comparison
                            </div>
                            <div className="space-y-1">
                              {metric.values.map((value) => {
                                const width = (value.normalizedValue || 0) * 100;
                                return (
                                  <div key={value.sourceId} className="flex items-center gap-2">
                                    <span className="text-xs w-24 truncate">
                                      {value.sourceName}
                                    </span>
                                    <div className="flex-1 h-6 bg-secondary rounded overflow-hidden">
                                      <div
                                        className="h-full bg-primary/60 flex items-center px-2"
                                        style={{ width: `${width}%` }}
                                      >
                                        <span className="text-xs font-medium">
                                          {formatter(value.rawValue)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Insights Panel */}
      {showInsights && insights.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4" />
            Performance Insights
          </div>
          <div className="space-y-2">
            {insights.slice(0, 5).map((insight, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-2 p-2 rounded text-sm',
                  insight.type === 'positive' && 'bg-green-50 dark:bg-green-950/30',
                  insight.type === 'negative' && 'bg-red-50 dark:bg-red-950/30',
                  insight.type === 'neutral' && 'bg-gray-50 dark:bg-gray-950/30'
                )}
              >
                {insight.type === 'positive' ? (
                  <ArrowUp className="h-4 w-4 text-green-500 mt-0.5" />
                ) : insight.type === 'negative' ? (
                  <ArrowDown className="h-4 w-4 text-red-500 mt-0.5" />
                ) : (
                  <Activity className="h-4 w-4 text-gray-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p>{insight.insight}</p>
                  {insight.significance === 'high' && (
                    <span className="text-xs text-muted-foreground">High significance</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Percent className="h-3 w-3" />
          <span>
            Values normalized to {normalizationMethod === 'none' ? 'raw' : normalizationMethod}{' '}
            scale
          </span>
        </div>
        {timePeriodDays !== 30 && (
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3" />
            <span>Normalized to 30-day period</span>
          </div>
        )}
      </div>
    </div>
  );
}
