'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TablePaginationProps {
  /**
   * Current page (0-indexed)
   */
  currentPage: number;

  /**
   * Total number of pages
   */
  totalPages: number;

  /**
   * Current page size
   */
  pageSize: number;

  /**
   * Total number of items
   */
  totalItems: number;

  /**
   * Available page size options
   */
  pageSizeOptions?: number[];

  /**
   * Callback when page changes
   */
  onPageChange: (page: number) => void;

  /**
   * Callback when page size changes
   */
  onPageSizeChange: (size: number) => void;

  /**
   * Whether to show page size selector
   */
  showPageSizeSelector?: boolean;

  /**
   * Whether to show item count
   */
  showItemCount?: boolean;

  /**
   * Whether to show page jump input
   */
  showPageJump?: boolean;

  /**
   * Maximum number of page buttons to show
   */
  maxPageButtons?: number;

  /**
   * Whether pagination is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Mobile-optimized layout
   */
  mobileOptimized?: boolean;
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 20, 30, 50, 100],
  onPageChange,
  onPageSizeChange,
  showPageSizeSelector = true,
  showItemCount = true,
  showPageJump = true,
  maxPageButtons = 7,
  disabled = false,
  className,
  mobileOptimized = true,
}: TablePaginationProps) {
  const [jumpValue, setJumpValue] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    if (!mobileOptimized) return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileOptimized]);

  // Calculate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const halfMax = Math.floor(maxPageButtons / 2);

    if (totalPages <= maxPageButtons) {
      // Show all pages
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);

      if (currentPage <= halfMax) {
        // Near start
        for (let i = 1; i < maxPageButtons - 2; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages - 1);
      } else if (currentPage >= totalPages - halfMax - 1) {
        // Near end
        pages.push('...');
        for (let i = totalPages - maxPageButtons + 2; i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Middle
        pages.push('...');
        for (let i = currentPage - halfMax + 2; i <= currentPage + halfMax - 2; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages - 1);
      }
    }

    return pages;
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(jumpValue, 10) - 1;
    if (!isNaN(page) && page >= 0 && page < totalPages) {
      onPageChange(page);
      setJumpValue('');
    }
  };

  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  // Mobile layout
  if (isMobile && mobileOptimized) {
    return (
      <div className={cn('flex flex-col gap-3 p-4', className)}>
        {/* Item count and page info */}
        {showItemCount && (
          <div className="text-sm text-muted-foreground text-center">
            {startItem}-{endItem} of {totalItems.toLocaleString()} items
            <span className="ml-2">
              • Page {currentPage + 1} of {totalPages}
            </span>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(0)}
            disabled={disabled || currentPage === 0}
            className="h-9 w-9"
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">First page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage === 0}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>

          {/* Current page indicator */}
          <div className="flex items-center px-3 min-w-[100px] justify-center">
            <span className="text-sm font-medium">
              {currentPage + 1} / {totalPages}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage === totalPages - 1}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={disabled || currentPage === totalPages - 1}
            className="h-9 w-9"
          >
            <ChevronsRight className="h-4 w-4" />
            <span className="sr-only">Last page</span>
          </Button>
        </div>

        {/* Page size selector */}
        {showPageSizeSelector && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size} items
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={cn('flex items-center justify-between gap-4 px-2', className)}>
      {/* Left section: Item count and page size */}
      <div className="flex items-center gap-4">
        {showItemCount && (
          <p className="text-sm text-muted-foreground">
            Showing {startItem}-{endItem} of {totalItems.toLocaleString()} items
          </p>
        )}

        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Center section: Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(0)}
          disabled={disabled || currentPage === 0}
          className="h-8 w-8"
        >
          <ChevronsLeft className="h-4 w-4" />
          <span className="sr-only">First page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage === 0}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>

        {/* Page number buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <div key={`ellipsis-${index}`} className="flex h-8 w-8 items-center justify-center">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            }

            const pageNumber = page as number;
            const isActive = pageNumber === currentPage;

            return (
              <Button
                key={pageNumber}
                variant={isActive ? 'default' : 'outline'}
                size="icon"
                onClick={() => onPageChange(pageNumber)}
                disabled={disabled}
                className={cn('h-8 w-8', isActive && 'pointer-events-none')}
              >
                {pageNumber + 1}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage === totalPages - 1}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={disabled || currentPage === totalPages - 1}
          className="h-8 w-8"
        >
          <ChevronsRight className="h-4 w-4" />
          <span className="sr-only">Last page</span>
        </Button>
      </div>

      {/* Right section: Page jump */}
      {showPageJump && (
        <form onSubmit={handlePageJump} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Go to page:</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            disabled={disabled}
            className="h-8 w-[70px]"
            placeholder={(currentPage + 1).toString()}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={disabled || !jumpValue}
            className="h-8"
          >
            Go
          </Button>
        </form>
      )}
    </div>
  );
}
