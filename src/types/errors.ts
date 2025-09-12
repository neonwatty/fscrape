/**
 * Error type utilities for type-safe error handling
 */

import { BaseError } from '../utils/errors.js';

/**
 * Union type for all possible errors in the application
 */
export type AppError = Error | BaseError | NodeJS.ErrnoException | unknown;

/**
 * Type guard for Node.js system errors (e.g., file system errors)
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

/**
 * Type guard for BaseError instances
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Type guard for standard Error instances
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Safely extract error code from unknown error type
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isBaseError(error)) return error.code;
  if (isNodeError(error)) return error.code;
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as any).code);
  }
  return undefined;
}

/**
 * Safely extract stack trace from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) return error.stack;
  if (error && typeof error === 'object' && 'stack' in error) {
    return String((error as any).stack);
  }
  return undefined;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isBaseError(error)) return error.isRetryable;
  
  // Common retryable error codes
  const code = getErrorCode(error);
  if (code) {
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EPIPE',
      'EAI_AGAIN'
    ];
    return retryableCodes.includes(code);
  }
  
  return false;
}

/**
 * Format error for logging
 */
export function formatError(error: unknown): string {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const stack = getErrorStack(error);
  
  let formatted = message;
  if (code) formatted = `[${code}] ${formatted}`;
  if (stack && process.env.NODE_ENV === 'development') {
    formatted += `\n${stack}`;
  }
  
  return formatted;
}