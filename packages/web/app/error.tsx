'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Home, Bug, Copy, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);

    // Send error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry, LogRocket, etc.
      // errorReporter.captureException(error, {
      //   extra: {
      //     retryCount,
      //     digest: error.digest,
      //   }
      // })
    }
  }, [error, retryCount]);

  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount((prev) => prev + 1);
      reset();
    }
  };

  const copyErrorDetails = async () => {
    const errorDetails = `Error: ${error.message}\nDigest: ${error.digest || 'N/A'}\n${isDevelopment ? `Stack: ${error.stack}` : ''}`;
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-card rounded-lg border shadow-sm p-6 space-y-6">
          {/* Error Icon and Title */}
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="p-3 bg-destructive/10 rounded-full">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground mt-1">
                An unexpected error occurred while processing your request. The error has been
                logged and we&apos;ll look into it.
              </p>
            </div>
          </div>

          {/* Retry Limit Warning */}
          {retryCount >= maxRetries && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
              <p className="text-sm text-warning-foreground">
                Maximum retry attempts reached. Please refresh the page or contact support.
              </p>
            </div>
          )}

          {/* Error Details (Development Only) */}
          {isDevelopment && error && (
            <div className="p-4 bg-muted/50 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bug className="h-4 w-4" />
                  <span>Error Details (Development Only)</span>
                </div>
                <button
                  onClick={copyErrorDetails}
                  className="p-1.5 hover:bg-muted rounded transition-colors"
                  title="Copy error details"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-mono text-muted-foreground break-all">{error.message}</p>
                {error.digest && (
                  <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
                )}
                {retryCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Retry attempts: {retryCount}/{maxRetries}
                  </p>
                )}
              </div>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    View stack trace
                  </summary>
                  <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-40 p-2 bg-background rounded">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRetry}
              disabled={retryCount >= maxRetries}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {retryCount >= maxRetries ? 'Max Retries Reached' : 'Try Again'}
            </button>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors font-medium"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Link>
          </div>

          {/* Help Text */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              If this problem persists, please{' '}
              <Link href="/support" className="underline hover:text-foreground">
                contact support
              </Link>{' '}
              with error code: {error.digest || 'UNKNOWN'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
