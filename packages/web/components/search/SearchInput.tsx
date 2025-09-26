'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SearchSuggestion, getSearchSuggestions } from '@/lib/db/search-queries';

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  className?: string;
  showSuggestions?: boolean;
  debounceMs?: number;
  autoFocus?: boolean;
  loading?: boolean;
}

export function SearchInput({
  value = '',
  onChange,
  onSearch,
  placeholder = 'Search posts...',
  className,
  showSuggestions = true,
  debounceMs = 300,
  autoFocus = false,
  loading = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionsPopover, setShowSuggestionsPopover] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update internal value when prop changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Debounced search handler
  const debouncedSearch = useCallback(
    (searchValue: string) => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        onChange?.(searchValue);
        onSearch?.(searchValue);
      }, debounceMs);
    },
    [onChange, onSearch, debounceMs]
  );

  // Load suggestions
  const loadSuggestions = useCallback(
    async (query: string) => {
      if (!showSuggestions || query.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const results = getSearchSuggestions(query, 8);
        setSuggestions(results);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [showSuggestions]
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    debouncedSearch(newValue);

    if (showSuggestions) {
      loadSuggestions(newValue);
      setShowSuggestionsPopover(newValue.length > 0);
    }
  };

  // Handle clear
  const handleClear = () => {
    setInternalValue('');
    setSuggestions([]);
    setShowSuggestionsPopover(false);
    onChange?.('');
    onSearch?.('');
    inputRef.current?.focus();
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const newValue = suggestion.term;
    setInternalValue(newValue);
    setSuggestions([]);
    setShowSuggestionsPopover(false);
    onChange?.(newValue);
    onSearch?.(newValue);
  };

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch?.(internalValue);
      setShowSuggestionsPopover(false);
    } else if (e.key === 'Escape') {
      setShowSuggestionsPopover(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const getSuggestionTypeColor = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'title':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'author':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'tag':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
      default:
        return '';
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Popover open={showSuggestionsPopover} onOpenChange={setShowSuggestionsPopover}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              value={internalValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (showSuggestions && internalValue.length > 0) {
                  loadSuggestions(internalValue);
                  setShowSuggestionsPopover(true);
                }
              }}
              placeholder={placeholder}
              className="pl-9 pr-20"
              autoFocus={autoFocus}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {internalValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleClear}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Clear search</span>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => onSearch?.(internalValue)}
              >
                Search
              </Button>
            </div>
          </div>
        </PopoverTrigger>
        {showSuggestions && suggestions.length > 0 && (
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="max-h-[300px] overflow-y-auto">
              {isLoadingSuggestions ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <div className="py-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.type}-${suggestion.term}-${index}`}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <span className="truncate">{suggestion.term}</span>
                      <div className="ml-2 flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', getSuggestionTypeColor(suggestion.type))}
                        >
                          {suggestion.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{suggestion.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
