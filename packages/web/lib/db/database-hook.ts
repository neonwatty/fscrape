'use client';

import { useEffect, useState, useCallback } from 'react';
import { Database } from 'sql.js';
import { initializeDatabase, isDatabaseInitialized, closeDatabase } from './sql-loader';
import {
  DatabaseError,
  DatabaseErrorType,
  ErrorSeverity,
  classifyError,
  errorLogger,
  errorRecovery,
  safeExecuteQuery,
  TransactionManager,
} from './error-handling';

interface UseDatabaseOptions {
  autoLoad?: boolean;
  databasePath?: string;
  enableErrorRecovery?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

interface UseDatabaseReturn {
  database: Database | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: DatabaseError | null;
  errorHistory: DatabaseError[];
  loadDatabase: (path?: string) => Promise<void>;
  closeDb: () => void;
  retry: () => Promise<void>;
  clearError: () => void;
  executeQuery: (query: string, params?: unknown[]) => Promise<unknown>;
  transaction: TransactionManager | null;
}

export function useDatabaseInitializer(options: UseDatabaseOptions = {}): UseDatabaseReturn {
  const {
    autoLoad = false,
    databasePath,
    enableErrorRecovery = true,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  const [database, setDatabase] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [transaction, setTransaction] = useState<TransactionManager | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastLoadPath, setLastLoadPath] = useState<string | undefined>();

  const createDatabaseError = (err: unknown, type?: DatabaseErrorType): DatabaseError => {
    const errorType = type || classifyError(err as Error);
    const dbError = new DatabaseError(
      errorType,
      err instanceof Error ? err.message : 'Database operation failed',
      {
        severity:
          errorType === DatabaseErrorType.INITIALIZATION_ERROR
            ? ErrorSeverity.HIGH
            : ErrorSeverity.MEDIUM,
        originalError: err instanceof Error ? err : undefined,
        retryable: retryCount < maxRetries,
        recoverable: enableErrorRecovery,
        context: {
          databasePath,
          retryCount,
          maxRetries,
        },
      }
    );

    // Log error
    errorLogger.log(dbError);

    return dbError;
  };

  const loadDatabase = async (path?: string) => {
    setIsLoading(true);
    setError(null);
    setLastLoadPath(path || databasePath);

    try {
      const db = await initializeDatabase(
        path || databasePath ? { databasePath: path || databasePath } : undefined
      );
      setDatabase(db);
      setTransaction(new TransactionManager(db));
      setIsInitialized(true);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const dbError = createDatabaseError(err, DatabaseErrorType.INITIALIZATION_ERROR);
      setError(dbError);
      setIsInitialized(false);

      // Attempt automatic recovery if enabled
      if (enableErrorRecovery && dbError.recoverable) {
        const recovered = await errorRecovery.attemptRecovery(dbError);
        if (recovered && retryCount < maxRetries) {
          // Retry after recovery
          setTimeout(() => {
            retry();
          }, retryDelay);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const retry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      const dbError = new DatabaseError(
        DatabaseErrorType.INITIALIZATION_ERROR,
        'Maximum retry attempts exceeded',
        {
          severity: ErrorSeverity.HIGH,
          retryable: false,
          context: { retryCount, maxRetries },
        }
      );
      setError(dbError);
      return;
    }

    setRetryCount((prev) => prev + 1);
    await loadDatabase(lastLoadPath);
  }, [retryCount, maxRetries, lastLoadPath]);

  const closeDb = useCallback(() => {
    if (isDatabaseInitialized()) {
      // Clean up transaction if exists
      if (transaction?.isInTransaction()) {
        transaction.rollback().catch(console.error);
      }

      closeDatabase();
      setDatabase(null);
      setTransaction(null);
      setIsInitialized(false);
      setError(null);
      setRetryCount(0);
    }
  }, [transaction]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeQuery = useCallback(
    async (query: string, params?: any[]) => {
      if (!database) {
        throw new DatabaseError(DatabaseErrorType.QUERY_ERROR, 'Database not initialized', {
          severity: ErrorSeverity.HIGH,
        });
      }

      const result = await safeExecuteQuery(database, query, params);

      if (!result.success && result.error) {
        setError(result.error);
        throw result.error;
      }

      return result.data;
    },
    [database]
  );

  const getErrorHistory = useCallback(() => {
    return errorLogger.getErrorHistory();
  }, []);

  useEffect(() => {
    if (autoLoad && !isInitialized && !isLoading) {
      loadDatabase();
    }

    // Cleanup on unmount
    return () => {
      if (isDatabaseInitialized()) {
        if (transaction?.isInTransaction()) {
          transaction.rollback().catch(console.error);
        }
        closeDatabase();
      }
    };
  }, [autoLoad, isInitialized, isLoading]);

  return {
    database,
    isLoading,
    isInitialized,
    error,
    errorHistory: getErrorHistory(),
    loadDatabase,
    closeDb,
    retry,
    clearError,
    executeQuery,
    transaction,
  };
}
