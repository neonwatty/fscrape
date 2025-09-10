/**
 * Rate limiter interface for controlling API request rates
 */
export interface RateLimiter {
  /**
   * Wait if necessary to respect rate limits
   */
  waitIfNeeded(): Promise<void>;

  /**
   * Check if a request can be made without waiting
   */
  canMakeRequest(): boolean;

  /**
   * Record that a request was made
   */
  recordRequest(): void;

  /**
   * Reset the rate limiter
   */
  reset(): void;

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus;
}

/**
 * Rate limit status information
 */
export interface RateLimitStatus {
  requestsRemaining: number;
  resetTime: Date;
  isLimited: boolean;
}

/**
 * Basic implementation of rate limiter
 */
export class BasicRateLimiter implements RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitIfNeeded(): Promise<void> {
    while (!this.canMakeRequest()) {
      const oldestRequest = this.requests[0];
      if (oldestRequest !== undefined) {
        const waitTime = oldestRequest + this.windowMs - Date.now();
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
      this.cleanup();
    }
  }

  canMakeRequest(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  reset(): void {
    this.requests = [];
  }

  getStatus(): RateLimitStatus {
    this.cleanup();
    const now = Date.now();
    const oldestRequest = this.requests[0];
    const resetTime =
      oldestRequest !== undefined
        ? new Date(oldestRequest + this.windowMs)
        : new Date(now + this.windowMs);

    return {
      requestsRemaining: Math.max(0, this.maxRequests - this.requests.length),
      resetTime,
      isLimited: this.requests.length >= this.maxRequests,
    };
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }
}
