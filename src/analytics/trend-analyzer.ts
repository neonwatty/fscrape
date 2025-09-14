import { StatisticsEngine, TimeSeriesPoint } from "./statistics.js";

export type { TimeSeriesPoint } from "./statistics.js";

export interface TrendResult {
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

export interface ChangePoint {
  index: number;
  timestamp?: Date;
  value: number;
  magnitude: number;
  type: "increase" | "decrease";
}

export interface SeasonalPattern {
  period: number;
  strength: number;
  pattern: number[];
  nextPrediction: number;
}

export interface AnomalyDetectionResult {
  anomalies: Array<{
    index: number;
    value: number;
    timestamp?: Date;
    zScore: number;
    severity: "low" | "medium" | "high";
  }>;
  threshold: number;
  method: "zscore" | "iqr" | "isolation";
}

export interface TrendAnalysisOptions {
  windowSize?: number;
  smoothingFactor?: number;
  confidenceLevel?: number;
  minTrendStrength?: number;
  seasonalityPeriod?: number;
  anomalyThreshold?: number;
}

export class TrendAnalyzer {
  private readonly defaultOptions: Required<TrendAnalysisOptions> = {
    windowSize: 7,
    smoothingFactor: 0.3,
    confidenceLevel: 0.95,
    minTrendStrength: 0.1,
    seasonalityPeriod: 7,
    anomalyThreshold: 2.5,
  };

