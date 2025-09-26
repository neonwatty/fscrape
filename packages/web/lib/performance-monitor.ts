'use client';

interface PerformanceMetrics {
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  tti: number; // Time to Interactive
  bundleSize?: number;
  memoryUsage?: number;
}

interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: string;
}

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private resources: ResourceTiming[] = [];
  private observer: PerformanceObserver | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      this.initializeObserver();
      this.collectInitialMetrics();
    }
  }

  private initializeObserver() {
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
          }

          if (entry.entryType === 'paint') {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime;
            }
          }

          if (entry.entryType === 'largest-contentful-paint') {
            this.metrics.lcp = entry.startTime;
          }

          if (entry.entryType === 'first-input') {
            const fidEntry = entry as PerformanceEventTiming;
            this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
          }

          if (entry.entryType === 'layout-shift') {
            const layoutEntry = entry as PerformanceEntry & {
              hadRecentInput: boolean;
              value: number;
            };
            if (!layoutEntry.hadRecentInput) {
              this.metrics.cls = (this.metrics.cls || 0) + layoutEntry.value;
            }
          }
        }
      });

      this.observer.observe({
        entryTypes: [
          'navigation',
          'paint',
          'largest-contentful-paint',
          'first-input',
          'layout-shift',
        ],
      });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  private collectInitialMetrics() {
    if (typeof window === 'undefined') return;

    // Collect navigation timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
    }

    // Collect resource timings
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    this.resources = resources.map((resource) => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize || 0,
      type: this.getResourceType(resource.name),
    }));

    // Memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as Performance & { memory: { usedJSHeapSize: number } }).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1048576; // Convert to MB
    }
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.webp')) return 'image';
    if (url.includes('.woff') || url.includes('.ttf')) return 'font';
    return 'other';
  }

  public getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  public getResourcesByType(type: string): ResourceTiming[] {
    return this.resources.filter((r) => r.type === type);
  }

  public getBundleSize(): number {
    const scripts = this.getResourcesByType('script');
    return scripts.reduce((total, script) => total + script.size, 0) / 1024; // KB
  }

  public getCSSSize(): number {
    const styles = this.getResourcesByType('stylesheet');
    return styles.reduce((total, style) => total + style.size, 0) / 1024; // KB
  }

  public getImageSize(): number {
    const images = this.getResourcesByType('image');
    return images.reduce((total, img) => total + img.size, 0) / 1024; // KB
  }

  public getTotalResourceSize(): number {
    return this.resources.reduce((total, resource) => total + resource.size, 0) / 1024; // KB
  }

  public getLargestResources(count: number = 10): ResourceTiming[] {
    return [...this.resources].sort((a, b) => b.size - a.size).slice(0, count);
  }

  public getSlowestResources(count: number = 10): ResourceTiming[] {
    return [...this.resources].sort((a, b) => b.duration - a.duration).slice(0, count);
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Web Vitals collection utility
export function collectWebVitals(callback: (metrics: PerformanceMetrics) => void) {
  if (typeof window === 'undefined') return;

  const _metrics: Partial<PerformanceMetrics> = {};

  // Use native performance monitoring since web-vitals is not installed
  const monitor = new PerformanceMonitor();
  setTimeout(() => {
    callback(monitor.getMetrics());
  }, 3000);
}

// Bundle analyzer helper
export function analyzeBundleSize() {
  if (typeof window === 'undefined') return null;

  const monitor = new PerformanceMonitor();

  setTimeout(() => {
    const analysis = {
      js: monitor.getBundleSize(),
      css: monitor.getCSSSize(),
      images: monitor.getImageSize(),
      total: monitor.getTotalResourceSize(),
      largestResources: monitor.getLargestResources(5),
      slowestResources: monitor.getSlowestResources(5),
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('Bundle Analysis:', analysis);
    }

    monitor.destroy();
    return analysis;
  }, 2000);

  return null;
}

// Performance report generator
export function generatePerformanceReport(): string {
  const monitor = new PerformanceMonitor();

  setTimeout(() => {
    const metrics = monitor.getMetrics();
    const bundleSize = monitor.getBundleSize();
    const cssSize = monitor.getCSSSize();
    const imageSize = monitor.getImageSize();
    const totalSize = monitor.getTotalResourceSize();

    const report = `
Performance Report
==================
Web Vitals:
- TTFB: ${metrics.ttfb?.toFixed(2) || 'N/A'}ms
- FCP: ${metrics.fcp?.toFixed(2) || 'N/A'}ms
- LCP: ${metrics.lcp?.toFixed(2) || 'N/A'}ms
- FID: ${metrics.fid?.toFixed(2) || 'N/A'}ms
- CLS: ${metrics.cls?.toFixed(4) || 'N/A'}

Resource Sizes:
- JavaScript: ${bundleSize.toFixed(2)}KB
- CSS: ${cssSize.toFixed(2)}KB
- Images: ${imageSize.toFixed(2)}KB
- Total: ${totalSize.toFixed(2)}KB

Memory Usage: ${metrics.memoryUsage?.toFixed(2) || 'N/A'}MB

Largest Resources:
${monitor
  .getLargestResources(3)
  .map((r) => `  - ${r.name.split('/').pop()}: ${(r.size / 1024).toFixed(2)}KB`)
  .join('\n')}

Slowest Resources:
${monitor
  .getSlowestResources(3)
  .map((r) => `  - ${r.name.split('/').pop()}: ${r.duration.toFixed(2)}ms`)
  .join('\n')}
    `;

    monitor.destroy();

    if (process.env.NODE_ENV === 'development') {
      console.log(report);
    }

    return report;
  }, 3000);

  return '';
}
