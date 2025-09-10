/**
 * Error handler with recovery strategies and circuit breaker implementation
 */

import { 
  BaseError, 
  ErrorSeverity, 
  RecoveryStrategy,
  NetworkError,
  RateLimitError,
  isRetryableError,
  ErrorFactory
} from './errors.js';
import { logger, createLogger } from './enhanced-logger.js';

const errorLogger = createLogger('ErrorHandler');

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxAttempts: number;
}

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Recovery context for error handling
 */
export interface RecoveryContext {
  attempt: number;
  maxAttempts: number;
  delay: number;
  strategy: RecoveryStrategy;
  metadata?: Record<string, any>;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  halfOpenMaxAttempts: 3
};

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private halfOpenAttempts: number = 0;
  
  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG
  ) {}
  
  /**
   * Check if circuit allows request
   */
  public canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
        
      case CircuitState.OPEN:
        // Check if timeout has passed
        if (this.lastFailureTime) {
          const timeSinceFailure = Date.now() - this.lastFailureTime.getTime();
          if (timeSinceFailure >= this.config.timeout) {
            this.transitionTo(CircuitState.HALF_OPEN);
            return true;
          }
        }
        return false;
        
      case CircuitState.HALF_OPEN:
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
        
      default:
        return false;
    }
  }
  
  /**
   * Record successful execution
   */
  public recordSuccess(): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount = 0;
        break;
        
      case CircuitState.HALF_OPEN:
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo(CircuitState.CLOSED);
        }
        break;
    }
  }
  
  /**
   * Record failed execution
   */
  public recordFailure(): void {
    this.lastFailureTime = new Date();
    
    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;
        
      case CircuitState.HALF_OPEN:
        this.transitionTo(CircuitState.OPEN);
        break;
    }
  }
  
  /**
   * Get current circuit state
   */
  public getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    errorLogger.debug(`Circuit breaker ${this.name} transitioning from ${this.state} to ${newState}`);
    this.state = newState;
    
    // Reset counters based on new state
    switch (newState) {
      case CircuitState.CLOSED:
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenAttempts = 0;
        break;
        
      case CircuitState.HALF_OPEN:
        this.successCount = 0;
        this.halfOpenAttempts = 0;
        break;
        
      case CircuitState.OPEN:
        this.halfOpenAttempts = 0;
        break;
    }
  }
}

/**
 * Error handler with recovery strategies
 */
export class ErrorHandler {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryConfig: RetryConfig;
  private circuitConfig: CircuitBreakerConfig;
  
