import { useEffect, useRef, useState, useCallback } from 'react';

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface TouchGestureOptions extends SwipeHandlers {
  threshold?: number; // Minimum distance for swipe detection (default: 50px)
  velocity?: number; // Minimum velocity for swipe (default: 0.3)
  enabled?: boolean; // Enable/disable gesture detection
}

export function useTouchGestures<T extends HTMLElement = HTMLElement>(
  elementRef: React.RefObject<T | null>,
  options: TouchGestureOptions = {}
) {
  const {
    threshold = 50,
    velocity = 0.3,
    enabled = true,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  } = options;

  const [isSwiping, setIsSwiping] = useState(false);
  const touchStart = useRef<TouchPosition | null>(null);
  const touchEnd = useRef<TouchPosition | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchEnd.current = null;
      setIsSwiping(true);
    },
    [enabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchStart.current) return;

      const touch = e.touches[0];
      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    [enabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !touchStart.current || !touchEnd.current) {
      setIsSwiping(false);
      return;
    }

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const deltaTime = touchEnd.current.time - touchStart.current.time;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Calculate velocity
    const velocityX = absX / deltaTime;
    const velocityY = absY / deltaTime;

    // Determine if it's a valid swipe
    const isValidSwipe =
      (absX > threshold || absY > threshold) && (velocityX > velocity || velocityY > velocity);

    if (isValidSwipe) {
      // Horizontal swipe
      if (absX > absY) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      }
      // Vertical swipe
      else {
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    // Reset
    touchStart.current = null;
    touchEnd.current = null;
    setIsSwiping(false);
  }, [enabled, threshold, velocity, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isSwiping };
}

// Hook for pinch-to-zoom gestures
export function usePinchZoom<T extends HTMLElement = HTMLElement>(
  elementRef: React.RefObject<T | null>,
  options: {
    minScale?: number;
    maxScale?: number;
    enabled?: boolean;
    onZoom?: (scale: number) => void;
  } = {}
) {
  const { minScale = 0.5, maxScale = 3, enabled = true, onZoom } = options;
  const [scale, setScale] = useState(1);
  const initialDistance = useRef<number | null>(null);
  const currentScale = useRef(1);

  const getDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;

    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || e.touches.length !== 2) return;

      initialDistance.current = getDistance(e.touches);
    },
    [enabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || e.touches.length !== 2 || !initialDistance.current) return;

      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const newScale = Math.min(
        Math.max((currentDistance / initialDistance.current) * currentScale.current, minScale),
        maxScale
      );

      setScale(newScale);
      onZoom?.(newScale);
    },
    [enabled, minScale, maxScale, onZoom]
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;

    currentScale.current = scale;
    initialDistance.current = null;
  }, [enabled, scale]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    scale,
    resetScale: () => {
      setScale(1);
      currentScale.current = 1;
    },
  };
}

// Hook for long press detection
export function useLongPress(
  callback: () => void,
  options: {
    delay?: number;
    enabled?: boolean;
  } = {}
) {
  const { delay = 500, enabled = true } = options;
  const [isLongPressing, setIsLongPressing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    if (!enabled) return;

    setIsLongPressing(true);
    timeoutRef.current = setTimeout(() => {
      callback();
      setIsLongPressing(false);
    }, delay);
  }, [callback, delay, enabled]);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLongPressing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onTouchStart: enabled ? start : undefined,
    onTouchEnd: enabled ? stop : undefined,
    onTouchCancel: enabled ? stop : undefined,
    onMouseDown: enabled ? start : undefined,
    onMouseUp: enabled ? stop : undefined,
    onMouseLeave: enabled ? stop : undefined,
    isLongPressing,
  };
}
