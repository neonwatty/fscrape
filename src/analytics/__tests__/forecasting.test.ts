import { describe, it, expect, beforeEach } from "vitest";
import {
  ForecastingEngine,
  type ForecastConfig,
  type TimeSeriesPoint,
} from "../forecasting.js";

describe("ForecastingEngine", () => {
  let engine: ForecastingEngine;

  beforeEach(() => {
    engine = new ForecastingEngine();
  });

  describe("Basic Forecasting", () => {
    it("should generate forecast for simple data", () => {
      const values = [10, 12, 14, 16, 18, 20];
      const result = engine.forecast(values);

      expect(result.forecast).toBeDefined();
      expect(result.forecast.length).toBeGreaterThan(0);
      expect(result.model).toBeDefined();
      expect(result.parameters).toBeDefined();
    });

    it("should handle empty data", () => {
      const result = engine.forecast([]);

      expect(result.forecast).toEqual([]);
      expect(result.parameters).toEqual({});
    });

    it("should handle single value", () => {
      const result = engine.forecast([10]);

      expect(result.forecast).toEqual([]);
    });

    it("should respect horizon configuration", () => {
      const config: ForecastConfig = { horizon: 5 };
      const engine = new ForecastingEngine(config);
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const result = engine.forecast(values);

      expect(result.forecast.length).toBe(5);
    });
  });

  describe("Linear Trend Projection", () => {
    it("should forecast linear increasing trend", () => {
      const config: ForecastConfig = {
        model: "linear_trend",
        horizon: 3,
      };
      const engine = new ForecastingEngine(config);
      const values = [1, 2, 3, 4, 5];

      const result = engine.forecast(values);

      expect(result.model).toBe("linear_trend");
      expect(result.forecast[0].value).toBeCloseTo(6, 1);
      expect(result.forecast[1].value).toBeCloseTo(7, 1);
      expect(result.forecast[2].value).toBeCloseTo(8, 1);
    });

    it("should forecast linear decreasing trend", () => {
      const config: ForecastConfig = {
        model: "linear_trend",
        horizon: 3,
      };
      const engine = new ForecastingEngine(config);
      const values = [10, 8, 6, 4, 2];

      const result = engine.forecast(values);

      expect(result.forecast[0].value).toBeCloseTo(0, 1);
      expect(result.forecast[1].value).toBeCloseTo(-2, 1);
      expect(result.forecast[2].value).toBeCloseTo(-4, 1);
    });

    it("should include confidence intervals", () => {
      const config: ForecastConfig = {
        model: "linear_trend",
        confidence: 0.95,
      };
      const engine = new ForecastingEngine(config);
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const result = engine.forecast(values);

      result.forecast.forEach((point) => {
        expect(point.lower).toBeLessThan(point.value);
        expect(point.upper).toBeGreaterThan(point.value);
        expect(point.upper - point.lower).toBeGreaterThan(0);
      });
    });
  });

  describe("Seasonal Naive Forecast", () => {
    it("should detect and forecast seasonal pattern", () => {
      const config: ForecastConfig = {
        model: "seasonal_naive",
        seasonalPeriod: 4,
        horizon: 4,
      };
      const engine = new ForecastingEngine(config);

      // Create seasonal data
      const values = [10, 20, 30, 40, 11, 21, 31, 41, 12, 22, 32, 42];

      const result = engine.forecast(values);

      expect(result.model).toBe("seasonal_naive");
      expect(result.seasonalComponent).toBeDefined();
      expect(result.seasonalComponent?.length).toBe(4);
    });

    it("should handle weekly seasonality", () => {
      const config: ForecastConfig = {
        model: "seasonal_naive",
        seasonalPeriod: 7,
        horizon: 7,
      };
      const engine = new ForecastingEngine(config);

      // Weekly pattern
      const values: number[] = [];
      for (let week = 0; week < 4; week++) {
        values.push(100, 110, 120, 130, 140, 90, 80); // Weekly pattern
      }

      const result = engine.forecast(values);

      expect(result.forecast.length).toBe(7);
      // Check that forecast values are reasonable
      expect(result.forecast[0].value).toBeDefined();
      expect(result.forecast[0].value).toBeGreaterThan(0);
    });
  });

  describe("Exponential Smoothing", () => {
    it("should apply exponential smoothing", () => {
      const config: ForecastConfig = {
        model: "exponential_smoothing",
        alpha: 0.3,
        horizon: 5,
      };
      const engine = new ForecastingEngine(config);
      const values = [10, 12, 11, 13, 12, 14, 13, 15];

      const result = engine.forecast(values);

      expect(result.model).toBe("exponential_smoothing");
      expect(result.parameters.alpha).toBe(0.3);
      expect(result.forecast.length).toBe(5);
    });

    it("should handle different smoothing parameters", () => {
      const lowAlpha = new ForecastingEngine({
        model: "exponential_smoothing",
        alpha: 0.1,
        horizon: 3,
      });
      const highAlpha = new ForecastingEngine({
        model: "exponential_smoothing",
        alpha: 0.9,
        horizon: 3,
      });

      const volatileData = [10, 20, 10, 20, 10, 20, 10, 20];

      const lowResult = lowAlpha.forecast(volatileData);
      const highResult = highAlpha.forecast(volatileData);

      // Check that both produce valid forecasts
      expect(lowResult.forecast.length).toBe(3);
      expect(highResult.forecast.length).toBe(3);

      // Both should have defined values
      expect(lowResult.forecast[0].value).toBeDefined();
      expect(highResult.forecast[0].value).toBeDefined();
    });
  });

  describe("Holt-Winters Method", () => {
    it("should forecast with trend and seasonality", () => {
      const config: ForecastConfig = {
        model: "holt_winters",
        alpha: 0.3,
        beta: 0.1,
        gamma: 0.1,
        seasonalPeriod: 4,
        horizon: 4,
      };
      const engine = new ForecastingEngine(config);

      // Trend + seasonal data
      const values: number[] = [];
      for (let i = 0; i < 16; i++) {
        const trend = i * 2;
        const seasonal = [0, 5, 10, 5][i % 4];
        values.push(100 + trend + seasonal);
      }

      const result = engine.forecast(values);

      expect(result.model).toBe("holt_winters");
      expect(result.seasonalComponent).toBeDefined();
      expect(result.trendComponent).toBeDefined();
      expect(result.forecast.length).toBe(4);
    });

    it("should fall back when insufficient data", () => {
      const config: ForecastConfig = {
        model: "holt_winters",
        seasonalPeriod: 7,
        horizon: 3,
      };
      const engine = new ForecastingEngine(config);

      const values = [10, 11, 12, 13, 14]; // Not enough for seasonal

      const result = engine.forecast(values);

      // Should fall back to exponential smoothing
      expect(result.model).toBe("exponential_smoothing");
    });
  });

  describe("Moving Average Forecast", () => {
    it("should forecast using moving average", () => {
      const config: ForecastConfig = {
        model: "moving_average",
        horizon: 3,
      };
      const engine = new ForecastingEngine(config);
      const values = [10, 12, 11, 13, 12, 14, 13, 15, 14, 16];

      const result = engine.forecast(values);

      expect(result.model).toBe("moving_average");
      expect(result.parameters.windowSize).toBeDefined();
      expect(result.forecast.length).toBe(3);
    });
  });

  describe("Auto Model Selection", () => {
    it("should auto-select appropriate model", () => {
      const config: ForecastConfig = {
        model: "auto",
        seasonalPeriod: 4,
      };
      const engine = new ForecastingEngine(config);

      // Strong trend data
      const trendData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const trendResult = engine.forecast(trendData);
      expect(["linear_trend", "exponential_smoothing"]).toContain(
        trendResult.model,
      );

      // Seasonal data
      const seasonalData: number[] = [];
      for (let i = 0; i < 20; i++) {
        seasonalData.push(100 + [0, 10, 20, 10][i % 4]);
      }
      const seasonalResult = engine.forecast(seasonalData);
      expect(["seasonal_naive", "holt_winters"]).toContain(
        seasonalResult.model,
      );
    });
  });

  describe("Time Series Forecasting", () => {
    it("should forecast time series data", () => {
      const timeSeries: TimeSeriesPoint[] = [];
      const startDate = new Date("2024-01-01");

      for (let i = 0; i < 30; i++) {
        timeSeries.push({
          timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
          value: 100 + i * 2 + Math.sin((i * Math.PI) / 7) * 10,
        });
      }

      const result = engine.forecastTimeSeries(timeSeries);

      expect(result.forecast.length).toBeGreaterThan(0);
      result.forecast.forEach((point) => {
        expect(point.timestamp).toBeDefined();
        expect(point.timestamp).toBeInstanceOf(Date);
      });
    });

    it("should extrapolate timestamps correctly", () => {
      const timeSeries: TimeSeriesPoint[] = [
        { timestamp: new Date("2024-01-01"), value: 100 },
        { timestamp: new Date("2024-01-02"), value: 110 },
        { timestamp: new Date("2024-01-03"), value: 120 },
      ];

      const config: ForecastConfig = { horizon: 2 };
      const engine = new ForecastingEngine(config);
      const result = engine.forecastTimeSeries(timeSeries);

      const firstForecastDate = result.forecast[0].timestamp;
      const secondForecastDate = result.forecast[1].timestamp;

      expect(firstForecastDate?.toISOString().split("T")[0]).toBe("2024-01-04");
      expect(secondForecastDate?.toISOString().split("T")[0]).toBe(
        "2024-01-05",
      );
    });
  });

  describe("Accuracy Metrics", () => {
    it("should calculate accuracy metrics correctly", () => {
      const actual = [10, 20, 30, 40, 50];
      const predicted = [11, 19, 32, 38, 52];

      const accuracy = engine.calculateAccuracy(actual, predicted);

      expect(accuracy.mae).toBeCloseTo(1.6, 1);
      expect(accuracy.rmse).toBeGreaterThan(accuracy.mae);
      expect(accuracy.mape).toBeGreaterThan(0);
      expect(accuracy.r2).toBeLessThanOrEqual(1);
    });

    it("should handle perfect predictions", () => {
      const actual = [10, 20, 30, 40, 50];
      const predicted = [10, 20, 30, 40, 50];

      const accuracy = engine.calculateAccuracy(actual, predicted);

      expect(accuracy.mae).toBe(0);
      expect(accuracy.mse).toBe(0);
      expect(accuracy.rmse).toBe(0);
      expect(accuracy.r2).toBe(1);
    });

    it("should include accuracy in forecast with sufficient data", () => {
      const config: ForecastConfig = {
        horizon: 2,
        splitRatio: 0.8,
      };
      const engine = new ForecastingEngine(config);

      // Need enough data for train/test split
      const values = Array(25)
        .fill(0)
        .map((_, i) => 100 + i * 2);

      const result = engine.forecast(values);

      expect(result.accuracy).toBeDefined();
      expect(result.accuracy?.mae).toBeGreaterThanOrEqual(0);
      expect(result.accuracy?.r2).toBeLessThanOrEqual(1);
    });
  });

  describe("Cross Validation", () => {
    it("should perform cross-validation", () => {
      const values = Array(50)
        .fill(0)
        .map((_, i) => 100 + i * 2 + Math.random() * 10);

      const results = engine.crossValidate(values, 3);

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.model).toBeDefined();
        expect(result.avgAccuracy).toBeDefined();
        expect(result.avgAccuracy.rmse).toBeGreaterThanOrEqual(0);
      });

      // Results should be sorted by RMSE (best first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].avgAccuracy.rmse).toBeGreaterThanOrEqual(
          results[i - 1].avgAccuracy.rmse,
        );
      }
    });
  });

  describe("Configuration Options", () => {
    it("should include historical data when configured", () => {
      const config: ForecastConfig = {
        includeHistory: true,
      };
      const engine = new ForecastingEngine(config);
      const values = [1, 2, 3, 4, 5];

      const result = engine.forecast(values);

      expect(result.historical).toBeDefined();
      expect(result.historical).toEqual(values);
    });

    it("should respect confidence level", () => {
      const lowConf = new ForecastingEngine({ confidence: 0.9 });
      const highConf = new ForecastingEngine({ confidence: 0.99 });

      const values = [10, 12, 11, 13, 12, 14, 13, 15];

      const lowResult = lowConf.forecast(values);
      const highResult = highConf.forecast(values);

      // Higher confidence should have wider intervals
      const lowWidth =
        lowResult.forecast[0].upper - lowResult.forecast[0].lower;
      const highWidth =
        highResult.forecast[0].upper - highResult.forecast[0].lower;

      expect(highWidth).toBeGreaterThan(lowWidth);
    });
  });

  describe("Edge Cases", () => {
    it("should handle constant values", () => {
      const values = [10, 10, 10, 10, 10, 10];
      const result = engine.forecast(values);

      result.forecast.forEach((point) => {
        expect(point.value).toBeCloseTo(10, 1);
      });
    });

    it("should handle highly volatile data", () => {
      const values = [10, 100, 5, 95, 8, 92, 12, 88];
      const result = engine.forecast(values);

      expect(result.forecast).toBeDefined();
      expect(result.forecast.length).toBeGreaterThan(0);

      // Confidence intervals should be wide
      result.forecast.forEach((point) => {
        const width = point.upper - point.lower;
        expect(width).toBeGreaterThan(10);
      });
    });

    it("should handle negative values", () => {
      const values = [-10, -8, -6, -4, -2, 0, 2, 4];
      const result = engine.forecast(values);

      expect(result.forecast).toBeDefined();
      expect(result.forecast[0].value).toBeGreaterThan(4);
    });
  });
});
