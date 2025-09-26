import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Navigation history management
export class NavigationHistory {
  private history: string[] = [];
  private maxSize: number;

  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }

  push(path: string) {
    // Don't add duplicate consecutive entries
    if (this.history[this.history.length - 1] === path) return;

    this.history.push(path);

    // Keep history size limited
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  goBack(): string | null {
    if (this.history.length <= 1) return null;
    this.history.pop(); // Remove current
    return this.history.pop() || null; // Return and remove previous
  }

  canGoBack(): boolean {
    return this.history.length > 1;
  }

  clear() {
    this.history = [];
  }

  getHistory(): string[] {
    return [...this.history];
  }
}

// Hook for managing navigation history
export function useNavigationHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const [history] = useState(() => new NavigationHistory());

  useEffect(() => {
    history.push(pathname);
  }, [pathname, history]);

  const goBack = () => {
    const previousPath = history.goBack();
    if (previousPath) {
      router.push(previousPath);
    } else {
      router.back();
    }
  };

  return {
    goBack,
    canGoBack: history.canGoBack(),
    history: history.getHistory(),
  };
}

// Hook for keyboard navigation
export function useKeyboardNavigation(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      // Build shortcut string
      let shortcut = '';
      if (ctrl) shortcut += 'ctrl+';
      if (shift) shortcut += 'shift+';
      if (alt) shortcut += 'alt+';
      shortcut += key;

      // Execute shortcut if exists
      if (shortcuts[shortcut]) {
        event.preventDefault();
        shortcuts[shortcut]();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [shortcuts]);
}

// Hook for scroll position restoration
export function useScrollRestoration(key?: string) {
  const pathname = usePathname();
  const storageKey = `scroll-position-${key || pathname}`;

  useEffect(() => {
    // Restore scroll position
    const savedPosition = sessionStorage.getItem(storageKey);
    if (savedPosition) {
      const { x, y } = JSON.parse(savedPosition);
      window.scrollTo(x, y);
    }

    // Save scroll position before leaving
    const saveScrollPosition = () => {
      sessionStorage.setItem(storageKey, JSON.stringify({ x: window.scrollX, y: window.scrollY }));
    };

    window.addEventListener('beforeunload', saveScrollPosition);
    return () => window.removeEventListener('beforeunload', saveScrollPosition);
  }, [storageKey]);
}

// Navigation route configuration
export interface RouteConfig {
  path: string;
  name: string;
  icon?: string;
  children?: RouteConfig[];
  meta?: {
    requiresAuth?: boolean;
    roles?: string[];
    title?: string;
    description?: string;
  };
}

// Build breadcrumb trail from route config
export function buildBreadcrumbs(pathname: string, routes: RouteConfig[]) {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: { name: string; href: string }[] = [];

  let currentPath = '';
  let currentRoutes = routes;

  for (const segment of segments) {
    currentPath += `/${segment}`;

    const route = currentRoutes.find((r) => {
      const routeSegment = r.path.split('/').pop();
      return routeSegment === segment || routeSegment === `[${segment}]`;
    });

    if (route) {
      breadcrumbs.push({
        name: route.name,
        href: currentPath,
      });

      if (route.children) {
        currentRoutes = route.children;
      }
    } else {
      // Dynamic segment - try to format nicely
      const name = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      breadcrumbs.push({
        name,
        href: currentPath,
      });
    }
  }

  return breadcrumbs;
}

// Check if a route is active
export function isRouteActive(pathname: string, routePath: string, exact = false) {
  if (exact) {
    return pathname === routePath;
  }

  // Handle root path specially
  if (routePath === '/') {
    return pathname === '/';
  }

  return pathname.startsWith(routePath);
}

// Format dynamic route parameters
export function formatRouteParams(route: string, params: Record<string, string>) {
  let formattedRoute = route;

  Object.entries(params).forEach(([key, value]) => {
    formattedRoute = formattedRoute.replace(`[${key}]`, value);
  });

  return formattedRoute;
}

// Prefetch multiple routes
export function prefetchRoutes(router: { prefetch: (route: string) => void }, routes: string[]) {
  routes.forEach((route) => {
    router.prefetch(route);
  });
}

// Navigation guards
export interface NavigationGuard {
  canActivate: (to: string, from: string) => boolean | Promise<boolean>;
  redirectTo?: string;
}

export function useNavigationGuard(guard: NavigationGuard) {
  const pathname = usePathname();
  const router = useRouter();
  const [previousPath, setPreviousPath] = useState(pathname);

  useEffect(() => {
    const checkGuard = async () => {
      const canActivate = await guard.canActivate(pathname, previousPath);

      if (!canActivate) {
        if (guard.redirectTo) {
          router.push(guard.redirectTo);
        } else {
          router.back();
        }
      } else {
        setPreviousPath(pathname);
      }
    };

    if (pathname !== previousPath) {
      checkGuard();
    }
  }, [pathname, previousPath, guard, router]);
}

// Smart link prefetching based on viewport
export function useSmartPrefetch(links: string[]) {
  const router = useRouter();

  useEffect(() => {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const href = entry.target.getAttribute('href');
              if (href && links.includes(href)) {
                router.prefetch(href);
              }
            }
          });
        },
        { rootMargin: '50px' }
      );

      // Observe all links
      const linkElements = document.querySelectorAll('a[href]');
      linkElements.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && links.includes(href)) {
          observer.observe(link);
        }
      });

      return () => observer.disconnect();
    }
  }, [links, router]);
}
