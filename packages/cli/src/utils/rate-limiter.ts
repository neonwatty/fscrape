import PQueue from 'p-queue';
import type { Platform } from '../types/core.js';
import { logger } from './logger.js';
import { TokenBucket, TokenBucketFactory, MultiTierTokenBucket } from './token-bucket.js';

/**
 * Rate limiting configuration per platform
 */
export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum concurrent requests */
  concurrency?: number;
  /** Minimum interval between requests in ms */
  interval?: number;
  /** Whether to use exponential backoff on rate limit errors */
  useBackoff?: boolean;
  /** Initial backoff delay in ms */
  initialBackoffMs?: number;
  /** Maximum backoff delay in ms */
  maxBackoffMs?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
}

/**
 * Platform-specific rate limit configurations
 */
export const PLATFORM_RATE_LIMITS: Record<Platform, RateLimitConfig> = {
  reddit: {
    maxRequests: 100, // 100 QPM for OAuth
    windowMs: 60000, // 1 minute
    concurrency: 2,
    interval: 600, // 600ms between requests (100 per minute)
    useBackoff: true,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
  },
  hackernews: {
    maxRequests: 1000, // No official limit, but being conservative
    windowMs: 60000,
    concurrency: 5,
    interval: 60, // 60ms between requests
    useBackoff: false, // HN doesn't have rate limits
  },
  discourse: {
    maxRequests: 60,
    windowMs: 60000,
    concurrency: 2,
    interval: 1000,
    useBackoff: true,
    initialBackoffMs: 2000,
    maxBackoffMs: 30000,
    backoffMultiplier: 1.5,
  },
  lemmy: {
    maxRequests: 60,
    windowMs: 60000,
    concurrency: 2,
    interval: 1000,
    useBackoff: true,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2,
  },
  lobsters: {
    maxRequests: 60,
    windowMs: 60000,
    concurrency: 2,
    interval: 1000,
    useBackoff: true,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2,
  },
  custom: {
    maxRequests: 30,
    windowMs: 60000,
    concurrency: 1,
    interval: 2000,
    useBackoff: true,
    initialBackoffMs: 2000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
  },
};

/**
 * Rate limit status information
 */
export interface RateLimitStatus {
  platform: Platform;
  requestsRemaining: number;
  requestsUsed: number;
  resetTime: Date;
  isLimited: boolean;
  currentBackoffMs?: number;
  quotaUsage?: QuotaUsage;
  tokenBucketState?: {
    availableTokens: number;
    capacity: number;
    refillRate: number;
  };
}

/**
 * Quota usage tracking
 */
export interface QuotaUsage {
  hourly: {
    used: number;
    limit: number;
    resetTime: Date;
  };
  daily: {
    used: number;
    limit: number;
    resetTime: Date;
  };
  monthly?: {
    used: number;
    limit: number;
    resetTime: Date;
  };
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /** Execute a function with rate limiting */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  /** Wait if necessary to respect rate limits */
  waitIfNeeded(): Promise<void>;
  /** Check if a request can be made without waiting */
  canMakeRequest(): boolean;
  /** Record that a request was made */
  recordRequest(): void;
  /** Record a rate limit error and apply backoff */
  recordRateLimitError(retryAfterMs?: number): void;
  /** Reset the rate limiter */
  reset(): void;
  /** Get current rate limit status */
  getStatus(): RateLimitStatus;
  /** Update quota usage */
  updateQuotaUsage(usage: Partial<QuotaUsage>): void;
}

/**
 * Advanced rate limiter with p-queue, token bucket, and backoff strategies
 */
export class AdvancedRateLimiter implements RateLimiter {
  private readonly platform: Platform;
  private readonly config: Required<RateLimitConfig>;
  private readonly queue: PQueue;
  private readonly tokenBucket: TokenBucket;
  private readonly multiTierBucket?: MultiTierTokenBucket;
  private requests: number[] = [];
  private currentBackoffMs: number = 0;
  private backoffUntil: number = 0;
  private quotaUsage: QuotaUsage;

