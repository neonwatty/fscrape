import { StatisticsEngine, TimeSeriesPoint } from "./statistics.js";

/**
 * Anomaly types for different detection scenarios
 */
export type AnomalyType =
  | "spike" // Sudden increase
  | "dip" // Sudden decrease
  | "trend_break" // Break in trend pattern
  | "unusual_pattern" // Unusual behavior pattern
  | "outlier"; // Statistical outlier

/**
 * Severity levels for anomalies
 */
export type AnomalySeverity = "low" | "medium" | "high" | "critical";

/**
 * Detection methods available
 */
export type DetectionMethod =
  | "zscore"
  | "iqr"
  | "isolation_forest"
  | "mad"
  | "ensemble";

/**
 * Interface for a detected anomaly
 */
export interface Anomaly {
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

/**
 * Configuration for anomaly detection
 */
export interface AnomalyDetectorConfig {
  sensitivity?: number; // 0-1, higher = more sensitive
  methods?: DetectionMethod[]; // Methods to use
  contextWindow?: number; // Window for contextual analysis
  minDataPoints?: number; // Minimum points needed
  adaptiveThreshold?: boolean; // Use adaptive thresholds
  seasonalPeriod?: number; // Period for seasonal adjustment
}

/**
 * Result of anomaly detection
 */
export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  statistics: {
    totalPoints: number;
    anomalyRate: number;
    methods: DetectionMethod[];
    thresholds: Record<string, number>;
  };
  confidence: number;
}

/**
 * Engagement metrics for behavioral anomaly detection
 */
export interface EngagementMetrics {
  timestamp: Date;
  posts: number;
  comments: number;
  likes: number;
  shares: number;
  activeUsers: number;
  newUsers: number;
  [key: string]: number | Date;
}

/**
 * Advanced Anomaly Detection System
 */
export class AnomalyDetector {
  private config: Required<AnomalyDetectorConfig>;

  constructor(config: AnomalyDetectorConfig = {}) {
    this.config = {
      sensitivity: config.sensitivity ?? 0.5,
      methods: config.methods ?? ["zscore", "iqr"],
      contextWindow: config.contextWindow ?? 10,
      minDataPoints: config.minDataPoints ?? 5,
      adaptiveThreshold: config.adaptiveThreshold ?? true,
      seasonalPeriod: config.seasonalPeriod ?? 7,
    };
  }

  /**
   * Main anomaly detection method
   */
  detect(values: number[], timestamps?: Date[]): AnomalyDetectionResult {
    if (values.length < this.config.minDataPoints) {
      return this.createEmptyResult();
    }

    const anomaliesMap = new Map<number, Anomaly>();
    const thresholds: Record<string, number> = {};

    // Apply each detection method
    for (const method of this.config.methods) {
      const result = this.applyMethod(method, values, timestamps);

      // Merge results
      for (const anomaly of result.anomalies) {
        const existing = anomaliesMap.get(anomaly.index);
        if (!existing || anomaly.severity > existing.severity) {
          anomaliesMap.set(anomaly.index, anomaly);
        }
      }

      if (result.threshold !== undefined) {
        thresholds[method] = result.threshold;
      }
    }

    const anomalies = Array.from(anomaliesMap.values()).sort(
      (a, b) => a.index - b.index,
    );
    const confidence = this.calculateConfidence(anomalies, values.length);

    return {
      anomalies,
      statistics: {
        totalPoints: values.length,
        anomalyRate: anomalies.length / values.length,
        methods: this.config.methods,
        thresholds,
      },
      confidence,
    };
  }

  /**
   * Detect anomalies in time series data
   */
  detectTimeSeries(timeSeries: TimeSeriesPoint[]): AnomalyDetectionResult {
    const values = timeSeries.map((p) => p.value);
    const timestamps = timeSeries.map((p) => p.timestamp);

    // Remove seasonal component if configured
    const adjusted =
      this.config.seasonalPeriod > 0
        ? this.removeSeasonality(values, this.config.seasonalPeriod)
        : values;

    return this.detect(adjusted, timestamps);
  }

