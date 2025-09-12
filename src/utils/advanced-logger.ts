/**
 * Advanced production logging system with winston
 * Provides structured logging with multiple transports, formatting, and performance optimization
 */

import winston from "winston";
import path from "path";
import os from "os";

/**
 * Log levels for the application
 */
export enum LogLevel {
  CRITICAL = "critical",
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  HTTP = "http",
  VERBOSE = "verbose",
  DEBUG = "debug",
  SILLY = "silly",
}

/**
 * Custom log levels with priorities
 */
const customLevels = {
  levels: {
    critical: 0,
    error: 1,
    warn: 2,
    info: 3,
    http: 4,
    verbose: 5,
    debug: 6,
    silly: 7,
  },
  colors: {
    critical: "red bold",
    error: "red",
    warn: "yellow",
    info: "cyan",
    http: "magenta",
    verbose: "blue",
    debug: "gray",
    silly: "grey",
  },
};

/**
 * Transport configuration interface
 */
export interface TransportConfig {
  type: "console" | "file" | "http" | "stream";
  level?: string;
  filename?: string;
  maxsize?: number;
  maxFiles?: number;
  format?: winston.Logform.Format;
  url?: string;
  stream?: NodeJS.WritableStream;
}

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level?: string;
  transports?: TransportConfig[];
  exitOnError?: boolean;
  silent?: boolean;
  defaultMeta?: Record<string, any>;
  logDirectory?: string;
  enableConsoleInProduction?: boolean;
  enableFileRotation?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  datePattern?: string;
}

/**
 * Log metadata interface
 */
export interface LogMetadata {
  timestamp?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  error?: Error | any;
  stack?: string;
  [key: string]: any;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.LOG_LEVEL || "info",
  exitOnError: false,
  silent: process.env.NODE_ENV === "test",
  logDirectory: process.env.LOG_DIR || "logs",
  enableConsoleInProduction: false,
  enableFileRotation: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5,
  datePattern: "YYYY-MM-DD",
};

/**
 * Create custom format for structured logging
 */
function createStructuredFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...meta } = info;

      // Build structured log object
      const logObject: any = {
        timestamp,
        level,
        message,
      };

      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        logObject.metadata = meta;
      }

      // Add system info for critical errors
      if (level === "critical" || level === "error") {
        logObject.system = {
          hostname: os.hostname(),
          platform: os.platform(),
          nodeVersion: process.version,
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        };
      }

      return JSON.stringify(logObject);
    }),
  );
}

/**
 * Create console format with colors and readable output
 */
function createConsoleFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
    winston.format.colorize({ all: true }),
    winston.format.align(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let output = `${timestamp} [${level}]: ${message}`;

      // Add metadata in readable format
      if (meta.error) {
        output += `\n  Error: ${meta.error.message || meta.error}`;
        if (meta.error.stack && process.env.LOG_STACK_TRACES === "true") {
          output += `\n  Stack: ${meta.error.stack}`;
        }
      }

      // Add other metadata
      const filteredMeta = { ...meta };
      delete filteredMeta.error;

      if (Object.keys(filteredMeta).length > 0) {
        output += `\n  Meta: ${JSON.stringify(filteredMeta, null, 2)}`;
      }

      return output;
    }),
  );
}

/**
 * Create transport based on configuration
 */
function createTransport(config: TransportConfig): winston.transport {
  switch (config.type) {
    case "console":
      return new winston.transports.Console({
        level: config.level,
        format: config.format || createConsoleFormat(),
      });

    case "file":
      if (!config.filename) {
        throw new Error("Filename is required for file transport");
      }
      return new winston.transports.File({
        filename: config.filename,
        level: config.level,
        format: config.format || createStructuredFormat(),
        maxsize: config.maxsize,
        maxFiles: config.maxFiles,
      });

    case "http":
      if (!config.url) {
        throw new Error("URL is required for HTTP transport");
      }
      return new winston.transports.Http({
        host: new URL(config.url).hostname,
        port: parseInt(new URL(config.url).port) || 80,
        path: new URL(config.url).pathname,
        level: config.level,
        format: config.format || createStructuredFormat(),
      });

    case "stream":
      if (!config.stream) {
        throw new Error("Stream is required for stream transport");
      }
      return new winston.transports.Stream({
        stream: config.stream,
        level: config.level,
        format: config.format || createStructuredFormat(),
      });

    default:
      throw new Error(`Unknown transport type: ${(config as any).type}`);
  }
}

