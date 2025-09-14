import { StatisticsEngine, TimeSeriesPoint } from "./statistics.js";

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

  analyzeTrend(values: number[], timestamps?: Date[]): TrendResult {
    if (values.length < 2) {
      return this.createEmptyTrendResult();
    }

    const smoothedValues = StatisticsEngine.exponentialSmoothing(
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
    const lastValue = values[values.length - 1];
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
    const arOrder = 1;
    const maOrder = 1;

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
}