  /**
   * Detect anomalies in engagement patterns
   */
  detectEngagementAnomalies(
    metrics: EngagementMetrics[],
  ): Map<string, AnomalyDetectionResult> {
    const results = new Map<string, AnomalyDetectionResult>();

    // Analyze each metric separately
    const metricKeys = [
      "posts",
      "comments",
      "likes",
      "shares",
      "activeUsers",
      "newUsers",
    ];

    for (const key of metricKeys) {
      const values = metrics.map((m) => Number(m[key]) || 0);
      const timestamps = metrics.map((m) => m.timestamp);

      // Check for unusual patterns
      const result = this.detect(values, timestamps);

      // Add pattern-specific analysis
      const enhancedResult = this.enhanceWithPatternAnalysis(
        result,
        values,
        key,
      );
      results.set(key, enhancedResult);
    }

    // Cross-metric anomaly detection
    const crossAnomalies = this.detectCrossMetricAnomalies(metrics);
    results.set("cross_metric", crossAnomalies);

    return results;
  }

  /**
   * Z-Score based anomaly detection
   */
  private detectZScore(values: number[]): {
    anomalies: Anomaly[];
    threshold: number;
  } {
    const mean = StatisticsEngine.calculateMean(values);
    const stdDev = StatisticsEngine.calculateStandardDeviation(values);

    // Dynamic threshold based on sensitivity
    const zThreshold = 3 - this.config.sensitivity * 1.5; // 1.5 to 3

    const anomalies: Anomaly[] = [];

    for (let i = 0; i < values.length; i++) {
      const zScore = Math.abs((values[i] - mean) / stdDev);

      if (zScore > zThreshold) {
        anomalies.push({
          index: i,
          value: values[i],
          type: this.classifyAnomalyType(values, i),
          severity: this.calculateSeverity(zScore, zThreshold),
          score: zScore,
          method: "zscore",
          context: {
            expected: mean,
            deviation: values[i] - mean,
            percentile: this.calculatePercentile(values[i], values),
          },
        });
      }
    }

    return { anomalies, threshold: zThreshold };
  }

  /**
   * IQR (Interquartile Range) based anomaly detection
   */
  private detectIQR(values: number[]): {
    anomalies: Anomaly[];
    threshold: number;
  } {
    const quartiles = StatisticsEngine.calculateQuartiles(values);
    const iqr = quartiles.q3 - quartiles.q1;

    // Dynamic multiplier based on sensitivity
    const multiplier = 2.5 - this.config.sensitivity * 1;
    const lowerBound = quartiles.q1 - multiplier * iqr;
    const upperBound = quartiles.q3 + multiplier * iqr;

    const anomalies: Anomaly[] = [];

    for (let i = 0; i < values.length; i++) {
      if (values[i] < lowerBound || values[i] > upperBound) {
        const deviation =
          values[i] < lowerBound
            ? lowerBound - values[i]
            : values[i] - upperBound;

        anomalies.push({
          index: i,
          value: values[i],
          type: this.classifyAnomalyType(values, i),
          severity: this.calculateSeverity(deviation, iqr),
          score: deviation / iqr,
          method: "iqr",
          context: {
            expected: quartiles.q2,
            deviation,
            percentile: this.calculatePercentile(values[i], values),
          },
        });
      }
    }

    return { anomalies, threshold: multiplier };
  }

