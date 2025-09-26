/**
 * fscrape - Multi-platform forum scraper
 * Main entry point for the library
 */

export * from './types/index.js';
export * from './platforms/index.js';
export * from './database/index.js';
// Export everything except ExportConfig to avoid conflict
export {
  ExportManager,
  CsvExporter,
  JsonExporter,
  MarkdownExporter,
  HtmlExporter,
  DataFilter,
  FilterPresets,
  FilterChain,
  DataTransformer,
  TransformPresets,
  TransformChain,
} from './export/index.js';
export type {
  CsvExportOptions,
  JsonExportOptions,
  MarkdownExportOptions,
  HtmlExportOptions,
  FilterOptions,
  TransformOptions,
} from './export/index.js';
export * from './session/index.js';
export * from './config/index.js';
export * from './utils/index.js';
