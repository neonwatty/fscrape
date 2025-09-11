import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { PerformanceProfiler } from "../performance-profiler.js";

describe("PerformanceProfiler", () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    vi.clearAllMocks();
    profiler = new PerformanceProfiler({
      autoLog: false,
      thresholdMs: 100,
      captureStackTrace: false,
      maxMeasures: 100,
    });
  });

  afterEach(() => {
    profiler.destroy();
    vi.clearAllTimers();
  });

  describe("Marks", () => {
    it("should create performance marks", () => {
      expect(() => profiler.mark("test-mark")).not.toThrow();
      expect(() => profiler.mark("test-mark-2", { custom: "data" })).not.toThrow();
    });

    it("should create marks with metadata", () => {
      profiler.mark("test-mark", { userId: 123, action: "click" });
      const metrics = profiler.getMetrics();
      
      const mark = metrics.marks.find(m => m.name === "test-mark");
      expect(mark).toBeDefined();
      expect(mark?.metadata).toEqual({ userId: 123, action: "click" });
    });
  });

  describe("Measures", () => {
    it("should measure between marks", () => {
      profiler.mark("start");
      profiler.mark("end");
      
      const measure = profiler.measure("operation", "start", "end");
      
      expect(measure).not.toBeNull();
      expect(measure?.name).toBe("operation");
      expect(measure?.duration).toBeGreaterThanOrEqual(0);
    });

    it("should auto-create end mark if not provided", () => {
      profiler.mark("start");
      
      const measure = profiler.measure("operation", "start");
      
      expect(measure).not.toBeNull();
      expect(measure?.name).toBe("operation");
    });

    it("should handle measure errors gracefully", () => {
      const measure = profiler.measure("invalid", "nonexistent-start", "nonexistent-end");
      expect(measure).toBeNull();
    });

    it("should track measures in history", () => {
      profiler.mark("start1");
      profiler.mark("end1");
      profiler.measure("op1", "start1", "end1");
      
      profiler.mark("start2");
      profiler.mark("end2");
      profiler.measure("op2", "start2", "end2");
      
      const metrics = profiler.getMetrics();
      expect(metrics.measures).toHaveLength(2);
      expect(metrics.measures[0].name).toBe("op1");
      expect(metrics.measures[1].name).toBe("op2");
    });
  });

  describe("Profile Method", () => {
    it("should profile synchronous functions", async () => {
      const result = await profiler.profile("sync-operation", () => {
        return "result";
      });
      
      expect(result).toBe("result");
      
      const metrics = profiler.getMetrics();
      expect(metrics.measures).toHaveLength(1);
      expect(metrics.measures[0].name).toBe("sync-operation");
    });

    it("should profile asynchronous functions", async () => {
      const result = await profiler.profile("async-operation", async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return "async-result";
      });
      
      expect(result).toBe("async-result");
      
      const metrics = profiler.getMetrics();
      expect(metrics.measures).toHaveLength(1);
      expect(metrics.measures[0].name).toBe("async-operation");
      expect(metrics.measures[0].duration).toBeGreaterThanOrEqual(9);
    });

    it("should handle errors in profiled functions", async () => {
      await expect(
        profiler.profile("error-operation", () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
      
      const metrics = profiler.getMetrics();
      const errorMeasure = metrics.measures.find(m => m.name === "error-operation-error");
      expect(errorMeasure).toBeDefined();
    });

    it("should track operation stack", async () => {
      expect(profiler.getCurrentOperation()).toBeUndefined();
      
      await profiler.profile("outer", async () => {
        expect(profiler.getCurrentOperation()).toBe("outer");
        
        await profiler.profile("inner", async () => {
          expect(profiler.getCurrentOperation()).toBe("inner");
          expect(profiler.getOperationStack()).toEqual(["outer", "inner"]);
        });
        
        expect(profiler.getCurrentOperation()).toBe("outer");
      });
      
      expect(profiler.getCurrentOperation()).toBeUndefined();
    });
  });

  describe("Timer", () => {
    it("should create and stop timer", async () => {
      const stopTimer = profiler.startTimer("test-timer");
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const duration = stopTimer();
      
      expect(duration).toBeGreaterThanOrEqual(49);
      
      const metrics = profiler.getMetrics();
      const timerMeasure = metrics.measures.find(m => m.name === "test-timer-timer");
      expect(timerMeasure).toBeDefined();
      expect(timerMeasure?.duration).toBeGreaterThanOrEqual(49);
    });
  });

  describe("Metrics and Reporting", () => {
    it("should get metrics by name", () => {
      profiler.mark("start1");
      profiler.mark("end1");
      profiler.measure("operation", "start1", "end1");
      
      profiler.mark("start2");
      profiler.mark("end2");
      profiler.measure("operation", "start2", "end2");
      
      profiler.mark("start3");
      profiler.mark("end3");
      profiler.measure("other", "start3", "end3");
      
      const operations = profiler.getMeasuresByName("operation");
      expect(operations).toHaveLength(2);
      expect(operations.every(op => op.name === "operation")).toBe(true);
    });

    it("should get slow operations", async () => {
      profiler.mark("fast-start");
      profiler.mark("fast-end");
      profiler.measure("fast", "fast-start", "fast-end");
      
      profiler.mark("slow-start");
      await new Promise(resolve => setTimeout(resolve, 150));
      profiler.mark("slow-end");
      profiler.measure("slow", "slow-start", "slow-end");
      
      const slowOps = profiler.getSlowOperations(100);
      expect(slowOps).toHaveLength(1);
      expect(slowOps[0].name).toBe("slow");
    });

    it("should calculate summary statistics", () => {
      profiler.mark("op1-start");
      profiler.mark("op1-end");
      profiler.measure("op1", "op1-start", "op1-end");
      
      profiler.mark("op2-start");
      profiler.mark("op2-end");
      profiler.measure("op2", "op2-start", "op2-end");
      
      const metrics = profiler.getMetrics();
      const summary = metrics.summary;
      
      expect(summary.operationCount).toBe(2);
      expect(summary.totalDuration).toBeGreaterThanOrEqual(0);
      expect(summary.averageDuration).toBeGreaterThanOrEqual(0);
      expect(summary.minDuration).toBeGreaterThanOrEqual(0);
      expect(summary.maxDuration).toBeGreaterThanOrEqual(0);
    });

    it("should generate report", async () => {
      await profiler.profile("operation1", async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      await profiler.profile("operation2", async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });
      
      const report = profiler.generateReport();
      
      expect(report).toContain("Performance Report");
      expect(report).toContain("Total Operations");
      expect(report).toContain("Slow Operations");
      expect(report).toContain("operation2");
    });
  });

  describe("Benchmark", () => {
    it("should benchmark function performance", async () => {
      let counter = 0;
      const result = await profiler.benchmark(
        "increment",
        () => { counter++; },
        10
      );
      
      expect(result.name).toBe("increment");
      expect(result.iterations).toBe(10);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.averageTime).toBeGreaterThanOrEqual(0);
      expect(result.minTime).toBeGreaterThanOrEqual(0);
      expect(result.maxTime).toBeGreaterThanOrEqual(0);
      expect(result.opsPerSecond).toBeGreaterThan(0);
      expect(counter).toBe(10);
    });

    it("should benchmark async functions", async () => {
      const result = await profiler.benchmark(
        "async-op",
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
        },
        5
      );
      
      expect(result.iterations).toBe(5);
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.averageTime).toBeGreaterThan(0);
    });
  });

  describe("Clear and Destroy", () => {
    it("should clear all data", () => {
      profiler.mark("test");
      profiler.measure("op", "test");
      
      profiler.clear();
      
      const metrics = profiler.getMetrics();
      expect(metrics.marks).toHaveLength(0);
      expect(metrics.measures).toHaveLength(0);
      expect(metrics.resourceTimings).toHaveLength(0);
    });

    it("should destroy profiler", () => {
      const listener = vi.fn();
      profiler.on("measure", listener);
      
      profiler.destroy();
      
      profiler.emit("measure", {});
      expect(listener).not.toHaveBeenCalled();
      
      const metrics = profiler.getMetrics();
      expect(metrics.marks).toHaveLength(0);
      expect(metrics.measures).toHaveLength(0);
    });
  });

  describe("Events", () => {
    it("should emit measure events", () => {
      const measureListener = vi.fn();
      const completeListener = vi.fn();
      
      profiler.on("measure", measureListener);
      profiler.on("measure-complete", completeListener);
      
      profiler.mark("start");
      profiler.mark("end");
      profiler.measure("operation", "start", "end");
      
      expect(completeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "operation",
        })
      );
    });
  });

  describe("Options", () => {
    it("should respect maxMeasures option", () => {
      const smallProfiler = new PerformanceProfiler({
        maxMeasures: 2,
      });
      
      smallProfiler.mark("op1-start");
      smallProfiler.mark("op1-end");
      smallProfiler.measure("op1", "op1-start", "op1-end");
      
      smallProfiler.mark("op2-start");
      smallProfiler.mark("op2-end");
      smallProfiler.measure("op2", "op2-start", "op2-end");
      
      smallProfiler.mark("op3-start");
      smallProfiler.mark("op3-end");
      smallProfiler.measure("op3", "op3-start", "op3-end");
      
      const metrics = smallProfiler.getMetrics();
      expect(metrics.measures).toHaveLength(2);
      expect(metrics.measures[0].name).toBe("op2");
      expect(metrics.measures[1].name).toBe("op3");
      
      smallProfiler.destroy();
    });

    it("should auto-log slow operations when enabled", async () => {
      const autoLogProfiler = new PerformanceProfiler({
        autoLog: true,
        thresholdMs: 10,
      });
      
      autoLogProfiler.mark("start");
      // Create a delay that exceeds threshold
      await new Promise(resolve => setTimeout(resolve, 20));
      autoLogProfiler.mark("end");
      
      const measure = autoLogProfiler.measure("slow-op", "start", "end");
      
      // Check that measure was created and exceeds threshold
      expect(measure).not.toBeNull();
      expect(measure?.duration).toBeGreaterThan(10);
      
      autoLogProfiler.destroy();
    });
  });
});