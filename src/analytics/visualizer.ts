/**
 * Analytics Visualizer
 * Creates ASCII charts and visual representations of analytics data
 */

export interface ChartOptions {
  width?: number;
  height?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: boolean;
  style?: "simple" | "detailed" | "minimal";
}

export interface DataPoint {
  date?: Date;
  label?: string;
  value: number;
  category?: string;
}

export interface MultiSeriesData {
  label: string;
  [key: string]: any;
}

export class AnalyticsVisualizer {
  private readonly defaultOptions: Required<ChartOptions> = {
    width: 80,
    height: 20,
    showLabels: true,
    showLegend: true,
    showGrid: true,
    colors: false,
    style: "simple",
  };

  /**
   * Create a line chart
   */
  public createLineChart(
    data: DataPoint[],
    title?: string,
    options?: ChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (title) {
      lines.push(this.centerText(title, opts.width));
      lines.push("");
    }

    if (data.length === 0) {
      return "No data available";
    }

    // Normalize data
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Create chart grid
    const chartHeight = opts.height - (opts.showLabels ? 4 : 2);
    const chartWidth = opts.width - 10; // Reserve space for axis labels

    // Y-axis labels
    const yLabels = this.generateYAxisLabels(min, max, chartHeight);

    // Create chart lines
    for (let y = 0; y < chartHeight; y++) {
      let line = "";

      // Y-axis label
      if (opts.showLabels && y % Math.floor(chartHeight / 5) === 0) {
        const labelIndex = Math.floor((y / chartHeight) * (yLabels.length - 1));
        line += this.padRight(
          yLabels[yLabels.length - 1 - labelIndex].toString(),
          8,
        );
      } else {
        line += "        ";
      }

      // Y-axis
      line += "│";

      // Plot points
      for (let x = 0; x < chartWidth; x++) {
        const dataIndex = Math.floor((x / chartWidth) * data.length);
        const point = data[Math.min(dataIndex, data.length - 1)];
        const normalizedValue = (point.value - min) / range;
        const chartY = Math.floor((1 - normalizedValue) * (chartHeight - 1));

        if (chartY === y) {
          line += "●";
        } else if (opts.showGrid && x % 10 === 0) {
          line += "·";
        } else {
          line += " ";
        }
      }

      lines.push(line);
    }

    // X-axis
    lines.push("        └" + "─".repeat(chartWidth));

    // X-axis labels
    if (opts.showLabels && data[0].date) {
      const xLabels = this.generateXAxisLabels(data);
      lines.push("         " + xLabels);
    }

    // Legend
    if (opts.showLegend) {
      lines.push("");
      lines.push(
        `Min: ${min.toFixed(2)} | Max: ${max.toFixed(2)} | ` +
          `Avg: ${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Create a bar chart
   */
  public createBarChart(
    data: MultiSeriesData[],
    title?: string,
    options?: ChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (title) {
      lines.push(this.centerText(title, opts.width));
      lines.push("");
    }

    if (data.length === 0) {
      return "No data available";
    }

    // Get all numeric keys (series)
    const series = Object.keys(data[0]).filter(
      (k) => k !== "label" && typeof data[0][k] === "number",
    );

    // Find max value for scaling
    let maxValue = 0;
    data.forEach((item) => {
      series.forEach((s) => {
        maxValue = Math.max(maxValue, item[s] || 0);
      });
    });

    const scale = (opts.height - 5) / (maxValue || 1);
    const barWidth = Math.floor(
      (opts.width - 10) / (data.length * (series.length + 1)),
    );

    // Create chart
    for (let y = opts.height - 5; y >= 0; y--) {
      let line = "";

      // Y-axis label
      if (y % 5 === 0) {
        const value = (y / scale).toFixed(0);
        line += this.padRight(value, 8);
      } else {
        line += "        ";
      }

      // Y-axis
      line += "│";

      // Draw bars
      data.forEach((item, itemIndex) => {
        series.forEach((s, seriesIndex) => {
          const value = item[s] || 0;
          const barHeight = Math.floor(value * scale);

          if (y < barHeight) {
            line += this.getBarCharacter(seriesIndex).repeat(barWidth);
          } else {
            line += " ".repeat(barWidth);
          }
          line += " "; // Gap between bars
        });
        line += "  "; // Gap between groups
      });

      lines.push(line);
    }

    // X-axis
    lines.push("        └" + "─".repeat(opts.width - 10));

    // X-axis labels
    if (opts.showLabels) {
      let labelLine = "         ";
      data.forEach((item) => {
        const label = item.label || "";
        const totalWidth = barWidth * series.length + series.length + 2;
        labelLine += this.centerText(
          label.substring(0, totalWidth - 1),
          totalWidth,
        );
      });
      lines.push(labelLine);
    }

    // Legend
    if (opts.showLegend && series.length > 1) {
      lines.push("");
      lines.push(
        "Legend: " +
          series.map((s, i) => `${this.getBarCharacter(i)} ${s}`).join(" | "),
      );
    }

    return lines.join("\n");
  }

  /**
   * Create a pie chart (ASCII representation)
   */
  public createPieChart(
    data: Array<{ label: string; value: number }>,
    title?: string,
    options?: ChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (title) {
      lines.push(this.centerText(title, opts.width));
      lines.push("");
    }

    if (data.length === 0) {
      return "No data available";
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
      return "No data available (all values are zero)";
    }

    // Sort by value descending
    const sorted = [...data].sort((a, b) => b.value - a.value);

    // Create ASCII pie representation
    const radius = Math.min(10, Math.floor(opts.height / 2));
    const centerX = Math.floor(opts.width / 2);
    const centerY = radius;

    // Create circle
    const chart: string[][] = [];
    for (let y = 0; y < radius * 2; y++) {
      chart[y] = [];
      for (let x = 0; x < opts.width; x++) {
        chart[y][x] = " ";
      }
    }

    // Draw circle segments
    let currentAngle = 0;
    sorted.forEach((item, index) => {
      const percentage = item.value / total;
      const angleSize = percentage * 2 * Math.PI;
      const endAngle = currentAngle + angleSize;

      // Fill segment
      for (let angle = currentAngle; angle < endAngle; angle += 0.01) {
        for (let r = 0; r < radius; r++) {
          const x = Math.floor(centerX + r * Math.cos(angle) * 2);
          const y = Math.floor(centerY + r * Math.sin(angle));

          if (x >= 0 && x < opts.width && y >= 0 && y < radius * 2) {
            chart[y][x] = this.getPieCharacter(index);
          }
        }
      }

      currentAngle = endAngle;
    });

    // Convert chart to lines
    chart.forEach((row) => {
      lines.push(row.join(""));
    });

    // Add legend
    lines.push("");
    lines.push("Distribution:");
    sorted.forEach((item, index) => {
      const percentage = ((item.value / total) * 100).toFixed(1);
      lines.push(
        `  ${this.getPieCharacter(index)} ${item.label}: ${item.value} (${percentage}%)`,
      );
    });

    return lines.join("\n");
  }

  /**
   * Create a heatmap
   */
  public createHeatmap(
    data: number[][],
    rowLabels?: string[],
    colLabels?: string[],
    title?: string,
    options?: ChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (title) {
      lines.push(this.centerText(title, opts.width));
      lines.push("");
    }

    if (data.length === 0 || data[0].length === 0) {
      return "No data available";
    }

    // Find min and max for normalization
    let min = Infinity;
    let max = -Infinity;
    data.forEach((row) => {
      row.forEach((val) => {
        min = Math.min(min, val);
        max = Math.max(max, val);
      });
    });

    const range = max - min || 1;

    // Column headers
    if (colLabels && opts.showLabels) {
      let headerLine = "        ";
      colLabels.forEach((label) => {
        headerLine += this.padRight(label.substring(0, 8), 10);
      });
      lines.push(headerLine);
      lines.push("");
    }

    // Create heatmap
    data.forEach((row, rowIndex) => {
      let line = "";

      // Row label
      if (rowLabels && opts.showLabels) {
        line += this.padRight(rowLabels[rowIndex]?.substring(0, 6) || "", 8);
      } else {
        line += "        ";
      }

      // Heat cells
      row.forEach((val) => {
        const normalized = (val - min) / range;
        const char = this.getHeatCharacter(normalized);
        line += ` ${char.repeat(8)} `;
      });

      lines.push(line);
    });

    // Legend
    if (opts.showLegend) {
      lines.push("");
      lines.push(
        `Scale: Min=${min.toFixed(2)} [${this.getHeatCharacter(0)}] ` +
          `→ [${this.getHeatCharacter(0.5)}] → ` +
          `[${this.getHeatCharacter(1)}] Max=${max.toFixed(2)}`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Create a sparkline (mini chart)
   */
  public createSparkline(data: number[]): string {
    if (data.length === 0) return "";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const sparkChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

    return data
      .map((val) => {
        const normalized = (val - min) / range;
        const index = Math.floor(normalized * (sparkChars.length - 1));
        return sparkChars[index];
      })
      .join("");
  }

  /**
   * Create a progress bar
   */
  public createProgressBar(
    value: number,
    max: number,
    width = 20,
    showPercentage = true,
  ): string {
    const percentage = Math.min(100, (value / max) * 100);
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;

    let bar = "[" + "█".repeat(filled) + "░".repeat(empty) + "]";

    if (showPercentage) {
      bar += ` ${percentage.toFixed(1)}%`;
    }

    return bar;
  }

  /**
   * Create a comparison table
   */
  public createComparisonTable(
    data: Array<{ metric: string; [key: string]: any }>,
    title?: string,
  ): string {
    const lines: string[] = [];

    if (title) {
      lines.push(title);
      lines.push("═".repeat(title.length));
      lines.push("");
    }

    if (data.length === 0) {
      return "No data available";
    }

    // Get columns (excluding 'metric')
    const columns = Object.keys(data[0]).filter((k) => k !== "metric");

    // Calculate column widths
    const metricWidth = Math.max(6, ...data.map((d) => d.metric.length));
    const colWidth = 12;

    // Header
    let header = this.padRight("Metric", metricWidth + 2);
    columns.forEach((col) => {
      header += "│ " + this.padRight(col, colWidth);
    });
    lines.push(header);

    // Separator
    lines.push(
      "─".repeat(metricWidth + 2) +
        columns.map(() => "┼" + "─".repeat(colWidth + 1)).join(""),
    );

    // Data rows
    data.forEach((row) => {
      let line = this.padRight(row.metric, metricWidth + 2);
      columns.forEach((col) => {
        const value = row[col];
        const formatted =
          typeof value === "number" ? value.toFixed(2) : String(value || "");
        line += "│ " + this.padRight(formatted, colWidth);
      });
      lines.push(line);
    });

    return lines.join("\n");
  }

  /**
   * Create a tree visualization
   */
  public createTree(
    data: any,
    title?: string,
    indent = 0,
    prefix = "",
  ): string {
    const lines: string[] = [];

    if (title && indent === 0) {
      lines.push(title);
      lines.push("");
    }

    if (typeof data === "object" && data !== null) {
      const entries = Object.entries(data);
      entries.forEach(([key, value], index) => {
        const isLast = index === entries.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const extension = isLast ? "    " : "│   ";

        lines.push(prefix + connector + key);

        if (typeof value === "object" && value !== null) {
          const subTree = this.createTree(
            value,
            undefined,
            indent + 1,
            prefix + extension,
          );
          lines.push(...subTree.split("\n").filter((l) => l));
        } else {
          lines.push(prefix + extension + "    " + String(value));
        }
      });
    }

    return lines.join("\n");
  }

  /**
   * Create a scatter plot
   */
  public createScatterPlot(
    data: Array<{ x: number; y: number; label?: string }>,
    title?: string,
    options?: ChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (title) {
      lines.push(this.centerText(title, opts.width));
      lines.push("");
    }

    if (data.length === 0) {
      return "No data available";
    }

    // Find bounds
    const xValues = data.map(d => d.x);
    const yValues = data.map(d => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    // Create chart dimensions
    const chartHeight = opts.height - (opts.showLabels ? 4 : 2);
    const chartWidth = opts.width - 10;

    // Create grid
    const grid: string[][] = [];
    for (let y = 0; y < chartHeight; y++) {
      grid[y] = [];
      for (let x = 0; x < chartWidth; x++) {
        grid[y][x] = opts.showGrid && (x % 10 === 0 || y % 5 === 0) ? "·" : " ";
      }
    }

    // Plot points
    data.forEach((point, index) => {
      const xPos = Math.floor(((point.x - xMin) / xRange) * (chartWidth - 1));
      const yPos = Math.floor((1 - (point.y - yMin) / yRange) * (chartHeight - 1));
      
      if (xPos >= 0 && xPos < chartWidth && yPos >= 0 && yPos < chartHeight) {
        grid[yPos][xPos] = this.getScatterCharacter(index);
      }
    });

    // Y-axis labels
    const yLabels = this.generateYAxisLabels(yMin, yMax, chartHeight);

    // Build chart
    for (let y = 0; y < chartHeight; y++) {
      let line = "";

      // Y-axis label
      if (opts.showLabels && y % Math.floor(chartHeight / 5) === 0) {
        const labelIndex = Math.floor((y / chartHeight) * (yLabels.length - 1));
        line += this.padRight(
          yLabels[yLabels.length - 1 - labelIndex].toFixed(1),
          8,
        );
      } else {
        line += "        ";
      }

      // Y-axis
      line += "│";

      // Grid content
      line += grid[y].join("");

      lines.push(line);
    }

    // X-axis
    lines.push("        └" + "─".repeat(chartWidth));

    // X-axis labels
    if (opts.showLabels) {
      const xLabels = [];
      for (let i = 0; i <= 4; i++) {
        xLabels.push((xMin + (xRange * i) / 4).toFixed(1));
      }
      lines.push("         " + xLabels.join("     ".padEnd(Math.floor(chartWidth / 4))));
    }

    // Legend
    if (opts.showLegend && data.some(d => d.label)) {
      lines.push("");
      lines.push("Points:");
      data.slice(0, 10).forEach((point, i) => {
        if (point.label) {
          lines.push(`  ${this.getScatterCharacter(i)} ${point.label}`);
        }
      });
    }

    return lines.join("\n");
  }

  /**
   * Create a histogram
   */
  public createHistogram(
    data: number[],
    bins = 10,
    title?: string,
    options?: ChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (title) {
      lines.push(this.centerText(title, opts.width));
      lines.push("");
    }

    if (data.length === 0) {
      return "No data available";
    }

    // Calculate bins
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins || 1;
    const histogram: number[] = new Array(bins).fill(0);

    // Populate bins
    data.forEach(value => {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        bins - 1
      );
      histogram[binIndex]++;
    });

    // Find max frequency for scaling
    const maxFreq = Math.max(...histogram);
    const scale = (opts.height - 5) / (maxFreq || 1);

    // Create chart
    for (let y = opts.height - 5; y >= 0; y--) {
      let line = "";

      // Y-axis label
      if (y % 5 === 0) {
        const value = (y / scale).toFixed(0);
        line += this.padRight(value, 8);
      } else {
        line += "        ";
      }

      // Y-axis
      line += "│";

      // Draw bins
      const barWidth = Math.floor((opts.width - 10) / bins);
      histogram.forEach((freq) => {
        const barHeight = Math.floor(freq * scale);
        if (y < barHeight) {
          line += "█".repeat(barWidth - 1) + " ";
        } else {
          line += " ".repeat(barWidth);
        }
      });

      lines.push(line);
    }

    // X-axis
    lines.push("        └" + "─".repeat(opts.width - 10));

    // X-axis labels
    if (opts.showLabels) {
      let labelLine = "         ";
      for (let i = 0; i <= bins; i += Math.ceil(bins / 5)) {
        const value = min + i * binWidth;
        labelLine += this.padRight(value.toFixed(1), Math.floor((opts.width - 10) / 5));
      }
      lines.push(labelLine);
    }

    // Statistics
    if (opts.showLegend) {
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      const stdDev = Math.sqrt(
        data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
      );
      lines.push("");
      lines.push(`Count: ${data.length} | Mean: ${mean.toFixed(2)} | StdDev: ${stdDev.toFixed(2)}`);
      lines.push(`Min: ${min.toFixed(2)} | Max: ${max.toFixed(2)} | Bins: ${bins}`);
    }

    return lines.join("\n");
  }

  /**
   * Create a box plot
   */
  public createBoxPlot(
    datasets: Array<{ label: string; values: number[] }>,
    title?: string,
    options?: ChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (title) {
      lines.push(this.centerText(title, opts.width));
      lines.push("");
    }

    if (datasets.length === 0) {
      return "No data available";
    }

    // Calculate statistics for each dataset
    const stats = datasets.map(dataset => {
      const sorted = [...dataset.values].sort((a, b) => a - b);
      const n = sorted.length;
      
      return {
        label: dataset.label,
        min: sorted[0],
        q1: sorted[Math.floor(n * 0.25)],
        median: sorted[Math.floor(n * 0.5)],
        q3: sorted[Math.floor(n * 0.75)],
        max: sorted[n - 1],
        outliers: this.findOutliers(sorted),
      };
    });

    // Find overall min/max for scaling
    const allValues = datasets.flatMap(d => d.values);
    const overallMin = Math.min(...allValues);
    const overallMax = Math.max(...allValues);
    const range = overallMax - overallMin || 1;

    // Chart dimensions
    const chartHeight = opts.height - 4;
    const chartWidth = opts.width - 10;
    const boxHeight = Math.floor(chartHeight / datasets.length) - 1;
    const boxCenter = Math.floor(boxHeight / 2);

    // Y-axis scale
    const scale = (chartWidth - 2) / range;

    // Draw each box plot
    stats.forEach((stat, index) => {
      const yStart = index * (boxHeight + 1) + 2;

      // Label
      if (opts.showLabels) {
        lines.push(this.padRight(stat.label.substring(0, 8), 10));
      }

      // Create box plot line
      const boxLine = new Array(chartWidth).fill(" ");
      
      // Whiskers and box positions
      const minPos = Math.floor((stat.min - overallMin) * scale);
      const q1Pos = Math.floor((stat.q1 - overallMin) * scale);
      const medianPos = Math.floor((stat.median - overallMin) * scale);
      const q3Pos = Math.floor((stat.q3 - overallMin) * scale);
      const maxPos = Math.floor((stat.max - overallMin) * scale);

      // Draw whiskers
      for (let i = minPos; i <= maxPos; i++) {
        if (i === minPos || i === maxPos) {
          boxLine[i] = "│";
        } else if (i > minPos && i < q1Pos) {
          boxLine[i] = "─";
        } else if (i > q3Pos && i < maxPos) {
          boxLine[i] = "─";
        }
      }

      // Draw box
      for (let i = q1Pos; i <= q3Pos; i++) {
        if (i === q1Pos || i === q3Pos) {
          boxLine[i] = "│";
        } else if (i === medianPos) {
          boxLine[i] = "┊";
        } else {
          boxLine[i] = "█";
        }
      }

      // Draw outliers
      stat.outliers.forEach(outlier => {
        const pos = Math.floor((outlier - overallMin) * scale);
        if (pos >= 0 && pos < chartWidth) {
          boxLine[pos] = "◦";
        }
      });

      lines.push("        │" + boxLine.join(""));
    });

    // X-axis
    lines.push("        └" + "─".repeat(chartWidth));

    // X-axis labels
    if (opts.showLabels) {
      const labels = [];
      for (let i = 0; i <= 4; i++) {
        labels.push((overallMin + (range * i) / 4).toFixed(1));
      }
      lines.push("         " + labels.join("     ".padEnd(Math.floor(chartWidth / 4))));
    }

    // Legend
    if (opts.showLegend) {
      lines.push("");
      lines.push("Box Plot Legend: │ = whisker/quartile, █ = box, ┊ = median, ◦ = outlier");
    }

    return lines.join("\n");
  }

  /**
   * Find outliers using IQR method
   */
  private findOutliers(sorted: number[]): number[] {
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return sorted.filter(v => v < lowerBound || v > upperBound);
  }

  /**
   * Get character for scatter plot points
   */
  private getScatterCharacter(index: number): string {
    const chars = ["●", "◆", "▲", "■", "◉", "★", "✦", "◈"];
    return chars[index % chars.length];
  }

  // Helper methods

  private generateYAxisLabels(
    min: number,
    max: number,
    steps: number,
  ): number[] {
    const labels: number[] = [];
    const range = max - min || 1;

    for (let i = 0; i <= 5; i++) {
      labels.push(min + (range * i) / 5);
    }

    return labels;
  }

  private generateXAxisLabels(data: DataPoint[]): string {
    if (data.length === 0) return "";

    const labels: string[] = [];
    const step = Math.max(1, Math.floor(data.length / 5));

    for (let i = 0; i < data.length; i += step) {
      if (data[i].date) {
        labels.push(this.formatDate(data[i].date!));
      } else if (data[i].label) {
        labels.push(data[i].label!);
      }
    }

    return labels.join("     ");
  }

  private formatDate(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  private getBarCharacter(index: number): string {
    const chars = ["█", "▓", "▒", "░", "▪"];
    return chars[index % chars.length];
  }

  private getPieCharacter(index: number): string {
    const chars = ["●", "○", "◆", "◇", "■", "□", "▲", "△"];
    return chars[index % chars.length];
  }

  private getHeatCharacter(normalized: number): string {
    const chars = [" ", "░", "▒", "▓", "█"];
    const index = Math.floor(normalized * (chars.length - 1));
    return chars[Math.min(index, chars.length - 1)];
  }

  private padRight(str: string, length: number): string {
    return str.padEnd(length, " ");
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return " ".repeat(leftPad) + text + " ".repeat(rightPad);
  }
}
