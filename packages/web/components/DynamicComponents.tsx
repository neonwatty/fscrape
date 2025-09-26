'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

// Generic loading component
const DefaultLoader = () => (
  <div className="flex items-center justify-center p-4">
    <Spinner size="md" />
  </div>
);

// Database components - only load when needed
export const DynamicDatabaseError = dynamic(
  () => import('./DatabaseError').then((mod) => ({ default: mod.DatabaseError })),
  {
    loading: () => <DefaultLoader />,
    ssr: true, // Keep SSR for error handling
  }
);

// Error Boundary - load on demand
export const DynamicErrorBoundary = dynamic(
  () => import('./ErrorBoundary').then((mod) => ({ default: mod.ErrorBoundary })),
  {
    loading: () => null, // No loader for error boundary
    ssr: true,
  }
);

// Analytics components
export const DynamicTopAuthors = dynamic(
  () => import('./analytics/TopAuthors').then((mod) => ({ default: mod.TopAuthors })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  }
);

export const DynamicEngagementMetrics = dynamic(
  () => import('./analytics/EngagementMetrics').then((mod) => ({ default: mod.EngagementMetrics })),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);

export const DynamicActivityHeatmap = dynamic(
  () => import('./analytics/ActivityHeatmap').then((mod) => ({ default: mod.ActivityHeatmap })),
  {
    loading: () => <Skeleton className="h-48 w-full" />,
    ssr: false,
  }
);

// Compare components
export const DynamicSourceSelector = dynamic(
  () => import('./compare/SourceSelector').then((mod) => ({ default: mod.SourceSelector })),
  {
    loading: () => <Skeleton className="h-20 w-full" />,
    ssr: false,
  }
);

export const DynamicMetricsTable = dynamic(
  () => import('./compare/MetricsTable').then((mod) => ({ default: mod.MetricsTable })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  }
);

export const DynamicMetricsCard = dynamic(
  () => import('./compare/MetricsCard').then((mod) => ({ default: mod.MetricsCard })),
  {
    loading: () => <Skeleton className="h-32 w-full" />,
    ssr: false,
  }
);

// Table components - lazy load for better performance
export const DynamicResponsivePostsTable = dynamic(
  () =>
    import('./tables/ResponsivePostsTable').then((mod) => ({ default: mod.ResponsivePostsTable })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  }
);

export const DynamicResponsiveTable = dynamic(
  () => import('./tables/ResponsiveTable').then((mod) => ({ default: mod.ResponsiveTable })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  }
);
