/**
 * Advanced Query Caching System with LRU eviction and performance tracking
 */

// Cache entry interface
export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  size: number; // Size in bytes
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  hits: number; // Number of times accessed
  lastAccessed: number;
}

// Cache statistics
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number; // Total size in bytes
  entries: number;
  hitRate: number;
  avgEntrySize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

// Cache configuration
export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes (default: 10MB)
  maxEntries: number; // Maximum number of entries (default: 1000)
  defaultTTL: number; // Default TTL in milliseconds (default: 5 minutes)
  checkInterval: number; // Interval for cleanup checks (default: 1 minute)
  enableStats: boolean; // Enable statistics tracking (default: true)
}

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  maxEntries: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  checkInterval: 60 * 1000, // 1 minute
  enableStats: true,
};

/**
 * LRU (Least Recently Used) Cache implementation
 */
export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private accessOrder: string[] = []; // Track access order for LRU

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.stats = this.initStats();

    // Start cleanup timer
    if (this.config.checkInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Initialize statistics
   */
  private initStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0,
      hitRate: 0,
      avgEntrySize: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  /**
   * Calculate size of data in bytes
   */
  private calculateSize(data: T): number {
    try {
      // Simple size estimation
      const str = JSON.stringify(data);
      return new Blob([str]).size;
    } catch {
      // Fallback for non-serializable data
      return 1024; // Default 1KB
    }
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.delete(key);
      if (this.config.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return null;
    }

    // Update access tracking
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);

    if (this.config.enableStats) {
      this.stats.hits++;
      this.updateHitRate();
    }

    return entry.data;
  }

  /**
   * Set value in cache with optional TTL
   */
  set(key: string, data: T, ttl?: number): boolean {
    const size = this.calculateSize(data);

    // Check if single entry exceeds max size
    if (size > this.config.maxSize) {
      console.warn(`Cache entry ${key} exceeds maximum size limit`);
      return false;
    }

    // Evict entries if necessary
    this.evictIfNeeded(size);

    const entry: CacheEntry<T> = {
      key,
      data,
      size,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      hits: 0,
      lastAccessed: Date.now(),
    };

    // Remove old entry if exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.stats.size -= oldEntry.size;
      this.stats.entries--;
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    // Update stats
    if (this.config.enableStats) {
      this.stats.size += size;
      this.stats.entries++;
      this.updateEntryTimestamps();
      this.stats.avgEntrySize = this.stats.size / this.stats.entries;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.removeFromAccessOrder(key);

    if (this.config.enableStats) {
      this.stats.size -= entry.size;
      this.stats.entries--;
      if (this.stats.entries > 0) {
        this.stats.avgEntrySize = this.stats.size / this.stats.entries;
      }
      this.updateEntryTimestamps();
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats = this.initStats();
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict entries if needed to make space
   */
  private evictIfNeeded(requiredSize: number): void {
    // Check max entries limit
    while (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    // Check size limit
    while (this.stats.size + requiredSize > this.config.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    const entry = this.cache.get(lruKey);

    if (entry) {
      this.delete(lruKey);
      if (this.config.enableStats) {
        this.stats.evictions++;
      }
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const _now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.delete(key));
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Update entry timestamp statistics
   */
  private updateEntryTimestamps(): void {
    if (this.cache.size === 0) {
      this.stats.oldestEntry = null;
      this.stats.newestEntry = null;
      return;
    }

    let oldest = Infinity;
    let newest = 0;

    this.cache.forEach((entry) => {
      if (entry.timestamp < oldest) oldest = entry.timestamp;
      if (entry.timestamp > newest) newest = entry.timestamp;
    });

    this.stats.oldestEntry = oldest === Infinity ? null : oldest;
    this.stats.newestEntry = newest === 0 ? null : newest;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache size info
   */
  getSizeInfo(): { used: number; max: number; percentage: number } {
    return {
      used: this.stats.size,
      max: this.config.maxSize,
      percentage: (this.stats.size / this.config.maxSize) * 100,
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get cache entry metadata (without accessing data)
   */
  getEntryInfo(key: string): Omit<CacheEntry<T>, 'data'> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const { data: _data, ...info } = entry;
    return info;
  }

  /**
   * Preload multiple entries
   */
  preload(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  /**
   * Export cache for persistence
   */
  export(): Array<CacheEntry<T>> {
    const entries: CacheEntry<T>[] = [];
    this.cache.forEach((entry) => {
      if (!this.isExpired(entry)) {
        entries.push({ ...entry });
      }
    });
    return entries;
  }

  /**
   * Import cache from export
   */
  import(entries: Array<CacheEntry<T>>): void {
    this.clear();
    entries.forEach((entry) => {
      // Recalculate TTL based on original timestamp
      const elapsed = Date.now() - entry.timestamp;
      const remainingTTL = Math.max(0, entry.ttl - elapsed);

      if (remainingTTL > 0) {
        this.cache.set(entry.key, {
          ...entry,
          timestamp: Date.now(),
          ttl: remainingTTL,
        });
        this.updateAccessOrder(entry.key);
      }
    });

    // Recalculate stats
    this.recalculateStats();
  }

  /**
   * Recalculate statistics
   */
  private recalculateStats(): void {
    this.stats.entries = this.cache.size;
    this.stats.size = 0;

    this.cache.forEach((entry) => {
      this.stats.size += entry.size;
    });

    if (this.stats.entries > 0) {
      this.stats.avgEntrySize = this.stats.size / this.stats.entries;
    }

    this.updateEntryTimestamps();
  }
}

/**
 * Create a singleton cache instance for database queries
 */
let globalCache: LRUCache | null = null;

export function getGlobalCache(config?: Partial<CacheConfig>): LRUCache {
  if (!globalCache) {
    globalCache = new LRUCache(config);
  }
  return globalCache;
}

export function clearGlobalCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
}

export function destroyGlobalCache(): void {
  if (globalCache) {
    globalCache.stopCleanupTimer();
    globalCache.clear();
    globalCache = null;
  }
}

/**
 * Cache key generator for database queries
 */
export function generateCacheKey(queryType: string, params: Record<string, unknown> = {}): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>
    );

  return `${queryType}:${JSON.stringify(sortedParams)}`;
}

/**
 * Cache decorator for functions
 */
export function withCache<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number;
    cache?: LRUCache;
  } = {}
): T {
  const cache = options.cache || getGlobalCache();
  const keyGen = options.keyGenerator || ((...args) => JSON.stringify(args));

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGen(...args);

    // Check cache
    const cached = cache.get(key);
    if (cached !== null) {
      return cached as ReturnType<T>;
    }

    // Execute function
    const result = fn(...args);

    // Store in cache
    cache.set(key, result, options.ttl);

    return result;
  }) as T;
}
