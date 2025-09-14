# Analytics API Documentation

This document provides comprehensive API documentation for all analytics modules, including TypeScript interfaces, function parameters, and return types.

## Table of Contents

1. [Statistics Module](#statistics-module)
2. [Anomaly Detector Module](#anomaly-detector-module)
3. [Trend Analyzer Module](#trend-analyzer-module)
4. [Forecasting Module](#forecasting-module)
5. [Visualizer Module](#visualizer-module)
6. [Report Generator Module](#report-generator-module)
7. [Dashboard Module](#dashboard-module)
8. [SVG Generator Module](#svg-generator-module)
9. [Cache Layer Module](#cache-layer-module)
10. [Cached Analytics Module](#cached-analytics-module)
11. [Terminal Visualizer Module](#terminal-visualizer-module)

---

## Statistics Module

**Import:** `import { StatisticsEngine } from "./analytics/statistics.js"`

### Interfaces

#### StatisticalSummary
```typescript
interface StatisticalSummary {
  mean: number;
  median: number;
  mode: number | null;
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  quartiles: {
    q1: number;
    q2: number;
    q3: number;
  };
  iqr: number;
  outliers: number[];
  skewness: number;
  kurtosis: number;
}
```

#### CorrelationResult
```typescript
interface CorrelationResult {
  correlation: number;
  pValue: number;
  strength: "strong" | "moderate" | "weak" | "none";
  direction: "positive" | "negative" | "none";
}
```

#### RegressionResult
```typescript
interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  predictions: number[];
  residuals: number[];
}
```

#### TimeSeriesPoint
```typescript
interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}
```

### Class: StatisticsEngine

#### Static Methods

##### calculateMean
```typescript
static calculateMean(values: number[]): number
```
Calculates the arithmetic mean of an array of numbers.

##### calculateMedian
```typescript
static calculateMedian(values: number[]): number
```
Calculates the median value of an array of numbers.

##### calculateMode
```typescript
static calculateMode(values: number[]): number | null
```
Calculates the mode (most frequent value). Returns null if no value appears more than once.

##### calculateVariance
```typescript
static calculateVariance(values: number[]): number
```
Calculates the variance of an array of numbers.

##### calculateStandardDeviation
```typescript
static calculateStandardDeviation(values: number[]): number
```
Calculates the standard deviation of an array of numbers.

##### calculateQuartiles
```typescript
static calculateQuartiles(values: number[]): { q1: number; q2: number; q3: number }
```
Calculates the first, second (median), and third quartiles.

##### detectOutliers
```typescript
static detectOutliers(values: number[], threshold?: number): number[]
```
Detects outliers using the IQR method.
- **threshold**: Multiplier for IQR (default: 1.5)

##### calculateSkewness
```typescript
static calculateSkewness(values: number[]): number
```
Calculates the skewness of the distribution.

##### calculateKurtosis
```typescript
static calculateKurtosis(values: number[]): number
```
Calculates the kurtosis of the distribution.

##### getSummary
```typescript
static getSummary(values: number[]): StatisticalSummary
```
Returns a comprehensive statistical summary.

##### calculateCorrelation
```typescript
static calculateCorrelation(x: number[], y: number[]): CorrelationResult
```
Calculates Pearson correlation coefficient between two arrays.

##### linearRegression
```typescript
static linearRegression(x: number[], y: number[]): RegressionResult
```
Performs linear regression analysis.

##### movingAverage
```typescript
static movingAverage(values: number[], windowSize: number): number[]
```
Calculates moving average with specified window size.

##### exponentialSmoothing
```typescript
static exponentialSmoothing(values: number[], alpha?: number): number[]
```
Applies exponential smoothing to time series data.
- **alpha**: Smoothing factor between 0 and 1 (default: 0.3)

##### detectSeasonality
```typescript
static detectSeasonality(
  timeSeries: TimeSeriesPoint[],
  periodDays?: number
): {
  hasSeasonality: boolean;
  strength: number;
  pattern: number[];
}
```
Detects seasonal patterns in time series data.
- **periodDays**: Expected period length (default: 7)

##### calculateZScore
```typescript
static calculateZScore(value: number, mean: number, stdDev: number): number
```
Calculates the z-score for a value.

##### normalizeValues
```typescript
static normalizeValues(values: number[]): number[]
```
Normalizes values to 0-1 range.

##### standardizeValues
```typescript
static standardizeValues(values: number[]): number[]
```
Standardizes values (z-score normalization).

---

## Anomaly Detector Module

**Import:** `import { AnomalyDetector } from "./analytics/anomaly-detector.js"`

### Types and Interfaces

#### AnomalyType
```typescript
type AnomalyType = "spike" | "dip" | "trend_break" | "unusual_pattern" | "outlier";
```

#### AnomalySeverity
```typescript
type AnomalySeverity = "low" | "medium" | "high" | "critical";
```

#### DetectionMethod
```typescript
type DetectionMethod = "zscore" | "iqr" | "isolation_forest" | "mad" | "ensemble";
```

#### Anomaly
```typescript
interface Anomaly {
  index: number;
  value: number;
  timestamp?: Date;
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number;
  method: DetectionMethod;
  context?: {
    expected: number;
    deviation: number;
    percentile: number;
  };
}
```

#### AnomalyDetectorConfig
```typescript
interface AnomalyDetectorConfig {
  sensitivity?: number;        // 0-1, higher = more sensitive
  methods?: DetectionMethod[]; // Methods to use
  contextWindow?: number;      // Window for contextual analysis
  minDataPoints?: number;      // Minimum points needed
  adaptiveThreshold?: boolean; // Use adaptive thresholds
  seasonalPeriod?: number;     // Period for seasonal adjustment
}
```

#### AnomalyDetectionResult
```typescript
interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  statistics: {
    totalPoints: number;
    anomalyRate: number;
    methods: DetectionMethod[];
    thresholds: Record<string, number>;
  };
  confidence: number;
}
```

#### EngagementMetrics
```typescript
interface EngagementMetrics {
  timestamp: Date;
  posts: number;
  comments: number;
  likes: number;
  shares: number;
  activeUsers: number;
  newUsers: number;
  [key: string]: number | Date;
}
```

### Class: AnomalyDetector

#### Constructor
```typescript
constructor(config?: AnomalyDetectorConfig)
```
Creates new anomaly detector with optional configuration.

#### Methods

##### detect
```typescript
detect(values: number[], timestamps?: Date[]): AnomalyDetectionResult
```
Main anomaly detection method for numeric arrays.

##### detectTimeSeries
```typescript
detectTimeSeries(timeSeries: TimeSeriesPoint[]): AnomalyDetectionResult
```
Detects anomalies in time series data with seasonal adjustment.

##### detectEngagementAnomalies
```typescript
detectEngagementAnomalies(
  metrics: EngagementMetrics[]
): Map<string, AnomalyDetectionResult>
```
Detects anomalies in engagement patterns across multiple metrics.

---

## Trend Analyzer Module

**Import:** `import { TrendAnalyzer } from "./analytics/trend-analyzer.js"`

### Interfaces

#### TrendResult
```typescript
interface TrendResult {
  trend: "increasing" | "decreasing" | "stable" | "volatile";
  slope: number;
  strength: number;
  confidence: number;
  changePercent: number;
  volatility: number;
  predictions: {
    nextValue: number;
    confidence: number;
    range: { min: number; max: number };
  };
}
```

#### ChangePoint
```typescript
interface ChangePoint {
  index: number;
  timestamp?: Date;
  value: number;
  magnitude: number;
  type: "increase" | "decrease";
}
```

#### SeasonalPattern
```typescript
interface SeasonalPattern {
  period: number;
  strength: number;
  pattern: number[];
  nextPrediction: number;
}
```

#### TrendAnalysisOptions
```typescript
interface TrendAnalysisOptions {
  windowSize?: number;
  smoothingFactor?: number;
  confidenceLevel?: number;
  minTrendStrength?: number;
  seasonalityPeriod?: number;
  anomalyThreshold?: number;
}
```

### Class: TrendAnalyzer

#### Constructor
```typescript
constructor(options?: TrendAnalysisOptions)
```
Creates trend analyzer with optional configuration.

#### Methods

##### analyzeTrend
```typescript
analyzeTrend(values: number[], timestamps?: Date[]): TrendResult
```
Analyzes trend in numeric data series.

##### detectChangePoints
```typescript
detectChangePoints(values: number[], timestamps?: Date[]): ChangePoint[]
```
Detects significant changes in trend direction or magnitude.

##### analyzeTimeSeries
```typescript
analyzeTimeSeries(timeSeries: TimeSeriesPoint[]): TrendResult
```
Analyzes trend in time series data.

##### predictNextValues
```typescript
predictNextValues(values: number[], periods: number): number[]
```
Predicts future values based on trend analysis.

##### detectSeasonalPattern
```typescript
detectSeasonalPattern(values: number[], period?: number): SeasonalPattern | null
```
Detects seasonal patterns in data.

---

## Forecasting Module

**Import:** `import { ForecastingEngine } from "./analytics/forecasting.js"`

### Types and Interfaces

#### ForecastModel
```typescript
type ForecastModel =
  | "linear_trend"
  | "seasonal_naive"
  | "exponential_smoothing"
  | "holt_winters"
  | "moving_average"
  | "auto";
```

#### ForecastConfig
```typescript
interface ForecastConfig {
  model?: ForecastModel;
  horizon?: number;           // Number of periods to forecast
  confidence?: number;        // Confidence level (0-1)
  seasonalPeriod?: number;    // Period for seasonal patterns
  alpha?: number;            // Smoothing parameter (0-1)
  beta?: number;             // Trend smoothing parameter (0-1)
  gamma?: number;            // Seasonal smoothing parameter (0-1)
  includeHistory?: boolean;  // Include historical data in result
  splitRatio?: number;       // Train/test split ratio (0-1)
}
```

#### ForecastPoint
```typescript
interface ForecastPoint {
  timestamp?: Date;
  index: number;
  value: number;
  lower: number;  // Lower confidence bound
  upper: number;  // Upper confidence bound
  model: ForecastModel;
}
```

#### ForecastResult
```typescript
interface ForecastResult {
  forecast: ForecastPoint[];
  accuracy?: AccuracyMetrics;
  model: ForecastModel;
  parameters: Record<string, number>;
  historical?: number[];
  residuals?: number[];
  seasonalComponent?: number[];
  trendComponent?: number[];
}
```

#### AccuracyMetrics
```typescript
interface AccuracyMetrics {
  mae: number;   // Mean Absolute Error
  mse: number;   // Mean Squared Error
  rmse: number;  // Root Mean Squared Error
  mape: number;  // Mean Absolute Percentage Error
  smape: number; // Symmetric Mean Absolute Percentage Error
  mase: number;  // Mean Absolute Scaled Error
  r2: number;    // R-squared coefficient
}
```

### Class: ForecastingEngine

#### Constructor
```typescript
constructor(config?: ForecastConfig)
```
Creates forecasting engine with optional configuration.

#### Methods

##### forecast
```typescript
forecast(values: number[], timestamps?: Date[]): ForecastResult
```
Generates forecast for numeric data series.

##### forecastTimeSeries
```typescript
forecastTimeSeries(timeSeries: TimeSeriesPoint[]): ForecastResult
```
Generates forecast for time series data.

##### evaluateModel
```typescript
evaluateModel(
  values: number[],
  model?: ForecastModel
): AccuracyMetrics
```
Evaluates forecast model accuracy using train/test split.

##### selectBestModel
```typescript
selectBestModel(values: number[]): ForecastModel
```
Automatically selects best model based on data characteristics.

---

## Visualizer Module

**Import:** `import { AnalyticsVisualizer } from "./analytics/visualizer.js"`

### Interfaces

#### ChartOptions
```typescript
interface ChartOptions {
  width?: number;
  height?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: boolean;
  style?: "simple" | "detailed" | "minimal";
  showTrends?: boolean;
  showStatistics?: boolean;
  colorScheme?: "default" | "vibrant" | "monochrome";
}
```

#### DataPoint
```typescript
interface DataPoint {
  date?: Date;
  label?: string;
  value: number;
  category?: string;
}
```

#### MultiSeriesData
```typescript
interface MultiSeriesData {
  label: string;
  [key: string]: any;
}
```

### Class: AnalyticsVisualizer

#### Methods

##### createLineChart
```typescript
createLineChart(
  data: DataPoint[],
  title?: string,
  options?: ChartOptions
): string
```
Creates ASCII line chart visualization.

##### createBarChart
```typescript
createBarChart(
  data: DataPoint[],
  title?: string,
  options?: ChartOptions
): string
```
Creates ASCII bar chart visualization.

##### createHeatmap
```typescript
createHeatmap(
  data: number[][],
  labels?: { rows: string[]; cols: string[] },
  options?: ChartOptions
): string
```
Creates ASCII heatmap visualization.

##### createSparkline
```typescript
createSparkline(values: number[], width?: number): string
```
Creates compact sparkline visualization.

##### createTable
```typescript
createTable(
  data: any[],
  columns?: string[],
  options?: ChartOptions
): string
```
Creates formatted table visualization.

##### createMultiSeriesChart
```typescript
createMultiSeriesChart(
  data: MultiSeriesData[],
  title?: string,
  options?: ChartOptions
): string
```
Creates multi-series comparison chart.

---

## Report Generator Module

**Import:** `import { ReportGenerator } from "./analytics/report-generator.js"`

### Interfaces

#### ReportConfig
```typescript
interface ReportConfig {
  includeCharts?: boolean;
  includeRawData?: boolean;
  includeSummary?: boolean;
  includeRecommendations?: boolean;
  dateFormat?: "short" | "long" | "iso";
  numberFormat?: "standard" | "compact" | "scientific";
  template?: ReportTemplate;
  customCSS?: string;
  headerFooter?: {
    header?: string;
    footer?: string;
    logo?: string;
  };
}
```

#### ReportSection
```typescript
interface ReportSection {
  title: string;
  content: string | any;
  priority: "high" | "medium" | "low";
  type: "text" | "data" | "chart" | "table";
}
```

#### GeneratedReport
```typescript
interface GeneratedReport {
  title: string;
  generatedAt: Date;
  sections: ReportSection[];
  metadata: {
    dataRange?: { start: Date; end: Date };
    platforms?: string[];
    recordCount?: number;
  };
  format: string;
  content: string;
}
```

#### ReportTemplate
```typescript
interface ReportTemplate {
  name: string;
  description?: string;
  sections: TemplateSection[];
  layout?: "single-column" | "two-column" | "dashboard";
  theme?: "light" | "dark" | "custom";
  customStyles?: string;
}
```

#### ScheduledReport
```typescript
interface ScheduledReport {
  id: string;
  name: string;
  template: ReportTemplate | string;
  schedule: ReportSchedule;
  recipients?: string[];
  format: "html" | "markdown" | "json" | "pdf";
  config?: ReportConfig;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}
```

#### ReportSchedule
```typescript
interface ReportSchedule {
  type: "daily" | "weekly" | "monthly" | "custom";
  time?: string;         // HH:MM format
  dayOfWeek?: number;    // 0-6 for weekly
  dayOfMonth?: number;   // 1-31 for monthly
  cronExpression?: string; // For custom schedules
}
```

### Class: ReportGenerator

#### Constructor
```typescript
constructor(analytics: DatabaseAnalytics, config?: ReportConfig)
```
Creates report generator with database analytics and configuration.

#### Methods

##### generateReport
```typescript
generateReport(
  title: string,
  data: any,
  config?: ReportConfig
): GeneratedReport
```
Generates comprehensive analytics report.

##### generateMarkdownReport
```typescript
generateMarkdownReport(
  title: string,
  metrics: DashboardMetrics,
  config?: ReportConfig
): string
```
Generates report in Markdown format.

##### generateHTMLReport
```typescript
generateHTMLReport(
  title: string,
  metrics: DashboardMetrics,
  config?: ReportConfig
): string
```
Generates report in HTML format.

##### generateJSONReport
```typescript
generateJSONReport(
  title: string,
  metrics: DashboardMetrics,
  config?: ReportConfig
): string
```
Generates report in JSON format.

##### registerTemplate
```typescript
registerTemplate(template: ReportTemplate): void
```
Registers custom report template.

##### scheduleReport
```typescript
scheduleReport(report: ScheduledReport): void
```
Schedules automatic report generation.

---

## Dashboard Module

**Import:** `import { AnalyticsDashboard } from "./analytics/dashboard.js"`

### Interfaces

#### DashboardConfig
```typescript
interface DashboardConfig {
  refreshInterval?: number;    // in milliseconds
  maxDataPoints?: number;
  platforms?: Platform[];
  enableAutoRefresh?: boolean;
}
```

#### DashboardMetrics
```typescript
interface DashboardMetrics {
  overview: {
    totalPosts: number;
    totalComments: number;
    totalUsers: number;
    avgEngagement: number;
    growthRate: number;
  };
  platformBreakdown: Map<Platform, PlatformStats>;
  trending: TrendingPost[];
  timeSeries: TimeSeriesData[];
  topPerformers: {
    posts: TrendingPost[];
    authors: Array<{
      author: string;
      metrics: {
        postCount: number;
        totalScore: number;
        avgScore: number;
      };
    }>;
  };
  health: {
    databaseSize: number;
    lastUpdate: Date;
    dataQuality: number; // 0-100 score
    gaps: Array<{
      platform: Platform;
      startDate: Date;
      endDate: Date;
      gapDays: number;
    }>;
  };
}
```

#### DashboardFilter
```typescript
interface DashboardFilter {
  platforms?: Platform[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  metrics?: string[];
  sortBy?: "score" | "engagement" | "date" | "comments";
  limit?: number;
}
```

### Class: AnalyticsDashboard

#### Constructor
```typescript
constructor(analytics: DatabaseAnalytics, config?: DashboardConfig)
```
Creates analytics dashboard with database connection.

#### Methods

##### getMetrics
```typescript
async getMetrics(filter?: DashboardFilter): Promise<DashboardMetrics>
```
Retrieves comprehensive dashboard metrics.

##### displayDashboard
```typescript
async displayDashboard(filter?: DashboardFilter): Promise<void>
```
Displays interactive dashboard in terminal.

##### startAutoRefresh
```typescript
startAutoRefresh(): void
```
Starts automatic dashboard refresh.

##### stopAutoRefresh
```typescript
stopAutoRefresh(): void
```
Stops automatic dashboard refresh.

##### exportDashboard
```typescript
async exportDashboard(
  format: "html" | "markdown" | "json",
  filepath?: string
): Promise<string>
```
Exports dashboard to specified format.

---

## SVG Generator Module

**Import:** `import { SvgGenerator } from "./analytics/svg-generator.js"`

### Interfaces

#### SvgChartOptions
```typescript
interface SvgChartOptions {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltips?: boolean;
  animation?: boolean;
  theme?: "light" | "dark" | "custom";
  customColors?: {
    background?: string;
    text?: string;
    grid?: string;
    axis?: string;
  };
}
```

#### SvgElement
```typescript
interface SvgElement {
  tag: string;
  attributes: Record<string, string | number>;
  children?: (SvgElement | string)[];
}
```

### Class: SvgGenerator

#### Constructor
```typescript
constructor(options?: SvgChartOptions)
```
Creates SVG generator with default options.

#### Methods

##### generateLineChart
```typescript
generateLineChart(
  data: Array<{ x: number | Date; y: number; label?: string }>,
  title?: string,
  options?: SvgChartOptions
): string
```
Generates SVG line chart.

##### generateBarChart
```typescript
generateBarChart(
  data: Array<{ label: string; value: number; color?: string }>,
  title?: string,
  options?: SvgChartOptions
): string
```
Generates SVG bar chart.

##### generatePieChart
```typescript
generatePieChart(
  data: Array<{ label: string; value: number; color?: string }>,
  title?: string,
  options?: SvgChartOptions
): string
```
Generates SVG pie chart.

##### generateScatterPlot
```typescript
generateScatterPlot(
  data: Array<{ x: number; y: number; label?: string; size?: number }>,
  title?: string,
  options?: SvgChartOptions
): string
```
Generates SVG scatter plot.

##### generateHeatmap
```typescript
generateHeatmap(
  data: number[][],
  labels?: { rows: string[]; cols: string[] },
  title?: string,
  options?: SvgChartOptions
): string
```
Generates SVG heatmap visualization.

---

## Cache Layer Module

**Import:** `import { CacheLayer } from "./analytics/cache-layer.js"`

### Interfaces

#### CacheConfig
```typescript
interface CacheConfig {
  defaultTTL?: number;           // Default TTL in milliseconds
  maxSize?: number;              // Maximum cache size in bytes
  maxEntries?: number;           // Maximum number of entries
  cleanupInterval?: number;      // Cleanup interval in milliseconds
  enableMetrics?: boolean;       // Enable cache metrics collection
  compressionThreshold?: number; // Size threshold for compression
}
```

#### CacheStats
```typescript
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
  avgEntrySize: number;
  topKeys: Array<{ key: string; hits: number }>;
}
```

### Enums

#### CacheDependency
```typescript
enum CacheDependency {
  DATA = "data",           // Raw data changes
  TIME_RANGE = "time",     // Time range changes
  PLATFORM = "platform",   // Platform filter changes
  CONFIG = "config",       // Configuration changes
  USER = "user",          // User-specific data
}
```

### Class: CacheLayer

#### Constructor
```typescript
constructor(config?: CacheConfig)
```
Creates cache layer with optional configuration.

#### Methods

##### get
```typescript
get<T>(key: string): T | undefined
```
Retrieves value from cache.

##### set
```typescript
set<T>(
  key: string,
  value: T,
  ttl?: number,
  dependencies?: CacheDependency[]
): void
```
Stores value in cache with optional TTL and dependencies.

##### delete
```typescript
delete(key: string): boolean
```
Removes entry from cache.

##### clear
```typescript
clear(): void
```
Clears all cache entries.

##### invalidate
```typescript
invalidate(dependency: CacheDependency): number
```
Invalidates all entries with specified dependency.

##### getStats
```typescript
getStats(): CacheStats
```
Returns cache statistics.

##### has
```typescript
has(key: string): boolean
```
Checks if key exists in cache.

---

## Cached Analytics Module

**Import:** `import { CachedAnalyticsService } from "./analytics/cached-analytics.js"`

### Class: CachedAnalyticsService

#### Constructor
```typescript
constructor(analytics: DatabaseAnalytics, options?: any)
```
Creates cached analytics service wrapping database analytics.

#### Methods

##### getPlatformStats
```typescript
getPlatformStats(
  platform?: Platform,
  dateRange?: { start: Date; end: Date }
): any
```
Gets platform statistics with caching.

##### getTrendingPosts
```typescript
getTrendingPosts(
  platform?: Platform,
  limit?: number,
  dateRange?: { start: Date; end: Date }
): any
```
Gets trending posts with caching.

##### getTimeSeriesData
```typescript
getTimeSeriesData(
  metric: string,
  platform?: Platform,
  interval?: string,
  dateRange?: { start: Date; end: Date }
): any
```
Gets time series data with caching.

##### invalidateCache
```typescript
invalidateCache(dependency?: CacheDependency): void
```
Invalidates cache entries.

##### getCacheStats
```typescript
getCacheStats(): CacheStats
```
Returns cache statistics.

##### setCacheEnabled
```typescript
setCacheEnabled(enabled: boolean): void
```
Enables or disables caching.

---

## Terminal Visualizer Module

**Import:** `import { TerminalVisualizer } from "./analytics/terminal-visualizer.js"`

### Interfaces

#### TerminalChartOptions
```typescript
interface TerminalChartOptions {
  width?: number;
  height?: number;
  useColors?: boolean;
  useUnicode?: boolean;
  style?: "minimal" | "standard" | "rich";
  colorScheme?: "default" | "vibrant" | "pastel" | "monochrome";
}
```

#### ColorPalette
```typescript
interface ColorPalette {
  primary: typeof chalk;
  secondary: typeof chalk;
  accent: typeof chalk;
  success: typeof chalk;
  warning: typeof chalk;
  error: typeof chalk;
  info: typeof chalk;
  muted: typeof chalk;
}
```

### Class: TerminalVisualizer

#### Methods

##### createRichLineChart
```typescript
createRichLineChart(
  data: Array<{ value: number; label?: string }>,
  title?: string,
  options?: TerminalChartOptions
): string
```
Creates enhanced line chart with colors and Unicode.

##### createRichBarChart
```typescript
createRichBarChart(
  data: Array<{ label: string; value: number }>,
  title?: string,
  options?: TerminalChartOptions
): string
```
Creates enhanced bar chart with colors and Unicode.

##### createProgressBar
```typescript
createProgressBar(
  progress: number,
  label?: string,
  width?: number,
  showPercentage?: boolean
): string
```
Creates colored progress bar visualization.

##### createSparkline
```typescript
createSparkline(
  values: number[],
  width?: number,
  useColors?: boolean
): string
```
Creates compact sparkline with optional colors.

##### createBox
```typescript
createBox(
  content: string,
  title?: string,
  style?: "single" | "double" | "rounded",
  color?: string
): string
```
Creates boxed content with Unicode borders.

##### createTable
```typescript
createTable(
  data: any[],
  headers?: string[],
  options?: TerminalChartOptions
): string
```
Creates formatted table with colors and borders.

##### formatMetric
```typescript
formatMetric(
  label: string,
  value: number | string,
  unit?: string,
  color?: string
): string
```
Formats metric display with colors and alignment.

---

## Usage Examples

### Basic Statistical Analysis
```typescript
import { StatisticsEngine } from "./analytics/statistics.js";

const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const summary = StatisticsEngine.getSummary(data);
console.log(`Mean: ${summary.mean}`);
console.log(`Median: ${summary.median}`);
console.log(`Std Dev: ${summary.standardDeviation}`);
```

### Anomaly Detection
```typescript
import { AnomalyDetector } from "./analytics/anomaly-detector.js";

const detector = new AnomalyDetector({
  sensitivity: 0.7,
  methods: ["zscore", "iqr", "ensemble"]
});

const values = [10, 12, 11, 13, 100, 14, 12, 13, 11];
const result = detector.detect(values);

result.anomalies.forEach(anomaly => {
  console.log(`Anomaly at index ${anomaly.index}: ${anomaly.value}`);
  console.log(`Severity: ${anomaly.severity}, Type: ${anomaly.type}`);
});
```

### Trend Analysis
```typescript
import { TrendAnalyzer } from "./analytics/trend-analyzer.js";

const analyzer = new TrendAnalyzer({
  windowSize: 7,
  smoothingFactor: 0.3
});

const values = [100, 105, 103, 108, 112, 118, 125, 130];
const trend = analyzer.analyzeTrend(values);

console.log(`Trend: ${trend.trend}`);
console.log(`Slope: ${trend.slope}`);
console.log(`Next prediction: ${trend.predictions.nextValue}`);
```

### Forecasting
```typescript
import { ForecastingEngine } from "./analytics/forecasting.js";

const engine = new ForecastingEngine({
  model: "holt_winters",
  horizon: 5,
  confidence: 0.95
});

const historicalData = [100, 105, 110, 108, 115, 120, 118, 125];
const forecast = engine.forecast(historicalData);

forecast.forecast.forEach(point => {
  console.log(`Period ${point.index}: ${point.value}`);
  console.log(`Confidence interval: [${point.lower}, ${point.upper}]`);
});
```

### Dashboard Creation
```typescript
import { AnalyticsDashboard } from "./analytics/dashboard.js";

const dashboard = new AnalyticsDashboard(analytics, {
  refreshInterval: 60000,
  enableAutoRefresh: true,
  platforms: ["reddit", "hackernews"]
});

const metrics = await dashboard.getMetrics({
  dateRange: {
    start: new Date("2024-01-01"),
    end: new Date("2024-12-31")
  }
});

await dashboard.displayDashboard();
```

### Report Generation
```typescript
import { ReportGenerator } from "./analytics/report-generator.js";

const generator = new ReportGenerator(analytics, {
  includeCharts: true,
  includeSummary: true,
  dateFormat: "long"
});

const report = generator.generateReport(
  "Monthly Analytics Report",
  dashboardMetrics,
  {
    template: customTemplate,
    format: "html"
  }
);

console.log(report.content);
```

### Caching Implementation
```typescript
import { CachedAnalyticsService } from "./analytics/cached-analytics.js";

const cachedService = new CachedAnalyticsService(analytics, {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 50 * 1024 * 1024, // 50MB
  backgroundRefresh: true
});

// First call hits database
const stats1 = cachedService.getPlatformStats("reddit");

// Second call returns cached result
const stats2 = cachedService.getPlatformStats("reddit");

// Check cache performance
const cacheStats = cachedService.getCacheStats();
console.log(`Cache hit rate: ${cacheStats.hitRate}%`);
```

## Error Handling

All analytics modules implement consistent error handling:

```typescript
try {
  const result = analyzer.analyzeTrend(data);
} catch (error) {
  if (error instanceof AnalyticsError) {
    console.error(`Analytics error: ${error.message}`);
    console.error(`Code: ${error.code}`);
  }
}
```

## Performance Considerations

1. **Large Datasets**: Use streaming or chunking for datasets > 100k points
2. **Caching**: Implement CacheLayer for frequently accessed computations
3. **Parallel Processing**: Some methods support parallel computation
4. **Memory Management**: Monitor memory usage with large visualizations

## Best Practices

1. **Data Validation**: Always validate input data before analysis
2. **Error Handling**: Implement proper error handling for all operations
3. **Caching Strategy**: Use appropriate TTL values based on data volatility
4. **Visualization**: Choose appropriate chart types for data characteristics
5. **Configuration**: Tune sensitivity and thresholds based on domain requirements

## Version History

- v1.0.0: Initial release with core analytics modules
- v1.1.0: Added advanced anomaly detection methods
- v1.2.0: Enhanced forecasting with Holt-Winters
- v1.3.0: Added SVG generation capabilities
- v1.4.0: Implemented sophisticated caching layer
- v1.5.0: Enhanced terminal visualizations with colors

## License

MIT License - See LICENSE file for details