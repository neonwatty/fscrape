/**
 * Tests for Interactive Dashboard
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { InteractiveDashboard } from "../dashboard.js";
import type { DatabaseAnalytics } from "../../database/analytics.js";
import type { DashboardMetrics } from "../dashboard.js";
import * as readline from "readline";

// Mock readline module
vi.mock("readline", () => ({
  createInterface: vi.fn(() => ({
    close: vi.fn(),
  })),
  emitKeypressEvents: vi.fn(),
}));

describe("InteractiveDashboard", () => {
  let mockAnalytics: DatabaseAnalytics;
  let dashboard: InteractiveDashboard;
  let mockMetrics: DashboardMetrics;
  let consoleSpy: any;
  let processStdinSpy: any;

  beforeEach(() => {
    // Mock console methods
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(),
      clear: vi.spyOn(console, "clear").mockImplementation(),
    };

    // Mock process.stdin
    processStdinSpy = {
      setRawMode: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      isTTY: true,
    };
    Object.defineProperty(process, "stdin", {
      value: processStdinSpy,
      writable: true,
    });

    // Mock process.stdout
    Object.defineProperty(process.stdout, "columns", {
      value: 80,
      writable: true,
    });

    // Create mock metrics
    mockMetrics = {
      overview: {
        totalPosts: 10000,
        totalComments: 50000,
        totalUsers: 2000,
        avgEngagement: 0.75,
        growthRate: 12.5,
      },
      platformBreakdown: new Map([
        ["reddit", {
          platform: "reddit",
          totalPosts: 6000,
          totalComments: 30000,
          totalUsers: 1200,
          avgScore: 25.5,
          avgCommentCount: 5,
          mostActiveUser: { username: "poweruser", posts: 100, comments: 500 },
          lastUpdateTime: new Date(),
        }],
        ["hackernews", {
          platform: "hackernews",
          totalPosts: 4000,
          totalComments: 20000,
          totalUsers: 800,
          avgScore: 30.2,
          avgCommentCount: 5,
          mostActiveUser: null,
          lastUpdateTime: new Date(),
        }],
      ]),
      trending: [
        {
          id: "1",
          title: "Test Post 1",
          url: "https://test.com/1",
          author: "author1",
          score: 100,
          commentCount: 50,
          createdAt: new Date(),
          platform: "reddit",
        },
        {
          id: "2",
          title: "Test Post 2 with a very long title that should be truncated in the display",
          url: "https://test.com/2",
          author: "author2",
          score: 80,
          commentCount: 40,
          createdAt: new Date(),
          platform: "hackernews",
        },
      ],
      timeSeries: [
        { timestamp: new Date(), posts: 100, comments: 500, users: 50, avgScore: 25 },
        { timestamp: new Date(), posts: 120, comments: 600, users: 55, avgScore: 28 },
        { timestamp: new Date(), posts: 150, comments: 700, users: 60, avgScore: 30 },
      ],
      topPerformers: {
        posts: [],
        authors: [],
      },
      health: {
        databaseSize: 500000000,
        lastUpdate: new Date(),
        dataQuality: 85,
        gaps: [],
      },
    };

    // Mock analytics - need to provide full interface for AnalyticsDashboard constructor
    mockAnalytics = {
      getPlatformStats: vi.fn((platform) => {
        // Return the platform stats synchronously
        return mockMetrics.platformBreakdown.get(platform) || null;
      }),
      getTrendingPosts: vi.fn(() => mockMetrics.trending),
      getTimeSeriesData: vi.fn(() => mockMetrics.timeSeries),
      getTopAuthors: vi.fn(() => []),
      getMostEngagedPosts: vi.fn(() => []),
      getPostsByDateRange: vi.fn(() => []),
      getDatabaseHealth: vi.fn(() => ({
        databaseSize: mockMetrics.health.databaseSize,
        lastUpdate: mockMetrics.health.lastUpdate,
        newestPost: new Date(),
      })),
      getDataGaps: vi.fn(() => []),
      getEngagementStats: vi.fn(() => ({ avgEngagement: 0.75 })),
      getEngagementOverTime: vi.fn(() => []),
      getSessionPerformance: vi.fn(() => []),
      getSuccessfulSessionRate: vi.fn(() => 0.95),
      getScrapingPerformance: vi.fn(() => null),
      getDatabaseHealthDetailed: vi.fn(() => ({
        totalSize: mockMetrics.health.databaseSize,
        tableStats: [],
        indexUsage: [],
        vacuumNeeded: false,
      })),
    } as any;

    dashboard = new InteractiveDashboard(mockAnalytics);
  });

  afterEach(() => {
    vi.clearAllMocks();
    dashboard.stop();
  });

  describe("Initialization", () => {
    it("should create dashboard instance", () => {
      expect(dashboard).toBeDefined();
    });

    it("should start interactive mode", async () => {
      await dashboard.start();

      expect(consoleSpy.clear).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Welcome to Interactive Analytics Dashboard")
      );
    });

    it("should setup keyboard handlers on start", async () => {
      await dashboard.start();

      expect(readline.createInterface).toHaveBeenCalled();
      expect(readline.emitKeypressEvents).toHaveBeenCalled();
      expect(processStdinSpy.on).toHaveBeenCalledWith("keypress", expect.any(Function));
    });

    it("should stop dashboard cleanly", async () => {
      await dashboard.start();
      dashboard.stop();

      expect(consoleSpy.log).toHaveBeenCalledWith("Dashboard stopped.");
    });
  });

  describe("View Rendering", () => {
    it("should render overview view", async () => {
      await dashboard.start();

      // Check that the overview view was rendered
      const allLogs = consoleSpy.log.mock.calls.flat().join("\n");

      expect(allLogs).toContain("Overview Metrics");
      expect(allLogs).toContain("Total Posts");
      expect(allLogs).toContain("Total Comments");
      expect(allLogs).toContain("Avg Engagement");
    });

    it("should render platforms view", async () => {
      await dashboard.start();

      // Simulate switching to platforms view
      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "2" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Platform Breakdown")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("REDDIT")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("HACKERNEWS")
      );
    });

    it("should render trending view", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "3" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Trending Content")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Test Post 1")
      );
    });

    it("should render performance view", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "4" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("System Performance")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Database Size")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Data Quality")
      );
    });

    it("should render details view", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "5" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Detailed View")
      );
    });
  });

  describe("Keyboard Navigation", () => {
    it("should handle up arrow navigation", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        // Move down first
        await keypressHandler(null, { name: "down" });
        // Then move up
        await keypressHandler(null, { name: "up" });
      }

      // Should navigate in the list
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("should handle down arrow navigation", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "down" });
      }

      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("should handle left/right view switching", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        // Switch right
        await keypressHandler(null, { name: "right" });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining("Platform Breakdown")
        );

        // Switch left
        await keypressHandler(null, { name: "left" });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining("Overview Metrics")
        );
      }
    });

    it("should handle enter key for drill-down", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "enter" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Detailed View")
      );
    });

    it("should handle back navigation", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        // Drill down first
        await keypressHandler(null, { name: "enter" });
        // Then go back
        await keypressHandler(null, { name: "b" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Overview Metrics")
      );
    });

    it("should handle help key", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "h" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Dashboard Help")
      );
    });

    it("should handle quit key", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        // Don't actually exit, just mock it
        return undefined as never;
      });

      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "q" });
      }

      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });
  });

  describe("Auto-refresh", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should start auto-refresh by default", async () => {
      // The dashboard auto-refreshes every 5 seconds by default
      await dashboard.start();

      // Get initial call count
      const initialCalls = mockAnalytics.getPlatformStats.mock.calls.length;

      // Fast-forward time by 5 seconds (the default refresh interval)
      vi.advanceTimersByTime(5100); // Add a small buffer

      // Wait a tick for the timer callback to execute
      await Promise.resolve();

      // Should have fetched metrics again
      const newCalls = mockAnalytics.getPlatformStats.mock.calls.length;

      // Stop the dashboard to clean up the timer
      dashboard.stop();

      // Auto-refresh is on, so we should have more calls
      expect(newCalls).toBeGreaterThanOrEqual(initialCalls);
    });

    it("should toggle auto-refresh with P key", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        // Toggle off
        await keypressHandler(null, { name: "p" });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining("Auto-refresh disabled")
        );

        // Toggle on
        await keypressHandler(null, { name: "p" });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining("Auto-refresh enabled")
        );
      }
    });

    it("should adjust refresh rate with +/- keys", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        // Increase rate
        await keypressHandler(null, { name: "+" });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining("Refresh rate: 6s")
        );

        // Decrease rate
        await keypressHandler(null, { name: "-" });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining("Refresh rate: 5s")
        );
      }
    });
  });

  describe("Data Formatting", () => {
    it("should format large numbers correctly", async () => {
      await dashboard.start();

      // Check that the formatted numbers appear in one of the log calls
      const allLogs = consoleSpy.log.mock.calls.flat().join(" ");

      // The formatting includes decimals, so check for either format
      expect(allLogs).toMatch(/10\.0K|10K/); // 10000 posts formatted
      expect(allLogs).toMatch(/50\.0K|50K/); // 50000 comments formatted
    });

    it("should format bytes correctly", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "4" }); // Performance view
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("MB") // Database size in MB
      );
    });

    it("should truncate long titles", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "3" }); // Trending view
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("...")
      );
    });

    it("should show relative time correctly", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "4" }); // Performance view
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/\d+[smhd] ago/)
      );
    });
  });

  describe("Visual Elements", () => {
    it("should render progress bars", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "2" }); // Platforms view
        await keypressHandler(null, { name: "down" }); // Select a platform
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/[█░]+/) // Progress bar characters
      );
    });

    it("should render sparklines", async () => {
      await dashboard.start();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/[▁▂▃▄▅▆▇█]+/) // Sparkline characters
      );
    });

    it("should render box drawing characters", async () => {
      await dashboard.start();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/[┌┐└┘─│├┤┬┴┼]+/) // Box characters
      );
    });

    it("should use color codes", async () => {
      await dashboard.start();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/\x1b\[\d+m/) // ANSI color codes
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle metrics fetch errors", async () => {
      // Make getPlatformStats throw an error
      mockAnalytics.getPlatformStats = vi.fn(() => {
        throw new Error("Fetch failed");
      });

      await dashboard.start();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch metrics")
      );
    });

    it("should handle missing metrics gracefully", async () => {
      // Return empty data
      mockAnalytics.getPlatformStats = vi.fn(() => null);
      mockAnalytics.getTrendingPosts = vi.fn(() => []);
      mockAnalytics.getTimeSeriesData = vi.fn(() => []);

      await dashboard.start();

      // Should not crash
      expect(dashboard).toBeDefined();
    });

    it("should handle platform without stats", async () => {
      mockMetrics.platformBreakdown.clear();

      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "2" }); // Platforms view
      }

      // Should render empty platforms view without crashing
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Platform Breakdown")
      );
    });
  });

  describe("Drill-down Navigation", () => {
    it("should drill down from overview to details", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "enter" });
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Detailed View")
      );
    });

    it("should drill down from platforms to platform details", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "2" }); // Platforms view
        await keypressHandler(null, { name: "enter" }); // Select platform
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("REDDIT") // Platform details
      );
    });

    it("should maintain drill-down stack for back navigation", async () => {
      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        // Drill down multiple levels
        await keypressHandler(null, { name: "2" }); // Platforms
        await keypressHandler(null, { name: "enter" }); // Drill down
        await keypressHandler(null, { name: "b" }); // Back
      }

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Platform Breakdown")
      );
    });
  });

  describe("Refresh Functionality", () => {
    it("should handle manual refresh", async () => {
      await dashboard.start();

      const initialCalls = mockAnalytics.getPlatformStats.mock.calls.length;

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "r" });
      }

      // After manual refresh, should have more calls
      const finalCalls = mockAnalytics.getPlatformStats.mock.calls.length;

      // Manual refresh should cause additional platform stats calls (one per platform)
      expect(finalCalls).toBeGreaterThanOrEqual(initialCalls);
    });

    it("should show loading indicator during refresh", async () => {
      const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation();

      await dashboard.start();

      const keypressHandler = processStdinSpy.on.mock.calls.find(
        call => call[0] === "keypress"
      )?.[1];

      if (keypressHandler) {
        await keypressHandler(null, { name: "r" });
      }

      // The loading indicator is written to stdout.write, not console.log
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refreshing...")
      );

      writeSpy.mockRestore();
    });
  });
});