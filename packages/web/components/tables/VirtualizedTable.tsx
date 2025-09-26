'use client';

import { useRef, useCallback, memo, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Generic type for table data
export interface VirtualizedTableProps<T = any> {
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    width?: number | string;
    render?: (item: T) => React.ReactNode;
    className?: string;
  }>;
  rowHeight?: number;
  overscan?: number;
  className?: string;
  containerHeight?: number | string;
  onRowClick?: (item: T, index: number) => void;
  getRowId?: (item: T, index: number) => string;
  loading?: boolean;
  emptyMessage?: string;
  estimateSize?: (index: number) => number;
  enableHorizontalScroll?: boolean;
  stickyHeader?: boolean;
}

// Row component with memo for performance
const VirtualRow = memo(function VirtualRow({
  item,
  columns,
  onRowClick,
  style,
  index,
}: {
  item: any;
  columns: VirtualizedTableProps<any>['columns'];
  onRowClick?: VirtualizedTableProps<any>['onRowClick'];
  style: React.CSSProperties;
  index: number;
}) {
  const handleClick = useCallback(() => {
    if (onRowClick) {
      onRowClick(item, index);
    }
  }, [item, index, onRowClick]);

  return (
    <div
      style={style}
      className={cn(
        'flex items-center border-b border-border hover:bg-muted/50 transition-colors',
        onRowClick && 'cursor-pointer'
      )}
      onClick={handleClick}
      role="row"
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={cn('px-4 py-2 truncate', column.className)}
          style={{
            width: column.width || `${100 / columns.length}%`,
            minWidth: column.width,
          }}
        >
          {column.render ? column.render(item) : String((item as any)[column.key] || '')}
        </div>
      ))}
    </div>
  );
});

/**
 * High-performance virtualized table component
 * Capable of rendering thousands of rows efficiently
 */
export function VirtualizedTable<T = any>({
  data,
  columns,
  rowHeight = 48,
  overscan = 10,
  className,
  containerHeight = 600,
  onRowClick,
  getRowId,
  loading = false,
  emptyMessage = 'No data available',
  estimateSize,
  enableHorizontalScroll = false,
  stickyHeader = true,
}: VirtualizedTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // Calculate scrollbar width
  useEffect(() => {
    const scrollDiv = document.createElement('div');
    scrollDiv.style.cssText =
      'width: 100px; height: 100px; overflow: scroll; position: absolute; top: -9999px;';
    document.body.appendChild(scrollDiv);
    const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
    document.body.removeChild(scrollDiv);
    setScrollbarWidth(scrollbarWidth);
  }, []);

  // Virtual row renderer
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => containerRef.current,
    estimateSize: estimateSize || (() => rowHeight),
    overscan,
    getItemKey: getRowId ? (index) => getRowId(data[index], index) : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Calculate padding for virtual scrolling
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - (virtualItems[virtualItems.length - 1]?.end || 0) : 0;

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-muted-foreground">Loading data...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('relative border rounded-lg', className)}>
      {/* Header */}
      <div
        className={cn(
          'flex border-b bg-muted/30 font-medium',
          stickyHeader && 'sticky top-0 z-10',
          enableHorizontalScroll && 'overflow-x-auto'
        )}
        style={{ paddingRight: scrollbarWidth }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn('px-4 py-3 text-sm', column.className)}
            style={{
              width: column.width || `${100 / columns.length}%`,
              minWidth: column.width,
            }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Virtual scrolling container */}
      <div
        ref={containerRef}
        className={cn(
          'overflow-auto',
          enableHorizontalScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
        )}
        style={{
          height: typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight,
        }}
      >
        {/* Virtual spacer for top padding */}
        {paddingTop > 0 && <div style={{ height: paddingTop }} />}

        {/* Render only visible rows */}
        {virtualItems.map((virtualRow) => {
          const item = data[virtualRow.index];
          return (
            <VirtualRow
              key={virtualRow.key}
              item={item}
              columns={columns}
              onRowClick={onRowClick}
              index={virtualRow.index}
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start - paddingTop}px)`,
              }}
            />
          );
        })}

        {/* Virtual spacer for bottom padding */}
        {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
      </div>

      {/* Row count indicator */}
      <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
        <span>
          Showing {virtualItems.length} of {data.length.toLocaleString()} rows
        </span>
        <span className="text-xs">
          Rendered: {virtualItems[0]?.index ?? 0 + 1} -{' '}
          {(virtualItems[virtualItems.length - 1]?.index ?? 0) + 1}
        </span>
      </div>
    </div>
  );
}

/**
 * Windowed table using react-window for comparison
 * Alternative implementation using react-window library
 */
export { WindowedTable } from './WindowedTable';

// Export utility types
export type { VirtualizedTableColumn } from './types';

// Performance monitoring component
export function VirtualTablePerformance({
  rowCount,
  visibleCount,
}: {
  rowCount: number;
  visibleCount: number;
}) {
  const efficiency = ((visibleCount / rowCount) * 100).toFixed(2);
  const memorySaved = ((1 - visibleCount / rowCount) * 100).toFixed(0);

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span>Total: {rowCount.toLocaleString()}</span>
      <span>Visible: {visibleCount}</span>
      <span>Efficiency: {efficiency}%</span>
      <span>Memory saved: ~{memorySaved}%</span>
    </div>
  );
}

// Export enhanced version with built-in features
export function EnhancedVirtualizedTable<T = any>(
  props: VirtualizedTableProps<T> & {
    enableSearch?: boolean;
    enableSort?: boolean;
    enableFilter?: boolean;
    showPerformanceStats?: boolean;
  }
) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, _setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Filter and sort data
  let processedData = [...props.data];

  // Apply search
  if (props.enableSearch && searchTerm) {
    processedData = processedData.filter((item) =>
      Object.values(item as any).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }

  // Apply sort
  if (props.enableSort && sortConfig) {
    processedData.sort((a, b) => {
      const aValue = (a as any)[sortConfig.key];
      const bValue = (b as any)[sortConfig.key];

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      {(props.enableSearch || props.enableSort) && (
        <div className="flex items-center gap-4">
          {props.enableSearch && (
            <input
              type="text"
              placeholder="Search..."
              className="px-3 py-1 border rounded"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          )}
        </div>
      )}

      {/* Table */}
      <VirtualizedTable {...props} data={processedData} />

      {/* Performance stats */}
      {props.showPerformanceStats && (
        <VirtualTablePerformance
          rowCount={props.data.length}
          visibleCount={Math.ceil(
            ((props.containerHeight as number) || 600) / (props.rowHeight || 48)
          )}
        />
      )}
    </div>
  );
}
