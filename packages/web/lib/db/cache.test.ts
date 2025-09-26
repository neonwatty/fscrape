import { describe, it, expect, afterEach } from 'vitest';
import { LRUCache, generateCacheKey, withCache, clearGlobalCache } from './cache';

describe('LRU Cache', () => {
  let cache: LRUCache<any>;

  afterEach(() => {
    if (cache) {
      cache.stopCleanupTimer();
    }
  });

  describe('Cache Hits and Misses', () => {
    it('should track hits and misses correctly', () => {
      cache = new LRUCache<string>({
        maxEntries: 3,
        defaultTTL: 1000,
        enableStats: true,
      });

      // Test miss
      expect(cache.get('key1')).toBeNull();

      // Test setting and hitting
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key1')).toBe('value1');

      // Test multiple entries
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.entries).toBe(3);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      cache = new LRUCache<string>({
        defaultTTL: 100,
        checkInterval: 50,
      });

      cache.set('expiring', 'value');
      expect(cache.get('expiring')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('expiring')).toBeNull();
      const stats = cache.getStats();
      expect(stats.entries).toBe(0);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries', () => {
      cache = new LRUCache<string>({
        maxEntries: 3,
        enableStats: true,
      });

      // Fill cache to capacity
      cache.set('a', 'valueA');
      cache.set('b', 'valueB');
      cache.set('c', 'valueC');

      // Access 'a' and 'b' to make them more recently used
      cache.get('a');
      cache.get('b');

      // Add new entry - should evict 'c' (least recently used)
      cache.set('d', 'valueD');

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(false);
      expect(cache.has('d')).toBe(true);

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should manage memory size constraints', () => {
      cache = new LRUCache<any>({
        maxSize: 1024,
        enableStats: true,
      });

      // Add small entries
      cache.set('small1', { data: 'a' });
      cache.set('small2', { data: 'b' });

      // Add large entry
      const largeData = {
        data: 'x'.repeat(500),
      };
      cache.set('large', largeData);

      const sizeInfo = cache.getSizeInfo();
      expect(sizeInfo.used).toBeLessThanOrEqual(sizeInfo.max);

      // Add another large entry - should trigger eviction
      cache.set('large2', largeData);

      const finalStats = cache.getStats();
      expect(finalStats.size).toBeLessThanOrEqual(1024);
      expect(finalStats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys regardless of parameter order', () => {
      const key1 = generateCacheKey('getPosts', { limit: 10, offset: 0 });
      const key2 = generateCacheKey('getPosts', { offset: 0, limit: 10 });
      const key3 = generateCacheKey('getPosts', { limit: 20, offset: 0 });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('Cache Decorator', () => {
    it('should cache function results', () => {
      let callCount = 0;

      function expensiveOperation(x: number, y: number): number {
        callCount++;
        return x + y;
      }

      const cachedOperation = withCache(expensiveOperation, {
        keyGenerator: (x, y) => `add:${x}:${y}`,
        ttl: 1000,
      });

      // First call - executes function
      expect(cachedOperation(2, 3)).toBe(5);
      expect(callCount).toBe(1);

      // Second call with same args - uses cache
      expect(cachedOperation(2, 3)).toBe(5);
      expect(callCount).toBe(1);

      // Different args - executes function
      expect(cachedOperation(3, 4)).toBe(7);
      expect(callCount).toBe(2);

      clearGlobalCache();
    });
  });

  describe('Cache Import/Export', () => {
    it('should export and import cache data', () => {
      const cache1 = new LRUCache<string>();

      // Add data to first cache
      cache1.set('key1', 'value1');
      cache1.set('key2', 'value2');
      cache1.set('key3', 'value3');

      // Export data
      const exported = cache1.export();
      expect(exported).toHaveLength(3);

      // Create new cache and import
      const cache2 = new LRUCache<string>();
      cache2.import(exported);

      // Verify imported data
      expect(cache2.get('key1')).toBe('value1');
      expect(cache2.get('key2')).toBe('value2');
      expect(cache2.get('key3')).toBe('value3');

      const stats = cache2.getStats();
      expect(stats.entries).toBe(3);

      cache1.stopCleanupTimer();
      cache2.stopCleanupTimer();
    });
  });

  describe('Cache Performance', () => {
    it('should handle many operations efficiently', () => {
      cache = new LRUCache<number>({
        maxEntries: 1000,
        maxSize: 1024 * 1024,
        enableStats: true,
      });

      const startTime = Date.now();

      // Add many entries
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
      }

      // Access entries randomly
      for (let i = 0; i < 5000; i++) {
        const key = `key${Math.floor(Math.random() * 1000)}`;
        cache.get(key);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      const stats = cache.getStats();
      expect(stats.entries).toBeLessThanOrEqual(1000);
      expect(duration).toBeLessThan(1000);
    });
  });
});
