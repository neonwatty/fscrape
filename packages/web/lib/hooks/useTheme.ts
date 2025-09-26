'use client';

import { useTheme as useNextTheme } from 'next-themes';
import { useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
}

interface UseThemeReturn {
  theme: Theme | undefined;
  setTheme: (theme: Theme) => void;
  systemTheme: 'light' | 'dark' | undefined;
  themes: Theme[];
  resolvedTheme: 'light' | 'dark' | undefined;
  mounted: boolean;
  isLoading: boolean;
  toggleTheme: () => void;
  cycleTheme: () => void;
  isLight: boolean;
  isDark: boolean;
  isSystem: boolean;
  themeColors: ThemeColors | null;
}

/**
 * Custom hook for advanced theme management
 * Extends next-themes with additional utilities
 */
export function useTheme(): UseThemeReturn {
  const { theme, setTheme: setNextTheme, systemTheme, themes, resolvedTheme } = useNextTheme();

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Extract CSS variables for current theme
  useEffect(() => {
    if (!mounted) return;

    const extractColors = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);

      const getColor = (varName: string) => {
        const hslValue = computedStyle.getPropertyValue(`--${varName}`).trim();
        return hslValue ? `hsl(${hslValue})` : '';
      };

      setThemeColors({
        background: getColor('background'),
        foreground: getColor('foreground'),
        card: getColor('card'),
        cardForeground: getColor('card-foreground'),
        popover: getColor('popover'),
        popoverForeground: getColor('popover-foreground'),
        primary: getColor('primary'),
        primaryForeground: getColor('primary-foreground'),
        secondary: getColor('secondary'),
        secondaryForeground: getColor('secondary-foreground'),
        muted: getColor('muted'),
        mutedForeground: getColor('muted-foreground'),
        accent: getColor('accent'),
        accentForeground: getColor('accent-foreground'),
        destructive: getColor('destructive'),
        destructiveForeground: getColor('destructive-foreground'),
        border: getColor('border'),
        input: getColor('input'),
        ring: getColor('ring'),
        radius: computedStyle.getPropertyValue('--radius').trim(),
      });
    };

    // Extract colors after theme changes
    extractColors();

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          extractColors();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [mounted, resolvedTheme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setIsLoading(true);
      setNextTheme(newTheme);

      // Simulate loading for smooth transition
      setTimeout(() => {
        setIsLoading(false);
      }, 150);
    },
    [setNextTheme]
  );

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const cycleTheme = useCallback(() => {
    const themeOrder: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themeOrder.indexOf(theme as Theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  }, [theme, setTheme]);

  const isLight = resolvedTheme === 'light';
  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  return {
    theme: theme as Theme | undefined,
    setTheme,
    systemTheme: systemTheme as 'light' | 'dark' | undefined,
    themes: themes as Theme[],
    resolvedTheme: resolvedTheme as 'light' | 'dark' | undefined,
    mounted,
    isLoading,
    toggleTheme,
    cycleTheme,
    isLight,
    isDark,
    isSystem,
    themeColors,
  };
}

/**
 * Hook to apply theme-aware styles
 */
export function useThemeStyles() {
  const { resolvedTheme, mounted } = useTheme();

  const getThemeStyles = useCallback(
    (lightStyles: Record<string, unknown>, darkStyles: Record<string, unknown>) => {
      if (!mounted) return {};
      return resolvedTheme === 'dark' ? darkStyles : lightStyles;
    },
    [mounted, resolvedTheme]
  );

  const getThemeValue = useCallback(
    <T>(lightValue: T, darkValue: T): T => {
      if (!mounted) return lightValue;
      return resolvedTheme === 'dark' ? darkValue : lightValue;
    },
    [mounted, resolvedTheme]
  );

  return {
    getThemeStyles,
    getThemeValue,
  };
}

/**
 * Hook for theme-aware media queries
 */
export function useThemeMediaQuery() {
  const [prefersDark, setPrefersDark] = useState(false);
  const [prefersLight, setPrefersLight] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const lightQuery = window.matchMedia('(prefers-color-scheme: light)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');

    const updatePreferences = () => {
      setPrefersDark(darkQuery.matches);
      setPrefersLight(lightQuery.matches);
      setPrefersReducedMotion(motionQuery.matches);
      setPrefersHighContrast(contrastQuery.matches);
    };

    updatePreferences();

    darkQuery.addEventListener('change', updatePreferences);
    lightQuery.addEventListener('change', updatePreferences);
    motionQuery.addEventListener('change', updatePreferences);
    contrastQuery.addEventListener('change', updatePreferences);

    return () => {
      darkQuery.removeEventListener('change', updatePreferences);
      lightQuery.removeEventListener('change', updatePreferences);
      motionQuery.removeEventListener('change', updatePreferences);
      contrastQuery.removeEventListener('change', updatePreferences);
    };
  }, []);

  return {
    prefersDark,
    prefersLight,
    prefersReducedMotion,
    prefersHighContrast,
  };
}
