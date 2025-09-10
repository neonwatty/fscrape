/**
 * Tests for error handling system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BaseError,
  NetworkError,
  DatabaseError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ParsingError,
  FileSystemError,
  ConfigurationError,
  PlatformError,
  AggregateError,
  ErrorFactory,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
  isRetryableError,
  isCriticalError,
  getErrorMessage
} from '../errors.js';
import { ErrorHandler, globalErrorHandler } from '../error-handler.js';

describe('Error Types', () => {
  describe('BaseError', () => {
    it('should create base error with all properties', () => {
      const error = new BaseError(
        'Test error',
        'TEST_ERROR',
        ErrorSeverity.HIGH,
        ErrorCategory.NETWORK,
        RecoveryStrategy.RETRY,
        true
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(error.isRetryable).toBe(true);
      expect(error.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should add context to error', () => {
      const error = new BaseError('Test error', 'TEST_ERROR');
      error.addContext({ userId: '123', operation: 'test' });

      expect(error.metadata.context).toEqual({
        userId: '123',
        operation: 'test'
      });
    });

    it('should set correlation ID', () => {
      const error = new BaseError('Test error', 'TEST_ERROR');
      error.setCorrelationId('corr-123');

      expect(error.metadata.correlationId).toBe('corr-123');
    });

    it('should convert to JSON', () => {
      const error = new BaseError('Test error', 'TEST_ERROR');
      const json = error.toJSON();

      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('severity');
      expect(json).toHaveProperty('category');
      expect(json).toHaveProperty('metadata');
    });
  });

  describe('NetworkError', () => {
    it('should create network error with retryable defaults', () => {
      const error = new NetworkError('Network failed');

      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseError('DB connection failed');

      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.isRetryable).toBe(true);
    });

    it('should create non-retryable database error', () => {
      const error = new DatabaseError('Invalid query', 'INVALID_QUERY', false);

      expect(error.isRetryable).toBe(false);
      expect(error.recoveryStrategy).toBe(RecoveryStrategy.TERMINATE);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field errors', () => {
      const validationErrors = {
        email: ['Invalid format', 'Required'],
        password: ['Too short']
      };
      const error = new ValidationError('Validation failed', validationErrors);

      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.isRetryable).toBe(false);
      expect(error.validationErrors).toEqual(validationErrors);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry info', () => {
      const reset = new Date();
      const error = new RateLimitError('Rate limited', 5000, 100, 0, reset);

      expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(error.isRetryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
      expect(error.limit).toBe(100);
      expect(error.remaining).toBe(0);
      expect(error.reset).toBe(reset);
    });
  });

  describe('AggregateError', () => {
    it('should aggregate multiple errors', () => {
      const errors = [
        new NetworkError('Network failed'),
        new DatabaseError('DB failed'),
        new ValidationError('Validation failed')
      ];
      const aggregateError = new AggregateError(errors);

      expect(aggregateError.errors).toHaveLength(3);
      expect(aggregateError.getAllMessages()).toEqual([
        'Network failed',
        'DB failed',
        'Validation failed'
      ]);
    });

    it('should detect retryable errors in aggregate', () => {
      const errors = [
        new ValidationError('Validation failed'),
        new NetworkError('Network failed')
      ];
      const aggregateError = new AggregateError(errors);

      expect(aggregateError.hasRetryableError()).toBe(true);
    });
  });

  describe('ErrorFactory', () => {
    it('should create error from unknown type', () => {
      const error = ErrorFactory.fromUnknown('String error');
      expect(error).toBeInstanceOf(BaseError);
      expect(error.message).toBe('String error');
    });

    it('should wrap native Error', () => {
      const nativeError = new Error('Native error');
      const error = ErrorFactory.fromUnknown(nativeError);
      
      expect(error).toBeInstanceOf(BaseError);
      expect(error.originalError).toBe(nativeError);
    });

    it('should create network error with context', () => {
      const error = ErrorFactory.networkError(
        'Request failed',
        'https://api.example.com',
        'GET',
        500
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.metadata.context).toEqual({
        url: 'https://api.example.com',
        method: 'GET',
        statusCode: 500
      });
    });

    it('should create database error with context', () => {
      const error = ErrorFactory.databaseError(
        'Query failed',
        'INSERT',
        'users',
        'INSERT INTO users...'
      );

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.metadata.context).toEqual({
        operation: 'INSERT',
        table: 'users',
        query: 'INSERT INTO users...'
      });
    });
  });

  describe('Type Guards', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(new NetworkError('Network failed'))).toBe(true);
      expect(isRetryableError(new ValidationError('Validation failed'))).toBe(false);
      expect(isRetryableError(new Error('Regular error'))).toBe(false);
    });

    it('should identify critical errors', () => {
      const criticalError = new ConfigurationError('Config missing');
      expect(isCriticalError(criticalError)).toBe(true);
      
      const normalError = new NetworkError('Network failed');
      expect(isCriticalError(normalError)).toBe(false);
    });

    it('should extract error message', () => {
      expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
      expect(getErrorMessage('String error')).toBe('String error');
      expect(getErrorMessage(null)).toBe('An unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
    });
  });
});

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockOperation: any;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockOperation = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Retry Logic', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      mockOperation.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError('Network failed');
        }
        return 'success';
      });

      const result = await errorHandler.executeWithRetry(mockOperation, {
        maxAttempts: 3,
        initialDelay: 10
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      mockOperation.mockRejectedValue(new ValidationError('Validation failed'));

      await expect(
        errorHandler.executeWithRetry(mockOperation, {
          maxAttempts: 3,
          initialDelay: 10
        })
      ).rejects.toThrow('Validation failed');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retry attempts', async () => {
      mockOperation.mockRejectedValue(new NetworkError('Network failed'));

      await expect(
        errorHandler.executeWithRetry(mockOperation, {
          maxAttempts: 2,
          initialDelay: 10
        })
      ).rejects.toThrow('Network failed');

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Exponential Backoff', () => {
    it('should apply exponential backoff', async () => {
      const delays: number[] = [];
      const originalSleep = (errorHandler as any).sleep;
      
      (errorHandler as any).sleep = vi.fn((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      mockOperation
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockResolvedValue('success');

      await errorHandler.executeWithBackoff(mockOperation, 3);

      expect(delays.length).toBe(2);
      expect(delays[1]).toBeGreaterThan(delays[0]); // Exponential increase
      
      (errorHandler as any).sleep = originalSleep;
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      mockOperation.mockRejectedValue(new NetworkError('Network failed'));

      // Fail 5 times to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker(mockOperation, 'test-circuit');
        } catch (e) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      await expect(
        errorHandler.executeWithCircuitBreaker(mockOperation, 'test-circuit')
      ).rejects.toThrow('Circuit breaker is open');

      expect(errorHandler.getCircuitBreakerState('test-circuit')).toBe('open');
    });

    it('should close circuit after success threshold', async () => {
      // First open the circuit
      mockOperation.mockRejectedValue(new NetworkError('Network failed'));
      
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker(mockOperation, 'test-circuit-2');
        } catch (e) {
          // Expected
        }
      }

      // Reset circuit breaker to simulate timeout
      errorHandler.resetCircuitBreaker('test-circuit-2');

      // Now succeed to close circuit
      mockOperation.mockResolvedValue('success');
      
      const result = await errorHandler.executeWithCircuitBreaker(
        mockOperation,
        'test-circuit-2'
      );

      expect(result).toBe('success');
    });
  });

  describe('Error Handling with Fallback', () => {
    it('should use fallback on error', async () => {
      mockOperation.mockRejectedValue(new ParsingError('Parse failed'));
      const fallback = vi.fn().mockReturnValue('fallback-value');

      const result = await errorHandler.handle(mockOperation, {
        name: 'test-operation',
        fallback
      });

      expect(result).toBe('fallback-value');
      expect(fallback).toHaveBeenCalled();
    });

    it('should not use fallback on success', async () => {
      mockOperation.mockResolvedValue('success');
      const fallback = vi.fn();

      const result = await errorHandler.handle(mockOperation, {
        name: 'test-operation',
        fallback
      });

      expect(result).toBe('success');
      expect(fallback).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limit Handling', () => {
    it('should handle rate limit with delay', async () => {
      const rateLimitError = new RateLimitError('Rate limited', 100);
      mockOperation.mockResolvedValue('success');

      const startTime = Date.now();
      const result = await errorHandler.handleRateLimit(rateLimitError, mockOperation);
      const elapsed = Date.now() - startTime;

      expect(result).toBe('success');
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some margin
      expect(mockOperation).toHaveBeenCalled();
    });
  });

  describe('Global Error Handler', () => {
    it('should have global instance', () => {
      expect(globalErrorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('should handle operations through global handler', async () => {
      const operation = vi.fn().mockResolvedValue('global-success');
      
      const result = await globalErrorHandler.handle(operation);
      
      expect(result).toBe('global-success');
      expect(operation).toHaveBeenCalled();
    });
  });
});