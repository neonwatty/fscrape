/**
 * Database Error Handling Utilities
 * Provides comprehensive error handling for SQL.js database operations
 */

import { Database } from 'sql.js';

// Error Types
export enum DatabaseErrorType {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  LOADING_ERROR = 'LOADING_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  CORRUPTION_ERROR = 'CORRUPTION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Error Severity Levels
export enum ErrorSeverity {
  LOW = 'LOW', // Minor issue, can continue
  MEDIUM = 'MEDIUM', // Some functionality affected
  HIGH = 'HIGH', // Major functionality affected
  CRITICAL = 'CRITICAL', // System unusable
}

// Custom Database Error Class
export class DatabaseError extends Error {
  public readonly type: DatabaseErrorType;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails?: string;

  constructor(
    type: DatabaseErrorType,
    message: string,
    options?: {
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      originalError?: Error;
      recoverable?: boolean;
      retryable?: boolean;
      userMessage?: string;
      technicalDetails?: string;
    }
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.type = type;
    this.severity = options?.severity || ErrorSeverity.MEDIUM;
    this.timestamp = new Date();
    this.context = options?.context;
    this.originalError = options?.originalError;
    this.recoverable = options?.recoverable ?? true;
    this.retryable = options?.retryable ?? false;
    this.userMessage = options?.userMessage || this.getDefaultUserMessage(type);
    this.technicalDetails = options?.technicalDetails;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }

  private getDefaultUserMessage(type: DatabaseErrorType): string {
    const messages: Record<DatabaseErrorType, string> = {
      [DatabaseErrorType.INITIALIZATION_ERROR]:
        'Failed to initialize the database. Please refresh the page and try again.',
      [DatabaseErrorType.CONNECTION_ERROR]:
        'Unable to connect to the database. Please check your connection and try again.',
      [DatabaseErrorType.LOADING_ERROR]:
        'Failed to load the database file. The file may be corrupted or incompatible.',
      [DatabaseErrorType.QUERY_ERROR]:
        'The database query failed. Please check your input and try again.',
      [DatabaseErrorType.TRANSACTION_ERROR]:
        'The database transaction failed. Your changes have been rolled back.',
      [DatabaseErrorType.MEMORY_ERROR]:
        'The operation requires more memory than available. Try closing other applications.',
      [DatabaseErrorType.CORRUPTION_ERROR]:
        'The database appears to be corrupted. Please restore from a backup.',
      [DatabaseErrorType.PERMISSION_ERROR]: 'You do not have permission to perform this operation.',
      [DatabaseErrorType.TIMEOUT_ERROR]:
        'The operation took too long to complete. Please try again.',
      [DatabaseErrorType.UNKNOWN_ERROR]:
        'An unexpected error occurred. Please try again or contact support.',
    };
    return messages[type];
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      recoverable: this.recoverable,
      retryable: this.retryable,
      stack: this.stack,
      technicalDetails: this.technicalDetails,
    };
  }
}

// Error Detection Utilities
export function classifyError(error: Error): DatabaseErrorType {
  const message = error.message.toLowerCase();
  const _name = error.name.toLowerCase();

  // Check for specific error patterns
  if (message.includes('wasm') || message.includes('webassembly')) {
    return DatabaseErrorType.INITIALIZATION_ERROR;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return DatabaseErrorType.CONNECTION_ERROR;
  }
  if (message.includes('load') || message.includes('import') || message.includes('file')) {
    return DatabaseErrorType.LOADING_ERROR;
  }
  if (message.includes('syntax') || message.includes('query') || message.includes('sql')) {
    return DatabaseErrorType.QUERY_ERROR;
  }
  if (
    message.includes('transaction') ||
    message.includes('rollback') ||
    message.includes('commit')
  ) {
    return DatabaseErrorType.TRANSACTION_ERROR;
  }
  if (message.includes('memory') || message.includes('heap') || message.includes('stack')) {
    return DatabaseErrorType.MEMORY_ERROR;
  }
  if (message.includes('corrupt') || message.includes('invalid') || message.includes('malformed')) {
    return DatabaseErrorType.CORRUPTION_ERROR;
  }
  if (
    message.includes('permission') ||
    message.includes('denied') ||
    message.includes('unauthorized')
  ) {
    return DatabaseErrorType.PERMISSION_ERROR;
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return DatabaseErrorType.TIMEOUT_ERROR;
  }

  return DatabaseErrorType.UNKNOWN_ERROR;
}

// Error Recovery Strategies
export interface RecoveryStrategy {
  type: DatabaseErrorType;
  actions: RecoveryAction[];
  maxRetries: number;
  retryDelay: number;
}

export interface RecoveryAction {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
}

