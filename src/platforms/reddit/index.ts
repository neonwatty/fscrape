/**
 * Reddit platform implementation exports
 */

export { RedditScraper, type RedditScraperConfig } from "./scraper.js";
export { RedditClient, type RedditClientConfig } from "./client.js";
export { RedditAuth, type RedditAuthConfig } from "./auth.js";
export {
  RedditEndpoints,
  QueryParams,
  buildUrl,
  REDDIT_BASE_URL,
} from "./endpoints.js";
export { RedditParsers, RedditValidators } from "./parsers.js";

// Re-export types
export type {
  RedditPost,
  RedditComment,
  RedditUser,
  RedditSubreddit,
  RedditListing,
} from "./client.js";

export type { RedditTokenResponse, RedditAuthState } from "./auth.js";

// Default export for platform registration
import { RedditScraper } from "./scraper.js";
import type { PlatformConstructor } from "../platform-factory.js";
import type winston from "winston";

// Create platform constructor that matches the expected signature
export const RedditPlatform: PlatformConstructor = class extends RedditScraper {
  constructor(_platform: string, config: any, logger?: winston.Logger) {
    super(config, logger);
  }
};

export default RedditPlatform;
