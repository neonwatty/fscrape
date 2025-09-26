'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDatabase } from '@/lib/db/database-context';
import { getPlatformStats } from '@/lib/db/queries';
import { ChevronDown, Filter, X, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlatformPickerSelection {
  platforms: string[];
  sources: string[];
}

interface PlatformPickerProps {
  onSelectionChange?: (selection: PlatformPickerSelection) => void;
  className?: string;
}

interface PlatformSource {
  platform: string;
  sources: string[];
}

export function PlatformPicker({ onSelectionChange, className }: PlatformPickerProps) {
  const { isInitialized } = useDatabase();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformSource[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const platforms = searchParams.get('platforms')?.split(',').filter(Boolean) || [];
    const sources = searchParams.get('sources')?.split(',').filter(Boolean) || [];

    if (platforms.length > 0) {
      setSelectedPlatforms(platforms);
    }
    if (sources.length > 0) {
      setSelectedSources(sources);
    }
  }, [searchParams]);

  // Load available platforms and sources
  useEffect(() => {
    if (isInitialized) {
      const stats = getPlatformStats();

      // Group sources by platform
      const platformMap = new Map<string, Set<string>>();

      stats.forEach((stat: { platform: string; source?: string }) => {
        const platform = stat.platform.toLowerCase();
        if (!platformMap.has(platform)) {
          platformMap.set(platform, new Set());
        }
        // Add source if it exists
        if (stat.source) {
          platformMap.get(platform)?.add(stat.source);
        }
      });

      const platforms: PlatformSource[] = Array.from(platformMap.entries()).map(
        ([platform, sources]) => ({
          platform,
          sources: Array.from(sources),
        })
      );

      setAvailablePlatforms(platforms);
    }
  }, [isInitialized]);

  // Update URL when selection changes
  const updateURL = useCallback(
    (platforms: string[], sources: string[]) => {
      const params = new URLSearchParams(searchParams.toString());

      if (platforms.length > 0) {
        params.set('platforms', platforms.join(','));
      } else {
        params.delete('platforms');
      }

      if (sources.length > 0) {
        params.set('sources', sources.join(','));
      } else {
        params.delete('sources');
      }

      const queryString = params.toString();
      router.push(`${pathname}${queryString ? '?' + queryString : ''}`);
    },
    [pathname, router, searchParams]
  );

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) => {
      const newPlatforms = prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform];

      // Remove sources from deselected platform
      if (!newPlatforms.includes(platform)) {
        const platformData = availablePlatforms.find((p) => p.platform === platform);
        if (platformData) {
          setSelectedSources((prevSources) =>
            prevSources.filter((s) => !platformData.sources.includes(s))
          );
        }
      }

      return newPlatforms;
    });
  };

  const handleSourceToggle = (source: string, platform: string) => {
    // Auto-select platform when source is selected
    if (!selectedPlatforms.includes(platform)) {
      setSelectedPlatforms((prev) => [...prev, platform]);
    }

    setSelectedSources((prev) => {
      return prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source];
    });
  };

  const handleApply = () => {
    updateURL(selectedPlatforms, selectedSources);
    onSelectionChange?.({
      platforms: selectedPlatforms,
      sources: selectedSources,
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedPlatforms([]);
    setSelectedSources([]);
    updateURL([], []);
    onSelectionChange?.({
      platforms: [],
      sources: [],
    });
  };

  const handleSelectAll = () => {
    const allPlatforms = availablePlatforms.map((p) => p.platform);
    const allSources = availablePlatforms.flatMap((p) => p.sources);
    setSelectedPlatforms(allPlatforms);
    setSelectedSources(allSources);
  };

  const hasSelection = selectedPlatforms.length > 0 || selectedSources.length > 0;
  const selectionCount = selectedPlatforms.length + selectedSources.length;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Platform Filter</CardTitle>
            <CardDescription>Select platforms and sources to filter dashboard data</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSelection && (
              <Badge variant="secondary" className="gap-1">
                {selectionCount} selected
              </Badge>
            )}
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>
                  <div className="flex items-center justify-between">
                    <span>Select Platforms & Sources</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        className="h-auto p-1 text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-auto p-1 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-96 overflow-y-auto p-2 space-y-4">
                  {availablePlatforms.map((platformData) => (
                    <div key={platformData.platform} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`platform-${platformData.platform}`}
                          checked={selectedPlatforms.includes(platformData.platform)}
                          onCheckedChange={() => handlePlatformToggle(platformData.platform)}
                        />
                        <Label
                          htmlFor={`platform-${platformData.platform}`}
                          className="text-sm font-medium cursor-pointer capitalize"
                        >
                          {platformData.platform}
                        </Label>
                      </div>
                      {platformData.sources.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {platformData.sources.map((source) => (
                            <div key={source} className="flex items-center space-x-2">
                              <Checkbox
                                id={`source-${source}`}
                                checked={selectedSources.includes(source)}
                                onCheckedChange={() =>
                                  handleSourceToggle(source, platformData.platform)
                                }
                                disabled={!selectedPlatforms.includes(platformData.platform)}
                              />
                              <Label
                                htmlFor={`source-${source}`}
                                className="text-xs cursor-pointer"
                              >
                                {source}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleApply}>
                    Apply Filter
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      {hasSelection && (
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedPlatforms.map((platform) => (
              <Badge key={platform} variant="secondary" className="gap-1 capitalize">
                <CheckCircle2 className="h-3 w-3" />
                {platform}
                <button
                  onClick={() => handlePlatformToggle(platform)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedSources.map((source) => (
              <Badge key={source} variant="outline" className="gap-1">
                <Circle className="h-3 w-3" />
                {source}
                <button
                  onClick={() => {
                    setSelectedSources((prev) => prev.filter((s) => s !== source));
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
