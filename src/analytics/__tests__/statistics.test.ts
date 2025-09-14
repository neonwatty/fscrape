import { describe, it, expect } from "vitest";
import { StatisticsEngine } from "../statistics.js";

describe("StatisticsEngine", () => {
  describe("Basic Statistics", () => {
    it("should calculate mean correctly", () => {
      expect(StatisticsEngine.calculateMean([1, 2, 3, 4, 5])).toBe(3);
      expect(StatisticsEngine.calculateMean([10, 20, 30])).toBe(20);
      expect(StatisticsEngine.calculateMean([])).toBe(0);
    });

    it("should calculate median correctly", () => {
      expect(StatisticsEngine.calculateMedian([1, 2, 3, 4, 5])).toBe(3);
      expect(StatisticsEngine.calculateMedian([1, 2, 3, 4])).toBe(2.5);
      expect(StatisticsEngine.calculateMedian([5, 1, 3])).toBe(3);
      expect(StatisticsEngine.calculateMedian([])).toBe(0);
    });

    it("should calculate mode correctly", () => {
      expect(StatisticsEngine.calculateMode([1, 2, 2, 3, 3, 3, 4])).toBe(3);
      expect(StatisticsEngine.calculateMode([1, 2, 3, 4])).toBeNull();
      expect(StatisticsEngine.calculateMode([])).toBeNull();
    });

    it("should calculate variance correctly", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const variance = StatisticsEngine.calculateVariance(values);
      expect(variance).toBeCloseTo(4, 1);
    });

    it("should calculate standard deviation correctly", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = StatisticsEngine.calculateStandardDeviation(values);
      expect(stdDev).toBeCloseTo(2, 1);
    });
  });

  describe("Quartiles and IQR", () => {
    it("should calculate quartiles correctly", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const quartiles = StatisticsEngine.calculateQuartiles(values);
      expect(quartiles.q1).toBe(2.5);
      expect(quartiles.q2).toBe(5);
      expect(quartiles.q3).toBe(7.5);
    });

    it("should detect outliers using IQR method", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const outliers = StatisticsEngine.detectOutliers(values);
      expect(outliers).toContain(100);
    });
  });

  describe("Advanced Statistics", () => {
    it("should calculate skewness", () => {
      const rightSkewed = [1, 1, 2, 2, 3, 4, 5, 6, 10, 15];
      const skewness = StatisticsEngine.calculateSkewness(rightSkewed);
      expect(skewness).toBeGreaterThan(0);
    });

    it("should calculate kurtosis", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const kurtosis = StatisticsEngine.calculateKurtosis(values);
      expect(kurtosis).toBeDefined();
      expect(typeof kurtosis).toBe("number");
    });
  });

  describe("Statistical Summary", () => {
    it("should generate complete statistical summary", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const summary = StatisticsEngine.getSummary(values);

      expect(summary.mean).toBe(5.5);
      expect(summary.median).toBe(5.5);
      expect(summary.min).toBe(1);
      expect(summary.max).toBe(10);
      expect(summary.range).toBe(9);
      expect(summary.quartiles).toBeDefined();
      expect(summary.standardDeviation).toBeGreaterThan(0);
    });

    it("should handle empty array in summary", () => {
      const summary = StatisticsEngine.getSummary([]);
      expect(summary.mean).toBe(0);
      expect(summary.median).toBe(0);
      expect(summary.mode).toBeNull();
    });
  });

  describe("Correlation and Regression", () => {
    it("should calculate positive correlation", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = StatisticsEngine.calculateCorrelation(x, y);

      expect(result.correlation).toBeCloseTo(1, 1);
      expect(result.strength).toBe("strong");
      expect(result.direction).toBe("positive");
    });

    it("should calculate negative correlation", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      const result = StatisticsEngine.calculateCorrelation(x, y);

      expect(result.correlation).toBeCloseTo(-1, 1);
      expect(result.strength).toBe("strong");
      expect(result.direction).toBe("negative");
    });

    it("should handle no correlation", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 1, 4, 2, 5];
      const result = StatisticsEngine.calculateCorrelation(x, y);

      expect(Math.abs(result.correlation)).toBeLessThan(0.5);
    });

    it("should perform linear regression", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = StatisticsEngine.linearRegression(x, y);

      expect(result.slope).toBeCloseTo(2, 1);
      expect(result.intercept).toBeCloseTo(0, 1);
      expect(result.rSquared).toBeCloseTo(1, 1);
    });
  });

  describe("Time Series Operations", () => {
    it("should calculate moving average", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const ma = StatisticsEngine.movingAverage(values, 3);

      expect(ma.length).toBe(8);
      expect(ma[0]).toBe(2);
      expect(ma[1]).toBe(3);
    });

    it("should apply exponential smoothing", () => {
      const values = [1, 3, 2, 5, 4, 7, 6];
      const smoothed = StatisticsEngine.exponentialSmoothing(values, 0.3);

      expect(smoothed.length).toBe(values.length);
      expect(smoothed[0]).toBe(values[0]);
      smoothed.forEach((val, i) => {
        if (i > 0) {
          expect(val).toBeDefined();
          expect(typeof val).toBe("number");
        }
      });
    });

    it("should detect seasonality", () => {
      const timeSeries = [];
      for (let i = 0; i < 28; i++) {
        timeSeries.push({
          timestamp: new Date(2024, 0, i + 1),
          value: 10 + 5 * Math.sin((2 * Math.PI * i) / 7),
        });
      }

      const result = StatisticsEngine.detectSeasonality(timeSeries, 7);
      expect(result.hasSeasonality).toBeDefined();
      expect(result.pattern.length).toBe(7);
    });
  });

  describe("Data Transformations", () => {
    it("should calculate z-scores", () => {
      const mean = 100;
      const stdDev = 15;

      expect(StatisticsEngine.calculateZScore(115, mean, stdDev)).toBe(1);
      expect(StatisticsEngine.calculateZScore(85, mean, stdDev)).toBe(-1);
      expect(StatisticsEngine.calculateZScore(100, mean, stdDev)).toBe(0);
    });

    it("should normalize values to 0-1 range", () => {
      const values = [10, 20, 30, 40, 50];
      const normalized = StatisticsEngine.normalizeValues(values);

      expect(Math.min(...normalized)).toBe(0);
      expect(Math.max(...normalized)).toBe(1);
      expect(normalized[2]).toBe(0.5);
    });

    it("should standardize values (z-score normalization)", () => {
      const values = [10, 20, 30, 40, 50];
      const standardized = StatisticsEngine.standardizeValues(values);

      const mean = StatisticsEngine.calculateMean(standardized);
      const stdDev = StatisticsEngine.calculateStandardDeviation(standardized);

      expect(mean).toBeCloseTo(0, 10);
      expect(stdDev).toBeCloseTo(1, 10);
    });
  });

  describe("Edge Cases", () => {
    it("should handle single value arrays", () => {
      const single = [5];
      expect(StatisticsEngine.calculateMean(single)).toBe(5);
      expect(StatisticsEngine.calculateMedian(single)).toBe(5);
      expect(StatisticsEngine.calculateStandardDeviation(single)).toBe(0);
    });

    it("should handle arrays with same values", () => {
      const same = [5, 5, 5, 5, 5];
      expect(StatisticsEngine.calculateMean(same)).toBe(5);
      expect(StatisticsEngine.calculateStandardDeviation(same)).toBe(0);
      expect(StatisticsEngine.calculateMode(same)).toBe(5);
    });

    it("should handle mismatched array lengths in correlation", () => {
      const x = [1, 2, 3];
      const y = [4, 5];
      const result = StatisticsEngine.calculateCorrelation(x, y);

      expect(result.correlation).toBe(0);
      expect(result.strength).toBe("none");
    });
  });
});
