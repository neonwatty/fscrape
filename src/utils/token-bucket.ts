/**
 * Token bucket algorithm implementation for rate limiting
 * Provides smooth rate limiting with burst capacity
 */

/**
 * Token bucket configuration
 */
export interface TokenBucketConfig {
  /** Maximum number of tokens in the bucket */
  capacity: number;
  /** Rate of token refill per second */
  refillRate: number;
  /** Initial number of tokens (defaults to capacity) */
  initialTokens?: number;
}

/**
 * Token bucket state information
 */
export interface TokenBucketState {
  /** Current number of tokens available */
  tokens: number;
  /** Maximum capacity */
  capacity: number;
  /** Refill rate per second */
  refillRate: number;
  /** Last refill timestamp */
  lastRefill: number;
  /** Total tokens consumed */
  totalConsumed: number;
  /** Total tokens generated */
  totalGenerated: number;
}

/**
 * Token bucket implementation for smooth rate limiting
 */
export class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private lastRefill: number;
  private totalConsumed: number = 0;
  private totalGenerated: number = 0;

  constructor(config: TokenBucketConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.tokens = config.initialTokens ?? config.capacity;
    this.lastRefill = Date.now();
    this.totalGenerated = this.tokens;
  }

  /**
   * Try to consume tokens from the bucket
   * @param count Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false if not enough tokens
   */
  tryConsume(count: number = 1): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      this.totalConsumed += count;
      return true;
    }

    return false;
  }

  /**
   * Consume tokens from the bucket, waiting if necessary
   * @param count Number of tokens to consume (default: 1)
   */
  async consume(count: number = 1): Promise<void> {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      this.totalConsumed += count;
      return;
    }

    // Calculate wait time for required tokens
    const tokensNeeded = count - this.tokens;
    const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;

    await new Promise((resolve) => setTimeout(resolve, waitTimeMs));

    // Refill and consume
    this.refill();
    this.tokens -= count;
    this.totalConsumed += count;
  }

  /**
   * Get the current number of available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Get time until the specified number of tokens will be available
   * @param count Number of tokens needed
   * @returns Wait time in milliseconds, or 0 if tokens are available now
   */
  getWaitTime(count: number = 1): number {
    this.refill();

    if (this.tokens >= count) {
      return 0;
    }

    const tokensNeeded = count - this.tokens;
    return (tokensNeeded / this.refillRate) * 1000;
  }

  /**
   * Reset the bucket to initial state
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.totalConsumed = 0;
    this.totalGenerated = this.capacity;
  }

  /**
   * Get current bucket state
   */
  getState(): TokenBucketState {
    this.refill();

    return {
      tokens: this.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      lastRefill: this.lastRefill,
      totalConsumed: this.totalConsumed,
      totalGenerated: this.totalGenerated,
    };
  }

  /**
   * Check if the bucket can accommodate a burst of requests
   * @param burstSize Size of the burst
   */
  canHandleBurst(burstSize: number): boolean {
    this.refill();
    return this.tokens >= burstSize;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;

    if (elapsedMs <= 0) {
      return;
    }

    const tokensToAdd = (elapsedMs / 1000) * this.refillRate;
    const newTokens = Math.min(this.tokens + tokensToAdd, this.capacity);
    const actuallyAdded = newTokens - this.tokens;

    this.tokens = newTokens;
    this.totalGenerated += actuallyAdded;
    this.lastRefill = now;
  }
}

/**
 * Multi-tier token bucket for different rate limit levels
 */
export class MultiTierTokenBucket {
  private buckets: Map<string, TokenBucket>;

  constructor() {
    this.buckets = new Map();
  }

  /**
   * Add a tier to the multi-tier bucket
   */
  addTier(name: string, config: TokenBucketConfig): void {
    this.buckets.set(name, new TokenBucket(config));
  }

  /**
   * Try to consume tokens from all tiers
   * @param count Number of tokens to consume from each tier
   * @returns true if tokens were consumed from all tiers
   */
  tryConsumeAll(count: number = 1): boolean {
    // Check if all buckets have enough tokens
    for (const bucket of this.buckets.values()) {
      if (!bucket.canHandleBurst(count)) {
        return false;
      }
    }

    // Consume from all buckets
    for (const bucket of this.buckets.values()) {
      bucket.tryConsume(count);
    }

    return true;
  }

  /**
   * Consume tokens from all tiers, waiting if necessary
   * @param count Number of tokens to consume from each tier
   */
  async consumeAll(count: number = 1): Promise<void> {
    // Find the maximum wait time across all buckets
    let maxWaitTime = 0;

    for (const bucket of this.buckets.values()) {
      const waitTime = bucket.getWaitTime(count);
      maxWaitTime = Math.max(maxWaitTime, waitTime);
    }

    // Wait if necessary
    if (maxWaitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, maxWaitTime));
    }

    // Consume from all buckets
    for (const bucket of this.buckets.values()) {
      bucket.tryConsume(count);
    }
  }

  /**
   * Get the state of all tiers
   */
  getAllStates(): Map<string, TokenBucketState> {
    const states = new Map<string, TokenBucketState>();

    for (const [name, bucket] of this.buckets.entries()) {
      states.set(name, bucket.getState());
    }

    return states;
  }

  /**
   * Reset all tiers
   */
  resetAll(): void {
    for (const bucket of this.buckets.values()) {
      bucket.reset();
    }
  }

  /**
   * Get a specific tier
   */
  getTier(name: string): TokenBucket | undefined {
    return this.buckets.get(name);
  }
}

/**
 * Token bucket factory for common configurations
 */
export class TokenBucketFactory {
  /**
   * Create a token bucket for per-second rate limiting
   */
  static perSecond(requestsPerSecond: number, burstSize?: number): TokenBucket {
    return new TokenBucket({
      capacity: burstSize ?? requestsPerSecond * 2,
      refillRate: requestsPerSecond,
    });
  }

  /**
   * Create a token bucket for per-minute rate limiting
   */
  static perMinute(requestsPerMinute: number, burstSize?: number): TokenBucket {
    return new TokenBucket({
      capacity: burstSize ?? Math.ceil(requestsPerMinute / 2),
      refillRate: requestsPerMinute / 60,
    });
  }

  /**
   * Create a token bucket for per-hour rate limiting
   */
  static perHour(requestsPerHour: number, burstSize?: number): TokenBucket {
    return new TokenBucket({
      capacity: burstSize ?? Math.ceil(requestsPerHour / 60),
      refillRate: requestsPerHour / 3600,
    });
  }

  /**
   * Create a multi-tier token bucket with standard tiers
   */
  static multiTier(
    perSecond: number,
    perMinute: number,
    perHour: number,
  ): MultiTierTokenBucket {
    const bucket = new MultiTierTokenBucket();

    bucket.addTier("second", {
      capacity: perSecond * 2,
      refillRate: perSecond,
    });

    bucket.addTier("minute", {
      capacity: perMinute,
      refillRate: perMinute / 60,
    });

    bucket.addTier("hour", {
      capacity: perHour,
      refillRate: perHour / 3600,
    });

    return bucket;
  }
}
