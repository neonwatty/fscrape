# Complete Removal Plan: All Visualization & Analytics Features

## Overview
Remove all visualization, charting, analytics, and reporting functionality from fscrape, keeping only core scraping, database storage, and basic data export capabilities.

## 1. CLI Commands to Remove

### A. Complete Commands
- **`visualize` (alias: `viz`)** - Remove entirely from `/src/cli/commands/visualize.ts`
- **`analyze`** - Remove entirely from `/src/cli/commands/analyze.ts`
  - All subcommands: `statistics`, `trends`, `anomalies`, `forecast`, `compare`, `report`, `dashboard`

### B. CLI Registration Removal
- Remove from `/src/cli/index.ts`:
  - `import { visualizeCommand }` (line 15)
  - `import { createAnalyzeCommand }` (line 14)
  - `program.addCommand(createAnalyzeCommand())` (line 68)
  - `program.addCommand(visualizeCommand)` (line 69)

## 2. Source Files to Delete (55+ files)

### A. Analytics Directory (Complete Removal)
```
/src/analytics/
├── __tests__/ (18 test files)
├── statistics.ts
├── anomaly-detector.ts
├── trend-analyzer.ts
├── forecasting.ts
├── cache-layer.ts
├── cached-analytics.ts
├── dashboard.ts
├── terminal-visualizer.ts
├── report-generator.ts
├── svg-generator.ts
└── visualizer.ts
```

### B. Analytics-Specific Export Files
```
/src/export/exporters/
├── analytics-exporter.ts
├── analytics-csv-exporter.ts
├── analytics-json-exporter.ts
└── __tests__/analytics-exporters.test.ts
```

### C. Database Analytics
```
/src/database/analytics.ts
```

### D. Config Files
```
/src/config/analytics-config.ts
```

### E. E2E Test Directory
```
/e2e/analytics/ (complete directory)
├── full-workflow.test.ts
├── dashboard-interaction.test.ts
├── trend-analysis.spec.ts
└── export-workflows.spec.ts
```

### F. Built Files (dist/)
- All corresponding `.d.ts` files in `/dist/analytics/`
- All corresponding `.d.ts` files in `/dist/export/exporters/` for analytics

## 3. Code Modifications Required

### A. Update `/src/export/export-manager.ts`
- Remove analytics-related imports and functionality
- Keep only basic CSV, JSON, HTML, Markdown exporters

### B. Update `/src/config/default-config.ts`
- Remove analytics configuration sections

### C. Update `/src/config/config-validator.ts`
- Remove analytics config validation

### D. Update `/package.json`
- **Dependencies to potentially remove:**
  - `cli-table3` (if only used for analytics tables)
  - `table` (if only used for analytics)
  - `date-fns` (if only used for analytics time handling)
  - Keep core dependencies: `chalk`, `ora`, `commander`, etc.

### E. Update README.md
- Remove analytics and visualization examples
- Remove analytics commands from documentation
- Keep only: `scrape`, `status`, `export`, `list`, `config`, `init`, `clean`

## 4. Database Schema Updates

### A. Remove Analytics Tables/Views
- Remove analytics-related materialized views from migrations
- Remove analytics columns from posts/comments tables if they exist
- Keep core tables: `posts`, `comments`, `users`, `sessions`

## 5. Type Definitions Cleanup

### A. Update `/src/types/core.ts`
- Remove analytics-related interfaces and types
- Keep: `ForumPost`, `Comment`, `User`, `ScrapeResult`, etc.

### B. Update other type files
- Remove analytics imports from other modules

## 6. What to Keep

### A. Core CLI Commands
- `scrape` - Core scraping functionality
- `status` - Basic database statistics
- `export` - Basic data export (JSON, CSV, HTML, Markdown)
- `list` - View/browse scraped data
- `config` - Configuration management
- `init` - Project initialization
- `clean` - Database cleanup
- `batch` - Batch operations

### B. Core Export Functionality
- JSON export for raw data
- CSV export for spreadsheets
- HTML export for readable reports
- Markdown export for documentation

### C. Database Core
- Basic database operations
- Core schema (posts, comments, users)
- Migration system
- Basic statistics in status command

## 7. Testing Updates
- Remove all analytics test files
- Update integration tests to remove analytics workflows
- Keep core scraping and export tests

## 8. Build Process
- Update TypeScript compilation to exclude removed files
- Clean up any build scripts that reference analytics

## Estimated Impact
- **~55 files removed**
- **~15,000+ lines of code eliminated**
- **Simpler, focused codebase**
- **Reduced bundle size**
- **Fewer dependencies**

This plan transforms fscrape from a comprehensive analytics platform into a focused, efficient forum scraping tool with basic data export capabilities.