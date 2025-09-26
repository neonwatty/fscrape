import { performance, PerformanceObserver } from 'perf_hooks';
import { createLogger } from './enhanced-logger.js';
import { EventEmitter } from 'events';

export interface PerformanceMark {
  name: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMeasure {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  marks: PerformanceMark[];
  measures: PerformanceMeasure[];
  resourceTimings: ResourceTiming[];
  summary: PerformanceSummary;
}

export interface ResourceTiming {
  name: string;
  duration: number;
  type: string;
  size?: number;
}

export interface PerformanceSummary {
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  operationCount: number;
  timestamp: number;
}

export interface ProfileOptions {
  autoLog: boolean;
  thresholdMs: number;
  captureStackTrace: boolean;
  maxMeasures: number;
}

export class PerformanceProfiler extends EventEmitter {
  private logger = createLogger('PerformanceProfiler');
  private marks: Map<string, PerformanceMark> = new Map();
  private measures: PerformanceMeasure[] = [];
  private options: ProfileOptions;
  private observer?: PerformanceObserver;
  private operationStack: string[] = [];
  private resourceTimings: ResourceTiming[] = [];

  constructor(options?: Partial<ProfileOptions>) {
    super();

    this.options = {
      autoLog: options?.autoLog ?? true,
      thresholdMs: options?.thresholdMs ?? 100,
      captureStackTrace: options?.captureStackTrace ?? false,
      maxMeasures: options?.maxMeasures ?? 1000,
    };

    this.setupObserver();
  }

