/**
 * Custom error types for the fscrape application
 * Provides comprehensive error handling with error codes, metadata, and recovery strategies
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  DATABASE = 'database',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  PARSING = 'parsing',
  FILE_SYSTEM = 'file_system',
  CONFIGURATION = 'configuration',
  PLATFORM = 'platform',
  UNKNOWN = 'unknown'
}

/**
 * Recovery strategy types
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  CIRCUIT_BREAKER = 'circuit_breaker',
  FALLBACK = 'fallback',
  IGNORE = 'ignore',
  TERMINATE = 'terminate'
}

/**
 * Error metadata interface
 */
export interface ErrorMetadata {
  timestamp: Date;
  correlationId?: string;
  userId?: string;
  platform?: string;
  operation?: string;
  context?: Record<string, any>;
  stackTrace?: string;
}

/**
 * Base error class with enhanced functionality
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly metadata: ErrorMetadata;
  public readonly isRetryable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    recoveryStrategy: RecoveryStrategy = RecoveryStrategy.TERMINATE,
    isRetryable: boolean = false,
    originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.category = category;
    this.recoveryStrategy = recoveryStrategy;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
    
    this.metadata = {
      timestamp: new Date(),
      stackTrace: this.stack || undefined
    };

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Add context to error metadata
   */
  public addContext(context: Record<string, any>): this {
    this.metadata.context = { ...this.metadata.context, ...context };
    return this;
  }

  /**
   * Set correlation ID for tracing
   */
  public setCorrelationId(correlationId: string): this {
    this.metadata.correlationId = correlationId;
    return this;
  }

  /**
   * Convert error to JSON representation
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      recoveryStrategy: this.recoveryStrategy,
      isRetryable: this.isRetryable,
      metadata: this.metadata,
      stack: this.stack
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends BaseError {
  constructor(
    message: string,
    code: string = 'NETWORK_ERROR',
    originalError?: Error
  ) {
    super(
      message,
      code,
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      RecoveryStrategy.EXPONENTIAL_BACKOFF,
      true,
      originalError
    );
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends BaseError {
  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    isRetryable: boolean = true,
    originalError?: Error
  ) {
    super(
      message,
      code,
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE,
      isRetryable ? RecoveryStrategy.RETRY : RecoveryStrategy.TERMINATE,
      isRetryable,
      originalError
    );
  }
}

/**
 * Database connection error
 */
export class DatabaseConnectionError extends DatabaseError {
  public readonly host: string | undefined;
  public readonly port: number | undefined;
  public readonly database: string | undefined;

  constructor(
    message: string,
    host?: string,
    port?: number,
    database?: string,
    originalError?: Error
  ) {
    super(
      message,
      'DB_CONNECTION_ERROR',
      true,
      originalError
    );
    this.host = host;
    this.port = port;
    this.database = database;
    (this as any).recoveryStrategy = RecoveryStrategy.EXPONENTIAL_BACKOFF;
  }
}

/**
 * Database query error
 */
export class DatabaseQueryError extends DatabaseError {
  public readonly query: string | undefined;
  public readonly params: any[] | undefined;
  public readonly sqlState: string | undefined;

  constructor(
    message: string,
    query?: string,
    params?: any[],
    sqlState?: string,
    originalError?: Error
  ) {
    // Determine if retryable based on SQL state
    // Only certain error classes are retryable (e.g., lock timeouts, connection issues)
    let isRetryable = false;
    if (sqlState) {
      // 40xxx = Transaction rollback
      // 08xxx = Connection exceptions
      // 57xxx = Operator intervention (like statement timeout)
      isRetryable = sqlState.startsWith('40') || 
                    sqlState.startsWith('08') || 
                    sqlState.startsWith('57');
    }
    
    super(
      message,
      'DB_QUERY_ERROR',
      isRetryable,
      originalError
    );
    this.query = query;
    this.params = params;
    this.sqlState = sqlState;
  }
}

/**
 * Database transaction error
 */
export class DatabaseTransactionError extends DatabaseError {
  public readonly transactionId: string | undefined;
  public readonly operation: string | undefined;

