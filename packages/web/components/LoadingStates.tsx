'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  ChartSkeleton,
  ListSkeleton,
  FormSkeleton,
} from '@/components/ui/skeleton';
import { Spinner, InlineLoader } from '@/components/ui/spinner';
import { CheckCircle, AlertCircle, XCircle, Circle } from 'lucide-react';

// Loading state types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface LoadingStateProps {
  state: LoadingState;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  successMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  delay?: number;
  minLoadTime?: number;
}

// Main loading state wrapper
export function LoadingState({
  state,
  children,
  fallback,
  errorFallback,
  successMessage,
  errorMessage,
  onRetry,
  delay = 0,
  minLoadTime = 0,
}: LoadingStateProps) {
  const [showContent, setShowContent] = useState(state === 'idle');
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (state === 'loading') {
      setStartTime(Date.now());
      const timer = setTimeout(() => {
        setShowContent(false);
      }, delay);
      return () => clearTimeout(timer);
    }

    if (state === 'success' && startTime) {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadTime - elapsed);

      const timer = setTimeout(() => {
        setShowContent(true);
      }, remainingTime);
      return () => clearTimeout(timer);
    }

    if (state === 'idle' || state === 'error') {
      setShowContent(state === 'idle');
    }
  }, [state, delay, minLoadTime, startTime]);

  if (state === 'loading' && !showContent) {
    return <>{fallback || <Spinner size="lg" />}</>;
  }

  if (state === 'error') {
    return (
      <>
        {errorFallback || (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-muted-foreground">{errorMessage || 'An error occurred'}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  if (state === 'success' && successMessage && showContent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md">
          <CheckCircle className="h-5 w-5" />
          <span>{successMessage}</span>
        </div>
        {children}
      </div>
    );
  }

  return <>{showContent ? children : fallback || <Spinner size="lg" />}</>;
}

// Progressive loading indicator
export function ProgressiveLoader({
  steps,
  currentStep,
  className,
}: {
  steps: string[];
  currentStep: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-3">
          {index < currentStep ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : index === currentStep ? (
            <InlineLoader size="sm" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
          <span
            className={cn(
              'text-sm',
              index < currentStep && 'text-muted-foreground line-through',
              index === currentStep && 'font-medium',
              index > currentStep && 'text-muted-foreground/50'
            )}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

// Staggered loading animation
export function StaggeredLoader({
  items,
  delay = 100,
  className,
}: {
  items: React.ReactNode[];
  delay?: number;
  className?: string;
}) {
  const [visibleItems, setVisibleItems] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleItems((prev) => {
        if (prev >= items.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, delay);

    return () => clearInterval(timer);
  }, [items.length, delay]);

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'transition-all duration-300',
            index < visibleItems ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

// Content placeholder
export function ContentPlaceholder({
  type = 'card',
  count = 1,
  className,
}: {
  type?: 'card' | 'table' | 'chart' | 'list' | 'form' | 'custom';
  count?: number;
  className?: string;
}) {
  const renderPlaceholder = () => {
    switch (type) {
      case 'card':
        return <CardSkeleton className={className} />;
      case 'table':
        return <TableSkeleton rows={5} />;
      case 'chart':
        return <ChartSkeleton className={className} />;
      case 'list':
        return <ListSkeleton items={count} />;
      case 'form':
        return <FormSkeleton />;
      default:
        return <Skeleton className={cn('h-32 w-full', className)} />;
    }
  };

  if (count > 1 && type !== 'list') {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>{renderPlaceholder()}</div>
        ))}
      </div>
    );
  }

  return renderPlaceholder();
}

// Async data loader with states
export function AsyncLoader<T>({
  promise,
  children,
  fallback,
  errorFallback,
  onError,
}: {
  promise: Promise<T>;
  children: (data: T) => React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  onError?: (error: Error) => void;
}) {
  const [state, setState] = useState<{
    status: LoadingState;
    data?: T;
    error?: Error;
  }>({
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    promise
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'success', data });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', error });
          onError?.(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [promise, onError]);

  if (state.status === 'loading') {
    return <>{fallback || <Spinner size="lg" />}</>;
  }

  if (state.status === 'error') {
    return (
      <>
        {errorFallback || (
          <div className="flex items-center justify-center p-8">
            <AlertCircle className="h-8 w-8 text-destructive mr-2" />
            <span>Failed to load data</span>
          </div>
        )}
      </>
    );
  }

  return <>{state.data && children(state.data)}</>;
}

// Infinite scroll loader
export function InfiniteScrollLoader({
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 100,
  children,
  loader,
  endMessage,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
  children: React.ReactNode;
  loader?: React.ReactNode;
  endMessage?: React.ReactNode;
}) {
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - threshold
      ) {
        if (hasMore && !isLoading) {
          onLoadMore();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, onLoadMore, threshold]);

  return (
    <>
      {children}
      {isLoading && (loader || <Spinner size="md" className="my-4" />)}
      {!hasMore && endMessage && (
        <div className="text-center text-muted-foreground py-4">{endMessage}</div>
      )}
    </>
  );
}

// Page transition loader
export function PageTransition({
  loading,
  children,
  direction = 'fade',
}: {
  loading: boolean;
  children: React.ReactNode;
  direction?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right';
}) {
  const transitionClasses = {
    fade: loading ? 'opacity-0' : 'opacity-100',
    'slide-up': loading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0',
    'slide-down': loading ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0',
    'slide-left': loading ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
    'slide-right': loading ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0',
  };

  return (
    <div className={cn('transition-all duration-300 ease-in-out', transitionClasses[direction])}>
      {children}
    </div>
  );
}

// Data fetch wrapper with caching
export function DataLoader<T>({
  queryKey,
  queryFn,
  cacheTime = 5 * 60 * 1000, // 5 minutes
  children,
  fallback,
}: {
  queryKey: string;
  queryFn: () => Promise<T>;
  cacheTime?: number;
  children: (data: T) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(queryKey);
    if (cached) {
      const { data: cachedData, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheTime) {
        setData(cachedData);
        setLoading(false);
        return;
      }
    }

    queryFn()
      .then((result) => {
        setData(result);
        sessionStorage.setItem(queryKey, JSON.stringify({ data: result, timestamp: Date.now() }));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [queryKey, queryFn, cacheTime]);

  if (loading) {
    return <>{fallback || <Spinner size="lg" />}</>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <AlertCircle className="h-8 w-8 text-destructive mr-2" />
        <span>Error: {error.message}</span>
      </div>
    );
  }

  return <>{data && children(data)}</>;
}