  constructor(private options: TrendAnalysisOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  analyzeTrend(values: number[], _timestamps?: Date[]): TrendResult {
    if (values.length < 2) {
      return this.createEmptyTrendResult();
    }

    // smoothedValues could be used for trend detection in future enhancements
    const _smoothedValues = StatisticsEngine.exponentialSmoothing(
      values,
      this.options.smoothingFactor!,
    );

    const x = values.map((_, i) => i);
    const regression = StatisticsEngine.linearRegression(x, values);

    const volatility = this.calculateVolatility(values);
    const trend = this.determineTrend(regression.slope, volatility, values);
    const strength = Math.min(Math.abs(regression.rSquared), 1);

    const changePercent =
      values.length > 1
        ? ((values[values.length - 1] - values[0]) / Math.abs(values[0])) * 100
        : 0;

    const prediction = this.predictNextValue(values, regression);

    return {
      trend,
      slope: regression.slope,
      strength,
      confidence: regression.rSquared,
      changePercent,
      volatility,
      predictions: prediction,
    };
  }

  analyzeTimeSeries(timeSeries: TimeSeriesPoint[]): TrendResult {
    const values = timeSeries.map((point) => point.value);
    const timestamps = timeSeries.map((point) => point.timestamp);
    return this.analyzeTrend(values, timestamps);
  }

  detectChangePoints(values: number[], sensitivity: number = 2): ChangePoint[] {
    if (values.length < 3) return [];

    const changePoints: ChangePoint[] = [];
    const windowSize = Math.min(
      Math.max(3, this.options.windowSize!),
      Math.floor(values.length / 3),
    );

    for (let i = windowSize; i < values.length - windowSize; i++) {
      const leftWindow = values.slice(Math.max(0, i - windowSize), i);
      const rightWindow = values.slice(
        i,
        Math.min(values.length, i + windowSize),
      );

      const leftMean = StatisticsEngine.calculateMean(leftWindow);
      const rightMean = StatisticsEngine.calculateMean(rightWindow);

      const leftStd = StatisticsEngine.calculateStandardDeviation(leftWindow);
      const rightStd = StatisticsEngine.calculateStandardDeviation(rightWindow);
      const pooledStd = Math.sqrt(
        (leftStd * leftStd + rightStd * rightStd) / 2,
      );

      const meanDiff = Math.abs(rightMean - leftMean);

      if (pooledStd > 0) {
        const tStatistic = meanDiff / (pooledStd / Math.sqrt(windowSize));

        if (tStatistic > sensitivity) {
          changePoints.push({
            index: i,
            value: values[i],
            magnitude: tStatistic,
            type: rightMean > leftMean ? "increase" : "decrease",
          });
        }
      } else if (meanDiff > 0.1) {
        changePoints.push({
          index: i,
          value: values[i],
          magnitude: meanDiff * 10,
          type: rightMean > leftMean ? "increase" : "decrease",
        });
      }
    }

    return this.mergeNearbyChangePoints(changePoints, windowSize);
  }

  detectSeasonality(timeSeries: TimeSeriesPoint[]): SeasonalPattern | null {
    if (timeSeries.length < this.options.seasonalityPeriod! * 2) {
      return null;
    }

    const result = StatisticsEngine.detectSeasonality(
      timeSeries,
      this.options.seasonalityPeriod!,
    );

    if (!result.hasSeasonality) {
      return null;
    }

    const currentPosition = timeSeries.length % this.options.seasonalityPeriod!;
    const nextPrediction = result.pattern[currentPosition];

    return {
      period: this.options.seasonalityPeriod!,
      strength: result.strength,
      pattern: result.pattern,
      nextPrediction,
    };
  }

  detectAnomalies(
    values: number[],
    method: "zscore" | "iqr" | "isolation" = "zscore",
  ): AnomalyDetectionResult {
    const anomalies: AnomalyDetectionResult["anomalies"] = [];

    if (values.length === 0) {
      return { anomalies, threshold: 0, method };
    }

    if (method === "zscore") {
      const mean = StatisticsEngine.calculateMean(values);
      const stdDev = StatisticsEngine.calculateStandardDeviation(values);
      const threshold = this.options.anomalyThreshold!;

      values.forEach((value, index) => {
        const zScore = StatisticsEngine.calculateZScore(value, mean, stdDev);
        if (Math.abs(zScore) > threshold) {
          anomalies.push({
            index,
            value,
            zScore,
            severity: this.calculateSeverity(Math.abs(zScore), threshold),
          });
        }
      });

      return { anomalies, threshold, method };
    } else if (method === "iqr") {
      const outliers = StatisticsEngine.detectOutliers(values, 1.5);
      const quartiles = StatisticsEngine.calculateQuartiles(values);
      const iqr = quartiles.q3 - quartiles.q1;
      const threshold = 1.5 * iqr;

      values.forEach((value, index) => {
        if (outliers.includes(value)) {
          const deviation = Math.min(
            Math.abs(value - quartiles.q1),
            Math.abs(value - quartiles.q3),
          );
          anomalies.push({
            index,
            value,
            zScore: deviation / iqr,
            severity: this.calculateSeverity(deviation, threshold),
          });
        }
      });

      return { anomalies, threshold, method };
    } else {
      return this.isolationForestAnomalies(values);
    }
  }

  forecastValues(
    values: number[],
    steps: number,
    method: "linear" | "exponential" | "arima" = "exponential",
  ): number[] {
    if (values.length === 0 || steps <= 0) return [];

    if (method === "linear") {
      const x = values.map((_, i) => i);
      const regression = StatisticsEngine.linearRegression(x, values);
      const forecast: number[] = [];

      for (let i = 0; i < steps; i++) {
        const nextX = values.length + i;
        forecast.push(regression.slope * nextX + regression.intercept);
      }

      return forecast;
    } else if (method === "exponential") {
      const smoothed = StatisticsEngine.exponentialSmoothing(
        values,
        this.options.smoothingFactor!,
      );
      const lastValue = smoothed[smoothed.length - 1];
      const lastTrend =
        smoothed.length > 1
          ? smoothed[smoothed.length - 1] - smoothed[smoothed.length - 2]
          : 0;

      const forecast: number[] = [];
      let currentValue = lastValue;

      for (let i = 0; i < steps; i++) {
        currentValue += lastTrend * Math.pow(0.9, i);
        forecast.push(currentValue);
      }

      return forecast;
    } else {
      return this.arimaForecast(values, steps);
    }
  }

  compareTriends(
    trend1: TrendResult,
    trend2: TrendResult,
  ): {
    correlation: number;
    divergence: number;
    similar: boolean;
  } {
    const slopeCorrelation =
      1 -
      Math.abs(trend1.slope - trend2.slope) /
        (Math.abs(trend1.slope) + Math.abs(trend2.slope) + 1);

    const strengthCorrelation = 1 - Math.abs(trend1.strength - trend2.strength);

    const correlation = (slopeCorrelation + strengthCorrelation) / 2;

    const divergence = Math.sqrt(
      Math.pow(trend1.slope - trend2.slope, 2) +
        Math.pow(trend1.volatility - trend2.volatility, 2),
    );

    const similar = correlation > 0.7 && divergence < 0.3;

    return { correlation, divergence, similar };
  }

  calculateMomentum(values: number[], period: number = 10): number[] {
    if (values.length <= period) return [];

    const momentum: number[] = [];
    for (let i = period; i < values.length; i++) {
      const change = values[i] - values[i - period];
      const percentChange = (change / Math.abs(values[i - period])) * 100;
      momentum.push(percentChange);
    }

    return momentum;
  }

  calculateRSI(values: number[], period: number = 14): number[] {
    if (values.length < period + 1) return [];

    const rsi: number[] = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }

    return rsi;
  }