  constructor(
    message: string,
    transactionId?: string,
    operation?: string,
    originalError?: Error
  ) {
    super(
      message,
      'DB_TRANSACTION_ERROR',
      true,
      originalError
    );
    this.transactionId = transactionId;
    this.operation = operation;
  }
}

/**
 * Database constraint violation error
 */
export class DatabaseConstraintError extends DatabaseError {
  public readonly constraint: string | undefined;
  public readonly table: string | undefined;
  public readonly column: string | undefined;

  constructor(
    message: string,
    constraint?: string,
    table?: string,
    column?: string,
    originalError?: Error
  ) {
    super(
      message,
      'DB_CONSTRAINT_VIOLATION',
      false,
      originalError
    );
    this.constraint = constraint;
    this.table = table;
    this.column = column;
    (this as any).severity = ErrorSeverity.MEDIUM;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: Record<string, string[]> | undefined;

  constructor(
    message: string,
    validationErrors?: Record<string, string[]>,
    code: string = 'VALIDATION_ERROR'
  ) {
    super(
      message,
      code,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      RecoveryStrategy.IGNORE,
      false
    );
    this.validationErrors = validationErrors;
  }
}

/**
 * Field validation error
 */
export class FieldValidationError extends ValidationError {
  public readonly fieldName: string;
  public readonly fieldValue: any;
  public readonly rules: string[];

  constructor(
    message: string,
    fieldName: string,
    fieldValue: any,
    rules: string[]
  ) {
    const fieldErrors = { [fieldName]: rules };
    super(
      message,
      fieldErrors,
      'FIELD_VALIDATION_ERROR'
    );
    this.fieldName = fieldName;
    this.fieldValue = fieldValue;
    this.rules = rules;
  }
}

/**
 * Schema validation error
 */
export class SchemaValidationError extends ValidationError {
  public readonly schema: any;
  public readonly data: any;
  public readonly schemaPath: string | undefined;

  constructor(
    message: string,
    schema: any,
    data: any,
    validationErrors?: Record<string, string[]>,
    schemaPath?: string
  ) {
    super(
      message,
      validationErrors,
      'SCHEMA_VALIDATION_ERROR'
    );
    this.schema = schema;
    this.data = data;
    this.schemaPath = schemaPath;
  }
}

/**
 * Input sanitization error
 */
export class InputSanitizationError extends ValidationError {
  public readonly input: any;
  public readonly sanitizationType: string;
  public readonly detectedIssues: string[];

  constructor(
    message: string,
    input: any,
    sanitizationType: string,
    detectedIssues: string[]
  ) {
    super(
      message,
      { input: detectedIssues },
      'INPUT_SANITIZATION_ERROR'
    );
    this.input = input;
    this.sanitizationType = sanitizationType;
    this.detectedIssues = detectedIssues;
    (this as any).severity = ErrorSeverity.MEDIUM;
  }
}

/**
 * Business rule validation error
 */
export class BusinessRuleError extends ValidationError {
  public readonly ruleName: string;
  public readonly ruleDescription: string | undefined;
  public readonly context: Record<string, any> | undefined;

