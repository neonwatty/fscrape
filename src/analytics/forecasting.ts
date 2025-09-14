import { StatisticsEngine, TimeSeriesPoint } from "./statistics.js";

/**
 * Forecasting model types
 */
export type ForecastModel =
  | "linear_trend"
  | "seasonal_naive"
  | "exponential_smoothing"
  | "holt_winters"
  | "moving_average"
  | "auto";

/**
 * Configuration for forecasting
 */
export interface ForecastConfig {
  model?: ForecastModel;
  horizon?: number; // Number of periods to forecast
  confidence?: number; // Confidence level for prediction intervals (0-1)
  seasonalPeriod?: number; // Period for seasonal patterns
  alpha?: number; // Smoothing parameter for exponential smoothing (0-1)
  beta?: number; // Trend smoothing parameter for Holt-Winters (0-1)
  gamma?: number; // Seasonal smoothing parameter for Holt-Winters (0-1)
  includeHistory?: boolean; // Include historical data in result
  splitRatio?: number; // Train/test split ratio for validation (0-1)
}

/**
 * Single forecast point
 */
export interface ForecastPoint {
  timestamp?: Date;
  index: number;
  value: number;
  lower: number; // Lower confidence bound
  upper: number; // Upper confidence bound
  model: ForecastModel;
}

/**
 * Complete forecast result
 */
export interface ForecastResult {
  forecast: ForecastPoint[];
  accuracy?: AccuracyMetrics;
  model: ForecastModel;
  parameters: Record<string, number>;
  historical?: number[];
  residuals?: number[];
  seasonalComponent?: number[];
  trendComponent?: number[];
}

/**
 * Accuracy metrics for forecast evaluation
 */
export interface AccuracyMetrics {
  mae: number; // Mean Absolute Error
  mse: number; // Mean Squared Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  smape: number; // Symmetric Mean Absolute Percentage Error
  mase: number; // Mean Absolute Scaled Error
  r2: number; // R-squared coefficient
}

/**
 * Data split for validation
 */
interface DataSplit {
  train: number[];
  test: number[];
  trainSize: number;
  testSize: number;
}

/**
 * Advanced Forecasting Engine
 */
export class ForecastingEngine {
  private config: Required<ForecastConfig>;

  constructor(config: ForecastConfig = {}) {
    this.config = {
      model: config.model ?? "auto",
      horizon: config.horizon ?? 10,
      confidence: config.confidence ?? 0.95,
      seasonalPeriod: config.seasonalPeriod ?? 7,
      alpha: config.alpha ?? 0.3,
      beta: config.beta ?? 0.1,
      gamma: config.gamma ?? 0.1,
      includeHistory: config.includeHistory ?? false,
      splitRatio: config.splitRatio ?? 0.8,
    };
  }

  /**
   * Main forecasting method
   */
  forecast(values: number[], timestamps?: Date[]): ForecastResult {
    if (values.length < 2) {
      return this.createEmptyResult();
    }

    // Auto-select model if needed
    const model =
      this.config.model === "auto"
        ? this.selectBestModel(values)
        : this.config.model;

    // Generate forecast based on selected model
    let result: ForecastResult;

    switch (model) {
      case "linear_trend":
        result = this.linearTrendForecast(values, timestamps);
        break;
      case "seasonal_naive":
        result = this.seasonalNaiveForecast(values, timestamps);
        break;
      case "exponential_smoothing":
        result = this.exponentialSmoothingForecast(values, timestamps);
        break;
      case "holt_winters":
        result = this.holtWintersForecast(values, timestamps);
        break;
      case "moving_average":
        result = this.movingAverageForecast(values, timestamps);
        break;
      default:
        result = this.linearTrendForecast(values, timestamps);
    }

    // Add historical data if requested
    if (this.config.includeHistory) {
      result.historical = values;
    }

    // Calculate accuracy if we have enough data
    if (values.length > this.config.horizon * 2) {
      const split = this.splitData(values);
      const testForecast = this.generateForecast(
        split.train,
        model,
        split.testSize,
      );
      result.accuracy = this.calculateAccuracy(
        split.test,
        testForecast.map((p) => p.value),
      );
    }

    return result;
  }