  private setupObserver(): void {
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.handleMeasureEntry(entry);
          } else if (entry.entryType === 'resource') {
            this.handleResourceEntry(entry);
          }
        }
      });

      this.observer.observe({ entryTypes: ['measure', 'resource'] });
    } catch (error) {
      this.logger.warn('Performance observer setup failed:', error);
    }
  }

  private handleMeasureEntry(entry: any): void {
    if (entry.duration > this.options.thresholdMs && this.options.autoLog) {
      this.logger.warn(`Slow operation detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
    }

    this.emit('measure', {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
    });
  }

  private handleResourceEntry(entry: any): void {
    this.resourceTimings.push({
      name: entry.name,
      duration: entry.duration,
      type: entry.entryType,
    });
  }

  mark(name: string, metadata?: Record<string, unknown>): void {
    const timestamp = performance.now();

    const mark: PerformanceMark = {
      name,
      timestamp,
      metadata,
    };

    this.marks.set(name, mark);
    performance.mark(name);

    if (this.options.captureStackTrace) {
      const stack = new Error().stack;
      mark.metadata = { ...mark.metadata, stackTrace: stack };
    }

    this.logger.debug(`Performance mark: ${name}`);
  }

  measure(name: string, startMark: string, endMark?: string): PerformanceMeasure | null {
    try {
      const endMarkName = endMark || `${name}-end`;

      if (!endMark) {
        this.mark(endMarkName);
      }

      performance.measure(name, startMark, endMarkName);

      const startTime = this.marks.get(startMark)?.timestamp || 0;
      const endTime = this.marks.get(endMarkName)?.timestamp || performance.now();
      const duration = endTime - startTime;

      const measure: PerformanceMeasure = {
        name,
        duration,
        startTime,
        endTime,
        metadata: this.marks.get(startMark)?.metadata,
      };

      this.measures.push(measure);

      if (this.measures.length > this.options.maxMeasures) {
        this.measures.shift();
      }

      if (this.options.autoLog && duration > this.options.thresholdMs) {
        this.logger.info(`Performance measure: ${name} took ${duration.toFixed(2)}ms`);
      }

      this.emit('measure-complete', measure);

      return measure;
    } catch (error) {
      this.logger.error(`Failed to measure ${name}:`, error);
      return null;
    }
  }

  async profile<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;

    this.mark(startMark, metadata);
    this.operationStack.push(name);

    try {
      const result = await fn();

      this.mark(endMark);
      this.measure(name, startMark, endMark);

      return result;
    } catch (error) {
      this.mark(`${name}-error`);
      this.measure(`${name}-error`, startMark, `${name}-error`);
      throw error;
    } finally {
      this.operationStack.pop();
    }
  }

  startTimer(name: string): () => number {
    const startMark = `${name}-timer-start`;
    this.mark(startMark);

    return () => {
      const endMark = `${name}-timer-end`;
      this.mark(endMark);
      const measure = this.measure(`${name}-timer`, startMark, endMark);
      return measure?.duration || 0;
    };
  }

  getMetrics(): PerformanceMetrics {
    const summary = this.calculateSummary();

    return {
      marks: Array.from(this.marks.values()),
      measures: [...this.measures],
      resourceTimings: [...this.resourceTimings],
      summary,
    };
  }

  private calculateSummary(): PerformanceSummary {
    if (this.measures.length === 0) {
      return {
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        operationCount: 0,
        timestamp: Date.now(),
      };
    }

    const durations = this.measures.map((m) => m.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    return {
      totalDuration,
      averageDuration: totalDuration / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      operationCount: this.measures.length,
      timestamp: Date.now(),
    };
  }

  getMeasuresByName(name: string): PerformanceMeasure[] {
    return this.measures.filter((m) => m.name === name);
  }

  getSlowOperations(thresholdMs?: number): PerformanceMeasure[] {
    const threshold = thresholdMs || this.options.thresholdMs;
    return this.measures.filter((m) => m.duration > threshold);
  }

  generateReport(): string {
    const metrics = this.getMetrics();
    const slowOps = this.getSlowOperations();

    const report = [
      '=== Performance Report ===',
      `Total Operations: ${metrics.summary.operationCount}`,
      `Total Duration: ${metrics.summary.totalDuration.toFixed(2)}ms`,
      `Average Duration: ${metrics.summary.averageDuration.toFixed(2)}ms`,
      `Min Duration: ${metrics.summary.minDuration.toFixed(2)}ms`,
      `Max Duration: ${metrics.summary.maxDuration.toFixed(2)}ms`,
      '',
      '=== Slow Operations ===',
      ...slowOps.map((op) => `- ${op.name}: ${op.duration.toFixed(2)}ms`),
      '',
      '=== Top 10 Operations by Duration ===',
      ...this.measures
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map((op, i) => `${i + 1}. ${op.name}: ${op.duration.toFixed(2)}ms`),
    ];

    return report.join('\n');
  }

  clear(): void {
    this.marks.clear();
    this.measures = [];
    this.resourceTimings = [];
    this.operationStack = [];
    performance.clearMarks();
    performance.clearMeasures();
    this.logger.debug('Performance profiler cleared');
  }

  getCurrentOperation(): string | undefined {
    return this.operationStack[this.operationStack.length - 1];
  }

  getOperationStack(): string[] {
    return [...this.operationStack];
  }

  benchmark(
    name: string,
    fn: () => void | Promise<void>,
    iterations: number = 100
  ): Promise<{
    name: string;
    iterations: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    opsPerSecond: number;
  }> {
    return this.profile(`benchmark-${name}`, async () => {
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
      }

      const totalTime = times.reduce((a, b) => a + b, 0);
      const averageTime = totalTime / iterations;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const opsPerSecond = 1000 / averageTime;

      const result = {
        name,
        iterations,
        totalTime,
        averageTime,
        minTime,
        maxTime,
        opsPerSecond,
      };

      this.logger.info(`Benchmark ${name}:`, {
        iterations,
        averageTime: `${averageTime.toFixed(3)}ms`,
        opsPerSecond: opsPerSecond.toFixed(2),
      });

      return result;
    });
  }

  destroy(): void {
    this.observer?.disconnect();
    this.clear();
    this.removeAllListeners();
  }
}

export function createPerformanceProfiler(options?: Partial<ProfileOptions>): PerformanceProfiler {
  return new PerformanceProfiler(options);
}
