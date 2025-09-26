'use client';

import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Menu, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface ColumnDefinition<T> {
  key: string;
  header: string | ReactNode;
  accessor: (item: T) => ReactNode;
  priority?: 'essential' | 'important' | 'optional';
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  className?: string;
  mobileBreakpoint?: number;
  cardView?: boolean;
  stickyHeader?: boolean;
  expandableRows?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  striped?: boolean;
  compact?: boolean;
}

export function ResponsiveTable<T extends { id?: string | number }>({
  data,
  columns,
  className,
  mobileBreakpoint = 768,
  cardView = true,
  stickyHeader = false,
  expandableRows = false,
  onRowClick,
  emptyMessage = 'No data available',
  loading = false,
  striped = false,
  compact = false,
}: ResponsiveTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => col.key))
  );
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileBreakpoint]);

  // Filter columns by visibility
  const activeColumns = columns.filter((col) => visibleColumns.has(col.key));

  // Get essential columns for mobile
  const essentialColumns = columns.filter((col) => col.priority === 'essential');
  const mobileColumns = essentialColumns.length > 0 ? essentialColumns : columns.slice(0, 2);

  // Sort data
  const sortedData = sortConfig
    ? [...data].sort((a, b) => {
        const column = columns.find((col) => col.key === sortConfig.key);
        if (!column) return 0;

        const aValue = column.accessor(a);
        const bValue = column.accessor(b);

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      })
    : data;

  // Handle row expansion
  const toggleRowExpansion = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handle column sorting
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>;
  }

  // Mobile card view
  if (isMobile && cardView) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Column visibility control for mobile */}
        <div className="flex justify-end mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns.has(column.key)}
                  onCheckedChange={() => toggleColumn(column.key)}
                >
                  {typeof column.header === 'string' ? column.header : column.key}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card layout for mobile */}
        {sortedData.map((item, index) => {
          const itemId = item.id || index;
          const isExpanded = expandedRows.has(itemId);

          return (
            <div
              key={itemId}
              className={cn(
                'bg-card rounded-lg border p-4 space-y-2 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-accent/50',
                striped && index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => onRowClick?.(item)}
            >
              {/* Show essential columns always */}
              {mobileColumns.map((column) => (
                <div key={column.key} className="flex justify-between items-start">
                  <span className="text-sm font-medium text-muted-foreground">
                    {typeof column.header === 'string' ? column.header : column.key}:
                  </span>
                  <span className={cn('text-sm text-right', column.className)}>
                    {column.accessor(item)}
                  </span>
                </div>
              ))}

              {/* Expandable section for additional columns */}
              {expandableRows && activeColumns.length > mobileColumns.length && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRowExpansion(itemId);
                    }}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show more
                      </>
                    )}
                  </Button>

                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t">
                      {activeColumns
                        .filter((col) => !mobileColumns.includes(col))
                        .map((column) => (
                          <div key={column.key} className="flex justify-between items-start">
                            <span className="text-sm font-medium text-muted-foreground">
                              {typeof column.header === 'string' ? column.header : column.key}:
                            </span>
                            <span className={cn('text-sm text-right', column.className)}>
                              {column.accessor(item)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className={className}>
      {/* Column visibility control for desktop */}
      <div className="flex justify-end mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu className="h-4 w-4 mr-2" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={visibleColumns.has(column.key)}
                onCheckedChange={() => toggleColumn(column.key)}
              >
                {typeof column.header === 'string' ? column.header : column.key}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Scrollable table container */}
      <ScrollArea className="w-full">
        <Table className={cn(compact && 'table-compact')}>
          <TableHeader className={cn(stickyHeader && 'sticky top-0 bg-background z-10')}>
            <TableRow>
              {activeColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.width && `w-[${column.width}]`,
                    column.sortable && 'cursor-pointer select-none hover:bg-muted/50',
                    column.className
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && sortConfig?.key === column.key && (
                      <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((item, index) => (
              <TableRow
                key={item.id || index}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  striped && index % 2 === 1 && 'bg-muted/30'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {activeColumns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.className
                    )}
                  >
                    {column.accessor(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