  /**
   * Forecast time series data
   */
  forecastTimeSeries(timeSeries: TimeSeriesPoint[]): ForecastResult {
    const values = timeSeries.map((p) => p.value);
    const timestamps = timeSeries.map((p) => p.timestamp);
    return this.forecast(values, timestamps);
  }

  /**
   * Linear trend projection
   */
  private linearTrendForecast(
    values: number[],
    timestamps?: Date[],
  ): ForecastResult {
    const x = values.map((_, i) => i);
    const regression = StatisticsEngine.linearRegression(x, values);

    const forecast: ForecastPoint[] = [];
    const residuals = regression.residuals;
    const stdError = Math.max(
      0.01,
      StatisticsEngine.calculateStandardDeviation(residuals),
    );
    const zScore = this.getZScore(this.config.confidence);

    for (let i = 0; i < this.config.horizon; i++) {
      const futureX = values.length + i;
      const predictedValue = regression.slope * futureX + regression.intercept;
      const margin = Math.max(
        0.01,
        zScore * stdError * Math.sqrt(1 + 1 / values.length),
      );

      forecast.push({
        index: futureX,
        timestamp: timestamps
          ? this.extrapolateTimestamp(timestamps, i)
          : undefined,
        value: predictedValue,
        lower: predictedValue - margin,
        upper: predictedValue + margin,
        model: "linear_trend",
      });
    }

    return {
      forecast,
      model: "linear_trend",
      parameters: {
        slope: regression.slope,
        intercept: regression.intercept,
        rSquared: regression.rSquared,
      },
      residuals,
      trendComponent: values.map(
        (_, i) => regression.slope * i + regression.intercept,
      ),
    };
  }

  /**
   * Seasonal naive forecast
   */
  private seasonalNaiveForecast(
    values: number[],
    timestamps?: Date[],
  ): ForecastResult {
    const period = this.config.seasonalPeriod;
    const forecast: ForecastPoint[] = [];

    // Calculate seasonal pattern
    const seasonalPattern = this.extractSeasonalPattern(values, period);

    // Calculate trend
    const detrended = this.detrend(values);
    const trendSlope = this.calculateTrendSlope(values);

    // Generate forecast
    for (let i = 0; i < this.config.horizon; i++) {
      const seasonalIndex = i % period;
      const trendValue = values[values.length - 1] + trendSlope * (i + 1);
      const seasonalValue = seasonalPattern[seasonalIndex];
      const predictedValue = trendValue + seasonalValue;

      // Calculate prediction interval based on historical variance
      const variance = StatisticsEngine.calculateVariance(detrended);
      const stdError = Math.sqrt(variance);
      const zScore = this.getZScore(this.config.confidence);
      const margin = zScore * stdError;

      forecast.push({
        index: values.length + i,
        timestamp: timestamps
          ? this.extrapolateTimestamp(timestamps, i)
          : undefined,
        value: predictedValue,
        lower: predictedValue - margin,
        upper: predictedValue + margin,
        model: "seasonal_naive",
      });
    }

    return {
      forecast,
      model: "seasonal_naive",
      parameters: {
        period,
        trendSlope,
        seasonalStrength: this.calculateSeasonalStrength(values, period),
      },
      seasonalComponent: seasonalPattern,
    };
  }