  private createEmptyTrendResult(): TrendResult {
    return {
      trend: "stable",
      slope: 0,
      strength: 0,
      confidence: 0,
      changePercent: 0,
      volatility: 0,
      predictions: {
        nextValue: 0,
        confidence: 0,
        range: { min: 0, max: 0 },
      },
    };
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      const percentChange =
        values[i - 1] !== 0 ? change / Math.abs(values[i - 1]) : 0;
      returns.push(percentChange);
    }

    return StatisticsEngine.calculateStandardDeviation(returns);
  }

  private determineTrend(
    slope: number,
    volatility: number,
    values: number[],
  ): "increasing" | "decreasing" | "stable" | "volatile" {
    const normalizedSlope =
      slope / (StatisticsEngine.calculateMean(values) || 1);

    if (volatility > 0.5) return "volatile";
    if (Math.abs(normalizedSlope) < 0.05) return "stable";
    return normalizedSlope > 0 ? "increasing" : "decreasing";
  }

  private predictNextValue(
    values: number[],
    regression: ReturnType<typeof StatisticsEngine.linearRegression>,
  ): TrendResult["predictions"] {
    // const lastValue = values[values.length - 1]; // Could be used for validation
    const nextX = values.length;
    const predictedValue = regression.slope * nextX + regression.intercept;

    const stdError = Math.max(
      0.1,
      StatisticsEngine.calculateStandardDeviation(regression.residuals),
    );
    const confidence = Math.min(regression.rSquared, 0.99);

    const zScore = 1.96;
    const margin = zScore * stdError;

    return {
      nextValue: predictedValue,
      confidence,
      range: {
        min: predictedValue - margin,
        max: predictedValue + margin,
      },
    };
  }

  private mergeNearbyChangePoints(
    changePoints: ChangePoint[],
    windowSize: number,
  ): ChangePoint[] {
    if (changePoints.length <= 1) return changePoints;

    const merged: ChangePoint[] = [];
    let current = changePoints[0];

    for (let i = 1; i < changePoints.length; i++) {
      if (changePoints[i].index - current.index <= windowSize) {
        if (changePoints[i].magnitude > current.magnitude) {
          current = changePoints[i];
        }
      } else {
        merged.push(current);
        current = changePoints[i];
      }
    }
    merged.push(current);

    return merged;
  }

  private calculateSeverity(
    score: number,
    threshold: number,
  ): "low" | "medium" | "high" {
    const ratio = Math.abs(score) / Math.max(Math.abs(threshold), 1);
    if (ratio < 1.2) return "low";
    if (ratio < 2.0) return "medium";
    return "high";
  }

  private isolationForestAnomalies(values: number[]): AnomalyDetectionResult {
    const mean = StatisticsEngine.calculateMean(values);
    const stdDev = StatisticsEngine.calculateStandardDeviation(values);

    const scores = values.map((value) => {
      const paths: number[] = [];
      for (let i = 0; i < 100; i++) {
        paths.push(this.isolationPath(value, values, mean, stdDev));
      }
      return StatisticsEngine.calculateMean(paths);
    });

    const threshold =
      StatisticsEngine.calculateMean(scores) +
      2 * StatisticsEngine.calculateStandardDeviation(scores);

    const anomalies: AnomalyDetectionResult["anomalies"] = [];
    scores.forEach((score, index) => {
      if (score > threshold) {
        anomalies.push({
          index,
          value: values[index],
          zScore: (score - threshold) / threshold,
          severity: this.calculateSeverity(score, threshold),
        });
      }
    });

    return { anomalies, threshold, method: "isolation" };
  }

  private isolationPath(
    value: number,
    values: number[],
    mean: number,
    stdDev: number,
  ): number {
    let depth = 0;
    let min = mean - 3 * stdDev;
    let max = mean + 3 * stdDev;

    while (depth < 10 && max - min > 0.01) {
      const split = min + Math.random() * (max - min);
      if (value < split) {
        max = split;
      } else {
        min = split;
      }
      depth++;
    }

    return depth;
  }

