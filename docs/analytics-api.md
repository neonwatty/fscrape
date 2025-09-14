# Analytics API Documentation

## Overview
The fscrape analytics module provides comprehensive data analysis capabilities for scraped forum data. This document details the API for programmatic access to analytics features.

## Core Modules

### Statistics Module
Statistical analysis functions for numerical data.

```typescript
import { StatisticsService } from './analytics/statistics';

const stats = new StatisticsService();

// Basic statistics
const basicStats = stats.getBasicStats(data);
// Returns: { mean, median, mode, stdDev, variance, min, max, range }

// Quartiles and percentiles
const quartiles = stats.getQuartiles(data);
// Returns: { q1, q2, q3, iqr }

const percentile = stats.getPercentile(data, 95);
// Returns: number

// Correlation analysis
const correlation = stats.getCorrelation(xData, yData);
// Returns: number between -1 and 1

// Distribution analysis
const distribution = stats.analyzeDistribution(data);
// Returns: { skewness, kurtosis, isNormal, histogram }
```

### Trend Analyzer
Detect and analyze trends in time-series data.

```typescript
import { TrendAnalyzer } from './analytics/trend-analyzer';

const analyzer = new TrendAnalyzer();

// Analyze trends
const result = analyzer.analyzeTrends(data, {
  windowSize: 7,
  minDataPoints: 10,
  includeSeasonality: true
});
// Returns: {
//   trend: 'increasing' | 'decreasing' | 'stable',
//   slope: number,
//   confidence: number,
//   changePoints: Array<{index, magnitude}>,
//   seasonality: { period, strength },
//   predictions: { values, confidence }
// }

// Detect change points
const changePoints = analyzer.detectChangePoints(data, {
  sensitivity: 'medium',
  method: 'cusum'
});
// Returns: Array<{index, timestamp, magnitude, type}>

// Seasonal pattern analysis
const seasonal = analyzer.analyzeSeasonalPatterns(data, {
  periods: [7, 30, 365], // daily, monthly, yearly
  minStrength: 0.3
});
// Returns: { patterns: Array<{period, strength, phase}> }
```

### Anomaly Detector
Identify outliers and anomalies in data.

```typescript
import { AnomalyDetector } from './analytics/anomaly-detector';

const detector = new AnomalyDetector();

// Detect anomalies
const anomalies = detector.detectAnomalies(data, {
  method: 'statistical',
  sensitivity: 0.95,
  contextWindow: 10
});
// Returns: Array<{
//   index: number,
//   value: number,
//   score: number,
//   type: 'outlier' | 'contextual' | 'collective'
// }>

// Statistical detection
const statistical = detector.detectStatisticalAnomalies(data, {
  threshold: 3, // z-score threshold
});

// IQR-based detection
const iqrAnomalies = detector.detectIQRAnomalies(data, {
  multiplier: 1.5
});

// Streaming detection
const stream = detector.createStreamingDetector({
  windowSize: 100,
  updateThreshold: 10
});
stream.addPoint(value);
const isAnomaly = stream.isAnomaly(value);
```

### Forecasting Service
Predict future values based on historical data.

```typescript
import { ForecastingService } from './analytics/forecasting';

const forecaster = new ForecastingService();

// Generate forecast
const forecast = forecaster.forecast(historicalData, {
  method: 'auto', // or 'linear', 'exponential', 'arima'
  horizon: 30,
  confidence: 0.95
});
// Returns: {
//   predictions: Array<{timestamp, value, lower, upper}>,
//   method: string,
//   accuracy: { mape, rmse, mae },
//   confidence: number
// }

// Linear regression
const linear = forecaster.linearRegression(data, horizon);

// Exponential smoothing
const exponential = forecaster.exponentialSmoothing(data, {
  alpha: 0.3,
  horizon: 10
});

// Moving average
const movingAvg = forecaster.movingAverage(data, {
  window: 7,
  horizon: 14
});

// ARIMA-like forecasting
const arima = forecaster.arimaForecast(data, {
  p: 1, // autoregressive order
  d: 1, // differencing order
  q: 1, // moving average order
  horizon: 30
});
```

### Cache Layer
Performance optimization through intelligent caching.

```typescript
import { CacheLayer } from './analytics/cache-layer';

const cache = new CacheLayer({
  maxMemorySize: 100 * 1024 * 1024, // 100MB
  ttl: 3600, // 1 hour
  diskCache: {
    enabled: true,
    directory: '.cache',
    maxSize: 500 * 1024 * 1024 // 500MB
  }
});

// Cache operations
await cache.set('key', data, { ttl: 1800 });
const cached = await cache.get('key');
await cache.invalidate('key');
await cache.clear();

// Cache statistics
const stats = cache.getStats();
// Returns: { hits, misses, hitRate, memoryUsage, diskUsage }
```

### Visualizer
Terminal-based data visualization.

