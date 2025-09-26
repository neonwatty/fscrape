import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryMonitor } from '../memory-monitor.js';

describe('MemoryMonitor', () => {
  let memoryMonitor: MemoryMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryMonitor = new MemoryMonitor({
      warningPercent: 70,
      criticalPercent: 90,
      maxHeapUsedMB: 1024,
      gcThresholdMB: 512,
    });
  });

  afterEach(() => {
    memoryMonitor.stopMonitoring();
    vi.clearAllTimers();
  });

  describe('Memory Stats', () => {
    it('should get current memory stats', () => {
      const stats = memoryMonitor.getMemoryStats();

      expect(stats).toHaveProperty('heapUsed');
      expect(stats).toHaveProperty('heapTotal');
      expect(stats).toHaveProperty('external');
      expect(stats).toHaveProperty('rss');
      expect(stats).toHaveProperty('arrayBuffers');
      expect(stats).toHaveProperty('heapUsedPercent');
      expect(stats).toHaveProperty('timestamp');

      expect(stats.heapUsed).toBeGreaterThan(0);
      expect(stats.heapTotal).toBeGreaterThan(0);
      expect(stats.heapUsedPercent).toBeGreaterThan(0);
      expect(stats.heapUsedPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Monitoring', () => {
    it('should start and stop monitoring', () => {
      expect(() => memoryMonitor.startMonitoring(100)).not.toThrow();
      expect(() => memoryMonitor.stopMonitoring()).not.toThrow();
    });

    it('should collect memory stats during monitoring', async () => {
      vi.useFakeTimers();

      memoryMonitor.startMonitoring(100);

      vi.advanceTimersByTime(300);

      const history = memoryMonitor.getHistory();
      expect(history.length).toBeGreaterThan(0);

      memoryMonitor.stopMonitoring();
      vi.useRealTimers();
    });

    it('should not start monitoring twice', () => {
      memoryMonitor.startMonitoring(100);

      // This should log a warning but not throw
      expect(() => memoryMonitor.startMonitoring(100)).not.toThrow();

      memoryMonitor.stopMonitoring();
    });
  });

  describe('Memory Trends', () => {
    it('should detect stable memory trend with insufficient data', () => {
      const trend = memoryMonitor.getMemoryUsageTrend();

      expect(trend.trend).toBe('stable');
      expect(trend.averageGrowthMBPerMin).toBe(0);
    });

    it('should calculate memory usage trend', async () => {
      vi.useFakeTimers();

      memoryMonitor.startMonitoring(100);

      vi.advanceTimersByTime(1000);

      const trend = memoryMonitor.getMemoryUsageTrend();
      expect(['increasing', 'decreasing', 'stable']).toContain(trend.trend);
      expect(typeof trend.averageGrowthMBPerMin).toBe('number');

      memoryMonitor.stopMonitoring();
      vi.useRealTimers();
    });
  });

  describe('Memory Snapshots', () => {
    it('should create memory snapshot', () => {
      const snapshot = memoryMonitor.createSnapshot();

      expect(snapshot).toHaveProperty('stats');
      expect(snapshot).toHaveProperty('gcStats');
      expect(snapshot.stats).toHaveProperty('heapUsed');
      expect(snapshot.stats).toHaveProperty('heapTotal');
    });
  });

  describe('GC Stats', () => {
    it('should get GC stats', () => {
      const gcStats = memoryMonitor.getGCStats();

      expect(gcStats).toHaveProperty('count');
      expect(gcStats).toHaveProperty('duration');
      expect(gcStats).toHaveProperty('lastRun');
      expect(gcStats).toHaveProperty('type');
      expect(gcStats.count).toBeGreaterThanOrEqual(0);
    });

    it('should handle forced garbage collection', () => {
      expect(() => memoryMonitor.forceGarbageCollection()).not.toThrow();
    });
  });

  describe('Memory Leak Detection', () => {
    it('should analyze memory for potential leaks', async () => {
      const analysis = await memoryMonitor.analyzeMemoryLeaks();

      expect(analysis).toHaveProperty('possibleLeak');
      expect(analysis).toHaveProperty('growthRate');
      expect(analysis).toHaveProperty('recommendation');
      expect(typeof analysis.possibleLeak).toBe('boolean');
      expect(typeof analysis.growthRate).toBe('number');
      expect(typeof analysis.recommendation).toBe('string');
    }, 15000);
  });

  describe('Memory Delta', () => {
    it('should calculate memory delta from baseline', () => {
      const delta = memoryMonitor.getMemoryDelta();

      expect(delta).not.toBeNull();
      expect(delta).toHaveProperty('heapUsedDelta');
      expect(delta).toHaveProperty('heapTotalDelta');
      expect(delta).toHaveProperty('percentChange');
    });
  });

  describe('Callbacks', () => {
    it('should register and notify callbacks', () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      memoryMonitor.registerCallback('test', callback);

      memoryMonitor.startMonitoring(100);
      vi.advanceTimersByTime(150);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
        })
      );

      memoryMonitor.stopMonitoring();
      vi.useRealTimers();
    });

    it('should unregister callbacks', () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      memoryMonitor.registerCallback('test', callback);
      memoryMonitor.unregisterCallback('test');

      memoryMonitor.startMonitoring(100);
      vi.advanceTimersByTime(150);

      expect(callback).not.toHaveBeenCalled();

      memoryMonitor.stopMonitoring();
      vi.useRealTimers();
    });

    it('should handle callback errors gracefully', () => {
      vi.useFakeTimers();

      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      memoryMonitor.registerCallback('error', errorCallback);
      memoryMonitor.startMonitoring(100);

      vi.advanceTimersByTime(150);

      expect(errorCallback).toHaveBeenCalled();
      // The error is caught internally and logged, but not re-thrown
      expect(() => vi.advanceTimersByTime(150)).not.toThrow();

      memoryMonitor.stopMonitoring();
      vi.useRealTimers();
    });
  });

  describe('Reset', () => {
    it('should reset monitor state', async () => {
      vi.useFakeTimers();

      memoryMonitor.startMonitoring(100);
      vi.advanceTimersByTime(300);

      const historyBefore = memoryMonitor.getHistory();
      expect(historyBefore.length).toBeGreaterThan(0);

      memoryMonitor.reset();

      const historyAfter = memoryMonitor.getHistory();
      expect(historyAfter.length).toBe(0);

      const gcStats = memoryMonitor.getGCStats();
      expect(gcStats.count).toBe(0);
      expect(gcStats.duration).toBe(0);

      memoryMonitor.stopMonitoring();
      vi.useRealTimers();
    });
  });

  describe('Thresholds', () => {
    it('should check memory thresholds', () => {
      // Create monitor with very low thresholds that will trigger
      const monitor = new MemoryMonitor({
        warningPercent: 0.1,
        criticalPercent: 0.2,
        maxHeapUsedMB: 0.001,
      });

      vi.useFakeTimers();
      monitor.startMonitoring(100);
      vi.advanceTimersByTime(150);

      // Since the thresholds are so low, they will trigger warnings
      // But we just need to test it doesn't throw
      expect(() => vi.advanceTimersByTime(150)).not.toThrow();

      monitor.stopMonitoring();
      vi.useRealTimers();
    });
  });
});
