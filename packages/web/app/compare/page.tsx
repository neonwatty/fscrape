'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Types exports
import type { Source } from '@/components/compare/SourceSelector';
import type { ComparisonData } from '@/components/compare/ComparisonChart';
import type { TimeSeriesData } from '@/components/compare/ComparisonCharts';
import type { MetricData } from '@/components/compare/MetricsCard';
import type { NormalizedMetric } from '@/components/compare/NormalizedView';

// Dynamic imports for comparison components
const SourceSelector = dynamic(
  () =>
    import('@/components/compare/SourceSelector').then((mod) => ({ default: mod.SourceSelector })),
  { loading: () => <Skeleton className="h-20 w-full" />, ssr: false }
);

const ComparisonCharts = dynamic(
  () =>
    import('@/components/compare/ComparisonCharts').then((mod) => ({
      default: mod.ComparisonCharts,
    })),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false }
);

const MetricsCard = dynamic(
  () => import('@/components/compare/MetricsCard').then((mod) => ({ default: mod.MetricsCard })),
  { loading: () => <Skeleton className="h-32 w-full" />, ssr: false }
);

const MetricsTable = dynamic(
  () => import('@/components/compare/MetricsTable').then((mod) => ({ default: mod.MetricsTable })),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false }
);

const NormalizedView = dynamic(
  () =>
    import('@/components/compare/NormalizedView').then((mod) => ({ default: mod.NormalizedView })),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);
import {
  BarChart3,
  LineChart,
  TrendingUp,
  Layers,
  Download,
  Save,
  Settings,
  Table,
  FileDown,
  Share2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data generation for demonstration
const generateMockSources = (): Source[] => [
  {
    id: 'reddit-tech',
    name: 'r/technology',
    platform: 'Reddit',
    postCount: 15234,
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    color: '#FF4500',
  },
  {
    id: 'reddit-prog',
    name: 'r/programming',
    platform: 'Reddit',
    postCount: 12456,
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    color: '#5296DD',
  },
  {
    id: 'hn-main',
    name: 'HackerNews',
    platform: 'HackerNews',
    postCount: 8932,
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    color: '#FF6600',
  },
  {
    id: 'reddit-webdev',
    name: 'r/webdev',
    platform: 'Reddit',
    postCount: 10234,
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    color: '#00D4AA',
  },
  {
    id: 'reddit-ml',
    name: 'r/MachineLearning',
    platform: 'Reddit',
    postCount: 7823,
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    color: '#8B5CF6',
  },
];

const generateTimeSeriesData = (sources: string[]): ComparisonData[] => {
  const days = 30;
  const data: ComparisonData[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(2024, 0, i + 1);
    const dataPoint: ComparisonData = {
      date: date.toISOString().split('T')[0],
    };

    sources.forEach((sourceId) => {
      dataPoint[sourceId] = Math.floor(Math.random() * 500) + 100;
    });

    data.push(dataPoint);
  }

  return data;
};

const generateMetricData = (sources: string[]): MetricData[] => {
  return sources.map((sourceId) => ({
    sourceId,
    value: Math.floor(Math.random() * 10000) + 1000,
    change: (Math.random() - 0.5) * 20,
    trend:
      Math.random() > 0.5
        ? 'up'
        : Math.random() > 0.5
          ? 'down'
          : ('neutral' as 'up' | 'down' | 'neutral'),
    sparklineData: Array.from({ length: 10 }, () => Math.random() * 100),
  }));
};

const generateNormalizedMetrics = (sources: string[]): NormalizedMetric[] => {
  const rawValues = sources.map(() => Math.floor(Math.random() * 10000) + 1000);
  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);
  const mean = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;
  const stdDev = Math.sqrt(
    rawValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rawValues.length
  );

  return sources.map((sourceId, index) => {
    const rawValue = rawValues[index];
    return {
      sourceId,
      rawValue,
      normalizedValue: (rawValue - min) / (max - min),
      percentile: (rawValues.filter((v) => v <= rawValue).length / rawValues.length) * 100,
      zScore: (rawValue - mean) / stdDev,
    };
  });
};