  /**
   * Exponential smoothing forecast
   */
  private exponentialSmoothingForecast(
    values: number[],
    timestamps?: Date[],
  ): ForecastResult {
    const alpha = this.config.alpha;
    const smoothed = StatisticsEngine.exponentialSmoothing(values, alpha);
    const lastSmoothed = smoothed[smoothed.length - 1];

    // Calculate trend from smoothed values
    const trend = this.calculateTrendFromSmoothed(smoothed);

    const forecast: ForecastPoint[] = [];
    const residuals: number[] = values.map((v, i) => v - smoothed[i]);
    const stdError = StatisticsEngine.calculateStandardDeviation(residuals);
    const zScore = this.getZScore(this.config.confidence);

    for (let i = 0; i < this.config.horizon; i++) {
      const predictedValue = lastSmoothed + trend * (i + 1);
      const margin = zScore * stdError * Math.sqrt(1 + alpha * (i + 1));

      forecast.push({
        index: values.length + i,
        timestamp: timestamps
          ? this.extrapolateTimestamp(timestamps, i)
          : undefined,
        value: predictedValue,
        lower: predictedValue - margin,
        upper: predictedValue + margin,
        model: "exponential_smoothing",
      });
    }

    return {
      forecast,
      model: "exponential_smoothing",
      parameters: {
        alpha,
        initialLevel: smoothed[0],
        finalLevel: lastSmoothed,
        trend,
      },
      residuals,
      trendComponent: smoothed,
    };
  }

  /**
   * Holt-Winters forecast (with trend and seasonality)
   */
  private holtWintersForecast(
    values: number[],
    timestamps?: Date[],
  ): ForecastResult {
    const { alpha, beta, gamma } = this.config;
    const period = this.config.seasonalPeriod;

    if (values.length < period * 2) {
      // Fall back to exponential smoothing if not enough data
      return this.exponentialSmoothingForecast(values, timestamps);
    }

    // Initialize components
    const { level, trend, seasonal } = this.initializeHoltWinters(
      values,
      period,
    );

    // Apply Holt-Winters algorithm
    const smoothedLevel: number[] = [level];
    const smoothedTrend: number[] = [trend];
    const smoothedSeasonal: number[][] = [seasonal];

    for (let i = period; i < values.length; i++) {
      const prevLevel = smoothedLevel[smoothedLevel.length - 1];
      const prevTrend = smoothedTrend[smoothedTrend.length - 1];
      const prevSeasonal = smoothedSeasonal[smoothedSeasonal.length - 1];

      // Update level
      const newLevel =
        alpha * (values[i] - prevSeasonal[i % period]) +
        (1 - alpha) * (prevLevel + prevTrend);

      // Update trend
      const newTrend = beta * (newLevel - prevLevel) + (1 - beta) * prevTrend;

      // Update seasonal
      const newSeasonal = [...prevSeasonal];
      newSeasonal[i % period] =
        gamma * (values[i] - newLevel) + (1 - gamma) * prevSeasonal[i % period];

      smoothedLevel.push(newLevel);
      smoothedTrend.push(newTrend);
      smoothedSeasonal.push(newSeasonal);
    }

    // Generate forecast
    const lastLevel = smoothedLevel[smoothedLevel.length - 1];
    const lastTrend = smoothedTrend[smoothedTrend.length - 1];
    const lastSeasonal = smoothedSeasonal[smoothedSeasonal.length - 1];

    const forecast: ForecastPoint[] = [];
    const fittedValues = this.calculateFittedValues(
      smoothedLevel,
      smoothedTrend,
      smoothedSeasonal,
      period,
    );
    const residuals = values.map((v, i) => v - fittedValues[i]);
    const stdError = StatisticsEngine.calculateStandardDeviation(residuals);
    const zScore = this.getZScore(this.config.confidence);

    for (let h = 0; h < this.config.horizon; h++) {
      const predictedValue =
        lastLevel + lastTrend * (h + 1) + lastSeasonal[h % period];
      const margin = zScore * stdError * Math.sqrt(1 + h * 0.1);

      forecast.push({
        index: values.length + h,
        timestamp: timestamps
          ? this.extrapolateTimestamp(timestamps, h)
          : undefined,
        value: predictedValue,
        lower: predictedValue - margin,
        upper: predictedValue + margin,
        model: "holt_winters",
      });
    }

    return {
      forecast,
      model: "holt_winters",
      parameters: {
        alpha,
        beta,
        gamma,
        lastLevel,
        lastTrend,
      },
      residuals,
      seasonalComponent: lastSeasonal,
      trendComponent: smoothedLevel,
    };
  }

