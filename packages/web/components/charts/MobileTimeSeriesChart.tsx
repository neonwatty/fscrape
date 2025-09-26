'use client';

import { useState, useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ReferenceLine,
} from 'recharts';
import { MobileChart, MobileChartControls } from './MobileChart';
import { MobileChartTooltip } from './MobileTooltip';
import { useChartTouch } from '@/lib/hooks/useTouch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  value: number;
  [key: string]: string | number;
}

interface MobileTimeSeriesChartProps {
  data: DataPoint[];
  title?: string;
  description?: string;
  dataKeys?: Array<{
    key: string;
    color: string;
    name: string;
  }>;
  height?: number;
  className?: string;
  showBrush?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  enableMobileOptimizations?: boolean;
}

export function MobileTimeSeriesChart({
  data,
  title,
  description,
  dataKeys = [{ key: 'value', color: '#8884d8', name: 'Value' }],
  height = 300,
  className,
  showBrush = false,
  showGrid = true,
  showLegend = false,
  enableMobileOptimizations = true,
}: MobileTimeSeriesChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panEnabled, setPanEnabled] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [_brushDomain, setBrushDomain] = useState<{
    startIndex?: number;
    endIndex?: number;
  } | null>(null);

  // Detect if mobile device
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Use touch gestures for chart interaction
  const { activeGesture } = useChartTouch(chartRef, {
    enabled: enableMobileOptimizations && isMobile,
    onTap: (point) => {
      // Find nearest data point on tap
      const chartWidth = chartRef.current?.offsetWidth || 0;
      const dataIndex = Math.round((point.x / chartWidth) * data.length);
      if (data[dataIndex]) {
        setSelectedPoint(data[dataIndex]);
      }
    },
    onDoubleTap: () => {
      // Reset zoom on double tap
      setZoomLevel(1);
      setBrushDomain(null);
    },
    onPinch: (scale) => {
      setZoomLevel(scale);
    },
  });

  // Optimize data for mobile display
  const optimizedData = useMemo(() => {
    if (!enableMobileOptimizations || !isMobile) return data;

    // Reduce data points for better performance on mobile
    const maxPoints = 50;
    if (data.length <= maxPoints) return data;

    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0);
  }, [data, enableMobileOptimizations, isMobile]);

  // Format tick for mobile
  const formatXAxisTick = (tickItem: string) => {
    if (!isMobile) return tickItem;

    try {
      const date = new Date(tickItem);
      return format(date, 'MM/dd');
    } catch {
      return tickItem;
    }
  };

  // Mobile-optimized chart configuration
  const chartMargin = isMobile
    ? { top: 5, right: 5, left: -20, bottom: 5 }
    : { top: 10, right: 30, left: 0, bottom: 10 };

  const tickStyle = isMobile ? { fontSize: 10, fill: '#666' } : { fontSize: 12, fill: '#666' };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {(title || description) && (
        <CardHeader className={cn(isMobile && 'pb-2')}>
          {title && <CardTitle className={cn(isMobile && 'text-base')}>{title}</CardTitle>}
          {description && (
            <p className={cn('text-sm text-muted-foreground', isMobile && 'text-xs')}>
              {description}
            </p>
          )}
        </CardHeader>
      )}

      <CardContent className={cn('p-0', isMobile && 'pb-2')}>
        <div ref={chartRef}>
          <MobileChart
            height={height}
            enableZoom={enableMobileOptimizations}
            enablePan={panEnabled}
            enableGestures={enableMobileOptimizations}
            onZoomChange={setZoomLevel}
            className="relative"
          >
            <LineChart data={optimizedData} margin={chartMargin}>
              {showGrid && (
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" strokeOpacity={0.3} />
              )}

              <XAxis
                dataKey="date"
                tick={tickStyle}
                tickFormatter={formatXAxisTick}
                interval={isMobile ? 'preserveStartEnd' : 'preserveStart'}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 50 : 30}
              />

              <YAxis
                tick={tickStyle}
                width={isMobile ? 35 : 60}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                  return value.toString();
                }}
              />

              <Tooltip
                content={enableMobileOptimizations && isMobile ? <MobileChartTooltip /> : undefined}
                cursor={{ strokeDasharray: '3 3' }}
              />

              {showLegend && !isMobile && (
                <Legend verticalAlign="top" height={36} iconType="line" />
              )}

              {dataKeys.map((dataKey) => (
                <Line
                  key={dataKey.key}
                  type="monotone"
                  dataKey={dataKey.key}
                  stroke={dataKey.color}
                  name={dataKey.name}
                  strokeWidth={isMobile ? 2 : 3}
                  dot={!isMobile}
                  activeDot={isMobile ? { r: 6 } : { r: 8 }}
                />
              ))}

              {selectedPoint && (
                <ReferenceLine
                  x={selectedPoint.date}
                  stroke="#ff0000"
                  strokeDasharray="3 3"
                  label={{
                    value: `Selected: ${selectedPoint.value}`,
                    position: 'top',
                    style: { fontSize: 12, fill: '#ff0000' },
                  }}
                />
              )}

              {showBrush && !isMobile && (
                <Brush
                  dataKey="date"
                  height={30}
                  stroke="#8884d8"
                  onChange={(domain: { startIndex?: number; endIndex?: number } | null) =>
                    setBrushDomain(domain)
                  }
                />
              )}
            </LineChart>
          </MobileChart>
        </div>

        {/* Mobile controls */}
        {enableMobileOptimizations && isMobile && (
          <div className="px-4 py-2 border-t">
            <MobileChartControls
              onZoomIn={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
              onZoomOut={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              onReset={() => {
                setZoomLevel(1);
                setSelectedPoint(null);
                setBrushDomain(null);
              }}
              onTogglePan={() => setPanEnabled(!panEnabled)}
              isPanEnabled={panEnabled}
              className="justify-center"
            />

            {/* Legend for mobile */}
            {showLegend && (
              <div className="flex items-center justify-center gap-4 mt-2">
                {dataKeys.map((dataKey) => (
                  <div key={dataKey.key} className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: dataKey.color }}
                    />
                    <span className="text-xs text-muted-foreground">{dataKey.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gesture indicator */}
        {activeGesture !== 'none' && (
          <div className="absolute top-2 left-2 bg-primary/10 rounded px-2 py-1">
            <span className="text-xs font-medium capitalize">{activeGesture}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
