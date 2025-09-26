import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'secondary' | 'muted';
  type?: 'spinner' | 'dots' | 'ring' | 'bars';
  label?: string;
  showLabel?: boolean;
  fullScreen?: boolean;
  overlay?: boolean;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const variantClasses = {
  default: 'text-foreground',
  primary: 'text-primary',
  secondary: 'text-secondary',
  muted: 'text-muted-foreground',
};

export function Spinner({
  size = 'md',
  variant = 'primary',
  type = 'spinner',
  label = 'Loading...',
  showLabel = false,
  fullScreen = false,
  overlay = false,
  className,
  ...props
}: SpinnerProps) {
  const spinnerContent = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2',
        fullScreen && 'min-h-screen',
        className
      )}
      {...props}
    >
      {type === 'spinner' && (
        <Loader2 className={cn('animate-spin', sizeClasses[size], variantClasses[variant])} />
      )}

      {type === 'dots' && (
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'rounded-full bg-current',
                size === 'xs' && 'h-1 w-1',
                size === 'sm' && 'h-1.5 w-1.5',
                size === 'md' && 'h-2 w-2',
                size === 'lg' && 'h-3 w-3',
                size === 'xl' && 'h-4 w-4',
                variantClasses[variant]
              )}
              style={{
                animation: `pulse 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      {type === 'ring' && (
        <div
          className={cn(
            'rounded-full border-2 border-current border-t-transparent',
            sizeClasses[size],
            variantClasses[variant],
            'animate-spin'
          )}
        />
      )}

      {type === 'bars' && (
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'bg-current',
                size === 'xs' && 'h-3 w-0.5',
                size === 'sm' && 'h-4 w-1',
                size === 'md' && 'h-6 w-1.5',
                size === 'lg' && 'h-8 w-2',
                size === 'xl' && 'h-12 w-3',
                variantClasses[variant]
              )}
              style={{
                animation: `pulse 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      {showLabel && (
        <span
          className={cn(
            'text-sm',
            variant === 'muted' ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {label}
        </span>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
}

// Button with loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({
  loading = false,
  loadingText = 'Loading...',
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center justify-center px-4 py-2 font-medium rounded-md',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Inline loader for small spaces
export function InlineLoader({
  size = 'sm',
  className,
}: {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  return <RefreshCw className={cn('animate-spin inline-block', sizeClasses[size], className)} />;
}

// Progress spinner with percentage
export function ProgressSpinner({
  value,
  max = 100,
  size = 'md',
  showLabel = true,
  className,
}: {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = size === 'sm' ? 16 : size === 'md' ? 24 : 32;
  const strokeWidth = size === 'sm' ? 2 : size === 'md' ? 3 : 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        className={cn(
          size === 'sm' && 'h-10 w-10',
          size === 'md' && 'h-16 w-16',
          size === 'lg' && 'h-20 w-20'
        )}
      >
        <circle
          className="text-muted"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
        />
        <circle
          className="text-primary transition-all duration-300 ease-in-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
          }}
        />
      </svg>
      {showLabel && <span className="absolute text-xs font-medium">{Math.round(percentage)}%</span>}
    </div>
  );
}

// Lazy loading wrapper
export function LazyLoadingBoundary({
  children,
  fallback = <Spinner size="lg" fullScreen />,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return <React.Suspense fallback={fallback}>{children}</React.Suspense>;
}

import React from 'react';