  constructor(
    message: string,
    ruleName: string,
    ruleDescription?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      undefined,
      'BUSINESS_RULE_ERROR'
    );
    this.ruleName = ruleName;
    this.ruleDescription = ruleDescription;
    this.context = context;
    (this as any).severity = ErrorSeverity.MEDIUM;
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends BaseError {
  constructor(
    message: string,
    code: string = 'AUTH_ERROR',
    originalError?: Error
  ) {
    super(
      message,
      code,
      ErrorSeverity.HIGH,
      ErrorCategory.AUTHENTICATION,
      RecoveryStrategy.TERMINATE,
      false,
      originalError
    );
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends BaseError {
  public readonly retryAfter: number | undefined;
  public readonly limit: number | undefined;
  public readonly remaining: number | undefined;
  public readonly reset: Date | undefined;

  constructor(
    message: string,
    retryAfter?: number,
    limit?: number,
    remaining?: number,
    reset?: Date
  ) {
    super(
      message,
      'RATE_LIMIT_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.RATE_LIMIT,
      RecoveryStrategy.EXPONENTIAL_BACKOFF,
      true
    );
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
    this.reset = reset;
  }
}

/**
 * Parsing errors
 */
export class ParsingError extends BaseError {
  public readonly content: string | undefined;
  public readonly position: number | undefined;

  constructor(
    message: string,
    content?: string,
    position?: number,
    originalError?: Error
  ) {
    super(
      message,
      'PARSING_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.PARSING,
      RecoveryStrategy.FALLBACK,
      false,
      originalError
    );
    this.content = content;
    this.position = position;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends BaseError {
  public readonly path: string | undefined;
  public readonly operation: string | undefined;

  constructor(
    message: string,
    path?: string,
    operation?: string,
    originalError?: Error
  ) {
    super(
      message,
      'FILE_SYSTEM_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.FILE_SYSTEM,
      RecoveryStrategy.RETRY,
      true,
      originalError
    );
    this.path = path;
    this.operation = operation;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends BaseError {
  public readonly configKey: string | undefined;
  public readonly configValue: any;

  constructor(
    message: string,
    configKey?: string,
    configValue?: any
  ) {
    super(
      message,
      'CONFIG_ERROR',
      ErrorSeverity.CRITICAL,
      ErrorCategory.CONFIGURATION,
      RecoveryStrategy.TERMINATE,
      false
    );
    this.configKey = configKey;
    this.configValue = configValue;
  }
}

/**
 * Missing configuration error
 */
export class MissingConfigError extends ConfigurationError {
  public readonly requiredKeys: string[];

  constructor(
    message: string,
    requiredKeys: string[],
    configKey?: string
  ) {
    super(
      message,
      configKey,
      undefined
    );
    this.requiredKeys = requiredKeys;
    (this as any).code = 'CONFIG_MISSING';
  }
}

/**
 * Invalid configuration error
 */
export class InvalidConfigError extends ConfigurationError {
  public readonly expectedType: string | undefined;
  public readonly actualType: string | undefined;
  public readonly validationRule: string | undefined;

  constructor(
    message: string,
    configKey: string,
    configValue: any,
    expectedType?: string,
    validationRule?: string
  ) {
    super(
      message,
      configKey,
      configValue
    );
    this.expectedType = expectedType;
    this.actualType = typeof configValue;
    this.validationRule = validationRule;
    (this as any).code = 'CONFIG_INVALID';
  }
}

/**
 * Environment configuration error
 */
export class EnvironmentConfigError extends ConfigurationError {
  public readonly environment: string | undefined;
  public readonly missingEnvVars: string[] | undefined;

  constructor(
    message: string,
    environment?: string,
    missingEnvVars?: string[]
  ) {
    super(
      message,
      undefined,
      undefined
    );
    this.environment = environment || process.env.NODE_ENV;
    this.missingEnvVars = missingEnvVars;
    (this as any).code = 'ENV_CONFIG_ERROR';
  }
}

/**
 * Platform-specific errors
 */
export class PlatformError extends BaseError {
  public readonly platform: string;
  public readonly platformCode: string | undefined;

  constructor(
    message: string,
    platform: string,
    platformCode?: string,
    originalError?: Error
  ) {
    super(
      message,
      `PLATFORM_ERROR_${platform.toUpperCase()}`,
      ErrorSeverity.MEDIUM,
      ErrorCategory.PLATFORM,
      RecoveryStrategy.RETRY,
      true,
      originalError
    );
    this.platform = platform;
    this.platformCode = platformCode;
  }
}

/**
 * API-specific errors
 */
export class APIError extends NetworkError {
  public readonly statusCode: number | undefined;
  public readonly endpoint: string | undefined;
  public readonly method: string | undefined;
  public readonly responseBody: any;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    method?: string,
    responseBody?: any,
    originalError?: Error
  ) {
    // Determine recovery strategy based on status code before calling super
    let code = `API_ERROR_${statusCode || 'UNKNOWN'}`;
    let recoveryStrategy = RecoveryStrategy.EXPONENTIAL_BACKOFF;
    let isRetryable = true;
    
    if (statusCode) {
      if (statusCode >= 500 || statusCode === 429) {
        recoveryStrategy = RecoveryStrategy.EXPONENTIAL_BACKOFF;
        isRetryable = true;
      } else if (statusCode >= 400 && statusCode < 500) {
        recoveryStrategy = RecoveryStrategy.TERMINATE;
        isRetryable = false;
      }
    }
    
    // Call parent constructor through NetworkError which sets the right properties
    super(message, code, originalError);
    
    // Override properties set by NetworkError if needed
    (this as any).recoveryStrategy = recoveryStrategy;
    (this as any).isRetryable = isRetryable;
    
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.method = method;
    this.responseBody = responseBody;
  }
}

/**
 * API timeout error
 */
export class APITimeoutError extends APIError {
  public readonly timeoutMs: number;

  constructor(
    message: string,
    endpoint: string,
    timeoutMs: number,
    originalError?: Error
  ) {
    super(
      message,
      408,
      endpoint,
      undefined,
      undefined,
      originalError
    );
    this.timeoutMs = timeoutMs;
    (this as any).code = 'API_TIMEOUT';
    (this as any).isRetryable = true;
    (this as any).recoveryStrategy = RecoveryStrategy.RETRY;
  }
}

/**
 * API response parsing error
 */
export class APIResponseError extends APIError {
  public readonly rawResponse: string | undefined;

  constructor(
    message: string,
    endpoint: string,
    rawResponse?: string,
    originalError?: Error
  ) {
    super(
      message,
      undefined,
      endpoint,
      undefined,
      undefined,
      originalError
    );
    this.rawResponse = rawResponse;
    (this as any).code = 'API_RESPONSE_PARSE_ERROR';
    (this as any).category = ErrorCategory.PARSING;
  }
}

/**
 * Aggregate error for multiple errors
 */
export class AggregateError extends BaseError {
  public readonly errors: Error[];

  constructor(errors: Error[], message?: string) {
    const errorMessage = message || `Multiple errors occurred: ${errors.length} errors`;
    super(
      errorMessage,
      'AGGREGATE_ERROR',
      ErrorSeverity.HIGH,
      ErrorCategory.UNKNOWN,
      RecoveryStrategy.TERMINATE,
      false
    );
    this.errors = errors;
  }

  /**
   * Get all error messages
   */
  public getAllMessages(): string[] {
    return this.errors.map(e => e.message);
  }

  /**
   * Check if any error is retryable
   */
  public hasRetryableError(): boolean {
    return this.errors.some(e => 
      e instanceof BaseError && e.isRetryable
    );
  }
}

/**
 * Error factory for creating standardized errors
 */
export class ErrorFactory {
  /**
   * Create error from unknown type
   */
  static fromUnknown(error: unknown, defaultMessage: string = 'An unknown error occurred'): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    if (error instanceof Error) {
      return new BaseError(
        error.message || defaultMessage,
        'UNKNOWN_ERROR',
        ErrorSeverity.MEDIUM,
        ErrorCategory.UNKNOWN,
        RecoveryStrategy.TERMINATE,
        false,
        error
      );
    }

    if (typeof error === 'string') {
      return new BaseError(
        error,
        'STRING_ERROR',
        ErrorSeverity.MEDIUM,
        ErrorCategory.UNKNOWN,
        RecoveryStrategy.TERMINATE,
        false
      );
    }

    return new BaseError(
      defaultMessage,
      'UNKNOWN_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.UNKNOWN,
      RecoveryStrategy.TERMINATE,
      false
    );
  }

  /**
   * Create network error with context
   */
  static networkError(
    message: string,
    url?: string,
    method?: string,
    statusCode?: number
  ): NetworkError {
    const error = new NetworkError(message);
    if (url || method || statusCode) {
      error.addContext({ url, method, statusCode });
    }
    return error;
  }

  /**
   * Create database error with context
   */
  static databaseError(
    message: string,
    operation?: string,
    table?: string,
    query?: string
  ): DatabaseError {
    const error = new DatabaseError(message);
    if (operation || table || query) {
      error.addContext({ operation, table, query });
    }
    return error;
  }
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return error instanceof BaseError && error.isRetryable;
}

/**
 * Type guard to check if error is critical
 */
export function isCriticalError(error: unknown): boolean {
  return error instanceof BaseError && error.severity === ErrorSeverity.CRITICAL;
}

/**
 * Extract error message from unknown type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}