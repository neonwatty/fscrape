#!/usr/bin/env node
/**
 * fscrape CLI - Main entry point
 *
 * This file serves as the primary entry point for the fscrape CLI tool.
 * It delegates to the complete implementation in cli/index.ts
 */

import { main } from './cli/index.js';

// Execute the main CLI function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
