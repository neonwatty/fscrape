/**
 * Terminal Visualizer
 * Enhanced terminal visualizations with colors and Unicode support
 */

import chalk from "chalk";

export interface TerminalChartOptions {
  width?: number;
  height?: number;
  useColors?: boolean;
  useUnicode?: boolean;
  style?: "minimal" | "standard" | "rich";
  colorScheme?: "default" | "vibrant" | "pastel" | "monochrome";
}

export interface ColorPalette {
  primary: typeof chalk;
  secondary: typeof chalk;
  accent: typeof chalk;
  success: typeof chalk;
  warning: typeof chalk;
  error: typeof chalk;
  info: typeof chalk;
  muted: typeof chalk;
}

export class TerminalVisualizer {
  private defaultOptions: Required<TerminalChartOptions> = {
    width: 120,
    height: 30,
    useColors: true,
    useUnicode: true,
    style: "rich",
    colorScheme: "default",
  };

  private colorPalettes: Record<string, ColorPalette> = {
    default: {
      primary: chalk.blue,
      secondary: chalk.green,
      accent: chalk.yellow,
      success: chalk.green.bold,
      warning: chalk.yellow.bold,
      error: chalk.red.bold,
      info: chalk.cyan,
      muted: chalk.gray,
    },
    vibrant: {
      primary: chalk.hex("#FF006E"),
      secondary: chalk.hex("#FB5607"),
      accent: chalk.hex("#FFBE0B"),
      success: chalk.hex("#8338EC"),
      warning: chalk.hex("#3A86FF"),
      error: chalk.hex("#FF006E").bold,
      info: chalk.hex("#06FFB4"),
      muted: chalk.hex("#666666"),
    },
    pastel: {
      primary: chalk.hex("#B4A7D6"),
      secondary: chalk.hex("#B6D7A8"),
      accent: chalk.hex("#FFE599"),
      success: chalk.hex("#9FC5E8"),
      warning: chalk.hex("#F6B26B"),
      error: chalk.hex("#EA9999"),
      info: chalk.hex("#A2C4C9"),
      muted: chalk.hex("#CCCCCC"),
    },
    monochrome: {
      primary: chalk.white,
      secondary: chalk.gray,
      accent: chalk.white.bold,
      success: chalk.white,
      warning: chalk.gray,
      error: chalk.white.bold,
      info: chalk.gray,
      muted: chalk.dim,
    },
  };

  private unicodeChars = {
    // Box drawing
    boxTopLeft: "╔",
    boxTopRight: "╗",
    boxBottomLeft: "╚",
    boxBottomRight: "╝",
    boxHorizontal: "═",
    boxVertical: "║",
    boxCross: "╬",
    boxTeeDown: "╦",
    boxTeeUp: "╩",
    boxTeeRight: "╠",
    boxTeeLeft: "╣",

    // Bars
    barFull: "█",
    barSevenEighths: "▇",
    barThreeQuarters: "▆",
    barFiveEighths: "▅",
    barHalf: "▄",
    barThreeEighths: "▃",
    barQuarter: "▂",
    barEighth: "▁",

    // Dots and points
    dotLarge: "●",
    dotMedium: "•",
    dotSmall: "·",
    circleEmpty: "○",
    squareFull: "■",
    squareEmpty: "□",
    diamond: "◆",
    triangleUp: "▲",
    triangleDown: "▼",

    // Arrows
    arrowUp: "↑",
    arrowDown: "↓",
    arrowRight: "→",
    arrowLeft: "←",
    arrowUpDouble: "⇈",
    arrowDownDouble: "⇊",

    // Progress
    progressEmpty: "░",
    progressQuarter: "▒",
    progressHalf: "▓",
    progressFull: "█",

    // Sparkline
    sparkBars: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"],
  };

  private asciiChars = {
    boxTopLeft: "+",
    boxTopRight: "+",
    boxBottomLeft: "+",
    boxBottomRight: "+",
    boxHorizontal: "-",
    boxVertical: "|",
    boxCross: "+",
    boxTeeRight: "|",
    boxTeeLeft: "|",
    barFull: "#",
    barHalf: "=",
    barQuarter: "-",
    dotLarge: "O",
    dotMedium: "o",
    dotSmall: ".",
    arrowUp: "^",
    arrowDown: "v",
    arrowRight: ">",
    arrowLeft: "<",
    progressEmpty: ".",
    progressQuarter: "-",
    progressHalf: "=",
    progressFull: "#",
  };

