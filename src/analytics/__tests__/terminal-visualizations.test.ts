/**
 * Tests for enhanced terminal visualizations
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AnalyticsVisualizer } from "../visualizer.js";

describe("Terminal Visualizations", () => {
  let visualizer: AnalyticsVisualizer;

  beforeEach(() => {
    visualizer = new AnalyticsVisualizer();
  });

  describe("Trend Indicators", () => {
    it("should create trend indicator with up arrow for positive change", () => {
      const indicator = visualizer.createTrendIndicator(150, 100, "Revenue");

      expect(indicator).toContain("Revenue");
      expect(indicator).toContain("↑");
      expect(indicator).toContain("UP");
      expect(indicator).toContain("+50.00");
      expect(indicator).toContain("+50.0%");
    });

    it("should create trend indicator with down arrow for negative change", () => {
      const indicator = visualizer.createTrendIndicator(80, 100, "Sales");

      expect(indicator).toContain("↓");
      expect(indicator).toContain("DOWN");
      expect(indicator).toContain("-20.00");
      expect(indicator).toContain("-20.0%");
    });

    it("should create trend indicator with stable arrow for no change", () => {
      const indicator = visualizer.createTrendIndicator(100, 100);

      expect(indicator).toContain("→");
      expect(indicator).toContain("STABLE");
      expect(indicator).toContain("+0.00");
      expect(indicator).toContain("+0.0%");
    });

    it("should show detailed visualization when style is detailed", () => {
      const indicator = visualizer.createTrendIndicator(150, 100, "Growth", {
        style: "detailed",
      });

      expect(indicator).toContain("↑↑↑");
      expect(indicator).toContain("["); // Progress bar
      expect(indicator).toContain("▲"); // Up triangles
    });

    it("should handle zero previous value", () => {
      const indicator = visualizer.createTrendIndicator(100, 0, "New Metric");

      expect(indicator).toContain("↑");
      expect(indicator).toContain("UP");
      expect(indicator).not.toContain("Infinity");
    });
  });

  describe("Statistical Summary", () => {
    it("should create statistical summary with all metrics", () => {
      const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const summary = visualizer.createStatisticalSummary(data, "Test Stats");

      expect(summary).toContain("Test Stats");
      expect(summary).toContain("Count:");
      expect(summary).toContain("Mean:");
      expect(summary).toContain("Median:");
      expect(summary).toContain("Std Dev:");
      expect(summary).toContain("Min:");
      expect(summary).toContain("Max:");
      expect(summary).toContain("Q1:");
      expect(summary).toContain("Q3:");
      expect(summary).toContain("IQR:");
    });

    it("should show distribution box plot when not minimal", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const summary = visualizer.createStatisticalSummary(
        data,
        "Distribution",
        {
          style: "simple",
        },
      );

      expect(summary).toContain("Distribution:");
      expect(summary).toContain("├"); // Box plot start
      expect(summary).toContain("┤"); // Box plot end
      expect(summary).toContain("█"); // Box fill
    });

    it("should include sparkline in detailed mode", () => {
      const data = [5, 10, 15, 20, 25, 30];
      const summary = visualizer.createStatisticalSummary(data, "Trend", {
        style: "detailed",
      });

      expect(summary).toContain("Trend:");
      expect(summary).toMatch(/[▁▂▃▄▅▆▇█]+/); // Sparkline characters
    });

    it("should handle empty data", () => {
      const summary = visualizer.createStatisticalSummary([]);

      expect(summary).toBe("No data available for statistical summary");
    });

    it("should calculate statistics correctly", () => {
      const data = [10, 20, 30, 40, 50];
      const summary = visualizer.createStatisticalSummary(data);

      expect(summary).toContain("30.00"); // Mean
      expect(summary).toContain("10.00"); // Min
      expect(summary).toContain("50.00"); // Max
    });
  });

  describe("Enhanced Progress Bar", () => {
    it("should create enhanced progress bar with label", () => {
      const bar = visualizer.createEnhancedProgressBar(75, 100, "Progress");

      expect(bar).toContain("Progress");
      expect(bar).toContain("[");
      expect(bar).toContain("]");
      expect(bar).toContain("75.0%");
      expect(bar).toContain("█"); // Filled portion
      expect(bar).toContain("░"); // Empty portion
    });

    it("should show value when configured", () => {
      const bar = visualizer.createEnhancedProgressBar(50, 200, "Items", {
        showValue: true,
      });

      expect(bar).toContain("(50/200)");
    });

    it("should use different fill characters based on percentage", () => {
      const bar1 = visualizer.createEnhancedProgressBar(20, 100, "Low", {
        style: "detailed",
      });
      const bar2 = visualizer.createEnhancedProgressBar(50, 100, "Medium", {
        style: "detailed",
      });
      const bar3 = visualizer.createEnhancedProgressBar(80, 100, "High", {
        style: "detailed",
      });

      expect(bar1).toContain("▓"); // Low percentage
      expect(bar2).toContain("▆"); // Medium percentage
      expect(bar3).toContain("█"); // High percentage
    });

    it("should apply thresholds", () => {
      const bar = visualizer.createEnhancedProgressBar(85, 100, "Score", {
        thresholds: [
          { value: 80, label: "Excellent" },
          { value: 60, label: "Good" },
          { value: 40, label: "Fair" },
        ],
      });

      expect(bar).toContain("Excellent");
    });

    it("should handle overflow gracefully", () => {
      const bar = visualizer.createEnhancedProgressBar(150, 100, "Overflow");

      expect(bar).toContain("100.0%");
    });
  });

  describe("Mini Dashboard", () => {
    it("should create mini dashboard with all components", () => {
      const dashboard = visualizer.createMiniDashboard({
        title: "Analytics Dashboard",
        metrics: [
          { label: "Users", value: 1000, change: 5.2 },
          { label: "Revenue", value: 50000, change: -2.1 },
        ],
        chart: [{ value: 10 }, { value: 20 }, { value: 15 }, { value: 25 }],
        distribution: [10, 20, 30, 40, 50],
      });

      expect(dashboard).toContain("Analytics Dashboard");
      expect(dashboard).toContain("╔"); // Top border
      expect(dashboard).toContain("╗");
      expect(dashboard).toContain("╚"); // Bottom border
      expect(dashboard).toContain("╝");
      expect(dashboard).toContain("Metrics:");
      expect(dashboard).toContain("Users");
      expect(dashboard).toContain("Revenue");
      expect(dashboard).toContain("↑"); // Up arrow for positive change
      expect(dashboard).toContain("↓"); // Down arrow for negative change
      expect(dashboard).toContain("Trend:");
      expect(dashboard).toContain("Distribution:");
      expect(dashboard).toContain("Mean:");
      expect(dashboard).toContain("Median:");
    });

    it("should handle missing sections gracefully", () => {
      const dashboard = visualizer.createMiniDashboard({
        title: "Simple Dashboard",
        metrics: [{ label: "Count", value: 42 }],
      });

      expect(dashboard).toContain("Simple Dashboard");
      expect(dashboard).toContain("Count");
      expect(dashboard).not.toContain("Trend:");
      expect(dashboard).not.toContain("Distribution:");
    });

    it("should show stable arrow for zero change", () => {
      const dashboard = visualizer.createMiniDashboard({
        metrics: [{ label: "Stable", value: 100, change: 0 }],
      });

      expect(dashboard).toContain("→"); // Stable arrow
    });
  });

  describe("Colored Output", () => {
    it("should add ANSI color codes based on thresholds", () => {
      const thresholds = [
        { min: 0, max: 33, color: "red" as const },
        { min: 34, max: 66, color: "yellow" as const },
        { min: 67, max: 100, color: "green" as const },
      ];

      const red = visualizer.createColoredOutput("Low Score", 20, thresholds);
      const yellow = visualizer.createColoredOutput(
        "Medium Score",
        50,
        thresholds,
      );
      const green = visualizer.createColoredOutput(
        "High Score",
        80,
        thresholds,
      );

      expect(red).toContain("\x1b[31m"); // Red color code
      expect(red).toContain("\x1b[0m"); // Reset code
      expect(yellow).toContain("\x1b[33m"); // Yellow color code
      expect(green).toContain("\x1b[32m"); // Green color code
    });

    it("should return plain text when no threshold matches", () => {
      const thresholds = [{ min: 50, max: 100, color: "green" as const }];
      const output = visualizer.createColoredOutput("Test", 25, thresholds);

      expect(output).toBe("Test");
      expect(output).not.toContain("\x1b[");
    });
  });

  describe("Responsive Sparkline", () => {
    it("should respect max width parameter", () => {
      const data = Array.from({ length: 100 }, (_, i) => i);
      const sparkline = visualizer.createSparkline(data, 20);

      expect(sparkline.length).toBeLessThanOrEqual(20);
    });

    it("should handle data shorter than max width", () => {
      const data = [1, 2, 3, 4, 5];
      const sparkline = visualizer.createSparkline(data, 10);

      expect(sparkline.length).toBe(5);
    });

    it("should sample data correctly when too wide", () => {
      const data = Array.from({ length: 50 }, (_, i) => i % 10);
      const sparkline = visualizer.createSparkline(data, 10);

      expect(sparkline.length).toBeLessThanOrEqual(10);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]+/);
    });
  });
});
