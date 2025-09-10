import { logger } from "./logger.js";
import pRetry, {
  type Options as PRetryOptions,
  type FailedAttemptError,
} from "p-retry";

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

/**
 * Advanced retry configuration with p-retry integration
 */
export interface AdvancedRetryConfig {
  /** Base retry configuration */
  retries?: number;
  /** Minimum delay between retries in ms */
  minTimeout?: number;
  /** Maximum delay between retries in ms */
  maxTimeout?: number;
  /** Exponential factor for retry delays */
  factor?: number;
  /** Randomization factor for delays */
  randomize?: boolean;
  /** Called on each retry attempt */
  onFailedAttempt?: (error: FailedAttemptError) => void | Promise<void>;
  /** Custom retry logic */
  shouldRetry?: (error: FailedAttemptError) => boolean | Promise<boolean>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * P-Retry wrapper with advanced backoff strategies
 */
export class AdvancedRetry {
  private readonly config: AdvancedRetryConfig;
  private readonly backoffStrategy: BaseBackoffStrategy | undefined;

  constructor(
    config: AdvancedRetryConfig = {},
    backoffStrategy?: BaseBackoffStrategy,
  ) {
    this.config = config;
    this.backoffStrategy = backoffStrategy;
  }

  /**
   * Execute function with p-retry and custom backoff
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const options: PRetryOptions = {
      retries: this.config.retries ?? 10,
      minTimeout: this.config.minTimeout ?? 1000,
      maxTimeout: this.config.maxTimeout ?? 60000,
      factor: this.config.factor ?? 2,
      randomize: this.config.randomize ?? true,
      ...(this.config.signal && { signal: this.config.signal }),
      onFailedAttempt: async (error) => {
        // Log the failed attempt
        logger.warn(
          `Retry attempt ${error.attemptNumber} failed: ${error.message}`,
        );

        // Call user's handler if provided
        if (this.config.onFailedAttempt) {
          await this.config.onFailedAttempt(error);
        }

        // Apply custom backoff if provided
        if (
          this.backoffStrategy &&
          error.attemptNumber <= error.retriesLeft + error.attemptNumber
        ) {
          const delay = this.backoffStrategy.getNextDelay();
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      },
    };

    // Add custom retry logic if provided
    if (this.config.shouldRetry) {
      const originalShouldRetry = this.config.shouldRetry;
      const extendedOptions = {
        ...options,
        shouldRetry: async (error: FailedAttemptError) => {
          return originalShouldRetry(error);
        },
      };
      return pRetry(fn, extendedOptions);
    }

    return pRetry(fn, options);
  }

  /**
   * Create an instance with exponential backoff
   */
  static withExponentialBackoff(
    config?: AdvancedRetryConfig,
    backoffConfig?: Partial<BackoffConfig>,
  ): AdvancedRetry {
    const backoff = BackoffFactory.exponential(
      backoffConfig?.initialDelayMs,
      backoffConfig?.maxDelayMs,
      backoffConfig?.multiplier,
    );
    return new AdvancedRetry(config ?? {}, backoff);
  }

  /**
   * Create an instance with linear backoff
   */
  static withLinearBackoff(
    config?: AdvancedRetryConfig,
    backoffConfig?: Partial<BackoffConfig>,
  ): AdvancedRetry {
    const backoff = BackoffFactory.linear(
      backoffConfig?.initialDelayMs,
      backoffConfig?.maxDelayMs,
    );
    return new AdvancedRetry(config ?? {}, backoff);
  }

  /**
   * Create an instance with decorrelated backoff
   */
  static withDecorrelatedBackoff(
    config?: AdvancedRetryConfig,
    backoffConfig?: Partial<BackoffConfig>,
  ): AdvancedRetry {
    const backoff = BackoffFactory.decorrelated(
      backoffConfig?.initialDelayMs,
      backoffConfig?.maxDelayMs,
    );
    return new AdvancedRetry(config ?? {}, backoff);
  }
}

/**
 * Error classification for intelligent retry decisions
 */
export class ErrorClassifier {
  private static readonly RETRYABLE_ERROR_CODES = new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "EPIPE",
    "EAI_AGAIN",
  ]);

  private static readonly RETRYABLE_HTTP_CODES = new Set([
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    509, // Bandwidth Limit Exceeded
    520, // Unknown Error (Cloudflare)
    521, // Web Server Is Down (Cloudflare)
    522, // Connection Timed Out (Cloudflare)
    523, // Origin Is Unreachable (Cloudflare)
    524, // A Timeout Occurred (Cloudflare)
  ]);

  /**
   * Check if an error is retryable based on its characteristics
   */
  static isRetryable(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    // Check for network errors
    if ("code" in error && typeof error.code === "string") {
      if (this.RETRYABLE_ERROR_CODES.has(error.code)) {
        return true;
      }
    }

    // Check for HTTP status codes
    if ("statusCode" in error && typeof error.statusCode === "number") {
      if (this.RETRYABLE_HTTP_CODES.has(error.statusCode)) {
        return true;
      }
    }

    // Check for rate limit errors
    if (this.isRateLimitError(error)) {
      return true;
    }

    // Check for temporary errors
    if (this.isTemporaryError(error)) {
      return true;
    }

    return false;
  }

  /**
   * Check if error is a rate limit error
   */
  static isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429") ||
      message.includes("quota exceeded")
    );
  }

  /**
   * Check if error is temporary
   */
  static isTemporaryError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("temporary") ||
      message.includes("try again") ||
      message.includes("temporarily unavailable") ||
      message.includes("timeout")
    );
  }

  /**
   * Extract retry delay from error if available
   */
  static extractRetryDelay(error: Error): number | undefined {
    // Check for Retry-After header value in error
    if ("retryAfter" in error && typeof error.retryAfter === "number") {
      return error.retryAfter * 1000; // Convert to milliseconds
    }

    // Try to extract from error message
    const match = error.message.match(/retry[- ]?after:?\s*(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10) * 1000;
    }

    return undefined;
  }
}

/**
 * Utility function for creating a retry-enabled function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config?: AdvancedRetryConfig,
  backoffStrategy?: BaseBackoffStrategy,
): T {
  const retry = new AdvancedRetry(config ?? {}, backoffStrategy);

  return (async (...args: Parameters<T>) => {
    return retry.execute(() => fn(...args));
  }) as T;
}