  constructor(options?: TerminalChartOptions) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Create an enhanced sparkline with colors
   */
  public createSparkline(
    data: number[],
    options?: TerminalChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    if (data.length === 0) return "";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const chars = opts.useUnicode ? this.unicodeChars.sparkBars : [".", "-", "=", "#"];
    const colors = this.getColorPalette(opts.colorScheme);

    return data
      .map((val, index) => {
        const normalized = (val - min) / range;
        const charIndex = Math.floor(normalized * (chars.length - 1));
        const char = chars[charIndex];

        if (!opts.useColors) return char;

        // Color based on value
        if (normalized < 0.33) return colors.error(char);
        if (normalized < 0.66) return colors.warning(char);
        return colors.success(char);
      })
      .join("");
  }

  /**
   * Create a rich progress bar with percentage and time estimate
   */
  public createProgressBar(
    current: number,
    total: number,
    options?: TerminalChartOptions & {
      label?: string;
      showTime?: boolean;
      startTime?: Date;
    },
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const percentage = Math.min(100, (current / total) * 100);
    const width = opts.width || 40;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    const colors = this.getColorPalette(opts.colorScheme);

    const chars = opts.useUnicode ? this.unicodeChars : this.asciiChars;

    let bar = "";

    // Label
    if (options?.label) {
      bar += colors.info(options.label + ": ");
    }

    // Progress bar
    if (opts.useColors) {
      bar += colors.muted("[");
      bar += colors.success(chars.progressFull.repeat(filled));
      bar += colors.muted(chars.progressEmpty.repeat(empty));
      bar += colors.muted("]");
    } else {
      bar += "[" + chars.progressFull.repeat(filled) + chars.progressEmpty.repeat(empty) + "]";
    }

    // Percentage
    const percentStr = ` ${percentage.toFixed(1)}%`;
    if (opts.useColors) {
      if (percentage < 33) bar += colors.error(percentStr);
      else if (percentage < 66) bar += colors.warning(percentStr);
      else bar += colors.success(percentStr);
    } else {
      bar += percentStr;
    }

    // Time estimate
    if (options?.showTime && options.startTime) {
      const elapsed = Date.now() - options.startTime.getTime();
      const estimatedTotal = percentage > 0 ? (elapsed / percentage) * 100 : 0;
      const remaining = estimatedTotal - elapsed;

      const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
      };

      bar += colors.muted(` (${formatTime(remaining)} remaining)`);
    }

