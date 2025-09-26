/**
 * Tests for custom error types
 * Validates error type hierarchy, inheritance, and specific properties
 */

import { describe, it, expect } from 'vitest';
import {
  BaseError,
  NetworkError,
  DatabaseError,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTransactionError,
  DatabaseConstraintError,
  ValidationError,
  FieldValidationError,
  SchemaValidationError,
  InputSanitizationError,
  BusinessRuleError,
  ConfigurationError,
  MissingConfigError,
  InvalidConfigError,
  EnvironmentConfigError,
  APIError,
  APITimeoutError,
  APIResponseError,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
} from '../errors.js';

describe('Custom Error Types', () => {
  describe('API Error Types', () => {
    describe('APIError', () => {
      it('should create API error with status code', () => {
        const error = new APIError('API request failed', 500, '/api/users', 'GET', {
          error: 'Internal Server Error',
        });

        expect(error).toBeInstanceOf(NetworkError);
        expect(error.statusCode).toBe(500);
        expect(error.endpoint).toBe('/api/users');
        expect(error.method).toBe('GET');
        expect(error.responseBody).toEqual({ error: 'Internal Server Error' });
        expect(error.code).toBe('API_ERROR_500');
      });

      it('should set recovery strategy based on status code', () => {
        const error500 = new APIError('Server error', 500);
        expect(error500.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
        expect(error500.isRetryable).toBe(true);

        const error429 = new APIError('Rate limited', 429);
        expect(error429.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
        expect(error429.isRetryable).toBe(true);

        const error400 = new APIError('Bad request', 400);
        expect(error400.recoveryStrategy).toBe(RecoveryStrategy.TERMINATE);
        expect(error400.isRetryable).toBe(false);

        const error404 = new APIError('Not found', 404);
        expect(error404.recoveryStrategy).toBe(RecoveryStrategy.TERMINATE);
        expect(error404.isRetryable).toBe(false);
      });
    });

    describe('APITimeoutError', () => {
      it('should create timeout error with endpoint and timeout duration', () => {
        const error = new APITimeoutError('Request timed out', '/api/data', 30000);

        expect(error).toBeInstanceOf(APIError);
        expect(error.statusCode).toBe(408);
        expect(error.endpoint).toBe('/api/data');
        expect(error.timeoutMs).toBe(30000);
        expect(error.code).toBe('API_TIMEOUT');
        expect(error.isRetryable).toBe(true);
        expect(error.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      });
    });

    describe('APIResponseError', () => {
      it('should create response parsing error', () => {
        const error = new APIResponseError(
          'Failed to parse response',
          '/api/users',
          '{"invalid json'
        );

        expect(error).toBeInstanceOf(APIError);
        expect(error.endpoint).toBe('/api/users');
        expect(error.rawResponse).toBe('{"invalid json');
        expect(error.code).toBe('API_RESPONSE_PARSE_ERROR');
        expect(error.category).toBe(ErrorCategory.PARSING);
      });
    });
  });

  describe('Database Error Types', () => {
    describe('DatabaseConnectionError', () => {
      it('should create connection error with host and port', () => {
        const error = new DatabaseConnectionError('Connection failed', 'localhost', 5432, 'mydb');

        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.host).toBe('localhost');
        expect(error.port).toBe(5432);
        expect(error.database).toBe('mydb');
        expect(error.code).toBe('DB_CONNECTION_ERROR');
        expect(error.isRetryable).toBe(true);
        expect(error.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
      });
    });

    describe('DatabaseQueryError', () => {
      it('should create query error with SQL details', () => {
        const error = new DatabaseQueryError(
          'Query failed',
          'SELECT * FROM users WHERE id = ?',
          [123],
          '42P01'
        );

        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.query).toBe('SELECT * FROM users WHERE id = ?');
        expect(error.params).toEqual([123]);
        expect(error.sqlState).toBe('42P01');
        expect(error.code).toBe('DB_QUERY_ERROR');
      });

      it('should set retryable based on SQL state', () => {
        const constraintError = new DatabaseQueryError(
          'Constraint violation',
          'INSERT INTO users',
          [],
          '23505' // Unique violation
        );
        expect(constraintError.isRetryable).toBe(false);

        const otherError = new DatabaseQueryError(
          'Other error',
          'SELECT * FROM users',
          [],
          '42P01'
        );
        expect(otherError.isRetryable).toBe(false);
      });
    });

    describe('DatabaseTransactionError', () => {
      it('should create transaction error', () => {
        const error = new DatabaseTransactionError('Transaction failed', 'tx_12345', 'COMMIT');

        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.transactionId).toBe('tx_12345');
        expect(error.operation).toBe('COMMIT');
        expect(error.code).toBe('DB_TRANSACTION_ERROR');
        expect(error.isRetryable).toBe(true);
      });
    });

    describe('DatabaseConstraintError', () => {
      it('should create constraint violation error', () => {
        const error = new DatabaseConstraintError(
          'Unique constraint violated',
          'users_email_unique',
          'users',
          'email'
        );

        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.constraint).toBe('users_email_unique');
        expect(error.table).toBe('users');
        expect(error.column).toBe('email');
        expect(error.code).toBe('DB_CONSTRAINT_VIOLATION');
        expect(error.isRetryable).toBe(false);
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });
  });

  describe('Validation Error Types', () => {
    describe('FieldValidationError', () => {
      it('should create field validation error', () => {
        const error = new FieldValidationError(
          'Email validation failed',
          'email',
          'invalid-email',
          ['must be valid email', 'required']
        );

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.fieldName).toBe('email');
        expect(error.fieldValue).toBe('invalid-email');
        expect(error.rules).toEqual(['must be valid email', 'required']);
        expect(error.validationErrors).toEqual({
          email: ['must be valid email', 'required'],
        });
        expect(error.code).toBe('FIELD_VALIDATION_ERROR');
      });
    });

    describe('SchemaValidationError', () => {
      it('should create schema validation error', () => {
        const schema = { type: 'object', required: ['name'] };
        const data = { age: 25 };
        const validationErrors = {
          name: ['required field missing'],
        };

        const error = new SchemaValidationError(
          'Schema validation failed',
          schema,
          data,
          validationErrors,
          '#/properties/name'
        );

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.schema).toEqual(schema);
        expect(error.data).toEqual(data);
        expect(error.validationErrors).toEqual(validationErrors);
        expect(error.schemaPath).toBe('#/properties/name');
        expect(error.code).toBe('SCHEMA_VALIDATION_ERROR');
      });
    });

    describe('InputSanitizationError', () => {
      it('should create input sanitization error', () => {
        const error = new InputSanitizationError(
          'Dangerous input detected',
          '<script>alert("XSS")</script>',
          'XSS',
          ['script tag detected', 'potentially malicious code']
        );

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.input).toBe('<script>alert("XSS")</script>');
        expect(error.sanitizationType).toBe('XSS');
        expect(error.detectedIssues).toEqual(['script tag detected', 'potentially malicious code']);
        expect(error.code).toBe('INPUT_SANITIZATION_ERROR');
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });

    describe('BusinessRuleError', () => {
      it('should create business rule error', () => {
        const error = new BusinessRuleError(
          'Business rule violation',
          'MINIMUM_ORDER_VALUE',
          'Order must be at least $50',
          { orderValue: 25, minimumValue: 50 }
        );

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.ruleName).toBe('MINIMUM_ORDER_VALUE');
        expect(error.ruleDescription).toBe('Order must be at least $50');
        expect(error.context).toEqual({ orderValue: 25, minimumValue: 50 });
        expect(error.code).toBe('BUSINESS_RULE_ERROR');
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });
  });

  describe('Configuration Error Types', () => {
    describe('MissingConfigError', () => {
      it('should create missing configuration error', () => {
        const error = new MissingConfigError(
          'Required configuration missing',
          ['API_KEY', 'DATABASE_URL'],
          'API_KEY'
        );

        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.requiredKeys).toEqual(['API_KEY', 'DATABASE_URL']);
        expect(error.configKey).toBe('API_KEY');
        expect(error.code).toBe('CONFIG_MISSING');
        expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      });
    });

    describe('InvalidConfigError', () => {
      it('should create invalid configuration error', () => {
        const error = new InvalidConfigError(
          'Invalid configuration value',
          'port',
          'not-a-number',
          'number',
          'must be a valid port number'
        );

        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.configKey).toBe('port');
        expect(error.configValue).toBe('not-a-number');
        expect(error.expectedType).toBe('number');
        expect(error.actualType).toBe('string');
        expect(error.validationRule).toBe('must be a valid port number');
        expect(error.code).toBe('CONFIG_INVALID');
      });
    });

    describe('EnvironmentConfigError', () => {
      it('should create environment configuration error', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const error = new EnvironmentConfigError('Environment configuration error', 'production', [
          'DATABASE_URL',
          'REDIS_URL',
        ]);

        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.environment).toBe('production');
        expect(error.missingEnvVars).toEqual(['DATABASE_URL', 'REDIS_URL']);
        expect(error.code).toBe('ENV_CONFIG_ERROR');

        process.env.NODE_ENV = originalEnv;
      });

      it('should use process.env.NODE_ENV if environment not provided', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const error = new EnvironmentConfigError('Environment configuration error');

        expect(error.environment).toBe('development');

        process.env.NODE_ENV = originalEnv;
      });
    });
  });

  describe('Error Inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const apiError = new APIError('API error', 500);
      expect(apiError).toBeInstanceOf(APIError);
      expect(apiError).toBeInstanceOf(NetworkError);
      expect(apiError).toBeInstanceOf(BaseError);
      expect(apiError).toBeInstanceOf(Error);

      const dbConnError = new DatabaseConnectionError('Connection failed');
      expect(dbConnError).toBeInstanceOf(DatabaseConnectionError);
      expect(dbConnError).toBeInstanceOf(DatabaseError);
      expect(dbConnError).toBeInstanceOf(BaseError);
      expect(dbConnError).toBeInstanceOf(Error);

      const fieldError = new FieldValidationError('Field invalid', 'email', 'test', ['invalid']);
      expect(fieldError).toBeInstanceOf(FieldValidationError);
      expect(fieldError).toBeInstanceOf(ValidationError);
      expect(fieldError).toBeInstanceOf(BaseError);
      expect(fieldError).toBeInstanceOf(Error);

      const configError = new MissingConfigError('Config missing', ['KEY']);
      expect(configError).toBeInstanceOf(MissingConfigError);
      expect(configError).toBeInstanceOf(ConfigurationError);
      expect(configError).toBeInstanceOf(BaseError);
      expect(configError).toBeInstanceOf(Error);
    });
  });

  describe('Error Properties', () => {
    it('should have correct default properties', () => {
      const apiError = new APIError('API failed', 503);
      expect(apiError.category).toBe(ErrorCategory.NETWORK);
      expect(apiError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(apiError.isRetryable).toBe(true);

      const validationError = new FieldValidationError('Invalid', 'field', 'value', ['rule']);
      expect(validationError.category).toBe(ErrorCategory.VALIDATION);
      expect(validationError.severity).toBe(ErrorSeverity.LOW);
      expect(validationError.isRetryable).toBe(false);

      const configError = new InvalidConfigError('Invalid config', 'key', 'value');
      expect(configError.category).toBe(ErrorCategory.CONFIGURATION);
      expect(configError.severity).toBe(ErrorSeverity.CRITICAL);
      expect(configError.isRetryable).toBe(false);

      const dbError = new DatabaseConnectionError('Connection failed');
      expect(dbError.category).toBe(ErrorCategory.DATABASE);
      expect(dbError.severity).toBe(ErrorSeverity.HIGH);
      expect(dbError.isRetryable).toBe(true);
    });
  });
});
