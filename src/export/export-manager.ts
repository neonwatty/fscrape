/**
 * Export manager for handling data exports in various formats
 */

import type { ScrapeResult } from "../types/core.js";
import { CsvExporter } from "./exporters/csv-exporter.js";
import type { CsvExportOptions } from "./exporters/csv-exporter.js";
import { JsonExporter } from "./exporters/json-exporter.js";
import type { JsonExportOptions } from "./exporters/json-exporter.js";
import { MarkdownExporter } from "./exporters/markdown-exporter.js";
import type { MarkdownExportOptions } from "./exporters/markdown-exporter.js";
import { HtmlExporter } from "./exporters/html-exporter.js";
import type { HtmlExportOptions } from "./exporters/html-exporter.js";
import { DataFilter } from "./filters.js";
import type { FilterOptions } from "./filters.js";
import { DataTransformer } from "./transformers.js";
import type { TransformOptions } from "./transformers.js";

export interface ExportConfig {
  outputDirectory: string;
  defaultFormat: string;
  includeMetadata?: boolean;

  // Filter options
  filterOptions?: FilterOptions;

  // Transform options
  transformOptions?: TransformOptions;

  // Format-specific options
  csvOptions?: CsvExportOptions;
  jsonOptions?: JsonExportOptions;
  markdownOptions?: MarkdownExportOptions;
  htmlOptions?: HtmlExportOptions;
}

export class ExportManager {
  private csvExporter: CsvExporter;
  private jsonExporter: JsonExporter;
  private markdownExporter: MarkdownExporter;
  private htmlExporter: HtmlExporter;
  private dataFilter?: DataFilter;
  private dataTransformer?: DataTransformer;
  private includeMetadata: boolean;

  constructor(config: ExportConfig) {
    // Store config
    this.includeMetadata = config.includeMetadata ?? true;

    // Initialize exporters with their specific options
    this.csvExporter = new CsvExporter(config.csvOptions);
    this.jsonExporter = new JsonExporter(config.jsonOptions);
    this.markdownExporter = new MarkdownExporter(config.markdownOptions);
    this.htmlExporter = new HtmlExporter(config.htmlOptions);

    // Initialize filter and transformer if options provided
    if (config.filterOptions) {
      this.dataFilter = new DataFilter(config.filterOptions);
    }

    if (config.transformOptions) {
      this.dataTransformer = new DataTransformer(config.transformOptions);
    }
  }

  /**
   * Export data in specified format with filtering and transformation
   */
  async exportData(
    data: ScrapeResult,
    format: string,
    outputPath: string,
  ): Promise<string | string[]> {
    // Apply filtering if configured
    let processedData = data;
    if (this.dataFilter) {
      processedData = this.dataFilter.filterScrapeResult(data);
    }

    // Apply transformation if configured
    if (this.dataTransformer) {
      processedData = this.dataTransformer.transformScrapeResult(processedData);
    }

    // Add metadata if configured
    if (this.includeMetadata) {
      processedData = {
        ...processedData,
        metadata: {
          ...processedData.metadata,
          ...this.generateMetadata(processedData),
        },
      };
    }

    // Export using the appropriate exporter
    switch (format.toLowerCase()) {
      case "json": {
        const jsonFiles = await this.jsonExporter.export(
          processedData,
          outputPath,
        );
        return jsonFiles.length === 1 ? jsonFiles[0]! : jsonFiles;
      }

      case "csv": {
        const csvFiles = await this.csvExporter.export(
          processedData,
          outputPath,
        );
        return csvFiles.length === 1 ? csvFiles[0]! : csvFiles;
      }

      case "markdown":
      case "md":
        return await this.markdownExporter.export(processedData, outputPath);

      case "html":
        return await this.htmlExporter.export(processedData, outputPath);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export with custom filter options
   */
  async exportWithFilter(
    data: ScrapeResult,
    format: string,
    outputPath: string,
    filterOptions: FilterOptions,
  ): Promise<string | string[]> {
    const filter = new DataFilter(filterOptions);
    const filteredData = filter.filterScrapeResult(data);

    // Apply transformation if configured
    let processedData = filteredData;
    if (this.dataTransformer) {
      processedData = this.dataTransformer.transformScrapeResult(filteredData);
    }

    return this.exportData(processedData, format, outputPath);
  }

  /**
   * Export with custom transform options
   */
  async exportWithTransform(
    data: ScrapeResult,
    format: string,
    outputPath: string,
    transformOptions: TransformOptions,
  ): Promise<string | string[]> {
    const transformer = new DataTransformer(transformOptions);

    // Apply filtering first if configured
    let processedData = data;
    if (this.dataFilter) {
      processedData = this.dataFilter.filterScrapeResult(data);
    }

    // Apply transformation
    processedData = transformer.transformScrapeResult(processedData);

    return this.exportData(processedData, format, outputPath);
  }

  /**
   * Batch export to multiple formats
   */
  async exportToMultipleFormats(
    data: ScrapeResult,
    formats: string[],
    baseOutputPath: string,
  ): Promise<Record<string, string | string[]>> {
    const results: Record<string, string | string[]> = {};

    for (const format of formats) {
      const outputPath = `${baseOutputPath}.${format}`;
      results[format] = await this.exportData(data, format, outputPath);
    }

    return results;
  }

  /**
   * Update filter options
   */
  setFilterOptions(filterOptions: FilterOptions): void {
    this.dataFilter = new DataFilter(filterOptions);
  }

  /**
   * Update transform options
   */
  setTransformOptions(transformOptions: TransformOptions): void {
    this.dataTransformer = new DataTransformer(transformOptions);
  }


  /**
   * Get supported export formats
   */
  static getSupportedFormats(): string[] {
    return ["json", "csv", "markdown", "md", "html"];
  }

  /**
   * Validate export format
   */
  static isFormatSupported(format: string): boolean {
    return ExportManager.getSupportedFormats().includes(format.toLowerCase());
  }

  /**
   * Generate metadata for export
   */
  private generateMetadata(data: ScrapeResult): any {
    return {
      exportDate: new Date().toISOString(),
      totalCount: data.posts.length,
      commentCount: data.comments?.length || 0,
      userCount: data.users?.length || 0,
      platforms: [...new Set(data.posts.map((p) => p.platform))],
      dateRange: {
        earliest: data.posts.reduce(
          (min, p) => (p.createdAt < min ? p.createdAt : min),
          data.posts[0]?.createdAt || new Date(),
        ),
        latest: data.posts.reduce(
          (max, p) => (p.createdAt > max ? p.createdAt : max),
          data.posts[0]?.createdAt || new Date(),
        ),
      },
    };
  }
}
