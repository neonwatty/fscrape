import * as os from "os";
import * as fs from "fs/promises";
import { advancedLogger } from "../utils/advanced-logger";
import { HealthCheckResult, HealthCheckConfig } from "./health-checker";

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  network?: {
    interfaces: NetworkInterface[];
  };
}

interface NetworkInterface {
  name: string;
  address: string;
  family: string;
  internal: boolean;
}

export class SystemMonitor {
  private readonly logger = advancedLogger.child({ module: "SystemMonitor" });
  private config: HealthCheckConfig;
  private lastCpuInfo?: os.CpuInfo[];
  private lastCpuUsage?: NodeJS.CpuUsage;
  private metricsHistory: SystemMetrics[] = [];
  private readonly maxHistorySize = 100;

  constructor(config: HealthCheckConfig) {
    this.config = config;
  }

  /**
   * Check system health
   */
  public async checkSystem(): Promise<HealthCheckResult[]> {
    const checks: HealthCheckResult[] = [];

    // Collect system metrics
    const metrics = await this.collectMetrics();
    this.addToHistory(metrics);

    // CPU check
    checks.push(this.checkCpu(metrics.cpu));

    // Memory check
    checks.push(this.checkMemory(metrics.memory));

    // Disk check
    checks.push(await this.checkDisk());

    // Process check
    checks.push(this.checkProcess(metrics.process));

    return checks;
  }

  /**
   * Collect system metrics
   */
  public async collectMetrics(): Promise<SystemMetrics> {
    const cpuUsage = this.calculateCpuUsage();
    const memoryInfo = this.getMemoryInfo();
    const diskInfo = await this.getDiskInfo();
    const processInfo = this.getProcessInfo();
    const networkInfo = this.getNetworkInfo();

    return {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      memory: memoryInfo,
      disk: diskInfo,
      process: processInfo,
      network: networkInfo,
    };
  }

  /**
   * Check CPU health
   */
  private checkCpu(cpu: SystemMetrics["cpu"]): HealthCheckResult {
    const threshold = this.config.thresholds?.cpu || 80;
    const status = cpu.usage > threshold ? "warning" : "pass";
    const message =
      cpu.usage > threshold
        ? `CPU usage high: ${cpu.usage.toFixed(1)}% (threshold: ${threshold}%)`
        : `CPU usage normal: ${cpu.usage.toFixed(1)}%`;

    return {
      name: "system:cpu",
      status,
      message,
      details: {
        usage: cpu.usage,
        cores: cpu.cores,
        loadAverage: cpu.loadAverage,
        threshold,
      },
    };
  }

  /**
   * Check memory health
   */
  private checkMemory(memory: SystemMetrics["memory"]): HealthCheckResult {
    const threshold = this.config.thresholds?.memory || 90;
    const status = memory.usagePercent > threshold ? "warning" : "pass";
    const message =
      memory.usagePercent > threshold
        ? `Memory usage high: ${memory.usagePercent.toFixed(1)}% (threshold: ${threshold}%)`
        : `Memory usage normal: ${memory.usagePercent.toFixed(1)}%`;

    return {
      name: "system:memory",
      status,
      message,
      details: {
        total: memory.total,
        used: memory.used,
        free: memory.free,
        usagePercent: memory.usagePercent,
        threshold,
      },
    };
  }

