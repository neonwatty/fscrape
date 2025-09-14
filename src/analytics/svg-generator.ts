/**
 * SVG Chart Generator
 * Generates SVG charts from analytics data
 */

export interface SvgChartOptions {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltips?: boolean;
  animation?: boolean;
  theme?: "light" | "dark" | "custom";
  customColors?: {
    background?: string;
    text?: string;
    grid?: string;
    axis?: string;
  };
}

export interface SvgElement {
  tag: string;
  attributes: Record<string, string | number>;
  children?: (SvgElement | string)[];
}

export class SvgGenerator {
  private defaultOptions: Required<SvgChartOptions> = {
    width: 800,
    height: 400,
    margin: { top: 40, right: 40, bottom: 60, left: 60 },
    colors: ["#4299E1", "#48BB78", "#ED8936", "#9F7AEA", "#F56565", "#38B2AC"],
    showGrid: true,
    showLegend: true,
    showTooltips: false,
    animation: false,
    theme: "light",
    customColors: {
      background: "#FFFFFF",
      text: "#2D3748",
      grid: "#E2E8F0",
      axis: "#4A5568",
    },
  };

  constructor(options?: SvgChartOptions) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    this.applyTheme();
  }

  /**
   * Generate SVG line chart
   */
  public generateLineChart(
    data: Array<{ x: number | Date; y: number; label?: string }>,
    title?: string,
    options?: SvgChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const chartWidth = opts.width - opts.margin.left - opts.margin.right;
    const chartHeight = opts.height - opts.margin.top - opts.margin.bottom;

    // Calculate scales
    const xValues = data.map(d => d.x instanceof Date ? d.x.getTime() : d.x);
    const yValues = data.map(d => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xScale = (val: number) => ((val - xMin) / (xMax - xMin)) * chartWidth;
    const yScale = (val: number) => chartHeight - ((val - yMin) / (yMax - yMin)) * chartHeight;

    // Build SVG elements
    const elements: SvgElement[] = [];

    // Background
    elements.push({
      tag: "rect",
      attributes: {
        width: opts.width,
        height: opts.height,
        fill: opts.customColors.background!,
      },
    });

    // Chart group
    const chartGroup: SvgElement = {
      tag: "g",
      attributes: {
        transform: `translate(${opts.margin.left},${opts.margin.top})`,
      },
      children: [],
    };

    // Grid
    if (opts.showGrid) {
      chartGroup.children!.push(this.generateGrid(chartWidth, chartHeight, opts));
    }

    // Axes
    chartGroup.children!.push(this.generateAxes(chartWidth, chartHeight, xMin, xMax, yMin, yMax, opts));

    // Line path
    const pathData = data.map((d, i) => {
      const x = xScale(d.x instanceof Date ? d.x.getTime() : d.x);
      const y = yScale(d.y);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");

    chartGroup.children!.push({
      tag: "path",
      attributes: {
        d: pathData,
        fill: "none",
        stroke: opts.colors[0],
        "stroke-width": 2,
      },
    });

    // Data points
    data.forEach(d => {
      const x = xScale(d.x instanceof Date ? d.x.getTime() : d.x);
      const y = yScale(d.y);

      chartGroup.children!.push({
        tag: "circle",
        attributes: {
          cx: x,
          cy: y,
          r: 4,
          fill: opts.colors[0],
        },
      });
    });

    elements.push(chartGroup);

    // Title
    if (title) {
      elements.push({
        tag: "text",
        attributes: {
          x: opts.width / 2,
          y: 25,
          "text-anchor": "middle",
          "font-size": 18,
          "font-weight": "bold",
          fill: opts.customColors.text!,
        },
        children: [title],
      });
    }

    return this.renderSvg(opts.width, opts.height, elements);
  }

  /**
   * Generate SVG bar chart
   */
  public generateBarChart(
    data: Array<{ label: string; values: Record<string, number> }>,
    title?: string,
    options?: SvgChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const chartWidth = opts.width - opts.margin.left - opts.margin.right;
    const chartHeight = opts.height - opts.margin.top - opts.margin.bottom;

    // Get series names
    const series = Object.keys(data[0].values);
    const maxValue = Math.max(...data.flatMap(d => Object.values(d.values)));

    // Calculate bar dimensions
    const barGroupWidth = chartWidth / data.length;
    const barWidth = barGroupWidth / (series.length + 1);
    const yScale = (val: number) => chartHeight - (val / maxValue) * chartHeight;

    // Build SVG elements
    const elements: SvgElement[] = [];

    // Background
    elements.push({
      tag: "rect",
      attributes: {
        width: opts.width,
        height: opts.height,
        fill: opts.customColors.background!,
      },
    });

    // Chart group
    const chartGroup: SvgElement = {
      tag: "g",
      attributes: {
        transform: `translate(${opts.margin.left},${opts.margin.top})`,
      },
      children: [],
    };

    // Grid
    if (opts.showGrid) {
      chartGroup.children!.push(this.generateGrid(chartWidth, chartHeight, opts));
    }

    // Bars
    data.forEach((item, itemIndex) => {
      series.forEach((s, seriesIndex) => {
        const value = item.values[s];
        const x = itemIndex * barGroupWidth + seriesIndex * barWidth + barWidth / 2;
        const y = yScale(value);
        const height = chartHeight - y;

        chartGroup.children!.push({
          tag: "rect",
          attributes: {
            x,
            y,
            width: barWidth * 0.8,
            height,
            fill: opts.colors[seriesIndex % opts.colors.length],
          },
        });
      });

      // X-axis labels
      chartGroup.children!.push({
        tag: "text",
        attributes: {
          x: itemIndex * barGroupWidth + barGroupWidth / 2,
          y: chartHeight + 20,
          "text-anchor": "middle",
          "font-size": 12,
          fill: opts.customColors.text!,
        },
        children: [item.label],
      });
    });

    // Y-axis
    chartGroup.children!.push(this.generateYAxis(chartHeight, 0, maxValue, opts));

    elements.push(chartGroup);

    // Title
    if (title) {
      elements.push({
        tag: "text",
        attributes: {
          x: opts.width / 2,
          y: 25,
          "text-anchor": "middle",
          "font-size": 18,
          "font-weight": "bold",
          fill: opts.customColors.text!,
        },
        children: [title],
      });
    }

    // Legend
    if (opts.showLegend && series.length > 1) {
      elements.push(this.generateLegend(series, opts));
    }

    return this.renderSvg(opts.width, opts.height, elements);
  }

  /**
   * Generate SVG pie chart
   */
  public generatePieChart(
    data: Array<{ label: string; value: number }>,
    title?: string,
    options?: SvgChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const centerX = opts.width / 2;
    const centerY = opts.height / 2;
    const radius = Math.min(opts.width, opts.height) / 3;

    const total = data.reduce((sum, item) => sum + item.value, 0);

    // Build SVG elements
    const elements: SvgElement[] = [];

    // Background
    elements.push({
      tag: "rect",
      attributes: {
        width: opts.width,
        height: opts.height,
        fill: opts.customColors.background!,
      },
    });

    // Pie slices
    let currentAngle = -Math.PI / 2; // Start at top
    data.forEach((item, index) => {
      const percentage = item.value / total;
      const angle = percentage * 2 * Math.PI;
      const endAngle = currentAngle + angle;

      // Calculate path
      const x1 = centerX + radius * Math.cos(currentAngle);
      const y1 = centerY + radius * Math.sin(currentAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const largeArcFlag = angle > Math.PI ? 1 : 0;

      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        "Z",
      ].join(" ");

      elements.push({
        tag: "path",
        attributes: {
          d: pathData,
          fill: opts.colors[index % opts.colors.length],
          stroke: opts.customColors.background!,
          "stroke-width": 2,
        },
      });

      // Label
      const labelAngle = currentAngle + angle / 2;
      const labelRadius = radius * 0.7;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);

      elements.push({
        tag: "text",
        attributes: {
          x: labelX,
          y: labelY,
          "text-anchor": "middle",
          "font-size": 14,
          fill: "#FFFFFF",
          "font-weight": "bold",
        },
        children: [`${(percentage * 100).toFixed(1)}%`],
      });

      currentAngle = endAngle;
    });

    // Title
    if (title) {
      elements.push({
        tag: "text",
        attributes: {
          x: opts.width / 2,
          y: 25,
          "text-anchor": "middle",
          "font-size": 18,
          "font-weight": "bold",
          fill: opts.customColors.text!,
        },
        children: [title],
      });
    }

    // Legend
    if (opts.showLegend) {
      const legendY = opts.height - data.length * 20 - 20;
      data.forEach((item, index) => {
        elements.push({
          tag: "rect",
          attributes: {
            x: 20,
            y: legendY + index * 20,
            width: 15,
            height: 15,
            fill: opts.colors[index % opts.colors.length],
          },
        });

        elements.push({
          tag: "text",
          attributes: {
            x: 40,
            y: legendY + index * 20 + 12,
            "font-size": 12,
            fill: opts.customColors.text!,
          },
          children: [`${item.label}: ${item.value} (${((item.value / total) * 100).toFixed(1)}%)`],
        });
      });
    }

    return this.renderSvg(opts.width, opts.height, elements);
  }

  /**
   * Generate grid lines
   */
  private generateGrid(width: number, height: number, options: Required<SvgChartOptions>): SvgElement {
    const group: SvgElement = {
      tag: "g",
      attributes: { class: "grid" },
      children: [],
    };

    // Horizontal lines
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      group.children!.push({
        tag: "line",
        attributes: {
          x1: 0,
          y1: y,
          x2: width,
          y2: y,
          stroke: options.customColors.grid!,
          "stroke-width": 1,
          "stroke-dasharray": "2,2",
        },
      });
    }

    // Vertical lines
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      group.children!.push({
        tag: "line",
        attributes: {
          x1: x,
          y1: 0,
          x2: x,
          y2: height,
          stroke: options.customColors.grid!,
          "stroke-width": 1,
          "stroke-dasharray": "2,2",
        },
      });
    }

    return group;
  }

  /**
   * Generate axes
   */
  private generateAxes(
    width: number,
    height: number,
    _xMin: number,
    _xMax: number,
    yMin: number,
    yMax: number,
    options: Required<SvgChartOptions>,
  ): SvgElement {
    const group: SvgElement = {
      tag: "g",
      attributes: { class: "axes" },
      children: [],
    };

    // X-axis
    group.children!.push({
      tag: "line",
      attributes: {
        x1: 0,
        y1: height,
        x2: width,
        y2: height,
        stroke: options.customColors.axis!,
        "stroke-width": 2,
      },
    });

    // Y-axis
    group.children!.push({
      tag: "line",
      attributes: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: height,
        stroke: options.customColors.axis!,
        "stroke-width": 2,
      },
    });

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const y = height - (height / 5) * i;
      const value = yMin + ((yMax - yMin) / 5) * i;

      group.children!.push({
        tag: "text",
        attributes: {
          x: -10,
          y: y + 5,
          "text-anchor": "end",
          "font-size": 12,
          fill: options.customColors.text!,
        },
        children: [value.toFixed(1)],
      });
    }

    return group;
  }

  /**
   * Generate Y-axis
   */
  private generateYAxis(height: number, min: number, max: number, options: Required<SvgChartOptions>): SvgElement {
    const group: SvgElement = {
      tag: "g",
      attributes: { class: "y-axis" },
      children: [],
    };

    // Axis line
    group.children!.push({
      tag: "line",
      attributes: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: height,
        stroke: options.customColors.axis!,
        "stroke-width": 2,
      },
    });

    // Labels
    for (let i = 0; i <= 5; i++) {
      const y = height - (height / 5) * i;
      const value = min + ((max - min) / 5) * i;

      group.children!.push({
        tag: "text",
        attributes: {
          x: -10,
          y: y + 5,
          "text-anchor": "end",
          "font-size": 12,
          fill: options.customColors.text!,
        },
        children: [value.toFixed(0)],
      });
    }

    return group;
  }

  /**
   * Generate legend
   */
  private generateLegend(series: string[], options: Required<SvgChartOptions>): SvgElement {
    const group: SvgElement = {
      tag: "g",
      attributes: {
        transform: `translate(${options.width - 150}, 50)`,
      },
      children: [],
    };

    series.forEach((s, index) => {
      group.children!.push({
        tag: "rect",
        attributes: {
          x: 0,
          y: index * 25,
          width: 15,
          height: 15,
          fill: options.colors[index % options.colors.length],
        },
      });

      group.children!.push({
        tag: "text",
        attributes: {
          x: 20,
          y: index * 25 + 12,
          "font-size": 12,
          fill: options.customColors.text!,
        },
        children: [s],
      });
    });

    return group;
  }

  /**
   * Apply theme colors
   */
  private applyTheme(): void {
    if (this.defaultOptions.theme === "dark") {
      this.defaultOptions.customColors = {
        background: "#1A202C",
        text: "#E2E8F0",
        grid: "#2D3748",
        axis: "#718096",
      };
    }
  }

  /**
   * Render SVG elements to string
   */
  private renderSvg(width: number, height: number, elements: SvgElement[]): string {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" version="1.1">
${elements.map(el => this.renderElement(el, 1)).join("\n")}
</svg>`;

    return svg;
  }

  /**
   * Render individual SVG element
   */
  private renderElement(element: SvgElement, indent = 0): string {
    const indentStr = "  ".repeat(indent);
    const attrs = Object.entries(element.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");

    if (!element.children || element.children.length === 0) {
      return `${indentStr}<${element.tag} ${attrs}/>`;
    }

    const children = element.children
      .map(child => {
        if (typeof child === "string") {
          return `${indentStr}  ${child}`;
        }
        return this.renderElement(child, indent + 1);
      })
      .join("\n");

    return `${indentStr}<${element.tag} ${attrs}>
${children}
${indentStr}</${element.tag}>`;
  }
}