  /**
   * Moving average forecast
   */
  private movingAverageForecast(
    values: number[],
    timestamps?: Date[],
  ): ForecastResult {
    const windowSize = Math.min(
      Math.floor(values.length / 3),
      this.config.seasonalPeriod,
    );
    const movingAvg = StatisticsEngine.movingAverage(values, windowSize);

    // Use the trend from moving average for forecasting
    const recentTrend = this.calculateRecentTrend(movingAvg);
    const lastMA = movingAvg[movingAvg.length - 1];

    const forecast: ForecastPoint[] = [];
    const residuals = values
      .slice(windowSize - 1)
      .map((v, i) => v - movingAvg[i]);
    const stdError = StatisticsEngine.calculateStandardDeviation(residuals);
    const zScore = this.getZScore(this.config.confidence);

    for (let i = 0; i < this.config.horizon; i++) {
      const predictedValue = lastMA + recentTrend * (i + 1);
      const margin = zScore * stdError * Math.sqrt(1 + i / windowSize);

      forecast.push({
        index: values.length + i,
        timestamp: timestamps
          ? this.extrapolateTimestamp(timestamps, i)
          : undefined,
        value: predictedValue,
        lower: predictedValue - margin,
        upper: predictedValue + margin,
        model: "moving_average",
      });
    }

    return {
      forecast,
      model: "moving_average",
      parameters: {
        windowSize,
        trend: recentTrend,
        lastValue: lastMA,
      },
      residuals,
    };
  }

  /**
   * Auto-select best model based on data characteristics
   */
  private selectBestModel(values: number[]): ForecastModel {
    // Check for seasonality
    const seasonalStrength = this.calculateSeasonalStrength(
      values,
      this.config.seasonalPeriod,
    );

    // Check for trend
    const trendStrength = this.calculateTrendStrength(values);

    // Check data length
    const hasEnoughData = values.length >= this.config.seasonalPeriod * 2;

    // Model selection logic
    if (hasEnoughData && seasonalStrength > 0.3 && trendStrength > 0.3) {
      return "holt_winters";
    } else if (seasonalStrength > 0.3) {
      return "seasonal_naive";
    } else if (trendStrength > 0.5) {
      return "linear_trend";
    } else if (values.length > 20) {
      return "exponential_smoothing";
    } else {
      return "moving_average";
    }
  }

