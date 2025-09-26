/**
 * Comparison metrics utilities for normalized statistical analysis
 * Provides various normalization techniques and statistical insights
 */

import { Source } from '@/components/compare/SourceSelector';

// Types for comparison metrics
export interface MetricValue {
  sourceId: string;
  sourceName: string;
  rawValue: number;
  normalizedValue?: number;
  percentile?: number;
  zScore?: number;
  rank?: number;
}

export interface ComparisonMetric {
  name: string;
  label: string;
  values: MetricValue[];
  unit?: string;
  format?: (value: number) => string;
  higherIsBetter?: boolean;
}

export interface StatisticalSummary {
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  cv: number; // Coefficient of variation
  skewness?: number;
  kurtosis?: number;
}

export interface PerformanceInsight {
  sourceId: string;
  metric: string;
  insight: string;
  type: 'positive' | 'negative' | 'neutral';
  significance: 'high' | 'medium' | 'low';
}

// Normalization Methods

/**
 * Min-Max Normalization: Scales values to [0, 1] range
 * Formula: (x - min) / (max - min)
 */
export function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    // All values are the same
    return values.map(() => 0.5);
  }

  return values.map((v) => (v - min) / (max - min));
}

/**
 * Z-Score Standardization: Transforms to zero mean and unit variance
 * Formula: (x - μ) / σ
 */
export function zScoreNormalize(values: number[]): number[] {
  const mean = calculateMean(values);
  const stdDev = calculateStdDev(values, mean);

  if (stdDev === 0) {
    // No variation in data
    return values.map(() => 0);
  }

  return values.map((v) => (v - mean) / stdDev);
}

/**
 * Robust Scaling: Uses median and IQR, less sensitive to outliers
 * Formula: (x - median) / IQR
 */
export function robustScale(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const median = calculateMedian(sorted);
  const q1 = calculatePercentile(sorted, 25);
  const q3 = calculatePercentile(sorted, 75);
  const iqr = q3 - q1;

  if (iqr === 0) {
    // No interquartile range
    return values.map(() => 0);
  }

  return values.map((v) => (v - median) / iqr);
}

/**
 * Decimal Scaling: Scales by moving decimal point
 * Useful for preserving original distribution
 */
export function decimalScale(values: number[]): number[] {
  const maxAbs = Math.max(...values.map(Math.abs));
  if (maxAbs === 0) return values.map(() => 0);

  const j = Math.ceil(Math.log10(maxAbs));
  const divisor = Math.pow(10, j);

  return values.map((v) => v / divisor);
}

/**
 * Unit Vector Scaling: Normalizes to unit length
 * Formula: x / ||x||
 */
export function unitVectorScale(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));

  if (magnitude === 0) {
    return values.map(() => 0);
  }

  return values.map((v) => v / magnitude);
}

// Statistical Calculations

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function calculateMedian(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;

  const mid = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }

  return sortedValues[mid];
}