export class ErrorRecovery {
  private strategies: Map<DatabaseErrorType, RecoveryStrategy> = new Map();

  constructor() {
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies() {
    // Initialization Error Recovery
    this.strategies.set(DatabaseErrorType.INITIALIZATION_ERROR, {
      type: DatabaseErrorType.INITIALIZATION_ERROR,
      actions: [
        {
          name: 'Clear Cache',
          description: 'Clear cached database resources',
          execute: async () => {
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.clear();
                localStorage.removeItem('db_cache');
              }
              return true;
            } catch {
              return false;
            }
          },
        },
        {
          name: 'Reload Page',
          description: 'Reload the application',
          execute: async () => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
            return true;
          },
        },
      ],
      maxRetries: 3,
      retryDelay: 1000,
    });

    // Loading Error Recovery
    this.strategies.set(DatabaseErrorType.LOADING_ERROR, {
      type: DatabaseErrorType.LOADING_ERROR,
      actions: [
        {
          name: 'Use Fallback Database',
          description: 'Load a default sample database',
          execute: async () => {
            // Implementation would load a fallback database
            return true;
          },
        },
        {
          name: 'Download Fresh Copy',
          description: 'Download a fresh copy of the database',
          execute: async () => {
            // Implementation would download a new database file
            return true;
          },
        },
      ],
      maxRetries: 2,
      retryDelay: 2000,
    });

    // Query Error Recovery
    this.strategies.set(DatabaseErrorType.QUERY_ERROR, {
      type: DatabaseErrorType.QUERY_ERROR,
      actions: [
        {
          name: 'Validate Query',
          description: 'Check query syntax and parameters',
          execute: async () => {
            // Implementation would validate SQL syntax
            return true;
          },
        },
      ],
      maxRetries: 1,
      retryDelay: 0,
    });

    // Memory Error Recovery
    this.strategies.set(DatabaseErrorType.MEMORY_ERROR, {
      type: DatabaseErrorType.MEMORY_ERROR,
      actions: [
        {
          name: 'Clear Memory',
          description: 'Free up memory by closing unused resources',
          execute: async () => {
            if (typeof window !== 'undefined' && 'gc' in window) {
              (window as any).gc();
            }
            return true;
          },
        },
        {
          name: 'Reduce Query Size',
          description: 'Limit query results to reduce memory usage',
          execute: async () => {
            // Implementation would add LIMIT clauses
            return true;
          },
        },
      ],
      maxRetries: 2,
      retryDelay: 3000,
    });
  }

  getStrategy(errorType: DatabaseErrorType): RecoveryStrategy | undefined {
    return this.strategies.get(errorType);
  }

  async attemptRecovery(error: DatabaseError): Promise<boolean> {
    const strategy = this.getStrategy(error.type);
    if (!strategy) return false;

    for (const action of strategy.actions) {
      try {
        console.log(`Attempting recovery: ${action.name}`);
        const success = await action.execute();
        if (success) {
          console.log(`Recovery successful: ${action.name}`);
          return true;
        }
      } catch (err) {
        console.error(`Recovery action failed: ${action.name}`, err);
      }
    }

    return false;
  }
}

// Error Logging and Monitoring
export class ErrorLogger {
  private errorHistory: DatabaseError[] = [];
  private maxHistorySize = 100;

