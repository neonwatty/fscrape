'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileCardField {
  label: string;
  value: ReactNode;
  priority?: 'primary' | 'secondary' | 'tertiary';
  badge?: boolean;
  copyable?: boolean;
  link?: string;
  className?: string;
}

interface MobileCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  fields: MobileCardField[];
  actions?: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  }>;
  expandable?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  status?: 'success' | 'warning' | 'error' | 'info';
}

export function MobileCard({
  title,
  subtitle,
  fields,
  actions = [],
  expandable = true,
  defaultExpanded = false,
  className,
  onClick,
  selected = false,
  compact = false,
  status,
}: MobileCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Group fields by priority
  const primaryFields = fields.filter((f) => f.priority === 'primary' || !f.priority);
  const _secondaryFields = fields.filter((f) => f.priority === 'secondary');
  const _tertiaryFields = fields.filter((f) => f.priority === 'tertiary');

  // Determine visible fields based on expansion state
  const visibleFields = isExpanded ? fields : primaryFields.slice(0, compact ? 2 : 3);

  const hasHiddenFields = !isExpanded && fields.length > visibleFields.length;

  // Copy to clipboard
  const handleCopy = async (value: ReactNode) => {
    if (typeof value === 'string' || typeof value === 'number') {
      await navigator.clipboard.writeText(String(value));
    }
  };

  // Status colors
  const statusColors = {
    success: 'border-green-500 bg-green-50 dark:bg-green-950',
    warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
    error: 'border-red-500 bg-red-50 dark:bg-red-950',
    info: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        className={cn(isFullscreen && 'fixed inset-4 z-50')}
      >
        <Card
          className={cn(
            'transition-all duration-200',
            onClick && 'cursor-pointer hover:shadow-md',
            selected && 'ring-2 ring-primary',
            status && statusColors[status],
            isFullscreen && 'h-full overflow-auto',
            className
          )}
          onClick={(e) => {
            if (onClick && !isFullscreen) {
              e.stopPropagation();
              onClick();
            }
          }}
        >
          {(title || subtitle || actions.length > 0) && (
            <CardHeader className={cn('pb-3', compact && 'py-2')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {title && (
                    <div className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
                      {title}
                    </div>
                  )}
                  {subtitle && (
                    <div className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
                      {subtitle}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {/* Fullscreen toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreen(!isFullscreen);
                    }}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Actions dropdown */}
                  {actions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action, index) => (
                          <DropdownMenuItem
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick();
                            }}
                          >
                            {action.icon && <span className="mr-2">{action.icon}</span>}
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardHeader>
          )}

          <CardContent className={cn('space-y-2', compact && 'py-2')}>
            {/* Visible fields */}
            {visibleFields.map((field, index) => (
              <div
                key={index}
                className={cn('flex items-start justify-between gap-2', field.className)}
              >
                <span
                  className={cn(
                    'text-muted-foreground flex-shrink-0',
                    compact ? 'text-xs' : 'text-sm'
                  )}
                >
                  {field.label}:
                </span>
                <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                  <span
                    className={cn(
                      'text-right',
                      compact ? 'text-xs' : 'text-sm',
                      field.badge && 'inline-flex'
                    )}
                  >
                    {field.badge ? (
                      <Badge variant="secondary" className="text-xs">
                        {field.value}
                      </Badge>
                    ) : field.link ? (
                      <a
                        href={field.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {field.value}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      field.value
                    )}
                  </span>
                  {field.copyable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(field.value);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Expand/collapse button */}
            {expandable && hasHiddenFields && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
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
                    Show {fields.length - visibleFields.length} more
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

// Grid layout for multiple cards
interface MobileCardGridProps {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export function MobileCardGrid({ children, columns = 1, className }: MobileCardGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        className
      )}
    >
      {children}
    </div>
  );
}

// Swipeable card container
interface SwipeableCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  className?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  className,
}: SwipeableCardProps) {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;

    const current = e.touches[0].clientX;
    setCurrentX(current);
    setOffset(current - startX);
  };

  const handleTouchEnd = () => {
    if (startX === null || currentX === null) return;

    const diff = currentX - startX;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (diff < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    // Reset
    setStartX(null);
    setCurrentX(null);
    setOffset(0);
  };

  return (
    <div
      className={cn('touch-pan-y', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${offset * 0.2}px)`,
        transition: startX === null ? 'transform 0.2s ease-out' : 'none',
      }}
    >
      {children}
    </div>
  );
}
