import { Loader2 } from 'lucide-react';

// Main route-level loading component with Suspense boundary support
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="h-16 w-16 mx-auto">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
          {/* Pulse ring for better visual feedback */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full border-4 border-primary/20 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">Loading...</h2>
          <p className="text-sm text-muted-foreground">Please wait while we fetch your data</p>
          {/* Animated dots for progress indication */}
          <div className="flex justify-center space-x-1">
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Component-level loading for lazy loaded components
export function ComponentLoading({ message = 'Loading component...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center space-x-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}

// Skeleton loading for data tables
export function TableLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />
      ))}
    </div>
  );
}

// Chart loading placeholder
export function ChartLoading({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`${height} bg-muted/20 rounded-lg flex items-center justify-center`}>
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading chart data...</p>
      </div>
    </div>
  );
}

// Section loading with skeleton
export function SectionLoading({ title }: { title?: string }) {
  return (
    <div className="space-y-4">
      {title && <div className="h-8 w-48 bg-muted/30 rounded animate-pulse" />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
