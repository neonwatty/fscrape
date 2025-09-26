/**
 * Supported platforms for scraping
 */
export enum Platform {
  Reddit = 'reddit',
  HackerNews = 'hackernews',
}

/**
 * Type guard to check if a string is a valid platform
 */
export function isPlatform(value: string): value is Platform {
  return Object.values(Platform).includes(value as Platform);
}

/**
 * Convert string to Platform enum
 */
export function toPlatform(value: string): Platform {
  if (!isPlatform(value)) {
    throw new Error(`Invalid platform: ${value}`);
  }
  return value as Platform;
}
