'use client';

import React, { useState, useRef } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { formatLargeNumber } from '@/lib/utils/formatters';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  [key: string]: string | number; // Allow additional data fields
}

export interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  lines?: {
    dataKey: string;
    name: string;
    color: string;
    strokeWidth?: number;
    type?: 'monotone' | 'linear' | 'step' | 'stepBefore' | 'stepAfter';
    dot?: boolean;
  }[];
  chartType?: 'line' | 'area';
  height?: number;
  showBrush?: boolean;
  brushHeight?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  xAxisKey?: string;
  yAxisDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  zoomEnabled?: boolean;
  onZoom?: (startIndex: number, endIndex: number) => void;
  referenceLines?: {
    y?: number;
    x?: string | number;
    label?: string;
    color?: string;
  }[];
  className?: string;
  customTooltip?: React.FC<{
    active?: boolean;
    payload?: Array<{ color?: string; fill?: string; name: string; value: number | string }>;
    label?: string;
  }>;
  gradientColors?: {
    id: string;
    startColor: string;
    endColor: string;
    startOpacity?: number;
    endOpacity?: number;
  }[];
}

interface ZoomState {
  refAreaLeft: string | null;
  refAreaRight: string | null;
  left: string | number | null;
  right: string | number | null;
  top: string | number | null;
  bottom: string | number | null;
  animation: boolean;
}

const DefaultTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; fill?: string; name: string; value: number | string }>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm mb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {formatLargeNumber(typeof entry.value === 'number' ? entry.value : 0)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function TimeSeriesChart({
  data,
  lines = [{ dataKey: 'value', name: 'Value', color: '#8884d8', strokeWidth: 2, dot: false }],
  chartType = 'line',
  height = 350,
  showBrush = true,
  brushHeight = 40,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  xAxisKey = 'date',
  yAxisDomain,
  zoomEnabled = true,
  onZoom,
  referenceLines = [],
  className = '',
  customTooltip,
  gradientColors = [],
}: TimeSeriesChartProps) {
  const [zoomState, setZoomState] = useState<ZoomState>({
    refAreaLeft: null,
    refAreaRight: null,
    left: null,
    right: null,
    top: null,
    bottom: null,
    animation: true,
  });

  const chartRef = useRef<any>(null);

  // Handle mouse down for zoom selection
  const handleMouseDown = (e: { activeLabel?: string }) => {
    if (!zoomEnabled || !e) return;
    const { activeLabel } = e;
    if (activeLabel) {
      setZoomState((prev) => ({
        ...prev,
        refAreaLeft: activeLabel,
        refAreaRight: activeLabel,
      }));
    }
  };

  // Handle mouse move for zoom selection
  const handleMouseMove = (e: { activeLabel?: string }) => {
    if (!zoomEnabled || !e || !zoomState.refAreaLeft) return;
    const { activeLabel } = e;
    if (activeLabel) {
      setZoomState((prev) => ({
        ...prev,
        refAreaRight: activeLabel,
      }));
    }
  };

  // Handle mouse up to complete zoom
  const handleMouseUp = () => {
    if (!zoomEnabled || !zoomState.refAreaLeft || !zoomState.refAreaRight) return;

    let left = zoomState.refAreaLeft;
    let right = zoomState.refAreaRight;

    if (left === right || !left || !right) {
      setZoomState((prev) => ({
        ...prev,
        refAreaLeft: null,
        refAreaRight: null,
      }));
      return;
    }

    // Swap if needed
    if (left > right) {
      [left, right] = [right, left];
    }

    // Find the indices for zoom
    const leftIndex = data.findIndex((item) => item[xAxisKey] === left);
    const rightIndex = data.findIndex((item) => item[xAxisKey] === right);

    if (onZoom && leftIndex !== -1 && rightIndex !== -1) {
      onZoom(leftIndex, rightIndex);
    }

    // Calculate Y axis bounds for zoom
    const zoomedData = data.slice(leftIndex, rightIndex + 1);
    const values = zoomedData
      .flatMap((item) => lines.map((line) => item[line.dataKey] as number))
      .filter((v) => v !== null && v !== undefined);

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const padding = (maxValue - minValue) * 0.1;

    setZoomState({
      refAreaLeft: null,
      refAreaRight: null,
      left,
      right,
      top: maxValue + padding,
      bottom: minValue - padding,
      animation: false,
    });
  };

  // Reset zoom
  const handleZoomOut = () => {
    setZoomState({
      refAreaLeft: null,
      refAreaRight: null,
      left: null,
      right: null,
      top: null,
      bottom: null,
      animation: true,
    });
  };

  // Render gradient definitions
  const renderGradients = () => {
    if (chartType !== 'area' || gradientColors.length === 0) return null;

    return (
      <defs>
        {gradientColors.map((gradient) => (
          <linearGradient key={gradient.id} id={gradient.id} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={gradient.startColor}
              stopOpacity={gradient.startOpacity ?? 0.8}
            />
            <stop
              offset="95%"
              stopColor={gradient.endColor}
              stopOpacity={gradient.endOpacity ?? 0}
            />
          </linearGradient>
        ))}
      </defs>
    );
  };

  // Render reference lines
  const renderReferenceLines = () => {
    return referenceLines.map((line, index) => (
      <ReferenceLine
        key={index}
        y={line.y}
        x={line.x}
        label={line.label}
        stroke={line.color || '#666'}
        strokeDasharray="3 3"
      />
    ));
  };

  const TooltipComponent = customTooltip || DefaultTooltip;
  const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

  return (
    <div className={`relative ${className}`}>
      {/* Zoom out button */}
      {zoomEnabled && zoomState.left && zoomState.right && (
        <button
          onClick={handleZoomOut}
          className="absolute top-2 right-2 z-10 px-3 py-1 text-xs font-medium bg-background border rounded-md hover:bg-muted transition-colors"
        >
          Reset Zoom
        </button>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent
          data={data}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          margin={{ top: 5, right: 5, left: 5, bottom: showBrush ? 0 : 5 }}
          ref={chartRef}
        >
          {renderGradients()}

          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
          )}

          <XAxis
            dataKey={xAxisKey}
            domain={[zoomState.left || 'dataMin', zoomState.right || 'dataMax']}
            className="text-xs"
            tick={{ fill: 'currentColor', fontSize: 11 }}
            tickMargin={8}
          />

          <YAxis
            domain={yAxisDomain || [zoomState.bottom || 'auto', zoomState.top || 'auto']}
            className="text-xs"
            tick={{ fill: 'currentColor', fontSize: 11 }}
            tickFormatter={(value) => formatLargeNumber(value)}
            tickMargin={8}
          />

          {showTooltip && <Tooltip content={<TooltipComponent />} />}
          {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}

          {chartType === 'area'
            ? lines.map((line) => (
                <Area
                  key={line.dataKey}
                  type={line.type || 'monotone'}
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth || 2}
                  fill={
                    gradientColors.find((g) => g.id === line.dataKey)
                      ? `url(#${line.dataKey})`
                      : line.color
                  }
                  fillOpacity={gradientColors.find((g) => g.id === line.dataKey) ? 1 : 0.1}
                  dot={line.dot ?? false}
                  animationDuration={zoomState.animation ? 300 : 0}
                />
              ))
            : lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type={line.type || 'monotone'}
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth || 2}
                  dot={line.dot ?? false}
                  animationDuration={zoomState.animation ? 300 : 0}
                />
              ))}

          {renderReferenceLines()}

          {/* Zoom selection area */}
          {zoomEnabled && zoomState.refAreaLeft && zoomState.refAreaRight && (
            <ReferenceArea
              x1={zoomState.refAreaLeft}
              x2={zoomState.refAreaRight}
              strokeOpacity={0.3}
              fill="#8884d8"
              fillOpacity={0.3}
            />
          )}

          {showBrush && (
            <Brush
              dataKey={xAxisKey}
              height={brushHeight}
              stroke="#8884d8"
              fill="#f0f0f0"
              fillOpacity={0.2}
              startIndex={
                zoomState.left
                  ? data.findIndex((item) => item[xAxisKey] === zoomState.left)
                  : undefined
              }
              endIndex={
                zoomState.right
                  ? data.findIndex((item) => item[xAxisKey] === zoomState.right)
                  : undefined
              }
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
