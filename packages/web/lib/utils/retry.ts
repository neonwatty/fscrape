/**
 * Retry utility functions for handling failed operations
 */

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  maxDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delay: 1000,
  backoff: 'exponential',
  maxDelay: 30000,
  onRetry: () => {},
  shouldRetry: () => true,
};

/**
 * Retry a function with configurable options
 */
export async function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (!opts.shouldRetry(lastError) || attempt === opts.maxAttempts) {
        throw lastError;
      }

      opts.onRetry(lastError, attempt);

      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeout: number,
  options?: RetryOptions
): Promise<T> {
  return Promise.race([
    retry(fn, options),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeout)
    ),
  ]);
}

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  let delay: number;

  if (options.backoff === 'exponential') {
    delay = options.delay * Math.pow(2, attempt - 1);
  } else {
    delay = options.delay * attempt;
  }

  return Math.min(delay, options.maxDelay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry decorator for class methods
 */
export function Retry(options?: RetryOptions) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
    this.failures = 0;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  reset() {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Exponential backoff retry for API calls
 */
export async function retryApi<T>(
  apiCall: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onRetry?: (error: Error, attempt: number, delay: number) => void;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry,
  } = options || {};

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain status codes
      if (error instanceof Error && 'status' in error) {
        const status = (error as Error & { status: number }).status;
        if (status === 401 || status === 403 || status === 404) {
          throw error;
        }
      }

      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);

      if (onRetry) {
        onRetry(lastError, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Batch retry for multiple operations
 */
export async function retryBatch<T>(
  operations: (() => Promise<T>)[],
  options?: RetryOptions & { concurrency?: number }
): Promise<{ results: T[]; errors: Error[] }> {
  const { concurrency = 3, ...retryOptions } = options || {};
  const results: T[] = [];
  const errors: Error[] = [];

  // Process in batches
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    const batchPromises = batch.map(async (operation, index) => {
      try {
        const result = await retry(operation, retryOptions);
        results[i + index] = result;
      } catch (error) {
        errors.push(error as Error);
      }
    });

    await Promise.all(batchPromises);
  }

  return { results, errors };
}