export function calculateStdDev(values: number[], mean?: number): number {
  if (values.length <= 1) return 0;

  const avg = mean ?? calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function calculatePercentileRank(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;

  let count = 0;
  for (const v of sortedValues) {
    if (v <= value) count++;
    else break;
  }

  return (count / sortedValues.length) * 100;
}

/**
 * Calculate comprehensive statistical summary
 */
export function calculateStatistics(values: number[]): StatisticalSummary {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      cv: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = calculateMean(values);
  const median = calculateMedian(sorted);
  const stdDev = calculateStdDev(values, mean);
  const variance = stdDev * stdDev;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = calculatePercentile(sorted, 25);
  const q3 = calculatePercentile(sorted, 75);
  const iqr = q3 - q1;
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  // Calculate skewness (Fisher-Pearson)
  let skewness: number | undefined;
  if (stdDev > 0 && values.length >= 3) {
    const n = values.length;
    const cubedDiffs = values.map((v) => Math.pow((v - mean) / stdDev, 3));
    skewness = (n / ((n - 1) * (n - 2))) * cubedDiffs.reduce((sum, v) => sum + v, 0);
  }

  // Calculate excess kurtosis
  let kurtosis: number | undefined;
  if (stdDev > 0 && values.length >= 4) {
    const n = values.length;
    const fourthDiffs = values.map((v) => Math.pow((v - mean) / stdDev, 4));
    const sum = fourthDiffs.reduce((sum, v) => sum + v, 0);
    kurtosis =
      (n * (n + 1) * sum) / ((n - 1) * (n - 2) * (n - 3)) -
      (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  }

  return {
    mean,
    median,
    stdDev,
    variance,
    min,
    max,
    q1,
    q3,
    iqr,
    cv,
    skewness,
    kurtosis,
  };
}

// Comparison Functions

/**
 * Compare metrics across sources with normalization
 */
export function compareMetrics(
  sources: Source[],
  metricData: Record<string, Record<string, number>>,
  normalizationMethod: 'minmax' | 'zscore' | 'robust' | 'none' = 'minmax'
): ComparisonMetric[] {
  const metrics: ComparisonMetric[] = [];

  for (const [metricName, sourceValues] of Object.entries(metricData)) {
    const values: MetricValue[] = [];
    const rawValues: number[] = [];

    // Collect raw values
    for (const source of sources) {
      const rawValue = sourceValues[source.id] || 0;
      rawValues.push(rawValue);
      values.push({
        sourceId: source.id,
        sourceName: source.name,
        rawValue,
      });
    }

    // Apply normalization
    let normalizedValues: number[] = [];
    switch (normalizationMethod) {
      case 'minmax':
        normalizedValues = minMaxNormalize(rawValues);
        break;
      case 'zscore':
        normalizedValues = zScoreNormalize(rawValues);
        break;
      case 'robust':
        normalizedValues = robustScale(rawValues);
        break;
      default:
        normalizedValues = rawValues;
    }

    // Calculate additional statistics
    const sorted = [...rawValues].sort((a, b) => a - b);

    // Assign normalized values and statistics
    values.forEach((v, i) => {
      v.normalizedValue = normalizedValues[i];
      v.percentile = calculatePercentileRank(v.rawValue, sorted);
      v.zScore = zScoreNormalize(rawValues)[i];
      v.rank = sorted.indexOf(v.rawValue) + 1;
    });

    // Sort by normalized value (descending)
    values.sort((a, b) => (b.normalizedValue || 0) - (a.normalizedValue || 0));

    metrics.push({
      name: metricName,
      label: formatMetricName(metricName),
      values,
      higherIsBetter: true, // Default assumption
    });
  }

  return metrics;
}

/**
 * Generate performance insights based on statistical analysis
 */
export function generateInsights(
  metrics: ComparisonMetric[],
  _threshold: number = 0.2 // 20% difference threshold
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  for (const metric of metrics) {
    const stats = calculateStatistics(metric.values.map((v) => v.rawValue));

    for (const value of metric.values) {
      // Check for outliers
      if (value.rawValue > stats.q3 + 1.5 * stats.iqr) {
        insights.push({
          sourceId: value.sourceId,
          metric: metric.name,
          insight: `Exceptional performance: ${value.sourceName} shows ${metric.label} significantly above others`,
          type: 'positive',
          significance: 'high',
        });
      } else if (value.rawValue < stats.q1 - 1.5 * stats.iqr) {
        insights.push({
          sourceId: value.sourceId,
          metric: metric.name,
          insight: `Below average: ${value.sourceName} shows lower ${metric.label} compared to peers`,
          type: 'negative',
          significance: 'medium',
        });
      }

      // Check for high performers (top 25%)
      if (value.percentile && value.percentile >= 75) {
        insights.push({
          sourceId: value.sourceId,
          metric: metric.name,
          insight: `Top performer: ${value.sourceName} ranks in top 25% for ${metric.label}`,
          type: 'positive',
          significance: 'medium',
        });
      }

      // Check for significant deviations
      if (value.zScore && Math.abs(value.zScore) > 2) {
        const direction = value.zScore > 0 ? 'above' : 'below';
        insights.push({
          sourceId: value.sourceId,
          metric: metric.name,
          insight: `Significant deviation: ${value.sourceName} is ${Math.abs(value.zScore).toFixed(1)} standard deviations ${direction} mean`,
          type: value.zScore > 0 ? 'positive' : 'negative',
          significance: 'high',
        });
      }
    }

    // Check for high variability
    if (stats.cv > 50) {
      insights.push({
        sourceId: 'all',
        metric: metric.name,
        insight: `High variability in ${metric.label} across sources (CV: ${stats.cv.toFixed(1)}%)`,
        type: 'neutral',
        significance: 'low',
      });
    }
  }

  return insights;
}

/**
 * Calculate relative performance between sources
 */
export function calculateRelativePerformance(
  baseSourceId: string,
  compareSourceId: string,
  metrics: ComparisonMetric[]
): Record<string, number> {
  const performance: Record<string, number> = {};

  for (const metric of metrics) {
    const baseValue = metric.values.find((v) => v.sourceId === baseSourceId);
    const compareValue = metric.values.find((v) => v.sourceId === compareSourceId);

    if (baseValue && compareValue && baseValue.rawValue !== 0) {
      // Calculate percentage difference
      performance[metric.name] =
        ((compareValue.rawValue - baseValue.rawValue) / baseValue.rawValue) * 100;
    }
  }

  return performance;
}

/**
 * Normalize metrics by time period for fair comparison
 */
export function normalizeByTimePeriod(
  value: number,
  days: number,
  targetPeriod: 'daily' | 'weekly' | 'monthly' = 'daily'
): number {
  if (days === 0) return 0;

  const dailyValue = value / days;

  switch (targetPeriod) {
    case 'weekly':
      return dailyValue * 7;
    case 'monthly':
      return dailyValue * 30;
    case 'daily':
    default:
      return dailyValue;
  }
}

/**
 * Format metric name for display
 */
function formatMetricName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Determine if higher values are better for a metric
 */
export function isHigherBetter(metricName: string): boolean {
  const lowerIsBetter = ['bounceRate', 'errorRate', 'downtime', 'latency', 'cost'];
  return !lowerIsBetter.some((metric) => metricName.toLowerCase().includes(metric.toLowerCase()));
}

/**
 * Calculate compound growth rate
 */
export function calculateCAGR(initialValue: number, finalValue: number, periods: number): number {
  if (initialValue <= 0 || periods <= 0) return 0;
  return (Math.pow(finalValue / initialValue, 1 / periods) - 1) * 100;
}
