'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  showDetails: boolean;
  isRecovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: false,
      isRecovering: false,
    };
    this.previousResetKeys = props.resetKeys || [];
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state to display fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to monitoring service
      // errorReporter.captureException(error, {
      //   extra: errorInfo,
      //   level: this.props.level || 'component',
      // })
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset on prop changes if configured
    if (hasError && prevProps.children !== this.props.children && resetOnPropsChange) {
      this.resetErrorBoundary();
    }

    // Reset when resetKeys change
    if (hasError && resetKeys && this.previousResetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== this.previousResetKeys[index]
      );
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
    this.previousResetKeys = resetKeys || [];
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      isRecovering: true,
    });

    // Reset recovering state after animation
    this.resetTimeoutId = setTimeout(() => {
      this.setState({ isRecovering: false });
    }, 300);
  };

  toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  render() {
    const { hasError, error, errorInfo, errorCount, showDetails, isRecovering } = this.state;
    const {
      children,
      fallback,
      level = 'component',
      showDetails: showDetailsProp = true,
    } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Determine error boundary level styling
      const levelStyles = {
        page: 'min-h-screen',
        section: 'min-h-[400px]',
        component: 'min-h-[200px]',
      };

      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className={`${levelStyles[level]} flex items-center justify-center p-4`}>
          <div className="max-w-md w-full">
            <div className="bg-card rounded-lg border shadow-sm p-6 space-y-4">
              {/* Error Header */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="p-2.5 bg-destructive/10 rounded-full">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {level === 'page'
                      ? 'Page Error'
                      : level === 'section'
                        ? 'Section Error'
                        : 'Component Error'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {error.message || 'An unexpected error occurred'}
                  </p>
                  {errorCount > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      This error has occurred {errorCount} times
                    </p>
                  )}
                </div>
              </div>

              {/* Error Details Toggle (Development) */}
              {isDevelopment && showDetailsProp && errorInfo && (
                <div>
                  <button
                    onClick={this.toggleDetails}
                    className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-md hover:bg-muted/70 transition-colors"
                  >
                    <span className="text-sm font-medium">Error Details</span>
                    {showDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {showDetails && (
                    <div className="mt-2 p-3 bg-muted/30 rounded-md space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Component Stack:
                        </p>
                        <pre className="text-xs text-muted-foreground overflow-auto max-h-32 p-2 bg-background rounded">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                      {error.stack && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Error Stack:
                          </p>
                          <pre className="text-xs text-muted-foreground overflow-auto max-h-32 p-2 bg-background rounded">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recovery Actions */}
              <div className="flex gap-2">
                <button
                  onClick={this.resetErrorBoundary}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Try Again
                </button>
                {level === 'page' && (
                  <Link
                    href="/"
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors text-sm font-medium"
                  >
                    <Home className="h-4 w-4 mr-1.5" />
                    Go Home
                  </Link>
                )}
              </div>

              {/* Isolation Mode Indicator */}
              {this.props.isolate && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    This error has been isolated and won&apos;t affect other parts of the
                    application
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Add recovering animation class
    if (isRecovering) {
      return <div className="animate-fadeIn">{children}</div>;
    }

    return children;
  }
}

// Higher-order component for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

// Hook for error handling in functional components
export function useErrorHandler() {
  return (error: Error) => {
    console.error('Error caught by useErrorHandler:', error);
    throw error; // This will be caught by the nearest error boundary
  };
}

// Async error boundary wrapper
export function AsyncBoundary({
  children,
  fallback: FallbackComponent,
  ...props
}: Props & {
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}) {
  return (
    <ErrorBoundary
      {...props}
      fallback={
        FallbackComponent && (
          <FallbackComponent
            error={new Error('Async operation failed')}
            retry={() => window.location.reload()}
          />
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}
