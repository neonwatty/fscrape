'use client';

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
  className?: string;
  refreshText?: string;
  pullingText?: string;
  releaseText?: string;
  loadingText?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  maxPull = 150,
  disabled = false,
  className,
  refreshText = 'Pull to refresh',
  pullingText = 'Pull down to refresh',
  releaseText = 'Release to refresh',
  loadingText = 'Refreshing...',
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [canRefresh, setCanRefresh] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Motion values for smooth animations
  const pullY = useMotionValue(0);
  const _pullProgress = useTransform(pullY, [0, threshold], [0, 1]);
  const pullOpacity = useTransform(pullY, [0, threshold / 2], [0, 1]);
  const iconRotation = useTransform(pullY, [0, threshold], [0, 180]);

  // Check if we're at the top of the scrollable area
  const isAtTop = useCallback(() => {
    if (!contentRef.current) return true;

    // Check if any parent element is scrollable and not at top
    let element = contentRef.current.parentElement;
    while (element) {
      if (element.scrollTop > 0) {
        return false;
      }
      element = element.parentElement;
    }

    // Check window scroll
    return window.scrollY === 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;

      const touch = e.touches[0];
      setTouchStart(touch.clientY);

      if (isAtTop()) {
        setIsPulling(true);
      }
    },
    [disabled, isRefreshing, isAtTop]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || disabled || isRefreshing) return;

      const touch = e.touches[0];
      const distance = touch.clientY - touchStart;

      if (distance > 0 && isAtTop()) {
        e.preventDefault();

        // Apply resistance as we pull further
        const resistedDistance = Math.min(distance * (1 - distance / (maxPull * 2)), maxPull);

        setPullDistance(resistedDistance);
        pullY.set(resistedDistance);

        // Check if we've passed the threshold
        setCanRefresh(resistedDistance >= threshold);
      } else if (distance <= 0) {
        // User is scrolling up, cancel pull
        setIsPulling(false);
        setPullDistance(0);
        pullY.set(0);
        setCanRefresh(false);
      }
    },
    [isPulling, disabled, isRefreshing, touchStart, isAtTop, maxPull, threshold, pullY]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (canRefresh && !isRefreshing) {
      setIsRefreshing(true);

      // Keep the indicator visible while refreshing
      setPullDistance(threshold);
      pullY.set(threshold);

      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        pullY.set(0);
        setCanRefresh(false);
      }
    } else {
      // Snap back if threshold not reached
      setPullDistance(0);
      pullY.set(0);
      setCanRefresh(false);
    }
  }, [isPulling, canRefresh, isRefreshing, threshold, onRefresh, pullY]);

  // Add touch event listeners
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Determine status text
  const getStatusText = () => {
    if (isRefreshing) return loadingText;
    if (canRefresh) return releaseText;
    if (isPulling) return pullingText;
    return refreshText;
  };

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* Pull indicator */}
      <AnimatePresence>
        {(isPulling || isRefreshing) && (
          <motion.div
            className="absolute top-0 left-0 right-0 flex items-center justify-center bg-background/80 backdrop-blur-sm border-b z-40"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: pullDistance,
              opacity: pullOpacity.get(),
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="flex flex-col items-center gap-2 text-sm">
              <motion.div
                animate={{ rotate: isRefreshing ? 360 : iconRotation.get() }}
                transition={
                  isRefreshing
                    ? {
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear',
                      }
                    : {}
                }
              >
                {isRefreshing ? (
                  <RefreshCw className="h-5 w-5" />
                ) : (
                  <ChevronDown
                    className={cn('h-5 w-5 transition-transform', canRefresh && 'rotate-180')}
                  />
                )}
              </motion.div>
              <span className="text-muted-foreground">{getStatusText()}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        ref={contentRef}
        style={{ y: pullY }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Hook for programmatic refresh
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh]);

  return { refresh, isRefreshing };
}

// Simplified pull-to-refresh for specific containers
interface SimplePullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function SimplePullToRefresh({ onRefresh, children, className }: SimplePullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullY, setPullY] = useState(0);

  const handleStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setStartY(touch.clientY);
  };

  const handleMove = (e: React.TouchEvent) => {
    if (refreshing) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - startY;

    if (deltaY > 0 && window.scrollY === 0) {
      e.preventDefault();
      setPullY(Math.min(deltaY * 0.5, 100));
    }
  };

  const handleEnd = async () => {
    if (pullY > 60 && !refreshing) {
      setRefreshing(true);
      setPullY(60);

      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  };

  return (
    <div
      className={cn('relative touch-pan-y', className)}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      {(pullY > 0 || refreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-primary/10"
          style={{ height: pullY }}
        >
          <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
        </div>
      )}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: pullY === 0 ? 'transform 0.2s' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
