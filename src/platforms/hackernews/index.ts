/**
 * HackerNews platform module exports
 */

export { HackerNewsScraper } from "./scraper.js";
export type { HackerNewsScraperConfig } from "./scraper.js";

export { HackerNewsClient } from "./client.js";
export type {
  HNItem,
  HNUser,
  HNItemType,
  StoryListType,
  HNClientConfig,
} from "./client.js";

export {
  parsePost,
  parseComment,
  parseUser,
  parseJob,
  parsePoll,
  buildCommentTree,
  cleanContent,
  extractDomain,
  formatRelativeTime,
  parseStoryType,
  batchParseItems,
} from "./parsers.js";

// Default export for platform registration
export { HackerNewsScraper as default } from "./scraper.js";