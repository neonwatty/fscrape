/**
 * E2E Tests for Interactive Dashboard
 * Tests the complete interactive dashboard experience
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Database } from "../../src/database/database.js";
import { DatabaseAnalytics } from "../../src/database/analytics.js";
import { AnalyticsDashboard, InteractiveDashboard } from "../../src/analytics/dashboard.js";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { EventEmitter } from "events";

describe("E2E Interactive Dashboard", () => {
  let tempDir: string;
  let db: Database;
  let analytics: DatabaseAnalytics;
  let dashboard: AnalyticsDashboard;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fscrape-dashboard-e2e-"));
    const dbPath = join(tempDir, "test.db");

    db = new Database(dbPath);
    await db.initialize();

    // Seed test data
    await seedDashboardTestData(db);

    analytics = new DatabaseAnalytics(db);
    dashboard = new AnalyticsDashboard(analytics);
  });

  afterAll(async () => {
    await db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Dashboard Navigation", () => {
    it("should navigate through all views", async () => {
      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        dashboard,
        mockStdin as any,
        mockStdout as any
      );

      // Start dashboard
      await interactiveDashboard.start();

      // Verify initial overview screen
      expect(mockStdout.write).toHaveBeenCalled();
      const output = mockStdout.write.mock.calls.join("");
      expect(output).toContain("Analytics Dashboard");
      expect(output).toContain("Overview");

      // Navigate to platforms view
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("2"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const platformsOutput = mockStdout.write.mock.calls.join("");
      expect(platformsOutput).toContain("Platform Analytics");

      // Navigate to trending view
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("3"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const trendingOutput = mockStdout.write.mock.calls.join("");
      expect(trendingOutput).toContain("Trending Content");

      // Navigate to performance view
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("4"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const performanceOutput = mockStdout.write.mock.calls.join("");
      expect(performanceOutput).toContain("Performance Metrics");

      // Exit dashboard
      interactiveDashboard.stop();
      mockStdin.emit("data", Buffer.from("q"));

      expect((mockStdin as any).pause).toHaveBeenCalled();
    });

    it("should handle drill-down navigation", async () => {
      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        dashboard,
        mockStdin as any,
        mockStdout as any
      );

      await interactiveDashboard.start();

      // Navigate to platforms view
      mockStdin.emit("data", Buffer.from("2"));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Select a platform (Enter key)
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("\r"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const detailOutput = mockStdout.write.mock.calls.join("");
      expect(detailOutput).toContain("Platform Details");

      // Go back (Backspace)
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("\x7f"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const backOutput = mockStdout.write.mock.calls.join("");
      expect(backOutput).toContain("Platform Analytics");

      interactiveDashboard.stop();
    });

    it("should handle auto-refresh", async () => {
      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        dashboard,
        mockStdin as any,
        mockStdout as any
      );

      // Start with auto-refresh
      await interactiveDashboard.start({ autoRefresh: 100 }); // 100ms refresh

      const initialCallCount = mockStdout.write.mock.calls.length;

      // Wait for auto-refresh
      await new Promise(resolve => setTimeout(resolve, 250));

      const afterRefreshCallCount = mockStdout.write.mock.calls.length;
      expect(afterRefreshCallCount).toBeGreaterThan(initialCallCount);

      // Stop auto-refresh
      mockStdin.emit("data", Buffer.from("a"));
      await new Promise(resolve => setTimeout(resolve, 50));

      const output = mockStdout.write.mock.calls.join("");
      expect(output).toContain("Auto-refresh: OFF");

      interactiveDashboard.stop();
    });
  });

  describe("Dashboard Features", () => {
    it("should export data from dashboard", async () => {
      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        dashboard,
        mockStdin as any,
        mockStdout as any
      );

      await interactiveDashboard.start();

      // Trigger export
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("e"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const output = mockStdout.write.mock.calls.join("");
      expect(output).toContain("Data exported");

      interactiveDashboard.stop();
    });

    it("should handle search functionality", async () => {
      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        dashboard,
        mockStdin as any,
        mockStdout as any
      );

      await interactiveDashboard.start();

      // Navigate to trending view
      mockStdin.emit("data", Buffer.from("3"));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger search
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("/"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const output = mockStdout.write.mock.calls.join("");
      expect(output).toContain("Search:");

      interactiveDashboard.stop();
    });

    it("should display help menu", async () => {
      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        dashboard,
        mockStdin as any,
        mockStdout as any
      );

      await interactiveDashboard.start();

      // Show help
      mockStdout.write.mockClear();
      mockStdin.emit("data", Buffer.from("h"));

      await new Promise(resolve => setTimeout(resolve, 50));
      const output = mockStdout.write.mock.calls.join("");
      expect(output).toContain("Help");
      expect(output).toContain("Navigation");
      expect(output).toContain("q - Quit");

      interactiveDashboard.stop();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid input gracefully", async () => {
      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        dashboard,
        mockStdin as any,
        mockStdout as any
      );

      await interactiveDashboard.start();

      // Send invalid input
      const initialCallCount = mockStdout.write.mock.calls.length;
      mockStdin.emit("data", Buffer.from("xyz"));

      await new Promise(resolve => setTimeout(resolve, 50));

      // Dashboard should still be running
      mockStdin.emit("data", Buffer.from("1"));
      await new Promise(resolve => setTimeout(resolve, 50));

      const afterCallCount = mockStdout.write.mock.calls.length;
      expect(afterCallCount).toBeGreaterThan(initialCallCount);

      interactiveDashboard.stop();
    });

    it("should recover from data fetch errors", async () => {
      const mockAnalytics = {
        getPlatformStats: vi.fn().mockImplementation(() => {
          throw new Error("Database error");
        }),
        getTrendingPosts: vi.fn().mockReturnValue([]),
        getPostsByDateRange: vi.fn().mockReturnValue([]),
        getTimeSeriesData: vi.fn().mockReturnValue([]),
        getUserStats: vi.fn().mockReturnValue(null),
        getTopUsers: vi.fn().mockReturnValue([]),
        getScrapingPerformance: vi.fn().mockReturnValue(null),
        getDatabaseHealth: vi.fn().mockReturnValue({
          totalSize: 0,
          tableStats: [],
        }),
        getDatabaseHealthDetailed: vi.fn().mockReturnValue({
          totalSize: 0,
          tableStats: [],
          indexUsage: {},
          vacuumNeeded: false,
        }),
        getDataGaps: vi.fn().mockReturnValue([]),
      };

      const errorDashboard = new AnalyticsDashboard(mockAnalytics as any);

      const mockStdout = {
        write: vi.fn(),
        cursorTo: vi.fn(),
        clearLine: vi.fn(),
        clearScreenDown: vi.fn(),
      };

      const mockStdin = new EventEmitter();
      (mockStdin as any).setRawMode = vi.fn();
      (mockStdin as any).resume = vi.fn();
      (mockStdin as any).pause = vi.fn();

      const interactiveDashboard = new InteractiveDashboard(
        errorDashboard,
        mockStdin as any,
        mockStdout as any
      );

      await interactiveDashboard.start();

      // Should display error message but not crash
      const output = mockStdout.write.mock.calls.join("");
      expect(output).toContain("Analytics Dashboard");

      interactiveDashboard.stop();
    });
  });
});

/**
 * Seed test data for dashboard E2E tests
 */
