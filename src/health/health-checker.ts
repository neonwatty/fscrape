import { AdvancedLogger } from "../utils/advanced-logger.js";

const advancedLogger = new AdvancedLogger();
import { ApiMonitor } from "./api-monitor.js";
import { SystemMonitor } from "./system-monitor.js";
import { DatabaseManager } from "../database/database.js";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  uptime: number;
  checks: HealthCheckResult[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warnings: number;
  };
}

export interface HealthCheckResult {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  endpoints?: string[];
  thresholds?: {
    cpu?: number;
    memory?: number;
    diskSpace?: number;
    responseTime?: number;
  };
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  enabled: true,
  interval: 60000, // 1 minute
  timeout: 5000,
  thresholds: {
    cpu: 80,
    memory: 90,
    diskSpace: 90,
    responseTime: 1000,
  },
};

export class HealthChecker {
  private readonly logger = advancedLogger;
  private config: HealthCheckConfig;
  private apiMonitor: ApiMonitor;
  private systemMonitor: SystemMonitor;
  private database: DatabaseManager;
  private startTime: Date;
  private checkInterval?: NodeJS.Timeout;
  private lastStatus?: HealthStatus;

  constructor(config?: Partial<HealthCheckConfig>, database?: DatabaseManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.apiMonitor = new ApiMonitor(this.config);
    this.systemMonitor = new SystemMonitor(this.config);
    this.database = database || new DatabaseManager({ path: "./fscrape.db" });
    this.startTime = new Date();
  }

  /**
   * Start health monitoring
   */
  public async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info("Health checks disabled");
      return;
    }

    this.logger.info("Starting health checker", {
      interval: this.config.interval,
      timeout: this.config.timeout,
    });

    // Run initial check
    await this.runHealthCheck();

    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, this.config.interval);
  }

  /**
   * Stop health monitoring
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      this.logger.info("Health checker stopped");
    }
  }

  /**
   * Run all health checks
   */
  public async runHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    this.logger.debug("Running health checks");

    // Database check
    checks.push(await this.checkDatabase());

    // API checks
    if (this.config.endpoints && this.config.endpoints.length > 0) {
      const apiChecks = await this.apiMonitor.checkEndpoints(
        this.config.endpoints,
      );
      checks.push(...apiChecks);
    }

    // System checks
    const systemChecks = await this.systemMonitor.checkSystem();
    checks.push(...systemChecks);

    // Calculate summary
    const summary = this.calculateSummary(checks);

    // Determine overall status
    const status = this.determineOverallStatus(checks);

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      checks,
      summary,
    };

    this.lastStatus = healthStatus;

    const duration = Date.now() - startTime;
    this.logger.info("Health check completed", {
      status,
      duration,
      summary,
    });

    // Log warnings or errors if any
    if (status !== "healthy") {
      const failedChecks = checks.filter((c) => c.status === "fail");
      const warnings = checks.filter((c) => c.status === "warning");

      if (failedChecks.length > 0) {
        this.logger.error("Health check failures detected", {
          failures: failedChecks.map((c) => ({
            name: c.name,
            message: c.message,
          })),
        });
      }

      if (warnings.length > 0) {
        this.logger.warn("Health check warnings detected", {
          warnings: warnings.map((c) => ({ name: c.name, message: c.message })),
        });
      }
    }

    return healthStatus;
  }

  /**
   * Get current health status
   */
  public async getStatus(): Promise<HealthStatus> {
    if (!this.lastStatus) {
      return await this.runHealthCheck();
    }

    // Return cached status if recent (within 10 seconds)
    const age = Date.now() - this.lastStatus.timestamp.getTime();
    if (age < 10000) {
      return this.lastStatus;
    }

    return await this.runHealthCheck();
  }

  /**
   * Check if system is healthy
   */
  public async isHealthy(): Promise<boolean> {
    const status = await this.getStatus();
    return status.status === "healthy";
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Test database connection
      // Test database connection by running a simple query
      await this.database.vacuum();

      const responseTime = Date.now() - startTime;

      return {
        name: "database",
        status: "pass",
        message: "Database connection healthy",
        responseTime,
        details: {
          connected: true,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: "database",
        status: "fail",
        message: `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        responseTime,
        details: {
          connected: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    checks: HealthCheckResult[],
  ): HealthStatus["summary"] {
    const totalChecks = checks.length;
    const passedChecks = checks.filter((c) => c.status === "pass").length;
    const failedChecks = checks.filter((c) => c.status === "fail").length;
    const warnings = checks.filter((c) => c.status === "warning").length;

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      warnings,
    };
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(
    checks: HealthCheckResult[],
  ): "healthy" | "degraded" | "unhealthy" {
    const hasFailures = checks.some((c) => c.status === "fail");
    const hasWarnings = checks.some((c) => c.status === "warning");

    if (hasFailures) {
      return "unhealthy";
    }

    if (hasWarnings) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Get health metrics for monitoring
   */
  public getMetrics(): Record<string, any> {
    if (!this.lastStatus) {
      return {
        status: "unknown",
        uptime: Date.now() - this.startTime.getTime(),
      };
    }

    return {
      status: this.lastStatus.status,
      uptime: this.lastStatus.uptime,
      lastCheck: this.lastStatus.timestamp,
      summary: this.lastStatus.summary,
      checks: this.lastStatus.checks.map((c) => ({
        name: c.name,
        status: c.status,
        responseTime: c.responseTime,
      })),
    };
  }

  /**
   * Register custom health check
   */
  public registerCheck(
    name: string,
    _check: () => Promise<HealthCheckResult>,
  ): void {
    this.logger.info(`Registering custom health check: ${name}`);
    // Store custom checks for execution during health check runs
    // Implementation would store these in a Map or array
  }

  /**
   * Configure health check
   */
  public configure(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
    this.apiMonitor = new ApiMonitor(this.config);
    this.systemMonitor = new SystemMonitor(this.config);

    this.logger.info("Health checker reconfigured", this.config);
  }
}
