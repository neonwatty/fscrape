'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, X, ChevronDown, Search, Hash, Globe, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Source {
  id: string;
  name: string;
  platform: string;
  postCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  color?: string;
}

interface SourceSelectorProps {
  sources: Source[];
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
  maxSources?: number;
  className?: string;
  enablePlatformGrouping?: boolean;
}

// Platform icons and colors
const platformConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Reddit: {
    icon: <Hash className="h-4 w-4" />,
    color: '#FF4500',
    label: 'Reddit Communities',
  },
  HackerNews: {
    icon: <Globe className="h-4 w-4" />,
    color: '#FF6600',
    label: 'Hacker News',
  },
  Twitter: {
    icon: <MessageSquare className="h-4 w-4" />,
    color: '#1DA1F2',
    label: 'Twitter',
  },
  Default: {
    icon: <Globe className="h-4 w-4" />,
    color: '#6B7280',
    label: 'Other Sources',
  },
};

export function SourceSelector({
  sources,
  selectedSources,
  onSourcesChange,
  maxSources = 5,
  className,
  enablePlatformGrouping = true,
}: SourceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Enhanced filtering with fuzzy search
  const filteredSources = useMemo(() => {
    if (!searchTerm) return sources;

    const term = searchTerm.toLowerCase();
    return sources.filter((source) => {
      const nameMatch = source.name.toLowerCase().includes(term);
      const platformMatch = source.platform.toLowerCase().includes(term);
      // Fuzzy match for common abbreviations
      const fuzzyMatch = term
        .split('')
        .every(
          (char) =>
            source.name.toLowerCase().includes(char) || source.platform.toLowerCase().includes(char)
        );
      return nameMatch || platformMatch || (term.length > 2 && fuzzyMatch);
    });
  }, [sources, searchTerm]);

  // Group sources by platform
  const groupedSources = useMemo(() => {
    if (!enablePlatformGrouping) return { All: filteredSources };

    return filteredSources.reduce(
      (groups, source) => {
        const platform = source.platform || 'Other';
        if (!groups[platform]) {
          groups[platform] = [];
        }
        groups[platform].push(source);
        return groups;
      },
      {} as Record<string, Source[]>
    );
  }, [filteredSources, enablePlatformGrouping]);

  // Sort platforms by source count
  const sortedPlatforms = useMemo(() => {
    return Object.keys(groupedSources).sort((a, b) => {
      // Priority order for known platforms
      const priorityOrder = ['Reddit', 'HackerNews', 'Twitter'];
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Then sort by count
      return groupedSources[b].length - groupedSources[a].length;
    });
  }, [groupedSources]);

  const toggleSource = useCallback(
    (sourceId: string) => {
      if (selectedSources.includes(sourceId)) {
        onSourcesChange(selectedSources.filter((id) => id !== sourceId));
      } else if (selectedSources.length < maxSources) {
        onSourcesChange([...selectedSources, sourceId]);
      }
    },
    [selectedSources, onSourcesChange, maxSources]
  );

  const removeSource = (sourceId: string) => {
    onSourcesChange(selectedSources.filter((id) => id !== sourceId));
  };

  const clearAll = () => {
    onSourcesChange([]);
    setSearchTerm('');
  };

  const selectAll = () => {
    const availableSources = filteredSources.slice(0, maxSources);
    onSourcesChange(availableSources.map((s) => s.id));
  };

  const selectedSourceObjects = sources.filter((s) => selectedSources.includes(s.id));

  const getPlatformConfig = (platform: string) => {
    return platformConfig[platform] || platformConfig['Default'];
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      const flatSources = sortedPlatforms.flatMap((platform) => groupedSources[platform]);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev < flatSources.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatSources.length - 1));
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < flatSources.length) {
            toggleSource(flatSources[highlightedIndex].id);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, sortedPlatforms, groupedSources, toggleSource]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && !(event.target as Element).closest('.source-selector')) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Select Sources to Compare
            <span className="text-muted-foreground ml-2">
              ({selectedSources.length}/{maxSources})
            </span>
          </label>
          {selectedSourceObjects.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Selected sources pills with platform indicators */}
        {selectedSourceObjects.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedSourceObjects.map((source) => {
              const config = getPlatformConfig(source.platform);
              return (
                <div
                  key={source.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-sm group"
                  style={{
                    backgroundColor: source.color ? `${source.color}20` : `${config.color}20`,
                    borderLeft: `3px solid ${source.color || config.color}`,
                  }}
                >
                  {config.icon}
                  <span className="font-medium">{source.name}</span>
                  <button
                    onClick={() => removeSource(source.id)}
                    className="ml-1 hover:bg-background/50 rounded-full p-0.5 opacity-70 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${source.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Dropdown selector */}
        <div className="source-selector relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-2.5',
              'border rounded-lg bg-background',
              'hover:bg-accent/50 transition-colors',
              'min-h-[44px]', // Mobile-friendly touch target
              isOpen && 'ring-2 ring-primary',
              selectedSources.length >= maxSources && !isOpen && 'opacity-60'
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className="text-sm">
              {selectedSources.length === 0
                ? 'Select sources...'
                : `${selectedSources.length} source${selectedSources.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-lg border bg-background shadow-lg max-w-md">
              {/* Enhanced search input with icon */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name or platform..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    autoFocus
                  />
                </div>
                {filteredSources.length > 0 && selectedSources.length < maxSources && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Select all visible (
                      {Math.min(filteredSources.length, maxSources - selectedSources.length)})
                    </button>
                  </div>
                )}
              </div>

              {/* Sources list with platform grouping */}
              <div className="max-h-96 overflow-y-auto">
                {filteredSources.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sources found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                ) : enablePlatformGrouping ? (
                  sortedPlatforms.map((platform) => {
                    const config = getPlatformConfig(platform);
                    const platformSources = groupedSources[platform];
                    if (!platformSources || platformSources.length === 0) return null;

                    return (
                      <div key={platform}>
                        <div className="sticky top-0 bg-background/95 backdrop-blur-sm px-4 py-2 border-b flex items-center gap-2">
                          {config.icon}
                          <span className="text-xs font-medium text-muted-foreground">
                            {config.label || platform}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {platformSources.length}
                          </span>
                        </div>
                        {platformSources.map((source, index) => {
                          const isSelected = selectedSources.includes(source.id);
                          const isDisabled = !isSelected && selectedSources.length >= maxSources;
                          const flatIndex =
                            sortedPlatforms
                              .slice(0, sortedPlatforms.indexOf(platform))
                              .reduce((acc, p) => acc + (groupedSources[p]?.length || 0), 0) +
                            index;
                          const isHighlighted = flatIndex === highlightedIndex;

                          return (
                            <button
                              key={source.id}
                              onClick={() => !isDisabled && toggleSource(source.id)}
                              onMouseEnter={() => setHighlightedIndex(flatIndex)}
                              disabled={isDisabled}
                              className={cn(
                                'w-full flex items-center justify-between px-4 py-3',
                                'hover:bg-accent/50 transition-colors text-left',
                                'min-h-[44px]', // Mobile-friendly touch target
                                isSelected && 'bg-primary/10',
                                isDisabled && 'opacity-50 cursor-not-allowed',
                                isHighlighted && 'bg-accent/30'
                              )}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: source.color || config.color }}
                                  />
                                  <span className="font-medium text-sm">{source.name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {source.postCount.toLocaleString()} posts •{' '}
                                  {new Date(source.dateRange.start).toLocaleDateString()} -{' '}
                                  {new Date(source.dateRange.end).toLocaleDateString()}
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  filteredSources.map((source, index) => {
                    const isSelected = selectedSources.includes(source.id);
                    const isDisabled = !isSelected && selectedSources.length >= maxSources;
                    const isHighlighted = index === highlightedIndex;
                    const config = getPlatformConfig(source.platform);

                    return (
                      <button
                        key={source.id}
                        onClick={() => !isDisabled && toggleSource(source.id)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        disabled={isDisabled}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3',
                          'hover:bg-accent/50 transition-colors text-left',
                          'min-h-[44px]',
                          isSelected && 'bg-primary/10',
                          isDisabled && 'opacity-50 cursor-not-allowed',
                          isHighlighted && 'bg-accent/30'
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {config.icon}
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: source.color || config.color }}
                            />
                            <span className="font-medium text-sm">{source.name}</span>
                            <span className="text-xs text-muted-foreground">{source.platform}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {source.postCount.toLocaleString()} posts
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer with count and limit info */}
              <div className="p-2 border-t text-xs text-center text-muted-foreground bg-muted/30">
                {selectedSources.length >= maxSources ? (
                  <span className="text-orange-600">Maximum {maxSources} sources reached</span>
                ) : (
                  <span>
                    {filteredSources.length} source{filteredSources.length !== 1 ? 's' : ''}{' '}
                    available
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
