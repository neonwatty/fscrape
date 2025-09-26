'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // You can send error to monitoring service here
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: Send to analytics or error tracking service
      // analytics.track('Error', { error: error.message, stack: error.stack })
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full">
            <div className="bg-card rounded-lg shadow-lg p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    An unexpected error occurred. Please try refreshing the page.
                  </p>
                </div>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-4 bg-muted rounded-md">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        View stack trace
                      </summary>
                      <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={this.handleReset}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </button>
                <Link
                  href="/"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for error handling in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const resetError = () => setError(null);
  const captureError = (error: Error) => setError(error);

  return { resetError, captureError };
}
