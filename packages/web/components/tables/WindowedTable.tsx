'use client';

import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface WindowedTableProps<T = any> {
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    width?: number | string;
    render?: (item: T) => React.ReactNode;
  }>;
  height?: number;
  rowHeight?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
}

// Memoized row component for react-window v2
const Row = memo(function Row({ index, style, items, columns, onRowClick }: any) {
  const item = items[index];

  return (
    <div
      style={style}
      className={cn(
        'flex items-center border-b hover:bg-muted/50 transition-colors',
        onRowClick && 'cursor-pointer'
      )}
      onClick={() => onRowClick?.(item, index)}
    >
      {columns.map((column: any) => (
        <div
          key={column.key}
          className="px-4 py-2 truncate"
          style={{
            width: column.width || `${100 / columns.length}%`,
          }}
        >
          {column.render ? column.render(item) : String((item as any)[column.key] || '')}
        </div>
      ))}
    </div>
  );
});

/**
 * Alternative virtual table implementation using react-window
 * Better for fixed-height rows
 */
export function WindowedTable<T = any>({
  data,
  columns,
  height = 600,
  rowHeight = 48,
  className,
  onRowClick,
}: WindowedTableProps<T>) {
  const [List, setList] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('react-window').then((module) => {
        setList(() => module.List);
      });
    }
  }, []);

  return (
    <div className={cn('border rounded-lg', className)}>
      {/* Header */}
      <div className="flex border-b bg-muted/30 font-medium sticky top-0 z-10">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-3 text-sm"
            style={{
              width: column.width || `${100 / columns.length}%`,
            }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Windowed list */}
      {List ? (
        <List
          rowHeight={rowHeight}
          rowCount={data.length}
          rowProps={{
            items: data,
            columns,
            onRowClick,
          }}
          style={{ height }}
          rowComponent={Row}
        />
      ) : (
        <div style={{ height }} className="flex items-center justify-center">
          <span className="text-muted-foreground">Loading virtual table...</span>
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-4 py-2 text-sm text-muted-foreground">
        Total: {data.length.toLocaleString()} rows
      </div>
    </div>
  );
}
