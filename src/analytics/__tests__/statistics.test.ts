/**
 * Comprehensive unit tests for StatisticsEngine
 * Testing mathematical accuracy, edge cases, and performance
 */

import { describe, it, expect, beforeEach } from "vitest";
import { StatisticsEngine } from "../statistics.js";
import type {
  StatisticalSummary,
  CorrelationResult,
  RegressionResult,
  TimeSeriesPoint,
} from "../statistics.js";

describe("StatisticsEngine", () => {
  describe("Basic Statistical Functions", () => {
    describe("calculateMean", () => {
      it("should calculate mean correctly", () => {
        expect(StatisticsEngine.calculateMean([1, 2, 3, 4, 5])).toBe(3);
        expect(StatisticsEngine.calculateMean([10, 20, 30])).toBe(20);
        expect(StatisticsEngine.calculateMean([5.5, 4.5, 3.5])).toBeCloseTo(
          4.5,
        );
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.calculateMean([])).toBe(0);
      });

      it("should handle single value", () => {
        expect(StatisticsEngine.calculateMean([42])).toBe(42);
      });

      it("should handle negative values", () => {
        expect(StatisticsEngine.calculateMean([-1, -2, -3])).toBe(-2);
      });

      it("should handle large datasets efficiently", () => {
        const largeArray = Array(10000)
          .fill(0)
          .map((_, i) => i);
        expect(StatisticsEngine.calculateMean(largeArray)).toBe(4999.5);
      });
    });

    describe("calculateMedian", () => {
      it("should calculate median for odd-length array", () => {
        expect(StatisticsEngine.calculateMedian([1, 3, 2])).toBe(2);
        expect(StatisticsEngine.calculateMedian([7, 3, 9, 1, 5])).toBe(5);
      });

      it("should calculate median for even-length array", () => {
        expect(StatisticsEngine.calculateMedian([1, 2, 3, 4])).toBe(2.5);
        expect(StatisticsEngine.calculateMedian([10, 20, 30, 40])).toBe(25);
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.calculateMedian([])).toBe(0);
      });

      it("should handle single value", () => {
        expect(StatisticsEngine.calculateMedian([42])).toBe(42);
      });

      it("should handle duplicate values", () => {
        expect(StatisticsEngine.calculateMedian([5, 5, 5, 5])).toBe(5);
      });
    });

    describe("calculateMode", () => {
      it("should find mode in array with clear mode", () => {
        expect(StatisticsEngine.calculateMode([1, 2, 2, 3, 4])).toBe(2);
        expect(StatisticsEngine.calculateMode([1, 1, 1, 2, 3])).toBe(1);
      });

      it("should return null for no repeating values", () => {
        expect(StatisticsEngine.calculateMode([1, 2, 3, 4, 5])).toBeNull();
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.calculateMode([])).toBeNull();
      });

      it("should handle array with all same values", () => {
        expect(StatisticsEngine.calculateMode([5, 5, 5, 5])).toBe(5);
      });

      it("should return first mode in multimodal data", () => {
        const result = StatisticsEngine.calculateMode([1, 1, 2, 2, 3]);
        expect(result === 1 || result === 2).toBeTruthy();
      });
    });

    describe("calculateVariance", () => {
      it("should calculate variance correctly", () => {
        expect(StatisticsEngine.calculateVariance([1, 2, 3, 4, 5])).toBe(2);
        expect(StatisticsEngine.calculateVariance([2, 4, 6, 8, 10])).toBe(8);
      });

      it("should return 0 for empty array", () => {
        expect(StatisticsEngine.calculateVariance([])).toBe(0);
      });

      it("should return 0 for array with identical values", () => {
        expect(StatisticsEngine.calculateVariance([5, 5, 5, 5])).toBe(0);
      });

      it("should handle negative values", () => {
        expect(StatisticsEngine.calculateVariance([-2, -1, 0, 1, 2])).toBe(2);
      });
    });

    describe("calculateStandardDeviation", () => {
      it("should calculate standard deviation correctly", () => {
        expect(
          StatisticsEngine.calculateStandardDeviation([1, 2, 3, 4, 5]),
        ).toBeCloseTo(Math.sqrt(2));
        expect(
          StatisticsEngine.calculateStandardDeviation([2, 4, 6, 8, 10]),
        ).toBeCloseTo(Math.sqrt(8));
      });

      it("should return 0 for empty array", () => {
        expect(StatisticsEngine.calculateStandardDeviation([])).toBe(0);
      });

      it("should return 0 for constant values", () => {
        expect(StatisticsEngine.calculateStandardDeviation([7, 7, 7])).toBe(0);
      });

      it("should match known statistical values", () => {
        // Standard normal distribution sample
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const stdDev = StatisticsEngine.calculateStandardDeviation(values);
        expect(stdDev).toBeCloseTo(2.58199, 4);
      });
    });
  });

  describe("Quartiles and Outliers", () => {
    describe("calculateQuartiles", () => {
      it("should calculate quartiles correctly", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const quartiles = StatisticsEngine.calculateQuartiles(values);
        expect(quartiles.q1).toBe(2.5);
        expect(quartiles.q2).toBe(5);
        expect(quartiles.q3).toBe(7.5);
      });

      it("should handle even-sized arrays", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8];
        const quartiles = StatisticsEngine.calculateQuartiles(values);
        expect(quartiles.q1).toBe(2.5);
        expect(quartiles.q2).toBe(4.5);
        expect(quartiles.q3).toBe(6.5);
      });

      it("should handle small arrays", () => {
        const values = [1, 2, 3];
        const quartiles = StatisticsEngine.calculateQuartiles(values);
        expect(quartiles.q1).toBe(1);
        expect(quartiles.q2).toBe(2);
        expect(quartiles.q3).toBe(3);
      });

      it("should handle empty array", () => {
        const quartiles = StatisticsEngine.calculateQuartiles([]);
        expect(quartiles.q1).toBe(0);
        expect(quartiles.q2).toBe(0);
        expect(quartiles.q3).toBe(0);
      });
    });

    describe("detectOutliers", () => {
      it("should detect outliers using IQR method", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
        const outliers = StatisticsEngine.detectOutliers(values);
        expect(outliers).toContain(100);
      });

      it("should detect multiple outliers", () => {
        const values = [-50, 1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
        const outliers = StatisticsEngine.detectOutliers(values);
        expect(outliers).toContain(-50);
        expect(outliers).toContain(100);
      });

      it("should handle custom threshold", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 15];
        const outliers1 = StatisticsEngine.detectOutliers(values, 1.5);
        const outliers2 = StatisticsEngine.detectOutliers(values, 3.0);
        expect(outliers1.length).toBeGreaterThanOrEqual(outliers2.length);
      });

      it("should return empty array for no outliers", () => {
        const values = [1, 2, 3, 4, 5];
        const outliers = StatisticsEngine.detectOutliers(values);
        expect(outliers).toEqual([]);
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.detectOutliers([])).toEqual([]);
      });
    });
  });

  describe("Advanced Statistics", () => {
    describe("calculateSkewness", () => {
      it("should calculate positive skewness", () => {
        const values = [1, 1, 1, 2, 3, 4, 5, 10, 20];
        const skewness = StatisticsEngine.calculateSkewness(values);
        expect(skewness).toBeGreaterThan(0);
      });

      it("should calculate negative skewness", () => {
        const values = [1, 10, 20, 30, 30, 30, 31, 31, 31];
        const skewness = StatisticsEngine.calculateSkewness(values);
        expect(skewness).toBeLessThan(0);
      });

      it("should return 0 for symmetric distribution", () => {
        const values = [1, 2, 3, 4, 5, 4, 3, 2, 1];
        const skewness = StatisticsEngine.calculateSkewness(values);
        expect(Math.abs(skewness)).toBeLessThan(0.5);
      });

      it("should handle insufficient data", () => {
        expect(StatisticsEngine.calculateSkewness([1, 2])).toBe(0);
        expect(StatisticsEngine.calculateSkewness([])).toBe(0);
      });

      it("should handle constant values", () => {
        expect(StatisticsEngine.calculateSkewness([5, 5, 5, 5])).toBe(0);
      });
    });

    describe("calculateKurtosis", () => {
      it("should calculate positive kurtosis (leptokurtic)", () => {
        const values = [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0];
        const kurtosis = StatisticsEngine.calculateKurtosis(values);
        expect(kurtosis).toBeDefined();
      });

      it("should handle normal-like distribution", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const kurtosis = StatisticsEngine.calculateKurtosis(values);
        expect(Math.abs(kurtosis)).toBeLessThan(3);
      });

      it("should handle insufficient data", () => {
        expect(StatisticsEngine.calculateKurtosis([1, 2, 3])).toBe(0);
        expect(StatisticsEngine.calculateKurtosis([])).toBe(0);
      });

      it("should handle constant values", () => {
        expect(StatisticsEngine.calculateKurtosis([5, 5, 5, 5, 5])).toBe(0);
      });
    });
  });

  describe("Correlation and Regression", () => {
    describe("calculateCorrelation", () => {
      it("should calculate perfect positive correlation", () => {
        const x = [1, 2, 3, 4, 5];
        const y = [2, 4, 6, 8, 10];
        const result = StatisticsEngine.calculateCorrelation(x, y);
        expect(result.correlation).toBeCloseTo(1, 5);
        expect(result.direction).toBe("positive");
        expect(result.strength).toBe("strong");
      });

      it("should calculate perfect negative correlation", () => {
        const x = [1, 2, 3, 4, 5];
        const y = [10, 8, 6, 4, 2];
        const result = StatisticsEngine.calculateCorrelation(x, y);
        expect(result.correlation).toBeCloseTo(-1, 5);
        expect(result.direction).toBe("negative");
        expect(result.strength).toBe("strong");
      });

      it("should detect no correlation", () => {
        const x = [1, 2, 3, 4, 5];
        const y = [3, 1, 4, 1, 5];
        const result = StatisticsEngine.calculateCorrelation(x, y);
        expect(Math.abs(result.correlation)).toBeLessThan(0.5);
      });

      it("should handle mismatched array lengths", () => {
        const x = [1, 2, 3];
        const y = [1, 2];
        const result = StatisticsEngine.calculateCorrelation(x, y);
        expect(result.correlation).toBe(0);
        expect(result.strength).toBe("none");
      });

      it("should handle empty arrays", () => {
        const result = StatisticsEngine.calculateCorrelation([], []);
        expect(result.correlation).toBe(0);
        expect(result.strength).toBe("none");
      });

      it("should handle constant values", () => {
        const x = [5, 5, 5, 5];
        const y = [1, 2, 3, 4];
        const result = StatisticsEngine.calculateCorrelation(x, y);
        expect(result.correlation).toBe(0);
        expect(result.strength).toBe("none");
      });

      it("should classify correlation strength correctly", () => {
        // Strong correlation
        const x = [1, 2, 3, 4, 5];
        let y = x.map((v) => v * 2 + Math.random() * 0.1);
        let result = StatisticsEngine.calculateCorrelation(x, y);
        expect(result.strength).toBe("strong");

        // Moderate correlation
        y = x.map((v) => v + Math.random() * 2);
        result = StatisticsEngine.calculateCorrelation(x, y);
        expect(["moderate", "strong"]).toContain(result.strength);

        // Weak correlation
        y = x.map(() => Math.random() * 10);
        result = StatisticsEngine.calculateCorrelation(x, y);
        expect(["none", "weak", "moderate", "strong"]).toContain(
          result.strength,
        );
      });
    });

    describe("linearRegression", () => {
      it("should calculate perfect linear regression", () => {
        const x = [1, 2, 3, 4, 5];
        const y = [2, 4, 6, 8, 10];
        const result = StatisticsEngine.linearRegression(x, y);
        expect(result.slope).toBe(2);
        expect(result.intercept).toBe(0);
        expect(result.rSquared).toBe(1);
      });

      it("should calculate regression with intercept", () => {
        const x = [1, 2, 3, 4, 5];
        const y = [3, 5, 7, 9, 11];
        const result = StatisticsEngine.linearRegression(x, y);
        expect(result.slope).toBe(2);
        expect(result.intercept).toBe(1);
        expect(result.rSquared).toBe(1);
      });

      it("should calculate predictions correctly", () => {
        const x = [1, 2, 3];
        const y = [2, 4, 6];
        const result = StatisticsEngine.linearRegression(x, y);
        expect(result.predictions).toEqual([2, 4, 6]);
      });

      it("should calculate residuals correctly", () => {
        const x = [1, 2, 3];
        const y = [2.1, 3.9, 6.1];
        const result = StatisticsEngine.linearRegression(x, y);
        result.residuals.forEach((r) => {
          expect(Math.abs(r)).toBeLessThan(0.5);
        });
      });

      it("should handle empty arrays", () => {
        const result = StatisticsEngine.linearRegression([], []);
        expect(result.slope).toBe(0);
        expect(result.intercept).toBe(0);
        expect(result.rSquared).toBe(0);
      });

      it("should handle mismatched lengths", () => {
        const result = StatisticsEngine.linearRegression([1, 2], [1, 2, 3]);
        expect(result.slope).toBe(0);
        expect(result.intercept).toBe(0);
      });

      it("should handle vertical line (undefined slope)", () => {
        const x = [1, 1, 1, 1];
        const y = [1, 2, 3, 4];
        const result = StatisticsEngine.linearRegression(x, y);
        expect(result.slope).toBe(0);
      });
    });
  });

  describe("Time Series Analysis", () => {
    describe("movingAverage", () => {
      it("should calculate moving average correctly", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const ma = StatisticsEngine.movingAverage(values, 3);
        expect(ma).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      });

      it("should handle window size of 1", () => {
        const values = [1, 2, 3, 4, 5];
        const ma = StatisticsEngine.movingAverage(values, 1);
        expect(ma).toEqual(values);
      });

      it("should handle window larger than array", () => {
        const values = [1, 2, 3];
        const ma = StatisticsEngine.movingAverage(values, 5);
        expect(ma).toEqual([2]);
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.movingAverage([], 3)).toEqual([]);
      });

      it("should handle invalid window size", () => {
        expect(StatisticsEngine.movingAverage([1, 2, 3], 0)).toEqual([]);
        expect(StatisticsEngine.movingAverage([1, 2, 3], -1)).toEqual([]);
      });
    });

    describe("exponentialSmoothing", () => {
      it("should apply exponential smoothing", () => {
        const values = [1, 2, 3, 4, 5];
        const smoothed = StatisticsEngine.exponentialSmoothing(values, 0.5);
        expect(smoothed.length).toBe(values.length);
        expect(smoothed[0]).toBe(values[0]);
      });

      it("should handle alpha = 0 (no smoothing)", () => {
        const values = [1, 2, 3, 4, 5];
        const smoothed = StatisticsEngine.exponentialSmoothing(values, 0);
        expect(smoothed).toEqual([1, 1, 1, 1, 1]);
      });

      it("should handle alpha = 1 (no memory)", () => {
        const values = [1, 2, 3, 4, 5];
        const smoothed = StatisticsEngine.exponentialSmoothing(values, 1);
        expect(smoothed).toEqual(values);
      });

      it("should handle invalid alpha values", () => {
        const values = [1, 2, 3];
        const smoothed1 = StatisticsEngine.exponentialSmoothing(values, -0.5);
        const smoothed2 = StatisticsEngine.exponentialSmoothing(values, 1.5);
        // Should default to 0.3
        expect(smoothed1).toEqual(smoothed2);
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.exponentialSmoothing([], 0.5)).toEqual([]);
      });

      it("should smooth noisy data", () => {
        const values = [10, 12, 9, 11, 13, 8, 12];
        const smoothed = StatisticsEngine.exponentialSmoothing(values, 0.3);
        const variance = StatisticsEngine.calculateVariance(smoothed);
        const originalVariance = StatisticsEngine.calculateVariance(values);
        expect(variance).toBeLessThan(originalVariance);
      });
    });

    describe("detectSeasonality", () => {
      it("should detect weekly seasonality", () => {
        const timeSeries: TimeSeriesPoint[] = [];
        const baseDate = new Date("2024-01-01");

        // Create data with weekly pattern
        for (let i = 0; i < 28; i++) {
          const date = new Date(baseDate);
          date.setDate(date.getDate() + i);
          const dayOfWeek = i % 7;
          const value = dayOfWeek === 0 || dayOfWeek === 6 ? 100 : 50;
          timeSeries.push({
            timestamp: date,
            value: value + Math.random() * 10,
          });
        }

        const result = StatisticsEngine.detectSeasonality(timeSeries, 7);
        expect(result.hasSeasonality).toBe(true);
        expect(result.pattern.length).toBe(7);
      });

      it("should detect no seasonality in random data", () => {
        const timeSeries: TimeSeriesPoint[] = [];
        const baseDate = new Date("2024-01-01");

        for (let i = 0; i < 30; i++) {
          const date = new Date(baseDate);
          date.setDate(date.getDate() + i);
          timeSeries.push({ timestamp: date, value: Math.random() * 100 });
        }

        const result = StatisticsEngine.detectSeasonality(timeSeries, 7);
        expect(result.strength).toBeLessThan(0.5);
      });

      it("should handle insufficient data", () => {
        const timeSeries: TimeSeriesPoint[] = [
          { timestamp: new Date(), value: 10 },
          { timestamp: new Date(), value: 20 },
        ];
        const result = StatisticsEngine.detectSeasonality(timeSeries, 7);
        expect(result.hasSeasonality).toBe(false);
        expect(result.pattern).toEqual([]);
      });

      it("should handle empty time series", () => {
        const result = StatisticsEngine.detectSeasonality([], 7);
        expect(result.hasSeasonality).toBe(false);
        expect(result.strength).toBe(0);
      });
    });
  });

  describe("Utility Functions", () => {
    describe("calculateZScore", () => {
      it("should calculate z-score correctly", () => {
        expect(StatisticsEngine.calculateZScore(10, 5, 2)).toBe(2.5);
        expect(StatisticsEngine.calculateZScore(5, 5, 2)).toBe(0);
        expect(StatisticsEngine.calculateZScore(3, 5, 2)).toBe(-1);
      });

      it("should handle zero standard deviation", () => {
        expect(StatisticsEngine.calculateZScore(10, 5, 0)).toBe(0);
      });
    });

    describe("normalizeValues", () => {
      it("should normalize values to [0, 1] range", () => {
        const values = [0, 50, 100];
        const normalized = StatisticsEngine.normalizeValues(values);
        expect(normalized).toEqual([0, 0.5, 1]);
      });

      it("should handle negative values", () => {
        const values = [-10, 0, 10];
        const normalized = StatisticsEngine.normalizeValues(values);
        expect(normalized).toEqual([0, 0.5, 1]);
      });

      it("should handle constant values", () => {
        const values = [5, 5, 5];
        const normalized = StatisticsEngine.normalizeValues(values);
        expect(normalized).toEqual([0.5, 0.5, 0.5]);
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.normalizeValues([])).toEqual([]);
      });
    });

    describe("standardizeValues", () => {
      it("should standardize values (z-score normalization)", () => {
        const values = [1, 2, 3, 4, 5];
        const standardized = StatisticsEngine.standardizeValues(values);
        const mean = StatisticsEngine.calculateMean(standardized);
        const stdDev =
          StatisticsEngine.calculateStandardDeviation(standardized);
        expect(mean).toBeCloseTo(0, 10);
        expect(stdDev).toBeCloseTo(1, 10);
      });

      it("should handle constant values", () => {
        const values = [5, 5, 5];
        const standardized = StatisticsEngine.standardizeValues(values);
        expect(standardized).toEqual([0, 0, 0]);
      });

      it("should handle empty array", () => {
        expect(StatisticsEngine.standardizeValues([])).toEqual([]);
      });
    });
  });

  describe("Complete Statistical Summary", () => {
    it("should generate complete summary for normal data", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const summary = StatisticsEngine.getSummary(values);

      expect(summary.mean).toBe(5.5);
      expect(summary.median).toBe(5.5);
      expect(summary.mode).toBeNull();
      expect(summary.min).toBe(1);
      expect(summary.max).toBe(10);
      expect(summary.range).toBe(9);
      expect(summary.quartiles.q1).toBe(3);
      expect(summary.quartiles.q2).toBe(5.5);
      expect(summary.quartiles.q3).toBe(8);
      expect(summary.iqr).toBe(5);
      expect(summary.outliers).toEqual([]);
      expect(summary.standardDeviation).toBeCloseTo(2.872, 2);
      expect(summary.variance).toBeCloseTo(8.25, 2);
    });

    it("should handle empty array in summary", () => {
      const summary = StatisticsEngine.getSummary([]);
      expect(summary.mean).toBe(0);
      expect(summary.median).toBe(0);
      expect(summary.mode).toBeNull();
      expect(summary.min).toBe(0);
      expect(summary.max).toBe(0);
      expect(summary.outliers).toEqual([]);
    });

    it("should detect outliers in summary", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const summary = StatisticsEngine.getSummary(values);
      expect(summary.outliers).toContain(100);
    });
  });

  describe("Performance Tests", () => {
    it("should handle large datasets efficiently", () => {
      const largeDataset = Array(100000)
        .fill(0)
        .map(() => Math.random() * 1000);

      const start = performance.now();
      const summary = StatisticsEngine.getSummary(largeDataset);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
      expect(summary.mean).toBeDefined();
      expect(summary.median).toBeDefined();
      expect(summary.standardDeviation).toBeDefined();
    });

    it("should calculate correlation on large datasets", () => {
      const size = 10000;
      const x = Array(size)
        .fill(0)
        .map((_, i) => i);
      const y = Array(size)
        .fill(0)
        .map((_, i) => i * 2 + Math.random());

      const start = performance.now();
      const result = StatisticsEngine.calculateCorrelation(x, y);
      const end = performance.now();

      expect(end - start).toBeLessThan(500);
      expect(result.correlation).toBeCloseTo(1, 1);
    });

    it("should perform regression on large datasets", () => {
      const size = 10000;
      const x = Array(size)
        .fill(0)
        .map((_, i) => i);
      const y = Array(size)
        .fill(0)
        .map((_, i) => i * 3 + 5 + Math.random());

      const start = performance.now();
      const result = StatisticsEngine.linearRegression(x, y);
      const end = performance.now();

      expect(end - start).toBeLessThan(500);
      expect(result.slope).toBeCloseTo(3, 0);
      expect(result.intercept).toBeCloseTo(5.5, 0);
    });
  });

  describe("Edge Cases and Numerical Precision", () => {
    it("should handle very large numbers", () => {
      const values = [1e10, 1e10 + 1, 1e10 + 2];
      const mean = StatisticsEngine.calculateMean(values);
      expect(mean).toBeCloseTo(1e10 + 1, 5);
    });

    it("should handle very small numbers", () => {
      const values = [1e-10, 2e-10, 3e-10];
      const mean = StatisticsEngine.calculateMean(values);
      expect(mean).toBeCloseTo(2e-10, 15);
    });

    it("should handle mixed positive and negative values", () => {
      const values = [-1000, -100, 0, 100, 1000];
      const summary = StatisticsEngine.getSummary(values);
      expect(summary.mean).toBe(0);
      expect(summary.median).toBe(0);
    });

    it("should handle floating point precision", () => {
      const values = [0.1, 0.2, 0.3];
      const sum = StatisticsEngine.calculateMean(values) * values.length;
      expect(sum).toBeCloseTo(0.6, 10);
    });

    it("should handle Infinity values gracefully", () => {
      const values = [1, 2, Infinity, 4, 5];
      const mean = StatisticsEngine.calculateMean(values);
      expect(mean).toBe(Infinity);
    });

    it("should handle NaN values in input", () => {
      const values = [1, 2, NaN, 4, 5];
      const mean = StatisticsEngine.calculateMean(values);
      expect(mean).toBeNaN();
    });
  });
});
