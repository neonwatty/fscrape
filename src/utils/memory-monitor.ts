import { createLogger } from "./enhanced-logger.js";
import { performance, PerformanceObserver } from "perf_hooks";

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  heapUsedPercent: number;
  timestamp: number;
}

export interface MemoryThresholds {
  warningPercent: number;
  criticalPercent: number;
  maxHeapUsedMB: number;
  gcThresholdMB: number;
}

export interface MemorySnapshot {
  stats: MemoryStats;
  gcStats?: GCStats;
}

interface GCStats {
  count: number;
  duration: number;
  lastRun: number;
  type: string;
}

export class MemoryMonitor {
  private logger = createLogger("MemoryMonitor");
  private thresholds: MemoryThresholds;
  private monitoring = false;
  private monitorInterval?: NodeJS.Timeout;
  private history: MemoryStats[] = [];
  private maxHistorySize = 100;
  private gcStats: GCStats = {
    count: 0,
    duration: 0,
    lastRun: Date.now(),
    type: "manual",
  };
  private callbacks: Map<string, (stats: MemoryStats) => void> = new Map();
  private baselineMemory?: MemoryStats;

  constructor(thresholds?: Partial<MemoryThresholds>) {
    this.thresholds = {
      warningPercent: thresholds?.warningPercent ?? 70,
      criticalPercent: thresholds?.criticalPercent ?? 90,
      maxHeapUsedMB: thresholds?.maxHeapUsedMB ?? 1024,
      gcThresholdMB: thresholds?.gcThresholdMB ?? 512,
    };

    this.setupGCTracking();
    this.captureBaseline();
  }

