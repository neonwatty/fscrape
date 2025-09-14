/**
 * Tests for Cached Analytics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CachedAnalytics } from "../cached-analytics.js";
import type { DatabaseAnalytics } from "../../database/analytics.js";

describe("CachedAnalytics", () => {
  let mockAnalytics: DatabaseAnalytics;
  let cachedAnalytics: CachedAnalytics;

  beforeEach(() => {
    // Mock the underlying analytics
    mockAnalytics = {
      getPlatformStats: vi.fn().mockReturnValue({
        platform: "reddit",
        totalPosts: 100,
        totalComments: 500,
        totalUsers: 50,
        avgScore: 25.5,
        avgCommentCount: 5,
        mostActiveUser: null,
        lastUpdateTime: new Date(),
      }),
      getTrendingPosts: vi.fn().mockReturnValue([
        { id: "1", title: "Post 1", score: 100 },
        { id: "2", title: "Post 2", score: 80 },
      ]),
      getTimeSeriesData: vi.fn().mockReturnValue([
        { timestamp: new Date(), posts: 10, comments: 50, users: 5, avgScore: 20 },
      ]),
      getTopAuthors: vi.fn().mockReturnValue([
        { username: "user1", karma: 1000, posts: 50 },
      ]),
      getMostEngagedPosts: vi.fn().mockReturnValue([
        { id: "1", title: "Engaged Post", engagement: 0.8 },
      ]),
      getPostsByDateRange: vi.fn().mockReturnValue([]),
      getDatabaseHealth: vi.fn().mockReturnValue({
        databaseSize: 1000000,
        lastUpdate: new Date(),
        newestPost: new Date(),
      }),
      getDataGaps: vi.fn().mockReturnValue([]),
      getEngagementStats: vi.fn().mockReturnValue({ avgEngagement: 0.75 }),
      getEngagementOverTime: vi.fn().mockReturnValue([]),
      getSessionPerformance: vi.fn().mockReturnValue([]),
      getSuccessfulSessionRate: vi.fn().mockReturnValue(0.95),
      getScrapingPerformance: vi.fn().mockReturnValue(null),
      getDatabaseHealthDetailed: vi.fn().mockReturnValue({
        totalSize: 1000000,
        tableStats: [],
        indexUsage: [],
        vacuumNeeded: false,
      }),
    } as any;

    cachedAnalytics = new CachedAnalytics(mockAnalytics);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Cache Behavior", () => {
    it("should cache getPlatformStats results", () => {
      const result1 = cachedAnalytics.getPlatformStats("reddit");
      const result2 = cachedAnalytics.getPlatformStats("reddit");

      expect(result1).toBe(result2); // Same reference
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(1);
    });

    it("should cache different platforms separately", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getPlatformStats("hackernews");

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2);
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledWith("reddit");
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledWith("hackernews");
    });

    it("should cache getTrendingPosts results", () => {
      const result1 = cachedAnalytics.getTrendingPosts(10);
      const result2 = cachedAnalytics.getTrendingPosts(10);

      expect(result1).toBe(result2);
      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(1);
    });

    it("should cache with different parameters separately", () => {
      cachedAnalytics.getTrendingPosts(10);
      cachedAnalytics.getTrendingPosts(20);

      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(2);
    });

    it("should cache time series data", () => {
      const start = new Date("2024-01-01");
      const end = new Date("2024-01-31");

      const result1 = cachedAnalytics.getTimeSeriesData("reddit", start, end, "daily");
      const result2 = cachedAnalytics.getTimeSeriesData("reddit", start, end, "daily");

      expect(result1).toBe(result2);
      expect(mockAnalytics.getTimeSeriesData).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cache Invalidation", () => {
    it("should clear all cache", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      cachedAnalytics.clearCache();

      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2);
      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(2);
    });

    it("should clear specific cache", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      cachedAnalytics.clearCacheFor("getPlatformStats");

      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2);
      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(1);
    });

    it("should invalidate cache by pattern", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getPlatformStats("hackernews");

      cachedAnalytics.invalidatePattern(/reddit/);

      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getPlatformStats("hackernews");

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(3);
    });
  });

  describe("TTL (Time To Live)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should expire cache after TTL", () => {
      const shortTTL = new CachedAnalytics(mockAnalytics, { ttl: 1000 }); // 1 second

      shortTTL.getPlatformStats("reddit");

      vi.advanceTimersByTime(500);
      shortTTL.getPlatformStats("reddit");
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(600); // Total: 1100ms
      shortTTL.getPlatformStats("reddit");
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2);
    });

    it("should respect different TTLs for different methods", () => {
      const customTTL = new CachedAnalytics(mockAnalytics, {
        ttl: {
          getPlatformStats: 1000,
          getTrendingPosts: 5000,
        },
      });

      customTTL.getPlatformStats("reddit");
      customTTL.getTrendingPosts(10);

      vi.advanceTimersByTime(1100);

      customTTL.getPlatformStats("reddit");
      customTTL.getTrendingPosts(10);

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2);
      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(1);
    });

    it("should handle infinite TTL", () => {
      const infiniteTTL = new CachedAnalytics(mockAnalytics, { ttl: Infinity });

      infiniteTTL.getPlatformStats("reddit");

      vi.advanceTimersByTime(1000000);

      infiniteTTL.getPlatformStats("reddit");

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cache Size Management", () => {
    it("should limit cache size", () => {
      const limitedCache = new CachedAnalytics(mockAnalytics, {
        maxCacheSize: 3,
      });

      // Add 4 items, oldest should be evicted
      limitedCache.getPlatformStats("reddit");
      limitedCache.getPlatformStats("hackernews");
      limitedCache.getPlatformStats("twitter");
      limitedCache.getPlatformStats("facebook");

      // Access first item again - should cause new fetch
      limitedCache.getPlatformStats("reddit");

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(5);
    });

    it("should use LRU eviction", () => {
      const lruCache = new CachedAnalytics(mockAnalytics, {
        maxCacheSize: 3,
        evictionPolicy: "lru",
      });

      lruCache.getPlatformStats("reddit");
      lruCache.getPlatformStats("hackernews");
      lruCache.getPlatformStats("twitter");

      // Access reddit again - moves to front
      lruCache.getPlatformStats("reddit");

      // Add new item - hackernews should be evicted
      lruCache.getPlatformStats("facebook");
      lruCache.getPlatformStats("hackernews");

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(5);
    });

    it("should track cache size", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      const stats = cachedAnalytics.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });
  });

  describe("Cache Statistics", () => {
    it("should track hit rate", () => {
      cachedAnalytics.getPlatformStats("reddit"); // Miss
      cachedAnalytics.getPlatformStats("reddit"); // Hit
      cachedAnalytics.getPlatformStats("reddit"); // Hit

      const stats = cachedAnalytics.getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 1);
    });

    it("should track memory usage", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      const stats = cachedAnalytics.getCacheStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it("should reset statistics", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getPlatformStats("reddit");

      cachedAnalytics.resetStats();

      const stats = cachedAnalytics.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("Warmup", () => {
    it("should warmup cache with common queries", async () => {
      await cachedAnalytics.warmup([
        { method: "getPlatformStats", args: ["reddit"] },
        { method: "getTrendingPosts", args: [10] },
      ]);

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledWith("reddit");
      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledWith(10);

      // Subsequent calls should be cached
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(1);
      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(1);
    });

    it("should warmup in parallel", async () => {
      const start = Date.now();

      await cachedAnalytics.warmup([
        { method: "getPlatformStats", args: ["reddit"] },
        { method: "getPlatformStats", args: ["hackernews"] },
        { method: "getTrendingPosts", args: [10] },
      ]);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be fast (parallel)
    });
  });

  describe("Serialization", () => {
    it("should serialize cache to JSON", () => {
      cachedAnalytics.getPlatformStats("reddit");
      cachedAnalytics.getTrendingPosts(10);

      const serialized = cachedAnalytics.serialize();
      const parsed = JSON.parse(serialized);

      expect(parsed).toHaveProperty("cache");
      expect(parsed).toHaveProperty("stats");
      expect(parsed).toHaveProperty("timestamp");
    });

    it("should deserialize cache from JSON", () => {
      cachedAnalytics.getPlatformStats("reddit");

      const serialized = cachedAnalytics.serialize();
      const newCache = new CachedAnalytics(mockAnalytics);

      newCache.deserialize(serialized);
      newCache.getPlatformStats("reddit");

      // Should use cached value
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid JSON", () => {
      const newCache = new CachedAnalytics(mockAnalytics);

      expect(() => {
        newCache.deserialize("invalid json");
      }).not.toThrow();
    });
  });

  describe("Conditional Caching", () => {
    it("should skip caching based on condition", () => {
      const conditionalCache = new CachedAnalytics(mockAnalytics, {
        shouldCache: (method, args, result) => {
          // Only cache if result has data
          return result && result.length > 0;
        },
      });

      mockAnalytics.getTrendingPosts = vi.fn()
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ id: "1", title: "Post" }]);

      conditionalCache.getTrendingPosts(10); // Empty - not cached
      conditionalCache.getTrendingPosts(10); // Should fetch again

      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(2);

      conditionalCache.getTrendingPosts(10); // Has data - cached
      expect(mockAnalytics.getTrendingPosts).toHaveBeenCalledTimes(2);
    });

    it("should skip caching for specific methods", () => {
      const selectiveCache = new CachedAnalytics(mockAnalytics, {
        excludeMethods: ["getDatabaseHealth"],
      });

      selectiveCache.getDatabaseHealth();
      selectiveCache.getDatabaseHealth();

      expect(mockAnalytics.getDatabaseHealth).toHaveBeenCalledTimes(2);

      selectiveCache.getPlatformStats("reddit");
      selectiveCache.getPlatformStats("reddit");

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("Background Refresh", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should refresh cache in background", () => {
      const bgCache = new CachedAnalytics(mockAnalytics, {
        backgroundRefresh: true,
        refreshInterval: 5000,
      });

      bgCache.getPlatformStats("reddit");

      vi.advanceTimersByTime(5100);

      // Background refresh should have occurred
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2);

      bgCache.stopBackgroundRefresh();
    });

    it("should only refresh accessed items", () => {
      const bgCache = new CachedAnalytics(mockAnalytics, {
        backgroundRefresh: true,
        refreshInterval: 5000,
      });

      bgCache.getPlatformStats("reddit");
      // Don't access hackernews

      vi.advanceTimersByTime(5100);

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledWith("reddit");
      expect(mockAnalytics.getPlatformStats).not.toHaveBeenCalledWith("hackernews");

      bgCache.stopBackgroundRefresh();
    });
  });

  describe("Error Handling", () => {
    it("should not cache errors by default", () => {
      mockAnalytics.getPlatformStats = vi.fn()
        .mockImplementationOnce(() => {
          throw new Error("Network error");
        })
        .mockReturnValueOnce({ platform: "reddit", totalPosts: 100 });

      expect(() => cachedAnalytics.getPlatformStats("reddit")).toThrow();

      const result = cachedAnalytics.getPlatformStats("reddit");
      expect(result).toHaveProperty("totalPosts", 100);
      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(2);
    });

    it("should cache errors if configured", () => {
      const errorCache = new CachedAnalytics(mockAnalytics, {
        cacheErrors: true,
        errorTTL: 1000,
      });

      mockAnalytics.getPlatformStats = vi.fn()
        .mockImplementationOnce(() => {
          throw new Error("Network error");
        });

      expect(() => errorCache.getPlatformStats("reddit")).toThrow();
      expect(() => errorCache.getPlatformStats("reddit")).toThrow();

      expect(mockAnalytics.getPlatformStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("Performance", () => {
    it("should be faster than uncached calls", () => {
      const slowAnalytics = {
        ...mockAnalytics,
        getPlatformStats: vi.fn(() => {
          // Simulate slow operation
          const start = Date.now();
          while (Date.now() - start < 10) {}
          return { platform: "reddit", totalPosts: 100 };
        }),
      };

      const cached = new CachedAnalytics(slowAnalytics as any);

      const start1 = Date.now();
      cached.getPlatformStats("reddit");
      const firstCallTime = Date.now() - start1;

      const start2 = Date.now();
      cached.getPlatformStats("reddit");
      const secondCallTime = Date.now() - start2;

      expect(secondCallTime).toBeLessThan(firstCallTime);
      expect(secondCallTime).toBeLessThan(5);
    });

    it("should handle concurrent requests efficiently", () => {
      let callCount = 0;
      mockAnalytics.getPlatformStats = vi.fn(() => {
        callCount++;
        return { platform: "reddit", totalPosts: 100 };
      });

      // Make multiple concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(cachedAnalytics.getPlatformStats("reddit"))
      );

      return Promise.all(promises).then(() => {
        // Should only call underlying method once
        expect(callCount).toBe(1);
      });
    });
  });
});