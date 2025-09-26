'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useTouchGestures, useLongPress } from '@/lib/hooks/useTouchGestures';

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  swipeable?: boolean;
  pressable?: boolean;
  header?: React.ReactNode;
}

export function MobileCard({
  children,
  className,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  swipeable = false,
  pressable = false,
  header,
}: MobileCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useTouchGestures(cardRef, {
    enabled: swipeable,
    onSwipeLeft,
    onSwipeRight,
    threshold: 75,
    velocity: 0.5,
  });

  const longPressProps = useLongPress(
    () => {
      if (onLongPress) onLongPress();
    },
    {
      enabled: pressable,
      delay: 500,
    }
  );

  return (
    <Card
      ref={cardRef}
      className={cn(
        'relative overflow-hidden transition-all',
        'active:scale-[0.98] active:transition-transform',
        'tap-highlight-transparent',
        swipeable && 'cursor-grab active:cursor-grabbing',
        pressable && 'cursor-pointer',
        className
      )}
      {...(pressable ? longPressProps : {})}
    >
      {header && <CardHeader className="pb-3">{header}</CardHeader>}
      <CardContent className={cn(!header && 'pt-6')}>{children}</CardContent>
    </Card>
  );
}

// Mobile-optimized bottom sheet component
interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  height?: 'auto' | 'half' | 'full';
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  children,
  title,
  height = 'auto',
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useTouchGestures(sheetRef, {
    enabled: isOpen,
    onSwipeDown: onClose,
    threshold: 50,
  });

  if (!isOpen) return null;

  const heightClasses = {
    auto: 'max-h-[70vh]',
    half: 'h-1/2',
    full: 'h-full',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-background rounded-t-2xl',
          'animate-in slide-in-from-bottom',
          heightClasses[height],
          'overflow-hidden'
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-6 pb-4 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto scrolling-touch">{children}</div>
      </div>
    </>
  );
}

// Floating action button for mobile
interface FloatingActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  className?: string;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
}

export function FloatingActionButton({
  onClick,
  icon,
  className,
  position = 'bottom-right',
}: FloatingActionButtonProps) {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-6 left-6',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed z-30',
        positionClasses[position],
        'w-14 h-14 rounded-full',
        'bg-primary text-primary-foreground',
        'shadow-lg shadow-primary/25',
        'flex items-center justify-center',
        'active:scale-95 transition-transform',
        'tap-highlight-transparent',
        'pb-safe',
        className
      )}
      aria-label="Floating action button"
    >
      {icon}
    </button>
  );
}
