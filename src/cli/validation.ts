/**
 * CLI input validation utilities
 */

import { z } from "zod";
import type { Platform } from "../types/core.js";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Platform validation
 */
export const VALID_PLATFORMS: Platform[] = [
  "reddit",
  "hackernews",
  "discourse",
  "lemmy",
  "lobsters",
  "custom",
];

export function validatePlatform(value: string): Platform {
  if (!VALID_PLATFORMS.includes(value as Platform)) {
    throw new Error(
      `Invalid platform: ${value}. Valid options: ${VALID_PLATFORMS.join(", ")}`,
    );
  }
  return value as Platform;
}

/**
 * URL validation
 */
export function validateUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("URL must use HTTP or HTTPS protocol");
    }
    return value;
  } catch (error) {
    throw new Error(`Invalid URL: ${value}`);
  }
}

/**
 * Path validation
 */
export function validatePath(value: string, mustExist = false): string {
  const resolvedPath = resolve(value);

  if (mustExist && !existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  return resolvedPath;
}

/**
 * Positive integer validation
 */
export function validatePositiveInt(value: string, name: string): number {
  const num = parseInt(value, 10);

  if (isNaN(num) || num <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return num;
}

/**
 * Date/time validation
 */
export function validateDateTime(value: string): Date {
  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date/time: ${value}`);
  }

  return date;
}

/**
 * Scrape options schema
 */
export const ScrapeOptionsSchema = z.object({
  platform: z.enum([
    "reddit",
    "hackernews",
    "discourse",
    "lemmy",
    "lobsters",
    "custom",
  ]),
  limit: z.number().int().positive().optional(),
  sortBy: z.enum(["hot", "new", "top", "controversial", "old"]).optional(),
  timeRange: z.enum(["hour", "day", "week", "month", "year", "all"]).optional(),
  includeComments: z.boolean().optional(),
  maxDepth: z.number().int().positive().optional(),
  output: z.string().optional(),
  format: z.enum(["json", "csv", "markdown", "html"]).optional(),
  database: z.string().optional(),
  config: z.string().optional(),
});

export type ScrapeOptions = z.infer<typeof ScrapeOptionsSchema>;

/**
 * Init options schema
 */
export const InitOptionsSchema = z.object({
  name: z.string().min(1),
  database: z.string().optional(),
  platform: z
    .enum(["reddit", "hackernews", "discourse", "lemmy", "lobsters", "custom"])
    .optional(),
  force: z.boolean().optional(),
});

export type InitOptions = z.infer<typeof InitOptionsSchema>;

/**
 * Status options schema
 */
export const StatusOptionsSchema = z.object({
  database: z.string().optional(),
  format: z.enum(["json", "table", "summary"]).optional(),
  platform: z
    .enum(["reddit", "hackernews", "discourse", "lemmy", "lobsters", "custom"])
    .optional(),
  days: z.number().int().positive().optional(),
});

export type StatusOptions = z.infer<typeof StatusOptionsSchema>;

/**
 * Validate and parse scrape options
 */
export function validateScrapeOptions(options: any): ScrapeOptions {
  try {
    return ScrapeOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      throw new Error(`Invalid options:\n${issues.join("\n")}`);
    }
    throw error;
  }
}

/**
 * Validate and parse init options
 */
export function validateInitOptions(options: any): InitOptions {
  try {
    return InitOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      throw new Error(`Invalid options:\n${issues.join("\n")}`);
    }
    throw error;
  }
}

/**
 * Validate and parse status options
 */
export function validateStatusOptions(options: any): StatusOptions {
  try {
    return StatusOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      throw new Error(`Invalid options:\n${issues.join("\n")}`);
    }
    throw error;
  }
}

/**
 * Check if running in TTY (interactive terminal)
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

/**
 * Format error message for CLI output
 */
export function formatError(error: Error | unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Format success message
 */
export function formatSuccess(message: string): string {
  return `✓ ${message}`;
}

/**
 * Format warning message
 */
export function formatWarning(message: string): string {
  return `⚠ ${message}`;
}

/**
 * Format info message
 */
export function formatInfo(message: string): string {
  return `ℹ ${message}`;
}