  /**
   * Calculate accuracy metrics
   */
  calculateAccuracy(actual: number[], predicted: number[]): AccuracyMetrics {
    const n = Math.min(actual.length, predicted.length);
    if (n === 0) {
      return {
        mae: 0,
        mse: 0,
        rmse: 0,
        mape: 0,
        smape: 0,
        mase: 0,
        r2: 0,
      };
    }

    let mae = 0;
    let mse = 0;
    let mape = 0;
    let smape = 0;

    for (let i = 0; i < n; i++) {
      const error = actual[i] - predicted[i];
      const absError = Math.abs(error);

      mae += absError;
      mse += error * error;

      if (actual[i] !== 0) {
        mape += absError / Math.abs(actual[i]);
      }

      const denominator = Math.abs(actual[i]) + Math.abs(predicted[i]);
      if (denominator !== 0) {
        smape += absError / (denominator / 2);
      }
    }

    mae /= n;
    mse /= n;
    mape = (mape / n) * 100;
    smape = (smape / n) * 100;

    const rmse = Math.sqrt(mse);

    // Calculate MASE (Mean Absolute Scaled Error)
    let naiveMae = 0;
    for (let i = 1; i < actual.length; i++) {
      naiveMae += Math.abs(actual[i] - actual[i - 1]);
    }
    naiveMae /= actual.length - 1;
    const mase = naiveMae !== 0 ? mae / naiveMae : 0;

    // Calculate R-squared
    const meanActual = StatisticsEngine.calculateMean(actual.slice(0, n));
    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      ssRes += Math.pow(actual[i] - predicted[i], 2);
      ssTot += Math.pow(actual[i] - meanActual, 2);
    }

    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    return {
      mae,
      mse,
      rmse,
      mape,
      smape,
      mase,
      r2,
    };
  }

  /**
   * Cross-validation for model evaluation
   */
  crossValidate(
    values: number[],
    folds: number = 5,
  ): { model: ForecastModel; avgAccuracy: AccuracyMetrics }[] {
    const results: { model: ForecastModel; avgAccuracy: AccuracyMetrics }[] =
      [];
    const models: ForecastModel[] = [
      "linear_trend",
      "seasonal_naive",
      "exponential_smoothing",
      "holt_winters",
      "moving_average",
    ];

    for (const model of models) {
      const accuracies: AccuracyMetrics[] = [];

      // Perform k-fold cross-validation
      const foldSize = Math.floor(values.length / folds);

      for (let fold = 0; fold < folds; fold++) {
        const testStart = fold * foldSize;
        const testEnd = Math.min(testStart + foldSize, values.length);

        if (testEnd >= values.length - this.config.horizon) continue;

        const train = values.slice(0, testStart).concat(values.slice(testEnd));
        const test = values.slice(testEnd, testEnd + this.config.horizon);

        const forecast = this.generateForecast(train, model, test.length);
        const accuracy = this.calculateAccuracy(
          test,
          forecast.map((p) => p.value),
        );

        accuracies.push(accuracy);
      }

      // Calculate average accuracy
      if (accuracies.length > 0) {
        const avgAccuracy = this.averageAccuracy(accuracies);
        results.push({ model, avgAccuracy });
      }
    }

    // Sort by RMSE (lower is better)
    results.sort((a, b) => a.avgAccuracy.rmse - b.avgAccuracy.rmse);

    return results;
  }

  /**
   * Helper methods
   */
  private splitData(values: number[]): DataSplit {
    const trainSize = Math.floor(values.length * this.config.splitRatio);
    const testSize = values.length - trainSize;

    return {
      train: values.slice(0, trainSize),
      test: values.slice(trainSize),
      trainSize,
      testSize,
    };
  }

  private generateForecast(
    values: number[],
    model: ForecastModel,
    horizon: number,
  ): ForecastPoint[] {
    const tempEngine = new ForecastingEngine({
      ...this.config,
      model,
      horizon,
    });

    const result = tempEngine.forecast(values);
    return result.forecast;
  }

  private extractSeasonalPattern(values: number[], period: number): number[] {
    if (values.length < period) {
      return new Array(period).fill(0);
    }

    const pattern = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    // Detrend the data first
    const detrended = this.detrend(values);

    // Calculate average for each position in the period
    for (let i = 0; i < detrended.length; i++) {
      const position = i % period;
      pattern[position] += detrended[i];
      counts[position]++;
    }

    // Calculate mean for each position
    for (let i = 0; i < period; i++) {
      if (counts[i] > 0) {
        pattern[i] /= counts[i];
      }
    }

    // Center the pattern
    const meanPattern = StatisticsEngine.calculateMean(pattern);
    return pattern.map((p) => p - meanPattern);
  }

  private detrend(values: number[]): number[] {
    const x = values.map((_, i) => i);
    const regression = StatisticsEngine.linearRegression(x, values);
    return values.map(
      (v, i) => v - (regression.slope * i + regression.intercept),
    );
  }

  private calculateTrendSlope(values: number[]): number {
    const x = values.map((_, i) => i);
    const regression = StatisticsEngine.linearRegression(x, values);
    return regression.slope;
  }

  private calculateTrendFromSmoothed(smoothed: number[]): number {
    if (smoothed.length < 2) return 0;

    // Use last few points to estimate trend
    const recentPoints = Math.min(5, smoothed.length);
    const recent = smoothed.slice(-recentPoints);
    const x = recent.map((_, i) => i);
    const regression = StatisticsEngine.linearRegression(x, recent);

    return regression.slope;
  }

  private calculateRecentTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const recentPoints = Math.min(5, values.length);
    const recent = values.slice(-recentPoints);
    return this.calculateTrendSlope(recent);
  }

  private calculateSeasonalStrength(values: number[], period: number): number {
    if (values.length < period * 2) return 0;

    const detrended = this.detrend(values);
    const seasonal = this.extractSeasonalPattern(values, period);

    // Calculate how much variance is explained by seasonality
    const totalVariance = StatisticsEngine.calculateVariance(detrended);
    const seasonalVariance = StatisticsEngine.calculateVariance(seasonal);

    return totalVariance > 0 ? seasonalVariance / totalVariance : 0;
  }

  private calculateTrendStrength(values: number[]): number {
    const x = values.map((_, i) => i);
    const regression = StatisticsEngine.linearRegression(x, values);
    return Math.abs(regression.rSquared);
  }

  private initializeHoltWinters(
    values: number[],
    period: number,
  ): { level: number; trend: number; seasonal: number[] } {
    // Initialize level as mean of first period
    const level = StatisticsEngine.calculateMean(values.slice(0, period));

    // Initialize trend from first two periods
    const firstPeriodMean = level;
    const secondPeriodMean = StatisticsEngine.calculateMean(
      values.slice(period, period * 2),
    );
    const trend = (secondPeriodMean - firstPeriodMean) / period;

    // Initialize seasonal pattern
    const seasonal = new Array(period);
    for (let i = 0; i < period; i++) {
      seasonal[i] = values[i] - (level + trend * i);
    }

    return { level, trend, seasonal };
  }

  private calculateFittedValues(
    levels: number[],
    trends: number[],
    seasonals: number[][],
    period: number,
  ): number[] {
    const fitted: number[] = [];

    for (let i = 0; i < levels.length; i++) {
      const seasonal = seasonals[Math.min(i, seasonals.length - 1)];
      const value = levels[i] + trends[i] + seasonal[i % period];
      fitted.push(value);
    }

    return fitted;
  }

  private extrapolateTimestamp(timestamps: Date[], offset: number): Date {
    if (timestamps.length < 2) {
      // Default to daily frequency
      const lastTime = timestamps[timestamps.length - 1].getTime();
      return new Date(lastTime + offset * 24 * 60 * 60 * 1000);
    }

    // Calculate average time difference
    let totalDiff = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalDiff += timestamps[i].getTime() - timestamps[i - 1].getTime();
    }
    const avgDiff = totalDiff / (timestamps.length - 1);

    const lastTime = timestamps[timestamps.length - 1].getTime();
    return new Date(lastTime + avgDiff * (offset + 1));
  }

  private getZScore(confidence: number): number {
    // Common confidence levels
    if (confidence === 0.95) return 1.96;
    if (confidence === 0.99) return 2.576;
    if (confidence === 0.9) return 1.645;

    // For other values, use approximation
    return 1.96; // Default to 95% confidence
  }

  private averageAccuracy(accuracies: AccuracyMetrics[]): AccuracyMetrics {
    const n = accuracies.length;
    if (n === 0) {
      return {
        mae: 0,
        mse: 0,
        rmse: 0,
        mape: 0,
        smape: 0,
        mase: 0,
        r2: 0,
      };
    }

    return {
      mae: accuracies.reduce((sum, a) => sum + a.mae, 0) / n,
      mse: accuracies.reduce((sum, a) => sum + a.mse, 0) / n,
      rmse: accuracies.reduce((sum, a) => sum + a.rmse, 0) / n,
      mape: accuracies.reduce((sum, a) => sum + a.mape, 0) / n,
      smape: accuracies.reduce((sum, a) => sum + a.smape, 0) / n,
      mase: accuracies.reduce((sum, a) => sum + a.mase, 0) / n,
      r2: accuracies.reduce((sum, a) => sum + a.r2, 0) / n,
    };
  }

  private createEmptyResult(): ForecastResult {
    return {
      forecast: [],
      model: "linear_trend",
      parameters: {},
    };
  }
}
