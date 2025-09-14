/**
 * Analytics Cache Layer
 *
 * Provides a sophisticated caching strategy for analytics computations
 * with TTL-based expiration and dependency-aware invalidation.
 */

import { createHash } from "crypto";

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  dependencies: Set<string>;
  hits: number;
  size: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  defaultTTL?: number;           // Default TTL in milliseconds (5 minutes)
  maxSize?: number;              // Maximum cache size in bytes (100MB)
  maxEntries?: number;           // Maximum number of entries (1000)
  cleanupInterval?: number;      // Cleanup interval in milliseconds (60 seconds)
  enableMetrics?: boolean;       // Enable cache metrics collection
  compressionThreshold?: number; // Size threshold for compression (1KB)
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
  avgEntrySize: number;
  topKeys: Array<{ key: string; hits: number }>;
}

/**
 * Dependency types for cache invalidation
 */
export enum CacheDependency {
  DATA = "data",           // Raw data changes
  TIME_RANGE = "time",     // Time range changes
  PLATFORM = "platform",   // Platform filter changes
  CONFIG = "config",       // Configuration changes
  USER = "user",          // User-specific data
}

/**
 * Analytics Cache Layer
 */
export class CacheLayer {
  private cache: Map<string, CacheEntry<any>>;
  private config: Required<CacheConfig>;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;
  private dependencyMap: Map<string, Set<string>>; // dependency -> keys mapping
  private accessLog: Array<{ key: string; timestamp: number }>;

  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.dependencyMap = new Map();
    this.accessLog = [];

    // Initialize configuration with defaults
    this.config = {
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000,        // 5 minutes
      maxSize: config.maxSize ?? 100 * 1024 * 1024,         // 100MB
      maxEntries: config.maxEntries ?? 1000,
      cleanupInterval: config.cleanupInterval ?? 60 * 1000,  // 1 minute
      enableMetrics: config.enableMetrics ?? true,
      compressionThreshold: config.compressionThreshold ?? 1024, // 1KB
    };

    // Initialize statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0,
      hitRate: 0,
      avgEntrySize: 0,
      topKeys: [],
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Generate cache key from parameters
   */
  public generateKey(namespace: string, params: any): string {
    const paramStr = JSON.stringify(this.sortObject(params));
    const hash = createHash("sha256").update(paramStr).digest("hex");
    return `${namespace}:${hash.substring(0, 16)}`;
  }

