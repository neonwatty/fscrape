/**
 * Performance Monitoring Configuration
 * Tracks Core Web Vitals and custom metrics
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

export interface WebVitalsConfig {
  enableLogging: boolean;
  enableReporting: boolean;
  reportingEndpoint?: string;
  sampleRate: number;
}

// Performance thresholds based on Web Vitals
export const PERFORMANCE_THRESHOLDS = {
  // Largest Contentful Paint (LCP)
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  // First Input Delay (FID)
  FID: {
    good: 100,
    needsImprovement: 300,
  },
  // Cumulative Layout Shift (CLS)
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  // First Contentful Paint (FCP)
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  // Time to First Byte (TTFB)
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
  // Interaction to Next Paint (INP)
  INP: {
    good: 200,
    needsImprovement: 500,
  },
};

// Configuration for production performance monitoring
export const performanceConfig: WebVitalsConfig = {
  enableLogging: process.env.NODE_ENV === 'development',
  enableReporting: process.env.NODE_ENV === 'production',
  reportingEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1, // 10% in production, 100% in dev
};

/**
 * Get rating for a metric value
 */
export function getMetricRating(
  metricName: keyof typeof PERFORMANCE_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = PERFORMANCE_THRESHOLDS[metricName];

  if (!thresholds) {
    return 'needs-improvement';
  }

  if (value <= thresholds.good) {
    return 'good';
  }

  if (value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  }

  return 'poor';
}

/**
 * Format metric value for display
 */
export function formatMetricValue(name: string, value: number): string {
  // CLS is unitless, others are in milliseconds
  if (name === 'CLS') {
    return value.toFixed(3);
  }

  // Convert to seconds if value is large
  if (value >= 10000) {
    return `${(value / 1000).toFixed(2)}s`;
  }

  return `${Math.round(value)}ms`;
}

/**
 * Report metrics to analytics endpoint
 */
export async function reportMetrics(metrics: PerformanceMetric[]): Promise<void> {
  if (!performanceConfig.enableReporting || !performanceConfig.reportingEndpoint) {
    return;
  }

  // Sample based on configured rate
  if (Math.random() > performanceConfig.sampleRate) {
    return;
  }

  try {
    await fetch(performanceConfig.reportingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metrics,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        sessionId: getSessionId(),
      }),
    });
  } catch (error) {
    // Silently fail - don't impact user experience
    if (performanceConfig.enableLogging) {
      console.error('Failed to report metrics:', error);
    }
  }
}

/**
 * Get or create session ID for tracking
 */
function getSessionId(): string {
  const key = 'performance-session-id';
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

/**
 * Log metrics to console in development
 */
export function logMetric(metric: PerformanceMetric): void {
  if (!performanceConfig.enableLogging) {
    return;
  }

  const emoji =
    metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';

  console.log(
    `${emoji} ${metric.name}: ${formatMetricValue(metric.name, metric.value)} (${metric.rating})`
  );
}

/**
 * Batch metrics for efficient reporting
 */
class MetricsBatcher {
  private metrics: PerformanceMetric[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize = 10;
  private readonly batchDelay = 5000; // 5 seconds

  add(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    if (this.metrics.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchDelay);
    }
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.metrics.length === 0) {
      return;
    }

    const metricsToReport = [...this.metrics];
    this.metrics = [];

    await reportMetrics(metricsToReport);
  }
}

export const metricsBatcher = new MetricsBatcher();

// Resource timing utilities
export function getResourceTimings(): PerformanceResourceTiming[] {
  if (!('performance' in window) || !('getEntriesByType' in performance)) {
    return [];
  }

  return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
}

export function analyzeResourceTimings() {
  const resources = getResourceTimings();

  const analysis = {
    totalResources: resources.length,
    totalSize: 0,
    totalDuration: 0,
    slowResources: [] as { name: string; duration: number }[],
    largeResources: [] as { name: string; size: number }[],
  };

  resources.forEach((resource) => {
    const duration = resource.responseEnd - resource.startTime;
    const size = resource.transferSize || 0;

    analysis.totalDuration += duration;
    analysis.totalSize += size;

    // Track slow resources (> 1 second)
    if (duration > 1000) {
      analysis.slowResources.push({
        name: resource.name,
        duration: Math.round(duration),
      });
    }

    // Track large resources (> 100KB)
    if (size > 100000) {
      analysis.largeResources.push({
        name: resource.name,
        size: Math.round(size / 1024),
      });
    }
  });

  return analysis;
}

// Export singleton instance for monitoring
export const performanceMonitor = {
  config: performanceConfig,
  thresholds: PERFORMANCE_THRESHOLDS,
  getMetricRating,
  formatMetricValue,
  reportMetrics,
  logMetric,
  batcher: metricsBatcher,
  analyzeResourceTimings,
};
