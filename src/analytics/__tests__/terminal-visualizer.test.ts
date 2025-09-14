/**
 * Tests for Terminal Visualizer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TerminalVisualizer } from "../terminal-visualizer.js";

describe("TerminalVisualizer", () => {
  let visualizer: TerminalVisualizer;

  beforeEach(() => {
    visualizer = new TerminalVisualizer();
  });

  describe("Initialization", () => {
    it("should create visualizer with default config", () => {
      expect(visualizer).toBeDefined();
      expect(visualizer.getColorScheme()).toBe("default");
    });

    it("should accept custom color scheme", () => {
      const customVisualizer = new TerminalVisualizer({ colorScheme: "vibrant" });
      expect(customVisualizer.getColorScheme()).toBe("vibrant");
    });

    it("should validate color scheme", () => {
      const customVisualizer = new TerminalVisualizer({ colorScheme: "invalid" as any });
      expect(customVisualizer.getColorScheme()).toBe("default");
    });
  });

  describe("Text Formatting", () => {
    it("should apply bold formatting", () => {
      const text = visualizer.bold("Bold Text");
      expect(text).toContain("\x1b[1m");
      expect(text).toContain("Bold Text");
      expect(text).toContain("\x1b[0m");
    });

    it("should apply color formatting", () => {
      const redText = visualizer.colorize("Red", "red");
      expect(redText).toContain("\x1b[31m");
      expect(redText).toContain("Red");
      expect(redText).toContain("\x1b[0m");
    });

    it("should apply multiple formats", () => {
      const text = visualizer.format("Text", ["bold", "red", "underline"]);
      expect(text).toContain("\x1b[1m"); // Bold
      expect(text).toContain("\x1b[31m"); // Red
      expect(text).toContain("\x1b[4m"); // Underline
    });

    it("should handle empty text", () => {
      const text = visualizer.bold("");
      expect(text).toBe("");
    });

    it("should strip colors when disabled", () => {
      const noColorVisualizer = new TerminalVisualizer({ useColors: false });
      const text = noColorVisualizer.colorize("Text", "red");
      expect(text).toBe("Text");
      expect(text).not.toContain("\x1b");
    });
  });

  describe("Progress Bars", () => {
    it("should create basic progress bar", () => {
      const bar = visualizer.createProgressBar(50, 100);
      expect(bar).toContain("█");
      expect(bar).toContain("░");
      expect(bar).toContain("50.0%");
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

    it("should handle custom width", () => {
      const bar = visualizer.createProgressBar(50, 100, { width: 20 });
      const filled = (bar.match(/█/g) || []).length;
      expect(filled).toBe(10); // 50% of 20
    });

    it("should show labels", () => {
      const bar = visualizer.createProgressBar(75, 100, {
        label: "Processing",
      });
      expect(bar).toContain("Processing");
      expect(bar).toContain("75.0%");
    });

    it("should handle division by zero", () => {
      const bar = visualizer.createProgressBar(50, 0);
      expect(bar).toContain("%");
    });
  });

  describe("Sparklines", () => {
    it("should create sparkline from data", () => {
      const data = [1, 2, 3, 4, 5, 4, 3, 2, 1];
      const sparkline = visualizer.createSparkline(data);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]+/);
    });

    it("should handle empty data", () => {
      const sparkline = visualizer.createSparkline([]);
      expect(sparkline).toBe("");
    });

    it("should handle single value", () => {
      const sparkline = visualizer.createSparkline([5]);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]/);
    });

    it("should handle negative values", () => {
      const data = [-5, -2, 0, 2, 5];
      const sparkline = visualizer.createSparkline(data);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]+/);
    });

    it("should normalize large values", () => {
      const data = [1000, 2000, 3000, 4000, 5000];
      const sparkline = visualizer.createSparkline(data);
      expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]+/);
    });

    it("should handle all same values", () => {
      const data = [5, 5, 5, 5, 5];
      const sparkline = visualizer.createSparkline(data);
      expect(sparkline).toBeDefined();
    });
  });

  describe("Tables", () => {
    it("should create basic table", () => {
      const data = [
        { name: "Alice", score: 100 },
        { name: "Bob", score: 85 },
      ];
      const table = visualizer.createTable(data, ["name", "score"]);

      expect(table).toContain("Alice");
      expect(table).toContain("100");
      expect(table).toContain("Bob");
      expect(table).toContain("85");
      expect(table).toContain("│"); // Table borders
    });

    it("should handle empty data", () => {
      const table = visualizer.createTable([], ["col1", "col2"]);
      expect(table).toContain("No data");
    });

    it("should align columns", () => {
      const data = [
        { text: "Short", number: 1 },
        { text: "Very Long Text", number: 1000 },
      ];
      const table = visualizer.createTable(data, ["text", "number"], {
        alignment: { text: "left", number: "right" },
      });

      expect(table).toContain("Short");
      expect(table).toContain("Very Long Text");
    });

    it("should truncate long values", () => {
      const data = [
        { text: "This is a very long text that should be truncated" },
      ];
      const table = visualizer.createTable(data, ["text"], {
        maxWidth: 20,
      });

      expect(table).toContain("...");
    });

    it("should add headers", () => {
      const data = [{ id: 1, name: "Test" }];
      const table = visualizer.createTable(data, ["id", "name"], {
        headers: { id: "ID", name: "Name" },
      });

      expect(table).toContain("ID");
      expect(table).toContain("Name");
    });

    it("should handle special characters", () => {
      const data = [{ text: "Test\nNew\tLine" }];
      const table = visualizer.createTable(data, ["text"]);

      // Table should have replaced newlines and tabs within cell data
      expect(table).toContain("Test New Line");
      expect(table).not.toContain("\t");
    });
  });

  describe("Charts", () => {
    it("should create bar chart", () => {
      const data = [
        { label: "A", value: 10 },
        { label: "B", value: 20 },
        { label: "C", value: 15 },
      ];
      const chart = visualizer.createBarChart(data);

      expect(chart).toContain("A");
      expect(chart).toContain("B");
      expect(chart).toContain("C");
      expect(chart).toContain("█");
    });

    it("should handle horizontal bar chart", () => {
      const data = [
        { label: "Category 1", value: 30 },
        { label: "Category 2", value: 60 },
      ];
      const chart = visualizer.createBarChart(data, {
        orientation: "horizontal",
      });

      expect(chart).toContain("Category 1");
      expect(chart).toContain("Category 2");
      expect(chart).toContain("█");
    });

    it("should scale bars appropriately", () => {
      const data = [
        { label: "Small", value: 1 },
        { label: "Large", value: 100 },
      ];
      const chart = visualizer.createBarChart(data, { maxWidth: 20 });

      const lines = chart.split("\n");
      const smallBar = lines.find(l => l.includes("Small"));
      const largeBar = lines.find(l => l.includes("Large"));

      expect(smallBar).toBeDefined();
      expect(largeBar).toBeDefined();
    });

    it("should show values", () => {
      const data = [
        { label: "Test", value: 42 },
      ];
      const chart = visualizer.createBarChart(data, {
        showValues: true,
      });

      expect(chart).toContain("42");
    });

    it("should handle zero values", () => {
      const data = [
        { label: "Zero", value: 0 },
        { label: "NonZero", value: 10 },
      ];
      const chart = visualizer.createBarChart(data);

      expect(chart).toContain("Zero");
      expect(chart).toContain("NonZero");
    });

    it("should handle negative values", () => {
      const data = [
        { label: "Negative", value: -10 },
        { label: "Positive", value: 10 },
      ];
      const chart = visualizer.createBarChart(data);

      expect(chart).toContain("Negative");
      expect(chart).toContain("Positive");
    });
  });

  describe("Tree View", () => {
    it("should create tree structure", () => {
      const data = {
        name: "root",
        children: [
          { name: "child1" },
          { name: "child2", children: [{ name: "grandchild" }] },
        ],
      };
      const tree = visualizer.createTree(data);

      expect(tree).toContain("root");
      expect(tree).toContain("child1");
      expect(tree).toContain("child2");
      expect(tree).toContain("grandchild");
      expect(tree).toContain("├"); // Tree branch
      expect(tree).toContain("└"); // Tree end
    });

    it("should handle empty tree", () => {
      const tree = visualizer.createTree({});
      expect(tree).toBeDefined();
    });

    it("should limit depth", () => {
      const deepTree = {
        name: "1",
        children: [
          {
            name: "2",
            children: [
              {
                name: "3",
                children: [{ name: "4", children: [{ name: "5" }] }],
              },
            ],
          },
        ],
      };
      const tree = visualizer.createTreeView(deepTree, { maxDepth: 3 });

      expect(tree).toContain("1");
      expect(tree).toContain("2");
      expect(tree).not.toContain("4");
    });

    it("should show values in tree", () => {
      const data = {
        name: "total",
        value: 100,
        children: [
          { name: "a", value: 60 },
          { name: "b", value: 40 },
        ],
      };
      const tree = visualizer.createTree(data, { showValues: true });

      expect(tree).toContain("100");
      expect(tree).toContain("60");
      expect(tree).toContain("40");
    });
  });

  describe("Boxes and Panels", () => {
    it("should create box with content", () => {
      const box = visualizer.createBox("Content", "Title");

      expect(box).toContain("Title");
      expect(box).toContain("Content");
      expect(box).toContain("┌"); // Box corners
      expect(box).toContain("┐");
      expect(box).toContain("└");
      expect(box).toContain("┘");
    });

    it("should handle multiline content", () => {
      const content = "Line 1\nLine 2\nLine 3";
      const box = visualizer.createBox(content);

      expect(box).toContain("Line 1");
      expect(box).toContain("Line 2");
      expect(box).toContain("Line 3");
    });

    it("should apply padding", () => {
      const box = visualizer.createBox("Text", "Title", { padding: 2 });
      const lines = box.split("\n");

      // Check for padding lines
      expect(lines.some(l => l.includes("│") && l.trim().length > 2)).toBe(true);
    });

    it("should center content", () => {
      const box = visualizer.createBox("X", "Title", {
        width: 20,
        align: "center",
      });

      expect(box).toContain("X");
      // X should be roughly centered
    });

    it("should handle empty content", () => {
      const box = visualizer.createBox("", "Empty Box");
      expect(box).toContain("Empty Box");
    });
  });

  describe("Diff Display", () => {
    it("should show additions and deletions", () => {
      const diff = visualizer.createDiff(
        ["line1", "line2", "line3"],
        ["line1", "line2-modified", "line3", "line4"]
      );

      expect(diff).toContain("+"); // Addition
      expect(diff).toContain("-"); // Deletion
      expect(diff).toContain("line4");
    });

    it("should handle empty arrays", () => {
      const diff = visualizer.createDiff([], ["new"]);
      expect(diff).toContain("+");
      expect(diff).toContain("new");
    });

    it("should show no changes", () => {
      const diff = visualizer.createDiff(["same"], ["same"]);
      expect(diff).toContain("No changes");
    });

    it("should apply colors to diff", () => {
      const diff = visualizer.createDiff(["old"], ["new"], {
        useColors: true,
      });

      expect(diff).toContain("\x1b[31m"); // Red for deletion
      expect(diff).toContain("\x1b[32m"); // Green for addition
    });
  });

  describe("Loading Indicators", () => {
    it("should create spinner frames", () => {
      const frames = visualizer.getSpinnerFrames();
      expect(frames).toBeInstanceOf(Array);
      expect(frames.length).toBeGreaterThan(0);
    });

    it("should create loading bar", () => {
      const bar = visualizer.createLoadingBar(10, 100);
      expect(bar).toContain("%");
    });

    it("should animate dots", () => {
      const dots1 = visualizer.createLoadingDots(1);
      const dots2 = visualizer.createLoadingDots(2);
      const dots3 = visualizer.createLoadingDots(3);

      expect(dots1).toBe(".");
      expect(dots2).toBe("..");
      expect(dots3).toBe("...");
    });
  });

  describe("Color Schemes", () => {
    it("should apply default color scheme", () => {
      const text = visualizer.applyColorScheme("test", "success");
      expect(text).toContain("\x1b[32m"); // Green for success
    });

    it("should apply vibrant color scheme", () => {
      const vibrantVisualizer = new TerminalVisualizer({
        colorScheme: "vibrant",
      });
      const text = vibrantVisualizer.applyColorScheme("test", "primary");
      expect(text).toContain("\x1b");
    });

    it("should apply monochrome scheme", () => {
      const monoVisualizer = new TerminalVisualizer({
        colorScheme: "monochrome",
      });
      const text = monoVisualizer.applyColorScheme("test", "primary");
      // Monochrome should use limited colors
      expect(text).toBeDefined();
    });

    it("should handle invalid color names", () => {
      const text = visualizer.applyColorScheme("test", "invalid");
      expect(text).toBe("test");
    });
  });

  describe("Utility Functions", () => {
    it("should truncate text", () => {
      const truncated = visualizer.truncate(
        "This is a very long text",
        10
      );
      expect(truncated).toBe("This is...");
      expect(truncated.length).toBeLessThanOrEqual(10);
    });

    it("should pad text", () => {
      const padded = visualizer.pad("text", 10);
      expect(padded.length).toBe(10);
      expect(padded).toContain("text");
    });

    it("should center text", () => {
      const centered = visualizer.center("X", 10);
      expect(centered.length).toBe(10);
      expect(centered.indexOf("X")).toBeGreaterThan(0);
    });

    it("should repeat characters", () => {
      const repeated = visualizer.repeat("=", 5);
      expect(repeated).toBe("=====");
    });

    it("should clear screen codes", () => {
      const clear = visualizer.getClearScreen();
      expect(clear).toContain("\x1b[2J");
      expect(clear).toContain("\x1b[0;0H");
    });
  });

  describe("Performance", () => {
    it("should handle large tables efficiently", () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random() * 100,
      }));

      const start = Date.now();
      const table = visualizer.createTable(data, ["id", "value"]);
      const duration = Date.now() - start;

      expect(table).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it("should handle long sparklines efficiently", () => {
      const data = Array.from({ length: 10000 }, () => Math.random() * 100);

      const start = Date.now();
      const sparkline = visualizer.createSparkline(data);
      const duration = Date.now() - start;

      expect(sparkline).toBeDefined();
      expect(duration).toBeLessThan(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle Unicode characters", () => {
      const box = visualizer.createBox("Hello 世界 🌍", "Unicode");
      expect(box).toContain("Hello");
      expect(box).toContain("世界");
      expect(box).toContain("🌍");
    });

    it("should handle very wide content", () => {
      const wideText = "x".repeat(200);
      const box = visualizer.createBox(wideText, "Wide", {
        maxWidth: 80,
      });

      const lines = box.split("\n");
      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(80);
      });
    });

    it("should handle null and undefined", () => {
      const table = visualizer.createTable(
        [{ value: null }, { value: undefined }],
        ["value"]
      );

      expect(table).not.toContain("null");
      expect(table).not.toContain("undefined");
      expect(table).toContain("N/A");
    });
  });
});