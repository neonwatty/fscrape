/**
 * Tests for SVG Generator
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SvgGenerator } from "../svg-generator.js";

describe("SvgGenerator", () => {
  let generator: SvgGenerator;

  beforeEach(() => {
    generator = new SvgGenerator();
  });

  describe("Line Chart Generation", () => {
    it("should generate a basic line chart", () => {
      const data = [
        { x: new Date("2024-01-01"), y: 10 },
        { x: new Date("2024-01-02"), y: 20 },
        { x: new Date("2024-01-03"), y: 15 },
      ];

      const svg = generator.generateLineChart(data, "Test Chart");

      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("Test Chart");
      expect(svg).toContain("<path");
    });

    it("should handle empty data", () => {
      const svg = generator.generateLineChart([], "Empty Chart");

      expect(svg).toContain("<svg");
      expect(svg).toContain("No data available");
    });

    it("should handle single data point", () => {
      const data = [{ x: new Date("2024-01-01"), y: 10 }];

      const svg = generator.generateLineChart(data, "Single Point");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<circle"); // Should show point as circle
    });

    it("should apply custom options", () => {
      const data = [
        { x: new Date("2024-01-01"), y: 10 },
        { x: new Date("2024-01-02"), y: 20 },
      ];

      const svg = generator.generateLineChart(data, "Custom Chart", {
        width: 800,
        height: 400,
        theme: "dark",
      });

      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="400"');
      expect(svg.toLowerCase()).toContain("#1a1a1a"); // Dark theme background
    });

    it("should handle negative values", () => {
      const data = [
        { x: new Date("2024-01-01"), y: -10 },
        { x: new Date("2024-01-02"), y: 20 },
        { x: new Date("2024-01-03"), y: -5 },
      ];

      const svg = generator.generateLineChart(data, "Negative Values");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<line"); // Should have zero line
    });

    it("should format large numbers", () => {
      const data = [
        { x: new Date("2024-01-01"), y: 1000000 },
        { x: new Date("2024-01-02"), y: 2000000 },
      ];

      const svg = generator.generateLineChart(data, "Large Numbers");

      expect(svg).toContain("M"); // Should format as millions
    });
  });

  describe("Bar Chart Generation", () => {
    it("should generate a basic bar chart", () => {
      const data = [
        { label: "A", value: 10 },
        { label: "B", value: 20 },
        { label: "C", value: 15 },
      ];

      const svg = generator.generateBarChart(data, "Bar Chart");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<rect"); // Bars
      expect(svg).toContain("Bar Chart");
    });

    it("should handle comparison data", () => {
      const data = [
        { label: "Jan", reddit: 100, hackernews: 80 },
        { label: "Feb", reddit: 120, hackernews: 90 },
      ];

      const svg = generator.generateBarChart(data, "Comparison");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<rect"); // Multiple bars per category
      expect(svg).toContain("reddit");
      expect(svg).toContain("hackernews");
    });

    it("should handle zero values", () => {
      const data = [
        { label: "A", value: 0 },
        { label: "B", value: 10 },
      ];

      const svg = generator.generateBarChart(data, "Zero Values");

      expect(svg).toContain("<svg");
      expect(svg).not.toContain("NaN");
    });

    it("should apply themes correctly", () => {
      const data = [{ label: "A", value: 10 }];

      const lightSvg = generator.generateBarChart(data, "Light", {
        theme: "light",
      });

      const darkSvg = generator.generateBarChart(data, "Dark", {
        theme: "dark",
      });

      expect(lightSvg.toLowerCase()).toContain("#ffffff"); // Light background
      expect(darkSvg.toLowerCase()).toContain("#1a1a1a"); // Dark background
    });

    it("should handle long labels", () => {
      const data = [
        { label: "Very Long Label That Should Be Truncated", value: 10 },
        { label: "Short", value: 20 },
      ];

      const svg = generator.generateBarChart(data, "Long Labels");

      expect(svg).toContain("<svg");
      expect(svg).toContain("..."); // Should truncate long labels
    });
  });

  describe("Pie Chart Generation", () => {
    it("should generate a basic pie chart", () => {
      const data = [
        { label: "A", value: 30 },
        { label: "B", value: 50 },
        { label: "C", value: 20 },
      ];

      const svg = generator.generatePieChart(data, "Pie Chart");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<path"); // Pie slices
      expect(svg).toContain("Pie Chart");
    });

    it("should calculate percentages correctly", () => {
      const data = [
        { label: "Half", value: 50 },
        { label: "Quarter", value: 25 },
        { label: "Quarter", value: 25 },
      ];

      const svg = generator.generatePieChart(data, "Percentages");

      expect(svg).toContain("50%");
      expect(svg).toContain("25%");
    });

    it("should handle single slice", () => {
      const data = [{ label: "All", value: 100 }];

      const svg = generator.generatePieChart(data, "Single Slice");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<path"); // Path for single slice
      expect(svg).toContain("100%");
    });

    it("should handle zero total", () => {
      const data = [
        { label: "A", value: 0 },
        { label: "B", value: 0 },
      ];

      const svg = generator.generatePieChart(data, "Zero Total");

      expect(svg).toContain("<svg");
      expect(svg).toContain("No data");
    });

    it("should apply color schemes", () => {
      const data = [
        { label: "A", value: 30 },
        { label: "B", value: 70 },
      ];

      const svg = generator.generatePieChart(data, "Colors", {
        theme: "vibrant",
      });

      expect(svg).toContain("<svg");
      expect(svg).toMatch(/#[0-9a-fA-F]{6}/); // Should contain hex colors
    });

    it("should add legend", () => {
      const data = [
        { label: "Category A", value: 40 },
        { label: "Category B", value: 60 },
      ];

      const svg = generator.generatePieChart(data, "With Legend", {
        showLegend: true,
      });

      expect(svg).toContain("Category A");
      expect(svg).toContain("Category B");
      expect(svg).toContain("<rect"); // Legend color boxes
    });
  });

  describe("Scatter Plot Generation", () => {
    it("should generate a basic scatter plot", () => {
      const data = [
        { x: 10, y: 20, label: "Point 1" },
        { x: 20, y: 30, label: "Point 2" },
        { x: 15, y: 25, label: "Point 3" },
      ];

      const svg = generator.generateScatterPlot(data, "Scatter Plot");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<circle"); // Data points
      expect(svg).toContain("Scatter Plot");
    });

    it("should handle correlation visualization", () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        x: i,
        y: i * 2 + Math.random() * 5,
        label: `Point ${i}`,
      }));

      const svg = generator.generateScatterPlot(data, "Correlation", {
        showTrendLine: true,
      });

      expect(svg).toContain("<svg");
      expect(svg).toContain("<line"); // Trend line
    });

    it("should handle clusters", () => {
      const cluster1 = Array.from({ length: 5 }, (_, i) => ({
        x: 10 + i,
        y: 10 + i,
        label: "Cluster 1",
        group: "A",
      }));

      const cluster2 = Array.from({ length: 5 }, (_, i) => ({
        x: 30 + i,
        y: 30 + i,
        label: "Cluster 2",
        group: "B",
      }));

      const svg = generator.generateScatterPlot(
        [...cluster1, ...cluster2],
        "Clusters"
      );

      expect(svg).toContain("<svg");
      expect(svg).toContain("<circle");
    });
  });

  describe("Heatmap Generation", () => {
    it("should generate a basic heatmap", () => {
      const data = [
        { x: "Mon", y: "Morning", value: 10 },
        { x: "Mon", y: "Afternoon", value: 20 },
        { x: "Tue", y: "Morning", value: 15 },
        { x: "Tue", y: "Afternoon", value: 25 },
      ];

      const svg = generator.generateHeatmap(data, "Activity Heatmap");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<rect"); // Heat cells
      expect(svg).toContain("Activity Heatmap");
    });

    it("should apply color gradients based on values", () => {
      const data = [
        { x: "A", y: "1", value: 0 },
        { x: "A", y: "2", value: 50 },
        { x: "A", y: "3", value: 100 },
      ];

      const svg = generator.generateHeatmap(data, "Gradient");

      expect(svg).toContain("<svg");
      expect(svg).toMatch(/fill="#[0-9a-fA-F]{6}"/); // Different colors for different values
    });

    it("should handle missing data", () => {
      const data = [
        { x: "A", y: "1", value: 10 },
        { x: "A", y: "2", value: null },
        { x: "B", y: "1", value: 20 },
      ];

      const svg = generator.generateHeatmap(data, "Missing Data");

      expect(svg).toContain("<svg");
      expect(svg).not.toContain("NaN");
    });
  });

  describe("Export Functionality", () => {
    it("should export as SVG string", () => {
      const data = [{ date: new Date(), value: 10 }];
      const svg = generator.generateLineChart(data, "Export Test");

      expect(typeof svg).toBe("string");
      expect(svg).toMatch(/^<svg/);
      expect(svg).toMatch(/<\/svg>$/);
    });

    it("should include proper SVG namespace", () => {
      const data = [{ label: "A", value: 10 }];
      const svg = generator.generateBarChart(data, "Namespace Test");

      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it("should be valid XML", () => {
      const data = [{ label: "A", value: 10 }];
      const svg = generator.generatePieChart(data, "XML Test");

      // Check for proper XML structure
      expect(svg).toMatch(/<svg[^>]*>/);
      expect(svg).toMatch(/<\/svg>/);
      expect(svg.match(/<svg/g)?.length).toBe(1);
      expect(svg.match(/<\/svg>/g)?.length).toBe(1);
    });
  });

  describe("Responsive Design", () => {
    it("should handle different viewport sizes", () => {
      const data = [{ date: new Date(), value: 10 }];

      const small = generator.generateLineChart(data, "Small", {
        width: 300,
        height: 200,
      });

      const large = generator.generateLineChart(data, "Large", {
        width: 1200,
        height: 600,
      });

      expect(small).toContain('width="300"');
      expect(small).toContain('height="200"');
      expect(large).toContain('width="1200"');
      expect(large).toContain('height="600"');
    });

    it("should maintain aspect ratio", () => {
      const data = [{ label: "A", value: 10 }];

      const svg = generator.generateBarChart(data, "Aspect Ratio", {
        width: 800,
        height: 400,
        maintainAspectRatio: true,
      });

      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    });
  });

  describe("Accessibility", () => {
    it("should include title element", () => {
      const data = [{ x: new Date(), y: 10 }];
      const svg = generator.generateLineChart(data, "Accessible Chart");

      expect(svg).toContain("Accessible Chart");
      expect(svg).toMatch(/<title[^>]*>/);
    });

    it("should include descriptive text", () => {
      const data = [{ label: "A", value: 10 }];
      const svg = generator.generateBarChart(data, "Described Chart", {
        description: "A bar chart showing values",
      });

      expect(svg).toContain("A bar chart showing values");
      expect(svg).toMatch(/<desc[^>]*>/);
    });

    it("should add ARIA labels", () => {
      const data = [{ label: "A", value: 10 }];
      const svg = generator.generatePieChart(data, "ARIA Chart");

      expect(svg).toContain('role="img"');
      expect(svg).toContain('aria-label');
    });
  });

  describe("Performance", () => {
    it("should handle large datasets efficiently", () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000),
        value: Math.random() * 100,
      }));

      const start = Date.now();
      const svg = generator.generateLineChart(largeData, "Large Dataset");
      const duration = Date.now() - start;

      expect(svg).toContain("<svg");
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it("should optimize path data for large datasets", () => {
      const data = Array.from({ length: 500 }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000),
        value: Math.random() * 100,
      }));

      const svg = generator.generateLineChart(data, "Optimized", {
        optimize: true,
      });

      // Should use simplified path data
      const pathData = svg.match(/d="([^"]*)"/)?.[1] || "";
      const commands = pathData.split(/[ML]/).length;

      expect(commands).toBeLessThan(data.length); // Should be simplified
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid data gracefully", () => {
      const invalidData = [
        { x: 1, y: NaN },
        { x: 2, y: "not a number" as any },
      ];

      const svg = generator.generateLineChart(invalidData, "Invalid Data");

      expect(svg).toContain("<svg");
      expect(svg).toContain("Invalid data");
    });

    it("should handle Infinity values", () => {
      const data = [
        { label: "A", value: Infinity },
        { label: "B", value: 10 },
      ];

      const svg = generator.generateBarChart(data, "Infinity");

      expect(svg).toContain("<svg");
      expect(svg).toContain("<svg");
      // Should handle Infinity gracefully
    });

    it("should handle NaN values", () => {
      const data = [
        { label: "A", value: NaN },
        { label: "B", value: 10 },
      ];

      const svg = generator.generatePieChart(data, "NaN");

      expect(svg).toContain("<svg");
      expect(svg).not.toContain("NaN");
    });
  });
});