    return bar;
  }

  /**
   * Create a heat map with colored cells
   */
  public createHeatMap(
    data: number[][],
    options?: TerminalChartOptions & {
      title?: string;
      rowLabels?: string[];
      colLabels?: string[];
    },
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const colors = this.getColorPalette(opts.colorScheme);
    const lines: string[] = [];

    if (options?.title) {
      lines.push(this.createTitle(options.title, opts));
      lines.push("");
    }

    if (data.length === 0 || data[0].length === 0) {
      return "No data available";
    }

    // Find min and max for normalization
    const flat = data.flat();
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const range = max - min || 1;

    // Column headers
    if (options?.colLabels) {
      let header = "        ";
      options.colLabels.forEach(label => {
        header += this.padCenter(label.substring(0, 8), 10);
      });
      lines.push(colors.info(header));
    }

    // Heat map cells
    const heatChars = opts.useUnicode
      ? [" ", "░", "▒", "▓", "█"]
      : [" ", ".", "-", "=", "#"];

    data.forEach((row, rowIndex) => {
      let line = "";

      // Row label
      if (options?.rowLabels) {
        line += colors.info(this.padRight(options.rowLabels[rowIndex]?.substring(0, 6) || "", 8));
      } else {
        line += "        ";
      }

      // Heat cells
      row.forEach(val => {
        const normalized = (val - min) / range;
        const charIndex = Math.floor(normalized * (heatChars.length - 1));
        const char = heatChars[charIndex];
        const cell = char.repeat(8);

        if (opts.useColors) {
          if (normalized < 0.2) line += colors.primary(cell);
          else if (normalized < 0.4) line += colors.info(cell);
          else if (normalized < 0.6) line += colors.secondary(cell);
          else if (normalized < 0.8) line += colors.warning(cell);
          else line += colors.error(cell);
        } else {
          line += cell;
        }

        line += "  ";
      });

      lines.push(line);
    });

    // Legend
    lines.push("");
    lines.push(colors.muted(`Scale: ${min.toFixed(2)} → ${max.toFixed(2)}`));

    return lines.join("\n");
  }

  /**
   * Create a dashboard layout with multiple visualizations
   */
  public createDashboard(
    sections: Array<{
      title: string;
      content: string;
      position?: "left" | "right" | "center" | "full";
      style?: "box" | "simple";
    }>,
    options?: TerminalChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const colors = this.getColorPalette(opts.colorScheme);
    const chars = opts.useUnicode ? this.unicodeChars : this.asciiChars;
    const lines: string[] = [];

    // Dashboard header
    const headerLine = chars.boxTopLeft + chars.boxHorizontal.repeat(opts.width - 2) + chars.boxTopRight;
    lines.push(colors.primary(headerLine));

    // Process sections
    sections.forEach((section, index) => {
      if (section.style === "box") {
        // Boxed section
        const titleLine = chars.boxVertical + " " +
          colors.accent(this.padCenter(section.title, opts.width - 4)) +
          " " + chars.boxVertical;
        lines.push(colors.primary(titleLine));

        // Separator
        if (index === 0) {
          const sepLine = chars.boxTeeRight + chars.boxHorizontal.repeat(opts.width - 2) + chars.boxTeeLeft;
          lines.push(colors.primary(sepLine));
        }

        // Content
        const contentLines = section.content.split("\n");
        contentLines.forEach(line => {
          const paddedLine = this.padRight(line, opts.width - 4);
          lines.push(colors.primary(chars.boxVertical) + " " + paddedLine + " " + colors.primary(chars.boxVertical));
        });

        // Section separator or bottom
        if (index < sections.length - 1) {
          const sepLine = chars.boxTeeRight + chars.boxHorizontal.repeat(opts.width - 2) + chars.boxTeeLeft;
          lines.push(colors.primary(sepLine));
        }
      } else {
        // Simple section
        lines.push("");
        lines.push(colors.accent(section.title));
        lines.push(colors.muted("-".repeat(section.title.length)));
        lines.push(section.content);
      }
    });

    // Dashboard footer
    const footerLine = chars.boxBottomLeft + chars.boxHorizontal.repeat(opts.width - 2) + chars.boxBottomRight;
    lines.push(colors.primary(footerLine));

    return lines.join("\n");
  }

  /**
   * Create an animated loading spinner
   */
  public createSpinner(
    frame: number,
    message?: string,
    options?: TerminalChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const colors = this.getColorPalette(opts.colorScheme);

    const spinners = {
      unicode: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
      ascii: ["|", "/", "-", "\\"],
      dots: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
      circle: ["◐", "◓", "◑", "◒"],
    };

    const spinnerSet = opts.useUnicode ? spinners.unicode : spinners.ascii;
    const spinner = spinnerSet[frame % spinnerSet.length];

    let output = opts.useColors ? colors.accent(spinner) : spinner;
    if (message) {
      output += " " + message;
    }

    return output;
  }

  /**
   * Create a tree structure visualization
   */
  public createTree(
    data: any,
    indent = 0,
    prefix = "",
    isLast = true,
    options?: TerminalChartOptions,
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const colors = this.getColorPalette(opts.colorScheme);
    const lines: string[] = [];

    const chars = opts.useUnicode
      ? { branch: "├── ", lastBranch: "└── ", vertical: "│   ", empty: "    " }
      : { branch: "|-- ", lastBranch: "`-- ", vertical: "|   ", empty: "    " };

    if (typeof data === "object" && data !== null) {
      const entries = Object.entries(data);
      entries.forEach(([key, value], index) => {
        const isLastItem = index === entries.length - 1;
        const connector = isLastItem ? chars.lastBranch : chars.branch;
        const extension = isLastItem ? chars.empty : chars.vertical;

        const keyStr = opts.useColors ? colors.accent(key) : key;
        lines.push(prefix + connector + keyStr);

        if (typeof value === "object" && value !== null) {
          const subTree = this.createTree(
            value,
            indent + 1,
            prefix + extension,
            isLastItem,
            options,
          );
          lines.push(...subTree.split("\n").filter(l => l));
        } else {
          const valueStr = String(value);
          const coloredValue = opts.useColors
            ? this.colorizeValue(valueStr, colors)
            : valueStr;
          lines.push(prefix + extension + chars.empty + coloredValue);
        }
      });
    }

    return lines.join("\n");
  }

  /**
   * Create a comparison chart with side-by-side bars
   */
  public createComparisonChart(
    data: Array<{ label: string; value1: number; value2: number }>,
    options?: TerminalChartOptions & {
      labels?: [string, string];
      title?: string;
    },
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const colors = this.getColorPalette(opts.colorScheme);
    const lines: string[] = [];

    if (options?.title) {
      lines.push(this.createTitle(options.title, opts));
      lines.push("");
    }

    const maxValue = Math.max(...data.flatMap(d => [d.value1, d.value2]));
    const barWidth = Math.floor((opts.width - 30) / 2);
    const chars = opts.useUnicode ? this.unicodeChars : this.asciiChars;

    // Legend
    if (options?.labels) {
      const legend = `${colors.primary(chars.barFull)} ${options.labels[0]}  ${colors.secondary(chars.barFull)} ${options.labels[1]}`;
      lines.push(legend);
      lines.push("");
    }

    // Bars
    data.forEach(item => {
      const label = this.padRight(item.label.substring(0, 20), 20);
      const bar1Length = Math.floor((item.value1 / maxValue) * barWidth);
      const bar2Length = Math.floor((item.value2 / maxValue) * barWidth);

      const bar1 = chars.barFull.repeat(bar1Length);
      const bar2 = chars.barFull.repeat(bar2Length);

      let line = colors.info(label) + " ";
      line += colors.primary(bar1) + " ";
      line += colors.muted(`${item.value1.toFixed(0)}`.padStart(6));
      line += "  ";
      line += colors.secondary(bar2) + " ";
      line += colors.muted(`${item.value2.toFixed(0)}`.padStart(6));

      lines.push(line);
    });

    return lines.join("\n");
  }

  /**
   * Helper methods
   */
  private getColorPalette(scheme?: string): ColorPalette {
    return this.colorPalettes[scheme || "default"] || this.colorPalettes.default;
  }

  private createTitle(title: string, options: Required<TerminalChartOptions>): string {
    const colors = this.getColorPalette(options.colorScheme);
    const chars = options.useUnicode ? this.unicodeChars : this.asciiChars;

    if (options.style === "rich") {
      const padding = Math.max(0, options.width - title.length - 4) / 2;
      const leftPad = chars.boxHorizontal.repeat(Math.floor(padding));
      const rightPad = chars.boxHorizontal.repeat(Math.ceil(padding));
      return colors.accent(`${leftPad} ${title} ${rightPad}`);
    }

    return colors.accent(this.padCenter(title, options.width));
  }

  private colorizeValue(value: string, colors: ColorPalette): string {
    // Colorize based on value type
    if (/^\d+$/.test(value)) {
      return colors.info(value);
    }
    if (/^true$/i.test(value)) {
      return colors.success(value);
    }
    if (/^false$/i.test(value)) {
      return colors.error(value);
    }
    if (/^null$/i.test(value) || /^undefined$/i.test(value)) {
      return colors.muted(value);
    }
    return value;
  }

  private padRight(str: string, length: number): string {
    return str.padEnd(length, " ");
  }

  private padCenter(str: string, length: number): string {
    const padding = Math.max(0, length - str.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return " ".repeat(leftPad) + str + " ".repeat(rightPad);
  }
}