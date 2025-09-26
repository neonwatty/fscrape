'use client';

import { useState, useEffect } from 'react';
import { PostFilters } from '@/lib/db/types';
import {
  FilterPreset,
  defaultFilterPresets,
  getActiveFilterCount,
  clearFilters,
} from '@/lib/utils/filters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Search,
  Calendar as CalendarIcon,
  X,
  Sparkles,
  Clock,
  Settings2,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';

interface TableFiltersProps {
  filters: PostFilters;
  onFiltersChange: (filters: PostFilters) => void;
  filterOptions?: {
    platforms?: string[];
    sources?: string[];
    authors?: string[];
    categories?: string[];
  };
  showPresets?: boolean;
  showAdvanced?: boolean;
  className?: string;
}

export function TableFilters({
  filters,
  onFiltersChange,
  filterOptions = {},
  showPresets = true,
  showAdvanced = true,
  className,
}: TableFiltersProps) {
  const [localFilters, setLocalFilters] = useState<PostFilters>(filters);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState<FilterPreset[]>([]);
  const activeFilterCount = getActiveFilterCount(localFilters);

  // Sync local filters with props
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Update parent when local filters change
  const handleFilterChange = (newFilters: PostFilters) => {
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Apply a preset
  const applyPreset = (preset: FilterPreset) => {
    handleFilterChange({ ...localFilters, ...preset.filters });
  };

  // Save current filters as preset
  const saveAsPreset = () => {
    const name = prompt('Enter a name for this filter preset:');
    if (name) {
      const newPreset: FilterPreset = {
        id: `custom-${Date.now()}`,
        name,
        description: 'Custom filter preset',
        filters: { ...localFilters },
      };
      setCustomPresets([...customPresets, newPreset]);
      // Could persist to localStorage here
      localStorage.setItem('customFilterPresets', JSON.stringify([...customPresets, newPreset]));
    }
  };

  // Load custom presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customFilterPresets');
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom presets:', e);
      }
    }
  }, []);

  // Date range picker
  const DateRangePicker = () => (
    <div className="flex flex-col sm:flex-row gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !localFilters.dateFrom && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {localFilters.dateFrom ? format(localFilters.dateFrom, 'PPP') : 'From date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={localFilters.dateFrom}
            onSelect={(date: Date | undefined) =>
              handleFilterChange({ ...localFilters, dateFrom: date || undefined })
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !localFilters.dateTo && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {localFilters.dateTo ? format(localFilters.dateTo, 'PPP') : 'To date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={localFilters.dateTo}
            onSelect={(date: Date | undefined) =>
              handleFilterChange({ ...localFilters, dateTo: date || undefined })
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
                : 'Configure filters to refine your search'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange(clearFilters(localFilters))}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
            {showAdvanced && (
              <Sheet open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Advanced
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Advanced Filters</SheetTitle>
                    <SheetDescription>
                      Fine-tune your search with detailed filter options
                    </SheetDescription>
                  </SheetHeader>

                  <div className="mt-6 space-y-6">
                    {/* Score Range */}
                    <div className="space-y-2">
                      <Label>Score Range</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={localFilters.scoreMin ?? ''}
                          onChange={(e) =>
                            handleFilterChange({
                              ...localFilters,
                              scoreMin: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-24"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={localFilters.scoreMax ?? ''}
                          onChange={(e) =>
                            handleFilterChange({
                              ...localFilters,
                              scoreMax: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-24"
                        />
                      </div>
                    </div>

                    {/* Comments Range */}
                    <div className="space-y-2">
                      <Label>Comments Range</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={localFilters.commentsMin ?? ''}
                          onChange={(e) =>
                            handleFilterChange({
                              ...localFilters,
                              commentsMin: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-24"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={localFilters.commentsMax ?? ''}
                          onChange={(e) =>
                            handleFilterChange({
                              ...localFilters,
                              commentsMax: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-24"
                        />
                      </div>
                    </div>

                    {/* Author Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="author">Author</Label>
                      <Input
                        id="author"
                        placeholder="Search by author..."
                        value={localFilters.author ?? ''}
                        onChange={(e) =>
                          handleFilterChange({
                            ...localFilters,
                            author: e.target.value || undefined,
                          })
                        }
                      />
                    </div>

                    {/* Source Filter */}
                    {filterOptions.sources && filterOptions.sources.length > 0 && (
                      <div className="space-y-2">
                        <Label>Source</Label>
                        <Select
                          value={localFilters.source ?? ''}
                          onValueChange={(value) =>
                            handleFilterChange({
                              ...localFilters,
                              source: value || undefined,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All sources" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All sources</SelectItem>
                            {filterOptions.sources.map((source) => (
                              <SelectItem key={source} value={source}>
                                {source}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Category Filter */}
                    {filterOptions.categories && filterOptions.categories.length > 0 && (
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={localFilters.category ?? ''}
                          onValueChange={(value) =>
                            handleFilterChange({
                              ...localFilters,
                              category: value || undefined,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All categories</SelectItem>
                            {filterOptions.categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Save as Preset Button */}
                    <div className="pt-4">
                      <Button onClick={saveAsPreset} className="w-full">
                        <Save className="h-4 w-4 mr-2" />
                        Save as Preset
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={localFilters.searchTerm ?? ''}
            onChange={(e) =>
              handleFilterChange({
                ...localFilters,
                searchTerm: e.target.value || undefined,
              })
            }
            className="pl-10"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Platform Filter */}
          <Select
            value={localFilters.platform ?? 'all'}
            onValueChange={(value) =>
              handleFilterChange({
                ...localFilters,
                platform: value === 'all' ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {filterOptions.platforms?.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time Range Filter */}
          <Select
            value={localFilters.timeRange ?? 'all'}
            onValueChange={(value) =>
              handleFilterChange({
                ...localFilters,
                timeRange: value === 'all' ? undefined : (value as PostFilters['timeRange']),
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select
            value={localFilters.sortBy ?? 'created_utc'}
            onValueChange={(value) =>
              handleFilterChange({
                ...localFilters,
                sortBy: value as PostFilters['sortBy'],
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_utc">Date</SelectItem>
              <SelectItem value="score">Score</SelectItem>
              <SelectItem value="num_comments">Comments</SelectItem>
              <SelectItem value="upvote_ratio">Upvote Ratio</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Order */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleFilterChange({
                ...localFilters,
                sortOrder: localFilters.sortOrder === 'asc' ? 'desc' : 'asc',
              })
            }
          >
            {localFilters.sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        {/* Date Range */}
        <DateRangePicker />

        {/* Filter Presets */}
        {showPresets && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {defaultFilterPresets.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="h-auto py-1"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {preset.name}
                </Button>
              ))}
              {customPresets.map((preset) => (
                <div key={preset.id} className="relative group">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="h-auto py-1 pr-6"
                  >
                    {preset.name}
                  </Button>
                  <button
                    onClick={() => {
                      const filtered = customPresets.filter((p) => p.id !== preset.id);
                      setCustomPresets(filtered);
                      localStorage.setItem('customFilterPresets', JSON.stringify(filtered));
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {localFilters.platform && (
              <Badge variant="secondary">
                Platform: {localFilters.platform}
                <button
                  onClick={() => handleFilterChange({ ...localFilters, platform: undefined })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {localFilters.timeRange && (
              <Badge variant="secondary">
                Time: {localFilters.timeRange}
                <button
                  onClick={() => handleFilterChange({ ...localFilters, timeRange: undefined })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {localFilters.searchTerm && (
              <Badge variant="secondary">
                Search: {localFilters.searchTerm}
                <button
                  onClick={() => handleFilterChange({ ...localFilters, searchTerm: undefined })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {localFilters.scoreMin !== undefined && (
              <Badge variant="secondary">
                Score ≥ {localFilters.scoreMin}
                <button
                  onClick={() => handleFilterChange({ ...localFilters, scoreMin: undefined })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {localFilters.commentsMin !== undefined && (
              <Badge variant="secondary">
                Comments ≥ {localFilters.commentsMin}
                <button
                  onClick={() => handleFilterChange({ ...localFilters, commentsMin: undefined })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
