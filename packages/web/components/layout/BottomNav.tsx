'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, FileText, BarChart3, GitCompare, Menu } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTouchGestures } from '@/lib/hooks/useTouchGestures';

const navigationItems = [
  { name: 'Home', href: '/', icon: Home, label: 'Dashboard' },
  { name: 'Posts', href: '/posts', icon: FileText, label: 'Posts' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { name: 'Compare', href: '/compare', icon: GitCompare, label: 'Compare' },
];

interface BottomNavProps {
  onMenuClick?: () => void;
  className?: string;
}

export function BottomNav({ onMenuClick, className }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  // Update active index based on current pathname
  useEffect(() => {
    const index = navigationItems.findIndex((item) => item.href === pathname);
    if (index !== -1) {
      setActiveIndex(index);
    }
  }, [pathname]);

  // Add swipe gestures for navigation
  useTouchGestures(navRef, {
    onSwipeLeft: () => {
      const nextIndex = Math.min(activeIndex + 1, navigationItems.length - 1);
      if (nextIndex !== activeIndex) {
        router.push(navigationItems[nextIndex].href);
      }
    },
    onSwipeRight: () => {
      const prevIndex = Math.max(activeIndex - 1, 0);
      if (prevIndex !== activeIndex) {
        router.push(navigationItems[prevIndex].href);
      }
    },
    threshold: 75,
    velocity: 0.3,
  });

  const handleNavClick = (href: string, index: number) => {
    setActiveIndex(index);
    router.push(href);
  };

  return (
    <nav
      ref={navRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-t',
        'md:hidden', // Only show on mobile
        'pb-safe', // Safe area for iOS
        className
      )}
    >
      <div className="flex items-center justify-around h-16">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <button
              key={item.name}
              onClick={() => handleNavClick(item.href, index)}
              className={cn(
                'flex flex-col items-center justify-center',
                'w-full h-full',
                'relative group',
                'tap-highlight-transparent',
                'transition-all duration-200',
                'active:scale-95'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
              )}

              {/* Icon with animation */}
              <div
                className={cn(
                  'relative flex items-center justify-center',
                  'w-6 h-6 mb-1',
                  'transition-all duration-200',
                  isActive && 'scale-110'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5',
                    'transition-colors duration-200',
                    isActive ? 'text-primary' : 'text-muted-foreground group-active:text-primary/70'
                  )}
                />
                {/* Badge for notifications (example) */}
                {item.name === 'Posts' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-[10px] font-medium',
                  'transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>

              {/* Ripple effect on tap */}
              <span className="absolute inset-0 rounded-lg group-active:bg-primary/10 transition-colors" />
            </button>
          );
        })}

        {/* Menu button for additional options */}
        <button
          onClick={onMenuClick}
          className={cn(
            'flex flex-col items-center justify-center',
            'w-full h-full',
            'relative group',
            'tap-highlight-transparent',
            'transition-all duration-200',
            'active:scale-95'
          )}
          aria-label="More options"
        >
          <div className="w-6 h-6 mb-1 flex items-center justify-center">
            <Menu className="w-5 h-5 text-muted-foreground group-active:text-primary/70" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">More</span>
          <span className="absolute inset-0 rounded-lg group-active:bg-primary/10 transition-colors" />
        </button>
      </div>

      {/* Optional gesture hint */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 pointer-events-none">
        <div className="bg-foreground/10 text-foreground/60 text-xs px-2 py-1 rounded">
          Swipe to navigate
        </div>
      </div>
    </nav>
  );
}

// Bottom navigation with page indicators for swipe navigation
export function BottomNavWithIndicator({ className }: { className?: string }) {
  const pathname = usePathname();
  const activeIndex = navigationItems.findIndex((item) => item.href === pathname);

  return (
    <div className={cn('fixed bottom-0 left-0 right-0 z-40', className)}>
      {/* Page indicators */}
      <div className="flex justify-center items-center gap-1.5 pb-2">
        {navigationItems.map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-1 rounded-full transition-all duration-300',
              index === activeIndex ? 'w-6 bg-primary' : 'w-1 bg-muted-foreground/30'
            )}
          />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
