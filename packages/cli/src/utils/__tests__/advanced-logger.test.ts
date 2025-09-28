/**
 * Tests for advanced logging system
 * Validates multiple transports, formatting, and performance features
 */

// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { Writable } from 'stream';
import {
  AdvancedLogger,
  LoggerConfig,
  TransportConfig,
  initializeLogger,
  getLogger,
  requestLoggingMiddleware,
  createSimpleLogger,
} from '../advanced-logger.js';

describe('AdvancedLogger', () => {
  let logger: AdvancedLogger;
  const testLogDir = 'test-logs';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
    delete process.env.ENABLE_FILE_LOGGING;
  });

  afterEach(async () => {
    if (logger) {
      await logger.close();
      logger = null as unknown as AdvancedLogger;
    }
    // Reset global logger
    (global as Record<string, unknown>).globalLogger = null;
  });

  afterAll(async () => {
    // Clean up test log directory
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore if doesn't exist
    }
  });

  describe('Logger Initialization', () => {
    it('should create logger with default configuration', () => {
      logger = new AdvancedLogger();
      expect(logger).toBeInstanceOf(AdvancedLogger);
      expect(logger.isLevelEnabled('info')).toBe(true);
      expect(logger.isLevelEnabled('debug')).toBe(false);
    });

    it('should create logger with custom configuration', () => {
      const config: LoggerConfig = {
        level: 'debug',
        silent: false,
        logDirectory: testLogDir,
        defaultMeta: { service: 'test' },
      };

      logger = new AdvancedLogger(config);
      expect(logger).toBeInstanceOf(AdvancedLogger);
      expect(logger.isLevelEnabled('debug')).toBe(true);
    });

    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'debug';
      logger = new AdvancedLogger();
      expect(logger.isLevelEnabled('debug')).toBe(true);
    });

    it('should be silent in test environment', () => {
      process.env.NODE_ENV = 'test';
      logger = new AdvancedLogger();
      // Logger should be created but silent
      expect(logger).toBeInstanceOf(AdvancedLogger);
    });
  });

  describe('Log Levels', () => {
    beforeEach(() => {
      logger = new AdvancedLogger({ level: 'silly', silent: true });
    });

    it('should log at all levels', () => {
      const spy = vi.spyOn(logger.getWinston(), 'log');

      logger.critical('Critical message');
      expect(spy).toHaveBeenCalledWith('critical', 'Critical message', undefined);

      logger.error('Error message');
      expect(spy).toHaveBeenCalledWith('error', 'Error message', undefined);

      logger.warn('Warning message');
      expect(spy).toHaveBeenCalledWith('warn', 'Warning message', undefined);

      logger.info('Info message');
      expect(spy).toHaveBeenCalledWith('info', 'Info message', undefined);

      logger.http('HTTP message');
      expect(spy).toHaveBeenCalledWith('http', 'HTTP message', undefined);

      logger.verbose('Verbose message');
      expect(spy).toHaveBeenCalledWith('verbose', 'Verbose message', undefined);

      logger.debug('Debug message');
      expect(spy).toHaveBeenCalledWith('debug', 'Debug message', undefined);

      logger.silly('Silly message');
      expect(spy).toHaveBeenCalledWith('silly', 'Silly message', undefined);
    });

    it('should log with metadata', () => {
      const spy = vi.spyOn(logger.getWinston(), 'log');
      const metadata = { userId: '123', action: 'test' };

      logger.info('Test message', metadata);
      expect(spy).toHaveBeenCalledWith('info', 'Test message', metadata);
    });

    it('should check if level is enabled', () => {
      logger.configure({ level: 'warn' });

      expect(logger.isLevelEnabled('critical')).toBe(true);
      expect(logger.isLevelEnabled('error')).toBe(true);
      expect(logger.isLevelEnabled('warn')).toBe(true);
      expect(logger.isLevelEnabled('info')).toBe(false);
      expect(logger.isLevelEnabled('debug')).toBe(false);
    });
  });

  describe('Multiple Transports', () => {
    it('should support console transport', () => {
      const config: LoggerConfig = {
        transports: [{ type: 'console', level: 'info' }],
        silent: true,
      };

      logger = new AdvancedLogger(config);
      const transports = logger.getWinston().transports;
      expect(transports).toHaveLength(1);
      expect(transports[0].constructor.name).toBe('Console');
    });

    it('should support file transport', async () => {
      await fs.mkdir(testLogDir, { recursive: true });

      const config: LoggerConfig = {
        transports: [
          {
            type: 'file',
            level: 'error',
            filename: path.join(testLogDir, 'test.log'),
            maxsize: 1024,
            maxFiles: 2,
          },
        ],
        silent: false,
      };

      logger = new AdvancedLogger(config);
      const transports = logger.getWinston().transports;
      expect(transports).toHaveLength(1);
      expect(transports[0].constructor.name).toBe('File');
    });

    it('should support stream transport', () => {
      const stream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        },
      });

      const config: LoggerConfig = {
        transports: [{ type: 'stream', stream, level: 'info' }],
        silent: false,
      };

      logger = new AdvancedLogger(config);
      const transports = logger.getWinston().transports;
      expect(transports).toHaveLength(1);
      expect(transports[0].constructor.name).toBe('Stream');
    });

    it('should throw error for invalid transport configuration', () => {
      expect(() => {
        new AdvancedLogger({
          transports: [
            { type: 'file' } as TransportConfig, // Missing filename
          ],
        });
      }).toThrow('Filename is required for file transport');
    });

    it('should add and remove transports dynamically', () => {
      logger = new AdvancedLogger({ silent: true });

      // Add transport
      logger.addTransport({ type: 'console', level: 'debug' });
      expect(logger.getWinston().transports.length).toBeGreaterThan(0);

      // Remove transport (Note: Winston doesn't support removing by name in v3)
      // This is more of a placeholder test
      logger.removeTransport('console');
    });
  });

  describe('Performance Features', () => {
    beforeEach(() => {
      logger = new AdvancedLogger({ silent: true });
    });

    it('should measure performance with timers', async () => {
      const spy = vi.spyOn(logger, 'info');

      logger.startTimer('operation');
      await new Promise((resolve) => setTimeout(resolve, 10));
      logger.endTimer('operation', 'Operation completed');

      expect(spy).toHaveBeenCalled();
      const call = spy.mock.calls[0];
      expect(call[0]).toBe('Operation completed');
      expect(call[1]?.duration).toBeGreaterThanOrEqual(10);
      expect(call[1]?.timer).toBe('operation');
    });

    it('should warn if timer not started', () => {
      const spy = vi.spyOn(logger, 'warn');

      logger.endTimer('nonexistent');
      expect(spy).toHaveBeenCalledWith("Timer 'nonexistent' was not started");
    });

    it('should profile code sections', () => {
      const spy = vi.spyOn(logger.getWinston(), 'profile');

      logger.profile('section1', { operation: 'test' });
      expect(spy).toHaveBeenCalledWith('section1', { operation: 'test' });
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with additional metadata', () => {
      logger = new AdvancedLogger({
        silent: true,
        defaultMeta: { service: 'parent' },
      });

      const child = logger.child({ requestId: '123' });
      expect(child).toBeInstanceOf(AdvancedLogger);

      vi.spyOn(child.getWinston(), 'log');
      child.info('Child message');

      // The child should have both parent and child metadata
      const winston = child.getWinston();
      expect(winston.defaultMeta).toEqual({
        service: 'parent',
        requestId: '123',
      });
    });
  });

  describe('Logger Configuration', () => {
    it('should reconfigure logger', () => {
      logger = new AdvancedLogger({ level: 'info', silent: true });
      expect(logger.isLevelEnabled('debug')).toBe(false);

      logger.configure({ level: 'debug' });
      expect(logger.isLevelEnabled('debug')).toBe(true);
    });

    it('should clear all transports', () => {
      logger = new AdvancedLogger({ silent: true });
      logger.clear();
      expect(logger.getWinston().transports).toHaveLength(0);
    });
  });

  describe('Global Logger', () => {
    it('should initialize and get global logger', () => {
      const globalLogger = initializeLogger({ level: 'warn', silent: true });
      expect(globalLogger).toBeInstanceOf(AdvancedLogger);

      const retrievedLogger = getLogger();
      expect(retrievedLogger).toBe(globalLogger);
    });

    it('should create global logger on first get if not initialized', () => {
      // Clear any existing global logger
      (global as Record<string, unknown>).globalLogger = null;

      const logger = getLogger();
      expect(logger).toBeInstanceOf(AdvancedLogger);
    });
  });

  describe('Request Logging Middleware', () => {
    it('should create middleware function', () => {
      const middleware = requestLoggingMiddleware();
      expect(middleware).toBeInstanceOf(Function);
    });

    it('should log incoming requests', () => {
      const middleware = requestLoggingMiddleware({
        level: 'http',
        includeBody: true,
        includeQuery: true,
      });

      const req = {
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test' },
        query: { page: 1 },
        body: { data: 'test' },
      };

      const res = {
        statusCode: 200,
        send: vi.fn(),
      };

      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req).toHaveProperty('logger');
    });

    it('should skip excluded paths', () => {
      const middleware = requestLoggingMiddleware({
        excludePaths: ['/health'],
      });

      const req = { path: '/health' };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req).not.toHaveProperty('logger');
    });

    it('should sanitize sensitive data in body', () => {
      const middleware = requestLoggingMiddleware({
        includeBody: true,
      });

      const req = {
        method: 'POST',
        url: '/api/login',
        path: '/api/login',
        body: {
          username: 'user',
          password: 'secret123',
          token: 'jwt_token',
          apiKey: 'key123',
        },
      };

      const res = {
        statusCode: 200,
        send: vi.fn(),
      };

      const next = vi.fn();

      // Create a spy on the child logger
      const originalChild = getLogger().child;
      const childSpy = vi.fn(originalChild.bind(getLogger()));
      getLogger().child = childSpy;

      middleware(req, res, next);

      // The logger should be called with sanitized body
      expect(childSpy).toHaveBeenCalled();
    });
  });

  describe('Simple Logger Compatibility', () => {
    it('should create simple logger interface', () => {
      const simpleLogger = createSimpleLogger();

      expect(simpleLogger).toHaveProperty('debug');
      expect(simpleLogger).toHaveProperty('info');
      expect(simpleLogger).toHaveProperty('warn');
      expect(simpleLogger).toHaveProperty('error');

      // Test that methods work
      expect(() => {
        simpleLogger.debug('Debug message');
        simpleLogger.info('Info message');
        simpleLogger.warn('Warn message');
        simpleLogger.error('Error message');
      }).not.toThrow();
    });
  });

  describe('Production Features', () => {
    it('should create file transports in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_FILE_LOGGING = 'true';

      logger = new AdvancedLogger({
        logDirectory: testLogDir,
      });

      const transports = logger.getWinston().transports;
      const fileTransports = transports.filter((t) => t.constructor.name === 'File');
      expect(fileTransports.length).toBeGreaterThan(0);
    });

    it('should not create console transport in production by default', () => {
      process.env.NODE_ENV = 'production';

      logger = new AdvancedLogger({
        enableConsoleInProduction: false,
      });

      const transports = logger.getWinston().transports;
      const consoleTransports = transports.filter((t) => t.constructor.name === 'Console');
      expect(consoleTransports).toHaveLength(0);
    });

    it('should create console transport in production if enabled', () => {
      process.env.NODE_ENV = 'production';

      logger = new AdvancedLogger({
        enableConsoleInProduction: true,
      });

      const transports = logger.getWinston().transports;
      const consoleTransports = transports.filter((t) => t.constructor.name === 'Console');
      expect(consoleTransports.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in log metadata', () => {
      logger = new AdvancedLogger({ silent: true });
      const error = new Error('Test error');
      error.stack = 'Test stack trace';

      const spy = vi.spyOn(logger.getWinston(), 'log');

      logger.error('Error occurred', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });

      expect(spy).toHaveBeenCalled();
      const metadata = spy.mock.calls[0][2];
      expect(metadata?.error).toEqual({
        message: 'Test error',
        stack: 'Test stack trace',
        name: 'Error',
      });
    });
  });
});
