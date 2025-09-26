'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'icon' | 'dropdown';
}

export function ThemeToggle({ className, showLabel = false, variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={cn('w-9 h-9 rounded-md bg-muted animate-pulse', className)} />;
  }

  const currentTheme = theme === 'system' ? systemTheme : theme;

  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary',
            className
          )}
          aria-label="Toggle theme menu"
          aria-expanded={isOpen}
        >
          {currentTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {showLabel && <span>Theme</span>}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-48 rounded-md bg-popover border shadow-lg z-50">
              <div className="py-1">
                <button
                  onClick={() => {
                    setTheme('light');
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted transition-colors',
                    theme === 'light' && 'bg-muted'
                  )}
                >
                  <Sun className="h-4 w-4" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted transition-colors',
                    theme === 'dark' && 'bg-muted'
                  )}
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => {
                    setTheme('system');
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-muted transition-colors',
                    theme === 'system' && 'bg-muted'
                  )}
                >
                  <Monitor className="h-4 w-4" />
                  <span>System</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Icon variant - cycles through themes
  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'relative p-2 rounded-md transition-colors',
        'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary',
        className
      )}
      aria-label={`Current theme: ${theme}. Click to change theme`}
    >
      <Sun
        className={cn(
          'h-5 w-5 transition-all',
          currentTheme === 'dark' ? 'scale-0 rotate-90' : 'scale-100 rotate-0'
        )}
      />
      <Moon
        className={cn(
          'absolute top-2 left-2 h-5 w-5 transition-all',
          currentTheme === 'dark' ? 'scale-100 rotate-0' : 'scale-0 -rotate-90'
        )}
      />
      {showLabel && <span className="sr-only">Toggle theme</span>}
    </button>
  );
}

// Mobile-optimized theme toggle
export function MobileThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full h-10 bg-muted animate-pulse rounded-md" />;
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className={cn('flex rounded-md bg-muted p-1', className)}>
      {themes.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              theme === t.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label={`Set theme to ${t.label}`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
