// Shared types for table components

export interface VirtualizedTableColumn<T = any> {
  key: string;
  header: string;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string | ((item: T) => string);
}

export interface TableSortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface TableFilterConfig {
  key: string;
  value: any;
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
}

export interface VirtualTableState {
  sortConfig?: TableSortConfig | null;
  filterConfigs?: TableFilterConfig[];
  selectedRows?: Set<string | number>;
  expandedRows?: Set<string | number>;
  columnWidths?: Record<string, number>;
  columnOrder?: string[];
  hiddenColumns?: Set<string>;
}

export interface VirtualTableActions<T = any> {
  onSort?: (config: TableSortConfig) => void;
  onFilter?: (configs: TableFilterConfig[]) => void;
  onRowSelect?: (item: T, selected: boolean) => void;
  onRowExpand?: (item: T, expanded: boolean) => void;
  onColumnResize?: (key: string, width: number) => void;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onColumnToggle?: (key: string, visible: boolean) => void;
}
