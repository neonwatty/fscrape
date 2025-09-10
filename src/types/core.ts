import { z } from "zod";

// Base Forum Post Schema and Type
export const ForumPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  author: z.string(),
  authorId: z.string().optional(),
  url: z.string().url(),
  score: z.number().int(),
  commentCount: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  platform: z.enum([
    "reddit",
    "hackernews",
    "discourse",
    "lemmy",
    "lobsters",
    "custom",
  ]),
  metadata: z.record(z.unknown()).optional(),
});

export type ForumPost = z.infer<typeof ForumPostSchema>;

// Comment Schema and Type
export const CommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  parentId: z.string().nullable(),
  author: z.string(),
  authorId: z.string().optional(),
  content: z.string(),
  score: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  depth: z.number().int().nonnegative(),
  platform: z.enum([
    "reddit",
    "hackernews",
    "discourse",
    "lemmy",
    "lobsters",
    "custom",
  ]),
});

export type Comment = z.infer<typeof CommentSchema>;

// User Schema and Type
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  karma: z.number().int().optional(),
  createdAt: z.date().optional(),
  platform: z.enum([
    "reddit",
    "hackernews",
    "discourse",
    "lemmy",
    "lobsters",
    "custom",
  ]),
  metadata: z.record(z.unknown()).optional(),
});

export type User = z.infer<typeof UserSchema>;

// Scrape Result Schema and Type
export const ScrapeResultSchema = z.object({
  posts: z.array(ForumPostSchema),
  comments: z.array(CommentSchema).optional(),
  users: z.array(UserSchema).optional(),
  metadata: z.object({
    scrapedAt: z.date(),
    totalPosts: z.number().int().nonnegative(),
    totalComments: z.number().int().nonnegative().optional(),
    platform: z.enum([
      "reddit",
      "hackernews",
      "discourse",
      "lemmy",
      "lobsters",
      "custom",
    ]),
    query: z.string().optional(),
    subreddit: z.string().optional(),
    category: z.string().optional(),
  }),
});

export type ScrapeResult = z.infer<typeof ScrapeResultSchema>;

// Error Schema and Type
export const ScrapeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  timestamp: z.date(),
  platform: z
    .enum(["reddit", "hackernews", "discourse", "lemmy", "lobsters", "custom"])
    .optional(),
  retryable: z.boolean(),
});

export type ScrapeError = z.infer<typeof ScrapeErrorSchema>;

// Pagination Schema and Type
export const PaginationSchema = z.object({
  limit: z.number().int().positive().default(25),
  offset: z.number().int().nonnegative().default(0),
  after: z.string().optional(),
  before: z.string().optional(),
  page: z.number().int().positive().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Platform Type
export type Platform =
  | "reddit"
  | "hackernews"
  | "discourse"
  | "lemmy"
  | "lobsters"
  | "custom";

// Sort Options
export type SortOption =
  | "hot"
  | "new"
  | "top"
  | "rising"
  | "controversial"
  | "best";

// Time Range for sorting
export type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";
