import { describe, it, expect, beforeEach } from "vitest";
import {
  AnomalyDetector,
  type EngagementMetrics,
  type AnomalyDetectorConfig,
} from "../anomaly-detector.js";
import { TimeSeriesPoint } from "../statistics.js";

describe("AnomalyDetector", () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  describe("Basic Detection", () => {
    it("should detect outliers in simple dataset", () => {
      const values = [10, 12, 11, 13, 12, 100, 11, 12, 10]; // 100 is outlier
      const result = detector.detect(values);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.value === 100)).toBe(true);
      expect(result.statistics.totalPoints).toBe(9);
    });

    it("should handle empty dataset", () => {
      const result = detector.detect([]);

      expect(result.anomalies).toEqual([]);
      expect(result.statistics.totalPoints).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it("should handle uniform data with no anomalies", () => {
      const values = [5, 5, 5, 5, 5, 5, 5, 5];
      const result = detector.detect(values);

      expect(result.anomalies.length).toBe(0);
      expect(result.statistics.anomalyRate).toBe(0);
    });
  });

  describe("Z-Score Detection", () => {
    it("should detect anomalies using z-score method", () => {
      const config: AnomalyDetectorConfig = {
        methods: ["zscore"],
        sensitivity: 0.7,
      };
      const detector = new AnomalyDetector(config);

      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 50]; // 50 is anomaly
      const result = detector.detect(values);

      expect(result.anomalies.length).toBeGreaterThan(0);
      const anomaly = result.anomalies.find((a) => a.value === 50);
      expect(anomaly).toBeDefined();
      expect(anomaly?.method).toBe("zscore");
      expect(anomaly?.score).toBeGreaterThan(2);
    });

    it("should adjust threshold based on sensitivity", () => {
      const lowSensitivity = new AnomalyDetector({
        methods: ["zscore"],
        sensitivity: 0.2,
      });
      const highSensitivity = new AnomalyDetector({
        methods: ["zscore"],
        sensitivity: 0.9,
      });

      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 15];

      const lowResult = lowSensitivity.detect(values);
      const highResult = highSensitivity.detect(values);

      expect(highResult.anomalies.length).toBeGreaterThanOrEqual(
        lowResult.anomalies.length,
      );
    });
  });

  describe("IQR Detection", () => {
    it("should detect anomalies using IQR method", () => {
      const config: AnomalyDetectorConfig = {
        methods: ["iqr"],
      };
      const detector = new AnomalyDetector(config);

      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // 100 is outlier
      const result = detector.detect(values);

      expect(result.anomalies.length).toBeGreaterThan(0);
      const anomaly = result.anomalies.find((a) => a.value === 100);
      expect(anomaly).toBeDefined();
      expect(anomaly?.method).toBe("iqr");
    });

    it("should detect both high and low outliers", () => {
      const config: AnomalyDetectorConfig = {
        methods: ["iqr"],
      };
      const detector = new AnomalyDetector(config);

      const values = [-50, 10, 12, 11, 13, 12, 11, 12, 10, 100];
      const result = detector.detect(values);

      expect(result.anomalies.length).toBe(2);
      expect(result.anomalies.some((a) => a.value === -50)).toBe(true);
      expect(result.anomalies.some((a) => a.value === 100)).toBe(true);
    });
  });

  describe("Isolation Forest Detection", () => {
    it("should detect anomalies using isolation forest", () => {
      const config: AnomalyDetectorConfig = {
        methods: ["isolation_forest"],
      };
      const detector = new AnomalyDetector(config);

      const values = Array(50)
        .fill(0)
        .map(() => Math.random() * 10 + 10);
      values.push(100); // Add clear outlier
      values.push(-20); // Add another outlier

      const result = detector.detect(values);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.value === 100)).toBe(true);
    });
  });

  describe("MAD Detection", () => {
    it("should detect anomalies using MAD method", () => {
      const config: AnomalyDetectorConfig = {
        methods: ["mad"],
      };
      const detector = new AnomalyDetector(config);

      const values = [10, 11, 12, 10, 11, 12, 11, 50, 10];
      const result = detector.detect(values);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.value === 50)).toBe(true);
      expect(result.anomalies[0].method).toBe("mad");
    });
  });

  describe("Ensemble Detection", () => {
    it("should combine multiple methods for consensus", () => {
      const config: AnomalyDetectorConfig = {
        methods: ["ensemble"],
      };
      const detector = new AnomalyDetector(config);

      const values = [10, 12, 11, 13, 12, 100, 11, 12, 10];
      const result = detector.detect(values);

      // 100 should be detected by majority of methods
      expect(result.anomalies.some((a) => a.value === 100)).toBe(true);
      const anomaly = result.anomalies.find((a) => a.value === 100);
      expect(anomaly?.method).toBe("ensemble");
    });

    it("should require consensus for detection", () => {
      const config: AnomalyDetectorConfig = {
        methods: ["ensemble"],
        sensitivity: 0.3,
      };
      const detector = new AnomalyDetector(config);

      // Borderline outlier that might not be detected by all methods
      const values = [10, 12, 11, 13, 12, 20, 11, 12, 10];
      const result = detector.detect(values);

      // May or may not detect 20 depending on consensus
      if (result.anomalies.length > 0) {
        expect(result.anomalies[0].method).toBe("ensemble");
      }
    });
  });

  describe("Time Series Anomaly Detection", () => {
    it("should detect anomalies in time series data", () => {
      const timeSeries: TimeSeriesPoint[] = [];
      const now = new Date();

      for (let i = 0; i < 30; i++) {
        timeSeries.push({
          timestamp: new Date(now.getTime() + i * 86400000),
          value: 100 + Math.sin((i * Math.PI) / 7) * 10 + (i === 15 ? 50 : 0),
        });
      }

      const result = detector.detectTimeSeries(timeSeries);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.index === 15)).toBe(true);
    });

    it("should handle seasonal patterns", () => {
      const config: AnomalyDetectorConfig = {
        seasonalPeriod: 7,
      };
      const detector = new AnomalyDetector(config);

      const timeSeries: TimeSeriesPoint[] = [];
      const now = new Date();

      // Create seasonal pattern with anomaly
      for (let i = 0; i < 28; i++) {
        const seasonalValue = 100 + Math.sin((2 * Math.PI * i) / 7) * 20;
        const anomalyValue = i === 20 ? seasonalValue + 100 : seasonalValue;
        timeSeries.push({
          timestamp: new Date(now.getTime() + i * 86400000),
          value: anomalyValue,
        });
      }

      const result = detector.detectTimeSeries(timeSeries);

      expect(result.anomalies.some((a) => a.index === 20)).toBe(true);
    });
  });

  describe("Engagement Anomaly Detection", () => {
    it("should detect anomalies in engagement metrics", () => {
      const metrics: EngagementMetrics[] = [];
      const now = new Date();

      for (let i = 0; i < 20; i++) {
        metrics.push({
          timestamp: new Date(now.getTime() + i * 86400000),
          posts: 100 + Math.random() * 20,
          comments: 500 + Math.random() * 50,
          likes: 1000 + Math.random() * 100,
          shares: 50 + Math.random() * 10,
          activeUsers: 5000 + Math.random() * 500,
          newUsers: 100 + Math.random() * 20,
        });
      }

      // Add anomaly
      metrics[10].posts = 500; // Spike in posts
      metrics[10].likes = 50; // Drop in likes

      const results = detector.detectEngagementAnomalies(metrics);

      expect(results.has("posts")).toBe(true);
      expect(results.has("likes")).toBe(true);

      const postsResult = results.get("posts");
      expect(postsResult?.anomalies.length).toBeGreaterThan(0);

      const likesResult = results.get("likes");
      expect(likesResult?.anomalies.length).toBeGreaterThan(0);
    });

    it("should detect cross-metric anomalies", () => {
      const metrics: EngagementMetrics[] = [];
      const now = new Date();

      // Create correlated metrics
      for (let i = 0; i < 20; i++) {
        const base = 100 + i * 5;
        metrics.push({
          timestamp: new Date(now.getTime() + i * 86400000),
          posts: base,
          comments: base * 5, // Usually correlated with posts
          likes: base * 10,
          shares: base * 0.5,
          activeUsers: 5000,
          newUsers: 100,
        });
      }

      // Break correlation at index 15
      metrics[15].comments = 100; // Should be ~875

      const results = detector.detectEngagementAnomalies(metrics);
      const crossResult = results.get("cross_metric");

      expect(crossResult).toBeDefined();
      expect(crossResult?.anomalies.length).toBeGreaterThan(0);
    });
  });

  describe("Anomaly Classification", () => {
    it("should classify spike anomalies", () => {
      const values = [10, 11, 12, 50, 11, 12, 10]; // Spike at index 3
      const result = detector.detect(values);

      const anomaly = result.anomalies.find((a) => a.value === 50);
      expect(anomaly?.type).toBe("spike");
    });

    it("should classify dip anomalies", () => {
      const values = [10, 11, 12, 2, 11, 12, 10]; // Dip at index 3
      const result = detector.detect(values);

      const anomaly = result.anomalies.find((a) => a.value === 2);
      expect(anomaly?.type).toBe("dip");
    });

    it("should classify trend break anomalies", () => {
      const values = [1, 2, 3, 4, 5, 4, 3, 2, 1]; // Trend reversal
      const config: AnomalyDetectorConfig = {
        sensitivity: 0.8,
      };
      const detector = new AnomalyDetector(config);

      const result = detector.detect(values);

      if (result.anomalies.length > 0) {
        expect(["trend_break", "spike", "outlier"]).toContain(
          result.anomalies[0].type,
        );
      }
    });
  });

  describe("Severity Classification", () => {
    it("should classify anomaly severity levels", () => {
      const values = [10, 11, 12, 10, 11, 25, 50, 100, 10]; // Various anomalies
      const result = detector.detect(values);

      const anomalies = result.anomalies.sort((a, b) => a.value - b.value);

      // Higher values should have higher severity
      if (anomalies.length >= 2) {
        const lowAnomaly = anomalies[0];
        const highAnomaly = anomalies[anomalies.length - 1];

        expect(["low", "medium"]).toContain(lowAnomaly.severity);
        expect(["high", "critical"]).toContain(highAnomaly.severity);
      }
    });
  });

  describe("Configuration Options", () => {
    it("should respect minimum data points configuration", () => {
      const config: AnomalyDetectorConfig = {
        minDataPoints: 10,
      };
      const detector = new AnomalyDetector(config);

      const result = detector.detect([1, 2, 3, 4, 100]); // Only 5 points

      expect(result.anomalies).toEqual([]);
      expect(result.statistics.totalPoints).toBe(0);
    });

    it("should use adaptive thresholds when configured", () => {
      const config: AnomalyDetectorConfig = {
        adaptiveThreshold: true,
        contextWindow: 5,
      };
      const detector = new AnomalyDetector(config);

      const values = Array(20)
        .fill(0)
        .map((_, i) => 10 + i * 0.5);
      values[15] = 30; // Anomaly

      const result = detector.detect(values);

      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });

  describe("Confidence Calculation", () => {
    it("should calculate higher confidence for clear anomalies", () => {
      const clearAnomalies = [10, 10, 10, 10, 1000, 10, 10, 10];
      const unclearAnomalies = [10, 12, 14, 16, 18, 20, 22, 24];

      const clearResult = detector.detect(clearAnomalies);
      const unclearResult = detector.detect(unclearAnomalies);

      if (
        clearResult.anomalies.length > 0 &&
        unclearResult.anomalies.length > 0
      ) {
        expect(clearResult.confidence).toBeGreaterThan(
          unclearResult.confidence,
        );
      }
    });
  });
});
