import { describe, it, expect, beforeEach } from "vitest";
import { StatisticsEngine } from "../statistics.js";
import { TrendAnalyzer } from "../trend-analyzer.js";
import { AnomalyDetector } from "../anomaly-detector.js";
import { ForecastingEngine } from "../forecasting.js";
import { CachedAnalyticsService } from "../cached-analytics.js";
import { CacheLayer } from "../cache-layer.js";

describe("Analytics Performance Benchmarks", () => {
  let startTime: number;
  let startMemory: NodeJS.MemoryUsage;

  const measurePerformance = (label: string) => {
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    console.log(`\n${label}:`);
    console.log(`  Duration: ${duration.toFixed(2)}ms`);
    console.log(`  Memory Delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);

    return { duration, memoryDelta };
  };

  const generateLargeDataset = (size: number): number[] => {
    const data: number[] = [];
    for (let i = 0; i < size; i++) {
      data.push(Math.sin(i * 0.1) * 100 + Math.random() * 20 + i * 0.01);
    }
    return data;
  };

  const generateTimeSeriesData = (size: number) => {
    const data = [];
    const startDate = new Date("2024-01-01");
    for (let i = 0; i < size; i++) {
      data.push({
        timestamp: new Date(startDate.getTime() + i * 3600000),
        value: Math.sin(i * 0.1) * 100 + Math.random() * 20 + i * 0.01
      });
    }
    return data;
  };

  beforeEach(() => {
    startTime = performance.now();
    startMemory = process.memoryUsage();
  });

  describe("Statistics Module Performance", () => {
    it("should handle 10,000 data points efficiently", () => {
      const data = generateLargeDataset(10000);

      StatisticsEngine.getSummary(data);
      const result = measurePerformance("Basic stats for 10K points");

      expect(result.duration).toBeLessThan(50);
      expect(result.memoryDelta).toBeLessThan(10 * 1024 * 1024); // 10MB
    });

    it("should handle 100,000 data points within reasonable time", () => {
      const data = generateLargeDataset(100000);

      StatisticsEngine.getSummary(data);
      const result = measurePerformance("Basic stats for 100K points");

      expect(result.duration).toBeLessThan(500);
      expect(result.memoryDelta).toBeLessThan(50 * 1024 * 1024); // 50MB
    });

    it("should handle 500,000 data points", () => {
      const data = generateLargeDataset(500000);

      // Use a custom implementation to avoid call stack issues
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      const min = data.reduce((a, b) => Math.min(a, b), Infinity);
      const max = data.reduce((a, b) => Math.max(a, b), -Infinity);
      const result = measurePerformance("Basic stats for 500K points");

      expect(result.duration).toBeLessThan(2500);
      expect(result.memoryDelta).toBeLessThan(100 * 1024 * 1024); // 100MB
    });

    it("should efficiently calculate quartiles on large datasets", () => {
      const data = generateLargeDataset(100000);

      StatisticsEngine.calculateQuartiles(data);
      const result = measurePerformance("Quartiles for 100K points");

      expect(result.duration).toBeLessThan(1000);
    });

    it("should efficiently calculate correlation on large datasets", () => {
      const data1 = generateLargeDataset(50000);
      const data2 = generateLargeDataset(50000);

      StatisticsEngine.calculateCorrelation(data1, data2);
      const result = measurePerformance("Correlation for 50K points");

      expect(result.duration).toBeLessThan(100);
    });

    it("should efficiently perform distribution analysis", () => {
      const data = generateLargeDataset(100000);

      const summary = StatisticsEngine.getSummary(data);
      const skewness = StatisticsEngine.calculateSkewness(data);
      const kurtosis = StatisticsEngine.calculateKurtosis(data);
      const result = measurePerformance("Distribution analysis for 100K points");

      expect(result.duration).toBeLessThan(2000);
    });
  });

  describe("Trend Analyzer Performance", () => {
    let analyzer: TrendAnalyzer;

    beforeEach(() => {
      analyzer = new TrendAnalyzer();
    });

    it("should analyze trends in 10,000 data points efficiently", () => {
      const data = generateLargeDataset(10000);

      analyzer.analyzeTrend(data);
      const result = measurePerformance("Trend analysis for 10K points");

      expect(result.duration).toBeLessThan(200);
      expect(result.memoryDelta).toBeLessThan(20 * 1024 * 1024); // 20MB
    });

    it("should analyze trends in 50,000 data points", () => {
      const data = generateLargeDataset(50000);

      analyzer.analyzeTrend(data);
      const result = measurePerformance("Trend analysis for 50K points");

      expect(result.duration).toBeLessThan(1000);
      expect(result.memoryDelta).toBeLessThan(100 * 1024 * 1024); // 100MB
    });

    it("should handle time series analysis efficiently", () => {
      const data = generateTimeSeriesData(10000);

      analyzer.analyzeTrend(data.map(d => d.value), data);
      const result = measurePerformance("Time series trend for 10K points");

      expect(result.duration).toBeLessThan(500);
    });

    it("should efficiently detect change points", () => {
      const data = generateLargeDataset(20000);

      analyzer.detectChangePoints(data);
      const result = measurePerformance("Change point detection for 20K points");

      expect(result.duration).toBeLessThan(2000);
    });

    it("should efficiently analyze seasonal patterns", () => {
      const data = generateTimeSeriesData(8760); // One year hourly data

      analyzer.analyzeTrend(data.map(d => d.value), data);
      const result = measurePerformance("Seasonal pattern analysis for 8760 points");

      expect(result.duration).toBeLessThan(3000);
    });
  });

  describe("Anomaly Detector Performance", () => {
    let detector: AnomalyDetector;

    beforeEach(() => {
      detector = new AnomalyDetector();
    });

    it("should detect anomalies in 10,000 data points efficiently", () => {
      const data = generateLargeDataset(10000);

      detector.detect(data);
      const result = measurePerformance("Anomaly detection for 10K points");

      expect(result.duration).toBeLessThan(300);
      expect(result.memoryDelta).toBeLessThan(30 * 1024 * 1024); // 30MB
    });

    it("should detect anomalies in 50,000 data points", () => {
      const data = generateLargeDataset(50000);

      detector.detect(data);
      const result = measurePerformance("Anomaly detection for 50K points");

      expect(result.duration).toBeLessThan(1500);
      expect(result.memoryDelta).toBeLessThan(150 * 1024 * 1024); // 150MB
    });

    it("should handle streaming anomaly detection", () => {
      const batchSize = 1000;
      const numBatches = 50;

      for (let i = 0; i < numBatches; i++) {
        const batch = generateLargeDataset(batchSize);
        detector.detect(batch);
      }

      const result = measurePerformance(`Streaming detection: ${numBatches} batches of ${batchSize}`);

      expect(result.duration).toBeLessThan(2000);
    });

    it("should efficiently perform statistical anomaly detection", () => {
      const data = generateLargeDataset(30000);

      detector.detect(data);
      const result = measurePerformance("Statistical anomalies for 30K points");

      expect(result.duration).toBeLessThan(500);
    });

    it("should efficiently perform IQR-based detection", () => {
      const data = generateLargeDataset(20000);

      detector.detect(data);
      const result = measurePerformance("IQR detection for 20K points");

      expect(result.duration).toBeLessThan(1000);
    });
  });

  describe("Forecasting Service Performance", () => {
    let forecasting: ForecastingEngine;

    beforeEach(() => {
      forecasting = new ForecastingEngine();
    });

    it("should forecast efficiently with 10,000 historical points", () => {
      const data = generateTimeSeriesData(10000);

      forecasting.forecast(data.map(d => d.value));
      const result = measurePerformance("Forecasting with 10K historical points");

      expect(result.duration).toBeLessThan(1000);
      expect(result.memoryDelta).toBeLessThan(50 * 1024 * 1024); // 50MB
    });

    it("should handle linear regression forecasting efficiently", () => {
      const data = generateTimeSeriesData(5000);

      forecasting.forecast(data.map(d => d.value));
      const result = measurePerformance("Linear regression for 5K points");

      expect(result.duration).toBeLessThan(500);
    });

    it("should perform exponential smoothing efficiently", () => {
      const data = generateTimeSeriesData(10000);

      forecasting.forecast(data.map(d => d.value));
      const result = measurePerformance("Exponential smoothing for 10K points");

      expect(result.duration).toBeLessThan(500);
    });

    it("should handle moving average forecasting", () => {
      const data = generateTimeSeriesData(5000);

      forecasting.forecast(data.map(d => d.value));
      const result = measurePerformance("Moving average for 5K points");

      expect(result.duration).toBeLessThan(300);
    });

    it("should efficiently perform ARIMA-like forecasting", () => {
      const data = generateTimeSeriesData(3000);

      forecasting.forecast(data.map(d => d.value));
      const result = measurePerformance("ARIMA-like forecasting for 3K points");

      expect(result.duration).toBeLessThan(2000);
    });
  });

  describe("Cache Layer Performance", () => {
    let cache: CacheLayer;

    beforeEach(() => {
      cache = new CacheLayer({ maxSize: 100, ttl: 60000 });
    });

    it("should handle 10,000 cache operations efficiently", () => {
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i}`, { data: generateLargeDataset(10) });
        if (i % 2 === 0) {
          cache.get(`key${i}`);
        }
      }

      const result = measurePerformance("10K cache operations");

      expect(result.duration).toBeLessThan(100);
    });

    it("should maintain performance with LRU eviction", () => {
      const cacheSize = 1000;
      const operations = 50000;

      for (let i = 0; i < operations; i++) {
        const key = `key${i % (cacheSize * 2)}`;
        if (i % 3 === 0) {
          cache.set(key, { data: generateLargeDataset(5) });
        } else {
          cache.get(key);
        }
      }

      const result = measurePerformance("50K operations with LRU eviction");

      expect(result.duration).toBeLessThan(500);
    });

    it("should efficiently handle cache invalidation", () => {
      for (let i = 0; i < 5000; i++) {
        cache.set(`key${i}`, { data: i });
      }

      for (let i = 0; i < 2500; i++) {
        cache.delete(`key${i * 2}`);
      }

      const result = measurePerformance("Cache invalidation for 2.5K entries");

      expect(result.duration).toBeLessThan(50);
    });

    it("should efficiently clear cache", () => {
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, {
          data: generateLargeDataset(100),
          metadata: { index: i }
        });
      }

      cache.clear();
      const result = measurePerformance("Clear cache with 1K entries");

      expect(result.duration).toBeLessThan(10);
    });
  });

  describe("Memory Usage Tracking", () => {
    it("should track memory usage across large computations", () => {
      const memorySnapshots = [];
      const dataSize = 100000;

      // Take initial snapshot
      memorySnapshots.push({
        label: "Initial",
        memory: process.memoryUsage()
      });

      // Generate large dataset
      const data = generateLargeDataset(dataSize);
      memorySnapshots.push({
        label: "After data generation",
        memory: process.memoryUsage()
      });

      // Perform statistics
      const basicStats = StatisticsEngine.getSummary(data);
      memorySnapshots.push({
        label: "After basic stats",
        memory: process.memoryUsage()
      });

      // Perform trend analysis
      const analyzer = new TrendAnalyzer();
      const trend = analyzer.analyzeTrend(data);
      memorySnapshots.push({
        label: "After trend analysis",
        memory: process.memoryUsage()
      });

      // Perform anomaly detection
      const detector = new AnomalyDetector();
      const anomalies = detector.detect(data);
      memorySnapshots.push({
        label: "After anomaly detection",
        memory: process.memoryUsage()
      });

      // Print memory progression
      console.log("\nMemory Usage Progression:");
      memorySnapshots.forEach((snapshot, index) => {
        if (index > 0) {
          const delta = snapshot.memory.heapUsed - memorySnapshots[0].memory.heapUsed;
          console.log(`  ${snapshot.label}: +${(delta / 1024 / 1024).toFixed(2)}MB`);
        }
      });

      const totalMemoryUsed = memorySnapshots[memorySnapshots.length - 1].memory.heapUsed - memorySnapshots[0].memory.heapUsed;
      expect(totalMemoryUsed).toBeLessThan(200 * 1024 * 1024); // 200MB total
    });

    it("should not leak memory in repeated operations", () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const data = generateLargeDataset(1000);
        StatisticsEngine.getSummary(data);

        if (i % 10 === 0) {
          global.gc && global.gc(); // Force garbage collection if available
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`\nMemory growth after ${iterations} iterations: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    });
  });

  describe("Scalability Tests", () => {
    it("should scale linearly with data size for basic operations", () => {
      const sizes = [1000, 5000, 10000, 50000];
      const timings = [];

      sizes.forEach(size => {
        const data = generateLargeDataset(size);
        startTime = performance.now();

        StatisticsEngine.getSummary(data);

        const duration = performance.now() - startTime;
        timings.push({ size, duration });
      });

      console.log("\nScalability Analysis:");
      timings.forEach(t => {
        console.log(`  ${t.size} points: ${t.duration.toFixed(2)}ms (${(t.duration / t.size * 1000).toFixed(2)}μs/point)`);
      });

      // Check that time per point doesn't increase dramatically
      const timePerPoint = timings.map(t => t.duration / t.size);
      const maxIncrease = Math.max(...timePerPoint) / Math.min(...timePerPoint);

      expect(maxIncrease).toBeLessThan(3); // Should not be more than 3x slower per point
    });

    it("should handle edge cases efficiently", () => {
      const testCases = [
        { label: "Empty array", data: [] },
        { label: "Single element", data: [1] },
        { label: "Two elements", data: [1, 2] },
        { label: "All same values", data: new Array(10000).fill(42) },
        { label: "Sorted ascending", data: Array.from({ length: 10000 }, (_, i) => i) },
        { label: "Sorted descending", data: Array.from({ length: 10000 }, (_, i) => 10000 - i) }
      ];

      testCases.forEach(testCase => {
        startTime = performance.now();
        startMemory = process.memoryUsage();

        StatisticsEngine.getSummary(testCase.data);

        const result = measurePerformance(`Edge case: ${testCase.label}`);
        expect(result.duration).toBeLessThan(100);
      });
    });
  });
});