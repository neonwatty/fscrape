import { logger } from "./logger.js";

/**
 * Backoff strategy types
 */
export type BackoffStrategy =
  | "exponential"
  | "linear"
  | "fibonacci"
  | "decorrelated";

/**
 * Backoff configuration
 */
export interface BackoffConfig {
  /** Strategy type */
  strategy: BackoffStrategy;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  multiplier?: number;
  /** Jitter factor (0-1) to add randomness */
  jitterFactor?: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Custom delay calculation function */
  customDelayFn?: (attempt: number, previousDelay: number) => number;
}

/**
 * Backoff state tracking
 */
export interface BackoffState {
  attempt: number;
  nextDelayMs: number;
  totalDelayMs: number;
  retriesRemaining: number;
  lastError?: Error;
}

/**
 * Abstract base class for backoff strategies
 */
export abstract class BaseBackoffStrategy {
  protected config: Required<Omit<BackoffConfig, "customDelayFn">> & {
    customDelayFn?: BackoffConfig["customDelayFn"];
  };
  protected state: BackoffState;
  protected fibSequence: number[] = [1, 1];

  constructor(config: BackoffConfig) {
    this.config = {
      strategy: config.strategy,
      initialDelayMs: config.initialDelayMs,
      maxDelayMs: config.maxDelayMs,
      multiplier: config.multiplier ?? 2,
      jitterFactor: config.jitterFactor ?? 0.1,
      maxRetries: config.maxRetries ?? 10,
      ...(config.customDelayFn && { customDelayFn: config.customDelayFn }),
    };

    this.state = this.createInitialState();
  }

  /**
   * Calculate next delay based on strategy
   */
  abstract calculateDelay(attempt: number): number;

  /**
   * Get next delay and update state
   */
  getNextDelay(): number {
    if (this.state.retriesRemaining <= 0) {
      throw new Error("Maximum retries exceeded");
    }

    this.state.attempt++;
    this.state.retriesRemaining--;

    let delay = this.calculateDelay(this.state.attempt);

    // Apply jitter
    if (this.config.jitterFactor > 0) {
      delay = this.applyJitter(delay);
    }

    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelayMs);

    this.state.nextDelayMs = delay;
    this.state.totalDelayMs += delay;

    logger.debug(`Backoff: attempt ${this.state.attempt}, delay ${delay}ms`);

    return delay;
  }

  /**
   * Wait for the next backoff delay
   */
  async wait(): Promise<void> {
    const delay = this.getNextDelay();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Execute a function with backoff retry
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error) => boolean,
  ): Promise<T> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const result = await fn();
        this.reset(); // Reset on success
        return result;
      } catch (error) {
        const err = error as Error;
        this.state.lastError = err;

        // Check if we should retry
        if (shouldRetry && !shouldRetry(err)) {
          throw err;
        }

        // Check if we have retries remaining
        if (this.state.retriesRemaining <= 0) {
          logger.error(
            `Backoff: Max retries (${this.config.maxRetries}) exceeded`,
          );
          throw new Error(`Max retries exceeded: ${err.message}`);
        }

        // Wait before retrying
        await this.wait();

        logger.info(
          `Backoff: Retry attempt ${this.state.attempt}/${this.config.maxRetries}`,
        );
      }
    }
  }

  /**
   * Reset backoff state
   */
  reset(): void {
    this.state = this.createInitialState();
    this.fibSequence = [1, 1];
  }

  /**
   * Get current state
   */
  getState(): Readonly<BackoffState> {
    return { ...this.state };
  }

  /**
   * Apply jitter to delay
   */
  protected applyJitter(delay: number): number {
    const jitter = delay * this.config.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  /**
   * Create initial state
   */
  protected createInitialState(): BackoffState {
    return {
      attempt: 0,
      nextDelayMs: this.config.initialDelayMs,
      totalDelayMs: 0,
      retriesRemaining: this.config.maxRetries,
    };
  }
}

/**
 * Exponential backoff strategy
 */
export class ExponentialBackoff extends BaseBackoffStrategy {
  calculateDelay(attempt: number): number {
    if (this.config.customDelayFn) {
      return this.config.customDelayFn(attempt, this.state.nextDelayMs);
    }

    return (
      this.config.initialDelayMs * Math.pow(this.config.multiplier, attempt - 1)
    );
  }
}