/**
 * Advanced logger class
 */
export class AdvancedLogger {
  private winston: winston.Logger;
  private config: LoggerConfig;
  private defaultMeta: Record<string, any>;
  private timers: Map<string, number> = new Map();

  constructor(config?: LoggerConfig) {
    // Get fresh config values from environment at construction time
    const envConfig: LoggerConfig = {
      level: process.env.LOG_LEVEL || DEFAULT_CONFIG.level,
      silent: process.env.NODE_ENV === "test",
      logDirectory: process.env.LOG_DIR || DEFAULT_CONFIG.logDirectory,
      enableConsoleInProduction: process.env.ENABLE_CONSOLE_IN_PROD === "true",
    };

    this.config = { ...DEFAULT_CONFIG, ...envConfig, ...config };
    this.defaultMeta = this.config.defaultMeta || {};

    // Initialize winston logger
    this.winston = this.createWinstonLogger();

    // Add colors for custom levels
    winston.addColors(customLevels.colors);
  }

  /**
   * Create winston logger instance
   */
  private createWinstonLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Add configured transports
    if (this.config.transports) {
      this.config.transports.forEach((transportConfig) => {
        transports.push(createTransport(transportConfig));
      });
    } else {
      // Default transports based on environment
      transports.push(...this.getDefaultTransports());
    }