  log(error: DatabaseError): void {
    this.errorHistory.unshift(error);

    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔴 Database Error: ${error.type}`);
      console.error('Message:', error.message);
      console.error('Severity:', error.severity);
      console.error('Context:', error.context);
      console.error('Stack:', error.stack);
      console.groupEnd();
    }

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(error);
    }
  }

  private sendToMonitoring(_error: DatabaseError): void {
    // Implementation would send to service like Sentry
    // Example:
    // Sentry.captureException(error, {
    //   tags: {
    //     type: error.type,
    //     severity: error.severity,
    //   },
    //   extra: error.context,
    // })
  }

  getErrorHistory(): DatabaseError[] {
    return [...this.errorHistory];
  }

  getErrorStats(): {
    total: number;
    byType: Record<DatabaseErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentErrors: DatabaseError[];
  } {
    const stats = {
      total: this.errorHistory.length,
      byType: {} as Record<DatabaseErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recentErrors: this.errorHistory.slice(0, 10),
    };

    for (const error of this.errorHistory) {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    }

    return stats;
  }

  clearHistory(): void {
    this.errorHistory = [];
  }
}

// Query Validation
export function validateQuery(query: string): { valid: boolean; error?: string } {
  // Basic SQL injection prevention
  const dangerousPatterns = [
    /;\s*DROP\s+/i,
    /;\s*DELETE\s+FROM\s+/i,
    /;\s*TRUNCATE\s+/i,
    /;\s*ALTER\s+/i,
    /;\s*CREATE\s+/i,
    /--/,
    /\/\*/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      return {
        valid: false,
        error: 'Query contains potentially dangerous SQL patterns',
      };
    }
  }

  // Check for basic syntax
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      valid: false,
      error: 'Query is empty',
    };
  }

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of trimmedQuery) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      return {
        valid: false,
        error: 'Unbalanced parentheses in query',
      };
    }
  }
  if (parenCount !== 0) {
    return {
      valid: false,
      error: 'Unbalanced parentheses in query',
    };
  }

  return { valid: true };
}

// Safe Query Execution
export async function safeExecuteQuery(
  db: Database,
  query: string,
  params?: any[]
): Promise<{ success: boolean; data?: any; error?: DatabaseError }> {
  // Validate query first
  const validation = validateQuery(query);
  if (!validation.valid) {
    return {
      success: false,
      error: new DatabaseError(DatabaseErrorType.QUERY_ERROR, validation.error!, {
        severity: ErrorSeverity.LOW,
        retryable: false,
        context: { query, params },
      }),
    };
  }

  try {
    const stmt = db.prepare(query);
    if (params) {
      stmt.bind(params);
    }

    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    const dbError = new DatabaseError(
      DatabaseErrorType.QUERY_ERROR,
      error instanceof Error ? error.message : 'Query execution failed',
      {
        severity: ErrorSeverity.MEDIUM,
        originalError: error instanceof Error ? error : undefined,
        retryable: true,
        context: { query, params },
        technicalDetails: error instanceof Error ? error.stack : undefined,
      }
    );

    return {
      success: false,
      error: dbError,
    };
  }
}

// Transaction Manager
export class TransactionManager {
  private db: Database;
  private inTransaction: boolean = false;
  private savepoints: string[] = [];

  constructor(database: Database) {
    this.db = database;
  }

  async begin(): Promise<void> {
    if (this.inTransaction) {
      throw new DatabaseError(
        DatabaseErrorType.TRANSACTION_ERROR,
        'Transaction already in progress',
        { severity: ErrorSeverity.LOW }
      );
    }

    try {
      this.db.run('BEGIN TRANSACTION');
      this.inTransaction = true;
    } catch (error) {
      throw new DatabaseError(DatabaseErrorType.TRANSACTION_ERROR, 'Failed to begin transaction', {
        originalError: error instanceof Error ? error : undefined,
        severity: ErrorSeverity.HIGH,
      });
    }
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new DatabaseError(DatabaseErrorType.TRANSACTION_ERROR, 'No transaction in progress', {
        severity: ErrorSeverity.LOW,
      });
    }

    try {
      this.db.run('COMMIT');
      this.inTransaction = false;
      this.savepoints = [];
    } catch (error) {
      await this.rollback();
      throw new DatabaseError(DatabaseErrorType.TRANSACTION_ERROR, 'Failed to commit transaction', {
        originalError: error instanceof Error ? error : undefined,
        severity: ErrorSeverity.HIGH,
        recoverable: true,
      });
    }
  }

  async rollback(toSavepoint?: string): Promise<void> {
    if (!this.inTransaction) {
      return;
    }

    try {
      if (toSavepoint && this.savepoints.includes(toSavepoint)) {
        this.db.run(`ROLLBACK TO SAVEPOINT ${toSavepoint}`);
        // Remove savepoints after the rollback point
        const index = this.savepoints.indexOf(toSavepoint);
        this.savepoints = this.savepoints.slice(0, index);
      } else {
        this.db.run('ROLLBACK');
        this.inTransaction = false;
        this.savepoints = [];
      }
    } catch (error) {
      throw new DatabaseError(
        DatabaseErrorType.TRANSACTION_ERROR,
        'Failed to rollback transaction',
        {
          originalError: error instanceof Error ? error : undefined,
          severity: ErrorSeverity.CRITICAL,
        }
      );
    }
  }

  async savepoint(name: string): Promise<void> {
    if (!this.inTransaction) {
      throw new DatabaseError(DatabaseErrorType.TRANSACTION_ERROR, 'No transaction in progress', {
        severity: ErrorSeverity.LOW,
      });
    }

    try {
      this.db.run(`SAVEPOINT ${name}`);
      this.savepoints.push(name);
    } catch (error) {
      throw new DatabaseError(DatabaseErrorType.TRANSACTION_ERROR, 'Failed to create savepoint', {
        originalError: error instanceof Error ? error : undefined,
        severity: ErrorSeverity.MEDIUM,
      });
    }
  }

  isInTransaction(): boolean {
    return this.inTransaction;
  }
}

// Export singleton instances
export const errorLogger = new ErrorLogger();
export const errorRecovery = new ErrorRecovery();