  /**
   * Get cached value
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update statistics
    entry.hits++;
    this.stats.hits++;
    this.updateHitRate();

    // Log access for LRU tracking
    if (this.config.enableMetrics) {
      this.accessLog.push({ key, timestamp: Date.now() });
      if (this.accessLog.length > 1000) {
        this.accessLog = this.accessLog.slice(-500);
      }
    }

    return entry.data;
  }

  /**
   * Set cache value with optional TTL and dependencies
   */
  public set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      dependencies?: string[];
    } = {}
  ): void {
    const ttl = options.ttl ?? this.config.defaultTTL;
    const dependencies = new Set(options.dependencies ?? []);

    // Calculate entry size
    const size = this.estimateSize(data);

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    if (this.stats.size + size > this.config.maxSize) {
      this.evictBySize(size);
    }

    // Create cache entry
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      dependencies,
      hits: 0,
      size,
    };

    // Update dependency map
    dependencies.forEach(dep => {
      if (!this.dependencyMap.has(dep)) {
        this.dependencyMap.set(dep, new Set());
      }
      this.dependencyMap.get(dep)!.add(key);
    });

    // Store entry
    this.cache.set(key, entry);

    // Update statistics
    this.stats.size += size;
    this.stats.entries = this.cache.size;
    this.updateAvgEntrySize();
  }

  /**
   * Delete cache entry
   */
  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Remove from dependency map
    entry.dependencies.forEach(dep => {
      const keys = this.dependencyMap.get(dep);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.dependencyMap.delete(dep);
        }
      }
    });

    // Update statistics
    this.stats.size -= entry.size;
    this.stats.entries--;

    return this.cache.delete(key);
  }

  /**
   * Invalidate cache entries by dependency
   */
  public invalidateByDependency(dependency: string): number {
    const keys = this.dependencyMap.get(dependency);
    if (!keys) return 0;

    let invalidated = 0;
    keys.forEach(key => {
      if (this.delete(key)) {
        invalidated++;
      }
    });

    this.stats.evictions += invalidated;
    return invalidated;
  }

  /**
   * Invalidate cache entries by pattern
   */
  public invalidateByPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.delete(key));
    this.stats.evictions += keysToDelete.length;

    return keysToDelete.length;
  }

  /**
   * Get all cache keys
   */
  public getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.dependencyMap.clear();
    this.accessLog = [];

    this.stats.size = 0;
    this.stats.entries = 0;
    this.stats.evictions += entriesCleared;
  }

  /**
   * Get cache metrics (alias for getStats)
   */
  public getMetrics(): CacheStats {
    return this.getStats();
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    // Calculate top keys if metrics enabled
    if (this.config.enableMetrics) {
      const keyHits = new Map<string, number>();

      this.cache.forEach((entry, key) => {
        keyHits.set(key, entry.hits);
      });

      this.stats.topKeys = Array.from(keyHits.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, hits]) => ({ key, hits }));
    }

    return { ...this.stats };
  }

  /**
   * Warm up cache with precomputed values
   */
  public async warmUp(
    computations: Array<{
      key: string;
      compute: () => Promise<any>;
      ttl?: number;
      dependencies?: string[];
    }>
  ): Promise<void> {
    const promises = computations.map(async ({ key, compute, ttl, dependencies }) => {
      try {
        const data = await compute();
        this.set(key, data, { ttl, dependencies });
      } catch (error) {
        console.error(`Failed to warm up cache for key ${key}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Memoize a function with caching
   */
  public memoize<T extends (...args: any[]) => any>(
    fn: T,
    options: {
      namespace?: string;
      ttl?: number;
      dependencies?: string[];
      keyGenerator?: (...args: Parameters<T>) => string;
    } = {}
  ): T {
    const namespace = options.namespace ?? fn.name ?? "memoized";

    return ((...args: Parameters<T>) => {
      const key = options.keyGenerator
        ? options.keyGenerator(...args)
        : this.generateKey(namespace, args);

      // Check cache
      const cached = this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Compute and cache result
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.then(data => {
          this.set(key, data, {
            ttl: options.ttl,
            dependencies: options.dependencies,
          });
          return data;
        });
      }

      // Handle sync functions
      this.set(key, result, {
        ttl: options.ttl,
        dependencies: options.dependencies,
      });

      return result;
    }) as T;
  }

  /**
   * Destroy cache and cleanup
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  // Private helper methods

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.delete(key));

    if (keysToDelete.length > 0) {
      this.stats.evictions += keysToDelete.length;
    }
  }

  private evictLRU(): void {
    if (this.accessLog.length === 0) {
      // If no access log, evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.delete(oldestKey);
        this.stats.evictions++;
      }
      return;
    }

    // Find least recently used key
    const accessCounts = new Map<string, number>();
    this.accessLog.forEach(({ key }) => {
      accessCounts.set(key, (accessCounts.get(key) ?? 0) + 1);
    });

    let lruKey: string | null = null;
    let minAccess = Infinity;

    this.cache.forEach((_, key) => {
      const count = accessCounts.get(key) ?? 0;
      if (count < minAccess) {
        minAccess = count;
        lruKey = key;
      }
    });

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
    }
  }

  private evictBySize(requiredSize: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => {
        // Sort by access frequency and age
        const scoreA = a[1].hits / (Date.now() - a[1].timestamp);
        const scoreB = b[1].hits / (Date.now() - b[1].timestamp);
        return scoreA - scoreB;
      });

    let freedSize = 0;
    for (const [key, entry] of entries) {
      if (freedSize >= requiredSize) break;

      freedSize += entry.size;
      this.delete(key);
      this.stats.evictions++;
    }
  }

  private estimateSize(data: any): number {
    const str = JSON.stringify(data);
    return Buffer.byteLength(str, "utf8");
  }

  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObject(item));

    return Object.keys(obj)
      .sort()
      .reduce((sorted: any, key) => {
        sorted[key] = this.sortObject(obj[key]);
        return sorted;
      }, {});
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateAvgEntrySize(): void {
    this.stats.avgEntrySize = this.stats.entries > 0
      ? this.stats.size / this.stats.entries
      : 0;
  }
}

// Export singleton instance for global cache
export const globalCache = new CacheLayer({
  defaultTTL: 5 * 60 * 1000,    // 5 minutes
  maxSize: 100 * 1024 * 1024,   // 100MB
  maxEntries: 1000,
  enableMetrics: true,
});

// Export cache decorator
export function Cacheable(options: {
  ttl?: number;
  namespace?: string;
  dependencies?: string[];
} = {}) {
  return function <T>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> | void {
    // Handle both method and property descriptors
    if (!descriptor) {
      return;
    }

    // Handle getter/setter vs regular method
    const originalMethod = descriptor.value || descriptor.get;
    if (!originalMethod || typeof originalMethod !== 'function') {
      console.warn(`@Cacheable decorator: Cannot apply to non-method property: ${propertyKey}`);
      return descriptor;
    }

    const namespace = options.namespace ?? `${target.constructor.name}.${propertyKey}`;

    // For regular methods
    if (descriptor.value) {
      descriptor.value = function (this: any, ...args: any[]): any {
      const key = globalCache.generateKey(namespace, args);

      // Check cache
      const cached = globalCache.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = originalMethod.apply(this, args);

      // Handle async methods
      if (result instanceof Promise) {
        return result.then((data: any) => {
          globalCache.set(key, data, {
            ttl: options.ttl,
            dependencies: options.dependencies,
          });
          return data;
        });
      }

      // Cache sync result
      globalCache.set(key, result, {
        ttl: options.ttl,
        dependencies: options.dependencies,
      });

      return result;
      } as any;
    }
    // For getters
    else if (descriptor.get) {
      descriptor.get = function (this: any): any {
        const key = globalCache.generateKey(namespace, []);

        // Check cache
        const cached = globalCache.get(key);
        if (cached !== null) {
          return cached;
        }

        // Execute original getter
        const result = originalMethod.apply(this);

        // Cache result
        globalCache.set(key, result, {
          ttl: options.ttl,
          dependencies: options.dependencies,
        });
        return result;
      };
    }

    return descriptor;
  };
}