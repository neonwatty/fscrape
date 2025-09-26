'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HeatmapData } from '@/lib/analytics/analytics-utils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActivityHeatmapProps {
  data: HeatmapData[];
  title?: string;
  description?: string;
  className?: string;
}

export function ActivityHeatmap({
  data,
  title = 'Posting Activity Heatmap',
  description = 'Posts distribution by day of week and hour',
  className,
}: ActivityHeatmapProps) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => i);

  // Calculate max value for color scaling
  const maxValue = useMemo(() => {
    return Math.max(...data.map((d) => d.value), 1);
  }, [data]);

  // Get value for specific cell
  const getValue = (day: number, hour: number) => {
    const cell = data.find((d) => d.day === day && d.hour === hour);
    return cell?.value || 0;
  };

  // Get color intensity based on value
  const getColorIntensity = (value: number) => {
    if (value === 0) return 'bg-muted';
    const intensity = (value / maxValue) * 100;

    if (intensity <= 25) return 'bg-primary/20 dark:bg-primary/15';
    if (intensity <= 50) return 'bg-primary/40 dark:bg-primary/30';
    if (intensity <= 75) return 'bg-primary/60 dark:bg-primary/50';
    return 'bg-primary/80 dark:bg-primary/70';
  };

  // Format hour label
  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Hour labels */}
          <div className="flex gap-1 ml-12">
            {hourLabels.map((hour) => (
              <div
                key={hour}
                className="flex-1 text-xs text-muted-foreground text-center"
                style={{ minWidth: '20px' }}
              >
                {hour % 3 === 0 ? formatHour(hour) : ''}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <TooltipProvider>
            <div className="space-y-1">
              {dayLabels.map((day, dayIndex) => (
                <div key={day} className="flex gap-1 items-center">
                  <div className="w-12 text-sm text-muted-foreground text-right pr-2">{day}</div>
                  <div className="flex gap-1">
                    {hourLabels.map((hour) => {
                      const value = getValue(dayIndex, hour);
                      const label = `${day} ${formatHour(hour)}: ${value} posts`;

                      return (
                        <Tooltip key={hour}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'w-5 h-5 rounded-sm cursor-pointer transition-all hover:scale-110',
                                getColorIntensity(value)
                              )}
                              aria-label={label}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{label}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <span className="text-xs text-muted-foreground">Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded-sm bg-muted" />
              <div className="w-4 h-4 rounded-sm bg-primary/20 dark:bg-primary/15" />
              <div className="w-4 h-4 rounded-sm bg-primary/40 dark:bg-primary/30" />
              <div className="w-4 h-4 rounded-sm bg-primary/60 dark:bg-primary/50" />
              <div className="w-4 h-4 rounded-sm bg-primary/80 dark:bg-primary/70" />
            </div>
            <span className="text-xs text-muted-foreground">More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SimpleHeatmapProps {
  data: HeatmapData[];
  className?: string;
}

export function SimpleHeatmap({ data, className }: SimpleHeatmapProps) {
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const getValue = (day: number, hour: number) => {
    const cell = data.find((d) => d.day === day && d.hour === hour);
    return cell?.value || 0;
  };

  const getColorClass = (value: number) => {
    if (value === 0) return 'bg-muted';
    const intensity = (value / maxValue) * 100;

    if (intensity <= 33) return 'bg-emerald-200 dark:bg-emerald-900';
    if (intensity <= 66) return 'bg-emerald-400 dark:bg-emerald-700';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  return (
    <div className={cn('space-y-1', className)}>
      {/* Compact grid */}
      <TooltipProvider>
        {dayLabels.map((day, dayIndex) => (
          <div key={day} className="flex gap-0.5 items-center">
            <div className="w-4 text-xs text-muted-foreground">{day}</div>
            <div className="flex gap-0.5">
              {Array.from({ length: 24 }, (_, hour) => {
                const value = getValue(dayIndex, hour);
                const label = `${value} posts`;

                return (
                  <Tooltip key={hour}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn('w-2 h-2 rounded-sm', getColorClass(value))}
                        aria-label={label}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </TooltipProvider>
    </div>
  );
}
