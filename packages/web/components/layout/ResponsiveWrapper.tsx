import { cn } from '@/lib/utils';

interface ResponsiveWrapperProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
};

const paddingClasses = {
  none: '',
  sm: 'px-4 sm:px-6',
  md: 'px-4 sm:px-6 lg:px-8',
  lg: 'px-4 sm:px-8 lg:px-12',
};

export function ResponsiveWrapper({
  children,
  className,
  maxWidth = '2xl',
  padding = 'md',
}: ResponsiveWrapperProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

// Mobile-first responsive grid component
interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-2 sm:gap-3',
  md: 'gap-3 sm:gap-4 lg:gap-6',
  lg: 'gap-4 sm:gap-6 lg:gap-8',
};

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 'md',
}: ResponsiveGridProps) {
  const gridCols = cn(
    'grid',
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`
  );

  return <div className={cn(gridCols, gapClasses[gap], className)}>{children}</div>;
}

// Stack component for vertical layouts on mobile
interface StackProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
  direction?: 'vertical' | 'horizontal';
}

const spacingClasses = {
  vertical: {
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
  },
  horizontal: {
    sm: 'space-x-2',
    md: 'space-x-4',
    lg: 'space-x-6',
  },
};

export function Stack({ children, className, spacing = 'md', direction = 'vertical' }: StackProps) {
  return (
    <div
      className={cn(
        direction === 'vertical' ? 'flex flex-col' : 'flex flex-row',
        spacingClasses[direction][spacing],
        className
      )}
    >
      {children}
    </div>
  );
}
