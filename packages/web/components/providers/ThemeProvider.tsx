'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: 'class' | 'data-theme';
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
  themes?: string[];
  forcedTheme?: string;
}

/**
 * Theme Provider Component
 * Wraps the application with theme context and manages theme transitions
 */
export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = true,
  disableTransitionOnChange = true,
  storageKey = 'fscrape-theme',
  themes = ['light', 'dark'],
  ...props
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent theme flashing by adding a class during initial load
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Add transition class after theme is set
    const enableTransitions = () => {
      root.classList.add('theme-transitions');
    };

    // Enable transitions after a short delay
    const timer = setTimeout(enableTransitions, 100);

    return () => clearTimeout(timer);
  }, [mounted]);

  return (
    <NextThemesProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
      storageKey={storageKey}
      themes={themes}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Script to prevent theme flashing on initial load
 * Should be added to the <head> of the document
 */
export function ThemeScript({
  storageKey = 'fscrape-theme',
  defaultTheme = 'system',
}: {
  storageKey?: string;
  defaultTheme?: string;
}) {
  const script = `
    (function() {
      try {
        const storageKey = '${storageKey}';
        const defaultTheme = '${defaultTheme}';
        const savedTheme = localStorage.getItem(storageKey);
        // Handle both JSON and plain string formats
        let theme;
        if (savedTheme) {
          try {
            theme = JSON.parse(savedTheme);
          } catch {
            theme = savedTheme; // Use as plain string if JSON parse fails
          }
        } else {
          theme = defaultTheme;
        }
        
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const resolvedTheme = theme === 'system' ? systemTheme : theme;
        
        document.documentElement.classList.add(resolvedTheme);
        document.documentElement.style.colorScheme = resolvedTheme;
        
        // Add data attribute for theme
        document.documentElement.setAttribute('data-theme', resolvedTheme);
      } catch (e) {
        console.error('Failed to set initial theme:', e);
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />;
}