// Comparison preset interface
interface ComparisonPreset {
  id: string;
  name: string;
  sources: string[];
  settings: {
    chartType: 'line' | 'bar' | 'area' | 'composed';
    normalizationMethod: 'minmax' | 'zscore' | 'robust' | 'none';
    aggregation: 'daily' | 'weekly' | 'monthly';
  };
  createdAt: string;
}

export default function ComparePage() {
  const [sources] = useState<Source[]>(generateMockSources());
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<ComparisonData[]>([]);
  const [metricData, setMetricData] = useState<MetricData[]>([]);
  const [normalizedMetrics, setNormalizedMetrics] = useState<NormalizedMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'charts' | 'metrics' | 'table' | 'normalized'>(
    'charts'
  );
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area' | 'composed'>('line');
  const [normalizationMethod, setNormalizationMethod] = useState<
    'minmax' | 'zscore' | 'robust' | 'none'
  >('minmax');
  const [aggregation, setAggregation] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [savedPresets, setSavedPresets] = useState<ComparisonPreset[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (selectedSources.length > 0) {
      setTimeSeriesData(generateTimeSeriesData(selectedSources));
      setMetricData(generateMetricData(selectedSources));
      setNormalizedMetrics(generateNormalizedMetrics(selectedSources));
    }
  }, [selectedSources]);

  // Load saved presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('comparisonPresets');
    if (saved) {
      setSavedPresets(JSON.parse(saved));
    }
  }, []);

  const selectedSourceObjects = sources.filter((s) => selectedSources.includes(s.id));

  // Export functionality
  const exportData = useCallback(
    async (format: 'csv' | 'json' | 'pdf') => {
      setIsExporting(true);

      try {
        const exportData = {
          sources: selectedSourceObjects,
          timeSeriesData,
          metrics: metricData,
          normalized: normalizedMetrics,
          settings: {
            chartType,
            normalizationMethod,
            aggregation,
          },
          exportDate: new Date().toISOString(),
        };

        if (format === 'json') {
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `comparison-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } else if (format === 'csv') {
          // Convert to CSV format
          const headers = ['Date', ...selectedSourceObjects.map((s) => s.name)].join(',');
          const rows = timeSeriesData.map((row) => {
            const values = [row.date, ...selectedSources.map((id) => row[id])];
            return values.join(',');
          });
          const csv = [headers, ...rows].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `comparison-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        } else if (format === 'pdf') {
          // For PDF, we'd typically use a library like jsPDF
          // For now, we'll use browser print
          window.print();
        }
      } finally {
        setIsExporting(false);
      }
    },
    [
      selectedSourceObjects,
      timeSeriesData,
      metricData,
      normalizedMetrics,
      chartType,
      normalizationMethod,
      aggregation,
      selectedSources,
    ]
  );

  // Save preset functionality
  const savePreset = useCallback(() => {
    const presetName = prompt('Enter a name for this comparison preset:');
    if (!presetName) return;

    const newPreset: ComparisonPreset = {
      id: Date.now().toString(),
      name: presetName,
      sources: selectedSources,
      settings: {
        chartType,
        normalizationMethod,
        aggregation,
      },
      createdAt: new Date().toISOString(),
    };

    const updatedPresets = [...savedPresets, newPreset];
    setSavedPresets(updatedPresets);
    localStorage.setItem('comparisonPresets', JSON.stringify(updatedPresets));
  }, [selectedSources, chartType, normalizationMethod, aggregation, savedPresets]);

  // Load preset functionality
  const loadPreset = useCallback((preset: ComparisonPreset) => {
    setSelectedSources(preset.sources);
    setChartType(preset.settings.chartType);
    setNormalizationMethod(preset.settings.normalizationMethod);
    setAggregation(preset.settings.aggregation);
    setShowPresetMenu(false);
  }, []);

  // Delete preset functionality
  const deletePreset = useCallback(
    (presetId: string) => {
      const updatedPresets = savedPresets.filter((p) => p.id !== presetId);
      setSavedPresets(updatedPresets);
      localStorage.setItem('comparisonPresets', JSON.stringify(updatedPresets));
    },
    [savedPresets]
  );

  // Generate metrics data for table
  const metricsTableData = useMemo(() => {
    const metrics: Record<string, Record<string, number>> = {
      posts: {},
      engagement: {},
      sentiment: {},
      growth: {},
    };

    selectedSources.forEach((sourceId) => {
      metrics.posts[sourceId] = Math.floor(Math.random() * 10000) + 1000;
      metrics.engagement[sourceId] = Math.random() * 0.1;
      metrics.sentiment[sourceId] = Math.random() * 5;
      metrics.growth[sourceId] = (Math.random() - 0.5) * 0.2;
    });

    return metrics;
  }, [selectedSources]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 px-4 max-w-7xl">
        {/* Header with actions */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Compare Sources</h1>
              <p className="text-muted-foreground">
                Analyze and compare metrics across different platforms and sources
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Presets dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowPresetMenu(!showPresetMenu)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'bg-secondary hover:bg-secondary/80 transition-colors',
                    'text-sm font-medium min-h-[44px]'
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Presets
                </button>

                {showPresetMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border bg-background shadow-lg z-50">
                    <div className="p-2 border-b">
                      <button
                        onClick={savePreset}
                        disabled={selectedSources.length === 0}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-accent text-sm"
                      >
                        <Save className="h-4 w-4" />
                        Save Current Settings
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {savedPresets.length === 0 ? (
                        <p className="p-4 text-center text-sm text-muted-foreground">
                          No saved presets
                        </p>
                      ) : (
                        savedPresets.map((preset) => (
                          <div
                            key={preset.id}
                            className="flex items-center justify-between p-2 hover:bg-accent group"
                          >
                            <button
                              onClick={() => loadPreset(preset)}
                              className="flex-1 text-left text-sm"
                            >
                              <div className="font-medium">{preset.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {preset.sources.length} sources •{' '}
                                {new Date(preset.createdAt).toLocaleDateString()}
                              </div>
                            </button>
                            <button
                              onClick={() => deletePreset(preset.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Export dropdown */}
              <div className="relative group">
                <button
                  disabled={selectedSources.length === 0 || isExporting}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    'text-sm font-medium min-h-[44px] transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isExporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export
                </button>

                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border bg-background shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                  <button
                    onClick={() => exportData('csv')}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-sm"
                  >
                    <FileDown className="h-4 w-4" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => exportData('json')}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-sm"
                  >
                    <FileDown className="h-4 w-4" />
                    Export as JSON
                  </button>
                  <button
                    onClick={() => exportData('pdf')}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-sm"
                  >
                    <FileDown className="h-4 w-4" />
                    Export as PDF
                  </button>
                </div>
              </div>

              {/* Share button */}
              <button
                disabled={selectedSources.length === 0}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-secondary hover:bg-secondary/80 transition-colors',
                  'text-sm font-medium min-h-[44px]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('sources', selectedSources.join(','));
                  navigator.clipboard.writeText(url.toString());
                  alert('Comparison link copied to clipboard!');
                }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Source Selector with responsive design */}
        <div className="mb-6">
          <SourceSelector
            sources={sources}
            selectedSources={selectedSources}
            onSourcesChange={setSelectedSources}
            maxSources={5}
            enablePlatformGrouping
          />
        </div>

        {selectedSources.length > 0 && (
          <>
            {/* Tab Navigation - responsive */}
            <div className="flex flex-wrap gap-2 mb-6 border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('charts')}
                className={cn(
                  'flex items-center gap-2 px-3 md:px-4 py-2.5 min-h-[44px] whitespace-nowrap',
                  'font-medium text-sm transition-colors',
                  activeTab === 'charts'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LineChart className="h-4 w-4" />
                <span className="hidden sm:inline">Time Series</span>
                <span className="sm:hidden">Charts</span>
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={cn(
                  'flex items-center gap-2 px-3 md:px-4 py-2.5 min-h-[44px] whitespace-nowrap',
                  'font-medium text-sm transition-colors',
                  activeTab === 'metrics'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TrendingUp className="h-4 w-4" />
                Metrics
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={cn(
                  'flex items-center gap-2 px-3 md:px-4 py-2.5 min-h-[44px] whitespace-nowrap',
                  'font-medium text-sm transition-colors',
                  activeTab === 'table'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Table className="h-4 w-4" />
                Table
              </button>
              <button
                onClick={() => setActiveTab('normalized')}
                className={cn(
                  'flex items-center gap-2 px-3 md:px-4 py-2.5 min-h-[44px] whitespace-nowrap',
                  'font-medium text-sm transition-colors',
                  activeTab === 'normalized'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">Normalized</span>
                <span className="sm:hidden">Norm</span>
              </button>
            </div>

            {/* Content based on active tab - responsive grid layouts */}
            {activeTab === 'charts' && (
              <div className="space-y-6">
                <ComparisonCharts
                  sources={selectedSourceObjects}
                  timeSeriesData={timeSeriesData as TimeSeriesData[]}
                  enableSideBySide
                  normalizeData={normalizationMethod !== 'none'}
                  aggregation={aggregation}
                />
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
                <MetricsCard
                  title="Total Posts"
                  description="Post volume comparison across sources"
                  metrics={metricData}
                  sources={selectedSourceObjects}
                  showSparkline
                  compareMode="absolute"
                />

                <MetricsCard
                  title="Relative Performance"
                  description="Percentage difference from baseline"
                  metrics={metricData}
                  sources={selectedSourceObjects}
                  compareMode="percentage"
                  baselineSourceId={selectedSources[0]}
                />

                <MetricsCard
                  title="Indexed Comparison"
                  description="All sources indexed to baseline (100)"
                  metrics={metricData}
                  sources={selectedSourceObjects}
                  compareMode="indexed"
                  baselineSourceId={selectedSources[0]}
                />

                <MetricsCard
                  title="Growth Metrics"
                  description="Period-over-period growth rates"
                  metrics={metricData}
                  sources={selectedSourceObjects}
                  format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                />
              </div>
            )}

            {activeTab === 'table' && (
              <div className="space-y-6">
                <MetricsTable
                  sources={selectedSourceObjects}
                  metricsData={metricsTableData}
                  normalizationMethod={normalizationMethod}
                  showStatistics
                  showInsights
                  baselineSourceId={selectedSources[0]}
                />
              </div>
            )}

            {activeTab === 'normalized' && (
              <div className="grid gap-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <NormalizedView
                    title="Normalized Comparison"
                    metrics={normalizedMetrics}
                    sources={selectedSourceObjects}
                    normalizationMethod={
                      normalizationMethod === 'none'
                        ? 'minmax'
                        : (normalizationMethod as 'minmax' | 'zscore' | 'percentile' | 'log')
                    }
                    showRawValues
                  />

                  <div className="space-y-4">
                    {/* Settings panel */}
                    <div className="rounded-lg border bg-card p-6">
                      <h3 className="text-lg font-semibold mb-4">Comparison Settings</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Normalization Method
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['minmax', 'zscore', 'robust', 'none'] as const).map((method) => (
                              <button
                                key={method}
                                onClick={() => setNormalizationMethod(method)}
                                className={cn(
                                  'px-3 py-2 rounded text-sm transition-colors',
                                  normalizationMethod === method
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary hover:bg-secondary/80'
                                )}
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

                        <div>
                          <label className="text-sm font-medium mb-2 block">Data Aggregation</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['daily', 'weekly', 'monthly'] as const).map((agg) => (
                              <button
                                key={agg}
                                onClick={() => setAggregation(agg)}
                                className={cn(
                                  'px-3 py-2 rounded text-sm capitalize transition-colors',
                                  aggregation === agg
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary hover:bg-secondary/80'
                                )}
                              >
                                {agg}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {selectedSources.length === 0 && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4 max-w-md">
              <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold mb-2">No Sources Selected</h3>
                <p className="text-muted-foreground">
                  Select sources from the dropdown above to start comparing metrics across platforms
                </p>
              </div>
              <div className="pt-4">
                <button
                  onClick={() => {
                    // Auto-select first 3 sources for demo
                    const demoSources = sources.slice(0, 3).map((s) => s.id);
                    setSelectedSources(demoSources);
                  }}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Load Demo Comparison
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
