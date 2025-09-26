import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiMonitor, ApiEndpoint } from '../api-monitor.js';
import { HealthCheckConfig } from '../health-checker.js';
import fetch from 'node-fetch';

vi.mock('node-fetch');
vi.mock('../../utils/advanced-logger', () => ({
  AdvancedLogger: vi.fn().mockImplementation(() => ({
    child: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
    })),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  })),
}));

describe('ApiMonitor', () => {
  let apiMonitor: ApiMonitor;
  let config: HealthCheckConfig;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      enabled: true,
      interval: 60000,
      timeout: 5000,
      thresholds: {
        responseTime: 1000,
      },
    };

    apiMonitor = new ApiMonitor(config);
    mockFetch = vi.mocked(fetch);
  });

  describe('Endpoint Checking', () => {
    it('should check single endpoint successfully', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
      });

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
      };

      const result = await apiMonitor.checkEndpoint(endpoint);

      expect(result.name).toBe('api:test-api');
      expect(result.status).toBe('pass');
      expect(result.message).toContain('Endpoint healthy');
      expect(result.responseTime).toBeDefined();
    });

    it('should detect slow response', async () => {
      // Mock slow response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                status: 200,
                headers: new Map(),
              });
            }, 100);
          })
      );

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
      };

      // Use very low threshold to trigger warning
      const monitor = new ApiMonitor({
        ...config,
        thresholds: { responseTime: 50 },
      });

      const result = await monitor.checkEndpoint(endpoint);

      expect(result.status).toBe('warning');
      expect(result.message).toContain('responding slowly');
    });

    it('should handle unexpected status code', async () => {
      mockFetch.mockResolvedValue({
        status: 500,
        headers: new Map(),
      });

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
        expectedStatus: 200,
      };

      const result = await apiMonitor.checkEndpoint(endpoint);

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Unexpected status code: 500');
    });

    it('should handle endpoint timeout', async () => {
      mockFetch.mockRejectedValue(new Error('The operation was aborted'));

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
        timeout: 1000,
      };

      const result = await apiMonitor.checkEndpoint(endpoint);

      expect(result.status).toBe('fail');
      expect(result.message).toContain('timeout');
      expect(result.details?.timeout).toBe(true);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
      };

      const result = await apiMonitor.checkEndpoint(endpoint);

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Network error');
    });

    it('should check multiple endpoints', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      const endpoints: ApiEndpoint[] = [
        { url: 'http://api1.com/health', name: 'api1' },
        { url: 'http://api2.com/health', name: 'api2' },
      ];

      const results = await apiMonitor.checkEndpoints(endpoints);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('api:api1');
      expect(results[1].name).toBe('api:api2');
    });

    it('should handle string endpoints', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      const results = await apiMonitor.checkEndpoints(['http://test.com/health']);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('api:http://test.com/health');
    });
  });

  describe('Internal API Checks', () => {
    it('should check internal APIs', async () => {
      mockFetch
        .mockResolvedValueOnce({ status: 401, headers: new Map() }) // Reddit
        .mockResolvedValueOnce({ status: 200, headers: new Map() }); // HackerNews

      const results = await apiMonitor.checkInternalApis();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('api:reddit-api');
      expect(results[0].status).toBe('pass'); // 401 is expected
      expect(results[1].name).toBe('api:hackernews-api');
      expect(results[1].status).toBe('pass');
    });
  });

  describe('Statistics', () => {
    it('should track endpoint statistics', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
      };

      await apiMonitor.checkEndpoint(endpoint);
      await apiMonitor.checkEndpoint(endpoint);

      const stats = apiMonitor.getStats('test-api') as any;

      expect(stats.totalChecks).toBe(2);
      expect(stats.successfulChecks).toBe(2);
      expect(stats.failedChecks).toBe(0);
      expect(stats.lastStatus).toBe('pass');
    });

    it('should calculate availability', async () => {
      mockFetch
        .mockResolvedValueOnce({ status: 200, headers: new Map() })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ status: 200, headers: new Map() });

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
      };

      await apiMonitor.checkEndpoint(endpoint);
      await apiMonitor.checkEndpoint(endpoint);
      await apiMonitor.checkEndpoint(endpoint);

      const availability = apiMonitor.calculateAvailability('test-api');

      expect(availability).toBeCloseTo(66.67, 1); // 2 out of 3 successful
    });

    it('should calculate average response time', async () => {
      // Mock with a small delay to ensure responseTime > 0
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                status: 200,
                headers: new Map(),
              });
            }, 10);
          })
      );

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
      };

      await apiMonitor.checkEndpoint(endpoint);
      await apiMonitor.checkEndpoint(endpoint);

      const avgResponseTime = apiMonitor.getAverageResponseTime('test-api');

      expect(avgResponseTime).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
      };

      await apiMonitor.checkEndpoint(endpoint);
      apiMonitor.resetStats('test-api');

      const stats = apiMonitor.getStats('test-api') as any;

      expect(stats.totalChecks).toBe(0);
    });

    it('should reset all statistics', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      await apiMonitor.checkEndpoints(['http://test1.com', 'http://test2.com']);
      apiMonitor.resetStats();

      const allStats = apiMonitor.getStats() as Map<string, any>;

      expect(allStats.size).toBe(0);
    });
  });

  describe('Health Summary', () => {
    it('should provide health summary', async () => {
      // Mock with a small delay to ensure responseTime > 0
      mockFetch
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({ status: 200, headers: new Map() });
              }, 10);
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({ status: 500, headers: new Map() });
              }, 10);
            })
        );

      await apiMonitor.checkEndpoints([
        { url: 'http://healthy.com', name: 'healthy' },
        { url: 'http://unhealthy.com', name: 'unhealthy' },
      ]);

      const summary = apiMonitor.getHealthSummary();

      expect(summary.totalEndpoints).toBe(2);
      expect(summary.healthyEndpoints).toBe(1);
      expect(summary.unhealthyEndpoints).toBe(1);
      expect(summary.degradedEndpoints).toBe(0);
      expect(summary.averageResponseTime).toBeGreaterThan(0);
      expect(summary.overallAvailability).toBe(50);
    });

    it('should handle empty summary', () => {
      const summary = apiMonitor.getHealthSummary();

      expect(summary.totalEndpoints).toBe(0);
      expect(summary.healthyEndpoints).toBe(0);
      expect(summary.averageResponseTime).toBe(0);
      expect(summary.overallAvailability).toBe(0);
    });
  });

  describe('Custom Headers and Methods', () => {
    it('should use custom headers', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
      };

      await apiMonitor.checkEndpoint(endpoint);

      expect(mockFetch).toHaveBeenCalledWith(
        endpoint.url,
        expect.objectContaining({
          headers: endpoint.headers,
        })
      );
    });

    it('should use custom HTTP method', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      const endpoint: ApiEndpoint = {
        url: 'http://test.com/health',
        name: 'test-api',
        method: 'POST',
      };

      await apiMonitor.checkEndpoint(endpoint);

      expect(mockFetch).toHaveBeenCalledWith(
        endpoint.url,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
