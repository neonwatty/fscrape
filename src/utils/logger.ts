/**
 * Production logger utility for the application
 * Uses winston for structured logging with multiple transports
 */

import {
  initializeLogger,
  setupGlobalErrorLogging,
} from "./advanced-logger.js";
import type { LogMetadata } from "./advanced-logger.js";

// Initialize the advanced logger with default configuration
const advancedLogger = initializeLogger({
  level: process.env.LOG_LEVEL || "info",
  silent: process.env.NODE_ENV === "test",
  enableConsoleInProduction: process.env.ENABLE_CONSOLE_IN_PROD === "true",
  logDirectory: process.env.LOG_DIR || "logs",
  defaultMeta: {
    service: "fscrape",
    environment: process.env.NODE_ENV || "development",
  },
});

// Setup global error logging if not in test environment
if (process.env.NODE_ENV !== "test") {
  setupGlobalErrorLogging();
}

/**
 * Main logger interface - maintains backward compatibility
 */
export const logger = {
  /**
   * Log debug message
   */
  debug: (message: string, ...args: any[]) => {
    if (args.length > 0) {
      advancedLogger.debug(message, { data: args });
    } else {
      advancedLogger.debug(message);
    }
  },

  /**
   * Log info message
   */
  info: (message: string, ...args: any[]) => {
    if (args.length > 0) {
      advancedLogger.info(message, { data: args });
    } else {
      advancedLogger.info(message);
    }
  },

  /**
   * Log warning message
   */
  warn: (message: string, ...args: any[]) => {
    if (args.length > 0) {
      advancedLogger.warn(message, { data: args });
    } else {
      advancedLogger.warn(message);
    }
  },

  /**
   * Log error message
   */
  error: (message: string, ...args: any[]) => {
    // Check if first argument is an Error object
    if (args.length > 0 && args[0] instanceof Error) {
      const error = args[0];
      const additionalArgs = args.slice(1);
      advancedLogger.error(message, {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        data: additionalArgs.length > 0 ? additionalArgs : undefined,
      });
    } else if (args.length > 0) {
      advancedLogger.error(message, { data: args });
    } else {
      advancedLogger.error(message);
    }
  },

  /**
   * Log critical message (new level)
   */
  critical: (message: string, error?: Error, meta?: LogMetadata) => {
    const metadata: LogMetadata = { ...meta };
    if (error) {
      metadata.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }
    advancedLogger.critical(message, metadata);
  },

  /**
   * Log HTTP request (new level)
   */
  http: (message: string, meta?: LogMetadata) => {
    advancedLogger.http(message, meta);
  },

  /**
   * Log verbose message (new level)
   */
  verbose: (message: string, meta?: LogMetadata) => {
    advancedLogger.verbose(message, meta);
  },

  /**
   * Start a performance timer
   */
  startTimer: (label: string) => {
    advancedLogger.startTimer(label);
  },

  /**
   * End a performance timer and log the duration
   */
  endTimer: (label: string, message?: string, meta?: LogMetadata) => {
    advancedLogger.endTimer(label, message, meta);
  },

  /**
   * Create a child logger with additional metadata
   */
  child: (metadata: Record<string, any>) => {
    const childAdvancedLogger = advancedLogger.child(metadata);
    return {
      debug: (message: string, ...args: any[]) => {
        childAdvancedLogger.debug(message, {
          data: args.length > 0 ? args : undefined,
        });
      },
      info: (message: string, ...args: any[]) => {
        childAdvancedLogger.info(message, {
          data: args.length > 0 ? args : undefined,
        });
      },
      warn: (message: string, ...args: any[]) => {
        childAdvancedLogger.warn(message, {
          data: args.length > 0 ? args : undefined,
        });
      },
      error: (message: string, ...args: any[]) => {
        childAdvancedLogger.error(message, {
          data: args.length > 0 ? args : undefined,
        });
      },
    };
  },

  /**
   * Profile a section of code
   */
  profile: (id: string, meta?: LogMetadata) => {
    advancedLogger.profile(id, meta);
  },

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled: (level: string) => {
    return advancedLogger.isLevelEnabled(level);
  },
};

// Export the advanced logger instance for direct access
export { advancedLogger };

// Re-export types and utilities from advanced-logger
export type {
  LoggerConfig,
  LogMetadata,
  TransportConfig,
} from "./advanced-logger.js";
export { LogLevel } from "./advanced-logger.js";
export {
  getLogger,
  initializeLogger as configureLogger,
  requestLoggingMiddleware,
} from "./advanced-logger.js";
