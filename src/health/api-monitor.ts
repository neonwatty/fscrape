import { advancedLogger } from '../utils/advanced-logger';
import { HealthCheckResult, HealthCheckConfig } from './health-checker';
import fetch from 'node-fetch';

export interface ApiEndpoint {
  url: string;
  name: string;
  method?: string;
  headers?: Record<string, string>;
  expectedStatus?: number;
  timeout?: number;
}

export class ApiMonitor {
  private readonly logger = advancedLogger.child({ module: 'ApiMonitor' });
  private config: HealthCheckConfig;
  private endpointStats: Map<string, EndpointStats>;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.endpointStats = new Map();
  }

  /**
   * Check multiple endpoints
   */
  public async checkEndpoints(endpoints: string[] | ApiEndpoint[]): Promise<HealthCheckResult[]> {
    const checks: HealthCheckResult[] = [];

    for (const endpoint of endpoints) {
      const endpointConfig = typeof endpoint === 'string' 
        ? { url: endpoint, name: endpoint }
        : endpoint;

      const result = await this.checkEndpoint(endpointConfig);
      checks.push(result);
    }

    return checks;
  }

  /**
   * Check single endpoint
   */
  public async checkEndpoint(endpoint: ApiEndpoint): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timeout = endpoint.timeout || this.config.timeout || 5000;
    let result: HealthCheckResult;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(endpoint.url, {
        method: endpoint.method || 'GET',
        headers: endpoint.headers || {},
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const expectedStatus = endpoint.expectedStatus || 200;

      if (response.status === expectedStatus) {
        // Check response time threshold
        const threshold = this.config.thresholds?.responseTime || 1000;
        const status = responseTime > threshold ? 'warning' : 'pass';
        const message = responseTime > threshold
          ? `Endpoint responding slowly (${responseTime}ms > ${threshold}ms)`
          : `Endpoint healthy (${responseTime}ms)`;

        result = {
          name: `api:${endpoint.name}`,
          status,
          message,
          responseTime,
          details: {
            url: endpoint.url,
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
          },
        };
      } else {
        result = {
          name: `api:${endpoint.name}`,
          status: 'fail',
          message: `Unexpected status code: ${response.status} (expected ${expectedStatus})`,
          responseTime,
          details: {
            url: endpoint.url,
            statusCode: response.status,
            expectedStatus,
          },
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');

      result = {
        name: `api:${endpoint.name}`,
        status: 'fail',
        message: isTimeout ? `Endpoint timeout after ${timeout}ms` : `Endpoint error: ${errorMessage}`,
        responseTime,
        details: {
          url: endpoint.url,
          error: errorMessage,
          timeout: isTimeout,
        },
      };
    }

    // Update statistics for this endpoint
    this.updateStats(endpoint.name, result);
    
    return result;
  }

  /**
   * Check internal API endpoints
   */
  public async checkInternalApis(): Promise<HealthCheckResult[]> {
    const checks: HealthCheckResult[] = [];

    // Check common internal endpoints
    const internalEndpoints: ApiEndpoint[] = [
      {
        name: 'reddit-api',
        url: 'https://www.reddit.com/api/v1/me.json',
        expectedStatus: 401, // Expect unauthorized without credentials
      },
      {
        name: 'hackernews-api',
        url: 'https://hacker-news.firebaseio.com/v0/maxitem.json',
        expectedStatus: 200,
      },
    ];

    for (const endpoint of internalEndpoints) {
      const result = await this.checkEndpoint(endpoint);
      checks.push(result);
    }

    return checks;
  }

  /**
   * Update endpoint statistics
   */
  private updateStats(endpointName: string, result: HealthCheckResult): void {
    const stats = this.endpointStats.get(endpointName) || {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
      totalResponseTime: 0,
      lastCheck: new Date(),
      lastStatus: 'unknown' as const,
    };

    stats.totalChecks++;
    stats.lastCheck = new Date();
    stats.lastStatus = result.status;

    if (result.status === 'pass') {
      stats.successfulChecks++;
    } else if (result.status === 'fail') {
      stats.failedChecks++;
    } else if (result.status === 'warning') {
      stats.warningChecks++;
    }

    if (result.responseTime) {
      stats.totalResponseTime += result.responseTime;
    }

    this.endpointStats.set(endpointName, stats);
  }

  /**
   * Get endpoint statistics
   */
  public getStats(endpointName?: string): EndpointStats | Map<string, EndpointStats> {
    if (endpointName) {
      return this.endpointStats.get(endpointName) || {
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        warningChecks: 0,
        totalResponseTime: 0,
        lastCheck: new Date(),
        lastStatus: 'unknown',
      };
    }

    return this.endpointStats;
  }

  /**
   * Calculate endpoint availability
   */
  public calculateAvailability(endpointName: string): number {
    const stats = this.endpointStats.get(endpointName);
    if (!stats || stats.totalChecks === 0) {
      return 0;
    }

    return (stats.successfulChecks / stats.totalChecks) * 100;
  }

  /**
   * Get average response time
   */
  public getAverageResponseTime(endpointName: string): number {
    const stats = this.endpointStats.get(endpointName);
    if (!stats || stats.totalChecks === 0) {
      return 0;
    }

    return stats.totalResponseTime / stats.totalChecks;
  }

  /**
   * Reset statistics
   */
  public resetStats(endpointName?: string): void {
    if (endpointName) {
      this.endpointStats.delete(endpointName);
    } else {
      this.endpointStats.clear();
    }

    this.logger.info('API monitor statistics reset', { endpoint: endpointName });
  }

  /**
   * Get health summary
   */
  public getHealthSummary(): {
    totalEndpoints: number;
    healthyEndpoints: number;
    degradedEndpoints: number;
    unhealthyEndpoints: number;
    averageResponseTime: number;
    overallAvailability: number;
  } {
    const endpoints = Array.from(this.endpointStats.entries());
    
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let totalResponseTime = 0;
    let totalChecks = 0;
    let totalSuccessful = 0;

    for (const [_, stats] of endpoints) {
      if (stats.lastStatus === 'pass') {
        healthyCount++;
      } else if (stats.lastStatus === 'warning') {
        degradedCount++;
      } else if (stats.lastStatus === 'fail') {
        unhealthyCount++;
      }

      totalResponseTime += stats.totalResponseTime;
      totalChecks += stats.totalChecks;
      totalSuccessful += stats.successfulChecks;
    }

    return {
      totalEndpoints: endpoints.length,
      healthyEndpoints: healthyCount,
      degradedEndpoints: degradedCount,
      unhealthyEndpoints: unhealthyCount,
      averageResponseTime: totalChecks > 0 ? totalResponseTime / totalChecks : 0,
      overallAvailability: totalChecks > 0 ? (totalSuccessful / totalChecks) * 100 : 0,
    };
  }
}

interface EndpointStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  warningChecks: number;
  totalResponseTime: number;
  lastCheck: Date;
  lastStatus: 'pass' | 'fail' | 'warning' | 'unknown';
}