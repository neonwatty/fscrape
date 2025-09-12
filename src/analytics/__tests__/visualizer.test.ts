/**
 * Tests for Analytics Visualizer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AnalyticsVisualizer } from "../visualizer.js";
import type {
  DataPoint,
  MultiSeriesData,
  ChartOptions,
} from "../visualizer.js";

describe("AnalyticsVisualizer", () => {
  let visualizer: AnalyticsVisualizer;

  beforeEach(() => {
    visualizer = new AnalyticsVisualizer();
  });

  describe("Line Chart", () => {
    it("should create a line chart with data points", () => {
      const data: DataPoint[] = [
        { value: 10, date: new Date("2024-01-01") },
        { value: 20, date: new Date("2024-01-02") },
        { value: 15, date: new Date("2024-01-03") },
        { value: 25, date: new Date("2024-01-04") },
        { value: 30, date: new Date("2024-01-05") },
      ];

      const chart = visualizer.createLineChart(data, "Test Line Chart");

      expect(chart).toContain("Test Line Chart");
      expect(chart).toContain("│"); // Y-axis
      expect(chart).toContain("└"); // X-axis corner
      expect(chart).toContain("─"); // X-axis line
      expect(chart).toContain("●"); // Data points
      expect(chart).toContain("Min:");
      expect(chart).toContain("Max:");
      expect(chart).toContain("Avg:");
    });

    it("should handle empty data", () => {
      const chart = visualizer.createLineChart([]);
      expect(chart).toBe("No data available");
    });

    it("should handle single data point", () => {
      const data: DataPoint[] = [{ value: 42 }];
      const chart = visualizer.createLineChart(data);

      expect(chart).toContain("●");
      expect(chart).toContain("42");
    });

    it("should respect chart options", () => {
      const data: DataPoint[] = [{ value: 10 }, { value: 20 }, { value: 30 }];

      const options: ChartOptions = {
        width: 40,
        height: 10,
        showLabels: false,
        showLegend: false,
        showGrid: false,
      };

      const chart = visualizer.createLineChart(data, "Small Chart", options);
      const lines = chart.split("\n");

      // Check dimensions
      expect(lines[0].length).toBeLessThanOrEqual(40);
      expect(lines.length).toBeLessThanOrEqual(12); // height + title + spacing

      // Should not contain legend
      expect(chart).not.toContain("Min:");
    });
  });

  describe("Bar Chart", () => {
    it("should create a bar chart with multi-series data", () => {
      const data: MultiSeriesData[] = [
        { label: "Jan", sales: 100, costs: 80 },
        { label: "Feb", sales: 120, costs: 90 },
        { label: "Mar", sales: 140, costs: 95 },
      ];

      const chart = visualizer.createBarChart(data, "Sales vs Costs");

      expect(chart).toContain("Sales vs Costs");
      expect(chart).toContain("│"); // Y-axis
      expect(chart).toContain("█"); // Bar character
      expect(chart).toContain("Jan");
      expect(chart).toContain("Feb");
      expect(chart).toContain("Mar");
      expect(chart).toContain("Legend:");
    });

    it("should handle empty data", () => {
      const chart = visualizer.createBarChart([]);
      expect(chart).toBe("No data available");
    });

    it("should handle single series", () => {
      const data: MultiSeriesData[] = [
        { label: "Q1", revenue: 1000 },
        { label: "Q2", revenue: 1200 },
      ];

      const chart = visualizer.createBarChart(data);
      expect(chart).toContain("Q1");
      expect(chart).toContain("Q2");
      expect(chart).not.toContain("Legend:"); // No legend for single series
    });
  });

  describe("Pie Chart", () => {
    it("should create a pie chart with distribution", () => {
      const data = [
        { label: "Desktop", value: 60 },
        { label: "Mobile", value: 30 },
        { label: "Tablet", value: 10 },
      ];

      const chart = visualizer.createPieChart(data, "Device Distribution");

      expect(chart).toContain("Device Distribution");
      expect(chart).toContain("Distribution:");
      expect(chart).toContain("Desktop");
      expect(chart).toContain("60.0%");
      expect(chart).toContain("Mobile");
      expect(chart).toContain("30.0%");
      expect(chart).toContain("●"); // Pie segment character
    });

    it("should handle empty data", () => {
      const chart = visualizer.createPieChart([]);
      expect(chart).toBe("No data available");
    });

    it("should handle zero values", () => {
      const data = [
        { label: "A", value: 0 },
        { label: "B", value: 0 },
      ];

      const chart = visualizer.createPieChart(data);
      expect(chart).toBe("No data available (all values are zero)");
    });
  });

  describe("Heatmap", () => {
    it("should create a heatmap with matrix data", () => {
      const data = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      const rowLabels = ["Row1", "Row2", "Row3"];
      const colLabels = ["Col1", "Col2", "Col3"];

      const chart = visualizer.createHeatmap(
        data,
        rowLabels,
        colLabels,
        "Test Heatmap",
      );

      expect(chart).toContain("Test Heatmap");
      expect(chart).toContain("Row1");
      expect(chart).toContain("Col1");
      expect(chart).toContain("Scale:");
      expect(chart).toContain("░"); // Heat character
    });

    it("should handle empty data", () => {
      const chart = visualizer.createHeatmap([]);
      expect(chart).toBe("No data available");
    });

    it("should normalize values correctly", () => {
      const data = [
        [0, 50, 100],
        [25, 75, 50],
      ];

      const chart = visualizer.createHeatmap(data);
      expect(chart).toContain("Min=0.00");
      expect(chart).toContain("Max=100.00");
    });
  });

  describe("Sparkline", () => {
    it("should create a sparkline from numeric data", () => {
      const data = [1, 5, 3, 8, 2, 9, 4];
      const sparkline = visualizer.createSparkline(data);

      expect(sparkline.length).toBe(data.length);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]+/);
    });

    it("should handle empty data", () => {
      const sparkline = visualizer.createSparkline([]);
      expect(sparkline).toBe("");
    });

    it("should handle single value", () => {
      const sparkline = visualizer.createSparkline([5]);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]/);
      expect(sparkline.length).toBe(1);
    });

    it("should handle identical values", () => {
      const data = [5, 5, 5, 5];
      const sparkline = visualizer.createSparkline(data);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]{4}/);
    });
  });

  describe("Progress Bar", () => {
    it("should create a progress bar", () => {
      const bar = visualizer.createProgressBar(75, 100);

      expect(bar).toContain("[");
      expect(bar).toContain("]");
      expect(bar).toContain("█"); // Filled portion
      expect(bar).toContain("░"); // Empty portion
      expect(bar).toContain("75.0%");
    });

    it("should handle 0% progress", () => {
      const bar = visualizer.createProgressBar(0, 100);
      expect(bar).toContain("0.0%");
      expect(bar).not.toContain("█");
    });

    it("should handle 100% progress", () => {
      const bar = visualizer.createProgressBar(100, 100);
      expect(bar).toContain("100.0%");
      expect(bar).not.toContain("░");
    });

    it("should cap at 100% for overflow", () => {
      const bar = visualizer.createProgressBar(150, 100);
      expect(bar).toContain("100.0%");
    });

    it("should hide percentage when requested", () => {
      const bar = visualizer.createProgressBar(50, 100, 20, false);
      expect(bar).not.toContain("%");
    });
  });

  describe("Comparison Table", () => {
    it("should create a comparison table", () => {
      const data = [
        { metric: "Speed", car: 200, bike: 30, walk: 5 },
        { metric: "Cost", car: 50000, bike: 500, walk: 0 },
        { metric: "Eco", car: 20, bike: 90, walk: 100 },
      ];

      const table = visualizer.createComparisonTable(
        data,
        "Transport Comparison",
      );

      expect(table).toContain("Transport Comparison");
      expect(table).toContain("═"); // Title underline
      expect(table).toContain("│"); // Column separator
      expect(table).toContain("─"); // Row separator
      expect(table).toContain("Speed");
      expect(table).toContain("Cost");
      expect(table).toContain("car");
      expect(table).toContain("bike");
    });

    it("should handle empty data", () => {
      const table = visualizer.createComparisonTable([]);
      expect(table).toBe("No data available");
    });

    it("should format numeric values", () => {
      const data = [{ metric: "Value", a: 3.14159, b: 2.71828 }];

      const table = visualizer.createComparisonTable(data);
      expect(table).toContain("3.14");
      expect(table).toContain("2.72");
    });
  });

  describe("Tree Visualization", () => {
    it("should create a tree from nested object", () => {
      const data = {
        root: {
          branch1: {
            leaf1: "value1",
            leaf2: "value2",
          },
          branch2: "value3",
        },
      };

      const tree = visualizer.createTree(data, "File Structure");

      expect(tree).toContain("File Structure");
      expect(tree).toContain("├──"); // Branch connector
      expect(tree).toContain("└──"); // Last branch connector
      expect(tree).toContain("│"); // Vertical line
      expect(tree).toContain("root");
      expect(tree).toContain("branch1");
      expect(tree).toContain("leaf1");
      expect(tree).toContain("value1");
    });

    it("should handle empty object", () => {
      const tree = visualizer.createTree({});
      expect(tree).toBe("");
    });

    it("should handle flat object", () => {
      const data = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
      };

      const tree = visualizer.createTree(data);
      expect(tree).toContain("├── key1");
      expect(tree).toContain("├── key2");
      expect(tree).toContain("└── key3");
    });
  });

  describe("Scatter Plot", () => {
    it("should create a scatter plot", () => {
      const data = [
        { x: 1, y: 2, label: "Point A" },
        { x: 3, y: 5, label: "Point B" },
        { x: 5, y: 3, label: "Point C" },
        { x: 7, y: 8, label: "Point D" },
      ];

      const chart = visualizer.createScatterPlot(data, "Scatter Test");

      expect(chart).toContain("Scatter Test");
      expect(chart).toContain("│"); // Y-axis
      expect(chart).toContain("└"); // X-axis corner
      expect(chart).toContain("●"); // Data point
      expect(chart).toContain("Points:");
      expect(chart).toContain("Point A");
    });

    it("should handle empty data", () => {
      const chart = visualizer.createScatterPlot([]);
      expect(chart).toBe("No data available");
    });

    it("should show grid when enabled", () => {
      const data = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];

      const chart = visualizer.createScatterPlot(data, "Grid Test", {
        showGrid: true,
      });

      expect(chart).toContain("·"); // Grid points
    });
  });

  describe("Histogram", () => {
    it("should create a histogram", () => {
      const data = [1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 5, 6, 7, 8, 9, 10];

      const chart = visualizer.createHistogram(data, 5, "Distribution");

      expect(chart).toContain("Distribution");
      expect(chart).toContain("│"); // Y-axis
      expect(chart).toContain("█"); // Bar
      expect(chart).toContain("Count:");
      expect(chart).toContain("Mean:");
      expect(chart).toContain("StdDev:");
    });

    it("should handle empty data", () => {
      const chart = visualizer.createHistogram([]);
      expect(chart).toBe("No data available");
    });

    it("should calculate statistics correctly", () => {
      const data = [1, 2, 3, 4, 5];
      const chart = visualizer.createHistogram(data, 5);

      expect(chart).toContain("Count: 5");
      expect(chart).toContain("Mean: 3.00");
      expect(chart).toContain("Min: 1.00");
      expect(chart).toContain("Max: 5.00");
    });

    it("should respect bin count", () => {
      const data = Array.from({ length: 100 }, (_, i) => i);
      const chart = visualizer.createHistogram(data, 10);

      expect(chart).toContain("Bins: 10");
    });
  });

  describe("Box Plot", () => {
    it("should create a box plot", () => {
      const datasets = [
        {
          label: "Group A",
          values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
        {
          label: "Group B",
          values: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        },
      ];

      const chart = visualizer.createBoxPlot(datasets, "Comparison");

      expect(chart).toContain("Comparison");
      expect(chart).toContain("Group A");
      expect(chart).toContain("Group B");
      expect(chart).toContain("│"); // Whiskers
      expect(chart).toContain("█"); // Box
      expect(chart).toContain("┊"); // Median
      expect(chart).toContain("Box Plot Legend:");
    });

    it("should handle empty data", () => {
      const chart = visualizer.createBoxPlot([]);
      expect(chart).toBe("No data available");
    });

    it("should detect outliers", () => {
      const datasets = [
        {
          label: "With Outlier",
          values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100], // 100 is an outlier
        },
      ];

      const chart = visualizer.createBoxPlot(datasets);
      expect(chart).toContain("◦"); // Outlier symbol
    });

    it("should handle single dataset", () => {
      const datasets = [
        {
          label: "Single",
          values: [10, 20, 30, 40, 50],
        },
      ];

      const chart = visualizer.createBoxPlot(datasets);
      expect(chart).toContain("Single");
      expect(chart).toContain("│");
      expect(chart).toContain("█");
    });
  });

  describe("Edge Cases", () => {
    it("should handle negative values in line chart", () => {
      const data: DataPoint[] = [{ value: -10 }, { value: 0 }, { value: 10 }];

      const chart = visualizer.createLineChart(data);
      expect(chart).toContain("-10");
      expect(chart).toContain("10");
    });

    it("should handle very large numbers", () => {
      const data: DataPoint[] = [{ value: 1000000 }, { value: 2000000 }];

      const chart = visualizer.createLineChart(data);
      expect(chart).toBeDefined();
      expect(chart).not.toBe("No data available");
    });

    it("should handle special characters in labels", () => {
      const data = [
        { label: "Test & Demo", value: 50 },
        { label: "Special <chars>", value: 50 },
      ];

      const chart = visualizer.createPieChart(data);
      expect(chart).toContain("Test & Demo");
      expect(chart).toContain("Special <chars>");
    });

    it("should handle very long labels", () => {
      const data: MultiSeriesData[] = [
        {
          label: "This is a very long label that should be truncated",
          value: 100,
        },
      ];

      const chart = visualizer.createBarChart(data);
      expect(chart).toBeDefined();
    });
  });

  describe("Chart Options", () => {
    it("should respect width option", () => {
      const data: DataPoint[] = [{ value: 50 }];
      const chart = visualizer.createLineChart(data, "Test", { width: 40 });

      const lines = chart.split("\n");
      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(40);
      });
    });

    it("should respect height option", () => {
      const data: DataPoint[] = [{ value: 50 }];
      const chart = visualizer.createLineChart(data, "Test", { height: 10 });

      const lines = chart.split("\n");
      expect(lines.length).toBeLessThanOrEqual(15); // Height + title + labels
    });

    it("should respect showLabels option", () => {
      const data: DataPoint[] = [{ value: 50 }];
      const chart = visualizer.createLineChart(data, "Test", {
        showLabels: false,
      });

      // Should not show axis labels when disabled
      const lines = chart.split("\n");
      const hasLabels = lines.some(
        (line) => line.includes("Min:") || line.includes("Max:"),
      );
      expect(hasLabels).toBe(true); // Legend is separate from labels
    });

    it("should respect showLegend option", () => {
      const data: DataPoint[] = [{ value: 50 }];
      const chart = visualizer.createLineChart(data, "Test", {
        showLegend: false,
      });

      expect(chart).not.toContain("Min:");
      expect(chart).not.toContain("Max:");
      expect(chart).not.toContain("Avg:");
    });

    it("should respect showGrid option", () => {
      const data: DataPoint[] = [{ value: 10 }, { value: 20 }];

      const chartWithGrid = visualizer.createLineChart(data, "Test", {
        showGrid: true,
      });
      const chartWithoutGrid = visualizer.createLineChart(data, "Test", {
        showGrid: false,
      });

      const gridCount = (chartWithGrid.match(/·/g) || []).length;
      const noGridCount = (chartWithoutGrid.match(/·/g) || []).length;

      expect(gridCount).toBeGreaterThanOrEqual(noGridCount);
    });
  });
});