  /**
   * Isolation Forest based anomaly detection
   */
  private detectIsolationForest(values: number[]): {
    anomalies: Anomaly[];
    threshold: number;
  } {
    const numTrees = 100;
    const sampleSize = Math.min(256, values.length);
    const scores: number[] = [];

    // Calculate isolation scores
    for (let i = 0; i < values.length; i++) {
      let totalPathLength = 0;

      for (let t = 0; t < numTrees; t++) {
        const sample = this.randomSample(values, sampleSize);
        const tree = this.buildIsolationTree(
          sample,
          0,
          Math.ceil(Math.log2(sampleSize)),
        );
        const pathLength = this.getPathLength(values[i], tree);
        totalPathLength += pathLength;
      }

      const avgPathLength = totalPathLength / numTrees;
      const score = Math.pow(2, -avgPathLength / this.c(sampleSize));
      scores.push(score);
    }

    // Determine threshold based on sensitivity
    const threshold = 0.5 + 0.2 * (1 - this.config.sensitivity);

    const anomalies: Anomaly[] = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > threshold) {
        anomalies.push({
          index: i,
          value: values[i],
          type: this.classifyAnomalyType(values, i),
          severity: this.calculateSeverity(scores[i], threshold),
          score: scores[i],
          method: "isolation_forest",
          context: {
            expected: StatisticsEngine.calculateMedian(values),
            deviation: values[i] - StatisticsEngine.calculateMedian(values),
            percentile: this.calculatePercentile(values[i], values),
          },
        });
      }
    }

    return { anomalies, threshold };
  }

  /**
   * MAD (Median Absolute Deviation) based detection
   */
  private detectMAD(values: number[]): {
    anomalies: Anomaly[];
    threshold: number;
  } {
    const median = StatisticsEngine.calculateMedian(values);
    const deviations = values.map((v) => Math.abs(v - median));
    const mad = StatisticsEngine.calculateMedian(deviations);

    // Modified Z-score using MAD
    const threshold = 3.5 - this.config.sensitivity * 1.5;
    const anomalies: Anomaly[] = [];

    for (let i = 0; i < values.length; i++) {
      const modifiedZScore = (0.6745 * (values[i] - median)) / mad;

      if (Math.abs(modifiedZScore) > threshold) {
        anomalies.push({
          index: i,
          value: values[i],
          type: this.classifyAnomalyType(values, i),
          severity: this.calculateSeverity(Math.abs(modifiedZScore), threshold),
          score: Math.abs(modifiedZScore),
          method: "mad",
          context: {
            expected: median,
            deviation: values[i] - median,
            percentile: this.calculatePercentile(values[i], values),
          },
        });
      }
    }

    return { anomalies, threshold };
  }

  /**
   * Apply a specific detection method
   */
  private applyMethod(
    method: DetectionMethod,
    values: number[],
    timestamps?: Date[],
  ): { anomalies: Anomaly[]; threshold?: number } {
    switch (method) {
      case "zscore":
        return this.detectZScore(values);
      case "iqr":
        return this.detectIQR(values);
      case "isolation_forest":
        return this.detectIsolationForest(values);
      case "mad":
        return this.detectMAD(values);
      case "ensemble":
        return this.ensembleDetection(values, timestamps);
      default:
        return { anomalies: [] };
    }
  }

  /**
   * Ensemble method combining multiple detection approaches
   */
  private ensembleDetection(
    values: number[],
    _timestamps?: Date[],
  ): { anomalies: Anomaly[]; threshold?: number } {
    const methods: DetectionMethod[] = ["zscore", "iqr", "mad"];
    const voteMap = new Map<number, number>();
    const allAnomalies: Anomaly[] = [];

    // Collect votes from each method
    for (const method of methods) {
      const result = this.applyMethod(method, values);
      for (const anomaly of result.anomalies) {
        voteMap.set(anomaly.index, (voteMap.get(anomaly.index) || 0) + 1);
        allAnomalies.push(anomaly);
      }
    }

    // Require majority vote
    const threshold = methods.length / 2;
    const consensusAnomalies: Anomaly[] = [];

    for (const [index, votes] of voteMap.entries()) {
      if (votes > threshold) {
        // Find the anomaly with highest severity for this index
        const anomaly = allAnomalies
          .filter((a) => a.index === index)
          .sort((a, b) => b.score - a.score)[0];

        if (anomaly) {
          consensusAnomalies.push({
            ...anomaly,
            method: "ensemble",
            score: votes / methods.length,
          });
        }
      }
    }

    return { anomalies: consensusAnomalies, threshold };
  }

  /**
   * Remove seasonal component from time series
   */
  private removeSeasonality(values: number[], period: number): number[] {
    if (values.length < period * 2) return values;

    const _seasonal = new Array(values.length).fill(0);
    const trend = new Array(values.length).fill(0);

    // Calculate moving average for trend
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(period / 2));
      const end = Math.min(values.length, i + Math.floor(period / 2) + 1);
      const window = values.slice(start, end);
      trend[i] = StatisticsEngine.calculateMean(window);
    }

    // Calculate seasonal component
    const seasonalPattern = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    for (let i = 0; i < values.length; i++) {
      const detrended = values[i] - trend[i];
      const position = i % period;
      seasonalPattern[position] += detrended;
      counts[position]++;
    }

    for (let i = 0; i < period; i++) {
      if (counts[i] > 0) {
        seasonalPattern[i] /= counts[i];
      }
    }

    // Apply seasonal adjustment
    const adjusted = values.map((v, i) => v - seasonalPattern[i % period]);
    return adjusted;
  }

  /**
   * Detect cross-metric anomalies
   */
  private detectCrossMetricAnomalies(
    metrics: EngagementMetrics[],
  ): AnomalyDetectionResult {
    const anomalies: Anomaly[] = [];

    // Calculate correlation matrix
    const metricKeys = ["posts", "comments", "likes", "shares"];
    const correlations: number[][] = [];

    for (let i = 0; i < metricKeys.length; i++) {
      correlations[i] = [];
      for (let j = 0; j < metricKeys.length; j++) {
        const x = metrics.map((m) => Number(m[metricKeys[i]]) || 0);
        const y = metrics.map((m) => Number(m[metricKeys[j]]) || 0);
        correlations[i][j] = this.calculateCorrelation(x, y);
      }
    }

    // Detect unusual correlation patterns
    for (let t = 1; t < metrics.length; t++) {
      const windowSize = Math.min(this.config.contextWindow, t);
      const window = metrics.slice(Math.max(0, t - windowSize), t + 1);

      // Check for broken correlations
      for (let i = 0; i < metricKeys.length - 1; i++) {
        for (let j = i + 1; j < metricKeys.length; j++) {
          const expectedCorr = correlations[i][j];
          const windowX = window.map((m) => Number(m[metricKeys[i]]) || 0);
          const windowY = window.map((m) => Number(m[metricKeys[j]]) || 0);
          const actualCorr = this.calculateCorrelation(windowX, windowY);

          const deviation = Math.abs(expectedCorr - actualCorr);
          if (deviation > 0.5) {
            anomalies.push({
              index: t,
              value: deviation,
              timestamp: metrics[t].timestamp,
              type: "unusual_pattern",
              severity: this.calculateSeverity(deviation, 0.5),
              score: deviation,
              method: "ensemble",
              context: {
                expected: expectedCorr,
                deviation,
                percentile: 0,
              },
            });
          }
        }
      }
    }

    return {
      anomalies,
      statistics: {
        totalPoints: metrics.length,
        anomalyRate: anomalies.length / metrics.length,
        methods: ["ensemble"],
        thresholds: { correlation_deviation: 0.5 },
      },
      confidence: this.calculateConfidence(anomalies, metrics.length),
    };
  }

  /**
   * Enhance results with pattern-specific analysis
   */
  private enhanceWithPatternAnalysis(
    result: AnomalyDetectionResult,
    values: number[],
    metricName: string,
  ): AnomalyDetectionResult {
    // Add metric-specific pattern detection
    const patterns = this.detectSpecificPatterns(values, metricName);

    // Merge pattern anomalies with existing ones
    const enhancedAnomalies = [...result.anomalies];

    for (const pattern of patterns) {
      if (!enhancedAnomalies.some((a) => a.index === pattern.index)) {
        enhancedAnomalies.push(pattern);
      }
    }

    return {
      ...result,
      anomalies: enhancedAnomalies.sort((a, b) => a.index - b.index),
    };
  }

  /**
   * Detect metric-specific patterns
   */
  private detectSpecificPatterns(
    values: number[],
    _metricName: string,
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Detect sudden spikes/drops
    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      const percentChange =
        values[i - 1] !== 0
          ? Math.abs(change / values[i - 1])
          : Math.abs(change);

      if (percentChange > 2) {
        // 200% change
        anomalies.push({
          index: i,
          value: values[i],
          type: change > 0 ? "spike" : "dip",
          severity: percentChange > 5 ? "critical" : "high",
          score: percentChange,
          method: "ensemble",
        });
      }
    }

    // Detect trend breaks
    if (values.length > 10) {
      const trendBreaks = this.detectTrendBreaks(values);
      anomalies.push(...trendBreaks);
    }

    return anomalies;
  }

  /**
   * Detect breaks in trend
   */
  private detectTrendBreaks(values: number[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const windowSize = Math.min(10, Math.floor(values.length / 3));

    for (let i = windowSize; i < values.length - windowSize; i++) {
      const leftWindow = values.slice(i - windowSize, i);
      const rightWindow = values.slice(i, i + windowSize);

      const leftTrend = this.calculateTrend(leftWindow);
      const rightTrend = this.calculateTrend(rightWindow);

      // Check for trend reversal
      if (
        Math.sign(leftTrend) !== Math.sign(rightTrend) &&
        Math.abs(leftTrend) > 0.1 &&
        Math.abs(rightTrend) > 0.1
      ) {
        anomalies.push({
          index: i,
          value: values[i],
          type: "trend_break",
          severity: "medium",
          score: Math.abs(leftTrend - rightTrend),
          method: "ensemble",
        });
      }
    }

    return anomalies;
  }

  /**
   * Build isolation tree for Isolation Forest
   */
  private buildIsolationTree(
    data: number[],
    depth: number,
    maxDepth: number,
  ): IsolationNode {
    if (depth >= maxDepth || data.length <= 1) {
      return {
        isLeaf: true,
        size: data.length,
        depth,
      };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);

    if (min === max) {
      return {
        isLeaf: true,
        size: data.length,
        depth,
      };
    }

    const splitValue = min + Math.random() * (max - min);
    const left = data.filter((x) => x < splitValue);
    const right = data.filter((x) => x >= splitValue);

    return {
      isLeaf: false,
      splitValue,
      left: this.buildIsolationTree(left, depth + 1, maxDepth),
      right: this.buildIsolationTree(right, depth + 1, maxDepth),
      depth,
    };
  }

  /**
   * Get path length in isolation tree
   */
  private getPathLength(value: number, tree: IsolationNode): number {
    if (tree.isLeaf) {
      return tree.depth + this.c(tree.size);
    }

    if (value < tree.splitValue!) {
      return this.getPathLength(value, tree.left!);
    } else {
      return this.getPathLength(value, tree.right!);
    }
  }

  /**
   * Average path length for unsuccessful search in BST
   */
  private c(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }

  /**
   * Helper functions
   */
  private classifyAnomalyType(values: number[], index: number): AnomalyType {
    if (index === 0 || index === values.length - 1) {
      return "outlier";
    }

    const prev = values[index - 1];
    const curr = values[index];
    const next = index < values.length - 1 ? values[index + 1] : curr;

    const prevChange = curr - prev;
    const nextChange = next - curr;

    if (
      prevChange > 0 &&
      nextChange < 0 &&
      Math.abs(prevChange) > Math.abs(prev) * 0.5
    ) {
      return "spike";
    }
    if (
      prevChange < 0 &&
      nextChange > 0 &&
      Math.abs(prevChange) > Math.abs(prev) * 0.5
    ) {
      return "dip";
    }
    if (Math.sign(prevChange) !== Math.sign(nextChange)) {
      return "trend_break";
    }

    return "outlier";
  }

  private calculateSeverity(score: number, threshold: number): AnomalySeverity {
    const ratio = score / threshold;
    if (ratio < 1.5) return "low";
    if (ratio < 2.5) return "medium";
    if (ratio < 4) return "high";
    return "critical";
  }

  private calculatePercentile(value: number, values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex((v) => v >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const result = StatisticsEngine.calculateCorrelation(x, y);
    return result.correlation;
  }

  private calculateTrend(values: number[]): number {
    const x = values.map((_, i) => i);
    const regression = StatisticsEngine.linearRegression(x, values);
    return regression.slope;
  }

  private randomSample<T>(array: T[], size: number): T[] {
    const sample: T[] = [];
    const indices = new Set<number>();

    while (sample.length < size && sample.length < array.length) {
      const index = Math.floor(Math.random() * array.length);
      if (!indices.has(index)) {
        indices.add(index);
        sample.push(array[index]);
      }
    }

    return sample;
  }

  private calculateConfidence(
    anomalies: Anomaly[],
    totalPoints: number,
  ): number {
    if (totalPoints === 0) return 0;

    // Base confidence on anomaly rate and severity distribution
    const anomalyRate = anomalies.length / totalPoints;
    const severityScore =
      anomalies.reduce((sum, a) => {
        const weight =
          a.severity === "critical"
            ? 4
            : a.severity === "high"
              ? 3
              : a.severity === "medium"
                ? 2
                : 1;
        return sum + weight;
      }, 0) / (anomalies.length || 1);

    // Higher confidence with lower anomaly rate and consistent severity
    const rateConfidence = Math.max(0, 1 - anomalyRate * 10);
    const severityConfidence = severityScore / 4;

    return (rateConfidence + severityConfidence) / 2;
  }

  private createEmptyResult(): AnomalyDetectionResult {
    return {
      anomalies: [],
      statistics: {
        totalPoints: 0,
        anomalyRate: 0,
        methods: this.config.methods,
        thresholds: {},
      },
      confidence: 0,
    };
  }
}

/**
 * Interface for Isolation Forest tree node
 */
interface IsolationNode {
  isLeaf: boolean;
  splitValue?: number;
  left?: IsolationNode;
  right?: IsolationNode;
  size: number;
  depth: number;
}
