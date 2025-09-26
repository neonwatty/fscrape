'use client';

import { useState } from 'react';
import { Percent, TrendingUp, BarChart3, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Source } from './SourceSelector';

export interface NormalizedMetric {
  sourceId: string;
  rawValue: number;
  normalizedValue: number;
  percentile: number;
  zScore: number;
}

interface NormalizedViewProps {
  title: string;
  metrics: NormalizedMetric[];
  sources: Source[];
  normalizationMethod?: 'minmax' | 'zscore' | 'percentile' | 'log';
  showRawValues?: boolean;
  className?: string;
}

export function NormalizedView({
  title,
  metrics,
  sources,
  normalizationMethod = 'minmax',
  showRawValues = true,
  className,
}: NormalizedViewProps) {
  const [selectedMethod, setSelectedMethod] = useState(normalizationMethod);

  const getSourceById = (id: string) => sources.find((s) => s.id === id);

  const getNormalizedValue = (metric: NormalizedMetric) => {
    switch (selectedMethod) {
      case 'zscore':
        return metric.zScore;
      case 'percentile':
        return metric.percentile;
      case 'log':
        return Math.log10(metric.rawValue + 1);
      case 'minmax':
      default:
        return metric.normalizedValue;
    }
  };

  const formatNormalizedValue = (value: number) => {
    switch (selectedMethod) {
      case 'zscore':
        return `σ ${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
      case 'percentile':
        return `${value.toFixed(0)}th`;
      case 'log':
        return value.toFixed(2);
      case 'minmax':
      default:
        return (value * 100).toFixed(0);
    }
  };

  const getMethodLabel = (method: typeof selectedMethod) => {
    switch (method) {
      case 'zscore':
        return 'Z-Score';
      case 'percentile':
        return 'Percentile';
      case 'log':
        return 'Log Scale';
      case 'minmax':
      default:
        return 'Min-Max';
    }
  };

  const getMethodDescription = (method: typeof selectedMethod) => {
    switch (method) {
      case 'zscore':
        return 'Standard deviations from mean';
      case 'percentile':
        return 'Relative ranking (0-100)';
      case 'log':
        return 'Logarithmic transformation';
      case 'minmax':
      default:
        return 'Scaled to 0-100 range';
    }
  };

  const sortedMetrics = [...metrics].sort((a, b) => getNormalizedValue(b) - getNormalizedValue(a));

  const maxNormalized = Math.max(...metrics.map((m) => getNormalizedValue(m)));

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          {title}
        </h3>

        {/* Normalization method selector */}
        <div className="flex flex-wrap gap-2">
          {(['minmax', 'zscore', 'percentile', 'log'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                'min-h-[44px] flex items-center gap-2',
                selectedMethod === method
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              )}
            >
              {method === 'minmax' && <Percent className="h-4 w-4" />}
              {method === 'zscore' && <TrendingUp className="h-4 w-4" />}
              {method === 'percentile' && <BarChart3 className="h-4 w-4" />}
              {method === 'log' && <Calculator className="h-4 w-4" />}
              {getMethodLabel(method)}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground mt-2">{getMethodDescription(selectedMethod)}</p>
      </div>

      <div className="p-6 space-y-3">
        {sortedMetrics.map((metric, index) => {
          const source = getSourceById(metric.sourceId);
          if (!source) return null;

          const normalizedValue = getNormalizedValue(metric);
          const percentage =
            selectedMethod === 'minmax' ? normalizedValue : normalizedValue / maxNormalized;

          return (
            <div key={metric.sourceId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {source.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: source.color }}
                    />
                  )}
                  <span className="font-medium text-sm">{source.name}</span>
                  {index === 0 && (
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded">
                      Best
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {showRawValues && (
                    <span className="text-xs text-muted-foreground">
                      Raw: {metric.rawValue.toLocaleString()}
                    </span>
                  )}
                  <span className="font-semibold text-sm">
                    {formatNormalizedValue(normalizedValue)}
                  </span>
                </div>
              </div>

              {/* Visual bar representation */}
              <div className="relative h-6 bg-secondary rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/50 to-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(5, Math.min(100, percentage * 100))}%`,
                    backgroundColor: source.color || undefined,
                  }}
                />
                <div className="absolute inset-0 flex items-center px-2">
                  <span className="text-xs font-medium text-foreground/70">
                    {selectedMethod === 'percentile' ? `${metric.percentile}th percentile` : ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistical summary */}
      <div className="p-4 border-t bg-muted/30">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Mean</span>
            <p className="font-medium">
              {(metrics.reduce((sum, m) => sum + m.rawValue, 0) / metrics.length).toFixed(0)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Median</span>
            <p className="font-medium">
              {[...metrics]
                .sort((a, b) => a.rawValue - b.rawValue)
                [Math.floor(metrics.length / 2)]?.rawValue.toFixed(0)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Std Dev</span>
            <p className="font-medium">
              {(() => {
                const mean = metrics.reduce((sum, m) => sum + m.rawValue, 0) / metrics.length;
                const variance =
                  metrics.reduce((sum, m) => sum + Math.pow(m.rawValue - mean, 2), 0) /
                  metrics.length;
                return Math.sqrt(variance).toFixed(0);
              })()}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Range</span>
            <p className="font-medium">
              {Math.min(...metrics.map((m) => m.rawValue)).toFixed(0)} -{' '}
              {Math.max(...metrics.map((m) => m.rawValue)).toFixed(0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