  /**
   * Check disk health
   */
  private async checkDisk(): Promise<HealthCheckResult> {
    try {
      const diskInfo = await this.getDiskInfo();
      const threshold = this.config.thresholds?.diskSpace || 90;
      const status = diskInfo.usagePercent > threshold ? "warning" : "pass";
      const message =
        diskInfo.usagePercent > threshold
          ? `Disk usage high: ${diskInfo.usagePercent.toFixed(1)}% (threshold: ${threshold}%)`
          : `Disk usage normal: ${diskInfo.usagePercent.toFixed(1)}%`;

      return {
        name: "system:disk",
        status,
        message,
        details: {
          total: diskInfo.total,
          used: diskInfo.used,
          free: diskInfo.free,
          usagePercent: diskInfo.usagePercent,
          threshold,
        },
      };
    } catch (_error) {
      return {
        name: "system:disk",
        status: "warning",
        message: "Unable to check disk usage",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Check process health
   */
  private checkProcess(process: SystemMetrics["process"]): HealthCheckResult {
    const heapUsed = process.memoryUsage.heapUsed;
    const heapTotal = process.memoryUsage.heapTotal;
    const heapPercent = (heapUsed / heapTotal) * 100;

    const status = heapPercent > 90 ? "warning" : "pass";
    const message =
      heapPercent > 90
        ? `Process heap usage high: ${heapPercent.toFixed(1)}%`
        : `Process healthy`;

    return {
      name: "system:process",
      status,
      message,
      details: {
        pid: process.pid,
        uptime: process.uptime,
        memoryUsage: process.memoryUsage,
        heapPercent,
      },
    };
  }

  /**
   * Calculate CPU usage
   */
  private calculateCpuUsage(): number {
    const cpus = os.cpus();

    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Get memory information
   */
  private getMemoryInfo(): SystemMetrics["memory"] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = (used / total) * 100;

    return {
      total,
      used,
      free,
      usagePercent,
    };
  }

  /**
   * Get disk information
   */
  private async getDiskInfo(): Promise<SystemMetrics["disk"]> {
    // Simplified disk check - in production, use proper disk usage library
    try {
      const stats = await fs.statfs(process.cwd());
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      return {
        total,
        used,
        free,
        usagePercent,
      };
    } catch (_error) {
      // Fallback for systems that don't support statfs
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
      };
    }
  }

  /**
   * Get process information
   */
  private getProcessInfo(): SystemMetrics["process"] {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * Get network information
   */
  private getNetworkInfo(): SystemMetrics["network"] {
    const networkInterfaces = os.networkInterfaces();
    const interfaces: NetworkInterface[] = [];

    for (const [name, nets] of Object.entries(networkInterfaces)) {
      if (nets) {
        for (const net of nets) {
          interfaces.push({
            name,
            address: net.address,
            family: net.family,
            internal: net.internal,
          });
        }
      }
    }

    return { interfaces };
  }

  /**
   * Add metrics to history
   */
  private addToHistory(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);

    // Keep history size limited
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Get metrics history
   */
  public getHistory(): SystemMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get average metrics over time
   */
  public getAverageMetrics(): Partial<SystemMetrics> {
    if (this.metricsHistory.length === 0) {
      return {};
    }

    const avgCpu =
      this.metricsHistory.reduce((sum, m) => sum + m.cpu.usage, 0) /
      this.metricsHistory.length;
    const avgMemory =
      this.metricsHistory.reduce((sum, m) => sum + m.memory.usagePercent, 0) /
      this.metricsHistory.length;
    const avgDisk =
      this.metricsHistory.reduce((sum, m) => sum + m.disk.usagePercent, 0) /
      this.metricsHistory.length;

    return {
      cpu: {
        usage: avgCpu,
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem(),
        usagePercent: avgMemory,
      },
      disk: {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: avgDisk,
      },
    };
  }

  /**
   * Clear metrics history
   */
  public clearHistory(): void {
    this.metricsHistory = [];
    this.logger.info("System metrics history cleared");
  }

  /**
   * Get current metrics
   */
  public async getCurrentMetrics(): Promise<SystemMetrics> {
    return await this.collectMetrics();
  }

  /**
   * Check if system resources are within limits
   */
  public async isSystemHealthy(): Promise<boolean> {
    const metrics = await this.collectMetrics();

    const cpuThreshold = this.config.thresholds?.cpu || 80;
    const memoryThreshold = this.config.thresholds?.memory || 90;
    const diskThreshold = this.config.thresholds?.diskSpace || 90;

    return (
      metrics.cpu.usage <= cpuThreshold &&
      metrics.memory.usagePercent <= memoryThreshold &&
      metrics.disk.usagePercent <= diskThreshold
    );
  }
}