  private captureBaseline(): void {
    this.baselineMemory = this.getMemoryStats();
    this.logger.info("Memory baseline captured", {
      heapUsedMB: Math.round(this.baselineMemory.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(this.baselineMemory.heapTotal / 1024 / 1024),
    });
  }

  private setupGCTracking(): void {
    try {
      const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === "gc") {
            this.gcStats.count++;
            this.gcStats.duration += entry.duration;
            this.gcStats.lastRun = Date.now();
            const gcEntry = entry as any;
            this.gcStats.type = gcEntry.kind
              ? String(gcEntry.kind)
              : "unknown";
          }
        }
      });

      obs.observe({ entryTypes: ["gc"] });
    } catch (error) {
      this.logger.warn("GC tracking not available");
    }
  }

  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const heapTotal = memUsage.heapTotal;
    const heapUsed = memUsage.heapUsed;

    return {
      heapUsed,
      heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      heapUsedPercent: (heapUsed / heapTotal) * 100,
      timestamp: Date.now(),
    };
  }

  startMonitoring(intervalMs: number = 10000): void {
    if (this.monitoring) {
      this.logger.warn("Memory monitoring already started");
      return;
    }

    this.monitoring = true;
    this.logger.info(`Starting memory monitoring (interval: ${intervalMs}ms)`);

    this.monitorInterval = setInterval(() => {
      const stats = this.getMemoryStats();
      this.recordStats(stats);
      this.checkThresholds(stats);
      this.notifyCallbacks(stats);
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (!this.monitoring) {
      return;
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.monitorInterval = undefined;

    this.monitoring = false;
    this.logger.info("Memory monitoring stopped");
  }

  private recordStats(stats: MemoryStats): void {
    this.history.push(stats);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  private checkThresholds(stats: MemoryStats): void {
    const heapUsedMB = stats.heapUsed / 1024 / 1024;

    if (stats.heapUsedPercent > this.thresholds.criticalPercent) {
      this.logger.error("Critical memory usage detected: " + 
        `${stats.heapUsedPercent.toFixed(2)}% (${heapUsedMB.toFixed(2)}MB)`);
      this.forceGarbageCollection();
    } else if (stats.heapUsedPercent > this.thresholds.warningPercent) {
      this.logger.warn("High memory usage detected: " + 
        `${stats.heapUsedPercent.toFixed(2)}% (${heapUsedMB.toFixed(2)}MB)`);
    }

    if (heapUsedMB > this.thresholds.maxHeapUsedMB) {
      this.logger.error("Memory limit exceeded: " + 
        `${heapUsedMB.toFixed(2)}MB (limit: ${this.thresholds.maxHeapUsedMB}MB)`);
      this.forceGarbageCollection();
    }
  }

  forceGarbageCollection(): void {
    if (global.gc) {
      const before = this.getMemoryStats();
      global.gc();
      const after = this.getMemoryStats();

      const freedMB = (before.heapUsed - after.heapUsed) / 1024 / 1024;

      this.logger.info("Garbage collection completed", {
        freedMB: freedMB.toFixed(2),
        beforeMB: (before.heapUsed / 1024 / 1024).toFixed(2),
        afterMB: (after.heapUsed / 1024 / 1024).toFixed(2),
      });
    } else {
      this.logger.warn(
        "Garbage collection not available (run with --expose-gc)",
      );
    }
  }

  getMemoryUsageTrend(): {
    trend: "increasing" | "decreasing" | "stable";
    averageGrowthMBPerMin: number;
  } {
    if (this.history.length < 2) {
      return { trend: "stable", averageGrowthMBPerMin: 0 };
    }

    const recentHistory = this.history.slice(-10);
    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];
    
    if (!first || !last) {
      return { trend: "stable", averageGrowthMBPerMin: 0 };
    }

    const timeDiffMin = (last.timestamp - first.timestamp) / 1000 / 60;
    const memDiffMB = (last.heapUsed - first.heapUsed) / 1024 / 1024;
    const growthRate = timeDiffMin > 0 ? memDiffMB / timeDiffMin : 0;

    let trend: "increasing" | "decreasing" | "stable" = "stable";

    if (Math.abs(growthRate) < 1) {
      trend = "stable";
    } else if (growthRate > 0) {
      trend = "increasing";
    } else {
      trend = "decreasing";
    }

    return {
      trend,
      averageGrowthMBPerMin: growthRate,
    };
  }

  createSnapshot(): MemorySnapshot {
    const stats = this.getMemoryStats();

    return {
      stats,
      gcStats: { ...this.gcStats },
    };
  }

  async analyzeMemoryLeaks(): Promise<{
    possibleLeak: boolean;
    growthRate: number;
    recommendation: string;
  }> {
    const snapshots: MemoryStats[] = [];
    const sampleCount = 5;
    const sampleInterval = 2000;

    for (let i = 0; i < sampleCount; i++) {
      snapshots.push(this.getMemoryStats());
      if (i < sampleCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, sampleInterval));
      }
    }

    const growthRates: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      if (prev && curr) {
        const rate = (curr.heapUsed - prev.heapUsed) / sampleInterval;
        growthRates.push(rate);
      }
    }

    const avgGrowthRate =
      growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    const possibleLeak = avgGrowthRate > 1024;

    let recommendation = "Memory usage appears stable";

    if (possibleLeak) {
      recommendation =
        "Possible memory leak detected. Consider profiling the application";
    } else if (avgGrowthRate > 512) {
      recommendation = "Memory usage is increasing. Monitor closely";
    }

    return {
      possibleLeak,
      growthRate: avgGrowthRate,
      recommendation,
    };
  }

  registerCallback(id: string, callback: (stats: MemoryStats) => void): void {
    this.callbacks.set(id, callback);
  }

  unregisterCallback(id: string): void {
    this.callbacks.delete(id);
  }

  private notifyCallbacks(stats: MemoryStats): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(stats);
      } catch (error) {
        this.logger.error("Callback error: " + String(error));
      }
    });
  }

  getHistory(): MemoryStats[] {
    return [...this.history];
  }

  getGCStats(): GCStats {
    return { ...this.gcStats };
  }

  reset(): void {
    this.history = [];
    this.gcStats = {
      count: 0,
      duration: 0,
      lastRun: Date.now(),
      type: "manual",
    };
    this.captureBaseline();
    this.logger.info("Memory monitor reset");
  }

  getMemoryDelta(): {
    heapUsedDelta: number;
    heapTotalDelta: number;
    percentChange: number;
  } | null {
    if (!this.baselineMemory) {
      return null;
    }

    const current = this.getMemoryStats();

    return {
      heapUsedDelta: current.heapUsed - this.baselineMemory.heapUsed,
      heapTotalDelta: current.heapTotal - this.baselineMemory.heapTotal,
      percentChange:
        ((current.heapUsed - this.baselineMemory.heapUsed) /
          this.baselineMemory.heapUsed) *
        100,
    };
  }
}

export function createMemoryMonitor(
  thresholds?: Partial<MemoryThresholds>,
): MemoryMonitor {
  return new MemoryMonitor(thresholds);
}
