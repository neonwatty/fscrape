import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemMonitor } from "../system-monitor.js";
import { HealthCheckConfig } from "../health-checker.js";
import * as os from "os";
import * as fs from "fs/promises";

vi.mock("os");
vi.mock("fs/promises");
vi.mock("../../utils/advanced-logger", () => ({
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

describe("SystemMonitor", () => {
  let systemMonitor: SystemMonitor;
  let config: HealthCheckConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      enabled: true,
      interval: 60000,
      timeout: 5000,
      thresholds: {
        cpu: 80,
        memory: 90,
        diskSpace: 90,
      },
    };

    systemMonitor = new SystemMonitor(config);

    // Mock OS functions
    vi.mocked(os.cpus).mockReturnValue([
      {
        model: "Intel Core i7",
        speed: 2400,
        times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 },
      },
      {
        model: "Intel Core i7",
        speed: 2400,
        times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 },
      },
    ] as any);

    vi.mocked(os.totalmem).mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB
    vi.mocked(os.freemem).mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB free
    vi.mocked(os.loadavg).mockReturnValue([1.5, 1.2, 1.0]);
    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          address: "192.168.1.100",
          netmask: "255.255.255.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: false,
          cidr: "192.168.1.100/24",
        },
      ],
    } as any);

    // Mock process functions
    vi.spyOn(process, "uptime").mockReturnValue(3600);
    vi.spyOn(process, "memoryUsage").mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: 40 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024,
    });
    vi.spyOn(process, "cpuUsage").mockReturnValue({
      user: 1000000,
      system: 500000,
    });
  });

  describe("System Checks", () => {
    it("should perform system health checks", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      const results = await systemMonitor.checkSystem();

      expect(results).toHaveLength(4); // cpu, memory, disk, process
      expect(results.some((r: any) => r.name === "system:cpu")).toBe(true);
      expect(results.some((r: any) => r.name === "system:memory")).toBe(true);
      expect(results.some((r: any) => r.name === "system:disk")).toBe(true);
      expect(results.some((r: any) => r.name === "system:process")).toBe(true);
    });

    it("should detect high CPU usage", async () => {
      // Mock high CPU usage
      vi.mocked(os.cpus).mockReturnValue([
        {
          model: "Intel Core i7",
          speed: 2400,
          times: { user: 9000, nice: 0, sys: 500, idle: 500, irq: 0 },
        },
      ] as any);

      const results = await systemMonitor.checkSystem();
      const cpuCheck = results.find((r: any) => r.name === "system:cpu");

      expect(cpuCheck?.status).toBe("warning");
      expect(cpuCheck?.message).toContain("CPU usage high");
    });

    it("should detect high memory usage", async () => {
      // Mock high memory usage (95% used)
      vi.mocked(os.totalmem).mockReturnValue(16 * 1024 * 1024 * 1024);
      vi.mocked(os.freemem).mockReturnValue(0.8 * 1024 * 1024 * 1024); // Only 5% free

      const results = await systemMonitor.checkSystem();
      const memoryCheck = results.find((r: any) => r.name === "system:memory");

      expect(memoryCheck?.status).toBe("warning");
      expect(memoryCheck?.message).toContain("Memory usage high");
    });

    it("should detect high disk usage", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 50000, // Only 5% available
      } as any);

      const results = await systemMonitor.checkSystem();
      const diskCheck = results.find((r: any) => r.name === "system:disk");

      expect(diskCheck?.status).toBe("warning");
      expect(diskCheck?.message).toContain("Disk usage high");
    });

    it("should handle disk check errors", async () => {
      vi.mocked(fs.statfs).mockRejectedValue(new Error("Permission denied"));

      const results = await systemMonitor.checkSystem();
      const diskCheck = results.find((r: any) => r.name === "system:disk");

      // When statfs fails, it falls back to 0 values which is normal/pass
      expect(diskCheck?.status).toBe("pass");
      expect(diskCheck?.message).toContain("Disk usage normal");
    });

    it("should check process health", async () => {
      const results = await systemMonitor.checkSystem();
      const processCheck = results.find((r: any) => r.name === "system:process");

      expect(processCheck?.status).toBe("pass");
      expect(processCheck?.message).toBe("Process healthy");
      expect(processCheck?.details?.pid).toBe(process.pid);
    });

    it("should detect high heap usage", async () => {
      vi.spyOn(process, "memoryUsage").mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 75 * 1024 * 1024, // 93.75% heap usage
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const results = await systemMonitor.checkSystem();
      const processCheck = results.find((r: any) => r.name === "system:process");

      expect(processCheck?.status).toBe("warning");
      expect(processCheck?.message).toContain("Process heap usage high");
    });
  });

  describe("Metrics Collection", () => {
    it("should collect system metrics", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      const metrics = await systemMonitor.collectMetrics();

      expect(metrics.cpu).toHaveProperty("usage");
      expect(metrics.cpu).toHaveProperty("cores");
      expect(metrics.cpu).toHaveProperty("loadAverage");
      expect(metrics.memory).toHaveProperty("total");
      expect(metrics.memory).toHaveProperty("used");
      expect(metrics.memory).toHaveProperty("free");
      expect(metrics.memory).toHaveProperty("usagePercent");
      expect(metrics.disk).toHaveProperty("total");
      expect(metrics.disk).toHaveProperty("usagePercent");
      expect(metrics.process).toHaveProperty("pid");
      expect(metrics.process).toHaveProperty("uptime");
      expect(metrics.network).toHaveProperty("interfaces");
    });

    it("should calculate CPU usage correctly", async () => {
      const metrics = await systemMonitor.collectMetrics();

      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
      expect(metrics.cpu.cores).toBe(2);
    });

    it("should calculate memory usage correctly", async () => {
      const metrics = await systemMonitor.collectMetrics();

      expect(metrics.memory.total).toBe(16 * 1024 * 1024 * 1024);
      expect(metrics.memory.free).toBe(8 * 1024 * 1024 * 1024);
      expect(metrics.memory.used).toBe(8 * 1024 * 1024 * 1024);
      expect(metrics.memory.usagePercent).toBe(50);
    });

    it("should handle disk metrics with fallback", async () => {
      vi.mocked(fs.statfs).mockRejectedValue(new Error("Not supported"));

      const metrics = await systemMonitor.collectMetrics();

      expect(metrics.disk.total).toBe(0);
      expect(metrics.disk.used).toBe(0);
      expect(metrics.disk.free).toBe(0);
      expect(metrics.disk.usagePercent).toBe(0);
    });
  });

  describe("Metrics History", () => {
    it("should track metrics history", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      // checkSystem calls collectMetrics and adds to history
      await systemMonitor.checkSystem();
      await systemMonitor.checkSystem();

      const history = systemMonitor.getHistory();

      expect(history).toHaveLength(2);
    });

    it("should limit history size", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      // Add more than max history size (100)
      for (let i = 0; i < 105; i++) {
        await systemMonitor.checkSystem();
      }

      const history = systemMonitor.getHistory();

      expect(history).toHaveLength(100);
    });

    it("should calculate average metrics", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      await systemMonitor.checkSystem();
      await systemMonitor.checkSystem();

      const avgMetrics = systemMonitor.getAverageMetrics();

      expect(avgMetrics.cpu?.usage).toBeDefined();
      expect(avgMetrics.memory?.usagePercent).toBeDefined();
      expect(avgMetrics.disk?.usagePercent).toBeDefined();
    });

    it("should handle empty history for averages", () => {
      const avgMetrics = systemMonitor.getAverageMetrics();

      expect(avgMetrics).toEqual({});
    });

    it("should clear metrics history", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      await systemMonitor.collectMetrics();
      systemMonitor.clearHistory();

      const history = systemMonitor.getHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe("System Health", () => {
    it("should check if system is healthy", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      const isHealthy = await systemMonitor.isSystemHealthy();

      expect(isHealthy).toBe(true);
    });

    it("should detect unhealthy system", async () => {
      // Mock high resource usage
      vi.mocked(os.totalmem).mockReturnValue(16 * 1024 * 1024 * 1024);
      vi.mocked(os.freemem).mockReturnValue(0.5 * 1024 * 1024 * 1024); // 97% used

      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      const isHealthy = await systemMonitor.isSystemHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  describe("Network Information", () => {
    it("should collect network interface information", async () => {
      const metrics = await systemMonitor.collectMetrics();

      expect(metrics.network?.interfaces).toHaveLength(1);
      expect(metrics.network?.interfaces[0]).toHaveProperty("name", "eth0");
      expect(metrics.network?.interfaces[0]).toHaveProperty(
        "address",
        "192.168.1.100",
      );
      expect(metrics.network?.interfaces[0]).toHaveProperty("family", "IPv4");
      expect(metrics.network?.interfaces[0]).toHaveProperty("internal", false);
    });
  });

  describe("Current Metrics", () => {
    it("should get current metrics", async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        blocks: 1000000,
        bsize: 4096,
        bavail: 500000,
      } as any);

      const metrics = await systemMonitor.getCurrentMetrics();

      expect(metrics).toHaveProperty("cpu");
      expect(metrics).toHaveProperty("memory");
      expect(metrics).toHaveProperty("disk");
      expect(metrics).toHaveProperty("process");
    });
  });
});
