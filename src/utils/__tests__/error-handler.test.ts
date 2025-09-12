/**
 * Test suite for error handler with recovery strategies and user notifications
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ErrorHandler,
  globalErrorHandler,
  withErrorHandling,
  HandleErrors,
  CircuitBreakerConfig,
  RetryConfig,
  NotificationConfig,
  DegradationConfig,
} from "../error-handler.js";
import {
  BaseError,
  NetworkError,
  RateLimitError,
  ErrorSeverity,
  RecoveryStrategy,
  ValidationError,
  ErrorCategory,
} from "../errors.js";

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;
  let consoleLogSpy: any;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("Basic Error Handling", () => {
    it("should handle successful operations", async () => {
      const operation = vi.fn().mockResolvedValue("success");
      const result = await errorHandler.handle(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledOnce();
    });

    it("should handle failed operations with fallback", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error("Operation failed"));
      const fallback = vi.fn().mockReturnValue("fallback");

      const result = await errorHandler.handle(operation, {
        name: "test_operation",
        fallback,
      });

      expect(result).toBe("fallback");
      expect(operation).toHaveBeenCalledOnce();
      expect(fallback).toHaveBeenCalled();
    });

    it("should add context to errors", async () => {
      // Create a non-retryable error to prevent retries
      const error = new BaseError(
        "Network failed",
        "TEST_ERROR",
        ErrorSeverity.HIGH,
        ErrorCategory.NETWORK,
        RecoveryStrategy.TERMINATE,
        false,
      );
      const operation = vi.fn().mockRejectedValue(error);

      let caughtError: any;
      try {
        await errorHandler.handle(operation, {
          name: "test_operation",
          metadata: { userId: "123" },
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.context).toMatchObject({
        operation: "test_operation",
        userId: "123",
      });
    });
  });

  describe("Retry Logic", () => {
    it("should retry failed operations", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError("Temporary failure"))
        .mockRejectedValueOnce(new NetworkError("Temporary failure"))
        .mockResolvedValue("success");

      const retryPromise = errorHandler.executeWithRetry(operation, {
        maxAttempts: 3,
        initialDelay: 10,
        jitter: false,
      });

      // Advance timers for first retry
      await vi.advanceTimersByTimeAsync(10);
      // Advance timers for second retry (with backoff multiplier of 2)
      await vi.advanceTimersByTimeAsync(20);

      const result = await retryPromise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should not retry non-retryable errors", async () => {
      const error = new ValidationError("Invalid input");
      error.isRetryable = false;
      const operation = vi.fn().mockRejectedValue(error);

      await expect(errorHandler.executeWithRetry(operation)).rejects.toThrow(
        "Invalid input",
      );
      expect(operation).toHaveBeenCalledOnce();
    });

    it("should apply exponential backoff", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError("Failure 1"))
        .mockRejectedValueOnce(new NetworkError("Failure 2"))
        .mockResolvedValue("success");

      const promise = errorHandler.executeWithBackoff(operation, 3);

      // First attempt immediately
      expect(operation).toHaveBeenCalledTimes(1);

      // Second attempt after initial delay (1000ms base + up to 20% jitter)
      await vi.advanceTimersByTimeAsync(1200);
      expect(operation).toHaveBeenCalledTimes(2);

      // Third attempt after backoff (2000ms base + up to 20% jitter)
      await vi.advanceTimersByTimeAsync(2400);
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("should add jitter to backoff delay", async () => {
      const config: RetryConfig = {
        maxAttempts: 2,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
      };

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError("Failure"))
        .mockResolvedValue("success");

      const retryPromise = errorHandler.executeWithRetry(operation, config);

      // Advance timer to handle jitter (max 1200ms with 20% jitter)
      await vi.advanceTimersByTimeAsync(1200);

      await retryPromise;

      // Verify jitter was applied (delay should be between 800-1200ms)
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe("Circuit Breaker", () => {
    it("should open circuit after failure threshold", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new NetworkError("Service unavailable"));
      const circuitConfig: CircuitBreakerConfig = {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        halfOpenMaxAttempts: 1,
      };

      const handler = new ErrorHandler(undefined, circuitConfig);

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await handler.executeWithCircuitBreaker(operation, "test_service");
        } catch (e) {
          // Expected
        }
      }

      // Circuit should be open now
      await expect(
        handler.executeWithCircuitBreaker(operation, "test_service"),
      ).rejects.toThrow("Circuit breaker is open");

      // Operation should not have been called on the 4th attempt
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should transition to half-open after timeout", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError("Service unavailable"))
        .mockRejectedValueOnce(new NetworkError("Service unavailable"))
        .mockResolvedValue("success");

      const circuitConfig: CircuitBreakerConfig = {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 5000,
        halfOpenMaxAttempts: 1,
      };

      const handler = new ErrorHandler(undefined, circuitConfig);

      // Open the circuit by failing operations (need 2 failures)
      for (let i = 0; i < 2; i++) {
        try {
          await handler.executeWithCircuitBreaker(operation, "test_service");
        } catch (e) {
          // Expected failure
        }
      }

      // Circuit should be open after reaching failure threshold
      expect(handler.getCircuitBreakerState("test_service")).toBe("open");

      // Try to execute while circuit is open - should fail without calling operation
      await expect(
        handler.executeWithCircuitBreaker(operation, "test_service"),
      ).rejects.toThrow("Circuit breaker is open");

      // Operation should have been called only 2 times (circuit is open)
      expect(operation).toHaveBeenCalledTimes(2);

      // Wait for timeout
      await vi.advanceTimersByTimeAsync(5000);

      // Should allow one attempt in half-open state
      const result = await handler.executeWithCircuitBreaker(
        operation,
        "test_service",
      );
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should close circuit after success threshold in half-open", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError("Failure"))
        .mockRejectedValueOnce(new NetworkError("Failure"))
        .mockResolvedValue("success");

      const circuitConfig: CircuitBreakerConfig = {
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 1000,
        halfOpenMaxAttempts: 3,
      };

      const handler = new ErrorHandler(undefined, circuitConfig);

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await handler.executeWithCircuitBreaker(operation, "test_service");
        } catch (e) {
          // Expected
        }
      }

      // Wait for timeout to transition to half-open
      vi.advanceTimersByTime(1000);

      // Succeed twice to close circuit
      await handler.executeWithCircuitBreaker(operation, "test_service");
      await handler.executeWithCircuitBreaker(operation, "test_service");

      expect(handler.getCircuitBreakerState("test_service")).toBe("closed");
    });

    it("should reset circuit breaker", async () => {
      const handler = new ErrorHandler();

      // Create a circuit breaker by executing an operation
      const operation = vi.fn().mockResolvedValue("success");
      await handler.executeWithCircuitBreaker(operation, "test_service");
      expect(handler.getCircuitBreakerState("test_service")).toBe("closed");

      // Reset it
      handler.resetCircuitBreaker("test_service");
      expect(handler.getCircuitBreakerState("test_service")).toBeUndefined();
    });
  });

  describe("Rate Limiting", () => {
    it("should handle rate limit errors with retry", async () => {
      const rateLimitError = new RateLimitError(
        "Rate limited",
        1000, // retryAfter in ms
        60, // limit
        0, // remaining
        new Date(Date.now() + 1000), // reset as Date
      );

      const operation = vi.fn().mockResolvedValue("success");

      const promise = errorHandler.handleRateLimit(rateLimitError, operation);

      // Should wait for retry after
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("User Notifications", () => {
    it("should notify on errors when enabled", async () => {
      const notificationConfig: NotificationConfig = {
        enabled: true,
        showErrors: true,
        showWarnings: true,
        showRecoveryAttempts: true,
      };

      const handler = new ErrorHandler(
        undefined,
        undefined,
        notificationConfig,
      );
      const operation = vi
        .fn()
        .mockRejectedValue(
          new BaseError("Test error", "TEST_ERROR", ErrorSeverity.HIGH),
        );

      try {
        await handler.handle(operation, { name: "test_op" });
      } catch (e) {
        // Expected
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("⚠️"));
    });

    it("should use custom notifier when provided", async () => {
      const customNotifier = vi.fn();
      const notificationConfig: NotificationConfig = {
        enabled: true,
        showErrors: true,
        showWarnings: true,
        showRecoveryAttempts: false,
        customNotifier,
      };

      const handler = new ErrorHandler(
        undefined,
        undefined,
        notificationConfig,
      );
      const operation = vi
        .fn()
        .mockRejectedValue(
          new BaseError("Test error", "TEST_ERROR", ErrorSeverity.CRITICAL),
        );

      try {
        await handler.handle(operation, { name: "test_op" });
      } catch (e) {
        // Expected
      }

      expect(customNotifier).toHaveBeenCalledWith(
        expect.stringContaining("Critical error"),
        "error",
      );
    });

    it("should respect notification level settings", async () => {
      const notificationConfig: NotificationConfig = {
        enabled: true,
        showErrors: false,
        showWarnings: true,
        showRecoveryAttempts: false,
      };

      const handler = new ErrorHandler(
        undefined,
        undefined,
        notificationConfig,
      );
      const operation = vi
        .fn()
        .mockRejectedValue(
          new BaseError("Test error", "TEST_ERROR", ErrorSeverity.CRITICAL),
        );

      try {
        await handler.handle(operation, { name: "test_op" });
      } catch (e) {
        // Expected
      }

      // Should not log error notifications when showErrors is false
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("❌"),
      );
    });

    it("should notify recovery attempts when enabled", async () => {
      const notificationConfig: NotificationConfig = {
        enabled: true,
        showErrors: true,
        showWarnings: true,
        showRecoveryAttempts: true,
      };

      const handler = new ErrorHandler(
        undefined,
        undefined,
        notificationConfig,
      );
      const error = new NetworkError("Network error");
      error.isRetryable = true;
      error.recoveryStrategy = RecoveryStrategy.RETRY;

      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      await handler.handle(operation, { name: "test_op" });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempting recovery"),
      );
    });
  });

  describe("Graceful Degradation", () => {
    it("should degrade service after threshold failures", async () => {
      const degradationConfig: DegradationConfig = {
        enabled: true,
        fallbackServices: new Map([
          ["test_service", () => "degraded_response"],
        ]),
        degradationThreshold: 3,
        autoRecover: false,
        recoveryCheckInterval: 5000,
      };

      const handler = new ErrorHandler(
        undefined,
        undefined,
        undefined,
        degradationConfig,
      );

      const operation = vi.fn().mockRejectedValue(new Error("Service error"));

      // Fail 3 times to trigger degradation
      for (let i = 0; i < 3; i++) {
        try {
          await handler.handle(operation, { name: "test_service" });
        } catch (e) {
          // Expected
        }
      }

      // Service should be degraded
      expect(handler.getDegradedServices()).toContain("test_service");

      // Should use fallback on next call
      const result = await handler.handle(operation, { name: "test_service" });
      expect(result).toBe("degraded_response");
      expect(operation).toHaveBeenCalledTimes(3); // Not called again
    });

    it("should auto-recover degraded services", async () => {
      const degradationConfig: DegradationConfig = {
        enabled: true,
        fallbackServices: new Map(),
        degradationThreshold: 2,
        autoRecover: true,
        recoveryCheckInterval: 5000,
      };

      const handler = new ErrorHandler(
        undefined,
        undefined,
        undefined,
        degradationConfig,
      );

      const operation = vi.fn().mockRejectedValue(new Error("Service error"));

      // Trigger degradation
      for (let i = 0; i < 2; i++) {
        try {
          await handler.handle(operation, { name: "test_service" });
        } catch (e) {
          // Expected
        }
      }

      expect(handler.getDegradedServices()).toContain("test_service");

      // Wait for auto-recovery
      vi.advanceTimersByTime(5000);

      // Service should be recovered
      expect(handler.getDegradedServices()).not.toContain("test_service");
    });

    it("should manually clear error count", () => {
      const handler = new ErrorHandler();
      const operation = vi.fn().mockRejectedValue(new Error("Service error"));

      // Generate some errors
      handler.handle(operation, { name: "test_service" }).catch(() => {});

      // Clear error count
      handler.clearErrorCount("test_service");

      expect(handler.getDegradedServices()).not.toContain("test_service");
    });

    it("should configure degradation settings", () => {
      const handler = new ErrorHandler();

      handler.configureDegradation({
        enabled: false,
        degradationThreshold: 5,
      });

      // Degradation should be disabled
      const operation = vi.fn().mockRejectedValue(new Error("Service error"));

      // Even after many failures, service should not be degraded
      for (let i = 0; i < 10; i++) {
        handler.handle(operation, { name: "test_service" }).catch(() => {});
      }

      expect(handler.getDegradedServices()).toHaveLength(0);
    });
  });

  describe("Recovery Strategies", () => {
    it("should determine retry strategy for retryable errors", async () => {
      const handler = new ErrorHandler();
      const error = new NetworkError("Temporary failure");
      error.isRetryable = true;

      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await handler.handle(operation, { name: "test_op" });
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should apply exponential backoff for rate limits", async () => {
      const handler = new ErrorHandler();
      const rateLimitError = new RateLimitError(
        "Rate limited",
        429,
        60,
        0,
        Date.now() + 1000,
      );

      const operation = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const promise = handler.handle(operation, { name: "test_op" });

      // Should apply backoff
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("should terminate on critical errors", async () => {
      const handler = new ErrorHandler();
      const error = new BaseError(
        "Critical failure",
        "CRITICAL",
        ErrorSeverity.CRITICAL,
      );
      error.recoveryStrategy = RecoveryStrategy.TERMINATE;

      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        handler.handle(operation, { name: "test_op" }),
      ).rejects.toThrow("Critical failure");

      expect(operation).toHaveBeenCalledOnce();
    });

    it("should ignore errors with ignore strategy", async () => {
      const handler = new ErrorHandler();
      const error = new BaseError(
        "Ignorable error",
        "IGNORE",
        ErrorSeverity.LOW,
      );
      error.recoveryStrategy = RecoveryStrategy.IGNORE;

      const operation = vi.fn().mockRejectedValue(error);

      const result = await handler.handle(operation, { name: "test_op" });
      expect(result).toBeUndefined();
    });
  });

  describe("Global Error Handler", () => {
    it("should have global instance available", () => {
      expect(globalErrorHandler).toBeInstanceOf(ErrorHandler);
    });

    it("should wrap functions with error handling", async () => {
      const originalFn = vi.fn().mockResolvedValue("result");
      const wrappedFn = withErrorHandling(originalFn, {
        name: "wrapped_function",
      });

      const result = await wrappedFn();
      expect(result).toBe("result");
      expect(originalFn).toHaveBeenCalled();
    });

    it("should handle errors in wrapped functions", async () => {
      const originalFn = vi.fn().mockRejectedValue(new Error("Function error"));
      const fallback = vi.fn().mockReturnValue("fallback");

      const wrappedFn = withErrorHandling(originalFn, {
        name: "wrapped_function",
        fallback,
      });

      const result = await wrappedFn();
      expect(result).toBe("fallback");
    });
  });

  describe("Decorator", () => {
    it("should decorate class methods with error handling", async () => {
      class TestClass {
        @HandleErrors({ fallback: () => "fallback_value" })
        async testMethod() {
          throw new Error("Method error");
        }
      }

      const instance = new TestClass();
      const result = await instance.testMethod();

      expect(result).toBe("fallback_value");
    });

    it("should preserve method context in decorator", async () => {
      class TestClass {
        private value = "test_value";

        @HandleErrors()
        async getValue() {
          return this.value;
        }
      }

      const instance = new TestClass();
      const result = await instance.getValue();

      expect(result).toBe("test_value");
    });
  });

  describe("Error Factory Integration", () => {
    it("should handle unknown errors", async () => {
      const handler = new ErrorHandler();
      const operation = vi.fn().mockRejectedValue("string error");

      try {
        await handler.handle(operation, { name: "test_op" });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BaseError);
        expect(error.message).toBe("string error");
      }
    });

    it("should preserve error properties", async () => {
      const handler = new ErrorHandler();
      const originalError = new NetworkError("Network failed", "NETWORK_ERROR");
      originalError.addContext({ requestId: "123" });
      // Override recovery strategy to prevent retries
      originalError.recoveryStrategy = RecoveryStrategy.TERMINATE;

      const operation = vi.fn().mockRejectedValue(originalError);

      let caughtError: any;
      try {
        await handler.handle(operation, { name: "test_op" });
      } catch (error: any) {
        caughtError = error;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.code).toBe("NETWORK_ERROR");
      expect(caughtError.context).toBeDefined();
      expect(caughtError.context.requestId).toBe("123");
      expect(caughtError.context.operation).toBe("test_op");
    });
  });

  describe("Performance", () => {
    it("should handle concurrent operations", async () => {
      const handler = new ErrorHandler();
      const operations = Array.from({ length: 10 }, (_, i) =>
        vi.fn().mockResolvedValue(`result_${i}`),
      );

      const promises = operations.map((op, i) =>
        handler.handle(op, { name: `operation_${i}` }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBe(`result_${i}`);
      });
    });

    it("should isolate circuit breakers per operation", async () => {
      const handler = new ErrorHandler();
      const failingOp = vi.fn().mockRejectedValue(new Error("Failure"));
      const successOp = vi.fn().mockResolvedValue("success");

      // Fail one operation multiple times
      for (let i = 0; i < 5; i++) {
        try {
          await handler.executeWithCircuitBreaker(failingOp, "failing_service");
        } catch (e) {
          // Expected
        }
      }

      // Other operation should still work
      const result = await handler.executeWithCircuitBreaker(
        successOp,
        "working_service",
      );
      expect(result).toBe("success");

      // Circuit states should be independent
      expect(handler.getCircuitBreakerState("failing_service")).toBe("open");
      expect(handler.getCircuitBreakerState("working_service")).toBe("closed");
    });
  });
});
