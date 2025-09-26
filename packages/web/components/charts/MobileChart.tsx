'use client';

import { ReactElement, useRef, useState, useEffect } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { usePinchZoom, useTouchGestures } from '@/lib/hooks/useTouchGestures';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface MobileChartProps {
  children: ReactElement;
  className?: string;
  height?: number | string;
  minHeight?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableGestures?: boolean;
  onPanStart?: () => void;
  onPanEnd?: () => void;
  onZoomChange?: (scale: number) => void;
}

export function MobileChart({
  children,
  className,
  height = 300,
  minHeight = 200,
  enableZoom = true,
  enablePan = true,
  enableGestures = true,
  onPanStart,
  onPanEnd,
  onZoomChange,
}: MobileChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);

  // Use pinch-to-zoom hook
  const { scale, resetScale } = usePinchZoom(containerRef, {
    enabled: enableGestures && enableZoom,
    minScale: 0.5,
    maxScale: 3,
    onZoom: (newScale) => {
      setZoomLevel(newScale);
      onZoomChange?.(newScale);
    },
  });

  // Use swipe gestures for navigation
  const { isSwiping } = useTouchGestures(containerRef, {
    enabled: enableGestures && !isPanning,
    threshold: 30,
    velocity: 0.2,
  });

  // Touch handlers for panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enablePan || e.touches.length !== 1) return;

    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setIsPanning(true);
    onPanStart?.();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enablePan || !touchStartPos || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPos.x;
    const deltaY = touch.clientY - touchStartPos.y;

    setPanOffset((prev) => ({
      x: prev.x + deltaX,
      y: Math.max(-100, Math.min(100, prev.y + deltaY)), // Limit vertical panning
    }));

    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setTouchStartPos(null);
    setIsPanning(false);
    onPanEnd?.();
  };

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(3, zoomLevel + 0.25);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoomLevel - 0.25);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    resetScale();
    onZoomChange?.(1);
  };

  // Detect if device is touch-enabled
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Zoom Controls */}
      {enableZoom && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleResetView}
            aria-label="Reset view"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Pan indicator */}
      {isPanning && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-primary/10 backdrop-blur-sm rounded-lg px-3 py-1">
          <Move className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-medium">Panning</span>
        </div>
      )}

      {/* Touch hint for mobile users */}
      {isTouchDevice && enableGestures && (
        <div className="absolute bottom-2 left-2 right-2 z-10 text-center">
          <p className="text-xs text-muted-foreground bg-background/60 backdrop-blur-sm rounded px-2 py-1 inline-block">
            Pinch to zoom • Drag to pan
          </p>
        </div>
      )}

      {/* Chart Container */}
      <div
        ref={containerRef}
        className={cn(
          'touch-none select-none',
          isPanning && 'cursor-move',
          isSwiping && 'pointer-events-none'
        )}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${enableGestures ? scale : zoomLevel})`,
          transformOrigin: 'center',
          transition: isPanning ? 'none' : 'transform 0.2s ease-out',
          minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Mobile-optimized chart controls component
export function MobileChartControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onTogglePan,
  isPanEnabled = false,
  className,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onTogglePan?: () => void;
  isPanEnabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1">
        <Button variant="ghost" size="sm" onClick={onZoomIn} className="h-7 px-2">
          <ZoomIn className="h-4 w-4 mr-1" />
          <span className="text-xs">Zoom In</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onZoomOut} className="h-7 px-2">
          <ZoomOut className="h-4 w-4 mr-1" />
          <span className="text-xs">Zoom Out</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2">
          <Maximize2 className="h-4 w-4 mr-1" />
          <span className="text-xs">Reset</span>
        </Button>
        {onTogglePan && (
          <Button
            variant={isPanEnabled ? 'default' : 'ghost'}
            size="sm"
            onClick={onTogglePan}
            className="h-7 px-2"
          >
            <Move className="h-4 w-4 mr-1" />
            <span className="text-xs">Pan</span>
          </Button>
        )}
      </div>
    </div>
  );
}
