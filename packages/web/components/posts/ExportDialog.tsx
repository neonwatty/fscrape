'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ForumPost } from '@/lib/db/types';
import {
  ExportFormat,
  ExportOptions,
  ExportColumn,
  defaultExportColumns,
  exportPosts,
  estimateExportSize,
  formatBytes,
} from '@/lib/utils/export';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Settings,
} from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: ForumPost[];
  selectedPosts?: ForumPost[];
  title?: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  posts,
  selectedPosts,
  title = 'Export Posts',
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filename, setFilename] = useState('');
  const [dateFormat, setDateFormat] = useState<'iso' | 'locale' | 'unix'>('iso');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    defaultExportColumns.map((col) => col.key)
  );
  const [exportSelection, setExportSelection] = useState<'all' | 'selected'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setExportSuccess(false);
      setExportError(null);
      setExportProgress(0);
      setFilename(`posts-export-${new Date().toISOString().split('T')[0]}`);

      // Set default export selection based on whether posts are selected
      if (selectedPosts && selectedPosts.length > 0) {
        setExportSelection('selected');
      } else {
        setExportSelection('all');
      }
    }
  }, [open, selectedPosts]);

  // Get posts to export
  const getPostsToExport = useCallback(() => {
    if (exportSelection === 'selected' && selectedPosts && selectedPosts.length > 0) {
      return selectedPosts;
    }
    return posts;
  }, [exportSelection, posts, selectedPosts]);

  // Calculate export size
  const exportSize = estimateExportSize(getPostsToExport(), format);
  const formattedSize = formatBytes(exportSize);

  // Handle column selection
  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(columnKey)) {
        // Don't allow deselecting all columns
        if (prev.length === 1) return prev;
        return prev.filter((key) => key !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportProgress(0);

    try {
      const postsToExport = getPostsToExport();

      // Filter columns based on selection
      const columns: ExportColumn[] = defaultExportColumns.filter((col) =>
        selectedColumns.includes(col.key)
      );

      const options: ExportOptions = {
        format,
        filename,
        includeHeaders: format === 'csv' ? includeHeaders : true,
        dateFormat,
        columns,
      };

      await exportPosts(postsToExport, options, (progress) => {
        setExportProgress(progress.percentage);
      });

      setExportSuccess(true);

      // Close dialog after successful export
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const postsCount = getPostsToExport().length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Export {postsCount} posts to your preferred format</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Export selection (if posts are selected) */}
          {selectedPosts && selectedPosts.length > 0 && (
            <div className="space-y-2">
              <Label>Export Range</Label>
              <RadioGroup
                value={exportSelection}
                onValueChange={(value: 'all' | 'selected') => setExportSelection(value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal">
                    All posts ({posts.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="font-normal">
                    Selected posts ({selectedPosts.length})
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Format selection */}
          <div className="space-y-2">
            <Label>Format</Label>
            <RadioGroup value={format} onValueChange={(value: ExportFormat) => setFormat(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 font-normal">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV (Comma-separated values)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 font-normal">
                  <FileJson className="h-4 w-4" />
                  JSON (JavaScript Object Notation)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Filename */}
          <div className="space-y-2">
            <Label htmlFor="filename">Filename</Label>
            <div className="flex gap-2">
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="posts-export"
              />
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                .{format}
              </span>
            </div>
          </div>

          {/* Advanced options */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Advanced Options
            </Button>

            {showAdvanced && (
              <div className="space-y-4 pl-6">
                {/* Date format */}
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select
                    value={dateFormat}
                    onValueChange={(value: 'iso' | 'locale' | 'unix') => setDateFormat(value)}
                  >
                    <SelectTrigger id="dateFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iso">ISO 8601 (2024-01-01T00:00:00.000Z)</SelectItem>
                      <SelectItem value="locale">Locale (1/1/2024, 12:00:00 AM)</SelectItem>
                      <SelectItem value="unix">Unix Timestamp (1704067200)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* CSV Headers option */}
                {format === 'csv' && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="headers"
                      checked={includeHeaders}
                      onCheckedChange={(checked) => setIncludeHeaders(!!checked)}
                    />
                    <Label htmlFor="headers" className="font-normal">
                      Include column headers
                    </Label>
                  </div>
                )}

                {/* Column selection */}
                <div className="space-y-2">
                  <Label>Columns to Export</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 border rounded-md">
                    {defaultExportColumns.map((col) => (
                      <div key={col.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={col.key}
                          checked={selectedColumns.includes(col.key)}
                          onCheckedChange={() => handleColumnToggle(col.key)}
                        />
                        <Label htmlFor={col.key} className="font-normal text-sm">
                          {col.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export size estimate */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Estimated file size: {formattedSize}</AlertDescription>
          </Alert>

          {/* Progress indicator */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Exporting...</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}

          {/* Success message */}
          {exportSuccess && (
            <Alert className="bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                Export completed successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {exportError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || postsCount === 0}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export {postsCount} Posts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