  constructor(platform: Platform, customConfig?: Partial<RateLimitConfig>) {
    this.platform = platform;
    const defaultConfig = PLATFORM_RATE_LIMITS[platform];

    this.config = {
      maxRequests: customConfig?.maxRequests ?? defaultConfig.maxRequests,
      windowMs: customConfig?.windowMs ?? defaultConfig.windowMs,
      concurrency: customConfig?.concurrency ?? defaultConfig.concurrency ?? 1,
      interval: customConfig?.interval ?? defaultConfig.interval ?? 0,
      useBackoff: customConfig?.useBackoff ?? defaultConfig.useBackoff ?? false,
      initialBackoffMs: customConfig?.initialBackoffMs ?? defaultConfig.initialBackoffMs ?? 1000,
      maxBackoffMs: customConfig?.maxBackoffMs ?? defaultConfig.maxBackoffMs ?? 60000,
      backoffMultiplier: customConfig?.backoffMultiplier ?? defaultConfig.backoffMultiplier ?? 2,
    };

    this.queue = new PQueue({
      concurrency: this.config.concurrency,
      interval: this.config.interval,
      intervalCap: 1, // One request per interval
    });

    // Initialize token bucket for primary rate limiting
    const requestsPerSecond = this.config.maxRequests / (this.config.windowMs / 1000);
    this.tokenBucket = TokenBucketFactory.perSecond(
      requestsPerSecond,
      Math.min(this.config.maxRequests, requestsPerSecond * 10) // Allow burst up to 10 seconds worth or max requests
    );

    // Initialize multi-tier bucket for platforms with complex limits
    if (platform === 'reddit' || platform === 'discourse') {
      this.multiTierBucket = TokenBucketFactory.multiTier(
        Math.ceil(requestsPerSecond), // Per second
        this.config.maxRequests, // Per minute
        this.config.maxRequests * 60 // Per hour
      );
    }

    // Initialize quota usage
    const now = new Date();
    this.quotaUsage = {
      hourly: {
        used: 0,
        limit: this.config.maxRequests * 60, // Per hour
        resetTime: new Date(now.getTime() + 3600000),
      },
      daily: {
        used: 0,
        limit: this.config.maxRequests * 60 * 24, // Per day
        resetTime: new Date(now.getTime() + 86400000),
      },
    };

    logger.info(`Rate limiter initialized for ${platform}`, {
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      concurrency: this.config.concurrency,
    });
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const result = await this.queue.add(async () => {
      // Wait for token bucket availability
      await this.tokenBucket.consume(1);

      // If multi-tier bucket exists, also check it
      if (this.multiTierBucket) {
        await this.multiTierBucket.consumeAll(1);
      }

      await this.waitIfNeeded();
      this.recordRequest();

      try {
        const result = await fn();
        // Reset backoff on successful request
        if (this.config.useBackoff && this.currentBackoffMs > 0) {
          this.currentBackoffMs = 0;
          this.backoffUntil = 0;
          logger.debug(`${this.platform}: Backoff reset after successful request`);
        }
        return result;
      } catch (error) {
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const retryAfter = this.extractRetryAfter(error);
          this.recordRateLimitError(retryAfter);
        }
        throw error;
      }
    });
    return result as T;
  }

  async waitIfNeeded(): Promise<void> {
    // Wait for backoff if needed
    if (this.backoffUntil > Date.now()) {
      const waitTime = this.backoffUntil - Date.now();
      logger.info(`${this.platform}: Waiting ${waitTime}ms due to backoff`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // Wait for rate limit window
    while (!this.canMakeRequest()) {
      const oldestRequest = this.requests[0];
      if (oldestRequest !== undefined) {
        const waitTime = oldestRequest + this.config.windowMs - Date.now();
        if (waitTime > 0) {
          logger.debug(`${this.platform}: Rate limit wait ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 1000)));
        }
      }
      this.cleanup();
    }
  }

  canMakeRequest(): boolean {
    this.cleanup();

    // Check backoff
    if (this.backoffUntil > Date.now()) {
      return false;
    }

    // Check token bucket
    if (this.tokenBucket.getAvailableTokens() < 1) {
      return false;
    }

    // Check multi-tier bucket if exists
    if (this.multiTierBucket && !this.multiTierBucket.tryConsumeAll(0)) {
      return false;
    }

    // Check rate limit
    return this.requests.length < this.config.maxRequests;
  }

  recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);

    // Update quota usage
    this.quotaUsage.hourly.used++;
    this.quotaUsage.daily.used++;
    if (this.quotaUsage.monthly) {
      this.quotaUsage.monthly.used++;
    }

    // Check and reset quotas if needed
    this.checkQuotaReset();
  }

  recordRateLimitError(retryAfterMs?: number): void {
    if (!this.config.useBackoff) {
      return;
    }

    if (retryAfterMs) {
      // Use server-provided retry-after
      this.backoffUntil = Date.now() + retryAfterMs;
      this.currentBackoffMs = retryAfterMs;
      logger.warn(`${this.platform}: Rate limited, retry after ${retryAfterMs}ms`);
    } else {
      // Use exponential backoff
      if (this.currentBackoffMs === 0) {
        this.currentBackoffMs = this.config.initialBackoffMs;
      } else {
        this.currentBackoffMs = Math.min(
          this.currentBackoffMs * this.config.backoffMultiplier,
          this.config.maxBackoffMs
        );
      }

      this.backoffUntil = Date.now() + this.currentBackoffMs;
      logger.warn(`${this.platform}: Rate limited, backing off ${this.currentBackoffMs}ms`);
    }
  }

  reset(): void {
    this.requests = [];
    this.currentBackoffMs = 0;
    this.backoffUntil = 0;
    this.queue.clear();
    this.tokenBucket.reset();
    if (this.multiTierBucket) {
      this.multiTierBucket.resetAll();
    }
    logger.info(`${this.platform}: Rate limiter reset`);
  }

  getStatus(): RateLimitStatus {
    this.cleanup();
    this.checkQuotaReset();

    const now = Date.now();
    const oldestRequest = this.requests[0];
    const resetTime =
      oldestRequest !== undefined
        ? new Date(oldestRequest + this.config.windowMs)
        : new Date(now + this.config.windowMs);

    const bucketState = this.tokenBucket.getState();

    return {
      platform: this.platform,
      requestsRemaining: Math.max(0, this.config.maxRequests - this.requests.length),
      requestsUsed: this.requests.length,
      resetTime,
      isLimited: this.requests.length >= this.config.maxRequests || this.backoffUntil > now,
      ...(this.currentBackoffMs > 0 && {
        currentBackoffMs: this.currentBackoffMs,
      }),
      quotaUsage: { ...this.quotaUsage },
      tokenBucketState: {
        availableTokens: bucketState.tokens,
        capacity: bucketState.capacity,
        refillRate: bucketState.refillRate,
      },
    };
  }

  updateQuotaUsage(usage: Partial<QuotaUsage>): void {
    if (usage.hourly) {
      this.quotaUsage.hourly = { ...this.quotaUsage.hourly, ...usage.hourly };
    }
    if (usage.daily) {
      this.quotaUsage.daily = { ...this.quotaUsage.daily, ...usage.daily };
    }
    if (usage.monthly) {
      this.quotaUsage.monthly = this.quotaUsage.monthly
        ? { ...this.quotaUsage.monthly, ...usage.monthly }
        : usage.monthly;
    }
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }

  private checkQuotaReset(): void {
    const now = new Date();

    // Reset hourly quota
    if (now >= this.quotaUsage.hourly.resetTime) {
      this.quotaUsage.hourly.used = 0;
      this.quotaUsage.hourly.resetTime = new Date(now.getTime() + 3600000);
    }

    // Reset daily quota
    if (now >= this.quotaUsage.daily.resetTime) {
      this.quotaUsage.daily.used = 0;
      this.quotaUsage.daily.resetTime = new Date(now.getTime() + 86400000);
    }

    // Reset monthly quota if exists
    if (this.quotaUsage.monthly && now >= this.quotaUsage.monthly.resetTime) {
      this.quotaUsage.monthly.used = 0;
      this.quotaUsage.monthly.resetTime = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429')
      );
    }
    return false;
  }

  private extractRetryAfter(error: unknown): number | undefined {
    if (error instanceof Error) {
      // Try to extract retry-after from error message or headers
      const match = error.message.match(/retry[- ]?after:?\s*(\d+)/i);
      if (match && match[1]) {
        return parseInt(match[1], 10) * 1000; // Convert to ms
      }
    }
    return undefined;
  }
}

/**
 * Rate limiter factory
 */
export class RateLimiterFactory {
  private static limiters = new Map<string, AdvancedRateLimiter>();

  /**
   * Get or create a rate limiter for a platform
   */
  static get(platform: Platform, customConfig?: Partial<RateLimitConfig>): AdvancedRateLimiter {
    const key = `${platform}-${JSON.stringify(customConfig ?? {})}`;

    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = new AdvancedRateLimiter(platform, customConfig);
      this.limiters.set(key, limiter);
    }
    return limiter;
  }

  /**
   * Clear all rate limiters
   */
  static clear(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
    this.limiters.clear();
  }

  /**
   * Get status for all rate limiters
   */
  static getAllStatus(): RateLimitStatus[] {
    return Array.from(this.limiters.values()).map((limiter) => limiter.getStatus());
  }
}