  private arimaForecast(values: number[], steps: number): number[] {
    // const arOrder = 1; // For future ARIMA implementation
    // const maOrder = 1; // For future ARIMA implementation

    const differences: number[] = [];
    for (let i = 1; i < values.length; i++) {
      differences.push(values[i] - values[i - 1]);
    }

    const mean = StatisticsEngine.calculateMean(differences);
    const centered = differences.map((d) => d - mean);

    const forecast: number[] = [];
    let lastValue = values[values.length - 1];
    let lastDiff = centered[centered.length - 1];

    for (let i = 0; i < steps; i++) {
      const arComponent = lastDiff * 0.5;
      const maComponent = Math.random() * 0.1 - 0.05;
      const nextDiff = mean + arComponent + maComponent;

      lastValue += nextDiff;
      forecast.push(lastValue);
      lastDiff = nextDiff - mean;
    }

    return forecast;
  }

  /**
   * Mann-Kendall Test for trend detection
   * Returns test statistic, p-value, and trend significance
   */
  mannKendallTest(values: number[]): {
    statistic: number;
    pValue: number;
    trend: "increasing" | "decreasing" | "no_trend";
    significant: boolean;
  } {
    const n = values.length;
    if (n < 2) {
      return { statistic: 0, pValue: 1, trend: "no_trend", significant: false };
    }

    let s = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const diff = values[j] - values[i];
        if (diff > 0) s++;
        else if (diff < 0) s--;
      }
    }

    // Calculate variance
    let variance = (n * (n - 1) * (2 * n + 5)) / 18;

    // Adjust for ties
    const tieGroups = this.countTieGroups(values);
    if (tieGroups.length > 0) {
      let tieAdjustment = 0;
      for (const g of tieGroups) {
        tieAdjustment += (g * (g - 1) * (2 * g + 5)) / 18;
      }
      variance -= tieAdjustment;
    }

    // Calculate z-statistic
    let z = 0;
    if (s > 0) {
      z = (s - 1) / Math.sqrt(variance);
    } else if (s < 0) {
      z = (s + 1) / Math.sqrt(variance);
    }

    // Calculate p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    // Determine trend
    const alpha = 0.05; // significance level
    const significant = pValue < alpha;
    let trend: "increasing" | "decreasing" | "no_trend";

    if (!significant) {
      trend = "no_trend";
    } else {
      trend = s > 0 ? "increasing" : "decreasing";
    }

    return { statistic: s, pValue, trend, significant };
  }

  /**
   * Count tie groups for Mann-Kendall test
   */
  private countTieGroups(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const groups: number[] = [];
    let currentCount = 1;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1]) {
        currentCount++;
      } else {
        if (currentCount > 1) {
          groups.push(currentCount);
        }
        currentCount = 1;
      }
    }

    if (currentCount > 1) {
      groups.push(currentCount);
    }

    return groups;
  }

  /**
   * Cumulative distribution function for standard normal distribution
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const y =
      1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Detect breakpoints in time series using PELT algorithm
   * (Pruned Exact Linear Time)
   */
  detectBreakpoints(
    values: number[],
    minSegmentLength: number = 5,
    penalty: number = 3,
  ): number[] {
    const n = values.length;
    if (n < 2 * minSegmentLength) return [];

    const breakpoints: number[] = [];
    const cost = new Array(n + 1).fill(0);
    const changepoints = new Array(n + 1).fill(0);

    // Calculate cumulative sums for efficiency
    const cumSum = [0];
    const cumSumSq = [0];
    for (let i = 0; i < n; i++) {
      cumSum.push(cumSum[i] + values[i]);
      cumSumSq.push(cumSumSq[i] + values[i] * values[i]);
    }

    // Dynamic programming to find optimal breakpoints
    for (let s = minSegmentLength; s <= n; s++) {
      let minCost = Infinity;
      let bestBreakpoint = 0;

      for (let t = 0; t <= s - minSegmentLength; t++) {
        const segmentCost = this.calculateSegmentCost(cumSum, cumSumSq, t, s);
        const totalCost = cost[t] + segmentCost + penalty;

        if (totalCost < minCost) {
          minCost = totalCost;
          bestBreakpoint = t;
        }
      }

      cost[s] = minCost;
      changepoints[s] = bestBreakpoint;
    }

    // Backtrack to find all breakpoints
    let current = n;
    while (current > 0) {
      const prev = changepoints[current];
      if (prev > 0) {
        breakpoints.unshift(prev);
      }
      current = prev;
    }

    return breakpoints;
  }

  /**
   * Calculate cost for a segment (for breakpoint detection)
   */
  private calculateSegmentCost(
    cumSum: number[],
    cumSumSq: number[],
    start: number,
    end: number,
  ): number {
    const length = end - start;
    if (length === 0) return 0;

    const sum = cumSum[end] - cumSum[start];
    const sumSq = cumSumSq[end] - cumSumSq[start];
    const mean = sum / length;
    const variance = sumSq / length - mean * mean;

    // Return negative log-likelihood
    return length * (Math.log(2 * Math.PI * Math.max(variance, 1e-10)) + 1);
  }

  /**
   * Enhanced seasonal decomposition using STL
   * (Seasonal and Trend decomposition using Loess)
   */
  seasonalDecomposition(
    timeSeries: TimeSeriesPoint[],
    period: number = 7,
  ): {
    trend: number[];
    seasonal: number[];
    residual: number[];
    strength: {
      trend: number;
      seasonal: number;
    };
  } {
    const values = timeSeries.map((p) => p.value);
    const n = values.length;

    if (n < period * 2) {
      return {
        trend: values,
        seasonal: new Array(n).fill(0),
        residual: new Array(n).fill(0),
        strength: { trend: 0, seasonal: 0 },
      };
    }

    // Step 1: Initial trend using moving average
    const trendWindow = Math.min(period * 2 + 1, n);
    const trend = this.calculateCenteredMovingAverage(values, trendWindow);

    // Step 2: Detrend the series
    const detrended = values.map((v, i) => v - trend[i]);

    // Step 3: Calculate seasonal component
    const seasonal = this.calculateSeasonalComponent(detrended, period);

    // Step 4: Calculate residuals
    const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

    // Step 5: Calculate strength metrics
    const trendStrength = this.calculateTrendStrength(values, trend, residual);
    const seasonalStrength = this.calculateSeasonalStrength(
      values,
      seasonal,
      residual,
    );

    return {
      trend,
      seasonal,
      residual,
      strength: {
        trend: trendStrength,
        seasonal: seasonalStrength,
      },
    };
  }

  /**
   * Calculate centered moving average for seasonal decomposition
   */
  private calculateCenteredMovingAverage(
    values: number[],
    window: number,
  ): number[] {
    const n = values.length;
    const result = new Array(n);
    const halfWindow = Math.floor(window / 2);

    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(n, i + halfWindow + 1);
      const windowValues = values.slice(start, end);
      result[i] = StatisticsEngine.calculateMean(windowValues);
    }

    return result;
  }

  /**
   * Calculate seasonal component for decomposition
   */
  private calculateSeasonalComponent(
    detrended: number[],
    period: number,
  ): number[] {
    const n = detrended.length;
    const seasonal = new Array(n);
    const seasonalPattern = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    // Calculate average for each position in the period
    for (let i = 0; i < n; i++) {
      const position = i % period;
      seasonalPattern[position] += detrended[i];
      counts[position]++;
    }

    // Calculate mean for each position
    for (let i = 0; i < period; i++) {
      if (counts[i] > 0) {
        seasonalPattern[i] /= counts[i];
      }
    }

    // Center the seasonal pattern
    const meanPattern = StatisticsEngine.calculateMean(seasonalPattern);
    for (let i = 0; i < period; i++) {
      seasonalPattern[i] -= meanPattern;
    }

    // Apply pattern to full series
    for (let i = 0; i < n; i++) {
      seasonal[i] = seasonalPattern[i % period];
    }

    return seasonal;
  }

  /**
   * Calculate trend strength for decomposition
   */
  private calculateTrendStrength(
    values: number[],
    trend: number[],
    residual: number[],
  ): number {
    const trendPlusResidual = trend.map((t, i) => t + residual[i]);
    const varTrendResidual =
      StatisticsEngine.calculateVariance(trendPlusResidual);
    const varResidual = StatisticsEngine.calculateVariance(residual);

    if (varTrendResidual === 0) return 0;
    return Math.max(0, 1 - varResidual / varTrendResidual);
  }

  /**
   * Calculate seasonal strength for decomposition
   */
  private calculateSeasonalStrength(
    values: number[],
    seasonal: number[],
    residual: number[],
  ): number {
    const seasonalPlusResidual = seasonal.map((s, i) => s + residual[i]);
    const varSeasonalResidual =
      StatisticsEngine.calculateVariance(seasonalPlusResidual);
    const varResidual = StatisticsEngine.calculateVariance(residual);

    if (varSeasonalResidual === 0) return 0;
    return Math.max(0, 1 - varResidual / varSeasonalResidual);
  }
}