  constructor(
    retryConfig?: Partial<RetryConfig>,
    circuitConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.circuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...circuitConfig };
  }
  
  /**
   * Handle error with appropriate recovery strategy
   */
  public async handle<T>(
    operation: () => Promise<T>,
    context?: { 
      name?: string; 
      fallback?: () => T | Promise<T>;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    const operationName = context?.name || 'unnamed_operation';
    const startTime = Date.now();
    
    try {
      // Check circuit breaker if exists
      const circuitBreaker = this.getOrCreateCircuitBreaker(operationName);
      if (!circuitBreaker.canExecute()) {
        throw new NetworkError(
          `Circuit breaker is open for operation: ${operationName}`,
          'CIRCUIT_BREAKER_OPEN'
        );
      }
      
      // Execute operation
      const result = await operation();
      
      // Record success
      circuitBreaker.recordSuccess();
      
      const duration = Date.now() - startTime;
      errorLogger.trace(`Operation ${operationName} succeeded`, { duration });
      
      return result;
    } catch (error) {
      const baseError = ErrorFactory.fromUnknown(error);
      baseError.addContext({
        operation: operationName,
        ...context?.metadata
      });
      
      // Log the error
      errorLogger.logError(baseError);
      
      // Record failure in circuit breaker
      const circuitBreaker = this.getOrCreateCircuitBreaker(operationName);
      circuitBreaker.recordFailure();
      
      // Determine recovery strategy
      const recoveryStrategy = this.determineRecoveryStrategy(baseError);
      
      // Apply recovery strategy
      return this.applyRecoveryStrategy(
        baseError,
        operation,
        recoveryStrategy,
        context
      );
    }
  }
  
  /**
   * Execute with retry logic
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.retryConfig, ...config };
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        errorLogger.debug(`Attempting operation (attempt ${attempt}/${retryConfig.maxAttempts})`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!isRetryableError(error)) {
          errorLogger.warn('Error is not retryable, stopping retry attempts');
          throw error;
        }
        
        // Check if we've exhausted attempts
        if (attempt === retryConfig.maxAttempts) {
          errorLogger.error(`All retry attempts exhausted (${retryConfig.maxAttempts} attempts)`, lastError);
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateBackoffDelay(attempt, retryConfig);
        
        errorLogger.debug(`Retry attempt ${attempt} failed, waiting ${delay}ms before next attempt`);
        await this.sleep(delay);
      }
    }
    
    throw lastError || new Error('Retry failed with no error captured');
  }
  
  /**
   * Execute with exponential backoff
   */
  public async executeWithBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 5
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      maxAttempts,
      backoffMultiplier: 2,
      jitter: true
    });
  }
  
  /**
   * Execute with circuit breaker
   */
  public async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    name: string
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(name);
    
    if (!circuitBreaker.canExecute()) {
      throw new NetworkError(
        `Circuit breaker is open for: ${name}`,
        'CIRCUIT_BREAKER_OPEN'
      );
    }
    
    try {
      const result = await operation();
      circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      circuitBreaker.recordFailure();
      throw error;
    }
  }
  
  /**
   * Handle rate limit errors
   */
  public async handleRateLimit(
    error: RateLimitError,
    operation: () => Promise<any>
  ): Promise<any> {
    const retryAfter = error.retryAfter || 60000; // Default to 1 minute
    
    errorLogger.info(`Rate limited, waiting ${retryAfter}ms before retry`, {
      limit: error.limit,
      remaining: error.remaining,
      reset: error.reset
    });
    
    await this.sleep(retryAfter);
    
    return operation();
  }
  
  /**
   * Determine recovery strategy based on error
   */
  private determineRecoveryStrategy(error: BaseError): RecoveryStrategy {
    // Use error's suggested strategy if available
    if (error.recoveryStrategy) {
      return error.recoveryStrategy;
    }
    
    // Determine based on error properties
    if (error instanceof RateLimitError) {
      return RecoveryStrategy.EXPONENTIAL_BACKOFF;
    }
    
    if (error instanceof NetworkError) {
      return RecoveryStrategy.CIRCUIT_BREAKER;
    }
    
    if (error.isRetryable) {
      return RecoveryStrategy.RETRY;
    }
    
    if (error.severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.TERMINATE;
    }
    
    return RecoveryStrategy.IGNORE;
  }
  
  /**
   * Apply recovery strategy
   */
  private async applyRecoveryStrategy<T>(
    error: BaseError,
    operation: () => Promise<T>,
    strategy: RecoveryStrategy,
    context?: { 
      name?: string; 
      fallback?: () => T | Promise<T>;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    errorLogger.debug(`Applying recovery strategy: ${strategy}`);
    
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        return this.executeWithRetry(operation);
        
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        return this.executeWithBackoff(operation);
        
      case RecoveryStrategy.CIRCUIT_BREAKER:
        if (context?.name) {
          return this.executeWithCircuitBreaker(operation, context.name);
        }
        throw error;
        
      case RecoveryStrategy.FALLBACK:
        if (context?.fallback) {
          errorLogger.info('Using fallback strategy');
          return context.fallback();
        }
        throw error;
        
      case RecoveryStrategy.IGNORE:
        errorLogger.debug('Ignoring error as per recovery strategy');
        return undefined as any;
        
      case RecoveryStrategy.TERMINATE:
      default:
        errorLogger.error('Terminating due to critical error', error);
        throw error;
    }
  }
  
  /**
   * Get or create circuit breaker
   */
  private getOrCreateCircuitBreaker(name: string): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker(name, this.circuitConfig));
    }
    return this.circuitBreakers.get(name)!;
  }
  
  /**
   * Calculate backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply max delay cap
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter if enabled
    if (config.jitter) {
      const jitterAmount = delay * 0.2; // 20% jitter
      delay += Math.random() * jitterAmount - jitterAmount / 2;
    }
    
    return Math.round(delay);
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get circuit breaker state
   */
  public getCircuitBreakerState(name: string): CircuitState | undefined {
    const breaker = this.circuitBreakers.get(name);
    return breaker?.getState();
  }
  
  /**
   * Reset circuit breaker
   */
  public resetCircuitBreaker(name: string): void {
    this.circuitBreakers.delete(name);
  }
  
  /**
   * Reset all circuit breakers
   */
  public resetAllCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    name?: string;
    fallback?: () => ReturnType<T>;
    metadata?: Record<string, any>;
  }
): T {
  return (async (...args: Parameters<T>) => {
    return globalErrorHandler.handle(
      () => fn(...args),
      options
    );
  }) as T;
}

/**
 * Decorator for class methods with error handling
 */
export function HandleErrors(options?: {
  strategy?: RecoveryStrategy;
  fallback?: () => any;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = `${className}.${propertyKey}`;
      
      return globalErrorHandler.handle(
        () => originalMethod.apply(this, args),
        {
          name: methodName,
          fallback: options?.fallback || undefined,
          metadata: { className, methodName }
        }
      );
    };
    
    return descriptor;
  };
}