/**
 * Service Worker TypeScript utilities for PWA functionality
 * Provides typed interfaces and helper functions for service worker management
 */

export interface ServiceWorkerConfig {
  scope?: string;
  updateViaCache?: 'all' | 'imports' | 'none';
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export interface CacheConfig {
  version: string;
  caches: {
    static: string;
    runtime: string;
    database: string;
  };
  maxAge?: number;
  maxEntries?: number;
}

export interface BackgroundSyncConfig {
  tags: string[];
  minInterval?: number;
  maxRetries?: number;
}

/**
 * Register service worker with configuration
 */
export async function registerServiceWorker(
  swUrl = '/sw.js',
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Service Worker] Not supported in this browser');
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: config.scope || '/',
      updateViaCache: config.updateViaCache || 'none',
    });

    console.log('[Service Worker] Registration successful:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          if (config.onUpdate) {
            config.onUpdate(registration);
          }
        } else if (newWorker.state === 'activated') {
          // Service worker activated
          if (config.onSuccess) {
            config.onSuccess(registration);
          }
        }
      });
    });

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60000); // Check every minute

    return registration;
  } catch (error) {
    console.error('[Service Worker] Registration failed:', error);
    if (config.onError) {
      config.onError(error as Error);
    }
    return undefined;
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorkers(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const results = await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
    return results.every((result) => result === true);
  } catch (error) {
    console.error('[Service Worker] Unregistration failed:', error);
    return false;
  }
}

/**
 * Send message to service worker
 */
export async function sendMessageToSW(message: unknown): Promise<unknown> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }

  const registration = await navigator.serviceWorker.ready;

  if (!registration.active) {
    throw new Error('No active service worker');
  }

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data);
      }
    };

    registration.active!.postMessage(message, [messageChannel.port2]);
  });
}

/**
 * Skip waiting for new service worker
 */
export async function skipWaiting(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Cache URLs programmatically
 */
export async function cacheUrls(urls: string[]): Promise<void> {
  await sendMessageToSW({
    type: 'CACHE_URLS',
    payload: urls,
  });
}

/**
 * Clear specific cache
 */
export async function clearCache(cacheName?: string): Promise<boolean> {
  if (!('caches' in window)) {
    return false;
  }

  try {
    if (cacheName) {
      return await caches.delete(cacheName);
    } else {
      const cacheNames = await caches.keys();
      const results = await Promise.all(cacheNames.map((name) => caches.delete(name)));
      return results.every((result) => result === true);
    }
  } catch (error) {
    console.error('[Service Worker] Cache clearing failed:', error);
    return false;
  }
}

/**
 * Get cache storage estimate
 */
export async function getCacheStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
} | null> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;

    return {
      usage,
      quota,
      percentage: quota > 0 ? (usage / quota) * 100 : 0,
    };
  } catch (error) {
    console.error('[Service Worker] Storage estimate failed:', error);
    return null;
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    console.log(`[Service Worker] Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  } catch (error) {
    console.error('[Service Worker] Persistent storage request failed:', error);
    return false;
  }
}

/**
 * Register background sync
 */
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    console.warn('[Service Worker] Background sync not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (
      registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }
    ).sync.register(tag);
    console.log(`[Service Worker] Background sync registered: ${tag}`);
  } catch (error) {
    console.error('[Service Worker] Background sync registration failed:', error);
  }
}

/**
 * Check if service worker is ready
 */
export async function isServiceWorkerReady(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return !!registration.active;
  } catch {
    return false;
  }
}

/**
 * Get service worker state
 */
export function getServiceWorkerState(): {
  supported: boolean;
  controller: ServiceWorker | null;
  ready: Promise<ServiceWorkerRegistration>;
} | null {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  return {
    supported: true,
    controller: navigator.serviceWorker.controller,
    ready: navigator.serviceWorker.ready,
  };
}

/**
 * Monitor network status
 */
export function monitorNetworkStatus(onOnline?: () => void, onOffline?: () => void): () => void {
  const handleOnline = () => {
    console.log('[Network] Online');
    if (onOnline) onOnline();
  };

  const handleOffline = () => {
    console.log('[Network] Offline');
    if (onOffline) onOffline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Check if app is installed as PWA
 */
export function isPWAInstalled(): boolean {
  // Check for display mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check for iOS standalone
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return true;
  }

  // Check for Samsung Internet
  if (document.referrer.includes('android-app://')) {
    return true;
  }

  return false;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