```typescript
import { Visualizer } from './analytics/visualizer';

const viz = new Visualizer({
  width: 80,
  height: 20,
  colors: true
});

// Sparkline chart
const sparkline = viz.sparkline(data, {
  width: 40,
  height: 1
});

// Bar chart
const barChart = viz.barChart(data, {
  labels: ['Mon', 'Tue', 'Wed'],
  orientation: 'vertical'
});

// Line chart
const lineChart = viz.lineChart(data, {
  title: 'Trend Over Time',
  xLabel: 'Date',
  yLabel: 'Count'
});

// Table
const table = viz.table(data, {
  headers: ['Date', 'Count', 'Change'],
  alignment: ['left', 'right', 'right']
});

// Heatmap
const heatmap = viz.heatmap(matrix, {
  colorScale: 'viridis'
});
```

### Dashboard
Comprehensive analytics dashboard.

```typescript
import { Dashboard } from './analytics/dashboard';

const dashboard = new Dashboard();

// Generate full dashboard
const result = await dashboard.generate({
  data: timeSeriesData,
  metrics: ['posts', 'comments', 'users'],
  analyses: ['trends', 'anomalies', 'forecast'],
  visualization: true
});

// Display in terminal
dashboard.display(result);

// Export to file
await dashboard.export(result, {
  format: 'html',
  filename: 'analytics-report.html'
});
```

## Usage Examples

### Complete Analytics Pipeline

```typescript
import {
  StatisticsService,
  TrendAnalyzer,
  AnomalyDetector,
  ForecastingService,
  Visualizer
} from './analytics';

async function analyzeForumData(posts) {
  // 1. Basic statistics
  const stats = new StatisticsService();
  const summary = stats.getBasicStats(posts.map(p => p.commentCount));

  // 2. Trend analysis
  const trends = new TrendAnalyzer();
  const trendResult = trends.analyzeTrends(
    posts.map(p => ({ date: p.createdAt, value: p.viewCount }))
  );

  // 3. Anomaly detection
  const detector = new AnomalyDetector();
  const anomalies = detector.detectAnomalies(
    posts.map(p => p.score),
    { method: 'statistical' }
  );

  // 4. Forecasting
  const forecaster = new ForecastingService();
  const forecast = forecaster.forecast(
    posts.map(p => p.commentCount),
    { horizon: 7 }
  );

  // 5. Visualization
  const viz = new Visualizer();
  console.log(viz.sparkline(forecast.predictions));

  return {
    statistics: summary,
    trends: trendResult,
    anomalies: anomalies,
    forecast: forecast
  };
}
```

### Streaming Analytics

```typescript
import { AnomalyDetector, TrendAnalyzer } from './analytics';

class StreamingAnalytics {
  constructor() {
    this.detector = new AnomalyDetector().createStreamingDetector({
      windowSize: 100
    });
    this.trendBuffer = [];
    this.analyzer = new TrendAnalyzer();
  }

  processNewPost(post) {
    // Check for anomalies
    const isAnomaly = this.detector.isAnomaly(post.score);

    // Update trend buffer
    this.trendBuffer.push({
      timestamp: post.createdAt,
      value: post.commentCount
    });

    // Analyze trends every 10 posts
    if (this.trendBuffer.length % 10 === 0) {
      const trend = this.analyzer.analyzeTrends(this.trendBuffer);
      console.log('Current trend:', trend.trend);
    }

    return { isAnomaly };
  }
}
```

### Custom Configuration

```typescript
import { validateAnalyticsConfig } from './config/analytics-config';

const customConfig = validateAnalyticsConfig({
  cache: {
    enabled: true,
    memoryMaxSize: 200, // 200MB
    ttl: 7200 // 2 hours
  },
  trends: {
    minDataPoints: 20,
    confidenceThreshold: 0.99,
    changePointSensitivity: 'high'
  },
  anomalies: {
    enabled: true,
    methods: ['statistical', 'iqr', 'zscore'],
    sensitivity: 0.99
  }
});

// Use custom config in analytics modules
const analyzer = new TrendAnalyzer(customConfig.trends);
const detector = new AnomalyDetector(customConfig.anomalies);
```

## Error Handling

All analytics functions include comprehensive error handling:

```typescript
try {
  const result = analyzer.analyzeTrends(data);
} catch (error) {
  if (error.code === 'INSUFFICIENT_DATA') {
    console.error(`Need at least ${error.required} data points`);
  } else if (error.code === 'INVALID_PARAMETER') {
    console.error(`Invalid parameter: ${error.parameter}`);
  } else {
    console.error('Analytics error:', error.message);
  }
}
```

## Performance Considerations

- **Large Datasets**: Use sampling for datasets over 100K points
- **Caching**: Enable caching for repeated analyses
- **Streaming**: Use streaming APIs for real-time data
- **Parallel Processing**: Enable for multi-core utilization

## API Stability

This API follows semantic versioning:
- Major version: Breaking changes
- Minor version: New features, backward compatible
- Patch version: Bug fixes

Current version: 1.0.0