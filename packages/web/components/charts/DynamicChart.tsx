'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Chart loading component
const ChartLoader = () => (
  <div className="w-full h-full min-h-[200px] flex items-center justify-center">
    <Skeleton className="w-full h-full" />
  </div>
);

// Dynamic imports for heavy chart components with loading states
export const DynamicTimeSeriesChart = dynamic(
  () => import('./TimeSeriesChart').then((mod) => mod.TimeSeriesChart),
  {
    loading: () => <ChartLoader />,
    ssr: false, // Charts don't need SSR
  }
);

export const DynamicMobileTimeSeriesChart = dynamic(
  () => import('./MobileTimeSeriesChart').then((mod) => mod.MobileTimeSeriesChart),
  {
    loading: () => <ChartLoader />,
    ssr: false,
  }
);

export const DynamicEngagementChart = dynamic(
  () => import('./EngagementChart').then((mod) => mod.EngagementChart),
  {
    loading: () => <ChartLoader />,
    ssr: false,
  }
);

export const DynamicGrowthChart = dynamic(
  () => import('./GrowthChart').then((mod) => mod.GrowthChart),
  {
    loading: () => <ChartLoader />,
    ssr: false,
  }
);

export const DynamicComparisonChart = dynamic(
  () => import('../compare/ComparisonChart').then((mod) => mod.ComparisonChart),
  {
    loading: () => <ChartLoader />,
    ssr: false,
  }
);

export const DynamicComparisonCharts = dynamic(
  () => import('../compare/ComparisonCharts').then((mod) => mod.ComparisonCharts),
  {
    loading: () => <ChartLoader />,
    ssr: false,
  }
);

// Dashboard chart components
export const DynamicTrendChart = dynamic(
  () => import('../dashboard/TrendChart').then((mod) => mod.TrendChart),
  {
    loading: () => <ChartLoader />,
    ssr: false,
  }
);

export const DynamicPlatformSelector = dynamic(
  () => import('../dashboard/PlatformSelector').then((mod) => mod.PlatformSelector),
  {
    loading: () => <ChartLoader />,
    ssr: false,
  }
);
