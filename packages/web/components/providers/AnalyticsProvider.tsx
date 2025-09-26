'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

// Inner component that uses hooks
function AnalyticsTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page view on route change
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

    // Log page view in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Page view:', url);
    }

    // Send to analytics service in production
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: Google Analytics
      if (typeof window.gtag !== 'undefined') {
        window.gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
          page_path: url,
        });
      }

      // Example: Custom analytics
      // analytics.page({ path: url })
    }
  }, [pathname, searchParams]);

  // Track Web Vitals
  useEffect(() => {
    if (typeof window !== 'undefined' && 'web-vital' in window) {
      // Track Core Web Vitals
      interface WebVital {
        name: string;
        value: number;
        id: string;
      }

      const reportWebVital = ({ name, value, id }: WebVital) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Analytics] Web Vital:', { name, value, id });
        }

        // Send to analytics service
        if (process.env.NODE_ENV === 'production') {
          // Example: Send to analytics endpoint
          // analytics.track('Web Vital', { name, value, id })
        }
      };

      // Listen for web vitals
      if ('addEventListener' in window) {
        window.addEventListener('web-vital', reportWebVital as unknown as EventListener);
        return () =>
          window.removeEventListener('web-vital', reportWebVital as unknown as EventListener);
      }
    }
  }, []);

  return null;
}

/**
 * Analytics Provider Component
 * Tracks page views and user interactions
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  return (
    <>
      <Suspense fallback={null}>
        <AnalyticsTracking />
      </Suspense>
      {children}
    </>
  );
}

// Custom hook for tracking events
export function useAnalytics() {
  const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Event:', eventName, properties);
    }

    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Google Analytics
      if (typeof window.gtag !== 'undefined') {
        window.gtag('event', eventName, properties);
      }

      // Custom analytics
      // analytics.track(eventName, properties)
    }
  };

  const trackError = (error: Error, errorInfo?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Analytics] Error:', error, errorInfo);
    }

    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Send to error tracking service
      // errorTracker.captureException(error, { extra: errorInfo })
    }
  };

  const trackTiming = (category: string, variable: string, value: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Timing:', { category, variable, value });
    }

    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Google Analytics timing
      if (typeof window.gtag !== 'undefined') {
        window.gtag('event', 'timing_complete', {
          event_category: category,
          name: variable,
          value: value,
        });
      }
    }
  };

  return {
    trackEvent,
    trackError,
    trackTiming,
  };
}

// Extend Window interface for analytics
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
