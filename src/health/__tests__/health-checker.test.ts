import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthChecker, HealthCheckConfig } from '../health-checker';
import { ApiMonitor } from '../api-monitor';
import { SystemMonitor } from '../system-monitor';
import { Database } from '../../database/database';

vi.mock('../api-monitor');
vi.mock('../system-monitor');
vi.mock('../../database/database', () => ({
  Database: {
    getInstance: vi.fn(),
  },
}));
vi.mock('../../utils/advanced-logger', () => ({
  advancedLogger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
    })),
  },
}));

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;
  let mockDatabase: any;
  let mockApiMonitor: any;
  let mockSystemMonitor: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database
    mockDatabase = {
      testConnection: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(Database.getInstance).mockReturnValue(mockDatabase);

    // Mock monitors
    mockApiMonitor = {
      checkEndpoints: vi.fn().mockResolvedValue([
        {
          name: 'api:test',
          status: 'pass',
          message: 'API healthy',
          responseTime: 100,
        },
      ]),
    };

    mockSystemMonitor = {
      checkSystem: vi.fn().mockResolvedValue([
        {
          name: 'system:cpu',
          status: 'pass',
          message: 'CPU usage normal',
        },
        {
          name: 'system:memory',
          status: 'pass',
          message: 'Memory usage normal',
        },
      ]),
    };

    (ApiMonitor as any).mockImplementation(() => mockApiMonitor);
    (SystemMonitor as any).mockImplementation(() => mockSystemMonitor);

    healthChecker = new HealthChecker();
  });

  afterEach(() => {
    if (healthChecker) {
      healthChecker.stop();
    }
  });

  describe('Health Checks', () => {
    it('should run health check successfully', async () => {
      const result = await healthChecker.runHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveLength(3); // database + api + 2 system checks
      expect(result.summary.totalChecks).toBe(3);
      expect(result.summary.passedChecks).toBe(3);
      expect(result.summary.failedChecks).toBe(0);
    });

    it('should detect unhealthy status on failures', async () => {
      mockDatabase.testConnection.mockRejectedValue(new Error('Connection failed'));

      const result = await healthChecker.runHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.summary.failedChecks).toBeGreaterThan(0);
    });

    it('should detect degraded status on warnings', async () => {
      mockSystemMonitor.checkSystem.mockResolvedValue([
        {
          name: 'system:cpu',
          status: 'warning',
          message: 'CPU usage high',
        },
      ]);

      const result = await healthChecker.runHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.summary.warnings).toBeGreaterThan(0);
    });

    it('should check database connectivity', async () => {
      const result = await healthChecker.runHealthCheck();
      const dbCheck = result.checks.find(c => c.name === 'database');

      expect(dbCheck).toBeDefined();
      expect(dbCheck?.status).toBe('pass');
      expect(mockDatabase.testConnection).toHaveBeenCalled();
    });

    it('should handle database connection failure', async () => {
      mockDatabase.testConnection.mockRejectedValue(new Error('DB Error'));

      const result = await healthChecker.runHealthCheck();
      const dbCheck = result.checks.find(c => c.name === 'database');

      expect(dbCheck?.status).toBe('fail');
      expect(dbCheck?.message).toContain('Database connection failed');
    });
  });

  describe('Status Management', () => {
    it('should cache status for performance', async () => {
      await healthChecker.runHealthCheck();
      
      // First call should use cache
      const status1 = await healthChecker.getStatus();
      
      // Should not trigger new health check (within 10 seconds)
      vi.clearAllMocks();
      const status2 = await healthChecker.getStatus();
      
      expect(mockDatabase.testConnection).not.toHaveBeenCalled();
      expect(status1.timestamp).toEqual(status2.timestamp);
    });

    it('should check if system is healthy', async () => {
      const isHealthy = await healthChecker.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should return false when system is unhealthy', async () => {
      mockDatabase.testConnection.mockRejectedValue(new Error('Failed'));
      
      const isHealthy = await healthChecker.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Monitoring', () => {
    it('should start health monitoring', async () => {
      vi.useFakeTimers();
      const config: Partial<HealthCheckConfig> = {
        enabled: true,
        interval: 1000,
      };

      const checker = new HealthChecker(config);
      await checker.start();

      // Initial check
      expect(mockDatabase.testConnection).toHaveBeenCalledTimes(1);

      // Advance timer for periodic check
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockDatabase.testConnection).toHaveBeenCalledTimes(2);

      checker.stop();
      vi.useRealTimers();
    });

    it('should not start monitoring when disabled', async () => {
      const config: Partial<HealthCheckConfig> = {
        enabled: false,
      };

      const checker = new HealthChecker(config);
      await checker.start();

      expect(mockDatabase.testConnection).not.toHaveBeenCalled();
    });

    it('should stop monitoring', async () => {
      vi.useFakeTimers();
      
      await healthChecker.start();
      healthChecker.stop();

      vi.clearAllMocks();
      await vi.advanceTimersByTimeAsync(60000);

      expect(mockDatabase.testConnection).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('Metrics', () => {
    it('should return health metrics', async () => {
      await healthChecker.runHealthCheck();
      const metrics = healthChecker.getMetrics();

      expect(metrics).toHaveProperty('status');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('summary');
      expect(metrics).toHaveProperty('checks');
    });

    it('should return unknown status when no checks run', () => {
      const metrics = healthChecker.getMetrics();
      
      expect(metrics.status).toBe('unknown');
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    it('should configure health checker', () => {
      const newConfig: Partial<HealthCheckConfig> = {
        interval: 30000,
        timeout: 10000,
        thresholds: {
          cpu: 90,
          memory: 95,
        },
      };

      healthChecker.configure(newConfig);
      // Configuration change should recreate monitors
      expect(ApiMonitor).toHaveBeenCalled();
      expect(SystemMonitor).toHaveBeenCalled();
    });

    it('should use custom endpoints for API checks', async () => {
      const config: Partial<HealthCheckConfig> = {
        endpoints: ['http://test.com/health'],
      };

      const checker = new HealthChecker(config);
      await checker.runHealthCheck();

      expect(mockApiMonitor.checkEndpoints).toHaveBeenCalledWith(['http://test.com/health']);
    });
  });
});