'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, FileWarning } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log critical error
    console.error('Global application error:', error);

    // Send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Critical error reporting
      // errorReporter.captureException(error, { level: 'critical' })
    }
  }, [error]);

  // Global error requires a full HTML structure since it replaces the entire app
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-card rounded-lg border border-destructive/20 shadow-lg p-8 space-y-6">
              {/* Critical Error Icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="p-4 bg-destructive/10 rounded-full">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                  </div>
                  <div className="absolute -top-1 -right-1 p-1 bg-destructive rounded-full">
                    <FileWarning className="h-4 w-4 text-destructive-foreground" />
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Application Error</h1>
                <p className="text-muted-foreground">
                  A critical error has occurred that prevented the application from loading
                  properly.
                </p>
                <p className="text-sm text-muted-foreground">
                  Our team has been notified and is working to resolve this issue.
                </p>
              </div>

              {/* Error Code */}
              <div className="p-4 bg-muted/50 rounded-md text-center">
                <p className="text-xs text-muted-foreground mb-1">Error Reference</p>
                <p className="font-mono text-sm font-medium">{error.digest || 'GLOBAL_ERROR'}</p>
              </div>

              {/* Development Error Details */}
              {process.env.NODE_ENV === 'development' && (
                <div className="p-4 bg-destructive/5 rounded-md space-y-2 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">
                    Development Mode - Error Details
                  </p>
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {error.message}
                  </p>
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

              {/* Recovery Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    // Clear any cached data that might be causing issues
                    if (typeof window !== 'undefined') {
                      try {
                        sessionStorage.clear();
                        localStorage.clear();
                      } catch (e) {
                        console.error('Failed to clear storage:', e);
                      }
                    }
                    reset();
                  }}
                  className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Application
                </button>
                <Link
                  href="/"
                  className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors font-medium"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Return Home
                </Link>
              </div>

              {/* Support Information */}
              <div className="pt-6 border-t space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  If this problem persists, please try:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Clearing your browser cache and cookies</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Trying a different browser or incognito mode</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Checking your internet connection</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>
                      Contacting support with error code:{' '}
                      <span className="font-mono font-medium">
                        {error.digest || 'GLOBAL_ERROR'}
                      </span>
                    </span>
                  </li>
                </ul>
              </div>

              {/* System Status Link */}
              <div className="text-center">
                <Link
                  href="/status"
                  className="text-sm text-primary hover:underline inline-flex items-center"
                >
                  Check System Status
                  <span className="ml-1">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
