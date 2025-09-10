import { LRUCache } from "lru-cache";
import type { CacheConfig } from "../types/config.js";
import { createLogger } from "./enhanced-logger.js";
import fs from "fs/promises";
import path from "path";

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
  evictions: number;
}

export class CacheManager<T = unknown> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private stats: CacheStats;
  private config: CacheConfig;
  private logger = createLogger("CacheManager");
  private persistPath?: string;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      ttl: config.ttl ?? 3600000,
      maxSize: config.maxSize ?? 100,
      strategy: config.strategy ?? "lru",
      persistToFile: config.persistToFile ?? false,
      cacheDir: config.cacheDir,
    };

    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      dispose: (value, key) => {
        this.stats.evictions++;
        this.logger.debug(`Cache entry evicted: ${key}`);
      },
      sizeCalculation: (value) => {
        const size = JSON.stringify(value).length;
        return Math.ceil(size / 1024);
      },
      maxSize: this.config.maxSize * 1024,
    });

    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize: this.config.maxSize,
      hitRate: 0,
      evictions: 0,
    };

    if (this.config.persistToFile && this.config.cacheDir) {
      this.persistPath = path.join(this.config.cacheDir, "cache.json");
      this.loadFromDisk().catch((err) => {
        this.logger.warn("Failed to load cache from disk:", err);
      });
    }
  }

  async get(key: string): Promise<T | undefined> {
    if (!this.config.enabled) {
      return undefined;
    }

    const entry = this.cache.get(key);

    if (entry) {
      this.stats.hits++;
      entry.hits++;
      this.updateHitRate();
      this.logger.debug(`Cache hit for key: ${key}`);
      return entry.value;
    }

    this.stats.misses++;
    this.updateHitRate();
    this.logger.debug(`Cache miss for key: ${key}`);
    return undefined;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
    };

    const options = ttl ? { ttl } : undefined;
    this.cache.set(key, entry, options);
    this.stats.size = this.cache.size;

    this.logger.debug(`Cache set for key: ${key}`);

    if (this.config.persistToFile) {
      await this.saveToDisk().catch((err) => {
        this.logger.warn("Failed to persist cache to disk:", err);
      });
    }
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;

    if (deleted) {
      this.logger.debug(`Cache entry deleted: ${key}`);
    }

    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      ...this.stats,
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
    };

    this.logger.info("Cache cleared");

    if (this.config.persistToFile && this.persistPath) {
      await fs.unlink(this.persistPath).catch(() => {});
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
    };
  }

  async fetch(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);

    return value;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private async saveToDisk(): Promise<void> {
    if (!this.persistPath) {
      return;
    }

    const data = {
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        value,
      })),
      stats: this.stats,
      timestamp: Date.now(),
    };

    await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
    await fs.writeFile(this.persistPath, JSON.stringify(data, null, 2));
  }

  private async loadFromDisk(): Promise<void> {
    if (!this.persistPath) {
      return;
    }

    try {
      const content = await fs.readFile(this.persistPath, "utf-8");
      const data = JSON.parse(content);

      if (data.entries && Array.isArray(data.entries)) {
        for (const { key, value } of data.entries) {
          this.cache.set(key, value);
        }
      }

      if (data.stats) {
        this.stats = { ...this.stats, ...data.stats };
      }

      this.logger.info(
        `Cache loaded from disk: ${data.entries.length} entries`,
      );
    } catch (error) {
      this.logger.debug("No existing cache file found");
    }
  }

  async warmup(
    keys: string[],
    fetcher: (key: string) => Promise<T>,
  ): Promise<void> {
    this.logger.info(`Warming up cache with ${keys.length} keys`);

    const promises = keys.map(async (key) => {
      if (!this.has(key)) {
        try {
          const value = await fetcher(key);
          await this.set(key, value);
        } catch (error) {
          this.logger.warn(`Failed to warm up cache for key ${key}:`, error);
        }
      }
    });

    await Promise.all(promises);
    this.logger.info("Cache warmup completed");
  }

  prune(): number {
    const beforeSize = this.cache.size;
    this.cache.forEach((value, key) => {
      if (value.hits === 0) {
        this.cache.delete(key);
      }
    });

    const pruned = beforeSize - this.cache.size;
    if (pruned > 0) {
      this.logger.info(`Pruned ${pruned} unused cache entries`);
    }

    return pruned;
  }
}

export function createCacheManager<T = unknown>(
  config?: Partial<CacheConfig>,
): CacheManager<T> {
  return new CacheManager<T>(config);
}
