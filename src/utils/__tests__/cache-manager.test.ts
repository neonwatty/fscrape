import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CacheManager } from "../cache-manager.js";

describe("CacheManager", () => {
  let cacheManager: CacheManager<string>;

  beforeEach(() => {
    cacheManager = new CacheManager<string>({
      enabled: true,
      ttl: 1000,
      maxSize: 10,
      strategy: "lru",
      persistToFile: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    cacheManager.clear();
  });

  describe("Basic Operations", () => {
    it("should set and get values", async () => {
      await cacheManager.set("key1", "value1");
      const value = await cacheManager.get("key1");
      expect(value).toBe("value1");
    });

    it("should return undefined for non-existent keys", async () => {
      const value = await cacheManager.get("nonexistent");
      expect(value).toBeUndefined();
    });

    it("should delete values", async () => {
      await cacheManager.set("key1", "value1");
      const deleted = await cacheManager.delete("key1");
      expect(deleted).toBe(true);

      const value = await cacheManager.get("key1");
      expect(value).toBeUndefined();
    });

    it("should check if key exists", async () => {
      await cacheManager.set("key1", "value1");
      expect(cacheManager.has("key1")).toBe(true);
      expect(cacheManager.has("key2")).toBe(false);
    });

    it("should clear all values", async () => {
      await cacheManager.set("key1", "value1");
      await cacheManager.set("key2", "value2");

      await cacheManager.clear();

      expect(cacheManager.has("key1")).toBe(false);
      expect(cacheManager.has("key2")).toBe(false);
    });
  });

  describe("TTL and Expiration", () => {
    it("should expire values after TTL", async () => {
      // Create cache with short TTL for testing
      const shortTTLCache = new CacheManager<string>({
        enabled: true,
        ttl: 10, // 10ms TTL
        maxSize: 10,
        strategy: "lru",
      });

      await shortTTLCache.set("key1", "value1");
      expect(await shortTTLCache.get("key1")).toBe("value1");

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // LRUCache removes expired items on access
      expect(await shortTTLCache.get("key1")).toBeUndefined();
    });

    it("should use custom TTL when specified", async () => {
      // Create cache with longer default TTL
      const ttlCache = new CacheManager<string>({
        enabled: true,
        ttl: 100, // 100ms default TTL
        maxSize: 10,
        strategy: "lru",
      });

      // Set with custom shorter TTL
      await ttlCache.set("key1", "value1", 10);
      expect(await ttlCache.get("key1")).toBe("value1");

      // Wait for custom TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await ttlCache.get("key1")).toBeUndefined();
    });
  });

  describe("LRU Eviction", () => {
    it("should evict least recently used items when max size reached", async () => {
      const smallCache = new CacheManager<string>({
        enabled: true,
        ttl: 10000,
        maxSize: 3,
        strategy: "lru",
      });

      await smallCache.set("key1", "value1");
      await smallCache.set("key2", "value2");
      await smallCache.set("key3", "value3");

      await smallCache.get("key1");
      await smallCache.get("key2");

      await smallCache.set("key4", "value4");

      expect(smallCache.has("key3")).toBe(false);
      expect(smallCache.has("key1")).toBe(true);
      expect(smallCache.has("key2")).toBe(true);
      expect(smallCache.has("key4")).toBe(true);
    });
  });

  describe("Cache Stats", () => {
    it("should track hits and misses", async () => {
      await cacheManager.set("key1", "value1");

      await cacheManager.get("key1");
      await cacheManager.get("key1");
      await cacheManager.get("nonexistent");

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it("should track cache size", async () => {
      const stats1 = cacheManager.getStats();
      expect(stats1.size).toBe(0);

      await cacheManager.set("key1", "value1");
      await cacheManager.set("key2", "value2");

      const stats2 = cacheManager.getStats();
      expect(stats2.size).toBe(2);
    });

    it("should track evictions", async () => {
      const smallCache = new CacheManager<string>({
        enabled: true,
        ttl: 10000,
        maxSize: 2,
        strategy: "lru",
      });

      await smallCache.set("key1", "value1");
      await smallCache.set("key2", "value2");
      await smallCache.set("key3", "value3");

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe("Fetch Method", () => {
    it("should fetch value if not cached", async () => {
      const fetcher = vi.fn(async () => "fetched-value");

      const value = await cacheManager.fetch("key1", fetcher);

      expect(value).toBe("fetched-value");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(await cacheManager.get("key1")).toBe("fetched-value");
    });

    it("should return cached value without fetching", async () => {
      await cacheManager.set("key1", "cached-value");
      const fetcher = vi.fn(async () => "fetched-value");

      const value = await cacheManager.fetch("key1", fetcher);

      expect(value).toBe("cached-value");
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("should fetch with custom TTL", async () => {
      const ttlCache = new CacheManager<string>({
        enabled: true,
        ttl: 100,
        maxSize: 10,
        strategy: "lru",
      });

      const fetcher = vi.fn(async () => "fetched-value");
      await ttlCache.fetch("key1", fetcher, 10);

      expect(await ttlCache.get("key1")).toBe("fetched-value");

      // Wait for custom TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await ttlCache.get("key1")).toBeUndefined();
    });
  });

  describe("Cache Warmup", () => {
    it("should warm up cache with provided keys", async () => {
      const fetcher = vi.fn(async (key: string) => `value-${key}`);
      const keys = ["key1", "key2", "key3"];

      await cacheManager.warmup(keys, fetcher);

      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(await cacheManager.get("key1")).toBe("value-key1");
      expect(await cacheManager.get("key2")).toBe("value-key2");
      expect(await cacheManager.get("key3")).toBe("value-key3");
    });

    it("should not refetch already cached keys", async () => {
      await cacheManager.set("key1", "existing-value");
      const fetcher = vi.fn(async (key: string) => `value-${key}`);

      await cacheManager.warmup(["key1", "key2"], fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith("key2");
      expect(await cacheManager.get("key1")).toBe("existing-value");
    });
  });

  describe("Cache Pruning", () => {
    it("should prune unused entries", async () => {
      await cacheManager.set("key1", "value1");
      await cacheManager.set("key2", "value2");
      await cacheManager.set("key3", "value3");

      await cacheManager.get("key2");

      const pruned = cacheManager.prune();

      expect(pruned).toBe(2);
      expect(cacheManager.has("key1")).toBe(false);
      expect(cacheManager.has("key2")).toBe(true);
      expect(cacheManager.has("key3")).toBe(false);
    });
  });

  describe("Disabled Cache", () => {
    it("should not cache when disabled", async () => {
      const disabledCache = new CacheManager<string>({
        enabled: false,
      });

      await disabledCache.set("key1", "value1");
      const value = await disabledCache.get("key1");

      expect(value).toBeUndefined();
    });
  });
});