/**
 * Linear backoff strategy
 */
export class LinearBackoff extends BaseBackoffStrategy {
  calculateDelay(attempt: number): number {
    if (this.config.customDelayFn) {
      return this.config.customDelayFn(attempt, this.state.nextDelayMs);
    }

    return this.config.initialDelayMs * attempt;
  }
}

/**
 * Fibonacci backoff strategy
 */
export class FibonacciBackoff extends BaseBackoffStrategy {
  calculateDelay(attempt: number): number {
    if (this.config.customDelayFn) {
      return this.config.customDelayFn(attempt, this.state.nextDelayMs);
    }

    // Generate fibonacci sequence up to attempt
    while (this.fibSequence.length < attempt) {
      const len = this.fibSequence.length;
      const prev1 = this.fibSequence[len - 1];
      const prev2 = this.fibSequence[len - 2];
      if (prev1 !== undefined && prev2 !== undefined) {
        this.fibSequence.push(prev1 + prev2);
      }
    }

    const fibValue = this.fibSequence[attempt - 1];
    return this.config.initialDelayMs * (fibValue ?? 1);
  }
}

/**
 * Decorrelated jitter backoff strategy (AWS recommended)
 */
export class DecorrelatedBackoff extends BaseBackoffStrategy {
  calculateDelay(attempt: number): number {
    if (this.config.customDelayFn) {
      return this.config.customDelayFn(attempt, this.state.nextDelayMs);
    }

    if (attempt === 1) {
      return this.config.initialDelayMs;
    }

    // Decorrelated jitter: sleep = min(cap, random_between(base, sleep * 3))
    const previousDelay = this.state.nextDelayMs;
    const minDelay = this.config.initialDelayMs;
    const maxDelay = Math.min(previousDelay * 3, this.config.maxDelayMs);

    return minDelay + Math.random() * (maxDelay - minDelay);
  }
}

/**
 * Backoff strategy factory
 */
export class BackoffFactory {
  /**
   * Create a backoff strategy instance
   */
  static create(config: BackoffConfig): BaseBackoffStrategy {
    switch (config.strategy) {
      case "exponential":
        return new ExponentialBackoff(config);
      case "linear":
        return new LinearBackoff(config);
      case "fibonacci":
        return new FibonacciBackoff(config);
      case "decorrelated":
        return new DecorrelatedBackoff(config);
      default:
        throw new Error(`Unknown backoff strategy: ${config.strategy}`);
    }
  }

  /**
   * Create an exponential backoff with sensible defaults
   */
  static exponential(
    initialDelayMs = 1000,
    maxDelayMs = 60000,
    multiplier = 2,
  ): ExponentialBackoff {
    return new ExponentialBackoff({
      strategy: "exponential",
      initialDelayMs,
      maxDelayMs,
      multiplier,
      jitterFactor: 0.1,
      maxRetries: 10,
    });
  }

  /**
   * Create a linear backoff with sensible defaults
   */
  static linear(initialDelayMs = 1000, maxDelayMs = 30000): LinearBackoff {
    return new LinearBackoff({
      strategy: "linear",
      initialDelayMs,
      maxDelayMs,
      jitterFactor: 0.1,
      maxRetries: 10,
    });
  }

  /**
   * Create a fibonacci backoff with sensible defaults
   */
  static fibonacci(
    initialDelayMs = 1000,
    maxDelayMs = 60000,
  ): FibonacciBackoff {
    return new FibonacciBackoff({
      strategy: "fibonacci",
      initialDelayMs,
      maxDelayMs,
      jitterFactor: 0.1,
      maxRetries: 10,
    });
  }

  /**
   * Create a decorrelated backoff with sensible defaults (AWS recommended)
   */
  static decorrelated(
    initialDelayMs = 1000,
    maxDelayMs = 20000,
  ): DecorrelatedBackoff {
    return new DecorrelatedBackoff({
      strategy: "decorrelated",
      initialDelayMs,
      maxDelayMs,
      jitterFactor: 0,
      maxRetries: 10,
    });
  }
}

/**
 * Retry with backoff helper function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: BackoffConfig,
  shouldRetry?: (error: Error) => boolean,
): Promise<T> {
  const backoff = BackoffFactory.create(config);
  return backoff.execute(fn, shouldRetry);
}