    return winston.createLogger({
      levels: customLevels.levels,
      level: this.config.level,
      format: createStructuredFormat(),
      transports,
      exitOnError: this.config.exitOnError,
      silent: this.config.silent,
      defaultMeta: this.defaultMeta,
    });
  }

  /**
   * Get default transports based on environment
   */
  private getDefaultTransports(): winston.transport[] {
    const transports: winston.transport[] = [];
    const isProduction = process.env.NODE_ENV === "production";
    const logDir = this.config.logDirectory!;

    // Console transport
    if (!isProduction || this.config.enableConsoleInProduction) {
      transports.push(
        new winston.transports.Console({
          format: createConsoleFormat(),
          level: this.config.level,
        }),
      );
    }

    // File transports for production
    if (isProduction || process.env.ENABLE_FILE_LOGGING === "true") {
      // Error log file
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, "error.log"),
          level: "error",
          format: createStructuredFormat(),
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
        }),
      );

      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, "combined.log"),
          format: createStructuredFormat(),
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
        }),
      );

      // Critical errors log file
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, "critical.log"),
          level: "critical",
          format: createStructuredFormat(),
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles! * 2, // Keep more critical logs
        }),
      );
    }

    return transports;
  }

  /**
   * Log critical message
   */
  critical(message: string, meta?: LogMetadata): void {
    this.winston.log("critical", message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, meta?: LogMetadata): void {
    this.winston.error(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: LogMetadata): void {
    this.winston.warn(message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: LogMetadata): void {
    this.winston.info(message, meta);
  }

  /**
   * Log HTTP message
   */
  http(message: string, meta?: LogMetadata): void {
    this.winston.http(message, meta);
  }

  /**
   * Log verbose message
   */
  verbose(message: string, meta?: LogMetadata): void {
    this.winston.verbose(message, meta);
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: LogMetadata): void {
    this.winston.debug(message, meta);
  }

  /**
   * Log silly message
   */
  silly(message: string, meta?: LogMetadata): void {
    this.winston.silly(message, meta);
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  /**
   * End a timer and log the duration
   */
  endTimer(label: string, message?: string, meta?: LogMetadata): void {
    const startTime = this.timers.get(label);
    if (!startTime) {
      this.warn(`Timer '${label}' was not started`);
      return;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    const logMessage = message || `Timer '${label}' completed`;
    this.info(logMessage, {
      ...meta,
      duration,
      timer: label,
    });
  }

  /**
   * Create a child logger with additional default metadata
   */
  child(defaultMeta: Record<string, any>): AdvancedLogger {
    const childConfig = {
      ...this.config,
      defaultMeta: { ...this.defaultMeta, ...defaultMeta },
    };
    return new AdvancedLogger(childConfig);
  }

  /**
   * Add a new transport dynamically
   */
  addTransport(config: TransportConfig): void {
    const transport = createTransport(config);
    this.winston.add(transport);
  }

  /**
   * Remove a transport by name
   */
  removeTransport(transportName: string): void {
    const transport = this.winston.transports.find(
      (t) => (t as any).name === transportName,
    );
    if (transport) {
      this.winston.remove(transport);
    }
  }

  /**
   * Query logs (if using file transport)
   */
  async query(options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.winston.query(options, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  /**
   * Stream logs
   */
  stream(options?: any): NodeJS.ReadableStream {
    return this.winston.stream(options);
  }

  /**
   * Profile a section of code
   */
  profile(id: string, meta?: LogMetadata): void {
    this.winston.profile(id, meta);
  }

  /**
   * Clear all transports
   */
  clear(): void {
    this.winston.clear();
  }

  /**
   * Close the logger and all transports
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      // Clear all transports first
      this.winston.clear();
      // Then end the logger
      this.winston.end(() => resolve());
      // Set a timeout to ensure we don't hang forever
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * Get the winston logger instance (for advanced usage)
   */
  getWinston(): winston.Logger {
    return this.winston;
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.winston.configure({
      level: this.config.level,
      silent: this.config.silent,
    });
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: string): boolean {
    const levelValue =
      customLevels.levels[level as keyof typeof customLevels.levels];
    const currentLevelValue =
      customLevels.levels[
        this.config.level as keyof typeof customLevels.levels
      ];
    return levelValue <= currentLevelValue;
  }
}

/**
 * Global logger instance
 */
let globalLogger: AdvancedLogger | null = null;

/**
 * Initialize global logger
 */
export function initializeLogger(config?: LoggerConfig): AdvancedLogger {
  globalLogger = new AdvancedLogger(config);
  return globalLogger;
}

/**
 * Get global logger instance
 */
export function getLogger(): AdvancedLogger {
  if (!globalLogger) {
    globalLogger = new AdvancedLogger();
  }
  return globalLogger;
}

/**
 * Express/Koa middleware for request logging
 */
export function requestLoggingMiddleware(options?: {
  level?: string;
  includeBody?: boolean;
  includeQuery?: boolean;
  excludePaths?: string[];
}) {
  const logger = getLogger();
  const config = {
    level: "http",
    includeBody: false,
    includeQuery: true,
    excludePaths: [],
    ...options,
  };

  return (req: any, res: any, next: any) => {
    // Skip excluded paths
    if (
      req.path &&
      config.excludePaths.some((path) => req.path.startsWith(path))
    ) {
      return next();
    }

    const startTime = Date.now();
    const requestId =
      req.id ||
      (req.headers && req.headers["x-request-id"]) ||
      generateRequestId();

    // Create child logger with request context
    const childLogger = logger.child({ requestId });
    req.logger = childLogger;

    // Log request
    const requestMeta: LogMetadata = {
      method: req.method,
      url: req.url,
      ip: req.ip || (req.connection && req.connection.remoteAddress),
      userAgent: req.headers && req.headers["user-agent"],
      requestId,
    };

    if (config.includeQuery && req.query) {
      requestMeta.query = req.query;
    }

    if (config.includeBody && req.body) {
      requestMeta.body = sanitizeBody(req.body);
    }

    childLogger.http("Incoming request", requestMeta);

    // Log response
    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - startTime;

      childLogger.http("Request completed", {
        statusCode: res.statusCode,
        duration,
        requestId,
      });

      originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize request body for logging
 */
function sanitizeBody(body: any): any {
  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "apiKey",
    "authorization",
  ];
  const sanitized = { ...body };

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  });

  return sanitized;
}

/**
 * Setup global error handlers with logging
 */
export function setupGlobalErrorLogging(): void {
  const logger = getLogger();

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    logger.critical("Uncaught Exception", {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    });

    // Give time for logs to be written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.critical("Unhandled Promise Rejection", {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });
  });

  // Handle warnings
  process.on("warning", (warning: Error) => {
    logger.warn("Process Warning", {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });

  // Handle SIGTERM
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    process.exit(0);
  });

  // Handle SIGINT
  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down gracefully");
    process.exit(0);
  });
}

/**
 * Create a simple logger interface for backward compatibility
 */
export function createSimpleLogger(): {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
} {
  const logger = getLogger();

  return {
    debug: (message: string, ...args: any[]) => {
      logger.debug(message, { data: args });
    },
    info: (message: string, ...args: any[]) => {
      logger.info(message, { data: args });
    },
    warn: (message: string, ...args: any[]) => {
      logger.warn(message, { data: args });
    },
    error: (message: string, ...args: any[]) => {
      logger.error(message, { data: args });
    },
  };
}