async function seedDashboardTestData(db: Database): Promise<void> {
  // Add users
  const users = ["alice", "bob", "charlie", "david", "eve"];
  for (const username of users) {
    await db.run(
      `INSERT OR IGNORE INTO users (username, karma, created_at, platform)
       VALUES (?, ?, ?, ?)`,
      [username, Math.floor(Math.random() * 5000), new Date().toISOString(), "reddit"]
    );
  }

  // Add posts
  const now = Date.now();
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    await db.run(
      `INSERT OR IGNORE INTO posts (id, platform, title, url, author, score, comment_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `dashboard-post-${i}`,
        i % 2 === 0 ? "reddit" : "hackernews",
        `Dashboard Test Post ${i}`,
        `http://example.com/dashboard/${i}`,
        users[i % users.length],
        Math.floor(Math.random() * 500),
        Math.floor(Math.random() * 50),
        createdAt.toISOString(),
      ]
    );

    // Add comments
    for (let j = 0; j < 3; j++) {
      await db.run(
        `INSERT OR IGNORE INTO comments (id, post_id, parent_id, author, content, score, created_at, platform)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `dashboard-comment-${i}-${j}`,
          `dashboard-post-${i}`,
          null,
          users[j % users.length],
          `Test comment ${j}`,
          Math.floor(Math.random() * 50),
          createdAt.toISOString(),
          i % 2 === 0 ? "reddit" : "hackernews",
        ]
      );
    }
  }
}