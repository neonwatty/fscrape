'use client';

import { useState, useRef, ReactNode, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Trash2, Archive, Star, MoreHorizontal, Check, X } from 'lucide-react';

interface SwipeAction {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: 'default' | 'primary' | 'destructive' | 'success' | 'warning';
  onClick: () => void | Promise<void>;
  confirmRequired?: boolean;
  confirmText?: string;
}

interface SwipeActionsProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  threshold?: number;
  maxSwipe?: number;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  className?: string;
  disabled?: boolean;
  hapticFeedback?: boolean;
}

export function SwipeActions({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 60,
  maxSwipe = 200,
  onSwipeStart,
  onSwipeEnd,
  className,
  disabled = false,
  hapticFeedback = true,
}: SwipeActionsProps) {
  const [activeAction, setActiveAction] = useState<SwipeAction | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<SwipeAction | null>(null);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  // Transform values for visual feedback
  const leftActionOpacity = useTransform(x, [0, threshold], [0, 1]);
  const rightActionOpacity = useTransform(x, [-threshold, 0], [1, 0]);
  const scale = useTransform(x, [-maxSwipe, 0, maxSwipe], [0.95, 1, 0.95]);

  // Trigger haptic feedback if available
  const triggerHaptic = useCallback(() => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, [hapticFeedback]);

  // Handle action execution
  const executeAction = useCallback(
    async (action: SwipeAction) => {
      if (action.confirmRequired && !confirmingAction) {
        setConfirmingAction(action);
        triggerHaptic();
        return;
      }

      try {
        await action.onClick();
        triggerHaptic();
      } catch (error) {
        console.error('Action failed:', error);
      } finally {
        setActiveAction(null);
        setConfirmingAction(null);
        x.set(0);
      }
    },
    [confirmingAction, x, triggerHaptic]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
      onSwipeStart?.();
    },
    [disabled, onSwipeStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;

      // Only swipe horizontally if horizontal movement is greater than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        e.preventDefault();
        setIsSwiping(true);

        // Apply resistance at the edges
        const resistedX =
          deltaX > 0
            ? Math.min(deltaX * (1 - deltaX / (maxSwipe * 2)), maxSwipe)
            : Math.max(deltaX * (1 + deltaX / (maxSwipe * 2)), -maxSwipe);

        x.set(resistedX);

        // Determine active action based on swipe distance
        if (resistedX > threshold && leftActions.length > 0) {
          const actionIndex = Math.min(
            Math.floor((resistedX - threshold) / 60),
            leftActions.length - 1
          );
          setActiveAction(leftActions[actionIndex]);
        } else if (resistedX < -threshold && rightActions.length > 0) {
          const actionIndex = Math.min(
            Math.floor((Math.abs(resistedX) - threshold) / 60),
            rightActions.length - 1
          );
          setActiveAction(rightActions[actionIndex]);
        } else {
          setActiveAction(null);
        }
      }
    },
    [disabled, touchStart, x, threshold, maxSwipe, leftActions, rightActions]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;

    setIsSwiping(false);
    onSwipeEnd?.();

    if (activeAction) {
      executeAction(activeAction);
    } else {
      // Snap back to center
      x.set(0);
    }
  }, [isSwiping, activeAction, x, executeAction, onSwipeEnd]);

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

  const getActionColor = (color?: string) => {
    switch (color) {
      case 'primary':
        return 'bg-primary text-primary-foreground';
      case 'destructive':
        return 'bg-destructive text-destructive-foreground';
      case 'success':
        return 'bg-green-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* Left actions */}
      {leftActions.length > 0 && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 flex items-center gap-2 px-4"
          style={{ opacity: leftActionOpacity }}
        >
          {leftActions.map((action) => (
            <div
              key={action.id}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg transition-colors',
                getActionColor(action.color),
                activeAction?.id === action.id && 'scale-110'
              )}
            >
              {action.icon}
              <span className="text-xs mt-1">{action.label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Right actions */}
      {rightActions.length > 0 && (
        <motion.div
          className="absolute right-0 top-0 bottom-0 flex items-center gap-2 px-4"
          style={{ opacity: rightActionOpacity }}
        >
          {rightActions.map((action) => (
            <div
              key={action.id}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg transition-colors',
                getActionColor(action.color),
                activeAction?.id === action.id && 'scale-110'
              )}
            >
              {action.icon}
              <span className="text-xs mt-1">{action.label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Swipeable content */}
      <motion.div
        style={{ x, scale }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative bg-background"
      >
        {children}
      </motion.div>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {confirmingAction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm z-50"
          >
            <div className="flex flex-col items-center gap-4 p-6 bg-card rounded-lg shadow-lg">
              <p className="text-sm text-center">
                {confirmingAction.confirmText ||
                  `Are you sure you want to ${confirmingAction.label}?`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    executeAction(confirmingAction);
                  }}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setConfirmingAction(null);
                    setActiveAction(null);
                    x.set(0);
                  }}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Preset swipe actions
export const SwipeActionPresets = {
  delete: (onClick: () => void): SwipeAction => ({
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-5 w-5" />,
    color: 'destructive',
    onClick,
    confirmRequired: true,
    confirmText: 'Are you sure you want to delete this item?',
  }),

  archive: (onClick: () => void): SwipeAction => ({
    id: 'archive',
    label: 'Archive',
    icon: <Archive className="h-5 w-5" />,
    color: 'default',
    onClick,
  }),

  favorite: (onClick: () => void): SwipeAction => ({
    id: 'favorite',
    label: 'Favorite',
    icon: <Star className="h-5 w-5" />,
    color: 'warning',
    onClick,
  }),

  more: (onClick: () => void): SwipeAction => ({
    id: 'more',
    label: 'More',
    icon: <MoreHorizontal className="h-5 w-5" />,
    color: 'default',
    onClick,
  }),
};

// List item with swipe actions
interface SwipeableListItemProps {
  children: ReactNode;
  onDelete?: () => void;
  onArchive?: () => void;
  onFavorite?: () => void;
  className?: string;
}

export function SwipeableListItem({
  children,
  onDelete,
  onArchive,
  onFavorite,
  className,
}: SwipeableListItemProps) {
  const leftActions: SwipeAction[] = [];
  const rightActions: SwipeAction[] = [];

  if (onFavorite) {
    leftActions.push(SwipeActionPresets.favorite(onFavorite));
  }

  if (onArchive) {
    rightActions.push(SwipeActionPresets.archive(onArchive));
  }

  if (onDelete) {
    rightActions.push(SwipeActionPresets.delete(onDelete));
  }

  return (
    <SwipeActions leftActions={leftActions} rightActions={rightActions} className={className}>
      {children}
    </SwipeActions>
  );
}
