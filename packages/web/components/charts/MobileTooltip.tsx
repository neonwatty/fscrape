'use client';

import { ReactNode, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  children: ReactNode;
  className?: string;
  offset?: { x: number; y: number };
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  followCursor?: boolean;
  showArrow?: boolean;
}

export function MobileTooltip({
  visible,
  x,
  y,
  children,
  className,
  offset = { x: 0, y: -10 },
  placement = 'auto',
  followCursor = false,
  showArrow = true,
}: MobileTooltipProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [actualPlacement, setActualPlacement] = useState(placement);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Calculate tooltip position based on viewport
    const calculatePosition = () => {
      const padding = 10;
      const tooltipWidth = 200; // Estimated width
      const tooltipHeight = 80; // Estimated height

      let newX = x + offset.x;
      let newY = y + offset.y;
      let newPlacement = placement;

      if (placement === 'auto') {
        // Determine best placement based on available space
        const viewportWidth = window.innerWidth;
        const _viewportHeight = window.innerHeight;

        // Check horizontal space
        if (x + tooltipWidth + padding > viewportWidth) {
          newX = x - tooltipWidth - offset.x;
          newPlacement = 'left';
        } else if (x - tooltipWidth - padding < 0) {
          newX = x + offset.x;
          newPlacement = 'right';
        }

        // Check vertical space
        if (y - tooltipHeight - padding < 0) {
          newY = y + tooltipHeight + Math.abs(offset.y);
          newPlacement = 'bottom';
        } else {
          newY = y - tooltipHeight - Math.abs(offset.y);
          newPlacement = 'top';
        }
      } else {
        // Manual placement
        switch (placement) {
          case 'top':
            newY = y - tooltipHeight - Math.abs(offset.y);
            break;
          case 'bottom':
            newY = y + Math.abs(offset.y);
            break;
          case 'left':
            newX = x - tooltipWidth - Math.abs(offset.x);
            break;
          case 'right':
            newX = x + Math.abs(offset.x);
            break;
        }
      }

      // Ensure tooltip stays within viewport
      newX = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, newX));
      newY = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, newY));

      setPosition({ x: newX, y: newY });
      setActualPlacement(newPlacement);
    };

    calculatePosition();

    if (followCursor) {
      window.addEventListener('resize', calculatePosition);
      return () => window.removeEventListener('resize', calculatePosition);
    }
  }, [x, y, offset, placement, visible, followCursor]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={cn(
            'fixed z-50 pointer-events-none',
            'bg-popover text-popover-foreground',
            'rounded-lg shadow-lg border',
            'px-3 py-2 text-sm',
            className
          )}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          {children}

          {/* Arrow indicator */}
          {showArrow && (
            <div
              className={cn(
                'absolute w-2 h-2 bg-popover border rotate-45',
                actualPlacement === 'top' &&
                  'bottom-[-5px] left-1/2 -translate-x-1/2 border-t-0 border-l-0',
                actualPlacement === 'bottom' &&
                  'top-[-5px] left-1/2 -translate-x-1/2 border-b-0 border-r-0',
                actualPlacement === 'left' &&
                  'right-[-5px] top-1/2 -translate-y-1/2 border-l-0 border-b-0',
                actualPlacement === 'right' &&
                  'left-[-5px] top-1/2 -translate-y-1/2 border-r-0 border-t-0'
              )}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// Recharts-compatible mobile tooltip
export function MobileChartTooltip({
  active,
  payload,
  label,
  coordinate,
  className,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number | string }>;
  label?: string;
  coordinate?: { x: number; y: number };
  className?: string;
}) {
  const [touchPoint, setTouchPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (active && coordinate) {
      setTouchPoint({ x: coordinate.x, y: coordinate.y });
    }
  }, [active, coordinate]);

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <MobileTooltip
      visible={active}
      x={touchPoint?.x || coordinate?.x || 0}
      y={touchPoint?.y || coordinate?.y || 0}
      className={className}
      placement="auto"
      followCursor={false}
    >
      <div className="space-y-1">
        {label && <p className="font-medium text-xs text-muted-foreground">{label}</p>}
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs">{entry.name}:</span>
            </span>
            <span className="text-xs font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    </MobileTooltip>
  );
}

// Touch-friendly tooltip trigger component
export function TouchTooltipTrigger({
  children,
  content,
  className,
  delay = 100,
}: {
  children: ReactNode;
  content: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouch = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    setPosition({ x: touch.clientX, y: touch.clientY });

    // Show tooltip after delay
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    // Hide after 3 seconds
    setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  };

  const handleTouchEnd = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return (
    <>
      <div onTouchStart={handleTouch} onTouchEnd={handleTouchEnd} className={className}>
        {children}
      </div>
      <MobileTooltip visible={isVisible} x={position.x} y={position.y} placement="auto">
        {content}
      </MobileTooltip>
    </>
  );
}
