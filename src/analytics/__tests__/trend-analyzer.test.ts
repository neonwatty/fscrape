import { describe, it, expect, beforeEach } from "vitest";
import { TrendAnalyzer, TimeSeriesPoint } from "../trend-analyzer.js";

describe("TrendAnalyzer", () => {
  let analyzer: TrendAnalyzer;

  beforeEach(() => {
    analyzer = new TrendAnalyzer();
  });

  describe("Trend Analysis", () => {
    it("should detect increasing trend", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = analyzer.analyzeTrend(values);

      expect(result.trend).toBe("increasing");
      expect(result.slope).toBeGreaterThan(0);
      expect(result.changePercent).toBeGreaterThan(0);
    });

    it("should detect decreasing trend", () => {
      const values = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      const result = analyzer.analyzeTrend(values);

      expect(result.trend).toBe("decreasing");
      expect(result.slope).toBeLessThan(0);
      expect(result.changePercent).toBeLessThan(0);
    });

    it("should detect stable trend", () => {
      const values = [5, 5.1, 4.9, 5, 5.2, 4.8, 5.1, 5, 4.9, 5];
      const result = analyzer.analyzeTrend(values);

      expect(result.trend).toBe("stable");
      expect(Math.abs(result.slope)).toBeLessThan(0.5);
    });

    it("should detect volatile trend", () => {
      const values = [1, 10, 2, 15, 3, 20, 1, 25, 2, 30];
      const result = analyzer.analyzeTrend(values);

      expect(result.trend).toBe("volatile");
      expect(result.volatility).toBeGreaterThan(0.5);
    });

    it("should provide predictions", () => {
      const values = [1, 2, 3, 4, 5];
      const result = analyzer.analyzeTrend(values);

      expect(result.predictions).toBeDefined();
      expect(result.predictions.nextValue).toBeGreaterThan(5);
      expect(result.predictions.confidence).toBeGreaterThan(0);
      expect(result.predictions.range.min).toBeLessThan(
        result.predictions.nextValue,
      );
      expect(result.predictions.range.max).toBeGreaterThan(
        result.predictions.nextValue,
      );
    });
  });

  describe("Time Series Analysis", () => {
    it("should analyze time series data", () => {
      const timeSeries: TimeSeriesPoint[] = [
        { timestamp: new Date("2024-01-01"), value: 100 },
        { timestamp: new Date("2024-01-02"), value: 110 },
        { timestamp: new Date("2024-01-03"), value: 120 },
        { timestamp: new Date("2024-01-04"), value: 130 },
        { timestamp: new Date("2024-01-05"), value: 140 },
      ];

      const result = analyzer.analyzeTimeSeries(timeSeries);

      expect(result.trend).toBe("increasing");
      expect(result.slope).toBeGreaterThan(0);
    });
  });

  describe("Change Point Detection", () => {
    it("should detect change points", () => {
      const values = [1, 1, 1, 1, 1, 10, 10, 10, 10, 10, 5, 5, 5, 5, 5];

      const changePoints = analyzer.detectChangePoints(values, 2);

      expect(changePoints.length).toBeGreaterThan(0);
      expect(changePoints[0].type).toBe("increase");
    });

    it("should handle no change points", () => {
      const values = [5, 5, 5, 5, 5, 5, 5, 5];
      const changePoints = analyzer.detectChangePoints(values, 3);

      expect(changePoints.length).toBe(0);
    });
  });

  describe("Seasonality Detection", () => {
    it("should detect weekly seasonality", () => {
      const timeSeries: TimeSeriesPoint[] = [];
      for (let i = 0; i < 28; i++) {
        timeSeries.push({
          timestamp: new Date(2024, 0, i + 1),
          value: 100 + 20 * Math.sin((2 * Math.PI * i) / 7),
        });
      }

      const pattern = analyzer.detectSeasonality(timeSeries);

      expect(pattern).not.toBeNull();
      if (pattern) {
        expect(pattern.period).toBe(7);
        expect(pattern.pattern.length).toBe(7);
        expect(pattern.strength).toBeGreaterThan(0);
      }
    });

    it("should return null for insufficient data", () => {
      const timeSeries: TimeSeriesPoint[] = [
        { timestamp: new Date("2024-01-01"), value: 100 },
        { timestamp: new Date("2024-01-02"), value: 110 },
      ];

      const pattern = analyzer.detectSeasonality(timeSeries);
      expect(pattern).toBeNull();
    });
  });

  describe("Anomaly Detection", () => {
    it("should detect anomalies using z-score method", () => {
      const values = [10, 11, 12, 10, 11, 100, 12, 11, 10, 11];
      const result = analyzer.detectAnomalies(values, "zscore");

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].value).toBe(100);
      expect(result.method).toBe("zscore");
    });

    it("should detect anomalies using IQR method", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const result = analyzer.detectAnomalies(values, "iqr");

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.method).toBe("iqr");
    });

    it("should detect anomalies using isolation forest method", () => {
      const values = [10, 11, 12, 10, 11, 50, 12, 11, 10, 11];
      const result = analyzer.detectAnomalies(values, "isolation");

      expect(result.method).toBe("isolation");
      expect(result.anomalies).toBeDefined();
    });

    it("should classify anomaly severity", () => {
      const values = [10, 11, 12, 10, 11, 30, 50, 100, 11, 10];
      const result = analyzer.detectAnomalies(values, "zscore");

      const severities = result.anomalies.map((a) => a.severity);
      expect(severities.length).toBeGreaterThan(0);
      expect(
        severities.some((s) => s === "high" || s === "medium" || s === "low"),
      ).toBe(true);
    });
  });

  describe("Forecasting", () => {
    it("should forecast using linear method", () => {
      const values = [1, 2, 3, 4, 5];
      const forecast = analyzer.forecastValues(values, 3, "linear");

      expect(forecast.length).toBe(3);
      expect(forecast[0]).toBeGreaterThan(5);
      expect(forecast[1]).toBeGreaterThan(forecast[0]);
    });

    it("should forecast using exponential smoothing", () => {
      const values = [10, 12, 11, 13, 12, 14, 13];
      const forecast = analyzer.forecastValues(values, 3, "exponential");

      expect(forecast.length).toBe(3);
      forecast.forEach((val) => {
        expect(val).toBeGreaterThan(0);
        expect(typeof val).toBe("number");
      });
    });

    it("should forecast using ARIMA method", () => {
      const values = [10, 12, 11, 13, 12, 14, 13, 15];
      const forecast = analyzer.forecastValues(values, 3, "arima");

      expect(forecast.length).toBe(3);
      forecast.forEach((val) => {
        expect(typeof val).toBe("number");
      });
    });
  });

  describe("Trend Comparison", () => {
    it("should compare similar trends", () => {
      const values1 = [1, 2, 3, 4, 5];
      const values2 = [2, 3, 4, 5, 6];

      const trend1 = analyzer.analyzeTrend(values1);
      const trend2 = analyzer.analyzeTrend(values2);

      const comparison = analyzer.compareTriends(trend1, trend2);

      expect(comparison.correlation).toBeGreaterThan(0.5);
      expect(comparison.similar).toBe(true);
    });

    it("should compare different trends", () => {
      const values1 = [1, 2, 3, 4, 5];
      const values2 = [5, 4, 3, 2, 1];

      const trend1 = analyzer.analyzeTrend(values1);
      const trend2 = analyzer.analyzeTrend(values2);

      const comparison = analyzer.compareTriends(trend1, trend2);

      expect(comparison.similar).toBe(false);
    });
  });

  describe("Technical Indicators", () => {
    it("should calculate momentum", () => {
      const values = [10, 11, 12, 11, 13, 14, 15, 16, 14, 15, 16, 17];
      const momentum = analyzer.calculateMomentum(values, 3);

      expect(momentum.length).toBe(values.length - 3);
      momentum.forEach((val) => {
        expect(typeof val).toBe("number");
      });
    });

    it("should calculate RSI", () => {
      const values = [
        44, 44.5, 44.25, 43.75, 44.5, 45, 45.5, 45.25, 46, 47, 47.5, 46.75,
        46.25, 46.5, 46.25, 47, 47.25, 48, 47.5, 47.25,
      ];

      const rsi = analyzer.calculateRSI(values, 14);

      expect(rsi.length).toBeGreaterThan(0);
      rsi.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty arrays", () => {
      const result = analyzer.analyzeTrend([]);

      expect(result.trend).toBe("stable");
      expect(result.slope).toBe(0);
      expect(result.predictions.nextValue).toBe(0);
    });

    it("should handle single value", () => {
      const result = analyzer.analyzeTrend([5]);

      expect(result.trend).toBe("stable");
      expect(result.slope).toBe(0);
    });

    it("should handle custom options", () => {
      const customAnalyzer = new TrendAnalyzer({
        windowSize: 5,
        smoothingFactor: 0.5,
        anomalyThreshold: 3,
      });

      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = customAnalyzer.analyzeTrend(values);

      expect(result).toBeDefined();
      expect(result.trend).toBeDefined();
    });
  });
});
