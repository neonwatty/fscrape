'use client';

import { useState, ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Filter, Check, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FilterOption {
  id: string;
  label: string;
  value: unknown;
  icon?: ReactNode;
  count?: number;
}

interface FilterGroup {
  id: string;
  label: string;
  type: 'single' | 'multiple' | 'range' | 'custom';
  options?: FilterOption[];
  customComponent?: ReactNode;
}

interface MobileFiltersProps {
  groups: FilterGroup[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onReset?: () => void;
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  className?: string;
}

export function MobileFilters({
  groups,
  values,
  onChange,
  onReset,
  triggerLabel = 'Filters',
  triggerIcon = <Filter className="h-4 w-4" />,
  className,
}: MobileFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState(values);

  // Count active filters
  const activeFilterCount = Object.values(values).filter(
    (v) => v !== null && v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  // Update temp values when values prop changes
  useEffect(() => {
    setTempValues(values);
  }, [values]);

  const handleApply = () => {
    onChange(tempValues);
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetValues = Object.keys(tempValues).reduce(
      (acc, key) => {
        const group = groups.find((g) => g.id === key);
        if (group?.type === 'multiple') {
          acc[key] = [];
        } else {
          acc[key] = null;
        }
        return acc;
      },
      {} as Record<string, unknown>
    );

    setTempValues(resetValues);
    onReset?.();
  };

  const handleGroupChange = (groupId: string, value: unknown) => {
    setTempValues((prev) => ({
      ...prev,
      [groupId]: value,
    }));
  };

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn('min-h-[44px] touch-manipulation', className)}
      >
        {triggerIcon}
        <span className="ml-2">{triggerLabel}</span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-2">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e: unknown, info: PanInfo) => {
                if (info.velocity.y > 500 || info.offset.y > 100) {
                  setIsOpen(false);
                }
              }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-xl z-50 max-h-[90vh] overflow-hidden"
            >
              {/* Handle */}
              <div className="flex justify-center py-2">
                <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-4 border-b">
                <h2 className="text-lg font-semibold">Filters</h2>
                <div className="flex items-center gap-2">
                  {onReset && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="min-h-[44px] touch-manipulation"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="min-h-[44px] min-w-[44px] touch-manipulation"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[60vh] pb-safe">
                {!activeGroup ? (
                  // Group list
                  <div className="p-4 space-y-2">
                    {groups.map((group) => {
                      const value = tempValues[group.id];
                      const hasValue =
                        value !== null &&
                        value !== undefined &&
                        (Array.isArray(value) ? value.length > 0 : value !== '');

                      return (
                        <button
                          key={group.id}
                          onClick={() => setActiveGroup(group.id)}
                          className="w-full flex items-center justify-between p-4 rounded-lg bg-card hover:bg-accent transition-colors min-h-[60px] touch-manipulation"
                        >
                          <div className="text-left">
                            <div className="font-medium">{group.label}</div>
                            {hasValue && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {Array.isArray(value)
                                  ? `${value.length} selected`
                                  : typeof value === 'object' && value !== null && 'label' in value
                                    ? (value as { label: string }).label
                                    : String(value)}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  // Active group options
                  <div className="p-4">
                    <button
                      onClick={() => setActiveGroup(null)}
                      className="flex items-center gap-2 text-sm text-muted-foreground mb-4 touch-manipulation"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      Back to filters
                    </button>

                    {(() => {
                      const group = groups.find((g) => g.id === activeGroup);
                      if (!group) return null;

                      if (group.customComponent) {
                        return group.customComponent;
                      }

                      const currentValue = tempValues[group.id];

                      return (
                        <div className="space-y-2">
                          <h3 className="font-medium mb-4">{group.label}</h3>

                          {group.options?.map((option) => {
                            const isSelected =
                              group.type === 'multiple'
                                ? (currentValue as unknown[])?.includes(option.value)
                                : currentValue === option.value;

                            return (
                              <button
                                key={option.id}
                                onClick={() => {
                                  if (group.type === 'multiple') {
                                    const current = (currentValue as unknown[]) || [];
                                    const updated = isSelected
                                      ? current.filter((v: unknown) => v !== option.value)
                                      : [...current, option.value];
                                    handleGroupChange(group.id, updated);
                                  } else {
                                    handleGroupChange(group.id, isSelected ? null : option.value);
                                    setActiveGroup(null);
                                  }
                                }}
                                className={cn(
                                  'w-full flex items-center justify-between p-4 rounded-lg transition-colors min-h-[56px] touch-manipulation',
                                  isSelected
                                    ? 'bg-primary/10 border-2 border-primary'
                                    : 'bg-card hover:bg-accent border-2 border-transparent'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {option.icon}
                                  <span className="font-medium">{option.label}</span>
                                  {option.count !== undefined && (
                                    <Badge variant="secondary" className="ml-2">
                                      {option.count}
                                    </Badge>
                                  )}
                                </div>
                                {isSelected && <Check className="h-5 w-5 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t p-4 pb-safe">
                <Button
                  onClick={handleApply}
                  className="w-full min-h-[48px] touch-manipulation"
                  size="lg"
                >
                  Apply Filters
                  {activeFilterCount > 0 && ` (${activeFilterCount})`}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Quick filter chips for common filters
interface QuickFiltersProps {
  filters: Array<{
    id: string;
    label: string;
    value: unknown;
    active?: boolean;
  }>;
  onToggle: (id: string, value: unknown) => void;
  className?: string;
}

export function QuickFilters({ filters, onToggle, className }: QuickFiltersProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-2 scrollbar-hide', className)}>
      {filters.map((filter) => (
        <Button
          key={filter.id}
          variant={filter.active ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToggle(filter.id, filter.value)}
          className="min-h-[40px] whitespace-nowrap touch-manipulation flex-shrink-0"
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
