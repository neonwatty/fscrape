import { useEffect, useRef, useState, useCallback } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  id: number;
  timestamp: number;
}

interface ChartTouchHandlers {
  onTap?: (point: TouchPoint) => void;
  onDoubleTap?: (point: TouchPoint) => void;
  onLongPress?: (point: TouchPoint) => void;
  onPanStart?: (point: TouchPoint) => void;
  onPan?: (delta: { dx: number; dy: number }, point: TouchPoint) => void;
  onPanEnd?: () => void;
  onPinchStart?: () => void;
  onPinch?: (scale: number, center: { x: number; y: number }) => void;
  onPinchEnd?: () => void;
}

interface UseChartTouchOptions extends ChartTouchHandlers {
  enabled?: boolean;
  doubleTapDelay?: number;
  longPressDelay?: number;
  tapThreshold?: number;
}

export function useChartTouch<T extends HTMLElement = HTMLElement>(
  elementRef: React.RefObject<T | null>,
  options: UseChartTouchOptions = {}
) {
  const {
    enabled = true,
    doubleTapDelay = 300,
    longPressDelay = 500,
    tapThreshold = 10,
    onTap,
    onDoubleTap,
    onLongPress,
    onPanStart,
    onPan,
    onPanEnd,
    onPinchStart,
    onPinch,
    onPinchEnd,
  } = options;

  const [activeGesture, setActiveGesture] = useState<'none' | 'tap' | 'pan' | 'pinch'>('none');
  const [touchPoints, setTouchPoints] = useState<TouchPoint[]>([]);

  const lastTapTime = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const panStartPoint = useRef<TouchPoint | null>(null);
  const pinchStartDistance = useRef<number | null>(null);
  const initialTouchPoint = useRef<TouchPoint | null>(null);

  // Calculate distance between two touch points
  const getDistance = (p1: Touch, p2: Touch) => {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getCenter = (p1: Touch, p2: Touch) => ({
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  });

  // Convert touch event to touch point
  const touchToPoint = (touch: Touch): TouchPoint => ({
    x: touch.clientX,
    y: touch.clientY,
    id: touch.identifier,
    timestamp: Date.now(),
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touches = Array.from(e.touches).map(touchToPoint);
      setTouchPoints(touches);

      // Single touch - potential tap, long press, or pan
      if (e.touches.length === 1) {
        const point = touches[0];
        initialTouchPoint.current = point;

        // Set up long press timer
        if (onLongPress) {
          longPressTimer.current = setTimeout(() => {
            if (activeGesture === 'tap') {
              onLongPress(point);
              setActiveGesture('none');
            }
          }, longPressDelay);
        }

        setActiveGesture('tap');
      }
      // Two touches - pinch gesture
      else if (e.touches.length === 2 && onPinch) {
        // Clear any existing timers
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        pinchStartDistance.current = getDistance(e.touches[0], e.touches[1]);
        setActiveGesture('pinch');
        onPinchStart?.();
      }
    },
    [enabled, onLongPress, longPressDelay, onPinch, onPinchStart, activeGesture]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touches = Array.from(e.touches).map(touchToPoint);
      setTouchPoints(touches);

      // Handle pan gesture
      if (e.touches.length === 1 && initialTouchPoint.current) {
        const currentPoint = touches[0];
        const dx = currentPoint.x - initialTouchPoint.current.x;
        const dy = currentPoint.y - initialTouchPoint.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Convert tap to pan if moved beyond threshold
        if (activeGesture === 'tap' && distance > tapThreshold) {
          // Clear long press timer
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }

          setActiveGesture('pan');
          panStartPoint.current = initialTouchPoint.current;
          onPanStart?.(panStartPoint.current);
        }

        // Continue panning
        if (activeGesture === 'pan' && panStartPoint.current) {
          onPan?.({ dx, dy }, currentPoint);
        }
      }
      // Handle pinch gesture
      else if (e.touches.length === 2 && activeGesture === 'pinch' && pinchStartDistance.current) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / pinchStartDistance.current;
        const center = getCenter(e.touches[0], e.touches[1]);

        onPinch?.(scale, center);
      }
    },
    [enabled, activeGesture, tapThreshold, onPanStart, onPan, onPinch]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const remainingTouches = Array.from(e.touches).map(touchToPoint);
      setTouchPoints(remainingTouches);

      // Handle tap or double tap
      if (activeGesture === 'tap' && initialTouchPoint.current) {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime.current;

        if (timeSinceLastTap < doubleTapDelay && onDoubleTap) {
          onDoubleTap(initialTouchPoint.current);
          lastTapTime.current = 0;
        } else if (onTap) {
          onTap(initialTouchPoint.current);
          lastTapTime.current = now;
        }
      }
      // End pan gesture
      else if (activeGesture === 'pan') {
        onPanEnd?.();
      }
      // End pinch gesture
      else if (activeGesture === 'pinch' && e.touches.length < 2) {
        onPinchEnd?.();
        pinchStartDistance.current = null;
      }

      // Reset if no more touches
      if (e.touches.length === 0) {
        setActiveGesture('none');
        initialTouchPoint.current = null;
        panStartPoint.current = null;
      }
    },
    [enabled, activeGesture, doubleTapDelay, onTap, onDoubleTap, onPanEnd, onPinchEnd]
  );

  const handleTouchCancel = useCallback(() => {
    // Clear all timers and reset state
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    setActiveGesture('none');
    setTouchPoints([]);
    initialTouchPoint.current = null;
    panStartPoint.current = null;
    pinchStartDistance.current = null;

    if (activeGesture === 'pan') {
      onPanEnd?.();
    } else if (activeGesture === 'pinch') {
      onPinchEnd?.();
    }
  }, [activeGesture, onPanEnd, onPinchEnd]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);

      // Clear any pending timers
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [elementRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    activeGesture,
    touchPoints,
    isInteracting: activeGesture !== 'none',
  };
}

// Hook for mobile-friendly tooltips
export function useMobileTooltip<T extends HTMLElement = HTMLElement>(
  elementRef: React.RefObject<T | null>,
  options: {
    enabled?: boolean;
    showDelay?: number;
    hideDelay?: number;
    followTouch?: boolean;
  } = {}
) {
  const {
    enabled: _enabled = true,
    showDelay = 100,
    hideDelay = 2000,
    followTouch = true,
  } = options;

  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState<unknown>(null);

  const showTimer = useRef<NodeJS.Timeout | null>(null);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = useCallback(
    (x: number, y: number, data: unknown) => {
      // Clear any existing timers
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }

      // Set position and content
      setTooltipPosition({ x, y });
      setContent(data);

      // Show after delay
      showTimer.current = setTimeout(() => {
        setIsVisible(true);

        // Auto-hide after hideDelay
        hideTimer.current = setTimeout(() => {
          setIsVisible(false);
        }, hideDelay);
      }, showDelay);
    },
    [showDelay, hideDelay]
  );

  const hideTooltip = useCallback(() => {
    // Clear timers
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    setIsVisible(false);
  }, []);

  const updatePosition = useCallback(
    (x: number, y: number) => {
      if (followTouch && isVisible) {
        setTooltipPosition({ x, y });
      }
    },
    [followTouch, isVisible]
  );

  useEffect(() => {
    return () => {
      // Cleanup timers on unmount
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return {
    tooltipPosition,
    isVisible,
    content,
    showTooltip,
    hideTooltip,
    updatePosition,
  };
}
