'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { Footer } from './Footer';
import { Sidebar, MobileSidebar } from './Sidebar';
import { Breadcrumbs, MobileBreadcrumbs } from './Breadcrumbs';
import { BottomNav } from './BottomNav';
import { usePathname } from 'next/navigation';

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showBreadcrumbs?: boolean;
  showFooter?: boolean;
  sidebarCollapsed?: boolean;
  containerClassName?: string;
  contentClassName?: string;
}

export function MainLayout({
  children,
  showSidebar = false,
  showBreadcrumbs = true,
  showFooter = false,
  sidebarCollapsed = false,
  containerClassName,
  contentClassName,
}: MainLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine if we should show breadcrumbs based on route
  const shouldShowBreadcrumbs = showBreadcrumbs && pathname !== '/';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        {showSidebar && !isMobile && (
          <Sidebar defaultCollapsed={sidebarCollapsed} className="hidden md:flex" />
        )}

        {/* Mobile Sidebar */}
        {showSidebar && isMobile && <MobileSidebar />}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Breadcrumbs */}
          {shouldShowBreadcrumbs && (
            <div className="border-b px-4 py-2 bg-muted/30">
              {isMobile ? <MobileBreadcrumbs /> : <Breadcrumbs className="container mx-auto" />}
            </div>
          )}

          {/* Page Content */}
          <main className={cn('flex-1', isMobile ? 'pb-20' : 'pb-0', containerClassName)}>
            <div className={cn('container mx-auto px-4 py-6', contentClassName)}>{children}</div>
          </main>

          {/* Footer - Desktop only */}
          {showFooter && !isMobile && <Footer />}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav />}
    </div>
  );
}

// Layout variants for different page types
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout
      showSidebar={true}
      showBreadcrumbs={true}
      showFooter={false}
      contentClassName="max-w-7xl"
    >
      {children}
    </MainLayout>
  );
}

export function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout
      showSidebar={false}
      showBreadcrumbs={true}
      showFooter={true}
      contentClassName="max-w-4xl mx-auto"
    >
      {children}
    </MainLayout>
  );
}

export function FullWidthLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout
      showSidebar={false}
      showBreadcrumbs={false}
      showFooter={false}
      containerClassName="px-0"
      contentClassName="max-w-full px-0"
    >
      {children}
    </MainLayout>
  );
}

// Two-column layout for comparison views
export function ComparisonLayout({
  leftPanel,
  rightPanel,
}: {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}) {
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const containerWidth = window.innerWidth;
      const newPosition = (e.clientX / containerWidth) * 100;
      setSplitPosition(Math.min(Math.max(newPosition, 20), 80));
    },
    [isDragging]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove]);

  return (
    <MainLayout
      showSidebar={false}
      showBreadcrumbs={true}
      showFooter={false}
      containerClassName="h-full"
      contentClassName="h-full px-0"
    >
      <div className="flex h-full relative">
        {/* Left Panel */}
        <div className="overflow-auto border-r" style={{ width: `${splitPosition}%` }}>
          <div className="p-4">{leftPanel}</div>
        </div>

        {/* Resizer */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 transition-colors',
            isDragging && 'bg-primary/30'
          )}
          style={{ left: `${splitPosition}%` }}
          onMouseDown={() => setIsDragging(true)}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right Panel */}
        <div className="flex-1 overflow-auto" style={{ width: `${100 - splitPosition}%` }}>
          <div className="p-4">{rightPanel}</div>
        </div>
      </div>
    </MainLayout>
  );
}
