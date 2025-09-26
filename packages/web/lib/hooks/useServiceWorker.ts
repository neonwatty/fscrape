import { useEffect, useState, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOnline: true,
    isUpdateAvailable: false,
    registration: null,
  });

  // Check if service worker is supported
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator;
    setState((prev) => ({ ...prev, isSupported }));

    // Set online status
    setState((prev) => ({ ...prev, isOnline: navigator.onLine }));

    // Listen for online/offline events
    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if (!state.isSupported) return;
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PWA] Service worker disabled in development');
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;

    const registerServiceWorker = async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        // Register the service worker
        registration = await navigator.serviceWorker.register(`${basePath}/sw.js`, {
          scope: basePath || '/',
        });

        console.log('[PWA] Service worker registered:', registration);
        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration?.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              setState((prev) => ({ ...prev, isUpdateAvailable: true }));
              console.log('[PWA] New service worker available');
            }
          });
        });

        // Check for updates periodically (every hour)
        setInterval(
          () => {
            registration?.update();
          },
          60 * 60 * 1000
        );
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    };

    // Wait for window load to register service worker
    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker);
    }

    return () => {
      if (registration) {
        registration.unregister();
      }
    };
  }, [state.isSupported]);

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (!state.registration) return;

    // Tell waiting service worker to skip waiting
    state.registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

    // Reload page to use new service worker
    window.location.reload();
  }, [state.registration]);

  // Cache URLs manually
  const cacheUrls = useCallback((urls: string[]) => {
    if (!navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      payload: urls,
    });
  }, []);

  // Clear all caches
  const clearCache = useCallback(async () => {
    if (!('caches' in window)) return;

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('[PWA] All caches cleared');
      return true;
    } catch (error) {
      console.error('[PWA] Failed to clear caches:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    updateServiceWorker,
    cacheUrls,
    clearCache,
  };
}
