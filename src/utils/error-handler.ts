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
 * User notification configuration
 */
export interface NotificationConfig {
  enabled: boolean;
  showErrors: boolean;
  showWarnings: boolean;
  showRecoveryAttempts: boolean;
  customNotifier?: (message: string, level: 'error' | 'warning' | 'info') => void;
}

/**
 * Graceful degradation configuration
 */
export interface DegradationConfig {
  enabled: boolean;
  fallbackServices: Map<string, () => any>;
  degradationThreshold: number;
  autoRecover: boolean;
  recoveryCheckInterval: number;
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
  private notificationConfig: NotificationConfig;
  private degradationConfig: DegradationConfig;
  private degradedServices: Set<string> = new Set();
  private errorCounts: Map<string, number> = new Map();
  private recoveryTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    retryConfig?: Partial<RetryConfig>,
    circuitConfig?: Partial<CircuitBreakerConfig>,
    notificationConfig?: Partial<NotificationConfig>,
    degradationConfig?: Partial<DegradationConfig>
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.circuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...circuitConfig };
    this.notificationConfig = {
      enabled: true,
      showErrors: true,
      showWarnings: true,
      showRecoveryAttempts: false,
      ...notificationConfig
    };
    this.degradationConfig = {
      enabled: true,
      fallbackServices: new Map(),
      degradationThreshold: 3,
      autoRecover: true,
      recoveryCheckInterval: 60000,
      ...degradationConfig
    };
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
      // Check if service is degraded
      if (this.checkDegradation(operationName)) {
        const fallback = this.getFallbackForService(operationName) || context?.fallback;
        if (fallback) {
          this.notify(`Using fallback for degraded service: ${operationName}`, 'info');
          return await fallback();
        }
      }
      
      // Check circuit breaker if exists
      const circuitBreaker = this.getOrCreateCircuitBreaker(operationName);
      if (!circuitBreaker.canExecute()) {
        this.notify(`Circuit breaker open for: ${operationName}`, 'warning');
        throw new NetworkError(
          `Circuit breaker is open for operation: ${operationName}`,
          'CIRCUIT_BREAKER_OPEN'
        );
      }
      
      // Execute operation
      const result = await operation();
      
      // Record success
      circuitBreaker.recordSuccess();
      this.clearErrorCount(operationName);
      
      const duration = Date.now() - startTime;
      errorLogger.trace(`Operation ${operationName} succeeded`, { duration });
      
      return result;
    } catch (error) {
      const baseError = ErrorFactory.fromUnknown(error);
      baseError.addContext({
        operation: operationName,
        ...context?.metadata
      });
      
      // Track error for degradation
      this.trackError(operationName);
      
      // Notify user of error
      if (baseError.severity === ErrorSeverity.CRITICAL) {
        this.notify(`Critical error in ${operationName}: ${baseError.message}`, 'error');
      } else if (baseError.severity === ErrorSeverity.HIGH) {
        this.notify(`Error in ${operationName}: ${baseError.message}`, 'warning');
      }
      
      // Log the error
      errorLogger.logError(baseError);
      
      // Record failure in circuit breaker
      const circuitBreaker = this.getOrCreateCircuitBreaker(operationName);
      circuitBreaker.recordFailure();
      
      // Determine recovery strategy
      const hasFallback = !!(context?.fallback || this.getFallbackForService(operationName));
      const recoveryStrategy = this.determineRecoveryStrategy(baseError, hasFallback);
      
      // Notify recovery attempt if enabled
      if (this.notificationConfig.showRecoveryAttempts && recoveryStrategy !== RecoveryStrategy.TERMINATE) {
        this.notify(`Attempting recovery for ${operationName} using ${recoveryStrategy} strategy`, 'info');
      }
      
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
  private determineRecoveryStrategy(error: BaseError, hasFallback: boolean = false): RecoveryStrategy {
    // Use error's suggested strategy if available
    if (error.recoveryStrategy) {
      return error.recoveryStrategy;
    }
    
    // If we have a fallback and error is not critical, use it
    if (hasFallback && error.severity !== ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.FALLBACK;
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
        // Check if we're already inside a retry to prevent infinite recursion
        if (context?.metadata?.isRetrying) {
          throw error;
        }
        return this.executeWithRetry(operation);
        
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        // Check if we're already inside a backoff to prevent infinite recursion
        if (context?.metadata?.isRetrying) {
          throw error;
        }
        return this.executeWithBackoff(operation);
        
      case RecoveryStrategy.CIRCUIT_BREAKER:
        // Circuit breaker should not retry itself
        if (context?.metadata?.isCircuitBreaker) {
          throw error;
        }
        if (context?.name) {
          return this.executeWithCircuitBreaker(operation, context.name);
        }
        throw error;
        
      case RecoveryStrategy.FALLBACK:
        const fallback = this.getFallbackForService(context?.name || '') || context?.fallback;
        if (fallback) {
          errorLogger.info('Using fallback strategy');
          return fallback();
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
    // Create the circuit breaker if it doesn't exist to ensure consistent state
    const breaker = this.getOrCreateCircuitBreaker(name);
    return breaker.getState();
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
  
  /**
   * Send user notification
   */
  private notify(message: string, level: 'error' | 'warning' | 'info' = 'info'): void {
    if (!this.notificationConfig.enabled) return;
    
    // Check notification level settings
    if (level === 'error' && !this.notificationConfig.showErrors) return;
    if (level === 'warning' && !this.notificationConfig.showWarnings) return;
    if (level === 'info' && !this.notificationConfig.showRecoveryAttempts) return;
    
    // Use custom notifier if provided
    if (this.notificationConfig.customNotifier) {
      this.notificationConfig.customNotifier(message, level);
      return;
    }
    
    // Default console notification
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} ${message}`);
  }
  
  /**
   * Check if service should be degraded
   */
  private checkDegradation(serviceName: string): boolean {
    if (!this.degradationConfig.enabled) return false;
    
    const errorCount = this.errorCounts.get(serviceName) || 0;
    if (errorCount >= this.degradationConfig.degradationThreshold) {
      if (!this.degradedServices.has(serviceName)) {
        this.degradedServices.add(serviceName);
        this.notify(`Service ${serviceName} has been degraded due to repeated failures`, 'warning');
        
        // Setup auto-recovery if enabled
        if (this.degradationConfig.autoRecover) {
          this.setupAutoRecovery(serviceName);
        }
      }
      return true;
    }
    return false;
  }
  
  /**
   * Setup auto-recovery for degraded service
   */
  private setupAutoRecovery(serviceName: string): void {
    // Clear existing timer if any
    const existingTimer = this.recoveryTimers.get(serviceName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Setup new recovery timer
    const timer = setTimeout(() => {
      this.attemptServiceRecovery(serviceName);
    }, this.degradationConfig.recoveryCheckInterval);
    
    this.recoveryTimers.set(serviceName, timer);
  }
  
  /**
   * Attempt to recover degraded service
   */
  private attemptServiceRecovery(serviceName: string): void {
    if (this.degradedServices.has(serviceName)) {
      // Reset error count and remove from degraded services
      this.errorCounts.delete(serviceName);
      this.degradedServices.delete(serviceName);
      this.notify(`Attempting to recover service ${serviceName}`, 'info');
      
      // Clear recovery timer
      const timer = this.recoveryTimers.get(serviceName);
      if (timer) {
        clearTimeout(timer);
        this.recoveryTimers.delete(serviceName);
      }
    }
  }
  
  /**
   * Get fallback for degraded service
   */
  private getFallbackForService(serviceName: string): (() => any) | undefined {
    return this.degradationConfig.fallbackServices.get(serviceName);
  }
  
  /**
   * Track error for service
   */
  private trackError(serviceName: string): void {
    const currentCount = this.errorCounts.get(serviceName) || 0;
    this.errorCounts.set(serviceName, currentCount + 1);
  }
  
  /**
   * Clear error count for service
   */
  public clearErrorCount(serviceName: string): void {
    this.errorCounts.delete(serviceName);
    if (this.degradedServices.has(serviceName)) {
      this.degradedServices.delete(serviceName);
      this.notify(`Service ${serviceName} has been restored`, 'info');
    }
  }
  
  /**
   * Get degraded services
   */
  public getDegradedServices(): string[] {
    return Array.from(this.degradedServices);
  }
  
  /**
   * Configure notifications
   */
  public configureNotifications(config: Partial<NotificationConfig>): void {
    this.notificationConfig = { ...this.notificationConfig, ...config };
  }
  
  /**
   * Configure degradation
   */
  public configureDegradation(config: Partial<DegradationConfig>): void {
    this.degradationConfig = { ...this.degradationConfig, ...config };
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
    descriptor?: PropertyDescriptor
  ) {
    // Handle both legacy and modern decorators
    if (!descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
    }
    
    if (!descriptor || !descriptor.value) {
      throw new Error(`HandleErrors can only be applied to methods`);
    }
    
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