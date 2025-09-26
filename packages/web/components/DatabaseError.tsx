'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Database,
  RefreshCw,
  Download,
  FileX,
  WifiOff,
  MemoryStick,
  AlertCircle,
  Shield,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DatabaseError as DBError,
  DatabaseErrorType,
  ErrorSeverity,
  errorRecovery,
  RecoveryAction,
} from '@/lib/db/error-handling';

interface DatabaseErrorProps {
  error: DBError | Error | string;
  onRetry?: () => void;
  onReset?: () => void;
  onLoadSample?: () => void;
  className?: string;
  showDetails?: boolean;
  showRecoveryOptions?: boolean;
}

export function DatabaseError({
  error,
  onRetry,
  onReset,
  onLoadSample,
  className,
  showDetails = true,
  showRecoveryOptions = true,
}: DatabaseErrorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<string>('');

  // Parse error
  const dbError =
    error instanceof DBError
      ? error
      : new DBError(
          DatabaseErrorType.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        );

  // Get icon based on error type
  const getErrorIcon = () => {
    const iconClass = 'h-6 w-6';
    switch (dbError.type) {
      case DatabaseErrorType.CONNECTION_ERROR:
        return <WifiOff className={iconClass} />;
      case DatabaseErrorType.LOADING_ERROR:
        return <FileX className={iconClass} />;
      case DatabaseErrorType.MEMORY_ERROR:
        return <MemoryStick className={iconClass} />;
      case DatabaseErrorType.PERMISSION_ERROR:
        return <Shield className={iconClass} />;
      case DatabaseErrorType.TIMEOUT_ERROR:
        return <Clock className={iconClass} />;
      case DatabaseErrorType.CORRUPTION_ERROR:
        return <Database className={iconClass} />;
      case DatabaseErrorType.QUERY_ERROR:
        return <AlertCircle className={iconClass} />;
      default:
        return <AlertTriangle className={iconClass} />;
    }
  };

  // Get severity color
  const getSeverityColor = () => {
    switch (dbError.severity) {
      case ErrorSeverity.LOW:
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case ErrorSeverity.MEDIUM:
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case ErrorSeverity.HIGH:
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case ErrorSeverity.CRITICAL:
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  // Copy error details
  const copyErrorDetails = async () => {
    const errorText = `
Error Type: ${dbError.type}
Severity: ${dbError.severity}
Message: ${dbError.message}
Timestamp: ${dbError.timestamp.toISOString()}
${dbError.technicalDetails ? `\nTechnical Details:\n${dbError.technicalDetails}` : ''}
${dbError.stack ? `\nStack Trace:\n${dbError.stack}` : ''}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  // Attempt automatic recovery
  const attemptRecovery = async () => {
    if (!dbError.recoverable) return;

    setIsRecovering(true);
    setRecoveryStatus('Attempting automatic recovery...');

    try {
      const success = await errorRecovery.attemptRecovery(dbError);
      if (success) {
        setRecoveryStatus('Recovery successful! Reloading...');
        setTimeout(() => {
          if (onRetry) onRetry();
        }, 1500);
      } else {
        setRecoveryStatus('Automatic recovery failed. Please try manual options.');
      }
    } catch (err) {
      setRecoveryStatus('Recovery attempt failed.');
      console.error('Recovery error:', err);
    } finally {
      setTimeout(() => {
        setIsRecovering(false);
        setRecoveryStatus('');
      }, 3000);
    }
  };

  // Get recovery actions
  const getRecoveryActions = (): RecoveryAction[] => {
    const strategy = errorRecovery.getStrategy(dbError.type);
    return strategy?.actions || [];
  };

  return (
    <div className={cn('rounded-lg border p-6 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start space-x-4">
        <div className={cn('p-3 rounded-full', getSeverityColor())}>{getErrorIcon()}</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">Database Error</h3>
          <p className="text-sm text-muted-foreground mt-1">{dbError.userMessage}</p>
          {dbError.severity === ErrorSeverity.CRITICAL && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm">
              Critical error - immediate action required
            </div>
          )}
        </div>
      </div>

      {/* Error Details */}
      {showDetails && (
        <div className="space-y-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Error Details
            </span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {isExpanded && (
            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Error Type:</span>
                    <p className="text-sm font-mono">{dbError.type}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Severity:</span>
                    <p className="text-sm font-mono">{dbError.severity}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Timestamp:</span>
                    <p className="text-sm font-mono">{dbError.timestamp.toLocaleString()}</p>
                  </div>
                  {dbError.context && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Context:</span>
                      <pre className="text-xs mt-1 p-2 bg-background rounded overflow-auto max-h-32">
                        {JSON.stringify(dbError.context, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
                <button
                  onClick={copyErrorDetails}
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="Copy error details"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && dbError.technicalDetails && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Technical Details (Development Only)
                  </summary>
                  <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-40 p-2 bg-background rounded">
                    {dbError.technicalDetails}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recovery Status */}
      {isRecovering && recoveryStatus && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-700 dark:text-blue-300">{recoveryStatus}</span>
        </div>
      )}

      {/* Recovery Options */}
      {showRecoveryOptions && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Recovery Options</h4>

          <div className="grid gap-2">
            {/* Automatic Recovery */}
            {dbError.recoverable && !isRecovering && (
              <button
                onClick={attemptRecovery}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Attempt Automatic Recovery
              </button>
            )}

            {/* Manual Retry */}
            {dbError.retryable && onRetry && (
              <button
                onClick={onRetry}
                disabled={isRecovering}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Operation
              </button>
            )}

            {/* Load Sample Database */}
            {dbError.type === DatabaseErrorType.LOADING_ERROR && onLoadSample && (
              <button
                onClick={onLoadSample}
                disabled={isRecovering}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Load Sample Database
              </button>
            )}

            {/* Reset Application */}
            {onReset && (
              <button
                onClick={onReset}
                disabled={isRecovering}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                Reset Database
              </button>
            )}
          </div>

          {/* Additional Recovery Actions */}
          {getRecoveryActions().length > 0 && (
            <div className="mt-3 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Additional recovery options:
              </p>
              <ul className="space-y-1">
                {getRecoveryActions().map((action, index) => (
                  <li key={index} className="text-xs text-muted-foreground">
                    • {action.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          {dbError.severity === ErrorSeverity.CRITICAL ? (
            <>
              If this problem persists, please contact support with the error details above. Error
              ID: {dbError.timestamp.getTime()}
            </>
          ) : (
            <>
              This error is usually temporary. If it persists, try refreshing the page or clearing
              your browser cache.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// Inline Database Error Component
export function InlineDatabaseError({
  error,
  onRetry,
  className,
}: {
  error: string | Error;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md',
        className
      )}
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm flex-1">{error instanceof Error ? error.message : error}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-medium underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}

// Database Status Indicator
export function DatabaseStatus({
  isConnected,
  isLoading,
  error,
  className,
}: {
  isConnected: boolean;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
        <span className="text-muted-foreground">Connecting to database...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <AlertCircle className="h-3 w-3 text-red-500" />
        <span className="text-red-600 dark:text-red-400">Database error</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <div className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-gray-400')} />
      <span className="text-muted-foreground">
        Database {isConnected ? 'connected' : 'disconnected'}
      </span>
    </div>
  );
}
