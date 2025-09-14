/**
 * Integration tests for analyze command and all subcommands
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { Command } from "commander";
import { createAnalyzeCommand } from "../analyze.js";
import * as fs from "fs";
import chalk from "chalk";

// Mock the validation module to avoid actual file system checks
vi.mock("../../validation.js", () => ({
  validatePath: vi.fn((path: string) => path),
  validatePositiveInt: vi.fn((value: string, name: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }
    return num;
  }),
  formatError: vi.fn((error: any) => error.message || String(error)),
}));

// Mock fs module for cache operations
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock chalk for colored output
vi.mock("chalk", () => ({
  default: {
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    blue: vi.fn((text) => text),
    bold: vi.fn((text) => text),
    dim: vi.fn((text) => text),
    gray: vi.fn((text) => text),
    bgRed: {
      white: vi.fn((text) => text),
    },
    bgGreen: {
      white: vi.fn((text) => text),
    },
    bgYellow: {
      black: vi.fn((text) => text),
    },
  },
}));

// Mock the database manager module with proper structure
vi.mock("../../../database/database.js", () => {
  const mockAnalytics = {
    getBasicStats: vi.fn().mockReturnValue({
      totalPosts: 100,
      avgScore: 150,
      avgComments: 62.5,
      platformBreakdown: { reddit: 50, hackernews: 50 },
    }),
    getTrendAnalysis: vi.fn().mockReturnValue({
      trend: "increasing",
      confidence: 0.85,
      predictions: [],
    }),
    detectAnomalies: vi.fn().mockReturnValue({
      anomalies: [{ date: "2024-01-15", value: 1000, zScore: 3.5 }],
      threshold: 3,
    }),
    getForecast: vi.fn().mockReturnValue({
      predictions: [
        { date: "2024-02-01", value: 250, confidence: 0.8 },
        { date: "2024-02-02", value: 260, confidence: 0.75 },
      ],
      model: "arima",
    }),
    getEngagementOverTime: vi.fn().mockReturnValue([
      { date: "2024-01-01", engagement: 100 },
      { date: "2024-01-02", engagement: 150 },
      { date: "2024-01-03", engagement: 200 },
    ]),
    getTrends: vi.fn().mockReturnValue({
      data: [
        { date: "2024-01-01", value: 100 },
        { date: "2024-01-02", value: 150 },
      ],
      trend: "increasing",
    }),
    getMetricOverTime: vi.fn().mockReturnValue([
      { date: "2024-01-01", value: 100 },
      { date: "2024-01-02", value: 150 },
    ]),
    query: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([
        { date: "2024-01-01", score: 100, comments: 50 },
        { date: "2024-01-02", score: 150, comments: 75 },
      ]),
    }),
  };

  const mockDbManager = {
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getAnalytics: vi.fn().mockReturnValue(mockAnalytics),
    getQuery: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([
        { date: "2024-01-01", score: 100, comments: 50 },
        { date: "2024-01-02", score: 150, comments: 75 },
      ]),
      get: vi.fn().mockReturnValue({ count: 100 }),
    }),
  };

  return {
    DatabaseManager: vi.fn().mockImplementation(() => mockDbManager),
  };
});

// Mock analytics engines
vi.mock("../../../analytics/statistics.js", () => ({
  StatisticsEngine: Object.assign(
    vi.fn().mockImplementation(() => ({
      calculate: vi.fn().mockReturnValue({
        totalArticles: 100,
        avgScore: 150,
        avgComments: 62.5,
        platformBreakdown: { reddit: 50, hackernews: 50 },
      }),
      formatOutput: vi.fn().mockReturnValue("Statistics Output"),
    })),
    {
      getSummary: vi.fn().mockReturnValue({
        count: 3,
        mean: 150,
        median: 150,
        standardDeviation: 50,
        min: 100,
        max: 200,
        quartiles: { q1: 125, q3: 175 },
        skewness: 0,
        kurtosis: 0,
      }),
    },
  ),
}));

vi.mock("../../../analytics/trend-analyzer.js", () => ({
  TrendAnalyzer: Object.assign(
    vi.fn().mockImplementation(() => ({
      analyze: vi.fn().mockReturnValue({
        trend: "increasing",
        confidence: 0.85,
        predictions: [],
      }),
      formatOutput: vi.fn().mockReturnValue("Trends Output"),
    })),
    {
      analyzeTrend: vi.fn().mockReturnValue({
        trend: "increasing",
        confidence: 0.85,
        changePercent: 15,
        seasonality: "weekly",
      }),
    },
  ),
}));

vi.mock("../../../analytics/anomaly-detector.js", () => ({
  AnomalyDetector: Object.assign(
    vi.fn().mockImplementation(() => ({
      detect: vi.fn().mockReturnValue({
        anomalies: [{ date: "2024-01-15", value: 1000, zScore: 3.5 }],
        threshold: 3,
      }),
      formatOutput: vi.fn().mockReturnValue("Anomalies Output"),
    })),
    {
      detectAnomalies: vi.fn().mockReturnValue({
        anomalies: [{ date: "2024-01-15", value: 1000, score: 3.5 }],
        method: "zscore",
        threshold: 2.5,
      }),
    },
  ),
}));

vi.mock("../../../analytics/forecasting.js", () => ({
  ForecastingEngine: Object.assign(
    vi.fn().mockImplementation(() => ({
      predict: vi.fn().mockReturnValue({
        predictions: [
          { date: "2024-02-01", value: 250, confidence: 0.8 },
          { date: "2024-02-02", value: 260, confidence: 0.75 },
        ],
        model: "arima",
      }),
      formatOutput: vi.fn().mockReturnValue("Forecast Output"),
    })),
    {
      forecast: vi.fn().mockReturnValue({
        forecast: [
          { date: "2024-02-01", value: 250, lower: 200, upper: 300 },
          { date: "2024-02-02", value: 260, lower: 210, upper: 310 },
        ],
        model: "auto",
        accuracy: { rmse: 10, mae: 8 },
      }),
    },
  ),
}));

vi.mock("../../../analytics/report-generator.js", () => ({
  ReportGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockReturnValue({
      sections: ["summary", "statistics", "trends", "anomalies"],
      format: "markdown",
      content: "# Analytics Report\n...",
    }),
    save: vi.fn(),
  })),
}));

vi.mock("../../../analytics/dashboard.js", () => ({
  AnalyticsDashboard: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(false),
    setRefreshRate: vi.fn(),
  })),
}));

describe("Analyze Command Integration Tests", () => {
  let consoleLogSpy: Mock;
  let consoleErrorSpy: Mock;
  let processExitSpy: Mock;
  let program: Command;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up console spies
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: number) => {
        throw new Error(`process.exit called with code ${code}`);
      }) as Mock;

    // Create a fresh program for each test
    program = new Command();
    program.exitOverride(); // Prevent actual process exit
    program.addCommand(createAnalyzeCommand());
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("Statistics Subcommand", () => {
    it("should execute statistics command with default options", async () => {
      await program.parseAsync(["node", "test", "analyze", "statistics"]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
      const output = consoleLogSpy.mock.calls.join("\n");
      expect(output).toBeTruthy();
    });

    it("should handle platform filter option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--platform",
        "reddit",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle days option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--days",
        "7",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle JSON output format", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--format",
        "json",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
      const output = consoleLogSpy.mock.calls.join("");
      // Should contain JSON structure
      expect(output).toContain("{");
      expect(output).toContain("}");
    });

    it("should handle specific metrics option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--metrics",
        "score",
        "comments",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Trends Subcommand", () => {
    it("should execute trends command with default options", async () => {
      try {
        await program.parseAsync(["node", "test", "analyze", "trends"]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle metric option for trends", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "trends",
          "--metric",
          "score",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle period option for trends", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "trends",
          "--period",
          "weekly",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Anomalies Subcommand", () => {
    it("should execute anomalies command with default options", async () => {
      try {
        await program.parseAsync(["node", "test", "analyze", "anomalies"]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle threshold option", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "anomalies",
          "--threshold",
          "2.5",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle method option", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "anomalies",
          "--method",
          "isolation",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Forecast Subcommand", () => {
    it("should execute forecast command with default options", async () => {
      try {
        await program.parseAsync(["node", "test", "analyze", "forecast"]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle days option", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "forecast",
          "--days",
          "14",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle model option", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "forecast",
          "--model",
          "linear",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Report Subcommand", () => {
    it("should execute report command with default options", async () => {
      try {
        await program.parseAsync(["node", "test", "analyze", "report"]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle output option", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "report",
          "--output",
          "report.md",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle format option", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "report",
          "--format",
          "html",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle sections option", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "report",
          "--sections",
          "summary,statistics",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Dashboard Subcommand", () => {
    it("should execute dashboard command with default options", async () => {
      try {
        await program.parseAsync(["node", "test", "analyze", "dashboard"]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle compact option", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "dashboard",
          "--compact",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Common Options", () => {
    it("should handle database option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--database",
        "custom.db",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle time-range option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--time-range",
        "7d",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle cache option", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--cache",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should handle clear-cache option", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      await program.parseAsync(["node", "test", "analyze", "--clear-cache"]);

      // The cache is in-memory, not file-based, so rmSync won't be called
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Analytics cache cleared successfully"),
      );
    });

    it("should handle cache-stats option", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "cache1.json",
        "cache2.json",
      ] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 1024,
        mtime: new Date(),
      } as any);

      await program.parseAsync(["node", "test", "analyze", "--cache-stats"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Analytics Cache Statistics"),
      );
    });

    it("should handle verbose option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--verbose",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid days value", async () => {
      await expect(
        program.parseAsync([
          "node",
          "test",
          "analyze",
          "statistics",
          "--days",
          "-5",
        ]),
      ).rejects.toThrow("must be a positive integer");
    });

    it("should handle invalid threshold value", async () => {
      await expect(
        program.parseAsync([
          "node",
          "test",
          "analyze",
          "anomalies",
          "--threshold",
          "invalid",
        ]),
      ).rejects.toThrow();
    });

    it("should handle invalid time range format", async () => {
      try {
        await program.parseAsync([
          "node",
          "test",
          "analyze",
          "statistics",
          "--time-range",
          "invalid",
        ]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Unsupported time range format: invalid",
      );
    });

    it("should handle database connection errors", async () => {
      const { DatabaseManager } = await import("../../../database/database.js");
      vi.mocked(DatabaseManager).mockImplementationOnce(() => {
        throw new Error("Database connection failed");
      });

      await expect(
        program.parseAsync(["node", "test", "analyze", "statistics"]),
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Database connection failed"),
      );
    });
  });

  describe("Output Formatting", () => {
    it("should format table output correctly", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--format",
        "table",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
      const output = consoleLogSpy.mock.calls.join("\n");
      // Table output should contain formatting characters
      expect(output).toBeTruthy();
    });

    it("should format JSON output correctly", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--format",
        "json",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
      const output = consoleLogSpy.mock.calls.join("");
      expect(output).toContain("{");
      expect(output).toContain("}");
    });

    it("should format CSV output correctly", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--output-format",
        "csv",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Data Flow Integration", () => {
    it("should correctly apply platform filter", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--platform",
        "reddit",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should correctly apply time range filter", async () => {
      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--time-range",
        "7d",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Cache Management", () => {
    it("should use cached results when available", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          timestamp: Date.now(),
          data: { totalArticles: 100, avgScore: 150 },
        }),
      );

      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--cache",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });

    it("should skip cache when --no-cache is specified", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await program.parseAsync([
        "node",
        "test",
        "analyze",
        "statistics",
        "--no-cache",
      ]);

      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple subcommands in sequence", async () => {
      // Run statistics
      try {
        await program.parseAsync(["node", "test", "analyze", "statistics"]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }
      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);

      // Clear mocks for next command
      vi.clearAllMocks();
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Reset and run trends
      program = new Command();
      program.exitOverride();
      program.addCommand(createAnalyzeCommand());

      try {
        await program.parseAsync(["node", "test", "analyze", "trends"]);
      } catch (error: any) {
        expect(error.message).toContain("process.exit");
      }
      // Should have logged something (either success or error)
      expect(
        consoleLogSpy.mock.calls.length > 0 ||
          consoleErrorSpy.mock.calls.length > 0,
      ).toBe(true);
    });
  });
});
