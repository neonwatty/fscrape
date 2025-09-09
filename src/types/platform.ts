import { z } from "zod";
import type { Platform, SortOption, TimeRange } from "./core.js";
import { RateLimitConfigSchema, QueryConfigSchema } from "./config.js";

// Reddit-specific Configuration Schema and Type
export const RedditConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
  refreshToken: z.string().optional(),
  accessToken: z.string().optional(),
  userAgent: z.string().default("fscrape:v1.0.0"),
  subreddit: z.string().optional(),
  sort: z.enum(["hot", "new", "top", "rising", "controversial"]).default("hot"),
  timeRange: z
    .enum(["hour", "day", "week", "month", "year", "all"])
    .default("day"),
  includeNSFW: z.boolean().default(false),
  includeStickied: z.boolean().default(true),
  expandComments: z.boolean().default(false),
  commentSort: z
    .enum(["best", "top", "new", "controversial", "old", "qa"])
    .default("best"),
});

export type RedditConfig = z.infer<typeof RedditConfigSchema>;

// HackerNews-specific Configuration Schema and Type
export const HackerNewsConfigSchema = z.object({
  baseUrl: z.string().url().default("https://hacker-news.firebaseio.com/v0"),
  algoliaUrl: z.string().url().default("https://hn.algolia.com/api/v1"),
  useAlgolia: z.boolean().default(true),
  category: z.enum(["top", "new", "best", "ask", "show", "job"]).default("top"),
  includeJobStories: z.boolean().default(false),
  includePollOptions: z.boolean().default(true),
  fetchDeadItems: z.boolean().default(false),
  fetchDeletedItems: z.boolean().default(false),
});

export type HackerNewsConfig = z.infer<typeof HackerNewsConfigSchema>;

// Unified Platform Configuration Schema and Type
export const PlatformConfigSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("reddit"),
    config: RedditConfigSchema,
    rateLimit: RateLimitConfigSchema.optional(),
    query: QueryConfigSchema.optional(),
  }),
  z.object({
    platform: z.literal("hackernews"),
    config: HackerNewsConfigSchema,
    rateLimit: RateLimitConfigSchema.optional(),
    query: QueryConfigSchema.optional(),
  }),
]);

export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

// API Endpoint Configuration
export const APIEndpointSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  params: z.record(z.unknown()).optional(),
  requiresAuth: z.boolean().default(false),
  rateLimit: RateLimitConfigSchema.optional(),
});

export type APIEndpoint = z.infer<typeof APIEndpointSchema>;

// Authentication Configuration
export const AuthConfigSchema = z.object({
  type: z.enum(["oauth2", "apikey", "basic", "bearer", "custom"]),
  credentials: z.record(z.string()),
  tokenEndpoint: z.string().url().optional(),
  refreshEndpoint: z.string().url().optional(),
  expiresIn: z.number().optional(),
  scope: z.array(z.string()).optional(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// Platform Session State
export const SessionStateSchema = z.object({
  platform: z.custom<Platform>(),
  authenticated: z.boolean().default(false),
  sessionId: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.date().optional(),
  rateLimitRemaining: z.number().optional(),
  rateLimitReset: z.date().optional(),
  lastRequest: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

// Platform Capabilities
export const PlatformCapabilitiesSchema = z.object({
  platform: z.custom<Platform>(),
  supportsComments: z.boolean(),
  supportsUserProfiles: z.boolean(),
  supportsSearch: z.boolean(),
  supportsFiltering: z.boolean(),
  supportsPagination: z.boolean(),
  supportsRealtime: z.boolean(),
  maxItemsPerRequest: z.number().int().positive(),
  availableSortOptions: z.array(z.custom<SortOption>()),
  availableTimeRanges: z.array(z.custom<TimeRange>()),
  requiresAuthentication: z.boolean(),
});

export type PlatformCapabilities = z.infer<typeof PlatformCapabilitiesSchema>;

// Platform Response Metadata
export const PlatformResponseMetadataSchema = z.object({
  platform: z.custom<Platform>(),
  requestId: z.string().optional(),
  timestamp: z.date(),
  responseTime: z.number(), // milliseconds
  rateLimitRemaining: z.number().optional(),
  rateLimitReset: z.date().optional(),
  nextPageToken: z.string().optional(),
  hasMore: z.boolean(),
  totalResults: z.number().optional(),
});

export type PlatformResponseMetadata = z.infer<
  typeof PlatformResponseMetadataSchema
>;
