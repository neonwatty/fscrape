/**
 * Enhanced logger using Winston with comprehensive error handling
 */

import winston from 'winston';
import path from 'path';
import { BaseError, ErrorSeverity } from './errors.js';

/**
 * Custom log levels matching error severity
 */
const customLevels = {
  levels: {
    critical: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
  },
  colors: {
    critical: 'red bold',
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'gray',
  },
};

/**
 * Format for console output with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let output = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      // Handle error objects specially
      if (meta.error instanceof BaseError) {
        const error = meta.error;
        output += `\n  Code: ${error.code}`;
        output += `\n  Category: ${error.category}`;
        output += `\n  Severity: ${error.severity}`;
        output += `\n  Retryable: ${error.isRetryable}`;
        if (error.metadata.context) {
          output += `\n  Context: ${JSON.stringify(error.metadata.context)}`;
        }
      } else if (meta.error instanceof Error) {
        output += `\n  Error: ${meta.error.message}`;
        if (meta.error.stack && process.env.LOG_STACK_TRACES === 'true') {
          output += `\n  Stack: ${meta.error.stack}`;
        }
      } else if (Object.keys(meta).length > 0) {
        output += `\n  Metadata: ${JSON.stringify(meta, null, 2)}`;
      }
    }

    return output;
  })
);

/**
 * Format for file output (JSON)
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create transports based on environment
 */
function createTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console transport (always enabled unless in test)
  if (process.env.NODE_ENV !== 'test') {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info',
        handleExceptions: true,
        handleRejections: true,
      })
    );
  }

  // File transports (only in production)
  if (process.env.NODE_ENV === 'production') {
    const logDir = process.env.LOG_DIR || 'logs';

    // Error log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true,
      })
    );

    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true,
      })
    );

    // Critical errors log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'critical.log'),
        level: 'critical',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        tailable: true,
      })
    );
  }

  return transports;
}

/**
 * Create the Winston logger instance
 */
const winstonLogger = winston.createLogger({
  levels: customLevels.levels,
  transports: createTransports(),
  exitOnError: false,
  silent: process.env.DISABLE_LOGGING === 'true',
});

// Add colors if using console transport
if (process.env.NODE_ENV !== 'test') {
  winston.addColors(customLevels.colors);
}

/**
 * Logger interface matching existing logger
 */
export interface Logger {
  trace(message: string, ...meta: unknown[]): void;
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, error?: Error | BaseError, ...meta: unknown[]): void;
  critical(message: string, error?: Error | BaseError, ...meta: unknown[]): void;
  logError(error: Error | BaseError, context?: Record<string, unknown>): void;
  child(metadata: Record<string, unknown>): Logger;
  startTimer(): () => void;
}

/**
 * Enhanced logger implementation
 */
class EnhancedLogger implements Logger {
  private metadata: Record<string, unknown> = {};

  constructor(metadata?: Record<string, unknown>) {
    this.metadata = metadata || {};
  }

  trace(message: string, ...meta: unknown[]): void {
    winstonLogger.log('trace', message, {
      ...this.metadata,
      ...this.extractMeta(meta),
    });
  }

  debug(message: string, ...meta: unknown[]): void {
    winstonLogger.debug(message, {
      ...this.metadata,
      ...this.extractMeta(meta),
    });
  }

  info(message: string, ...meta: unknown[]): void {
    winstonLogger.info(message, {
      ...this.metadata,
      ...this.extractMeta(meta),
    });
  }

  warn(message: string, ...meta: unknown[]): void {
    winstonLogger.warn(message, {
      ...this.metadata,
      ...this.extractMeta(meta),
    });
  }

  error(message: string, error?: Error | BaseError, ...meta: unknown[]): void {
    const metadata = { ...this.metadata, ...this.extractMeta(meta) };
    if (error) {
      metadata.error = error;
    }
    winstonLogger.error(message, metadata);
  }

  critical(message: string, error?: Error | BaseError, ...meta: unknown[]): void {
    const metadata = { ...this.metadata, ...this.extractMeta(meta) };
    if (error) {
      metadata.error = error;
      // Log critical errors with full stack trace
      if (error instanceof Error && error.stack) {
        metadata.stack = error.stack;
      }
    }
    winstonLogger.log('critical', message, metadata);
  }

  /**
   * Log an error with automatic severity detection
   */
  logError(error: Error | BaseError, context?: Record<string, unknown>): void {
    const metadata = { ...this.metadata, ...context, error };

    if (error instanceof BaseError) {
      const message = `[${error.code}] ${error.message}`;

      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
          this.critical(message, error);
          break;
        case ErrorSeverity.HIGH:
          this.error(message, error);
          break;
        case ErrorSeverity.MEDIUM:
          this.warn(message, undefined, metadata);
          break;
        case ErrorSeverity.LOW:
          this.info(message, metadata);
          break;
        default:
          this.error(message, error);
      }
    } else {
      this.error(error.message, error);
    }
  }

  /**
   * Create a child logger with additional metadata
   */
  child(metadata: Record<string, unknown>): Logger {
    return new EnhancedLogger({ ...this.metadata, ...metadata });
  }

  /**
   * Start a timer for performance logging
   */
  startTimer(): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      return duration;
    };
  }

  /**
   * Extract metadata from variadic arguments
   */
  private extractMeta(args: unknown[]): Record<string, unknown> {
    if (args.length === 0) return {};

    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
      return args[0] as Record<string, unknown>;
    }

    return { data: args };
  }
}

/**
 * Global logger instance
 */
export const logger: Logger = new EnhancedLogger();

/**
 * Create a scoped logger with context
 */
export function createLogger(scope: string, metadata?: Record<string, unknown>): Logger {
  return logger.child({ scope, ...metadata });
}

/**
 * Middleware for Express/Koa error logging
 */
export function errorLoggingMiddleware(
  err: Error,
  req: Record<string, unknown>,
  res: Record<string, unknown>,
  next: () => void
): void {
  const metadata = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: (req.get as any)?.('user-agent'),
    correlationId: req.id || req.correlationId,
  };

  logger.logError(err, metadata);

  next();
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.critical('Uncaught Exception', error);
    // Give logger time to write before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.critical('Unhandled Promise Rejection', new Error(String(reason)), {
      promise: promise.toString(),
    });
  });

  // Handle warnings
  process.on('warning', (warning: Error) => {
    logger.warn('Process Warning', undefined, {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });
}

/**
 * Flush logs and close transports
 */
export async function closeLogger(): Promise<void> {
  return new Promise((resolve) => {
    winstonLogger.end(() => {
      resolve();
    });
  });
}

// Export the winston logger for advanced usage
export { winstonLogger };
